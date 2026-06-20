// backend/db.js - 数据库连接 + 工具函数
const { Client } = require('pg');
const logger = require('./utils/logger');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

// 全局配置缓存
let _configCache = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 30000;

async function getConfig(key) {
  if (!_configCache || Date.now() - _configCacheTime > CONFIG_CACHE_TTL) {
    await _refreshConfigCache();
  }
  return _configCache[key] !== undefined ? _configCache[key] : null;
}

async function getAllConfig() {
  if (!_configCache || Date.now() - _configCacheTime > CONFIG_CACHE_TTL) {
    await _refreshConfigCache();
  }
  return { ..._configCache };
}

async function _refreshConfigCache() {
  const result = await client.query('SELECT key, value FROM global_config');
  _configCache = {};
  for (const row of result.rows) _configCache[row.key] = row.value;
  _configCacheTime = Date.now();
}

function clearConfigCache() { _configCache = null; }

// 货币工具
async function deductCurrency(userId, type, amount) {
  const validTypes = ['silver_coin', 'gold_coin', 'diamond'];
  if (!validTypes.includes(type)) throw new Error('Invalid currency type');
  if (amount <= 0) throw new Error('Amount must be positive');
  const result = await client.query(
    `UPDATE currencies SET ${type} = ${type} - $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND ${type} >= $1 RETURNING *`,
    [amount, userId]
  );
  if (result.rowCount === 0) throw new Error('Insufficient balance');
  return result.rows[0];
}

async function addCurrency(userId, type, amount) {
  const validTypes = ['silver_coin', 'gold_coin', 'diamond'];
  if (!validTypes.includes(type)) throw new Error('Invalid currency type');
  if (amount <= 0) throw new Error('Amount must be positive');
  const result = await client.query(
    `UPDATE currencies SET ${type} = ${type} + $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING *`,
    [amount, userId]
  );
  if (result.rowCount === 0) throw new Error('User currency record not found');
  return result.rows[0];
}

async function createOrder(userId, type, currencyType, amount) {
  const result = await client.query(
    'INSERT INTO orders (user_id, type, currency_type, amount) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, type, currencyType, amount]
  );
  return result.rows[0];
}

async function getUserItemCount(userId, itemId) {
  const result = await client.query('SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, itemId]);
  return result.rowCount > 0 ? result.rows[0].quantity : 0;
}

async function generateUserId(role) {
  if (role === 'admin') {
    const r = await client.query("SELECT MAX(id::integer) as max_id FROM users WHERE role = 'admin' AND id::integer % 2 = 1");
    return r.rows[0].max_id ? r.rows[0].max_id + 2 : 1;
  } else {
    const r = await client.query("SELECT MAX(id::integer) as max_id FROM users WHERE role = 'user' AND id::integer % 2 = 0");
    return r.rows[0].max_id ? r.rows[0].max_id + 2 : 2;
  }
}

// 饱食度懒计算
async function calcCurrentHunger(pet) {
  const maxHunger = await getConfig('hunger_max') || 100;
  if (pet.is_test) return { currentHunger: maxHunger, growthGained: 0, maxHunger };
  if (!pet.last_fed_at) return { currentHunger: pet.hunger || 0, growthGained: 0 };
  const interval = await getConfig('hunger_decay_interval') || 5;
  const elapsed = Date.now() - new Date(pet.last_fed_at).getTime();
  const decay = Math.floor(elapsed / (interval * 1000));
  const currentHunger = Math.max(0, (pet.hunger || 0) - decay);
  const growthGained = Math.min(decay, pet.hunger || 0);
  return { currentHunger, growthGained, maxHunger };
}

// 宠物加成计算（查表）
async function calcPetBonusFromCurve(pet, petTemplate) {
  const { currentHunger } = await calcCurrentHunger(pet);
  if (currentHunger <= 0) return 0;
  if (petTemplate.is_test) return 1000;
  const bonusCurve = petTemplate.bonus_curve;
  if (bonusCurve && Array.isArray(bonusCurve)) {
    const idx = Math.min(pet.level - 1, bonusCurve.length - 1);
    return bonusCurve[idx] || 0;
  }
  return Number(petTemplate.base_bonus) * pet.level;
}

async function getPetBonus(userId) {
  try {
    const result = await client.query(
      `SELECT up.*, p.rarity, p.base_bonus, p.name, p.icon, p.bonus_curve, p.is_test, p.effect_file
       FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.user_id = $1 AND up.is_active = true`, [userId]);
    if (result.rowCount === 0) return 0;
    const pet = result.rows[0];
    const { currentHunger } = await calcCurrentHunger(pet);
    if (currentHunger <= 0) return 0;
    let bonus = await calcPetBonusFromCurve(pet, pet);
    const equipped = pet.equipped_decorations || {};
    for (const [, decId] of Object.entries(equipped)) {
      const decResult = await client.query('SELECT bonus FROM decorations WHERE id = $1', [decId]);
      if (decResult.rowCount > 0) bonus += Number(decResult.rows[0].bonus);
    }
    const cap = await getConfig('pet_deco_bonus_cap') || 120;
    const finalBonus = pet.is_test ? bonus : Math.min(bonus, cap);
    return Math.round(finalBonus * 100) / 100;
  } catch (error) {
    logger.error('getPetBonus error:', { error: error.message });
    return 0;
  }
}

async function formatPetData(pet, petTemplate) {
  const { currentHunger, maxHunger } = await calcCurrentHunger(pet);
  const growthCurve = petTemplate.growth_curve;
  const nextLevelThreshold = (growthCurve && Array.isArray(growthCurve) && pet.level < 10) ? growthCurve[pet.level] : null;
  const bonus = currentHunger > 0 ? await calcPetBonusFromCurve(pet, petTemplate) : 0;
  let decorationBonus = 0;
  const equipped = pet.equipped_decorations || {};
  for (const [, decId] of Object.entries(equipped)) {
    const decResult = await client.query('SELECT bonus FROM decorations WHERE id = $1', [decId]);
    if (decResult.rowCount > 0) decorationBonus += Number(decResult.rows[0].bonus);
  }
  const cap = await getConfig('pet_deco_bonus_cap') || 120;
  const totalBonus = pet.is_test ? (bonus + decorationBonus) : Math.min(bonus + decorationBonus, cap);
  return {
    user_pet_id: pet.id, pet_id: pet.pet_id, name: petTemplate.name, icon: petTemplate.icon,
    pixel_art: petTemplate.pixel_art, rarity: petTemplate.rarity, level: pet.level,
    growth_points: pet.growth_points, next_level_threshold: nextLevelThreshold,
    hunger: currentHunger, max_hunger: maxHunger || 100, is_active: pet.is_active,
    base_bonus: Number(petTemplate.base_bonus),
    level_bonus: Math.round(bonus * 100) / 100,
    current_bonus: Math.round(totalBonus * 100) / 100,
    equipped_decorations: pet.equipped_decorations || {}, last_fed_at: pet.last_fed_at,
    is_test: petTemplate.is_test || false, effect_file: petTemplate.effect_file || null,
    created_at: pet.created_at
  };
}

const PET_FOOD_EFFECTS = {
  '普通粮': { growth: 30, hunger: 20 },
  '精良粮': { growth: 60, hunger: 40 },
  '高级粮': { growth: 100, hunger: 60 },
  '稀有粮': { growth: 200, hunger: 100 }
};

// ========== 共享常量 ==========
const STAGE_ICONS = ['🥜', '🌱', '🌿', '🌻'];
const PLOT_LEVEL_MULTIPLIER = { 1: 1.0, 2: 1.1, 3: 1.3, 4: 1.5, 5: 1.8 };
const SHOP_TAB_MAP = { seeds: 'seed', fertilizers: 'fertilizer', pets: 'pet', pet_food: 'pet_food', decorations: 'decoration' };
const BUILTIN_EFFECTS = ['bubble-fish.js', 'cat-paw.js', 'star-rabbit.js', 'thunder-eagle.js', 'crystal-dragon.js', 'lbooktest.js'];

// ========== 共享工具函数 ==========
async function getUnlockCost(plotIndex) {
  const key = `plot_unlock_${plotIndex}`;
  const amount = await getConfig(key);
  if (amount === null) return null;
  let type = 'silver_coin';
  if (plotIndex >= 3 && plotIndex <= 4) type = 'gold_coin';
  if (plotIndex >= 5) type = 'diamond';
  return { type, amount };
}

async function getUpgradeCost(nextLevel) {
  const key = `plot_upgrade_${nextLevel - 1}_${nextLevel}`;
  const amount = await getConfig(key);
  if (amount === null) return null;
  let type = 'silver_coin';
  if (nextLevel === 2) type = 'silver_coin';
  if (nextLevel === 3 || nextLevel === 4) type = 'gold_coin';
  if (nextLevel === 5) type = 'diamond';
  return { type, amount };
}

function calcDiscountRate(amount) {
  if (amount <= 100) return 0.8;
  if (amount <= 500) return 0.6;
  return 0.5;
}

module.exports = {
  client, logger, getConfig, getAllConfig, clearConfigCache,
  deductCurrency, addCurrency, createOrder, getUserItemCount, generateUserId,
  calcCurrentHunger, calcPetBonusFromCurve, getPetBonus, formatPetData,
  PET_FOOD_EFFECTS, MAX_POINTS: 999999999,
  STAGE_ICONS, PLOT_LEVEL_MULTIPLIER, SHOP_TAB_MAP, BUILTIN_EFFECTS,
  getUnlockCost, getUpgradeCost, calcDiscountRate
};

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';


// 连接 PostgreSQL 数据库
logger.info('Connecting to PostgreSQL with URL:', { url: process.env.DATABASE_URL });
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

// 常量
const MAX_POINTS = 999999999;

// ========== 全局配置缓存 ==========
let _configCache = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 30000; // 30秒

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
  for (const row of result.rows) {
    _configCache[row.key] = row.value;
  }
  _configCacheTime = Date.now();
}

// ========== 全局配置默认值 ==========
const GLOBAL_CONFIG_DEFAULTS = [
  ['exchange_silver_to_gold', 1000, '银→金 汇率'],
  ['exchange_gold_to_silver', 600, '金→银 汇率'],
  ['gift_daily_limit_silver', 500, '每日礼物接收上限'],
  ['friend_gift_cooldown_hours', 24, '好友互送冷却（小时）'],
  ['account_gift_cooldown_hours', 24, '新号送礼冷却（小时）'],
  ['plot_unlock_2', 3000, '地块#2解锁费用'],
  ['plot_unlock_2_type', 'silver_coin', '地块#2解锁货币类型'],
  ['plot_unlock_3', 3000, '地块#3解锁费用'],
  ['plot_unlock_3_type', 'gold_coin', '地块#3解锁货币类型'],
  ['plot_unlock_4', 8000, '地块#4解锁费用'],
  ['plot_unlock_4_type', 'gold_coin', '地块#4解锁货币类型'],
  ['plot_unlock_5', 50, '地块#5解锁费用'],
  ['plot_unlock_5_type', 'diamond', '地块#5解锁货币类型'],
  ['plot_unlock_6', 100, '地块#6解锁费用'],
  ['plot_unlock_6_type', 'diamond', '地块#6解锁货币类型'],
  ['plot_upgrade_1_2', 10000, 'Lv1→2升级费用'],
  ['plot_upgrade_1_2_type', 'silver_coin', 'Lv1→2升级货币类型'],
  ['plot_upgrade_2_3', 5000, 'Lv2→3升级费用'],
  ['plot_upgrade_2_3_type', 'gold_coin', 'Lv2→3升级货币类型'],
  ['plot_upgrade_3_4', 30000, 'Lv3→4升级费用'],
  ['plot_upgrade_3_4_type', 'gold_coin', 'Lv3→4升级货币类型'],
  ['plot_upgrade_4_5', 50, 'Lv4→5升级费用'],
  ['plot_upgrade_4_5_type', 'diamond', 'Lv4→5升级货币类型'],
  ['hunger_max', 100, '饱食度上限'],
  ['hunger_decay_interval', 5, '饱食度衰减间隔（秒）'],
  ['pet_deco_bonus_cap', 120, '宠物+饰品加成上限%'],
  ['sss_drop_base', 0.33, 'SSS 基础掉落率'],
  ['sss_drop_cap', 1.0, 'SSS 掉落率上限'],
  ['yield_accumulator_threshold', 10, '累加值触发阈值'],
  ['max_seed_count', 999, '种子上限'],
  ['max_crop_count', 9999, '作物上限'],
  ['max_fertilizer_count', 99, '肥料上限'],
  ['max_pet_food_count', 999, '宠物粮上限'],
];

// 生成用户ID的函数
async function generateUserId(role) {
  if (role === 'admin') {
    const maxAdminIdResult = await client.query('SELECT MAX(id::integer) as max_id FROM users WHERE role = \'admin\' AND id::integer % 2 = 1');
    const maxAdminId = maxAdminIdResult.rows[0].max_id;
    return maxAdminId ? maxAdminId + 2 : 1;
  } else {
    const maxUserIdResult = await client.query('SELECT MAX(id::integer) as max_id FROM users WHERE role = \'user\' AND id::integer % 2 = 0');
    const maxUserId = maxUserIdResult.rows[0].max_id;
    return maxUserId ? maxUserId + 2 : 2;
  }
}

// ========== 货币工具函数 ==========

async function deductCurrency(userId, type, amount) {
  const validTypes = ['silver_coin', 'gold_coin', 'diamond'];
  if (!validTypes.includes(type)) throw new Error('Invalid currency type');
  if (amount <= 0) throw new Error('Amount must be positive');

  const result = await client.query(
    `UPDATE currencies SET ${type} = ${type} - $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND ${type} >= $1 RETURNING *`,
    [amount, userId]
  );
  if (result.rowCount === 0) {
    throw new Error('Insufficient balance');
  }
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
  if (result.rowCount === 0) {
    throw new Error('User currency record not found');
  }
  return result.rows[0];
}

async function createOrder(userId, type, currencyType, amount) {
  try {
    const result = await client.query(
      'INSERT INTO orders (user_id, type, currency_type, amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, type, currencyType, amount]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Create order error:', { error: error.message });
    throw error;
  }
}

// ========== 背包工具函数 ==========
async function getUserItemCount(userId, itemId) {
  const result = await client.query(
    'SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2',
    [userId, itemId]
  );
  return result.rowCount > 0 ? result.rows[0].quantity : 0;
}

// ========== 饱食度懒计算 (1.5) ==========
async function calcCurrentHunger(pet) {
  if (!pet.last_fed_at) return { currentHunger: pet.hunger || 0, growthGained: 0 };
  const interval = await getConfig('hunger_decay_interval') || 5;
  const maxHunger = await getConfig('hunger_max') || 100;
  const elapsed = Date.now() - new Date(pet.last_fed_at).getTime();
  const decay = Math.floor(elapsed / (interval * 1000));
  const currentHunger = Math.max(0, (pet.hunger || 0) - decay);
  const growthGained = Math.min(decay, pet.hunger || 0);
  return { currentHunger, growthGained, maxHunger };
}

// ========== 宠物加成计算（查表 bonus_curve）(1.3) ==========
async function calcPetBonusFromCurve(pet, petTemplate) {
  const currentHunger = (await calcCurrentHunger(pet)).currentHunger;
  if (currentHunger <= 0) return 0;
  // LBOOKTest 直接返回 1000%
  if (petTemplate.is_test) return 1000;
  const bonusCurve = petTemplate.bonus_curve;
  if (bonusCurve && Array.isArray(bonusCurve)) {
    const idx = Math.min(pet.level - 1, bonusCurve.length - 1);
    return bonusCurve[idx] || 0;
  }
  // 回退到旧逻辑
  return Number(petTemplate.base_bonus) * pet.level;
}

// 获取用户激活宠物的加成百分比
async function getPetBonus(userId) {
  try {
    const result = await client.query(
      `SELECT up.*, p.rarity, p.base_bonus, p.name, p.icon, p.bonus_curve, p.is_test, p.effect_file
       FROM user_pets up
       JOIN pets p ON up.pet_id = p.id
       WHERE up.user_id = $1 AND up.is_active = true`,
      [userId]
    );
    if (result.rowCount === 0) return 0;

    const pet = result.rows[0];
    const { currentHunger } = await calcCurrentHunger(pet);
    if (currentHunger <= 0) return 0;

    let bonus = await calcPetBonusFromCurve(pet, pet);

    // 装饰加成叠加
    const equipped = pet.equipped_decorations || {};
    for (const [, decId] of Object.entries(equipped)) {
      const decResult = await client.query('SELECT bonus FROM decorations WHERE id = $1', [decId]);
      if (decResult.rowCount > 0) {
        bonus += Number(decResult.rows[0].bonus);
      }
    }

    // 上限检查（测试宠物跳过上限）
    if (!pet.is_test) {
      const cap = await getConfig('pet_deco_bonus_cap') || 120;
      bonus = Math.min(bonus, cap);
    }

    return Math.round(bonus * 100) / 100;
  } catch (error) {
    logger.error('getPetBonus error:', { error: error.message });
    return 0;
  }
}

// 格式化宠物数据 (1.4 用 growth_curve)
async function formatPetData(pet, petTemplate) {
  const { currentHunger, maxHunger } = await calcCurrentHunger(pet);
  const growthCurve = petTemplate.growth_curve;
  const nextLevelThreshold = (growthCurve && Array.isArray(growthCurve) && pet.level < 10)
    ? growthCurve[pet.level]  // growth_curve[当前等级] = 升到下一级所需
    : null;
  const bonus = currentHunger > 0 ? await calcPetBonusFromCurve(pet, petTemplate) : 0;

  // 计算装饰加成
  let decorationBonus = 0;
  const equipped = pet.equipped_decorations || {};
  for (const [, decId] of Object.entries(equipped)) {
    const decResult = await client.query('SELECT bonus FROM decorations WHERE id = $1', [decId]);
    if (decResult.rowCount > 0) {
      decorationBonus += Number(decResult.rows[0].bonus);
    }
  }

  const cap = await getConfig('pet_deco_bonus_cap') || 120;
  const totalBonus = pet.is_test ? (bonus + decorationBonus) : Math.min(bonus + decorationBonus, cap);

  return {
    user_pet_id: pet.id,
    pet_id: pet.pet_id,
    name: petTemplate.name,
    icon: petTemplate.icon,
    pixel_art: petTemplate.pixel_art,
    rarity: petTemplate.rarity,
    level: pet.level,
    growth_points: pet.growth_points,
    next_level_threshold: nextLevelThreshold,
    hunger: currentHunger,
    max_hunger: maxHunger || 100,
    is_active: pet.is_active,
    base_bonus: Number(petTemplate.base_bonus),
    current_bonus: Math.round(totalBonus * 100) / 100,
    equipped_decorations: pet.equipped_decorations || {},
    last_fed_at: pet.last_fed_at,

    is_test: petTemplate.is_test || false,
    effect_file: petTemplate.effect_file || null,
    created_at: pet.created_at
  };
}

// 宠物粮效果配置
const PET_FOOD_EFFECTS = {
  '普通粮': { growth: 30, hunger: 20 },
  '精良粮': { growth: 60, hunger: 40 },
  '高级粮': { growth: 100, hunger: 60 },
  '稀有粮': { growth: 200, hunger: 100 }
};

// 初始化数据库
async function initDatabase() {
  try {
    await client.connect();
    logger.info('Connected to PostgreSQL database');

    // ========== 创建 users 表（如果不存在） ==========
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        is_new_user BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 添加 admin_theme 字段 (1.1)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_theme VARCHAR(20) DEFAULT 'hub'`);

    // ========== 创建新表 ==========

    // currencies 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS currencies (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL,
        silver_coin BIGINT DEFAULT 0,
        gold_coin BIGINT DEFAULT 0,
        diamond BIGINT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // 累加值字段 (1.8)
    await client.query(`ALTER TABLE currencies ADD COLUMN IF NOT EXISTS yield_accumulator JSONB DEFAULT '{}'`);

    // garden_plots 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS garden_plots (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        plot_index INT NOT NULL,
        is_unlocked BOOLEAN DEFAULT false,
        level INT DEFAULT 1,
        seed_id INT,
        stage INT DEFAULT 0,
        planted_at TIMESTAMP,
        last_watered_at TIMESTAMP,
        is_dead BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // 施肥标记 (1.9)
    await client.query(`ALTER TABLE garden_plots ADD COLUMN IF NOT EXISTS fertilized BOOLEAN DEFAULT FALSE`);

    // items 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(50),
        rarity VARCHAR(50),
        item_type VARCHAR(50) NOT NULL,
        base_yield INT DEFAULT 0,
        buy_price INT DEFAULT 0,
        sell_price INT DEFAULT 0,
        currency_type VARCHAR(20) DEFAULT 'silver_coin',
        is_shop BOOLEAN DEFAULT true,
        crop_id INT DEFAULT NULL,
        water_cd INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (crop_id) REFERENCES items(id) ON DELETE SET NULL
      )
    `);
    // 新增字段 (1.1)
    await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS stage_skip INT DEFAULT 1`);
    await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS bonus_curve JSONB DEFAULT NULL`);
    await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS purchasable BOOLEAN DEFAULT true`);

    // user_items 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_items (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        item_id INT NOT NULL,
        quantity INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_id)
      )
    `);

    // orders 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        currency_type VARCHAR(20),
        amount BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON orders(user_id, created_at)`);

    // friendships 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        friend_id VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, friend_id)
      )
    `);

    // gifts 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        sender_id VARCHAR(50) NOT NULL,
        receiver_id VARCHAR(50) NOT NULL,
        gift_type VARCHAR(20) NOT NULL,
        item_id INT,
        currency_type VARCHAR(20),
        amount BIGINT DEFAULT 0,
        discount_rate NUMERIC(3,2) DEFAULT 1.00,
        status VARCHAR(20) DEFAULT 'accepted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id)`);

    // ========== 宠物系统表 ==========

    await client.query(`
      CREATE TABLE IF NOT EXISTS pets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(50),
        pixel_art TEXT,
        rarity VARCHAR(50) NOT NULL,
        base_bonus NUMERIC(8,2) DEFAULT 0,
        price_type VARCHAR(20) DEFAULT 'silver_coin',
        price_amount BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // 新增字段 (1.1)
    await client.query(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS is_shop BOOLEAN DEFAULT TRUE`);
    await client.query(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS purchasable BOOLEAN DEFAULT TRUE`);
    await client.query(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS bonus_curve JSONB DEFAULT NULL`);
    await client.query(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS growth_curve JSONB DEFAULT NULL`);
    await client.query(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS effect_file VARCHAR(100) DEFAULT NULL`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_pets (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        pet_id INT NOT NULL,
        level INT DEFAULT 1,
        growth_points INT DEFAULT 0,
        hunger INT DEFAULT 20,
        is_active BOOLEAN DEFAULT false,
        last_fed_at TIMESTAMP,
        feeding_end_at TIMESTAMP,
        equipped_decorations JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS decorations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(50),
        slot_type VARCHAR(50) NOT NULL,
        quality VARCHAR(50) DEFAULT 'normal',
        bonus NUMERIC(8,2) DEFAULT 0,
        price_type VARCHAR(20) DEFAULT 'silver_coin',
        price_amount BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // 专属宠物ID (1.1)
    await client.query(`ALTER TABLE decorations ADD COLUMN IF NOT EXISTS pet_id INT DEFAULT NULL`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_decorations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        decoration_id INT NOT NULL,
        quantity INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, decoration_id)
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_pets_user_id ON user_pets(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_pets_active ON user_pets(user_id, is_active) WHERE is_active = true`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_decorations_user_id ON user_decorations(user_id)`);

    // ========== global_config 表 (1.2) ==========
    await client.query(`
      CREATE TABLE IF NOT EXISTS global_config (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 初始化 global_config（如果为空）
    const configCheck = await client.query('SELECT COUNT(*) as count FROM global_config');
    if (parseInt(configCheck.rows[0].count) === 0) {
      for (const [key, value, description] of GLOBAL_CONFIG_DEFAULTS) {
        await client.query(
          'INSERT INTO global_config (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING',
          [key, JSON.stringify(value), description]
        );
      }
      logger.info('global_config initialized with defaults');
    }

    // 确保 *_type 货币类型配置项存在（即使表已有数据）
    for (const [key, value, description] of GLOBAL_CONFIG_DEFAULTS) {
      if (key.endsWith('_type')) {
        await client.query(
          'INSERT INTO global_config (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING',
          [key, JSON.stringify(value), description]
        );
      }
    }

    // ========== 修正种子/作物数据（对照 v6.0 设计文档） ==========
    const seedYieldFixes = [
      ['白菜种子', 48, 12, 3], ['土豆种子', 36, 14, 4], ['黄瓜种子', 24, 16, 6], ['胡萝卜种子', 20, 20, 8],
      ['玉米种子', 50, 40, 9], ['番茄种子', 40, 45, 11], ['蓝莓种子', 30, 55, 15], ['南瓜种子', 24, 60, 18],
      ['葡萄种子', 35, 75, 20], ['草莓种子', 25, 90, 28], ['西瓜种子', 18, 105, 38],
      ['玫瑰种子', 22, 350, 75], ['兰花种子', 16, 400, 100],
      ['金盏花种子', 2, 0, 1], ['星尘花种子', 1, 0, 2],
    ];
    for (const [name, yld, buy, sell] of seedYieldFixes) {
      await client.query('UPDATE items SET base_yield = $1, buy_price = $2, sell_price = $3 WHERE name = $4 AND item_type = $5', [yld, buy, sell, name, 'seed']);
    }
    const cropYieldFixes = [
      ['白菜', 48, 12, 3], ['土豆', 36, 14, 4], ['黄瓜', 24, 16, 6], ['胡萝卜', 20, 20, 8],
      ['玉米', 50, 40, 9], ['番茄', 40, 45, 11], ['蓝莓', 30, 55, 15], ['南瓜', 24, 60, 18],
      ['葡萄', 35, 75, 20], ['草莓', 25, 90, 28], ['西瓜', 18, 105, 38],
      ['玫瑰', 22, 350, 75], ['兰花', 16, 400, 100],
      ['金盏花', 2, 0, 1], ['星尘花', 1, 0, 2],
    ];
    for (const [name, yld, buy, sell] of cropYieldFixes) {
      await client.query('UPDATE items SET base_yield = $1, buy_price = $2, sell_price = $3 WHERE name = $4 AND item_type = $5', [yld, buy, sell, name, 'crop']);
    }
    // 补生菜（如果不存在）
    const lettuceCheck = await client.query("SELECT id FROM items WHERE name = '生菜种子' AND item_type = 'seed'");
    if (lettuceCheck.rowCount === 0) {
      const lr = await client.query("INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, water_cd) VALUES ('生菜', '🥬', 'C', 'crop', 1, 50, 5, 'silver_coin', true, 5) RETURNING id");
      await client.query("INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, water_cd, crop_id) VALUES ('生菜种子', '🥬', 'C', 'seed', 1, 50, 5, 'silver_coin', true, 5, $1)", [lr.rows[0].id]);
    }
    // 所有种子浇水CD统一为5秒
    await client.query("UPDATE items SET water_cd = 5 WHERE item_type = 'seed'");
    logger.info('Seed/crop data synced with v6.0 design doc');

    // ========== 插入宠物模板数据 (1.3 更新 bonus_curve/growth_curve) ==========
    const petsCheck = await client.query('SELECT COUNT(*) as count FROM pets');
    if (parseInt(petsCheck.rows[0].count) === 0) {
      const petTemplates = [
        ['泡泡鱼', '🐟', '🐟', 'B', 4.00, 'diamond', 80, false,
          [4,6,8,11,14,18,22,27,33,40],
          [0,100,150,200,300,400,550,700,900,1200],
          null],
        ['小豆猫', '🐱', '🐱', 'B', 4.00, 'diamond', 80, false,
          [4,6,8,11,14,18,22,27,33,40],
          [0,100,150,200,300,400,550,700,900,1200],
          null],
        ['星光兔', '🐰', '🐰', 'A', 6.00, 'diamond', 200, false,
          [6,10,14,19,24,30,36,43,51,60],
          [0,100,150,200,300,400,550,700,900,1200],
          null],
        ['雷霆鹰', '🦅', '🦅', 'A', 6.00, 'diamond', 200, false,
          [6,10,14,19,24,30,36,43,51,60],
          [0,100,150,200,300,400,550,700,900,1200],
          null],
        ['水晶龙', '🐉', '🐉', 'S', 10.00, 'diamond', 600, false,
          [10,15,20,26,32,39,47,56,67,80],
          [0,100,150,200,300,400,550,700,900,1200],
          null],
        ['LBOOKTest', '🐼', '🐼', 'SSR', 1000.00, 'diamond', 999999, true,
          [1000,1000,1000,1000,1000,1000,1000,1000,1000,1000],
          [0,100,150,200,300,400,550,700,900,1200],
          'lbooktest.js'],
      ];
      for (const p of petTemplates) {
        await client.query(
          `INSERT INTO pets (name, icon, pixel_art, rarity, base_bonus, price_type, price_amount, is_test, bonus_curve, growth_curve, effect_file)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          p
        );
      }
      // LBOOKTest 不可购买
      await client.query("UPDATE pets SET is_shop = false, purchasable = false WHERE name = 'LBOOKTest'");
      logger.info('Pet template data inserted with v6 curves');
    } else {
      // 已有数据：更新 bonus_curve, growth_curve, is_test, effect_file (1.3)
      // 迁移旧稀有度值
      await client.query(`UPDATE pets SET rarity = 'B' WHERE rarity = 'common'`);
      await client.query(`UPDATE pets SET rarity = 'A' WHERE rarity = 'rare'`);
      await client.query(`UPDATE pets SET rarity = 'S' WHERE rarity = 'epic'`);
      await client.query(`UPDATE pets SET rarity = 'SSR' WHERE rarity = 'legendary' AND name = 'LBOOKTest'`);
      await client.query(`UPDATE pets SET rarity = 'S' WHERE rarity = 'legendary' AND name != 'LBOOKTest'`);
      await client.query(`UPDATE pets SET bonus_curve = '[4,6,8,11,14,18,22,27,33,40]'::jsonb, growth_curve = '[0,100,150,200,300,400,550,700,900,1200]'::jsonb, base_bonus = 4.00, price_type = 'diamond', price_amount = 80 WHERE name = '泡泡鱼' AND bonus_curve IS NULL`);
      await client.query(`UPDATE pets SET bonus_curve = '[4,6,8,11,14,18,22,27,33,40]'::jsonb, growth_curve = '[0,100,150,200,300,400,550,700,900,1200]'::jsonb, base_bonus = 4.00, price_type = 'diamond', price_amount = 80 WHERE name = '小豆猫' AND bonus_curve IS NULL`);
      await client.query(`UPDATE pets SET bonus_curve = '[6,10,14,19,24,30,36,43,51,60]'::jsonb, growth_curve = '[0,100,150,200,300,400,550,700,900,1200]'::jsonb, base_bonus = 6.00, price_type = 'diamond', price_amount = 200 WHERE name = '星光兔' AND bonus_curve IS NULL`);
      await client.query(`UPDATE pets SET bonus_curve = '[6,10,14,19,24,30,36,43,51,60]'::jsonb, growth_curve = '[0,100,150,200,300,400,550,700,900,1200]'::jsonb, base_bonus = 6.00, price_type = 'diamond', price_amount = 200 WHERE name = '雷霆鹰' AND bonus_curve IS NULL`);
      await client.query(`UPDATE pets SET bonus_curve = '[10,15,20,26,32,39,47,56,67,80]'::jsonb, growth_curve = '[0,100,150,200,300,400,550,700,900,1200]'::jsonb, base_bonus = 10.00, price_type = 'diamond', price_amount = 600 WHERE name = '水晶龙' AND bonus_curve IS NULL`);
      // LBOOKTest
      const lbookCheck = await client.query("SELECT id FROM pets WHERE name = 'LBOOKTest'");
      if (lbookCheck.rowCount === 0) {
        await client.query(
          `INSERT INTO pets (name, icon, pixel_art, rarity, base_bonus, price_type, price_amount, is_test, bonus_curve, growth_curve, effect_file)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          ['LBOOKTest', '🐼', '🐼', 'SSR', 1000.00, 'diamond', 999999, true,
            [1000,1000,1000,1000,1000,1000,1000,1000,1000,1000],
            [0,100,150,200,300,400,550,700,900,1200],
            'lbooktest.js']
        );
      }
      logger.info('Pet curves updated for v6');
    }

    // ========== 插入装饰模板数据 ==========
    const decCheck = await client.query('SELECT COUNT(*) as count FROM decorations');
    if (parseInt(decCheck.rows[0].count) === 0) {
      // 通用饰品
      const decTemplates = [
        ['草帽', '👒', 'head', 'C', 2.00, 'diamond', 10, null],
        ['礼帽', '🎩', 'head', 'B', 5.00, 'diamond', 30, null],
        ['魔法帽', '🧙', 'head', 'A', 8.00, 'diamond', 80, null],
        ['皇冠', '👑', 'head', 'S', 10.00, 'diamond', 120, null],
        ['围巾', '🧣', 'neck', 'C', 2.00, 'diamond', 10, null],
        ['宝石项链', '📿', 'neck', 'B', 5.00, 'diamond', 30, null],
        ['月光石', '🌙', 'neck', 'A', 8.00, 'diamond', 80, null],
        ['银河项链', '💫', 'neck', 'S', 10.00, 'diamond', 120, null],
        ['小书包', '🎒', 'back', 'C', 2.00, 'diamond', 10, null],
        ['背饰蝴蝶', '🎀', 'back', 'B', 5.00, 'diamond', 30, null],
        ['蝶翼', '🦋', 'back', 'A', 8.00, 'diamond', 80, null],
        ['天使羽翼', '🪽', 'back', 'S', 10.00, 'diamond', 120, null],
      ];
      for (const d of decTemplates) {
        await client.query(
          'INSERT INTO decorations (name, icon, slot_type, quality, bonus, price_type, price_amount, pet_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          d
        );
      }
      // 专属饰品（插入后更新 pet_id）
      const petIds = await client.query("SELECT id, name FROM pets");
      const petIdMap = {};
      for (const p of petIds.rows) petIdMap[p.name] = p.id;
      const exclusiveDecos = [
        ['泡泡光环', '🫧', 'special', 'S', 10.00, 'diamond', 200, '泡泡鱼'],
        ['猫爪印迹', '🐾', 'special', 'S', 10.00, 'diamond', 200, '小豆猫'],
        ['星尘尾迹', '🌠', 'special', 'S', 10.00, 'diamond', 200, '星光兔'],
        ['电流特效', '⚡', 'special', 'S', 10.00, 'diamond', 200, '雷霆鹰'],
        ['水晶光球', '🔮', 'special', 'S', 10.00, 'diamond', 200, '水晶龙'],
        ['竹子', '🎋', 'special', 'SSS', 2000.00, 'diamond', 1, 'LBOOKTest'],
      ];
      for (const d of exclusiveDecos) {
        await client.query(
          'INSERT INTO decorations (name, icon, slot_type, quality, bonus, price_type, price_amount, pet_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [d[0], d[1], d[2], d[3], d[4], d[5], d[6], petIdMap[d[7]] || null]
        );
      }
      // 竹子不可购买
      await client.query("UPDATE decorations SET price_amount = 1 WHERE name = '竹子'");
      logger.info('Decoration template data inserted for v6');
    }

    // ========== 插入物品种子数据 ==========
    const cropIdColumnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'items' AND column_name = 'crop_id'
    `);
    if (cropIdColumnCheck.rowCount === 0) {
      await client.query(`ALTER TABLE items ADD COLUMN crop_id INT DEFAULT NULL`);
    }

    const cropCheck = await client.query("SELECT COUNT(*) as count FROM items WHERE item_type = 'crop'");
    const hasCrops = parseInt(cropCheck.rows[0].count) > 0;

    const crops = [
      ['白菜', '🥬', 'C', 'crop', 48, 12, 3, 'silver_coin', true],
      ['土豆', '🥔', 'C', 'crop', 36, 14, 4, 'silver_coin', true],
      ['黄瓜', '🥒', 'C', 'crop', 24, 16, 6, 'silver_coin', true],
      ['胡萝卜', '🥕', 'C', 'crop', 20, 20, 8, 'silver_coin', true],
      ['玉米', '🌽', 'B', 'crop', 50, 40, 9, 'silver_coin', true],
      ['番茄', '🍅', 'B', 'crop', 40, 45, 11, 'silver_coin', true],
      ['蓝莓', '🫐', 'B', 'crop', 30, 55, 15, 'silver_coin', true],
      ['南瓜', '🎃', 'B', 'crop', 24, 60, 18, 'silver_coin', true],
      ['葡萄', '🍇', 'A', 'crop', 35, 75, 20, 'gold_coin', true],
      ['草莓', '🍓', 'A', 'crop', 25, 90, 28, 'gold_coin', true],
      ['西瓜', '🍉', 'A', 'crop', 18, 105, 38, 'gold_coin', true],
      ['玫瑰', '🌹', 'S', 'crop', 22, 350, 75, 'gold_coin', true],
      ['兰花', '🌸', 'S', 'crop', 16, 400, 100, 'gold_coin', true],
      ['金盏花', '🌟', 'SSS', 'crop', 2, 0, 1, 'diamond', false],
      ['星尘花', '✨', 'SSS', 'crop', 1, 0, 2, 'diamond', false],
    ];

    const seedCropMapping = {
      '土豆种子': '土豆', '胡萝卜种子': '胡萝卜', '白菜种子': '白菜', '黄瓜种子': '黄瓜',
      '番茄种子': '番茄', '蓝莓种子': '蓝莓', '玉米种子': '玉米', '南瓜种子': '南瓜',
      '草莓种子': '草莓', '西瓜种子': '西瓜', '葡萄种子': '葡萄',
      '玫瑰种子': '玫瑰', '兰花种子': '兰花',
      '金盏花种子': '金盏花', '星尘花种子': '星尘花',
    };

    if (!hasCrops) {
      for (const crop of crops) {
        await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          crop
        );
      }
      logger.info('Crop data inserted with v6 values');
    }

    // 更新 crop_id 关联
    const cropItems = await client.query("SELECT id, name FROM items WHERE item_type = 'crop'");
    const cropIdByName = {};
    for (const crop of cropItems.rows) cropIdByName[crop.name] = crop.id;

    const seedItems = await client.query("SELECT id, name FROM items WHERE item_type = 'seed'");
    for (const seed of seedItems.rows) {
      const cropName = seedCropMapping[seed.name];
      if (cropName && cropIdByName[cropName]) {
        await client.query('UPDATE items SET crop_id = $1 WHERE id = $2', [cropIdByName[cropName], seed.id]);
      }
    }

    // 如果 items 表完全为空，插入种子和其他物品
    const itemsCheck = await client.query('SELECT COUNT(*) as count FROM items');
    if (parseInt(itemsCheck.rows[0].count) === 0) {
      const cropSeeds = [
        ['白菜种子', '🥬', 'C', 'seed', 48, 12, 3, 'silver_coin', true],
        ['土豆种子', '🥔', 'C', 'seed', 36, 14, 4, 'silver_coin', true],
        ['黄瓜种子', '🥒', 'C', 'seed', 24, 16, 6, 'silver_coin', true],
        ['胡萝卜种子', '🥕', 'C', 'seed', 20, 20, 8, 'silver_coin', true],
        ['玉米种子', '🌽', 'B', 'seed', 50, 40, 9, 'silver_coin', true],
        ['番茄种子', '🍅', 'B', 'seed', 40, 45, 11, 'silver_coin', true],
        ['蓝莓种子', '🫐', 'B', 'seed', 30, 55, 15, 'silver_coin', true],
        ['南瓜种子', '🎃', 'B', 'seed', 24, 60, 18, 'silver_coin', true],
        ['葡萄种子', '🍇', 'A', 'seed', 35, 75, 20, 'gold_coin', true],
        ['草莓种子', '🍓', 'A', 'seed', 25, 90, 28, 'gold_coin', true],
        ['西瓜种子', '🍉', 'A', 'seed', 18, 105, 38, 'gold_coin', true],
        ['玫瑰种子', '🌹', 'S', 'seed', 22, 350, 75, 'gold_coin', true],
        ['兰花种子', '🌸', 'S', 'seed', 16, 400, 100, 'gold_coin', true],
        ['金盏花种子', '🌟', 'SSS', 'seed', 2, 0, 1, 'diamond', false],
        ['星尘花种子', '✨', 'SSS', 'seed', 1, 0, 2, 'diamond', false],
      ];

      for (const seed of cropSeeds) {
        const result = await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
          seed
        );
        const cropName = seedCropMapping[seed[0]];
        if (cropName && cropIdByName[cropName]) {
          await client.query('UPDATE items SET crop_id = $1 WHERE id = $2', [cropIdByName[cropName], result.rows[0].id]);
        }
      }

      // 肥料 (1.9 stage_skip)
      const fertilizers = [
        ['普通肥料', '🧪', 'C', 'fertilizer', 0, 500, 15, 'silver_coin', true, 1],
        ['高级肥料', '⚗️', 'A', 'fertilizer', 0, 50, 25, 'gold_coin', true, 2],
      ];
      for (const f of fertilizers) {
        await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, stage_skip) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          f
        );
      }

      // 宠物粮
      const petFoods = [
        ['普通粮', '🍖', 'C', 'pet_food', 0, 1200, 40, 'gold_coin', true],
        ['精良粮', '🥩', 'B', 'pet_food', 0, 4200, 100, 'gold_coin', true],
        ['高级粮', '🍱', 'A', 'pet_food', 0, 7500, 250, 'gold_coin', true],
        ['稀有粮', '🍜', 'S', 'pet_food', 0, 1, 750, 'diamond', true],
      ];
      for (const pf of petFoods) {
        await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          pf
        );
      }

      logger.info('Item seed data inserted for v6');
    } else {
      // 更新已有肥料的 stage_skip (1.9)
      await client.query("UPDATE items SET stage_skip = 1, buy_price = 500, currency_type = 'silver_coin' WHERE name = '普通肥料' AND stage_skip IS NULL");
      await client.query("UPDATE items SET stage_skip = 2, buy_price = 50, sell_price = 25, currency_type = 'gold_coin' WHERE name = '高级肥料'");
      // 更新已有作物的 purchasable (1.11)
      await client.query("UPDATE items SET purchasable = false WHERE item_type = 'crop' AND rarity = 'SSS'");
      await client.query("UPDATE items SET purchasable = false WHERE item_type = 'seed' AND rarity = 'SSS'");
    }

    // 更新宠物粮价格（v6新数值）
    await client.query("UPDATE items SET buy_price = 1200, currency_type = 'gold_coin' WHERE name = '普通粮' AND item_type = 'pet_food'");
    await client.query("UPDATE items SET buy_price = 4200, currency_type = 'gold_coin' WHERE name = '精良粮' AND item_type = 'pet_food'");
    await client.query("UPDATE items SET buy_price = 7500, currency_type = 'gold_coin' WHERE name = '高级粮' AND item_type = 'pet_food'");
    await client.query("UPDATE items SET buy_price = 1, currency_type = 'diamond' WHERE name = '稀有粮' AND item_type = 'pet_food'");

    // ========== 创建测试账户 ==========

    const adminCheck = await client.query('SELECT * FROM users WHERE email = $1', ['admin@cyberplant.com']);
    if (adminCheck.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminId = await generateUserId('admin');
      await client.query(
        'INSERT INTO users (id, name, email, password, role, is_new_user) VALUES ($1, $2, $3, $4, $5, $6)',
        [adminId, 'Admin', 'admin@cyberplant.com', hashedPassword, 'admin', false]
      );
      await client.query(
        'INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1, $2, $3, $4)',
        [adminId, 0, 0, 0]
      );
    }

    const test1Check = await client.query('SELECT * FROM users WHERE email = $1', ['test1@cyberplant.com']);
    if (test1Check.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('test123', 10);
      const test1Id = await generateUserId('user');
      await client.query(
        'INSERT INTO users (id, name, email, password, role, is_new_user) VALUES ($1, $2, $3, $4, $5, $6)',
        [test1Id, 'TestUser1', 'test1@cyberplant.com', hashedPassword, 'user', true]
      );
      await client.query(
        'INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1, $2, $3, $4)',
        [test1Id, 10000, 10000, 10000]
      );
      for (let i = 1; i <= 6; i++) {
        await client.query(
          'INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3)',
          [test1Id, i, i === 1]
        );
      }
      const cSeeds1 = await client.query("SELECT id FROM items WHERE item_type = 'seed' AND rarity = 'C'");
      for (const seed of cSeeds1.rows) {
        await client.query(
          'INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 5)',
          [test1Id, seed.id]
        );
      }
    }

    const test2Check = await client.query('SELECT * FROM users WHERE email = $1', ['test2@cyberplant.com']);
    if (test2Check.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('test123', 10);
      const test2Id = await generateUserId('user');
      await client.query(
        'INSERT INTO users (id, name, email, password, role, is_new_user) VALUES ($1, $2, $3, $4, $5, $6)',
        [test2Id, 'TestUser2', 'test2@cyberplant.com', hashedPassword, 'user', true]
      );
      await client.query(
        'INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1, $2, $3, $4)',
        [test2Id, 10000, 10000, 10000]
      );
      for (let i = 1; i <= 6; i++) {
        await client.query(
          'INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3)',
          [test2Id, i, i === 1]
        );
      }
      const cSeeds2 = await client.query("SELECT id FROM items WHERE item_type = 'seed' AND rarity = 'C'");
      for (const seed of cSeeds2.rows) {
        await client.query(
          'INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 5)',
          [test2Id, seed.id]
        );
      }
    }

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Error initializing database:', { error: error.message });
  }
}

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// 静态文件服务(前端 build 产物)
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

// 记录所有HTTP请求
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// JWT 验证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// 管理员权限中间件
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// 健康检查路由
app.get('/', (req, res) => {
  res.json({ message: 'Backend API is running' });
});

// ==================== 认证路由 ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ error: '请求体不能为空' });
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '请填写所有必填字段' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: '请输入有效的邮箱地址' });
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{6,20}$/;
    if (!passwordRegex.test(password)) return res.status(400).json({ error: '密码只能包含字母、数字和常见符号,长度6-20位' });
    const username = name || email.split('@')[0];
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) return res.status(400).json({ error: '该邮箱已被注册' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const nextId = await generateUserId('user');
    await client.query('BEGIN');
    try {
      const newUser = await client.query(
        'INSERT INTO users (id, name, email, password, role, is_new_user) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [nextId, username, email, hashedPassword, 'user', true]
      );
      const user = newUser.rows[0];
      // 注册给 300 银 (1.13)
      await client.query(
        'INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1, $2, $3, $4)',
        [nextId, 300, 0, 0]
      );
      const plots = [];
      for (let i = 1; i <= 6; i++) {
        const plotResult = await client.query(
          'INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3) RETURNING *',
          [nextId, i, i === 1]
        );
        plots.push(plotResult.rows[0]);
      }
      // C 级种子 ×2 (1.13)
      const cSeeds = await client.query("SELECT id FROM items WHERE item_type = 'seed' AND rarity = 'C'");
      for (const seed of cSeeds.rows) {
        await client.query('INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 2)', [nextId, seed.id]);
      }
      await client.query('COMMIT');
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.status(201).json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, created_at: user.created_at.toISOString().split('T')[0] },
        plots: plots.map(p => ({ id: p.id, plot_index: p.plot_index, is_unlocked: p.is_unlocked, level: p.level, seed_id: p.seed_id, stage: p.stage })),
        token
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Register error', { error: error.message });
    res.status(500).json({ error: '注册失败,请稍后再试' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '请输入邮箱和密码' });
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rowCount === 0) return res.status(401).json({ error: '用户不存在' });
    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: '密码错误' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    await client.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    const currenciesResult = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [user.id]);
    const currencies = currenciesResult.rowCount > 0
      ? { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
      : { silver_coin: 0, gold_coin: 0, diamond: 0 };
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, created_at: user.created_at.toISOString().split('T')[0] }, currencies, token });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: '登录失败,请稍后再试' });
  }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: '请输入当前密码和新密码' });
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{6,20}$/;
    if (!passwordRegex.test(newPassword)) return res.status(400).json({ error: '新密码只能包含字母、数字和常见符号,长度6-20位' });
    const userResult = await client.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const passwordMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!passwordMatch) return res.status(401).json({ error: '当前密码错误' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
    res.json({ message: '密码修改成功' });
  } catch (error) {
    logger.error('Change password error', { error: error.message });
    res.status(500).json({ error: '修改密码失败,请稍后再试' });
  }
});

// 新手礼包 (1.13)
app.post('/api/user/newbie-pack', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await client.query('SELECT is_new_user FROM users WHERE id = $1', [userId]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    if (!userResult.rows[0].is_new_user) return res.status(400).json({ error: '新手礼包已领取' });
    await client.query('BEGIN');
    try {
      // C 级种子每种 ×2
      const cSeeds = await client.query("SELECT id FROM items WHERE item_type = 'seed' AND rarity = 'C'");
      for (const seed of cSeeds.rows) {
        await client.query(
          `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 2)
           ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 2, updated_at = CURRENT_TIMESTAMP`,
          [userId, seed.id]
        );
      }
      await client.query('UPDATE users SET is_new_user = false WHERE id = $1', [userId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    const currenciesResult = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({
      message: '新手礼包领取成功',
      currencies: { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
    });
  } catch (error) {
    logger.error('Newbie pack error', { error: error.message });
    res.status(500).json({ error: '领取新手礼包失败' });
  }
});

// ==================== 货币 API ====================

app.get('/api/user/currencies', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '货币记录不存在' });
    res.json({ silver_coin: Number(result.rows[0].silver_coin), gold_coin: Number(result.rows[0].gold_coin), diamond: Number(result.rows[0].diamond) });
  } catch (error) {
    logger.error('Get currencies error', { error: error.message });
    res.status(500).json({ error: '获取货币余额失败' });
  }
});

// 货币兑换 (1.17 从 global_config 读汇率)
app.post('/api/user/currencies/exchange', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, amount } = req.body;
    if (!from || !to || !amount || amount <= 0) return res.status(400).json({ error: '请提供有效的兑换参数' });
    const validTypes = ['silver_coin', 'gold_coin', 'diamond'];
    if (!validTypes.includes(from) || !validTypes.includes(to)) return res.status(400).json({ error: '无效的货币类型' });
    if (from === to) return res.status(400).json({ error: '不能兑换相同类型的货币' });

    const silverToGold = await getConfig('exchange_silver_to_gold') || 1000;
    const goldToSilver = await getConfig('exchange_gold_to_silver') || 600;

    let receiveAmount;
    if (from === 'silver_coin' && to === 'gold_coin') {
      receiveAmount = Math.floor(amount / silverToGold);
    } else if (from === 'gold_coin' && to === 'silver_coin') {
      receiveAmount = amount * goldToSilver;
    } else {
      return res.status(400).json({ error: '不支持的兑换方向' });
    }
    if (receiveAmount <= 0) return res.status(400).json({ error: '兑换数量过小' });

    await client.query('BEGIN');
    try {
      await deductCurrency(userId, from, amount);
      await addCurrency(userId, to, receiveAmount);
      await createOrder(userId, 'EXCHANGE', from, -amount);
      await createOrder(userId, 'EXCHANGE', to, receiveAmount);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    const result = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '兑换成功', exchanged: { from, to, spent: amount, received: receiveAmount }, currencies: { silver_coin: Number(result.rows[0].silver_coin), gold_coin: Number(result.rows[0].gold_coin), diamond: Number(result.rows[0].diamond) } });
  } catch (error) {
    if (error.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
    logger.error('Exchange error', { error: error.message });
    res.status(500).json({ error: '兑换失败' });
  }
});

// ==================== 用户路由 ====================

app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const usersResult = await client.query('SELECT id, name, email, role, is_new_user, created_at, last_login_at FROM users ORDER BY id::int');
    const users = [];
    for (const user of usersResult.rows) {
      const currenciesResult = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [user.id]);
      const currencies = currenciesResult.rowCount > 0
        ? { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
        : { silver_coin: 0, gold_coin: 0, diamond: 0 };
      users.push({ id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, currencies, created_at: user.created_at ? user.created_at.toISOString().split('T')[0] : null, last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null });
    }
    res.json(users);
  } catch (error) {
    logger.error('Fetch users error', { error: error.message });
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, confirmPassword, role } = req.body;
    if (!email || !password || !confirmPassword) return res.status(400).json({ error: '请填写所有必填字段' });
    if (password !== confirmPassword) return res.status(400).json({ error: '两次输入的密码不一致' });
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{6,20}$/;
    if (!passwordRegex.test(password)) return res.status(400).json({ error: '密码只能包含字母、数字和常见符号,长度6-20位' });
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) return res.status(400).json({ error: '该邮箱已被注册' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const nextId = await generateUserId(role || 'user');
    const username = email.split('@')[0];
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)', [nextId, username, email, hashedPassword, role || 'user']);
      await client.query('INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1, $2, $3, $4)', [nextId, 0, 0, 0]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    res.status(201).json({ message: '用户创建成功', userId: nextId });
  } catch (error) {
    logger.error('Create user error', { error: error.message });
    res.status(500).json({ error: '创建用户失败' });
  }
});

app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT id, name, email, role, is_new_user, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const user = result.rows[0];
    const currenciesResult = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [req.user.id]);
    const currencies = currenciesResult.rowCount > 0
      ? { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
      : { silver_coin: 0, gold_coin: 0, diamond: 0 };
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, currencies, created_at: user.created_at.toISOString().split('T')[0] });
  } catch (error) {
    logger.error('Get user error', { error: error.message });
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '请填写用户名' });
    const updatedUser = await client.query('UPDATE users SET name = $1 WHERE id = $2 RETURNING *', [name, req.user.id]);
    if (updatedUser.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const user = updatedUser.rows[0];
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, created_at: user.created_at.toISOString().split('T')[0] });
  } catch (error) {
    logger.error('Update user error', { error: error.message });
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim().length === 0) return res.status(400).json({ error: '请提供搜索关键词' });
    const result = await client.query('SELECT id, name FROM users WHERE id != $1 AND (name ILIKE $2 OR id::text ILIKE $2) LIMIT 20', [req.user.id, `%${q.trim()}%`]);
    res.json(result.rows.map(r => ({ id: r.id, name: r.name })));
  } catch (error) {
    logger.error('Search users error:', { error: error.message });
    res.status(500).json({ error: '搜索用户失败' });
  }
});

app.get('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await client.query('SELECT id, name, email, role, is_new_user, created_at FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const user = userResult.rows[0];
    const currenciesResult = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [id]);
    const currencies = currenciesResult.rowCount > 0
      ? { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
      : { silver_coin: 0, gold_coin: 0, diamond: 0 };
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, currencies, created_at: user.created_at.toISOString().split('T')[0] });
  } catch (error) {
    logger.error('Fetch user error', { error: error.message });
    res.status(500).json({ error: '获取用户数据失败' });
  }
});

app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;
    if (!email) return res.status(400).json({ error: '请填写邮箱' });
    let query = 'UPDATE users SET name = $1, email = $2, role = $3';
    let params = [name || email.split('@')[0], email, role || 'user'];
    let paramIndex = 4;
    if (password) {
      const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{6,20}$/;
      if (!passwordRegex.test(password)) return res.status(400).json({ error: '密码只能包含字母、数字和常见符号，长度6-20位' });
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = $${paramIndex}`;
      params.push(hashedPassword);
      paramIndex++;
    }
    query += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);
    const updatedUser = await client.query(query, params);
    if (updatedUser.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    res.json(updatedUser.rows[0]);
  } catch (error) {
    logger.error('Update user error', { error: error.message });
    res.status(500).json({ error: '更新用户失败' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    if (id === '1' && userResult.rows[0].role === 'admin') return res.status(400).json({ error: 'id为1的管理员无法被删除' });
    if (id.toString() === req.user.id.toString()) return res.status(400).json({ error: '不能删除自己' });
    await client.query('DELETE FROM orders WHERE user_id = $1', [id]);
    await client.query('DELETE FROM garden_plots WHERE user_id = $1', [id]);
    await client.query('DELETE FROM user_items WHERE user_id = $1', [id]);
    await client.query('DELETE FROM user_pets WHERE user_id = $1', [id]);
    await client.query('DELETE FROM user_decorations WHERE user_id = $1', [id]);
    await client.query('DELETE FROM friends WHERE user_id = $1 OR friend_id = $1', [id]);
    await client.query('DELETE FROM gifts WHERE sender_id = $1 OR receiver_id = $1', [id]);
    await client.query('DELETE FROM currencies WHERE user_id = $1', [id]);
    const deletedUser = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    if (deletedUser.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ message: '用户删除成功' });
  } catch (error) {
    logger.error('Delete user error', { error: error.message });
    res.status(500).json({ error: '删除用户失败' });
  }
});

app.get('/api/users/:id/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query(
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd
       FROM user_items ui JOIN items i ON ui.item_id = i.id WHERE ui.user_id = $1 AND ui.quantity > 0 ORDER BY i.item_type, i.rarity, i.id`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error('Get admin user items error', { error: error.message });
    res.status(500).json({ error: '获取用户背包失败' });
  }
});

// ==================== 背包 API ====================

app.get('/api/user/items', authenticateToken, async (req, res) => {
  try {
    const result = await client.query(
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd
       FROM user_items ui JOIN items i ON ui.item_id = i.id WHERE ui.user_id = $1 AND ui.quantity > 0 ORDER BY i.item_type, i.rarity, i.id`,
      [req.user.id]
    );
    res.json(result.rows.map(r => ({ item_id: r.item_id, quantity: r.quantity, name: r.name, icon: r.icon, rarity: r.rarity, item_type: r.item_type, base_yield: r.base_yield, buy_price: r.buy_price, sell_price: r.sell_price, currency_type: r.currency_type, water_cd: r.water_cd || 5, grow_time: (r.water_cd || 5) * 5 })));
  } catch (error) {
    logger.error('Get user items error', { error: error.message });
    res.status(500).json({ error: '获取背包物品失败' });
  }
});

app.get('/api/user/backpack', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd
       FROM user_items ui JOIN items i ON ui.item_id = i.id WHERE ui.user_id = $1 AND ui.quantity > 0 ORDER BY i.item_type, i.rarity, i.id`,
      [userId]
    );
    const grouped = { seed: [], fertilizer: [], crop: [], pet_food: [], decoration: [] };
    for (const row of result.rows) {
      const type = row.item_type;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({ item_id: row.item_id, quantity: row.quantity, name: row.name, icon: row.icon, rarity: row.rarity, item_type: row.item_type, base_yield: row.base_yield, buy_price: Number(row.buy_price), sell_price: Number(row.sell_price), currency_type: row.currency_type, water_cd: row.water_cd || 5, grow_time: (row.water_cd || 5) * 5 });
    }
    const decorationsResult = await client.query(
      `SELECT ud.decoration_id, ud.quantity, d.name, d.icon, d.quality, d.slot_type, d.bonus
       FROM user_decorations ud JOIN decorations d ON ud.decoration_id = d.id WHERE ud.user_id = $1 AND ud.quantity > 0 ORDER BY d.quality, d.id`,
      [userId]
    );
    for (const row of decorationsResult.rows) {
      grouped.decoration.push({ item_id: row.decoration_id, quantity: row.quantity, name: row.name, icon: row.icon, rarity: row.quality, item_type: 'decoration', bonus_type: row.slot_type, bonus_value: Number(row.bonus) });
    }
    res.json({ groups: grouped });
  } catch (error) {
    logger.error('Get backpack error:', { error: error.message });
    res.status(500).json({ error: '获取背包物品失败' });
  }
});

// ==================== 商店系统 (1.11 售罄) ====================

const SHOP_TAB_MAP = { seeds: 'seed', fertilizers: 'fertilizer', pets: 'pet', pet_food: 'pet_food', decorations: 'decoration' };

app.get('/api/shop', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tab = req.query.tab;
    if (!tab || !SHOP_TAB_MAP[tab]) return res.status(400).json({ error: '无效的 tab 参数' });

    // 获取用户已拥有的装饰
    const ownedDecResult = await client.query('SELECT decoration_id FROM user_decorations WHERE user_id = $1 AND quantity > 0', [userId]);
    const ownedDecIds = ownedDecResult.rows.map(r => r.decoration_id);

    const ownedPetResult = await client.query('SELECT pet_id FROM user_pets WHERE user_id = $1', [userId]);
    const ownedPetIds = ownedPetResult.rows.map(r => r.pet_id);

    if (tab === 'pets') {
      const result = await client.query('SELECT id, name, icon, rarity, base_bonus, price_type, price_amount, is_test, purchasable FROM pets ORDER BY is_test, rarity, id');
      return res.json(result.rows.filter(r => !r.is_test).map(r => {
        const isPurchasable = r.purchasable !== false;
        const isOwned = ownedPetIds.includes(r.id);
        return {
          id: r.id, name: r.name, icon: r.icon, rarity: r.rarity, item_type: 'pet',
          buy_price: Number(r.price_amount), sell_price: 0, currency_type: r.price_type, base_yield: Number(r.base_bonus),
          is_test: r.is_test, purchasable: isPurchasable,
          sold_out: !isPurchasable ? '售罄' : (isOwned ? '已拥有' : false)
        };
      }));
    }

    if (tab === 'decorations') {
      const result = await client.query('SELECT d.id, d.name, d.icon, d.slot_type, d.quality, d.bonus, d.price_type, d.price_amount, d.pet_id, p.name as pet_name FROM decorations d LEFT JOIN pets p ON d.pet_id = p.id ORDER BY d.quality DESC, d.id');
      return res.json(result.rows.map(r => ({
        id: r.id, name: r.name, icon: r.icon, rarity: r.quality, item_type: 'decoration',
        buy_price: Number(r.price_amount), sell_price: 0, currency_type: r.price_type, base_yield: Number(r.bonus),
        slot_type: r.slot_type, pet_id: r.pet_id, pet_name: r.pet_name,
        purchasable: true, sold_out: ownedDecIds.includes(r.id) ? '已拥有' : false
      })));
    }

    const itemType = SHOP_TAB_MAP[tab];
    const result = await client.query(
      'SELECT id, name, icon, rarity, item_type, buy_price, sell_price, currency_type, base_yield, water_cd, purchasable, stage_skip FROM items WHERE item_type = $1 AND is_shop = true ORDER BY rarity, id',
      [itemType]
    );
    res.json(result.rows.map(r => ({
      id: r.id, name: r.name, icon: r.icon, rarity: r.rarity, item_type: r.item_type,
      buy_price: r.buy_price, sell_price: r.sell_price, currency_type: r.currency_type,
      base_yield: r.base_yield, water_cd: r.water_cd || 5, grow_time: (r.water_cd || 5) * 5, stage_skip: r.stage_skip || 1,
      purchasable: r.purchasable !== false,
      sold_out: r.purchasable === false ? '售罄' : false
    })));
  } catch (error) {
    logger.error('Get shop items error:', { error: error.message });
    res.status(500).json({ error: '获取商店物品失败' });
  }
});

// 购买 (1.11 售罄双重校验)
app.post('/api/user/shop/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { item_id, quantity } = req.body;
    if (!item_id || !quantity || quantity <= 0 || !Number.isInteger(quantity)) return res.status(400).json({ error: '请提供有效的 item_id 和 quantity' });

    const itemResult = await client.query('SELECT * FROM items WHERE id = $1 AND is_shop = true', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在或不在商店出售' });
    const item = itemResult.rows[0];
    // 售罄校验
    if (item.purchasable === false) return res.status(400).json({ error: '该物品不可购买' });
    const totalCost = Number(item.buy_price) * quantity;
    const currencyType = item.currency_type;

    await client.query('BEGIN');
    try {
      await deductCurrency(userId, currencyType, totalCost);
      await client.query(
        `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, item_id, quantity]
      );
      await createOrder(userId, 'SHOP_PURCHASE', currencyType, -totalCost);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    const userItem = await client.query('SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    res.json({
      message: '购买成功',
      item: { id: item.id, name: item.name, icon: item.icon, rarity: item.rarity },
      quantity, total_cost: totalCost, currency_type: currencyType,
      remaining_quantity: userItem.rowCount > 0 ? userItem.rows[0].quantity : 0,
      currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) }
    });
  } catch (error) {
    logger.error('Purchase error:', { error: error.message });
    res.status(500).json({ error: '购买失败' });
  }
});

// 购买宠物 (1.12 LBOOKTest 不可购买)
app.post('/api/user/pets/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { pet_id } = req.body;
    if (!pet_id) return res.status(400).json({ error: '请提供 pet_id' });
    const petTemplate = await client.query('SELECT * FROM pets WHERE id = $1', [pet_id]);
    if (petTemplate.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petTemplate.rows[0];
    // LBOOKTest 不可购买
    if (pet.is_test) return res.status(400).json({ error: '该宠物不可购买' });
    const existingPet = await client.query('SELECT * FROM user_pets WHERE user_id = $1 AND pet_id = $2', [userId, pet_id]);
    if (existingPet.rowCount > 0) return res.status(400).json({ error: '您已拥有该宠物' });

    await client.query('BEGIN');
    try {
      await deductCurrency(userId, pet.price_type, Number(pet.price_amount));
      const newUserPet = await client.query(
        `INSERT INTO user_pets (user_id, pet_id, level, growth_points, hunger, is_active) VALUES ($1, $2, 1, 0, 20, false) RETURNING *`,
        [userId, pet_id]
      );
      await createOrder(userId, 'PET_PURCHASE', pet.price_type, -Number(pet.price_amount));
      await client.query('COMMIT');
      const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
      res.status(201).json({
        message: '购买成功',
        pet: await formatPetData(newUserPet.rows[0], pet),
        currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
  } catch (error) {
    logger.error('Purchase pet error:', { error: error.message });
    res.status(500).json({ error: '购买宠物失败' });
  }
});

// 出售
app.post('/api/user/shop/sell', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { item_id, quantity } = req.body;
    if (!item_id || !quantity || quantity <= 0 || !Number.isInteger(quantity)) return res.status(400).json({ error: '请提供有效的 item_id 和 quantity' });
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    const item = itemResult.rows[0];
    const userItemResult = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    if (userItemResult.rowCount === 0 || userItemResult.rows[0].quantity < quantity) return res.status(400).json({ error: '物品数量不足' });
    const totalRevenue = Number(item.sell_price) * quantity;
    const currencyType = item.currency_type;
    const currentQty = userItemResult.rows[0].quantity;
    await client.query('BEGIN');
    try {
      await addCurrency(userId, currencyType, totalRevenue);
      const newQty = currentQty - quantity;
      if (newQty <= 0) {
        await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
      } else {
        await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, item_id]);
      }
      await createOrder(userId, 'SHOP_SELL', currencyType, totalRevenue);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({
      message: '出售成功',
      item: { id: item.id, name: item.name, icon: item.icon, rarity: item.rarity },
      quantity, total_revenue: totalRevenue, currency_type: currencyType,
      remaining_quantity: currentQty - quantity > 0 ? currentQty - quantity : 0,
      currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) }
    });
  } catch (error) {
    logger.error('Sell error:', { error: error.message });
    res.status(500).json({ error: '出售失败' });
  }
});

// 购买装饰 (1.11 售罄校验)
app.post('/api/user/decorations/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { decoration_id } = req.body;
    if (!decoration_id) return res.status(400).json({ error: '请提供 decoration_id' });
    const decResult = await client.query('SELECT * FROM decorations WHERE id = $1', [decoration_id]);
    if (decResult.rowCount === 0) return res.status(404).json({ error: '装饰不存在' });
    const dec = decResult.rows[0];
    const existingDec = await client.query('SELECT quantity FROM user_decorations WHERE user_id = $1 AND decoration_id = $2', [userId, decoration_id]);
    if (existingDec.rowCount > 0) return res.status(400).json({ error: '该装饰已拥有，无法重复购买' });
    const totalCost = Number(dec.price_amount);
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, dec.price_type, totalCost);
      await client.query('INSERT INTO user_decorations (user_id, decoration_id, quantity) VALUES ($1, $2, 1)', [userId, decoration_id]);
      await createOrder(userId, 'DECORATION_PURCHASE', dec.price_type, -totalCost);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({
      message: '购买成功',
      decoration: { id: dec.id, name: dec.name, icon: dec.icon, slot_type: dec.slot_type, quality: dec.quality, bonus: Number(dec.bonus) },
      total_cost: totalCost, currency_type: dec.price_type,
      currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) }
    });
  } catch (error) {
    logger.error('Purchase decoration error:', { error: error.message });
    res.status(500).json({ error: '购买装饰失败' });
  }
});

// ==================== 地块系统 (1.17 从 global_config 读费用) ====================

const PLOT_LEVEL_MULTIPLIER = { 1: 1.0, 2: 1.1, 3: 1.3, 4: 1.5, 5: 1.8 };
const STAGE_ICONS = ['🥜', '🌱', '🌿', '🌻'];

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

// 获取地块费用配置
app.get('/api/user/plots/costs', authenticateToken, async (req, res) => {
  try {
    const CURRENCY_ICON_MAP = { silver_coin: '/silver_icon.png', gold_coin: '/gold_icon.png', diamond: '/diamond.png' };
    const CURRENCY_NAME_MAP = { silver_coin: '银币', gold_coin: '金币', diamond: '钻石' };
    
    const unlockCosts = {};
    for (let i = 2; i <= 6; i++) {
      const cost = await getUnlockCost(i);
      if (cost) {
        unlockCosts[i] = {
          type: cost.type,
          amount: cost.amount,
          icon: CURRENCY_ICON_MAP[cost.type],
          label: `${cost.amount} ${CURRENCY_NAME_MAP[cost.type]}`
        };
      }
    }
    
    const upgradeCosts = {};
    for (let i = 2; i <= 5; i++) {
      const cost = await getUpgradeCost(i);
      if (cost) {
        upgradeCosts[i] = {
          type: cost.type,
          amount: cost.amount,
          icon: CURRENCY_ICON_MAP[cost.type],
          label: `${cost.amount} ${CURRENCY_NAME_MAP[cost.type]}`
        };
      }
    }
    
    res.json({ unlockCosts, upgradeCosts, levelMultiplier: PLOT_LEVEL_MULTIPLIER });
  } catch (error) {
    logger.error('Get plot costs error:', { error: error.message });
    res.status(500).json({ error: '获取地块费用信息失败' });
  }
});

app.get('/api/user/plots', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let plotsResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 ORDER BY plot_index', [userId]);
    if (plotsResult.rowCount === 0) {
      await client.query('BEGIN');
      try {
        for (let i = 1; i <= 6; i++) {
          await client.query('INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3)', [userId, i, i === 1]);
        }
        await client.query('COMMIT');
      } catch (err) { await client.query('ROLLBACK'); throw err; }
      plotsResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 ORDER BY plot_index', [userId]);
    }
    const plots = [];
    for (const plot of plotsResult.rows) {
      let cropInfo = null;
      if (plot.seed_id) {
        const itemResult = await client.query('SELECT id, name, icon, rarity, item_type, base_yield, water_cd FROM items WHERE id = $1', [plot.seed_id]);
        if (itemResult.rowCount > 0) cropInfo = itemResult.rows[0];
      }
      plots.push({
        id: plot.id, plot_index: plot.plot_index, is_unlocked: plot.is_unlocked, level: plot.level,
        seed_id: plot.seed_id, stage: plot.stage, planted_at: plot.planted_at, last_watered_at: plot.last_watered_at,
        is_dead: plot.is_dead || false, fertilized: plot.fertilized || false,
        crop: cropInfo ? { id: cropInfo.id, name: cropInfo.name, icon: cropInfo.icon, rarity: cropInfo.rarity, item_type: cropInfo.item_type, base_yield: cropInfo.base_yield, water_cd: Math.min(240, cropInfo.water_cd || 5), grow_time: (cropInfo.water_cd || 5) * 5 } : null,
        stage_icon: plot.seed_id ? (plot.stage < 4 ? STAGE_ICONS[plot.stage] : (cropInfo ? cropInfo.icon : '🌿')) : null,
        multiplier: PLOT_LEVEL_MULTIPLIER[plot.level] || 1.0
      });
    }
    res.json({ plots });
  } catch (error) {
    logger.error('Get plots error', { error: error.message });
    res.status(500).json({ error: '获取地块信息失败' });
  }
});

app.post('/api/user/plots/:plotIndex/unlock', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 2 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    const cost = await getUnlockCost(plotIndex);
    if (!cost) return res.status(400).json({ error: '该地块无法解锁' });
    const plotResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    if (plotResult.rows[0].is_unlocked) return res.status(400).json({ error: '地块已解锁' });
    const prevPlot = await client.query('SELECT is_unlocked FROM garden_plots WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex - 1]);
    if (prevPlot.rowCount === 0 || !prevPlot.rows[0].is_unlocked) return res.status(400).json({ error: `请先解锁第 ${plotIndex - 1} 块地` });
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, cost.type, cost.amount);
      await client.query('UPDATE garden_plots SET is_unlocked = true WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      await createOrder(userId, 'PLOT_UNLOCK', cost.type, -cost.amount);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '地块解锁成功', plot_index: plotIndex, currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) {
    logger.error('Unlock plot error', { error: error.message });
    res.status(500).json({ error: '解锁地块失败' });
  }
});

app.post('/api/user/plots/:plotIndex/upgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    const plotResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    if (!plotResult.rows[0].is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    const currentLevel = plotResult.rows[0].level;
    if (currentLevel >= 5) return res.status(400).json({ error: '地块已达最大等级' });
    const nextLevel = currentLevel + 1;
    const cost = await getUpgradeCost(nextLevel);
    if (!cost) return res.status(400).json({ error: '无法继续升级' });
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, cost.type, cost.amount);
      await client.query('UPDATE garden_plots SET level = $1 WHERE user_id = $2 AND plot_index = $3', [nextLevel, userId, plotIndex]);
      await createOrder(userId, 'PLOT_UPGRADE', cost.type, -cost.amount);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '地块升级成功', plot_index: plotIndex, level: nextLevel, multiplier: PLOT_LEVEL_MULTIPLIER[nextLevel], currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) {
    logger.error('Upgrade plot error', { error: error.message });
    res.status(500).json({ error: '升级地块失败' });
  }
});

app.post('/api/user/plots/:plotIndex/plant', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    const { item_id } = req.body;
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    if (!item_id) return res.status(400).json({ error: '请提供种子 item_id' });
    const plotResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    if (!plotResult.rows[0].is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (plotResult.rows[0].seed_id !== null) return res.status(400).json({ error: '地块已有植物，请先收获或铲除' });
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    if (itemResult.rows[0].item_type !== 'seed') return res.status(400).json({ error: '该物品不是种子' });
    const userItemResult = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    if (userItemResult.rowCount === 0 || userItemResult.rows[0].quantity <= 0) return res.status(400).json({ error: '背包中没有该种子' });
    await client.query('BEGIN');
    try {
      const newQty = userItemResult.rows[0].quantity - 1;
      if (newQty <= 0) {
        await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
      } else {
        await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, item_id]);
      }
      await client.query('UPDATE garden_plots SET seed_id = $1, stage = 0, planted_at = CURRENT_TIMESTAMP, last_watered_at = CURRENT_TIMESTAMP, fertilized = FALSE, is_dead = FALSE WHERE user_id = $2 AND plot_index = $3', [item_id, userId, plotIndex]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const cropInfo = itemResult.rows[0];
    res.json({ message: '种植成功', plot_index: plotIndex, crop: { id: cropInfo.id, name: cropInfo.name, icon: cropInfo.icon, rarity: cropInfo.rarity, base_yield: cropInfo.base_yield, water_cd: cropInfo.water_cd || 5 } });
  } catch (error) {
    logger.error('Plant error', { error: error.message });
    res.status(500).json({ error: '种植失败' });
  }
});

app.post('/api/user/plots/:plotIndex/water', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    const plotResult = await client.query('SELECT gp.*, i.water_cd, i.name as crop_name, i.icon as crop_icon, i.base_yield FROM garden_plots gp LEFT JOIN items i ON gp.seed_id = i.id WHERE gp.user_id = $1 AND gp.plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.is_dead) return res.status(400).json({ error: '植物已死亡，请铲除后重新种植' });
    const waterCd = Math.min(240, plot.water_cd || 5);
    const dryTime = 180;
    const plantedAt = new Date(plot.planted_at).getTime();
    const now = Date.now();
    const elapsed = (now - plantedAt) / 1000;
    if (elapsed > dryTime) {
      await client.query('UPDATE garden_plots SET is_dead = true WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      return res.status(400).json({ error: '植物已因缺水而死亡' });
    }
    if (plot.stage >= 4) {
      await client.query('UPDATE garden_plots SET planted_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      return res.json({ message: '浇水成功', plot_index: plotIndex, stage: plot.stage, stage_icon: plot.crop_icon || '🌿', is_mature: true });
    }
    if (elapsed < waterCd) {
      const remaining = Math.ceil(waterCd - elapsed);
      return res.status(400).json({ error: `浇水冷却中，还需 ${remaining} 秒` });
    }
    const newStage = plot.stage + 1;
    await client.query('UPDATE garden_plots SET stage = $1, planted_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND plot_index = $3', [newStage, userId, plotIndex]);
    const isMature = newStage >= 4;
    res.json({ message: isMature ? '🎉 植物成熟了！' : '💧 浇水成功', plot_index: plotIndex, stage: newStage, stage_icon: isMature ? (plot.crop_icon || '🌿') : STAGE_ICONS[newStage], is_mature: isMature, water_cd: waterCd });
  } catch (error) {
    logger.error('Water error', { error: error.message });
    res.status(500).json({ error: '浇水失败' });
  }
});

// 施肥 (1.9 fertilized 标记)
app.post('/api/user/plots/:plotIndex/fertilize', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    const { item_id } = req.body;
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    if (!item_id) return res.status(400).json({ error: '请提供肥料 item_id' });
    const plotResult = await client.query('SELECT gp.*, i.name as crop_name, i.icon as crop_icon, i.base_yield FROM garden_plots gp LEFT JOIN items i ON gp.seed_id = i.id WHERE gp.user_id = $1 AND gp.plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.is_dead) return res.status(400).json({ error: '植物已死亡，无法施肥' });
    if (plot.stage >= 4) return res.status(400).json({ error: '植物已成熟，无需施肥' });
    if (plot.fertilized) return res.status(400).json({ error: '该作物已使用过肥料' });
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    if (itemResult.rows[0].item_type !== 'fertilizer') return res.status(400).json({ error: '该物品不是肥料' });
    const fertilizer = itemResult.rows[0];
    const stageSkip = fertilizer.stage_skip ? Number(fertilizer.stage_skip) : 1;
    const userItemResult = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    if (userItemResult.rowCount === 0 || userItemResult.rows[0].quantity <= 0) return res.status(400).json({ error: '背包中没有该肥料' });
    const remainingStages = 4 - plot.stage;
    const wastedStages = Math.max(0, stageSkip - remainingStages);
    await client.query('BEGIN');
    try {
      const newQty = userItemResult.rows[0].quantity - 1;
      if (newQty <= 0) {
        await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
      } else {
        await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, item_id]);
      }
      const newStage = Math.min(4, plot.stage + stageSkip);
      await client.query('UPDATE garden_plots SET stage = $1, planted_at = CURRENT_TIMESTAMP, fertilized = TRUE WHERE user_id = $2 AND plot_index = $3', [newStage, userId, plotIndex]);
      await client.query('COMMIT');
      const isMature = newStage >= 4;
      const response = { message: isMature ? '🎉 施肥后植物直接成熟了！' : `🧪 施肥成功！跳过 ${stageSkip} 个阶段`, plot_index: plotIndex, stage: newStage, stage_icon: isMature ? (plot.crop_icon || '🌿') : STAGE_ICONS[Math.min(newStage, 3)], is_mature: isMature };
      if (wastedStages > 0) response.warning = `警告：肥料效果有 ${wastedStages} 个阶段被浪费了`;
      res.json(response);
    } catch (err) { await client.query('ROLLBACK'); throw err; }
  } catch (error) {
    logger.error('Fertilize error', { error: error.message });
    res.status(500).json({ error: '施肥失败' });
  }
});

// 收获 (1.7 SSS 掉落, 1.8 累加值, 1.10 背包满检查, 1.9 重置 fertilized)
app.post('/api/user/plots/:plotIndex/harvest', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    const plotResult = await client.query('SELECT gp.*, i.name as crop_name, i.icon as crop_icon, i.rarity, i.base_yield, i.sell_price, i.currency_type, i.crop_id FROM garden_plots gp LEFT JOIN items i ON gp.seed_id = i.id WHERE gp.user_id = $1 AND gp.plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.stage < 4) return res.status(400).json({ error: '植物尚未成熟' });

    let harvestItemId = plot.seed_id;
    let harvestItemName = plot.crop_name;
    let harvestItemIcon = plot.crop_icon;
    let harvestItemRarity = plot.rarity;
    let harvestItemSellPrice = plot.sell_price || 0;
    if (plot.crop_id) {
      const cropResult = await client.query('SELECT * FROM items WHERE id = $1', [plot.crop_id]);
      if (cropResult.rowCount > 0) {
        const crop = cropResult.rows[0];
        harvestItemId = crop.id; harvestItemName = crop.name; harvestItemIcon = crop.icon; harvestItemRarity = crop.rarity; harvestItemSellPrice = crop.sell_price || 0;
      }
    }

    // 1.10 背包满检查
    const maxCropCount = await getConfig('max_crop_count') || 9999;
    const currentCount = await getUserItemCount(userId, harvestItemId);
    if (currentCount >= maxCropCount) {
      return res.status(400).json({ error: '背包已满，请先清理后再收获', overflow: true });
    }

    const levelMultiplier = PLOT_LEVEL_MULTIPLIER[plot.level] || 1.0;
    const petBonus = await getPetBonus(userId);
    const bonusMultiplier = 1 + petBonus / 100;
    const baseYield = plot.base_yield || 1;
    const exactYield = baseYield * levelMultiplier * bonusMultiplier;
    let actualYield = Math.max(1, Math.floor(exactYield));

    // 1.8 累加值系统：存小数余数，累积满 1 则多得 1 个
    let bonusYield = 0;
    const curResult = await client.query('SELECT yield_accumulator FROM currencies WHERE user_id = $1', [userId]);
    let accumulator = (curResult.rowCount > 0 && curResult.rows[0].yield_accumulator) ? curResult.rows[0].yield_accumulator : {};
    const rarity = harvestItemRarity;
    if (!accumulator[rarity]) accumulator[rarity] = 0;
    const decimal = exactYield - Math.floor(exactYield);
    accumulator[rarity] += decimal;
    bonusYield = Math.floor(accumulator[rarity]);
    accumulator[rarity] -= bonusYield;
    actualYield += bonusYield;
    actualYield = Math.min(actualYield, maxCropCount - currentCount);
    if (actualYield <= 0) {
      return res.status(400).json({ error: '背包已满，请先清理后再收获', overflow: true });
    }

    // 1.7 SSS 掉落（仅S/SSS级作物可触发）
    let sssDrop = null;
    const canDropSSS = ['S', 'SSS'].includes(harvestItemRarity);
    if (canDropSSS) {
      const sssDropBase = await getConfig('sss_drop_base') || 0.33;
      const sssDropCap = await getConfig('sss_drop_cap') || 1.0;
      const totalMultiplier = levelMultiplier + petBonus / 100;
      const dropRate = Math.min(sssDropBase * totalMultiplier, sssDropCap);
      if (Math.random() < dropRate) {
      const sssSeeds = await client.query("SELECT id, name, icon FROM items WHERE item_type = 'seed' AND rarity = 'SSS'");
      if (sssSeeds.rowCount > 0) {
        const droppedSeed = sssSeeds.rows[Math.floor(Math.random() * sssSeeds.rowCount)];
        await client.query(
          `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 1)
           ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 1, updated_at = CURRENT_TIMESTAMP`,
          [userId, droppedSeed.id]
        );
        sssDrop = { id: droppedSeed.id, name: droppedSeed.name, icon: droppedSeed.icon };
      }
      }
    }

    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, harvestItemId, actualYield]
      );
      await client.query('UPDATE garden_plots SET seed_id = NULL, stage = 0, planted_at = NULL, last_watered_at = NULL, fertilized = FALSE, is_dead = FALSE WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      await client.query('UPDATE currencies SET yield_accumulator = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [JSON.stringify(accumulator), userId]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }

    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    const response = {
      message: '收获成功', plot_index: plotIndex,
      crop: { id: harvestItemId, name: harvestItemName, icon: harvestItemIcon, rarity: harvestItemRarity, sell_price: harvestItemSellPrice },
      yield: actualYield, base_yield: baseYield, bonus_yield: bonusYield,
      item_reward: { item_id: harvestItemId, name: harvestItemName, icon: harvestItemIcon, quantity: actualYield },
      currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) }
    };
    if (bonusYield > 0) response.lucky_message = `🍀 幸运收获！多得了 ${bonusYield} 个`;
    if (sssDrop) response.sss_drop = sssDrop;
    res.json(response);
  } catch (error) {
    logger.error('Harvest error', { error: error.message });
    res.status(500).json({ error: '收获失败' });
  }
});

// 铲除 (1.9 重置 fertilized)
app.post('/api/user/plots/:plotIndex/remove', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    const plotResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.stage >= 4) return res.status(400).json({ error: '成熟植物不可铲除，请先收获' });
    await client.query('UPDATE garden_plots SET seed_id = NULL, stage = 0, planted_at = NULL, last_watered_at = NULL, fertilized = FALSE, is_dead = FALSE WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    res.json({ message: '铲除成功', plot_index: plotIndex });
  } catch (error) {
    logger.error('Remove error', { error: error.message });
    res.status(500).json({ error: '铲除失败' });
  }
});

app.get('/api/garden', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 ORDER BY plot_index', [req.user.id]);
    res.json(result.rows.map(p => ({ id: p.id, plot_index: p.plot_index, is_unlocked: p.is_unlocked, level: p.level, seed_id: p.seed_id, stage: p.stage, planted_at: p.planted_at, last_watered_at: p.last_watered_at })));
  } catch (error) {
    logger.error('Get garden error', { error: error.message });
    res.status(500).json({ error: '获取花园状态失败' });
  }
});

app.get('/api/items', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM items WHERE is_shop = true ORDER BY rarity, id');
    res.json(result.rows);
  } catch (error) {
    logger.error('Fetch items error', { error: error.message });
    res.status(500).json({ error: '获取物品列表失败' });
  }
});

app.get('/api/items/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM items ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    logger.error('Fetch all items error', { error: error.message });
    res.status(500).json({ error: '获取物品列表失败' });
  }
});

// ==================== 宠物系统 (1.3-1.6, 1.12) ====================

app.get('/api/user/pets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT up.*, p.name, p.icon, p.pixel_art, p.rarity, p.base_bonus, p.price_type, p.price_amount, p.bonus_curve, p.growth_curve, p.is_test, p.effect_file
       FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.user_id = $1 ORDER BY up.is_active DESC, p.rarity DESC, up.level DESC`,
      [userId]
    );
    const pets = [];
    for (const pet of result.rows) {
      const { currentHunger, growthGained } = await calcCurrentHunger(pet);
      if (growthGained > 0 || currentHunger !== pet.hunger) {
        await client.query('UPDATE user_pets SET hunger = $1, growth_points = growth_points + $2, last_fed_at = CURRENT_TIMESTAMP WHERE id = $3',
          [currentHunger, growthGained, pet.id]);
        pet.hunger = currentHunger;
        pet.growth_points = (pet.growth_points || 0) + growthGained;
      }
      pets.push(await formatPetData(pet, pet));
    }
    res.json({ pets });
  } catch (error) {
    logger.error('Get user pets error:', { error: error.message });
    res.status(500).json({ error: '获取宠物列表失败' });
  }
});

app.get('/api/user/pets/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT up.*, p.name, p.icon, p.pixel_art, p.rarity, p.base_bonus, p.price_type, p.price_amount, p.bonus_curve, p.growth_curve, p.is_test, p.effect_file
       FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.user_id = $1 AND up.is_active = true`,
      [userId]
    );
    if (result.rowCount === 0) return res.json({ pet: null, bonus: 0 });
    const pet = result.rows[0];
    const { currentHunger, growthGained } = await calcCurrentHunger(pet);
    if (growthGained > 0 || currentHunger !== pet.hunger) {
      await client.query('UPDATE user_pets SET hunger = $1, growth_points = growth_points + $2, last_fed_at = CURRENT_TIMESTAMP WHERE id = $3',
        [currentHunger, growthGained, pet.id]);
      pet.hunger = currentHunger;
      pet.growth_points = (pet.growth_points || 0) + growthGained;
    }
    const bonus = await getPetBonus(userId);
    res.json({ pet: await formatPetData(pet, pet), bonus });
  } catch (error) {
    logger.error('Get active pet error:', { error: error.message });
    res.status(500).json({ error: '获取激活宠物信息失败' });
  }
});

app.post('/api/user/pets/:userPetId/activate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    const petResult = await client.query('SELECT * FROM user_pets WHERE id = $1 AND user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];
    const isCurrentlyActive = pet.is_active;
    await client.query('BEGIN');
    try {
      if (isCurrentlyActive) {
        await client.query('UPDATE user_pets SET is_active = false WHERE id = $1', [userPetId]);
      } else {
        await client.query('UPDATE user_pets SET is_active = false WHERE user_id = $1', [userId]);
        await client.query('UPDATE user_pets SET is_active = true WHERE id = $1', [userPetId]);
      }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const updatedPet = await client.query('SELECT * FROM user_pets WHERE id = $1', [userPetId]);
    const template = await client.query('SELECT * FROM pets WHERE id = $1', [updatedPet.rows[0].pet_id]);
    const bonus = await getPetBonus(userId);
    res.json({ message: isCurrentlyActive ? '宠物已休息' : '激活成功', pet: await formatPetData(updatedPet.rows[0], template.rows[0]), current_bonus: bonus });
  } catch (error) {
    logger.error('Activate pet error:', { error: error.message });
    res.status(500).json({ error: '操作宠物失败' });
  }
});

// 喂食 (1.5 饱食度懒计算, 1.6 溢出检查, 1.12 测试宠隔离)
app.post('/api/user/pets/:userPetId/feed', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    const { food_item_id, confirm_overflow } = req.body;
    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    if (!food_item_id) return res.status(400).json({ error: '请提供宠物粮 item_id' });

    const petResult = await client.query(
      'SELECT up.*, p.rarity, p.base_bonus, p.name as pet_name, p.icon as pet_icon, p.bonus_curve, p.growth_curve, p.is_test FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1 AND up.user_id = $2',
      [userPetId, userId]
    );
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];

    // 1.12 测试宠隔离
    if (pet.is_test) return res.status(400).json({ error: '测试宠物不能喂食' });



    const foodItem = await client.query('SELECT * FROM items WHERE id = $1 AND item_type = $2', [food_item_id, 'pet_food']);
    if (foodItem.rowCount === 0) return res.status(400).json({ error: '无效的宠物粮' });
    const foodName = foodItem.rows[0].name;
    const foodEffect = PET_FOOD_EFFECTS[foodName];
    if (!foodEffect) return res.status(400).json({ error: '未知的宠物粮类型' });

    const userFood = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2 AND quantity > 0', [userId, food_item_id]);
    if (userFood.rowCount === 0) return res.status(400).json({ error: '你没有该宠物粮' });

    // 1.6 溢出检查
    const { currentHunger } = await calcCurrentHunger(pet);
    const hungerMax = await getConfig('hunger_max') || 100;
    const newHungerCalc = currentHunger + foodEffect.hunger;
    if (newHungerCalc > hungerMax && !confirm_overflow) {
      const waste = newHungerCalc - hungerMax;
      return res.status(400).json({ overflow: true, waste, message: `饱食度将溢出 ${waste} 点，确认继续？` });
    }

    await client.query('BEGIN');
    try {
      const newQty = userFood.rows[0].quantity - 1;
      if (newQty <= 0) await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, food_item_id]);
      else await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, food_item_id]);

      const newHunger = Math.min(hungerMax, currentHunger + foodEffect.hunger);
      const now = new Date();

      // 喂食只加饱食度，成长值由饱食度衰减自动转化，不自动升级
      await client.query('UPDATE user_pets SET hunger = $1, last_fed_at = $2, feeding_end_at = NULL WHERE id = $3',
        [newHunger, now, userPetId]);
      await client.query('COMMIT');

      const updatedPet = await client.query(
        'SELECT up.*, p.rarity, p.base_bonus, p.name, p.icon, p.pixel_art, p.bonus_curve, p.growth_curve, p.is_test, p.effect_file FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1', [userPetId]);
      res.json({
        message: '喂食成功', pet: await formatPetData(updatedPet.rows[0], updatedPet.rows[0]),
        fed_food: foodItem.rows[0].name, hunger_restored: foodEffect.hunger
      });
    } catch (err) { await client.query('ROLLBACK'); throw err; }
  } catch (error) {
    logger.error('Feed pet error:', { error: error.message });
    res.status(500).json({ error: '喂食失败' });
  }
});

// 宠物升级 (1.4 查表 growth_curve, 1.12 测试宠隔离)
app.post('/api/user/pets/:userPetId/upgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    const petResult = await client.query(
      'SELECT up.*, p.rarity, p.base_bonus, p.bonus_curve, p.growth_curve, p.is_test FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1 AND up.user_id = $2',
      [userPetId, userId]
    );
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];
    if (pet.is_test) return res.status(400).json({ error: '测试宠物不能升级' });

    const growthCurve = pet.growth_curve;
    if (!growthCurve || !Array.isArray(growthCurve)) return res.status(400).json({ error: '宠物升级数据异常' });
    if (pet.level >= 10) return res.status(400).json({ error: '宠物已达最大等级' });

    const required = growthCurve[pet.level];
    if (required === undefined) return res.status(400).json({ error: '无法继续升级' });
    if ((pet.growth_points || 0) < required) return res.status(400).json({ error: `成长值不足，需要 ${required}，当前 ${pet.growth_points || 0}` });

    let newLevel = pet.level;
    let remaining = pet.growth_points || 0;
    while (newLevel < 10 && growthCurve[newLevel] !== undefined && remaining >= growthCurve[newLevel]) {
      remaining -= growthCurve[newLevel];
      newLevel++;
    }

    await client.query('UPDATE user_pets SET level = $1, growth_points = $2 WHERE id = $3', [newLevel, remaining, userPetId]);
    const template = await client.query('SELECT * FROM pets WHERE id = $1', [pet.pet_id]);
    const updatedPet = await client.query('SELECT * FROM user_pets WHERE id = $1', [userPetId]);
    res.json({ message: newLevel > pet.level ? `升级成功！Lv${pet.level} → Lv${newLevel}` : '升级成功', pet: await formatPetData(updatedPet.rows[0], template.rows[0]) });
  } catch (error) {
    logger.error('Upgrade pet error:', { error: error.message });
    res.status(500).json({ error: '升级宠物失败' });
  }
});

// 装备装饰 (1.12 测试宠隔离)
app.post('/api/user/pets/:userPetId/equip', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    const { decoration_id, slot_type } = req.body;
    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    if (!decoration_id) return res.status(400).json({ error: '请提供 decoration_id' });
    if (!slot_type) return res.status(400).json({ error: '请提供 slot_type' });
    const validSlots = ['head', 'neck', 'back', 'special'];
    if (!validSlots.includes(slot_type)) return res.status(400).json({ error: '无效的槽位类型' });

    const petResult = await client.query('SELECT up.*, p.is_test, p.name as pet_name FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1 AND up.user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];

    const decResult = await client.query('SELECT * FROM decorations WHERE id = $1', [decoration_id]);
    if (decResult.rowCount === 0) return res.status(404).json({ error: '装饰不存在' });
    const dec = decResult.rows[0];

    // 1.12 测试宠隔离：只能装备专属饰品
    if (pet.is_test && dec.pet_id !== pet.pet_id) {
      return res.status(400).json({ error: '测试宠物只能装备专属饰品' });
    }

    if (dec.pet_id && dec.pet_id !== pet.pet_id) {
      return res.status(400).json({ error: '该饰品不是该宠物的专属饰品' });
    }

    const userDec = await client.query('SELECT * FROM user_decorations WHERE user_id = $1 AND decoration_id = $2 AND quantity > 0', [userId, decoration_id]);
    if (userDec.rowCount === 0) return res.status(400).json({ error: '你没有该装饰' });

    const targetPet = petResult.rows[0];
    const otherPetResult = await client.query(
      `SELECT id, pet_id FROM user_pets WHERE user_id = $1 AND id != $2 AND equipped_decorations @> $3`,
      [userId, userPetId, JSON.stringify({ [slot_type]: decoration_id })]
    );

    await client.query('BEGIN');
    try {
      if (otherPetResult.rowCount > 0) {
        const otherPet = otherPetResult.rows[0];
        const otherEquipped = otherPet.equipped_decorations || {};
        delete otherEquipped[slot_type];
        await client.query('UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2', [JSON.stringify(otherEquipped), otherPet.id]);
      }
      const equipped = targetPet.equipped_decorations || {};
      equipped[slot_type] = decoration_id;
      await client.query('UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2', [JSON.stringify(equipped), userPetId]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    res.json({ message: '装备成功', slot_type, decoration: { id: dec.id, name: dec.name, icon: dec.icon, bonus: Number(dec.bonus) } });
  } catch (error) {
    logger.error('Equip decoration error:', { error: error.message });
    res.status(500).json({ error: '装备装饰失败' });
  }
});

app.post('/api/user/pets/:userPetId/unequip', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    const { slot_type } = req.body;
    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    if (!slot_type) return res.status(400).json({ error: '请提供 slot_type' });
    const validSlots = ['head', 'neck', 'back', 'special'];
    if (!validSlots.includes(slot_type)) return res.status(400).json({ error: '无效的槽位类型' });
    const petResult = await client.query('SELECT * FROM user_pets WHERE id = $1 AND user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];
    const equipped = pet.equipped_decorations || {};
    if (!equipped[slot_type]) return res.status(400).json({ error: '该槽位没有装备装饰' });
    delete equipped[slot_type];
    await client.query('UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2', [JSON.stringify(equipped), userPetId]);
    res.json({ message: '卸下成功', slot_type });
  } catch (error) {
    logger.error('Unequip decoration error:', { error: error.message });
    res.status(500).json({ error: '卸下装饰失败' });
  }
});

app.get('/api/decorations', authenticateToken, async (req, res) => {
  try {
    const slotType = req.query.slot_type;
    let query = `SELECT d.id, d.name, d.icon, d.slot_type, d.quality, d.bonus, d.price_type, d.price_amount, d.pet_id, p.name as pet_name FROM decorations d LEFT JOIN pets p ON d.pet_id = p.id`;
    const params = [];
    if (slotType) { query += ' WHERE d.slot_type = $1'; params.push(slotType); }
    query += ' ORDER BY d.quality DESC, d.id';
    const result = await client.query(query, params);
    res.json(result.rows.map(d => ({ id: d.id, name: d.name, icon: d.icon, slot_type: d.slot_type, quality: d.quality, bonus: Number(d.bonus), price_type: d.price_type, price_amount: Number(d.price_amount), pet_id: d.pet_id, pet_name: d.pet_name || null })));
  } catch (error) {
    logger.error('Get decorations error:', { error: error.message });
    res.status(500).json({ error: '获取装饰列表失败' });
  }
});

app.get('/api/user/decorations', authenticateToken, async (req, res) => {
  try {
    const result = await client.query(
      `SELECT ud.quantity, d.id, d.name, d.icon, d.slot_type, d.quality, d.bonus, d.price_type, d.price_amount, d.pet_id, p.name as pet_name
       FROM user_decorations ud JOIN decorations d ON ud.decoration_id = d.id LEFT JOIN pets p ON d.pet_id = p.id WHERE ud.user_id = $1 AND ud.quantity > 0 ORDER BY d.slot_type, d.quality DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(d => ({ decoration_id: d.id, quantity: d.quantity, name: d.name, icon: d.icon, slot_type: d.slot_type, quality: d.quality, bonus: Number(d.bonus), price_type: d.price_type, price_amount: Number(d.price_amount), pet_id: d.pet_id, pet_name: d.pet_name || null })));
  } catch (error) {
    logger.error('Get user decorations error:', { error: error.message });
    res.status(500).json({ error: '获取用户装饰列表失败' });
  }
});

// ==================== 好友系统 ====================

const MAX_FRIENDS = 50;
function calcDiscountRate(amount) {
  if (amount <= 100) return 0.8;
  if (amount <= 500) return 0.6;
  return 0.5;
}

app.get('/api/user/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const acceptedResult = await client.query(
      `SELECT f.id, f.friend_id, f.user_id, f.created_at, u.name as friend_name FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'accepted'
       UNION
       SELECT f.id, f.user_id as friend_id, f.friend_id as user_id, f.created_at, u.name as friend_name FROM friendships f JOIN users u ON u.id = f.user_id WHERE f.friend_id = $1 AND f.status = 'accepted'`,
      [userId]
    );
    const pendingResult = await client.query(`SELECT f.id, f.user_id as sender_id, u.name as sender_name, f.created_at FROM friendships f JOIN users u ON u.id = f.user_id WHERE f.friend_id = $1 AND f.status = 'pending'`, [userId]);
    const sentResult = await client.query(`SELECT f.id, f.friend_id as receiver_id, u.name as receiver_name, f.created_at FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'pending'`, [userId]);
    const rejectedResult = await client.query(`SELECT f.id, f.friend_id as receiver_id, u.name as receiver_name, f.created_at FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'rejected'`, [userId]);
    res.json({
      friends: acceptedResult.rows.map(r => ({ friendship_id: r.id, friend_id: r.friend_id, friend_name: r.friend_name, created_at: r.created_at })),
      pending_requests: pendingResult.rows.map(r => ({ friendship_id: r.id, sender_id: r.sender_id, sender_name: r.sender_name, created_at: r.created_at })),
      sent_requests: sentResult.rows.map(r => ({ friendship_id: r.id, receiver_id: r.receiver_id, receiver_name: r.receiver_name, created_at: r.created_at })),
      rejected_requests: rejectedResult.rows.map(r => ({ friendship_id: r.id, receiver_id: r.receiver_id, receiver_name: r.receiver_name, created_at: r.created_at }))
    });
  } catch (error) {
    logger.error('Get friends error:', { error: error.message });
    res.status(500).json({ error: '获取好友列表失败' });
  }
});

app.post('/api/user/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friend_id } = req.body;
    if (!friend_id) return res.status(400).json({ error: '请提供 friend_id' });
    if (friend_id === userId) return res.status(400).json({ error: '不能添加自己为好友' });
    const targetUser = await client.query('SELECT id, name FROM users WHERE id = $1', [friend_id]);
    if (targetUser.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const existing = await client.query(`SELECT * FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`, [userId, friend_id]);
    if (existing.rowCount > 0) {
      if (existing.rows[0].status === 'accepted') return res.status(400).json({ error: '已经是好友了' });
      return res.status(400).json({ error: '已存在待处理的好友请求' });
    }
    const friendCount = await client.query(`SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`, [userId]);
    if (parseInt(friendCount.rows[0].count) >= MAX_FRIENDS) return res.status(400).json({ error: `好友数量已达上限（${MAX_FRIENDS}）` });
    const result = await client.query('INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3) RETURNING *', [userId, friend_id, 'pending']);
    res.status(201).json({ message: '好友请求已发送', friendship: { id: result.rows[0].id, friend_id: result.rows[0].friend_id, status: result.rows[0].status } });
  } catch (error) {
    logger.error('Send friend request error:', { error: error.message });
    res.status(500).json({ error: '发送好友请求失败' });
  }
});

app.post('/api/user/friends/:friendshipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(req.params.friendshipId);
    const { action } = req.body;
    if (!action || !['accept', 'reject'].includes(action)) return res.status(400).json({ error: '请提供有效的 action' });
    const friendship = await client.query('SELECT * FROM friendships WHERE id = $1', [friendshipId]);
    if (friendship.rowCount === 0) return res.status(404).json({ error: '好友请求不存在' });
    const f = friendship.rows[0];
    if (f.friend_id !== userId) return res.status(403).json({ error: '只有接收方可以操作' });
    if (f.status !== 'pending') return res.status(400).json({ error: '该请求已处理' });
    if (action === 'accept') {
      const friendCount = await client.query(`SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`, [userId]);
      if (parseInt(friendCount.rows[0].count) >= MAX_FRIENDS) return res.status(400).json({ error: `好友数量已达上限（${MAX_FRIENDS}）` });
      await client.query('UPDATE friendships SET status = $1 WHERE id = $2', ['accepted', friendshipId]);
      res.json({ message: '已接受好友请求' });
    } else {
      await client.query('UPDATE friendships SET status = $1 WHERE id = $2', ['rejected', friendshipId]);
      res.json({ message: '已拒绝好友请求' });
    }
  } catch (error) {
    logger.error('Handle friend request error:', { error: error.message });
    res.status(500).json({ error: '处理好友请求失败' });
  }
});

app.delete('/api/user/friends/:friendshipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(req.params.friendshipId);
    const friendship = await client.query('SELECT * FROM friendships WHERE id = $1', [friendshipId]);
    if (friendship.rowCount === 0) return res.status(404).json({ error: '好友关系不存在' });
    const f = friendship.rows[0];
    if (f.user_id !== userId && f.friend_id !== userId) return res.status(403).json({ error: '无权操作' });
    await client.query('DELETE FROM friendships WHERE id = $1', [friendshipId]);
    res.json({ message: '好友已删除' });
  } catch (error) {
    logger.error('Delete friend error:', { error: error.message });
    res.status(500).json({ error: '删除好友失败' });
  }
});

app.post('/api/user/friends/:friendId/gift', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;
    const { gift_type, item_id, currency_type, amount } = req.body;
    if (!gift_type || !['item', 'currency'].includes(gift_type)) return res.status(400).json({ error: '请提供有效的 gift_type' });
    const friendship = await client.query(`SELECT * FROM friendships WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted'`, [userId, friendId]);
    if (friendship.rowCount === 0) return res.status(400).json({ error: '对方不是你的好友' });
    const senderUser = await client.query('SELECT created_at FROM users WHERE id = $1', [userId]);
    if (senderUser.rowCount > 0) {
      const accountAge = Date.now() - new Date(senderUser.rows[0].created_at).getTime();
      const cooldownHours = await getConfig('account_gift_cooldown_hours') || 24;
      if (accountAge < cooldownHours * 60 * 60 * 1000) return res.status(400).json({ error: `新注册用户需满${cooldownHours}小时后才能送礼` });
    }
    const friendshipAge = Date.now() - new Date(friendship.rows[0].created_at).getTime();
    const friendCooldown = await getConfig('friend_gift_cooldown_hours') || 24;
    if (friendshipAge < friendCooldown * 60 * 60 * 1000) return res.status(400).json({ error: `添加好友满${friendCooldown}小时后才能互送礼物` });
    const receiver = await client.query('SELECT id FROM users WHERE id = $1', [friendId]);
    if (receiver.rowCount === 0) return res.status(404).json({ error: '接收方不存在' });

    await client.query('BEGIN');
    try {
      if (gift_type === 'item') {
        if (!item_id) { await client.query('ROLLBACK'); return res.status(400).json({ error: '请提供 item_id' }); }
        const userItem = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2 AND quantity > 0', [userId, item_id]);
        if (userItem.rowCount === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: '你没有该物品' }); }
        const giftDailyLimit = await getConfig('gift_daily_limit_silver') || 500;
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const dailyReceived = await client.query(`SELECT COALESCE(SUM(CASE WHEN currency_type = 'gold_coin' THEN amount * 100 WHEN currency_type = 'diamond' THEN amount * 10000 ELSE amount END), 0) as total FROM gifts WHERE receiver_id = $1 AND status = 'accepted' AND created_at >= $2`, [friendId, todayStart]);
        const dailyTotal = Number(dailyReceived.rows[0].total);
        if (dailyTotal > giftDailyLimit) { await client.query('ROLLBACK'); return res.status(400).json({ error: `对方今日接收礼物已达上限` }); }
        await client.query('INSERT INTO gifts (sender_id, receiver_id, gift_type, item_id, amount, discount_rate, status) VALUES ($1, $2, $3, $4, 1, 1.00, $5)', [userId, friendId, 'item', item_id, 'pending']);
        await client.query('COMMIT');
        res.json({ message: '礼物已送出，等待对方接收' });
      } else {
        if (!currency_type || !amount || amount <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: '请提供有效的参数' }); }
        const validTypes = ['silver_coin', 'gold_coin', 'diamond'];
        if (!validTypes.includes(currency_type)) { await client.query('ROLLBACK'); return res.status(400).json({ error: '无效的货币类型' }); }
        const discountRate = calcDiscountRate(amount);
        const receiveAmount = Math.floor(amount * discountRate);
        await deductCurrency(userId, currency_type, amount);
        await client.query('INSERT INTO gifts (sender_id, receiver_id, gift_type, currency_type, amount, discount_rate, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [userId, friendId, 'currency', currency_type, receiveAmount, discountRate, 'pending']);
        await client.query('COMMIT');
        res.json({ message: '礼物已送出，等待对方接收', spent: amount, receive_amount: receiveAmount, discount_rate: discountRate });
      }
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
  } catch (error) {
    logger.error('Gift error:', { error: error.message });
    res.status(500).json({ error: '送礼失败' });
  }
});

app.get('/api/user/gifts', authenticateToken, async (req, res) => {
  try {
    const result = await client.query(`SELECT g.*, u.name as sender_name FROM gifts g JOIN users u ON u.id = g.sender_id WHERE g.receiver_id = $1 AND g.status = 'pending' ORDER BY g.created_at DESC`, [req.user.id]);
    const gifts = [];
    for (const g of result.rows) {
      let giftInfo = { gift_type: g.gift_type };
      if (g.gift_type === 'item' && g.item_id) {
        const item = await client.query('SELECT name, icon, rarity FROM items WHERE id = $1', [g.item_id]);
        if (item.rowCount > 0) giftInfo.item = { id: g.item_id, name: item.rows[0].name, icon: item.rows[0].icon, rarity: item.rows[0].rarity };
      }
      if (g.gift_type === 'currency') { giftInfo.currency_type = g.currency_type; giftInfo.amount = Number(g.amount); }
      gifts.push({ id: g.id, sender_id: g.sender_id, sender_name: g.sender_name, ...giftInfo, created_at: g.created_at });
    }
    res.json({ gifts, count: gifts.length });
  } catch (error) {
    logger.error('Get gifts error:', { error: error.message });
    res.status(500).json({ error: '获取礼物箱失败' });
  }
});

app.post('/api/user/gifts/:giftId/accept', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const giftId = parseInt(req.params.giftId);
    if (isNaN(giftId)) return res.status(400).json({ error: '无效的礼物ID' });
    const giftResult = await client.query('SELECT * FROM gifts WHERE id = $1 AND receiver_id = $2 AND status = $3', [giftId, userId, 'pending']);
    if (giftResult.rowCount === 0) return res.status(404).json({ error: '礼物不存在或已接收' });
    const gift = giftResult.rows[0];
    await client.query('BEGIN');
    try {
      if (gift.gift_type === 'item' && gift.item_id) {
        const senderItem = await client.query('SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
        if (senderItem.rowCount === 0 || senderItem.rows[0].quantity <= 0) {
          await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['expired', giftId]);
          await client.query('COMMIT');
          return res.status(400).json({ error: '发送方已没有该物品，礼物已过期' });
        }
        const newQty = senderItem.rows[0].quantity - 1;
        if (newQty <= 0) await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
        else await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, gift.sender_id, gift.item_id]);
        await client.query('INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 1) ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 1, updated_at = CURRENT_TIMESTAMP', [userId, gift.item_id]);
      } else if (gift.gift_type === 'currency') {
        await addCurrency(userId, gift.currency_type, Number(gift.amount));
      }
      await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['accepted', giftId]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '礼物接收成功', currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) {
    logger.error('Accept gift error:', { error: error.message });
    res.status(500).json({ error: '接收礼物失败' });
  }
});

app.post('/api/user/gifts/accept-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const pendingGifts = await client.query('SELECT * FROM gifts WHERE receiver_id = $1 AND status = $2', [userId, 'pending']);
    if (pendingGifts.rowCount === 0) return res.json({ message: '没有待接收的礼物', accepted: 0 });
    let accepted = 0, failed = 0;
    await client.query('BEGIN');
    try {
      for (const gift of pendingGifts.rows) {
        try {
          if (gift.gift_type === 'item' && gift.item_id) {
            const senderItem = await client.query('SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
            if (senderItem.rowCount === 0 || senderItem.rows[0].quantity <= 0) { await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['expired', gift.id]); failed++; continue; }
            const newQty = senderItem.rows[0].quantity - 1;
            if (newQty <= 0) await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
            else await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, gift.sender_id, gift.item_id]);
            await client.query('INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 1) ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 1, updated_at = CURRENT_TIMESTAMP', [userId, gift.item_id]);
          } else if (gift.gift_type === 'currency') {
            await addCurrency(userId, gift.currency_type, Number(gift.amount));
          }
          await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['accepted', gift.id]);
          accepted++;
        } catch (e) { failed++; }
      }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: `接收完成：成功 ${accepted} 个${failed > 0 ? `，失败 ${failed} 个` : ''}`, accepted, failed, currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) {
    logger.error('Accept all gifts error:', { error: error.message });
    res.status(500).json({ error: '接收礼物失败' });
  }
});

app.post('/api/user/friends/:friendId/transfer', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;
    const { currency_type, amount } = req.body;
    if (!currency_type || !amount || amount <= 0) return res.status(400).json({ error: '请提供有效的参数' });
    const validTypes = ['silver_coin', 'gold_coin', 'diamond'];
    if (!validTypes.includes(currency_type)) return res.status(400).json({ error: '无效的货币类型' });
    const friendship = await client.query(`SELECT * FROM friendships WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted'`, [userId, friendId]);
    if (friendship.rowCount === 0) return res.status(400).json({ error: '对方不是你的好友' });
    const discountRate = calcDiscountRate(amount);
    const receiveAmount = Math.floor(amount * discountRate);
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, currency_type, amount);
      await addCurrency(friendId, currency_type, receiveAmount);
      await client.query('INSERT INTO gifts (sender_id, receiver_id, gift_type, currency_type, amount, discount_rate, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [userId, friendId, 'transfer', currency_type, amount, discountRate, 'accepted']);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '转让成功', spent: amount, received: receiveAmount, discount_rate: discountRate, currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) {
    logger.error('Transfer error:', { error: error.message });
    res.status(500).json({ error: '转让失败' });
  }
});

// ==================== 订单路由 ====================

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const ordersResult = await client.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [req.user.id, limit, offset]);
    const totalResult = await client.query('SELECT COUNT(*) as total FROM orders WHERE user_id = $1', [req.user.id]);
    res.json({ orders: ordersResult.rows.map(o => ({ id: o.id, user_id: o.user_id, type: o.type, currency_type: o.currency_type, amount: Number(o.amount), created_at: o.created_at ? new Date(o.created_at).toISOString() : null })), pagination: { page, limit, total: parseInt(totalResult.rows[0].total), totalPages: Math.ceil(parseInt(totalResult.rows[0].total) / limit) } });
  } catch (error) {
    logger.error('Fetch orders error', { error: error.message });
    res.status(500).json({ error: '获取订单列表失败' });
  }
});

// ==================== 管理员路由 ====================

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '请填写所有必填字段' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: '请输入有效的邮箱地址' });
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{6,20}$/;
    if (!passwordRegex.test(password)) return res.status(400).json({ error: '密码只能包含字母、数字和常见符号,长度6-20位' });
    const username = name || email.split('@')[0];
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) return res.status(400).json({ error: '该邮箱已被注册' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const nextId = await generateUserId('admin');
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO users (id, name, email, password, role, is_new_user) VALUES ($1, $2, $3, $4, $5, $6)', [nextId, username, email, hashedPassword, 'admin', false]);
      await client.query('INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1, $2, $3, $4)', [nextId, 0, 0, 0]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    res.status(201).json({ message: '管理员用户创建成功', userId: nextId });
  } catch (error) {
    logger.error('Create admin user error', { error: error.message });
    res.status(500).json({ error: '创建管理员用户失败' });
  }
});

app.post('/api/admin/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd, stage_skip, purchasable } = req.body;
    if (!name || !item_type) return res.status(400).json({ error: '请填写物品名和类型' });
    const result = await client.query(
      `INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd, stage_skip, purchasable) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [name, icon || '', rarity || 'C', item_type, base_yield || 0, buy_price || 0, sell_price || 0, currency_type || 'silver_coin', is_shop !== false, crop_id || null, water_cd || 5, stage_skip || 1, purchasable !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create item error', { error: error.message });
    res.status(500).json({ error: '创建物品失败' });
  }
});

app.put('/api/admin/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd, stage_skip, purchasable } = req.body;
    const existing = await client.query('SELECT * FROM items WHERE id = $1', [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    const e = existing.rows[0];
    const result = await client.query(
      `UPDATE items SET name=$1, icon=$2, rarity=$3, item_type=$4, base_yield=$5, buy_price=$6, sell_price=$7, currency_type=$8, is_shop=$9, crop_id=$10, water_cd=$11, stage_skip=$12, purchasable=$13 WHERE id=$14 RETURNING *`,
      [name||e.name, icon!==undefined?icon:e.icon, rarity||e.rarity, item_type||e.item_type, base_yield!==undefined?base_yield:e.base_yield, buy_price!==undefined?buy_price:e.buy_price, sell_price!==undefined?sell_price:e.sell_price, currency_type||e.currency_type, is_shop!==undefined?is_shop:e.is_shop, crop_id!==undefined?crop_id:e.crop_id, water_cd||e.water_cd||5, stage_skip!==undefined?stage_skip:(e.stage_skip||1), purchasable!==undefined?purchasable:(e.purchasable!==false), id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update item error', { error: error.message });
    res.status(500).json({ error: '更新物品失败' });
  }
});

app.delete('/api/admin/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('DELETE FROM items WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    res.json({ message: '物品删除成功' });
  } catch (error) {
    logger.error('Delete item error', { error: error.message });
    res.status(500).json({ error: '删除物品失败' });
  }
});

app.get('/api/pets/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json(await (await client.query('SELECT * FROM pets ORDER BY rarity, id')).rows);
  } catch (error) {
    logger.error('Get pets error', { error: error.message });
    res.status(500).json({ error: '获取宠物列表失败' });
  }
});

app.post('/api/admin/pets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, rarity, base_bonus, price_amount, price_type, is_shop, purchasable, bonus_curve, growth_curve, is_test, effect_file } = req.body;
    if (!name) return res.status(400).json({ error: '请填写宠物名' });
    const result = await client.query(
      `INSERT INTO pets (name, icon, rarity, base_bonus, price_amount, price_type, is_shop, purchasable, bonus_curve, growth_curve, is_test, effect_file) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, icon||'🐾', rarity||'C', base_bonus||5, price_amount||100, price_type||'silver_coin', is_shop!==false, purchasable!==false, bonus_curve?JSON.stringify(bonus_curve):null, growth_curve?JSON.stringify(growth_curve):null, is_test||false, effect_file||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create pet error', { error: error.message });
    res.status(500).json({ error: '创建宠物失败' });
  }
});

app.put('/api/admin/pets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, rarity, base_bonus, price_amount, price_type, is_shop, purchasable, bonus_curve, growth_curve, is_test, effect_file } = req.body;
    const existing = await client.query('SELECT * FROM pets WHERE id = $1', [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const e = existing.rows[0];
    const result = await client.query(
      `UPDATE pets SET name=$1, icon=$2, rarity=$3, base_bonus=$4, price_amount=$5, price_type=$6, is_shop=$7, purchasable=$8, bonus_curve=$9, growth_curve=$10, is_test=$11, effect_file=$12 WHERE id=$13 RETURNING *`,
      [name||e.name, icon||e.icon, rarity||e.rarity, base_bonus!==undefined?base_bonus:e.base_bonus, price_amount!==undefined?price_amount:e.price_amount, price_type||e.price_type, is_shop!==undefined?is_shop:e.is_shop, purchasable!==undefined?purchasable:(e.purchasable!==false), bonus_curve?JSON.stringify(bonus_curve):e.bonus_curve, growth_curve?JSON.stringify(growth_curve):e.growth_curve, is_test!==undefined?is_test:e.is_test, effect_file!==undefined?effect_file:e.effect_file, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update pet error', { error: error.message });
    res.status(500).json({ error: '更新宠物失败' });
  }
});

app.delete('/api/admin/pets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('DELETE FROM pets WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    res.json({ message: '宠物删除成功' });
  } catch (error) {
    logger.error('Delete pet error', { error: error.message });
    res.status(500).json({ error: '删除宠物失败' });
  }
});

app.get('/api/admin/active-users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const result = await client.query('SELECT COUNT(*) as count FROM users WHERE last_login_at >= $1 AND role = $2', [today, 'user']);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    logger.error('Get active users error', { error: error.message });
    res.status(500).json({ error: '获取活跃用户数失败' });
  }
});

app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const ordersResult = await client.query('SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const totalResult = await client.query('SELECT COUNT(*) as total FROM orders');
    res.json({ orders: ordersResult.rows.map(o => ({ id: o.id, user_id: o.user_id, type: o.type, currency_type: o.currency_type, amount: Number(o.amount), created_at: o.created_at ? new Date(o.created_at).toISOString() : null, user: { id: o.user_id, name: o.user_name, email: o.user_email } })), pagination: { page, limit, total: parseInt(totalResult.rows[0].total), totalPages: Math.ceil(parseInt(totalResult.rows[0].total) / limit) } });
  } catch (error) {
    logger.error('Fetch admin orders error', { error: error.message });
    res.status(500).json({ error: '获取订单列表失败' });
  }
});

app.delete('/api/admin/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('DELETE FROM orders WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '订单不存在' });
    res.json({ message: '订单删除成功' });
  } catch (error) {
    logger.error('Delete order error', { error: error.message });
    res.status(500).json({ error: '删除订单失败' });
  }
});

app.put('/api/admin/users/:id/currencies', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { silver_coin, gold_coin, diamond } = req.body;
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const curCheck = await client.query('SELECT * FROM currencies WHERE user_id = $1', [id]);
    if (curCheck.rowCount === 0) return res.status(404).json({ error: '用户货币记录不存在' });
    const updates = [];
    const params = [];
    let paramIdx = 1;
    if (silver_coin !== undefined) { updates.push(`silver_coin = $${paramIdx++}`); params.push(silver_coin); }
    if (gold_coin !== undefined) { updates.push(`gold_coin = $${paramIdx++}`); params.push(gold_coin); }
    if (diamond !== undefined) { updates.push(`diamond = $${paramIdx++}`); params.push(diamond); }
    if (updates.length === 0) return res.status(400).json({ error: '请提供要修改的货币字段' });
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await client.query(`UPDATE currencies SET ${updates.join(', ')} WHERE user_id = $${paramIdx} RETURNING *`, params);
    res.json({ message: '货币更新成功', currencies: { silver_coin: Number(result.rows[0].silver_coin), gold_coin: Number(result.rows[0].gold_coin), diamond: Number(result.rows[0].diamond) } });
  } catch (error) {
    logger.error('Update user currencies error', { error: error.message });
    res.status(500).json({ error: '更新用户货币失败' });
  }
});

app.put('/api/admin/users/:id/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id, quantity } = req.body;
    if (!item_id || quantity === undefined) return res.status(400).json({ error: '请提供 item_id 和 quantity' });
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const itemCheck = await client.query('SELECT id, name FROM items WHERE id = $1', [item_id]);
    if (itemCheck.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    if (quantity === 0) await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [id, item_id]);
    else await client.query('INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = $3, updated_at = CURRENT_TIMESTAMP', [id, item_id, quantity]);
    res.json({ message: '背包物品更新成功', item: { id: item_id, name: itemCheck.rows[0].name, quantity } });
  } catch (error) {
    logger.error('Update user items error', { error: error.message });
    res.status(500).json({ error: '更新用户背包物品失败' });
  }
});

// ==================== 1.14 管理员 API ====================

app.get('/api/admin/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT key, value, description, updated_at FROM global_config ORDER BY key');
    res.json(result.rows);
  } catch (error) {
    logger.error('Get config error:', { error: error.message });
    res.status(500).json({ error: '获取配置失败' });
  }
});

app.put('/api/admin/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key, value: newValue } = req.body;
    if (key && newValue !== undefined) {
      // 单项更新 { key, value }
      await client.query('INSERT INTO global_config (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [key, JSON.stringify(newValue)]);
    } else {
      // 批量更新 { key1: val1, key2: val2 }
      const updates = req.body;
      if (!updates || typeof updates !== 'object') return res.status(400).json({ error: '请提供配置键值对' });
      await client.query('BEGIN');
      try {
        for (const [k, v] of Object.entries(updates)) {
          await client.query('INSERT INTO global_config (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [k, JSON.stringify(v)]);
        }
        await client.query('COMMIT');
      } catch (err) { await client.query('ROLLBACK'); throw err; }
    }
    _configCache = null;
    res.json({ message: '配置更新成功' });
  } catch (error) {
    logger.error('Update config error:', { error: error.message });
    res.status(500).json({ error: '更新配置失败' });
  }
});

app.get('/api/admin/pets/:id/curve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT id, name, bonus_curve, growth_curve, base_bonus FROM pets WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get pet curve error:', { error: error.message });
    res.status(500).json({ error: '获取宠物曲线失败' });
  }
});

app.put('/api/admin/pets/:id/curve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { bonus_curve, growth_curve } = req.body;
    const existing = await client.query('SELECT id FROM pets WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const updates = [];
    const params = [];
    let idx = 1;
    if (bonus_curve) { updates.push(`bonus_curve = $${idx++}`); params.push(JSON.stringify(bonus_curve)); }
    if (growth_curve) { updates.push(`growth_curve = $${idx++}`); params.push(JSON.stringify(growth_curve)); }
    if (updates.length === 0) return res.status(400).json({ error: '请提供要更新的曲线' });
    params.push(req.params.id);
    await client.query(`UPDATE pets SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    res.json({ message: '宠物曲线更新成功' });
  } catch (error) {
    logger.error('Update pet curve error:', { error: error.message });
    res.status(500).json({ error: '更新宠物曲线失败' });
  }
});

app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await client.query(`SELECT COUNT(*) as count FROM users WHERE role = 'user'`);
    const totalOrders = await client.query('SELECT COUNT(*) as count FROM orders');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const activeToday = await client.query(`SELECT COUNT(*) as count FROM users WHERE last_login_at >= $1 AND role = 'user'`, [today]);
    const totalItems = await client.query('SELECT COUNT(*) as count FROM items');
    const totalPets = await client.query('SELECT COUNT(*) as count FROM user_pets');
    const currencies = await client.query('SELECT COALESCE(SUM(silver_coin),0) as silver, COALESCE(SUM(gold_coin),0) as gold, COALESCE(SUM(diamond),0) as diamond FROM currencies');
    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      totalItems: parseInt(totalItems.rows[0].count),
      totalSilverCoin: parseInt(currencies.rows[0].silver),
      totalGoldCoin: parseInt(currencies.rows[0].gold),
      totalDiamond: parseInt(currencies.rows[0].diamond),
      totalOrders: parseInt(totalOrders.rows[0].count),
      todayActiveUsers: parseInt(activeToday.rows[0].count)
    });
  } catch (error) {
    logger.error('Get stats error:', { error: error.message });
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// ==================== 快速重置 ====================
app.post('/api/admin/reset', authenticateToken, requireAdmin, async (req, res) => {
  try {
    logger.info('Full database reset initiated');

    // DROP 所有表
    await client.query('DROP TABLE IF EXISTS orders, gifts, friendships, user_decorations, user_pets, user_items, garden_plots, currencies, users, items, pets, decorations, global_config CASCADE');

    // 重新初始化（建表 + 插入默认数据）
    await initDatabase();

    // 创建两个演示账号
    const demoAccounts = [
      { name: '演示用户A', email: 'demo_a@test.com', password: '123456' },
      { name: '演示用户B', email: 'demo_b@test.com', password: '123456' }
    ];

    for (const demo of demoAccounts) {
      const hashedPw = await bcrypt.hash(demo.password, 10);
      const nextId = await generateUserId('user');

      await client.query(
        'INSERT INTO users (id, name, email, password, role, is_new_user) VALUES ($1, $2, $3, $4, $5, $6)',
        [nextId, demo.name, demo.email, hashedPw, 'user', true]
      );

      await client.query(
        'INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1, 10000, 10000, 10000)',
        [nextId]
      );

      for (let i = 1; i <= 6; i++) {
        await client.query(
          'INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3)',
          [nextId, i, i === 1]
        );
      }

      const cSeeds = await client.query("SELECT id FROM items WHERE item_type = 'seed' AND rarity = 'C'");
      for (const seed of cSeeds.rows) {
        await client.query('INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 2)', [nextId, seed.id]);
      }

      logger.info('Demo account created', { email: demo.email, id: nextId });
    }

    logger.info('Full database reset completed');
    res.json({ message: '重置成功', accounts: demoAccounts.map(a => ({ name: a.name, email: a.email, password: a.password })) });
  } catch (error) {
    logger.error('Reset error:', { error: error.message });
    res.status(500).json({ error: '重置失败: ' + error.message });
  }
});

// ==================== 1.15 宠物特效文件上传 ====================

const effectsDir = path.join(__dirname, 'effects');
if (!fs.existsSync(effectsDir)) fs.mkdirSync(effectsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, effectsDir),
  filename: (req, file, cb) => {
    const name = file.originalname.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    cb(null, name.endsWith('.js') ? name : name + '.js');
  }
});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 } });

app.post('/api/admin/effects/upload', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    const filePath = req.file.path;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.includes('name') || !content.includes('init')) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: '特效文件必须导出 { name, init }' });
      }
    } catch (e) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: '文件校验失败' });
    }
    res.json({ message: '上传成功', filename: req.file.filename });
  } catch (error) {
    logger.error('Upload effect error:', { error: error.message });
    res.status(500).json({ error: '上传失败' });
  }
});

app.get('/api/admin/effects', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const files = fs.existsSync(effectsDir) ? fs.readdirSync(effectsDir).filter(f => f.endsWith('.js')) : [];
    res.json({ effects: files });
  } catch (error) {
    logger.error('Get effects error:', { error: error.message });
    res.status(500).json({ error: '获取特效列表失败' });
  }
});

app.get('/api/effects/:filename', (req, res) => {
  try {
    const filename = req.params.filename.replace(/[^a-z0-9-\.]/g, '-');
    const filePath = path.join(effectsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '特效文件不存在' });
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(filePath);
  } catch (error) {
    logger.error('Get effect file error:', { error: error.message });
    res.status(500).json({ error: '获取特效文件失败' });
  }
});

// ==================== AI 问答 ====================

const aiRateLimitMap = new Map();
const AI_RATE_LIMIT = 5;
const AI_RATE_WINDOW = 60 * 1000;
function checkAiRateLimit(userId) {
  const now = Date.now();
  const record = aiRateLimitMap.get(userId);
  if (!record || now > record.resetTime) { aiRateLimitMap.set(userId, { count: 1, resetTime: now + AI_RATE_WINDOW }); return true; }
  if (record.count >= AI_RATE_LIMIT) return false;
  record.count++;
  return true;
}
setInterval(() => { const now = Date.now(); for (const [key, value] of aiRateLimitMap) { if (now > value.resetTime) aiRateLimitMap.delete(key); } }, 5 * 60 * 1000);

app.post('/api/ask', authenticateToken, async (req, res) => {
  try {
    const { question, conversation_id } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) return res.status(400).json({ error: '请输入问题' });
    if (question.length > 500) return res.status(400).json({ error: '问题不能超过 500 字' });
    if (!checkAiRateLimit(req.user.id)) return res.status(429).json({ error: '提问太频繁了' });
    const difyApiKey = process.env.DIFY_API_KEY;
    const difyApiUrl = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
    if (!difyApiKey || difyApiKey === 'your-dify-api-key') return res.json({ answer: '🤖 AI 助手暂未配置', conversation_id: null });
    const difyResponse = await fetch(`${difyApiUrl}/chat-messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${difyApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: {}, query: question.trim(), response_mode: 'blocking', conversation_id: conversation_id || '', user: `cyberplant-user-${req.user.id}` })
    });
    if (!difyResponse.ok) return res.json({ answer: '🤖 AI 助手暂时无法回答', conversation_id: null });
    const difyData = await difyResponse.json();
    let answer = (difyData.answer || '抱歉，暂时无法回答。').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    res.json({ answer, conversation_id: difyData.conversation_id || null });
  } catch (error) {
    logger.error('AI ask error', { error: error.message });
    res.json({ answer: '🤖 AI 助手暂时无法回答', conversation_id: null });
  }
});

// SPA fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) res.sendFile(path.join(frontendPath, 'index.html'));
  else next();
});

async function startServer() {
  try {
    await initDatabase();
    const server = app.listen(PORT, () => { logger.info(`Server is running on port ${PORT}`); });
    process.on('SIGTERM', async () => { server.close(async () => { console.log('Server closed'); await client.end(); }); });
  } catch (error) {
    console.error('Error starting server:', error);
    await client.end();
    process.exit(1);
  }
}

startServer();

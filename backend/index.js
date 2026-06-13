const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const logger = require('./utils/logger');
const path = require('path');
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
const MAX_ITEM_COUNT = 999;
const MAX_POINTS = 999999999;
const MAX_PRICE = 9999;

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

// 初始化数据库
async function initDatabase() {
  try {
    await client.connect();
    logger.info('Connected to PostgreSQL database');

    // ========== 删除旧表（按外键依赖顺序） ==========
    await client.query('DROP TABLE IF EXISTS orders CASCADE');
    await client.query('DROP TABLE IF EXISTS user_items CASCADE');
    await client.query('DROP TABLE IF EXISTS user_decorations CASCADE');
    await client.query('DROP TABLE IF EXISTS garden_plots CASCADE');
    await client.query('DROP TABLE IF EXISTS user_pets CASCADE');
    await client.query('DROP TABLE IF EXISTS gifts CASCADE');
    await client.query('DROP TABLE IF EXISTS friendships CASCADE');
    await client.query('DROP TABLE IF EXISTS items CASCADE');
    await client.query('DROP TABLE IF EXISTS decorations CASCADE');
    await client.query('DROP TABLE IF EXISTS pets CASCADE');
    await client.query('DROP TABLE IF EXISTS currencies CASCADE');
    await client.query('DROP TABLE IF EXISTS garden CASCADE');
    await client.query('DROP TABLE IF EXISTS plants CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    // ========== 创建 users 表 ==========
    await client.query(`
      CREATE TABLE users (
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

    // items 表（物品模板）
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
    
    // 如果 crop_id 字段不存在，添加它
    const cropIdCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'items' AND column_name = 'crop_id'
    `);
    if (cropIdCheck.rowCount === 0) {
      await client.query(`
        ALTER TABLE items ADD COLUMN crop_id INT DEFAULT NULL
      `);
    }

    // 如果 water_cd 字段不存在，添加它
    const waterCdCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'items' AND column_name = 'water_cd'
    `);
    if (waterCdCheck.rowCount === 0) {
      await client.query(`
        ALTER TABLE items ADD COLUMN water_cd INT DEFAULT 5
      `);
      logger.info('Added water_cd column to items table');
    }
    
    // 将现有种子的 water_cd 更新为5秒
    await client.query(`
      UPDATE items SET water_cd = 5 WHERE item_type = 'seed' AND (water_cd IS NULL OR water_cd != 5)
    `);
    
    // 如果 grow_time 字段存在，删除它（已废弃，改为自动计算 5×water_cd）
    const growTimeCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'items' AND column_name = 'grow_time'
    `);
    if (growTimeCheck.rowCount > 0) {
      await client.query(`ALTER TABLE items DROP COLUMN grow_time`);
      logger.info('Dropped grow_time column from items table');
    }

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

    // orders 新表
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

    // 创建索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON orders(user_id, created_at)
    `);

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

    // friendships 索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id)
    `);

    // ========== Phase 5: 宠物系统表 ==========

    // pets 宠物模板表
    await client.query(`
      CREATE TABLE IF NOT EXISTS pets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(50),
        pixel_art TEXT,
        rarity VARCHAR(50) NOT NULL,
        base_bonus NUMERIC(5,2) DEFAULT 0,
        price_type VARCHAR(20) DEFAULT 'silver_coin',
        price_amount BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // user_pets 用户宠物表
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

    // decorations 装饰模板表
    await client.query(`
      CREATE TABLE IF NOT EXISTS decorations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(50),
        slot_type VARCHAR(50) NOT NULL,
        quality VARCHAR(50) DEFAULT 'normal',
        bonus NUMERIC(5,2) DEFAULT 0,
        price_type VARCHAR(20) DEFAULT 'silver_coin',
        price_amount BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // user_decorations 用户持有装饰表
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

    // user_pets 索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_pets_user_id ON user_pets(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_pets_active ON user_pets(user_id, is_active) WHERE is_active = true
    `);

    // user_decorations 索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_decorations_user_id ON user_decorations(user_id)
    `);

    // ========== 插入宠物模板数据 ==========
    const petsCheck = await client.query('SELECT COUNT(*) as count FROM pets');
    if (parseInt(petsCheck.rows[0].count) === 0) {
      const petTemplates = [
        ['小豆猫', '🐱', '🐱', 'common', 3.00, 'silver_coin', 500],
        ['泡泡鱼', '🐟', '🐟', 'common', 3.00, 'silver_coin', 500],
        ['星光兔', '🐰', '🐰', 'rare', 8.00, 'gold_coin', 200],
        ['雷霆鹰', '🦅', '🦅', 'rare', 8.00, 'gold_coin', 200],
        ['水晶龙', '🐉', '🐉', 'epic', 15.00, 'diamond', 50],
        ['凤凰之翼', '🦅', '🔥🦅', 'legendary', 20.00, 'diamond', 100],
      ];
      for (const p of petTemplates) {
        await client.query(
          'INSERT INTO pets (name, icon, pixel_art, rarity, base_bonus, price_type, price_amount) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          p
        );
      }
      logger.info('Pet template data inserted');
    }

    // ========== 插入装饰模板数据 ==========
    const decCheck = await client.query('SELECT COUNT(*) as count FROM decorations');
    if (parseInt(decCheck.rows[0].count) === 0) {
      const decTemplates = [
        ['小花环', '🌸', 'head', 'normal', 2.00, 'silver_coin', 200],
        ['皇冠', '👑', 'head', 'rare', 5.00, 'gold_coin', 50],
        ['围巾', '🧣', 'neck', 'normal', 2.00, 'silver_coin', 150],
        ['宝石项链', '📿', 'neck', 'rare', 5.00, 'gold_coin', 80],
        ['小披风', '🦸', 'back', 'normal', 3.00, 'silver_coin', 300],
        ['魔法翅膀', '🪽', 'back', 'epic', 8.00, 'diamond', 20],
        ['魔法光环', '✨', 'special', 'epic', 10.00, 'diamond', 30],
        ['彩虹尾焰', '🌈', 'special', 'legendary', 15.00, 'diamond', 60],
      ];
      for (const d of decTemplates) {
        await client.query(
          'INSERT INTO decorations (name, icon, slot_type, quality, bonus, price_type, price_amount) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          d
        );
      }
      logger.info('Decoration template data inserted');
    }

    // ========== 插入物品种子数据 ==========
    const itemsCheck = await client.query('SELECT COUNT(*) as count FROM items');
    
    // 检查 crop_id 字段是否存在
    const cropIdColumnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'items' AND column_name = 'crop_id'
    `);
    if (cropIdColumnCheck.rowCount === 0) {
      await client.query(`ALTER TABLE items ADD COLUMN crop_id INT DEFAULT NULL`);
      logger.info('Added crop_id column to items table');
    }
    
    // 检查是否有作物数据
    const cropCheck = await client.query("SELECT COUNT(*) as count FROM items WHERE item_type = 'crop'");
    const hasCrops = parseInt(cropCheck.rows[0].count) > 0;
    
    // 作物数据定义
    const crops = [
      // C级作物
      ['土豆', '🥔', 'C', 'crop', 1, 5, 3, 'silver_coin', true],
      ['胡萝卜', '🥕', 'C', 'crop', 1, 6, 4, 'silver_coin', true],
      ['白菜', '🥬', 'C', 'crop', 1, 4, 2, 'silver_coin', true],
      ['黄瓜', '🥒', 'C', 'crop', 1, 7, 4, 'silver_coin', true],
      // B级作物
      ['番茄', '🍅', 'B', 'crop', 2, 15, 8, 'silver_coin', true],
      ['蓝莓', '🫐', 'B', 'crop', 2, 17, 9, 'silver_coin', true],
      ['玉米', '🌽', 'B', 'crop', 2, 12, 6, 'silver_coin', true],
      ['南瓜', '🎃', 'B', 'crop', 2, 20, 10, 'silver_coin', true],
      // A级作物
      ['草莓', '🍓', 'A', 'crop', 3, 40, 20, 'gold_coin', true],
      ['西瓜', '🍉', 'A', 'crop', 3, 50, 25, 'gold_coin', true],
      ['葡萄', '🍇', 'A', 'crop', 3, 30, 15, 'gold_coin', true],
      // S级作物
      ['玫瑰', '🌹', 'S', 'crop', 5, 100, 50, 'gold_coin', true],
      ['兰花', '🌸', 'S', 'crop', 5, 125, 60, 'gold_coin', true],
      // SSS级作物（不在商店出售）
      ['金盏花', '🌟', 'SSS', 'crop', 8, 250, 125, 'diamond', false],
      ['星尘花', '✨', 'SSS', 'crop', 10, 400, 200, 'diamond', false],
    ];

    // 种子与作物对应关系（按名称匹配）
    const seedCropMapping = {
      '土豆种子': '土豆',
      '胡萝卜种子': '胡萝卜',
      '白菜种子': '白菜',
      '黄瓜种子': '黄瓜',
      '番茄种子': '番茄',
      '蓝莓种子': '蓝莓',
      '玉米种子': '玉米',
      '南瓜种子': '南瓜',
      '草莓种子': '草莓',
      '西瓜种子': '西瓜',
      '葡萄种子': '葡萄',
      '玫瑰种子': '玫瑰',
      '兰花种子': '兰花',
      '金盏花种子': '金盏花',
      '星尘花种子': '星尘花',
    };

    // 如果没有作物数据，插入作物
    if (!hasCrops) {
      logger.info('No crops found, inserting crop data...');
      for (const crop of crops) {
        await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          crop
        );
      }
      logger.info('Crop data inserted');
    }

    // 更新现有种子的 crop_id 关联
    const cropItems = await client.query("SELECT id, name FROM items WHERE item_type = 'crop'");
    const cropIdByName = {};
    for (const crop of cropItems.rows) {
      cropIdByName[crop.name] = crop.id;
    }

    const seedItems = await client.query("SELECT id, name FROM items WHERE item_type = 'seed'");
    for (const seed of seedItems.rows) {
      const cropName = seedCropMapping[seed.name];
      if (cropName && cropIdByName[cropName]) {
        await client.query('UPDATE items SET crop_id = $1 WHERE id = $2', [cropIdByName[cropName], seed.id]);
      }
    }
    logger.info('Seed crop_id associations updated');

    // 如果 items 表完全为空，插入种子和其他物品
    if (parseInt(itemsCheck.rows[0].count) === 0) {
      // 种子数据（crop_id 已通过上面更新逻辑设置）
      const cropSeeds = [
        // C级
        ['土豆种子', '🥔', 'C', 'seed', 1, 10, 5, 'silver_coin', true],
        ['胡萝卜种子', '🥕', 'C', 'seed', 1, 12, 6, 'silver_coin', true],
        ['白菜种子', '🥬', 'C', 'seed', 1, 8, 4, 'silver_coin', true],
        ['黄瓜种子', '🥒', 'C', 'seed', 1, 15, 7, 'silver_coin', true],
        // B级
        ['番茄种子', '🍅', 'B', 'seed', 2, 30, 15, 'silver_coin', true],
        ['蓝莓种子', '🫐', 'B', 'seed', 2, 35, 17, 'silver_coin', true],
        ['玉米种子', '🌽', 'B', 'seed', 2, 25, 12, 'silver_coin', true],
        ['南瓜种子', '🎃', 'B', 'seed', 2, 40, 20, 'silver_coin', true],
        // A级
        ['草莓种子', '🍓', 'A', 'seed', 3, 80, 40, 'gold_coin', true],
        ['西瓜种子', '🍉', 'A', 'seed', 3, 100, 50, 'gold_coin', true],
        ['葡萄种子', '🍇', 'A', 'seed', 3, 60, 30, 'gold_coin', true],
        // S级
        ['玫瑰种子', '🌹', 'S', 'seed', 5, 200, 100, 'gold_coin', true],
        ['兰花种子', '🌸', 'S', 'seed', 5, 250, 125, 'gold_coin', true],
        // SSS级（不在商店出售）
        ['金盏花种子', '🌟', 'SSS', 'seed', 8, 500, 250, 'diamond', false],
        ['星尘花种子', '✨', 'SSS', 'seed', 10, 800, 400, 'diamond', false],
      ];

      for (const seed of cropSeeds) {
        const result = await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
          seed
        );
        // 设置 crop_id
        const cropName = seedCropMapping[seed[0]];
        if (cropName && cropIdByName[cropName]) {
          await client.query('UPDATE items SET crop_id = $1 WHERE id = $2', [cropIdByName[cropName], result.rows[0].id]);
        }
      }

      // 肥料 (2种)
      const fertilizers = [
        ['普通肥料', '🧪', 'C', 'fertilizer', 0, 30, 15, 'silver_coin', true],
        ['高级肥料', '⚗️', 'A', 'fertilizer', 0, 200, 100, 'gold_coin', true],
      ];
      for (const f of fertilizers) {
        await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          f
        );
      }

      // 宠物粮 (4种)
      const petFoods = [
        ['普通粮', '🍖', 'C', 'pet_food', 0, 80, 40, 'silver_coin', true],
        ['精良粮', '🥩', 'B', 'pet_food', 0, 200, 100, 'silver_coin', true],
        ['高级粮', '🍱', 'A', 'pet_food', 0, 500, 250, 'gold_coin', true],
        ['稀有粮', '🍜', 'S', 'pet_food', 0, 1500, 750, 'gold_coin', true],
      ];
      for (const pf of petFoods) {
        await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          pf
        );
      }

      logger.info('Item seed data inserted');
    }

    // ========== 创建测试账户 ==========

    // 管理员账户
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

    // 测试账户1
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
      // 创建6块地，第1块已解锁
      for (let i = 1; i <= 6; i++) {
        await client.query(
          'INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3)',
          [test1Id, i, i === 1]
        );
      }
      // 发放 C 级种子 ×5
      const cSeeds1 = await client.query("SELECT id FROM items WHERE item_type = 'seed' AND rarity = 'C'");
      for (const seed of cSeeds1.rows) {
        await client.query(
          'INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 5)',
          [test1Id, seed.id]
        );
      }
    }

    // 测试账户2
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
      // 发放 C 级种子 ×5
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

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// 管理员权限中间件
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// 健康检查路由
app.get('/', (req, res) => {
  res.json({ message: 'Backend API is running' });
});

// ==================== 认证路由 ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    logger.info('Register request received', { email: req.body?.email });
    if (!req.body) {
      return res.status(400).json({ error: '请求体不能为空' });
    }

    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }

    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{6,20}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: '密码只能包含字母、数字和常见符号,长度6-20位' });
    }

    const username = name || email.split('@')[0];

    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      logger.warn('Email already exists', { email });
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nextId = await generateUserId('user');

    // 开始事务
    await client.query('BEGIN');

    try {
      // 创建用户（is_new_user=true）
      const newUser = await client.query(
        'INSERT INTO users (id, name, email, password, role, is_new_user) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [nextId, username, email, hashedPassword, 'user', true]
      );
      const user = newUser.rows[0];

      // 创建 currencies 记录（silver_coin=100）
      await client.query(
        'INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1, $2, $3, $4)',
        [nextId, 100, 0, 0]
      );

      // 创建 garden_plots 6条记录，第1条已解锁
      const plots = [];
      for (let i = 1; i <= 6; i++) {
        const plotResult = await client.query(
          'INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3) RETURNING *',
          [nextId, i, i === 1]
        );
        plots.push(plotResult.rows[0]);
      }

      // 发放初始物品：C 级种子 ×5
      const cSeeds = await client.query("SELECT id FROM items WHERE item_type = 'seed' AND rarity = 'C'");
      for (const seed of cSeeds.rows) {
        await client.query(
          'INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 5)',
          [nextId, seed.id]
        );
      }

      await client.query('COMMIT');

      // 生成 JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      logger.info('New user created', { userId: user.id, email: user.email });

      res.status(201).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          is_new_user: user.is_new_user,
          created_at: user.created_at.toISOString().split('T')[0]
        },
        plots: plots.map(p => ({
          id: p.id,
          plot_index: p.plot_index,
          is_unlocked: p.is_unlocked,
          level: p.level,
          seed_id: p.seed_id,
          stage: p.stage
        })),
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
    logger.info('Login request received', { email: req.body?.email });
    const { email, password } = req.body;

    if (!email || !password) {
      logger.warn('Login attempt with missing credentials');
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }

    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rowCount === 0) {
      logger.warn('Login attempt failed: User not found', { email });
      return res.status(401).json({ error: '用户不存在' });
    }

    const user = userResult.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      logger.warn('Login attempt failed: Invalid password', { email });
      return res.status(401).json({ error: '密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await client.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // 获取货币余额
    const currenciesResult = await client.query(
      'SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1',
      [user.id]
    );
    const currencies = currenciesResult.rowCount > 0
      ? { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
      : { silver_coin: 0, gold_coin: 0, diamond: 0 };

    logger.info('Login successful', { userId: user.id, email: user.email, role: user.role });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_new_user: user.is_new_user,
        created_at: user.created_at.toISOString().split('T')[0]
      },
      currencies,
      token
    });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: '登录失败,请稍后再试' });
  }
});

// 新手礼包
app.post('/api/user/newbie-pack', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 检查是否为新用户
    const userResult = await client.query('SELECT is_new_user FROM users WHERE id = $1', [userId]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (!userResult.rows[0].is_new_user) {
      return res.status(400).json({ error: '新手礼包已领取' });
    }

    await client.query('BEGIN');

    try {
      // 新手礼包确认：物品已在注册时发放，这里只标记为非新用户
      // 设置 is_new_user=false
      await client.query('UPDATE users SET is_new_user = false WHERE id = $1', [userId]);

      await client.query('COMMIT');

      // 返回最新货币余额
      const currenciesResult = await client.query(
        'SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1',
        [userId]
      );
      const currencies = {
        silver_coin: Number(currenciesResult.rows[0].silver_coin),
        gold_coin: Number(currenciesResult.rows[0].gold_coin),
        diamond: Number(currenciesResult.rows[0].diamond)
      };

      res.json({ message: '新手礼包领取成功', currencies });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Newbie pack error', { error: error.message });
    res.status(500).json({ error: '领取新手礼包失败' });
  }
});

// 修改密码
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请输入当前密码和新密码' });
    }

    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{6,20}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ error: '新密码只能包含字母、数字和常见符号,长度6-20位' });
    }

    const userResult = await client.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!passwordMatch) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

    res.json({ message: '密码修改成功' });
  } catch (error) {
    logger.error('Change password error', { error: error.message });
    res.status(500).json({ error: '修改密码失败,请稍后再试' });
  }
});

// ==================== 货币 API ====================

// 获取货币余额
app.get('/api/user/currencies', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      'SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1',
      [userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: '货币记录不存在' });
    }
    res.json({
      silver_coin: Number(result.rows[0].silver_coin),
      gold_coin: Number(result.rows[0].gold_coin),
      diamond: Number(result.rows[0].diamond)
    });
  } catch (error) {
    logger.error('Get currencies error', { error: error.message });
    res.status(500).json({ error: '获取货币余额失败' });
  }
});

// 货币兑换
app.post('/api/user/currencies/exchange', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, amount } = req.body;

    if (!from || !to || !amount || amount <= 0) {
      return res.status(400).json({ error: '请提供有效的兑换参数' });
    }

    const validTypes = ['silver_coin', 'gold_coin', 'diamond'];
    if (!validTypes.includes(from) || !validTypes.includes(to)) {
      return res.status(400).json({ error: '无效的货币类型' });
    }
    if (from === to) {
      return res.status(400).json({ error: '不能兑换相同类型的货币' });
    }

    // 兑换规则
    const exchangeRules = {
      'silver_coin->gold_coin': { rate: 100, loss: 0 },
      'gold_coin->diamond': { rate: 100, loss: 0 },
      'gold_coin->silver_coin': { rate: 95, loss: 5 },
      'diamond->gold_coin': { rate: 90, loss: 10 }
    };

    const key = `${from}->${to}`;
    const rule = exchangeRules[key];
    if (!rule) {
      return res.status(400).json({ error: '不支持的兑换方向' });
    }

    // 计算兑换结果
    let receiveAmount;
    if (from === 'silver_coin' && to === 'gold_coin') {
      // silver→gold: 100:1
      receiveAmount = Math.floor(amount / 100);
    } else if (from === 'gold_coin' && to === 'diamond') {
      // gold→diamond: 100:1
      receiveAmount = Math.floor(amount / 100);
    } else if (from === 'gold_coin' && to === 'silver_coin') {
      // gold→silver: 1:95
      receiveAmount = amount * 95;
    } else if (from === 'diamond' && to === 'gold_coin') {
      // diamond→gold: 1:90
      receiveAmount = amount * 90;
    }

    if (receiveAmount <= 0) {
      return res.status(400).json({ error: '兑换数量过小' });
    }

    // 使用事务处理
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

    // 返回最新余额
    const result = await client.query(
      'SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1',
      [userId]
    );
    res.json({
      message: '兑换成功',
      exchanged: { from, to, spent: amount, received: receiveAmount },
      currencies: {
        silver_coin: Number(result.rows[0].silver_coin),
        gold_coin: Number(result.rows[0].gold_coin),
        diamond: Number(result.rows[0].diamond)
      }
    });
  } catch (error) {
    if (error.message === 'Insufficient balance') {
      return res.status(400).json({ error: '余额不足' });
    }
    logger.error('Exchange error', { error: error.message });
    res.status(500).json({ error: '兑换失败' });
  }
});

// 获取用户背包物品
app.get('/api/user/items', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd
       FROM user_items ui
       JOIN items i ON ui.item_id = i.id
       WHERE ui.user_id = $1 AND ui.quantity > 0
       ORDER BY i.item_type, i.rarity, i.id`,
      [userId]
    );
    res.json(result.rows.map(r => ({
      item_id: r.item_id,
      quantity: r.quantity,
      name: r.name,
      icon: r.icon,
      rarity: r.rarity,
      item_type: r.item_type,
      base_yield: r.base_yield,
      buy_price: r.buy_price,
      sell_price: r.sell_price,
      currency_type: r.currency_type,
      water_cd: r.water_cd || 5,
      grow_time: (r.water_cd || 5) * 5 // 自动计算
    })));
  } catch (error) {
    logger.error('Get user items error', { error: error.message });
    res.status(500).json({ error: '获取背包物品失败' });
  }
});

// ==================== 用户路由 ====================

app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const usersResult = await client.query('SELECT id, name, email, role, is_new_user, created_at, last_login_at FROM users');
    const users = [];

    for (const user of usersResult.rows) {
      const currenciesResult = await client.query(
        'SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1',
        [user.id]
      );
      const currencies = currenciesResult.rowCount > 0
        ? { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
        : { silver_coin: 0, gold_coin: 0, diamond: 0 };

      users.push({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_new_user: user.is_new_user,
        currencies,
        created_at: user.created_at ? user.created_at.toISOString().split('T')[0] : null,
        last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null
      });
    }
    res.json(users);
  } catch (error) {
    logger.error('Fetch users error', { error: error.message });
    res.status(500).json({ error: '获取用户列表失败,请稍后再试' });
  }
});

// 添加用户（管理员）
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, confirmPassword, role } = req.body;

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: '两次输入的密码不一致' });
    }

    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{6,20}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: '密码只能包含字母、数字和常见符号,长度6-20位' });
    }

    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nextId = await generateUserId(role || 'user');
    const username = email.split('@')[0];

    await client.query('BEGIN');
    try {
      await client.query(
        'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
        [nextId, username, email, hashedPassword, role || 'user']
      );
      await client.query(
        'INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1, $2, $3, $4)',
        [nextId, 0, 0, 0]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    res.status(201).json({ message: '用户创建成功', userId: nextId });
  } catch (error) {
    logger.error('Create user error', { error: error.message });
    res.status(500).json({ error: '创建用户失败,请稍后再试' });
  }
});

// 获取当前用户信息
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      'SELECT id, name, email, role, is_new_user, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = result.rows[0];

    const currenciesResult = await client.query(
      'SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1',
      [userId]
    );
    const currencies = currenciesResult.rowCount > 0
      ? { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
      : { silver_coin: 0, gold_coin: 0, diamond: 0 };

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_new_user: user.is_new_user,
      currencies,
      created_at: user.created_at.toISOString().split('T')[0]
    });
  } catch (error) {
    logger.error('Get user error', { error: error.message });
    res.status(500).json({ error: '获取用户信息失败,请稍后再试' });
  }
});

// 更新当前用户信息
app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: '请填写用户名' });
    }

    const updatedUser = await client.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
      [name, userId]
    );

    if (updatedUser.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = updatedUser.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_new_user: user.is_new_user,
      created_at: user.created_at.toISOString().split('T')[0]
    });
  } catch (error) {
    logger.error('Update user error', { error: error.message });
    res.status(500).json({ error: '更新用户信息失败,请稍后再试' });
  }
});

// 搜索用户（必须在 /api/users/:id 之前，避免被 :id 捕获）
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = req.query.q;

    if (!q || q.trim().length === 0) return res.status(400).json({ error: '请提供搜索关键词' });

    const result = await client.query(
      `SELECT id, name FROM users
       WHERE id != $1 AND (name ILIKE $2 OR id::text ILIKE $2)
       LIMIT 20`,
      [userId, `%${q.trim()}%`]
    );

    res.json(result.rows.map(r => ({ id: r.id, name: r.name })));
  } catch (error) {
    logger.error('Search users error:', { error: error.message });
    res.status(500).json({ error: '搜索用户失败' });
  }
});

// 获取单个用户
app.get('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await client.query(
      'SELECT id, name, email, role, is_new_user, created_at FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = userResult.rows[0];

    const currenciesResult = await client.query(
      'SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1',
      [id]
    );
    const currencies = currenciesResult.rowCount > 0
      ? { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
      : { silver_coin: 0, gold_coin: 0, diamond: 0 };

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_new_user: user.is_new_user,
      currencies,
      created_at: user.created_at.toISOString().split('T')[0]
    });
  } catch (error) {
    logger.error('Fetch user error', { error: error.message });
    res.status(500).json({ error: '获取用户数据失败,请稍后再试' });
  }
});

// 更新用户（管理员）
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: '请填写邮箱' });
    }

    let query = 'UPDATE users SET name = $1, email = $2, role = $3';
    let params = [
      name !== undefined && name !== '' ? name : email.split('@')[0],
      email,
      role || 'user'
    ];
    let paramIndex = 4;

    if (password) {
      const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{6,20}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: '密码只能包含字母、数字和常见符号，长度6-20位' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = $${paramIndex}`;
      params.push(hashedPassword);
      paramIndex++;
    }

    query += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const updatedUser = await client.query(query, params);

    if (updatedUser.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(updatedUser.rows[0]);
  } catch (error) {
    logger.error('Update user error', { error: error.message });
    res.status(500).json({ error: '更新用户失败,请稍后再试' });
  }
});

// 删除用户
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (id === '1' && userResult.rows[0].role === 'admin') {
      return res.status(400).json({ error: 'id为1的管理员无法被删除' });
    }

    if (id.toString() === req.user.id.toString()) {
      return res.status(400).json({ error: '不能删除自己' });
    }

    // 删除关联数据
    await client.query('DELETE FROM orders WHERE user_id = $1', [id]);
    await client.query('DELETE FROM garden_plots WHERE user_id = $1', [id]);
    await client.query('DELETE FROM user_items WHERE user_id = $1', [id]);
    await client.query('DELETE FROM currencies WHERE user_id = $1', [id]);

    const deletedUser = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

    if (deletedUser.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ message: '用户删除成功' });
  } catch (error) {
    logger.error('Delete user error', { error: error.message });
    res.status(500).json({ error: '删除用户失败,请稍后再试' });
  }
});

// ==================== 物品路由（Phase 3 会扩展） ====================

// 获取商店物品列表
app.get('/api/items', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM items WHERE is_shop = true ORDER BY rarity, id');
    res.json(result.rows);
  } catch (error) {
    logger.error('Fetch items error', { error: error.message });
    res.status(500).json({ error: '获取物品列表失败' });
  }
});

// 获取所有物品（管理员）
app.get('/api/items/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM items ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    logger.error('Fetch all items error', { error: error.message });
    res.status(500).json({ error: '获取物品列表失败' });
  }
});

// ==================== 商店系统 API (Phase 3) ====================

// Tab 到 item_type 的映射
const SHOP_TAB_MAP = {
  seeds: 'seed',
  fertilizers: 'fertilizer',
  pets: 'pet',
  pet_food: 'pet_food',
  decorations: 'decoration'
};

// GET /api/shop?tab=seeds|fertilizers|pets|pet_food|decorations
app.get('/api/shop', authenticateToken, async (req, res) => {
  try {
    const tab = req.query.tab;
    if (!tab || !SHOP_TAB_MAP[tab]) {
      return res.status(400).json({ error: '无效的 tab 参数，可选：seeds, fertilizers, pets, pet_food, decorations' });
    }

    // 宠物和装饰从各自的表查询
    if (tab === 'pets') {
      const result = await client.query(
        'SELECT id, name, icon, rarity, base_bonus, price_type, price_amount FROM pets ORDER BY rarity, id'
      );
      return res.json(result.rows.map(r => ({
        id: r.id,
        name: r.name,
        icon: r.icon,
        rarity: r.rarity,
        item_type: 'pet',
        buy_price: Number(r.price_amount),
        sell_price: 0,
        currency_type: r.price_type,
        base_yield: Number(r.base_bonus)
      })));
    }

    if (tab === 'decorations') {
      const result = await client.query(
        'SELECT id, name, icon, slot_type, quality, bonus, price_type, price_amount FROM decorations ORDER BY quality DESC, id'
      );
      return res.json(result.rows.map(r => ({
        id: r.id,
        name: r.name,
        icon: r.icon,
        rarity: r.quality,
        item_type: 'decoration',
        buy_price: Number(r.price_amount),
        sell_price: 0,
        currency_type: r.price_type,
        base_yield: Number(r.bonus),
        slot_type: r.slot_type
      })));
    }

    const itemType = SHOP_TAB_MAP[tab];
    const result = await client.query(
      'SELECT id, name, icon, rarity, item_type, buy_price, sell_price, currency_type, base_yield, water_cd FROM items WHERE item_type = $1 AND is_shop = true ORDER BY rarity, id',
      [itemType]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      rarity: r.rarity,
      item_type: r.item_type,
      buy_price: r.buy_price,
      sell_price: r.sell_price,
      currency_type: r.currency_type,
      base_yield: r.base_yield,
      water_cd: r.water_cd || 5,
      grow_time: (r.water_cd || 5) * 5 // 自动计算
    })));
  } catch (error) {
    logger.error('Get shop items error:', { error: error.message });
    res.status(500).json({ error: '获取商店物品失败' });
  }
});

// POST /api/user/shop/purchase
app.post('/api/user/shop/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { item_id, quantity } = req.body;

    if (!item_id || !quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: '请提供有效的 item_id 和 quantity（正整数）' });
    }
    if (quantity > MAX_ITEM_COUNT) {
      return res.status(400).json({ error: `单次购买数量不能超过 ${MAX_ITEM_COUNT}` });
    }

    const itemResult = await client.query('SELECT * FROM items WHERE id = $1 AND is_shop = true', [item_id]);
    if (itemResult.rowCount === 0) {
      return res.status(404).json({ error: '物品不存在或不在商店出售' });
    }
    const item = itemResult.rows[0];
    const totalCost = Number(item.buy_price) * quantity;
    const currencyType = item.currency_type;

    await client.query('BEGIN');
    try {
      await deductCurrency(userId, currencyType, totalCost);

      await client.query(
        `INSERT INTO user_items (user_id, item_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, item_id, quantity]
      );

      await createOrder(userId, 'SHOP_PURCHASE', currencyType, totalCost);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') {
        return res.status(400).json({ error: '余额不足' });
      }
      throw err;
    }

    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    const userItem = await client.query('SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);

    res.json({
      message: '购买成功',
      item: { id: item.id, name: item.name, icon: item.icon, rarity: item.rarity },
      quantity,
      total_cost: totalCost,
      currency_type: currencyType,
      remaining_quantity: userItem.rowCount > 0 ? userItem.rows[0].quantity : 0,
      currencies: {
        silver_coin: Number(cur.rows[0].silver_coin),
        gold_coin: Number(cur.rows[0].gold_coin),
        diamond: Number(cur.rows[0].diamond)
      }
    });
  } catch (error) {
    logger.error('Purchase error:', { error: error.message });
    res.status(500).json({ error: '购买失败' });
  }
});

// POST /api/user/shop/sell
app.post('/api/user/shop/sell', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { item_id, quantity } = req.body;

    if (!item_id || !quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: '请提供有效的 item_id 和 quantity（正整数）' });
    }

    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rowCount === 0) {
      return res.status(404).json({ error: '物品不存在' });
    }
    const item = itemResult.rows[0];

    if (item.item_type === 'decoration') {
      return res.status(400).json({ error: '装饰物品不可出售' });
    }

    const userItemResult = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    if (userItemResult.rowCount === 0 || userItemResult.rows[0].quantity < quantity) {
      return res.status(400).json({ error: '物品数量不足' });
    }

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
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);

    res.json({
      message: '出售成功',
      item: { id: item.id, name: item.name, icon: item.icon, rarity: item.rarity },
      quantity,
      total_revenue: totalRevenue,
      currency_type: currencyType,
      remaining_quantity: currentQty - quantity > 0 ? currentQty - quantity : 0,
      currencies: {
        silver_coin: Number(cur.rows[0].silver_coin),
        gold_coin: Number(cur.rows[0].gold_coin),
        diamond: Number(cur.rows[0].diamond)
      }
    });
  } catch (error) {
    logger.error('Sell error:', { error: error.message });
    res.status(500).json({ error: '出售失败' });
  }
});

// GET /api/user/backpack
app.get('/api/user/backpack', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd
       FROM user_items ui
       JOIN items i ON ui.item_id = i.id
       WHERE ui.user_id = $1 AND ui.quantity > 0
       ORDER BY i.item_type, i.rarity, i.id`,
      [userId]
    );

    const grouped = { seed: [], fertilizer: [], crop: [], pet_food: [], decoration: [] };
    for (const row of result.rows) {
      const type = row.item_type;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({
        item_id: row.item_id,
        quantity: row.quantity,
        name: row.name,
        icon: row.icon,
        rarity: row.rarity,
        item_type: row.item_type,
        base_yield: row.base_yield,
        buy_price: Number(row.buy_price),
        sell_price: Number(row.sell_price),
        currency_type: row.currency_type,
        water_cd: row.water_cd || 5,
        grow_time: (row.water_cd || 5) * 5 // 自动计算
      });
    }

    // 添加装饰分组（从 user_decorations 表）
    const decorationsResult = await client.query(
      `SELECT ud.decoration_id, ud.quantity, d.name, d.icon, d.quality, d.slot_type, d.bonus
       FROM user_decorations ud
       JOIN decorations d ON ud.decoration_id = d.id
       WHERE ud.user_id = $1 AND ud.quantity > 0
       ORDER BY d.quality, d.id`,
      [userId]
    );

    for (const row of decorationsResult.rows) {
      grouped.decoration.push({
        item_id: row.decoration_id,
        quantity: row.quantity,
        name: row.name,
        icon: row.icon,
        rarity: row.quality,
        item_type: 'decoration',
        bonus_type: row.slot_type,
        bonus_value: Number(row.bonus)
      });
    }

    res.json({ groups: grouped });
  } catch (error) {
    logger.error('Get backpack error:', { error: error.message });
    res.status(500).json({ error: '获取背包物品失败' });
  }
});

// ==================== 好友系统 API (Phase 4) ====================

const MAX_FRIENDS = 50;

// 折算规则：1-100=80%, 101-500=60%, 501+=50%
function calcDiscountRate(amount) {
  if (amount <= 100) return 0.8;
  if (amount <= 500) return 0.6;
  return 0.5;
}

// GET /api/user/friends — 获取好友列表
app.get('/api/user/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 已接受的好友（我发起的 + 对方发起的）
    const acceptedResult = await client.query(
      `SELECT f.id, f.friend_id, f.user_id, f.created_at, u.name as friend_name
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'accepted'
       UNION
       SELECT f.id, f.user_id as friend_id, f.friend_id as user_id, f.created_at, u.name as friend_name
       FROM friendships f
       JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'accepted'`,
      [userId]
    );

    // 待处理的请求（别人发给我的）
    const pendingResult = await client.query(
      `SELECT f.id, f.user_id as sender_id, u.name as sender_name, f.created_at
       FROM friendships f
       JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'`,
      [userId]
    );

    // 我发出的待处理请求
    const sentResult = await client.query(
      `SELECT f.id, f.friend_id as receiver_id, u.name as receiver_name, f.created_at
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'pending'`,
      [userId]
    );

    // 我发出的被拒绝请求
    const rejectedResult = await client.query(
      `SELECT f.id, f.friend_id as receiver_id, u.name as receiver_name, f.created_at
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'rejected'`,
      [userId]
    );

    res.json({
      friends: acceptedResult.rows.map(r => ({
        friendship_id: r.id,
        friend_id: r.friend_id,
        friend_name: r.friend_name,
        created_at: r.created_at
      })),
      pending_requests: pendingResult.rows.map(r => ({
        friendship_id: r.id,
        sender_id: r.sender_id,
        sender_name: r.sender_name,
        created_at: r.created_at
      })),
      sent_requests: sentResult.rows.map(r => ({
        friendship_id: r.id,
        receiver_id: r.receiver_id,
        receiver_name: r.receiver_name,
        created_at: r.created_at
      })),
      rejected_requests: rejectedResult.rows.map(r => ({
        friendship_id: r.id,
        receiver_id: r.receiver_id,
        receiver_name: r.receiver_name,
        created_at: r.created_at
      }))
    });
  } catch (error) {
    logger.error('Get friends error:', { error: error.message });
    res.status(500).json({ error: '获取好友列表失败' });
  }
});

// POST /api/user/friends — 发送好友请求
app.post('/api/user/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friend_id } = req.body;

    if (!friend_id) return res.status(400).json({ error: '请提供 friend_id' });
    if (friend_id === userId) return res.status(400).json({ error: '不能添加自己为好友' });

    // 验证对方存在
    const targetUser = await client.query('SELECT id, name FROM users WHERE id = $1', [friend_id]);
    if (targetUser.rowCount === 0) return res.status(404).json({ error: '用户不存在' });

    // 检查是否已是好友或有待处理请求
    const existing = await client.query(
      `SELECT * FROM friendships
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [userId, friend_id]
    );
    if (existing.rowCount > 0) {
      const row = existing.rows[0];
      if (row.status === 'accepted') return res.status(400).json({ error: '已经是好友了' });
      return res.status(400).json({ error: '已存在待处理的好友请求' });
    }

    // 检查好友上限
    const friendCount = await client.query(
      `SELECT COUNT(*) as count FROM friendships
       WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
      [userId]
    );
    if (parseInt(friendCount.rows[0].count) >= MAX_FRIENDS) {
      return res.status(400).json({ error: `好友数量已达上限（${MAX_FRIENDS}）` });
    }

    const result = await client.query(
      'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3) RETURNING *',
      [userId, friend_id, 'pending']
    );

    res.status(201).json({
      message: '好友请求已发送',
      friendship: {
        id: result.rows[0].id,
        friend_id: result.rows[0].friend_id,
        status: result.rows[0].status
      }
    });
  } catch (error) {
    logger.error('Send friend request error:', { error: error.message });
    res.status(500).json({ error: '发送好友请求失败' });
  }
});

// POST /api/user/friends/:friendshipId — 接受/拒绝好友请求
app.post('/api/user/friends/:friendshipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(req.params.friendshipId);
    const { action } = req.body;

    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: '请提供有效的 action (accept/reject)' });
    }

    const friendship = await client.query('SELECT * FROM friendships WHERE id = $1', [friendshipId]);
    if (friendship.rowCount === 0) return res.status(404).json({ error: '好友请求不存在' });

    const f = friendship.rows[0];
    if (f.friend_id !== userId) return res.status(403).json({ error: '只有接收方可以操作' });
    if (f.status !== 'pending') return res.status(400).json({ error: '该请求已处理' });

    if (action === 'accept') {
      // 检查好友上限
      const friendCount = await client.query(
        `SELECT COUNT(*) as count FROM friendships
         WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
        [userId]
      );
      if (parseInt(friendCount.rows[0].count) >= MAX_FRIENDS) {
        return res.status(400).json({ error: `好友数量已达上限（${MAX_FRIENDS}）` });
      }
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

// DELETE /api/user/friends/:friendshipId — 删除好友
app.delete('/api/user/friends/:friendshipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(req.params.friendshipId);

    const friendship = await client.query('SELECT * FROM friendships WHERE id = $1', [friendshipId]);
    if (friendship.rowCount === 0) return res.status(404).json({ error: '好友关系不存在' });

    const f = friendship.rows[0];
    if (f.user_id !== userId && f.friend_id !== userId) {
      return res.status(403).json({ error: '无权操作' });
    }

    await client.query('DELETE FROM friendships WHERE id = $1', [friendshipId]);
    res.json({ message: '好友已删除' });
  } catch (error) {
    logger.error('Delete friend error:', { error: error.message });
    res.status(500).json({ error: '删除好友失败' });
  }
});

// POST /api/user/friends/:friendId/gift — 送礼
app.post('/api/user/friends/:friendId/gift', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;
    const { gift_type, item_id, currency_type, amount } = req.body;

    if (!gift_type || !['item', 'currency'].includes(gift_type)) {
      return res.status(400).json({ error: '请提供有效的 gift_type (item/currency)' });
    }

    // 验证好友关系
    const friendship = await client.query(
      `SELECT * FROM friendships
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted'`,
      [userId, friendId]
    );
    if (friendship.rowCount === 0) return res.status(400).json({ error: '对方不是你的好友' });

    // 防刷机制1：新账户限制（注册不满24小时不能送礼）
    const senderUser = await client.query('SELECT created_at FROM users WHERE id = $1', [userId]);
    if (senderUser.rowCount > 0) {
      const accountAge = Date.now() - new Date(senderUser.rows[0].created_at).getTime();
      if (accountAge < 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: '新注册用户需满24小时后才能送礼' });
      }
    }

    // 防刷机制2：好友时间限制（添加好友满24小时后才能互送）
    const friendshipAge = Date.now() - new Date(friendship.rows[0].created_at).getTime();
    if (friendshipAge < 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: '添加好友满24小时后才能互送礼物' });
    }

    // 验证接收方存在
    const receiver = await client.query('SELECT id FROM users WHERE id = $1', [friendId]);
    if (receiver.rowCount === 0) return res.status(404).json({ error: '接收方不存在' });

    await client.query('BEGIN');
    try {
      if (gift_type === 'item') {
        if (!item_id) { await client.query('ROLLBACK'); return res.status(400).json({ error: '请提供 item_id' }); }

        // 验证拥有该物品
        const userItem = await client.query(
          'SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2 AND quantity > 0',
          [userId, item_id]
        );
        if (userItem.rowCount === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: '你没有该物品' }); }

        // 获取物品价值用于每日限额计算
        const itemInfo = await client.query('SELECT buy_price, currency_type FROM items WHERE id = $1', [item_id]);
        let itemValueInSilver = 0;
        if (itemInfo.rowCount > 0) {
          const price = Number(itemInfo.rows[0].buy_price);
          const curType = itemInfo.rows[0].currency_type;
          if (curType === 'gold_coin') itemValueInSilver = price * 100;
          else if (curType === 'diamond') itemValueInSilver = price * 10000;
          else itemValueInSilver = price;
        }

        // 防刷机制3：每日接收礼物上限（等值500银币）
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const dailyReceived = await client.query(
          `SELECT COALESCE(SUM(
            CASE
              WHEN currency_type = 'gold_coin' THEN amount * 100
              WHEN currency_type = 'diamond' THEN amount * 10000
              ELSE amount
            END
          ), 0) as total
          FROM gifts
          WHERE receiver_id = $1 AND status = 'accepted' AND created_at >= $2`,
          [friendId, todayStart]
        );
        const dailyTotal = Number(dailyReceived.rows[0].total) + itemValueInSilver;
        if (dailyTotal > 500) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '对方今日接收礼物已达上限（等值500银币）' });
        }

        // 创建 pending 礼物记录（不直接到账）
        await client.query(
          'INSERT INTO gifts (sender_id, receiver_id, gift_type, item_id, amount, discount_rate, status) VALUES ($1, $2, $3, $4, 1, 1.00, $5)',
          [userId, friendId, 'item', item_id, 'pending']
        );

        await client.query('COMMIT');
        res.json({ message: '礼物已送出，等待对方接收' });

      } else { // currency
        if (!currency_type || !amount || amount <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '请提供有效的 currency_type 和 amount' });
        }
        const validTypes = ['silver_coin', 'gold_coin', 'diamond'];
        if (!validTypes.includes(currency_type)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '无效的货币类型' });
        }

        // 防刷机制3：每日接收礼物上限（等值500银币）
        let valueInSilver = amount;
        if (currency_type === 'gold_coin') valueInSilver = amount * 100;
        else if (currency_type === 'diamond') valueInSilver = amount * 10000;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const dailyReceived = await client.query(
          `SELECT COALESCE(SUM(
            CASE
              WHEN currency_type = 'gold_coin' THEN amount * 100
              WHEN currency_type = 'diamond' THEN amount * 10000
              ELSE amount
            END
          ), 0) as total
          FROM gifts
          WHERE receiver_id = $1 AND status = 'accepted' AND created_at >= $2`,
          [friendId, todayStart]
        );
        const dailyTotal = Number(dailyReceived.rows[0].total) + valueInSilver;
        if (dailyTotal > 500) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '对方今日接收礼物已达上限（等值500银币）' });
        }

        const discountRate = calcDiscountRate(amount);
        const receiveAmount = Math.floor(amount * discountRate);

        // 扣除发送方货币
        await deductCurrency(userId, currency_type, amount);

        // 创建 pending 礼物记录（不直接到账）
        await client.query(
          'INSERT INTO gifts (sender_id, receiver_id, gift_type, currency_type, amount, discount_rate, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [userId, friendId, 'currency', currency_type, receiveAmount, discountRate, 'pending']
        );

        await client.query('COMMIT');
        res.json({
          message: '礼物已送出，等待对方接收',
          spent: amount,
          receive_amount: receiveAmount,
          discount_rate: discountRate
        });
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

// ==================== 礼物箱 API ====================

// GET /api/user/gifts — 获取待接收礼物列表
app.get('/api/user/gifts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT g.*, u.name as sender_name
       FROM gifts g
       JOIN users u ON u.id = g.sender_id
       WHERE g.receiver_id = $1 AND g.status = 'pending'
       ORDER BY g.created_at DESC`,
      [userId]
    );

    const gifts = [];
    for (const g of result.rows) {
      let giftInfo = { gift_type: g.gift_type };
      if (g.gift_type === 'item' && g.item_id) {
        const item = await client.query('SELECT name, icon, rarity FROM items WHERE id = $1', [g.item_id]);
        if (item.rowCount > 0) {
          giftInfo.item = { id: g.item_id, name: item.rows[0].name, icon: item.rows[0].icon, rarity: item.rows[0].rarity };
        }
      }
      if (g.gift_type === 'currency') {
        giftInfo.currency_type = g.currency_type;
        giftInfo.amount = Number(g.amount);
      }

      gifts.push({
        id: g.id,
        sender_id: g.sender_id,
        sender_name: g.sender_name,
        ...giftInfo,
        created_at: g.created_at
      });
    }

    res.json({ gifts, count: gifts.length });
  } catch (error) {
    logger.error('Get gifts error:', { error: error.message });
    res.status(500).json({ error: '获取礼物箱失败' });
  }
});

// POST /api/user/gifts/:giftId/accept — 接收礼物
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
        // 物品礼物：扣减发送方，增加接收方
        const senderItem = await client.query('SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
        if (senderItem.rowCount === 0 || senderItem.rows[0].quantity <= 0) {
          // 发送方已没有该物品，标记为过期
          await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['expired', giftId]);
          await client.query('COMMIT');
          return res.status(400).json({ error: '发送方已没有该物品，礼物已过期' });
        }

        // 扣减发送方
        const newQty = senderItem.rows[0].quantity - 1;
        if (newQty <= 0) {
          await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
        } else {
          await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, gift.sender_id, gift.item_id]);
        }

        // 增加接收方
        await client.query(
          `INSERT INTO user_items (user_id, item_id, quantity)
           VALUES ($1, $2, 1)
           ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 1, updated_at = CURRENT_TIMESTAMP`,
          [userId, gift.item_id]
        );
      } else if (gift.gift_type === 'currency') {
        // 货币礼物：直接增加接收方
        await addCurrency(userId, gift.currency_type, Number(gift.amount));
      }

      // 标记为已接收
      await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['accepted', giftId]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // 返回最新货币
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({
      message: '礼物接收成功',
      currencies: {
        silver_coin: Number(cur.rows[0].silver_coin),
        gold_coin: Number(cur.rows[0].gold_coin),
        diamond: Number(cur.rows[0].diamond)
      }
    });
  } catch (error) {
    logger.error('Accept gift error:', { error: error.message });
    res.status(500).json({ error: '接收礼物失败' });
  }
});

// POST /api/user/gifts/accept-all — 一键接收所有礼物
app.post('/api/user/gifts/accept-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const pendingGifts = await client.query('SELECT * FROM gifts WHERE receiver_id = $1 AND status = $2', [userId, 'pending']);

    if (pendingGifts.rowCount === 0) {
      return res.json({ message: '没有待接收的礼物', accepted: 0 });
    }

    let accepted = 0;
    let failed = 0;

    await client.query('BEGIN');
    try {
      for (const gift of pendingGifts.rows) {
        try {
          if (gift.gift_type === 'item' && gift.item_id) {
            const senderItem = await client.query('SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
            if (senderItem.rowCount === 0 || senderItem.rows[0].quantity <= 0) {
              await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['expired', gift.id]);
              failed++;
              continue;
            }
            const newQty = senderItem.rows[0].quantity - 1;
            if (newQty <= 0) {
              await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
            } else {
              await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, gift.sender_id, gift.item_id]);
            }
            await client.query(
              `INSERT INTO user_items (user_id, item_id, quantity)
               VALUES ($1, $2, 1)
               ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 1, updated_at = CURRENT_TIMESTAMP`,
              [userId, gift.item_id]
            );
          } else if (gift.gift_type === 'currency') {
            await addCurrency(userId, gift.currency_type, Number(gift.amount));
          }
          await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['accepted', gift.id]);
          accepted++;
        } catch (e) {
          failed++;
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({
      message: `接收完成：成功 ${accepted} 个${failed > 0 ? `，失败 ${failed} 个` : ''}`,
      accepted,
      failed,
      currencies: {
        silver_coin: Number(cur.rows[0].silver_coin),
        gold_coin: Number(cur.rows[0].gold_coin),
        diamond: Number(cur.rows[0].diamond)
      }
    });
  } catch (error) {
    logger.error('Accept all gifts error:', { error: error.message });
    res.status(500).json({ error: '接收礼物失败' });
  }
});

// POST /api/user/friends/:friendId/transfer — 货币转让
app.post('/api/user/friends/:friendId/transfer', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;
    const { currency_type, amount } = req.body;

    if (!currency_type || !amount || amount <= 0) {
      return res.status(400).json({ error: '请提供有效的 currency_type 和 amount' });
    }
    const validTypes = ['silver_coin', 'gold_coin', 'diamond'];
    if (!validTypes.includes(currency_type)) {
      return res.status(400).json({ error: '无效的货币类型' });
    }

    // 验证好友关系
    const friendship = await client.query(
      `SELECT * FROM friendships
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted'`,
      [userId, friendId]
    );
    if (friendship.rowCount === 0) return res.status(400).json({ error: '对方不是你的好友' });

    const receiver = await client.query('SELECT id FROM users WHERE id = $1', [friendId]);
    if (receiver.rowCount === 0) return res.status(404).json({ error: '接收方不存在' });

    const discountRate = calcDiscountRate(amount);
    const receiveAmount = Math.floor(amount * discountRate);

    await client.query('BEGIN');
    try {
      await deductCurrency(userId, currency_type, amount);
      await addCurrency(friendId, currency_type, receiveAmount);

      await client.query(
        'INSERT INTO gifts (sender_id, receiver_id, gift_type, currency_type, amount, discount_rate, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [userId, friendId, 'transfer', currency_type, amount, discountRate, 'accepted']
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }

    // 返回最新余额
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({
      message: '转让成功',
      spent: amount,
      received: receiveAmount,
      discount_rate: discountRate,
      currencies: {
        silver_coin: Number(cur.rows[0].silver_coin),
        gold_coin: Number(cur.rows[0].gold_coin),
        diamond: Number(cur.rows[0].diamond)
      }
    });
  } catch (error) {
    logger.error('Transfer error:', { error: error.message });
    res.status(500).json({ error: '转让失败' });
  }
});

// ==================== 宠物系统工具函数 (Phase 5) ====================

// 升级阈值：按稀有度分组
const PET_LEVEL_THRESHOLDS = {
  common:    [100, 200, 300, 400, 500],   // Lv1→2, Lv2→3, Lv3→4, Lv4→5, Lv5→6
  rare:      [200, 400, 600, 900, 1200],
  epic:      [400, 600, 900, 1200, 1500],
  legendary: [600, 900, 1200, 1800, 2500]
};

// 加成计算：线性插值，Lv1=base_bonus, Lv6=base_bonus*5
function calcPetBonus(rarity, level, baseBonus) {
  // Lv1 = base_bonus, Lv6 = base_bonus * 5
  // 线性插值
  const maxMultiplier = 5;
  const bonus = baseBonus * (1 + (level - 1) * (maxMultiplier - 1) / 5);
  return Math.round(bonus * 100) / 100;
}

// 宠物粮效果配置
const PET_FOOD_EFFECTS = {
  '普通粮': { growth: 30, hunger: 20, digest_hours: 4 },
  '精良粮': { growth: 60, hunger: 40, digest_hours: 8 },
  '高级粮': { growth: 100, hunger: 60, digest_hours: 12 },
  '稀有粮': { growth: 200, hunger: 100, digest_hours: 24 }
};

// 计算当前饱食度（基于 last_fed_at 和 feeding_end_at）
function calcCurrentHunger(pet) {
  if (!pet.last_fed_at) return pet.hunger;
  const lastFed = new Date(pet.last_fed_at).getTime();
  const now = Date.now();
  const hoursElapsed = (now - lastFed) / (1000 * 60 * 60);
  // 每小时 -1 饱食度
  const decayed = Math.floor(hoursElapsed);
  return Math.max(0, pet.hunger - decayed);
}

// 获取用户激活宠物的加成百分比
async function getPetBonus(userId) {
  try {
    const result = await client.query(
      `SELECT up.*, p.rarity, p.base_bonus, p.name, p.icon
       FROM user_pets up
       JOIN pets p ON up.pet_id = p.id
       WHERE up.user_id = $1 AND up.is_active = true`,
      [userId]
    );
    if (result.rowCount === 0) return 0;

    const pet = result.rows[0];
    const currentHunger = calcCurrentHunger(pet);

    // 饱食度为 0 时加成暂停
    if (currentHunger <= 0) return 0;

    // 计算宠物自身加成
    let bonus = calcPetBonus(pet.rarity, pet.level, Number(pet.base_bonus));

    // 装饰加成叠加
    const equipped = pet.equipped_decorations || {};
    for (const [, decId] of Object.entries(equipped)) {
      const decResult = await client.query('SELECT bonus FROM decorations WHERE id = $1', [decId]);
      if (decResult.rowCount > 0) {
        bonus += Number(decResult.rows[0].bonus);
      }
    }

    return Math.round(bonus * 100) / 100;
  } catch (error) {
    logger.error('getPetBonus error:', { error: error.message });
    return 0;
  }
}

// 格式化宠物数据
function formatPetData(pet, petTemplate) {
  const currentHunger = calcCurrentHunger(pet);
  const thresholds = PET_LEVEL_THRESHOLDS[petTemplate.rarity] || PET_LEVEL_THRESHOLDS.common;
  const nextThreshold = pet.level < 6 ? thresholds[pet.level - 1] : null;
  const bonus = currentHunger > 0 ? calcPetBonus(petTemplate.rarity, pet.level, Number(petTemplate.base_bonus)) : 0;

  // 计算装饰加成
  let decorationBonus = 0;
  const equipped = pet.equipped_decorations || {};

  return {
    user_pet_id: pet.id,
    pet_id: pet.pet_id,
    name: petTemplate.name,
    icon: petTemplate.icon,
    pixel_art: petTemplate.pixel_art,
    rarity: petTemplate.rarity,
    level: pet.level,
    growth_points: pet.growth_points,
    next_level_threshold: nextThreshold,
    hunger: currentHunger,
    max_hunger: 100,
    is_active: pet.is_active,
    base_bonus: Number(petTemplate.base_bonus),
    current_bonus: Math.round((bonus + decorationBonus) * 100) / 100,
    equipped_decorations: pet.equipped_decorations || {},
    last_fed_at: pet.last_fed_at,
    feeding_end_at: pet.feeding_end_at,
    is_digesting: pet.feeding_end_at ? new Date(pet.feeding_end_at).getTime() > Date.now() : false,
    created_at: pet.created_at
  };
}

// ==================== 宠物系统 API (Phase 5) ====================

// GET /api/user/pets — 获取用户所有宠物
app.get('/api/user/pets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT up.*, p.name, p.icon, p.pixel_art, p.rarity, p.base_bonus, p.price_type, p.price_amount
       FROM user_pets up
       JOIN pets p ON up.pet_id = p.id
       WHERE up.user_id = $1
       ORDER BY up.is_active DESC, p.rarity DESC, up.level DESC`,
      [userId]
    );

    const pets = result.rows.map(pet => formatPetData(pet, pet));

    // 更新饱食度到数据库
    for (const pet of result.rows) {
      const currentHunger = calcCurrentHunger(pet);
      if (currentHunger !== pet.hunger) {
        await client.query(
          'UPDATE user_pets SET hunger = $1 WHERE id = $2',
          [currentHunger, pet.id]
        );
      }
    }

    res.json({ pets });
  } catch (error) {
    logger.error('Get user pets error:', { error: error.message });
    res.status(500).json({ error: '获取宠物列表失败' });
  }
});

// POST /api/user/pets/purchase — 购买宠物
app.post('/api/user/pets/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { pet_id } = req.body;

    if (!pet_id) return res.status(400).json({ error: '请提供 pet_id' });

    const petTemplate = await client.query('SELECT * FROM pets WHERE id = $1', [pet_id]);
    if (petTemplate.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });

    const pet = petTemplate.rows[0];

    // 检查用户是否已拥有该宠物（防止重复购买）
    const existingPet = await client.query(
      'SELECT * FROM user_pets WHERE user_id = $1 AND pet_id = $2',
      [userId, pet_id]
    );
    if (existingPet.rowCount > 0) {
      return res.status(400).json({ error: '您已拥有该宠物，无法重复购买' });
    }

    await client.query('BEGIN');
    try {
      await deductCurrency(userId, pet.price_type, Number(pet.price_amount));

      const newUserPet = await client.query(
        `INSERT INTO user_pets (user_id, pet_id, level, growth_points, hunger, is_active)
         VALUES ($1, $2, 1, 0, 20, false)
         RETURNING *`,
        [userId, pet_id]
      );

      await createOrder(userId, 'PET_PURCHASE', pet.price_type, Number(pet.price_amount));

      await client.query('COMMIT');

      const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
      res.status(201).json({
        message: '购买成功',
        pet: formatPetData(newUserPet.rows[0], pet),
        currencies: {
          silver_coin: Number(cur.rows[0].silver_coin),
          gold_coin: Number(cur.rows[0].gold_coin),
          diamond: Number(cur.rows[0].diamond)
        }
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

// POST /api/user/pets/:userPetId/activate — 激活/停用宠物（切换状态）
app.post('/api/user/pets/:userPetId/activate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);

    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });

    const petResult = await client.query(
      'SELECT * FROM user_pets WHERE id = $1 AND user_id = $2',
      [userPetId, userId]
    );
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
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const updatedPet = await client.query('SELECT * FROM user_pets WHERE id = $1 AND user_id = $2', [userPetId, userId]);
    const template = await client.query('SELECT * FROM pets WHERE id = $1', [updatedPet.rows[0].pet_id]);
    const bonus = await getPetBonus(userId);

    res.json({
      message: isCurrentlyActive ? '宠物已休息' : '激活成功',
      pet: formatPetData(updatedPet.rows[0], template.rows[0]),
      current_bonus: bonus
    });
  } catch (error) {
    logger.error('Activate pet error:', { error: error.message });
    res.status(500).json({ error: '操作宠物失败' });
  }
});
// POST /api/user/pets/:userPetId/feed — 喂食
app.post('/api/user/pets/:userPetId/feed', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    const { food_item_id } = req.body;

    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    if (!food_item_id) return res.status(400).json({ error: '请提供宠物粮 item_id' });

    // 验证宠物属于该用户
    const petResult = await client.query(
      'SELECT up.*, p.rarity, p.base_bonus, p.name as pet_name, p.icon as pet_icon FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1 AND up.user_id = $2',
      [userPetId, userId]
    );
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });

    const pet = petResult.rows[0];

    // 检查是否在消化中
    if (pet.feeding_end_at && new Date(pet.feeding_end_at).getTime() > Date.now()) {
      const remaining = Math.ceil((new Date(pet.feeding_end_at).getTime() - Date.now()) / (1000 * 60));
      return res.status(400).json({ error: `宠物正在消化中，还需 ${remaining} 分钟` });
    }

    // 验证宠物粮
    const foodItem = await client.query('SELECT * FROM items WHERE id = $1 AND item_type = $2', [food_item_id, 'pet_food']);
    if (foodItem.rowCount === 0) return res.status(400).json({ error: '无效的宠物粮' });

    const foodName = foodItem.rows[0].name;
    const foodEffect = PET_FOOD_EFFECTS[foodName];
    if (!foodEffect) return res.status(400).json({ error: '未知的宠物粮类型' });

    // 验证用户拥有该宠物粮
    const userFood = await client.query(
      'SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2 AND quantity > 0',
      [userId, food_item_id]
    );
    if (userFood.rowCount === 0) return res.status(400).json({ error: '你没有该宠物粮' });

    await client.query('BEGIN');
    try {
      // 扣减宠物粮
      const newQty = userFood.rows[0].quantity - 1;
      if (newQty <= 0) {
        await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, food_item_id]);
      } else {
        await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, food_item_id]);
      }

      // 计算新的饱食度
      const currentHunger = calcCurrentHunger(pet);
      const newHunger = Math.min(100, currentHunger + foodEffect.hunger);

      // 增加成长值
      const newGrowthPoints = pet.growth_points + foodEffect.growth;

      // 设置消化时间
      const now = new Date();
      const feedingEnd = new Date(now.getTime() + foodEffect.digest_hours * 60 * 60 * 1000);

      // 检查是否升级
      let newLevel = pet.level;
      const thresholds = PET_LEVEL_THRESHOLDS[pet.rarity] || PET_LEVEL_THRESHOLDS.common;
      let remainingGrowth = newGrowthPoints;

      while (newLevel < 6) {
        const threshold = thresholds[newLevel - 1];
        if (threshold && remainingGrowth >= threshold) {
          remainingGrowth -= threshold;
          newLevel++;
        } else {
          break;
        }
      }

      await client.query(
        `UPDATE user_pets
         SET growth_points = $1, hunger = $2, level = $3, last_fed_at = $4, feeding_end_at = $5
         WHERE id = $6`,
        [remainingGrowth, newHunger, newLevel, now, feedingEnd, userPetId]
      );

      await client.query('COMMIT');

      // 重新查询更新后的宠物数据
      const updatedPet = await client.query(
        'SELECT up.*, p.rarity, p.base_bonus, p.name, p.icon, p.pixel_art, p.price_type, p.price_amount FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1',
        [userPetId]
      );

      res.json({
        message: '喂食成功',
        pet: formatPetData(updatedPet.rows[0], updatedPet.rows[0]),
        fed_food: foodItem.rows[0].name,
        growth_gained: foodEffect.growth,
        hunger_restored: foodEffect.hunger,
        leveled_up: newLevel > pet.level ? newLevel : false,
        digest_hours: foodEffect.digest_hours
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    logger.error('Feed pet error:', { error: error.message });
    res.status(500).json({ error: '喂食失败' });
  }
});

// GET /api/user/pets/active — 获取当前激活宠物信息
app.get('/api/user/pets/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT up.*, p.name, p.icon, p.pixel_art, p.rarity, p.base_bonus, p.price_type, p.price_amount
       FROM user_pets up
       JOIN pets p ON up.pet_id = p.id
       WHERE up.user_id = $1 AND up.is_active = true`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.json({ pet: null, bonus: 0 });
    }

    const pet = result.rows[0];
    // 更新饱食度
    const currentHunger = calcCurrentHunger(pet);
    if (currentHunger !== pet.hunger) {
      await client.query('UPDATE user_pets SET hunger = $1 WHERE id = $2', [currentHunger, pet.id]);
    }

    const bonus = await getPetBonus(userId);

    res.json({
      pet: formatPetData({ ...pet, hunger: currentHunger }, pet),
      bonus
    });
  } catch (error) {
    logger.error('Get active pet error:', { error: error.message });
    res.status(500).json({ error: '获取激活宠物信息失败' });
  }
});

// GET /api/decorations — 获取所有装饰模板
app.get('/api/decorations', authenticateToken, async (req, res) => {
  try {
    const slotType = req.query.slot_type;
    let query = 'SELECT id, name, icon, slot_type, quality, bonus, price_type, price_amount FROM decorations';
    const params = [];
    if (slotType) {
      query += ' WHERE slot_type = $1';
      params.push(slotType);
    }
    query += ' ORDER BY quality DESC, id';

    const result = await client.query(query, params);
    res.json(result.rows.map(d => ({
      id: d.id,
      name: d.name,
      icon: d.icon,
      slot_type: d.slot_type,
      quality: d.quality,
      bonus: Number(d.bonus),
      price_type: d.price_type,
      price_amount: Number(d.price_amount)
    })));
  } catch (error) {
    logger.error('Get decorations error:', { error: error.message });
    res.status(500).json({ error: '获取装饰列表失败' });
  }
});

// POST /api/user/decorations/purchase — 购买装饰
app.post('/api/user/decorations/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { decoration_id, quantity } = req.body;

    if (!decoration_id) return res.status(400).json({ error: '请提供 decoration_id' });
    
    // 限制只能购买1个
    const qty = 1;

    const decResult = await client.query('SELECT * FROM decorations WHERE id = $1', [decoration_id]);
    if (decResult.rowCount === 0) return res.status(404).json({ error: '装饰不存在' });

    const dec = decResult.rows[0];

    // 限购检查：每种装饰每人最多购买 1 个
    const existingDec = await client.query('SELECT quantity FROM user_decorations WHERE user_id = $1 AND decoration_id = $2', [userId, decoration_id]);
    if (existingDec.rowCount > 0) {
      return res.status(400).json({ error: '该装饰已拥有，无法重复购买' });
    }

    const totalCost = Number(dec.price_amount) * qty;

    await client.query('BEGIN');
    try {
      await deductCurrency(userId, dec.price_type, totalCost);

      await client.query(
        `INSERT INTO user_decorations (user_id, decoration_id, quantity)
         VALUES ($1, $2, $3)`,
        [userId, decoration_id, qty]
      );

      await createOrder(userId, 'DECORATION_PURCHASE', dec.price_type, totalCost);

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
      quantity: qty,
      total_cost: totalCost,
      currency_type: dec.price_type,
      currencies: {
        silver_coin: Number(cur.rows[0].silver_coin),
        gold_coin: Number(cur.rows[0].gold_coin),
        diamond: Number(cur.rows[0].diamond)
      }
    });
  } catch (error) {
    logger.error('Purchase decoration error:', { error: error.message });
    res.status(500).json({ error: '购买装饰失败' });
  }
});

// POST /api/user/pets/:userPetId/equip — 装备装饰
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

    // 验证宠物属于该用户
    const petResult = await client.query('SELECT * FROM user_pets WHERE id = $1 AND user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });

    // 验证装饰存在
    const decResult = await client.query('SELECT * FROM decorations WHERE id = $1', [decoration_id]);
    if (decResult.rowCount === 0) return res.status(404).json({ error: '装饰不存在' });
    const dec = decResult.rows[0];

    // 验证用户持有该装饰
    const userDec = await client.query('SELECT * FROM user_decorations WHERE user_id = $1 AND decoration_id = $2 AND quantity > 0', [userId, decoration_id]);
    if (userDec.rowCount === 0) return res.status(400).json({ error: '你没有该装饰' });

    const targetPet = petResult.rows[0];
    
    // 检查该饰品是否已被其他宠物装备
    const otherPetResult = await client.query(
      `SELECT id, pet_id FROM user_pets 
       WHERE user_id = $1 AND id != $2 AND equipped_decorations @> '{"${slot_type}": ${decoration_id}}'`,
      [userId, userPetId]
    );

    let replacedPet = null;
    await client.query('BEGIN');
    try {
      // 如果饰品已被其他宠物装备，先卸下
      if (otherPetResult.rowCount > 0) {
        const otherPet = otherPetResult.rows[0];
        const otherEquipped = otherPet.equipped_decorations || {};
        delete otherEquipped[slot_type];
        await client.query(
          'UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2',
          [JSON.stringify(otherEquipped), otherPet.id]
        );
        
        const otherPetTemplate = await client.query('SELECT * FROM pets WHERE id = $1', [otherPet.pet_id]);
        replacedPet = {
          id: otherPet.id,
          name: otherPet.name,
          icon: otherPetTemplate.rows[0]?.icon || '🐾'
        };
      }

      // 装备到目标宠物
      const equipped = targetPet.equipped_decorations || {};
      equipped[slot_type] = decoration_id;

      await client.query(
        'UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2',
        [JSON.stringify(equipped), userPetId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    res.json({
      message: replacedPet ? '装备成功，已从其他宠物卸下' : '装备成功',
      slot_type: slot_type,
      decoration: { id: dec.id, name: dec.name, icon: dec.icon, bonus: Number(dec.bonus) },
      replaced_pet: replacedPet
    });
  } catch (error) {
    logger.error('Equip decoration error:', { error: error.message });
    res.status(500).json({ error: '装备装饰失败' });
  }
});
// POST /api/user/pets/:userPetId/unequip — 卸下装饰
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

    await client.query(
      'UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2',
      [JSON.stringify(equipped), userPetId]
    );

    res.json({ message: '卸下成功', slot_type });
  } catch (error) {
    logger.error('Unequip decoration error:', { error: error.message });
    res.status(500).json({ error: '卸下装饰失败' });
  }
});

// GET /api/user/decorations — 获取用户持有的装饰列表
app.get('/api/user/decorations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT ud.quantity, d.id, d.name, d.icon, d.slot_type, d.quality, d.bonus, d.price_type, d.price_amount
       FROM user_decorations ud
       JOIN decorations d ON ud.decoration_id = d.id
       WHERE ud.user_id = $1 AND ud.quantity > 0
       ORDER BY d.slot_type, d.quality DESC`,
      [userId]
    );

    res.json(result.rows.map(d => ({
      decoration_id: d.id,
      quantity: d.quantity,
      name: d.name,
      icon: d.icon,
      slot_type: d.slot_type,
      quality: d.quality,
      bonus: Number(d.bonus),
      price_type: d.price_type,
      price_amount: Number(d.price_amount)
    })));
  } catch (error) {
    logger.error('Get user decorations error:', { error: error.message });
    res.status(500).json({ error: '获取用户装饰列表失败' });
  }
});

// ==================== 订单路由 ====================

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const ordersResult = await client.query(`
      SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const totalResult = await client.query(
      'SELECT COUNT(*) as total FROM orders WHERE user_id = $1',
      [userId]
    );

    const orders = ordersResult.rows.map(order => ({
      id: order.id,
      user_id: order.user_id,
      type: order.type,
      currency_type: order.currency_type,
      amount: Number(order.amount),
      created_at: order.created_at ? new Date(order.created_at).toISOString() : null
    }));

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].total),
        totalPages: Math.ceil(parseInt(totalResult.rows[0].total) / limit)
      }
    });
  } catch (error) {
    logger.error('Fetch orders error', { error: error.message });
    res.status(500).json({ error: '获取订单列表失败,请稍后再试' });
  }
});

// ==================== 管理员路由 ====================

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }

    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{6,20}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: '密码只能包含字母、数字和常见符号,长度6-20位' });
    }

    const username = name || email.split('@')[0];

    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nextId = await generateUserId('admin');

    await client.query('BEGIN');
    try {
      await client.query(
        'INSERT INTO users (id, name, email, password, role, is_new_user) VALUES ($1, $2, $3, $4, $5, $6)',
        [nextId, username, email, hashedPassword, 'admin', false]
      );
      await client.query(
        'INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1, $2, $3, $4)',
        [nextId, 0, 0, 0]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    res.status(201).json({ message: '管理员用户创建成功', userId: nextId });
  } catch (error) {
    logger.error('Create admin user error', { error: error.message });
    res.status(500).json({ error: '创建管理员用户失败,请稍后再试' });
  }
});

// ==================== 管理员物品管理 API ====================

// POST /api/admin/items — 创建物品
app.post('/api/admin/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd } = req.body;

    if (!name || !item_type) {
      return res.status(400).json({ error: '请填写物品名和类型' });
    }

    const validTypes = ['seed', 'crop', 'fertilizer', 'pet_food'];
    if (!validTypes.includes(item_type)) {
      return res.status(400).json({ error: '无效的物品类型' });
    }

    // 如果设置了 crop_id，验证它是否存在且类型为 crop
    if (crop_id) {
      const cropCheck = await client.query('SELECT id FROM items WHERE id = $1 AND item_type = $2', [crop_id, 'crop']);
      if (cropCheck.rowCount === 0) {
        return res.status(400).json({ error: '关联的作物不存在或类型不是作物' });
      }
    }

    // 验证 water_cd 不能超过 240 秒
    const validWaterCd = water_cd ? Math.min(240, Math.max(10, Number(water_cd))) : 5;

    const result = await client.query(
      `INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [name, icon || '', rarity || 'C', item_type, base_yield || 0, buy_price || 0, sell_price || 0, currency_type || 'silver_coin', is_shop !== false, crop_id || null, validWaterCd]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create item error', { error: error.message });
    res.status(500).json({ error: '创建物品失败' });
  }
});

// PUT /api/admin/items/:id — 更新物品
app.put('/api/admin/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd } = req.body;

    const existing = await client.query('SELECT * FROM items WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: '物品不存在' });
    }

    // 如果设置了 crop_id，验证它是否存在且类型为 crop
    if (crop_id) {
      const cropCheck = await client.query('SELECT id FROM items WHERE id = $1 AND item_type = $2', [crop_id, 'crop']);
      if (cropCheck.rowCount === 0) {
        return res.status(400).json({ error: '关联的作物不存在或类型不是作物' });
      }
    }

    // 验证 water_cd 不能超过 240 秒
    const validWaterCd = water_cd !== undefined ? Math.min(240, Math.max(10, Number(water_cd))) : existing.rows[0].water_cd || 5;

    const result = await client.query(
      `UPDATE items SET name = $1, icon = $2, rarity = $3, item_type = $4, base_yield = $5, buy_price = $6, sell_price = $7, currency_type = $8, is_shop = $9, crop_id = $10, water_cd = $11 WHERE id = $12 RETURNING *`,
      [
        name || existing.rows[0].name,
        icon !== undefined ? icon : existing.rows[0].icon,
        rarity || existing.rows[0].rarity,
        item_type || existing.rows[0].item_type,
        base_yield !== undefined ? base_yield : existing.rows[0].base_yield,
        buy_price !== undefined ? buy_price : existing.rows[0].buy_price,
        sell_price !== undefined ? sell_price : existing.rows[0].sell_price,
        currency_type || existing.rows[0].currency_type,
        is_shop !== undefined ? is_shop : existing.rows[0].is_shop,
        crop_id !== undefined ? crop_id : existing.rows[0].crop_id,
        validWaterCd,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update item error', { error: error.message });
    res.status(500).json({ error: '更新物品失败' });
  }
});

// DELETE /api/admin/items/:id — 删除物品
app.delete('/api/admin/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await client.query('DELETE FROM items WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: '物品不存在' });
    }
    res.json({ message: '物品删除成功' });
  } catch (error) {
    logger.error('Delete item error', { error: error.message });
    res.status(500).json({ error: '删除物品失败' });
  }
});

// ==================== 管理员宠物管理 API ====================

// GET /api/pets/all — 获取所有宠物模板
app.get('/api/pets/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM pets ORDER BY rarity, id');
    res.json(result.rows);
  } catch (error) {
    logger.error('Get pets error', { error: error.message });
    res.status(500).json({ error: '获取宠物列表失败' });
  }
});

// POST /api/admin/pets — 创建宠物
app.post('/api/admin/pets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, rarity, base_bonus, price_amount, price_type, is_shop } = req.body;

    if (!name) {
      return res.status(400).json({ error: '请填写宠物名' });
    }

    const result = await client.query(
      `INSERT INTO pets (name, icon, rarity, base_bonus, price_amount, price_type, is_shop)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, icon || '🐾', rarity || 'C', base_bonus || 5, price_amount || 100, price_type || 'silver_coin', is_shop !== false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create pet error', { error: error.message });
    res.status(500).json({ error: '创建宠物失败' });
  }
});

// PUT /api/admin/pets/:id — 更新宠物
app.put('/api/admin/pets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, rarity, base_bonus, price_amount, price_type, is_shop } = req.body;

    const existing = await client.query('SELECT * FROM pets WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: '宠物不存在' });
    }

    const result = await client.query(
      `UPDATE pets SET name = $1, icon = $2, rarity = $3, base_bonus = $4, price_amount = $5, price_type = $6, is_shop = $7
       WHERE id = $8 RETURNING *`,
      [
        name || existing.rows[0].name,
        icon || existing.rows[0].icon,
        rarity || existing.rows[0].rarity,
        base_bonus || existing.rows[0].base_bonus,
        price_amount || existing.rows[0].price_amount,
        price_type || existing.rows[0].price_type,
        is_shop !== undefined ? is_shop : existing.rows[0].is_shop,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update pet error', { error: error.message });
    res.status(500).json({ error: '更新宠物失败' });
  }
});

// DELETE /api/admin/pets/:id — 删除宠物
app.delete('/api/admin/pets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await client.query('DELETE FROM pets WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: '宠物不存在' });
    }
    res.json({ message: '宠物删除成功' });
  } catch (error) {
    logger.error('Delete pet error', { error: error.message });
    res.status(500).json({ error: '删除宠物失败' });
  }
});

app.get('/api/admin/active-users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await client.query(
      'SELECT COUNT(*) as count FROM users WHERE last_login_at IS NOT NULL AND last_login_at >= $1 AND role = $2',
      [today, 'user']
    );

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

    const ordersResult = await client.query(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const totalResult = await client.query('SELECT COUNT(*) as total FROM orders');

    const orders = ordersResult.rows.map(order => ({
      id: order.id,
      user_id: order.user_id,
      type: order.type,
      currency_type: order.currency_type,
      amount: Number(order.amount),
      created_at: order.created_at ? new Date(order.created_at).toISOString() : null,
      user: {
        id: order.user_id,
        name: order.user_name,
        email: order.user_email
      }
    }));

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].total),
        totalPages: Math.ceil(parseInt(totalResult.rows[0].total) / limit)
      }
    });
  } catch (error) {
    logger.error('Fetch admin orders error', { error: error.message });
    res.status(500).json({ error: '获取订单列表失败,请稍后再试' });
  }
});

app.delete('/api/admin/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOrder = await client.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);

    if (deletedOrder.rowCount === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    res.json({ message: '订单删除成功' });
  } catch (error) {
    logger.error('Delete order error', { error: error.message });
    res.status(500).json({ error: '删除订单失败,请稍后再试' });
  }
});

// PUT /api/admin/users/:id/currencies — 修改用户货币
app.put('/api/admin/users/:id/currencies', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { silver_coin, gold_coin, diamond } = req.body;

    // 验证用户存在
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证货币记录存在
    const curCheck = await client.query('SELECT * FROM currencies WHERE user_id = $1', [id]);
    if (curCheck.rowCount === 0) {
      return res.status(404).json({ error: '用户货币记录不存在' });
    }

    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (silver_coin !== undefined) {
      if (silver_coin < 0 || silver_coin > MAX_POINTS) {
        return res.status(400).json({ error: `银币数量必须在 0-${MAX_POINTS} 之间` });
      }
      updates.push(`silver_coin = $${paramIdx++}`);
      params.push(silver_coin);
    }
    if (gold_coin !== undefined) {
      if (gold_coin < 0 || gold_coin > MAX_POINTS) {
        return res.status(400).json({ error: `金币数量必须在 0-${MAX_POINTS} 之间` });
      }
      updates.push(`gold_coin = $${paramIdx++}`);
      params.push(gold_coin);
    }
    if (diamond !== undefined) {
      if (diamond < 0 || diamond > MAX_POINTS) {
        return res.status(400).json({ error: `钻石数量必须在 0-${MAX_POINTS} 之间` });
      }
      updates.push(`diamond = $${paramIdx++}`);
      params.push(diamond);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '请提供要修改的货币字段' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await client.query(
      `UPDATE currencies SET ${updates.join(', ')} WHERE user_id = $${paramIdx} RETURNING *`,
      params
    );

    res.json({
      message: '货币更新成功',
      currencies: {
        silver_coin: Number(result.rows[0].silver_coin),
        gold_coin: Number(result.rows[0].gold_coin),
        diamond: Number(result.rows[0].diamond)
      }
    });
  } catch (error) {
    logger.error('Update user currencies error', { error: error.message });
    res.status(500).json({ error: '更新用户货币失败' });
  }
});

// PUT /api/admin/users/:id/items — 修改用户背包物品
app.put('/api/admin/users/:id/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id, quantity } = req.body;

    if (!item_id || quantity === undefined || quantity === null) {
      return res.status(400).json({ error: '请提供 item_id 和 quantity' });
    }

    if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_ITEM_COUNT) {
      return res.status(400).json({ error: `数量必须在 0-${MAX_ITEM_COUNT} 之间的整数` });
    }

    // 验证用户存在
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证物品存在
    const itemCheck = await client.query('SELECT id, name FROM items WHERE id = $1', [item_id]);
    if (itemCheck.rowCount === 0) {
      return res.status(404).json({ error: '物品不存在' });
    }

    if (quantity === 0) {
      // 删除该物品
      await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [id, item_id]);
    } else {
      // 更新或插入
      await client.query(
        `INSERT INTO user_items (user_id, item_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = $3, updated_at = CURRENT_TIMESTAMP`,
        [id, item_id, quantity]
      );
    }

    res.json({
      message: '背包物品更新成功',
      item: { id: item_id, name: itemCheck.rows[0].name, quantity }
    });
  } catch (error) {
    logger.error('Update user items error', { error: error.message });
    res.status(500).json({ error: '更新用户背包物品失败' });
  }
});

// GET /api/admin/users/:id/items — 获取用户背包物品
app.get('/api/admin/users/:id/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await client.query(
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd
       FROM user_items ui
       JOIN items i ON ui.item_id = i.id
       WHERE ui.user_id = $1 AND ui.quantity > 0
       ORDER BY i.item_type, i.rarity, i.id`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error('Get admin user items error', { error: error.message });
    res.status(500).json({ error: '获取用户背包失败' });
  }
});

// ==================== 多地块系统 API (Phase 2) ====================

// 地块等级倍率
const PLOT_LEVEL_MULTIPLIER = { 1: 1.0, 2: 1.2, 3: 1.5, 4: 2.0, 5: 3.0 };

// 地块解锁费用
const UNLOCK_COSTS = {
  2: { type: 'silver_coin', amount: 200 },
  3: { type: 'silver_coin', amount: 800 },
  4: { type: 'gold_coin', amount: 300 },
  5: { type: 'gold_coin', amount: 800 },
  6: { type: 'diamond', amount: 100 }
};

// 地块升级费用
const UPGRADE_COSTS = {
  2: { type: 'silver_coin', amount: 1500 },
  3: { type: 'gold_coin', amount: 500 },
  4: { type: 'gold_coin', amount: 1500 },
  5: { type: 'diamond', amount: 500 }
};

// 阶段图标
const STAGE_ICONS = ['🥜', '🌱', '🌿', '🌻']; // stage 0-3, stage 4 uses crop icon

// GET /api/user/plots — 获取用户所有地块
app.get('/api/user/plots', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let plotsResult = await client.query(
      'SELECT * FROM garden_plots WHERE user_id = $1 ORDER BY plot_index',
      [userId]
    );
    if (plotsResult.rowCount === 0) {
      await client.query('BEGIN');
      try {
        for (let i = 1; i <= 6; i++) {
          await client.query(
            'INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3)',
            [userId, i, i === 1]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
      plotsResult = await client.query(
        'SELECT * FROM garden_plots WHERE user_id = $1 ORDER BY plot_index',
        [userId]
      );
    }
    const plots = [];
    for (const plot of plotsResult.rows) {
      let cropInfo = null;
      if (plot.seed_id) {
        const itemResult = await client.query(
          'SELECT id, name, icon, rarity, item_type, base_yield, water_cd FROM items WHERE id = $1',
          [plot.seed_id]
        );
        if (itemResult.rowCount > 0) {
          const item = itemResult.rows[0];
          cropInfo = {
            ...item,
            grow_time: (item.water_cd || 5) * 5 // 自动计算：5个阶段 × 浇水CD
          };
        }
      }
      plots.push({
        id: plot.id,
        plot_index: plot.plot_index,
        is_unlocked: plot.is_unlocked,
        level: plot.level,
        seed_id: plot.seed_id,
        stage: plot.stage,
        planted_at: plot.planted_at,
        last_watered_at: plot.last_watered_at,
        is_dead: plot.is_dead || false,
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

// POST /api/user/plots/:plotIndex/unlock
app.post('/api/user/plots/:plotIndex/unlock', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 2 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效，可解锁范围为 2-6' });
    const cost = UNLOCK_COSTS[plotIndex];
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
      await createOrder(userId, 'PLOT_UNLOCK', cost.type, cost.amount);
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

// POST /api/user/plots/:plotIndex/upgrade
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
    const cost = UPGRADE_COSTS[nextLevel];
    if (!cost) return res.status(400).json({ error: '无法继续升级' });
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, cost.type, cost.amount);
      await client.query('UPDATE garden_plots SET level = $1 WHERE user_id = $2 AND plot_index = $3', [nextLevel, userId, plotIndex]);
      await createOrder(userId, 'PLOT_UPGRADE', cost.type, cost.amount);
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

// POST /api/user/plots/:plotIndex/plant
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
      await client.query('UPDATE garden_plots SET seed_id = $1, stage = 0, planted_at = CURRENT_TIMESTAMP, last_watered_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND plot_index = $3', [item_id, userId, plotIndex]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    const cropInfo = itemResult.rows[0];
    res.json({ message: '种植成功', plot_index: plotIndex, crop: { id: cropInfo.id, name: cropInfo.name, icon: cropInfo.icon, rarity: cropInfo.rarity, base_yield: cropInfo.base_yield, water_cd: cropInfo.water_cd || 5, grow_time: (cropInfo.water_cd || 5) * 5 } });
  } catch (error) {
    logger.error('Plant error', { error: error.message });
    res.status(500).json({ error: '种植失败' });
  }
});

// POST /api/user/plots/:plotIndex/water
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
    
    // 浇水冷却时间（从物品数据获取，默认5秒，最大240秒）
    const waterCd = Math.min(240, plot.water_cd || 5);
    // 干涸死亡时间（固定3分钟）
    const dryTime = 180;
    
    const plantedAt = new Date(plot.planted_at).getTime();
    const now = Date.now();
    const elapsed = (now - plantedAt) / 1000;
    
    // 检查植物是否已干涸死亡（超过3分钟未浇水）
    if (elapsed > dryTime) {
      await client.query('UPDATE garden_plots SET is_dead = true WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      return res.status(400).json({ error: '植物已因缺水而死亡' });
    }
    
    // 成熟后仍可浇水，但不推进阶段，只重置计时器
    if (plot.stage >= 4) {
      await client.query('UPDATE garden_plots SET planted_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      return res.json({ message: '浇水成功', plot_index: plotIndex, stage: plot.stage, stage_icon: plot.crop_icon || '🌿', is_mature: true });
    }
    
    // 检查浇水冷却时间
    if (elapsed < waterCd) {
      const remaining = Math.ceil(waterCd - elapsed);
      return res.status(400).json({ error: `浇水冷却中，还需 ${remaining} 秒` });
    }
    
    // 浇水成功，推进一个阶段并重置计时器
    const newStage = plot.stage + 1;
    await client.query('UPDATE garden_plots SET stage = $1, planted_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND plot_index = $3', [newStage, userId, plotIndex]);
    
    const isMature = newStage >= 4;
    res.json({ 
      message: isMature ? '🎉 植物成熟了！' : '💧 浇水成功', 
      plot_index: plotIndex, 
      stage: newStage, 
      stage_icon: isMature ? (plot.crop_icon || '🌿') : STAGE_ICONS[newStage], 
      is_mature: isMature,
      water_cd: waterCd
    });
  } catch (error) {
    logger.error('Water error', { error: error.message });
    res.status(500).json({ error: '浇水失败' });
  }
});

// POST /api/user/plots/:plotIndex/fertilize
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
    
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    if (itemResult.rows[0].item_type !== 'fertilizer') return res.status(400).json({ error: '该物品不是肥料' });
    
    const fertilizer = itemResult.rows[0];
    // 获取肥料跳过的阶段数，默认为1
    const stageSkip = fertilizer.stage_skip ? Number(fertilizer.stage_skip) : 1;
    
    const userItemResult = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    if (userItemResult.rowCount === 0 || userItemResult.rows[0].quantity <= 0) return res.status(400).json({ error: '背包中没有该肥料' });
    
    // 检查是否会浪费（跳过阶段大于剩余阶段）
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
      
      // 跳过阶段并重置计时器
      const newStage = Math.min(4, plot.stage + stageSkip);
      await client.query('UPDATE garden_plots SET stage = $1, planted_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND plot_index = $3', [newStage, userId, plotIndex]);
      
      await client.query('COMMIT');
      
      const isMature = newStage >= 4;
      const response = {
        message: isMature ? '🎉 施肥后植物直接成熟了！' : `🧪 施肥成功！跳过 ${stageSkip} 个阶段`,
        plot_index: plotIndex,
        stage: newStage,
        stage_icon: isMature ? (plot.crop_icon || '🌿') : STAGE_ICONS[Math.min(newStage, 3)],
        is_mature: isMature
      };
      
      // 如果有浪费，添加警告信息
      if (wastedStages > 0) {
        response.warning = `警告：肥料效果有 ${wastedStages} 个阶段被浪费了，植物原本只需 ${remainingStages} 个阶段即可成熟`;
      }
      
      res.json(response);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    logger.error('Fertilize error', { error: error.message });
    res.status(500).json({ error: '施肥失败' });
  }
});

// POST /api/user/plots/:plotIndex/harvest
app.post('/api/user/plots/:plotIndex/harvest', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    // 查询地块信息和关联的种子物品（包含作物ID）
    const plotResult = await client.query('SELECT gp.*, i.name as crop_name, i.icon as crop_icon, i.rarity, i.base_yield, i.sell_price, i.currency_type, i.crop_id FROM garden_plots gp LEFT JOIN items i ON gp.seed_id = i.id WHERE gp.user_id = $1 AND gp.plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.stage < 4) return res.status(400).json({ error: '植物尚未成熟' });
    
    // 计算收获数量
    const levelMultiplier = PLOT_LEVEL_MULTIPLIER[plot.level] || 1.0;
    const petBonus = await getPetBonus(userId);
    const bonusMultiplier = 1 + petBonus / 100;
    const baseYield = plot.base_yield || 1;
    const actualYield = Math.max(1, Math.round(baseYield * levelMultiplier * bonusMultiplier));
    
    // 确定收获的物品：如果种子有关联的作物ID，则收获作物，否则收获种子本身
    let harvestItemId = plot.seed_id;
    let harvestItemName = plot.crop_name;
    let harvestItemIcon = plot.crop_icon;
    let harvestItemRarity = plot.rarity;
    let harvestItemSellPrice = plot.sell_price || 0;
    
    if (plot.crop_id) {
      // 查询作物信息
      const cropResult = await client.query('SELECT * FROM items WHERE id = $1', [plot.crop_id]);
      if (cropResult.rowCount > 0) {
        const crop = cropResult.rows[0];
        harvestItemId = crop.id;
        harvestItemName = crop.name;
        harvestItemIcon = crop.icon;
        harvestItemRarity = crop.rarity;
        harvestItemSellPrice = crop.sell_price || 0;
      }
    }
    
    await client.query('BEGIN');
    try {
      // 收获获得作物物品到背包
      await client.query(
        `INSERT INTO user_items (user_id, item_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, harvestItemId, actualYield]
      );
      // 清空地块
      await client.query('UPDATE garden_plots SET seed_id = NULL, stage = 0, planted_at = NULL, last_watered_at = NULL WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ 
      message: '收获成功', 
      plot_index: plotIndex, 
      crop: { 
        id: harvestItemId, 
        name: harvestItemName, 
        icon: harvestItemIcon, 
        rarity: harvestItemRarity,
        sell_price: harvestItemSellPrice
      }, 
      yield: actualYield, 
      item_reward: { 
        item_id: harvestItemId, 
        name: harvestItemName, 
        icon: harvestItemIcon, 
        quantity: actualYield 
      }, 
      currency_type: plot.currency_type, 
      currency_reward: 0, 
      currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } 
    });
  } catch (error) {
    logger.error('Harvest error', { error: error.message });
    res.status(500).json({ error: '收获失败' });
  }
});

// POST /api/user/plots/:plotIndex/remove
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
    await client.query('UPDATE garden_plots SET seed_id = NULL, stage = 0, planted_at = NULL, last_watered_at = NULL WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    res.json({ message: '铲除成功', plot_index: plotIndex });
  } catch (error) {
    logger.error('Remove error', { error: error.message });
    res.status(500).json({ error: '铲除失败' });
  }
});

// ==================== 花园路由（保留兼容） ====================

app.get('/api/garden', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      'SELECT * FROM garden_plots WHERE user_id = $1 ORDER BY plot_index',
      [userId]
    );
    res.json(result.rows.map(p => ({
      id: p.id,
      plot_index: p.plot_index,
      is_unlocked: p.is_unlocked,
      level: p.level,
      seed_id: p.seed_id,
      stage: p.stage,
      planted_at: p.planted_at,
      last_watered_at: p.last_watered_at
    })));
  } catch (error) {
    logger.error('Get garden error', { error: error.message });
    res.status(500).json({ error: '获取花园状态失败' });
  }
});

// ========== AI 问答系统 ==========

// 简单内存限流：每用户每分钟最多 5 次
const aiRateLimitMap = new Map(); // userId -> { count, resetTime }
const AI_RATE_LIMIT = 5;
const AI_RATE_WINDOW = 60 * 1000; // 1 分钟

function checkAiRateLimit(userId) {
  const now = Date.now();
  const record = aiRateLimitMap.get(userId);
  if (!record || now > record.resetTime) {
    aiRateLimitMap.set(userId, { count: 1, resetTime: now + AI_RATE_WINDOW });
    return true;
  }
  if (record.count >= AI_RATE_LIMIT) {
    return false;
  }
  record.count++;
  return true;
}

// 清理过期的限流记录（每 5 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of aiRateLimitMap) {
    if (now > value.resetTime) aiRateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

app.post('/api/ask', authenticateToken, async (req, res) => {
  try {
    const { question, conversation_id } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: '请输入问题' });
    }
    if (question.length > 500) {
      return res.status(400).json({ error: '问题不能超过 500 字' });
    }

    // 限流检查
    if (!checkAiRateLimit(req.user.id)) {
      return res.status(429).json({ error: '提问太频繁了，请稍后再试（每分钟最多 5 次）' });
    }

    const difyApiKey = process.env.DIFY_API_KEY;
    const difyApiUrl = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';

    if (!difyApiKey || difyApiKey === 'your-dify-api-key') {
      logger.warn('Dify API key not configured');
      return res.json({
        answer: '🤖 AI 助手暂未配置，请联系管理员设置 Dify API Key。',
        conversation_id: null
      });
    }

    // 转发到 Dify Chatflow API
    const difyResponse = await fetch(`${difyApiUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: question.trim(),
        response_mode: 'blocking',
        conversation_id: conversation_id || '',
        user: `cyberplant-user-${req.user.id}`
      })
    });

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text().catch(() => '');
      logger.error('Dify API error', { status: difyResponse.status, body: errorText });
      return res.json({
        answer: '🤖 AI 助手暂时无法回答，请稍后再试。',
        conversation_id: null
      });
    }

    const difyData = await difyResponse.json();
    logger.info('Dify query success', { userId: req.user.id, conversation_id: difyData.conversation_id });

    // 过滤掉 <think> 标签内容
    let answer = difyData.answer || '抱歉，我暂时无法回答这个问题。';
    answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    res.json({
      answer,
      conversation_id: difyData.conversation_id || null
    });
  } catch (error) {
    logger.error('AI ask error', { error: error.message });
    res.json({
      answer: '🤖 AI 助手暂时无法回答，请稍后再试。',
      conversation_id: null
    });
  }
});

// 所有非 API 路由返回前端 index.html(SPA 路由)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    next();
  }
});

// 启动服务器
async function startServer() {
  try {
    await initDatabase();

    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });

    process.on('SIGTERM', async () => {
      server.close(async () => {
        console.log('Server closed');
        await client.end();
        console.log('Database connection closed');
      });
    });
  } catch (error) {
    console.error('Error starting server:', error);
    await client.end();
    process.exit(1);
  }
}

startServer();

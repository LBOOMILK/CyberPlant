// backend/init.js - 数据库初始化
const bcrypt = require('bcryptjs');
const { client, logger, generateUserId } = require('./db');

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
  ['sss_drop_base', 0.33, 'SSS 基础掉落率'],
  ['sss_drop_cap', 1.0, 'SSS 掉落率上限'],
  ['max_seed_count', 999, '种子上限'],
  ['max_crop_count', 9999, '作物上限'],
  ['max_fertilizer_count', 99, '肥料上限'],
  ['max_pet_food_count', 999, '宠物粮上限'],
];

// 初始化数据库
async function initDatabase() {
  try {
    try { await client.connect(); } catch(e) { /* already connected */ }
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
    // is_shop 标志
    await client.query(`ALTER TABLE decorations ADD COLUMN IF NOT EXISTS is_shop BOOLEAN DEFAULT true`);

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
          'bubble-fish.js'],
        ['小豆猫', '🐱', '🐱', 'B', 4.00, 'diamond', 80, false,
          [4,6,8,11,14,18,22,27,33,40],
          [0,100,150,200,300,400,550,700,900,1200],
          'cat-paw.js'],
        ['星光兔', '🐰', '🐰', 'A', 6.00, 'diamond', 200, false,
          [6,10,14,19,24,30,36,43,51,60],
          [0,100,150,200,300,400,550,700,900,1200],
          'star-rabbit.js'],
        ['雷霆鹰', '🦅', '🦅', 'A', 6.00, 'diamond', 200, false,
          [6,10,14,19,24,30,36,43,51,60],
          [0,100,150,200,300,400,550,700,900,1200],
          'thunder-eagle.js'],
        ['水晶龙', '🐉', '🐉', 'S', 10.00, 'diamond', 600, false,
          [10,15,20,26,32,39,47,56,67,80],
          [0,100,150,200,300,400,550,700,900,1200],
          'crystal-dragon.js'],
        ['LBOOKTest', '🐼', '🐼', 'SSR', 8000.00, 'diamond', 999999, true,
          [8000,8000,8000,8000,8000,8000,8000,8000,8000,8000],
          [0,0,0,0,0,0,0,0,0,0],
          'lbooktest.js'],
      ];
      for (const p of petTemplates) {
        await client.query(
          `INSERT INTO pets (name, icon, pixel_art, rarity, base_bonus, price_type, price_amount, is_test, bonus_curve, growth_curve, effect_file)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)`,
          [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], JSON.stringify(p[8]), JSON.stringify(p[9]), p[10]]
        );
      }
      // LBOOKTest 不可购买
      await client.query("UPDATE pets SET is_shop = true, purchasable = false WHERE name = 'LBOOKTest'");
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
          ['LBOOKTest', '🐼', '🐼', 'SSR', 8000.00, 'diamond', 999999, true,
            [8000,8000,8000,8000,8000,8000,8000,8000,8000,8000],
            [0,0,0,0,0,0,0,0,0,0],
            'lbooktest.js']
        );
      }

      // 补充缺失的 effect_file
      await client.query("UPDATE pets SET effect_file = 'bubble-fish.js' WHERE name = '泡泡鱼' AND effect_file IS NULL");
      await client.query("UPDATE pets SET effect_file = 'cat-paw.js' WHERE name = '小豆猫' AND effect_file IS NULL");
      await client.query("UPDATE pets SET effect_file = 'star-rabbit.js' WHERE name = '星光兔' AND effect_file IS NULL");
      await client.query("UPDATE pets SET effect_file = 'thunder-eagle.js' WHERE name = '雷霆鹰' AND effect_file IS NULL");
      await client.query("UPDATE pets SET effect_file = 'crystal-dragon.js' WHERE name = '水晶龙' AND effect_file IS NULL");

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

    // 检查种子是否存在，不存在则插入全部物品
    const seedCheck = await client.query("SELECT COUNT(*) as count FROM items WHERE item_type = 'seed'");
    if (parseInt(seedCheck.rows[0].count) === 0) {
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
        ['金盏花种子', '🌟', 'SSS', 'seed', 2, 0, 1, 'diamond', true],
        ['星尘花种子', '✨', 'SSS', 'seed', 1, 0, 2, 'diamond', true],
      ];
      for (const seed of cropSeeds) {
        await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          seed
        );
      }
      // SSS 种子设为不可购买（在商店显示为售罄）
      await client.query("UPDATE items SET purchasable = false WHERE item_type = 'seed' AND rarity = 'SSS'");

      // 肥料
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
      logger.info('All item data inserted (seeds + fertilizers + pet_food)');
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

    // 更新已有肥料的 stage_skip (1.9)
    await client.query("UPDATE items SET stage_skip = 1, buy_price = 500, currency_type = 'silver_coin' WHERE name = '普通肥料' AND stage_skip IS NULL");
    await client.query("UPDATE items SET stage_skip = 2, buy_price = 50, sell_price = 25, currency_type = 'gold_coin' WHERE name = '高级肥料'");

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

module.exports = { initDatabase };

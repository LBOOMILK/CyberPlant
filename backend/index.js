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

    // ========== 删除旧表 ==========
    await client.query('DROP TABLE IF EXISTS orders CASCADE');
    await client.query('DROP TABLE IF EXISTS garden CASCADE');
    await client.query('DROP TABLE IF EXISTS plants CASCADE');
    await client.query('DROP TABLE IF EXISTS user_items CASCADE');
    await client.query('DROP TABLE IF EXISTS items CASCADE');
    await client.query('DROP TABLE IF EXISTS garden_plots CASCADE');
    await client.query('DROP TABLE IF EXISTS currencies CASCADE');
    // 注意：不删除 users 表，后面用 ALTER TABLE 修改

    // ========== 修改 users 表 ==========
    // 先检查 users 表是否存在
    const usersExist = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')"
    );

    if (usersExist.rows[0].exists) {
      // 删除旧字段
      await client.query('ALTER TABLE users DROP COLUMN IF EXISTS points');
      await client.query('ALTER TABLE users DROP COLUMN IF EXISTS seeds');
      await client.query('ALTER TABLE users DROP COLUMN IF EXISTS crops');
      await client.query('ALTER TABLE users DROP COLUMN IF EXISTS uses');
      await client.query('ALTER TABLE users DROP COLUMN IF EXISTS plants_role');
      // 添加新字段
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_new_user BOOLEAN DEFAULT true');
    } else {
      // 创建全新的 users 表
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
    }

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
        grow_time INT DEFAULT 0,
        base_yield INT DEFAULT 0,
        buy_price INT DEFAULT 0,
        sell_price INT DEFAULT 0,
        currency_type VARCHAR(20) DEFAULT 'silver_coin',
        is_shop BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // ========== 插入物品种子数据 ==========
    const itemsCheck = await client.query('SELECT COUNT(*) as count FROM items');
    if (parseInt(itemsCheck.rows[0].count) === 0) {
      // 作物种子 (16种)
      const cropSeeds = [
        // C级
        ['土豆种子', '🥔', 'C', 'seed', 30, 1, 10, 5, 'silver_coin', true],
        ['胡萝卜种子', '🥕', 'C', 'seed', 35, 1, 12, 6, 'silver_coin', true],
        ['白菜种子', '🥬', 'C', 'seed', 25, 1, 8, 4, 'silver_coin', true],
        ['黄瓜种子', '🥒', 'C', 'seed', 40, 1, 15, 7, 'silver_coin', true],
        ['生菜种子', '🥬', 'C', 'seed', 28, 1, 9, 4, 'silver_coin', true],
        // B级
        ['番茄种子', '🍅', 'B', 'seed', 60, 2, 30, 15, 'silver_coin', true],
        ['蓝莓种子', '🫐', 'B', 'seed', 70, 2, 35, 17, 'silver_coin', true],
        ['玉米种子', '🌽', 'B', 'seed', 55, 2, 25, 12, 'silver_coin', true],
        ['南瓜种子', '🎃', 'B', 'seed', 80, 2, 40, 20, 'silver_coin', true],
        // A级
        ['草莓种子', '🍓', 'A', 'seed', 120, 3, 80, 40, 'gold_coin', true],
        ['西瓜种子', '🍉', 'A', 'seed', 150, 3, 100, 50, 'gold_coin', true],
        ['葡萄种子', '🍇', 'A', 'seed', 100, 3, 60, 30, 'gold_coin', true],
        // S级
        ['玫瑰种子', '🌹', 'S', 'seed', 200, 5, 200, 100, 'gold_coin', true],
        ['兰花种子', '🌸', 'S', 'seed', 240, 5, 250, 125, 'gold_coin', true],
        // SSS级（不在商店出售）
        ['金盏花种子', '🌟', 'SSS', 'seed', 300, 8, 500, 250, 'diamond', false],
        ['星尘花种子', '✨', 'SSS', 'seed', 360, 10, 800, 400, 'diamond', false],
      ];

      for (const seed of cropSeeds) {
        await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, grow_time, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          seed
        );
      }

      // 肥料 (2种)
      const fertilizers = [
        ['普通肥料', '🧪', 'C', 'fertilizer', 0, 0, 30, 15, 'silver_coin', true],
        ['高级肥料', '⚗️', 'A', 'fertilizer', 0, 0, 200, 100, 'gold_coin', true],
      ];
      for (const f of fertilizers) {
        await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, grow_time, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          f
        );
      }

      // 宠物粮 (4种)
      const petFoods = [
        ['普通粮', '🍖', 'C', 'pet_food', 0, 0, 80, 40, 'silver_coin', true],
        ['精良粮', '🥩', 'B', 'pet_food', 0, 0, 200, 100, 'silver_coin', true],
        ['高级粮', '🍱', 'A', 'pet_food', 0, 0, 500, 250, 'gold_coin', true],
        ['稀有粮', '🍜', 'S', 'pet_food', 0, 0, 1500, 750, 'gold_coin', true],
      ];
      for (const pf of petFoods) {
        await client.query(
          'INSERT INTO items (name, icon, rarity, item_type, grow_time, base_yield, buy_price, sell_price, currency_type, is_shop) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
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
        [test1Id, 100, 0, 0]
      );
      // 创建6块地，第1块已解锁
      for (let i = 1; i <= 6; i++) {
        await client.query(
          'INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3)',
          [test1Id, i, i === 1]
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
        [test2Id, 100, 0, 0]
      );
      for (let i = 1; i <= 6; i++) {
        await client.query(
          'INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3)',
          [test2Id, i, i === 1]
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
      // 发放 silver_coin=100
      await addCurrency(userId, 'silver_coin', 100);

      // 获取 C 级种子的 item_id
      const cSeeds = await client.query(
        "SELECT id FROM items WHERE item_type = 'seed' AND rarity = 'C' LIMIT 5"
      );

      // 给每个 C 级种子 ×5
      for (const seed of cSeeds.rows) {
        await client.query(
          `INSERT INTO user_items (user_id, item_id, quantity)
           VALUES ($1, $2, 5)
           ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 5, updated_at = CURRENT_TIMESTAMP`,
          [userId, seed.id]
        );
      }

      // 设置 is_new_user=false
      await client.query('UPDATE users SET is_new_user = false WHERE id = $1', [userId]);

      // 创建订单记录
      await createOrder(userId, 'NEWBIE_PACK', 'silver_coin', 100);

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
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.grow_time, i.base_yield, i.buy_price, i.sell_price, i.currency_type
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
      grow_time: r.grow_time,
      base_yield: r.base_yield,
      buy_price: r.buy_price,
      sell_price: r.sell_price,
      currency_type: r.currency_type
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
    const itemType = SHOP_TAB_MAP[tab];
    const result = await client.query(
      'SELECT id, name, icon, rarity, item_type, buy_price, sell_price, currency_type, grow_time, base_yield FROM items WHERE item_type = $1 AND is_shop = true ORDER BY rarity, id',
      [itemType]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      rarity: r.rarity,
      item_type: r.item_type,
      buy_price: Number(r.buy_price),
      sell_price: Number(r.sell_price),
      currency_type: r.currency_type,
      grow_time: r.grow_time,
      base_yield: r.base_yield
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
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.grow_time, i.base_yield, i.buy_price, i.sell_price, i.currency_type
       FROM user_items ui
       JOIN items i ON ui.item_id = i.id
       WHERE ui.user_id = $1 AND ui.quantity > 0
       ORDER BY i.item_type, i.rarity, i.id`,
      [userId]
    );

    const grouped = {};
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
        grow_time: row.grow_time,
        base_yield: row.base_yield,
        buy_price: Number(row.buy_price),
        sell_price: Number(row.sell_price),
        currency_type: row.currency_type
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
      await client.query('DELETE FROM friendships WHERE id = $1', [friendshipId]);
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

        // 扣减发送方
        const newQty = userItem.rows[0].quantity - 1;
        if (newQty <= 0) {
          await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
        } else {
          await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, item_id]);
        }

        // 增加接收方
        await client.query(
          `INSERT INTO user_items (user_id, item_id, quantity)
           VALUES ($1, $2, 1)
           ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 1, updated_at = CURRENT_TIMESTAMP`,
          [friendId, item_id]
        );

        // 创建 gifts 记录
        await client.query(
          'INSERT INTO gifts (sender_id, receiver_id, gift_type, item_id, amount, discount_rate, status) VALUES ($1, $2, $3, $4, 1, 1.00, $5)',
          [userId, friendId, 'item', item_id, 'accepted']
        );

        await client.query('COMMIT');
        res.json({ message: '送礼成功' });

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

        const discountRate = calcDiscountRate(amount);
        const receiveAmount = Math.floor(amount * discountRate);

        await deductCurrency(userId, currency_type, amount);
        await addCurrency(friendId, currency_type, receiveAmount);

        await client.query(
          'INSERT INTO gifts (sender_id, receiver_id, gift_type, currency_type, amount, discount_rate, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [userId, friendId, 'currency', currency_type, amount, discountRate, 'accepted']
        );

        await client.query('COMMIT');
        res.json({
          message: '送礼成功',
          spent: amount,
          received: receiveAmount,
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
          'SELECT id, name, icon, rarity, item_type, grow_time, base_yield FROM items WHERE id = $1',
          [plot.seed_id]
        );
        if (itemResult.rowCount > 0) cropInfo = itemResult.rows[0];
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
        crop: cropInfo ? { id: cropInfo.id, name: cropInfo.name, icon: cropInfo.icon, rarity: cropInfo.rarity, item_type: cropInfo.item_type, grow_time: cropInfo.grow_time, base_yield: cropInfo.base_yield } : null,
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
    res.json({ message: '种植成功', plot_index: plotIndex, crop: { id: cropInfo.id, name: cropInfo.name, icon: cropInfo.icon, rarity: cropInfo.rarity, grow_time: cropInfo.grow_time, base_yield: cropInfo.base_yield } });
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
    const plotResult = await client.query('SELECT gp.*, i.grow_time, i.name as crop_name, i.icon as crop_icon, i.base_yield FROM garden_plots gp LEFT JOIN items i ON gp.seed_id = i.id WHERE gp.user_id = $1 AND gp.plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.stage >= 4) return res.status(400).json({ error: '植物已成熟，无需浇水' });
    const growTime = plot.grow_time || 60;
    const stageTime = growTime / 4;
    const plantedAt = new Date(plot.planted_at).getTime();
    const now = Date.now();
    const elapsed = (now - plantedAt) / 1000;
    const expectedStage = Math.min(4, Math.floor(elapsed / stageTime));
    const newStage = Math.min(plot.stage + 1, expectedStage, 4);
    if (newStage === plot.stage) {
      const nextStageTime = (plot.stage + 1) * stageTime;
      const remaining = Math.ceil(nextStageTime - elapsed);
      return res.status(400).json({ error: `植物还在生长中，还需 ${remaining} 秒` });
    }
    await client.query('UPDATE garden_plots SET stage = $1, last_watered_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND plot_index = $3', [newStage, userId, plotIndex]);
    res.json({ message: '浇水成功', plot_index: plotIndex, stage: newStage, stage_icon: newStage < 4 ? STAGE_ICONS[newStage] : (plot.crop_icon || '🌿'), is_mature: newStage >= 4 });
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
    const plotResult = await client.query('SELECT gp.*, i.grow_time, i.name as crop_name, i.icon as crop_icon, i.base_yield FROM garden_plots gp LEFT JOIN items i ON gp.seed_id = i.id WHERE gp.user_id = $1 AND gp.plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.stage >= 4) return res.status(400).json({ error: '植物已成熟，无需施肥' });
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    if (itemResult.rows[0].item_type !== 'fertilizer') return res.status(400).json({ error: '该物品不是肥料' });
    const userItemResult = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    if (userItemResult.rowCount === 0 || userItemResult.rows[0].quantity <= 0) return res.status(400).json({ error: '背包中没有该肥料' });
    const fertilizerName = itemResult.rows[0].name;
    const isAdvanced = fertilizerName.includes('高级');
    const boostRate = isAdvanced ? 0.3 : 0.1;
    const growTime = plot.grow_time || 60;
    const stageTime = growTime / 4;
    const plantedAt = new Date(plot.planted_at).getTime();
    const now = Date.now();
    const elapsed = (now - plantedAt) / 1000;
    const remainingTime = growTime - elapsed;
    const boostTime = remainingTime * boostRate;
    const newPlantedAt = new Date(plantedAt - boostTime * 1000);
    const newElapsed = (now - newPlantedAt.getTime()) / 1000;
    const newStage = Math.min(4, Math.floor(newElapsed / stageTime));
    await client.query('BEGIN');
    try {
      const newQty = userItemResult.rows[0].quantity - 1;
      if (newQty <= 0) {
        await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
      } else {
        await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, item_id]);
      }
      await client.query('UPDATE garden_plots SET planted_at = $1, stage = $2, last_watered_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND plot_index = $4', [newPlantedAt, newStage, userId, plotIndex]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    res.json({ message: '施肥成功', plot_index: plotIndex, stage: newStage, stage_icon: newStage < 4 ? STAGE_ICONS[newStage] : (plot.crop_icon || '🌿'), is_mature: newStage >= 4, boost: `${Math.round(boostRate * 100)}%` });
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
    const plotResult = await client.query('SELECT gp.*, i.name as crop_name, i.icon as crop_icon, i.rarity, i.base_yield, i.sell_price, i.currency_type FROM garden_plots gp LEFT JOIN items i ON gp.seed_id = i.id WHERE gp.user_id = $1 AND gp.plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.stage < 4) return res.status(400).json({ error: '植物尚未成熟' });
    const levelMultiplier = PLOT_LEVEL_MULTIPLIER[plot.level] || 1.0;
    const baseYield = plot.base_yield || 1;
    const actualYield = Math.max(1, Math.round(baseYield * levelMultiplier));
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + $3, updated_at = CURRENT_TIMESTAMP', [userId, plot.seed_id, actualYield]);
      await client.query('UPDATE garden_plots SET seed_id = NULL, stage = 0, planted_at = NULL, last_watered_at = NULL WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    res.json({ message: '收获成功', plot_index: plotIndex, crop: { id: plot.seed_id, name: plot.crop_name, icon: plot.crop_icon, rarity: plot.rarity }, yield: actualYield, multiplier: levelMultiplier });
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

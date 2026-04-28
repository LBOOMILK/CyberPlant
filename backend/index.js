const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';


// 连接 PostgreSQL 数据库
console.log('Connecting to PostgreSQL with URL:', process.env.DATABASE_URL);
const client = new Client({
  connectionString: process.env.DATABASE_URL
});


// 稀有度排序顺序：C < B < A < S < SSS
const rarityOrder = ['C', 'B', 'A', 'S', 'SSS'];

// 按稀有度排序对象（确保JSON字段按正确顺序存储）
function sortByRarity(obj) {
  const sorted = {};
  for (const rarity of rarityOrder) {
    if (obj[rarity] !== undefined) {
      sorted[rarity] = obj[rarity];
    }
  }
  return sorted;
}

// 过滤背包数据（只保留数量>0的物品）并按稀有度排序
function filterAndSortBackpack(obj) {
  const filtered = {};
  for (const rarity of rarityOrder) {
    if (obj[rarity] && obj[rarity] > 0) {
      filtered[rarity] = obj[rarity];
    }
  }
  return filtered;
}

// 生成用户ID的函数
async function generateUserId(role) {
  if (role === 'admin') {
    // 获取最大的奇数ID
    const maxAdminIdResult = await client.query('SELECT MAX(id::integer) as max_id FROM users WHERE role = \'admin\' AND id::integer % 2 = 1');
    const maxAdminId = maxAdminIdResult.rows[0].max_id;
    return maxAdminId ? maxAdminId + 2 : 1; // 下一个奇数
  } else {
    // 获取最大的偶数ID
    const maxUserIdResult = await client.query('SELECT MAX(id::integer) as max_id FROM users WHERE role = \'user\' AND id::integer % 2 = 0');
    const maxUserId = maxUserIdResult.rows[0].max_id;
    return maxUserId ? maxUserId + 2 : 2; // 下一个偶数
  }
}

// 初始化数据库
async function initDatabase() {
  try {
    // 连接数据库
    await client.connect();
    console.log('Connected to PostgreSQL database');
    
    // 创建用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        points INT DEFAULT 0,
        seeds JSONB DEFAULT '[]',
        crops JSONB DEFAULT '[]',
        uses JSONB DEFAULT '[]',
        last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 检查并添加last_login_at字段
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    } catch (error) {
      console.error('Error adding last_login_at column:', error);
    }

    // 检查并添加points字段
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS points INT DEFAULT 0');
    } catch (error) {
      console.error('Error adding points column:', error);
    }

    // 检查并添加uses字段
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS uses JSONB DEFAULT \'[]\'');
    } catch (error) {
      console.error('Error adding uses column:', error);
    }

    // 检查并添加seeds字段
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS seeds JSONB DEFAULT \'[]\'');
    } catch (error) {
      console.error('Error adding seeds column:', error);
    }
    
    // 检查并添加crops字段
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS crops JSONB DEFAULT \'[]\'');
    } catch (error) {
      console.error('Error adding crops column:', error);
    }
    
    // 检查并添加uses字段
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS uses JSONB DEFAULT \'[]\'');
    } catch (error) {
      console.error('Error adding uses column:', error);
    }



    // 创建商店
    await client.query(`
      CREATE TABLE IF NOT EXISTS plants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(50) NOT NULL,
        rarity VARCHAR(50) NOT NULL,
        price INTEGER NOT NULL,
        plants_role VARCHAR(50) DEFAULT 'seed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
        // 检查并添加plants_role字段
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS plants_role VARCHAR(50) DEFAULT \'seeds\'');
    } catch (error) {
      console.error('Error adding plants_role column:', error);
    }


    // 创建订单表
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('PURCHASE_SEED', 'SELL_SEED', 'SELL_CROP', 'PURCHASE_USE', 'SELL_USE')),
        amount INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    // 更新已存在的orders表的约束，添加SELL_USE类型
    await client.query(`
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_type_check;
      ALTER TABLE orders ADD CONSTRAINT orders_type_check CHECK (type IN ('PURCHASE_SEED', 'SELL_SEED', 'SELL_CROP', 'PURCHASE_USE', 'SELL_USE'));
    `);
    
    // 创建花园表
    await client.query(`
      CREATE TABLE IF NOT EXISTS garden (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        seed_id INTEGER,
        rarity VARCHAR(50),
        stage INTEGER DEFAULT 1,
        last_watered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    // 创建userId和createdAt的联合索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON orders(user_id, created_at)
    `);
    

    
    // 检查是否已有管理员用户
    const adminCheck = await client.query('SELECT * FROM users WHERE email = $1', ['admin@example.com']);
    if (adminCheck.rowCount === 0) {
      // 创建管理员用户，使用奇数ID
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminId = await generateUserId('admin');
      await client.query(
        'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
        [adminId, 'Admin', 'admin@example.com', hashedPassword, 'admin']
      );
    }
    
    // 检查是否已有普通用户
    const userCheck = await client.query('SELECT * FROM users WHERE email = $1', ['user@example.com']);
    if (userCheck.rowCount === 0) {
      // 创建普通用户，使用偶数ID
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const userId = await generateUserId('user');
      await client.query(
        'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
        [userId, 'User', 'user@example.com', hashedPassword, 'user']
      );
    }
    
    // 检查是否已有演示用户
    const demoCheck = await client.query('SELECT * FROM users WHERE email = $1', ['demo@example.com']);
    if (demoCheck.rowCount === 0) {
      // 创建演示用户，使用偶数ID
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const demoId = await generateUserId('user');
      await client.query(
        'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
        [demoId, 'Demo User', 'demo@example.com', hashedPassword, 'user']
      );
    }
    
    // 检查是否已有植物数据
    const plantsCheck = await client.query('SELECT * FROM plants');
    if (plantsCheck.rowCount === 0) {
      // 创建植物数据
      const plantData = [
        ['普通种子', '🌱', 'C', 10, 'seed'],
        ['稀有种子', '🌿', 'B', 30, 'seed'],
        ['史诗种子', '🌻', 'A', 50, 'seed'],
        ['传说种子', '🌺', 'S', 100, 'seed'],
        ['神级种子', '✨', 'SSS', 300, 'seed'],
        ['普通肥料', '💩', 'C', 20, 'use'],
        ['稀有肥料', '🧪', 'B', 60, 'use'],
        ['史诗肥料', '⚗️', 'A', 100, 'use'],
        ['传说肥料', '🌟', 'S', 200, 'use']
      ];
      
      for (const plant of plantData) {
        await client.query(
          'INSERT INTO plants (name, icon, rarity, price, plants_role) VALUES ($1, $2, $3, $4, $5)',
          plant
        );
      }
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(express.json());

// 记录所有HTTP请求
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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

// 认证路由
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('Register request:', req.body);
    if (!req.body) {
      return res.status(400).json({ error: '请求体不能为空' });
    }
    
    const { name, email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    
    // 检查邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }
    
    // 如果没有提供name，使用邮箱前缀作为用户名
    const username = name || email.split('@')[0];
    console.log('Username:', username);
    
    // 检查邮箱是否已存在
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      console.log('Email already exists:', email);
      return res.status(400).json({ error: '该邮箱已被注册' });
    }
    
    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 生成用户ID，使用偶数
    const nextId = await generateUserId('user');
    console.log('Next user ID:', nextId);
    
    // 初始化背包数据，为所有稀有度的种子、作物和可使用物品设置初始数量为0
    const initialSeeds = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    const initialCrops = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    const initialUses = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    
    // 创建用户
    const newUser = await client.query(
      'INSERT INTO users (id, name, email, password, role, points, seeds, crops, uses) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [nextId, username, email, hashedPassword, 'user', 100, initialSeeds, initialCrops, initialUses]
    );
    
    const user = newUser.rows[0];
    console.log('New user created:', user);
    
    // 生成 JWT 令牌
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log('Token generated:', token);
    
    const response = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points || 0,
        created_at: user.created_at.toISOString().split('T')[0]
      },
      token
    };
    console.log('Register response:', response);
    res.status(201).json(response);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败，请稍后再试' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login request:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Login error: Missing email or password');
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }

    // 查找用户
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rowCount === 0) {
      console.log('Login error: User not found', email);
      return res.status(401).json({ error: '用户不存在' });
    }

    const user = userResult.rows[0];
    console.log('User found:', user.id, user.email, user.role);

    // 验证密码
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('Login error: Invalid password');
      return res.status(401).json({ error: '密码错误' });
    }

    // 生成 JWT 令牌
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 更新最后登录时间
    await client.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // 确保用户背包数据格式正确
    const seedRarities = ['C', 'B', 'A', 'S', 'SSS'];
    const useRarities = ['C', 'B', 'A', 'S']; // 肥料不包含SSS等级
    const defaultSeedBackpack = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    const defaultUseBackpack = { C: 0, B: 0, A: 0, S: 0 };

    // 初始化seeds字段（确保按稀有度顺序存储）
    if (typeof user.seeds !== 'object' || user.seeds === null || Array.isArray(user.seeds)) {
      user.seeds = { ...defaultSeedBackpack };
      await client.query('UPDATE users SET seeds = $1 WHERE id = $2', [user.seeds, user.id]);
    } else {
      let needsUpdate = false;
      for (const rarity of seedRarities) {
        if (user.seeds[rarity] === undefined) {
          user.seeds[rarity] = 0;
          needsUpdate = true;
        }
      }
      // 检查是否需要排序
      const originalKeys = Object.keys(user.seeds);
      const sortedKeys = Object.keys(sortByRarity(user.seeds));
      if (JSON.stringify(originalKeys) !== JSON.stringify(sortedKeys)) {
        needsUpdate = true;
      }
      // 只有在需要更新时才操作数据库
      if (needsUpdate) {
        user.seeds = sortByRarity(user.seeds);
        await client.query('UPDATE users SET seeds = $1 WHERE id = $2', [user.seeds, user.id]);
      }
    }

    // 初始化crops字段（确保按稀有度顺序存储）
    if (typeof user.crops !== 'object' || user.crops === null || Array.isArray(user.crops)) {
      user.crops = { ...defaultSeedBackpack };
      await client.query('UPDATE users SET crops = $1 WHERE id = $2', [user.crops, user.id]);
    } else {
      let needsUpdate = false;
      for (const rarity of seedRarities) {
        if (user.crops[rarity] === undefined) {
          user.crops[rarity] = 0;
          needsUpdate = true;
        }
      }
      const originalKeys = Object.keys(user.crops);
      const sortedKeys = Object.keys(sortByRarity(user.crops));
      if (JSON.stringify(originalKeys) !== JSON.stringify(sortedKeys)) {
        needsUpdate = true;
      }
      if (needsUpdate) {
        user.crops = sortByRarity(user.crops);
        await client.query('UPDATE users SET crops = $1 WHERE id = $2', [user.crops, user.id]);
      }
    }

    // 初始化uses字段（确保按稀有度顺序存储，肥料不包含SSS）
    if (typeof user.uses !== 'object' || user.uses === null || Array.isArray(user.uses)) {
      user.uses = { ...defaultUseBackpack };
      await client.query('UPDATE users SET uses = $1 WHERE id = $2', [user.uses, user.id]);
    } else {
      let needsUpdate = false;
      // 只初始化C/B/A/S四个等级，不包含SSS
      for (const rarity of useRarities) {
        if (user.uses[rarity] === undefined) {
          user.uses[rarity] = 0;
          needsUpdate = true;
        }
      }
      // 如果存在SSS等级的肥料，删除它
      if (user.uses['SSS'] !== undefined) {
        delete user.uses['SSS'];
        needsUpdate = true;
      }
      const originalKeys = Object.keys(user.uses);
      const sortedKeys = Object.keys(sortByRarity(user.uses));
      if (JSON.stringify(originalKeys) !== JSON.stringify(sortedKeys)) {
        needsUpdate = true;
      }
      if (needsUpdate) {
        user.uses = sortByRarity(user.uses);
        await client.query('UPDATE users SET uses = $1 WHERE id = $2', [user.uses, user.id]);
      }
    }

    const response = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points || 0,
        created_at: user.created_at.toISOString().split('T')[0]
      },
      token
    };
    console.log('Login response:', response);
    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败，请稍后再试' });
  }
});

// 修改密码
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // 验证输入
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请输入当前密码和新密码' });
    }

    // 获取用户当前密码
    const userResult = await client.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = userResult.rows[0];

    // 验证当前密码
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    // 哈希新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: '修改密码失败，请稍后再试' });
  }
});

// 用户路由
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const usersResult = await client.query('SELECT id, name, email, role, points, seeds, crops, uses, created_at, last_login_at FROM users');
    const users = usersResult.rows.map(user => ({
      ...user,
      created_at: user.created_at ? user.created_at.toISOString().split('T')[0] : null,
      last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null,
      seeds: typeof user.seeds === 'object' && user.seeds !== null && !Array.isArray(user.seeds) ? user.seeds : {},
      crops: typeof user.crops === 'object' && user.crops !== null && !Array.isArray(user.crops) ? user.crops : {},
      uses: typeof user.uses === 'object' && user.uses !== null && !Array.isArray(user.uses) ? user.uses : {}
    }));
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: '获取用户列表失败，请稍后再试' });
  }
});

// 添加用户
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, confirmPassword, role } = req.body;
    
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ error: '两次输入的密码不一致' });
    }
    
    // 检查邮箱是否已存在
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }
    
    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 生成ID，管理员使用奇数，用户使用偶数
    const nextId = await generateUserId(role);
    
    // 创建用户，用户名使用邮箱前缀
    const username = email.split('@')[0];
    
    // 初始化背包数据，为所有稀有度的种子、作物和可使用物品设置初始数量为0
    const initialSeeds = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    const initialCrops = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    const initialUses = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    
    const newUser = await client.query(
      'INSERT INTO users (id, name, email, password, role, points, seeds, crops, uses) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [nextId, username, email, hashedPassword, role || 'user', req.body.points || 100, initialSeeds, initialCrops, initialUses]
    );
    
    res.status(201).json(newUser.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: '创建用户失败，请稍后再试' });
  }
});

// 获取当前用户信息
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    console.log('GET /api/users/me request');
    console.log('User from token:', req.user);
    const userId = req.user.id;
    
    const result = await client.query(
      'SELECT id, name, email, role, points, seeds, crops, uses, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rowCount === 0) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = result.rows[0];
    console.log('User data from database:', user);
    // 确保seeds、crops和uses始终是对象，并只保留数量大于0的物品，按稀有度排序
    const seeds = filterAndSortBackpack(typeof user.seeds === 'object' && user.seeds !== null && !Array.isArray(user.seeds) ? user.seeds : {});
    const crops = filterAndSortBackpack(typeof user.crops === 'object' && user.crops !== null && !Array.isArray(user.crops) ? user.crops : {});
    const uses = filterAndSortBackpack(typeof user.uses === 'object' && user.uses !== null && !Array.isArray(user.uses) ? user.uses : {});
    const response = {
      ...user,
      created_at: user.created_at.toISOString().split('T')[0],
      seeds,
      crops,
      uses
    };
    console.log('GET /api/users/me response:', response);
    res.json(response);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '获取用户信息失败，请稍后再试' });
  }
});

// 更新当前用户信息
app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    console.log('PUT /api/users/me request');
    console.log('User from token:', req.user);
    console.log('Request body:', req.body);
    const userId = req.user.id;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '请填写用户名' });
    }
    
    // 更新用户信息
    const updatedUser = await client.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
      [name, userId]
    );
    
    if (updatedUser.rowCount === 0) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = updatedUser.rows[0];
    console.log('Updated user data:', user);
    
    // 确保seeds和crops始终是对象
    const seeds = typeof user.seeds === 'object' && user.seeds !== null && !Array.isArray(user.seeds) ? user.seeds : {};
    const crops = typeof user.crops === 'object' && user.crops !== null && !Array.isArray(user.crops) ? user.crops : {};
    const response = {
      ...user,
      created_at: user.created_at.toISOString().split('T')[0],
      seeds,
      crops
    };
    
    console.log('PUT /api/users/me response:', response);
    res.json(response);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: '更新用户信息失败，请稍后再试' });
  }
});

// 获取单个用户
app.get('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await client.query('SELECT id, name, email, role, points, seeds, crops, uses, created_at FROM users WHERE id = $1', [id]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = userResult.rows[0];

    // 初始化背包数据格式
    const requiredRarities = ['C', 'B', 'A', 'S', 'SSS'];
    const defaultBackpack = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };

    // 处理seeds字段
    let processedSeeds = user.seeds || {};
    if (typeof processedSeeds !== 'object' || processedSeeds === null || Array.isArray(processedSeeds)) {
      processedSeeds = { ...defaultBackpack };
    } else {
      for (const rarity of requiredRarities) {
        if (processedSeeds[rarity] === undefined) {
          processedSeeds[rarity] = 0;
        }
      }
    }

    // 处理crops字段
    let processedCrops = user.crops || {};
    if (typeof processedCrops !== 'object' || processedCrops === null || Array.isArray(processedCrops)) {
      processedCrops = { ...defaultBackpack };
    } else {
      for (const rarity of requiredRarities) {
        if (processedCrops[rarity] === undefined) {
          processedCrops[rarity] = 0;
        }
      }
    }

    // 处理uses字段
    let processedUses = user.uses || {};
    if (typeof processedUses !== 'object' || processedUses === null || Array.isArray(processedUses)) {
      processedUses = { ...defaultBackpack };
    } else {
      for (const rarity of requiredRarities) {
        if (processedUses[rarity] === undefined) {
          processedUses[rarity] = 0;
        }
      }
    }

    const responseUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      points: user.points,
      created_at: user.created_at.toISOString().split('T')[0],
      seeds: processedSeeds,
      crops: processedCrops,
      uses: processedUses
    };
    
    res.json(responseUser);
  } catch (error) {
    console.error('Fetch user error:', error);
    res.status(500).json({ error: '获取用户数据失败，请稍后再试' });
  }
});

// 更新用户
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, points, seeds, crops, password } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: '请填写邮箱' });
    }
    
    // 确保seeds和crops始终是对象
    const requiredRarities = ['C', 'B', 'A', 'S', 'SSS'];
    let processedSeeds = seeds || {};
    let processedCrops = crops || {};
    
    // 处理seeds字段
    if (typeof processedSeeds !== 'object' || processedSeeds === null || Array.isArray(processedSeeds)) {
      processedSeeds = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    } else {
      // 确保所有稀有度都有值
      for (const rarity of requiredRarities) {
        if (processedSeeds[rarity] === undefined) {
          processedSeeds[rarity] = 0;
        }
      }
    }
    
    // 处理crops字段
    if (typeof processedCrops !== 'object' || processedCrops === null || Array.isArray(processedCrops)) {
      processedCrops = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    } else {
      // 确保所有稀有度都有值
      for (const rarity of requiredRarities) {
        if (processedCrops[rarity] === undefined) {
          processedCrops[rarity] = 0;
        }
      }
    }
    
    let query = 'UPDATE users SET name = $1, email = $2, role = $3, points = $4, seeds = $5, crops = $6';
    let params = [name || email.split('@')[0], email, role || 'user', points || 0, processedSeeds, processedCrops, id];
    
    if (password) {
      // 哈希密码
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = $7';
      params.splice(6, 0, hashedPassword);
    }
    
    query += ' WHERE id = $' + params.length + ' RETURNING *';
    
    const updatedUser = await client.query(query, params);
    
    if (updatedUser.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(updatedUser.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: '更新用户失败，请稍后再试' });
  }
});

// 删除用户
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查用户是否存在
    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 验证逻辑：id为1的管理员无法被删除
    if (id === '1' && userResult.rows[0].role === 'admin') {
      return res.status(400).json({ error: 'id为1的管理员无法被删除' });
    }
    
    // 验证逻辑：管理员不能删除自己
    if (id.toString() === req.user.id.toString()) {
      return res.status(400).json({ error: '不能删除自己' });
    }
    
    const deletedUser = await client.query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (deletedUser.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '删除用户失败，请稍后再试' });
  }
});

// 植物路由
app.get('/api/plants', async (req, res) => {
  try {
    const plantsResult = await client.query('SELECT * FROM plants ORDER BY id');
    res.json(plantsResult.rows);
  } catch (error) {
    console.error('Fetch plants error:', error);
    res.status(500).json({ error: '获取植物列表失败，请稍后再试' });
  }
});

app.post('/api/plants', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, rarity, price, plants_role = 'seed' } = req.body;
    
    if (!name || !icon || !rarity || !price) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    
    const newPlant = await client.query(
      'INSERT INTO plants (name, icon, rarity, price, plants_role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, icon, rarity, price, plants_role]
    );
    
    res.status(201).json(newPlant.rows[0]);
  } catch (error) {
    console.error('Create plant error:', error);
    res.status(500).json({ error: '创建植物失败，请稍后再试' });
  }
});

// 更新植物
app.put('/api/plants/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, rarity, price, plants_role } = req.body;
    
    if (!name || !icon || !rarity || !price) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    
    const updatedPlant = await client.query(
      'UPDATE plants SET name = $1, icon = $2, rarity = $3, price = $4, plants_role = $5 WHERE id = $6 RETURNING *',
      [name, icon, rarity, price, plants_role || 'seed', id]
    );
    
    if (updatedPlant.rowCount === 0) {
      return res.status(404).json({ error: '植物不存在' });
    }
    
    res.json(updatedPlant.rows[0]);
  } catch (error) {
    console.error('Update plant error:', error);
    res.status(500).json({ error: '更新植物失败，请稍后再试' });
  }
});

// 删除植物
app.delete('/api/plants/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedPlant = await client.query(
      'DELETE FROM plants WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (deletedPlant.rowCount === 0) {
      return res.status(404).json({ error: '植物不存在' });
    }
    
    res.json({ message: '植物删除成功' });
  } catch (error) {
    console.error('Delete plant error:', error);
    res.status(500).json({ error: '删除植物失败，请稍后再试' });
  }
});

// 创建订单服务函数
async function createOrder(userId, type, amount) {
  try {
    // 将userId转换为integer类型，以匹配orders表的user_id列类型
    const integerUserId = parseInt(userId);
    const result = await client.query(
      'INSERT INTO orders (user_id, type, amount) VALUES ($1, $2, $3) RETURNING *',
      [integerUserId, type, amount]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Create order error:', error);
    throw error;
  }
}

// 订单路由
// 用户获取自己的订单，支持分页
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // 将userId转换为integer类型，以匹配orders表的user_id列类型
    const integerUserId = parseInt(userId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const ordersResult = await client.query(`
      SELECT * FROM orders 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [integerUserId, limit, offset]);
    
    const totalResult = await client.query(
      'SELECT COUNT(*) as total FROM orders WHERE user_id = $1',
      [userId]
    );
    
    const orders = ordersResult.rows.map(order => ({
      id: order.id,
      user_id: order.user_id,
      type: order.type,
      amount: order.amount,
      created_at: order.created_at.toISOString().replace('T', ' ').slice(0, 19)
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
    console.error('Fetch orders error:', error);
    res.status(500).json({ error: '获取订单列表失败，请稍后再试' });
  }
});

// 管理员创建新管理员用户
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    
    // 检查邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }
    
    // 如果没有提供name，使用邮箱前缀作为用户名
    const username = name || email.split('@')[0];
    
    // 检查邮箱是否已存在
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }
    
    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 生成管理员用户ID，使用奇数
    const nextId = await generateUserId('admin');
    
    // 初始化背包数据
    const initialSeeds = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    const initialCrops = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    const initialUses = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    
    // 创建管理员用户
    await client.query(
      'INSERT INTO users (id, name, email, password, role, points, seeds, crops, uses) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [nextId, username, email, hashedPassword, 'admin', 0, initialSeeds, initialCrops, initialUses]
    );
    
    res.status(201).json({ message: '管理员用户创建成功', userId: nextId });
  } catch (error) {
    console.error('Create admin user error:', error);
    res.status(500).json({ error: '创建管理员用户失败，请稍后再试' });
  }
});

// 管理员获取今日活跃用户数
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
    console.error('Get active users error:', error);
    res.status(500).json({ error: '获取活跃用户数失败' });
  }
});

// 管理员获取所有订单，支持分页
app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const ordersResult = await client.query(`
      SELECT o.*, u.id as user_id, u.name as user_name, u.email as user_email 
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
      amount: order.amount,
      created_at: order.created_at.toISOString().replace('T', ' ').slice(0, 19),
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
    console.error('Fetch orders error:', error);
    res.status(500).json({ error: '获取订单列表失败，请稍后再试' });
  }
});

// 管理员删除订单
app.delete('/api/admin/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedOrder = await client.query(
      'DELETE FROM orders WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (deletedOrder.rowCount === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    res.json({ message: '订单删除成功' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: '删除订单失败，请稍后再试' });
  }
});

// 用户背包路由
app.get('/api/user/backpack', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 确保userId是字符串类型
    const stringUserId = String(userId);
    
    // 获取用户数据
    const userResult = await client.query(
      'SELECT seeds, crops, uses FROM users WHERE id = $1',
      [stringUserId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = userResult.rows[0];
    
    // 确保seeds、crops和uses始终是对象
    const seeds = typeof user.seeds === 'object' && user.seeds !== null && !Array.isArray(user.seeds) ? user.seeds : {};
    const crops = typeof user.crops === 'object' && user.crops !== null && !Array.isArray(user.crops) ? user.crops : {};
    const uses = typeof user.uses === 'object' && user.uses !== null && !Array.isArray(user.uses) ? user.uses : {};
    
    res.json({
      seeds,
      crops,
      uses
    });
  } catch (error) {
    console.error('Fetch backpack error:', error);
    res.status(500).json({ error: '获取背包数据失败，请稍后再试' });
  }
});

// 计算物品卖出价格（基于同品质最低购买价的50%）
async function calculateSellPrice(itemType, rarity) {
  console.log('calculateSellPrice called with:', { itemType, rarity });
  
  // 作物保持原有逻辑（商店价2倍）
  if (itemType === 'crop') {
    const cropResult = await client.query(
      'SELECT price FROM plants WHERE plants_role = $1 AND rarity = $2 LIMIT 1',
      ['seed', rarity]
    );
    if (cropResult.rowCount > 0) {
      return cropResult.rows[0].price * 2;
    }
    return 0;
  }
  
  // 查询同类型同品质物品的最低价格
  const role = itemType === 'use' ? 'use' : 'seed';
  console.log('Querying plants with:', { role, rarity });
  
  const result = await client.query(
    'SELECT MIN(price) as minPrice FROM plants WHERE plants_role = $1 AND rarity = $2',
    [role, rarity]
  );
  
  console.log('Query result:', result.rows);
  
  // PostgreSQL返回的列名是小写的minprice
  const minPrice = result.rows[0]?.minprice || result.rows[0]?.minPrice;
  
  if (!minPrice) {
    console.log('No price found, returning 0');
    return 0;
  }
  const sellPrice = Math.floor(minPrice * 0.5);
  console.log('Calculated sell price:', sellPrice);
  return sellPrice;
}

// 获取物品卖出价格（基于同品质最低购买价的50%）
app.get('/api/user/sell-price', authenticateToken, async (req, res) => {
  try {
    const { itemType, rarity } = req.query;
    
    if (!itemType || !rarity) {
      return res.status(400).json({ error: '请提供物品类型和稀有度' });
    }
    
    // 只对种子和肥料计算动态卖出价，作物保持原有逻辑
    if (itemType !== 'seed' && itemType !== 'use') {
      return res.status(400).json({ error: '仅支持种子和肥料的卖出价计算' });
    }
    
    // 查询同类型同品质物品的最低价格
    const result = await client.query(
      'SELECT MIN(price) as minPrice FROM plants WHERE plants_role = $1 AND rarity = $2',
      [itemType === 'use' ? 'use' : 'seed', rarity]
    );
    
    // PostgreSQL返回的列名是小写的minprice
    const minPrice = result.rows[0]?.minprice || result.rows[0]?.minPrice;
    
    if (result.rowCount === 0 || !minPrice) {
      return res.status(404).json({ error: '未找到该物品' });
    }
    const sellPrice = Math.floor(minPrice * 0.5);
    
    res.json({
      rarity,
      itemType,
      minBuyPrice: minPrice,
      sellPrice
    });
  } catch (error) {
    console.error('Get sell price error:', error);
    res.status(500).json({ error: '获取卖出价格失败，请稍后再试' });
  }
});

// 购买种子（包含积分扣除和订单创建）
app.post('/api/user/seeds', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rarity, price, quantity = 1 } = req.body;
    
    if (!rarity || !price) {
      return res.status(400).json({ error: '请提供种子稀有度和价格' });
    }
    
    const buyQuantity = Math.max(1, Math.min(parseInt(quantity) || 1, 99));
    const totalPrice = price * buyQuantity;
    
    // 确保userId是字符串类型
    const stringUserId = String(userId);
    
    // 开始事务
    await client.query('BEGIN');
    
    try {
      // 获取用户当前数据
      const userResult = await client.query('SELECT * FROM users WHERE id = $1', [stringUserId]);
      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = userResult.rows[0];
      
      // 检查积分是否足够
      if (user.points < totalPrice) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '积分不足' });
      }
      
      // 确保seeds字段是对象
      const currentSeeds = typeof user.seeds === 'object' && user.seeds !== null && !Array.isArray(user.seeds) ? user.seeds : {};
      
      // 增加对应稀有度的数量
      const updatedSeeds = { ...currentSeeds };
      updatedSeeds[rarity] = (updatedSeeds[rarity] || 0) + buyQuantity;
      
      // 扣除积分
      const updatedPoints = user.points - totalPrice;
      
      // 更新用户数据
      await client.query(
        'UPDATE users SET seeds = $1, points = $2 WHERE id = $3',
        [updatedSeeds, updatedPoints, stringUserId]
      );
      
      // 创建订单
      await createOrder(stringUserId, 'PURCHASE_SEED', -totalPrice);
      
      // 提交事务
      await client.query('COMMIT');
      
      res.status(201).json({ rarity, quantity: updatedSeeds[rarity], points: updatedPoints });
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Add seed error:', error);
    res.status(500).json({ error: '添加种子失败，请稍后再试' });
  }
});

// 购买可使用物品（包含积分扣除和订单创建）
app.post('/api/user/uses', authenticateToken, async (req, res) => {
  try {
    console.log('POST /api/user/uses request:', req.body);
    const userId = req.user.id;
    const { rarity, price, quantity = 1 } = req.body;
    
    if (!rarity || !price) {
      console.log('Missing rarity or price');
      return res.status(400).json({ error: '请提供物品稀有度和价格' });
    }
    
    const buyQuantity = Math.max(1, Math.min(parseInt(quantity) || 1, 99));
    const totalPrice = price * buyQuantity;

    // 确保userId是字符串类型
    const stringUserId = String(userId);

    // 开始事务
    await client.query('BEGIN');

    try {
      // 获取用户当前数据
      const userResult = await client.query('SELECT * FROM users WHERE id = $1', [stringUserId]);
      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '用户不存在' });
      }

      const user = userResult.rows[0];

      // 检查积分是否足够
      if (user.points < totalPrice) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '积分不足' });
      }

      // 处理uses字段
      let currentUses = user.uses;
      if (typeof currentUses !== 'object' || currentUses === null || Array.isArray(currentUses)) {
        currentUses = {};
      }

      // 增加对应稀有度的数量
      const updatedUses = { ...currentUses };
      updatedUses[rarity] = (updatedUses[rarity] || 0) + buyQuantity;

      // 扣除积分
      const updatedPoints = user.points - totalPrice;

      // 更新用户数据
      await client.query(
        'UPDATE users SET uses = $1, points = $2 WHERE id = $3',
        [updatedUses, updatedPoints, stringUserId]
      );

      // 提交事务
      await client.query('COMMIT');

      // 创建订单（在事务之外）
      try {
        await createOrder(stringUserId, 'PURCHASE_USE', -totalPrice);
      } catch (error) {
        console.error('Error creating order:', error);
      }

      res.status(201).json({ rarity, quantity: updatedUses[rarity], points: updatedPoints });
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Add use error:', error);
    res.status(500).json({ error: '添加物品失败，请稍后再试' });
  }
});

// 卖出肥料（包含积分增加和订单创建）
app.delete('/api/user/uses/:rarity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rarity } = req.params;
    const { quantity } = req.body || { quantity: 1 };
    
    // 后端自己计算卖出价格，不依赖前端传入
    const price = await calculateSellPrice('use', rarity);
    
    console.log('Sell use request received:', { userId, rarity, quantity, price });
    
    if (!price || price <= 0) {
      return res.status(400).json({ error: '无法计算肥料价格' });
    }
    
    const stringUserId = String(userId);
    console.log('String userId:', stringUserId);
    
    // 开始事务
    await client.query('BEGIN');
    
    try {
      // 获取用户当前数据
      const userResult = await client.query(
        'SELECT uses, points FROM users WHERE id = $1',
        [stringUserId]
      );
      
      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        console.log('User not found:', stringUserId);
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = userResult.rows[0];
      
      // 确保currentUses始终是对象
      const currentUses = typeof user.uses === 'object' && user.uses !== null ? user.uses : {};
      console.log('Current uses:', currentUses);
      
      // 检查肥料是否存在
      if (!currentUses[rarity] || currentUses[rarity] < quantity) {
        await client.query('ROLLBACK');
        console.log('Use not found or insufficient quantity:', { rarity, currentQuantity: currentUses[rarity], requestedQuantity: quantity });
        return res.status(404).json({ error: '肥料不存在或数量不足' });
      }
      
      // 减少对应稀有度的数量
      const updatedUses = { ...currentUses };
      updatedUses[rarity] -= quantity;
      // 保留数量为0的字段，避免登录时重复初始化
      if (updatedUses[rarity] < 0) {
        updatedUses[rarity] = 0;
      }
      console.log('Updated uses:', updatedUses);
      
      // 计算增加的积分（使用后端计算的价格）
      const totalPrice = price * quantity;
      const updatedPoints = (user.points || 0) + totalPrice;
      
      // 更新用户数据
      await client.query(
        'UPDATE users SET uses = $1, points = $2 WHERE id = $3',
        [updatedUses, updatedPoints, stringUserId]
      );
      
      // 创建订单
      await createOrder(stringUserId, 'SELL_USE', totalPrice);
      
      // 提交事务
      await client.query('COMMIT');
      
      console.log('Use sold successfully:', { rarity, quantity, totalPrice });
      res.json({ rarity, quantity: updatedUses[rarity] || 0, points: updatedPoints });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Sell use error:', error);
    res.status(500).json({ error: '卖出肥料失败，请稍后再试' });
  }
});

// 卖出种子（包含积分增加和订单创建）
app.delete('/api/user/seeds/:rarity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rarity } = req.params;
    const { quantity } = req.body || { quantity: 1 };
    
    console.log('=== SELL SEED START ===');
    console.log('User ID:', userId);
    console.log('Rarity:', rarity);
    console.log('Quantity:', quantity);
    
    // 后端自己计算卖出价格，不依赖前端传入
    const price = await calculateSellPrice('seed', rarity);
    
    console.log('Calculated sell price:', price);
    
    if (!price || price <= 0) {
      console.log('Error: Price calculation failed');
      return res.status(400).json({ error: '无法计算种子价格' });
    }
    
    const stringUserId = String(userId);
    console.log('String userId:', stringUserId);
    
    // 开始事务
    await client.query('BEGIN');
    console.log('Transaction started');
    
    try {
      // 获取用户当前数据
      console.log('Fetching user data...');
      const userResult = await client.query(
        'SELECT seeds, points FROM users WHERE id = $1',
        [stringUserId]
      );
      
      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        console.log('Error: User not found:', stringUserId);
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = userResult.rows[0];
      console.log('User found:', user);
      
      // 确保currentSeeds始终是对象
      const currentSeeds = typeof user.seeds === 'object' && user.seeds !== null ? user.seeds : {};
      console.log('Current seeds:', currentSeeds);
      
      // 检查种子是否存在
      if (!currentSeeds[rarity] || currentSeeds[rarity] < quantity) {
        await client.query('ROLLBACK');
        console.log('Error: Seed not found or insufficient quantity:', { rarity, currentQuantity: currentSeeds[rarity], requestedQuantity: quantity });
        return res.status(404).json({ error: '种子不存在或数量不足' });
      }
      
      console.log('Seed available:', currentSeeds[rarity]);
      
      // 减少对应稀有度的数量
      const updatedSeeds = { ...currentSeeds };
      updatedSeeds[rarity] -= quantity;
      // 保留数量为0的字段，避免登录时重复初始化
      if (updatedSeeds[rarity] < 0) {
        updatedSeeds[rarity] = 0;
      }
      console.log('Updated seeds:', updatedSeeds);
      
      // 计算增加的积分（使用后端计算的价格）
      const totalPrice = price * quantity;
      const updatedPoints = (user.points || 0) + totalPrice;
      console.log('Total price:', totalPrice, 'Updated points:', updatedPoints);
      
      // 更新用户数据
      console.log('Updating user data...');
      await client.query(
        'UPDATE users SET seeds = $1, points = $2 WHERE id = $3',
        [updatedSeeds, updatedPoints, stringUserId]
      );
      console.log('User data updated');
      
      // 创建订单
      console.log('Creating order...');
      await createOrder(stringUserId, 'SELL_SEED', totalPrice);
      console.log('Order created');
      
      // 提交事务
      await client.query('COMMIT');
      console.log('Transaction committed');
      
      console.log('=== SELL SEED SUCCESS ===');
      res.json({ rarity, quantity: updatedSeeds[rarity] || 0, points: updatedPoints });
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      console.log('Transaction rolled back due to error:', error);
      throw error;
    }
  } catch (error) {
    console.error('=== SELL SEED ERROR ===:', error);
    res.status(500).json({ error: '卖出种子失败，请稍后再试' });
  }
});

// 添加作物
app.post('/api/user/crops', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rarity } = req.body;
    
    if (!rarity) {
      return res.status(400).json({ error: '请提供作物稀有度' });
    }
    
    // 确保userId是字符串类型
    const stringUserId = String(userId);
    
    // 获取用户当前数据
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [stringUserId]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = userResult.rows[0];
    
    // 确保crops字段是对象
    const currentCrops = typeof user.crops === 'object' && user.crops !== null ? user.crops : {};
    
    // 增加对应稀有度的数量
    const updatedCrops = { ...currentCrops };
    updatedCrops[rarity] = (updatedCrops[rarity] || 0) + 1;
    
    // 更新数据库
    await client.query(
      'UPDATE users SET crops = $1 WHERE id = $2',
      [updatedCrops, stringUserId]
    );
    
    res.status(201).json({ rarity, quantity: updatedCrops[rarity] });
  } catch (error) {
    console.error('Add crop error:', error);
    res.status(500).json({ error: '添加作物失败，请稍后再试' });
  }
});

// 卖出作物（包含积分增加和订单创建）
app.delete('/api/user/crops/:rarity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rarity } = req.params;
    const { quantity, price } = req.body || { quantity: 1, price: 0 };
    
    if (!price) {
      return res.status(400).json({ error: '请提供作物价格' });
    }
    
    // 确保userId是字符串类型
    const stringUserId = String(userId);
    
    // 开始事务
    await client.query('BEGIN');
    
    try {
      // 获取用户当前数据
      const userResult = await client.query(
        'SELECT crops, points FROM users WHERE id = $1',
        [stringUserId]
      );
      
      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = userResult.rows[0];
      
      // 确保currentCrops始终是对象
      const currentCrops = typeof user.crops === 'object' && user.crops !== null ? user.crops : {};
      
      // 检查作物是否存在
      if (!currentCrops[rarity] || currentCrops[rarity] < quantity) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '作物不存在或数量不足' });
      }
      
      // 减少对应稀有度的数量
      const updatedCrops = { ...currentCrops };
      updatedCrops[rarity] -= quantity;
      // 保留数量为0的字段，避免登录时重复初始化
      if (updatedCrops[rarity] < 0) {
        updatedCrops[rarity] = 0;
      }
      
      // 计算增加的积分
      const totalPrice = price * quantity;
      const updatedPoints = (user.points || 0) + totalPrice;
      
      // 更新用户数据
      await client.query(
        'UPDATE users SET crops = $1, points = $2 WHERE id = $3',
        [updatedCrops, updatedPoints, stringUserId]
      );
      
      // 创建订单
      await createOrder(stringUserId, 'SELL_CROP', totalPrice);
      
      // 提交事务
      await client.query('COMMIT');
      
      res.json({ rarity, quantity: updatedCrops[rarity] || 0, points: updatedPoints });
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Sell crop error:', error);
    res.status(500).json({ error: '卖出作物失败，请稍后再试' });
  }
});

// 更新用户积分
app.put('/api/user/points', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { points } = req.body;
    
    if (points === undefined) {
      return res.status(400).json({ error: '请提供积分值' });
    }
    
    const result = await client.query(
      'UPDATE users SET points = $1 WHERE id = $2 RETURNING *',
      [points, userId]
    );
    
    res.json({
      points: result.rows[0].points
    });
  } catch (error) {
    console.error('Update points error:', error);
    res.status(500).json({ error: '更新积分失败，请稍后再试' });
  }
});

// 花园路由
// 获取当前种植状态
app.get('/api/garden', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await client.query(
      'SELECT * FROM garden WHERE user_id = $1',
      [userId]
    );
    
    if (result.rowCount === 0) {
      return res.json({ hasPlant: false });
    }
    
    const garden = result.rows[0];
    const now = new Date();
    const lastWateredAt = new Date(garden.last_watered_at);
    const secondsSinceWater = (now - lastWateredAt) / 1000;
    // 五阶段前一分钟不浇水则死亡，五阶段无论多久不浇水都不会死亡
    const isWilted = garden.stage < 5 && secondsSinceWater > 60;
    const canHarvest = garden.stage === 5 && !isWilted;
    
    res.json({
      hasPlant: true,
      plant: {
        id: garden.id,
        seedId: garden.seed_id,
        rarity: garden.rarity,
        stage: garden.stage,
        lastWateredAt: garden.last_watered_at,
        createdAt: garden.created_at
      },
      isWilted,
      canHarvest
    });
  } catch (error) {
    console.error('Get garden error:', error);
    res.status(500).json({ error: '获取花园状态失败，请稍后再试' });
  }
});

// 种植种子
app.post('/api/garden/plant', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rarity } = req.body;
    
    if (!rarity) {
      return res.status(400).json({ error: '请提供种子稀有度' });
    }
    
    // 开始事务
    await client.query('BEGIN');
    
    try {
      // 检查用户背包中是否有对应稀有度的种子
      const userResult = await client.query(
        'SELECT seeds FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = userResult.rows[0];
      const seeds = typeof user.seeds === 'object' && user.seeds !== null ? user.seeds : {};
      
      if (!seeds[rarity] || seeds[rarity] <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '种子数量不足' });
      }
      
      // 扣减种子数量
      const updatedSeeds = { ...seeds };
      updatedSeeds[rarity] -= 1;
      // 保留数量为0的字段，避免登录时重复初始化
      if (updatedSeeds[rarity] < 0) {
        updatedSeeds[rarity] = 0;
      }
      
      // 更新用户背包
      await client.query(
        'UPDATE users SET seeds = $1 WHERE id = $2',
        [updatedSeeds, userId]
      );
      
      // 检查是否已有花园记录
      const gardenResult = await client.query(
        'SELECT * FROM garden WHERE user_id = $1',
        [userId]
      );
      
      if (gardenResult.rowCount > 0) {
        // 更新花园记录
        await client.query(
          'UPDATE garden SET seed_id = $1, rarity = $2, stage = 1, last_watered_at = CURRENT_TIMESTAMP WHERE user_id = $3',
          [1, rarity, userId] // 简化处理，使用固定的seed_id
        );
      } else {
        // 创建花园记录
        await client.query(
          'INSERT INTO garden (user_id, seed_id, rarity, stage, last_watered_at) VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)',
          [userId, 1, rarity] // 简化处理，使用固定的seed_id
        );
      }
      
      // 提交事务
      await client.query('COMMIT');
      
      res.json({ message: '种植成功' });
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Plant error:', error);
    res.status(500).json({ error: '种植失败，请稍后再试' });
  }
});

// 浇水
app.post('/api/garden/water', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 开始事务
    await client.query('BEGIN');
    
    try {
      // 检查花园记录
      const gardenResult = await client.query(
        'SELECT * FROM garden WHERE user_id = $1',
        [userId]
      );
      
      if (gardenResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '花园不存在' });
      }
      
      const garden = gardenResult.rows[0];
      
      // 检查植物是否枯萎
      const now = new Date();
      const lastWateredAt = new Date(garden.last_watered_at);
      const secondsSinceWater = (now - lastWateredAt) / 1000;
      // 五阶段前一分钟不浇水则死亡，五阶段无论多久不浇水都不会死亡
      const isWilted = garden.stage < 5 && secondsSinceWater > 60;
      
      // 检查浇水冷却时间
      const cooldownSeconds = garden.stage === 5 ? 300 : 5; // 成熟植物5分钟冷却，其他5秒
      
      if (secondsSinceWater < cooldownSeconds) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `浇水过于频繁，请等待 ${Math.ceil(cooldownSeconds - secondsSinceWater)} 秒` });
      }
      
      // 更新浇水时间和生长阶段
      let updatedStage = garden.stage;
      if (!isWilted && garden.stage < 5) {
        updatedStage = garden.stage + 1;
      }
      
      await client.query(
        'UPDATE garden SET last_watered_at = CURRENT_TIMESTAMP, stage = $1 WHERE user_id = $2',
        [updatedStage, userId]
      );
      
      // 提交事务
      await client.query('COMMIT');
      
      res.json({ message: '浇水成功', stage: updatedStage });
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Water error:', error);
    res.status(500).json({ error: '浇水失败，请稍后再试' });
  }
});

// 施肥
app.post('/api/garden/fertilize', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rarity } = req.body;
    
    if (!rarity) {
      return res.status(400).json({ error: '请提供肥料稀有度' });
    }
    
    // 肥料等级对应的成长阶段提升数量（施肥可绕过冷却时间）
    const fertilizerBoost = {
      'C': 1,   // 普通肥料：提升1个阶段
      'B': 2,   // 稀有肥料：提升2个阶段
      'A': 3,   // 史诗肥料：提升3个阶段
      'S': 4    // 传说肥料：提升4个阶段
    };
    
    // 检查肥料等级是否有效
    if (!fertilizerBoost[rarity]) {
      return res.status(400).json({ error: '无效的肥料等级' });
    }
    
    // 开始事务
    await client.query('BEGIN');
    
    try {
      // 检查花园记录
      const gardenResult = await client.query(
        'SELECT * FROM garden WHERE user_id = $1',
        [userId]
      );
      
      if (gardenResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '花园不存在' });
      }
      
      const garden = gardenResult.rows[0];
      
      // 检查植物是否存在且处于1-4阶段（未成熟）
      if (garden.stage < 1 || garden.stage >= 5) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '施肥只能在植物生长阶段（1-4阶段）进行' });
      }
      
      // 检查植物是否枯萎
      const now = new Date();
      const lastWateredAt = new Date(garden.last_watered_at);
      const secondsSinceWater = (now - lastWateredAt) / 1000;
      const isWilted = secondsSinceWater > 60;
      
      if (isWilted) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '植物已枯萎，请先浇水复活' });
      }
      
      // 获取用户背包中的肥料
      const userResult = await client.query(
        'SELECT uses FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = userResult.rows[0];
      const uses = typeof user.uses === 'object' && user.uses !== null ? user.uses : {};
      
      // 检查肥料是否足够
      if (!uses[rarity] || uses[rarity] < 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '肥料不足' });
      }
      
      // 扣除肥料
      const updatedUses = { ...uses };
      updatedUses[rarity] -= 1;
      // 保留数量为0的字段，避免登录时重复初始化
      if (updatedUses[rarity] < 0) {
        updatedUses[rarity] = 0;
      }
      
      // 根据肥料等级计算提升的阶段数
      const boostAmount = fertilizerBoost[rarity];
      const updatedStage = Math.min(garden.stage + boostAmount, 5);
      
      // 更新用户肥料数量
      await client.query(
        'UPDATE users SET uses = $1 WHERE id = $2',
        [updatedUses, userId]
      );
      
      // 更新花园状态（施肥可绕过冷却时间，直接更新浇水时间）
      await client.query(
        'UPDATE garden SET stage = $1, last_watered_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [updatedStage, userId]
      );
      
      // 提交事务
      await client.query('COMMIT');
      
      res.json({ message: '施肥成功', stage: updatedStage });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Fertilize error:', error);
    res.status(500).json({ error: '施肥失败，请稍后再试' });
  }
});

// 收获作物
app.post('/api/garden/harvest', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 开始事务
    await client.query('BEGIN');
    
    try {
      // 检查花园记录
      const gardenResult = await client.query(
        'SELECT * FROM garden WHERE user_id = $1',
        [userId]
      );
      
      if (gardenResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '花园不存在' });
      }
      
      const garden = gardenResult.rows[0];
      
      // 检查植物是否成熟
      if (garden.stage < 5) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '植物尚未成熟' });
      }
      
      // 检查植物是否枯萎
      const now = new Date();
      const lastWateredAt = new Date(garden.last_watered_at);
      const secondsSinceWater = (now - lastWateredAt) / 1000;
      // 五阶段前一分钟不浇水则死亡，五阶段无论多久不浇水都不会死亡
      const isWilted = garden.stage < 5 && secondsSinceWater > 60;
      
      if (isWilted) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '植物已枯萎' });
      }
      
      // 获取用户背包
      const userResult = await client.query(
        'SELECT crops FROM users WHERE id = $1',
        [userId]
      );
      
      const user = userResult.rows[0];
      const crops = typeof user.crops === 'object' && user.crops !== null ? user.crops : {};
      
      // 添加作物到背包
      const updatedCrops = { ...crops };
      updatedCrops[garden.rarity] = (updatedCrops[garden.rarity] || 0) + 1;
      
      // 更新用户背包
      await client.query(
        'UPDATE users SET crops = $1 WHERE id = $2',
        [updatedCrops, userId]
      );
      
      // 重置花园记录
      await client.query(
        'UPDATE garden SET seed_id = NULL, rarity = NULL, stage = 0, last_watered_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );
      
      // 提交事务
      await client.query('COMMIT');
      
      res.json({ message: '收获成功', crop: garden.rarity });
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Harvest error:', error);
    res.status(500).json({ error: '收获失败，请稍后再试' });
  }
});

// 铲除植物
app.delete('/api/garden/remove', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 检查花园记录
    const gardenResult = await client.query(
      'SELECT * FROM garden WHERE user_id = $1',
      [userId]
    );
    
    if (gardenResult.rowCount === 0) {
      return res.status(404).json({ error: '花园不存在' });
    }
    
    const garden = gardenResult.rows[0];
    
    // 检查植物是否成熟
    if (garden.stage === 5) {
      return res.status(400).json({ error: '植物已成熟，请先收获' });
    }
    
    // 重置花园记录
    await client.query(
      'UPDATE garden SET seed_id = NULL, rarity = NULL, stage = 0, last_watered_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );
    
    res.json({ message: '铲除成功' });
  } catch (error) {
    console.error('Remove error:', error);
    res.status(500).json({ error: '铲除失败，请稍后再试' });
  }
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    
    // 启动服务器
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    
    // 优雅关闭
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

// 启动服务器
startServer();
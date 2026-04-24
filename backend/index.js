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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 检查并添加points字段
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS points INT DEFAULT 0');
    } catch (error) {
      console.error('Error adding points column:', error);
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



    // 创建植物表
    await client.query(`
      CREATE TABLE IF NOT EXISTS plants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(50) NOT NULL,
        rarity VARCHAR(50) NOT NULL,
        price INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建订单表
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('PURCHASE_SEED', 'SELL_SEED', 'SELL_CROP')),
        amount INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
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
      // 创建管理员用户
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
        ['01', 'Admin', 'admin@example.com', hashedPassword, 'admin']
      );
    }
    
    // 检查是否已有普通用户
    const userCheck = await client.query('SELECT * FROM users WHERE email = $1', ['user@example.com']);
    if (userCheck.rowCount === 0) {
      // 创建普通用户
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
        ['11', 'User', 'user@example.com', hashedPassword, 'user']
      );
    }
    
    // 检查是否已有演示用户
    const demoCheck = await client.query('SELECT * FROM users WHERE email = $1', ['demo@example.com']);
    if (demoCheck.rowCount === 0) {
      // 创建演示用户
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
        ['12', 'Demo User', 'demo@example.com', hashedPassword, 'user']
      );
    }
    
    // 检查是否已有植物数据
    const plantsCheck = await client.query('SELECT * FROM plants');
    if (plantsCheck.rowCount === 0) {
      // 创建植物数据
      const plantData = [
        ['普通种子', '🌱', 'C', 10],
        ['稀有种子', '🌿', 'B', 30],
        ['史诗种子', '🌻', 'A', 50],
        ['传说种子', '🌺', 'S', 100],
        ['神级种子', '✨', 'SSS', 300]
      ];
      
      for (const plant of plantData) {
        await client.query(
          'INSERT INTO plants (name, icon, rarity, price) VALUES ($1, $2, $3, $4)',
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
    
    // 生成用户ID，以1开头
    const userResult = await client.query('SELECT MAX(id) as max_id FROM users WHERE id::text LIKE \'1%\'');
    const maxUserId = userResult.rows[0].max_id;
    let nextId;
    if (maxUserId) {
      // 提取数字部分并加1
      const numPart = parseInt(maxUserId.toString().substring(1)) || 0;
      nextId = `1${numPart + 1}`;
    } else {
      nextId = '11'; // 第一个用户
    }
    console.log('Next user ID:', nextId);
    
    // 初始化背包数据，为所有稀有度的种子和作物设置初始数量为0
    const initialSeeds = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    const initialCrops = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    
    // 创建用户
    const newUser = await client.query(
      'INSERT INTO users (id, name, email, password, role, points, seeds, crops) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [nextId, username, email, hashedPassword, 'user', 100, initialSeeds, initialCrops]
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
    console.log('Token generated:', token);

    // 只对普通用户执行背包内容的格式化操作，管理员不需要
    if (user.role === 'user') {
      // 确保seeds和crops始终是对象，为所有稀有度的种子和作物设置初始数量为0
      // 同时移除旧的存储方式的数据（数字键的对象）
      const requiredRarities = ['C', 'B', 'A', 'S', 'SSS'];
      
      // 处理seeds字段
      if (typeof user.seeds !== 'object' || user.seeds === null || Array.isArray(user.seeds)) {
        user.seeds = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
        // 更新数据库
        await client.query('UPDATE users SET seeds = $1 WHERE id = $2', [user.seeds, user.id]);
        console.log('Updated seeds to default object');
      } else {
        // 统计旧的存储方式中的种子数量
        let seedCounts = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
        for (const key in user.seeds) {
          if (!isNaN(key)) {
            // 旧的存储方式，key是数字
            const seed = user.seeds[key];
            if (seed && typeof seed === 'object' && seed.rarity) {
              const rarity = seed.rarity;
              if (requiredRarities.includes(rarity)) {
                seedCounts[rarity]++;
              }
            }
          } else if (requiredRarities.includes(key)) {
            // 新的存储方式，key是稀有度
            seedCounts[key] = user.seeds[key] || 0;
          }
        }
        // 使用新的存储方式
        user.seeds = seedCounts;
        // 更新数据库
        await client.query('UPDATE users SET seeds = $1 WHERE id = $2', [user.seeds, user.id]);
        console.log('Updated seeds to new format:', user.seeds);
      }
      
      // 处理crops字段
      if (typeof user.crops !== 'object' || user.crops === null || Array.isArray(user.crops)) {
        user.crops = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
        // 更新数据库
        await client.query('UPDATE users SET crops = $1 WHERE id = $2', [user.crops, user.id]);
        console.log('Updated crops to default object');
      } else {
        // 统计旧的存储方式中的作物数量
        let cropCounts = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
        for (const key in user.crops) {
          if (!isNaN(key)) {
            // 旧的存储方式，key是数字
            const crop = user.crops[key];
            if (crop && typeof crop === 'object' && crop.rarity) {
              const rarity = crop.rarity;
              if (requiredRarities.includes(rarity)) {
                cropCounts[rarity]++;
              }
            }
          } else if (requiredRarities.includes(key)) {
            // 新的存储方式，key是稀有度
            cropCounts[key] = user.crops[key] || 0;
          }
        }
        // 使用新的存储方式
        user.crops = cropCounts;
        // 更新数据库
        await client.query('UPDATE users SET crops = $1 WHERE id = $2', [user.crops, user.id]);
        console.log('Updated crops to new format:', user.crops);
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
    const usersResult = await client.query('SELECT id, name, email, role, points, seeds, crops, created_at FROM users');
    const users = usersResult.rows.map(user => ({
      ...user,
      created_at: user.created_at.toISOString().split('T')[0],
      seeds: typeof user.seeds === 'object' && user.seeds !== null && !Array.isArray(user.seeds) ? user.seeds : {},
      crops: typeof user.crops === 'object' && user.crops !== null && !Array.isArray(user.crops) ? user.crops : {}
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
    
    // 生成ID，管理员以0开头，用户以1开头
    let nextId;
    if (role === 'admin') {
      // 获取最大的管理员ID（将id转换为字符串再进行LIKE操作）
      const adminResult = await client.query('SELECT MAX(id) as max_id FROM users WHERE id::text LIKE \'0%\'');
      const maxAdminId = adminResult.rows[0].max_id;
      if (maxAdminId) {
        // 提取数字部分并加1
        const numPart = parseInt(maxAdminId.toString().substring(1)) || 0;
        nextId = `0${numPart + 1}`;
      } else {
        nextId = '01'; // 第一个管理员
      }
    } else {
      // 获取最大的用户ID（将id转换为字符串再进行LIKE操作）
      const userResult = await client.query('SELECT MAX(id) as max_id FROM users WHERE id::text LIKE \'1%\'');
      const maxUserId = userResult.rows[0].max_id;
      if (maxUserId) {
        // 提取数字部分并加1
        const numPart = parseInt(maxUserId.toString().substring(1)) || 0;
        nextId = `1${numPart + 1}`;
      } else {
        nextId = '11'; // 第一个用户
      }
    }
    
    // 创建用户，用户名使用邮箱前缀
    const username = email.split('@')[0];
    
    // 初始化背包数据，为所有稀有度的种子和作物设置初始数量为0
    const initialSeeds = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    const initialCrops = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    
    const newUser = await client.query(
      'INSERT INTO users (id, name, email, password, role, points, seeds, crops) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [nextId, username, email, hashedPassword, role || 'user', req.body.points || 100, initialSeeds, initialCrops]
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
      'SELECT id, name, email, role, points, seeds, crops, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rowCount === 0) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = result.rows[0];
    console.log('User data from database:', user);
    // 确保seeds和crops始终是对象
    const seeds = typeof user.seeds === 'object' && user.seeds !== null && !Array.isArray(user.seeds) ? user.seeds : {};
    const crops = typeof user.crops === 'object' && user.crops !== null && !Array.isArray(user.crops) ? user.crops : {};
    const response = {
      ...user,
      created_at: user.created_at.toISOString().split('T')[0],
      seeds,
      crops
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
    console.log('Fetching user with id:', id);
    const userResult = await client.query('SELECT id, name, email, role, points, seeds, crops, created_at FROM users WHERE id = $1', [id]);
    
    if (userResult.rowCount === 0) {
      console.log('User not found:', id);
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = userResult.rows[0];
    console.log('User data from database:', user);
    
    // 确保seeds和crops始终是对象
    const requiredRarities = ['C', 'B', 'A', 'S', 'SSS'];
    let processedSeeds = user.seeds || {};
    let processedCrops = user.crops || {};
    
    // 处理seeds字段
    if (typeof processedSeeds !== 'object' || processedSeeds === null || Array.isArray(processedSeeds)) {
      console.log('Processing seeds as array or null:', processedSeeds);
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
      console.log('Processing crops as array or null:', processedCrops);
      processedCrops = { C: 0, B: 0, A: 0, S: 0, SSS: 0 };
    } else {
      // 确保所有稀有度都有值
      for (const rarity of requiredRarities) {
        if (processedCrops[rarity] === undefined) {
          processedCrops[rarity] = 0;
        }
      }
    }
    
    // 打印处理后的背包数据，以便调试
    console.log('Processed seeds:', processedSeeds);
    console.log('Processed crops:', processedCrops);
    
    // 确保返回的对象包含处理后的seeds和crops字段
    const responseUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      points: user.points,
      created_at: user.created_at.toISOString().split('T')[0],
      seeds: processedSeeds,
      crops: processedCrops
    };
    
    // 打印返回的用户数据，以便调试
    console.log('Response user data:', responseUser);
    
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
    
    // 不能删除管理员用户
    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rowCount > 0 && userResult.rows[0].role === 'admin') {
      return res.status(400).json({ error: '不能删除管理员用户' });
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
    const plantsResult = await client.query('SELECT * FROM plants');
    res.json(plantsResult.rows);
  } catch (error) {
    console.error('Fetch plants error:', error);
    res.status(500).json({ error: '获取植物列表失败，请稍后再试' });
  }
});

app.post('/api/plants', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, rarity, price } = req.body;
    
    if (!name || !icon || !rarity || !price) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    
    const newPlant = await client.query(
      'INSERT INTO plants (name, icon, rarity, price) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, icon, rarity, price]
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
    const { name, icon, rarity, price } = req.body;
    
    if (!name || !icon || !rarity || !price) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    
    const updatedPlant = await client.query(
      'UPDATE plants SET name = $1, icon = $2, rarity = $3, price = $4 WHERE id = $5 RETURNING *',
      [name, icon, rarity, price, id]
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
    const result = await client.query(
      'INSERT INTO orders (user_id, type, amount) VALUES ($1, $2, $3) RETURNING *',
      [userId, type, amount]
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const ordersResult = await client.query(`
      SELECT * FROM orders 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
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
      'SELECT seeds, crops FROM users WHERE id = $1',
      [stringUserId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = userResult.rows[0];
    
    // 确保seeds和crops始终是对象
    const seeds = typeof user.seeds === 'object' && user.seeds !== null && !Array.isArray(user.seeds) ? user.seeds : {};
    const crops = typeof user.crops === 'object' && user.crops !== null && !Array.isArray(user.crops) ? user.crops : {};
    
    res.json({
      seeds,
      crops
    });
  } catch (error) {
    console.error('Fetch backpack error:', error);
    res.status(500).json({ error: '获取背包数据失败，请稍后再试' });
  }
});

// 购买种子（包含积分扣除和订单创建）
app.post('/api/user/seeds', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rarity, price } = req.body;
    
    if (!rarity || !price) {
      return res.status(400).json({ error: '请提供种子稀有度和价格' });
    }
    
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
      if (user.points < price) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '积分不足' });
      }
      
      // 确保seeds字段是对象
      const currentSeeds = typeof user.seeds === 'object' && user.seeds !== null && !Array.isArray(user.seeds) ? user.seeds : {};
      
      // 增加对应稀有度的数量
      const updatedSeeds = { ...currentSeeds };
      updatedSeeds[rarity] = (updatedSeeds[rarity] || 0) + 1;
      
      // 扣除积分
      const updatedPoints = user.points - price;
      
      // 更新用户数据
      await client.query(
        'UPDATE users SET seeds = $1, points = $2 WHERE id = $3',
        [updatedSeeds, updatedPoints, stringUserId]
      );
      
      // 创建订单
      await createOrder(stringUserId, 'PURCHASE_SEED', -price);
      
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

// 记录所有HTTP请求
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 卖出种子（包含积分增加和订单创建）
app.delete('/api/user/seeds/:rarity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rarity } = req.params;
    const { quantity, price } = req.body || { quantity: 1, price: 0 };
    
    console.log('Sell seed request received:', { userId, rarity, quantity, price });
    
    if (!price) {
      return res.status(400).json({ error: '请提供种子价格' });
    }
    
    // 确保userId是字符串类型
    const stringUserId = String(userId);
    console.log('String userId:', stringUserId);
    
    // 开始事务
    await client.query('BEGIN');
    
    try {
      // 获取用户当前数据
      const userResult = await client.query(
        'SELECT seeds, points FROM users WHERE id = $1',
        [stringUserId]
      );
      
      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        console.log('User not found:', stringUserId);
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = userResult.rows[0];
      
      // 确保currentSeeds始终是对象
      const currentSeeds = typeof user.seeds === 'object' && user.seeds !== null ? user.seeds : {};
      console.log('Current seeds:', currentSeeds);
      
      // 检查种子是否存在
      if (!currentSeeds[rarity] || currentSeeds[rarity] < quantity) {
        await client.query('ROLLBACK');
        console.log('Seed not found or insufficient quantity:', { rarity, currentQuantity: currentSeeds[rarity], requestedQuantity: quantity });
        return res.status(404).json({ error: '种子不存在或数量不足' });
      }
      
      // 减少对应稀有度的数量
      const updatedSeeds = { ...currentSeeds };
      updatedSeeds[rarity] -= quantity;
      if (updatedSeeds[rarity] === 0) {
        delete updatedSeeds[rarity];
      }
      console.log('Updated seeds:', updatedSeeds);
      
      // 计算增加的积分
      const totalPrice = price * quantity;
      const updatedPoints = (user.points || 0) + totalPrice;
      
      // 更新用户数据
      await client.query(
        'UPDATE users SET seeds = $1, points = $2 WHERE id = $3',
        [updatedSeeds, updatedPoints, stringUserId]
      );
      
      // 创建订单
      await createOrder(stringUserId, 'SELL_SEED', totalPrice);
      
      // 提交事务
      await client.query('COMMIT');
      
      console.log('Seed sold successfully:', { rarity, quantity, totalPrice });
      res.json({ rarity, quantity: updatedSeeds[rarity] || 0, points: updatedPoints });
    } catch (error) {
      // 回滚事务
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Sell seed error:', error);
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
      if (updatedCrops[rarity] === 0) {
        delete updatedCrops[rarity];
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
      if (updatedSeeds[rarity] === 0) {
        delete updatedSeeds[rarity];
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
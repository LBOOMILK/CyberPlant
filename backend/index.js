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
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        product VARCHAR(255) NOT NULL,
        amount INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT '待支付',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
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
app.use(cors());
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
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    
    // 检查邮箱是否已存在
    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }
    
    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 生成用户ID，以1开头
    const userResult = await client.query('SELECT MAX(id) as max_id FROM users WHERE id LIKE \'1%\'');
    const maxUserId = userResult.rows[0].max_id;
    let nextId;
    if (maxUserId) {
      // 提取数字部分并加1
      const numPart = parseInt(maxUserId.substring(1)) || 0;
      nextId = `1${numPart + 1}`;
    } else {
      nextId = '11'; // 第一个用户
    }
    
    // 创建用户
    const newUser = await client.query(
      'INSERT INTO users (id, name, email, password, role, points) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nextId, name, email, hashedPassword, 'user', 0]
    );
    
    const user = newUser.rows[0];
    
    // 生成 JWT 令牌
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points || 0,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败，请稍后再试' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }
    
    // 查找用户
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rowCount === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }
    
    const user = userResult.rows[0];
    
    // 验证密码
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: '密码错误' });
    }
    
    // 生成 JWT 令牌
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points || 0,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败，请稍后再试' });
  }
});

// 用户路由
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const usersResult = await client.query('SELECT id, name, email, role, points, seeds, crops, created_at FROM users');
    res.json(usersResult.rows);
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
      // 获取最大的管理员ID
      const adminResult = await client.query('SELECT MAX(id) as max_id FROM users WHERE id LIKE \'0%\'');
      const maxAdminId = adminResult.rows[0].max_id;
      if (maxAdminId) {
        // 提取数字部分并加1
        const numPart = parseInt(maxAdminId.substring(1)) || 0;
        nextId = `0${numPart + 1}`;
      } else {
        nextId = '01'; // 第一个管理员
      }
    } else {
      // 获取最大的用户ID
      const userResult = await client.query('SELECT MAX(id) as max_id FROM users WHERE id LIKE \'1%\'');
      const maxUserId = userResult.rows[0].max_id;
      if (maxUserId) {
        // 提取数字部分并加1
        const numPart = parseInt(maxUserId.substring(1)) || 0;
        nextId = `1${numPart + 1}`;
      } else {
        nextId = '11'; // 第一个用户
      }
    }
    
    // 创建用户，用户名使用邮箱前缀
    const username = email.split('@')[0];
    
    const newUser = await client.query(
      'INSERT INTO users (id, name, email, password, role, points) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nextId, username, email, hashedPassword, role || 'user', req.body.points || 0]
    );
    
    res.status(201).json(newUser.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: '创建用户失败，请稍后再试' });
  }
});

// 更新用户
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, points, seeds, crops } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: '请填写邮箱' });
    }
    
    const updatedUser = await client.query(
      'UPDATE users SET email = $1, role = $2, points = $3, seeds = $4, crops = $5 WHERE id = $6 RETURNING *',
      [email, role || 'user', points || 0, seeds || '[]', crops || '[]', id]
    );
    
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

// 订单路由
app.get('/api/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const ordersResult = await client.query(`
      SELECT o.*, u.id as user_id, u.name as user_name, u.email as user_email 
      FROM orders o
      JOIN users u ON o.user_id = u.id
    `);
    
    const orders = ordersResult.rows.map(order => ({
      id: order.id,
      user_id: order.user_id,
      product: order.product,
      amount: order.amount,
      status: order.status,
      created_at: order.created_at,
      user: {
        id: order.user_id,
        name: order.user_name,
        email: order.user_email
      }
    }));
    
    res.json(orders);
  } catch (error) {
    console.error('Fetch orders error:', error);
    res.status(500).json({ error: '获取订单列表失败，请稍后再试' });
  }
});

// 用户背包路由
app.get('/api/user/backpack', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取用户数据
    const userResult = await client.query(
      'SELECT seeds, crops FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = userResult.rows[0];
    
    res.json({
      seeds: user.seeds || [],
      crops: user.crops || []
    });
  } catch (error) {
    console.error('Fetch backpack error:', error);
    res.status(500).json({ error: '获取背包数据失败，请稍后再试' });
  }
});

// 添加种子
app.post('/api/user/seeds', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rarity } = req.body;
    
    if (!rarity) {
      return res.status(400).json({ error: '请提供种子稀有度' });
    }
    
    // 获取用户当前种子
    const userResult = await client.query(
      'SELECT seeds FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const currentSeeds = userResult.rows[0].seeds || [];
    const newSeed = {
      id: Date.now() + Math.random(),
      rarity: rarity,
      purchasedAt: new Date().toISOString()
    };
    
    const updatedSeeds = [...currentSeeds, newSeed];
    
    // 更新用户种子
    await client.query(
      'UPDATE users SET seeds = $1 WHERE id = $2',
      [updatedSeeds, userId]
    );
    
    res.status(201).json(newSeed);
  } catch (error) {
    console.error('Add seed error:', error);
    res.status(500).json({ error: '添加种子失败，请稍后再试' });
  }
});

// 删除种子
app.delete('/api/user/seeds/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // 获取用户当前种子
    const userResult = await client.query(
      'SELECT seeds FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const currentSeeds = userResult.rows[0].seeds || [];
    const updatedSeeds = currentSeeds.filter(seed => seed.id != id);
    
    if (updatedSeeds.length === currentSeeds.length) {
      return res.status(404).json({ error: '种子不存在' });
    }
    
    // 更新用户种子
    await client.query(
      'UPDATE users SET seeds = $1 WHERE id = $2',
      [updatedSeeds, userId]
    );
    
    res.json({ message: '删除种子成功' });
  } catch (error) {
    console.error('Delete seed error:', error);
    res.status(500).json({ error: '删除种子失败，请稍后再试' });
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
    
    // 获取用户当前作物
    const userResult = await client.query(
      'SELECT crops FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const currentCrops = userResult.rows[0].crops || [];
    const newCrop = {
      id: Date.now() + Math.random(),
      rarity: rarity,
      harvestedAt: new Date().toISOString()
    };
    
    const updatedCrops = [...currentCrops, newCrop];
    
    // 更新用户作物
    await client.query(
      'UPDATE users SET crops = $1 WHERE id = $2',
      [updatedCrops, userId]
    );
    
    res.status(201).json(newCrop);
  } catch (error) {
    console.error('Add crop error:', error);
    res.status(500).json({ error: '添加作物失败，请稍后再试' });
  }
});

// 删除作物
app.delete('/api/user/crops/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // 获取用户当前作物
    const userResult = await client.query(
      'SELECT crops FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const currentCrops = userResult.rows[0].crops || [];
    const updatedCrops = currentCrops.filter(crop => crop.id != id);
    
    if (updatedCrops.length === currentCrops.length) {
      return res.status(404).json({ error: '作物不存在' });
    }
    
    // 更新用户作物
    await client.query(
      'UPDATE users SET crops = $1 WHERE id = $2',
      [updatedCrops, userId]
    );
    
    res.json({ message: '删除作物成功' });
  } catch (error) {
    console.error('Delete crop error:', error);
    res.status(500).json({ error: '删除作物失败，请稍后再试' });
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

// 获取当前用户信息
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await client.query(
      'SELECT id, name, email, role, points, seeds, crops, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '获取用户信息失败，请稍后再试' });
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
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { client, logger, generateUserId } = require('../../db');
const { JWT_SECRET } = require('../../middleware');

// 健康检查
router.get('/', (req, res) => {
  res.json({ message: 'Backend API is running' });
});

// 注册
router.post('/api/auth/register', async (req, res) => {
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

// 登录
router.post('/api/auth/login', async (req, res) => {
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

// 获取商品列表（无需登录也能看）
router.get('/api/items', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM items WHERE is_shop = true ORDER BY rarity, id');
    res.json(result.rows);
  } catch (error) {
    logger.error('Fetch items error', { error: error.message });
    res.status(500).json({ error: '获取物品列表失败' });
  }
});

module.exports = router;

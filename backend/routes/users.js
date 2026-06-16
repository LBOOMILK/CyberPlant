// backend/routes/users.js - 用户路由
const express = require('express');
const bcrypt = require('bcrypt');
const { client, logger, generateUserId, deductCurrency, getConfig } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware');
const router = express.Router();

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const usersResult = await client.query('SELECT id, name, email, role, is_new_user, created_at, last_login_at FROM users');
    const users = [];
    for (const user of usersResult.rows) {
      const c = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [user.id]);
      const currencies = c.rowCount > 0 ? { silver_coin: Number(c.rows[0].silver_coin), gold_coin: Number(c.rows[0].gold_coin), diamond: Number(c.rows[0].diamond) } : { silver_coin: 0, gold_coin: 0, diamond: 0 };
      users.push({ id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, currencies, created_at: user.created_at?.toISOString().split('T')[0], last_login_at: user.last_login_at?.toISOString() });
    }
    res.json(users);
  } catch (error) { logger.error('Fetch users error', { error: error.message }); res.status(500).json({ error: '获取用户列表失败' }); }
});

router.get('/users/me', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT id, name, email, role, is_new_user, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const user = result.rows[0];
    const c = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [req.user.id]);
    const currencies = c.rowCount > 0 ? { silver_coin: Number(c.rows[0].silver_coin), gold_coin: Number(c.rows[0].gold_coin), diamond: Number(c.rows[0].diamond) } : { silver_coin: 0, gold_coin: 0, diamond: 0 };
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, currencies, created_at: user.created_at.toISOString().split('T')[0] });
  } catch (error) { logger.error('Get user error', { error: error.message }); res.status(500).json({ error: '获取用户信息失败' }); }
});

router.put('/users/me', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '请填写用户名' });
    const updatedUser = await client.query('UPDATE users SET name = $1 WHERE id = $2 RETURNING *', [name, req.user.id]);
    if (updatedUser.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const user = updatedUser.rows[0];
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, created_at: user.created_at.toISOString().split('T')[0] });
  } catch (error) { logger.error('Update user error', { error: error.message }); res.status(500).json({ error: '更新用户信息失败' }); }
});

router.get('/users/search', authenticateToken, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim().length === 0) return res.status(400).json({ error: '请提供搜索关键词' });
    const result = await client.query('SELECT id, name FROM users WHERE id != $1 AND (name ILIKE $2 OR id::text ILIKE $2) LIMIT 20', [req.user.id, `%${q.trim()}%`]);
    res.json(result.rows.map(r => ({ id: r.id, name: r.name })));
  } catch (error) { logger.error('Search users error:', { error: error.message }); res.status(500).json({ error: '搜索用户失败' }); }
});

router.get('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await client.query('SELECT id, name, email, role, is_new_user, created_at FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const user = userResult.rows[0];
    const c = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [id]);
    const currencies = c.rowCount > 0 ? { silver_coin: Number(c.rows[0].silver_coin), gold_coin: Number(c.rows[0].gold_coin), diamond: Number(c.rows[0].diamond) } : { silver_coin: 0, gold_coin: 0, diamond: 0 };
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, currencies, created_at: user.created_at.toISOString().split('T')[0] });
  } catch (error) { logger.error('Fetch user error', { error: error.message }); res.status(500).json({ error: '获取用户数据失败' }); }
});

router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;
    if (!email) return res.status(400).json({ error: '请填写邮箱' });
    let query = 'UPDATE users SET name = $1, email = $2, role = $3';
    let params = [name || email.split('@')[0], email, role || 'user'];
    let idx = 4;
    if (password) {
      const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{6,20}$/;
      if (!passwordRegex.test(password)) return res.status(400).json({ error: '密码格式不对' });
      query += `, password = $${idx++}`; params.push(await bcrypt.hash(password, 10));
    }
    query += ` WHERE id = $${idx} RETURNING *`; params.push(id);
    const updatedUser = await client.query(query, params);
    if (updatedUser.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    res.json(updatedUser.rows[0]);
  } catch (error) { logger.error('Update user error', { error: error.message }); res.status(500).json({ error: '更新用户失败' }); }
});

router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    if (id === '1' && userResult.rows[0].role === 'admin') return res.status(400).json({ error: 'id为1的管理员无法被删除' });
    if (id.toString() === req.user.id.toString()) return res.status(400).json({ error: '不能删除自己' });
    await client.query('DELETE FROM orders WHERE user_id = $1', [id]);
    await client.query('DELETE FROM garden_plots WHERE user_id = $1', [id]);
    await client.query('DELETE FROM user_items WHERE user_id = $1', [id]);
    await client.query('DELETE FROM currencies WHERE user_id = $1', [id]);
    await client.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: '用户删除成功' });
  } catch (error) { logger.error('Delete user error', { error: error.message }); res.status(500).json({ error: '删除用户失败' }); }
});

router.get('/users/:id/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd FROM user_items ui JOIN items i ON ui.item_id = i.id WHERE ui.user_id = $1 AND ui.quantity > 0 ORDER BY i.item_type, i.rarity, i.id', [req.params.id]);
    res.json(result.rows);
  } catch (error) { logger.error('Get admin user items error', { error: error.message }); res.status(500).json({ error: '获取用户背包失败' }); }
});

// 背包
router.get('/user/items', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd FROM user_items ui JOIN items i ON ui.item_id = i.id WHERE ui.user_id = $1 AND ui.quantity > 0 ORDER BY i.item_type, i.rarity, i.id', [req.user.id]);
    res.json(result.rows.map(r => ({ item_id: r.item_id, quantity: r.quantity, name: r.name, icon: r.icon, rarity: r.rarity, item_type: r.item_type, base_yield: r.base_yield, buy_price: r.buy_price, sell_price: r.sell_price, currency_type: r.currency_type, water_cd: r.water_cd || 5, grow_time: (r.water_cd || 5) * 5 })));
  } catch (error) { logger.error('Get user items error', { error: error.message }); res.status(500).json({ error: '获取背包物品失败' }); }
});

router.get('/user/backpack', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd FROM user_items ui JOIN items i ON ui.item_id = i.id WHERE ui.user_id = $1 AND ui.quantity > 0 ORDER BY i.item_type, i.rarity, i.id', [req.user.id]);
    const grouped = { seed: [], fertilizer: [], crop: [], pet_food: [], decoration: [] };
    for (const row of result.rows) { const type = row.item_type; if (!grouped[type]) grouped[type] = []; grouped[type].push({ item_id: row.item_id, quantity: row.quantity, name: row.name, icon: row.icon, rarity: row.rarity, item_type: row.item_type, base_yield: row.base_yield, buy_price: Number(row.buy_price), sell_price: Number(row.sell_price), currency_type: row.currency_type, water_cd: row.water_cd || 5, grow_time: (row.water_cd || 5) * 5 }); }
    const decResult = await client.query('SELECT ud.decoration_id, ud.quantity, d.name, d.icon, d.quality, d.slot_type, d.bonus FROM user_decorations ud JOIN decorations d ON ud.decoration_id = d.id WHERE ud.user_id = $1 AND ud.quantity > 0 ORDER BY d.quality, d.id', [req.user.id]);
    for (const row of decResult.rows) grouped.decoration.push({ item_id: row.decoration_id, quantity: row.quantity, name: row.name, icon: row.icon, rarity: row.quality, item_type: 'decoration', bonus_type: row.slot_type, bonus_value: Number(row.bonus) });
    res.json({ groups: grouped });
  } catch (error) { logger.error('Get backpack error:', { error: error.message }); res.status(500).json({ error: '获取背包物品失败' }); }
});

// 货币
router.get('/user/currencies', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '货币记录不存在' });
    res.json({ silver_coin: Number(result.rows[0].silver_coin), gold_coin: Number(result.rows[0].gold_coin), diamond: Number(result.rows[0].diamond) });
  } catch (error) { logger.error('Get currencies error', { error: error.message }); res.status(500).json({ error: '获取货币余额失败' }); }
});

router.post('/user/currencies/exchange', authenticateToken, async (req, res) => {
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
    if (from === 'silver_coin' && to === 'gold_coin') receiveAmount = Math.floor(amount / silverToGold);
    else if (from === 'gold_coin' && to === 'silver_coin') receiveAmount = amount * goldToSilver;
    else return res.status(400).json({ error: '不支持的兑换方向' });
    if (receiveAmount <= 0) return res.status(400).json({ error: '兑换数量过小' });
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, from, amount);
      await require('../db').addCurrency(userId, to, receiveAmount);
      await require('../db').createOrder(userId, 'EXCHANGE', from, -amount);
      await require('../db').createOrder(userId, 'EXCHANGE', to, receiveAmount);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    const result = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '兑换成功', exchanged: { from, to, spent: amount, received: receiveAmount }, currencies: { silver_coin: Number(result.rows[0].silver_coin), gold_coin: Number(result.rows[0].gold_coin), diamond: Number(result.rows[0].diamond) } });
  } catch (error) {
    if (error.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
    logger.error('Exchange error', { error: error.message }); res.status(500).json({ error: '兑换失败' });
  }
});

// 物品
router.get('/items', async (req, res) => { try { res.json((await client.query('SELECT * FROM items WHERE is_shop = true ORDER BY rarity, id')).rows); } catch (error) { res.status(500).json({ error: '获取物品列表失败' }); } });
router.get('/items/all', authenticateToken, requireAdmin, async (req, res) => { try { res.json((await client.query('SELECT * FROM items ORDER BY id')).rows); } catch (error) { res.status(500).json({ error: '获取物品列表失败' }); } });

module.exports = router;

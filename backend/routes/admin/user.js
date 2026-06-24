const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { client, logger, generateUserId } = require('../../db');
const { authenticateToken, requireAdmin } = require('../../middleware');

// GET /api/users — 获取所有用户列表
router.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
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

// POST /api/users — 创建用户
router.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
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

// GET /api/users/:id — 获取单个用户
router.get('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// PUT /api/users/:id — 更新用户
router.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// DELETE /api/users/:id — 删除用户
router.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
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
    await client.query('DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1', [id]);
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

// GET /api/users/:id/items — 获取用户物品
router.get('/api/users/:id/items', authenticateToken, requireAdmin, async (req, res) => {
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

// GET /api/items/all — 获取所有物品
router.get('/api/items/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM items ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    logger.error('Fetch all items error', { error: error.message });
    res.status(500).json({ error: '获取物品列表失败' });
  }
});

// GET /api/pets/all — 获取所有宠物
router.get('/api/pets/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json(await (await client.query('SELECT * FROM pets ORDER BY rarity, id')).rows);
  } catch (error) {
    logger.error('Get pets error', { error: error.message });
    res.status(500).json({ error: '获取宠物列表失败' });
  }
});

// GET /api/admin/users/:id/backpack — 获取用户背包详情
router.get('/api/admin/users/:id/backpack', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userCheck = await client.query('SELECT id, name, email, role FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) return res.status(404).json({ error: '用户不存在' });

    const itemsResult = await client.query(
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.buy_price, i.sell_price, i.currency_type
       FROM user_items ui
       JOIN items i ON ui.item_id = i.id
       WHERE ui.user_id = $1
       ORDER BY i.item_type, i.rarity, i.id`,
      [id]
    );

    const petsResult = await client.query(
      `SELECT up.id AS user_pet_id, up.pet_id, up.level, up.hunger, up.is_active,
              p.name, p.icon, p.rarity, p.base_bonus, p.price_amount, p.price_type
       FROM user_pets up
       JOIN pets p ON up.pet_id = p.id
       WHERE up.user_id = $1
       ORDER BY p.rarity DESC, up.level DESC`,
      [id]
    );

    const decorationsResult = await client.query(
      `SELECT ud.decoration_id, ud.quantity, d.name, d.icon, d.slot_type, d.quality, d.bonus
       FROM user_decorations ud
       JOIN decorations d ON ud.decoration_id = d.id
       WHERE ud.user_id = $1
       ORDER BY d.quality DESC, d.id`,
      [id]
    );

    res.json({
      user: userCheck.rows[0],
      items: itemsResult.rows,
      pets: petsResult.rows,
      decorations: decorationsResult.rows
    });
  } catch (error) {
    logger.error('Get user backpack error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: '获取用户背包失败: ' + error.message });
  }
});

// DELETE /api/admin/users/:id/pets/:petId — 删除用户宠物
router.delete('/api/admin/users/:id/pets/:petId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id, petId } = req.params;
    await client.query('DELETE FROM user_pets WHERE user_id = $1 AND pet_id = $2', [id, petId]);
    res.json({ message: '用户宠物删除成功' });
  } catch (error) {
    logger.error('Delete user pet error', { error: error.message });
    res.status(500).json({ error: '删除用户宠物失败' });
  }
});

// DELETE /api/admin/users/:id/decorations/:decorationId — 删除用户饰品
router.delete('/api/admin/users/:id/decorations/:decorationId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id, decorationId } = req.params;
    await client.query('DELETE FROM user_decorations WHERE user_id = $1 AND decoration_id = $2', [id, decorationId]);
    res.json({ message: '用户饰品删除成功' });
  } catch (error) {
    logger.error('Delete user decoration error', { error: error.message });
    res.status(500).json({ error: '删除用户饰品失败' });
  }
});

// GET /api/admin/active-users — 获取今日活跃用户数
router.get('/api/admin/active-users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const result = await client.query('SELECT COUNT(*) as count FROM users WHERE last_login_at >= $1 AND role = $2', [today, 'user']);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    logger.error('Get active users error', { error: error.message });
    res.status(500).json({ error: '获取活跃用户数失败' });
  }
});

// PUT /api/admin/users/:id/currencies — 更新用户货币
router.put('/api/admin/users/:id/currencies', authenticateToken, requireAdmin, async (req, res) => {
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

// PUT /api/admin/users/:id/items — 更新用户背包物品
router.put('/api/admin/users/:id/items', authenticateToken, requireAdmin, async (req, res) => {
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

module.exports = router;

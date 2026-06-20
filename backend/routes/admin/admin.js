const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { client, logger, generateUserId } = require('../../db');
const { authenticateToken, requireAdmin } = require('../../middleware');

// GET /api/admin/admins — 获取所有管理员
router.get('/api/admin/admins', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query("SELECT id, name, email, role, created_at, last_login_at FROM users WHERE role = 'admin' ORDER BY id::int");
    res.json(result.rows);
  } catch (error) {
    logger.error('Get admins error', { error: error.message });
    res.status(500).json({ error: '获取管理员列表失败' });
  }
});

// POST /api/admin/admins — 创建管理员
router.post('/api/admin/admins', authenticateToken, requireAdmin, async (req, res) => {
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

// DELETE /api/admin/admins/:id — 删除管理员
router.delete('/api/admin/admins/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    if (userResult.rows[0].role !== 'admin') return res.status(400).json({ error: '该用户不是管理员' });
    if (id === '1') return res.status(400).json({ error: 'id为1的管理员无法被删除' });
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
    res.json({ message: '管理员删除成功' });
  } catch (error) {
    logger.error('Delete admin error', { error: error.message });
    res.status(500).json({ error: '删除管理员失败' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { client, logger } = require('../../db');
const { authenticateToken, requireAdmin } = require('../../middleware');

// GET /api/admin/orders — 获取所有订单
router.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const ordersResult = await client.query('SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const totalResult = await client.query('SELECT COUNT(*) as total FROM orders');
    res.json({ orders: ordersResult.rows.map(o => ({ id: o.id, user_id: o.user_id, type: o.type, currency_type: o.currency_type, amount: Number(o.amount), created_at: o.created_at ? new Date(o.created_at).toISOString() : null, user: { id: o.user_id, name: o.user_name, email: o.user_email } })), pagination: { page, limit, total: parseInt(totalResult.rows[0].total), totalPages: Math.ceil(parseInt(totalResult.rows[0].total) / limit) } });
  } catch (error) {
    logger.error('Fetch admin orders error', { error: error.message });
    res.status(500).json({ error: '获取订单列表失败' });
  }
});

// DELETE /api/admin/orders/:id — 删除订单
router.delete('/api/admin/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('DELETE FROM orders WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '订单不存在' });
    res.json({ message: '订单删除成功' });
  } catch (error) {
    logger.error('Delete order error', { error: error.message });
    res.status(500).json({ error: '删除订单失败' });
  }
});

module.exports = router;

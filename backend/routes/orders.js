// backend/routes/orders.js
const express = require('express');
const { client, logger } = require('../db');
const { authenticateToken } = require('../middleware');
const router = express.Router();

router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; const limit = parseInt(req.query.limit) || 10; const offset = (page - 1) * limit;
    const ordersResult = await client.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [req.user.id, limit, offset]);
    const totalResult = await client.query('SELECT COUNT(*) as total FROM orders WHERE user_id = $1', [req.user.id]);
    res.json({ orders: ordersResult.rows.map(o => ({ id: o.id, user_id: o.user_id, type: o.type, currency_type: o.currency_type, amount: Number(o.amount), created_at: o.created_at ? new Date(o.created_at).toISOString() : null })), pagination: { page, limit, total: parseInt(totalResult.rows[0].total), totalPages: Math.ceil(parseInt(totalResult.rows[0].total) / limit) } });
  } catch (error) { logger.error('Fetch orders error', { error: error.message }); res.status(500).json({ error: '获取订单列表失败' }); }
});

module.exports = router;

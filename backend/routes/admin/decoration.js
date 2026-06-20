const express = require('express');
const router = express.Router();
const { client, logger } = require('../../db');
const { authenticateToken, requireAdmin } = require('../../middleware');

// GET /api/admin/decorations/all — 获取所有饰品
router.get('/api/admin/decorations/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT d.*, p.name as pet_name FROM decorations d LEFT JOIN pets p ON d.pet_id = p.id ORDER BY d.slot_type, d.quality DESC, d.id');
    logger.info('Decorations all query returned rows:', { count: result.rows.length });
    res.json(result.rows);
  } catch (error) {
    logger.error('Get decorations error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: '获取饰品列表失败: ' + error.message });
  }
});

// POST /api/admin/decorations — 创建饰品
router.post('/api/admin/decorations', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, slot_type, quality, bonus, price_type, price_amount, pet_id } = req.body;
    if (!name || !slot_type) return res.status(400).json({ error: '请填写饰品名和槽位类型' });
    const result = await client.query('INSERT INTO decorations (name, icon, slot_type, quality, bonus, price_type, price_amount, pet_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, icon || '🎀', slot_type, quality || 'C', bonus || 0, price_type || 'silver_coin', price_amount || 100, pet_id || null]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create decoration error', { error: error.message });
    res.status(500).json({ error: '创建饰品失败' });
  }
});

// PUT /api/admin/decorations/:id — 更新饰品
router.put('/api/admin/decorations/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, slot_type, quality, bonus, price_type, price_amount, pet_id } = req.body;
    const existing = await client.query('SELECT * FROM decorations WHERE id = $1', [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: '饰品不存在' });
    const e = existing.rows[0];
    const result = await client.query('UPDATE decorations SET name=$1, icon=$2, slot_type=$3, quality=$4, bonus=$5, price_type=$6, price_amount=$7, pet_id=$8 WHERE id=$9 RETURNING *',
      [name || e.name, icon || e.icon, slot_type || e.slot_type, quality || e.quality, bonus || e.bonus, price_type || e.price_type, price_amount || e.price_amount, pet_id !== undefined ? pet_id : e.pet_id, id]);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update decoration error', { error: error.message });
    res.status(500).json({ error: '更新饰品失败' });
  }
});

// DELETE /api/admin/decorations/:id — 删除饰品
router.delete('/api/admin/decorations/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('DELETE FROM decorations WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '饰品不存在' });
    res.json({ message: '饰品删除成功' });
  } catch (error) {
    logger.error('Delete decoration error', { error: error.message });
    res.status(500).json({ error: '删除饰品失败' });
  }
});

module.exports = router;

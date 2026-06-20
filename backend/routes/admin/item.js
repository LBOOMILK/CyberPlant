const express = require('express');
const router = express.Router();
const { client, logger } = require('../../db');
const { authenticateToken, requireAdmin } = require('../../middleware');

// POST /api/admin/items — 创建物品
router.post('/api/admin/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd, stage_skip, purchasable } = req.body;
    if (!name || !item_type) return res.status(400).json({ error: '请填写物品名和类型' });
    const result = await client.query(
      `INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd, stage_skip, purchasable) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [name, icon || '', rarity || 'C', item_type, base_yield || 0, buy_price || 0, sell_price || 0, currency_type || 'silver_coin', is_shop !== false, crop_id || null, water_cd || 5, stage_skip || 1, purchasable !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create item error', { error: error.message });
    res.status(500).json({ error: '创建物品失败' });
  }
});

// PUT /api/admin/items/:id — 更新物品
router.put('/api/admin/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd, stage_skip, purchasable } = req.body;
    const existing = await client.query('SELECT * FROM items WHERE id = $1', [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    const e = existing.rows[0];
    const result = await client.query(
      `UPDATE items SET name=$1, icon=$2, rarity=$3, item_type=$4, base_yield=$5, buy_price=$6, sell_price=$7, currency_type=$8, is_shop=$9, crop_id=$10, water_cd=$11, stage_skip=$12, purchasable=$13 WHERE id=$14 RETURNING *`,
      [name||e.name, icon!==undefined?icon:e.icon, rarity||e.rarity, item_type||e.item_type, base_yield!==undefined?base_yield:e.base_yield, buy_price!==undefined?buy_price:e.buy_price, sell_price!==undefined?sell_price:e.sell_price, currency_type||e.currency_type, is_shop!==undefined?is_shop:e.is_shop, crop_id!==undefined?crop_id:e.crop_id, water_cd||e.water_cd||5, stage_skip!==undefined?stage_skip:(e.stage_skip||1), purchasable!==undefined?purchasable:(e.purchasable!==false), id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update item error', { error: error.message });
    res.status(500).json({ error: '更新物品失败' });
  }
});

// DELETE /api/admin/items/:id — 删除物品
router.delete('/api/admin/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('DELETE FROM items WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    res.json({ message: '物品删除成功' });
  } catch (error) {
    logger.error('Delete item error', { error: error.message });
    res.status(500).json({ error: '删除物品失败' });
  }
});

module.exports = router;

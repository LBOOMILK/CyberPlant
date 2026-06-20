const express = require('express');
const router = express.Router();
const { client, logger } = require('../../db');
const { authenticateToken, requireAdmin } = require('../../middleware');

// POST /api/admin/pets — 创建宠物
router.post('/api/admin/pets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, rarity, base_bonus, price_amount, price_type, is_shop, purchasable, bonus_curve, growth_curve, is_test, effect_file } = req.body;
    if (!name) return res.status(400).json({ error: '请填写宠物名' });
    const result = await client.query(
      `INSERT INTO pets (name, icon, rarity, base_bonus, price_amount, price_type, is_shop, purchasable, bonus_curve, growth_curve, is_test, effect_file) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, icon||'🐾', rarity||'C', base_bonus||5, price_amount||100, price_type||'silver_coin', is_shop!==false, purchasable!==false, bonus_curve?JSON.stringify(bonus_curve):null, growth_curve?JSON.stringify(growth_curve):null, is_test||false, effect_file||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Create pet error', { error: error.message });
    res.status(500).json({ error: '创建宠物失败' });
  }
});

// PUT /api/admin/pets/:id — 更新宠物
router.put('/api/admin/pets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, rarity, base_bonus, price_amount, price_type, is_shop, purchasable, bonus_curve, growth_curve, is_test, effect_file } = req.body;
    const existing = await client.query('SELECT * FROM pets WHERE id = $1', [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const e = existing.rows[0];
    const result = await client.query(
      `UPDATE pets SET name=$1, icon=$2, rarity=$3, base_bonus=$4, price_amount=$5, price_type=$6, is_shop=$7, purchasable=$8, bonus_curve=$9, growth_curve=$10, is_test=$11, effect_file=$12 WHERE id=$13 RETURNING *`,
      [name||e.name, icon||e.icon, rarity||e.rarity, base_bonus!==undefined?base_bonus:e.base_bonus, price_amount!==undefined?price_amount:e.price_amount, price_type||e.price_type, is_shop!==undefined?is_shop:e.is_shop, purchasable!==undefined?purchasable:(e.purchasable!==false), JSON.stringify(bonus_curve||e.bonus_curve), JSON.stringify(growth_curve||e.growth_curve), is_test!==undefined?is_test:e.is_test, effect_file!==undefined?effect_file:e.effect_file, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update pet error', { error: error.message });
    res.status(500).json({ error: '更新宠物失败' });
  }
});

// DELETE /api/admin/pets/:id — 删除宠物
router.delete('/api/admin/pets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('DELETE FROM pets WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    res.json({ message: '宠物删除成功' });
  } catch (error) {
    logger.error('Delete pet error', { error: error.message });
    res.status(500).json({ error: '删除宠物失败' });
  }
});

// GET /api/admin/pets/:id/curve — 获取宠物曲线
router.get('/api/admin/pets/:id/curve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT id, name, bonus_curve, growth_curve, base_bonus FROM pets WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get pet curve error:', { error: error.message });
    res.status(500).json({ error: '获取宠物曲线失败' });
  }
});

// PUT /api/admin/pets/:id/curve — 更新宠物曲线
router.put('/api/admin/pets/:id/curve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { bonus_curve, growth_curve } = req.body;
    const existing = await client.query('SELECT id FROM pets WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const updates = [];
    const params = [];
    let idx = 1;
    if (bonus_curve) { updates.push(`bonus_curve = $${idx++}`); params.push(JSON.stringify(bonus_curve)); }
    if (growth_curve) { updates.push(`growth_curve = $${idx++}`); params.push(JSON.stringify(growth_curve)); }
    if (updates.length === 0) return res.status(400).json({ error: '请提供要更新的曲线' });
    params.push(req.params.id);
    await client.query(`UPDATE pets SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    res.json({ message: '宠物曲线更新成功' });
  } catch (error) {
    logger.error('Update pet curve error:', { error: error.message });
    res.status(500).json({ error: '更新宠物曲线失败' });
  }
});

module.exports = router;

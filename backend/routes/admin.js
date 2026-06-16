// backend/routes/admin.js
const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { client, logger, generateUserId, clearConfigCache, MAX_POINTS } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware');
const router = express.Router();

// 管理员用户管理
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '请填写所有必填字段' });
    const existing = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) return res.status(400).json({ error: '该邮箱已被注册' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const nextId = await generateUserId('admin');
    await client.query('BEGIN');
    try {
      await client.query('INSERT INTO users (id, name, email, password, role, is_new_user) VALUES ($1,$2,$3,$4,$5,$6)', [nextId, name || email.split('@')[0], email, hashedPassword, 'admin', false]);
      await client.query('INSERT INTO currencies (user_id, silver_coin, gold_coin, diamond) VALUES ($1,$2,$3,$4)', [nextId, 0, 0, 0]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    res.status(201).json({ message: '管理员用户创建成功', userId: nextId });
  } catch (error) { res.status(500).json({ error: '创建管理员用户失败' }); }
});

// 物品管理
router.post('/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd, stage_skip, purchasable } = req.body;
    if (!name || !item_type) return res.status(400).json({ error: '请填写物品名和类型' });
    const result = await client.query('INSERT INTO items (name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd, stage_skip, purchasable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *', [name, icon||'', rarity||'C', item_type, base_yield||0, buy_price||0, sell_price||0, currency_type||'silver_coin', is_shop!==false, crop_id||null, water_cd||5, stage_skip||1, purchasable!==false]);
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: '创建物品失败' }); }
});

router.put('/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params; const { name, icon, rarity, item_type, base_yield, buy_price, sell_price, currency_type, is_shop, crop_id, water_cd, stage_skip, purchasable } = req.body;
    const existing = await client.query('SELECT * FROM items WHERE id = $1', [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    const e = existing.rows[0];
    const result = await client.query('UPDATE items SET name=$1, icon=$2, rarity=$3, item_type=$4, base_yield=$5, buy_price=$6, sell_price=$7, currency_type=$8, is_shop=$9, crop_id=$10, water_cd=$11, stage_skip=$12, purchasable=$13 WHERE id=$14 RETURNING *', [name||e.name, icon!==undefined?icon:e.icon, rarity||e.rarity, item_type||e.item_type, base_yield!==undefined?base_yield:e.base_yield, buy_price!==undefined?buy_price:e.buy_price, sell_price!==undefined?sell_price:e.sell_price, currency_type||e.currency_type, is_shop!==undefined?is_shop:e.is_shop, crop_id!==undefined?crop_id:e.crop_id, water_cd||e.water_cd||5, stage_skip!==undefined?stage_skip:(e.stage_skip||1), purchasable!==undefined?purchasable:(e.purchasable!==false), id]);
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: '更新物品失败' }); }
});

router.delete('/items/:id', authenticateToken, requireAdmin, async (req, res) => {
  try { const result = await client.query('DELETE FROM items WHERE id = $1 RETURNING *', [req.params.id]); if (result.rowCount === 0) return res.status(404).json({ error: '物品不存在' }); res.json({ message: '物品删除成功' }); } catch (error) { res.status(500).json({ error: '删除物品失败' }); }
});

// 宠物管理
router.get('/pets/all', authenticateToken, requireAdmin, async (req, res) => { try { res.json((await client.query('SELECT * FROM pets ORDER BY rarity, id')).rows); } catch (error) { res.status(500).json({ error: '获取宠物列表失败' }); } });

router.post('/pets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, icon, rarity, base_bonus, price_amount, price_type, is_shop, bonus_curve, growth_curve, is_test, effect_file } = req.body;
    if (!name) return res.status(400).json({ error: '请填写宠物名' });
    const result = await client.query('INSERT INTO pets (name, icon, rarity, base_bonus, price_amount, price_type, is_shop, bonus_curve, growth_curve, is_test, effect_file) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [name, icon||'🐾', rarity||'C', base_bonus||5, price_amount||100, price_type||'silver_coin', is_shop!==false, bonus_curve?JSON.stringify(bonus_curve):null, growth_curve?JSON.stringify(growth_curve):null, is_test||false, effect_file||null]);
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: '创建宠物失败' }); }
});

router.put('/pets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params; const { name, icon, rarity, base_bonus, price_amount, price_type, is_shop, bonus_curve, growth_curve, is_test, effect_file } = req.body;
    const existing = await client.query('SELECT * FROM pets WHERE id = $1', [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const e = existing.rows[0];
    const result = await client.query('UPDATE pets SET name=$1, icon=$2, rarity=$3, base_bonus=$4, price_amount=$5, price_type=$6, is_shop=$7, bonus_curve=$8, growth_curve=$9, is_test=$10, effect_file=$11 WHERE id=$12 RETURNING *', [name||e.name, icon||e.icon, rarity||e.rarity, base_bonus||e.base_bonus, price_amount||e.price_amount, price_type||e.price_type, is_shop!==undefined?is_shop:e.is_shop, bonus_curve?JSON.stringify(bonus_curve):e.bonus_curve, growth_curve?JSON.stringify(growth_curve):e.growth_curve, is_test!==undefined?is_test:e.is_test, effect_file!==undefined?effect_file:e.effect_file, id]);
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: '更新宠物失败' }); }
});

router.delete('/pets/:id', authenticateToken, requireAdmin, async (req, res) => { try { const result = await client.query('DELETE FROM pets WHERE id = $1 RETURNING *', [req.params.id]); if (result.rowCount === 0) return res.status(404).json({ error: '宠物不存在' }); res.json({ message: '宠物删除成功' }); } catch (error) { res.status(500).json({ error: '删除宠物失败' }); } });

// 统计
router.get('/active-users', authenticateToken, requireAdmin, async (req, res) => { try { const today = new Date(); today.setHours(0,0,0,0); const result = await client.query('SELECT COUNT(*) as count FROM users WHERE last_login_at >= $1 AND role = $2', [today, 'user']); res.json({ count: parseInt(result.rows[0].count) }); } catch (error) { res.status(500).json({ error: '获取活跃用户数失败' }); } });

router.get('/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; const limit = parseInt(req.query.limit) || 10; const offset = (page - 1) * limit;
    const ordersResult = await client.query('SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const totalResult = await client.query('SELECT COUNT(*) as total FROM orders');
    res.json({ orders: ordersResult.rows.map(o => ({ id: o.id, user_id: o.user_id, type: o.type, currency_type: o.currency_type, amount: Number(o.amount), created_at: o.created_at?.toISOString(), user: { id: o.user_id, name: o.user_name, email: o.user_email } })), pagination: { page, limit, total: parseInt(totalResult.rows[0].total), totalPages: Math.ceil(parseInt(totalResult.rows[0].total) / limit) } });
  } catch (error) { res.status(500).json({ error: '获取订单列表失败' }); }
});

router.delete('/orders/:id', authenticateToken, requireAdmin, async (req, res) => { try { const result = await client.query('DELETE FROM orders WHERE id = $1 RETURNING *', [req.params.id]); if (result.rowCount === 0) return res.status(404).json({ error: '订单不存在' }); res.json({ message: '订单删除成功' }); } catch (error) { res.status(500).json({ error: '删除订单失败' }); } });

router.put('/users/:id/currencies', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params; const { silver_coin, gold_coin, diamond } = req.body;
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const updates = []; const params = []; let idx = 1;
    if (silver_coin !== undefined) { updates.push(`silver_coin = $${idx++}`); params.push(silver_coin); }
    if (gold_coin !== undefined) { updates.push(`gold_coin = $${idx++}`); params.push(gold_coin); }
    if (diamond !== undefined) { updates.push(`diamond = $${idx++}`); params.push(diamond); }
    if (updates.length === 0) return res.status(400).json({ error: '请提供要修改的货币字段' });
    updates.push('updated_at = CURRENT_TIMESTAMP'); params.push(id);
    const result = await client.query(`UPDATE currencies SET ${updates.join(', ')} WHERE user_id = $${idx} RETURNING *`, params);
    res.json({ message: '货币更新成功', currencies: { silver_coin: Number(result.rows[0].silver_coin), gold_coin: Number(result.rows[0].gold_coin), diamond: Number(result.rows[0].diamond) } });
  } catch (error) { res.status(500).json({ error: '更新用户货币失败' }); }
});

router.put('/users/:id/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params; const { item_id, quantity } = req.body;
    if (!item_id || quantity === undefined) return res.status(400).json({ error: '请提供 item_id 和 quantity' });
    if (quantity === 0) await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [id, item_id]);
    else await client.query('INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1,$2,$3) ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = $3, updated_at = CURRENT_TIMESTAMP', [id, item_id, quantity]);
    res.json({ message: '背包物品更新成功' });
  } catch (error) { res.status(500).json({ error: '更新用户背包物品失败' }); }
});

// 全局配置
router.get('/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT key, value, description, updated_at FROM global_config ORDER BY key');
    const config = {};
    for (const row of result.rows) config[row.key] = { value: row.value, description: row.description, updated_at: row.updated_at };
    res.json(config);
  } catch (error) { res.status(500).json({ error: '获取配置失败' }); }
});

router.put('/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') return res.status(400).json({ error: '请提供配置键值对' });
    await client.query('BEGIN');
    try {
      for (const [key, value] of Object.entries(updates)) {
        await client.query('INSERT INTO global_config (key, value, updated_at) VALUES ($1,$2,CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [key, JSON.stringify(value)]);
      }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    clearConfigCache();
    res.json({ message: '配置更新成功' });
  } catch (error) { res.status(500).json({ error: '更新配置失败' }); }
});

// 宠物曲线
router.get('/pets/:id/curve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT id, name, bonus_curve, growth_curve, base_bonus FROM pets WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: '获取宠物曲线失败' }); }
});

router.put('/pets/:id/curve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { bonus_curve, growth_curve } = req.body;
    const existing = await client.query('SELECT id FROM pets WHERE id = $1', [req.params.id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const updates = []; const params = []; let idx = 1;
    if (bonus_curve) { updates.push(`bonus_curve = $${idx++}`); params.push(JSON.stringify(bonus_curve)); }
    if (growth_curve) { updates.push(`growth_curve = $${idx++}`); params.push(JSON.stringify(growth_curve)); }
    if (updates.length === 0) return res.status(400).json({ error: '请提供要更新的曲线' });
    params.push(req.params.id);
    await client.query(`UPDATE pets SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    res.json({ message: '宠物曲线更新成功' });
  } catch (error) { res.status(500).json({ error: '更新宠物曲线失败' }); }
});

// 统计仪表
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await client.query(`SELECT COUNT(*) as count FROM users WHERE role = 'user'`);
    const totalOrders = await client.query('SELECT COUNT(*) as count FROM orders');
    const today = new Date(); today.setHours(0,0,0,0);
    const activeToday = await client.query(`SELECT COUNT(*) as count FROM users WHERE last_login_at >= $1 AND role = 'user'`, [today]);
    const totalPets = await client.query('SELECT COUNT(*) as count FROM user_pets');
    const totalItems = await client.query('SELECT COUNT(*) as count FROM items');
    res.json({ total_users: parseInt(totalUsers.rows[0].count), total_orders: parseInt(totalOrders.rows[0].count), active_today: parseInt(activeToday.rows[0].count), total_pets: parseInt(totalPets.rows[0].count), total_items: parseInt(totalItems.rows[0].count) });
  } catch (error) { res.status(500).json({ error: '获取统计数据失败' }); }
});

// 特效文件上传
const effectsDir = path.join(__dirname, '..', 'effects');
if (!fs.existsSync(effectsDir)) fs.mkdirSync(effectsDir, { recursive: true });
const storage = multer.diskStorage({ destination: (req, file, cb) => cb(null, effectsDir), filename: (req, file, cb) => { const name = file.originalname.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'); cb(null, name.endsWith('.js') ? name : name + '.js'); } });
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 } });

router.post('/effects/upload', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    const filePath = req.file.path;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.includes('name') || !content.includes('init')) { fs.unlinkSync(filePath); return res.status(400).json({ error: '特效文件必须导出 { name, init }' }); }
    } catch (e) { fs.unlinkSync(filePath); return res.status(400).json({ error: '文件校验失败' }); }
    res.json({ message: '上传成功', filename: req.file.filename });
  } catch (error) { res.status(500).json({ error: '上传失败' }); }
});

router.get('/effects', authenticateToken, requireAdmin, async (req, res) => {
  try { const files = fs.existsSync(effectsDir) ? fs.readdirSync(effectsDir).filter(f => f.endsWith('.js')) : []; res.json({ effects: files }); } catch (error) { res.status(500).json({ error: '获取特效列表失败' }); }
});

// 特效文件前端加载
router.get('/effects/:filename', (req, res) => {
  try {
    const filename = req.params.filename.replace(/[^a-z0-9-\\.]/g, '-');
    const filePath = path.join(effectsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '特效文件不存在' });
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(filePath);
  } catch (error) { res.status(500).json({ error: '获取特效文件失败' }); }
});

module.exports = router;

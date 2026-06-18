// backend/routes/shop.js
const express = require('express');
const { client, logger, deductCurrency, addCurrency, createOrder, getConfig } = require('../db');
const { authenticateToken } = require('../middleware');
const router = express.Router();

const SHOP_TAB_MAP = { seeds: 'seed', fertilizers: 'fertilizer', pets: 'pet', pet_food: 'pet_food', decorations: 'decoration' };

router.get('/shop', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tab = req.query.tab;
    if (!tab || !SHOP_TAB_MAP[tab]) return res.status(400).json({ error: '无效的 tab 参数' });
    const ownedDecResult = await client.query('SELECT decoration_id FROM user_decorations WHERE user_id = $1 AND quantity > 0', [userId]);
    const ownedDecIds = ownedDecResult.rows.map(r => r.decoration_id);
    if (tab === 'pets') {
      const result = await client.query('SELECT id, name, icon, rarity, base_bonus, price_type, price_amount, is_test, purchasable FROM pets WHERE is_shop = true ORDER BY rarity, id');
      return res.json(result.rows.map(r => ({ id: r.id, name: r.name, icon: r.icon, rarity: r.rarity, item_type: 'pet', buy_price: Number(r.price_amount), sell_price: 0, currency_type: r.price_type, base_yield: Number(r.base_bonus), purchasable: r.purchasable !== false, sold_out: r.purchasable === false ? '售罄' : false, is_test: r.is_test || false })));
    }
    if (tab === 'decorations') {
      const result = await client.query(`SELECT d.id, d.name, d.icon, d.slot_type, d.quality, d.bonus, d.price_type, d.price_amount, d.pet_id, p.name as pet_name FROM decorations d LEFT JOIN pets p ON d.pet_id = p.id ORDER BY d.quality DESC, d.id`);
      return res.json(result.rows.map(r => ({ id: r.id, name: r.name, icon: r.icon, rarity: r.quality, item_type: 'decoration', buy_price: Number(r.price_amount), sell_price: 0, currency_type: r.price_type, bonus: Number(r.bonus), slot_type: r.slot_type, pet_id: r.pet_id, pet_name: r.pet_name || null, purchasable: true, sold_out: ownedDecIds.includes(r.id) ? '已拥有' : false })));
    }
    const itemType = SHOP_TAB_MAP[tab];
    const result = await client.query('SELECT id, name, icon, rarity, item_type, buy_price, sell_price, currency_type, base_yield, water_cd, purchasable FROM items WHERE item_type = $1 AND is_shop = true ORDER BY rarity, id', [itemType]);
    res.json(result.rows.map(r => ({ id: r.id, name: r.name, icon: r.icon, rarity: r.rarity, item_type: r.item_type, buy_price: r.buy_price, sell_price: r.sell_price, currency_type: r.currency_type, base_yield: r.base_yield, water_cd: r.water_cd || 5, purchasable: r.purchasable !== false, sold_out: r.purchasable === false ? '售罄' : false })));
  } catch (error) { logger.error('Get shop items error:', { error: error.message }); res.status(500).json({ error: '获取商店物品失败' }); }
});

router.post('/user/shop/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { item_id, quantity } = req.body;
    if (!item_id || !quantity || quantity <= 0 || !Number.isInteger(quantity)) return res.status(400).json({ error: '请提供有效的参数' });
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1 AND is_shop = true', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在或不在商店出售' });
    const item = itemResult.rows[0];
    if (item.purchasable === false) return res.status(400).json({ error: '该物品不可购买' });
    const totalCost = Number(item.buy_price) * quantity;
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, item.currency_type, totalCost);
      await client.query('INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1,$2,$3) ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + $3, updated_at = CURRENT_TIMESTAMP', [userId, item_id, quantity]);
      await createOrder(userId, 'SHOP_PURCHASE', item.currency_type, totalCost);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' }); throw err; }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '购买成功', item: { id: item.id, name: item.name, icon: item.icon, rarity: item.rarity }, quantity, total_cost: totalCost, currency_type: item.currency_type, currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) { logger.error('Purchase error:', { error: error.message }); res.status(500).json({ error: '购买失败' }); }
});

router.post('/user/shop/sell', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { item_id, quantity } = req.body;
    if (!item_id || !quantity || quantity <= 0) return res.status(400).json({ error: '请提供有效的参数' });
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    const item = itemResult.rows[0];
    const userItemResult = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    if (userItemResult.rowCount === 0 || userItemResult.rows[0].quantity < quantity) return res.status(400).json({ error: '物品数量不足' });
    const totalRevenue = Number(item.sell_price) * quantity;
    const currentQty = userItemResult.rows[0].quantity;
    await client.query('BEGIN');
    try {
      await addCurrency(userId, item.currency_type, totalRevenue);
      const newQty = currentQty - quantity;
      if (newQty <= 0) await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
      else await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, item_id]);
      await createOrder(userId, 'SHOP_SELL', item.currency_type, totalRevenue);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '出售成功', item: { id: item.id, name: item.name, icon: item.icon, rarity: item.rarity }, quantity, total_revenue: totalRevenue, remaining_quantity: currentQty - quantity > 0 ? currentQty - quantity : 0, currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) { logger.error('Sell error:', { error: error.message }); res.status(500).json({ error: '出售失败' }); }
});

router.post('/user/decorations/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { decoration_id } = req.body;
    if (!decoration_id) return res.status(400).json({ error: '请提供 decoration_id' });
    const decResult = await client.query('SELECT * FROM decorations WHERE id = $1', [decoration_id]);
    if (decResult.rowCount === 0) return res.status(404).json({ error: '装饰不存在' });
    const dec = decResult.rows[0];
    const existingDec = await client.query('SELECT quantity FROM user_decorations WHERE user_id = $1 AND decoration_id = $2', [userId, decoration_id]);
    if (existingDec.rowCount > 0) return res.status(400).json({ error: '该装饰已拥有' });
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, dec.price_type, Number(dec.price_amount));
      await client.query('INSERT INTO user_decorations (user_id, decoration_id, quantity) VALUES ($1,$2,1)', [userId, decoration_id]);
      await createOrder(userId, 'DECORATION_PURCHASE', dec.price_type, Number(dec.price_amount));
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' }); throw err; }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '购买成功', decoration: { id: dec.id, name: dec.name, icon: dec.icon }, currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) { logger.error('Purchase decoration error:', { error: error.message }); res.status(500).json({ error: '购买装饰失败' }); }
});

router.get('/decorations', authenticateToken, async (req, res) => {
  try {
    const slotType = req.query.slot_type;
    let query = `SELECT d.id, d.name, d.icon, d.slot_type, d.quality, d.bonus, d.price_type, d.price_amount, d.pet_id, p.name as pet_name FROM decorations d LEFT JOIN pets p ON d.pet_id = p.id`;
    const params = [];
    if (slotType) { query += ' WHERE d.slot_type = $1'; params.push(slotType); }
    query += ' ORDER BY d.quality DESC, d.id';
    res.json((await client.query(query, params)).rows.map(d => ({ id: d.id, name: d.name, icon: d.icon, slot_type: d.slot_type, quality: d.quality, bonus: Number(d.bonus), price_type: d.price_type, price_amount: Number(d.price_amount), pet_id: d.pet_id, pet_name: d.pet_name || null })));
  } catch (error) { res.status(500).json({ error: '获取装饰列表失败' }); }
});

router.get('/user/decorations', authenticateToken, async (req, res) => {
  try {
    const result = await client.query(`SELECT ud.quantity, d.id, d.name, d.icon, d.slot_type, d.quality, d.bonus, d.price_type, d.price_amount, d.pet_id, p.name as pet_name FROM user_decorations ud JOIN decorations d ON ud.decoration_id = d.id LEFT JOIN pets p ON d.pet_id = p.id WHERE ud.user_id = $1 AND ud.quantity > 0 ORDER BY d.slot_type, d.quality DESC`, [req.user.id]);
    res.json(result.rows.map(d => ({ decoration_id: d.id, quantity: d.quantity, name: d.name, icon: d.icon, slot_type: d.slot_type, quality: d.quality, bonus: Number(d.bonus), price_type: d.price_type, price_amount: Number(d.price_amount), pet_id: d.pet_id, pet_name: d.pet_name || null })));
  } catch (error) { res.status(500).json({ error: '获取用户装饰列表失败' }); }
});

module.exports = router;

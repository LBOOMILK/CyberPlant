const express = require('express');
const router = express.Router();
const { client, logger, getConfig, deductCurrency, addCurrency, createOrder, SHOP_TAB_MAP } = require('../../db');
const { authenticateToken } = require('../../middleware');

// 新手礼包
router.post('/api/user/newbie-pack', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await client.query('SELECT is_new_user FROM users WHERE id = $1', [userId]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    if (!userResult.rows[0].is_new_user) return res.status(400).json({ error: '新手礼包已领取' });
    await client.query('BEGIN');
    try {
      // 种子已在注册时发放，新手礼包不再重复
      await client.query('UPDATE users SET is_new_user = false WHERE id = $1', [userId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    const currenciesResult = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({
      message: '新手礼包领取成功',
      currencies: { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
    });
  } catch (error) {
    logger.error('Newbie pack error', { error: error.message });
    res.status(500).json({ error: '领取新手礼包失败' });
  }
});

// 货币余额
router.get('/api/user/currencies', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '货币记录不存在' });
    res.json({ silver_coin: Number(result.rows[0].silver_coin), gold_coin: Number(result.rows[0].gold_coin), diamond: Number(result.rows[0].diamond) });
  } catch (error) {
    logger.error('Get currencies error', { error: error.message });
    res.status(500).json({ error: '获取货币余额失败' });
  }
});

// 货币兑换
router.post('/api/user/currencies/exchange', authenticateToken, async (req, res) => {
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
    if (from === 'silver_coin' && to === 'gold_coin') {
      receiveAmount = Math.floor(amount / silverToGold);
    } else if (from === 'gold_coin' && to === 'silver_coin') {
      receiveAmount = amount * goldToSilver;
    } else {
      return res.status(400).json({ error: '不支持的兑换方向' });
    }
    if (receiveAmount <= 0) return res.status(400).json({ error: '兑换数量过小' });

    await client.query('BEGIN');
    try {
      await deductCurrency(userId, from, amount);
      await addCurrency(userId, to, receiveAmount);
      await createOrder(userId, 'EXCHANGE', from, -amount);
      await createOrder(userId, 'EXCHANGE', to, receiveAmount);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    const result = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '兑换成功', exchanged: { from, to, spent: amount, received: receiveAmount }, currencies: { silver_coin: Number(result.rows[0].silver_coin), gold_coin: Number(result.rows[0].gold_coin), diamond: Number(result.rows[0].diamond) } });
  } catch (error) {
    if (error.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
    logger.error('Exchange error', { error: error.message });
    res.status(500).json({ error: '兑换失败' });
  }
});

// 用户信息
router.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT id, name, email, role, is_new_user, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const user = result.rows[0];
    const currenciesResult = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [req.user.id]);
    const currencies = currenciesResult.rowCount > 0
      ? { silver_coin: Number(currenciesResult.rows[0].silver_coin), gold_coin: Number(currenciesResult.rows[0].gold_coin), diamond: Number(currenciesResult.rows[0].diamond) }
      : { silver_coin: 0, gold_coin: 0, diamond: 0 };
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, currencies, created_at: user.created_at.toISOString().split('T')[0] });
  } catch (error) {
    logger.error('Get user error', { error: error.message });
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

router.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '请填写用户名' });
    const updatedUser = await client.query('UPDATE users SET name = $1 WHERE id = $2 RETURNING *', [name, req.user.id]);
    if (updatedUser.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const user = updatedUser.rows[0];
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, is_new_user: user.is_new_user, created_at: user.created_at.toISOString().split('T')[0] });
  } catch (error) {
    logger.error('Update user error', { error: error.message });
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

router.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim().length === 0) return res.status(400).json({ error: '请提供搜索关键词' });
    const result = await client.query('SELECT id, name FROM users WHERE id != $1 AND role != $2 AND (name ILIKE $3 OR id::text ILIKE $3) LIMIT 20', [req.user.id, 'admin', `%${q.trim()}%`]);
    res.json(result.rows.map(r => ({ id: r.id, name: r.name })));
  } catch (error) {
    logger.error('Search users error:', { error: error.message });
    res.status(500).json({ error: '搜索用户失败' });
  }
});

// 背包
router.get('/api/user/items', authenticateToken, async (req, res) => {
  try {
    const result = await client.query(
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd
       FROM user_items ui JOIN items i ON ui.item_id = i.id WHERE ui.user_id = $1 AND ui.quantity > 0 ORDER BY i.item_type, i.rarity, i.id`,
      [req.user.id]
    );
    res.json(result.rows.map(r => ({ item_id: r.item_id, quantity: r.quantity, name: r.name, icon: r.icon, rarity: r.rarity, item_type: r.item_type, base_yield: r.base_yield, buy_price: r.buy_price, sell_price: r.sell_price, currency_type: r.currency_type, water_cd: r.water_cd || 5, grow_time: (r.water_cd || 5) * 5 })));
  } catch (error) {
    logger.error('Get user items error', { error: error.message });
    res.status(500).json({ error: '获取背包物品失败' });
  }
});

router.get('/api/user/backpack', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT ui.item_id, ui.quantity, i.name, i.icon, i.rarity, i.item_type, i.base_yield, i.buy_price, i.sell_price, i.currency_type, i.water_cd
       FROM user_items ui JOIN items i ON ui.item_id = i.id WHERE ui.user_id = $1 AND ui.quantity > 0 ORDER BY i.item_type, i.rarity, i.id`,
      [userId]
    );
    const grouped = { seed: [], fertilizer: [], crop: [], pet_food: [], decoration: [] };
    for (const row of result.rows) {
      const type = row.item_type;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({ item_id: row.item_id, quantity: row.quantity, name: row.name, icon: row.icon, rarity: row.rarity, item_type: row.item_type, base_yield: row.base_yield, buy_price: Number(row.buy_price), sell_price: Number(row.sell_price), currency_type: row.currency_type, water_cd: row.water_cd || 5, grow_time: (row.water_cd || 5) * 5 });
    }
    const decorationsResult = await client.query(
      `SELECT ud.decoration_id, ud.quantity, d.name, d.icon, d.quality, d.slot_type, d.bonus
       FROM user_decorations ud JOIN decorations d ON ud.decoration_id = d.id WHERE ud.user_id = $1 AND ud.quantity > 0 ORDER BY d.quality, d.id`,
      [userId]
    );
    for (const row of decorationsResult.rows) {
      grouped.decoration.push({ item_id: row.decoration_id, quantity: row.quantity, name: row.name, icon: row.icon, rarity: row.quality, item_type: 'decoration', slot_type: row.slot_type, bonus: Number(row.bonus) });
    }
    res.json({ groups: grouped });
  } catch (error) {
    logger.error('Get backpack error:', { error: error.message });
    res.status(500).json({ error: '获取背包物品失败' });
  }
});

// 商店
router.get('/api/shop', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tab = req.query.tab;
    if (!tab || !SHOP_TAB_MAP[tab]) return res.status(400).json({ error: '无效的 tab 参数' });

    const ownedDecResult = await client.query('SELECT decoration_id FROM user_decorations WHERE user_id = $1 AND quantity > 0', [userId]);
    const ownedDecIds = ownedDecResult.rows.map(r => r.decoration_id);

    const ownedPetResult = await client.query('SELECT pet_id FROM user_pets WHERE user_id = $1', [userId]);
    const ownedPetIds = ownedPetResult.rows.map(r => r.pet_id);

    if (tab === 'pets') {
      const result = await client.query('SELECT id, name, icon, rarity, base_bonus, price_type, price_amount, is_test, purchasable FROM pets ORDER BY is_test, rarity, id');
      return res.json(result.rows.map(r => {
        const isPurchasable = r.purchasable !== false;
        const isOwned = ownedPetIds.includes(r.id);
        return {
          id: r.id, name: r.name, icon: r.icon, rarity: r.rarity, item_type: 'pet',
          buy_price: Number(r.price_amount), sell_price: 0, currency_type: r.price_type, base_yield: Number(r.base_bonus),
          is_test: r.is_test, purchasable: isPurchasable,
          sold_out: !isPurchasable ? '售罄' : (isOwned ? '已拥有' : false)
        };
      }));
    }

    if (tab === 'decorations') {
      const result = await client.query('SELECT d.id, d.name, d.icon, d.slot_type, d.quality, d.bonus, d.price_type, d.price_amount, d.pet_id, p.name as pet_name FROM decorations d LEFT JOIN pets p ON d.pet_id = p.id ORDER BY d.quality DESC, d.id');
      return res.json(result.rows.map(r => ({
        id: r.id, name: r.name, icon: r.icon, rarity: r.quality, item_type: 'decoration',
        buy_price: Number(r.price_amount), sell_price: 0, currency_type: r.price_type,
        bonus: Number(r.bonus) || 0, slot_type: r.slot_type, pet_id: r.pet_id, pet_name: r.pet_name,
        purchasable: true, sold_out: ownedDecIds.includes(r.id) ? '已拥有' : false
      })));
    }

    const itemType = SHOP_TAB_MAP[tab];
    const result = await client.query(
      'SELECT id, name, icon, rarity, item_type, buy_price, sell_price, currency_type, base_yield, water_cd, purchasable, is_shop, stage_skip FROM items WHERE item_type = $1 AND (is_shop = true OR purchasable = false) ORDER BY rarity, id',
      [itemType]
    );
    res.json(result.rows.map(r => ({
      id: r.id, name: r.name, icon: r.icon, rarity: r.rarity, item_type: r.item_type,
      buy_price: r.buy_price, sell_price: r.sell_price, currency_type: r.currency_type,
      base_yield: r.base_yield, water_cd: r.water_cd || 5, grow_time: (r.water_cd || 5) * 5, stage_skip: r.stage_skip || 1,
      purchasable: r.purchasable !== false,
      sold_out: (r.purchasable === false || r.is_shop === false) ? '售罄' : false
    })));
  } catch (error) {
    logger.error('Get shop items error:', { error: error.message });
    res.status(500).json({ error: '获取商店物品失败' });
  }
});

// 购买物品
router.post('/api/user/shop/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { item_id, quantity } = req.body;
    if (!item_id || !quantity || quantity <= 0 || !Number.isInteger(quantity)) return res.status(400).json({ error: '请提供有效的 item_id 和 quantity' });

    const itemResult = await client.query('SELECT * FROM items WHERE id = $1 AND is_shop = true', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在或不在商店出售' });
    const item = itemResult.rows[0];
    if (item.purchasable === false) return res.status(400).json({ error: '该物品不可购买' });
    const totalCost = Number(item.buy_price) * quantity;
    const currencyType = item.currency_type;

    await client.query('BEGIN');
    try {
      await deductCurrency(userId, currencyType, totalCost);
      await client.query(
        `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, item_id, quantity]
      );
      await createOrder(userId, 'SHOP_PURCHASE', currencyType, -totalCost);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    const userItem = await client.query('SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    res.json({
      message: '购买成功',
      item: { id: item.id, name: item.name, icon: item.icon, rarity: item.rarity },
      quantity, total_cost: totalCost, currency_type: currencyType,
      remaining_quantity: userItem.rowCount > 0 ? userItem.rows[0].quantity : 0,
      currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) }
    });
  } catch (error) {
    logger.error('Purchase error:', { error: error.message });
    res.status(500).json({ error: '购买失败' });
  }
});

// 购买宠物
router.post('/api/user/pets/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { pet_id } = req.body;
    if (!pet_id) return res.status(400).json({ error: '请提供 pet_id' });
    const petTemplate = await client.query('SELECT * FROM pets WHERE id = $1', [pet_id]);
    if (petTemplate.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petTemplate.rows[0];
    if (pet.purchasable === false) return res.status(400).json({ error: '该宠物不可购买' });
    const existingPet = await client.query('SELECT * FROM user_pets WHERE user_id = $1 AND pet_id = $2', [userId, pet_id]);
    if (existingPet.rowCount > 0) return res.status(400).json({ error: '您已拥有该宠物' });

    await client.query('BEGIN');
    try {
      await deductCurrency(userId, pet.price_type, Number(pet.price_amount));
      const newUserPet = await client.query(
        `INSERT INTO user_pets (user_id, pet_id, level, growth_points, hunger, is_active, last_fed_at) VALUES ($1, $2, 1, 0, 20, false, CURRENT_TIMESTAMP) RETURNING *`,
        [userId, pet_id]
      );
      await createOrder(userId, 'PET_PURCHASE', pet.price_type, -Number(pet.price_amount));
      await client.query('COMMIT');
      const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
      const { formatPetData } = require('../../db');
      res.status(201).json({
        message: '购买成功',
        pet: await formatPetData(newUserPet.rows[0], pet),
        currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
  } catch (error) {
    logger.error('Purchase pet error:', { error: error.message });
    res.status(500).json({ error: '购买宠物失败' });
  }
});

// 出售物品
router.post('/api/user/shop/sell', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { item_id, quantity } = req.body;
    if (!item_id || !quantity || quantity <= 0 || !Number.isInteger(quantity)) return res.status(400).json({ error: '请提供有效的 item_id 和 quantity' });
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    const item = itemResult.rows[0];
    const userItemResult = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    if (userItemResult.rowCount === 0 || userItemResult.rows[0].quantity < quantity) return res.status(400).json({ error: '物品数量不足' });
    const totalRevenue = Number(item.sell_price) * quantity;
    const currencyType = item.currency_type;
    const currentQty = userItemResult.rows[0].quantity;
    await client.query('BEGIN');
    try {
      await addCurrency(userId, currencyType, totalRevenue);
      const newQty = currentQty - quantity;
      if (newQty <= 0) {
        await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
      } else {
        await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, item_id]);
      }
      await createOrder(userId, 'SHOP_SELL', currencyType, totalRevenue);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({
      message: '出售成功',
      item: { id: item.id, name: item.name, icon: item.icon, rarity: item.rarity },
      quantity, total_revenue: totalRevenue, currency_type: currencyType,
      remaining_quantity: currentQty - quantity > 0 ? currentQty - quantity : 0,
      currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) }
    });
  } catch (error) {
    logger.error('Sell error:', { error: error.message });
    res.status(500).json({ error: '出售失败' });
  }
});

// 购买装饰
router.post('/api/user/decorations/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { decoration_id } = req.body;
    if (!decoration_id) return res.status(400).json({ error: '请提供 decoration_id' });
    const decResult = await client.query('SELECT * FROM decorations WHERE id = $1', [decoration_id]);
    if (decResult.rowCount === 0) return res.status(404).json({ error: '装饰不存在' });
    const dec = decResult.rows[0];
    const existingDec = await client.query('SELECT quantity FROM user_decorations WHERE user_id = $1 AND decoration_id = $2', [userId, decoration_id]);
    if (existingDec.rowCount > 0) return res.status(400).json({ error: '该装饰已拥有，无法重复购买' });
    const totalCost = Number(dec.price_amount);
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, dec.price_type, totalCost);
      await client.query('INSERT INTO user_decorations (user_id, decoration_id, quantity) VALUES ($1, $2, 1)', [userId, decoration_id]);
      await createOrder(userId, 'DECORATION_PURCHASE', dec.price_type, -totalCost);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({
      message: '购买成功',
      decoration: { id: dec.id, name: dec.name, icon: dec.icon, slot_type: dec.slot_type, quality: dec.quality, bonus: Number(dec.bonus) },
      total_cost: totalCost, currency_type: dec.price_type,
      currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) }
    });
  } catch (error) {
    logger.error('Purchase decoration error:', { error: error.message });
    res.status(500).json({ error: '购买装饰失败' });
  }
});

module.exports = router;

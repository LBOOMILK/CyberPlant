// backend/routes/friends.js
const express = require('express');
const { client, logger, deductCurrency, addCurrency, getConfig } = require('../db');
const { authenticateToken } = require('../middleware');
const router = express.Router();
const MAX_FRIENDS = 50;
function calcDiscountRate(amount) { if (amount <= 100) return 0.8; if (amount <= 500) return 0.6; return 0.5; }

router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const accepted = await client.query(`SELECT f.id, f.friend_id, f.user_id, f.created_at, u.name as friend_name FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'accepted' UNION SELECT f.id, f.user_id as friend_id, f.friend_id as user_id, f.created_at, u.name as friend_name FROM friendships f JOIN users u ON u.id = f.user_id WHERE f.friend_id = $1 AND f.status = 'accepted'`, [userId]);
    const pending = await client.query(`SELECT f.id, f.user_id as sender_id, u.name as sender_name, f.created_at FROM friendships f JOIN users u ON u.id = f.user_id WHERE f.friend_id = $1 AND f.status = 'pending'`, [userId]);
    const sent = await client.query(`SELECT f.id, f.friend_id as receiver_id, u.name as receiver_name, f.created_at FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'pending'`, [userId]);
    const rejected = await client.query(`SELECT f.id, f.friend_id as receiver_id, u.name as receiver_name, f.created_at FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'rejected'`, [userId]);
    res.json({ friends: accepted.rows.map(r => ({ friendship_id: r.id, friend_id: r.friend_id, friend_name: r.friend_name, created_at: r.created_at })), pending_requests: pending.rows.map(r => ({ friendship_id: r.id, sender_id: r.sender_id, sender_name: r.sender_name, created_at: r.created_at })), sent_requests: sent.rows.map(r => ({ friendship_id: r.id, receiver_id: r.receiver_id, receiver_name: r.receiver_name, created_at: r.created_at })), rejected_requests: rejected.rows.map(r => ({ friendship_id: r.id, receiver_id: r.receiver_id, receiver_name: r.receiver_name, created_at: r.created_at })) });
  } catch (error) { logger.error('Get friends error:', { error: error.message }); res.status(500).json({ error: '获取好友列表失败' }); }
});

router.post('/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const { friend_id } = req.body;
    if (!friend_id || friend_id === userId) return res.status(400).json({ error: '无效的好友ID' });
    const target = await client.query('SELECT id FROM users WHERE id = $1', [friend_id]);
    if (target.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const existing = await client.query('SELECT * FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [userId, friend_id]);
    if (existing.rowCount > 0) return res.status(400).json({ error: existing.rows[0].status === 'accepted' ? '已经是好友了' : '已存在待处理的好友请求' });
    const count = await client.query(`SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`, [userId]);
    if (parseInt(count.rows[0].count) >= MAX_FRIENDS) return res.status(400).json({ error: '好友数量已达上限' });
    const result = await client.query('INSERT INTO friendships (user_id, friend_id, status) VALUES ($1,$2,$3) RETURNING *', [userId, friend_id, 'pending']);
    res.status(201).json({ message: '好友请求已发送', friendship: { id: result.rows[0].id, friend_id: result.rows[0].friend_id, status: result.rows[0].status } });
  } catch (error) { logger.error('Send friend request error:', { error: error.message }); res.status(500).json({ error: '发送好友请求失败' }); }
});

router.post('/friends/:friendshipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const friendshipId = parseInt(req.params.friendshipId); const { action } = req.body;
    if (!action || !['accept', 'reject'].includes(action)) return res.status(400).json({ error: '请提供有效的 action' });
    const friendship = await client.query('SELECT * FROM friendships WHERE id = $1', [friendshipId]);
    if (friendship.rowCount === 0) return res.status(404).json({ error: '好友请求不存在' });
    const f = friendship.rows[0];
    if (f.friend_id !== userId || f.status !== 'pending') return res.status(400).json({ error: '无法操作' });
    if (action === 'accept') { const count = await client.query(`SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`, [userId]); if (parseInt(count.rows[0].count) >= MAX_FRIENDS) return res.status(400).json({ error: '好友数量已达上限' }); }
    await client.query('UPDATE friendships SET status = $1 WHERE id = $2', [action === 'accept' ? 'accepted' : 'rejected', friendshipId]);
    res.json({ message: action === 'accept' ? '已接受好友请求' : '已拒绝好友请求' });
  } catch (error) { logger.error('Handle friend request error:', { error: error.message }); res.status(500).json({ error: '处理好友请求失败' }); }
});

router.delete('/friends/:friendshipId', authenticateToken, async (req, res) => {
  try {
    const friendship = await client.query('SELECT * FROM friendships WHERE id = $1', [req.params.friendshipId]);
    if (friendship.rowCount === 0) return res.status(404).json({ error: '好友关系不存在' });
    const f = friendship.rows[0];
    if (f.user_id !== req.user.id && f.friend_id !== req.user.id) return res.status(403).json({ error: '无权操作' });
    await client.query('DELETE FROM friendships WHERE id = $1', [req.params.friendshipId]);
    res.json({ message: '好友已删除' });
  } catch (error) { res.status(500).json({ error: '删除好友失败' }); }
});

router.post('/friends/:friendId/gift', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const friendId = req.params.friendId; const { gift_type, item_id, currency_type, amount } = req.body;
    if (!gift_type || !['item', 'currency'].includes(gift_type)) return res.status(400).json({ error: '请提供有效的 gift_type' });
    const friendship = await client.query(`SELECT * FROM friendships WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted'`, [userId, friendId]);
    if (friendship.rowCount === 0) return res.status(400).json({ error: '对方不是你的好友' });
    const senderUser = await client.query('SELECT created_at FROM users WHERE id = $1', [userId]);
    if (senderUser.rowCount > 0) { const accountAge = Date.now() - new Date(senderUser.rows[0].created_at).getTime(); const cooldownHours = await getConfig('account_gift_cooldown_hours') || 24; if (accountAge < cooldownHours * 3600000) return res.status(400).json({ error: `新注册用户需满${cooldownHours}小时后才能送礼` }); }
    const friendshipAge = Date.now() - new Date(friendship.rows[0].created_at).getTime();
    const friendCooldown = await getConfig('friend_gift_cooldown_hours') || 24;
    if (friendshipAge < friendCooldown * 3600000) return res.status(400).json({ error: `添加好友满${friendCooldown}小时后才能互送礼物` });
    await client.query('BEGIN');
    try {
      if (gift_type === 'item') {
        if (!item_id) { await client.query('ROLLBACK'); return res.status(400).json({ error: '请提供 item_id' }); }
        const userItem = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2 AND quantity > 0', [userId, item_id]);
        if (userItem.rowCount === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: '你没有该物品' }); }
        await client.query('INSERT INTO gifts (sender_id, receiver_id, gift_type, item_id, amount, discount_rate, status) VALUES ($1,$2,$3,$4,1,1.00,$5)', [userId, friendId, 'item', item_id, 'pending']);
      } else {
        if (!currency_type || !amount || amount <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: '请提供有效的参数' }); }
        const discountRate = calcDiscountRate(amount);
        const receiveAmount = Math.floor(amount * discountRate);
        await deductCurrency(userId, currency_type, amount);
        await client.query('INSERT INTO gifts (sender_id, receiver_id, gift_type, currency_type, amount, discount_rate, status) VALUES ($1,$2,$3,$4,$5,$6,$7)', [userId, friendId, 'currency', currency_type, receiveAmount, discountRate, 'pending']);
      }
      await client.query('COMMIT');
      res.json({ message: '礼物已送出，等待对方接收' });
    } catch (err) { await client.query('ROLLBACK'); if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' }); throw err; }
  } catch (error) { logger.error('Gift error:', { error: error.message }); res.status(500).json({ error: '送礼失败' }); }
});

router.get('/gifts', authenticateToken, async (req, res) => {
  try {
    const result = await client.query(`SELECT g.*, u.name as sender_name FROM gifts g JOIN users u ON u.id = g.sender_id WHERE g.receiver_id = $1 AND g.status = 'pending' ORDER BY g.created_at DESC`, [req.user.id]);
    const gifts = [];
    for (const g of result.rows) {
      let giftInfo = { gift_type: g.gift_type };
      if (g.gift_type === 'item' && g.item_id) { const item = await client.query('SELECT name, icon, rarity FROM items WHERE id = $1', [g.item_id]); if (item.rowCount > 0) giftInfo.item = { id: g.item_id, name: item.rows[0].name, icon: item.rows[0].icon, rarity: item.rows[0].rarity }; }
      if (g.gift_type === 'currency') { giftInfo.currency_type = g.currency_type; giftInfo.amount = Number(g.amount); }
      gifts.push({ id: g.id, sender_id: g.sender_id, sender_name: g.sender_name, ...giftInfo, created_at: g.created_at });
    }
    res.json({ gifts, count: gifts.length });
  } catch (error) { res.status(500).json({ error: '获取礼物箱失败' }); }
});

router.post('/gifts/:giftId/accept', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const giftId = parseInt(req.params.giftId);
    const giftResult = await client.query('SELECT * FROM gifts WHERE id = $1 AND receiver_id = $2 AND status = $3', [giftId, userId, 'pending']);
    if (giftResult.rowCount === 0) return res.status(404).json({ error: '礼物不存在或已接收' });
    const gift = giftResult.rows[0];
    await client.query('BEGIN');
    try {
      if (gift.gift_type === 'item' && gift.item_id) {
        const senderItem = await client.query('SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
        if (senderItem.rowCount === 0 || senderItem.rows[0].quantity <= 0) { await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['expired', giftId]); await client.query('COMMIT'); return res.status(400).json({ error: '礼物已过期' }); }
        const newQty = senderItem.rows[0].quantity - 1;
        if (newQty <= 0) await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
        else await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, gift.sender_id, gift.item_id]);
        await client.query('INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1,$2,1) ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 1, updated_at = CURRENT_TIMESTAMP', [userId, gift.item_id]);
      } else if (gift.gift_type === 'currency') { await addCurrency(userId, gift.currency_type, Number(gift.amount)); }
      await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['accepted', giftId]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '礼物接收成功', currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) { res.status(500).json({ error: '接收礼物失败' }); }
});

router.post('/gifts/accept-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const pendingGifts = await client.query('SELECT * FROM gifts WHERE receiver_id = $1 AND status = $2', [userId, 'pending']);
    if (pendingGifts.rowCount === 0) return res.json({ message: '没有待接收的礼物', accepted: 0 });
    let accepted = 0, failed = 0;
    await client.query('BEGIN');
    try {
      for (const gift of pendingGifts.rows) {
        try {
          if (gift.gift_type === 'item' && gift.item_id) {
            const senderItem = await client.query('SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
            if (senderItem.rowCount === 0 || senderItem.rows[0].quantity <= 0) { await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['expired', gift.id]); failed++; continue; }
            const newQty = senderItem.rows[0].quantity - 1;
            if (newQty <= 0) await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [gift.sender_id, gift.item_id]);
            else await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, gift.sender_id, gift.item_id]);
            await client.query('INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1,$2,1) ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 1, updated_at = CURRENT_TIMESTAMP', [userId, gift.item_id]);
          } else if (gift.gift_type === 'currency') { await addCurrency(userId, gift.currency_type, Number(gift.amount)); }
          await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['accepted', gift.id]); accepted++;
        } catch (e) { failed++; }
      }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: `接收完成：成功 ${accepted} 个`, accepted, failed, currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) { res.status(500).json({ error: '接收礼物失败' }); }
});

router.post('/friends/:friendId/transfer', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const friendId = req.params.friendId; const { currency_type, amount } = req.body;
    if (!currency_type || !amount || amount <= 0) return res.status(400).json({ error: '请提供有效的参数' });
    const friendship = await client.query(`SELECT * FROM friendships WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted'`, [userId, friendId]);
    if (friendship.rowCount === 0) return res.status(400).json({ error: '对方不是你的好友' });
    const discountRate = calcDiscountRate(amount);
    const receiveAmount = Math.floor(amount * discountRate);
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, currency_type, amount);
      await addCurrency(friendId, currency_type, receiveAmount);
      await client.query('INSERT INTO gifts (sender_id, receiver_id, gift_type, currency_type, amount, discount_rate, status) VALUES ($1,$2,$3,$4,$5,$6,$7)', [userId, friendId, 'transfer', currency_type, amount, discountRate, 'accepted']);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' }); throw err; }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '转让成功', spent: amount, received: receiveAmount, discount_rate: discountRate, currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) { res.status(500).json({ error: '转让失败' }); }
});

module.exports = router;

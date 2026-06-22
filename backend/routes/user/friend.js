const express = require('express');
const router = express.Router();
const { client, logger, getConfig, deductCurrency, addCurrency, createOrder } = require('../../db');
const { authenticateToken } = require('../../middleware');

const MAX_FRIENDS = 50;

// 获取好友列表
router.get('/api/user/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const acceptedResult = await client.query(
      `SELECT f.id, f.friend_id, f.user_id, f.created_at, u.name as friend_name FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'accepted'
       UNION
       SELECT f.id, f.user_id as friend_id, f.friend_id as user_id, f.created_at, u.name as friend_name FROM friendships f JOIN users u ON u.id = f.user_id WHERE f.friend_id = $1 AND f.status = 'accepted'`,
      [userId]
    );
    const pendingResult = await client.query(`SELECT f.id, f.user_id as sender_id, u.name as sender_name, f.created_at FROM friendships f JOIN users u ON u.id = f.user_id WHERE f.friend_id = $1 AND f.status = 'pending'`, [userId]);
    const sentResult = await client.query(`SELECT f.id, f.friend_id as receiver_id, u.name as receiver_name, f.created_at FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'pending'`, [userId]);
    const rejectedResult = await client.query(`SELECT f.id, f.friend_id as receiver_id, u.name as receiver_name, f.created_at FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.status = 'rejected'`, [userId]);
    res.json({
      friends: acceptedResult.rows.map(r => ({ friendship_id: r.id, friend_id: r.friend_id, friend_name: r.friend_name, created_at: r.created_at })),
      pending_requests: pendingResult.rows.map(r => ({ friendship_id: r.id, sender_id: r.sender_id, sender_name: r.sender_name, created_at: r.created_at })),
      sent_requests: sentResult.rows.map(r => ({ friendship_id: r.id, receiver_id: r.receiver_id, receiver_name: r.receiver_name, created_at: r.created_at })),
      rejected_requests: rejectedResult.rows.map(r => ({ friendship_id: r.id, receiver_id: r.receiver_id, receiver_name: r.receiver_name, created_at: r.created_at }))
    });
  } catch (error) {
    logger.error('Get friends error:', { error: error.message });
    res.status(500).json({ error: '获取好友列表失败' });
  }
});

// 发送好友请求
router.post('/api/user/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friend_id } = req.body;
    if (!friend_id) return res.status(400).json({ error: '请提供 friend_id' });
    if (friend_id === userId) return res.status(400).json({ error: '不能添加自己为好友' });
    const targetUser = await client.query('SELECT id, name FROM users WHERE id = $1', [friend_id]);
    if (targetUser.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const existing = await client.query(`SELECT * FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`, [userId, friend_id]);
    if (existing.rowCount > 0) {
      if (existing.rows[0].status === 'accepted') return res.status(400).json({ error: '已经是好友了' });
      return res.status(400).json({ error: '已存在待处理的好友请求' });
    }
    const friendCount = await client.query(`SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`, [userId]);
    if (parseInt(friendCount.rows[0].count) >= MAX_FRIENDS) return res.status(400).json({ error: `好友数量已达上限（${MAX_FRIENDS}）` });
    const result = await client.query('INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3) RETURNING *', [userId, friend_id, 'pending']);
    res.status(201).json({ message: '好友请求已发送', friendship: { id: result.rows[0].id, friend_id: result.rows[0].friend_id, status: result.rows[0].status } });
  } catch (error) {
    logger.error('Send friend request error:', { error: error.message });
    res.status(500).json({ error: '发送好友请求失败' });
  }
});

// 处理好友请求
router.post('/api/user/friends/:friendshipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(req.params.friendshipId);
    const { action } = req.body;
    if (!action || !['accept', 'reject'].includes(action)) return res.status(400).json({ error: '请提供有效的 action' });
    const friendship = await client.query('SELECT * FROM friendships WHERE id = $1', [friendshipId]);
    if (friendship.rowCount === 0) return res.status(404).json({ error: '好友请求不存在' });
    const f = friendship.rows[0];
    if (f.friend_id !== userId) return res.status(403).json({ error: '只有接收方可以操作' });
    if (f.status !== 'pending') return res.status(400).json({ error: '该请求已处理' });
    if (action === 'accept') {
      const friendCount = await client.query(`SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`, [userId]);
      if (parseInt(friendCount.rows[0].count) >= MAX_FRIENDS) return res.status(400).json({ error: `好友数量已达上限（${MAX_FRIENDS}）` });
      await client.query('UPDATE friendships SET status = $1 WHERE id = $2', ['accepted', friendshipId]);
      res.json({ message: '已接受好友请求' });
    } else {
      await client.query('UPDATE friendships SET status = $1 WHERE id = $2', ['rejected', friendshipId]);
      res.json({ message: '已拒绝好友请求' });
    }
  } catch (error) {
    logger.error('Handle friend request error:', { error: error.message });
    res.status(500).json({ error: '处理好友请求失败' });
  }
});

// 删除好友
router.delete('/api/user/friends/:friendshipId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendshipId = parseInt(req.params.friendshipId);
    const friendship = await client.query('SELECT * FROM friendships WHERE id = $1', [friendshipId]);
    if (friendship.rowCount === 0) return res.status(404).json({ error: '好友关系不存在' });
    const f = friendship.rows[0];
    if (f.user_id !== userId && f.friend_id !== userId) return res.status(403).json({ error: '无权操作' });
    await client.query('DELETE FROM friendships WHERE id = $1', [friendshipId]);
    res.json({ message: '好友已删除' });
  } catch (error) {
    logger.error('Delete friend error:', { error: error.message });
    res.status(500).json({ error: '删除好友失败' });
  }
});

// ========== 辅助函数 ==========

// 获取今日已送钻石数
async function getDailySent(userId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const result = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM gifts
     WHERE sender_id = $1 AND status IN ('pending', 'accepted') AND created_at >= $2`,
    [userId, todayStart]
  );
  return Number(result.rows[0].total);
}

// 获取今日已收钻石数
async function getDailyReceived(userId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const result = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM gifts
     WHERE receiver_id = $1 AND status = 'accepted' AND created_at >= $2`,
    [userId, todayStart]
  );
  return Number(result.rows[0].total);
}

// 懒清理过期礼物并退回钻石
async function cleanupExpiredGifts() {
  const expireHours = await getConfig('gift_expire_hours') || 4;

  // 1. 标记过期
  await client.query(
    `UPDATE gifts SET status = 'expired'
     WHERE status = 'pending' AND created_at < NOW() - INTERVAL '${expireHours} hours'`
  );

  // 2. 退回未退回的过期礼物钻石
  const expired = await client.query(
    `SELECT sender_id, SUM(amount) as total
     FROM gifts WHERE status = 'expired' AND refunded = false
     GROUP BY sender_id`
  );
  for (const row of expired.rows) {
    await client.query(
      `UPDATE currencies SET diamond = diamond + $1 WHERE user_id = $2`,
      [Number(row.total), row.sender_id]
    );
  }

  // 3. 标记已退回
  if (expired.rowCount > 0) {
    await client.query(
      `UPDATE gifts SET refunded = true WHERE status = 'expired' AND refunded = false`
    );
  }

  return expired.rowCount || 0;
}

// ========== 送礼系统 ==========

// 送礼（仅钻石，1~5）
router.post('/api/user/friends/:friendId/gift', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;
    const { amount } = req.body;

    // 校验数量
    if (!amount || !Number.isInteger(amount) || amount < 1 || amount > 5) {
      return res.status(400).json({ error: '赠送数量必须为 1~5 的整数' });
    }

    // 校验好友关系
    const friendship = await client.query(
      `SELECT * FROM friendships WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted'`,
      [userId, friendId]
    );
    if (friendship.rowCount === 0) return res.status(400).json({ error: '对方不是你的好友' });

    // 新号冷却
    const senderUser = await client.query('SELECT created_at FROM users WHERE id = $1', [userId]);
    const accountCooldown = await getConfig('account_gift_cooldown_hours') || 24;
    const accountAge = Date.now() - new Date(senderUser.rows[0].created_at).getTime();
    if (accountAge < accountCooldown * 60 * 60 * 1000) {
      return res.status(400).json({ error: `新注册用户需满${accountCooldown}小时后才能送礼` });
    }

    // 好友冷却
    const friendCooldown = await getConfig('friend_gift_cooldown_hours') || 24;
    const friendshipAge = Date.now() - new Date(friendship.rows[0].created_at).getTime();
    if (friendshipAge < friendCooldown * 60 * 60 * 1000) {
      return res.status(400).json({ error: `添加好友满${friendCooldown}小时后才能互送礼物` });
    }

    // 今日已送限额
    const dailyLimit = await getConfig('gift_daily_limit_diamond') || 5;
    const dailySent = await getDailySent(userId);
    if (dailySent + amount > dailyLimit) {
      return res.status(400).json({ error: `今日赠送额度不足（已送 ${dailySent}/${dailyLimit}）` });
    }

    // 今日已收限额（接收方）
    const dailyReceived = await getDailyReceived(friendId);
    if (dailyReceived + amount > dailyLimit) {
      return res.status(400).json({ error: `对方今日收礼已达上限` });
    }

    // 扣除钻石
    await deductCurrency(userId, 'diamond', amount);
    await createOrder(userId, 'CURRENCY_GIFT', 'diamond', -amount);

    // 写入礼物
    await client.query(
      `INSERT INTO gifts (sender_id, receiver_id, gift_type, currency_type, amount, status)
       VALUES ($1, $2, 'currency', 'diamond', $3, 'pending')`,
      [userId, friendId, amount]
    );

    const remaining = dailyLimit - dailySent - amount;
    res.json({ message: '礼物已送出，等待对方接收', spent: amount, remaining_daily_send: remaining });
  } catch (error) {
    if (error.message === 'Insufficient balance') return res.status(400).json({ error: '钻石余额不足' });
    logger.error('Gift error:', { error: error.message });
    res.status(500).json({ error: '送礼失败' });
  }
});

// 获取礼物箱（含懒清理）
router.get('/api/user/gifts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 懒清理
    const expiredCount = await cleanupExpiredGifts();

    // 获取未过期礼物
    const result = await client.query(
      `SELECT g.*, u.name as sender_name FROM gifts g
       JOIN users u ON u.id = g.sender_id
       WHERE g.receiver_id = $1 AND g.status = 'pending'
       ORDER BY g.created_at DESC`,
      [userId]
    );

    const gifts = result.rows.map(g => ({
      id: g.id,
      sender_id: g.sender_id,
      sender_name: g.sender_name,
      currency_type: g.currency_type,
      amount: Number(g.amount),
      created_at: g.created_at
    }));

    // 今日已收
    const dailyReceived = await getDailyReceived(userId);
    const dailyLimit = await getConfig('gift_daily_limit_diamond') || 5;

    res.json({
      gifts,
      count: gifts.length,
      expired_refunded: expiredCount,
      daily_received: dailyReceived,
      daily_limit: dailyLimit
    });
  } catch (error) {
    logger.error('Get gifts error:', { error: error.message });
    res.status(500).json({ error: '获取礼物箱失败' });
  }
});

// 接受礼物
router.post('/api/user/gifts/:giftId/accept', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const giftId = parseInt(req.params.giftId);
    if (isNaN(giftId)) return res.status(400).json({ error: '无效的礼物ID' });

    const giftResult = await client.query(
      'SELECT * FROM gifts WHERE id = $1 AND receiver_id = $2 AND status = $3',
      [giftId, userId, 'pending']
    );
    if (giftResult.rowCount === 0) return res.status(404).json({ error: '礼物不存在或已处理' });

    const gift = giftResult.rows[0];

    // 检查是否过期
    const expireHours = await getConfig('gift_expire_hours') || 4;
    const giftAge = Date.now() - new Date(gift.created_at).getTime();
    if (giftAge > expireHours * 60 * 60 * 1000) {
      await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['expired', giftId]);
      return res.status(400).json({ error: '礼物已过期' });
    }

    // 今日已收限额
    const dailyLimit = await getConfig('gift_daily_limit_diamond') || 5;
    const dailyReceived = await getDailyReceived(userId);
    if (dailyReceived + Number(gift.amount) > dailyLimit) {
      return res.status(400).json({ error: `今日收礼已达上限（${dailyReceived}/${dailyLimit}）` });
    }

    // 接收
    await client.query('BEGIN');
    try {
      await addCurrency(userId, 'diamond', Number(gift.amount));
      await createOrder(userId, 'CURRENCY_GIFT', 'diamond', Number(gift.amount));
      await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['accepted', giftId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const cur = await client.query('SELECT diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '礼物接收成功', diamond: Number(cur.rows[0].diamond) });
  } catch (error) {
    logger.error('Accept gift error:', { error: error.message });
    res.status(500).json({ error: '接收礼物失败' });
  }
});

// 全部接收（按时间顺序，到上限停止）
router.post('/api/user/gifts/accept-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const pendingGifts = await client.query(
      `SELECT * FROM gifts WHERE receiver_id = $1 AND status = 'pending' ORDER BY created_at ASC`,
      [userId]
    );
    if (pendingGifts.rowCount === 0) {
      return res.json({ message: '没有待接收的礼物', accepted: 0 });
    }

    const dailyLimit = await getConfig('gift_daily_limit_diamond') || 5;
    const dailyReceived = await getDailyReceived(userId);
    const expireHours = await getConfig('gift_expire_hours') || 4;
    const now = Date.now();

    let accepted = 0;
    let skipped = 0;
    let remaining = dailyLimit - dailyReceived;

    await client.query('BEGIN');
    try {
      for (const gift of pendingGifts.rows) {
        if (remaining <= 0) { skipped++; continue; }
        // 检查过期
        const giftAge = now - new Date(gift.created_at).getTime();
        if (giftAge > expireHours * 60 * 60 * 1000) {
          await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['expired', gift.id]);
          skipped++;
          continue;
        }
        const giftAmount = Number(gift.amount);
        const actualAccept = Math.min(giftAmount, remaining);
        await addCurrency(userId, 'diamond', actualAccept);
        await createOrder(userId, 'CURRENCY_GIFT', 'diamond', actualAccept);
        if (actualAccept === giftAmount) {
          await client.query('UPDATE gifts SET status = $1 WHERE id = $2', ['accepted', gift.id]);
        } else {
          // 部分领取：更新金额，剩余部分保留
          await client.query('UPDATE gifts SET amount = $1 WHERE id = $2', [giftAmount - actualAccept, gift.id]);
        }
        remaining -= actualAccept;
        accepted++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const cur = await client.query('SELECT diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({
      message: `接收完成：成功 ${accepted} 个${skipped > 0 ? `，跳过 ${skipped} 个` : ''}`,
      accepted,
      skipped,
      diamond: Number(cur.rows[0].diamond)
    });
  } catch (error) {
    logger.error('Accept all gifts error:', { error: error.message });
    res.status(500).json({ error: '接收礼物失败' });
  }
});

module.exports = router;

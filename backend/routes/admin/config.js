const express = require('express');
const router = express.Router();
const { client, logger } = require('../../db');
const { authenticateToken, requireAdmin } = require('../../middleware');

// GET /api/admin/config — 获取所有配置
router.get('/api/admin/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await client.query('SELECT key, value, description, updated_at FROM global_config ORDER BY key');
    res.json(result.rows);
  } catch (error) {
    logger.error('Get config error:', { error: error.message });
    res.status(500).json({ error: '获取配置失败' });
  }
});

// PUT /api/admin/config — 更新配置
router.put('/api/admin/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key, value: newValue } = req.body;
    if (key && newValue !== undefined) {
      // 单项更新 { key, value }
      await client.query('INSERT INTO global_config (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [key, JSON.stringify(newValue)]);
    } else {
      // 批量更新 { key1: val1, key2: val2 }
      const updates = req.body;
      if (!updates || typeof updates !== 'object') return res.status(400).json({ error: '请提供配置键值对' });
      await client.query('BEGIN');
      try {
        for (const [k, v] of Object.entries(updates)) {
          await client.query('INSERT INTO global_config (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP', [k, JSON.stringify(v)]);
        }
        await client.query('COMMIT');
      } catch (err) { await client.query('ROLLBACK'); throw err; }
    }
    // 清除配置缓存
    const { clearConfigCache } = require('../../db');
    clearConfigCache();
    res.json({ message: '配置更新成功' });
  } catch (error) {
    logger.error('Update config error:', { error: error.message });
    res.status(500).json({ error: '更新配置失败' });
  }
});

// GET /api/admin/stats — 获取统计数据
router.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await client.query(`SELECT COUNT(*) as count FROM users WHERE role = 'user'`);
    const totalOrders = await client.query('SELECT COUNT(*) as count FROM orders');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const activeToday = await client.query(`SELECT COUNT(*) as count FROM users WHERE last_login_at >= $1 AND role = 'user'`, [today]);
    const totalItems = await client.query('SELECT COUNT(*) as count FROM items');
    const totalPets = await client.query('SELECT COUNT(*) as count FROM user_pets');
    const currencies = await client.query('SELECT COALESCE(SUM(silver_coin),0) as silver, COALESCE(SUM(gold_coin),0) as gold, COALESCE(SUM(diamond),0) as diamond FROM currencies');
    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      totalItems: parseInt(totalItems.rows[0].count),
      totalSilverCoin: parseInt(currencies.rows[0].silver),
      totalGoldCoin: parseInt(currencies.rows[0].gold),
      totalDiamond: parseInt(currencies.rows[0].diamond),
      totalOrders: parseInt(totalOrders.rows[0].count),
      todayActiveUsers: parseInt(activeToday.rows[0].count)
    });
  } catch (error) {
    logger.error('Get stats error:', { error: error.message });
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

module.exports = router;

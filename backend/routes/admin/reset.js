const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { client, logger, BUILTIN_EFFECTS } = require('../../db');
const { authenticateToken, requireAdmin } = require('../../middleware');

// POST /api/admin/reset — 快速重置数据库
router.post('/api/admin/reset', authenticateToken, requireAdmin, async (req, res) => {
  try {
    logger.info('Full database reset initiated');

    // DROP 所有表
    await client.query('DROP TABLE IF EXISTS orders, gifts, friendships, user_decorations, user_pets, user_items, garden_plots, currencies, users, items, pets, decorations, global_config CASCADE');

    // 重新初始化（建表 + 插入默认数据，含 admin + test1 + test2 账号）
    const { initDatabase } = require('../../init');
    await initDatabase();

    // 同步特效目录：复制前端内置特效到后端，清除非内置文件
    const frontendEffects = path.join(__dirname, '../../../frontend/src/effects');
    const effectsDir = path.join(__dirname, '../../../effects');
    if (fs.existsSync(frontendEffects)) {
      const defaultFiles = fs.readdirSync(frontendEffects).filter(f => f.endsWith('.js') && f !== 'index.js');
      if (fs.existsSync(effectsDir)) {
        for (const f of fs.readdirSync(effectsDir)) {
          if (f.endsWith('.js') && !BUILTIN_EFFECTS.includes(f)) {
            fs.unlinkSync(path.join(effectsDir, f));
          }
        }
      }
      for (const f of defaultFiles) {
        fs.copyFileSync(path.join(frontendEffects, f), path.join(effectsDir, f));
      }
      logger.info('Effects directory synced with defaults');
    }

    logger.info('Full database reset completed');
    res.json({ message: '重置成功', accounts: [
      { name: 'Admin', email: 'admin@cyberplant.com', password: 'admin123' },
      { name: 'TestUser1', email: 'test1@cyberplant.com', password: 'test123' },
      { name: 'TestUser2', email: 'test2@cyberplant.com', password: 'test123' }
    ] });
  } catch (error) {
    logger.error('Reset error:', { error: error.message });
    res.status(500).json({ error: '重置失败: ' + error.message });
  }
});

module.exports = router;

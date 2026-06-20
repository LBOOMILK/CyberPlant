const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { client, logger } = require('../../db');
const { authenticateToken } = require('../../middleware');

// 改密码
router.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: '请输入当前密码和新密码' });
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{6,20}$/;
    if (!passwordRegex.test(newPassword)) return res.status(400).json({ error: '新密码只能包含字母、数字和常见符号,长度6-20位' });
    const userResult = await client.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: '用户不存在' });
    const passwordMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!passwordMatch) return res.status(401).json({ error: '当前密码错误' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
    res.json({ message: '密码修改成功' });
  } catch (error) {
    logger.error('Change password error', { error: error.message });
    res.status(500).json({ error: '修改密码失败,请稍后再试' });
  }
});

module.exports = router;

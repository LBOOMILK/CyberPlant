const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { logger, BUILTIN_EFFECTS } = require('../../db');
const { authenticateToken, requireAdmin } = require('../../middleware');

// 特效文件目录
const effectsDir = path.join(__dirname, '../../../effects');
if (!fs.existsSync(effectsDir)) fs.mkdirSync(effectsDir, { recursive: true });

// multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, effectsDir),
  filename: (req, file, cb) => {
    const name = file.originalname.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    cb(null, name.endsWith('.js') ? name : name + '.js');
  }
});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 } });

// POST /api/admin/effects/upload — 上传特效文件
router.post('/api/admin/effects/upload', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    const filePath = req.file.path;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.includes('name') || !content.includes('init')) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: '特效文件必须导出 { name, init }' });
      }
    } catch (e) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: '文件校验失败' });
    }
    res.json({ message: '上传成功', filename: req.file.filename });
  } catch (error) {
    logger.error('Upload effect error:', { error: error.message });
    res.status(500).json({ error: '上传失败' });
  }
});

// GET /api/admin/effects — 获取特效列表
router.get('/api/admin/effects', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const files = fs.existsSync(effectsDir) ? fs.readdirSync(effectsDir).filter(f => f.endsWith('.js') && f !== 'index.js') : [];
    res.json({ effects: files });
  } catch (error) {
    logger.error('Get effects error:', { error: error.message });
    res.status(500).json({ error: '获取特效列表失败' });
  }
});

// GET /api/admin/effects/:filename/content — 获取特效内容
router.get('/api/admin/effects/:filename/content', authenticateToken, requireAdmin, (req, res) => {
  try {
    const filename = req.params.filename.replace(/[^a-z0-9-\.]/g, '-');
    const filePath = path.join(effectsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ filename, content, builtin: BUILTIN_EFFECTS.includes(filename) });
  } catch (error) {
    logger.error('Get effect content error:', { error: error.message });
    res.status(500).json({ error: '获取特效内容失败' });
  }
});

// PUT /api/admin/effects/:filename — 更新特效文件
router.put('/api/admin/effects/:filename', authenticateToken, requireAdmin, (req, res) => {
  try {
    const filename = req.params.filename.replace(/[^a-z0-9-\.]/g, '-');
    const filePath = path.join(effectsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: '内容不能为空' });
    if (!content.includes('name') || !content.includes('init')) {
      return res.status(400).json({ error: '必须导出 { name, init }' });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ message: '更新成功', filename });
  } catch (error) {
    logger.error('Update effect error:', { error: error.message });
    res.status(500).json({ error: '更新特效失败' });
  }
});

// DELETE /api/admin/effects/:filename — 删除特效文件
router.delete('/api/admin/effects/:filename', authenticateToken, requireAdmin, (req, res) => {
  try {
    const filename = req.params.filename.replace(/[^a-z0-9-\.]/g, '-');
    if (BUILTIN_EFFECTS.includes(filename)) return res.status(400).json({ error: '内置特效不能删除' });
    const filePath = path.join(effectsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
    fs.unlinkSync(filePath);
    res.json({ message: '删除成功', filename });
  } catch (error) {
    logger.error('Delete effect error:', { error: error.message });
    res.status(500).json({ error: '删除特效失败' });
  }
});

module.exports = router;

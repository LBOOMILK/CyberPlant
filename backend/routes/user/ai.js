const express = require('express');
const router = express.Router();
const { logger } = require('../../db');
const { authenticateToken } = require('../../middleware');

// AI 问答限流
const aiRateLimitMap = new Map();
const AI_RATE_LIMIT = 5;
const AI_RATE_WINDOW = 60 * 1000;
function checkAiRateLimit(userId) {
  const now = Date.now();
  const record = aiRateLimitMap.get(userId);
  if (!record || now > record.resetTime) { aiRateLimitMap.set(userId, { count: 1, resetTime: now + AI_RATE_WINDOW }); return true; }
  if (record.count >= AI_RATE_LIMIT) return false;
  record.count++;
  return true;
}
setInterval(() => { const now = Date.now(); for (const [key, value] of aiRateLimitMap) { if (now > value.resetTime) aiRateLimitMap.delete(key); } }, 5 * 60 * 1000);

// AI 问答
router.post('/api/ask', authenticateToken, async (req, res) => {
  try {
    const { question, conversation_id } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) return res.status(400).json({ error: '请输入问题' });
    if (question.length > 500) return res.status(400).json({ error: '问题不能超过 500 字' });
    if (!checkAiRateLimit(req.user.id)) return res.status(429).json({ error: '提问太频繁了' });
    const difyApiKey = process.env.DIFY_API_KEY;
    const difyApiUrl = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
    if (!difyApiKey || difyApiKey === 'your-dify-api-key') return res.json({ answer: '🤖 AI 助手暂未配置', conversation_id: null });
    const difyResponse = await fetch(`${difyApiUrl}/chat-messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${difyApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: {}, query: question.trim(), response_mode: 'blocking', conversation_id: conversation_id || '', user: `cyberplant-user-${req.user.id}` })
    });
    if (!difyResponse.ok) return res.json({ answer: '🤖 AI 助手暂时无法回答', conversation_id: null });
    const difyData = await difyResponse.json();
    let answer = (difyData.answer || '抱歉，暂时无法回答。').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    res.json({ answer, conversation_id: difyData.conversation_id || null });
  } catch (error) {
    logger.error('AI ask error', { error: error.message });
    res.json({ answer: '🤖 AI 助手暂时无法回答', conversation_id: null });
  }
});

module.exports = router;

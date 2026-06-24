const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { client, logger } = require('./db');
const { initDatabase } = require('./init');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// 静态文件服务(前端 build 产物)
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

// 记录所有HTTP请求
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// 路由挂载
const publicRoutes = require('./routes/public');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

app.use(publicRoutes);
app.use(userRoutes);
app.use(adminRoutes);

// SPA fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) res.sendFile(path.join(frontendPath, 'index.html'));
  else next();
});

// 导出 initDatabase 供 reset 路由使用
module.exports = { initDatabase };

async function startServer() {
  try {
    await initDatabase();
    const server = app.listen(PORT, () => { logger.info(`Server is running on port ${PORT}`); });
    process.on('SIGTERM', async () => { server.close(async () => { console.log('Server closed'); await client.end(); }); });
  } catch (error) {
    console.error('Error starting server:', error);
    await client.end();
    process.exit(1);
  }
}

startServer();

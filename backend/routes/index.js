// backend/routes/index.js - 路由注册入口
const authRoutes = require('./auth');
const userRoutes = require('./users');
const shopRoutes = require('./shop');
const gardenRoutes = require('./garden');
const petRoutes = require('./pets');
const friendRoutes = require('./friends');
const orderRoutes = require('./orders');
const adminRoutes = require('./admin');

module.exports = function registerRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api', userRoutes);
  app.use('/api', shopRoutes);
  app.use('/api', gardenRoutes);
  app.use('/api', petRoutes);
  app.use('/api/user', friendRoutes);
  app.use('/api', orderRoutes);
  app.use('/api/admin', adminRoutes);
};

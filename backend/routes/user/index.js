const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const shopRoutes = require('./shop');
const gardenRoutes = require('./garden');
const petRoutes = require('./pet');
const friendRoutes = require('./friend');
const orderRoutes = require('./order');
const aiRoutes = require('./ai');

router.use(authRoutes);
router.use(shopRoutes);
router.use(gardenRoutes);
router.use(petRoutes);
router.use(friendRoutes);
router.use(orderRoutes);
router.use(aiRoutes);

module.exports = router;

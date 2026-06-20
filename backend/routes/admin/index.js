const express = require('express');
const router = express.Router();

const userRoutes = require('./user');
const itemRoutes = require('./item');
const petRoutes = require('./pet');
const decorationRoutes = require('./decoration');
const orderRoutes = require('./order');
const configRoutes = require('./config');
const effectRoutes = require('./effect');
const resetRoutes = require('./reset');
const adminRoutes = require('./admin');

router.use(userRoutes);
router.use(itemRoutes);
router.use(petRoutes);
router.use(decorationRoutes);
router.use(orderRoutes);
router.use(configRoutes);
router.use(effectRoutes);
router.use(resetRoutes);
router.use(adminRoutes);

module.exports = router;

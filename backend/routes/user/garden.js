const express = require('express');
const router = express.Router();
const { client, logger, getConfig, deductCurrency, addCurrency, createOrder, getUserItemCount, getPetBonus, STAGE_ICONS, PLOT_LEVEL_MULTIPLIER, getUnlockCost, getUpgradeCost } = require('../../db');
const { authenticateToken } = require('../../middleware');

// 获取地块费用配置
router.get('/api/user/plots/costs', authenticateToken, async (req, res) => {
  try {
    const CURRENCY_ICON_MAP = { silver_coin: '/silver_icon.png', gold_coin: '/gold_icon.png', diamond: '/diamond.png' };
    const CURRENCY_NAME_MAP = { silver_coin: '银币', gold_coin: '金币', diamond: '钻石' };
    
    const unlockCosts = {};
    for (let i = 2; i <= 6; i++) {
      const cost = await getUnlockCost(i);
      if (cost) {
        unlockCosts[i] = {
          type: cost.type,
          amount: cost.amount,
          icon: CURRENCY_ICON_MAP[cost.type],
          label: `${cost.amount} ${CURRENCY_NAME_MAP[cost.type]}`
        };
      }
    }
    
    const upgradeCosts = {};
    for (let i = 2; i <= 5; i++) {
      const cost = await getUpgradeCost(i);
      if (cost) {
        upgradeCosts[i] = {
          type: cost.type,
          amount: cost.amount,
          icon: CURRENCY_ICON_MAP[cost.type],
          label: `${cost.amount} ${CURRENCY_NAME_MAP[cost.type]}`
        };
      }
    }
    
    res.json({ unlockCosts, upgradeCosts, levelMultiplier: PLOT_LEVEL_MULTIPLIER });
  } catch (error) {
    logger.error('Get plot costs error:', { error: error.message });
    res.status(500).json({ error: '获取地块费用信息失败' });
  }
});

// 获取地块列表
router.get('/api/user/plots', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let plotsResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 ORDER BY plot_index', [userId]);
    if (plotsResult.rowCount === 0) {
      await client.query('BEGIN');
      try {
        for (let i = 1; i <= 6; i++) {
          await client.query('INSERT INTO garden_plots (user_id, plot_index, is_unlocked) VALUES ($1, $2, $3)', [userId, i, i === 1]);
        }
        await client.query('COMMIT');
      } catch (err) { await client.query('ROLLBACK'); throw err; }
      plotsResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 ORDER BY plot_index', [userId]);
    }
    const plots = [];
    for (const plot of plotsResult.rows) {
      let cropInfo = null;
      if (plot.seed_id) {
        const itemResult = await client.query('SELECT id, name, icon, rarity, item_type, base_yield, water_cd FROM items WHERE id = $1', [plot.seed_id]);
        if (itemResult.rowCount > 0) cropInfo = itemResult.rows[0];
      }
      plots.push({
        id: plot.id, plot_index: plot.plot_index, is_unlocked: plot.is_unlocked, level: plot.level,
        seed_id: plot.seed_id, stage: plot.stage, planted_at: plot.planted_at, last_watered_at: plot.last_watered_at,
        is_dead: plot.is_dead || false, fertilized: plot.fertilized || false,
        crop: cropInfo ? { id: cropInfo.id, name: cropInfo.name, icon: cropInfo.icon, rarity: cropInfo.rarity, item_type: cropInfo.item_type, base_yield: cropInfo.base_yield, water_cd: Math.min(240, cropInfo.water_cd || 5), grow_time: (cropInfo.water_cd || 5) * 5 } : null,
        stage_icon: plot.seed_id ? (plot.stage < 4 ? STAGE_ICONS[plot.stage] : (cropInfo ? cropInfo.icon : '🌿')) : null,
        multiplier: PLOT_LEVEL_MULTIPLIER[plot.level] || 1.0
      });
    }
    res.json({ plots });
  } catch (error) {
    logger.error('Get plots error', { error: error.message });
    res.status(500).json({ error: '获取地块信息失败' });
  }
});

// 解锁地块
router.post('/api/user/plots/:plotIndex/unlock', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 2 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    const cost = await getUnlockCost(plotIndex);
    if (!cost) return res.status(400).json({ error: '该地块无法解锁' });
    const plotResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    if (plotResult.rows[0].is_unlocked) return res.status(400).json({ error: '地块已解锁' });
    const prevPlot = await client.query('SELECT is_unlocked FROM garden_plots WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex - 1]);
    if (prevPlot.rowCount === 0 || !prevPlot.rows[0].is_unlocked) return res.status(400).json({ error: `请先解锁第 ${plotIndex - 1} 块地` });
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, cost.type, cost.amount);
      await client.query('UPDATE garden_plots SET is_unlocked = true WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      await createOrder(userId, 'PLOT_UNLOCK', cost.type, -cost.amount);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '地块解锁成功', plot_index: plotIndex, currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) {
    logger.error('Unlock plot error', { error: error.message });
    res.status(500).json({ error: '解锁地块失败' });
  }
});

// 升级地块
router.post('/api/user/plots/:plotIndex/upgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    const plotResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    if (!plotResult.rows[0].is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    const currentLevel = plotResult.rows[0].level;
    if (currentLevel >= 5) return res.status(400).json({ error: '地块已达最大等级' });
    const nextLevel = currentLevel + 1;
    const cost = await getUpgradeCost(nextLevel);
    if (!cost) return res.status(400).json({ error: '无法继续升级' });
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, cost.type, cost.amount);
      await client.query('UPDATE garden_plots SET level = $1 WHERE user_id = $2 AND plot_index = $3', [nextLevel, userId, plotIndex]);
      await createOrder(userId, 'PLOT_UPGRADE', cost.type, -cost.amount);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' });
      throw err;
    }
    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    res.json({ message: '地块升级成功', plot_index: plotIndex, level: nextLevel, multiplier: PLOT_LEVEL_MULTIPLIER[nextLevel], currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
  } catch (error) {
    logger.error('Upgrade plot error', { error: error.message });
    res.status(500).json({ error: '升级地块失败' });
  }
});

// 种植
router.post('/api/user/plots/:plotIndex/plant', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    const { item_id } = req.body;
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    if (!item_id) return res.status(400).json({ error: '请提供种子 item_id' });
    const plotResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    if (!plotResult.rows[0].is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (plotResult.rows[0].seed_id !== null) return res.status(400).json({ error: '地块已有植物，请先收获或铲除' });
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    if (itemResult.rows[0].item_type !== 'seed') return res.status(400).json({ error: '该物品不是种子' });
    const userItemResult = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    if (userItemResult.rowCount === 0 || userItemResult.rows[0].quantity <= 0) return res.status(400).json({ error: '背包中没有该种子' });
    await client.query('BEGIN');
    try {
      const newQty = userItemResult.rows[0].quantity - 1;
      if (newQty <= 0) {
        await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
      } else {
        await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, item_id]);
      }
      await client.query('UPDATE garden_plots SET seed_id = $1, stage = 0, planted_at = CURRENT_TIMESTAMP, last_watered_at = CURRENT_TIMESTAMP, fertilized = FALSE, is_dead = FALSE WHERE user_id = $2 AND plot_index = $3', [item_id, userId, plotIndex]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const cropInfo = itemResult.rows[0];
    res.json({ message: '种植成功', plot_index: plotIndex, crop: { id: cropInfo.id, name: cropInfo.name, icon: cropInfo.icon, rarity: cropInfo.rarity, base_yield: cropInfo.base_yield, water_cd: cropInfo.water_cd || 5 } });
  } catch (error) {
    logger.error('Plant error', { error: error.message });
    res.status(500).json({ error: '种植失败' });
  }
});

// 浇水
router.post('/api/user/plots/:plotIndex/water', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    const plotResult = await client.query('SELECT gp.*, i.water_cd, i.name as crop_name, i.icon as crop_icon, i.base_yield FROM garden_plots gp LEFT JOIN items i ON gp.seed_id = i.id WHERE gp.user_id = $1 AND gp.plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.is_dead) return res.status(400).json({ error: '植物已死亡，请铲除后重新种植' });
    const waterCd = Math.min(240, plot.water_cd || 5);
    const dryTime = 180;
    const plantedAt = new Date(plot.planted_at).getTime();
    const now = Date.now();
    const elapsed = (now - plantedAt) / 1000;
    if (elapsed > dryTime) {
      await client.query('UPDATE garden_plots SET is_dead = true WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      return res.status(400).json({ error: '植物已因缺水而死亡' });
    }
    if (plot.stage >= 4) {
      await client.query('UPDATE garden_plots SET planted_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      return res.json({ message: '浇水成功', plot_index: plotIndex, stage: plot.stage, stage_icon: plot.crop_icon || '🌿', is_mature: true });
    }
    if (elapsed < waterCd) {
      const remaining = Math.ceil(waterCd - elapsed);
      return res.status(400).json({ error: `浇水冷却中，还需 ${remaining} 秒` });
    }
    const newStage = plot.stage + 1;
    await client.query('UPDATE garden_plots SET stage = $1, planted_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND plot_index = $3', [newStage, userId, plotIndex]);
    const isMature = newStage >= 4;
    res.json({ message: isMature ? '🎉 植物成熟了！' : '💧 浇水成功', plot_index: plotIndex, stage: newStage, stage_icon: isMature ? (plot.crop_icon || '🌿') : STAGE_ICONS[newStage], is_mature: isMature, water_cd: waterCd });
  } catch (error) {
    logger.error('Water error', { error: error.message });
    res.status(500).json({ error: '浇水失败' });
  }
});

// 施肥
router.post('/api/user/plots/:plotIndex/fertilize', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    const { item_id } = req.body;
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    if (!item_id) return res.status(400).json({ error: '请提供肥料 item_id' });
    const plotResult = await client.query('SELECT gp.*, i.water_cd, i.name as crop_name, i.icon as crop_icon, i.base_yield FROM garden_plots gp LEFT JOIN items i ON gp.seed_id = i.id WHERE gp.user_id = $1 AND gp.plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.is_dead) return res.status(400).json({ error: '植物已死亡，无法施肥' });
    if (plot.stage >= 4) return res.status(400).json({ error: '植物已成熟，无需施肥' });
    if (plot.fertilized) return res.status(400).json({ error: '该作物已使用过肥料' });
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rowCount === 0) return res.status(404).json({ error: '物品不存在' });
    if (itemResult.rows[0].item_type !== 'fertilizer') return res.status(400).json({ error: '该物品不是肥料' });
    const fertilizer = itemResult.rows[0];
    const stageSkip = fertilizer.stage_skip ? Number(fertilizer.stage_skip) : 1;
    const userItemResult = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
    if (userItemResult.rowCount === 0 || userItemResult.rows[0].quantity <= 0) return res.status(400).json({ error: '背包中没有该肥料' });
    const remainingStages = 4 - plot.stage;
    const wastedStages = Math.max(0, stageSkip - remainingStages);
    await client.query('BEGIN');
    try {
      const newQty = userItemResult.rows[0].quantity - 1;
      if (newQty <= 0) {
        await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, item_id]);
      } else {
        await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, item_id]);
      }
      const newStage = Math.min(4, plot.stage + stageSkip);
      await client.query('UPDATE garden_plots SET stage = $1, planted_at = CURRENT_TIMESTAMP, fertilized = TRUE WHERE user_id = $2 AND plot_index = $3', [newStage, userId, plotIndex]);
      await client.query('COMMIT');
      const isMature = newStage >= 4;
      const response = { message: isMature ? '🎉 施肥后植物直接成熟了！' : `🧪 施肥成功！跳过 ${stageSkip} 个阶段`, plot_index: plotIndex, stage: newStage, stage_icon: isMature ? (plot.crop_icon || '🌿') : STAGE_ICONS[Math.min(newStage, 3)], is_mature: isMature };
      if (wastedStages > 0) response.warning = `警告：肥料效果有 ${wastedStages} 个阶段被浪费了`;
      res.json(response);
    } catch (err) { await client.query('ROLLBACK'); throw err; }
  } catch (error) {
    logger.error('Fertilize error', { error: error.message });
    res.status(500).json({ error: '施肥失败' });
  }
});

// 收获
router.post('/api/user/plots/:plotIndex/harvest', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    const plotResult = await client.query('SELECT gp.*, i.name as crop_name, i.icon as crop_icon, i.rarity, i.base_yield, i.sell_price, i.currency_type, i.crop_id FROM garden_plots gp LEFT JOIN items i ON gp.seed_id = i.id WHERE gp.user_id = $1 AND gp.plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.stage < 4) return res.status(400).json({ error: '植物尚未成熟' });

    let harvestItemId = plot.seed_id;
    let harvestItemName = plot.crop_name;
    let harvestItemIcon = plot.crop_icon;
    let harvestItemRarity = plot.rarity;
    let harvestItemSellPrice = plot.sell_price || 0;
    if (plot.crop_id) {
      const cropResult = await client.query('SELECT * FROM items WHERE id = $1', [plot.crop_id]);
      if (cropResult.rowCount > 0) {
        const crop = cropResult.rows[0];
        harvestItemId = crop.id; harvestItemName = crop.name; harvestItemIcon = crop.icon; harvestItemRarity = crop.rarity; harvestItemSellPrice = crop.sell_price || 0;
      }
    }

    const maxCropCount = await getConfig('max_crop_count') || 9999;
    const currentCount = await getUserItemCount(userId, harvestItemId);
    if (currentCount >= maxCropCount) {
      return res.status(400).json({ error: '背包已满，请先清理后再收获', overflow: true });
    }

    const levelMultiplier = PLOT_LEVEL_MULTIPLIER[plot.level] || 1.0;
    const petBonus = await getPetBonus(userId);
    const bonusMultiplier = 1 + petBonus / 100;
    const baseYield = plot.base_yield || 1;
    const exactYield = baseYield * levelMultiplier * bonusMultiplier;
    let actualYield = Math.max(1, Math.floor(exactYield));

    let bonusYield = 0;
    const curResult = await client.query('SELECT yield_accumulator FROM currencies WHERE user_id = $1', [userId]);
    let accumulator = (curResult.rowCount > 0 && curResult.rows[0].yield_accumulator) ? curResult.rows[0].yield_accumulator : {};
    const rarity = harvestItemRarity;
    if (!accumulator[rarity]) accumulator[rarity] = 0;
    const decimal = exactYield - Math.floor(exactYield);
    accumulator[rarity] += decimal;
    bonusYield = Math.floor(accumulator[rarity]);
    accumulator[rarity] -= bonusYield;
    actualYield += bonusYield;
    actualYield = Math.min(actualYield, maxCropCount - currentCount);
    if (actualYield <= 0) {
      return res.status(400).json({ error: '背包已满，请先清理后再收获', overflow: true });
    }

    let sssDrop = null;
    const canDropSSS = ['S', 'SSS'].includes(harvestItemRarity);
    if (canDropSSS) {
      const sssDropBase = await getConfig('sss_drop_base') || 0.33;
      const sssDropCap = await getConfig('sss_drop_cap') || 1.0;
      const totalMultiplier = levelMultiplier + petBonus / 100;
      const dropRate = Math.min(sssDropBase * totalMultiplier, sssDropCap);
      if (Math.random() < dropRate) {
      const sssSeeds = await client.query("SELECT id, name, icon FROM items WHERE item_type = 'seed' AND rarity = 'SSS'");
      if (sssSeeds.rowCount > 0) {
        const droppedSeed = sssSeeds.rows[Math.floor(Math.random() * sssSeeds.rowCount)];
        await client.query(
          `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 1)
           ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 1, updated_at = CURRENT_TIMESTAMP`,
          [userId, droppedSeed.id]
        );
        sssDrop = { id: droppedSeed.id, name: droppedSeed.name, icon: droppedSeed.icon };
      }
      }
    }

    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, harvestItemId, actualYield]
      );
      await client.query('UPDATE garden_plots SET seed_id = NULL, stage = 0, planted_at = NULL, last_watered_at = NULL, fertilized = FALSE, is_dead = FALSE WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
      await client.query('UPDATE currencies SET yield_accumulator = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [JSON.stringify(accumulator), userId]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }

    const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
    const response = {
      message: '收获成功', plot_index: plotIndex,
      crop: { id: harvestItemId, name: harvestItemName, icon: harvestItemIcon, rarity: harvestItemRarity, sell_price: harvestItemSellPrice },
      yield: actualYield, base_yield: baseYield, bonus_yield: bonusYield,
      item_reward: { item_id: harvestItemId, name: harvestItemName, icon: harvestItemIcon, quantity: actualYield },
      currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) }
    };
    if (bonusYield > 0) response.lucky_message = `🍀 幸运收获！多得了 ${bonusYield} 个`;
    if (sssDrop) response.sss_drop = sssDrop;
    res.json(response);
  } catch (error) {
    logger.error('Harvest error', { error: error.message });
    res.status(500).json({ error: '收获失败' });
  }
});

// 铲除
router.post('/api/user/plots/:plotIndex/remove', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const plotIndex = parseInt(req.params.plotIndex);
    if (isNaN(plotIndex) || plotIndex < 1 || plotIndex > 6) return res.status(400).json({ error: '地块序号无效' });
    const plotResult = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    if (plotResult.rowCount === 0) return res.status(404).json({ error: '地块不存在' });
    const plot = plotResult.rows[0];
    if (!plot.is_unlocked) return res.status(400).json({ error: '地块未解锁' });
    if (!plot.seed_id) return res.status(400).json({ error: '地块没有植物' });
    if (plot.stage >= 4) return res.status(400).json({ error: '成熟植物不可铲除，请先收获' });
    await client.query('UPDATE garden_plots SET seed_id = NULL, stage = 0, planted_at = NULL, last_watered_at = NULL, fertilized = FALSE, is_dead = FALSE WHERE user_id = $1 AND plot_index = $2', [userId, plotIndex]);
    res.json({ message: '铲除成功', plot_index: plotIndex });
  } catch (error) {
    logger.error('Remove error', { error: error.message });
    res.status(500).json({ error: '铲除失败' });
  }
});

// 获取花园状态
router.get('/api/garden', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM garden_plots WHERE user_id = $1 ORDER BY plot_index', [req.user.id]);
    const dryTime = 180;
    const now = Date.now();
    for (const plot of result.rows) {
      if (plot.seed_id && !plot.is_dead && plot.stage < 4 && plot.planted_at) {
        const plantedAt = new Date(plot.planted_at).getTime();
        const elapsed = (now - plantedAt) / 1000;
        if (elapsed > dryTime) {
          await client.query('UPDATE garden_plots SET is_dead = true WHERE user_id = $1 AND plot_index = $2', [req.user.id, plot.plot_index]);
          plot.is_dead = true;
        }
      }
    }
    res.json(result.rows.map(p => ({ id: p.id, plot_index: p.plot_index, is_unlocked: p.is_unlocked, level: p.level, seed_id: p.seed_id, stage: p.stage, planted_at: p.planted_at, last_watered_at: p.last_watered_at, is_dead: p.is_dead || false })));
  } catch (error) {
    logger.error('Get garden error', { error: error.message });
    res.status(500).json({ error: '获取花园状态失败' });
  }
});

module.exports = router;

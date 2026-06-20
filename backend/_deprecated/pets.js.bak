// backend/routes/pets.js - 宠物系统路由
const express = require('express');
const { client, logger, getConfig, calcCurrentHunger, getPetBonus, formatPetData, PET_FOOD_EFFECTS } = require('../db');
const { authenticateToken } = require('../middleware');
const router = express.Router();

router.get('/user/pets', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT up.*, p.name, p.icon, p.pixel_art, p.rarity, p.base_bonus, p.price_type, p.price_amount, p.bonus_curve, p.growth_curve, p.is_test, p.effect_file FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.user_id = $1 ORDER BY up.is_active DESC, p.rarity DESC, up.level DESC', [req.user.id]);
    const pets = [];
    for (const pet of result.rows) {
      const { currentHunger, growthGained } = await calcCurrentHunger(pet);
      if (growthGained > 0 || currentHunger !== pet.hunger) { await client.query('UPDATE user_pets SET hunger = $1, growth_points = growth_points + $2, last_fed_at = CURRENT_TIMESTAMP WHERE id = $3', [currentHunger, growthGained, pet.id]); pet.hunger = currentHunger; pet.growth_points = (pet.growth_points || 0) + growthGained; }
      pets.push(await formatPetData(pet, pet));
    }
    res.json({ pets });
  } catch (error) { logger.error('Get user pets error:', { error: error.message }); res.status(500).json({ error: '获取宠物列表失败' }); }
});

router.get('/user/pets/active', authenticateToken, async (req, res) => {
  try {
    const result = await client.query('SELECT up.*, p.name, p.icon, p.pixel_art, p.rarity, p.base_bonus, p.price_type, p.price_amount, p.bonus_curve, p.growth_curve, p.is_test, p.effect_file FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.user_id = $1 AND up.is_active = true', [req.user.id]);
    if (result.rowCount === 0) return res.json({ pet: null, bonus: 0 });
    const pet = result.rows[0];
    const { currentHunger, growthGained } = await calcCurrentHunger(pet);
    if (growthGained > 0 || currentHunger !== pet.hunger) { await client.query('UPDATE user_pets SET hunger = $1, growth_points = growth_points + $2, last_fed_at = CURRENT_TIMESTAMP WHERE id = $3', [currentHunger, growthGained, pet.id]); pet.hunger = currentHunger; pet.growth_points = (pet.growth_points || 0) + growthGained; }
    res.json({ pet: await formatPetData(pet, pet), bonus: await getPetBonus(req.user.id) });
  } catch (error) { logger.error('Get active pet error:', { error: error.message }); res.status(500).json({ error: '获取激活宠物信息失败' }); }
});

router.post('/user/pets/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const { pet_id } = req.body;
    if (!pet_id) return res.status(400).json({ error: '请提供 pet_id' });
    const petTemplate = await client.query('SELECT * FROM pets WHERE id = $1', [pet_id]);
    if (petTemplate.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petTemplate.rows[0];
    if (pet.is_test || pet.purchasable === false) return res.status(400).json({ error: '该宠物不可购买' });
    const existing = await client.query('SELECT * FROM user_pets WHERE user_id = $1 AND pet_id = $2', [userId, pet_id]);
    if (existing.rowCount > 0) return res.status(400).json({ error: '您已拥有该宠物' });
    const { deductCurrency, createOrder } = require('../db');
    await client.query('BEGIN');
    try {
      await deductCurrency(userId, pet.price_type, Number(pet.price_amount));
      const newUserPet = await client.query('INSERT INTO user_pets (user_id, pet_id, level, growth_points, hunger, is_active) VALUES ($1,$2,1,0,20,false) RETURNING *', [userId, pet_id]);
      await createOrder(userId, 'PET_PURCHASE', pet.price_type, Number(pet.price_amount));
      await client.query('COMMIT');
      const cur = await client.query('SELECT silver_coin, gold_coin, diamond FROM currencies WHERE user_id = $1', [userId]);
      res.status(201).json({ message: '购买成功', pet: await formatPetData(newUserPet.rows[0], pet), currencies: { silver_coin: Number(cur.rows[0].silver_coin), gold_coin: Number(cur.rows[0].gold_coin), diamond: Number(cur.rows[0].diamond) } });
    } catch (err) { await client.query('ROLLBACK'); if (err.message === 'Insufficient balance') return res.status(400).json({ error: '余额不足' }); throw err; }
  } catch (error) { logger.error('Purchase pet error:', { error: error.message }); res.status(500).json({ error: '购买宠物失败' }); }
});

router.post('/user/pets/:userPetId/activate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const userPetId = parseInt(req.params.userPetId);
    const petResult = await client.query('SELECT * FROM user_pets WHERE id = $1 AND user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const isCurrentlyActive = petResult.rows[0].is_active;
    await client.query('BEGIN');
    try {
      if (isCurrentlyActive) await client.query('UPDATE user_pets SET is_active = false WHERE id = $1', [userPetId]);
      else { await client.query('UPDATE user_pets SET is_active = false WHERE user_id = $1', [userId]); await client.query('UPDATE user_pets SET is_active = true WHERE id = $1', [userPetId]); }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const updatedPet = await client.query('SELECT * FROM user_pets WHERE id = $1', [userPetId]);
    const template = await client.query('SELECT * FROM pets WHERE id = $1', [updatedPet.rows[0].pet_id]);
    res.json({ message: isCurrentlyActive ? '宠物已休息' : '激活成功', pet: await formatPetData(updatedPet.rows[0], template.rows[0]), current_bonus: await getPetBonus(userId) });
  } catch (error) { logger.error('Activate pet error:', { error: error.message }); res.status(500).json({ error: '操作宠物失败' }); }
});

router.post('/user/pets/:userPetId/feed', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const userPetId = parseInt(req.params.userPetId); const { food_item_id, confirm_overflow } = req.body;
    if (!food_item_id) return res.status(400).json({ error: '请提供宠物粮 item_id' });
    const petResult = await client.query('SELECT up.*, p.rarity, p.base_bonus, p.name as pet_name, p.bonus_curve, p.growth_curve, p.is_test FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1 AND up.user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    let pet = petResult.rows[0];
    if (pet.is_test) return res.status(400).json({ error: '测试宠物不能喂食' });
    if (pet.feeding_end_at && new Date(pet.feeding_end_at).getTime() > Date.now()) return res.status(400).json({ error: '宠物正在消化中' });
    const { currentHunger, growthGained } = await calcCurrentHunger(pet);
    if (growthGained > 0 || currentHunger !== pet.hunger) { await client.query('UPDATE user_pets SET hunger = $1, growth_points = growth_points + $2, last_fed_at = CURRENT_TIMESTAMP WHERE id = $3', [currentHunger, growthGained, pet.id]); pet.hunger = currentHunger; pet.growth_points = (pet.growth_points || 0) + growthGained; }
    const foodItem = await client.query('SELECT * FROM items WHERE id = $1 AND item_type = $2', [food_item_id, 'pet_food']);
    if (foodItem.rowCount === 0) return res.status(400).json({ error: '无效的宠物粮' });
    const foodEffect = PET_FOOD_EFFECTS[foodItem.rows[0].name];
    if (!foodEffect) return res.status(400).json({ error: '未知的宠物粮类型' });
    const userFood = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2 AND quantity > 0', [userId, food_item_id]);
    if (userFood.rowCount === 0) return res.status(400).json({ error: '你没有该宠物粮' });
    const hungerMax = await getConfig('hunger_max') || 100;
    if (pet.hunger + foodEffect.hunger > hungerMax && !confirm_overflow) return res.status(400).json({ overflow: true, waste: pet.hunger + foodEffect.hunger - hungerMax, message: `饱食度将溢出 ${pet.hunger + foodEffect.hunger - hungerMax} 点，确认继续？` });
    await client.query('BEGIN');
    try {
      const newQty = userFood.rows[0].quantity - 1;
      if (newQty <= 0) await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, food_item_id]);
      else await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, food_item_id]);
      const newHunger = Math.min(hungerMax, pet.hunger + foodEffect.hunger);
      const newGrowthPoints = (pet.growth_points || 0) + foodEffect.growth;
      const now = new Date();
      let newLevel = pet.level;
      const growthCurve = pet.growth_curve;
      let remaining = newGrowthPoints;
      if (growthCurve && Array.isArray(growthCurve)) { while (newLevel < 10 && growthCurve[newLevel] !== undefined && remaining >= growthCurve[newLevel]) { remaining -= growthCurve[newLevel]; newLevel++; } }
      await client.query('UPDATE user_pets SET growth_points = $1, hunger = $2, level = $3, last_fed_at = $4, feeding_end_at = $5 WHERE id = $6', [remaining, newHunger, newLevel, now, new Date(now.getTime() + foodEffect.digest_hours * 3600000), userPetId]);
      await client.query('COMMIT');
      const updatedPet = await client.query('SELECT up.*, p.rarity, p.base_bonus, p.name, p.icon, p.pixel_art, p.bonus_curve, p.growth_curve, p.is_test, p.effect_file FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1', [userPetId]);
      res.json({ message: '喂食成功', pet: await formatPetData(updatedPet.rows[0], updatedPet.rows[0]), fed_food: foodItem.rows[0].name, growth_gained: foodEffect.growth, hunger_restored: foodEffect.hunger, leveled_up: newLevel > pet.level ? newLevel : false });
    } catch (err) { await client.query('ROLLBACK'); throw err; }
  } catch (error) { logger.error('Feed pet error:', { error: error.message }); res.status(500).json({ error: '喂食失败' }); }
});

router.post('/user/pets/:userPetId/upgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const userPetId = parseInt(req.params.userPetId);
    const petResult = await client.query('SELECT up.*, p.bonus_curve, p.growth_curve, p.is_test FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1 AND up.user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];
    if (pet.is_test) return res.status(400).json({ error: '测试宠物不能升级' });
    const growthCurve = pet.growth_curve;
    if (!growthCurve || !Array.isArray(growthCurve)) return res.status(400).json({ error: '宠物升级数据异常' });
    if (pet.level >= 10) return res.status(400).json({ error: '宠物已达最大等级' });
    if ((pet.growth_points || 0) < growthCurve[pet.level]) return res.status(400).json({ error: `成长值不足` });
    let newLevel = pet.level, remaining = pet.growth_points || 0;
    while (newLevel < 10 && growthCurve[newLevel] !== undefined && remaining >= growthCurve[newLevel]) { remaining -= growthCurve[newLevel]; newLevel++; }
    await client.query('UPDATE user_pets SET level = $1, growth_points = $2 WHERE id = $3', [newLevel, remaining, userPetId]);
    const template = await client.query('SELECT * FROM pets WHERE id = $1', [pet.pet_id]);
    const updatedPet = await client.query('SELECT * FROM user_pets WHERE id = $1', [userPetId]);
    res.json({ message: `升级成功！Lv${pet.level} → Lv${newLevel}`, pet: await formatPetData(updatedPet.rows[0], template.rows[0]) });
  } catch (error) { logger.error('Upgrade pet error:', { error: error.message }); res.status(500).json({ error: '升级宠物失败' }); }
});

router.post('/user/pets/:userPetId/equip', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const userPetId = parseInt(req.params.userPetId); const { decoration_id, slot_type } = req.body;
    if (!decoration_id || !slot_type) return res.status(400).json({ error: '请提供 decoration_id 和 slot_type' });
    if (!['head', 'neck', 'back', 'special'].includes(slot_type)) return res.status(400).json({ error: '无效的槽位类型' });
    const petResult = await client.query('SELECT up.*, p.is_test FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1 AND up.user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];
    const decResult = await client.query('SELECT * FROM decorations WHERE id = $1', [decoration_id]);
    if (decResult.rowCount === 0) return res.status(404).json({ error: '装饰不存在' });
    const dec = decResult.rows[0];
    if (pet.is_test && dec.pet_id !== pet.pet_id) return res.status(400).json({ error: '测试宠物只能装备专属饰品' });
    if (dec.pet_id && dec.pet_id !== pet.pet_id) return res.status(400).json({ error: '该饰品不是该宠物的专属饰品' });
    const userDec = await client.query('SELECT * FROM user_decorations WHERE user_id = $1 AND decoration_id = $2 AND quantity > 0', [userId, decoration_id]);
    if (userDec.rowCount === 0) return res.status(400).json({ error: '你没有该装饰' });
    const otherPet = await client.query('SELECT id, equipped_decorations FROM user_pets WHERE user_id = $1 AND id != $2 AND equipped_decorations @> $3', [userId, userPetId, JSON.stringify({ [slot_type]: decoration_id })]);
    await client.query('BEGIN');
    try {
      if (otherPet.rowCount > 0) { const eq = otherPet.rows[0].equipped_decorations || {}; delete eq[slot_type]; await client.query('UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2', [JSON.stringify(eq), otherPet.rows[0].id]); }
      const equipped = pet.equipped_decorations || {}; equipped[slot_type] = decoration_id;
      await client.query('UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2', [JSON.stringify(equipped), userPetId]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    res.json({ message: '装备成功', slot_type, decoration: { id: dec.id, name: dec.name, icon: dec.icon, bonus: Number(dec.bonus) } });
  } catch (error) { logger.error('Equip decoration error:', { error: error.message }); res.status(500).json({ error: '装备装饰失败' }); }
});

router.post('/user/pets/:userPetId/unequip', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; const userPetId = parseInt(req.params.userPetId); const { slot_type } = req.body;
    if (!slot_type || !['head', 'neck', 'back', 'special'].includes(slot_type)) return res.status(400).json({ error: '无效的槽位类型' });
    const petResult = await client.query('SELECT * FROM user_pets WHERE id = $1 AND user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const equipped = petResult.rows[0].equipped_decorations || {};
    if (!equipped[slot_type]) return res.status(400).json({ error: '该槽位没有装备装饰' });
    delete equipped[slot_type];
    await client.query('UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2', [JSON.stringify(equipped), userPetId]);
    res.json({ message: '卸下成功', slot_type });
  } catch (error) { logger.error('Unequip decoration error:', { error: error.message }); res.status(500).json({ error: '卸下装饰失败' }); }
});

module.exports = router;

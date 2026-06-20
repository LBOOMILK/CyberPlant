const express = require('express');
const router = express.Router();
const { client, logger, getConfig, calcCurrentHunger, calcPetBonusFromCurve, getPetBonus, formatPetData, PET_FOOD_EFFECTS } = require('../../db');
const { authenticateToken } = require('../../middleware');

// 获取宠物列表
router.get('/api/user/pets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT up.*, p.name, p.icon, p.pixel_art, p.rarity, p.base_bonus, p.price_type, p.price_amount, p.bonus_curve, p.growth_curve, p.is_test, p.effect_file
       FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.user_id = $1 ORDER BY up.is_active DESC, p.rarity DESC, up.level DESC`,
      [userId]
    );
    const pets = [];
    for (const pet of result.rows) {
      const { currentHunger, growthGained } = await calcCurrentHunger(pet);
      if (growthGained > 0 || currentHunger !== pet.hunger) {
        await client.query('UPDATE user_pets SET hunger = $1, growth_points = growth_points + $2, last_fed_at = CURRENT_TIMESTAMP WHERE id = $3',
          [currentHunger, growthGained, pet.id]);
        pet.hunger = currentHunger;
        pet.growth_points = (pet.growth_points || 0) + growthGained;
      }
      pets.push(await formatPetData(pet, pet));
    }
    res.json({ pets });
  } catch (error) {
    logger.error('Get user pets error:', { error: error.message });
    res.status(500).json({ error: '获取宠物列表失败' });
  }
});

// 获取激活宠物
router.get('/api/user/pets/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query(
      `SELECT up.*, p.name, p.icon, p.pixel_art, p.rarity, p.base_bonus, p.price_type, p.price_amount, p.bonus_curve, p.growth_curve, p.is_test, p.effect_file
       FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.user_id = $1 AND up.is_active = true`,
      [userId]
    );
    if (result.rowCount === 0) return res.json({ pet: null, bonus: 0 });
    const pet = result.rows[0];
    const { currentHunger, growthGained } = await calcCurrentHunger(pet);
    if (growthGained > 0 || currentHunger !== pet.hunger) {
      await client.query('UPDATE user_pets SET hunger = $1, growth_points = growth_points + $2, last_fed_at = CURRENT_TIMESTAMP WHERE id = $3',
        [currentHunger, growthGained, pet.id]);
      pet.hunger = currentHunger;
      pet.growth_points = (pet.growth_points || 0) + growthGained;
    }
    const bonus = await getPetBonus(userId);
    res.json({ pet: await formatPetData(pet, pet), bonus });
  } catch (error) {
    logger.error('Get active pet error:', { error: error.message });
    res.status(500).json({ error: '获取激活宠物信息失败' });
  }
});

// 激活/休息宠物
router.post('/api/user/pets/:userPetId/activate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    const petResult = await client.query('SELECT * FROM user_pets WHERE id = $1 AND user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];
    const isCurrentlyActive = pet.is_active;
    await client.query('BEGIN');
    try {
      if (isCurrentlyActive) {
        await client.query('UPDATE user_pets SET is_active = false WHERE id = $1', [userPetId]);
      } else {
        await client.query('UPDATE user_pets SET is_active = false WHERE user_id = $1', [userId]);
        await client.query('UPDATE user_pets SET is_active = true WHERE id = $1', [userPetId]);
      }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    const updatedPet = await client.query('SELECT * FROM user_pets WHERE id = $1', [userPetId]);
    const template = await client.query('SELECT * FROM pets WHERE id = $1', [updatedPet.rows[0].pet_id]);
    const bonus = await getPetBonus(userId);
    res.json({ message: isCurrentlyActive ? '宠物已休息' : '激活成功', pet: await formatPetData(updatedPet.rows[0], template.rows[0]), current_bonus: bonus });
  } catch (error) {
    logger.error('Activate pet error:', { error: error.message });
    res.status(500).json({ error: '操作宠物失败' });
  }
});

// 喂食
router.post('/api/user/pets/:userPetId/feed', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    const { food_item_id, confirm_overflow } = req.body;
    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    if (!food_item_id) return res.status(400).json({ error: '请提供宠物粮 item_id' });

    const petResult = await client.query(
      'SELECT up.*, p.rarity, p.base_bonus, p.name as pet_name, p.icon as pet_icon, p.bonus_curve, p.growth_curve, p.is_test FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1 AND up.user_id = $2',
      [userPetId, userId]
    );
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];

    if (pet.is_test) return res.status(400).json({ error: '测试宠物不能喂食' });

    const foodItem = await client.query('SELECT * FROM items WHERE id = $1 AND item_type = $2', [food_item_id, 'pet_food']);
    if (foodItem.rowCount === 0) return res.status(400).json({ error: '无效的宠物粮' });
    const foodName = foodItem.rows[0].name;
    const foodEffect = PET_FOOD_EFFECTS[foodName];
    if (!foodEffect) return res.status(400).json({ error: '未知的宠物粮类型' });

    const userFood = await client.query('SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2 AND quantity > 0', [userId, food_item_id]);
    if (userFood.rowCount === 0) return res.status(400).json({ error: '你没有该宠物粮' });

    const { currentHunger } = await calcCurrentHunger(pet);
    const hungerMax = await getConfig('hunger_max') || 100;
    const newHungerCalc = currentHunger + foodEffect.hunger;
    if (newHungerCalc > hungerMax && !confirm_overflow) {
      const waste = newHungerCalc - hungerMax;
      return res.status(400).json({ overflow: true, waste, message: `饱食度将溢出 ${waste} 点，确认继续？` });
    }

    await client.query('BEGIN');
    try {
      const newQty = userFood.rows[0].quantity - 1;
      if (newQty <= 0) await client.query('DELETE FROM user_items WHERE user_id = $1 AND item_id = $2', [userId, food_item_id]);
      else await client.query('UPDATE user_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND item_id = $3', [newQty, userId, food_item_id]);

      const newHunger = Math.min(hungerMax, currentHunger + foodEffect.hunger);
      const now = new Date();

      await client.query('UPDATE user_pets SET hunger = $1, last_fed_at = $2 WHERE id = $3',
        [newHunger, now, userPetId]);
      await client.query('COMMIT');

      const updatedPet = await client.query(
        'SELECT up.*, p.rarity, p.base_bonus, p.name, p.icon, p.pixel_art, p.bonus_curve, p.growth_curve, p.is_test, p.effect_file FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1', [userPetId]);
      res.json({
        message: '喂食成功', pet: await formatPetData(updatedPet.rows[0], updatedPet.rows[0]),
        fed_food: foodItem.rows[0].name, hunger_restored: foodEffect.hunger
      });
    } catch (err) { await client.query('ROLLBACK'); throw err; }
  } catch (error) {
    logger.error('Feed pet error:', { error: error.message });
    res.status(500).json({ error: '喂食失败' });
  }
});

// 宠物升级
router.post('/api/user/pets/:userPetId/upgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    const petResult = await client.query(
      'SELECT up.*, p.rarity, p.base_bonus, p.bonus_curve, p.growth_curve, p.is_test FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1 AND up.user_id = $2',
      [userPetId, userId]
    );
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];
    if (pet.is_test) return res.status(400).json({ error: '测试宠物不能升级' });

    const growthCurve = pet.growth_curve;
    if (!growthCurve || !Array.isArray(growthCurve)) return res.status(400).json({ error: '宠物升级数据异常' });
    if (pet.level >= 10) return res.status(400).json({ error: '宠物已达最大等级' });

    const required = growthCurve[pet.level];
    if (required === undefined) return res.status(400).json({ error: '无法继续升级' });
    if ((pet.growth_points || 0) < required) return res.status(400).json({ error: `成长值不足，需要 ${required}，当前 ${pet.growth_points || 0}` });

    let newLevel = pet.level;
    let remaining = pet.growth_points || 0;
    while (newLevel < 10 && growthCurve[newLevel] !== undefined && remaining >= growthCurve[newLevel]) {
      remaining -= growthCurve[newLevel];
      newLevel++;
    }

    await client.query('UPDATE user_pets SET level = $1, growth_points = $2 WHERE id = $3', [newLevel, remaining, userPetId]);
    const template = await client.query('SELECT * FROM pets WHERE id = $1', [pet.pet_id]);
    const updatedPet = await client.query('SELECT * FROM user_pets WHERE id = $1', [userPetId]);
    res.json({ message: newLevel > pet.level ? `升级成功！Lv${pet.level} → Lv${newLevel}` : '升级成功', pet: await formatPetData(updatedPet.rows[0], template.rows[0]) });
  } catch (error) {
    logger.error('Upgrade pet error:', { error: error.message });
    res.status(500).json({ error: '升级宠物失败' });
  }
});

// 装备装饰
router.post('/api/user/pets/:userPetId/equip', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    const { decoration_id, slot_type } = req.body;
    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    if (!decoration_id) return res.status(400).json({ error: '请提供 decoration_id' });
    if (!slot_type) return res.status(400).json({ error: '请提供 slot_type' });
    const validSlots = ['head', 'neck', 'back', 'special'];
    if (!validSlots.includes(slot_type)) return res.status(400).json({ error: '无效的槽位类型' });

    const petResult = await client.query('SELECT up.*, p.is_test, p.name as pet_name FROM user_pets up JOIN pets p ON up.pet_id = p.id WHERE up.id = $1 AND up.user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];

    const decResult = await client.query('SELECT * FROM decorations WHERE id = $1', [decoration_id]);
    if (decResult.rowCount === 0) return res.status(404).json({ error: '装饰不存在' });
    const dec = decResult.rows[0];

    if (pet.is_test && dec.pet_id !== pet.pet_id) {
      return res.status(400).json({ error: '测试宠物只能装备专属饰品' });
    }

    if (dec.pet_id && dec.pet_id !== pet.pet_id) {
      return res.status(400).json({ error: '该饰品不是该宠物的专属饰品' });
    }

    const userDec = await client.query('SELECT * FROM user_decorations WHERE user_id = $1 AND decoration_id = $2 AND quantity > 0', [userId, decoration_id]);
    if (userDec.rowCount === 0) return res.status(400).json({ error: '你没有该装饰' });

    const targetPet = petResult.rows[0];
    const otherPetResult = await client.query(
      `SELECT id, pet_id FROM user_pets WHERE user_id = $1 AND id != $2 AND equipped_decorations @> $3`,
      [userId, userPetId, JSON.stringify({ [slot_type]: decoration_id })]
    );

    await client.query('BEGIN');
    try {
      if (otherPetResult.rowCount > 0) {
        const otherPet = otherPetResult.rows[0];
        const otherEquipped = otherPet.equipped_decorations || {};
        delete otherEquipped[slot_type];
        await client.query('UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2', [JSON.stringify(otherEquipped), otherPet.id]);
      }
      const equipped = targetPet.equipped_decorations || {};
      equipped[slot_type] = decoration_id;
      await client.query('UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2', [JSON.stringify(equipped), userPetId]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    res.json({ message: '装备成功', slot_type, decoration: { id: dec.id, name: dec.name, icon: dec.icon, bonus: Number(dec.bonus) } });
  } catch (error) {
    logger.error('Equip decoration error:', { error: error.message });
    res.status(500).json({ error: '装备装饰失败' });
  }
});

// 卸下装饰
router.post('/api/user/pets/:userPetId/unequip', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPetId = parseInt(req.params.userPetId);
    const { slot_type } = req.body;
    if (isNaN(userPetId)) return res.status(400).json({ error: '无效的宠物ID' });
    if (!slot_type) return res.status(400).json({ error: '请提供 slot_type' });
    const validSlots = ['head', 'neck', 'back', 'special'];
    if (!validSlots.includes(slot_type)) return res.status(400).json({ error: '无效的槽位类型' });
    const petResult = await client.query('SELECT * FROM user_pets WHERE id = $1 AND user_id = $2', [userPetId, userId]);
    if (petResult.rowCount === 0) return res.status(404).json({ error: '宠物不存在' });
    const pet = petResult.rows[0];
    const equipped = pet.equipped_decorations || {};
    if (!equipped[slot_type]) return res.status(400).json({ error: '该槽位没有装备装饰' });
    delete equipped[slot_type];
    await client.query('UPDATE user_pets SET equipped_decorations = $1 WHERE id = $2', [JSON.stringify(equipped), userPetId]);
    res.json({ message: '卸下成功', slot_type });
  } catch (error) {
    logger.error('Unequip decoration error:', { error: error.message });
    res.status(500).json({ error: '卸下装饰失败' });
  }
});

// 获取装饰列表
router.get('/api/decorations', authenticateToken, async (req, res) => {
  try {
    const slotType = req.query.slot_type;
    let query = `SELECT d.id, d.name, d.icon, d.slot_type, d.quality, d.bonus, d.price_type, d.price_amount, d.pet_id, p.name as pet_name FROM decorations d LEFT JOIN pets p ON d.pet_id = p.id`;
    const params = [];
    if (slotType) { query += ' WHERE d.slot_type = $1'; params.push(slotType); }
    query += ' ORDER BY d.quality DESC, d.id';
    const result = await client.query(query, params);
    res.json(result.rows.map(d => ({ id: d.id, name: d.name, icon: d.icon, slot_type: d.slot_type, quality: d.quality, bonus: Number(d.bonus), price_type: d.price_type, price_amount: Number(d.price_amount), pet_id: d.pet_id, pet_name: d.pet_name || null })));
  } catch (error) {
    logger.error('Get decorations error:', { error: error.message });
    res.status(500).json({ error: '获取装饰列表失败' });
  }
});

// 获取用户装饰
router.get('/api/user/decorations', authenticateToken, async (req, res) => {
  try {
    const result = await client.query(
      `SELECT ud.quantity, d.id, d.name, d.icon, d.slot_type, d.quality, d.bonus, d.price_type, d.price_amount, d.pet_id, p.name as pet_name
       FROM user_decorations ud JOIN decorations d ON ud.decoration_id = d.id LEFT JOIN pets p ON d.pet_id = p.id WHERE ud.user_id = $1 AND ud.quantity > 0 ORDER BY d.slot_type, d.quality DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(d => ({ decoration_id: d.id, quantity: d.quantity, name: d.name, icon: d.icon, slot_type: d.slot_type, quality: d.quality, bonus: Number(d.bonus), price_type: d.price_type, price_amount: Number(d.price_amount), pet_id: d.pet_id, pet_name: d.pet_name || null })));
  } catch (error) {
    logger.error('Get user decorations error:', { error: error.message });
    res.status(500).json({ error: '获取用户装饰列表失败' });
  }
});

module.exports = router;

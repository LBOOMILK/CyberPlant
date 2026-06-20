# API 文档

## 基础信息

- **Base URL:** `http://localhost:3000/api`
- **认证方式:** JWT Bearer Token（`Authorization: Bearer <token>`）
- **数据格式:** JSON

## 通用响应

### 成功
```json
{ "message": "操作成功", ... }
```

### 错误
```json
{ "error": "错误描述" }
```

### HTTP 状态码

| 码 | 含义 |
|----|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 一、公共接口（无需认证）

### 1.1 注册

```
POST /api/auth/register
```

**请求体：**
```json
{ "name": "用户名", "email": "邮箱", "password": "密码" }
```

**响应：**
```json
{ "message": "注册成功", "user": { "id", "name", "email", "role" } }
```

### 1.2 登录

```
POST /api/auth/login
```

**请求体：**
```json
{ "email": "邮箱", "password": "密码" }
```

**响应：**
```json
{
  "user": { "id", "name", "email", "role", "is_new_user" },
  "currencies": { "silver_coin", "gold_coin", "diamond" },
  "token": "jwt_token"
}
```

### 1.3 商品列表（无需登录）

```
GET /api/items
```

**响应：** 所有 `is_shop=true` 的物品列表

---

## 二、用户接口（需要 authenticateToken）

### 2.1 认证相关

#### 修改密码
```
POST /api/auth/change-password
Body: { "currentPassword", "newPassword" }
```

#### 领取新手礼包
```
POST /api/user/newbie-pack
Response: { "message", "currencies", "items" }
```

### 2.2 用户信息

#### 获取当前用户
```
GET /api/users/me
Response: { "id", "name", "email", "role", "is_new_user", "currencies", "created_at" }
```

#### 更新个人信息
```
PUT /api/users/me
Body: { "name" }
```

#### 搜索用户
```
GET /api/users/search?q=关键词
```

### 2.3 货币

#### 获取货币余额
```
GET /api/user/currencies
Response: { "silver_coin", "gold_coin", "diamond" }
```

#### 货币兑换
```
POST /api/user/currencies/exchange
Body: { "from_type", "to_type", "amount" }
```

### 2.4 背包

#### 获取背包物品
```
GET /api/user/backpack
Response: { "groups": { "seed": [...], "crop": [...], "fertilizer": [...], "pet_food": [...], "decoration": [...] } }
```

#### 获取用户物品
```
GET /api/user/items
```

### 2.5 商店

#### 获取商店商品
```
GET /api/shop?tab=seeds|fertilizers|pets|pet_food|decorations
Response: [{ "id", "name", "icon", "rarity", "buy_price", "purchasable", "sold_out", ... }]
```

#### 购买物品
```
POST /api/user/shop/purchase
Body: { "item_id", "quantity" }
```

#### 购买宠物
```
POST /api/user/pets/purchase
Body: { "pet_id" }
```

#### 购买饰品
```
POST /api/user/decorations/purchase
Body: { "decoration_id", "quantity" }
```

#### 卖出物品
```
POST /api/user/shop/sell
Body: { "item_id", "quantity" }
```

### 2.6 花园

#### 获取地块信息
```
GET /api/user/plots
Response: [{ "plot_index", "is_unlocked", "level", "seed_id", "stage", "planted_at" }]
```

#### 获取解锁/升级费用
```
GET /api/user/plots/costs
Response: { "unlock_costs", "upgrade_costs" }
```

#### 解锁地块
```
POST /api/user/plots/:plotIndex/unlock
```

#### 升级地块
```
POST /api/user/plots/:plotIndex/upgrade
```

#### 种植
```
POST /api/user/plots/:plotIndex/plant
Body: { "seed_id" }
```

#### 浇水
```
POST /api/user/plots/:plotIndex/water
Response: { "message", "stage", "water_cd", "is_mature" }
```

#### 施肥
```
POST /api/user/plots/:plotIndex/fertilize
Body: { "fertilizer_id" }
```

#### 收获
```
POST /api/user/plots/:plotIndex/harvest
Response: { "harvest_count", "yield", "bonus_yield", "sss_drop" }
```

#### 铲除
```
POST /api/user/plots/:plotIndex/remove
```

#### 花园总览
```
GET /api/garden
Response: { "plots", "currencies" }
```

### 2.7 宠物

#### 获取宠物列表
```
GET /api/user/pets
Response: [{ "user_pet_id", "name", "icon", "level", "current_bonus", "hunger", "is_active", "equipped_decorations" }]
```

#### 获取出战宠物
```
GET /api/user/pets/active
Response: { "pet", "bonus" }
```

#### 激活/休息宠物
```
POST /api/user/pets/:userPetId/activate
```

#### 喂食
```
POST /api/user/pets/:userPetId/feed
Body: { "food_item_id", "confirm_overflow" }
```

#### 升级宠物
```
POST /api/user/pets/:userPetId/upgrade
```

#### 装备饰品
```
POST /api/user/pets/:userPetId/equip
Body: { "decoration_id", "slot_type" }
```

#### 卸下饰品
```
POST /api/user/pets/:userPetId/unequip
Body: { "slot_type" }
```

#### 获取所有饰品
```
GET /api/decorations
```

#### 获取用户饰品
```
GET /api/user/decorations
```

### 2.8 好友

#### 获取好友列表
```
GET /api/user/friends
Response: { "friends", "pending_requests", "sent_requests", "rejected_requests" }
```

#### 发送好友请求
```
POST /api/user/friends
Body: { "friend_id" }
```

#### 接受/拒绝好友请求
```
POST /api/user/friends/:friendshipId
Body: { "action": "accept" | "reject" }
```

#### 删除好友
```
DELETE /api/user/friends/:friendshipId
```

#### 发送礼物
```
POST /api/user/friends/:friendId/gift
Body: { "item_id", "quantity" }
```

#### 获取礼物列表
```
GET /api/user/gifts
```

#### 接受礼物
```
POST /api/user/gifts/:giftId/accept
```

#### 全部接受
```
POST /api/user/gifts/accept-all
```

#### 转账
```
POST /api/user/friends/:friendId/transfer
Body: { "currency_type", "amount" }
```

### 2.9 订单

#### 获取订单记录
```
GET /api/orders?page=1&limit=20
Response: { "orders", "total", "page", "limit" }
```

### 2.10 AI 问答

```
POST /api/ask
Body: { "question" }
Response: { "answer" }
```

---

## 三、管理接口（需要 requireAdmin）

### 3.1 用户管理

#### 获取所有用户
```
GET /api/users
```

#### 创建用户
```
POST /api/users
Body: { "name", "email", "password", "role" }
```

#### 获取用户详情
```
GET /api/users/:id
```

#### 更新用户
```
PUT /api/users/:id
Body: { "name", "email", "password", "role" }
```

#### 删除用户（不能删除自己）
```
DELETE /api/users/:id
```

#### 获取用户背包
```
GET /api/admin/users/:id/backpack
```

#### 删除用户宠物
```
DELETE /api/admin/users/:id/pets/:petId
```

#### 删除用户饰品
```
DELETE /api/admin/users/:id/decorations/:decorationId
```

#### 修改用户货币
```
PUT /api/admin/users/:id/currencies
Body: { "silver_coin", "gold_coin", "diamond" }
```

#### 修改用户物品
```
PUT /api/admin/users/:id/items
Body: { "item_id", "quantity" }
```

#### 获取活跃用户
```
GET /api/admin/active-users
```

### 3.2 物品管理

#### 获取所有物品（含非商店）
```
GET /api/items/all
```

#### 创建物品
```
POST /api/admin/items
Body: { "name", "icon", "rarity", "item_type", "base_yield", "buy_price", "sell_price", "currency_type", "is_shop", "purchasable", "water_cd", "stage_skip" }
```

#### 更新物品
```
PUT /api/admin/items/:id
Body: 同上（部分更新）
```

#### 删除物品
```
DELETE /api/admin/items/:id
```

### 3.3 宠物管理

#### 获取所有宠物
```
GET /api/pets/all
```

#### 创建宠物
```
POST /api/admin/pets
Body: { "name", "icon", "rarity", "base_bonus", "price_amount", "price_type", "is_shop", "purchasable", "is_test", "bonus_curve", "growth_curve", "effect_file" }
```

#### 更新宠物
```
PUT /api/admin/pets/:id
Body: 同上（部分更新）
```

#### 删除宠物
```
DELETE /api/admin/pets/:id
```

#### 获取宠物曲线
```
GET /api/admin/pets/:id/curve
Response: { "bonus_curve", "growth_curve" }
```

#### 更新宠物曲线
```
PUT /api/admin/pets/:id/curve
Body: { "bonus_curve": [10个数值], "growth_curve": [10个数值] }
```

### 3.4 饰品管理

#### 获取所有饰品
```
GET /api/admin/decorations/all
```

#### 创建饰品
```
POST /api/admin/decorations
Body: { "name", "icon", "slot_type", "quality", "bonus", "price_amount", "price_type", "is_shop", "pet_id" }
```

#### 更新饰品
```
PUT /api/admin/decorations/:id
Body: 同上（部分更新）
```

#### 删除饰品
```
DELETE /api/admin/decorations/:id
```

### 3.5 管理员管理

#### 获取管理员列表
```
GET /api/admin/admins
```

#### 添加管理员
```
POST /api/admin/admins
Body: { "email", "password" }
```

#### 删除管理员（不能删除自己，不能删除 ID=1）
```
DELETE /api/admin/admins/:id
```

### 3.6 订单管理

#### 获取所有订单（分页）
```
GET /api/admin/orders?page=1&limit=20
```

#### 删除订单
```
DELETE /api/admin/orders/:id
```

### 3.7 配置管理

#### 获取所有配置
```
GET /api/admin/config
Response: { "configs": { "key": value, ... } }
```

#### 更新配置
```
PUT /api/admin/config
Body: { "key": value } 或 { "key1": val1, "key2": val2 }
```

#### 获取统计信息
```
GET /api/admin/stats
Response: { "total_users", "total_orders", ... }
```

### 3.8 特效管理

#### 获取特效列表
```
GET /api/admin/effects
Response: { "effects": ["bubble-fish.js", "cat-paw.js", ...] }
```

#### 上传特效
```
POST /api/admin/effects/upload
Content-Type: multipart/form-data
Body: file=<.js文件>
```

#### 获取特效内容
```
GET /api/admin/effects/:filename/content
Response: { "content": "文件内容" }
```

#### 更新特效
```
PUT /api/admin/effects/:filename
Body: { "content": "新内容" }
```

#### 删除特效（内置特效不可删）
```
DELETE /api/admin/effects/:filename
```

### 3.9 数据重置

```
POST /api/admin/reset
Response: { "message": "重置成功" }
```

重置当前用户的花园、背包、货币到初始状态，同步特效文件。

---

## 四、特殊机制

### 售罄判定

- `is_shop=false` → 不在商店显示
- `is_shop=true, purchasable=true` → 正常可购买
- `is_shop=true, purchasable=false` → 显示「售罄」

### 浇水冷却

- 默认 5 秒冷却（由物品 `water_cd` 字段控制，最大 240 秒）
- 超过 180 秒未浇水 → 植物干涸死亡

### 宠物饱食度

- 饱食度随时间衰减（默认每 5 秒 -1）
- 饱食度 = 0 时加成暂停
- 喂食恢复饱食度，溢出部分转化为成长值

### SSS 掉落

- 仅 S/SSS 级作物可触发
- 掉落率 = `sss_drop_base × (1 + pet_bonus%)`，上限 `sss_drop_cap`
- 掉落物为 SSS 级种子

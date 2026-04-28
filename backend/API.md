# CyberPlant API 接口文档

## 基本信息

- **基础URL**: `http://localhost:3000`
- **认证方式**: JWT Bearer Token
- **认证Header**: `Authorization: Bearer <token>`
- **数据格式**: JSON
- **物品数量上限**: `MAX_ITEM_COUNT = 999`

***

## 健康检查

### 1. 健康检查

**GET** `/`

**响应** (200):
```json
{ "message": "Backend API is running" }
```

***

## 认证接口

### 2. 用户注册

**POST** `/api/auth/register`

**请求体**:
```json
{
  "name": "用户名",
  "email": "user@example.com",
  "password": "password123"
}
```

**参数说明**:
- `name` (可选): 用户名，默认使用邮箱前缀
- `email` (必填): 邮箱地址
- `password` (必填): 密码

**响应** (201):
```json
{
  "user": {
    "id": "2",
    "name": "用户名",
    "email": "user@example.com",
    "role": "user",
    "points": 100,
    "created_at": "2026-04-28"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**错误响应**:
- 400: `{ "error": "请求体不能为空" }`
- 400: `{ "error": "请填写所有必填字段" }`
- 400: `{ "error": "请输入有效的邮箱地址" }`
- 400: `{ "error": "该邮箱已被注册" }`
- 500: `{ "error": "注册失败，请稍后再试" }`

***

### 3. 用户登录

**POST** `/api/auth/login`

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应** (200):
```json
{
  "user": {
    "id": "2",
    "name": "用户名",
    "email": "user@example.com",
    "role": "user",
    "points": 100,
    "created_at": "2026-04-28"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**错误响应**:
- 400: `{ "error": "请输入邮箱和密码" }`
- 401: `{ "error": "用户不存在" }`
- 401: `{ "error": "密码错误" }`
- 500: `{ "error": "登录失败，请稍后再试" }`

***

### 4. 修改密码

**POST** `/api/auth/change-password`

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

**响应** (200):
```json
{ "message": "密码修改成功" }
```

**错误响应**:
- 400: `{ "error": "请输入当前密码和新密码" }`
- 401: `{ "error": "当前密码错误" }`
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "修改密码失败，请稍后再试" }`

***

## 用户接口

### 5. 获取所有用户列表 (管理员)

**GET** `/api/users`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**响应** (200):
```json
[
  {
    "id": "2",
    "name": "用户",
    "email": "user@example.com",
    "role": "user",
    "points": 100,
    "seeds": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
    "crops": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
    "uses": { "C": 0, "B": 0, "A": 0, "S": 0 },
    "created_at": "2026-04-28",
    "last_login_at": "2026-04-28T12:00:00.000Z"
  }
]
```

**错误响应**:
- 500: `{ "error": "获取用户列表失败，请稍后再试" }`

***

### 6. 添加用户 (管理员)

**POST** `/api/users`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "role": "user",
  "points": 100
}
```

**响应** (201):
```json
{
  "id": "2",
  "name": "user",
  "email": "user@example.com",
  "role": "user",
  "points": 100,
  "seeds": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
  "crops": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
  "uses": { "C": 0, "B": 0, "A": 0, "S": 0 },
  "created_at": "2026-04-28T12:00:00.000Z"
}
```

**错误响应**:
- 400: `{ "error": "请填写所有必填字段" }`
- 400: `{ "error": "两次输入的密码不一致" }`
- 400: `{ "error": "该邮箱已被注册" }`
- 500: `{ "error": "创建用户失败，请稍后再试" }`

***

### 7. 获取当前用户信息

**GET** `/api/users/me`

**请求头**: `Authorization: Bearer <token>`

**响应** (200):
```json
{
  "id": "2",
  "name": "用户",
  "email": "user@example.com",
  "role": "user",
  "points": 100,
  "seeds": { "C": 5, "A": 2 },
  "crops": { "B": 3 },
  "uses": { "C": 1 },
  "created_at": "2026-04-28"
}
```

**说明**: 返回的背包数据只包含数量>0的物品

**错误响应**:
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "获取用户信息失败，请稍后再试" }`

***

### 8. 更新当前用户信息

**PUT** `/api/users/me`

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "name": "新用户名"
}
```

**响应** (200):
```json
{
  "id": "2",
  "name": "新用户名",
  "email": "user@example.com",
  "role": "user",
  "points": 100,
  "created_at": "2026-04-28"
}
```

**错误响应**:
- 400: `{ "error": "请填写用户名" }`
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "更新用户信息失败，请稍后再试" }`

***

### 9. 获取单个用户 (管理员)

**GET** `/api/users/:id`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求参数**:
- `id` (必填): 用户ID

**响应** (200):
```json
{
  "id": "2",
  "name": "用户",
  "email": "user@example.com",
  "role": "user",
  "points": 100,
  "seeds": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
  "crops": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
  "uses": { "C": 0, "B": 0, "A": 0, "S": 0 },
  "created_at": "2026-04-28"
}
```

**错误响应**:
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "获取用户数据失败，请稍后再试" }`

***

### 10. 更新用户 (管理员)

**PUT** `/api/users/:id`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求参数**:
- `id` (必填): 用户ID

**请求体**:
```json
{
  "name": "用户名",
  "email": "user@example.com",
  "role": "user",
  "points": 100,
  "seeds": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
  "crops": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
  "uses": { "C": 0, "B": 0, "A": 0, "S": 0 },
  "password": "newpassword"
}
```

**说明**: 
- 背包数量会被裁剪到 MAX_ITEM_COUNT (999)
- uses 字段不支持 SSS 等级

**响应** (200): 返回更新后的用户对象

**错误响应**:
- 400: `{ "error": "请填写邮箱" }`
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "更新用户失败，请稍后再试" }`

***

### 11. 删除用户 (管理员)

**DELETE** `/api/users/:id`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求参数**:
- `id` (必填): 用户ID

**说明**: 
- id为1的管理员无法被删除
- 管理员不能删除自己

**响应** (200):
```json
{ "message": "用户删除成功" }
```

**错误响应**:
- 404: `{ "error": "用户不存在" }`
- 400: `{ "error": "id为1的管理员无法被删除" }`
- 400: `{ "error": "不能删除自己" }`
- 500: `{ "error": "删除用户失败，请稍后再试" }`

***

## 植物/商品接口

### 12. 获取所有商品

**GET** `/api/plants`

**响应** (200):
```json
[
  {
    "id": 1,
    "name": "普通种子",
    "icon": "🌱",
    "rarity": "C",
    "price": 10,
    "plants_role": "seed",
    "created_at": "2026-04-28T12:00:00.000Z"
  },
  {
    "id": 6,
    "name": "普通肥料",
    "icon": "💩",
    "rarity": "C",
    "price": 20,
    "plants_role": "use",
    "created_at": "2026-04-28T12:00:00.000Z"
  }
]
```

**错误响应**:
- 500: `{ "error": "获取植物列表失败，请稍后再试" }`

***

### 13. 添加商品 (管理员)

**POST** `/api/plants`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求体**:
```json
{
  "name": "新种子",
  "icon": "🌱",
  "rarity": "C",
  "price": 10,
  "plants_role": "seed"
}
```

**响应** (201):
```json
{
  "id": 10,
  "name": "新种子",
  "icon": "🌱",
  "rarity": "C",
  "price": 10,
  "plants_role": "seed",
  "created_at": "2026-04-28T12:00:00.000Z"
}
```

**错误响应**:
- 400: `{ "error": "请填写所有必填字段" }`
- 500: `{ "error": "创建植物失败，请稍后再试" }`

***

### 14. 更新商品 (管理员)

**PUT** `/api/plants/:id`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求参数**:
- `id` (必填): 商品ID

**请求体**:
```json
{
  "name": "更新后的种子",
  "icon": "🌱",
  "rarity": "C",
  "price": 15,
  "plants_role": "seed"
}
```

**响应** (200): 返回更新后的商品对象

**错误响应**:
- 400: `{ "error": "请填写所有必填字段" }`
- 404: `{ "error": "植物不存在" }`
- 500: `{ "error": "更新植物失败，请稍后再试" }`

***

### 15. 删除商品 (管理员)

**DELETE** `/api/plants/:id`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求参数**:
- `id` (必填): 商品ID

**响应** (200):
```json
{ "message": "植物删除成功" }
```

**错误响应**:
- 404: `{ "error": "植物不存在" }`
- 500: `{ "error": "删除植物失败，请稍后再试" }`

***

## 用户背包接口

### 16. 获取背包数据

**GET** `/api/user/backpack`

**请求头**: `Authorization: Bearer <token>`

**响应** (200):
```json
{
  "seeds": { "C": 5, "A": 2 },
  "crops": { "B": 3 },
  "uses": { "C": 1 }
}
```

**错误响应**:
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "获取背包数据失败，请稍后再试" }`

***

### 17. 获取卖出价格

**GET** `/api/user/sell-price`

**请求头**: `Authorization: Bearer <token>`

**查询参数**:
- `itemType` (必填): 物品类型 (seed/use/crop)
- `rarity` (必填): 稀有度

**定价规则**:
| 物品类型 | 定价规则 |
|---------|---------|
| `seed` | 同品质种子最低价 × 50% |
| `use` | 同品质肥料最低价 × 50% |
| `crop` | 同品质种子最高价 × 200% |

**响应** (200):
```json
{
  "rarity": "C",
  "itemType": "seed",
  "minBuyPrice": 10,
  "sellPrice": 5
}
```

**错误响应**:
- 400: `{ "error": "请提供物品类型和稀有度" }`
- 400: `{ "error": "不支持的物品类型" }`
- 404: `{ "error": "未找到该物品" }`
- 500: `{ "error": "获取卖出价格失败，请稍后再试" }`

***

### 18. 购买种子

**POST** `/api/user/seeds`

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "rarity": "C",
  "price": 10,
  "quantity": 1
}
```

**参数说明**:
- `rarity` (必填): 稀有度
- `price` (必填): 单价
- `quantity` (可选): 购买数量，默认1，最大99

**响应** (201):
```json
{
  "rarity": "C",
  "quantity": 6,
  "points": 90
}
```

**错误响应**:
- 400: `{ "error": "请提供种子稀有度和价格" }`
- 400: `{ "error": "积分不足" }`
- 400: `{ "error": "种子数量已达上限(999)" }`
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "添加种子失败，请稍后再试" }`

***

### 19. 卖出种子

**DELETE** `/api/user/seeds/:rarity`

**请求头**: `Authorization: Bearer <token>`

**请求参数**:
- `rarity` (必填): 稀有度

**请求体**:
```json
{
  "quantity": 1
}
```

**说明**: 价格由后端自动计算（同品质种子最低价的50%）

**响应** (200):
```json
{
  "rarity": "C",
  "quantity": 5,
  "points": 105
}
```

**错误响应**:
- 400: `{ "error": "无法计算种子价格" }`
- 404: `{ "error": "用户不存在" }`
- 404: `{ "error": "种子不存在或数量不足" }`
- 500: `{ "error": "卖出种子失败，请稍后再试" }`

***

### 20. 购买肥料

**POST** `/api/user/uses`

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "rarity": "C",
  "price": 20,
  "quantity": 1
}
```

**参数说明**:
- `rarity` (必填): 稀有度 (C/B/A/S，无SSS)
- `price` (必填): 单价
- `quantity` (可选): 购买数量，默认1，最大99

**说明**: 订单创建在事务之外

**响应** (201):
```json
{
  "rarity": "C",
  "quantity": 2,
  "points": 80
}
```

**错误响应**:
- 400: `{ "error": "请提供物品稀有度和价格" }`
- 400: `{ "error": "积分不足" }`
- 400: `{ "error": "肥料数量已达上限(999)" }`
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "添加物品失败，请稍后再试" }`

***

### 21. 卖出肥料

**DELETE** `/api/user/uses/:rarity`

**请求头**: `Authorization: Bearer <token>`

**请求参数**:
- `rarity` (必填): 稀有度

**请求体**:
```json
{
  "quantity": 1
}
```

**说明**: 价格由后端自动计算（同品质肥料最低价的50%）

**响应** (200):
```json
{
  "rarity": "C",
  "quantity": 1,
  "points": 110
}
```

**错误响应**:
- 400: `{ "error": "无法计算肥料价格" }`
- 404: `{ "error": "用户不存在" }`
- 404: `{ "error": "肥料不存在或数量不足" }`
- 500: `{ "error": "卖出肥料失败，请稍后再试" }`

***

### 22. 添加作物

**POST** `/api/user/crops`

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "rarity": "C"
}
```

**响应** (201):
```json
{
  "rarity": "C",
  "quantity": 1
}
```

**错误响应**:
- 400: `{ "error": "请提供作物稀有度" }`
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "添加作物失败，请稍后再试" }`

***

### 23. 卖出作物

**DELETE** `/api/user/crops/:rarity`

**请求头**: `Authorization: Bearer <token>`

**请求参数**:
- `rarity` (必填): 稀有度

**请求体**:
```json
{
  "quantity": 1
}
```

**说明**: 价格由后端自动计算（同品质种子最高价的200%）

**响应** (200):
```json
{
  "rarity": "C",
  "quantity": 2,
  "points": 120
}
```

**错误响应**:
- 400: `{ "error": "无法计算作物价格" }`
- 404: `{ "error": "用户不存在" }`
- 404: `{ "error": "作物不存在或数量不足" }`
- 500: `{ "error": "卖出作物失败，请稍后再试" }`

***

### 24. 更新用户积分

**PUT** `/api/user/points`

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "points": 200
}
```

**响应** (200):
```json
{
  "points": 200
}
```

**错误响应**:
- 400: `{ "error": "请提供积分值" }`
- 500: `{ "error": "更新积分失败，请稍后再试" }`

***

## 订单接口

### 25. 获取用户订单

**GET** `/api/orders`

**请求头**: `Authorization: Bearer <token>`

**查询参数**:
- `page` (可选): 页码，默认1
- `limit` (可选): 每页数量，默认10

**响应** (200):
```json
{
  "orders": [
    {
      "id": "uuid",
      "user_id": 2,
      "type": "PURCHASE_SEED",
      "amount": -10,
      "created_at": "2026-04-28 12:00:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

**错误响应**:
- 500: `{ "error": "获取订单列表失败，请稍后再试" }`

***

## 花园接口

### 26. 获取花园状态

**GET** `/api/garden`

**请求头**: `Authorization: Bearer <token>`

**响应** (200):
```json
{
  "hasPlant": true,
  "plant": {
    "id": 1,
    "seedId": 1,
    "rarity": "C",
    "stage": 3,
    "lastWateredAt": "2026-04-28T12:00:00.000Z",
    "createdAt": "2026-04-28T12:00:00.000Z"
  },
  "isWilted": false,
  "canHarvest": false
}
```

或 (无植物时):
```json
{
  "hasPlant": false
}
```

**说明**:
- `isWilted`: 五阶段前1分钟不浇水则枯萎
- `canHarvest`: 五阶段且未枯萎时可收获

**错误响应**:
- 500: `{ "error": "获取花园状态失败，请稍后再试" }`

***

### 27. 种植种子

**POST** `/api/garden/plant`

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "rarity": "C"
}
```

**说明**: 会扣除背包中对应稀有度的种子1个

**响应** (200):
```json
{
  "message": "种植成功"
}
```

**错误响应**:
- 400: `{ "error": "请提供种子稀有度" }`
- 400: `{ "error": "种子数量不足" }`
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "种植失败，请稍后再试" }`

***

### 28. 浇水

**POST** `/api/garden/water`

**请求头**: `Authorization: Bearer <token>`

**响应** (200):
```json
{
  "message": "浇水成功",
  "stage": 4
}
```

**说明**:
- 成熟植物（5阶段）冷却时间5分钟
- 其他阶段冷却时间5秒
- 未枯萎且阶段<5时，浇水后阶段+1

**错误响应**:
- 400: `{ "error": "浇水过于频繁，请等待 X 秒" }`
- 404: `{ "error": "花园不存在" }`
- 500: `{ "error": "浇水失败，请稍后再试" }`

***

### 29. 施肥

**POST** `/api/garden/fertilize`

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "rarity": "C"
}
```

**肥料效果**:
| 稀有度 | 提升阶段数 |
|-------|----------|
| C | 1 |
| B | 2 |
| A | 3 |
| S | 4 |

**说明**:
- 施肥可绕过冷却时间
- 只能在植物生长阶段（1-4阶段）进行
- 枯萎植物需先浇水才能施肥

**响应** (200):
```json
{
  "message": "施肥成功",
  "stage": 5
}
```

**错误响应**:
- 400: `{ "error": "请提供肥料稀有度" }`
- 400: `{ "error": "无效的肥料等级" }`
- 400: `{ "error": "施肥只能在植物生长阶段（1-4阶段）进行" }`
- 400: `{ "error": "植物已枯萎，请先浇水复活" }`
- 400: `{ "error": "肥料不足" }`
- 404: `{ "error": "花园不存在" }`
- 404: `{ "error": "用户不存在" }`
- 500: `{ "error": "施肥失败，请稍后再试" }`

***

### 30. 收获作物

**POST** `/api/garden/harvest`

**请求头**: `Authorization: Bearer <token>`

**响应** (200):
```json
{
  "message": "收获成功",
  "crop": "C"
}
```

**说明**:
- 植物需达到5阶段且未枯萎才能收获
- 收获后作物加入背包
- 背包中对应等级作物达到上限时无法收获

**错误响应**:
- 400: `{ "error": "植物尚未成熟" }`
- 400: `{ "error": "植物已枯萎" }`
- 400: `{ "error": "背包中X级作物已达上限(999)，请先清理背包再收获" }`
- 404: `{ "error": "花园不存在" }`
- 500: `{ "error": "收获失败，请稍后再试" }`

***

### 31. 铲除植物

**DELETE** `/api/garden/remove`

**请求头**: `Authorization: Bearer <token>`

**说明**: 已成熟的植物（5阶段）需先收获才能铲除

**响应** (200):
```json
{
  "message": "铲除成功"
}
```

**错误响应**:
- 400: `{ "error": "植物已成熟，请先收获" }`
- 404: `{ "error": "花园不存在" }`
- 500: `{ "error": "铲除失败，请稍后再试" }`

***

## 管理员专用接口

### 32. 创建管理员用户

**POST** `/api/admin/users`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求体**:
```json
{
  "name": "Admin",
  "email": "admin@example.com",
  "password": "password123"
}
```

**响应** (201):
```json
{
  "message": "管理员用户创建成功",
  "userId": "3"
}
```

**错误响应**:
- 400: `{ "error": "请填写所有必填字段" }`
- 400: `{ "error": "请输入有效的邮箱地址" }`
- 400: `{ "error": "该邮箱已被注册" }`
- 500: `{ "error": "创建管理员用户失败，请稍后再试" }`

***

### 33. 获取今日活跃用户数

**GET** `/api/admin/active-users`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**响应** (200):
```json
{
  "count": 5
}
```

**说明**: 返回今天登录过的普通用户数量

**错误响应**:
- 500: `{ "error": "获取活跃用户数失败" }`

***

### 34. 获取所有订单 (管理员)

**GET** `/api/admin/orders`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**查询参数**:
- `page` (可选): 页码，默认1
- `limit` (可选): 每页数量，默认10

**响应** (200):
```json
{
  "orders": [
    {
      "id": "uuid",
      "user_id": 2,
      "type": "PURCHASE_SEED",
      "amount": -10,
      "created_at": "2026-04-28 12:00:00",
      "user": {
        "id": 2,
        "name": "用户",
        "email": "user@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 10,
    "totalPages": 1
  }
}
```

**错误响应**:
- 500: `{ "error": "获取订单列表失败，请稍后再试" }`

***

### 35. 删除订单 (管理员)

**DELETE** `/api/admin/orders/:id`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求参数**:
- `id` (必填): 订单ID

**响应** (200):
```json
{
  "message": "订单删除成功"
}
```

**错误响应**:
- 404: `{ "error": "订单不存在" }`
- 500: `{ "error": "删除订单失败，请稍后再试" }`

***

## 订单类型说明

| 类型 | 说明 |
|-----|------|
| `PURCHASE_SEED` | 购买种子 |
| `SELL_SEED` | 卖出种子 |
| `PURCHASE_USE` | 购买肥料 |
| `SELL_USE` | 卖出肥料 |
| `SELL_CROP` | 卖出作物 |

***

## 稀有度说明

| 稀有度 | 标识 | 说明 |
|-------|-----|------|
| C | 灰色 | 普通 |
| B | 绿色 | 稀有 |
| A | 蓝色 | 史诗 |
| S | 紫色 | 传说 |
| SSS | 金色 | 神级 |

**注意**: 肥料不包含 SSS 等级

***

## 错误响应格式

所有错误响应都遵循以下格式：
```json
{
  "error": "错误信息描述"
}
```

常见状态码：
- `400`: 请求参数错误
- `401`: 未认证或认证失败
- `403`: 权限不足
- `404`: 资源不存在
- `500`: 服务器内部错误

***

## 数据库表结构

### users 表

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | VARCHAR(50) | 主键，奇数为管理员，偶数为普通用户 |
| email | VARCHAR(255) | 邮箱，唯一 |
| name | VARCHAR(255) | 用户名 |
| password | VARCHAR(255) | bcrypt加密密码 |
| role | VARCHAR(50) | 角色 (user/admin) |
| points | INT | 积分 |
| seeds | JSONB | 种子背包 `{ C: 0, B: 0, A: 0, S: 0, SSS: 0 }` |
| crops | JSONB | 作物背包 `{ C: 0, B: 0, A: 0, S: 0, SSS: 0 }` |
| uses | JSONB | 肥料背包 `{ C: 0, B: 0, A: 0, S: 0 }` |
| last_login_at | TIMESTAMP | 最后登录时间 |
| created_at | TIMESTAMP | 创建时间 |

### plants 表

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | SERIAL | 主键 |
| name | VARCHAR(255) | 商品名称 |
| icon | VARCHAR(50) | 图标 |
| rarity | VARCHAR(50) | 稀有度 |
| price | INT | 价格 |
| plants_role | VARCHAR(50) | 类型 (seed/use) |
| created_at | TIMESTAMP | 创建时间 |

### orders 表

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | UUID | 主键 |
| user_id | VARCHAR(50) | 用户ID |
| type | VARCHAR(50) | 订单类型 |
| amount | INT | 积分变化（负数为消费，正数为收入） |
| created_at | TIMESTAMP | 创建时间 |

### garden 表

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | SERIAL | 主键 |
| user_id | INTEGER | 用户ID（唯一） |
| seed_id | INTEGER | 种子ID |
| rarity | VARCHAR(50) | 稀有度 |
| stage | INT | 生长阶段 (0-5) |
| last_watered_at | TIMESTAMP | 最后浇水时间 |
| created_at | TIMESTAMP | 创建时间 |
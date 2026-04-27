# CyberPlant API 接口文档

## 基本信息

- **基础URL**: `http://localhost:3000`
- **认证方式**: JWT Bearer Token
- **认证Header**: `Authorization: Bearer <token>`
- **数据格式**: JSON

***

## 认证接口

### 1. 用户注册

**POST** `/api/auth/register`

**请求体**:

```json
{
  "name": "用户名",
  "email": "user@example.com",
  "password": "password123"
}
```

**响应** (201):

```json
{
  "user": {
    "id": "2",
    "name": "用户名",
    "email": "user@example.com",
    "role": "user",
    "points": 100,
    "seeds": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
    "crops": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
    "uses": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 }
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**错误响应** (400):

```json
{ "error": "该邮箱已被注册" }
```

***

### 2. 用户登录

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
    "points": 100
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**错误响应** (401):

```json
{ "error": "密码错误" }
```

***

### 3. 修改密码

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

***

## 用户接口

### 4. 获取当前用户信息

**GET** `/api/users/me`

**请求头**: `Authorization: Bearer <token>`

**响应** (200):

```json
{
  "id": "2",
  "name": "用户名",
  "email": "user@example.com",
  "role": "user",
  "points": 100,
  "seeds": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
  "crops": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
  "uses": { "C": 0, "B": 0, "A": 0, "S": 0, "SSS": 0 },
  "created_at": "2026-04-09"
}
```

***

### 5. 更新当前用户信息

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
  "role": "user"
}
```

***

### 6. 更新用户积分

**PUT** `/api/user/points`

**请求头**: `Authorization: Bearer <token>`

**请求体**:

```json
{
  "points": 500
}
```

**响应** (200):

```json
{ "message": "积分更新成功" }
```

***

## 商城接口

### 7. 获取所有商品

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
    "plants_role": "seed"
  },
  {
    "id": 6,
    "name": "普通肥料",
    "icon": "💩",
    "rarity": "C",
    "price": 20,
    "plants_role": "use"
  }
]
```

***

## 背包接口

### 8. 购买种子

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
- `rarity`: 稀有度 (C, B, A, S, SSS)
- `price`: 单价（种子买入价：C=10, B=30, A=50, S=100, SSS=300，卖出价为买入价的2倍）
- `quantity`: 购买数量 (默认1，最大99)

**响应** (201):

```json
{
  "rarity": "C",
  "quantity": 6,
  "points": 60
}
```

**错误响应** (400):

```json
{ "error": "积分不足" }
```

***

### 9. 购买肥料

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
- `rarity`: 稀有度 (C, B, A, S, SSS)
- `price`: 单价（根据稀有度：C=20, B=60, A=100, S=200, SSS=600，肥料买卖价格相同）
- `quantity`: 购买数量 (默认1，最大99)

**响应** (201):

```json
{
  "rarity": "C",
  "quantity": 1,
  "points": 40
}
```

***

## 订单接口

### 10. 获取用户订单列表

**GET** `/api/orders`

**请求头**: `Authorization: Bearer <token>`

**查询参数**:

- `page`: 页码 (默认1)
- `limit`: 每页数量 (默认10)

**响应** (200):

```json
{
  "orders": [
    {
      "id": "uuid",
      "user_id": 2,
      "type": "PURCHASE_SEED",
      "amount": -10,
      "created_at": "2026-04-09 14:46:20"
    },
    {
      "id": "uuid",
      "user_id": 2,
      "type": "PURCHASE_USE",
      "amount": -20,
      "created_at": "2026-04-09 14:50:30"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

**订单类型说明**:
- `PURCHASE_SEED`: 购买种子
- `PURCHASE_USE`: 购买肥料（肥料买卖价格相同，无积分盈利）
- `SELL_SEED`: 卖出种子
- `SELL_CROP`: 卖出作物

***

## 花园接口

### 12. 获取花园信息

**GET** `/api/garden`

**请求头**: `Authorization: Bearer <token>`

**响应** (200):

```json
{
  "plants": [
    {
      "id": 1,
      "user_id": 2,
      "seed_id": 1,
      "rarity": "C",
      "stage": 1,
      "last_watered_at": "2026-04-09T14:46:20.711Z",
      "created_at": "2026-04-09T14:46:20.711Z"
    }
  ]
}
```

***

### 13. 种植种子

**POST** `/api/garden/plant`

**请求头**: `Authorization: Bearer <token>`

**请求体**:

```json
{
  "seedId": 1
}
```

**响应** (200):

```json
{
  "message": "种植成功",
  "plant": {
    "id": 1,
    "user_id": 2,
    "seed_id": 1,
    "rarity": "C",
    "stage": 1
  }
}
```

***

### 14. 浇水

**POST** `/api/garden/water`

**请求头**: `Authorization: Bearer <token>`

**请求体**:

```json
{
  "plantId": 1
}
```

**响应** (200):

```json
{
  "message": "浇水成功",
  "growthBonus": 1
}
```

***

### 15. 收获

**POST** `/api/garden/harvest`

**请求头**: `Authorization: Bearer <token>`

**请求体**:

```json
{
  "plantId": 1
}
```

**响应** (200):

```json
{
  "message": "收获成功！获得 1 个 A 级作物",
  "crop": {
    "rarity": "A",
    "quantity": 1
  }
}
```

***

### 16. 移除植物

**DELETE** `/api/garden/remove`

**请求头**: `Authorization: Bearer <token>`

**请求体**:

```json
{
  "plantId": 1
}
```

**响应** (200):

```json
{
  "message": "移除成功"
}
```

***

## 管理员接口

### 17. 获取所有用户 (管理员)

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
    "seeds": {},
    "crops": {},
    "uses": {}
  }
]
```

***

### 18. 获取所有订单 (管理员)

**GET** `/api/admin/orders`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**响应** (200):

```json
{
  "orders": [
    {
      "id": "uuid",
      "user_id": 2,
      "user_name": "用户",
      "type": "PURCHASE_SEED",
      "amount": -10,
      "created_at": "2026-04-09 14:46:20"
    }
  ]
}
```

***

### 19. 删除订单 (管理员)

**DELETE** `/api/admin/orders/:id`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**响应** (200):

```json
{
  "message": "订单删除成功"
}
```

***

### 20. 添加商品 (管理员)

**POST** `/api/plants`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求体**:

```json
{
  "name": "普通种子",
  "icon": "🌱",
  "rarity": "C",
  "price": 10,
  "plants_role": "seed"
}
```

**响应** (201):

```json
{
  "message": "商品添加成功"
}
```

***

### 21. 更新商品 (管理员)

**PUT** `/api/plants/:id`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**请求体**:

```json
{
  "name": "新版普通种子",
  "price": 15
}
```

**响应** (200):

```json
{
  "message": "商品更新成功"
}
```

***

### 22. 删除商品 (管理员)

**DELETE** `/api/plants/:id`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**响应** (200):

```json
{
  "message": "商品删除成功"
}
```

***

### 23. 获取今日活跃用户数 (管理员)

**GET** `/api/admin/active-users`

**请求头**: `Authorization: Bearer <token>` (需管理员权限)

**响应** (200):

```json
{
  "count": 3
}
```

**说明**: 返回今天登录过的普通用户数量

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

| 字段              | 类型           | 说明              |
| --------------- | ------------ | --------------- |
| id              | VARCHAR(50)  | 主键              |
| email           | VARCHAR(255) | 邮箱，唯一           |
| name            | VARCHAR(255) | 用户名             |
| password        | VARCHAR(255) | 加密密码            |
| role            | VARCHAR(50)  | 角色 (user/admin) |
| points          | INT          | 积分              |
| seeds           | JSONB        | 种子背包            |
| crops           | JSONB        | 作物背包            |
| uses            | JSONB        | 可使用物品背包         |
| last\_login\_at | TIMESTAMP    | 最后登录时间          |
| created\_at     | TIMESTAMP    | 创建时间            |

### plants 表

| 字段           | 类型           | 说明                 |
| ------------ | ------------ | ------------------ |
| id           | SERIAL       | 主键                 |
| name         | VARCHAR(255) | 商品名称               |
| icon         | VARCHAR(50)  | 图标                 |
| rarity       | VARCHAR(50)  | 稀有度                |
| price        | INT          | 价格                 |
| plants\_role | VARCHAR(50)  | 角色 (seed/crop/use) |
| created\_at  | TIMESTAMP    | 创建时间               |

### orders 表

| 字段          | 类型          | 说明   |
| ----------- | ----------- | ---- |
| id          | UUID        | 主键   |
| user\_id    | INT         | 用户ID |
| type        | VARCHAR(50) | 订单类型 |
| amount      | INT         | 积分变化 |
| created\_at | TIMESTAMP   | 创建时间 |

### garden 表

| 字段                | 类型          | 说明     |
| ----------------- | ----------- | ------ |
| id                | SERIAL      | 主键     |
| user\_id          | INT         | 用户ID   |
| seed\_id          | INT         | 种子ID   |
| rarity            | VARCHAR(50) | 稀有度    |
| stage             | INT         | 生长阶段   |
| last\_watered\_at | TIMESTAMP   | 最后浇水时间 |
| created\_at       | TIMESTAMP   | 创建时间   |

***

## 稀有度说明

| 稀有度 | 标识 | 说明 |
| --- | -- | -- |
| C   | 灰色 | 普通 |
| B   | 绿色 | 稀有 |
| A   | 蓝色 | 史诗 |
| S   | 紫色 | 传说 |
| SSS | 金色 | 神级 |


# 技术栈

## 运行环境

- **Node.js** v18+
- **PostgreSQL** 14+
- **操作系统** Windows + WSL2 (Ubuntu)

## 核心依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| express | ^4.x | Web 框架 |
| pg | ^8.x | PostgreSQL 驱动 |
| jsonwebtoken | ^9.x | JWT 认证 |
| bcrypt | ^5.x | 密码哈希 |
| cors | ^2.x | 跨域 |
| helmet | ^7.x | 安全头 |
| multer | ^1.x | 文件上传（特效管理） |
| dotenv | ^16.x | 环境变量 |
| uuid | ^9.x | UUID 生成 |

## 数据库

### 连接方式

```js
const client = new Client({
  connectionString: process.env.DATABASE_URL
});
```

### 核心表结构

| 表名 | 说明 |
|------|------|
| `users` | 用户账号（id, name, email, password, role, is_new_user） |
| `currencies` | 用户货币（silver_coin, gold_coin, diamond, yield_accumulator） |
| `items` | 物品定义（种子/作物/肥料/宠物粮/饰品） |
| `user_items` | 用户背包物品 |
| `garden_plots` | 花园地块（stage, planted_at, is_dead, fertilized） |
| `pets` | 宠物模板（bonus_curve, growth_curve, effect_file） |
| `user_pets` | 用户宠物（level, growth_points, hunger, equipped_decorations） |
| `decorations` | 饰品定义（slot_type, bonus） |
| `user_decorations` | 用户饰品 |
| `friendships` | 好友关系 |
| `gifts` | 礼物记录 |
| `orders` | 交易订单 |
| `global_config` | 全局配置键值对 |

### 数据库初始化

`initDatabase()` 在服务器启动时自动执行：
- 表不存在则创建（`CREATE TABLE IF NOT EXISTS`）
- 首次启动插入默认物品、宠物、配置数据
- 后续启动跳过已有数据

## 认证机制

### JWT Token

```
Authorization: Bearer <token>
```

Token 有效期：24 小时

### 中间件

- `authenticateToken` — 验证 JWT，解析 user.id/email/role
- `requireAdmin` — 检查 user.role === 'admin'

## 项目结构

```
backend/
├── index.js              # 入口：Express 初始化 + 路由挂载 + 静态文件
├── db.js                 # 数据库连接 + 工具函数 + 常量
├── middleware.js          # JWT 认证 + 管理员权限中间件
├── init.js               # 数据库初始化（initDatabase）
├── utils/logger.js       # 日志工具（Winston-style）
├── routes/
│   ├── public/           # 无需认证
│   │   ├── auth.js       # 注册、登录
│   │   └── index.js      # 汇总
│   ├── user/             # 需要 authenticateToken
│   │   ├── auth.js       # 修改密码
│   │   ├── shop.js       # 商店、货币、背包
│   │   ├── garden.js     # 花园地块操作
│   │   ├── pet.js        # 宠物、装饰
│   │   ├── friend.js     # 好友、礼物、转账
│   │   ├── order.js      # 订单查询
│   │   ├── ai.js         # AI 问答
│   │   └── index.js      # 汇总
│   └── admin/            # 需要 requireAdmin
│       ├── user.js       # 用户管理
│       ├── item.js       # 物品管理
│       ├── pet.js        # 宠物管理
│       ├── decoration.js # 饰品管理
│       ├── order.js      # 订单管理
│       ├── config.js     # 全局配置
│       ├── effect.js     # 特效管理
│       ├── reset.js      # 数据重置
│       ├── admin.js      # 管理员管理
│       └── index.js      # 汇总
├── effects/              # 宠物特效文件（服务端存储）
└── _deprecated/          # 已废弃的旧路由文件
```

## 配置管理

全局配置存储在 `global_config` 表，通过 `getConfig(key)` 读取（带 30 秒缓存）。

### 默认配置项

| Key | 默认值 | 说明 |
|-----|--------|------|
| `hunger_max` | 100 | 饱食度上限 |
| `hunger_decay_interval` | 5 | 饱食度衰减间隔（秒） |
| `sss_drop_base` | 0.33 | SSS 基础掉落率 |
| `sss_drop_cap` | 1.0 | SSS 掉落率上限 |
| `friend_gift_cooldown_hours` | 24 | 好友互送冷却（小时） |
| `account_gift_cooldown_hours` | 24 | 新号送礼冷却（小时） |
| `pet_deco_bonus_cap` | 120 | 宠物装饰加成上限（已废弃） |

## 货币体系

| 货币 | 获取方式 | 用途 |
|------|----------|------|
| silver_coin | 卖作物、新手礼包 | 买基础种子 |
| gold_coin | 卖高级作物 | 买高级种子、肥料 |
| diamond | 卖稀有作物、充值 | 买宠物、饰品 |

货币兑换：100 银币 = 1 金币，100 金币 = 1 钻石

## 宠物系统

### 加成计算

```
bonus = bonus_curve[level - 1] + decoration_bonus
totalBonus = min(bonus, cap)  // cap 已废弃，直接用 bonus
```

### 饱食度衰减

```
decay = floor(elapsed / (interval * 1000))
currentHunger = max(0, hunger - decay)
```

### 成长值

```
growthGained = decay  // 每点饱食度衰减 = 1 成长值
level_up when growth_points >= growth_curve[level]
```

## 累加值系统

收获时计算产量：
```
exactYield = baseYield × levelMultiplier × bonusMultiplier
decimal = exactYield - floor(exactYield)  // 小数部分
accumulator[rarity] += decimal
bonusYield = floor(accumulator[rarity])   // 满1则+1
accumulator[rarity] -= bonusYield         // 保留余数
```

按稀有度分别累积，存储在 `currencies.yield_accumulator` JSONB 字段。

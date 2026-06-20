# Backend - 赛博花园

Node.js + Express + PostgreSQL 后端服务。

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 设置 DATABASE_URL 和 JWT_SECRET

# 启动
node index.js
```

默认端口：3000

## 环境变量

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/cyberplant
JWT_SECRET=your-secret-key
PORT=3000
```

## 项目结构

```
backend/
├── index.js              # 入口：Express 初始化 + 路由挂载
├── db.js                 # 数据库连接 + 工具函数 + 常量
├── middleware.js          # JWT 认证 + 管理员权限中间件
├── init.js               # 数据库初始化（表结构 + 默认数据）
├── utils/logger.js       # 日志工具
├── routes/
│   ├── public/           # 无需认证（注册、登录）
│   ├── user/             # 用户操作（花园、宠物、商店、好友等）
│   └── admin/            # 管理功能（用户、物品、配置等）
├── effects/              # 宠物特效文件
├── TECH_STACK.md         # 技术栈详细文档
├── API.md                # API 接口文档
└── _deprecated/          # 已废弃代码
```

## 文档

- **[TECH_STACK.md](./TECH_STACK.md)** — 技术栈、数据库表结构、核心机制
- **[API.md](./API.md)** — 完整 API 接口文档（88 个路由）

## 核心模块

### db.js — 数据库 + 工具函数

导出所有共享函数和常量，供路由文件引用：

```js
const { client, logger, getConfig, getPetBonus, formatPetData, ... } = require('./db');
```

### middleware.js — 认证中间件

```js
const { authenticateToken, requireAdmin } = require('./middleware');
// authenticateToken — 验证 JWT
// requireAdmin — 检查管理员权限
```

### init.js — 数据库初始化

服务器启动时自动执行 `initDatabase()`：
- 创建表结构（`CREATE TABLE IF NOT EXISTS`）
- 首次插入默认数据（物品、宠物、配置）
- 后续跳过已有数据

## 路由架构

按权限分三层：

| 层 | 目录 | 认证 | 路由数 |
|----|------|------|--------|
| 公共 | `routes/public/` | 无 | 4 |
| 用户 | `routes/user/` | JWT | 44 |
| 管理 | `routes/admin/` | JWT + Admin | 39 |

每个路由文件使用 `express.Router()`，通过汇总文件（`index.js`）统一挂载。

## 货币体系

- 🪙 **银币** — 基础货币，买卖种子/作物
- 🥇 **金币** — 中级货币，高级种子/肥料
- 💎 **钻石** — 高级货币，宠物/饰品

兑换：100 银币 = 1 金币，100 金币 = 1 钻石

## 测试账号

| 邮箱 | 密码 | 角色 |
|------|------|------|
| admin@cyberplant.com | admin123 | 管理员 |
| test1@test.com | test123 | 用户 |
| test2@test.com | test123 | 用户 |

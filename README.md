# 🌱 赛博花园 CyberPlant

一个赛博朋克风格的虚拟植物养成全栈应用。种植作物、领养宠物、好友互动，体验完整的养成循环。

## ✨ 功能特性

### 🌿 花园系统
- 6 块地块，可解锁和升级（Lv1~Lv5 产量倍率递增）
- 15+ 种作物，5 个成长阶段（种子→发芽→出叶→初熟→成熟）
- 浇水冷却机制、干涸死亡、施肥跳阶段
- SSS 级作物特殊掉落机制

### 🐾 宠物系统
- 6 种宠物（B/A/S/SSR 稀有度），10 级成长曲线
- 饱食度衰减 → 自动转化为成长值
- 4 个装饰槽位（头部/颈部/背部/特殊），饰品加成叠加
- 宠物特效系统（粒子动画，装备饰品后激活）
- LBOOKTest 测试宠物（SSR 稀有度，Lv999 显示）

### 🛒 商店系统
- 种子/肥料/宠物粮/宠物/饰品 5 个分类
- 售罄机制（purchasable 控制）
- SSS 级种子特殊售罄显示

### 👥 社交系统
- 好友添加/拒绝/删除
- 货币转账、礼物互赠
- 送礼冷却机制

### 🎒 背包系统
- 物品堆叠、数量管理
- 种子/作物/肥料/宠物粮分类显示

### 🛡️ 管理面板
- 双套 UI：HubView（一体化）+ ClassicLayout（分页式）
- 物品/饰品/宠物/用户/管理员/订单/配置/特效 全模块管理
- 用户背包管理（物品/宠物/饰品增删改）
- 全局配置面板（饱食度、掉落率、冷却时间等）

### 🤖 AI 助手
- 基于 Dify 知识库的种植问答

## 🛠️ 技术栈

### 前端
- **框架：** Vue 3 + Composition API + `<script setup>`
- **状态管理：** Pinia（userStore, petStore, shopStore, plotStore, friendStore, themeStore）
- **路由：** Vue Router（用户仪表盘 + 管理面板双布局）
- **构建：** Vite
- **样式：** CSS3（CSS 变量主题、深色模式、响应式布局）
- **特效：** Canvas + requestAnimationFrame 粒子动画

### 后端
- **运行时：** Node.js + Express
- **数据库：** PostgreSQL（pg 驱动）
- **认证：** JWT（jsonwebtoken + bcrypt）
- **文件上传：** Multer（特效文件管理）
- **日志：** 自定义 Winston-style logger

## 🚀 本地运行

```bash
# 克隆项目
git clone https://github.com/LBOOMILK/CyberPlant.git
cd CyberPlant

# 后端
cd backend
npm install
# 配置 .env（DATABASE_URL, JWT_SECRET）
node index.js

# 前端（新终端）
cd frontend
npm install
npm run dev
```

默认端口：后端 3000，前端 5173（Vite 开发模式）

## 📁 项目结构

```
CyberPlant/
├── backend/
│   ├── index.js              # 主入口（路由+初始化）
│   ├── db.js                 # 数据库连接+工具函数
│   ├── middleware.js          # JWT 认证+管理员权限
│   ├── utils/logger.js       # 日志工具
│   ├── effects/              # 宠物特效文件（.js）
│   └── _deprecated/          # 已废弃的旧路由文件
│
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   ├── auth/         # 登录注册（AuthPage.vue）
│   │   │   ├── dashboard/    # 用户页面
│   │   │   │   ├── Garden.vue       # 花园
│   │   │   │   ├── PetPanel.vue     # 宠物面板
│   │   │   │   ├── Shop.vue         # 商店
│   │   │   │   ├── Backpack.vue     # 背包
│   │   │   │   ├── FriendList.vue   # 好友
│   │   │   │   ├── User.vue         # 个人中心
│   │   │   │   └── UserOrders.vue   # 订单记录
│   │   │   └── admin/        # 管理页面
│   │   │       ├── HubView.vue      # 一体化管理面板
│   │   │       ├── Plants.vue       # 物品/饰品管理（Classic）
│   │   │       ├── Users.vue        # 用户管理（Classic）
│   │   │       ├── Admins.vue       # 管理员管理（Classic）
│   │   │       ├── Orders.vue       # 订单管理（Classic）
│   │   │       ├── PetsPanel.vue    # 宠物管理（Classic）
│   │   │       ├── EffectsManager.vue # 特效管理（Classic）
│   │   │       ├── ConfigPanel.vue  # 全局配置（Classic）
│   │   │       └── Dashboard.vue    # 仪表盘（Classic）
│   │   │
│   │   ├── components/
│   │   │   ├── common/       # 通用组件（Toast, Modal, ConfirmModal）
│   │   │   ├── admin/        # 管理端布局（ClassicLayout, AdminSidebar）
│   │   │   └── user/         # 用户端组件
│   │   │       ├── PetFloating.vue       # 悬浮宠物+特效
│   │   │       ├── PlotModal.vue         # 地块操作弹窗
│   │   │       ├── PlantSelectModal.vue  # 种植选择
│   │   │       ├── GiftModal.vue         # 送礼弹窗
│   │   │       ├── AIChatModal.vue       # AI 问答
│   │   │       ├── WelcomeModal.vue      # 新手礼包
│   │   │       ├── HandbookModal.vue     # 图鉴
│   │   │       └── UpgradeModal.vue      # 升级弹窗
│   │   │
│   │   ├── stores/           # Pinia 状态管理
│   │   │   ├── userStore.js      # 用户信息+货币+新手礼包
│   │   │   ├── petStore.js       # 宠物+装饰+槽位
│   │   │   ├── shopStore.js      # 商店+背包
│   │   │   ├── plotStore.js      # 花园地块
│   │   │   ├── friendStore.js    # 好友+礼物
│   │   │   └── themeStore.js     # 主题切换
│   │   │
│   │   ├── effects/          # 宠物特效（前端加载）
│   │   │   ├── index.js          # 特效注册表
│   │   │   ├── bubble-fish.js    # 泡泡鱼
│   │   │   ├── cat-paw.js        # 小豆猫
│   │   │   ├── star-rabbit.js    # 星光兔
│   │   │   ├── thunder-eagle.js  # 雷霆鹰
│   │   │   ├── crystal-dragon.js # 水晶龙
│   │   │   └── lbooktest.js      # LBOOKTest
│   │   │
│   │   ├── router/index.js   # 路由配置
│   │   ├── assets/           # 静态资源+全局 CSS
│   │   ├── App.vue           # 根组件
│   │   └── main.js           # 入口
│   │
│   └── dist/                 # 构建产物
│
└── docs/                     # 项目文档
```

## 🎮 游戏循环

```
购买种子 → 种植到地块 → 浇水 → 重复浇水推进阶段
→ 成熟后收获 → 作物存入背包 → 卖出获得货币
→ 购买更高级种子/宠物/饰品 → 提升加成 → 获得更多收益
```

## 💰 货币体系

| 货币 | 用途 |
|------|------|
| 🪙 银币 | 基础货币，买卖种子/作物 |
| 🥇 金币 | 中级货币，高级种子/肥料 |
| 💎 钻石 | 高级货币，宠物/饰品 |

## 🏷️ 稀有度

| 等级 | 颜色 | 说明 |
|------|------|------|
| C | 灰色 | 普通 |
| B | 绿色 | 普通 |
| A | 蓝色 | 稀有 |
| S | 紫色 | 史诗 |
| SSS | 金色 | 神话 |
| SSR | 红色 | 测试 |

## 📋 测试账号

| 账号 | 密码 | 角色 |
|------|------|------|
| admin@cyberplant.com | admin123 | 管理员 |
| test1@test.com | test123 | 普通用户 |
| test2@test.com | test123 | 普通用户 |

## 🔧 环境变量

```env
# .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/cyberplant
JWT_SECRET=your-secret-key
PORT=3000
```

## 📝 开发备注

- 数据库初始化：首次启动自动创建表结构和基础数据
- 管理面板入口：`/admin`（HubView）或 `/admin/classic`（ClassicLayout）
- 特效文件：上传到 `backend/effects/`，同时同步到 `frontend/src/effects/`
- 宠物加成：由 `bonus_curve` 查表决定，与等级挂钩
- 累加值系统：收获时小数余数按稀有度分别累积，满 1 则 +1

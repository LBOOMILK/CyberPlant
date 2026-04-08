# 🌱 赛博花园

一个基于 Vue 3 的虚拟植物养成游戏。购买种子、种植植物、浇水成长、收获作物，体验完整的养成循环。

## ✨ 功能特性

- 🌱 **植物养成**：浇水成长，5个阶段（种子→发芽→出叶→初熟→成熟）
- 🛒 **种子商城**：5种稀有度（C/B/A/S/SSS），不同价格和收益
- 🎒 **背包系统**：种子和作物分开管理，支持卖出
- 👤 **个人中心**：积分统计、数据重置
- 🌓 **深色模式**：跟随系统主题自动切换
- 📱 **响应式设计**：PC端悬浮导航，移动端底部导航

## 🎮 游戏循环

```
购买种子 → 种植 → 浇水 → 收获作物 → 卖出作物 → 获得积分
```

## 🛠️ 技术栈

- Vue 3 + Composition API
- Pinia（状态管理）
- Vue Router（路由）
- Vite（构建工具）
- localStorage（数据持久化）

## 🚀 本地运行

```bash
# 克隆项目
git clone https://github.com/你的用户名/cyber-garden.git

# 进入前端目录
cd cyber-garden/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 📁 项目结构

```
frontend/
├── src/
│   ├── views/          # 页面组件
│   │   ├── Garden.vue   # 花园页面
│   │   ├── Shop.vue     # 商城页面
│   │   ├── Inventory.vue # 背包页面
│   │   └── Profile.vue  # 我的页面
│   ├── stores/          # Pinia 状态管理
│   │   └── userStore.js
│   ├── components/      # 公共组件
│   │   └── Navbar.vue   # 全局导航栏
│   ├── router/          # 路由配置
│   └── App.vue
└── package.json
```

## 📝 后续计划

- [ ] 添加后端（Node.js + PostgreSQL）
- [ ] 用户登录/注册
- [ ] 更多植物品种

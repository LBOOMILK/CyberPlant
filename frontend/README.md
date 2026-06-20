# 🌱 赛博花园 - 前端

Vue 3 + Vite 构建的赛博朋克风格植物养成游戏前端。

## 技术栈

- **框架：** Vue 3 + Composition API + `<script setup>`
- **状态管理：** Pinia（6 个 Store）
- **路由：** Vue Router（用户仪表盘 + 管理面板双布局）
- **构建：** Vite
- **样式：** CSS3（CSS 变量主题、深色模式、响应式布局）
- **特效：** Canvas + requestAnimationFrame 粒子动画

## 目录结构

```
src/
├── views/
│   ├── auth/            # 登录注册
│   ├── dashboard/       # 用户页面（花园/宠物/商店/背包/好友/个人中心/订单）
│   └── admin/           # 管理页面（HubView 一体化 + ClassicLayout 分页式）
├── components/
│   ├── common/          # 通用组件（Toast, Modal, ConfirmModal）
│   ├── admin/           # 管理端布局
│   └── user/            # 用户端弹窗（悬浮宠物/地块/送礼/AI问答/新手礼包等）
├── stores/              # Pinia 状态管理
│   ├── userStore.js     # 用户信息+货币+新手礼包
│   ├── petStore.js      # 宠物+装饰+槽位
│   ├── shopStore.js     # 商店+背包
│   ├── plotStore.js     # 花园地块
│   ├── friendStore.js   # 好友+礼物
│   └── themeStore.js    # 主题切换
├── effects/             # 宠物特效（6种动画效果）
├── router/              # 路由配置
├── assets/              # 静态资源+全局CSS
├── App.vue              # 根组件
└── main.js              # 入口
```

## 页面说明

### 用户端
| 页面 | 文件 | 功能 |
|------|------|------|
| 花园 | `Garden.vue` | 地块管理、种植、浇水、收获 |
| 宠物 | `PetPanel.vue` | 宠物列表、喂食、升级、装饰 |
| 商店 | `Shop.vue` | 种子/肥料/宠物粮/宠物/饰品购买 |
| 背包 | `Backpack.vue` | 物品管理、卖出 |
| 好友 | `FriendList.vue` | 好友管理、礼物、转账 |
| 个人中心 | `User.vue` | 用户信息、密码修改 |
| 订单 | `UserOrders.vue` | 交易记录 |

### 管理端
| 页面 | 文件 | 功能 |
|------|------|------|
| 一体化面板 | `HubView.vue` | 全功能管理（物品/饰品/宠物/用户/管理员/订单/配置/特效） |
| Classic 分页 | `Plants.vue` 等 | 同 HubView，分页面展示 |

## 本地开发

```bash
npm install
npm run dev
```

开发服务器：http://localhost:5173

## 构建

```bash
npm run build
```

产物输出到 `dist/`，由后端 Express 静态文件服务提供。

## API 依赖

前端调用后端 API（默认 `http://localhost:3000/api`），主要接口：

- `/api/auth/*` — 登录注册
- `/api/user/*` — 用户操作（花园/宠物/商店/好友）
- `/api/admin/*` — 管理功能
- `/api/shop` — 商店商品
- `/api/items` — 物品列表

## 特效系统

宠物特效文件位于 `src/effects/`，每个文件导出一个 `init(container, options)` 函数：

- `bubble-fish.js` — 泡泡鱼（气泡+水波）
- `cat-paw.js` — 小豆猫（爪印+星星）
- `star-rabbit.js` — 星光兔（星光+月亮）
- `thunder-eagle.js` — 雷霆鹰（闪电+电弧）
- `crystal-dragon.js` — 水晶龙（水晶+火焰）
- `lbooktest.js` — LBOOKTest（竹子+数字雨+光环）

## 管理面板路由

```
/admin              → HubView（一体化）
/admin/classic      → ClassicLayout（分页式）
  /admin/classic/dashboard   → 仪表盘
  /admin/classic/users       → 用户管理
  /admin/classic/admins      → 管理员管理
  /admin/classic/plants      → 物品管理
  /admin/classic/orders      → 订单管理
  /admin/classic/config      → 全局配置
  /admin/classic/effects     → 特效管理
  /admin/classic/pets        → 宠物管理
```

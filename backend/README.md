# Backend 项目

基于 Node.js + Express + Prisma + PostgreSQL 的后端项目。

## 环境要求

- Node.js 18+
- PostgreSQL 数据库

## 安装

1. 进入项目目录：`cd backend`
2. 安装依赖：`npm install`

## 配置

1. 复制环境变量文件：`cp .env.example .env`
2. 编辑 `.env` 文件，设置正确的 `DATABASE_URL`（PostgreSQL 连接字符串）

## 数据库设置

1. 确保 PostgreSQL 服务正在运行
2. 运行数据库迁移：`npm run prisma:migrate`
3. 生成 Prisma 客户端：`npm run prisma:generate`

## 启动项目

开发模式（热重载）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

## API 路由

- GET `/` - 健康检查
- GET `/api/users` - 获取所有用户
- POST `/api/users` - 创建新用户

## Prisma 管理

- 生成 Prisma 客户端：`npm run prisma:generate`
- 数据库迁移：`npm run prisma:migrate`
- 打开 Prisma Studio：`npm run prisma:studio`

4.23 
订单管理开发完成
README补全以及修改后续完成
import { createRouter, createWebHistory } from 'vue-router'

// 路由守卫
function requireAuth(to, from, next) {
  const token = localStorage.getItem('auth_token')
  if (token) {
    next()
  } else {
    next('/login')
  }
}

function requireAdmin(to, from, next) {
  const token = localStorage.getItem('auth_token')
  const userRole = localStorage.getItem('user_role')
  if (token && userRole === 'admin') {
    next()
  } else {
    next('/login')
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // 公共路由
    { path: '/', redirect: '/login' },  // 默认重定向到登录页
    { path: '/login', name: 'login', component: () => import('../views/auth/Login.vue') },
    { path: '/register', name: 'register', component: () => import('../views/auth/Register.vue') },
    
    // 登录后路由
    {
      path: '/dashboard',
      name: 'dashboard',
      redirect: '/dashboard/garden',
      beforeEnter: requireAuth,
      children: [
        { path: 'garden', name: 'garden', component: () => import('../views/dashboard/Garden.vue') },
        { path: 'shop', name: 'shop', component: () => import('../views/dashboard/Shop.vue') },
        { path: 'backpack', name: 'backpack', component: () => import('../views/dashboard/Backpack.vue') },
        { path: 'orders', name: 'orders', component: () => import('../views/dashboard/UserOrders.vue') },
        { path: 'user', name: 'user', component: () => import('../views/dashboard/User.vue') },
      ]
    },
    
    // 管理端路由
    {
      path: '/admin',
      name: 'admin',
      redirect: '/admin/dashboard',
      beforeEnter: requireAdmin,
      children: [
        { path: 'dashboard', name: 'admin-dashboard', component: () => import('../views/admin/Dashboard.vue') },
        { path: 'users', name: 'admin-users', component: () => import('../views/admin/Users.vue') },
        { path: 'admins', name: 'admin-admins', component: () => import('../views/admin/Admins.vue') },
        { path: 'plants', name: 'admin-plants', component: () => import('../views/admin/Plants.vue') },
        { path: 'orders', name: 'admin-orders', component: () => import('../views/admin/Orders.vue') },
      ]
    },
  ]
})

export default router

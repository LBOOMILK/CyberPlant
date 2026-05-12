import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { 
      path: '/', 
      name: 'login-select', 
      component: () => import('../views/auth/LoginSelect.vue'),
      meta: { requiresAuth: false }
    },
    { 
      path: '/login', 
      name: 'login', 
      component: () => import('../views/auth/UserLogin.vue'),
      meta: { requiresAuth: false }
    },
    { 
      path: '/register', 
      name: 'register', 
      component: () => import('../views/auth/Register.vue'),
      meta: { requiresAuth: false }
    },
    { 
      path: '/admin/login', 
      name: 'admin-login', 
      component: () => import('../views/auth/AdminLogin.vue'),
      meta: { requiresAuth: false }
    },
    
    {
      path: '/dashboard',
      name: 'dashboard',
      redirect: '/dashboard/garden',
      meta: { requiresAuth: true, requiresRole: 'user' },
      children: [
        { path: 'garden', name: 'garden', component: () => import('../views/dashboard/Garden.vue') },
        { path: 'shop', name: 'shop', component: () => import('../views/dashboard/Shop.vue') },
        { path: 'backpack', name: 'backpack', component: () => import('../views/dashboard/Backpack.vue') },
        { path: 'orders', name: 'orders', component: () => import('../views/dashboard/UserOrders.vue') },
        { path: 'user', name: 'user', component: () => import('../views/dashboard/User.vue') },
      ]
    },
    
    {
      path: '/admin',
      name: 'admin',
      redirect: '/admin/dashboard',
      meta: { requiresAuth: true, requiresRole: 'admin' },
      children: [
        { path: 'dashboard', name: 'admin-dashboard', component: () => import('../views/admin/Dashboard.vue') },
        { path: 'users', name: 'admin-users', component: () => import('../views/admin/Users.vue') },
        { path: 'admins', name: 'admin-admins', component: () => import('../views/admin/Admins.vue') },
        { path: 'plants', name: 'admin-plants', component: () => import('../views/admin/Plants.vue') },
        { path: 'orders', name: 'admin-orders', component: () => import('../views/admin/Orders.vue') },
      ]
    },
    
    { 
      path: '/:pathMatch(.*)*', 
      redirect: '/',
      meta: { requiresAuth: false }
    }
  ]
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('auth_token')
  const userRole = localStorage.getItem('user_role')
  const requiresAuth = to.meta.requiresAuth !== false

  if (requiresAuth && !token) {
    next('/')
    return
  }

  if (requiresAuth && token) {
    const requiredRole = to.meta.requiresRole
    
    if (requiredRole === 'admin' && userRole !== 'admin') {
      next('/')
      return
    }
    
    if (requiredRole === 'user' && userRole === 'admin') {
      next('/')
      return
    }
  }

  next()
})

export default router
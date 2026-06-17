import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/auth/AuthPage.vue'),
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
        { path: 'friends', name: 'friends', component: () => import('../views/dashboard/FriendList.vue') },
        { path: 'pets', name: 'pets', component: () => import('../views/dashboard/PetPanel.vue') },
        { path: 'orders', name: 'orders', component: () => import('../views/dashboard/UserOrders.vue') },
        { path: 'user', name: 'user', component: () => import('../views/dashboard/User.vue') },
      ]
    },
    
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/admin/HubView.vue'),
      meta: { requiresAuth: true, requiresRole: 'admin' },
    },
    {
      path: '/admin/classic',
      name: 'admin-classic',
      component: () => import('../components/admin/ClassicLayout.vue'),
      redirect: '/admin/classic/dashboard',
      meta: { requiresAuth: true, requiresRole: 'admin' },
      children: [
        { path: 'dashboard', name: 'admin-dashboard', component: () => import('../views/admin/Dashboard.vue') },
        { path: 'users', name: 'admin-users', component: () => import('../views/admin/Users.vue') },
        { path: 'admins', name: 'admin-admins', component: () => import('../views/admin/Admins.vue') },
        { path: 'plants', name: 'admin-plants', component: () => import('../views/admin/Plants.vue') },
        { path: 'orders', name: 'admin-orders', component: () => import('../views/admin/Orders.vue') },
        { path: 'config', name: 'admin-config', component: () => import('../views/admin/ConfigPanel.vue') },
        { path: 'effects', name: 'admin-effects', component: () => import('../views/admin/EffectsManager.vue') },
        { path: 'pets', name: 'admin-pets', component: () => import('../views/admin/PetsPanel.vue') },
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
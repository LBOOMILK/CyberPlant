import { createRouter, createWebHistory } from 'vue-router'
import GardenView from '../views/Garden.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/garden' },  // 默认页面在花园
    { path: '/garden', name: 'garden', component: GardenView },
    { path: '/shop', name: 'shop', component: () => import('../views/Shop.vue') },
    { path: '/user', name: 'user', component: () => import('../views/User.vue') },
    { path: '/backpack', name: 'backpack', component: () => import('../views/Backpack.vue') },
  ]
})

export default router

<template>
  <div class="admin-sidebar-container">
    <button class="mobile-menu-toggle" @click="toggleMobileMenu" v-if="isMobile">
      ☰
    </button>
    
    <div class="admin-sidebar" :class="{ 'mobile-open': mobileMenuOpen }">
      <div class="sidebar-header">
        <h2>管理中心</h2>
        <button class="close-mobile-menu" @click="toggleMobileMenu" v-if="isMobile">
          ✕
        </button>
      </div>
      
      <ul class="menu-container">
        <li class="menu-item">
          <router-link to="/admin/classic/dashboard" class="menu-link" @click="closeMobileMenu">仪表盘</router-link>
        </li>
        <li class="menu-item">
          <router-link to="/admin/classic/plants" class="menu-link" @click="closeMobileMenu">物品管理</router-link>
        </li>
        <li class="menu-item">
          <div class="menu-title" @click="togglePetMenu">
            <span>宠物管理</span>
            <span class="menu-arrow" :class="{ open: petMenuOpen }">&#9660;</span>
          </div>
          <ul v-if="petMenuOpen" class="sub-menu">
            <li class="menu-item">
              <router-link to="/admin/classic/pets" class="menu-link" @click="closeMobileMenu">宠物列表</router-link>
            </li>
            <li class="menu-item">
              <router-link to="/admin/classic/effects" class="menu-link" @click="closeMobileMenu">特效管理</router-link>
            </li>
          </ul>
        </li>
        <li class="menu-item">
          <div class="menu-title" @click="toggleUserMenu">
            <span>用户管理</span>
            <span class="menu-arrow" :class="{ open: userMenuOpen }">&#9660;</span>
          </div>
          <ul v-if="userMenuOpen" class="sub-menu">
            <li class="menu-item">
              <router-link to="/admin/classic/users" class="menu-link" @click="closeMobileMenu">普通用户</router-link>
            </li>
            <li class="menu-item">
              <router-link to="/admin/classic/admins" class="menu-link" @click="closeMobileMenu">管理员</router-link>
            </li>
            <li class="menu-item">
              <router-link to="/admin/classic/orders" class="menu-link" @click="closeMobileMenu">订单管理</router-link>
            </li>
          </ul>
        </li>
        <li class="menu-item">
          <router-link to="/admin/classic/config" class="menu-link" @click="closeMobileMenu">全局配置</router-link>
        </li>
        <li class="menu-item hub-switch" @click="$router.push('/admin')">切换枢纽视图</li>
        <li class="logout-item" @click="showLogoutModal = true">退出登录</li>
      </ul>
    </div>
    
    <div v-if="mobileMenuOpen && isMobile" class="overlay" @click="toggleMobileMenu"></div>
    
    <div v-if="showLogoutModal" class="modal-overlay" @click.self="showLogoutModal = false">
      <div class="modal-content">
        <h3>退出登录</h3>
        <p>确定要退出登录吗？</p>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="showLogoutModal = false">取消</button>
          <button class="modal-btn confirm" @click="handleLogout">确定退出</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userMenuOpen = ref(sessionStorage.getItem('userMenuOpen') === 'true')
const petMenuOpen = ref(sessionStorage.getItem('petMenuOpen') === 'true')
const showLogoutModal = ref(false)
const mobileMenuOpen = ref(false)
const isMobile = ref(false)

watch(userMenuOpen, (newValue) => {
  sessionStorage.setItem('userMenuOpen', newValue)
})

watch(petMenuOpen, (newValue) => {
  sessionStorage.setItem('petMenuOpen', newValue)
})

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function togglePetMenu() {
  petMenuOpen.value = !petMenuOpen.value
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function closeMobileMenu() {
  if (isMobile.value) {
    mobileMenuOpen.value = false
  }
}

function handleLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_role')
  sessionStorage.removeItem('userMenuOpen')
  sessionStorage.removeItem('petMenuOpen')
  showLogoutModal.value = false
  router.push('/')
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  const savedUserMenu = sessionStorage.getItem('userMenuOpen')
  if (savedUserMenu !== null) {
    userMenuOpen.value = savedUserMenu === 'true'
  }
  const savedPetMenu = sessionStorage.getItem('petMenuOpen')
  if (savedPetMenu !== null) {
    petMenuOpen.value = savedPetMenu === 'true'
  }
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.admin-sidebar-container {
  position: relative;
  flex-shrink: 0;
  width: 200px;
}

.mobile-menu-toggle {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 1001;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 12px;
  background: #f59e0b;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.admin-sidebar {
  width: 200px;
  background: #f59e0b;
  color: white;
  padding: 20px;
  height: 100vh;
  overflow-y: auto;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  transition: transform 0.3s ease;
  box-sizing: border-box;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.close-mobile-menu {
  display: none;
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px 8px;
}

.admin-sidebar h2 {
  margin: 0 0 32px 0;
  font-size: 1.5rem;
  text-align: center;
}

.menu-container {
  list-style: none;
  padding: 0;
  margin: 0;
}

.menu-item {
  margin-bottom: 8px;
  border-radius: 8px;
  overflow: hidden;
}

.menu-link {
  display: block;
  padding: 12px 16px;
  color: white;
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.menu-link:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* 当前激活的路由链接 */
.menu-link.router-link-active {
  background: rgba(255, 255, 255, 0.25);
  font-weight: 600;
}

.menu-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.menu-title:hover {
  background: rgba(255, 255, 255, 0.15);
}

.menu-arrow {
  transition: transform 0.2s ease;
  font-size: 0.8rem;
}

.menu-arrow.open {
  transform: rotate(180deg);
}

.sub-menu {
  list-style: none;
  padding: 0;
  margin: 4px 0 0 0;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  overflow: hidden;
}

.sub-menu .menu-item {
  margin-bottom: 0;
  border-radius: 0;
}

.sub-menu .menu-link {
  padding: 10px 16px 10px 24px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
}

.hub-switch {
  margin-top: 12px;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  color: #065f46;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-weight: 600;
}
.hub-switch:hover {
  background: rgba(255, 255, 255, 0.3);
}

.logout-item {
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  color: #991b1b;
  background: rgba(220, 38, 38, 0.15);
  border: 1px solid rgba(220, 38, 38, 0.3);
}

.logout-item:hover {
  background: rgba(220, 38, 38, 0.25);
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1002;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  text-align: center;
}

.modal-content h3 {
  margin: 0 0 16px 0;
  color: #f59e0b;
}

.modal-content p {
  margin: 0 0 24px 0;
  color: #555;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.modal-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.modal-btn.cancel {
  background: #9e9e9e;
  color: white;
}

.modal-btn.cancel:hover {
  background: #757575;
}

.modal-btn.confirm {
  background: #dc2626;
  color: white;
}

.modal-btn.confirm:hover {
  background: #b91c1c;
}

/* 深色模式下的侧边栏和弹窗 */
[data-theme="dark"] .admin-sidebar {
  background: #b45309;
}

[data-theme="dark"] .sub-menu {
  background: rgba(0, 0, 0, 0.2);
}

[data-theme="dark"] .modal-content {
  background: #1e293b;
  border: 1px solid #334155;
}

[data-theme="dark"] .modal-content h3 {
  color: #fbbf24;
}

[data-theme="dark"] .modal-content p {
  color: #cbd5e1;
}

[data-theme="dark"] .modal-btn.cancel {
  background: #475569;
  color: #f1f5f9;
}

[data-theme="dark"] .modal-btn.cancel:hover {
  background: #334155;
}

[data-theme="dark"] .hub-switch {
  color: #00ff88;
  background: rgba(0,255,136,0.08);
  border-color: rgba(0,255,136,0.2);
}

[data-theme="dark"] .logout-item {
  color: #fb9696;
  background: rgba(207, 47, 47, 0.808);
  border-color: rgba(255, 0, 0, 0.83);
}

@media (max-width: 767px) {
  .mobile-menu-toggle {
    display: flex;
  }
  
  .admin-sidebar {
    width: 260px;
    transform: translateX(-100%);
    height: 100vh;
    padding: 24px;
  }
  
  .admin-sidebar.mobile-open {
    transform: translateX(0);
  }
  
  .close-mobile-menu {
    display: block;
  }
  
  .admin-sidebar h2 {
    margin: 0 0 24px 0;
    text-align: left;
  }
  
  .logout-item {
    margin-top: 32px;
  }
}
</style>

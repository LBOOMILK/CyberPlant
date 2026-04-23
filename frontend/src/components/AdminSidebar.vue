<template>
  <div class="admin-sidebar">
    <h2>管理中心</h2>
    <ul>
      <li><router-link to="/admin/dashboard">仪表盘</router-link></li>
      <li class="menu-item">
        <span class="menu-title" @click="toggleUserMenu">
          <span>用户管理</span>
          <span class="menu-arrow" :class="{ open: userMenuOpen }">&#9660;</span>
        </span>
        <ul v-if="userMenuOpen" class="sub-menu">
          <li @click="preventBubble"><router-link to="/admin/users">普通用户</router-link></li>
          <li @click="preventBubble"><router-link to="/admin/admins">管理员</router-link></li>
        </ul>
      </li>
      <li><router-link to="/admin/plants">植物管理</router-link></li>
      <li><router-link to="/admin/orders">订单管理</router-link></li>
      <li @click="showLogoutModal = true">退出登录</li>
    </ul>
    
    <!-- 退出登录弹窗 -->
    <div v-if="showLogoutModal" class="modal-overlay" @click.self="showLogoutModal = false">
      <div class="modal-content">
        <h3>🚪 退出登录</h3>
        <p>确定要退出登录吗？</p>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showLogoutModal = false">取消</button>
          <button class="confirm-btn" @click="handleLogout">确定退出</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
// 从 sessionStorage 中恢复状态，确保路由导航后状态保持
const userMenuOpen = ref(sessionStorage.getItem('userMenuOpen') === 'true')
const showLogoutModal = ref(false)

// 监听状态变化，保存到 sessionStorage
watch(userMenuOpen, (newValue) => {
  sessionStorage.setItem('userMenuOpen', newValue)
})

// 切换用户管理菜单
function toggleUserMenu(event) {
  userMenuOpen.value = !userMenuOpen.value
}

// 阻止子菜单点击事件冒泡
function preventBubble(event) {
  event.stopPropagation()
}

function handleLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_role')
  sessionStorage.removeItem('userMenuOpen')
  showLogoutModal.value = false
  router.push('/login')
}

// 组件挂载时从 sessionStorage 恢复状态
onMounted(() => {
  const savedState = sessionStorage.getItem('userMenuOpen')
  if (savedState !== null) {
    userMenuOpen.value = savedState === 'true'
  }
})
</script>

<style scoped>
.admin-sidebar {
  width: 200px;
  background: #2c5a2a;
  color: white;
  padding: 20px;
}

.admin-sidebar h2 {
  margin: 0 0 32px 0;
  font-size: 1.5rem;
}

.admin-sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.admin-sidebar ul li {
  margin-bottom: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  position: relative;
}

.admin-sidebar ul li:hover {
  background: rgba(255, 255, 255, 0.1);
}

.admin-sidebar ul li a {
  color: white;
  text-decoration: none;
  display: block;
}

/* 二级菜单样式 */
.menu-item {
  position: relative;
}

.menu-title {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  position: relative;
  width: 100%;
  height: 100%;
}

.menu-title:hover {
  background: rgba(255, 255, 255, 0.1);
}

.menu-arrow {
  transition: transform 0.2s ease;
  font-size: 0.8rem;
}

.menu-arrow.open {
  transform: rotate(180deg);
}

.sub-menu {
  margin: 12px 0 0 16px;
  padding: 0;
  list-style: none;
  position: relative;
}

.sub-menu li {
  margin-bottom: 4px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
  position: relative;
}

.sub-menu li:hover {
  background: rgba(255, 255, 255, 0.1);
}

.sub-menu li a {
  display: block;
  color: rgba(255, 255, 255, 0.9);
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .admin-sidebar {
    background: #1a3a1a;
  }
}

/* 弹窗样式 */
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
  z-index: 1000;
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
  color: #2c5a2a;
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

.cancel-btn,
.confirm-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.cancel-btn {
  background: #9e9e9e;
  color: white;
}

.cancel-btn:hover {
  background: #757575;
}

.confirm-btn {
  background: #f44336;
  color: white;
}

.confirm-btn:hover {
  background: #d32f2f;
}

/* 深色模式弹窗 */
@media (prefers-color-scheme: dark) {
  .modal-content {
    background: #333;
  }
  
  .modal-content h3 {
    color: #8bc34a;
  }
  
  .modal-content p {
    color: #ddd;
  }
  
  .cancel-btn {
    background: #555;
  }
  
  .cancel-btn:hover {
    background: #444;
  }
  
  .confirm-btn {
    background: #d32f2f;
  }
  
  .confirm-btn:hover {
    background: #b71c1c;
  }
}
</style>
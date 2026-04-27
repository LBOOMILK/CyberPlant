<template>
  <div class="admin-sidebar">
    <h2>管理中心</h2>
    <ul class="menu-container">
      <li class="menu-item">
        <router-link to="/admin/dashboard" class="menu-link">仪表盘</router-link>
      </li>
      <li class="menu-item">
        <div class="menu-title" @click="toggleUserMenu">
          <span>用户管理</span>
          <span class="menu-arrow" :class="{ open: userMenuOpen }">&#9660;</span>
        </div>
        <ul v-if="userMenuOpen" class="sub-menu">
          <li class="menu-item">
            <router-link to="/admin/users" class="menu-link" @click="preventBubble">普通用户</router-link>
          </li>
          <li class="menu-item">
            <router-link to="/admin/admins" class="menu-link" @click="preventBubble">管理员</router-link>
          </li>
        </ul>
      </li>
      <li class="menu-item">
        <router-link to="/admin/plants" class="menu-link">植物管理</router-link>
      </li>
      <li class="menu-item">
        <router-link to="/admin/orders" class="menu-link">订单管理</router-link>
      </li>
      <li class="logout-item" @click="showLogoutModal = true">退出登录</li>
    </ul>
    
    <!-- 退出登录弹窗 -->
    <div v-if="showLogoutModal" class="modal-overlay" @click.self="showLogoutModal = false">
      <div class="modal-content">
        <h3>🚪 退出登录</h3>
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
/* 主侧边栏样式 */
.admin-sidebar {
  width: 200px;
  background: #2c5a2a;
  color: white;
  padding: 20px;
  height: 100vh;
  overflow-y: auto;
}

.admin-sidebar h2 {
  margin: 0 0 32px 0;
  font-size: 1.5rem;
  text-align: center;
}

/* 菜单容器 */
.menu-container {
  list-style: none;
  padding: 0;
  margin: 0;
}

/* 菜单项通用样式 */
.menu-item {
  margin-bottom: 8px;
  border-radius: 8px;
  overflow: hidden;
}

/* 菜单项链接 */
.menu-link {
  display: block;
  padding: 12px 16px;
  color: white;
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.menu-link:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 菜单标题（带下拉箭头） */
.menu-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.menu-title:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 下拉箭头 */
.menu-arrow {
  transition: transform 0.2s ease;
  font-size: 0.8rem;
}

.menu-arrow.open {
  transform: rotate(180deg);
}

/* 二级菜单 */
.sub-menu {
  list-style: none;
  padding: 0;
  margin: 4px 0 0 0;
  background: rgba(0, 0, 0, 0.1);
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

/* 退出登录按钮 */
.logout-item {
  margin-top: 40px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  text-align: center;
  color: #ff0000;
}

.logout-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .admin-sidebar {
    background: #1a3a1a;
  }
  
  .sub-menu {
    background: rgba(0, 0, 0, 0.2);
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
  background: #f44336;
  color: white;
}

.modal-btn.confirm:hover {
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
  
  .modal-btn.cancel {
    background: #555;
  }
  
  .modal-btn.cancel:hover {
    background: #444;
  }
  
  .modal-btn.confirm {
    background: #d32f2f;
  }
  
  .modal-btn.confirm:hover {
    background: #b71c1c;
  }
}
</style>
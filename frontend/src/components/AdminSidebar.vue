<template>
  <div class="admin-sidebar">
    <h2>管理中心</h2>
    <ul>
      <li><router-link to="/admin/dashboard">仪表盘</router-link></li>
      <li class="menu-item">
        <span class="menu-title" @click="toggleUserMenu">
          <span>用户管理</span>
          <span class="menu-arrow" :class="{ open: userMenuOpen }">▼</span>
        </span>
        <ul v-if="userMenuOpen" class="sub-menu">
          <li @click="preventBubble"><router-link to="/admin/users">普通用户</router-link></li>
          <li @click="preventBubble"><router-link to="/admin/admins">管理员</router-link></li>
        </ul>
      </li>
      <li><router-link to="/admin/plants">植物管理</router-link></li>
      <li><router-link to="/admin/orders">订单管理</router-link></li>
      <li @click="handleLogout">退出登录</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
// 从 sessionStorage 中恢复状态，确保路由导航后状态保持
const userMenuOpen = ref(sessionStorage.getItem('userMenuOpen') === 'true')

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
</style>
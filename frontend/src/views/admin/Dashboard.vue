<template>
  <div class="admin-page">
    <Toast ref="toastRef" />
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
            <li><router-link to="/admin/users">普通用户</router-link></li>
            <li><router-link to="/admin/admins">管理员</router-link></li>
          </ul>
        </li>
        <li><router-link to="/admin/plants">植物管理</router-link></li>
        <li><router-link to="/admin/orders">订单管理</router-link></li>
        <li class="logout-btn" @click="showLogoutModal = true">退出登录</li>
      </ul>
    </div>
    
    <!-- 退出登录弹窗 -->
    <Modal
      :visible="showLogoutModal"
      title="🚪 退出登录"
      message="确定要退出登录吗？"
      confirm-text="确定退出"
      cancel-text="取消"
      @confirm="handleLogout"
      @cancel="showLogoutModal = false"
    />
    
    <div class="admin-content">
      <h1>仪表盘</h1>
      
      <div class="stats-grid">
        <div class="stat-card">
          <h3>总用户数</h3>
          <p class="stat-value">{{ stats.totalUsers }}</p>
        </div>
        <div class="stat-card" @click="nextStat">
          <h3>{{ statLabels[statTypes[currentStatIndex]] }}</h3>
          <p class="stat-value">{{ stats[statTypes[currentStatIndex]] }}</p>
          <p class="stat-hint">点击切换</p>
        </div>
        <div class="stat-card">
          <h3>总订单数</h3>
          <p class="stat-value">{{ stats.totalOrders }}</p>
        </div>
        <div class="stat-card">
          <h3>总收入</h3>
          <p class="stat-value">¥{{ stats.totalRevenue.toLocaleString() }}</p>
        </div>
      </div>
      
      <div class="recent-activity">
        <h2>最近活动</h2>
        <div class="activity-list">
          <div v-for="(activity, index) in recentActivity" :key="index" class="activity-item">
            <span class="activity-time">{{ activity.time }}</span>
            <span class="activity-content">{{ activity.content }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '@/components/Toast.vue'
import Modal from '@/components/Modal.vue'

const router = useRouter()
const toastRef = ref(null)
const showLogoutModal = ref(false)
const userMenuOpen = ref(false)

// 切换用户管理菜单
function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}
const stats = ref({
  totalUsers: 0,
  totalPlants: 0,
  totalSeeds: 0,
  totalPoints: 0,
  totalOrders: 0,
  totalRevenue: 0
})
const currentStatIndex = ref(0)
const statTypes = ['totalPlants', 'totalSeeds', 'totalPoints']
const statLabels = {
  totalPlants: '总植物数',
  totalSeeds: '总种子数',
  totalPoints: '总积分'
}
const recentActivity = ref([])

function handleLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_role')
  localStorage.removeItem('user_email')
  localStorage.removeItem('user_name')
  localStorage.removeItem('user_key')
  if (toastRef.value) {
    toastRef.value.addToast('已成功退出登录', 'success')
  }
  setTimeout(() => {
    router.push('/login')
  }, 1000)
}

function nextStat() {
  currentStatIndex.value = (currentStatIndex.value + 1) % statTypes.length
}

async function fetchDashboardData() {
  try {
    const token = localStorage.getItem('auth_token')
    
    // 获取用户数量
    const usersResponse = await fetch('http://localhost:3000/api/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const usersData = await usersResponse.json()
    stats.value.totalUsers = usersData.length
    
    // 获取植物数量
    const plantsResponse = await fetch('http://localhost:3000/api/plants')
    const plantsData = await plantsResponse.json()
    stats.value.totalPlants = plantsData.length
    
    // 计算总种子数（这里使用模拟数据，实际应从数据库中获取）
    // 假设每个用户平均有10个种子
    stats.value.totalSeeds = usersData.length * 10
    
    // 计算总积分（从用户数据中获取，排除管理员）
    stats.value.totalPoints = usersData
      .filter(user => user.role !== 'admin')
      .reduce((total, user) => total + (user.points || 0), 0)
    
    // 获取订单数量和总收入
    const ordersResponse = await fetch('http://localhost:3000/api/orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const ordersData = await ordersResponse.json()
    stats.value.totalOrders = ordersData.length
    stats.value.totalRevenue = ordersData.reduce((total, order) => total + order.amount, 0)
    
    // 模拟最近活动数据
    recentActivity.value = [
      { time: new Date().toLocaleString(), content: '系统初始化完成' },
      { time: new Date().toLocaleString(), content: '数据库连接成功' },
      { time: new Date().toLocaleString(), content: '管理端页面加载完成' }
    ]
  } catch (error) {
    console.error('获取仪表盘数据失败:', error)
    if (toastRef.value) {
      toastRef.value.addToast('获取数据失败', 'error')
    }
  }
}

onMounted(() => {
  fetchDashboardData()
})
</script>

<style scoped>
.admin-page {
  display: flex;
  min-height: 100vh;
  background: #f5f5f5;
}

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
  padding: 12px 16px 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  position: relative;
}

.admin-sidebar ul li::before {
  content: '•';
  position: absolute;
  left: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.2rem;
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
  padding: 12px 16px 12px 24px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  position: relative;
}

.menu-title::before {
  content: '•';
  position: absolute;
  left: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.2rem;
}

.menu-title:hover {
  background: rgba(255, 255, 255, 0.1);
}

.menu-arrow {
  transition: transform 0.2s ease;
  font-size: 0.8rem;
}

.menu-arrow.open {
  transform: rotate(90deg);
}

.sub-menu {
  margin: 8px 0 0 24px;
  padding: 0;
  list-style: none;
  position: relative;
}

.sub-menu::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.2);
}

.sub-menu li {
  margin-bottom: 4px;
  padding: 8px 12px 8px 24px;
  border-radius: 6px;
  font-size: 0.9rem;
  position: relative;
}

.sub-menu li::before {
  content: '•';
  position: absolute;
  left: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.2rem;
}

.sub-menu li:hover {
  background: rgba(255, 255, 255, 0.1);
}

.sub-menu li a {
  display: block;
  color: rgba(255, 255, 255, 0.9);
}

/* 退出登录按钮样式 */
.logout-btn {
  margin-top: 40px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 20px;
}

.logout-btn:hover {
  background: rgba(244, 67, 54, 0.2) !important;
  color: #f44336;
}

/* 深色模式下的退出登录按钮样式 */
@media (prefers-color-scheme: dark) {
  .logout-btn {
    border-top-color: rgba(255, 255, 255, 0.05);
  }
  
  .logout-btn:hover {
    background: rgba(244, 67, 54, 0.2) !important;
    color: #ef5350;
  }
}

.admin-content {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
}

.admin-content h1 {
  margin: 0 0 32px 0;
  color: #2c5a2a;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  margin-bottom: 40px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.stat-card h3 {
  margin: 0 0 12px 0;
  color: #666;
  font-size: 1rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #2c5a2a;
  margin: 0;
}

.stat-hint {
  font-size: 0.8rem;
  color: #999;
  margin: 8px 0 0 0;
  cursor: pointer;
}

.stat-card:hover {
  cursor: pointer;
  transform: translateY(-2px);
  transition: transform 0.2s ease;
}

.recent-activity h2 {
  margin: 0 0 24px 0;
  color: #2c5a2a;
}

.activity-list {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-time {
  color: #999;
  font-size: 0.9rem;
}

.activity-content {
  color: #333;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .admin-page {
    background: #1a1a1a;
  }
  
  .admin-sidebar {
    background: #1a3a1a;
  }
  
  .admin-content h1,
  .admin-content h2 {
    color: #8bc34a;
  }
  
  .stat-card {
    background: #2a2a2a;
  }
  
  .stat-card h3 {
    color: #aaa;
  }
  
  .stat-value {
    color: #8bc34a;
  }
  
  .stat-hint {
    color: #777;
  }
  
  .stat-card:hover {
    background: #333;
  }
  
  .activity-list {
    background: #2a2a2a;
  }
  
  .activity-item {
    border-bottom: 1px solid #3a3a3a;
  }
  
  .activity-time {
    color: #777;
  }
  
  .activity-content {
    color: #e0e0e0;
  }
}
</style>
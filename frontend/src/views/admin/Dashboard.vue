<template>
  <div class="admin-page">
    <Toast ref="toastRef" />
    <AdminSidebar />


    <!-- 退出登录弹窗 -->
    <Modal :visible="showLogoutModal" title="🚪 退出登录" message="确定要退出登录吗？" confirm-text="确定退出" cancel-text="取消"
      @confirm="handleLogout" @cancel="showLogoutModal = false" />

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
          <h3>今日活跃用户</h3>
          <p class="stat-value">{{ stats.todayActiveUsers }}</p>
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
import AdminSidebar from '@/components/AdminSidebar.vue'

const router = useRouter()
const toastRef = ref(null)
const showLogoutModal = ref(false)
const stats = ref({
  totalUsers: 0,
  totalPlants: 0,
  totalSeeds: 0,
  totalPoints: 0,
  totalOrders: 0,
  todayActiveUsers: 0
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
    router.push('/admin/login')
  }, 1000)
}

function nextStat() {
  currentStatIndex.value = (currentStatIndex.value + 1) % statTypes.length
}

async function fetchDashboardData() {
  try {
    const token = localStorage.getItem('auth_token')

    // 获取用户数量
    const usersResponse = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const usersData = await usersResponse.json()
    stats.value.totalUsers = usersData.length

    // 获取植物数量
    const plantsResponse = await fetch(`${import.meta.env.VITE_API_URL}/plants`)
    const plantsData = await plantsResponse.json()
    stats.value.totalPlants = plantsData.length

    // 计算总种子数（这里使用模拟数据，实际应从数据库中获取）
    // 假设每个用户平均有10个种子
    stats.value.totalSeeds = usersData.length * 10

    // 计算总积分（从用户数据中获取，排除管理员）
    stats.value.totalPoints = usersData
      .filter(user => user.role !== 'admin')
      .reduce((total, user) => total + (user.points || 0), 0)

    // 获取订单数量
    const ordersResponse = await fetch(`${import.meta.env.VITE_API_URL}/admin/orders`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const ordersData = await ordersResponse.json()
    if (ordersData && Array.isArray(ordersData.orders)) {
      stats.value.totalOrders = ordersData.orders.length
    } else {
      stats.value.totalOrders = 0
    }

    // 获取今日活跃用户数
    const activeUsersResponse = await fetch(`${import.meta.env.VITE_API_URL}/admin/active-users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const activeUsersData = await activeUsersResponse.json()
    stats.value.todayActiveUsers = activeUsersData.count || 0

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

.admin-content {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
  min-height: 100vh;
}

.admin-content h1 {
  margin: 0 0 32px 0;
  color: #1d6ed7;
  font-size: 1.8rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card h3 {
  margin: 0 0 10px 0;
  color: #666;
  font-size: 0.95rem;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: #1d6ed7;
  margin: 0;
}

.stat-hint {
  font-size: 0.75rem;
  color: #999;
  margin: 6px 0 0 0;
  cursor: pointer;
}

.stat-card:hover {
  cursor: pointer;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.recent-activity h2 {
  margin: 0 0 20px 0;
  color: #1d6ed7;
  font-size: 1.3rem;
}

.activity-list {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-time {
  color: #999;
  font-size: 0.85rem;
}

.activity-content {
  color: #333;
  font-size: 0.9rem;
}

@media (prefers-color-scheme: dark) {
  .admin-page {
    background: #1a1a1a;
  }

  .admin-sidebar {
    background: #1a3a1a;
  }

  .admin-content h1,
  .admin-content h2 {
    color: #1d6ed7;
  }

  .stat-card {
    background: #2a2a2a;
  }

  .stat-card h3 {
    color: #aaa;
  }

  .stat-value {
    color: #1d6ed7;
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

@media (max-width: 767px) {
  .admin-page {
    flex-direction: column;
  }

  .admin-content {
    padding: 20px 16px;
    padding-top: 70px;
  }

  .admin-content h1 {
    font-size: 1.4rem;
    margin-bottom: 24px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    margin-bottom: 24px;
  }

  .stat-card {
    padding: 16px 12px;
  }

  .stat-card h3 {
    font-size: 0.85rem;
    margin-bottom: 8px;
  }

  .stat-value {
    font-size: 1.4rem;
  }

  .stat-hint {
    font-size: 0.7rem;
  }

  .recent-activity h2 {
    font-size: 1.1rem;
    margin-bottom: 16px;
  }

  .activity-list {
    padding: 16px;
  }

  .activity-item {
    padding: 12px 0;
    flex-direction: column;
    gap: 4px;
  }

  .activity-time {
    font-size: 0.75rem;
  }

  .activity-content {
    font-size: 0.85rem;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .admin-content {
    padding: 24px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .stat-card {
    padding: 18px;
  }
}

@media (min-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
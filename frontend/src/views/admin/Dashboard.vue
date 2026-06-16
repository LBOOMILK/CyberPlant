<template>
  <div class="admin-page">
    <Toast ref="toastRef" />
    <AdminSidebar />

    <div class="admin-content">
      <h1>仪表盘</h1>

      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">👥</span>
          <span class="stat-value">{{ stats.totalUsers }}</span>
          <span class="stat-label">总用户数</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📦</span>
          <span class="stat-value">{{ stats.totalItems }}</span>
          <span class="stat-label">总物品数</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🪙</span>
          <span class="stat-value">{{ stats.totalSilverCoin }}</span>
          <span class="stat-label">总银币</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🥇</span>
          <span class="stat-value">{{ stats.totalGoldCoin }}</span>
          <span class="stat-label">总金币</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">💎</span>
          <span class="stat-value">{{ stats.totalDiamond }}</span>
          <span class="stat-label">总钻石</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📋</span>
          <span class="stat-value">{{ stats.totalOrders }}</span>
          <span class="stat-label">总订单数</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🔥</span>
          <span class="stat-value">{{ stats.todayActiveUsers }}</span>
          <span class="stat-label">今日活跃</span>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="quick-actions">
        <h2>快捷操作</h2>
        <div class="action-grid">
          <button class="action-btn" @click="$router.push('/admin/classic/plants')">
            <span class="action-icon">🌱</span>
            <span>商店管理</span>
          </button>
          <button class="action-btn" @click="$router.push('/admin/classic/users')">
            <span class="action-icon">👥</span>
            <span>用户管理</span>
          </button>
          <button class="action-btn" @click="$router.push('/admin/classic/orders')">
            <span class="action-icon">📋</span>
            <span>订单管理</span>
          </button>
          <button class="action-btn" @click="$router.push('/admin/classic/config')">
            <span class="action-icon">⚙️</span>
            <span>全局配置</span>
          </button>
          <button class="action-btn" @click="$router.push('/admin/classic/effects')">
            <span class="action-icon">✨</span>
            <span>特效管理</span>
          </button>
          <button class="action-btn" @click="$router.push('/admin')">
            <span class="action-icon">⚡</span>
            <span>枢纽视图</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Toast from '@/components/common/Toast.vue'
import AdminSidebar from '@/components/admin/AdminSidebar.vue'

const toastRef = ref(null)
const loading = ref(true)
const stats = ref({
  totalUsers: 0,
  totalItems: 0,
  totalSilverCoin: 0,
  totalGoldCoin: 0,
  totalDiamond: 0,
  totalOrders: 0,
  todayActiveUsers: 0
})

async function loadStats() {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      stats.value = { ...stats.value, ...data }
    }
  } catch (e) {
    console.error('Failed to load stats:', e)
    toastRef.value?.addToast('获取统计数据失败', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<style scoped>
.admin-page {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary, #0f172a);
  color: var(--text-primary, #f1f5f9);
}

.admin-content {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
  min-height: 100vh;
}

.admin-content h1 {
  margin: 0 0 24px 0;
  color: #f59e0b;
  font-size: 1.6rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: rgba(245,158,11,0.05);
  border: 1px solid rgba(245,158,11,0.15);
  border-radius: 10px;
  transition: all 0.2s;
}

.stat-card:hover {
  background: rgba(245,158,11,0.1);
  border-color: rgba(245,158,11,0.3);
  transform: translateY(-2px);
}

.stat-icon { font-size: 24px; }
.stat-value { font-size: 20px; font-weight: 700; color: #f59e0b; }
.stat-label { font-size: 11px; color: var(--text-muted, #8b949e); }

.quick-actions h2 {
  margin: 0 0 16px 0;
  color: #f59e0b;
  font-size: 1.2rem;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border-color, #334155);
  border-radius: 10px;
  color: var(--text-primary, #f1f5f9);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.action-btn:hover {
  background: rgba(245,158,11,0.1);
  border-color: rgba(245,158,11,0.3);
  transform: translateY(-2px);
}

.action-icon { font-size: 24px; }

@media (max-width: 767px) {
  .admin-content { padding: 16px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .action-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
}
</style>

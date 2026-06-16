<template>
  <div class="stats-panel">
    <div v-if="loading" class="panel-loading">加载中...</div>
    <div v-else class="stats-grid">
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

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
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<style scoped>
.stats-panel { font-size: 13px; }
.panel-loading { text-align: center; padding: 40px; color: var(--text-muted, #8b949e); }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}
.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: rgba(0,255,136,0.03);
  border: 1px solid rgba(0,255,136,0.1);
  border-radius: 10px;
  transition: all 0.2s;
}
.stat-card:hover {
  background: rgba(0,255,136,0.06);
  border-color: rgba(0,255,136,0.2);
}
.stat-icon { font-size: 24px; }
.stat-value { font-size: 20px; font-weight: 700; color: #00ff88; }
.stat-label { font-size: 11px; color: var(--text-muted, #8b949e); }
</style>

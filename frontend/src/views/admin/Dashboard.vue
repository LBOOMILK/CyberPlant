<template>
  <div class="dashboard-page">
    <Toast ref="toastRef" />
    <h1>仪表盘</h1>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <h3>总用户数</h3>
        <p class="stat-value">{{ stats.totalUsers }}</p>
      </div>
      <div class="stat-card clickable" @click="nextStat">
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

    <!-- 最近订单 -->
    <div class="recent-section">
      <h2>最近订单</h2>
      <div class="table-wrapper" v-if="recentOrders.length">
        <table class="data-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>类型</th>
              <th>货币</th>
              <th>金额</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in recentOrders" :key="order.id">
              <td>{{ order.user?.name || '—' }}</td>
              <td>{{ typeLabel(order.type) }}</td>
              <td>{{ currencyLabel(order.currency_type) }}</td>
              <td :class="order.amount >= 0 ? 'amount-pos' : 'amount-neg'">
                {{ order.amount >= 0 ? '+' : '' }}{{ order.amount }}
              </td>
              <td class="time-cell">{{ formatTime(order.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">暂无订单数据</div>
    </div>

    <!-- 危险操作区 -->
    <div class="danger-section">
      <h2>危险操作</h2>
      <div class="danger-card">
        <div class="danger-info">
          <span class="danger-icon">⚠️</span>
          <div>
            <p class="danger-title">快速重置</p>
            <p class="danger-desc">清空所有数据并重建，创建两个演示账号（各 10000 货币）</p>
          </div>
        </div>
        <button class="danger-btn" @click="showResetConfirm = true">重置数据库</button>
      </div>
    </div>

    <!-- 重置确认弹窗 -->
    <div v-if="showResetConfirm" class="modal-overlay" @mousedown.self="showResetConfirm = false">
      <div class="modal-card" style="max-width:420px;">
        <h3>⚠️ 确认重置</h3>
        <p style="color:var(--text-secondary,#8b949e);margin:0 0 8px 0;font-size:13px;">此操作将清空所有数据并重建，包括：</p>
        <ul style="color:#f87171;font-size:12px;margin:0 0 16px 20px;line-height:1.8;">
          <li>所有用户账号和数据</li>
          <li>所有物品、宠物、装饰数据</li>
          <li>所有订单和好友关系</li>
          <li>全局配置（重置为默认值）</li>
        </ul>
        <p style="color:var(--text-secondary,#8b949e);margin:0 0 16px 0;font-size:13px;">重建后自动插入默认数据，并创建两个演示账号。</p>
        <div class="modal-actions" style="justify-content:center;">
          <button @click="showResetConfirm = false">取消</button>
          <button class="primary" style="background:rgba(220,38,38,0.15);border-color:#dc2626;color:#f87171;" @click="doReset">确认重置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Toast from '@/components/common/Toast.vue'

const toastRef = ref(null)
const stats = ref({
  totalUsers: 0,
  totalItems: 0,
  totalSilverCoin: 0,
  totalGoldCoin: 0,
  totalDiamond: 0,
  totalOrders: 0,
  todayActiveUsers: 0
})
const currentStatIndex = ref(0)
const statTypes = ['totalItems', 'totalSilverCoin', 'totalGoldCoin', 'totalDiamond']
const statLabels = {
  totalItems: '总物品数',
  totalSilverCoin: '总银币',
  totalGoldCoin: '总金币',
  totalDiamond: '总钻石'
}
const recentOrders = ref([])
const showResetConfirm = ref(false)

function nextStat() {
  currentStatIndex.value = (currentStatIndex.value + 1) % statTypes.length
}

function typeLabel(type) {
  const map = { purchase: '购买', refund: '退款', gift: '赠送', reward: '奖励', admin: '管理' }
  return map[type] || type || '—'
}

function currencyLabel(type) {
  const map = { silver_coin: '银币', gold_coin: '金币', diamond: '钻石' }
  return map[type] || type || '—'
}

function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay < 7) return `${diffDay}天前`
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

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
  }
}

async function loadRecentOrders() {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/orders?limit=5`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      recentOrders.value = data.orders || []
    }
  } catch (e) {
    console.error('Failed to load recent orders:', e)
  }
}

async function doReset() {
  showResetConfirm.value = false
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      toastRef.value?.addToast('重置成功！演示账号：' + data.accounts.map(a => a.email).join('、'), 'success')
      await loadStats()
      await loadRecentOrders()
    } else {
      const err = await r.json()
      toastRef.value?.addToast(err.error || '重置失败', 'error')
    }
  } catch (e) {
    toastRef.value?.addToast('网络错误', 'error')
  }
}

onMounted(() => {
  loadStats()
  loadRecentOrders()
})
</script>

<style scoped>
.dashboard-page h1 {
  margin: 0 0 24px 0;
  color: #f59e0b;
  font-size: 1.6rem;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: rgba(245, 158, 11, 0.05);
  border: 1px solid rgba(245, 158, 11, 0.15);
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.08);
}

.stat-card.clickable {
  cursor: pointer;
}

.stat-card h3 {
  margin: 0 0 10px 0;
  color: var(--text-muted, #8b949e);
  font-size: 0.9rem;
  font-weight: 500;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #f59e0b;
  margin: 0;
}

.stat-hint {
  font-size: 0.7rem;
  color: var(--text-muted, #6b7280);
  margin: 6px 0 0 0;
}

/* 最近订单 */
.recent-section h2 {
  margin: 0 0 16px 0;
  color: #f59e0b;
  font-size: 1.2rem;
}

.table-wrapper {
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border-color, #334155);
  border-radius: 12px;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  font-size: 0.875rem;
}

.data-table th {
  background: rgba(245, 158, 11, 0.08);
  color: var(--text-muted, #8b949e);
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.data-table tbody tr {
  border-top: 1px solid var(--border-color, #334155);
  transition: background 0.15s;
}

.data-table tbody tr:hover {
  background: rgba(245, 158, 11, 0.04);
}

.data-table td {
  color: var(--text-primary, #f1f5f9);
}

.amount-pos { color: #22c55e; }
.amount-neg { color: #ef4444; }
.time-cell { color: var(--text-muted, #8b949e); font-size: 0.8rem; }

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-muted, #6b7280);
  font-size: 0.9rem;
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border-color, #334155);
  border-radius: 12px;
}

@media (max-width: 767px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .stat-card { padding: 14px 10px; }
  .stat-value { font-size: 1.4rem; }
  .data-table th,
  .data-table td { padding: 8px 10px; font-size: 0.8rem; }
}

/* 危险操作区 */
.danger-section {
  margin-top: 32px;
}
.danger-section h2 {
  margin: 0 0 16px 0;
  color: #ef4444;
  font-size: 1.2rem;
}
.danger-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
  gap: 16px;
}
.danger-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.danger-icon { font-size: 1.5rem; }
.danger-title {
  margin: 0;
  font-weight: 600;
  color: var(--text-primary, #f1f5f9);
  font-size: 0.95rem;
}
.danger-desc {
  margin: 4px 0 0 0;
  color: var(--text-muted, #8b949e);
  font-size: 0.8rem;
}
.danger-btn {
  padding: 8px 20px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #ef4444;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.danger-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 100; display: flex; align-items: center; justify-content: center;
}
.modal-card {
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border-color, #30363d);
  border-radius: 12px; padding: 24px; width: 90%; max-width: 500px;
}
.modal-card h3 { color: #f59e0b; margin: 0 0 16px 0; font-size: 15px; }
.modal-actions {
  display: flex; justify-content: flex-end; gap: 8px;
}
.modal-actions button {
  padding: 6px 16px; border-radius: 6px; font-size: 13px;
  cursor: pointer; border: 1px solid var(--border-color, #30363d);
  background: var(--bg-tertiary, #21262d); color: var(--text-primary, #c9d1d9);
}
.modal-actions button.primary {
  background: rgba(0,255,136,0.15); border-color: #00ff88; color: #00ff88;
}
.modal-actions button:hover { opacity: 0.8; }
</style>

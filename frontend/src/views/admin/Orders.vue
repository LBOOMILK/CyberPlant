<template>
  <div class="orders-page">
    <h1>订单管理</h1>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="orders.length === 0" class="empty-msg">
      <p>暂无订单记录</p>
    </div>

    <div v-else class="orders-table">
      <table>
        <thead>
          <tr>
            <th>订单ID</th>
            <th>用户</th>
            <th>操作类型</th>
            <th>货币类型</th>
            <th>金额变化</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td>{{ order.id }}</td>
            <td>{{ order.user?.name || order.user_id }}</td>
            <td>{{ orderTypeText(order.type) }}</td>
            <td>{{ currencyName(order.currency_type) }}</td>
            <td :class="amountClass(order.amount)">{{ formatAmount(order.amount) }}</td>
            <td>{{ formatTime(order.created_at) }}</td>
            <td>
              <button class="action-btn-sm danger" @click="handleDeleteOrder(order.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分页 -->
      <div class="pagination">
        <button class="page-btn" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">‹ 上一页</button>
        <div class="page-numbers">
          <button
            v-for="p in visiblePages"
            :key="p"
            :class="['page-num', { active: p === currentPage, ellipsis: p === '...' }]"
            :disabled="p === '...'"
            @click="p !== '...' && goPage(p)"
          >{{ p }}</button>
        </div>
        <button class="page-btn" :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)">下一页 ›</button>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteModal" class="modal-overlay" @mousedown.self="cancelDeleteOrder">
      <div class="modal-card" style="max-width:400px;text-align:center;">
        <h3>⚠️ 删除订单</h3>
        <p style="color:var(--text-secondary,#8b949e);margin:0 0 8px 0;font-size:13px;">确定要删除此订单吗？</p>
        <p style="color:#f87171;font-weight:600;margin:0 0 20px 0;font-size:12px;">删除订单无法找回，且其操作并不会撤回。</p>
        <div class="modal-actions" style="justify-content:center;">
          <button @click="cancelDeleteOrder">取消</button>
          <button class="primary" style="background:rgba(220,38,38,0.15);border-color:#dc2626;color:#f87171;" @click="confirmDeleteOrder">确定删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const orders = ref([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const limit = 10
const showDeleteModal = ref(false)
const deletingOrderId = ref(null)

const orderTypeMap = {
  SHOP_PURCHASE: '商店购买', SHOP_SELL: '商店出售', EXCHANGE: '货币兑换',
  CURRENCY_EXCHANGE: '货币兑换', CURRENCY_GIFT: '货币赠送', PLOT_UNLOCK: '地块解锁',
  PLOT_UPGRADE: '地块升级', NEWBIE_PACK: '新手礼包', PET_PURCHASE: '购买宠物',
  DECORATION_PURCHASE: '购买装饰', PURCHASE_SEED: '购买种子', SELL_SEED: '卖出种子',
  SELL_CROP: '卖出作物', PURCHASE_USE: '购买肥料', SELL_USE: '卖出肥料'
}

function orderTypeText(type) { return orderTypeMap[type] || type }
function currencyName(type) {
  const map = { silver_coin: '银币', gold_coin: '金币', diamond: '钻石' }
  return map[type] || type || '-'
}
function amountClass(amount) { return amount > 0 ? 'amount-positive' : 'amount-negative' }
function formatAmount(amount) { return amount > 0 ? `+${amount}` : String(amount) }
function formatTime(time) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const visiblePages = computed(() => {
  const total = totalPages.value
  const cur = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = []
  pages.push(1)
  if (cur > 3) pages.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
  if (cur < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

async function loadOrders(page = 1) {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/orders?page=${page}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      orders.value = data.orders || []
      totalPages.value = data.pagination?.totalPages || 1
      currentPage.value = data.pagination?.page || page
    }
  } catch (e) {
    console.error('Failed to load orders:', e)
  } finally {
    loading.value = false
  }
}

function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  loadOrders(p)
}

function handleDeleteOrder(id) {
  deletingOrderId.value = id
  showDeleteModal.value = true
}

async function confirmDeleteOrder() {
  if (!deletingOrderId.value) return
  const token = localStorage.getItem('auth_token')
  await fetch(`${import.meta.env.VITE_API_URL}/admin/orders/${deletingOrderId.value}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
  })
  showDeleteModal.value = false
  deletingOrderId.value = null
  await loadOrders(currentPage.value)
}

function cancelDeleteOrder() {
  showDeleteModal.value = false
  deletingOrderId.value = null
}

onMounted(() => loadOrders())
</script>

<style scoped>
.orders-page h1 {
  margin: 0 0 24px 0;
  color: #f59e0b;
  font-size: 1.6rem;
}

.loading {
  text-align: center;
  padding: 60px 0;
  color: var(--text-muted, #8b949e);
}
.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color, #21262d);
  border-top-color: #f59e0b;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-msg {
  text-align: center;
  padding: 60px 0;
  color: var(--text-muted, #6b7280);
}

.orders-table {
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border-color, #334155);
  border-radius: 12px;
  overflow: hidden;
}
.orders-table table {
  width: 100%;
  border-collapse: collapse;
}
.orders-table th,
.orders-table td {
  padding: 12px 16px;
  text-align: left;
  font-size: 0.875rem;
}
.orders-table th {
  background: rgba(245, 158, 11, 0.08);
  color: var(--text-muted, #8b949e);
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.orders-table tbody tr {
  border-top: 1px solid var(--border-color, #334155);
  transition: background 0.15s;
}
.orders-table tbody tr:hover {
  background: rgba(245, 158, 11, 0.04);
}
.orders-table td {
  color: var(--text-primary, #f1f5f9);
}

.amount-positive { color: #22c55e; font-weight: 600; }
.amount-negative { color: #ef4444; font-weight: 600; }

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color, #334155);
}
.page-btn {
  padding: 6px 14px;
  border: 1px solid var(--border-color, #334155);
  border-radius: 6px;
  background: var(--bg-primary, #0f172a);
  color: var(--text-primary, #f1f5f9);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.page-btn:hover:not(:disabled) {
  border-color: #f59e0b;
  color: #f59e0b;
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.page-numbers {
  display: flex;
  gap: 4px;
}
.page-num {
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted, #8b949e);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.page-num:hover:not(.active):not(.ellipsis) {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}
.page-num.active {
  background: #f59e0b;
  color: #000;
  font-weight: 600;
}
.page-num.ellipsis {
  cursor: default;
  color: var(--text-muted, #6b7280);
}

/* 弹窗 */
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

.action-btn-sm {
  padding: 3px 8px; border: 1px solid rgba(220,38,38,0.3); border-radius: 4px;
  background: rgba(220,38,38,0.1); color: #f87171; font-size: 11px; cursor: pointer;
}
.action-btn-sm:hover { background: rgba(220,38,38,0.2); }
</style>

<template>
  <div class="orders-page">
    <h1>📋 我的订单</h1>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="computedOrders.length === 0" class="empty-msg">
      <p>暂无订单记录</p>
    </div>

    <div v-else class="orders-list">
      <div v-for="(order, index) in computedOrders" :key="order.id || index" class="order-item">
        <div class="order-header">
          <div class="order-type" :class="orderTypeClass(order)">
            {{ orderTypeText(order) }}
          </div>
          <div class="order-time">{{ formatTime(order.created_at) }}</div>
        </div>
        <div class="order-amount" :class="amountClass(order.amount)">
          {{ formatAmount(order.amount) }}
          <span class="order-currency">
            <span v-if="getCurrencyDisplay(order.currency_type).img" class="currency-icon-wrapper">
              <img :src="getCurrencyDisplay(order.currency_type).img" :alt="formatCurrencyType(order.currency_type)" class="order-currency-icon" />
            </span>
            <span v-else class="currency-emoji">{{ getCurrencyDisplay(order.currency_type).icon }}</span>
            {{ formatCurrencyType(order.currency_type) }}
          </span>
        </div>
      </div>

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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()
const orders = ref([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)

// 响应式 limit：PC 20条，移动端 10条
const limit = ref(window.innerWidth >= 768 ? 20 : 10)

function updateLimit() {
  const newLimit = window.innerWidth >= 768 ? 20 : 10
  if (newLimit !== limit.value) {
    limit.value = newLimit
    // 重新加载当前页
    loadOrders(currentPage.value)
  }
}

// 计算属性，确保订单数据是数组
const computedOrders = computed(() => {
  return Array.isArray(orders.value) ? orders.value : []
})

// 分页可见页码
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

// 货币配置
const currencyConfig = {
  silver_coin: { name: '银币', icon: '/silver_icon.png', img: '/silver_icon.png' },
  gold_coin: { name: '金币', icon: '/gold_icon.png', img: '/gold_icon.png' },
  diamond: { name: '钻石', icon: '/diamond.png', img: '/diamond.png' }
}

function getCurrencyDisplay(type) {
  return currencyConfig[type] || { name: type || '未知', icon: '❓', img: '' }
}

// 订单类型中文映射
const orderTypeMap = {
  SHOP_PURCHASE: '购买物品',
  SHOP_SELL: '出售物品',
  PURCHASE_SEED: '购买种子',
  SELL_SEED: '出售种子',
  SELL_CROP: '出售作物',
  PURCHASE_FERTILIZER: '购买肥料',
  SELL_FERTILIZER: '出售肥料',
  PURCHASE_PET: '购买宠物',
  PET_PURCHASE: '购买宠物',
  PURCHASE_PET_FOOD: '购买宠物粮',
  SELL_PET_FOOD: '出售宠物粮',
  PURCHASE_DECORATION: '购买装饰',
  DECORATION_PURCHASE: '购买装饰',
  CURRENCY_EXCHANGE: '货币兑换',
  EXCHANGE: '货币兑换',
  CURRENCY_GIFT: '赠送礼物',
  PLOT_UNLOCK: '解锁地块',
  PLOT_UPGRADE: '升级地块',
  NEWBIE_PACK: '新手礼包',
  HARVEST: '收获作物'
}

function orderTypeText(order) {
  if (order.type === 'CURRENCY_GIFT') {
    return Number(order.amount) > 0 ? '收到礼物' : '赠送礼物'
  }
  return orderTypeMap[order.type] || order.type
}

function orderTypeClass(order) {
  const type = order.type
  if (type.includes('SELL') || type === 'HARVEST') return 'type-sell'
  if (type.includes('PURCHASE') || type.includes('UNLOCK') || type.includes('UPGRADE')) return 'type-purchase'
  if (type === 'EXCHANGE' || type === 'CURRENCY_EXCHANGE') return 'type-exchange'
  if (type.includes('GIFT')) return 'type-gift'
  return ''
}

function formatTime(timeString) {
  if (!timeString) return ''
  const date = new Date(timeString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatAmount(amount) {
  const sign = amount > 0 ? '+' : ''
  return `${sign}${amount}`
}

function formatCurrencyType(type) {
  const c = getCurrencyDisplay(type)
  return c.name
}

function amountClass(amount) {
  return amount > 0 ? 'amount-positive' : 'amount-negative'
}

// 加载订单
async function loadOrders(page = 1) {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('未登录')

    const url = `${import.meta.env.VITE_API_URL}/orders?page=${page}&limit=${limit.value}`
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) throw new Error('获取订单失败')

    const data = await response.json()
    orders.value = data.orders || []
    totalPages.value = data.pagination?.totalPages || 1
    currentPage.value = data.pagination?.page || page
  } catch (error) {
    console.error('Failed to load orders:', error)
  } finally {
    loading.value = false
  }
}

function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  loadOrders(p)
}

onMounted(() => {
  loadOrders()
  window.addEventListener('resize', updateLimit)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateLimit)
})
</script>

<style scoped>
.orders-page {
  min-height: 100vh;
  padding: 40px 20px 80px;
  background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
}

.orders-page h1 {
  text-align: center;
  color: #2c5a2a;
  margin-bottom: 30px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(44, 90, 42, 0.3);
  border-radius: 50%;
  border-top-color: #2c5a2a;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-msg {
  text-align: center;
  padding: 60px 0;
  color: #666;
}

.orders-list {
  max-width: 800px;
  margin: 0 auto;
}

.order-item {
  background: rgba(255, 248, 235, 0.95);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.order-item:hover {
  transform: translateY(-2px);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.order-type {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: bold;
}

.type-purchase {
  background: rgba(25, 118, 210, 0.2);
  color: #1976d2;
}

.type-sell {
  background: #e8f5e9;
  color: #388e3c;
}

.type-exchange {
  background: #fff3e0;
  color: #e65100;
}

.type-gift {
  background: #fce4ec;
  color: #c2185b;
}

.order-time {
  font-size: 0.875rem;
  color: #666;
}

.order-amount {
  font-size: 1.25rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-currency {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9rem;
  font-weight: normal;
  color: #666;
}

.order-currency-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.currency-emoji {
  font-size: 1rem;
}

.amount-positive {
  color: #388e3c;
}

.amount-negative {
  color: #d32f2f;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0 8px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid rgba(44, 90, 42, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  color: #2c5a2a;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: rgba(76, 175, 80, 0.15);
  border-color: #4caf50;
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
  width: 34px;
  height: 34px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-num:hover:not(.active):not(.ellipsis) {
  background: rgba(76, 175, 80, 0.1);
  color: #2c5a2a;
}

.page-num.active {
  background: #4caf50;
  color: #fff;
  font-weight: 600;
}

.page-num.ellipsis {
  cursor: default;
  color: #999;
}

@media (prefers-color-scheme: dark) {
  .orders-page {
    background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
  }

  .orders-page h1 {
    color: #8bc34a;
  }

  .order-item {
    background: rgba(30, 30, 25, 0.95);
    color: #e0e0d0;
  }

  .order-time {
    color: #aaa;
  }

  .empty-msg {
    color: #aaa;
  }

  .type-purchase {
    background: rgba(25, 118, 210, 0.2);
    color: #64b5f6;
  }

  .type-sell {
    background: rgba(56, 142, 60, 0.2);
    color: #81c784;
  }

  .type-exchange {
    background: rgba(230, 81, 0, 0.2);
    color: #ffb74d;
  }

  .type-gift {
    background: rgba(194, 24, 91, 0.2);
    color: #f48fb1;
  }

  .amount-positive {
    color: #81c784;
  }

  .amount-negative {
    color: #e57373;
  }

  .order-currency {
    color: #aaa;
  }

  .page-btn {
    background: rgba(30, 30, 25, 0.8);
    border-color: rgba(139, 195, 74, 0.3);
    color: #8bc34a;
  }

  .page-btn:hover:not(:disabled) {
    background: rgba(76, 175, 80, 0.2);
    border-color: #4caf50;
  }

  .page-num {
    color: #aaa;
  }

  .page-num:hover:not(.active):not(.ellipsis) {
    background: rgba(76, 175, 80, 0.15);
    color: #8bc34a;
  }

  .page-num.active {
    background: #4caf50;
    color: #000;
  }
}
</style>

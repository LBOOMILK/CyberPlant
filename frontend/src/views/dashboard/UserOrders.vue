<template>
  <div class="orders-page">
    <h1>📋 我的订单</h1>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else class="orders-list">
      <div v-if="computedOrders.length === 0" class="empty-msg">
        <p>暂无订单记录</p>
      </div>
      <div v-for="(order, index) in computedOrders" :key="order.id || index" class="order-item">
        <div class="order-header">
          <div class="order-type" :class="orderTypeClass(order.type)">
            {{ orderTypeText(order.type) }}
          </div>
          <div class="order-time">{{ formatTime(order.created_at) }}</div>
        </div>
        <div class="order-amount" :class="amountClass(order.amount)">
          {{ formatAmount(order.amount) }}
        </div>
      </div>
      <div v-if="loadingMore" class="loading-more">
        <div class="loading-spinner small"></div>
        <p>加载更多...</p>
      </div>
      <div v-if="!hasMore && computedOrders.length > 0" class="end-msg">
        <p>没有更多订单了</p>
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
const loadingMore = ref(false)
const hasMore = ref(true)
const page = ref(1)
const limit = ref(10)

// 计算属性，确保订单数据是数组
const computedOrders = computed(() => {
  console.log('Computed orders:', orders.value)
  return Array.isArray(orders.value) ? orders.value : []
})

// 订单类型中文映射
const orderTypeMap = {
  PURCHASE_SEED: '购买种子',
  SELL_SEED: '卖出种子',
  SELL_CROP: '卖出作物'
}

// 获取订单类型文本
function orderTypeText(type) {
  return orderTypeMap[type] || type
}

// 获取订单类型样式类
function orderTypeClass(type) {
  switch (type) {
    case 'PURCHASE_SEED':
      return 'type-purchase'
    case 'SELL_SEED':
      return 'type-sell'
    case 'SELL_CROP':
      return 'type-sell'
    default:
      return ''
  }
}

// 格式化时间
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

// 格式化金额
function formatAmount(amount) {
  const sign = amount > 0 ? '+' : ''
  return `${sign}${amount} 积分`
}

// 获取金额样式类
function amountClass(amount) {
  return amount > 0 ? 'amount-positive' : 'amount-negative'
}

// 加载订单
async function loadOrders(isLoadMore = false) {
  if (isLoadMore && (loadingMore.value || !hasMore.value)) return

  try {
    if (isLoadMore) {
      loadingMore.value = true
    } else {
      loading.value = true
    }

    const token = localStorage.getItem('auth_token')
    console.log('Token:', token)
    if (!token) {
      throw new Error('未登录')
    }

    const url = `${import.meta.env.VITE_API_URL}/orders?page=${isLoadMore ? page.value + 1 : 1}&limit=${limit.value}`
    console.log('Fetching orders from:', url)
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    console.log('Response status:', response.status)
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error response:', errorText)
      throw new Error('获取订单失败')
    }

    const data = await response.json()
    console.log('Order data:', data)
    console.log('Order data type:', typeof data)
    console.log('Orders array:', data.orders)
    console.log('Orders array length:', data.orders.length)
    
    if (isLoadMore) {
      orders.value = [...orders.value, ...data.orders]
      page.value++
    } else {
      orders.value = data.orders
      page.value = 1
    }

    hasMore.value = data.orders.length === limit.value
    console.log('Orders:', orders.value)
    console.log('Orders length:', orders.value.length)
  } catch (error) {
    console.error('Failed to load orders:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// 滚动事件处理
function handleScroll() {
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
  const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight
  const clientHeight = document.documentElement.clientHeight

  if (scrollTop + clientHeight >= scrollHeight - 100) {
    loadOrders(true)
  }
}

// 生命周期
onMounted(async () => {
  try {
    await userStore.loadFromLocal()
    await loadOrders()
    window.addEventListener('scroll', handleScroll)
  } catch (error) {
    console.error('Failed to load user data:', error)
    // 即使loadFromLocal失败，也要尝试加载订单
    await loadOrders()
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
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

.loading-spinner.small {
  width: 20px;
  height: 20px;
  border-width: 2px;
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
  background: #e3f2fd;
  color: #1976d2;
}

.type-sell {
  background: #e8f5e9;
  color: #388e3c;
}

.order-time {
  font-size: 0.875rem;
  color: #666;
}

.order-amount {
  font-size: 1.25rem;
  font-weight: bold;
}

.amount-positive {
  color: #388e3c;
}

.amount-negative {
  color: #d32f2f;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  color: #666;
}

.loading-more .loading-spinner {
  margin-right: 12px;
  margin-bottom: 0;
}

.end-msg {
  text-align: center;
  padding: 20px 0;
  color: #666;
  font-size: 0.875rem;
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

  .empty-msg,
  .loading-more,
  .end-msg {
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

  .amount-positive {
    color: #81c784;
  }

  .amount-negative {
    color: #e57373;
  }
}
</style>
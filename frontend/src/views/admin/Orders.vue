<template>
  <div class="admin-page">
    <AdminSidebar />
    
    <div class="admin-content">
      <h1>订单管理</h1>
      
      <div class="action-bar">
      </div>
      
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
              <th>用户ID</th>
              <th>操作类型</th>
              <th>积分变化</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td>{{ order.id }}</td>
              <td>{{ order.user_id }}</td>
              <td>{{ orderTypeText(order.type) }}</td>
              <td :class="amountClass(order.amount)">{{ formatAmount(order.amount) }}</td>
              <td>{{ formatTime(order.created_at) }}</td>
              <td>
                <button class="delete-btn" @click="handleDeleteOrder(order.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="loadingMore" class="loading-more">
          <div class="loading-spinner small"></div>
          <p>加载更多...</p>
        </div>
        
        <div v-if="!hasMore && orders.length > 0" class="end-msg">
          <p>没有更多订单了</p>
        </div>
      </div>
      
      <!-- 删除确认弹窗 -->
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="cancelDeleteOrder">
        <div class="modal-content">
          <h3>⚠️ 删除订单</h3>
          <p>确定要删除此订单吗？</p>
          <p class="warning-text">删除订单无法找回，且其操作并不会撤回。</p>
          <div class="modal-actions">
            <button class="cancel-btn" @click="cancelDeleteOrder">取消</button>
            <button class="confirm-btn" @click="confirmDeleteOrder">确定删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminSidebar from '@/components/AdminSidebar.vue'

const router = useRouter()
const orders = ref([])
const loading = ref(true)
const loadingMore = ref(false)
const hasMore = ref(true)
const page = ref(1)
const limit = ref(10)
const showDeleteModal = ref(false)
const deletingOrderId = ref(null)

// 订单类型中文映射
const orderTypeMap = {
  PURCHASE_SEED: '购买种子',
  SELL_SEED: '卖出种子',
  SELL_CROP: '卖出作物',
  PURCHASE_USE: '购买肥料',
  SELL_USE: '卖出肥料'
}

// 获取订单类型中文
function orderTypeText(type) {
  return orderTypeMap[type] || type
}

// 根据积分变化设置样式
function amountClass(amount) {
  return amount > 0 ? 'amount-positive' : 'amount-negative'
}

// 格式化积分变化
function formatAmount(amount) {
  return amount > 0 ? `+${amount}` : amount.toString()
}

// 格式化时间
function formatTime(time) {
  if (!time) return ''
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 加载订单数据
async function loadOrders(isLoadingMore = false) {
  if (isLoadingMore) {
    loadingMore.value = true
  } else {
    loading.value = true
    page.value = 1
    orders.value = []
  }
  
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/orders?page=${page.value}&limit=${limit.value}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      throw new Error('获取订单列表失败，请检查网络连接')
    }
    
    const data = await response.json()
    console.log('Order data:', data)
    
    if (isLoadingMore) {
      orders.value = [...orders.value, ...data.orders]
    } else {
      orders.value = data.orders
    }
    
    hasMore.value = data.pagination.hasMore
    page.value = data.pagination.currentPage + 1
  } catch (error) {
    console.error('Failed to load orders:', error)
    if (!isLoadingMore) {
      orders.value = []
      alert(error.message || '加载订单数据失败，请检查网络连接')
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// 处理滚动加载
function handleScroll() {
  if (loadingMore.value || !hasMore.value) return
  
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
  const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight
  const clientHeight = document.documentElement.clientHeight || window.innerHeight
  
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    loadOrders(true)
  }
}

// 处理删除订单
function handleDeleteOrder(orderId) {
  deletingOrderId.value = orderId
  showDeleteModal.value = true
}

// 确认删除订单
async function confirmDeleteOrder() {
  if (!deletingOrderId.value) return
  
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/orders/${deletingOrderId.value}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      throw new Error('删除订单失败，请检查网络连接')
    }
    
    // 重新加载订单列表
    await loadOrders()
    alert('订单删除成功')
  } catch (error) {
    console.error('Failed to delete order:', error)
    alert(error.message || '删除订单失败，请检查网络连接')
  } finally {
    showDeleteModal.value = false
    deletingOrderId.value = null
  }
}

// 取消删除订单
function cancelDeleteOrder() {
  showDeleteModal.value = false
  deletingOrderId.value = null
}

// 生命周期
onMounted(() => {
  loadOrders()
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
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
}

.admin-content h1 {
  margin: 0 0 32px 0;
  color: #2c5a2a;
}

.action-bar {
  display: flex;
  margin-bottom: 24px;
  justify-content: flex-end;
}


.orders-table {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.orders-table table {
  width: 100%;
  border-collapse: collapse;
}

.orders-table th,
.orders-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.orders-table th {
  background: #f5f5f5;
  font-weight: bold;
  color: #333;
}

.orders-table tr:hover {
  background: #f9f9f9;
}

.status-已完成 {
  color: #4caf50;
  font-weight: bold;
}

.status-待支付 {
  color: #ff9800;
  font-weight: bold;
}

.status-已取消 {
  color: #f44336;
  font-weight: bold;
}

.edit-btn,
.delete-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-right: 8px;
}

.edit-btn {
  background: #2196f3;
  color: white;
}

.edit-btn:hover {
  background: #1976d2;
}

.delete-btn {
  background: #f44336;
  color: white;
}

.delete-btn:hover {
  background: #d32f2f;
}

/* 加载状态 */
.loading,
.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #666;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4caf50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.loading-spinner.small {
  width: 24px;
  height: 24px;
  border-width: 2px;
  margin-bottom: 8px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 空状态 */
.empty-msg {
  text-align: center;
  padding: 60px 0;
  color: #999;
  font-size: 1.1rem;
}

/* 结束状态 */
.end-msg {
  text-align: center;
  padding: 20px 0;
  color: #999;
  font-size: 0.9rem;
  border-top: 1px solid #f0f0f0;
}

/* 积分变化样式 */
.amount-positive {
  color: #4caf50;
  font-weight: bold;
}

.amount-negative {
  color: #f44336;
  font-weight: bold;
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
  margin: 0 0 16px 0;
  color: #555;
}

.modal-content .warning-text {
  color: #f44336;
  font-weight: bold;
  margin-bottom: 24px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.cancel-btn,
.confirm-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.cancel-btn {
  background: #9e9e9e;
  color: white;
}

.cancel-btn:hover {
  background: #757575;
}

.confirm-btn {
  background: #f44336;
  color: white;
}

.confirm-btn:hover {
  background: #d32f2f;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .admin-page {
    background: #1a1a1a;
  }
  

  .admin-content h1 {
    color: #8bc34a;
  }
  
  .search-bar input {
    background: #2a2a2a;
    border-color: #444;
    color: #e0e0e0;
  }
  
  .orders-table {
    background: #2a2a2a;
  }
  
  .orders-table th {
    background: #3a3a3a;
    color: #e0e0e0;
  }
  
  .orders-table td {
    border-bottom: 1px solid #3a3a3a;
    color: #e0e0e0;
  }
  
  .orders-table tr:hover {
    background: #333;
  }
  
  .loading,
  .loading-more {
    color: #aaa;
  }
  
  .loading-spinner {
    border-color: #333;
    border-top-color: #8bc34a;
  }
  
  .empty-msg {
    color: #666;
  }
  
  .end-msg {
    color: #666;
    border-top-color: #3a3a3a;
  }
  
  .amount-positive {
    color: #8bc34a;
  }
  
  .amount-negative {
    color: #ef5350;
  }
  
  /* 深色模式弹窗 */
  .modal-content {
    background: #333;
  }
  
  .modal-content h3 {
    color: #8bc34a;
  }
  
  .modal-content p {
    color: #ddd;
  }
  
  .modal-content .warning-text {
    color: #ef5350;
  }
  
  .cancel-btn {
    background: #555;
  }
  
  .cancel-btn:hover {
    background: #444;
  }
  
  .confirm-btn {
    background: #d32f2f;
  }
  
  .confirm-btn:hover {
    background: #b71c1c;
  }
}
</style>
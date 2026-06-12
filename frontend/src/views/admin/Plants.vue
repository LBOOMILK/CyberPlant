<template>
  <div class="admin-page">
    <Toast ref="toastRef" />
    <AdminSidebar />
    
    <div class="admin-content">
      <h1>商店管理</h1>
      
      <div class="action-bar">
        <select v-model="filterType" class="filter-select">
          <option value="all">全部类型</option>
          <option value="seed">🌱 种子</option>
          <option value="fertilizer">🧪 肥料</option>
          <option value="pet_food">🍖 宠物粮</option>
        </select>
        <button class="add-btn" @click="showAddModal = true">添加物品</button>
      </div>
      
      <div class="items-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>图标</th>
              <th>名称</th>
              <th>类型</th>
              <th>稀有度</th>
              <th>生长/秒</th>
              <th>基础产量</th>
              <th>购买价</th>
              <th>出售价</th>
              <th>货币</th>
              <th>商店</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.id">
              <td>{{ item.id }}</td>
              <td class="icon-cell">{{ item.icon }}</td>
              <td>{{ item.name }}</td>
              <td>{{ itemTypeName(item.item_type) }}</td>
              <td><span :class="['item-rarity', item.rarity]">{{ item.rarity }}</span></td>
              <td>{{ item.grow_time || '-' }}</td>
              <td>{{ item.base_yield || '-' }}</td>
              <td>{{ item.buy_price }}</td>
              <td>{{ item.sell_price }}</td>
              <td>{{ currencyName(item.currency_type) }}</td>
              <td>{{ item.is_shop ? '✅' : '❌' }}</td>
              <td>
                <div class="action-buttons">
                  <button class="edit-btn" @click="openEditModal(item)">编辑</button>
                  <button class="delete-btn" @click="showDeleteModal(item.id)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- 添加物品弹窗 -->
      <div v-if="showAddModal" class="modal-overlay" @mousedown.self="showAddModal = false">
        <div class="modal-content wide-modal">
          <h3>添加物品</h3>
          <form @submit.prevent="handleAddItem">
            <div class="form-row">
              <div class="form-group">
                <label for="name">物品名</label>
                <input type="text" id="name" v-model="newItem.name" required placeholder="请输入物品名">
              </div>
              <div class="form-group">
                <label for="icon">图标 (Emoji)</label>
                <input type="text" id="icon" v-model="newItem.icon" placeholder="🌱">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="item_type">物品类型</label>
                <select id="item_type" v-model="newItem.item_type" required>
                  <option value="seed">🌱 种子</option>
                  <option value="fertilizer">🧪 肥料</option>
                  <option value="pet_food">🍖 宠物粮</option>
                </select>
              </div>
              <div class="form-group">
                <label for="rarity">稀有度</label>
                <select id="rarity" v-model="newItem.rarity" required>
                  <option value="C">C - 普通</option>
                  <option value="B">B - 稀有</option>
                  <option value="A">A - 史诗</option>
                  <option value="S">S - 传说</option>
                  <option value="SSS">SSS - 神话</option>
                </select>
              </div>
            </div>
            <div class="form-row" v-if="newItem.item_type === 'seed'">
              <div class="form-group">
                <label for="grow_time">生长时间(秒)</label>
                <input type="number" id="grow_time" v-model.number="newItem.grow_time" min="0" placeholder="60">
              </div>
              <div class="form-group">
                <label for="base_yield">基础产量</label>
                <input type="number" id="base_yield" v-model.number="newItem.base_yield" min="0" placeholder="1">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="buy_price">购买价格</label>
                <input type="number" id="buy_price" v-model.number="newItem.buy_price" min="0" placeholder="0">
              </div>
              <div class="form-group">
                <label for="sell_price">出售价格</label>
                <input type="number" id="sell_price" v-model.number="newItem.sell_price" min="0" placeholder="0">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="currency_type">货币类型</label>
                <select id="currency_type" v-model="newItem.currency_type">
                  <option value="silver_coin">🪙 银币</option>
                  <option value="gold_coin">🥇 金币</option>
                  <option value="diamond">💎 钻石</option>
                </select>
              </div>
              <div class="form-group">
                <label for="is_shop">商店出售</label>
                <select id="is_shop" v-model="newItem.is_shop">
                  <option :value="true">是</option>
                  <option :value="false">否</option>
                </select>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showAddModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认添加</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 编辑物品弹窗 -->
      <div v-if="showEditModal" class="modal-overlay" @mousedown.self="showEditModal = false">
        <div class="modal-content wide-modal">
          <h3>编辑物品</h3>
          <form @submit.prevent="handleEditItem">
            <div class="form-row">
              <div class="form-group">
                <label for="edit-name">物品名</label>
                <input type="text" id="edit-name" v-model="currentItem.name" required placeholder="请输入物品名">
              </div>
              <div class="form-group">
                <label for="edit-icon">图标 (Emoji)</label>
                <input type="text" id="edit-icon" v-model="currentItem.icon" placeholder="🌱">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="edit-item_type">物品类型</label>
                <select id="edit-item_type" v-model="currentItem.item_type" required>
                  <option value="seed">🌱 种子</option>
                  <option value="fertilizer">🧪 肥料</option>
                  <option value="pet_food">🍖 宠物粮</option>
                </select>
              </div>
              <div class="form-group">
                <label for="edit-rarity">稀有度</label>
                <select id="edit-rarity" v-model="currentItem.rarity" required>
                  <option value="C">C - 普通</option>
                  <option value="B">B - 稀有</option>
                  <option value="A">A - 史诗</option>
                  <option value="S">S - 传说</option>
                  <option value="SSS">SSS - 神话</option>
                </select>
              </div>
            </div>
            <div class="form-row" v-if="currentItem.item_type === 'seed'">
              <div class="form-group">
                <label for="edit-grow_time">生长时间(秒)</label>
                <input type="number" id="edit-grow_time" v-model.number="currentItem.grow_time" min="0">
              </div>
              <div class="form-group">
                <label for="edit-base_yield">基础产量</label>
                <input type="number" id="edit-base_yield" v-model.number="currentItem.base_yield" min="0">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="edit-buy_price">购买价格</label>
                <input type="number" id="edit-buy_price" v-model.number="currentItem.buy_price" min="0">
              </div>
              <div class="form-group">
                <label for="edit-sell_price">出售价格</label>
                <input type="number" id="edit-sell_price" v-model.number="currentItem.sell_price" min="0">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="edit-currency_type">货币类型</label>
                <select id="edit-currency_type" v-model="currentItem.currency_type">
                  <option value="silver_coin">🪙 银币</option>
                  <option value="gold_coin">🥇 金币</option>
                  <option value="diamond">💎 钻石</option>
                </select>
              </div>
              <div class="form-group">
                <label for="edit-is_shop">商店出售</label>
                <select id="edit-is_shop" v-model="currentItem.is_shop">
                  <option :value="true">是</option>
                  <option :value="false">否</option>
                </select>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showEditModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认更新</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 删除确认弹窗 -->
      <div v-if="showDeleteModalVisible" class="modal-overlay" @mousedown.self="cancelDeleteItem">
        <div class="modal-content">
          <h3>⚠️ 删除物品</h3>
          <p>确定要删除这个物品吗？</p>
          <p class="warning-text">删除后无法恢复，已拥有该物品的用户背包数据将受影响。</p>
          <div class="modal-actions">
            <button class="cancel-btn" @click="cancelDeleteItem">取消</button>
            <button class="confirm-btn" @click="confirmDeleteItem">确定删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Toast from '@/components/Toast.vue'
import AdminSidebar from '@/components/AdminSidebar.vue'

const items = ref([])
const filterType = ref('all')
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModalVisible = ref(false)
const currentItem = ref(null)
const deletingItemId = ref(null)
const toastRef = ref(null)

const filteredItems = computed(() => {
  if (filterType.value === 'all') return items.value
  return items.value.filter(i => i.item_type === filterType.value)
})

const newItem = ref({
  name: '',
  icon: '',
  rarity: 'C',
  item_type: 'seed',
  grow_time: 0,
  base_yield: 0,
  buy_price: 0,
  sell_price: 0,
  currency_type: 'silver_coin',
  is_shop: true
})

function itemTypeName(type) {
  const map = { seed: '🌱 种子', fertilizer: '🧪 肥料', pet_food: '🍖 宠物粮' }
  return map[type] || type
}

function currencyName(type) {
  const map = { silver_coin: '🪙 银币', gold_coin: '🥇 金币', diamond: '💎 钻石' }
  return map[type] || type
}

// 加载物品数据
async function loadItems() {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/items/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) throw new Error('获取物品列表失败')
    items.value = await response.json()
  } catch (error) {
    console.error('Failed to load items:', error)
    items.value = []
    if (toastRef.value) toastRef.value.addToast(error.message || '加载物品数据失败', 'error')
  }
}

// 添加物品
async function handleAddItem() {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newItem.value)
    })
    if (response.ok) {
      showAddModal.value = false
      newItem.value = { name: '', icon: '', rarity: 'C', item_type: 'seed', grow_time: 0, base_yield: 0, buy_price: 0, sell_price: 0, currency_type: 'silver_coin', is_shop: true }
      await loadItems()
      if (toastRef.value) toastRef.value.addToast('添加物品成功', 'success')
    } else {
      const errorData = await response.json()
      if (toastRef.value) toastRef.value.addToast(errorData.error || '添加物品失败', 'error')
    }
  } catch (error) {
    console.error('Error adding item:', error)
    if (toastRef.value) toastRef.value.addToast('网络错误，请稍后再试', 'error')
  }
}

// 打开编辑弹窗
function openEditModal(item) {
  currentItem.value = { ...item }
  showEditModal.value = true
}

// 编辑物品
async function handleEditItem() {
  if (!currentItem.value) return
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/items/${currentItem.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(currentItem.value)
    })
    if (response.ok) {
      const updatedItem = await response.json()
      const index = items.value.findIndex(i => i.id === updatedItem.id)
      if (index !== -1) items.value[index] = updatedItem
      showEditModal.value = false
      currentItem.value = null
      if (toastRef.value) toastRef.value.addToast('更新物品成功', 'success')
    } else {
      const errorData = await response.json()
      if (toastRef.value) toastRef.value.addToast(errorData.error || '更新物品失败', 'error')
    }
  } catch (error) {
    console.error('Error updating item:', error)
    if (toastRef.value) toastRef.value.addToast('网络错误，请稍后再试', 'error')
  }
}

// 删除相关
function showDeleteModal(itemId) {
  deletingItemId.value = itemId
  showDeleteModalVisible.value = true
}

function cancelDeleteItem() {
  showDeleteModalVisible.value = false
  deletingItemId.value = null
}

async function confirmDeleteItem() {
  if (!deletingItemId.value) return
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/items/${deletingItemId.value}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      items.value = items.value.filter(i => i.id !== deletingItemId.value)
      if (toastRef.value) toastRef.value.addToast('删除物品成功', 'success')
    } else {
      const errorData = await response.json()
      if (toastRef.value) toastRef.value.addToast(errorData.error || '删除物品失败', 'error')
    }
  } catch (error) {
    console.error('Error deleting item:', error)
    if (toastRef.value) toastRef.value.addToast('网络错误，请稍后再试', 'error')
  } finally {
    showDeleteModalVisible.value = false
    deletingItemId.value = null
  }
}

onMounted(() => {
  loadItems()
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
  color: #1d6ed7;
}

.action-bar {
  display: flex;
  margin-bottom: 24px;
  justify-content: flex-end;
  gap: 12px;
  align-items: center;
}

.filter-select {
  padding: 10px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.95rem;
  background: white;
  color: #333;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: #4caf50;
}

.add-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  background: #4caf50;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.add-btn:hover {
  background: #388e3c;
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
  max-width: 500px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.wide-modal {
  max-width: 640px;
}

.modal-content h3 {
  margin: 0 0 24px 0;
  color: #1d6ed7;
  text-align: center;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #555;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4caf50;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 32px;
  justify-content: flex-end;
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
  background: #4caf50;
  color: white;
}

.confirm-btn:hover {
  background: #388e3c;
}

.warning-text {
  color: #f44336;
  font-weight: bold;
}

/* 表格样式 */
.items-table {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.items-table table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th,
.items-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
  font-size: 0.9rem;
}

.items-table th {
  background: #f5f5f5;
  font-weight: bold;
  color: #333;
  white-space: nowrap;
}

.items-table tr:hover {
  background: #f9f9f9;
}

.icon-cell {
  font-size: 1.4rem;
}

.item-rarity {
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
}

.item-rarity.C { background: #9e9e9e; color: white; }
.item-rarity.B { background: #4caf50; color: white; }
.item-rarity.A { background: #2196f3; color: white; }
.item-rarity.S { background: #9c27b0; color: white; }
.item-rarity.SSS { background: #ff9800; color: white; }

.edit-btn,
.delete-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
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

.action-buttons {
  display: flex;
  gap: 6px;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .admin-page {
    background: #1a1a1a;
  }

  .admin-content h1 {
    color: #1d6ed7;
  }

  .items-table {
    background: #2a2a2a;
  }

  .items-table th {
    background: #3a3a3a;
    color: #e0e0e0;
  }

  .items-table td {
    border-bottom: 1px solid #3a3a3a;
    color: #e0e0e0;
  }

  .items-table tr:hover {
    background: #333;
  }

  .modal-content {
    background: #2a2a2a;
    color: #e0e0e0;
  }

  .modal-content h3 {
    color: #1d6ed7;
  }

  .form-group label {
    color: #e0e0e0;
  }

  .form-group input,
  .form-group select {
    background: #3a3a3a;
    border-color: #444;
    color: #e0e0e0;
  }

  .form-group input:focus,
  .form-group select:focus {
    border-color: #1d6ed7;
  }

  .cancel-btn {
    background: #555;
  }

  .cancel-btn:hover {
    background: #444;
  }

  .confirm-btn {
    background: #388e3c;
  }

  .confirm-btn:hover {
    background: #2e7d32;
  }

  .filter-select {
    background: #3a3a3a;
    border-color: #444;
    color: #e0e0e0;
  }
}
</style>

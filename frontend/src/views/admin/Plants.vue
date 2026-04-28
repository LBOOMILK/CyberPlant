<template>
  <div class="admin-page">
    <Toast ref="toastRef" />
    <AdminSidebar />
    
    <div class="admin-content">
      <h1>植物管理</h1>
      
      <div class="action-bar">
        <button class="add-btn" @click="showAddModal = true">添加商品</button>
      </div>
      
      <div class="plants-grid">
        <div v-for="plant in plants" :key="plant.id" class="plant-card">
          <div class="plant-icon">{{ plant.icon }}</div>
          <h3>{{ plant.name }}</h3>
          <p class="plant-rarity">{{ plant.rarity }}</p>
          <p class="plant-price">{{ plant.price }}积分</p>
          <div class="plant-actions">
            <button class="edit-btn" @click="openEditModal(plant)">编辑</button>
            <button class="delete-btn" @click="showDeleteModal(plant.id)">删除</button>
          </div>
        </div>
      </div>
      
      <!-- 删除确认弹窗 -->
      <Modal
        :visible="showDeleteModalVisible"
        title="删除确认"
        message="确定要删除这个商品吗？"
        confirm-text="确定删除"
        cancel-text="取消"
        @confirm="handleDeleteConfirm"
        @cancel="showDeleteModalVisible = false"
      />
      
      <!-- 添加商品弹窗 -->
      <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
        <div class="modal-content">
          <h3>添加商品</h3>
          <form @submit.prevent="handleAddPlant">
            <div class="form-group">
              <label for="name">商品名</label>
              <input type="text" id="name" v-model="newPlant.name" required placeholder="请输入商品名">
            </div>
            <div class="form-group">
              <label for="icon">商品图 (Emoji)</label>
              <input type="text" id="icon" v-model="newPlant.icon" required placeholder="请输入Emoji">
              <p class="hint">例如：🌱 🌿 🌻 🌸</p>
            </div>
            <div class="form-group">
              <label for="rarity">稀有度</label>
              <select id="rarity" v-model="newPlant.rarity" required>
                <option value="C">C - 普通</option>
                <option value="B">B - 稀有</option>
                <option value="A">A - 史诗</option>
                <option value="S">S - 传说</option>
                <option value="SSS" v-if="newPlant.plants_role !== 'use'">SSS - 神话</option>
              </select>
            </div>
            <div class="form-group">
              <label for="plants_role">商品类型</label>
              <select id="plants_role" v-model="newPlant.plants_role" required>
                <option value="seed">种子</option>
                <option value="use">可使用物品</option>
              </select>
            </div>
            <div class="form-group">
              <label for="price">积分价格</label>
              <input type="number" id="price" v-model="newPlant.price" required placeholder="请输入积分价格" min="1">
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showAddModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认添加</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 编辑商品弹窗 -->
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal-content">
          <h3>编辑商品</h3>
          <form @submit.prevent="handleEditPlant">
            <div class="form-group">
              <label for="edit-name">商品名</label>
              <input type="text" id="edit-name" v-model="currentPlant.name" required placeholder="请输入商品名">
            </div>
            <div class="form-group">
              <label for="edit-icon">商品图 (Emoji)</label>
              <input type="text" id="edit-icon" v-model="currentPlant.icon" required placeholder="请输入Emoji">
              <p class="hint">例如：🌱 🌾 🍃</p>
            </div>
            <div class="form-group">
              <label for="edit-rarity">稀有度</label>
              <select id="edit-rarity" v-model="currentPlant.rarity" required>
                <option value="C">C - 普通</option>
                <option value="B">B - 稀有</option>
                <option value="A">A - 史诗</option>
                <option value="S">S - 传说</option>
                <option value="SSS" v-if="currentPlant.plants_role !== 'use'">SSS - 神话</option>
              </select>
            </div>
            <div class="form-group">
              <label for="edit-plants_role">商品类型</label>
              <select id="edit-plants_role" v-model="currentPlant.plants_role" required>
                <option value="seed">种子</option>
                <option value="use">肥料</option>
              </select>
            </div>
            <div class="form-group">
              <label for="edit-price">积分价格</label>
              <input type="number" id="edit-price" v-model="currentPlant.price" required placeholder="请输入积分价格" min="1">
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showEditModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认更新</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '@/components/Toast.vue'
import AdminSidebar from '@/components/AdminSidebar.vue'
import Modal from '@/components/Modal.vue'

const router = useRouter()
const plants = ref([])
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModalVisible = ref(false)
const currentPlant = ref(null)
const plantToDelete = ref(null)
const newPlant = ref({
  name: '',
  icon: '',
  rarity: 'C',
  plants_role: 'seed',
  price: 0
})
const toastRef = ref(null)

// 监听商品类型变化，当选择可使用物品时自动切换稀有度
watch(() => newPlant.value.plants_role, (newRole) => {
  if (newRole === 'use' && newPlant.value.rarity === 'SSS') {
    newPlant.value.rarity = 'S'
  }
})

// 加载植物数据
async function loadPlants() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/plants`)
    if (!response.ok) {
      throw new Error('获取植物列表失败')
    }
    const data = await response.json()
    plants.value = data
  } catch (error) {
    console.error('Failed to load plants:', error)
    plants.value = []
    if (toastRef.value) {
      toastRef.value.addToast(error.message || '加载植物数据失败，请检查网络连接', 'error')
    }
  }
}

// 处理添加商品
async function handleAddPlant() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/plants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify(newPlant.value)
    })
    
    if (response.ok) {
      const addedPlant = await response.json()
      plants.value.push(addedPlant)
      showAddModal.value = false
      // 重置表单
      newPlant.value = {
        name: '',
        icon: '',
        rarity: 'C',
        plants_role: 'seed',
        price: 0
      }
      if (toastRef.value) {
        toastRef.value.addToast('添加商品成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '添加商品失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error adding plant:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

// 打开编辑弹窗
function openEditModal(plant) {
  currentPlant.value = { ...plant }
  showEditModal.value = true
}

// 处理编辑商品
async function handleEditPlant() {
  if (!currentPlant.value) return
  
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/plants/${currentPlant.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify(currentPlant.value)
    })
    
    if (response.ok) {
      const updatedPlant = await response.json()
      const index = plants.value.findIndex(p => p.id === updatedPlant.id)
      if (index !== -1) {
        plants.value[index] = updatedPlant
      }
      showEditModal.value = false
      currentPlant.value = null
      if (toastRef.value) {
        toastRef.value.addToast('更新商品成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '更新商品失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error updating plant:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

// 显示删除确认弹窗
function showDeleteModal(plantId) {
  plantToDelete.value = plantId
  showDeleteModalVisible.value = true
}

// 处理删除商品
async function handleDeleteConfirm() {
  if (!plantToDelete.value) return
  
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/plants/${plantToDelete.value}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    })
    
    if (response.ok) {
      plants.value = plants.value.filter(p => p.id !== plantToDelete.value)
      if (toastRef.value) {
        toastRef.value.addToast('删除商品成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '删除商品失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error deleting plant:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  } finally {
    showDeleteModalVisible.value = false
    plantToDelete.value = null
  }
}

function handleLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_role')
  router.push('/login')
}

// 生命周期
onMounted(() => {
  loadPlants()
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

.modal-content h3 {
  margin: 0 0 24px 0;
  color: #2c5a2a;
  text-align: center;
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

.hint {
  margin: 8px 0 0 0;
  font-size: 0.9rem;
  color: #999;
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

.plants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 24px;
}

.plant-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.plant-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.plant-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.plant-card h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.plant-rarity {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: #666;
}

.plant-price {
  margin: 0 0 16px 0;
  font-size: 1.2rem;
  font-weight: bold;
  color: #2c5a2a;
}

.plant-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.edit-btn,
.delete-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
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

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .admin-page {
    background: #1a1a1a;
  }
  
  .admin-sidebar {
    background: #1a3a1a;
  }
  
  .admin-content h1 {
    color: #8bc34a;
  }
  
  .search-bar input {
    background: #2a2a2a;
    border-color: #444;
    color: #e0e0e0;
  }
  
  .plant-card {
    background: #2a2a2a;
  }
  
  .plant-card h3 {
    color: #e0e0e0;
  }
  
  .plant-rarity {
    color: #aaa;
  }
  
  .plant-price {
    color: #8bc34a;
  }
  
  .modal-content {
    background: #2a2a2a;
    color: #e0e0e0;
  }
  
  .modal-content h3 {
    color: #8bc34a;
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
    border-color: #8bc34a;
  }
  
  .hint {
    color: #777;
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
}
</style>
<template>
  <div class="admin-page">
    <Toast ref="toastRef" />
    <div class="admin-sidebar">
      <h2>管理中心</h2>
      <ul>
        <li><router-link to="/admin/dashboard">仪表盘</router-link></li>
        <li class="menu-item">
          <span class="menu-title" @click="toggleUserMenu">
            <span>用户管理</span>
            <span class="menu-arrow" :class="{ open: userMenuOpen }"><</span>
          </span>
          <ul v-if="userMenuOpen" class="sub-menu">
            <li><router-link to="/admin/users">普通用户</router-link></li>
            <li><router-link to="/admin/admins">管理员</router-link></li>
          </ul>
        </li>
        <li><router-link to="/admin/plants">植物管理</router-link></li>
        <li><router-link to="/admin/orders">订单管理</router-link></li>
        <li @click="handleLogout">退出登录</li>
      </ul>
    </div>
    
    <div class="admin-content">
      <h1>用户管理</h1>
      
      <div class="search-bar">
        <input type="text" placeholder="搜索用户...">
        <button class="search-btn">搜索</button>
        <button class="add-btn" @click="showAddModal = true">添加用户</button>
      </div>
      
      <div class="users-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>邮箱</th>
              <th>积分</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ formatUserId(user.id) }}</td>
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.points || 0 }}</td>
              <td>{{ user.created_at }}</td>
              <td>
                <button class="edit-btn" @click="openEditModal(user)">编辑</button>
                <button class="edit-btn" @click="openBackpackModal(user)">背包</button>
                <button class="delete-btn" @click="handleDeleteUser(user.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- 添加用户弹窗 -->
      <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
        <div class="modal-content">
          <h3>添加用户</h3>
          <form @submit.prevent="handleAddUser">
            <div class="form-group">
              <label for="email">邮箱</label>
              <input type="email" id="email" v-model="newUser.email" required placeholder="请输入邮箱">
            </div>
            <div class="form-group password-group">
              <label for="password">密码</label>
              <div class="password-input-container">
                <input :type="showPassword ? 'text' : 'password'" id="password" v-model="newUser.password" required placeholder="请输入密码">
                <button type="button" class="password-toggle" @click="showPassword = !showPassword">
                  {{ showPassword ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
            <div class="form-group password-group">
              <label for="confirmPassword">确认密码</label>
              <div class="password-input-container">
                <input :type="showConfirmPassword ? 'text' : 'password'" id="confirmPassword" v-model="newUser.confirmPassword" required placeholder="请再次输入密码">
                <button type="button" class="password-toggle" @click="showConfirmPassword = !showConfirmPassword">
                  {{ showConfirmPassword ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label for="points">积分</label>
              <input type="number" id="points" v-model="newUser.points" min="0" placeholder="请输入积分">
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showAddModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认添加</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 编辑用户弹窗 -->
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal-content">
          <h3>编辑用户</h3>
          <form @submit.prevent="handleEditUser">
            <div class="form-group">
              <label for="edit-email">邮箱</label>
              <input type="email" id="edit-email" v-model="currentUser.email" required placeholder="请输入邮箱">
            </div>
            <div class="form-group">
              <label for="edit-points">积分</label>
              <input type="number" id="edit-points" v-model="currentUser.points" min="0" placeholder="请输入积分">
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showEditModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认更新</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 背包管理弹窗 -->
      <div v-if="showBackpackModal" class="modal-overlay" @click.self="showBackpackModal = false">
        <div class="modal-content backpack-modal">
          <h3>{{ backpackUser?.name }}的背包</h3>
          
          <div class="tabs">
            <button :class="{ active: backpackTab === 'seeds' }" @click="backpackTab = 'seeds'">
              🌱 种子
            </button>
            <button :class="{ active: backpackTab === 'crops' }" @click="backpackTab = 'crops'">
              🌾 作物
            </button>
          </div>
          
          <!-- 种子管理 -->
          <div v-if="backpackTab === 'seeds'" class="backpack-content">
            <div class="backpack-actions">
              <button class="add-btn" @click="showAddSeedModal = true">添加种子</button>
            </div>
            <div class="backpack-items">
              <div v-for="(seed, index) in backpackUser?.seeds || []" :key="seed.id || index" class="backpack-item">
                <div class="item-info">
                  <span class="item-rarity">{{ seed.rarity }}</span>
                  <span class="item-time">{{ formatDate(seed.purchasedAt) }}</span>
                </div>
                <button class="delete-btn" @click="removeSeed(index)">删除</button>
              </div>
              <div v-if="!(backpackUser?.seeds && backpackUser.seeds.length)" class="empty-msg">
                暂无种子
              </div>
            </div>
          </div>
          
          <!-- 作物管理 -->
          <div v-else class="backpack-content">
            <div class="backpack-actions">
              <button class="add-btn" @click="showAddCropModal = true">添加作物</button>
            </div>
            <div class="backpack-items">
              <div v-for="(crop, index) in backpackUser?.crops || []" :key="crop.id || index" class="backpack-item">
                <div class="item-info">
                  <span class="item-rarity">{{ crop.rarity }}</span>
                  <span class="item-time">{{ formatDate(crop.harvestedAt) }}</span>
                </div>
                <button class="delete-btn" @click="removeCrop(index)">删除</button>
              </div>
              <div v-if="!(backpackUser?.crops && backpackUser.crops.length)" class="empty-msg">
                暂无作物
              </div>
            </div>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="cancel-btn" @click="showBackpackModal = false">关闭</button>
            <button type="button" class="confirm-btn" @click="saveBackpackChanges">保存更改</button>
          </div>
        </div>
      </div>
      
      <!-- 添加种子弹窗 -->
      <div v-if="showAddSeedModal" class="modal-overlay" @click.self="showAddSeedModal = false">
        <div class="modal-content">
          <h3>添加种子</h3>
          <form @submit.prevent="handleAddSeed">
            <div class="form-group">
              <label for="seed-rarity">稀有度</label>
              <select id="seed-rarity" v-model="newSeed.rarity" required>
                <option value="C">C (普通)</option>
                <option value="B">B (稀有)</option>
                <option value="A">A (史诗)</option>
                <option value="S">S (传说)</option>
                <option value="SSS">SSS (神级)</option>
              </select>
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showAddSeedModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认添加</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 添加作物弹窗 -->
      <div v-if="showAddCropModal" class="modal-overlay" @click.self="showAddCropModal = false">
        <div class="modal-content">
          <h3>添加作物</h3>
          <form @submit.prevent="handleAddCrop">
            <div class="form-group">
              <label for="crop-rarity">稀有度</label>
              <select id="crop-rarity" v-model="newCrop.rarity" required>
                <option value="C">C (普通)</option>
                <option value="B">B (稀有)</option>
                <option value="A">A (史诗)</option>
                <option value="S">S (传说)</option>
                <option value="SSS">SSS (神级)</option>
              </select>
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showAddCropModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认添加</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '@/components/Toast.vue'

const router = useRouter()
const users = ref([])
const showAddModal = ref(false)
const showEditModal = ref(false)
const newUser = ref({
  email: '',
  password: '',
  confirmPassword: '',
  points: 0
})
const currentUser = ref(null)
const toastRef = ref(null)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const userMenuOpen = ref(false)

// 切换用户管理菜单
function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

// 背包管理相关
const showBackpackModal = ref(false)
const showAddSeedModal = ref(false)
const showAddCropModal = ref(false)
const backpackUser = ref(null)
const backpackTab = ref('seeds')
const newSeed = ref({ rarity: 'C' })
const newCrop = ref({ rarity: 'C' })

// 加载用户数据
async function loadUsers() {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const data = await response.json()
    // 只显示普通用户，不显示管理员
    users.value = data.filter(user => user.role !== 'admin')
  } catch (error) {
    console.error('Failed to load users:', error)
    if (toastRef.value) {
      toastRef.value.addToast('加载用户数据失败', 'error')
    }
  }
}

// 处理添加用户
async function handleAddUser() {
  try {
    const token = localStorage.getItem('auth_token')
    // 确保添加的是普通用户
    const userData = {
      ...newUser.value,
      role: 'user'
    }
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    })
    
    if (response.ok) {
      const addedUser = await response.json()
      users.value.push(addedUser)
      showAddModal.value = false
      // 重置表单
      newUser.value = {
        email: '',
        password: '',
        confirmPassword: '',
        points: 0
      }
      if (toastRef.value) {
        toastRef.value.addToast('添加用户成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '添加用户失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error adding user:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

// 打开编辑弹窗
function openEditModal(user) {
  currentUser.value = { ...user }
  showEditModal.value = true
}

// 处理编辑用户
async function handleEditUser() {
  if (!currentUser.value) return
  
  try {
    const token = localStorage.getItem('auth_token')
    // 确保编辑的用户仍然是普通用户
    const userData = {
      ...currentUser.value,
      role: 'user'
    }
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${currentUser.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    })
    
    if (response.ok) {
      const updatedUser = await response.json()
      const index = users.value.findIndex(u => u.id === updatedUser.id)
      if (index !== -1) {
        users.value[index] = updatedUser
      }
      showEditModal.value = false
      currentUser.value = null
      if (toastRef.value) {
        toastRef.value.addToast('更新用户成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '更新用户失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error updating user:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

// 处理删除用户
async function handleDeleteUser(userId) {
  if (!confirm('确定要删除这个用户吗？')) return
  
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      users.value = users.value.filter(u => u.id !== userId)
      if (toastRef.value) {
        toastRef.value.addToast('删除用户成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '删除用户失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error deleting user:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

function handleLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_role')
  router.push('/login')
}

// 格式化用户ID显示
function formatUserId(id) {
  // 确保ID是字符串
  const idStr = String(id)
  // 如果ID以1开头，显示第二位数字
  if (idStr.startsWith('1')) {
    return idStr[1] || idStr
  }
  return idStr
}

// 背包管理相关方法
function openBackpackModal(user) {
  // 深拷贝用户数据，避免直接修改原始数据
  backpackUser.value = JSON.parse(JSON.stringify(user))
  // 确保用户ID保持字符串类型
  backpackUser.value.id = String(user.id)
  // 确保seeds和crops字段存在
  if (!backpackUser.value.seeds) {
    backpackUser.value.seeds = []
  }
  if (!backpackUser.value.crops) {
    backpackUser.value.crops = []
  }
  showBackpackModal.value = true
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString()
}

function removeSeed(index) {
  if (backpackUser.value && backpackUser.value.seeds) {
    backpackUser.value.seeds.splice(index, 1)
  }
}

function removeCrop(index) {
  if (backpackUser.value && backpackUser.value.crops) {
    backpackUser.value.crops.splice(index, 1)
  }
}

async function handleAddSeed() {
  if (backpackUser.value && newSeed.value.rarity) {
    const newSeedItem = {
      id: Date.now() + Math.random(),
      rarity: newSeed.value.rarity,
      purchasedAt: new Date().toISOString()
    }
    if (!backpackUser.value.seeds) {
      backpackUser.value.seeds = []
    }
    backpackUser.value.seeds.push(newSeedItem)
    showAddSeedModal.value = false
    newSeed.value = { rarity: 'C' }
  }
}

async function handleAddCrop() {
  if (backpackUser.value && newCrop.value.rarity) {
    const newCropItem = {
      id: Date.now() + Math.random(),
      rarity: newCrop.value.rarity,
      harvestedAt: new Date().toISOString()
    }
    if (!backpackUser.value.crops) {
      backpackUser.value.crops = []
    }
    backpackUser.value.crops.push(newCropItem)
    showAddCropModal.value = false
    newCrop.value = { rarity: 'C' }
  }
}

async function saveBackpackChanges() {
  if (!backpackUser.value) return
  
  try {
    const token = localStorage.getItem('auth_token')
    const userId = String(backpackUser.value.id)
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email: backpackUser.value.email,
        role: backpackUser.value.role,
        points: backpackUser.value.points,
        seeds: backpackUser.value.seeds || [],
        crops: backpackUser.value.crops || []
      })
    })
    
    if (response.ok) {
      const updatedUser = await response.json()
      const index = users.value.findIndex(u => u.id === updatedUser.id)
      if (index !== -1) {
        users.value[index] = updatedUser
      }
      showBackpackModal.value = false
      backpackUser.value = null
      if (toastRef.value) {
        toastRef.value.addToast('保存背包更改成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '保存背包更改失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error saving backpack changes:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

// 生命周期
onMounted(() => {
  loadUsers()
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

.search-bar {
  display: flex;
  margin-bottom: 24px;
  gap: 12px;
}

.search-bar input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
}

.search-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  background: #4caf50;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.search-btn:hover {
  background: #388e3c;
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

/* 密码输入容器 */
.password-input-container {
  position: relative;
  width: 100%;
}

.password-input-container input {
  width: 100%;
  padding-right: 50px; /* 为密码可视按钮留出空间 */
  box-sizing: border-box;
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: color 0.2s ease;
}

.password-toggle:hover {
  color: #4caf50;
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

.users-table {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.users-table table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.users-table th {
  background: #f5f5f5;
  font-weight: bold;
  color: #333;
}

.users-table tr:hover {
  background: #f9f9f9;
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
  
  .users-table {
    background: #2a2a2a;
  }
  
  .users-table th {
    background: #3a3a3a;
    color: #e0e0e0;
  }
  
  .users-table td {
    border-bottom: 1px solid #3a3a3a;
    color: #e0e0e0;
  }
  
  .users-table tr:hover {
    background: #333;
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

/* 背包管理相关样式 */
.backpack-modal {
  max-width: 600px;
  width: 90%;
}

.tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 12px;
}

.tabs button {
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.tabs button.active {
  background: #4caf50;
  color: white;
}

.backpack-actions {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}

.backpack-items {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 24px;
}

.backpack-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 8px;
  background: #f9f9f9;
}

.item-info {
  display: flex;
  gap: 16px;
}

.item-rarity {
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  background: #e0e0e0;
}

.item-time {
  font-size: 0.9rem;
  color: #666;
}

.empty-msg {
  text-align: center;
  padding: 40px;
  color: #999;
  font-style: italic;
}

/* 深色模式下的背包样式 */
@media (prefers-color-scheme: dark) {
  .tabs {
    border-bottom: 1px solid #444;
  }
  
  .tabs button {
    color: #e0e0e0;
  }
  
  .tabs button.active {
    background: #388e3c;
  }
  
  .backpack-item {
    border-color: #444;
    background: #333;
  }
  
  .item-rarity {
    background: #555;
    color: #e0e0e0;
  }
  
  .item-time {
    color: #aaa;
  }
  
  .empty-msg {
    color: #777;
  }
}
</style>
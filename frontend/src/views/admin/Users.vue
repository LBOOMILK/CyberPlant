<template>
  <div class="admin-page">
    <Toast ref="toastRef" />
    <AdminSidebar />
    
    <div class="admin-content">
      <h1>用户管理</h1>
      
      <div class="action-bar">
        <button class="add-btn" @click="showAddModal = true">添加用户</button>
      </div>
      
      <div class="users-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>邮箱</th>
              <th>银币</th>
              <th>金币</th>
              <th>钻石</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ formatUserId(user.id) }}</td>
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.currencies?.silver_coin || 0 }}</td>
              <td>{{ user.currencies?.gold_coin || 0 }}</td>
              <td>{{ user.currencies?.diamond || 0 }}</td>
              <td>{{ user.created_at }}</td>
              <td>
                <div class="action-buttons">
                  <button class="edit-btn" @click="openEditModal(user)">编辑</button>
                  <button class="edit-btn" @click="() => openBackpackModal(user)">背包</button>
                  <button class="edit-btn" @click="openPasswordModal(user)">修改密码</button>
                  <button class="delete-btn" @click="showDeleteModal(user.id)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- 添加用户弹窗 -->
      <div v-if="showAddModal" class="modal-overlay" @mousedown.self="showAddModal = false">
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

            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showAddModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认添加</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 编辑用户弹窗 -->
      <div v-if="showEditModal" class="modal-overlay" @mousedown.self="showEditModal = false">
        <div class="modal-content">
          <h3>编辑用户</h3>
          <form @submit.prevent="handleEditUser">
            <div class="form-group">
              <label for="edit-email">邮箱</label>
              <input type="email" id="edit-email" v-model="currentUser.email" required placeholder="请输入邮箱">
            </div>
            <div class="form-group">
              <label>货币余额</label>
              <div class="currency-edit">
                <div class="currency-row">
                  <span class="currency-label">银币</span>
                  <input type="number" v-model.number="editCurrencies.silver_coin" min="0" max="999999999" />
                </div>
                <div class="currency-row">
                  <span class="currency-label">金币</span>
                  <input type="number" v-model.number="editCurrencies.gold_coin" min="0" max="999999999" />
                </div>
                <div class="currency-row">
                  <span class="currency-label">钻石</span>
                  <input type="number" v-model.number="editCurrencies.diamond" min="0" max="999999999" />
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showEditModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认更新</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 修改密码弹窗 -->
      <div v-if="showPasswordModal" class="modal-overlay" @mousedown.self="showPasswordModal = false">
        <div class="modal-content">
          <h3>修改密码</h3>
          <form @submit.prevent="handleChangePassword">
            <div class="form-group password-group">
              <label for="new-password">新密码</label>
              <div class="password-input-container">
                <input :type="showNewPassword ? 'text' : 'password'" id="new-password" v-model="newPassword" required placeholder="请输入新密码">
                <button type="button" class="password-toggle" @click="showNewPassword = !showNewPassword">
                  {{ showNewPassword ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showPasswordModal = false">取消</button>
              <button type="submit" class="confirm-btn">确认修改</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 背包管理弹窗 -->
      <div v-if="showBackpackModal" class="modal-overlay" @mousedown.self="showBackpackModal = false">
        <div class="modal-content backpack-modal">
          <h3>{{ backpackUser?.name }}的背包</h3>
          
          <div v-if="backpackLoading" class="loading-msg">加载中...</div>
          
          <div v-else-if="backpackItems.length === 0" class="empty-msg">
            背包为空
          </div>
          
          <div v-else class="backpack-content">
            <div class="backpack-items">
              <div v-for="item in backpackItems" :key="item.item_id" class="backpack-item">
                <div class="item-info">
                  <span class="item-icon">{{ item.icon }}</span>
                  <span class="item-name">{{ item.name }}</span>
                  <span :class="['item-rarity', item.rarity]">{{ item.rarity }}</span>
                  <span class="item-type-badge">{{ itemTypeName(item.item_type) }}</span>
                </div>
                <div class="item-quantity">
                  ×{{ item.quantity }}
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="cancel-btn" @click="showBackpackModal = false">关闭</button>
          </div>
        </div>
      </div>
      

      
      <!-- 删除确认弹窗 -->
      <div v-if="showDeleteModalVisible" class="modal-overlay" @mousedown.self="cancelDeleteUser">
        <div class="modal-content">
          <h3>⚠️ 删除用户</h3>
          <p>确定要删除这个用户吗？</p>
          <p class="warning-text">删除用户无法找回，且其所有数据将被清除。</p>
          <div class="modal-actions">
            <button class="cancel-btn" @click="cancelDeleteUser">取消</button>
            <button class="confirm-btn" @click="confirmDeleteUser">确定删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '@/components/common/Toast.vue'
import AdminSidebar from '@/components/admin/AdminSidebar.vue'

const router = useRouter()
const users = ref([])
const showAddModal = ref(false)
const showEditModal = ref(false)
const showPasswordModal = ref(false)
const newUser = ref({
  email: '',
  password: '',
  confirmPassword: ''
})
const currentUser = ref(null)
const editCurrencies = ref({ silver_coin: 0, gold_coin: 0, diamond: 0 })
const currentPasswordUser = ref(null)
const newPassword = ref('')
const toastRef = ref(null)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const showNewPassword = ref(false)

// 背包管理相关
const showBackpackModal = ref(false)
const showDeleteModalVisible = ref(false)
const deletingUserId = ref(null)
const backpackUser = ref(null)
const backpackItems = ref([])
const backpackLoading = ref(false)

// 加载用户数据
async function loadUsers() {
  try {
    const token = localStorage.getItem('auth_token')
    console.log('Loading users with token:', token)
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    console.log('Response status:', response.status)
    
    if (!response.ok) {
      throw new Error('获取用户列表失败，请检查网络连接')
    }
    
    const data = await response.json()
    console.log('Raw users data from backend:', data)
    // 打印每个用户的role字段
    data.forEach((user, index) => {
      console.log(`User ${index + 1} role:`, user.role)
    })
    // 只显示普通用户，不显示管理员
    const filteredUsers = data.filter(user => user.role !== 'admin')
    
    users.value = filteredUsers.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      currencies: user.currencies || { silver_coin: 0, gold_coin: 0, diamond: 0 },
      created_at: user.created_at,
      last_login_at: user.last_login_at
    }))
    
    // 按ID升序排序
    users.value.sort((a, b) => {
      const idA = Number(a.id)
      const idB = Number(b.id)
      return idA - idB
    })
  } catch (error) {
    console.error('Failed to load users:', error)
    users.value = []
    if (toastRef.value) {
      toastRef.value.addToast(error.message || '加载用户数据失败，请检查网络连接', 'error')
    }
  }
}

// 处理添加用户
async function handleAddUser() {
  try {
    const token = localStorage.getItem('auth_token')
    // 确保添加的是普通用户
    const userData = {
      email: newUser.value.email,
      password: newUser.value.password,
      confirmPassword: newUser.value.confirmPassword,
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
      showAddModal.value = false
      // 重置表单
      newUser.value = {
        email: '',
        password: '',
        confirmPassword: ''
      }
      // 重新加载用户列表，确保添加的用户数据格式与前端期望的格式一致
      await loadUsers()
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
  editCurrencies.value = {
    silver_coin: user.currencies?.silver_coin || 0,
    gold_coin: user.currencies?.gold_coin || 0,
    diamond: user.currencies?.diamond || 0
  }
  showEditModal.value = true
}

// 处理编辑用户
async function handleEditUser() {
  if (!currentUser.value) return
  
  try {
    const token = localStorage.getItem('auth_token')
    // 确保编辑的用户仍然是普通用户
    const userData = {
      name: currentUser.value.name,
      email: currentUser.value.email,
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
      // 更新货币
      const curResponse = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${currentUser.value.id}/currencies`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editCurrencies.value)
      })
      
      if (curResponse.ok) {
        const curData = await curResponse.json()
        // 更新本地列表
        const index = users.value.findIndex(u => u.id === currentUser.value.id)
        if (index !== -1) {
          users.value[index].currencies = curData.currencies
          users.value[index].email = currentUser.value.email
          users.value[index].name = currentUser.value.name
        }
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

// 显示删除确认弹窗
function showDeleteModal(userId) {
  deletingUserId.value = userId
  showDeleteModalVisible.value = true
}

// 确认删除用户
async function confirmDeleteUser() {
  if (!deletingUserId.value) return
  
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${deletingUserId.value}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      users.value = users.value.filter(u => u.id !== deletingUserId.value)
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
  } finally {
    showDeleteModalVisible.value = false
    deletingUserId.value = null
  }
}

// 取消删除用户
function cancelDeleteUser() {
  showDeleteModalVisible.value = false
  deletingUserId.value = null
}

// 打开修改密码弹窗
function openPasswordModal(user) {
  currentPasswordUser.value = { ...user }
  newPassword.value = ''
  showPasswordModal.value = true
}

// 处理修改密码
async function handleChangePassword() {
  if (!currentPasswordUser.value || !newPassword.value) return
  
  try {
    const token = localStorage.getItem('auth_token')
    const userId = String(currentPasswordUser.value.id)
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email: currentPasswordUser.value.email,
        role: currentPasswordUser.value.role,
        password: newPassword.value
      })
    })
    
    if (response.ok) {
      showPasswordModal.value = false
      currentPasswordUser.value = null
      newPassword.value = ''
      if (toastRef.value) {
        toastRef.value.addToast('修改密码成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '修改密码失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error changing password:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

function handleLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_role')
  router.push('/admin/login')
}

// 格式化用户ID显示
function formatUserId(id) {
  // 确保ID是字符串
  const idStr = String(id)
  return idStr
}

// 背包管理相关方法
async function openBackpackModal(user) {
  backpackUser.value = { id: user.id, name: user.name }
  backpackItems.value = []
  backpackLoading.value = true
  showBackpackModal.value = true

  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${user.id}/items`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      backpackItems.value = await response.json()
    } else {
      backpackItems.value = []
    }
  } catch (error) {
    console.error('Error loading backpack:', error)
    backpackItems.value = []
  } finally {
    backpackLoading.value = false
  }
}

function itemTypeName(type) {
  const map = { seed: '🌱 种子', fertilizer: '🧪 肥料', pet_food: '🍖 宠物粮' }
  return map[type] || type
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
  color: #1d6ed7;
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
  color: #1d6ed7;
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

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
    color: #1d6ed7;
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

  .action-buttons {
    flex-wrap: wrap;
    gap: 6px;
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

.quantity-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qty-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.qty-btn.plus-btn {
  background: #4caf50;
  color: white;
}

.qty-btn.plus-btn:hover {
  background: #45a049;
}

.qty-btn.minus-btn {
  background: #f44336;
  color: white;
}

.quantity-input {
  width: 60px;
  height: 32px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: bold;
  outline: none;
  transition: border-color 0.2s ease;
  background-color: rgba(0, 0, 0, 0.3);
  color: #39b620;
}

.quantity-input:focus {
  border-color: #4caf50;
}

.quantity-input::-webkit-outer-spin-button,
.quantity-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.quantity-input[type=number] {
  -moz-appearance: textfield;
}

.qty-btn.minus-btn:hover {
  background: #da190b;
}

.item-quantity {
  min-width: 40px;
  text-align: center;
  font-weight: bold;
  font-size: 1.1rem;
}

.backpack-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 12px;
}

.tabs {
  display: flex;
  gap: 12px;
}

.item-rarity {
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
}

.item-rarity.C {
  background: #9e9e9e;
  color: white;
}

.item-rarity.B {
  background: #4caf50;
  color: white;
}

.item-rarity.A {
  background: #2196f3;
  color: white;
}

.item-rarity.S {
  background: #9c27b0;
  color: white;
}

.item-rarity.SSS {
  background: #ff9800;
  color: white;
}

.currency-display {
  display: flex;
  gap: 16px;
  font-size: 0.95rem;
  color: #333;
  padding: 8px 0;
}

.currency-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.currency-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.currency-label {
  min-width: 70px;
  font-size: 0.95rem;
  font-weight: 500;
}

.currency-row input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.currency-row input:focus {
  outline: none;
  border-color: #4caf50;
}

.item-icon {
  font-size: 1.4rem;
}

.item-name {
  font-weight: 500;
  margin-right: 4px;
}

.item-type-badge {
  font-size: 0.8rem;
  color: #888;
  margin-left: 4px;
}

.item-quantity {
  font-weight: bold;
  font-size: 1.1rem;
  color: #1d6ed7;
}

.loading-msg {
  text-align: center;
  padding: 40px;
  color: #999;
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
  
  .currency-display {
    color: #e0e0e0;
  }
  
  .currency-row input {
    background: #3a3a3a;
    border-color: #444;
    color: #e0e0e0;
  }
  
  .currency-row input:focus {
    border-color: #1d6ed7;
  }
  
  .item-type-badge {
    color: #aaa;
  }
  
  .loading-msg {
    color: #777;
  }
}
</style>
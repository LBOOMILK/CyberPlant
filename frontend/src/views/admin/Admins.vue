<template>
  <div class="admin-page">
    <Toast ref="toastRef" />
    <AdminSidebar />
    
    <div class="admin-content">
      <h1>管理员管理</h1>
      
      <div class="action-bar">
        <button class="add-btn" @click="showAddModal = true">添加管理员</button>
      </div>
      
      <div class="users-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>邮箱</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="admin in admins" :key="admin.id">
              <td>{{ formatAdminId(admin.id) }}</td>
              <td>{{ admin.email }}</td>
              <td>{{ admin.created_at }}</td>
              <td>
                <button class="edit-btn" @click="showEditEmailModal(admin.id, admin.email)">编辑邮箱</button>
                <button class="edit-btn" @click="showChangePasswordModal(admin.id, admin.email)">修改密码</button>
                <button class="delete-btn" @click="showDeleteModal(admin.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- 添加管理员弹窗 -->
      <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
        <div class="modal-content">
          <h3>添加管理员</h3>
          <form @submit.prevent="handleAddAdmin">
            <div class="form-group">
              <label for="email">邮箱</label>
              <input type="email" id="email" v-model="newAdmin.email" required placeholder="请输入邮箱">
            </div>
            <div class="form-group password-group">
              <label for="password">密码</label>
              <div class="password-input-container">
                <input :type="showPassword ? 'text' : 'password'" id="password" v-model="newAdmin.password" required placeholder="请输入密码">
                <button type="button" class="password-toggle" @click="showPassword = !showPassword">
                  {{ showPassword ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
            <div class="form-group password-group">
              <label for="confirmPassword">确认密码</label>
              <div class="password-input-container">
                <input :type="showConfirmPassword ? 'text' : 'password'" id="confirmPassword" v-model="newAdmin.confirmPassword" required placeholder="请再次输入密码">
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
      
      <!-- 退出登录弹窗 -->
      <Modal
        :visible="showLogoutModal"
        title="🚪 退出登录"
        message="确定要退出登录吗？"
        confirm-text="确定退出"
        cancel-text="取消"
        @confirm="handleLogout"
        @cancel="showLogoutModal = false"
      />
      
      <!-- 修改密码弹窗 -->
      <div v-if="showChangePasswordModalVisible" class="modal-overlay" @click.self="showChangePasswordModalVisible = false">
        <div class="modal-content">
          <h3>修改密码</h3>
          <form @submit.prevent="handleChangePassword">
            <div class="form-group password-group">
              <label for="new-password">新密码</label>
              <div class="password-input-container">
                <input :type="showNewPassword ? 'text' : 'password'" id="new-password" v-model="changePasswordForm.newPassword" required placeholder="请输入新密码">
                <button type="button" class="password-toggle" @click="showNewPassword = !showNewPassword">
                  {{ showNewPassword ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
            <div class="form-group password-group">
              <label for="confirm-new-password">确认新密码</label>
              <div class="password-input-container">
                <input :type="showConfirmNewPassword ? 'text' : 'password'" id="confirm-new-password" v-model="changePasswordForm.confirmNewPassword" required placeholder="请再次输入新密码">
                <button type="button" class="password-toggle" @click="showConfirmNewPassword = !showConfirmNewPassword">
                  {{ showConfirmNewPassword ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showChangePasswordModalVisible = false">取消</button>
              <button type="submit" class="confirm-btn">确认修改</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 编辑邮箱弹窗 -->
      <div v-if="showEditEmailModalVisible" class="modal-overlay" @click.self="showEditEmailModalVisible = false">
        <div class="modal-content">
          <h3>编辑邮箱</h3>
          <form @submit.prevent="handleEditEmail">
            <div class="form-group">
              <label for="edit-email">新邮箱</label>
              <input type="email" id="edit-email" v-model="editEmailForm.email" required placeholder="请输入新邮箱" pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" title="请输入有效的邮箱地址">
            </div>
            <div class="modal-actions">
              <button type="button" class="cancel-btn" @click="showEditEmailModalVisible = false">取消</button>
              <button type="submit" class="confirm-btn">确认修改</button>
            </div>
          </form>
        </div>
      </div>
      
      <!-- 删除确认弹窗 -->
      <div v-if="showDeleteModalVisible" class="modal-overlay" @click.self="cancelDeleteAdmin">
        <div class="modal-content">
          <h3>⚠️ 删除管理员</h3>
          <p>确定要删除这个管理员吗？</p>
          <p class="warning-text">删除管理员无法找回，且其所有数据将被清除。</p>
          <div class="modal-actions">
            <button class="cancel-btn" @click="cancelDeleteAdmin">取消</button>
            <button class="confirm-btn" @click="confirmDeleteAdmin">确定删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '@/components/Toast.vue'
import Modal from '@/components/Modal.vue'
import AdminSidebar from '@/components/AdminSidebar.vue'

const router = useRouter()
const admins = ref([])
const showAddModal = ref(false)
const showLogoutModal = ref(false)
const newAdmin = ref({
  email: '',
  password: '',
  confirmPassword: ''
})
const changePasswordForm = ref({
  id: '',
  newPassword: '',
  confirmNewPassword: ''
})
const editEmailForm = ref({
  id: '',
  email: ''
})
const showChangePasswordModalVisible = ref(false)
const showEditEmailModalVisible = ref(false)
const showDeleteModalVisible = ref(false)
const deletingAdminId = ref(null)
const toastRef = ref(null)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmNewPassword = ref(false)

// 加载管理员数据
async function loadAdmins() {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const data = await response.json()
    // 只显示管理员
    admins.value = data.filter(user => user.role === 'admin')
  } catch (error) {
    console.error('Failed to load admins:', error)
    if (toastRef.value) {
      toastRef.value.addToast('加载管理员数据失败', 'error')
    }
  }
}

// 显示编辑邮箱弹窗
function showEditEmailModal(adminId, email) {
  editEmailForm.value = {
    id: adminId,
    email: email
  }
  showEditEmailModalVisible.value = true
}

// 处理编辑邮箱
async function handleEditEmail() {
  // 验证邮箱格式
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(editEmailForm.value.email)) {
    if (toastRef.value) {
      toastRef.value.addToast('请输入有效的邮箱地址', 'error')
    }
    return
  }
  
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${editEmailForm.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email: editEmailForm.value.email
      })
    })
    
    if (response.ok) {
      const updatedAdmin = await response.json()
      // 更新本地数据
      const index = admins.value.findIndex(admin => admin.id === editEmailForm.value.id)
      if (index !== -1) {
        admins.value[index] = updatedAdmin
      }
      showEditEmailModalVisible.value = false
      if (toastRef.value) {
        toastRef.value.addToast('邮箱修改成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '邮箱修改失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error editing email:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

// 处理添加管理员
async function handleAddAdmin() {
  if (newAdmin.value.password !== newAdmin.value.confirmPassword) {
    if (toastRef.value) {
      toastRef.value.addToast('两次输入的密码不一致', 'error')
    }
    return
  }
  
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email: newAdmin.value.email,
        password: newAdmin.value.password,
        confirmPassword: newAdmin.value.confirmPassword,
        role: 'admin',
        points: 0
      })
    })
    
    if (response.ok) {
      const addedAdmin = await response.json()
      admins.value.push(addedAdmin)
      showAddModal.value = false
      // 重置表单
      newAdmin.value = {
        email: '',
        password: '',
        confirmPassword: ''
      }
      if (toastRef.value) {
        toastRef.value.addToast('添加管理员成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '添加管理员失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error adding admin:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

// 显示修改密码弹窗
function showChangePasswordModal(adminId, email) {
  changePasswordForm.value = {
    id: adminId,
    newPassword: '',
    confirmNewPassword: ''
  }
  showChangePasswordModalVisible.value = true
}

// 处理修改密码
async function handleChangePassword() {
  if (changePasswordForm.value.newPassword !== changePasswordForm.value.confirmNewPassword) {
    if (toastRef.value) {
      toastRef.value.addToast('两次输入的密码不一致', 'error')
    }
    return
  }
  
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${changePasswordForm.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        password: changePasswordForm.value.newPassword
      })
    })
    
    if (response.ok) {
      showChangePasswordModalVisible.value = false
      if (toastRef.value) {
        toastRef.value.addToast('密码修改成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '密码修改失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error changing password:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

// 显示删除确认弹窗
function showDeleteModal(adminId) {
  deletingAdminId.value = adminId
  showDeleteModalVisible.value = true
}

// 确认删除管理员
async function confirmDeleteAdmin() {
  if (!deletingAdminId.value) return
  
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${deletingAdminId.value}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      admins.value = admins.value.filter(u => u.id !== deletingAdminId.value)
      if (toastRef.value) {
        toastRef.value.addToast('删除管理员成功', 'success')
      }
    } else {
      const errorData = await response.json()
      if (toastRef.value) {
        toastRef.value.addToast(errorData.error || '删除管理员失败', 'error')
      }
    }
  } catch (error) {
    console.error('Error deleting admin:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  } finally {
    showDeleteModalVisible.value = false
    deletingAdminId.value = null
  }
}

// 取消删除管理员
function cancelDeleteAdmin() {
  showDeleteModalVisible.value = false
  deletingAdminId.value = null
}

function handleLogout() {
  // 清除当前用户的本地存储数据
  const userId = localStorage.getItem('user_id')
  if (userId) {
    localStorage.removeItem(`user_${userId}_points`)
    localStorage.removeItem(`user_${userId}_seeds`)
    localStorage.removeItem(`user_${userId}_crops`)
    localStorage.removeItem(`user_${userId}_username`)
  }
  
  // 清除认证信息
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_id')
  localStorage.removeItem('user_role')
  localStorage.removeItem('user_email')
  localStorage.removeItem('user_name')
  localStorage.removeItem('prev_user_id')
  
  if (toastRef.value) {
    toastRef.value.addToast('已成功退出登录', 'success')
  }
  setTimeout(() => {
    router.push('/admin/login')
  }, 1000)
}

// 格式化管理员ID显示
function formatAdminId(id) {
  // 确保ID是字符串
  const idStr = String(id)
  // 如果ID以0开头，显示第二位数字
  if (idStr.startsWith('0')) {
    return idStr[1] || idStr
  }
  return idStr
}

// 生命周期
onMounted(() => {
  loadAdmins()
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

/* 退出登录按钮样式 */
.logout-btn {
  margin-top: 40px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 20px;
}

.logout-btn:hover {
  background: rgba(244, 67, 54, 0.2) !important;
  color: #f44336;
}

/* 深色模式下的退出登录按钮样式 */
@media (prefers-color-scheme: dark) {
  .logout-btn {
    border-top-color: rgba(255, 255, 255, 0.05);
  }
  
  .logout-btn:hover {
    background: rgba(244, 67, 54, 0.2) !important;
    color: #ef5350;
  }
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
}
</style>
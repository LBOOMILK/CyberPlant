<template>
    <div class="profile-page">
        <div class="profile-card">
            <div class="avatar">🧑‍🌾</div>
            <h2>{{ userStore.username }}</h2>

            <div class="stats">
                <div class="stat-item">
                    <span class="stat-label">⭐ 总积分</span>
                    <span class="stat-value">{{ userStore.totalPoints }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🌱 种子数量</span>
                    <span class="stat-value">{{ userStore.seedCount }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🌾 作物数量</span>
                    <span class="stat-value">{{ userStore.cropCount }}</span>
                </div>
            </div>

            <button class="change-pwd-btn" @click="showChangePwdModal = true">🔒 修改密码</button>
            <button class="change-name-btn" @click="showChangeNameModal = true">✏️ 修改用户名</button>
            <button class="logout-btn" @click="showLogoutModal = true">🚪 退出登录</button>
        </div>

        <Toast ref="toastRef" />
        

        
        <!-- 修改密码弹窗 -->
        <div v-if="showChangePwdModal" class="modal-overlay" @click.self="showChangePwdModal = false">
            <div class="modal-content">
                <h3>🔒 修改密码</h3>
                <form @submit.prevent="handleChangePassword">
                    <div class="form-group">
                        <label for="currentPassword">当前密码</label>
                        <div class="password-input-container">
                            <input :type="showCurrentPassword ? 'text' : 'password'" id="currentPassword" v-model="passwordForm.currentPassword" required placeholder="请输入当前密码">
                            <button type="button" class="password-toggle" @click="showCurrentPassword = !showCurrentPassword">
                                {{ showCurrentPassword ? '🙈' : '👁️' }}
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="newPassword">新密码</label>
                        <div class="password-input-container">
                            <input :type="showNewPassword ? 'text' : 'password'" id="newPassword" v-model="passwordForm.newPassword" required placeholder="请输入新密码">
                            <button type="button" class="password-toggle" @click="showNewPassword = !showNewPassword">
                                {{ showNewPassword ? '🙈' : '👁️' }}
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="confirmNewPassword">确认新密码</label>
                        <div class="password-input-container">
                            <input :type="showConfirmNewPassword ? 'text' : 'password'" id="confirmNewPassword" v-model="passwordForm.confirmNewPassword" required placeholder="请再次输入新密码">
                            <button type="button" class="password-toggle" @click="showConfirmNewPassword = !showConfirmNewPassword">
                                {{ showConfirmNewPassword ? '🙈' : '👁️' }}
                            </button>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="cancel-btn" @click="showChangePwdModal = false">取消</button>
                        <button type="submit" class="confirm-btn">确认修改</button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- 修改用户名弹窗 -->
        <div v-if="showChangeNameModal" class="modal-overlay" @click.self="showChangeNameModal = false">
            <div class="modal-content">
                <h3>✏️ 修改用户名</h3>
                <form @submit.prevent="handleChangeName">
                    <div class="form-group">
                        <label for="newName">新用户名</label>
                        <input type="text" id="newName" v-model="nameForm.newName" required placeholder="请输入新用户名">
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="cancel-btn" @click="showChangeNameModal = false">取消</button>
                        <button type="submit" class="confirm-btn">确认修改</button>
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
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import Modal from '@/components/Modal.vue'
import Toast from '@/components/Toast.vue'

const router = useRouter()
const userStore = useUserStore()
const toastRef = ref(null)
const showChangePwdModal = ref(false)
const showChangeNameModal = ref(false)
const showLogoutModal = ref(false)
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmNewPassword = ref(false)
const passwordForm = ref({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
})
const nameForm = ref({
    newName: ''
})

// 生命周期
onMounted(async () => {
    try {
        await userStore.loadFromLocal()
    } catch (error) {
        console.error('Failed to load user data:', error)
        addToast(error.message || '获取用户数据失败，请检查网络连接', 'error')
    }
})

function addToast(message, type = 'info') {
    if (toastRef.value) {
        toastRef.value.addToast(message, type)
    }
}



async function handleChangePassword() {
    if (passwordForm.value.newPassword !== passwordForm.value.confirmNewPassword) {
        addToast('两次输入的新密码不一致', 'error')
        return
    }
    
    try {
        const token = localStorage.getItem('auth_token')
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPassword: passwordForm.value.currentPassword,
                newPassword: passwordForm.value.newPassword
            })
        })
        
        const data = await response.json()
        
        if (!response.ok) {
            addToast(data.error || '修改密码失败', 'error')
            return
        }
        
        addToast('密码修改成功', 'success')
        showChangePwdModal.value = false
        
        // 重置表单
        passwordForm.value = {
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: ''
        }
        showCurrentPassword.value = false
        showNewPassword.value = false
        showConfirmNewPassword.value = false
    } catch (error) {
        console.error('修改密码失败:', error)
        addToast('网络错误，请稍后再试', 'error')
    }
}

async function handleChangeName() {
    try {
        const token = localStorage.getItem('auth_token')
        const response = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: nameForm.value.newName
            })
        })
        
        const data = await response.json()
        
        if (!response.ok) {
            addToast(data.error || '修改用户名失败', 'error')
            return
        }
        
        // 更新本地存储和用户状态
        localStorage.setItem('user_name', data.name)
        userStore.username = data.name
        
        addToast('用户名修改成功', 'success')
        showChangeNameModal.value = false
        
        // 重置表单
        nameForm.value = {
            newName: ''
        }
    } catch (error) {
        console.error('修改用户名失败:', error)
        addToast('网络错误，请稍后再试', 'error')
    }
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
    
    // 重置Pinia store状态
    userStore.resetAllData()
    
    addToast('已成功退出登录', 'success')
    setTimeout(() => {
        router.push('/login')
    }, 1000)
}
</script>

<style scoped>
.profile-page {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px 20px;
    background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
}

.profile-card {
    background: rgba(255, 248, 235, 0.95);
    border-radius: 64px;
    padding: 40px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
}

.avatar {
    font-size: 80px;
    margin-bottom: 16px;
}

.profile-card h2 {
    color: #2c5a2a;
    margin-bottom: 24px;
}

.stats {
    text-align: left;
    margin: 24px 0;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #e9dbbc;
}

.stat-label {
    font-weight: 500;
    color: #555;
}

.stat-value {
    font-weight: bold;
    color: #2e7d32;
}

.change-pwd-btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 40px;
    background: #2196f3;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    margin-top: 12px;
}

.change-name-btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 40px;
    background: #ff9800;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    margin-top: 12px;
}

.logout-btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 40px;
    background: #f44336;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    margin-top: 12px;
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
    background: rgba(255, 248, 235, 0.98);
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 400px;
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

.form-group input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.2s ease;
    box-sizing: border-box;
}

.form-group input:focus {
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



@media (prefers-color-scheme: dark) {
    .profile-page {
        background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
    }

    .profile-card {
        background: rgba(30, 30, 25, 0.95);
    }

    .profile-card h2 {
        color: #8bc34a;
    }

    .stat-item {
        border-bottom-color: #4a4a3a;
    }

    .stat-label {
        color: #aaa;
    }

    .stat-value {
        color: #8bc34a;
    }
    
    .change-pwd-btn {
        background: #1976d2;
    }
    
    .change-name-btn {
        background: #ef6c00;
    }
    
    .modal-content {
        background: rgba(30, 30, 25, 0.95);
    }
    
    .modal-content h3 {
        color: #8bc34a;
    }
    
    .form-group label {
        color: #e0e0e0;
    }
    
    .form-group input {
        background: rgba(40, 40, 35, 0.8);
        border-color: #555;
        color: #e0e0e0;
    }
    
    .form-group input:focus {
        border-color: #8bc34a;
    }
    
    .password-toggle {
        color: #aaa;
    }
    
    .password-toggle:hover {
        color: #8bc34a;
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
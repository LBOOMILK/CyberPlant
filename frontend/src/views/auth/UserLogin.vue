<template>
  <div class="user-auth-page">
    <Toast ref="toastRef" />
    <div class="user-auth-card">
      <div class="user-header">
        <div class="user-icon">🌱</div>
        <h1>赛博花园</h1>
      </div>
      <h2>用户登录</h2>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">邮箱</label>
          <div class="input-wrapper">
            <span class="input-icon">📧</span>
            <input type="email" id="email" v-model="form.email" required placeholder="请输入邮箱">
          </div>
        </div>
        
        <div class="form-group">
          <label for="password">密码</label>
          <div class="input-wrapper">
            <span class="input-icon">🔑</span>
            <input :type="showPassword ? 'text' : 'password'" id="password" v-model="form.password" required placeholder="请输入密码">
            <button type="button" class="password-toggle" @click="showPassword = !showPassword">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>
        
        <button type="submit" class="user-auth-btn">登录</button>
      </form>
      
      <div class="user-auth-footer">
        <p>还没有账号？<router-link to="/register">立即注册</router-link></p>
        <p class="admin-link">管理员请 <router-link to="/admin/login">点击这里登录</router-link></p>
      </div>
      
      <div class="demo-accounts">
        <h3>示例账号</h3>
        <div class="demo-account">
          <p><strong>用户账号：</strong>user@example.com</p>
          <p><strong>密码：</strong>admin123</p>
        </div>
        <div class="demo-account">
          <p><strong>演示账号：</strong>demo@example.com</p>
          <p><strong>密码：</strong>admin123</p>
        </div>
        <div class="demo-account">
          <p><strong>演示账号：</strong>demo1@example.com</p>
          <p><strong>密码：</strong>admin123</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '@/components/Toast.vue'

const router = useRouter()
const form = ref({
  email: '',
  password: ''
})
const toastRef = ref(null)
const showPassword = ref(false)

async function handleLogin() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: form.value.email,
        password: form.value.password
      })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      if (toastRef.value) {
        toastRef.value.addToast(data.error || '登录失败', 'error')
      }
      return
    }
    
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user_id', data.user.id)
    localStorage.setItem('user_role', data.user.role)
    localStorage.setItem('user_email', data.user.email)
    localStorage.setItem('user_name', data.user.name)
    
    if (data.user.role === 'admin') {
      if (toastRef.value) {
        toastRef.value.addToast('请使用管理员登录入口', 'error')
      }
      return
    }
    
    const oldUserId = localStorage.getItem('prev_user_id')
    if (oldUserId && oldUserId !== data.user.id) {
      if (toastRef.value) {
        toastRef.value.addToast('旧账号已被挤出，您现在登录的是新账号', 'info')
      }
      localStorage.removeItem(`user_${oldUserId}_points`)
      localStorage.removeItem(`user_${oldUserId}_seeds`)
      localStorage.removeItem(`user_${oldUserId}_crops`)
      localStorage.removeItem(`user_${oldUserId}_username`)
    }
    localStorage.setItem('prev_user_id', data.user.id)
    
    router.push('/dashboard')
  } catch (error) {
    console.error('登录失败:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}
</script>

<style scoped>
.user-auth-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(145deg, #2e7d32 0%, #388e3c 50%, #4caf50 100%);
  padding: 20px;
}

.user-auth-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  padding: 40px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
  border: 3px solid rgba(76, 175, 80, 0.4);
  background: linear-gradient(145deg, rgba(248, 255, 248, 0.98), rgba(255, 255, 255, 0.95));
}

.user-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 8px;
}

.user-icon {
  font-size: 3.5rem;
  margin-bottom: 12px;
}

.user-auth-card h1 {
  font-size: 1.8rem;
  margin: 0 0 16px 0;
  color: #2c5a2a;
  font-weight: 600;
}

.user-auth-card h2 {
  font-size: 1.3rem;
  margin: 0 0 32px 0;
  color: #4caf50;
  font-weight: 500;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #37474f;
  font-size: 0.9rem;
}

.input-wrapper {
  position: relative;
  width: 100%;
}

.input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.1rem;
  z-index: 1;
}

.input-wrapper input {
  width: 100%;
  padding: 14px 16px 14px 44px;
  border: 2px solid #e3e7ed;
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
  background: #fafbfc;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #4caf50;
  background: white;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #78909c;
  transition: color 0.2s ease;
}

.password-toggle:hover {
  color: #4caf50;
}

.user-auth-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
  box-shadow: 0 4px 14px rgba(76, 175, 80, 0.4);
}

.user-auth-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.5);
}

.user-auth-btn:active {
  transform: translateY(0);
}

.user-auth-footer {
  margin-top: 24px;
  font-size: 0.85rem;
  color: #78909c;
}

.user-auth-footer a {
  color: #4caf50;
  text-decoration: none;
  font-weight: 600;
}

.user-auth-footer a:hover {
  text-decoration: underline;
}

.admin-link {
  margin-top: 8px;
}

.admin-link a {
  color: #2196f3;
}

.demo-accounts {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid #e8eef4;
}

.demo-accounts h3 {
  margin: 0 0 14px 0;
  color: #607d8b;
  font-size: 0.9rem;
  font-weight: 600;
}

.demo-account {
  background: rgba(76, 175, 80, 0.06);
  padding: 14px 18px;
  border-radius: 10px;
  text-align: left;
  margin-bottom: 12px;
}

.demo-account:last-child {
  margin-bottom: 0;
}

.demo-account p {
  margin: 5px 0;
  font-size: 0.85rem;
  color: #546e7a;
}

@media (prefers-color-scheme: dark) {
  .user-auth-page {
    background: linear-gradient(145deg, #1a3a1a 0%, #1b5e20 50%, #2e7d32 100%);
  }
  
  .user-auth-card {
    background: rgba(25, 30, 50, 0.95);
  }
  
  .user-auth-card h1 {
    color: #8bc34a;
  }
  
  .user-auth-card h2 {
    color: #81c784;
  }
  
  .form-group label {
    color: #cfd8dc;
  }
  
  .input-wrapper input {
    background: rgba(40, 45, 70, 0.8);
    border-color: #37474f;
    color: #e8eef4;
  }
  
  .input-wrapper input:focus {
    border-color: #8bc34a;
    background: rgba(50, 55, 85, 0.9);
    box-shadow: 0 0 0 3px rgba(139, 195, 74, 0.15);
  }
  
  .password-toggle {
    color: #90a4ae;
  }
  
  .password-toggle:hover {
    color: #8bc34a;
  }
  
  .user-auth-footer {
    color: #90a4ae;
  }
  
  .user-auth-footer a {
    color: #8bc34a;
  }
  
  .admin-link a {
    color: #64b5f6;
  }
  
  .demo-accounts {
    border-top-color: #37474f;
  }
  
  .demo-accounts h3 {
    color: #b0bec5;
  }
  
  .demo-account {
    background: rgba(139, 195, 74, 0.1);
  }
  
  .demo-account p {
    color: #b0bec5;
  }
}

@media (max-width: 480px) {
  .user-auth-card {
    padding: 28px;
    border-radius: 20px;
  }
  
  .user-icon {
    font-size: 2.8rem;
  }
  
  .user-auth-card h1 {
    font-size: 1.5rem;
  }
  
  .user-auth-card h2 {
    font-size: 1.15rem;
    margin-bottom: 24px;
  }
  
  .input-wrapper input {
    padding: 12px 14px 12px 40px;
  }
  
  .demo-accounts {
    margin-top: 24px;
    padding-top: 16px;
  }
}
</style>
<template>
  <div class="admin-auth-page">
    <Toast ref="toastRef" />
    <div class="admin-auth-card">
      <div class="admin-header">
        <div class="admin-icon">🔧</div>
        <h1>管理中心</h1>
      </div>
      <h2>管理员登录</h2>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">邮箱</label>
          <div class="input-wrapper">
            <span class="input-icon">📧</span>
            <input type="email" id="email" v-model="form.email" required placeholder="请输入管理员邮箱">
          </div>
        </div>
        
        <div class="form-group">
          <label for="password">密码</label>
          <div class="input-wrapper">
            <span class="input-icon">🔑</span>
            <input :type="showPassword ? 'text' : 'password'" id="password" v-model="form.password" required placeholder="请输入管理员密码">
            <button type="button" class="password-toggle" @click="showPassword = !showPassword">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>
        
        <button type="submit" class="admin-auth-btn">登录管理后台</button>
      </form>
      
      <div class="admin-auth-footer">
        <p>普通用户请 <router-link to="/login">点击这里登录</router-link></p>
      </div>
      
      <div class="demo-accounts">
        <h3>示例管理员账号</h3>
        <div class="demo-account">
          <p><strong>管理员账号：</strong>admin@example.com</p>
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
    
    if (data.user.role !== 'admin') {
      if (toastRef.value) {
        toastRef.value.addToast('请使用普通用户登录入口', 'error')
      }
      return
    }
    
    router.push('/admin')
  } catch (error) {
    console.error('登录失败:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}
</script>

<style scoped>
.admin-auth-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(145deg, #1a237e 0%, #283593 50%, #3949ab 100%);
  padding: 20px;
}

.admin-auth-card {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24px;
  padding: 40px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
}

.admin-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 8px;
}

.admin-icon {
  font-size: 3.5rem;
  margin-bottom: 12px;
}

.admin-auth-card h1 {
  font-size: 1.8rem;
  margin: 0 0 16px 0;
  color: #1a237e;
  font-weight: 600;
}

.admin-auth-card h2 {
  font-size: 1.3rem;
  margin: 0 0 32px 0;
  color: #5c6bc0;
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
  border-color: #3949ab;
  background: white;
  box-shadow: 0 0 0 3px rgba(57, 73, 171, 0.1);
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
  color: #3949ab;
}

.admin-auth-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #3949ab 0%, #1a237e 100%);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
  box-shadow: 0 4px 14px rgba(57, 73, 171, 0.4);
}

.admin-auth-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(57, 73, 171, 0.5);
}

.admin-auth-btn:active {
  transform: translateY(0);
}

.admin-auth-footer {
  margin-top: 24px;
  font-size: 0.85rem;
  color: #78909c;
}

.admin-auth-footer a {
  color: #3949ab;
  text-decoration: none;
  font-weight: 600;
}

.admin-auth-footer a:hover {
  text-decoration: underline;
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
  background: rgba(57, 73, 171, 0.06);
  padding: 14px 18px;
  border-radius: 10px;
  text-align: left;
}

.demo-account p {
  margin: 5px 0;
  font-size: 0.85rem;
  color: #546e7a;
}

@media (prefers-color-scheme: dark) {
  .admin-auth-page {
    background: linear-gradient(145deg, #0d142a 0%, #151d3d 50%, #1e2a52 100%);
  }
  
  .admin-auth-card {
    background: rgba(25, 30, 50, 0.95);
  }
  
  .admin-auth-card h1 {
    color: #90caf9;
  }
  
  .admin-auth-card h2 {
    color: #7986cb;
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
    border-color: #64b5f6;
    background: rgba(50, 55, 85, 0.9);
    box-shadow: 0 0 0 3px rgba(100, 181, 246, 0.15);
  }
  
  .password-toggle {
    color: #90a4ae;
  }
  
  .password-toggle:hover {
    color: #64b5f6;
  }
  
  .admin-auth-footer {
    color: #90a4ae;
  }
  
  .admin-auth-footer a {
    color: #64b5f6;
  }
  
  .demo-accounts {
    border-top-color: #37474f;
  }
  
  .demo-accounts h3 {
    color: #b0bec5;
  }
  
  .demo-account {
    background: rgba(100, 181, 246, 0.1);
  }
  
  .demo-account p {
    color: #b0bec5;
  }
}

@media (max-width: 480px) {
  .admin-auth-card {
    padding: 28px;
    border-radius: 20px;
  }
  
  .admin-icon {
    font-size: 2.8rem;
  }
  
  .admin-auth-card h1 {
    font-size: 1.5rem;
  }
  
  .admin-auth-card h2 {
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
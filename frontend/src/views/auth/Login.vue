<template>
  <div class="auth-page">
    <Toast ref="toastRef" />
    <div class="auth-card">
      <h1>🌱 赛博花园</h1>
      <h2>登录</h2>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">邮箱</label>
          <input type="email" id="email" v-model="form.email" required placeholder="请输入邮箱">
        </div>
        
        <div class="form-group password-group">
          <label for="password">密码</label>
          <div class="password-input-container">
            <input :type="showPassword ? 'text' : 'password'" id="password" v-model="form.password" required placeholder="请输入密码">
            <button type="button" class="password-toggle" @click="showPassword = !showPassword">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.isAdmin">
            <span>管理员登录</span>
          </label>
        </div>
        
        <button type="submit" class="auth-btn">登录</button>
      </form>
      
      <div class="auth-footer">
        <p>还没有账号？<router-link to="/register">立即注册</router-link></p>
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
  password: '',
  isAdmin: false
})
const toastRef = ref(null)
const showPassword = ref(false)

async function handleLogin() {
  try {
    // 调用后端 API 进行登录验证
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
    
    // 存储认证信息
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user_id', data.user.id)
    localStorage.setItem('user_role', data.user.role)
    localStorage.setItem('user_email', data.user.email)
    localStorage.setItem('user_name', data.user.name)
    
    // 检查非管理员勾选管理员登录的情况
    if (form.value.isAdmin && data.user.role !== 'admin') {
      if (toastRef.value) {
        toastRef.value.addToast('只有管理员账号才能登录管理后台', 'error')
      }
      return
    }
    
    // 检查管理员账号未勾选管理员登录的情况
    if (!form.value.isAdmin && data.user.role === 'admin') {
      if (toastRef.value) {
        toastRef.value.addToast('管理员账号请勾选管理员登录选项', 'error')
      }
      return
    }
    
    // 检查是否有旧用户（只有在登录成功后才检查）
    const oldUserId = localStorage.getItem('prev_user_id')
    if (oldUserId && oldUserId !== data.user.id) {
      // 显示旧用户被挤出的提示
      if (toastRef.value) {
        toastRef.value.addToast('旧账号已被挤出，您现在登录的是新账号', 'info')
      }
      
      // 清除旧用户的本地存储数据
      localStorage.removeItem(`user_${oldUserId}_points`)
      localStorage.removeItem(`user_${oldUserId}_seeds`)
      localStorage.removeItem(`user_${oldUserId}_crops`)
      localStorage.removeItem(`user_${oldUserId}_username`)
    }
    localStorage.setItem('prev_user_id', data.user.id)
    
    // 根据角色跳转到不同的页面
    if (data.user.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/dashboard')
    }
  } catch (error) {
    console.error('登录失败:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
  padding: 20px;
}

.auth-card {
  background: rgba(255, 248, 235, 0.98);
  border-radius: 48px;
  padding: 40px;
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
}

.auth-card h1 {
  font-size: 2rem;
  margin: 0 0 16px 0;
  color: #2c5a2a;
}

.auth-card h2 {
  font-size: 1.5rem;
  margin: 0 0 32px 0;
  color: #4a6c4a;
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
  border-radius: 24px;
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

.auth-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 24px;
  background: #4caf50;
  color: white;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-top: 8px;
}

.auth-btn:hover {
  background: #388e3c;
}

.auth-footer {
  margin-top: 24px;
  font-size: 0.9rem;
  color: #666;
}

.auth-footer a {
  color: #4caf50;
  text-decoration: none;
  font-weight: bold;
}

.auth-footer a:hover {
  text-decoration: underline;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.demo-accounts {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e0e0e0;
}

.demo-accounts h3 {
  margin: 0 0 16px 0;
  color: #4a6c4a;
  font-size: 1rem;
}

.demo-account {
  background: rgba(76, 175, 80, 0.05);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 12px;
  text-align: left;
}

.demo-account p {
  margin: 4px 0;
  font-size: 0.9rem;
  color: #555;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .auth-page {
    background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
  }
  
  .auth-card {
    background: rgba(30, 30, 25, 0.95);
  }
  
  .auth-card h1 {
    color: #8bc34a;
  }
  
  .auth-card h2 {
    color: #a5d6a7;
  }
  
  .form-group label {
    color: #e0e0d0;
  }
  
  .form-group input {
    background: rgba(40, 40, 35, 0.8);
    border-color: #555;
    color: #e0e0e0;
  }
  
  .form-group input:focus {
    border-color: #8bc34a;
  }
  
  .auth-footer {
    color: #aaa;
  }
  
  .auth-footer a {
    color: #8bc34a;
  }
  
  .demo-accounts {
    border-top-color: #4a4a4a;
  }
  
  .demo-accounts h3 {
    color: #8bc34a;
  }
  
  .demo-account {
    background: rgba(139, 195, 74, 0.1);
  }
  
  .demo-account p {
    color: #e0e0e0;
  }
}
</style>
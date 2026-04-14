<template>
  <div class="auth-page">
    <Toast ref="toastRef" />
    <div class="auth-card">
      <h1>🌱 赛博花园</h1>
      <h2>注册</h2>
      
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="email">邮箱</label>
          <div class="email-input-container">
            <input 
              type="email" 
              id="email" 
              v-model="form.email" 
              required 
              placeholder="请输入邮箱"
              @input="validateEmail"
              @blur="validateEmail"
            >
            <div v-if="showEmailSuggestions" class="email-suggestions">
              <div 
                v-for="suffix in emailSuffixes" 
                :key="suffix"
                class="email-suggestion"
                @click="selectEmailSuffix(suffix)"
              >
                @{{ suffix }}
              </div>
            </div>
          </div>
          <p v-if="emailError" class="error-message">{{ emailError }}</p>
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
        
        <div class="form-group password-group">
          <label for="confirmPassword">确认密码</label>
          <div class="password-input-container">
            <input :type="showConfirmPassword ? 'text' : 'password'" id="confirmPassword" v-model="form.confirmPassword" required placeholder="请确认密码">
            <button type="button" class="password-toggle" @click="showConfirmPassword = !showConfirmPassword">
              {{ showConfirmPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>
        
        <button type="submit" class="auth-btn">注册</button>
      </form>
      
      <div class="auth-footer">
        <p>已有账号？<router-link to="/login">立即登录</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '@/components/Toast.vue'

const router = useRouter()
const form = ref({
  email: '',
  password: '',
  confirmPassword: ''
})

// 密码可视相关
const showPassword = ref(false)
const showConfirmPassword = ref(false)

// 邮箱验证相关
const emailError = ref('')
const showEmailSuggestions = ref(false)
const emailSuffixes = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'qq.com', '163.com', '126.com']

// Toast组件
const toastRef = ref(null)

// 邮箱验证
function validateEmail() {
  const email = form.value.email
  emailError.value = ''
  
  if (!email) {
    showEmailSuggestions.value = false
    return
  }
  
  // 检查是否包含 @ 符号
  if (!email.includes('@')) {
    showEmailSuggestions.value = true
    return
  }
  
  showEmailSuggestions.value = false
  
  // 邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    emailError.value = '请输入有效的邮箱地址'
  }
}

// 选择邮箱后缀
function selectEmailSuffix(suffix) {
  const email = form.value.email
  const atIndex = email.indexOf('@')
  if (atIndex === -1) {
    form.value.email = `${email}@${suffix}`
  } else {
    form.value.email = `${email.substring(0, atIndex)}@${suffix}`
  }
  showEmailSuggestions.value = false
  validateEmail()
}

async function handleRegister() {
  // 验证邮箱格式
  validateEmail()
  if (emailError.value) {
    return
  }
  
  if (form.value.password !== form.value.confirmPassword) {
    if (toastRef.value) {
      toastRef.value.addToast('两次输入的密码不一致', 'error')
    }
    return
  }
  
  // 调用后端 API 进行注册
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
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
        toastRef.value.addToast(data.error || '注册失败', 'error')
      }
      return
    }
    
    // 存储认证信息
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user_id', data.user.id)
    localStorage.setItem('user_role', data.user.role)
    localStorage.setItem('user_email', data.user.email)
    localStorage.setItem('user_name', data.user.name)
    
    // 跳转到仪表盘
    router.push('/dashboard')
  } catch (error) {
    console.error('注册失败:', error)
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

/* 邮箱输入容器 */
.email-input-container {
  position: relative;
  width: 100%;
}

/* 邮箱后缀建议 */
.email-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 0 0 24px 24px;
  border-top: none;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
}

.email-suggestion {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.email-suggestion:hover {
  background-color: #f5f5f5;
}

/* 错误消息 */
.error-message {
  margin: 8px 0 0 0;
  font-size: 0.8rem;
  color: #f44336;
  text-align: left;
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
  
  /* 邮箱后缀建议 - 深色模式 */
  .email-suggestions {
    background: #2a2a2a;
    border-color: #444;
  }
  
  .email-suggestion {
    color: #e0e0e0;
  }
  
  .email-suggestion:hover {
    background-color: #3a3a3a;
  }
  
  /* 错误消息 - 深色模式 */
  .error-message {
    color: #ef5350;
  }
}
</style>
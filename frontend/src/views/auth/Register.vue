<template>
  <div class="auth-page">
    <Toast ref="toastRef" />
    <div class="auth-card">
      <div class="auth-header">
        <div class="auth-icon">🌱</div>
        <h1>赛博花园</h1>
      </div>
      <h2>用户注册</h2>
      
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="name">用户名</label>
          <div class="input-wrapper">
            <span class="input-icon">👤</span>
            <input 
              type="text" 
              id="name" 
              v-model="form.name" 
              required 
              placeholder="请输入用户名"
            >
          </div>
        </div>
        
        <div class="form-group">
          <label for="email">邮箱</label>
          <div class="email-input-container">
            <div class="input-wrapper">
              <span class="input-icon">📧</span>
              <input 
                type="email" 
                id="email" 
                v-model="form.email" 
                required 
                placeholder="请输入邮箱"
                @input="validateEmail"
                @blur="validateEmail"
              >
            </div>
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
        
        <div class="form-group">
          <label for="confirmPassword">确认密码</label>
          <div class="input-wrapper">
            <span class="input-icon">🔑</span>
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
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const showPassword = ref(false)
const showConfirmPassword = ref(false)

const emailError = ref('')
const showEmailSuggestions = ref(false)
const emailSuffixes = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'qq.com', '163.com', '126.com']

const toastRef = ref(null)

function validateEmail() {
  const email = form.value.email
  emailError.value = ''
  
  if (!email) {
    showEmailSuggestions.value = false
    return
  }
  
  if (!email.includes('@')) {
    showEmailSuggestions.value = true
    return
  }
  
  showEmailSuggestions.value = false
  
  const emailRegex = /^[^\s@]+@[^\s@]+$/
  if (!emailRegex.test(email)) {
    emailError.value = '请输入有效的邮箱地址'
  }
}

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
  
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: form.value.name,
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
    
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user_id', data.user.id)
    localStorage.setItem('user_role', data.user.role)
    localStorage.setItem('user_email', data.user.email)
    localStorage.setItem('user_name', data.user.name)
    
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
  background: linear-gradient(145deg, #2e7d32 0%, #388e3c 50%, #4caf50 100%);
  padding: 20px;
}

.auth-card {
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

.auth-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 8px;
}

.auth-icon {
  font-size: 3.5rem;
  margin-bottom: 12px;
}

.auth-card h1 {
  font-size: 1.8rem;
  margin: 0 0 16px 0;
  color: #2c5a2a;
  font-weight: 600;
}

.auth-card h2 {
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

.email-input-container {
  position: relative;
  width: 100%;
}

.email-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 2px solid #e3e7ed;
  border-radius: 0 0 12px 12px;
  border-top: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
}

.email-suggestion {
  padding: 12px 16px 12px 44px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  text-align: left;
}

.email-suggestion:hover {
  background-color: #f1f8e9;
}

.error-message {
  margin: 8px 0 0 0;
  font-size: 0.8rem;
  color: #f44336;
  text-align: left;
}

.auth-btn {
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

.auth-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.5);
}

.auth-btn:active {
  transform: translateY(0);
}

.auth-footer {
  margin-top: 24px;
  font-size: 0.85rem;
  color: #78909c;
}

.auth-footer a {
  color: #4caf50;
  text-decoration: none;
  font-weight: 600;
}

.auth-footer a:hover {
  text-decoration: underline;
}

@media (prefers-color-scheme: dark) {
  .auth-page {
    background: linear-gradient(145deg, #1a3a1a 0%, #1b5e20 50%, #2e7d32 100%);
  }
  
  .auth-card {
    background: rgba(25, 30, 50, 0.95);
    border-color: rgba(139, 195, 74, 0.3);
  }
  
  .auth-card h1 {
    color: #8bc34a;
  }
  
  .auth-card h2 {
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
  
  .email-suggestions {
    background: rgba(40, 45, 70, 0.95);
    border-color: #37474f;
  }
  
  .email-suggestion {
    color: #e8eef4;
  }
  
  .email-suggestion:hover {
    background-color: rgba(139, 195, 74, 0.15);
  }
  
  .error-message {
    color: #ef5350;
  }
  
  .auth-footer {
    color: #90a4ae;
  }
  
  .auth-footer a {
    color: #8bc34a;
  }
}

@media (max-width: 480px) {
  .auth-card {
    padding: 28px;
    border-radius: 20px;
  }
  
  .auth-icon {
    font-size: 2.8rem;
  }
  
  .auth-card h1 {
    font-size: 1.5rem;
  }
  
  .auth-card h2 {
    font-size: 1.15rem;
    margin-bottom: 24px;
  }
  
  .input-wrapper input {
    padding: 12px 14px 12px 40px;
  }
}
</style>
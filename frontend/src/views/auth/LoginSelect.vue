<template>
  <div class="login-select-page">
    <div class="hero-section">
      <div class="logo-container">
        <span class="logo-emoji">🌱</span>
        <h1>赛博花园</h1>
        <p class="tagline">种植你的数字梦想</p>
      </div>
    </div>
    
    <div class="card-section">
      <div class="choice-card user-card" @click="goToUserLogin">
        <div class="card-icon user-icon">👤</div>
        <h2>用户登录</h2>
        <p>进入个人花园，种植和收获属于你的植物</p>
        <div class="card-arrow">→</div>
      </div>
      
      <div class="choice-card admin-card" @click="goToAdminLogin">
        <div class="card-icon admin-icon">🔧</div>
        <h2>管理员登录</h2>
        <p>管理用户、植物和订单，维护花园生态</p>
        <div class="card-arrow">→</div>
      </div>
    </div>
    
    <div class="quick-actions">
      <router-link to="/register" class="register-link">
        🌻 注册新用户
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goToUserLogin() {
  router.push('/login')
}

function goToAdminLogin() {
  router.push('/admin/login')
}
</script>

<style scoped>
.login-select-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 50%, #c8e6c9 100%);
}

.hero-section {
  text-align: center;
  margin-bottom: 48px;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-emoji {
  font-size: 5rem;
  margin-bottom: 16px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.hero-section h1 {
  font-size: 2.5rem;
  margin: 0 0 8px 0;
  color: #2c5a2a;
}

.tagline {
  font-size: 1.1rem;
  color: #5a7a5a;
  margin: 0;
}

.card-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 420px;
}

.choice-card {
  background: white;
  border-radius: 20px;
  padding: 28px;
  display: flex;
  align-items: center;
  gap: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.choice-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

.card-icon {
  font-size: 2.5rem;
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
}

.user-icon {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
}

.admin-icon {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
}

.choice-card h2 {
  font-size: 1.3rem;
  margin: 0 0 4px 0;
  color: #333;
}

.choice-card p {
  font-size: 0.85rem;
  color: #777;
  margin: 0;
}

.card-arrow {
  margin-left: auto;
  font-size: 1.5rem;
  color: #999;
  transition: transform 0.2s ease;
}

.choice-card:hover .card-arrow {
  transform: translateX(4px);
  color: #4caf50;
}

.choice-card {
  position: relative;
  overflow: visible;
}

/* 脉冲发光边框 - 常驻微脉冲 */
@keyframes pulse-border {
  0%, 100% {
    box-shadow: 0 0 3px 1px rgba(76, 175, 80, 0.15), 0 0 8px 3px rgba(76, 175, 80, 0.06);
  }
  50% {
    box-shadow: 0 0 6px 2px rgba(76, 175, 80, 0.30), 0 0 15px 6px rgba(76, 175, 80, 0.10);
  }
}

@keyframes pulse-border-strong {
  0%, 100% {
    box-shadow: 0 0 3px 1px rgba(76, 175, 80, 0.30), 0 0 8px 3px rgba(76, 175, 80, 0.15);
  }
  50% {
    box-shadow: 0 0 10px 4px rgba(76, 175, 80, 0.60), 0 0 25px 10px rgba(76, 175, 80, 0.25);
  }
}

@keyframes pulse-border-admin {
  0%, 100% {
    box-shadow: 0 0 3px 1px rgba(33, 150, 243, 0.15), 0 0 8px 3px rgba(33, 150, 243, 0.06);
  }
  50% {
    box-shadow: 0 0 6px 2px rgba(33, 150, 243, 0.30), 0 0 15px 6px rgba(33, 150, 243, 0.10);
  }
}

@keyframes pulse-border-admin-strong {
  0%, 100% {
    box-shadow: 0 0 3px 1px rgba(33, 150, 243, 0.30), 0 0 8px 3px rgba(33, 150, 243, 0.15);
  }
  50% {
    box-shadow: 0 0 10px 4px rgba(33, 150, 243, 0.60), 0 0 25px 10px rgba(33, 150, 243, 0.25);
  }
}

.user-card {
  background: white;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  animation: pulse-border 3s ease-in-out infinite;
}

.user-card:hover {
  border: 2px solid #4caf50;
  animation: pulse-border-strong 1.5s ease-in-out infinite;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.06) 0%, transparent 100%);
}

.admin-card {
  background: white;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  animation: pulse-border-admin 3s ease-in-out infinite;
}

.admin-card:hover {
  border: 2px solid #2196f3;
  animation: pulse-border-admin-strong 1.5s ease-in-out infinite;
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.06) 0%, transparent 100%);
}

.admin-card h2 {
  color: #1a237e;
}

.admin-card .card-arrow {
  color: #999;
}

.admin-card:hover .card-arrow {
  color: #2196f3;
}

.quick-actions {
  margin-top: 32px;
  text-align: center;
}

.register-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 30px;
  text-decoration: none;
  color: #4caf50;
  font-weight: 600;
  transition: all 0.2s ease;
}

.register-link:hover {
  background: white;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
}

@media (prefers-color-scheme: dark) {
  .login-select-page {
    background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 50%, #152815 100%);
  }
  
  .hero-section h1 {
    color: #8bc34a;
  }
  
  .tagline {
    color: #81c784;
  }
  
  .choice-card {
    background: rgba(40, 40, 35, 0.9);
  }
  
  .user-icon {
    background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
  }
  
  .admin-icon {
    background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
  }
  
  .choice-card h2 {
    color: #e8eef4;
  }
  
  .choice-card p {
    color: #a0a0a0;
  }
  
  .card-arrow {
    color: #666;
  }
  
  .choice-card:hover .card-arrow {
    color: #8bc34a;
  }
  
  .admin-card:hover .card-arrow {
    color: #64b5f6;
  }
  
  .register-link {
    background: rgba(50, 50, 45, 0.8);
    color: #8bc34a;
  }
  
  .register-link:hover {
    background: rgba(60, 60, 55, 0.95);
  }
  
  .user-card {
    background: rgba(40, 40, 35, 0.9);
    animation: pulse-border 3s ease-in-out infinite;
  }
  
  .user-card:hover {
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.20) 0%, rgba(40, 40, 35, 0.95) 100%);
    border: 2px solid #66bb6a;
    animation: pulse-border-strong 1.5s ease-in-out infinite;
  }
  
  .admin-card {
    background: rgba(40, 40, 35, 0.9);
    animation: pulse-border-admin 3s ease-in-out infinite;
  }
  
  .admin-card:hover {
    background: linear-gradient(135deg, rgba(33, 150, 243, 0.20) 0%, rgba(40, 40, 35, 0.95) 100%);
    border: 2px solid #42a5f5;
    animation: pulse-border-admin-strong 1.5s ease-in-out infinite;
  }
}

@media (max-width: 480px) {
  .login-select-page {
    padding: 30px 16px;
  }
  
  .logo-emoji {
    font-size: 4rem;
  }
  
  .hero-section h1 {
    font-size: 2rem;
  }
  
  .tagline {
    font-size: 1rem;
  }
  
  .card-section {
    gap: 16px;
  }
  
  .choice-card {
    padding: 22px;
    gap: 16px;
  }
  
  .card-icon {
    font-size: 2rem;
    width: 56px;
    height: 56px;
  }
  
  .choice-card h2 {
    font-size: 1.15rem;
  }
  
  .choice-card p {
    font-size: 0.8rem;
  }
}
</style>
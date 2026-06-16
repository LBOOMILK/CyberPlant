<template>
  <transition name="modal-fade">
    <div v-if="visible" class="welcome-overlay">
      <div class="welcome-panel">
        <!-- 装饰粒子 -->
        <div class="particles">
          <span v-for="i in 12" :key="i" class="particle" :style="particleStyle(i)">✨</span>
        </div>

        <div class="welcome-icon">🌱</div>
        <h2 class="welcome-title">欢迎来到赛博花园！</h2>
        <p class="welcome-subtitle">在数字世界中，种下属于你的植物</p>

        <div class="welcome-story">
          <p>在这个赛博朋克风格的花园里，你可以：</p>
          <ul>
            <li>🌾 种植各种作物，收获果实赚取货币</li>
            <li>🐾 领养宠物，获得种植加成</li>
            <li>👥 添加好友，互赠礼物</li>
            <li>🤖 向 AI 助手请教种植技巧</li>
          </ul>
        </div>

        <div v-if="!claimed" class="welcome-actions">
          <button class="claim-btn" :disabled="claiming" @click="handleClaim">
            {{ claiming ? '领取中...' : '🎁 领取新手礼包' }}
          </button>
          <button class="skip-btn" @click="handleSkip">稍后再说</button>
        </div>

        <div v-else class="welcome-reward">
          <div class="reward-title">🎉 礼包领取成功！</div>
          <div class="reward-list">
            <div class="reward-item">
              <img src="/silver_icon.png" class="reward-currency-icon" />
              <span>银币 ×300</span>
            </div>
            <div class="reward-item">
              <span class="reward-icon">🥬</span>
              <span>白菜种子 ×2</span>
            </div>
            <div class="reward-item">
              <span class="reward-icon">🥔</span>
              <span>土豆种子 ×2</span>
            </div>
            <div class="reward-item">
              <span class="reward-icon">🥒</span>
              <span>黄瓜种子 ×2</span>
            </div>
            <div class="reward-item">
              <span class="reward-icon">🥕</span>
              <span>胡萝卜种子 ×2</span>
            </div>
          </div>
          <button class="start-btn" @click="handleClose">开始种植 🌿</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])
const userStore = useUserStore()

const claimed = ref(false)
const claiming = ref(false)

function particleStyle(i) {
  const angle = (i / 12) * 360
  const delay = i * 0.15
  const dist = 80 + Math.random() * 60
  return {
    '--angle': `${angle}deg`,
    '--dist': `${dist}px`,
    animationDelay: `${delay}s`
  }
}

async function handleClaim() {
  claiming.value = true
  try {
    const result = await userStore.claimNewbiePack()
    if (result.success) {
      claimed.value = true
    }
  } catch (e) {
    console.error('Claim error:', e)
  } finally {
    claiming.value = false
  }
}

function handleSkip() {
  handleClose()
}

function handleClose() {
  userStore.isNewUser = false
  emit('close')
}
</script>

<style scoped>
.welcome-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10003;
}

.welcome-panel {
  background: rgba(255, 248, 235, 0.98);
  border-radius: 32px;
  padding: 36px 28px;
  width: 90%;
  max-width: 420px;
  text-align: center;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
  animation: welcomePop 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28);
  position: relative;
  overflow: hidden;
}

/* 装饰粒子 */
.particles {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  font-size: 1.2rem;
  animation: particleBurst 2s ease-out forwards;
}

@keyframes particleBurst {
  0% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(
      calc(cos(var(--angle)) * var(--dist)),
      calc(sin(var(--angle)) * var(--dist))
    ) scale(0.3);
  }
}

.welcome-icon {
  font-size: 4rem;
  margin-bottom: 8px;
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.welcome-title {
  margin: 0 0 4px;
  color: #2c5a2a;
  font-size: 1.5rem;
}

.welcome-subtitle {
  margin: 0 0 20px;
  color: #888;
  font-size: 0.9rem;
}

.welcome-story {
  text-align: left;
  padding: 16px;
  background: rgba(76, 175, 80, 0.06);
  border-radius: 16px;
  margin-bottom: 20px;
}

.welcome-story p {
  margin: 0 0 8px;
  color: #555;
  font-size: 0.9rem;
}

.welcome-story ul {
  margin: 0;
  padding: 0 0 0 8px;
  list-style: none;
}

.welcome-story li {
  padding: 4px 0;
  font-size: 0.85rem;
  color: #444;
}

.welcome-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.claim-btn {
  padding: 14px 24px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: white;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.3);
}

.claim-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(255, 152, 0, 0.4);
}

.claim-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.skip-btn {
  padding: 10px;
  border: none;
  background: none;
  color: #999;
  font-size: 0.85rem;
  cursor: pointer;
}

.skip-btn:hover { color: #666; }

/* 领取成功 */
.welcome-reward {
  animation: fadeIn 0.4s ease;
}

.reward-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #2e7d32;
  margin-bottom: 16px;
}

.reward-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-bottom: 20px;
}

.reward-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(76, 175, 80, 0.08);
  border-radius: 12px;
  font-size: 0.95rem;
  color: #333;
}

.reward-icon {
  font-size: 1.3rem;
}

.reward-currency-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.start-btn {
  padding: 12px 32px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

@keyframes welcomePop {
  from { opacity: 0; transform: scale(0.8) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-fade-enter-active { transition: opacity 0.3s ease; }
.modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

@media (prefers-color-scheme: dark) {
  .welcome-panel { background: rgba(30, 30, 25, 0.98); }
  .welcome-title { color: #8bc34a; }
  .welcome-subtitle { color: #aaa; }
  .welcome-story { background: rgba(76, 175, 80, 0.1); }
  .welcome-story p { color: #ccc; }
  .welcome-story li { color: #bbb; }
  .reward-item { background: rgba(76, 175, 80, 0.12); color: #ddd; }
  .reward-title { color: #81c784; }
}
</style>

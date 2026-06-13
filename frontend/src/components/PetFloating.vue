<template>
  <div
    v-if="visible"
    class="pet-floating"
    :class="{ dragging: isDragging }"
    :style="floatStyle"
    @click="handleClick"
  >
    <!-- 用户信息区域 -->
    <div class="user-section">
      <span class="user-icon">🧑‍🌾</span>
      <span class="user-name">{{ userStore.username }}</span>
    </div>
    
    <!-- 货币区域 -->
    <div class="currency-section">
      <div class="currency-item" @click.stop="openExchange">
        <img src="/silver_icon.png" alt="银币" class="currency-icon" />
        <span class="currency-value">{{ formatNumber(userStore.currencies.silver_coin) }}</span>
      </div>
      <div class="currency-item" @click.stop="openExchange">
        <img src="/gold_icon.png" alt="金币" class="currency-icon" />
        <span class="currency-value">{{ formatNumber(userStore.currencies.gold_coin) }}</span>
      </div>
      <div class="currency-item" @click.stop="openExchange">
        <img src="/diamond.png" alt="钻石" class="currency-icon" />
        <span class="currency-value">{{ formatNumber(userStore.currencies.diamond) }}</span>
      </div>
    </div>
    
    <!-- 宠物信息区域（仅当有激活宠物时显示） -->
    <div v-if="petStore.hasActivePet" class="pet-section">
      <div class="pet-float-icon">{{ petStore.activePet?.icon || '🐾' }}</div>
      <div class="pet-float-info">
        <div class="pet-float-name">{{ petStore.activePet?.name || '宠物' }}</div>
        <div class="pet-float-level">Lv.{{ petStore.activePet?.level }}</div>
        <div class="pet-float-hunger">
          <div class="mini-bar">
            <div
              class="mini-bar-fill"
              :class="{ low: hunger < 20, mid: hunger >= 20 && hunger < 50 }"
              :style="{ width: hunger + '%' }"
            ></div>
          </div>
          <span class="hunger-text">{{ hunger }}%</span>
        </div>
        <div class="pet-float-bonus" :class="{ paused: hunger <= 0 }">
          {{ hunger > 0 ? '+' + petStore.activeBonus + '%' : '暂停' }}
        </div>
      </div>
    </div>
    
    <!-- 无宠物时显示跳转按钮 -->
    <div v-else class="no-pet-section">
      <span class="no-pet-icon">🐾</span>
      <button class="go-pet-btn" @click.stop="goToPetPage">
        激活宠物
      </button>
    </div>
    
    <!-- 拖动手柄 -->
    <div class="drag-handle" @mousedown.stop="startDrag" @touchstart.stop="startDrag">
      <span>⠿</span>
    </div>
    
    <!-- 兑换面板 -->
    <teleport to="body">
      <transition name="fade">
        <div v-if="showExchange" class="exchange-overlay" @click.self="showExchange = false">
          <div class="exchange-panel">
            <div class="exchange-header">
              <h3>💱 货币兑换</h3>
              <button class="close-btn" @click="showExchange = false">✕</button>
            </div>
            <div class="exchange-body">
              <div class="exchange-row">
                <label>兑换方向</label>
                <select v-model="exchangeFrom" class="exchange-select">
                  <option v-for="opt in exchangeOptions" :key="opt.key" :value="opt.key">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div class="exchange-arrow">⬇️</div>
              <div class="exchange-row">
                <label>兑换数量</label>
                <input
                  v-model.number="exchangeAmount"
                  type="number"
                  min="1"
                  class="exchange-input"
                  :placeholder="exchangePlaceholder"
                />
              </div>
              <div class="exchange-preview" v-if="exchangePreview">
                <span>预计获得：</span>
                <span class="preview-value">{{ exchangePreview }}</span>
              </div>
              <div class="exchange-desc" v-if="exchangeDesc">{{ exchangeDesc }}</div>
              <button
                class="exchange-confirm"
                :disabled="!canExchange"
                @click="doExchange"
              >确认兑换</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePetStore } from '@/stores/petStore'
import { useUserStore } from '@/stores/userStore'

const petStore = usePetStore()
const userStore = useUserStore()
const router = useRouter()

const isDragging = ref(false)
const position = ref({ x: 20, y: 20 })
const dragOffset = ref({ x: 0, y: 0 })
const hunger = ref(100)
const showExchange = ref(false)
const exchangeFrom = ref('silver_coin->gold_coin')
const exchangeAmount = ref(1)

const visible = computed(() => {
  return router.currentRoute.value.path.startsWith('/dashboard')
})

const floatStyle = computed(() => ({
  right: `${position.value.x}px`,
  top: `${position.value.y}px`
}))

// 数值格式化（显示实际数字）
function formatNumber(n) {
  if (n === null || n === undefined) return '0'
  n = Number(n)
  return n.toLocaleString()
}

// 兑换选项
const exchangeOptions = [
  { key: 'silver_coin->gold_coin', label: '银币 → 金币 (100银币=1金币)' },
  { key: 'gold_coin->diamond', label: '金币 → 钻石 (100金币=1钻石)' },
  { key: 'gold_coin->silver_coin', label: '金币 → 银币 (1金币=95银币，5%损耗)' },
  { key: 'diamond->gold_coin', label: '钻石 → 金币 (1钻石=90金币，10%损耗)' }
]

const exchangeRules = {
  'silver_coin->gold_coin': { rate: 100, toKey: 'gold_coin' },
  'gold_coin->diamond': { rate: 100, toKey: 'diamond' },
  'gold_coin->silver_coin': { rate: 95, toKey: 'silver_coin' },
  'diamond->gold_coin': { rate: 90, toKey: 'gold_coin' }
}

const exchangePreview = computed(() => {
  const rule = exchangeRules[exchangeFrom.value]
  if (!rule || !exchangeAmount.value || exchangeAmount.value <= 0) return ''
  const isDowngrade = exchangeFrom.value === 'gold_coin->silver_coin' || exchangeFrom.value === 'diamond->gold_coin'
  const amount = isDowngrade
    ? exchangeAmount.value * rule.rate
    : Math.floor(exchangeAmount.value / rule.rate)
  const toName = { gold_coin: '金币', diamond: '钻石', silver_coin: '银币' }[rule.toKey]
  return `${amount} ${toName}`
})

const exchangeDesc = computed(() => {
  const opt = exchangeOptions.find(o => o.key === exchangeFrom.value)
  return opt ? opt.label : ''
})

// 兑换输入提示
const exchangePlaceholder = computed(() => {
  const names = { silver_coin: '银币', gold_coin: '金币', diamond: '钻石' }
  const [from, to] = exchangeFrom.value.split('->')
  const rule = exchangeRules[exchangeFrom.value]
  if (!rule) return '输入数量'
  const isUpgrade = from === 'silver_coin' || (from === 'gold_coin' && to === 'diamond')
  if (isUpgrade) {
    return `输入${names[from]}数量（最少${rule.rate}）`
  }
  return `输入${names[from]}数量以兑换${names[to]}`
})

const canExchange = computed(() => {
  if (exchangeAmount.value <= 0) return false
  
  const rule = exchangeRules[exchangeFrom.value]
  if (!rule) return false
  
  // 向上兑换需要满足最小数量（如 100银币→1金币）
  const isUpgrade = exchangeFrom.value === 'silver_coin->gold_coin' || exchangeFrom.value === 'gold_coin->diamond'
  if (isUpgrade && exchangeAmount.value < rule.rate) {
    return false
  }
  
  // 检查余额是否足够
  const [from] = exchangeFrom.value.split('->')
  const balance = userStore.currencies[from] || 0
  return exchangeAmount.value <= balance
})

function openExchange() {
  showExchange.value = true
}

async function doExchange() {
  const [from, to] = exchangeFrom.value.split('->')
  const result = await userStore.exchangeCurrency(from, to, exchangeAmount.value)
  if (result.success) {
    exchangeAmount.value = 1
    showExchange.value = false
  }
}

// 更新饱食度显示
let hungerTimer = null
function updateHunger() {
  if (!petStore.activePet) return
  const pet = petStore.activePet
  if (!pet.last_fed_at) {
    hunger.value = pet.hunger
    return
  }
  const lastFed = new Date(pet.last_fed_at).getTime()
  const now = Date.now()
  const hoursElapsed = (now - lastFed) / (1000 * 60 * 60)
  const decayed = Math.floor(hoursElapsed)
  hunger.value = Math.max(0, Math.min(100, pet.hunger - decayed))
}

function startDrag(e) {
  isDragging.value = true
  const touch = e.touches ? e.touches[0] : e
  dragOffset.value = {
    x: window.innerWidth - touch.clientX - position.value.x,
    y: touch.clientY - position.value.y
  }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag)
  document.addEventListener('touchend', stopDrag)
}

function onDrag(e) {
  if (!isDragging.value) return
  const touch = e.touches ? e.touches[0] : e
  const newX = window.innerWidth - touch.clientX - dragOffset.value.x
  const newY = touch.clientY - dragOffset.value.y
  position.value = {
    x: Math.max(0, Math.min(newX, window.innerWidth - 280)),
    y: Math.max(0, Math.min(newY, window.innerHeight - 120))
  }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
}

function handleClick() {
  // 点击悬浮框本身不跳转，只有点击按钮才跳转
}

function goToPetPage() {
  router.push('/dashboard/pets')
}

onMounted(async () => {
  try {
    await userStore.loadFromLocal()
    await petStore.loadActivePet()
    updateHunger()
    hungerTimer = setInterval(updateHunger, 60000) // 每分钟更新
  } catch (e) {
    console.error('PetFloating init error:', e)
  }
})

onUnmounted(() => {
  if (hungerTimer) clearInterval(hungerTimer)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
})

watch(() => petStore.activePet, () => {
  updateHunger()
})
</script>

<style scoped>
.pet-floating {
  position: fixed;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  padding: 10px 16px;
  padding-right: 32px;
  border-radius: 40px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.5);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  max-width: 90vw;
}

.pet-floating:hover {
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.pet-floating.dragging {
  cursor: grabbing;
  opacity: 0.9;
  transform: scale(1.03);
}

/* 用户信息区域 */
.user-section {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 8px;
  border-right: 1px solid rgba(0, 0, 0, 0.1);
}

.user-icon {
  font-size: 1.2rem;
}

.user-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}

/* 货币区域 */
.currency-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 8px;
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  flex-wrap: wrap;
}

.currency-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.currency-item:hover {
  background: rgba(76, 175, 80, 0.15);
  transform: scale(1.05);
}

.currency-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.currency-value {
  font-size: 0.8rem;
  font-weight: 700;
  color: #2e7d32;
  white-space: nowrap;
}

/* 宠物信息区域 */
.pet-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 无宠物状态区域 */
.no-pet-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
}

.no-pet-icon {
  font-size: 1.5rem;
}

.go-pet-btn {
  background: linear-gradient(135deg, #4caf50, #43a047);
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.go-pet-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.pet-float-icon {
  font-size: 1.8rem;
  animation: petBounce 3s ease-in-out infinite;
}

@keyframes petBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.pet-float-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 70px;
}

.pet-float-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}

.pet-float-level {
  font-size: 0.65rem;
  color: #888;
}

.pet-float-hunger {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mini-bar {
  flex: 1;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.mini-bar-fill {
  height: 100%;
  background: #4caf50;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.mini-bar-fill.mid {
  background: #ff9800;
}

.mini-bar-fill.low {
  background: #f44336;
}

.hunger-text {
  font-size: 0.6rem;
  color: #999;
  width: 28px;
  text-align: right;
}

.pet-float-bonus {
  font-size: 0.7rem;
  font-weight: 700;
  color: #4caf50;
}

.pet-float-bonus.paused {
  color: #f44336;
}

/* 拖动手柄 */
.drag-handle {
  position: absolute;
  right: -24px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 50px;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.25));
  border-radius: 0 12px 12px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #4caf50;
  cursor: grab;
  opacity: 0.5;
  transition: opacity 0.2s ease;
  border: 1px solid rgba(76, 175, 80, 0.2);
  border-left: none;
}

.drag-handle:hover {
  opacity: 1;
}

/* 兑换面板 */
.exchange-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10002;
}

.exchange-panel {
  background: linear-gradient(145deg, #fffef7, #f5f0e6);
  border-radius: 28px;
  padding: 28px;
  width: 90%;
  max-width: 400px;
  box-shadow: 
    0 25px 50px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.2);
  animation: panelScaleIn 0.3s ease-out;
}

@keyframes panelScaleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.exchange-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(76, 175, 80, 0.15);
}

.exchange-header h3 {
  margin: 0;
  color: #1e4d1e;
  font-size: 1.35rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-btn {
  background: rgba(0, 0, 0, 0.05);
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: #777;
  padding: 8px 12px;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.15);
  color: #333;
  transform: rotate(90deg);
}

.exchange-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.exchange-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.exchange-row label {
  font-size: 0.9rem;
  color: #4a5568;
  font-weight: 600;
  padding-left: 4px;
}

.exchange-select {
  padding: 14px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  font-size: 0.95rem;
  background: white;
  color: #2d3748;
  outline: none;
  transition: all 0.25s ease;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}

.exchange-select:hover {
  border-color: #a7f3a0;
}

.exchange-select:focus {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.exchange-input {
  padding: 14px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  font-size: 0.95rem;
  background: white;
  color: #2d3748;
  outline: none;
  transition: all 0.25s ease;
}

.exchange-input:hover {
  border-color: #a7f3a0;
}

.exchange-input:focus {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.exchange-input::-webkit-outer-spin-button,
.exchange-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.exchange-input[type=number] {
  -moz-appearance: textfield;
}

.exchange-arrow {
  text-align: center;
  font-size: 1.4rem;
  padding: 8px 0;
}

.exchange-preview {
  text-align: center;
  padding: 16px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.08));
  border-radius: 16px;
  font-size: 1rem;
  color: #4a5568;
  border: 1px solid rgba(34, 197, 94, 0.15);
}

.preview-value {
  color: #16a34a;
  font-weight: 700;
  font-size: 1.25rem;
  margin-left: 4px;
}

.exchange-desc {
  text-align: center;
  font-size: 0.85rem;
  color: #a0aec0;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 10px;
}

.exchange-confirm {
  padding: 16px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
}

.exchange-confirm:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(34, 197, 94, 0.4);
  background: linear-gradient(135deg, #22d36e, #16a34a);
}

.exchange-confirm:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}

.exchange-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .pet-floating {
    background: rgba(40, 40, 45, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .user-name {
    color: #e0e0e0;
  }

  .currency-item {
    background: rgba(255, 255, 255, 0.08);
  }

  .currency-item:hover {
    background: rgba(139, 195, 74, 0.15);
  }

  .currency-value {
    color: #81c784;
  }

  .user-section,
  .currency-section {
    border-right-color: rgba(255, 255, 255, 0.1);
  }

  .pet-float-name {
    color: #e0e0e0;
  }

  .pet-float-level {
    color: #aaa;
  }

  .mini-bar {
    background: #444;
  }

  .exchange-panel {
    background: rgba(30, 30, 25, 0.98);
    border-color: rgba(76, 175, 80, 0.3);
  }

  .exchange-header h3 {
    color: #8bc34a;
  }

  .close-btn {
    color: #aaa;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .exchange-row label {
    color: #aaa;
  }

  .exchange-select,
  .exchange-input {
    background: #2a2a2a;
    border-color: #555;
    color: #e0e0e0;
  }

  .exchange-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-size: 16px;
  }

  .exchange-select:focus,
  .exchange-input:focus {
    border-color: #4caf50;
  }

  .exchange-preview {
    background: rgba(76, 175, 80, 0.12);
    color: #ccc;
  }

  .preview-value {
    color: #81c784;
  }
}

@media (max-width: 600px) {
  .pet-floating {
    padding: 6px 10px;
    padding-right: 28px;
    gap: 6px;
    border-radius: 30px;
  }

  .user-section {
    display: none; /* 移动端隐藏用户名 */
  }

  .currency-section {
    border-right: none;
    padding-right: 0;
    gap: 4px;
  }

  .currency-item {
    padding: 3px 6px;
  }

  .currency-icon {
    width: 16px;
    height: 16px;
  }

  .currency-value {
    font-size: 0.75rem;
  }

  .pet-float-icon {
    font-size: 1.5rem;
  }

  .pet-float-info {
    min-width: 50px;
  }

  .pet-float-name {
    font-size: 0.7rem;
  }

  .pet-float-level {
    font-size: 0.6rem;
  }

  .drag-handle {
    right: -20px;
    width: 20px;
    height: 40px;
  }
}
</style>

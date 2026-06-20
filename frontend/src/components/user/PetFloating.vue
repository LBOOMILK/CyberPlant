<template>
  <!-- 移动端顶部状态栏（窄屏显示，宽屏隐藏） -->
  <!-- 收起状态：宠物图标+加成+银币 -->
  <div v-if="visible && !topbarExpanded" class="pet-topbar pet-topbar-collapsed" @click.stop="topbarExpanded = true">
    <div class="topbar-collapsed-currencies">
      <div class="topbar-collapsed-coin-item" @click.stop="openExchange">
        <img src="/silver_icon.png" alt="银币" class="topbar-collapsed-coin" />
        <span class="topbar-collapsed-value">{{ formatNumber(userStore.currencies.silver_coin) }}</span>
      </div>
      <div class="topbar-collapsed-coin-item" @click.stop="openExchange">
        <img src="/gold_icon.png" alt="金币" class="topbar-collapsed-coin" />
        <span class="topbar-collapsed-value">{{ formatNumber(userStore.currencies.gold_coin) }}</span>
      </div>
      <div class="topbar-collapsed-coin-item" @click.stop="openExchange">
        <img src="/diamond.png" alt="钻石" class="topbar-collapsed-coin" />
        <span class="topbar-collapsed-value">{{ formatNumber(userStore.currencies.diamond) }}</span>
      </div>
    </div>
    <div class="topbar-collapsed-right">
      <span class="topbar-collapsed-icon">{{ petStore.activePet?.icon || '🐾' }}</span>
      <span v-if="petStore.hasActivePet" class="topbar-collapsed-bonus" :class="{ paused: hunger <= 0 }">
        {{ hunger > 0 ? '+' + petStore.activeBonus + '%' : '暂停' }}
      </span>
      <span v-else class="topbar-collapsed-bonus">激活</span>
    </div>
    <span class="topbar-expand-arrow" @click.stop="topbarExpanded = true">⬇</span>
  </div>

  <!-- 展开状态：完整信息 -->
  <teleport to="body">
    <transition name="topbar-slide">
      <div v-if="visible && topbarExpanded" class="pet-topbar pet-topbar-expanded">
        <!-- 关闭按钮 -->
        <button class="topbar-close" @click.stop="topbarExpanded = false">⬆</button>

        <!-- 宠物信息区 -->
        <div class="topbar-pet-row">
          <div v-if="petStore.hasActivePet" class="topbar-pet-info">
            <div ref="topbarEffectContainer" class="topbar-effect-container"></div>
            <span class="topbar-pet-icon-lg">{{ petStore.activePet?.icon || '🐾' }}</span>
            <div class="topbar-pet-detail">
              <span class="topbar-pet-name">{{ petStore.activePet?.name || '宠物' }} Lv.{{ petStore.activePet?.level }}</span>
              <span class="topbar-pet-bonus-text" :class="{ paused: hunger <= 0 }">
                {{ hunger > 0 ? '加成 +' + petStore.activeBonus + '%' : '已暂停' }}
              </span>
            </div>
          </div>
          <div v-else class="topbar-pet-info" @click.stop="goToPetPage">
            <span class="topbar-pet-icon-lg">🐾</span>
            <span class="topbar-pet-name">点击激活宠物</span>
          </div>
          <!-- 饥饿条 -->
          <div v-if="petStore.hasActivePet" class="topbar-hunger-bar">
            <div class="topbar-hunger-label">饱食 {{ hunger }}%</div>
            <div class="topbar-hunger-track">
              <div class="topbar-hunger-fill" :class="{ low: hunger < 20 }" :style="{ width: hunger + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- 货币区 -->
        <div class="topbar-currencies-row">
          <div class="topbar-currency-chip" @click.stop="openExchange">
            <img src="/silver_icon.png" alt="银币" class="topbar-chip-icon" />
            <span class="topbar-chip-value">{{ formatNumber(userStore.currencies.silver_coin) }}</span>
          </div>
          <div class="topbar-currency-chip" @click.stop="openExchange">
            <img src="/gold_icon.png" alt="金币" class="topbar-chip-icon" />
            <span class="topbar-chip-value">{{ formatNumber(userStore.currencies.gold_coin) }}</span>
          </div>
          <div class="topbar-currency-chip" @click.stop="openExchange">
            <img src="/diamond.png" alt="钻石" class="topbar-chip-icon" />
            <span class="topbar-chip-value">{{ formatNumber(userStore.currencies.diamond) }}</span>
          </div>
        </div>
      </div>
    </transition>
    <!-- 遮罩层 -->
    <div v-if="visible && topbarExpanded" class="topbar-overlay" @click.stop="topbarExpanded = false"></div>
  </teleport>

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
      <div class="pet-float-icon-wrapper">
        <div ref="effectContainer" class="effect-container"></div>
        <div class="pet-float-icon">{{ petStore.activePet?.icon || '🐾' }}</div>
      </div>
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
                <div class="custom-select" @click.stop="selectOpen = !selectOpen">
                  <div class="select-display">
                    <span>{{ currentOptionLabel }}</span>
                    <span class="select-arrow" :class="{ open: selectOpen }">▾</span>
                  </div>
                  <div v-if="selectOpen" class="select-dropdown">
                    <div
                      v-for="opt in exchangeOptions"
                      :key="opt.key"
                      class="select-option"
                      :class="{ active: exchangeFrom === opt.key }"
                      @click.stop="exchangeFrom = opt.key; selectOpen = false"
                    >
                      {{ opt.label }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="exchange-arrow">⬇️</div>
              <div class="exchange-row">
                <label>{{ exchangeLabel }}</label>
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePetStore } from '@/stores/petStore'
import { useUserStore } from '@/stores/userStore'
import { loadEffect } from '@/effects'

const petStore = usePetStore()
const userStore = useUserStore()
const router = useRouter()

const isDragging = ref(false)
const position = ref({ x: 20, y: 20 })
const dragOffset = ref({ x: 0, y: 0 })
const hunger = ref(100)
const effectContainer = ref(null)
const topbarEffectContainer = ref(null)
const topbarExpanded = ref(false)
let currentEffectInstance = null
let topbarEffectInstance = null

// 宠物名到特效名的映射
const petEffectMap = {
  '泡泡鱼': 'bubble-fish',
  '小豆猫': 'cat-paw',
  '星光兔': 'star-rabbit',
  '雷霆鹰': 'thunder-eagle',
  '水晶龙': 'crystal-dragon',
  'LBOOKTest': 'lbooktest'
}

function getEffectName(pet) {
  if (!pet) return null
  return pet.effect_file || petEffectMap[pet.name] || null
}

function loadPetEffect() {
  // 销毁旧特效
  if (currentEffectInstance) {
    currentEffectInstance.destroy()
    currentEffectInstance = null
  }
  if (!effectContainer.value || !petStore.activePet) return
  effectContainer.value.innerHTML = ''
  const equippedSpecial = petStore.activePet.equipped_decorations?.special
  if (!equippedSpecial) return
  const effectName = getEffectName(petStore.activePet)
  if (!effectName) return
  const effect = loadEffect(effectName)
  if (effect) {
    currentEffectInstance = effect.init(effectContainer.value, {
      level: petStore.activePet.level,
      bonus: petStore.activePet.current_bonus
    })
  }
}

function loadTopbarEffect() {
  if (topbarEffectInstance) {
    topbarEffectInstance.destroy()
    topbarEffectInstance = null
  }
  if (!topbarEffectContainer.value || !petStore.activePet) return
  topbarEffectContainer.value.innerHTML = ''
  const equippedSpecial = petStore.activePet.equipped_decorations?.special
  if (!equippedSpecial) return
  const effectName = getEffectName(petStore.activePet)
  if (!effectName) return
  const effect = loadEffect(effectName)
  if (effect) {
    topbarEffectInstance = effect.init(topbarEffectContainer.value, {
      level: petStore.activePet.level,
      bonus: petStore.activePet.current_bonus
    })
  }
}
const showExchange = ref(false)
const exchangeFrom = ref('silver_coin->gold_coin')
const exchangeAmount = ref(1)
const selectOpen = ref(false)

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

// 当前选项显示文本
const currentOptionLabel = computed(() => {
  const opt = exchangeOptions.find(o => o.key === exchangeFrom.value)
  return opt ? opt.label : '选择兑换方向'
})

// 动态兑换数量标签
const exchangeLabel = computed(() => {
  const names = { silver_coin: '银币', gold_coin: '金币', diamond: '钻石' }
  const [from, to] = exchangeFrom.value.split('->')
  return `填入使用${names[from]}的数量以兑换${names[to]}`
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
  if (e.cancelable) e.preventDefault()
  const touch = e.touches ? e.touches[0] : e
  dragOffset.value = {
    x: window.innerWidth - touch.clientX - position.value.x,
    y: touch.clientY - position.value.y
  }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag, { passive: false })
  document.addEventListener('touchend', stopDrag)
}

function onDrag(e) {
  if (!isDragging.value) return
  if (e.cancelable) e.preventDefault()
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
    document.addEventListener('click', closeSelect)
    await nextTick()
    loadPetEffect()
  } catch (e) {
    console.error('PetFloating init error:', e)
  }
})

onUnmounted(() => {
  if (hungerTimer) clearInterval(hungerTimer)
  if (currentEffectInstance) {
    currentEffectInstance.destroy()
    currentEffectInstance = null
  }
  if (topbarEffectInstance) {
    topbarEffectInstance.destroy()
    topbarEffectInstance = null
  }
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
  document.removeEventListener('click', closeSelect)
})

function closeSelect() {
  selectOpen.value = false
}

watch(() => petStore.activePet, async () => {
  updateHunger()
  await nextTick()
  loadPetEffect()
})

// 装备变化时重新加载特效
watch(() => petStore.activePet?.equipped_decorations, async () => {
  await nextTick()
  loadPetEffect()
}, { deep: true })

// topbar 展开时加载特效
watch(topbarExpanded, async (val) => {
  if (val) {
    await nextTick()
    loadTopbarEffect()
  } else {
    if (topbarEffectInstance) {
      topbarEffectInstance.destroy()
      topbarEffectInstance = null
    }
  }
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

.pet-float-icon-wrapper {
  position: relative;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.effect-container {
  position: absolute;
  top: -20px;
  left: -20px;
  right: -20px;
  bottom: -20px;
  pointer-events: none;
  overflow: visible;
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

/* 拖动手柄 - 放在悬浮窗边缘右侧中间 */
.drag-handle {
  position: absolute;
  top: 50%;
  right: -28px;
  transform: translateY(-50%);
  width: 28px;
  height: 60px;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(76, 175, 80, 0.3));
  border-radius: 0 12px 12px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #4caf50;
  cursor: grab;
  opacity: 0.7;
  transition: all 0.2s ease;
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-left: none;
  z-index: 10;
}

.drag-handle:hover {
  opacity: 1;
}

/* ========== 宽屏悬浮窗样式（桌面端/平板） ========== */
@media (min-width: 768px) {
  .pet-floating {
    display: flex;
  }
  .pet-topbar {
    display: none;
  }
}

/* ========== 窄屏 topbar 样式（移动端） ========== */
.pet-topbar {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  align-items: center;
}

/* 收起状态 */
.pet-topbar-collapsed {
  display: none;
  height: 40px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 248, 0.95));
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(76, 175, 80, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 0 12px;
  gap: 8px;
  justify-content: space-between;
  cursor: pointer;
}

.topbar-collapsed-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.topbar-collapsed-icon {
  font-size: 1.1rem;
}

.topbar-collapsed-bonus {
  font-size: 0.7rem;
  font-weight: 700;
  color: #4caf50;
}

.topbar-collapsed-bonus.paused {
  color: #f44336;
}

.topbar-collapsed-currencies {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.topbar-collapsed-coin-item {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  background: rgba(76, 175, 80, 0.08);
  border-radius: 10px;
  cursor: pointer;
}

.topbar-collapsed-coin {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.topbar-collapsed-value {
  font-size: 0.7rem;
  font-weight: 700;
  color: #333;
}

.topbar-expand-arrow {
  font-size: 0.85rem;
  color: #779778;
  font-weight: 700;
  margin-left: 10px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(76, 175, 80, 0.08);
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
}

/* 展开状态 */
.pet-topbar-expanded {
  display: none;
  flex-direction: column;
  padding: 12px 16px 16px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 248, 0.98));
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(76, 175, 80, 0.2);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  gap: 12px;
}

.topbar-close {
  position: absolute;
  top: 8px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(76, 175, 80, 0.1);
  border-radius: 50%;
  font-size: 1rem;
  color: #4caf50;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.topbar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 998;
}

/* 展开动画 */
.topbar-slide-enter-active,
.topbar-slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.topbar-slide-enter-from,
.topbar-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* 宠物信息行 */
.topbar-pet-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.topbar-pet-info {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}

.topbar-effect-container {
  position: absolute;
  top: -8px;
  left: -8px;
  right: -8px;
  bottom: -8px;
  pointer-events: none;
  overflow: hidden;
  border-radius: 12px;
}

.topbar-pet-icon-lg {
  font-size: 2rem;
  line-height: 1;
  position: relative;
}

.topbar-pet-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.topbar-pet-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
}

.topbar-pet-bonus-text {
  font-size: 0.8rem;
  font-weight: 700;
  color: #4caf50;
}

.topbar-pet-bonus-text.paused {
  color: #f44336;
}

/* 饥饿条 */
.topbar-hunger-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topbar-hunger-label {
  font-size: 0.7rem;
  color: #888;
}

.topbar-hunger-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 4px;
  overflow: hidden;
}

.topbar-hunger-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff9800, #4caf50);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.topbar-hunger-fill.low {
  background: #f44336;
}

/* 货币行 */
.topbar-currencies-row {
  display: flex;
  gap: 8px;
}

.topbar-currency-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  justify-content: center;
}

.topbar-currency-chip:active {
  background: rgba(76, 175, 80, 0.12);
  transform: scale(0.97);
}

.topbar-chip-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.topbar-chip-value {
  font-size: 0.85rem;
  font-weight: 700;
  color: #333;
}

@media (max-width: 767px) {
  .pet-floating {
    display: none;
  }
  .pet-topbar-collapsed,
  .pet-topbar-expanded {
    display: flex;
  }
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

/* 自定义下拉选择框 */
.custom-select {
  position: relative;
  cursor: pointer;
}

.select-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  font-size: 0.95rem;
  background: white;
  color: #2d3748;
  transition: all 0.25s ease;
}

.select-display:hover {
  border-color: #a7f3a0;
}

.select-arrow {
  font-size: 1rem;
  transition: transform 0.2s ease;
}

.select-arrow.open {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 100;
  overflow: hidden;
  animation: dropdownFade 0.15s ease;
}

@keyframes dropdownFade {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.select-option {
  padding: 12px 16px;
  font-size: 0.9rem;
  color: #2d3748;
  transition: all 0.15s ease;
}

.select-option:hover {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.select-option.active {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
  font-weight: 600;
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

  .custom-select .select-display,
  .exchange-input {
    background: #2a2a2a;
    border-color: #555;
    color: #e0e0e0;
  }

  .custom-select .select-dropdown {
    background: #2a2a2a;
    border-color: #555;
  }

  .custom-select .select-option {
    color: #e0e0e0;
  }

  .custom-select .select-option:hover {
    background: rgba(76, 175, 80, 0.2);
    color: #81c784;
  }

  .custom-select .select-option.active {
    background: rgba(76, 175, 80, 0.25);
    color: #81c784;
  }

  .custom-select .select-display:hover,
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

@media (prefers-color-scheme: dark) {
  .pet-topbar-collapsed {
    background: linear-gradient(135deg, rgba(40, 40, 40, 0.95), rgba(50, 50, 50, 0.95));
    border-bottom: 1px solid rgba(76, 175, 80, 0.3);
  }
  .pet-topbar-expanded {
    background: linear-gradient(135deg, rgba(30, 30, 30, 0.98), rgba(40, 40, 40, 0.98));
    border-bottom: 1px solid rgba(76, 175, 80, 0.3);
  }
  .topbar-collapsed-coin-item {
    background: rgba(76, 175, 80, 0.15);
  }
  .topbar-collapsed-value {
    color: #eee;
  }
  .topbar-pet-name {
    color: #eee;
  }
  .topbar-hunger-label {
    color: #aaa;
  }
  .topbar-hunger-track {
    background: rgba(255, 255, 255, 0.1);
  }
  .topbar-currency-chip {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }
  .topbar-chip-value {
    color: #eee;
  }
  .topbar-close {
    background: rgba(76, 175, 80, 0.15);
    color: #81c784;
  }
  .topbar-expand-arrow {
    background: rgba(76, 175, 80, 0.15);
    color: #81c784;
  }
}
</style>

<!-- 全局特效关键帧（非 scoped，供动态创建的特效元素使用） -->
<style>
@keyframes bubbleUp {
  0% { transform: translateY(0) scale(1); opacity: 0.8; }
  50% { transform: translateY(-30px) scale(1.3); opacity: 0.3; }
  100% { transform: translateY(-60px) scale(0.8); opacity: 0; }
}

@keyframes pawFade {
  0% { opacity: 0; transform: scale(0.4) rotate(0deg); }
  25% { opacity: 0.9; transform: scale(1.0) rotate(-8deg); }
  50% { opacity: 0.7; transform: scale(1.15) rotate(5deg); }
  75% { opacity: 0.3; transform: scale(0.9) rotate(12deg); }
  100% { opacity: 0; transform: scale(0.4) rotate(20deg); }
}

@keyframes sparkleDrift {
  0% { transform: translate(0,0) scale(0); opacity: 0; }
  20% { transform: translate(var(--sx), var(--sy)) scale(1); opacity: 1; }
  100% { transform: translate(calc(var(--sx)*3), calc(var(--sy)*3)) scale(0); opacity: 0; }
}

@keyframes boltFlash {
  0%, 100% { opacity: 0; transform: scale(0.3) rotate(-15deg); }
  30% { opacity: 1; transform: scale(1.3) rotate(8deg); }
  60% { opacity: 0.6; transform: scale(0.7) rotate(-5deg); }
}

@keyframes pixelBlink {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; box-shadow: 0 0 6px #00ff88; }
}

@keyframes ringPulse {
  0% { transform: scale(0.5); opacity: 0; }
  50% { opacity: 0.6; }
  100% { transform: scale(1.8); opacity: 0; }
}
</style>

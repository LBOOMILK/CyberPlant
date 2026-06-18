<template>
  <div class="garden-page">
    <Toast ref="toastRef" />

    <!-- AI 助手入口 -->
    <button class="ai-chat-btn" @click="showAIChat = true" title="AI 助手">🤖</button>

    <!-- 手册入口 -->
    <button class="handbook-btn" @click="showHandbook = true" title="花园手册">?</button>

    <div class="card">
      <h1>🌱 赛博花园</h1>

      <div v-if="plotStore.loading && plotStore.plots.length === 0" class="loading-state">
        <div class="loading-spinner">⏳</div>
        <p>加载中...</p>
      </div>

      <div v-else class="plots-grid">
        <div
          v-for="plot in plotStore.plots"
          :key="plot.plot_index"
          class="plot-card"
          :class="{
            'plot-locked': !plot.is_unlocked,
            'plot-empty': plot.is_unlocked && !plot.seed_id,
            'plot-plant': plot.is_unlocked && plot.seed_id && plot.stage < 4,
            'plot-mature': plot.is_unlocked && plot.seed_id && plot.stage >= 4,
            'plot-glow-lv4': plot.level === 4,
            'plot-glow-lv5': plot.level >= 5
          }"
          :style="{ borderColor: plot.is_unlocked ? plotStore.levelColors[plot.level] : '#6B7280' }"
          @click="handlePlotClick(plot)"
        >
          <!-- 地块编号 -->
          <div class="plot-header">
            <span class="plot-index">#{{ plot.plot_index }}</span>
          </div>

          <!-- 未解锁状态 -->
          <div v-if="!plot.is_unlocked" class="plot-body locked-body">
            <div class="lock-icon">🔒</div>
            <div class="unlock-cost" v-if="plotStore.unlockCosts[plot.plot_index]">
              <img :src="plotStore.unlockCosts[plot.plot_index].icon" class="price-icon" />
              {{ plotStore.unlockCosts[plot.plot_index].label }}
            </div>
            <button class="unlock-btn" @click.stop="handleUnlock(plot.plot_index)">解锁</button>
          </div>

          <!-- 空地状态 -->
          <div v-else-if="!plot.seed_id" class="plot-body empty-body">
            <div class="empty-icon">🌾</div>
            <div class="empty-text">点击种植</div>
          </div>

          <!-- 有植物状态 -->
          <div v-else class="plot-body plant-body">
            <div class="plant-icon">{{ plot.stage_icon }}</div>
            <div class="plant-name">{{ plot.crop?.name || '未知' }}</div>
            <div v-if="plot.is_dead" class="dead-indicator">💀 已死亡</div>
            <div v-else class="progress-container">
              <div class="progress-bar">
                <!-- 干涸进度条（红色背景） -->
                <div class="dry-progress" :style="{ width: getDryProgress(plot) + '%' }"></div>
                <!-- 绿色浇水进度条 -->
                <div class="water-progress" :style="{ width: getProgress(plot) + '%' }"></div>
              </div>
              <div class="time-info">
                <div class="water-time">💧 {{ getStageProgressText(plot) }}</div>
                <div class="dry-time" :class="{ warning: getDryProgress(plot) > 80 }">⚠️ {{ getDryTimeText(plot) }}</div>
              </div>
            </div>
          </div>

          <!-- 等级和倍率标签 -->
          <div v-if="plot.is_unlocked" class="plot-tags">
            <span class="level-tag" :style="{ color: plotStore.levelColors[plot.level] }">Lv.{{ plot.level }}</span>
            <span class="multiplier-tag">{{ plot.multiplier }}x</span>
          </div>
        </div>
      </div>

      <footer>🌸 点击地块查看详情 | 升级地块提高产出</footer>
    </div>

    <!-- 种植选择弹窗 -->
    <PlantSelectModal
      :visible="showPlantSelect"
      :seeds="userSeeds"
      @close="showPlantSelect = false"
      @plant="handlePlant"
    />

    <!-- 地块详情弹窗 -->
    <PlotModal
      :visible="showPlotModal"
      :plot="selectedPlot"
      @close="showPlotModal = false"
      @water="handleWater"
      @fertilize="openFertilizeSelect"
      @harvest="handleHarvest"
      @remove="handleRemove"
      @upgrade="openUpgradeModal"
      @plant="handlePlotPlant"
    />

    <!-- 升级弹窗 -->
    <UpgradeModal
      :visible="showUpgradeModal"
      :plot="selectedPlot"
      @close="showUpgradeModal = false"
      @upgrade="handleUpgrade"
    />

    <!-- 施肥选择弹窗 -->
    <PlantSelectModal
      :visible="showFertilizeSelect"
      :seeds="userFertilizers"
      @close="showFertilizeSelect = false"
      @plant="handleFertilize"
    />

    <!-- AI 对话弹窗 -->
    <AIChatModal :visible="showAIChat" @close="showAIChat = false" />

    <!-- 手册弹窗 -->
    <HandbookModal :visible="showHandbook" @close="showHandbook = false" />

    <!-- 铲除确认弹窗 -->
    <ConfirmModal
      :visible="showRemoveConfirm"
      title="铲除作物"
      :message="`确定铲除 ${selectedPlot?.crop?.name || '作物'}？已投入的种子和肥料不会返还`"
      icon="🗑️"
      confirm-text="确认铲除"
      cancel-text="取消"
      :danger="true"
      @confirm="doRemove"
      @cancel="showRemoveConfirm = false"
    />

    <!-- 肥料确认弹窗 -->
    <ConfirmModal
      :visible="showFertilizeConfirm"
      title="使用肥料"
      :message="`确认对 ${selectedPlot?.crop?.name || '作物'} 使用 ${pendingFertilizer?.name || '肥料'}？每株仅可使用一次`"
      icon="🧪"
      confirm-text="确认使用"
      cancel-text="取消"
      @confirm="doFertilize"
      @cancel="showFertilizeConfirm = false; pendingFertilizer = null"
    />

    <!-- 解锁地块确认弹窗 -->
    <ConfirmModal
      :visible="showUnlockConfirm"
      title="解锁地块"
      :message="`花费 ${plotStore.unlockCosts[pendingUnlockIndex]?.label || ''} 解锁地块 #${pendingUnlockIndex}？`"
      icon="🔓"
      confirm-text="确认解锁"
      cancel-text="取消"
      @confirm="doUnlock"
      @cancel="showUnlockConfirm = false; pendingUnlockIndex = null"
    />

    <!-- 背包满提示 -->
    <ConfirmModal
      :visible="showBackpackFull"
      title="背包已满"
      message="背包已满，请先清理后再收获"
      icon="📦"
      confirm-text="确定"
      cancel-text=""
      @confirm="showBackpackFull = false"
      @cancel="showBackpackFull = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { usePlotStore } from '@/stores/plotStore'
import { useUserStore } from '@/stores/userStore'
import { useShopStore } from '@/stores/shopStore'
import Toast from '@/components/common/Toast.vue'
import PlantSelectModal from '@/components/user/PlantSelectModal.vue'
import PlotModal from '@/components/user/PlotModal.vue'
import UpgradeModal from '@/components/user/UpgradeModal.vue'
import AIChatModal from '@/components/user/AIChatModal.vue'
import HandbookModal from '@/components/user/HandbookModal.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const plotStore = usePlotStore()
const userStore = useUserStore()
const shopStore = useShopStore()
const toastRef = ref(null)

const showPlantSelect = ref(false)
const showPlotModal = ref(false)
const showUpgradeModal = ref(false)
const showFertilizeSelect = ref(false)
const showAIChat = ref(false)
const showHandbook = ref(false)
const showRemoveConfirm = ref(false)
const showFertilizeConfirm = ref(false)
const showUnlockConfirm = ref(false)
const showBackpackFull = ref(false)
const pendingFertilizer = ref(null)
const pendingUnlockIndex = ref(null)
const selectedPlot = ref(null)
const selectedPlotIndex = ref(null)
const userSeeds = ref([])
const userFertilizers = ref([])
let refreshTimer = null

function addToast(message, type = 'info') {
  if (toastRef.value) toastRef.value.addToast(message, type)
}

function getStageName(stage) {
  return ['种子', '发芽', '出叶', '初熟', '成熟'][stage] || '未知'
}

function getStageProgressText(plot) {
  if (!plot.crop || !plot.planted_at) return ''
  if (plot.stage >= 4) return '已成熟'
  const waterCd = plot.crop.water_cd || 5 // 浇水冷却时间
  const elapsed = (Date.now() - new Date(plot.planted_at).getTime()) / 1000
  const remaining = Math.max(0, Math.ceil(waterCd - elapsed))
  if (remaining <= 0) return '可以浇水'
  if (remaining < 60) return `${remaining}秒后可浇水`
  return `${Math.floor(remaining / 60)}分${remaining % 60}秒后可浇水`
}

function getDryTimeText(plot) {
  if (!plot.crop || !plot.planted_at) return ''
  if (plot.stage >= 4) return '不会干涸'
  if (plot.is_dead) return '已死亡'
  const dryTime = 180 // 干涸死亡时间固定3分钟
  const elapsed = (Date.now() - new Date(plot.planted_at).getTime()) / 1000
  const remaining = Math.max(0, Math.ceil(dryTime - elapsed))
  if (remaining <= 0) return '即将死亡！'
  if (remaining < 60) return `${remaining}秒后干涸`
  return `${Math.floor(remaining / 60)}分${remaining % 60}秒后干涸`
}

function getProgress(plot) {
  if (!plot.crop) return 0
  if (plot.stage >= 4) return 100
  if (!plot.planted_at) return 0
  const waterCd = plot.crop.water_cd || 5 // 浇水冷却时间
  const elapsed = (Date.now() - new Date(plot.planted_at).getTime()) / 1000
  return Math.min(100, Math.max(0, (elapsed / waterCd) * 100))
}

function getDryProgress(plot) {
  if (!plot.crop || !plot.planted_at) return 0
  if (plot.stage >= 4) return 0 // 成熟后不再干涸
  const dryTime = 180 // 干涸死亡时间固定3分钟
  const elapsed = (Date.now() - new Date(plot.planted_at).getTime()) / 1000
  return Math.min(100, Math.max(0, (elapsed / dryTime) * 100))
}

function handlePlotClick(plot) {
  if (!plot.is_unlocked) return
  selectedPlot.value = plot
  selectedPlotIndex.value = plot.plot_index
  showPlotModal.value = true
}

async function openPlantSelect(plotIndex) {
  selectedPlotIndex.value = plotIndex
  await loadUserSeeds()
  if (userSeeds.value.length === 0) {
    addToast('背包里没有种子，去商城购买吧', 'warning')
    return
  }
  showPlantSelect.value = true
}

async function loadUserSeeds() {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/user/backpack`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      const groups = data.groups || {}
      userSeeds.value = groups.seed || []
      userFertilizers.value = groups.fertilizer || []
    } else {
      userSeeds.value = []
      userFertilizers.value = []
    }
  } catch (error) {
    console.error('Failed to load seeds:', error)
    userSeeds.value = []
    userFertilizers.value = []
  }
}

async function handleUnlock(plotIndex) {
  pendingUnlockIndex.value = plotIndex
  showUnlockConfirm.value = true
}

async function doUnlock() {
  const plotIndex = pendingUnlockIndex.value
  showUnlockConfirm.value = false
  pendingUnlockIndex.value = null
  try {
    const data = await plotStore.unlockPlot(plotIndex)
    if (data.currencies) {
      userStore.currencies.silver_coin = Number(data.currencies.silver_coin) || 0
      userStore.currencies.gold_coin = Number(data.currencies.gold_coin) || 0
      userStore.currencies.diamond = Number(data.currencies.diamond) || 0
    }
    addToast('🔓 地块解锁成功！', 'success')
  } catch (error) {
    addToast(error.message, 'error')
  }
}

async function handlePlant(seed) {
  showPlantSelect.value = false
  try {
    const data = await plotStore.plant(selectedPlotIndex.value, seed.item_id)
    await userStore.loadCurrencies()
    addToast(`🌱 种植成功！${data.crop?.name || ''}`, 'success')
    // Refresh selected plot
    selectedPlot.value = plotStore.plots.find(p => p.plot_index === selectedPlotIndex.value)
  } catch (error) {
    addToast(error.message, 'error')
  }
}

async function handleWater() {
  try {
    const data = await plotStore.water(selectedPlot.value.plot_index)
    await userStore.loadCurrencies()
    if (data.is_mature) {
      addToast('🎉 植物成熟了！可以收获了', 'success')
    } else {
      addToast('💧 浇水成功', 'success')
    }
    selectedPlot.value = plotStore.plots.find(p => p.plot_index === selectedPlot.value.plot_index)
  } catch (error) {
    addToast(error.message, 'error')
  }
}

function openFertilizeSelect() {
  loadUserSeeds().then(() => {
    if (userFertilizers.value.length === 0) {
      addToast('背包里没有肥料', 'warning')
      return
    }
    showFertilizeSelect.value = true
  })
}

async function handleFertilize(fertilizer) {
  showFertilizeSelect.value = false
  pendingFertilizer.value = fertilizer
  showFertilizeConfirm.value = true
}

async function doFertilize() {
  const fertilizer = pendingFertilizer.value
  showFertilizeConfirm.value = false
  pendingFertilizer.value = null
  if (!fertilizer || !selectedPlot.value) return
  try {
    const data = await plotStore.fertilize(selectedPlot.value.plot_index, fertilizer.item_id)
    await userStore.loadCurrencies()
    if (data.is_mature) {
      addToast('🎉 植物成熟了！', 'success')
    } else {
      addToast(`🧪 施肥成功！加速 ${data.boost}`, 'success')
    }
    selectedPlot.value = plotStore.plots.find(p => p.plot_index === selectedPlot.value.plot_index)
  } catch (error) {
    addToast(error.message, 'error')
  }
}

async function handleHarvest() {
  try {
    const data = await plotStore.harvest(selectedPlot.value.plot_index)
    await userStore.loadCurrencies()
    await shopStore.loadBackpack()
    showPlotModal.value = false
    const itemInfo = data.item_reward ? `${data.item_reward.icon}${data.item_reward.name}×${data.item_reward.quantity}` : ''
    let toastMsg = `🏆 收获成功！获得 ${itemInfo}`
    if (data.bonus_yield > 0) toastMsg += ` 🍀幸运多得+${data.bonus_yield}`
    if (data.sss_drop) toastMsg += ` ✨获得SSS种子:${data.sss_drop.icon}`
    addToast(toastMsg, 'success')
  } catch (error) {
    if (error.message && error.message.includes('背包已满')) {
      showBackpackFull.value = true
    } else {
      addToast(error.message, 'error')
    }
  }
}

async function handleRemove() {
  showRemoveConfirm.value = true
}

async function doRemove() {
  showRemoveConfirm.value = false
  try {
    await plotStore.remove(selectedPlot.value.plot_index)
    showPlotModal.value = false
    addToast('🗑️ 铲除成功', 'info')
  } catch (error) {
    addToast(error.message, 'error')
  }
}

function handlePlotPlant() {
  showPlotModal.value = false
  openPlantSelect(selectedPlot.value.plot_index)
}

function openUpgradeModal() {
  showPlotModal.value = false
  selectedPlot.value = plotStore.plots.find(p => p.plot_index === selectedPlot.value?.plot_index)
  showUpgradeModal.value = true
}

async function handleUpgrade() {
  try {
    const data = await plotStore.upgradePlot(selectedPlot.value.plot_index)
    if (data.currencies) {
      userStore.currencies.silver_coin = Number(data.currencies.silver_coin) || 0
      userStore.currencies.gold_coin = Number(data.currencies.gold_coin) || 0
      userStore.currencies.diamond = Number(data.currencies.diamond) || 0
    }
    showUpgradeModal.value = false
    addToast(`⬆️ 升级成功！Lv.${data.level} (${data.multiplier}x)`, 'success')
  } catch (error) {
    addToast(error.message, 'error')
  }
}

onMounted(async () => {
  try {
    await userStore.loadFromLocal()
  } catch (error) {
    console.error('Failed to load user:', error)
    addToast(error.message || '加载用户信息失败', 'error')
    return
  }

  try {
    await plotStore.loadPlotCosts()
  } catch (error) {
    console.error('Failed to load plot costs:', error)
    addToast(error.message || '加载地块费用失败', 'error')
  }

  try {
    await plotStore.loadPlots()
    refreshTimer = setInterval(() => {
      plotStore.plots = [...plotStore.plots]
    }, 1000)
  } catch (error) {
    console.error('Failed to load plots:', error)
    addToast(error.message || '加载地块信息失败', 'error')
  }
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.garden-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
  padding: 20px;
  padding-top: 56px;
}

.card {
  background: rgba(255, 248, 235, 0.98);
  border-radius: 32px;
  padding: 28px 24px 36px;
  max-width: 640px;
  width: 100%;
  box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
  text-align: center;
}

@media (min-width: 900px) {
  .card {
    max-width: 900px;
    padding: 32px 30px 40px;
  }
}

@media (min-width: 1200px) {
  .card {
    max-width: 1250px;
    padding: 36px 36px 44px;
  }
}

h1 {
  font-size: 1.9rem;
  margin: 0 0 20px 0;
  color: #2c5a2a;
}

.loading-state {
  padding: 40px;
  color: #888;
}

.loading-spinner {
  font-size: 48px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 地块网格 */
.plots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}

@media (min-width: 900px) {
  .plots-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
}

@media (min-width: 1200px) {
  .plots-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 28px;
  }
}

/* 地块卡片 */
.plot-card {
  position: relative;
  border: 3px solid #9CA3AF;
  border-radius: 16px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.6);
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  min-height: 150px;
  min-width: 135px;
  max-width: none;
}

@media (min-width: 900px) {
  .plot-card {
    padding: 20px;
    min-height: 220px;
    min-width: 190px;
  }
}

@media (min-width: 1200px) {
  .plot-card {
    padding: 24px;
    min-height: 260px;
    min-width: 230px;
  }
}

.plot-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* 呼吸光效 Lv4 - 淡紫色 */
.plot-glow-lv4 {
  animation: plotBreathingLv4 2s ease-in-out infinite;
}

@keyframes plotBreathingLv4 {
  0%, 100% {
    box-shadow: 0 0 5px rgba(168, 85, 247, 0.4);
  }
  50% {
    box-shadow: 
      0 0 12px rgba(168, 85, 247, 0.7),
      0 0 24px rgba(168, 85, 247, 0.4);
  }
}

/* 呼吸光效 Lv5+ - 金黄色 */
.plot-glow-lv5 {
  animation: plotBreathingLv5 2s ease-in-out infinite;
}

@keyframes plotBreathingLv5 {
  0%, 100% {
    box-shadow: 0 0 5px rgba(255, 215, 0, 0.6);
  }
  50% {
    box-shadow: 
      0 0 15px rgba(255, 215, 0, 0.9),
      0 0 30px rgba(255, 200, 0, 0.7);
  }
}

.plot-mature {
  background: rgba(255, 248, 220, 0.8) !important;
}

.plot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.plot-index {
  font-size: 0.8rem;
  color: #999;
  font-weight: 600;
}

@media (min-width: 1200px) {
  .plot-index {
    font-size: 0.9rem;
  }
}

.plot-level {
  font-size: 0.8rem;
  font-weight: bold;
}

/* 地块内容 */
.plot-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.locked-body .lock-icon {
  font-size: 2.4rem;
  margin-bottom: 4px;
}

@media (min-width: 900px) {
  .locked-body .lock-icon {
    font-size: 3rem;
    margin-bottom: 6px;
  }
}

@media (min-width: 1200px) {
  .locked-body .lock-icon {
    font-size: 4rem;
    margin-bottom: 10px;
  }
}

.unlock-cost {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.price-icon {
  width: 15px;
  height: 15px;
  object-fit: contain;
  flex-shrink: 0;
}

@media (min-width: 900px) {
  .unlock-cost {
    font-size: 0.9rem;
    margin-bottom: 8px;
  }
  .price-icon {
    width: 20px;
    height: 20px;
  }
}

@media (min-width: 1200px) {
  .unlock-cost {
    font-size: 1rem;
    margin-bottom: 10px;
  }
  .price-icon {
    width: 24px;
    height: 24px;
  }
}

.unlock-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;
}

@media (min-width: 900px) {
  .unlock-btn {
    padding: 10px 20px;
    font-size: 0.9rem;
  }
}

@media (min-width: 1200px) {
  .unlock-btn {
    padding: 12px 26px;
    font-size: 1rem;
  }
}

.unlock-btn:hover {
  transform: scale(1.05);
}

.empty-body .empty-icon {
  font-size: 2.8rem;
  margin-bottom: 6px;
}

@media (min-width: 900px) {
  .empty-body .empty-icon {
    font-size: 3.6rem;
    margin-bottom: 8px;
  }
}

@media (min-width: 1200px) {
  .empty-body .empty-icon {
    font-size: 4.5rem;
    margin-bottom: 10px;
  }
}

.empty-body .empty-text {
  font-size: 0.85rem;
  color: #999;
}

@media (min-width: 900px) {
  .empty-body .empty-text {
    font-size: 0.95rem;
  }
}

@media (min-width: 1200px) {
  .empty-body .empty-text {
    font-size: 1.1rem;
  }
}

.plant-body .plant-icon {
  font-size: 2.6rem;
  margin-bottom: 6px;
}

@media (min-width: 900px) {
  .plant-body .plant-icon {
    font-size: 3.4rem;
    margin-bottom: 8px;
  }
}

@media (min-width: 1200px) {
  .plant-body .plant-icon {
    font-size: 4.5rem;
    margin-bottom: 10px;
  }
}

.plant-body .plant-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
  margin-bottom: 6px;
}

@media (min-width: 900px) {
  .plant-body .plant-name {
    font-size: 0.95rem;
    margin-bottom: 8px;
  }
}

@media (min-width: 1200px) {
  .plant-body .plant-name {
    font-size: 1.1rem;
    margin-bottom: 10px;
  }
}

.dead-indicator {
  color: #f44336;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 4px;
}

@media (min-width: 1200px) {
  .dead-indicator {
    font-size: 0.95rem;
  }
}

.progress-container {
  width: 100%;
  padding: 0 8px;
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

@media (min-width: 1200px) {
  .progress-bar {
    height: 10px;
    border-radius: 5px;
    margin-bottom: 6px;
  }
}

.dry-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #ffcdd2, #ef5350);
  border-radius: 4px;
  transition: width 0.5s;
  opacity: 0.6;
}

.water-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #a5d6a7, #2e7d32);
  border-radius: 4px;
  transition: width 0.5s;
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.7rem;
}

.water-time {
  color: #2e7d32;
}

.dry-time {
  color: #ef5350;
}

.dry-time.warning {
  color: #f44336;
  font-weight: 600;
}

.stage-text {
  font-size: 0.75rem;
  color: #888;
}

.plot-tags {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  align-items: center;
}

.level-tag {
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.12);
}

@media (min-width: 1200px) {
  .level-tag {
    font-size: 0.8rem;
    padding: 3px 8px;
  }
}
.multiplier-tag {
  background: rgba(0, 0, 0, 0.15);
  color: #555;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 6px;
}

@media (min-width: 1200px) {
  .multiplier-tag {
    font-size: 0.8rem;
    padding: 3px 8px;
  }
}
footer {
  font-size: 0.75rem;
  color: #7f6b4a;
  margin-top: 12px;
}

/* AI 助手按钮 */
.ai-chat-btn {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(34, 197, 94, 0.35);
  z-index: 1000;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-chat-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 24px rgba(34, 197, 94, 0.5);
}

.ai-chat-btn:active {
  transform: scale(0.95);
}

/* 手册按钮 */
.handbook-btn {
  position: fixed;
  top: 80px;
  right: 80px;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #2e7d32;
  font-size: 1.5rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(46, 125, 50, 0.2);
}

.handbook-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 24px rgba(46, 125, 50, 0.2);
  background: #e8f5e9;
}

.handbook-btn:active {
  transform: scale(0.95);
}

/* 移动端响应式 */
@media (max-width: 767px) {
  .plots-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .plot-card {
    padding: 8px;
    min-height: 110px;
    min-width: 100px;
    aspect-ratio: auto;
  }

  .locked-body .lock-icon {
    font-size: 1.5rem;
    margin-bottom: 3px;
  }

  .unlock-cost {
    font-size: 0.65rem;
    margin-bottom: 3px;
  }

  .price-icon {
    width: 11px;
    height: 11px;
  }

  .unlock-btn {
    padding: 5px 10px;
    font-size: 0.65rem;
  }

  .empty-body .empty-icon {
    font-size: 1.6rem;
    margin-bottom: 3px;
  }

  .empty-body .empty-text {
    font-size: 0.7rem;
  }

  .plant-body .plant-icon {
    font-size: 1.5rem;
    margin-bottom: 3px;
  }

  .plant-body .plant-name {
    font-size: 0.7rem;
    margin-bottom: 3px;
  }

  .dead-indicator {
    font-size: 0.65rem;
    margin-bottom: 2px;
  }

  .progress-bar {
    height: 5px;
    margin-bottom: 2px;
  }

  .time-info {
    font-size: 0.55rem;
    gap: 1px;
  }

  .plot-tags {
    bottom: 3px;
    right: 3px;
    gap: 2px;
  }

  .level-tag,
  .multiplier-tag {
    font-size: 0.55rem;
    padding: 1px 3px;
  }

  .plot-header {
    margin-bottom: 4px;
  }

  .plot-index {
    font-size: 0.65rem;
  }
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .garden-page {
    background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
  }
  .card {
    background: rgba(30, 30, 25, 0.95);
  }
  h1 { color: #8bc34a; }
  .plot-card { background: rgba(255,255,255,0.05); }
  .plot-mature { background: rgba(255,248,220,0.1) !important; }
  .plant-body .plant-name { color: #ccc; }
  .stage-text { color: #aaa; }
  .unlock-cost { color: #aaa; }
  .empty-body .empty-text { color: #aaa; }
  .multiplier-tag { background: rgba(255,255,255,0.1); color: #aaa; }
  .level-tag { background: rgba(255,255,255,0.1); }
  footer { color: #a0a080; }
  .ai-chat-btn { background: linear-gradient(135deg, #4caf50, #388e3c); box-shadow: 0 4px 16px rgba(76, 175, 80, 0.3); }
  .handbook-btn { background: rgba(40, 40, 45, 0.9); color: #81c784; border-color: rgba(76, 175, 80, 0.3); }
  .handbook-btn:hover { background: rgba(76, 175, 80, 0.15); }
}
</style>

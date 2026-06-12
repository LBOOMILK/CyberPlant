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
            'plot-glow': plot.level >= 4
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
              {{ plotStore.unlockCosts[plot.plot_index].icon }} {{ plotStore.unlockCosts[plot.plot_index].label }}
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
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: getProgress(plot) + '%' }"></div>
            </div>
            <div class="stage-text">{{ getStageName(plot.stage) }} {{ plot.stage < 4 ? getStageProgressText(plot) : '' }}</div>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { usePlotStore } from '@/stores/plotStore'
import { useUserStore } from '@/stores/userStore'
import { useShopStore } from '@/stores/shopStore'
import Toast from '@/components/Toast.vue'
import PlantSelectModal from '@/components/PlantSelectModal.vue'
import PlotModal from '@/components/PlotModal.vue'
import UpgradeModal from '@/components/UpgradeModal.vue'
import AIChatModal from '@/components/AIChatModal.vue'
import HandbookModal from '@/components/HandbookModal.vue'

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
const selectedPlot = ref(null)
const selectedPlotIndex = ref(null)
const userSeeds = ref([])
const userFertilizers = ref([])

function addToast(message, type = 'info') {
  if (toastRef.value) toastRef.value.addToast(message, type)
}

function getStageName(stage) {
  return ['种子', '发芽', '出叶', '初熟', '成熟'][stage] || '未知'
}

function getStageProgressText(plot) {
  if (!plot.crop || !plot.planted_at) return ''
  const growTime = plot.crop.grow_time || 60
  const stageTime = growTime / 4
  const elapsed = (Date.now() - new Date(plot.planted_at).getTime()) / 1000
  const stageElapsed = elapsed - (plot.stage * stageTime)
  const remaining = Math.max(0, Math.ceil(stageTime - stageElapsed))
  if (remaining <= 0) return '可浇水'
  if (remaining < 60) return `${remaining}秒`
  if (remaining < 3600) return `${Math.floor(remaining / 60)}分`
  return `${Math.floor(remaining / 3600)}时`
}

function getProgress(plot) {
  if (!plot.crop) return 0
  if (plot.stage >= 4) return 100
  if (!plot.planted_at) return 0
  const growTime = plot.crop.grow_time || 60
  const stageTime = growTime / 4
  const elapsed = (Date.now() - new Date(plot.planted_at).getTime()) / 1000
  // 每阶段独立进度
  const stageElapsed = elapsed - (plot.stage * stageTime)
  return Math.min(100, Math.max(0, (stageElapsed / stageTime) * 100))
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
    const response = await fetch(`${import.meta.env.VITE_API_URL}/user/items`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const items = await response.json()
      userSeeds.value = items.filter(i => i.item_type === 'seed')
      userFertilizers.value = items.filter(i => i.item_type === 'fertilizer')
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
  try {
    const data = await plotStore.unlockPlot(plotIndex)
    if (data.currencies) userStore.currencies.value = data.currencies
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
    addToast(`🏆 收获成功！获得 ${data.yield} 个 ${data.crop?.name || '作物'}`, 'success')
  } catch (error) {
    addToast(error.message, 'error')
  }
}

async function handleRemove() {
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
    if (data.currencies) userStore.currencies.value = data.currencies
    showUpgradeModal.value = false
    addToast(`⬆️ 升级成功！Lv.${data.level} (${data.multiplier}x)`, 'success')
  } catch (error) {
    addToast(error.message, 'error')
  }
}

onMounted(async () => {
  try {
    await userStore.loadFromLocal()
    await plotStore.loadPlots()
  } catch (error) {
    console.error('Failed to load garden:', error)
    addToast('加载花园数据失败', 'error')
  }
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

@media (max-width: 767px) {
  .plots-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 地块卡片 */
.plot-card {
  position: relative;
  border: 3px solid #9CA3AF;
  border-radius: 16px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.6);
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
}

.plot-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* 呼吸光效 Lv4+ */
.plot-glow {
  animation: plotBreathing 2s ease-in-out infinite;
}

@keyframes plotBreathing {
  0%, 100% {
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.3);
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
  font-size: 2rem;
  margin-bottom: 6px;
}

.unlock-cost {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 8px;
}

.unlock-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.unlock-btn:hover {
  transform: scale(1.05);
}

.empty-body .empty-icon {
  font-size: 2.5rem;
  margin-bottom: 6px;
}

.empty-body .empty-text {
  font-size: 0.85rem;
  color: #999;
}

.plant-body .plant-icon {
  font-size: 2.2rem;
  margin-bottom: 4px;
}

.plant-body .plant-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #555;
  margin-bottom: 6px;
}

.progress-bar {
  width: 80%;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  border-radius: 3px;
  transition: width 0.5s;
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

.multiplier-tag {
  background: rgba(0, 0, 0, 0.15);
  color: #555;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 6px;
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

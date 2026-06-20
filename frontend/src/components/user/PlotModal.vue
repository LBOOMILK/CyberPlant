<template>
  <div v-if="visible" class="modal-overlay" @mousedown.self="$emit('close')">
    <div class="modal-content">
      <h3>{{ plot?.crop?.icon || '🌱' }} 地块 #{{ plot?.plot_index }}</h3>
      <!-- 空地状态 -->
      <div v-if="plot && !plot.seed_id" class="plot-detail">
        <div class="crop-header">
          <span class="crop-emoji">🌾</span>
          <div class="crop-name-row">
            <span class="crop-name">空闲地块</span>
          </div>
        </div>
        <div class="info-panel">
          <div class="info-row">
            <span>🏷️ 地块等级</span>
            <span :style="{ color: levelColors[plot.level], fontWeight: 'bold' }">Lv.{{ plot.level }} ({{ plot.multiplier }}x)</span>
          </div>
        </div>
        <div class="action-buttons">
          <button class="action-btn plant-btn" @click="$emit('plant')">🌱 种植</button>
          <button class="action-btn upgrade-btn-inline" @click="$emit('upgrade')">⬆️ 升级</button>
        </div>
      </div>
      <!-- 有植物状态 -->
      <div v-else-if="plot && plot.crop" class="plot-detail">
        <div class="crop-header">
          <span class="crop-emoji">{{ getStageDisplay(plot) }}</span>
          <div class="crop-name-row">
            <span class="crop-name">{{ plot.crop.name }}</span>
            <span :class="['rarity-badge', `rarity-${plot.crop.rarity}`]">{{ plot.crop.rarity }}</span>
          </div>
        </div>
        
        <!-- 死亡状态 -->
        <div v-if="plot.is_dead" class="dead-warning">
          <span class="dead-icon">💀</span>
          <span class="dead-text">植物已因缺水死亡，请铲除后重新种植</span>
        </div>
        
        <div class="info-panel">
          <div class="info-row">
            <span>🌱 生长阶段</span>
            <span>{{ getStageName(plot.stage) }} {{ getStageDisplay(plot) }}</span>
          </div>
          <div class="info-row progress-row">
            <span>📊 生长进度</span>
            <span class="progress-bar-wrap">
              <span class="progress-bar">
                <span class="dry-fill" :style="{ width: dryProgress + '%' }"></span>
                <span class="water-fill" :style="{ width: waterProgress + '%' }"></span>
              </span>
              <span class="progress-text">{{ Math.round(waterProgress) }}%</span>
            </span>
          </div>
          <div class="info-row">
            <span>💧 浇水冷却</span>
            <span class="water-info">{{ waterTimeText }}</span>
          </div>
          <div class="info-row">
            <span>⚠️ 干涸倒计时</span>
            <span :class="{ 'dry-warning': dryProgress > 80 }">{{ dryTimeText }}</span>
          </div>
          <div class="info-row">
            <span>🏷️ 地块等级</span>
            <span :style="{ color: levelColors[plot.level], fontWeight: 'bold' }">Lv.{{ plot.level }} ({{ plot.multiplier }}x)</span>
          </div>
          <div class="info-row">
            <span>🌾 基础产出</span>
            <span>{{ plot.crop.base_yield }} × {{ plot.multiplier }} = {{ Math.round(plot.crop.base_yield * plot.multiplier) }}</span>
          </div>
        </div>
      </div>
      <div v-if="plot && plot.seed_id" class="action-buttons">
        <button
          class="action-btn water-btn"
          @click="$emit('water')"
          :disabled="!canWater"
        >💧 浇水</button>
        <button
          class="action-btn fertilize-btn"
          @click="$emit('fertilize')"
          :disabled="!canFertilize"
        >🧪 施肥</button>
        <button
          class="action-btn harvest-btn"
          @click="$emit('harvest')"
          :disabled="!canHarvest"
        >🏆 收获</button>
        <button
          class="action-btn remove-btn danger-pulse"
          @click="showRemoveConfirm = true"
          :disabled="!canRemove"
        >🗑️ 铲除</button>
      </div>
      <div v-if="plot && plot.seed_id" class="bottom-actions">
        <button @click="$emit('upgrade')" class="upgrade-link">⬆️ 升级地块 (Lv.{{ plot?.level }})</button>
        <button @click="$emit('close')" class="close-btn">关闭</button>
      </div>
      
      <!-- 铲除确认弹窗 -->
      <div v-if="showRemoveConfirm" class="modal-overlay confirm-overlay">
        <div class="confirm-modal">
          <div class="confirm-icon">⚠️</div>
          <h3>确认铲除</h3>
          <p class="confirm-message">
            铲除后将移除当前地块的植物，<span class="danger-text">不会返还种子，也不会获得任何物品</span>。
          </p>
          <p class="confirm-hint">确定要继续吗？</p>
          <div class="confirm-actions">
            <button class="confirm-btn danger-btn" @click="handleRemove">确认铲除</button>
            <button class="cancel-btn" @click="showRemoveConfirm = false">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { usePlotStore } from '@/stores/plotStore'

const props = defineProps({
  visible: Boolean,
  plot: Object
})

const emit = defineEmits(['close', 'water', 'fertilize', 'harvest', 'remove', 'upgrade', 'plant'])

const plotStore = usePlotStore()
const { levelColors, stageIcons } = plotStore

const dryProgress = ref(0)
const waterProgress = ref(0)
const dryTimeText = ref('')
const waterTimeText = ref('')
const showRemoveConfirm = ref(false)
let updateTimer = null

function handleRemove() {
  showRemoveConfirm.value = false
  emit('remove')
}

const canWater = computed(() => {
  if (!props.plot) return false
  return props.plot.seed_id && props.plot.stage < 4 && !props.plot.is_dead
})

const canFertilize = computed(() => {
  if (!props.plot) return false
  return props.plot.seed_id && props.plot.stage < 4 && !props.plot.is_dead
})

const canHarvest = computed(() => {
  if (!props.plot) return false
  return props.plot.seed_id && props.plot.stage >= 4 && !props.plot.is_dead
})

const canRemove = computed(() => {
  if (!props.plot) return false
  return props.plot.seed_id
})

function getStageName(stage) {
  const names = ['种子', '发芽', '出叶', '初熟', '成熟']
  return names[stage] || '未知'
}

function getStageDisplay(plot) {
  if (!plot) return '🥜'
  if (plot.stage >= 4) return plot.crop?.icon || '🌿'
  return stageIcons[plot.stage] || '🥜'
}

function updateProgress() {
  if (!props.plot || !props.plot.crop || !props.plot.planted_at) {
    dryProgress.value = 0
    waterProgress.value = 0
    dryTimeText.value = '-'
    waterTimeText.value = '-'
    return
  }
  
  const waterCd = props.plot.crop.water_cd || 5 // 浇水冷却时间
  const dryTime = 180 // 干涸死亡时间固定3分钟
  const plantedAt = new Date(props.plot.planted_at).getTime()
  const elapsed = (Date.now() - plantedAt) / 1000
  
  // 成熟后不再干涸
  if (props.plot.stage >= 4) {
    dryProgress.value = 0
    waterProgress.value = 100
    dryTimeText.value = '植物已成熟，不会干涸'
    waterTimeText.value = '无需浇水'
    return
  }
  
  // 死亡状态
  if (props.plot.is_dead) {
    dryProgress.value = 100
    waterProgress.value = 0
    dryTimeText.value = '植物已死亡'
    waterTimeText.value = '无法浇水'
    return
  }
  
  // 浇水进度（基于 water_cd）
  const waterProgressVal = Math.min(100, Math.max(0, (elapsed / waterCd) * 100))
  waterProgress.value = waterProgressVal
  
  // 干涸进度（基于 dryTime）
  const dryProgressVal = Math.min(100, Math.max(0, (elapsed / dryTime) * 100))
  dryProgress.value = dryProgressVal
  
  // 浇水冷却时间
  const waterRemaining = Math.max(0, Math.ceil(waterCd - elapsed))
  if (waterRemaining <= 0) {
    waterTimeText.value = '可以浇水'
  } else if (waterRemaining < 60) {
    waterTimeText.value = `${waterRemaining}秒后可浇水`
  } else {
    const mins = Math.floor(waterRemaining / 60)
    const secs = waterRemaining % 60
    waterTimeText.value = `${mins}分${secs}秒后可浇水`
  }
  
  // 干涸倒计时
  const dryRemaining = Math.max(0, Math.ceil(dryTime - elapsed))
  if (dryRemaining <= 0) {
    dryTimeText.value = '即将死亡！'
  } else if (dryRemaining < 60) {
    dryTimeText.value = `${dryRemaining}秒后死亡`
  } else {
    const mins = Math.floor(dryRemaining / 60)
    const secs = dryRemaining % 60
    dryTimeText.value = `${mins}分${secs}秒后死亡`
  }
}

onMounted(() => {
  updateProgress()
  updateTimer = setInterval(updateProgress, 1000)
})

onUnmounted(() => {
  if (updateTimer) {
    clearInterval(updateTimer)
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease;
}
.modal-content {
  background: rgba(255, 248, 235, 0.98);
  border-radius: 24px;
  padding: 24px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
  animation: slideUp 0.3s ease;
}
h3 {
  text-align: center;
  color: #2c5a2a;
  margin: 0 0 16px 0;
  font-size: 1.2rem;
}
.crop-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.crop-emoji {
  font-size: 2.5rem;
}
.crop-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.crop-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}
.rarity-badge {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: bold;
  color: white;
}
.rarity-C { background: #9e9e9e; }
.rarity-B { background: #4caf50; }
.rarity-A { background: #2196f3; }
.rarity-S { background: #9c27b0; }
.rarity-SSR { background: #f44336; color: white; }
.rarity-SSS { background: linear-gradient(135deg, #ffd700, #ff8c00); color: #2d2b15; }
.info-panel {
  background: rgba(255,255,255,0.5);
  border-radius: 16px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  font-size: 0.9rem;
  color: #555;
}

.info-row:last-child { border-bottom: none; }

.dry-warning {
  color: #f44336;
  font-weight: 600;
}

.water-info {
  color: #2e7d32;
}

.progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  position: relative;
  width: 100px;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.dry-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #ffcdd2, #ef5350);
  border-radius: 4px;
  transition: width 0.3s;
  opacity: 0.6;
}

.water-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #a5d6a7, #2e7d32);
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.8rem;
  color: #666;
  min-width: 36px;
  text-align: right;
}

/* 死亡警告 */
.dead-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(244, 67, 54, 0.1);
  border-radius: 12px;
  margin-bottom: 12px;
}

.dead-icon {
  font-size: 1.5rem;
}

.dead-text {
  color: #f44336;
  font-weight: 600;
}
.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}
.action-btn {
  padding: 10px;
  border: none;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
}
.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.plant-btn { background: linear-gradient(135deg, #22c55e, #16a34a); }
.upgrade-btn-inline { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.water-btn { background: linear-gradient(135deg, #2e7d32, #1b5e20); }
.fertilize-btn { background: linear-gradient(135deg, #7b1fa2, #5c1078); }
.harvest-btn { background: linear-gradient(135deg, #ff9800, #f57c00); }
.remove-btn { background: linear-gradient(135deg, #ef5350, #c62828); }
.action-btn:hover:not(:disabled) { transform: translateY(-1px); }
.bottom-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.upgrade-link {
  background: none;
  border: none;
  color: #22c55e;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 4px 0;
}
.upgrade-link:hover { text-decoration: underline; }
.close-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 20px;
  background: #e0e0e0;
  color: #333;
  cursor: pointer;
  font-weight: 600;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }

/* 红色脉冲动画 */
@keyframes dangerPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 83, 80, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(239, 83, 80, 0); }
}

.danger-pulse:not(:disabled) {
  animation: dangerPulse 2s infinite;
}

/* 确认弹窗样式 */
.confirm-overlay {
  background: rgba(0, 0, 0, 0.7);
}

.confirm-modal {
  background: rgba(255, 248, 235, 0.99);
  border-radius: 20px;
  padding: 32px;
  width: 90%;
  max-width: 360px;
  text-align: center;
}

.confirm-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.confirm-modal h3 {
  color: #c62828;
  margin-bottom: 12px;
}

.confirm-message {
  color: #555;
  line-height: 1.6;
  margin-bottom: 8px;
}

.danger-text {
  color: #c62828;
  font-weight: 700;
}

.confirm-hint {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 20px;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.confirm-actions .confirm-btn {
  padding: 12px 32px;
  border: none;
  border-radius: 25px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-actions .danger-btn {
  background: linear-gradient(135deg, #ef5350, #c62828);
  color: white;
}

.confirm-actions .cancel-btn {
  padding: 12px 32px;
  border: none;
  border-radius: 25px;
  font-weight: 600;
  cursor: pointer;
  background: #e0e0e0;
  color: #333;
}

.confirm-actions .confirm-btn:hover {
  transform: translateY(-2px);
}

@media (prefers-color-scheme: dark) {
  .modal-content { background: rgba(30, 30, 25, 0.98); }
  h3 { color: #8bc34a; }
  .crop-name { color: #e0e0d0; }
  .info-panel { background: rgba(255,255,255,0.05); }
  .info-row { color: #bbb; border-bottom-color: rgba(255,255,255,0.08); }
  .progress-bar { background: #444; }
  .close-btn { background: #4a4a4a; color: #e0e0e0; }
  .confirm-modal { background: rgba(40, 40, 35, 0.99); }
  .confirm-message { color: #ccc; }
  .confirm-hint { color: #888; }
  .confirm-actions .cancel-btn { background: #4a4a4a; color: #e0e0e0; }
}
</style>

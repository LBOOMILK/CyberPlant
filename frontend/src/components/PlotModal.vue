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
        <div class="info-panel">
          <div class="info-row">
            <span>🌱 生长阶段</span>
            <span>{{ getStageName(plot.stage) }} {{ getStageDisplay(plot) }}</span>
          </div>
          <div class="info-row">
            <span>📊 进度</span>
            <span class="progress-bar-wrap">
              <span class="progress-bar">
                <span class="progress-fill" :style="{ width: getProgress(plot) + '%' }"></span>
              </span>
              <span class="progress-text">{{ Math.round(getProgress(plot)) }}%</span>
            </span>
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
          class="action-btn remove-btn"
          @click="$emit('remove')"
          :disabled="!canRemove"
        >🗑️ 铲除</button>
      </div>
      <div v-if="plot && plot.seed_id" class="bottom-actions">
        <button @click="$emit('upgrade')" class="upgrade-link">⬆️ 升级地块 (Lv.{{ plot?.level }})</button>
        <button @click="$emit('close')" class="close-btn">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlotStore } from '@/stores/plotStore'

const props = defineProps({
  visible: Boolean,
  plot: Object
})

defineEmits(['close', 'water', 'fertilize', 'harvest', 'remove', 'upgrade', 'plant'])

const plotStore = usePlotStore()
const { levelColors, stageIcons } = plotStore

const canWater = computed(() => {
  if (!props.plot) return false
  return props.plot.seed_id && props.plot.stage < 4
})

const canFertilize = computed(() => {
  if (!props.plot) return false
  return props.plot.seed_id && props.plot.stage < 4
})

const canHarvest = computed(() => {
  if (!props.plot) return false
  return props.plot.seed_id && props.plot.stage >= 4
})

const canRemove = computed(() => {
  if (!props.plot) return false
  return props.plot.seed_id && props.plot.stage < 4
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

function getProgress(plot) {
  if (!plot || !plot.crop) return 0
  if (plot.stage >= 4) return 100
  const growTime = plot.crop.grow_time || 60
  const stageTime = growTime / 4
  if (!plot.planted_at) return 0
  const elapsed = (Date.now() - new Date(plot.planted_at).getTime()) / 1000
  // 每阶段独立进度
  const stageElapsed = elapsed - (plot.stage * stageTime)
  return Math.min(100, Math.max(0, (stageElapsed / stageTime) * 100))
}
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
.progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.progress-bar {
  width: 80px;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  border-radius: 4px;
  transition: width 0.3s;
}
.progress-text {
  font-size: 0.8rem;
  color: #666;
  min-width: 36px;
  text-align: right;
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

@media (prefers-color-scheme: dark) {
  .modal-content { background: rgba(30, 30, 25, 0.98); }
  h3 { color: #8bc34a; }
  .crop-name { color: #e0e0d0; }
  .info-panel { background: rgba(255,255,255,0.05); }
  .info-row { color: #bbb; border-bottom-color: rgba(255,255,255,0.08); }
  .progress-bar { background: #444; }
  .close-btn { background: #4a4a4a; color: #e0e0e0; }
}
</style>

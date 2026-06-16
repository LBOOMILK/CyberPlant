<template>
  <div v-if="visible" class="modal-overlay" @mousedown.self="$emit('close')">
    <div class="modal-content">
      <h3>⬆️ 地块升级</h3>
      <div v-if="plot" class="upgrade-info">
        <div class="current-level">
          <span class="level-label">当前等级</span>
          <span class="level-value" :style="{ color: levelColors[plot.level] }">Lv.{{ plot.level }}</span>
        </div>
        <div v-if="plot.level < 5" class="upgrade-preview">
          <div class="arrow">⬇️</div>
          <div class="next-level">
            <span class="level-label">升级到</span>
            <span class="level-value" :style="{ color: levelColors[plot.level + 1] }">Lv.{{ plot.level + 1 }}</span>
          </div>
          <div class="multiplier-change">
            <span>产出倍率：</span>
            <span class="old-mult">{{ levelMultiplier[plot.level] }}x</span>
            <span class="arrow-right">→</span>
            <span class="new-mult">{{ levelMultiplier[plot.level + 1] }}x</span>
          </div>
          <div class="cost-info">
            <span>升级费用：</span>
            <img v-if="getUpgradeCostIcon(plot.level + 1)" :src="getUpgradeCostIcon(plot.level + 1)" class="cost-icon" />
            <span class="cost-value">{{ getUpgradeCostLabel(plot.level + 1) }}</span>
          </div>
        </div>
        <div v-else class="max-level">
          <div class="max-emoji">👑</div>
          <p>已达最大等级！</p>
        </div>
      </div>
      <div class="modal-actions">
        <button @click="$emit('close')" class="cancel-btn">取消</button>
        <button
          v-if="plot && plot.level < 5"
          @click="$emit('upgrade')"
          class="confirm-btn"
        >确认升级</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePlotStore } from '@/stores/plotStore'

defineProps({
  visible: Boolean,
  plot: Object
})

defineEmits(['close', 'upgrade'])

const plotStore = usePlotStore()
const { levelColors, levelMultiplier, upgradeCosts } = plotStore

function getUpgradeCostLabel(nextLevel) {
  const cost = upgradeCosts[nextLevel]
  return cost ? cost.label : '未知'
}

function getUpgradeCostIcon(nextLevel) {
  const cost = upgradeCosts[nextLevel]
  return cost ? cost.icon : ''
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
  padding: 28px;
  width: 90%;
  max-width: 380px;
  text-align: center;
  box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
  animation: slideUp 0.3s ease;
}
h3 {
  color: #2c5a2a;
  margin: 0 0 20px 0;
  font-size: 1.2rem;
}
.upgrade-info {
  margin-bottom: 20px;
}
.current-level, .next-level {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: rgba(255,255,255,0.5);
  border-radius: 12px;
  margin-bottom: 8px;
}
.level-label {
  font-size: 0.95rem;
  color: #666;
}
.level-value {
  font-size: 1.3rem;
  font-weight: bold;
}
.arrow {
  font-size: 1.5rem;
  margin: 8px 0;
}
.multiplier-change, .cost-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  font-size: 0.9rem;
  color: #555;
}
.old-mult {
  text-decoration: line-through;
  color: #999;
}
.arrow-right {
  margin: 0 6px;
  color: #22c55e;
}
.new-mult {
  color: #22c55e;
  font-weight: bold;
}
.cost-value {
  color: #d97706;
  font-weight: bold;
}
.cost-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  margin-right: 4px;
}
.max-level {
  padding: 24px;
}
.max-emoji {
  font-size: 48px;
  margin-bottom: 8px;
}
.max-level p {
  color: #d97706;
  font-weight: bold;
}
.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.cancel-btn, .confirm-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 40px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}
.cancel-btn { background: #e0e0e0; color: #333; }
.confirm-btn { background: #22c55e; color: white; }
.confirm-btn:hover { background: #16a34a; }

@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }

@media (prefers-color-scheme: dark) {
  .modal-content { background: rgba(30, 30, 25, 0.98); }
  h3 { color: #8bc34a; }
  .current-level, .next-level { background: rgba(255,255,255,0.08); }
  .level-label, .multiplier-change, .cost-info { color: #bbb; }
  .cancel-btn { background: #4a4a4a; color: #e0e0e0; }
}
</style>

<template>
  <div v-if="visible" class="modal-overlay" @mousedown.self="$emit('close')">
    <div class="modal-content">
      <h3>🌱 选择种子</h3>
      <div v-if="seeds.length === 0" class="empty-seeds">
        <div class="empty-emoji">🌰</div>
        <p>背包里没有种子</p>
        <button @click="$emit('close')" class="close-btn">去商城购买</button>
      </div>
      <div v-else class="seeds-list">
        <div
          v-for="seed in seeds"
          :key="seed.item_id"
          class="seed-item"
          :class="{ selected: selectedSeed?.item_id === seed.item_id }"
          @click="selectedSeed = seed"
        >
          <div class="seed-icon">{{ seed.icon }}</div>
          <div class="seed-info">
            <div class="seed-name">{{ seed.name }}</div>
            <div class="seed-meta">
              <span :class="['rarity-badge', `rarity-${seed.rarity}`]">{{ seed.rarity }}</span>
              <span class="seed-qty">×{{ seed.quantity }}</span>
            </div>
          </div>
          <div class="seed-time">⏱️ {{ formatTime(seed.grow_time) }}</div>
        </div>
      </div>
      <div class="modal-actions">
        <button @click="$emit('close')" class="cancel-btn">取消</button>
        <button
          @click="handleConfirm"
          class="confirm-btn"
          :disabled="!selectedSeed"
        >确认种植</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  visible: Boolean,
  seeds: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'plant'])
const selectedSeed = ref(null)

function formatTime(seconds) {
  if (!seconds) return '0秒'
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60 ? seconds % 60 + '秒' : ''}`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}时${m ? m + '分' : ''}`
}

function handleConfirm() {
  if (selectedSeed.value) {
    emit('plant', selectedSeed.value)
    selectedSeed.value = null
  }
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
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
  animation: slideUp 0.3s ease;
}
h3 {
  text-align: center;
  color: #2c5a2a;
  margin: 0 0 16px 0;
  font-size: 1.2rem;
}
.seeds-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
  max-height: 320px;
}
.seed-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.5);
}
.seed-item:hover {
  background: rgba(46, 125, 50, 0.08);
}
.seed-item.selected {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}
.seed-icon {
  font-size: 2rem;
  margin-right: 12px;
}
.seed-info {
  flex: 1;
}
.seed-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}
.seed-meta {
  display: flex;
  align-items: center;
  gap: 8px;
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
.seed-qty {
  font-size: 0.85rem;
  color: #666;
}
.seed-time {
  font-size: 0.8rem;
  color: #888;
  white-space: nowrap;
}
.empty-seeds {
  text-align: center;
  padding: 32px 16px;
  color: #888;
}
.empty-emoji {
  font-size: 48px;
  margin-bottom: 12px;
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
.cancel-btn {
  background: #e0e0e0;
  color: #333;
}
.confirm-btn {
  background: #22c55e;
  color: white;
}
.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.confirm-btn:hover:not(:disabled) {
  background: #16a34a;
}
.close-btn {
  margin-top: 12px;
  padding: 8px 20px;
  border: none;
  border-radius: 20px;
  background: #22c55e;
  color: white;
  cursor: pointer;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }

@media (prefers-color-scheme: dark) {
  .modal-content { background: rgba(30, 30, 25, 0.98); }
  h3 { color: #8bc34a; }
  .seed-item { background: rgba(255,255,255,0.05); }
  .seed-item:hover { background: rgba(76,175,80,0.15); }
  .seed-item.selected { background: rgba(34,197,94,0.2); border-color: #4ade80; }
  .seed-name { color: #e0e0d0; }
  .seed-qty, .seed-time { color: #aaa; }
  .cancel-btn { background: #4a4a4a; color: #e0e0e0; }
}
</style>

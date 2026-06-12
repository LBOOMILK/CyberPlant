<template>
  <div
    v-if="visible"
    class="pet-floating"
    :class="{ dragging: isDragging }"
    :style="floatStyle"
    @click="handleClick"
  >
    <div class="pet-float-icon">{{ petStore.activePet?.icon || '🐾' }}</div>
    <div class="pet-float-info">
      <div class="pet-float-name">{{ petStore.activePet?.name || '宠物' }}</div>
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
    <div class="drag-handle" @mousedown.stop="startDrag" @touchstart.stop="startDrag">
      <span>⠿</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePetStore } from '@/stores/petStore'

const petStore = usePetStore()
const router = useRouter()

const isDragging = ref(false)
const position = ref({ x: 20, y: 80 })
const dragOffset = ref({ x: 0, y: 0 })
const hunger = ref(100)

const visible = computed(() => {
  return petStore.hasActivePet && router.currentRoute.value.path.startsWith('/dashboard')
})

const floatStyle = computed(() => ({
  right: `${position.value.x}px`,
  bottom: `${position.value.y}px`
}))

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
    y: window.innerHeight - touch.clientY - position.value.y
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
  const newY = window.innerHeight - touch.clientY - dragOffset.value.y
  position.value = {
    x: Math.max(0, Math.min(newX, window.innerWidth - 120)),
    y: Math.max(0, Math.min(newY, window.innerHeight - 80))
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
  if (!isDragging.value) {
    router.push('/dashboard/pets')
  }
}

onMounted(async () => {
  try {
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
  gap: 8px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  padding: 8px 12px;
  border-radius: 40px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.5);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
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

.pet-float-icon {
  font-size: 2rem;
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

.drag-handle {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 40px;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.25));
  border-radius: 0 10px 10px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
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

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .pet-floating {
    background: rgba(40, 40, 45, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .pet-float-name {
    color: #e0e0e0;
  }

  .mini-bar {
    background: #444;
  }
}

@media (max-width: 600px) {
  .pet-floating {
    padding: 6px 10px;
  }

  .pet-float-icon {
    font-size: 1.5rem;
  }

  .pet-float-info {
    min-width: 50px;
  }
}
</style>

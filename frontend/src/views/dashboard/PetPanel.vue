<template>
  <div class="pet-panel">
    <div class="panel-header">
      <h2>🐾 宠物系统</h2>
      <p class="subtitle">培养你的专属宠物，获得种植加成</p>
    </div>

    <!-- 宠物列表 -->
    <div class="section" v-if="petStore.pets.length > 0">
      <h3 class="section-title">我的宠物</h3>
      <div class="pet-grid">
        <div
          v-for="pet in petStore.pets"
          :key="pet.user_pet_id"
          class="pet-card"
          :class="{ active: pet.is_active, selected: selectedPet?.user_pet_id === pet.user_pet_id }"
          :style="{ borderColor: pet.is_active ? petStore.rarityConfig[pet.rarity]?.color : 'transparent' }"
          @click="selectPet(pet)"
        >
          <div class="pet-card-header">
            <span class="pet-icon">{{ pet.icon }}</span>
            <span class="pet-rarity-badge" :style="{ background: petStore.rarityConfig[pet.rarity]?.color }">
              {{ petStore.rarityConfig[pet.rarity]?.label }}
            </span>
            <span v-if="pet.is_active" class="active-badge">出战中</span>
          </div>
          <div class="pet-card-body">
            <div class="pet-name">{{ pet.name }}</div>
            <div class="pet-level">Lv.{{ pet.level }}</div>
            <!-- 成长进度条 -->
            <div class="progress-bar-container">
              <div class="progress-label">成长</div>
              <div class="progress-bar">
                <div
                  class="progress-fill growth"
                  :style="{
                    width: pet.next_level_threshold ? Math.min(100, (pet.growth_points / pet.next_level_threshold) * 100) + '%' : '100%',
                    background: petStore.rarityConfig[pet.rarity]?.color
                  }"
                ></div>
              </div>
              <div class="progress-text">
                {{ pet.next_level_threshold ? pet.growth_points + '/' + pet.next_level_threshold : 'MAX' }}
              </div>
            </div>
            <!-- 饱食度条 -->
            <div class="progress-bar-container">
              <div class="progress-label">饱食</div>
              <div class="progress-bar">
                <div
                  class="progress-fill hunger"
                  :class="{ low: pet.hunger < 20, mid: pet.hunger >= 20 && pet.hunger < 50 }"
                  :style="{ width: pet.hunger + '%' }"
                ></div>
              </div>
              <div class="progress-text">{{ pet.hunger }}/100</div>
            </div>
            <!-- 加成 -->
            <div class="pet-bonus" :class="{ paused: pet.hunger <= 0 }">
              <span v-if="pet.hunger > 0">加成 +{{ pet.current_bonus }}%</span>
              <span v-else class="bonus-paused">⏸ 加成已暂停</span>
            </div>
          </div>
          <!-- 消化中提示 -->
          <div v-if="pet.is_digesting" class="digesting-overlay">
            <span>🍽️ 消化中...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <span class="empty-icon">🐾</span>
      <p>还没有宠物</p>
      <p class="empty-hint">去商店购买一只宠物吧！</p>
    </div>

    <!-- 宠物详情/操作面板 -->
    <div v-if="selectedPet" class="pet-detail">
      <div class="detail-header">
        <span class="detail-icon">{{ selectedPet.icon }}</span>
        <div class="detail-info">
          <h3>{{ selectedPet.name }}</h3>
          <div class="detail-meta">
            <span class="rarity-tag" :style="{ background: petStore.rarityConfig[selectedPet.rarity]?.color }">
              {{ petStore.rarityConfig[selectedPet.rarity]?.label }}
            </span>
            <span>Lv.{{ selectedPet.level }}</span>
            <span v-if="selectedPet.is_active" class="active-tag">出战中</span>
          </div>
        </div>
        <button class="close-btn" @click="selectedPet = null">✕</button>
      </div>

      <div class="detail-stats">
        <div class="stat-item">
          <div class="stat-label">当前加成</div>
          <div class="stat-value" :class="{ paused: selectedPet.hunger <= 0 }">
            {{ selectedPet.hunger > 0 ? '+' + selectedPet.current_bonus + '%' : '已暂停' }}
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-label">饱食度</div>
          <div class="stat-value">{{ selectedPet.hunger }}/100</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">成长值</div>
          <div class="stat-value">
            {{ selectedPet.next_level_threshold ? selectedPet.growth_points + '/' + selectedPet.next_level_threshold : 'MAX' }}
          </div>
        </div>
      </div>

      <!-- 装备的装饰 -->
      <div class="equipped-section">
        <h4>已装备装饰</h4>
        <div class="equipped-slots">
          <div
            v-for="(slot, key) in petStore.slotConfig"
            :key="key"
            class="slot-item"
            :class="{ filled: selectedPet.equipped_decorations[key] }"
          >
            <span class="slot-icon">{{ slot.icon }}</span>
            <span class="slot-label">{{ slot.label }}</span>
            <span v-if="selectedPet.equipped_decorations[key]" class="slot-dec">
              {{ getDecName(selectedPet.equipped_decorations[key]) }}
            </span>
            <span v-else class="slot-empty">空</span>
            <button
              v-if="selectedPet.equipped_decorations[key]"
              class="slot-btn unequip"
              @click="handleUnequip(key)"
            >卸下</button>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button
          v-if="!selectedPet.is_active"
          class="btn btn-primary"
          @click="handleActivate"
          :disabled="actionLoading"
        >
          ⚡ 设为出战
        </button>
        <button
          class="btn btn-feed"
          @click="showFeedModal = true"
          :disabled="actionLoading || selectedPet.is_digesting"
        >
          🍖 喂食
        </button>
      </div>
    </div>

    <!-- 喂食弹窗 -->
    <div v-if="showFeedModal" class="modal-overlay" @click.self="showFeedModal = false">
      <div class="modal-content feed-modal">
        <h3>🍖 选择宠物粮</h3>
        <div class="food-list">
          <div
            v-for="food in availableFood"
            :key="food.item_id"
            class="food-item"
            :class="{ selected: selectedFood?.item_id === food.item_id }"
            @click="selectedFood = food"
          >
            <span class="food-icon">{{ food.icon }}</span>
            <div class="food-info">
              <div class="food-name">{{ food.name }}</div>
              <div class="food-effects">
                <span>成长 +{{ petStore.foodEffects[food.name]?.growth }}</span>
                <span>饱食 +{{ petStore.foodEffects[food.name]?.hunger }}</span>
                <span>消化 {{ petStore.foodEffects[food.name]?.digest_hours }}h</span>
              </div>
            </div>
            <span class="food-count">×{{ food.quantity }}</span>
          </div>
          <div v-if="availableFood.length === 0" class="no-food">
            <p>没有可用的宠物粮</p>
            <p class="hint">去商店购买宠物粮吧！</p>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-cancel" @click="showFeedModal = false">取消</button>
          <button
            class="btn btn-feed"
            @click="handleFeed"
            :disabled="!selectedFood || actionLoading"
          >
            确认喂食
          </button>
        </div>
      </div>
    </div>

    <!-- 消息提示 -->
    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePetStore } from '@/stores/petStore'
import { useShopStore } from '@/stores/shopStore'

const petStore = usePetStore()
const shopStore = useShopStore()

const selectedPet = ref(null)
const showFeedModal = ref(false)
const selectedFood = ref(null)
const actionLoading = ref(false)
const toast = ref({ show: false, message: '', type: 'success' })

// 可用的宠物粮（从背包中筛选）
const availableFood = computed(() => {
  const petFoods = shopStore.backpack.pet_food || []
  return petFoods.filter(f => f.quantity > 0)
})

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 2500)
}

function selectPet(pet) {
  selectedPet.value = pet
}

function getDecName(decId) {
  const dec = petStore.decorations.find(d => d.id === decId)
  return dec ? dec.icon + ' ' + dec.name : '装饰'
}

async function handleActivate() {
  if (!selectedPet.value) return
  actionLoading.value = true
  try {
    await petStore.activatePet(selectedPet.value.user_pet_id)
    selectedPet.value = petStore.pets.find(p => p.user_pet_id === selectedPet.value.user_pet_id)
    showToast('宠物已设为出战！')
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    actionLoading.value = false
  }
}

async function handleFeed() {
  if (!selectedPet.value || !selectedFood.value) return
  actionLoading.value = true
  try {
    const result = await petStore.feedPet(selectedPet.value.user_pet_id, selectedFood.value.item_id)
    selectedPet.value = petStore.pets.find(p => p.user_pet_id === selectedPet.value.user_pet_id)
    await shopStore.loadBackpack()
    showFeedModal.value = false
    selectedFood.value = null

    let msg = `喂食成功！成长+${result.growth_gained}，饱食+${result.hunger_restored}`
    if (result.leveled_up) msg += ` 🎉 升级到 Lv.${result.leveled_up}！`
    showToast(msg)
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    actionLoading.value = false
  }
}

async function handleUnequip(slotType) {
  if (!selectedPet.value) return
  try {
    await petStore.unequipDecoration(selectedPet.value.user_pet_id, slotType)
    selectedPet.value = petStore.pets.find(p => p.user_pet_id === selectedPet.value.user_pet_id)
    showToast('装饰已卸下')
  } catch (e) {
    showToast(e.message, 'error')
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      petStore.loadPets(),
      petStore.loadDecorations(),
      shopStore.loadBackpack()
    ])
  } catch (e) {
    console.error('PetPanel init error:', e)
  }
})
</script>

<style scoped>
.pet-panel {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
}

.panel-header {
  text-align: center;
  margin-bottom: 30px;
}

.panel-header h2 {
  font-size: 1.8rem;
  margin: 0;
  color: #2c5a2a;
}

.subtitle {
  color: #888;
  margin-top: 6px;
  font-size: 0.9rem;
}

.section-title {
  font-size: 1.1rem;
  color: #555;
  margin-bottom: 14px;
  padding-left: 4px;
}

/* 宠物卡片网格 */
.pet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.pet-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.pet-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

.pet-card.active {
  border-width: 2px;
}

.pet-card.selected {
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.3);
}

.pet-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.pet-icon {
  font-size: 2rem;
}

.pet-rarity-badge {
  font-size: 0.65rem;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.active-badge {
  font-size: 0.65rem;
  background: #4caf50;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: auto;
}

.pet-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pet-name {
  font-weight: 600;
  color: #333;
  font-size: 1rem;
}

.pet-level {
  color: #888;
  font-size: 0.85rem;
}

/* 进度条 */
.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 6px;
}

.progress-label {
  font-size: 0.7rem;
  color: #999;
  width: 28px;
  flex-shrink: 0;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-fill.hunger {
  background: #4caf50;
}

.progress-fill.hunger.mid {
  background: #ff9800;
}

.progress-fill.hunger.low {
  background: #f44336;
}

.progress-text {
  font-size: 0.65rem;
  color: #999;
  width: 52px;
  text-align: right;
  flex-shrink: 0;
}

.pet-bonus {
  font-size: 0.8rem;
  color: #4caf50;
  font-weight: 600;
  margin-top: 4px;
}

.pet-bonus.paused {
  color: #f44336;
}

.bonus-paused {
  font-weight: 500;
}

.digesting-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 152, 0, 0.9);
  color: white;
  text-align: center;
  padding: 4px;
  font-size: 0.75rem;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 16px;
}

.empty-hint {
  color: #bbb;
  font-size: 0.85rem;
}

/* 宠物详情 */
.pet-detail {
  background: white;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-top: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.detail-icon {
  font-size: 3rem;
}

.detail-info {
  flex: 1;
}

.detail-info h3 {
  margin: 0;
  font-size: 1.3rem;
  color: #333;
}

.detail-meta {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  align-items: center;
}

.rarity-tag {
  font-size: 0.7rem;
  color: white;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 600;
}

.active-tag {
  font-size: 0.7rem;
  background: #4caf50;
  color: white;
  padding: 2px 10px;
  border-radius: 10px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #999;
  cursor: pointer;
  padding: 4px 8px;
}

.close-btn:hover {
  color: #333;
}

/* 详情属性 */
.detail-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-item {
  flex: 1;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  color: #999;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #4caf50;
}

.stat-value.paused {
  color: #f44336;
}

/* 装备槽位 */
.equipped-section {
  margin-bottom: 20px;
}

.equipped-section h4 {
  font-size: 0.95rem;
  color: #555;
  margin-bottom: 10px;
}

.equipped-slots {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.slot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 10px;
  font-size: 0.85rem;
}

.slot-item.filled {
  background: #e8f5e9;
}

.slot-icon {
  font-size: 1.2rem;
}

.slot-label {
  color: #999;
  font-size: 0.75rem;
}

.slot-dec {
  flex: 1;
  text-align: right;
  font-size: 0.8rem;
  color: #333;
}

.slot-empty {
  flex: 1;
  text-align: right;
  color: #ccc;
  font-size: 0.8rem;
}

.slot-btn {
  background: none;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 0.7rem;
  cursor: pointer;
  color: #666;
}

.slot-btn:hover {
  background: #f44336;
  color: white;
  border-color: #f44336;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 12px;
}

.btn {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4caf50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #43a047;
}

.btn-feed {
  background: #ff9800;
  color: white;
}

.btn-feed:hover:not(:disabled) {
  background: #f57c00;
}

.btn-cancel {
  background: #e0e0e0;
  color: #666;
}

/* 喂食弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 24px;
  max-width: 420px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.feed-modal h3 {
  text-align: center;
  margin: 0 0 16px;
  font-size: 1.2rem;
}

.food-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.food-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 12px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.food-item:hover {
  background: #fff3e0;
}

.food-item.selected {
  border-color: #ff9800;
  background: #fff3e0;
}

.food-icon {
  font-size: 1.5rem;
}

.food-info {
  flex: 1;
}

.food-name {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.food-effects {
  display: flex;
  gap: 8px;
  font-size: 0.7rem;
  color: #888;
  margin-top: 2px;
}

.food-count {
  font-size: 0.85rem;
  color: #666;
  font-weight: 600;
}

.no-food {
  text-align: center;
  padding: 30px;
  color: #999;
}

.no-food .hint {
  font-size: 0.8rem;
  color: #ccc;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

/* Toast */
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 500;
  z-index: 3000;
  animation: slideDown 0.3s ease;
}

.toast.success {
  background: #4caf50;
  color: white;
}

.toast.error {
  background: #f44336;
  color: white;
}

@keyframes slideDown {
  from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .pet-panel {
    color: #e0e0e0;
  }

  .panel-header h2 {
    color: #81c784;
  }

  .pet-card {
    background: #2a2a2f;
  }

  .pet-name {
    color: #e0e0e0;
  }

  .pet-detail {
    background: #2a2a2f;
  }

  .detail-info h3 {
    color: #e0e0e0;
  }

  .stat-item {
    background: #333;
  }

  .slot-item {
    background: #333;
  }

  .slot-item.filled {
    background: #2e3b2e;
  }

  .modal-content {
    background: #2a2a2f;
  }

  .food-item {
    background: #333;
  }

  .food-item.selected {
    background: #3a3020;
  }

  .food-name {
    color: #e0e0e0;
  }
}

/* 响应式 */
@media (max-width: 600px) {
  .pet-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .detail-stats {
    flex-direction: column;
  }

  .equipped-slots {
    grid-template-columns: 1fr;
  }

  .pet-panel {
    padding: 12px;
    padding-bottom: 80px;
  }
}
</style>

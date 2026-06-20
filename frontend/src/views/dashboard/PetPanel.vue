<template>
  <div class="pet-panel">
    <!-- 上方70%：宠物展示区 -->
    <div class="pet-display-area">
      <!-- 未选择宠物时的提示 -->
      <div v-if="!selectedPet && petStore.pets.length > 0" class="no-selection-hint">
        <span class="hint-icon">🐾</span>
        <p>请从下方列表选择一只宠物</p>
      </div>
      
      <!-- 空状态：没有宠物 -->
      <div v-if="petStore.pets.length === 0" class="empty-display">
        <span class="empty-icon">🐾</span>
        <p>还没有宠物</p>
        <p class="empty-hint">去商店购买一只宠物吧！</p>
      </div>
      
      <!-- 已选择宠物：大号动效展示 -->
      <div v-if="selectedPet" class="selected-pet-display">
        <!-- 宠物大图标 -->
        <div class="pet-big-container">
          <div ref="panelEffectContainer" class="panel-effect-container"></div>
          <div class="pet-big-icon">{{ selectedPet.icon }}</div>
          <!-- 装饰槽位（四个，绕宠物旋转） -->
          <div class="decoration-slots">
            <div
              v-for="(slot, key, index) in petStore.slotConfig"
              :key="key"
              class="deco-slot"
              :style="getSlotPosition(index)"
              @click="openEquipModal(key)"
            >
              <span v-if="selectedPet.equipped_decorations[key]" class="deco-equipped">
                {{ getDecIcon(selectedPet.equipped_decorations[key]) }}
              </span>
              <span v-else class="deco-empty">⚪</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 宠物控制面板（贴近宠物栏上方） -->
    <div v-if="selectedPet" class="pet-control-panel">
      <div class="control-left">
        <span class="pet-name">{{ selectedPet.name }}</span>
        <span class="rarity-badge" :style="{ background: petStore.rarityConfig[selectedPet.rarity]?.color }">
          {{ petStore.rarityConfig[selectedPet.rarity]?.label }}
        </span>
        <span v-if="selectedPet.is_active" class="active-badge">出战中</span>
        <span v-if="isTestPet" class="test-pet-badge">🧪 测试宠物</span>
        <span class="level-badge">Lv.{{ selectedPet.level }}</span>
        <span class="bonus-display" :class="{ paused: selectedPet.hunger <= 0, 'test-bonus': isTestPet }">
          {{ selectedPet.hunger > 0 ? '+' + selectedPet.current_bonus + '%' : '暂停' }}
        </span>
        <span v-if="selectedPet.level_bonus" class="base-bonus-tag">
          基础+{{ selectedPet.level_bonus }}%
        </span>
      </div>
      <div class="control-right">
        <div class="bars-row">
          <div class="mini-bar-group">
            <span class="bar-label">饱食</span>
            <div class="mini-bar">
              <div
                class="mini-bar-fill hunger"
                :class="{ low: selectedPet.hunger < 20, mid: selectedPet.hunger >= 20 && selectedPet.hunger < 50 }"
                :style="{ width: selectedPet.hunger + '%' }"
              ></div>
            </div>
            <span class="bar-value">{{ selectedPet.hunger }}/{{ selectedPet.max_hunger || 100 }}</span>
          </div>
          <div class="mini-bar-group">
            <span class="bar-label">成长</span>
            <div class="mini-bar">
              <div
                class="mini-bar-fill growth"
                :style="{ width: selectedPet.next_level_threshold ? Math.min(100, (selectedPet.growth_points / selectedPet.next_level_threshold) * 100) + '%' : '100%' }"
              ></div>
            </div>
            <span class="bar-value">{{ selectedPet.next_level_threshold ? Math.floor((selectedPet.growth_points / selectedPet.next_level_threshold) * 100) + '%' : 'MAX' }}</span>
          </div>
        </div>
        <div class="action-btns">
          <button
            class="btn btn-activate"
            :class="{ active: selectedPet.is_active }"
            @click="handleActivate"
            :disabled="actionLoading"
          >{{ selectedPet.is_active ? '⏸️' : '⚡' }}<span class="btn-text">{{ selectedPet.is_active ? '休息' : '出战' }}</span></button>
          <button
            class="btn btn-feed"
            @click="showFeedModal = true"
            :disabled="actionLoading || isTestPet"
            :title="isTestPet ? '测试宠物不可喂食' : ''"
          >🍖<span class="btn-text">喂食</span></button>
          <button
            class="btn btn-upgrade"
            @click="canLevelUp ? showUpgradeModal = true : null"
            :disabled="!canLevelUp || actionLoading || isTestPet"
            :title="!canLevelUp ? `成长值不足，需要 ${selectedPet.next_level_threshold} 点` : isTestPet ? '测试宠物不可升级' : `点击升级`"
          >⬆️<span class="btn-text">升级</span></button>
          <button
            class="btn btn-equip"
            @click="openEquipModal()"
            :disabled="actionLoading"
          >💎<span class="btn-text">饰品</span></button>
        </div>

      </div>
    </div>
    
    <!-- 下方30%：宠物列表（可滑动） -->
    <div class="pet-list-area">
      <div class="list-header">
        <h3>我的宠物</h3>
        <span class="pet-count">({{ petStore.pets.length }}只)</span>
      </div>
      
      <div class="pet-list-scroll">
        <div
          v-for="pet in petStore.pets"
          :key="pet.user_pet_id"
          class="pet-list-item"
          :class="{ active: pet.is_active, selected: selectedPet?.user_pet_id === pet.user_pet_id }"
          @click="selectPet(pet)"
        >
          <span class="list-pet-icon">{{ pet.icon }}</span>
          <div class="list-pet-info">
            <span class="list-pet-name">{{ pet.name }}<span v-if="pet.is_test" class="test-tag">测试</span></span>
            <span class="list-pet-level">Lv.{{ pet.level }}</span>
          </div>
          <span class="list-pet-bonus" :class="{ paused: pet.hunger <= 0 }">
            {{ pet.hunger > 0 ? '+' + pet.current_bonus + '%' : '暂停' }}
          </span>
          <span v-if="pet.is_active" class="list-active-tag">出战</span>
        </div>
        
        <div v-if="petStore.pets.length === 0" class="list-empty">
          <p>暂无宠物</p>
        </div>
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
                <span>饱食 +{{ food.hunger !== undefined ? food.hunger : petStore.foodEffects[food.name]?.hunger }}</span>
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

    <!-- 饰品装备弹窗 -->
    <div v-if="showEquipModal" class="modal-overlay" @click.self="showEquipModal = false">
      <div class="modal-content equip-modal">
        <div class="modal-header">
          <h3>💎 {{ selectedSlot ? '装备饰品 - ' + petStore.slotConfig[selectedSlot]?.label : '饰品管理' }}</h3>
          <button class="close-btn" @click="showEquipModal = false">✕</button>
        </div>
        <div class="equip-body">
          <!-- 已装备的饰品 -->
          <div class="equipped-section">
            <h4>已装备饰品</h4>
            <div class="equipped-grid">
              <div
                v-for="(slot, key) in petStore.slotConfig"
                :key="key"
                class="equip-slot"
                :class="{ selected: selectedSlot === key }"
                @click="selectSlot(key)"
              >
                <span class="slot-icon">{{ slot.icon }}</span>
                <span class="slot-name">{{ slot.label }}</span>
                <div v-if="selectedPet?.equipped_decorations[key]" class="slot-equipped">
                  <span>{{ getDecIcon(selectedPet.equipped_decorations[key]) }}</span>
                  <button class="unequip-btn" @click.stop="handleUnequip(key)">卸下</button>
                </div>
                <span v-else class="slot-empty-text">空</span>
              </div>
            </div>
          </div>
          
          <!-- 背包中的饰品 -->
          <div class="inventory-section">
            <h4>我的饰品</h4>
            <div class="decoration-grid">
              <div
                v-for="dec in availableDecorations"
                :key="dec.item_id"
                class="decoration-item"
                :class="{ 
                  usable: canEquipDecoration(dec) && (!isTestPet || canEquipTestPet(dec)),
                  equipped: isDecorationEquipped(dec),
                  'test-restricted': isTestPet && !canEquipTestPet(dec)
                }"
                @click="isDecorationEquipped(dec) ? handleUnequipByDec(dec) : handleEquip(dec)"
              >
                <span class="dec-icon">{{ dec.icon }}</span>
                <span class="dec-name">{{ dec.name }}</span>
                <span class="dec-bonus">+{{ dec.bonus }}%</span>
                <span class="dec-slot">{{ petStore.slotConfig[dec.slot_type]?.label || petStore.slotConfig[dec.bonus_type]?.label }}</span>
                <span v-if="isDecorationEquipped(dec)" class="equipped-badge">{{ getEquippedPet(dec)?.name }}装备中</span>
              </div>
              <div v-if="availableDecorations.length === 0" class="no-decorations">
                <p>暂无饰品</p>
                <p class="hint">去商店购买饰品吧！</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 升级确认弹窗 -->
    <div v-if="showUpgradeModal" class="modal-overlay" @click.self="showUpgradeModal = false">
      <div class="modal-content upgrade-modal">
        <div class="upgrade-icon">🎉</div>
        <h3>宠物升级</h3>
        <p>成长值已满，确定要升级吗？</p>
        <div class="upgrade-preview">
          <div class="preview-row">
            <span>当前等级</span>
            <span>Lv.{{ selectedPet?.level }}</span>
          </div>
          <div class="preview-arrow">⬆️</div>
          <div class="preview-row">
            <span>升级后</span>
            <span>Lv.{{ (selectedPet?.level || 0) + 1 }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-cancel" @click="showUpgradeModal = false">取消</button>
          <button
            class="btn btn-upgrade"
            @click="handleUpgrade"
            :disabled="actionLoading"
          >
            确认升级
          </button>
        </div>
      </div>
    </div>

    <!-- 喂食溢出确认弹窗 -->
    <ConfirmModal
      :visible="showOverflowConfirm"
      title="饱食度溢出"
      :message="overflowData?.message || '饱食度将溢出，确认继续？'"
      icon="🍖"
      confirm-text="确认喂食"
      cancel-text="取消"
      @confirm="confirmFeedOverflow"
      @cancel="showOverflowConfirm = false; pendingFoodId = null; overflowData = null"
    />

    <!-- 消息提示 -->
    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { usePetStore } from '@/stores/petStore'
import { useShopStore } from '@/stores/shopStore'
import { loadEffect } from '@/effects'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const petStore = usePetStore()
const shopStore = useShopStore()

const selectedPet = ref(null)
const showFeedModal = ref(false)
const showEquipModal = ref(false)
const showUpgradeModal = ref(false)
const showOverflowConfirm = ref(false)
const overflowData = ref(null)
const pendingFoodId = ref(null)
const selectedFood = ref(null)
const selectedSlot = ref(null)
const actionLoading = ref(false)
const toast = ref({ show: false, message: '', type: 'success' })
const hungerDecayTime = ref(0) // 饥饿倒计时（分钟）
const panelEffectContainer = ref(null)
let panelEffectInstance = null

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
  const raw = pet.effect_file || petEffectMap[pet.name] || null
  return raw ? raw.replace(/\.js$/, '') : null
}

function loadPanelEffect() {
  if (panelEffectInstance) {
    panelEffectInstance.destroy()
    panelEffectInstance = null
  }
  if (!panelEffectContainer.value || !selectedPet.value) return
  panelEffectContainer.value.innerHTML = ''
  // 只有装备了特殊槽位饰品才显示特效
  const equippedSpecial = selectedPet.value.equipped_decorations?.special
  if (!equippedSpecial) return
  const effectName = getEffectName(selectedPet.value)
  if (!effectName) return
  const effect = loadEffect(effectName)
  if (effect) {
    panelEffectInstance = effect.init(panelEffectContainer.value, {
      level: selectedPet.value.level,
      bonus: selectedPet.value.current_bonus,
      scale: 3
    })
  }
}

// 判断是否可以升级
const canLevelUp = computed(() => {
  if (!selectedPet.value || !selectedPet.value.next_level_threshold) return false
  return selectedPet.value.growth_points >= selectedPet.value.next_level_threshold
})

// 判断是否为测试宠物
const isTestPet = computed(() => {
  return selectedPet.value?.is_test === true
})

// 测试宠物只能装备专属竹子
function canEquipTestPet(dec) {
  if (!isTestPet.value) return true
  // 只允许装备竹子（专属饰品）
  return dec.name?.includes('竹子') || dec.is_test_exclusive === true
}

// 可用的宠物粮（从背包中筛选）
const availableFood = computed(() => {
  const petFoods = shopStore.backpack.pet_food || []
  return petFoods.filter(f => f.quantity > 0)
})

// 可用的饰品（从背包中筛选）
const availableDecorations = computed(() => {
  const decs = shopStore.backpack.decoration || []
  return decs.filter(d => d.quantity > 0)
})

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 2500)
}

function selectPet(pet) {
  selectedPet.value = pet
  updateHungerDecayTime()
}

function selectSlot(slot) {
  selectedSlot.value = slot
}

function openEquipModal(slot = null) {
  selectedSlot.value = slot
  showEquipModal.value = true
}

// 获取装饰槽位位置（四个槽位绕宠物排列）
function getSlotPosition(index) {
  const positions = [
    { top: '-30px', left: '50%', transform: 'translateX(-50%)' },  // 上
    { top: '50%', right: '-30px', transform: 'translateY(-50%)' }, // 右
    { bottom: '-30px', left: '50%', transform: 'translateX(-50%)' }, // 下
    { top: '50%', left: '-30px', transform: 'translateY(-50%)' }   // 左
  ]
  return positions[index] || positions[0]
}

function getDecName(decId) {
  const dec = petStore.decorations.find(d => d.id === decId)
  return dec ? dec.icon + ' ' + dec.name : '装饰'
}

function getDecIcon(decId) {
  const dec = petStore.decorations.find(d => d.id === decId)
  return dec ? dec.icon : '❓'
}

// 判断饰品是否可以装备到当前选中的槽位
function canEquipDecoration(dec) {
  if (!selectedSlot.value) return true
  return dec.slot_type === selectedSlot.value
}

// 判断饰品是否已装备（在任意宠物上）
function isDecorationEquipped(dec) {
  for (const pet of petStore.pets) {
    const equipped = pet.equipped_decorations || {}
    if (Object.values(equipped).includes(dec.item_id)) {
      return true
    }
  }
  return false
}

// 获取装备该饰品的宠物信息
function getEquippedPet(dec) {
  for (const pet of petStore.pets) {
    const equipped = pet.equipped_decorations || {}
    if (Object.values(equipped).includes(dec.item_id)) {
      return pet
    }
  }
  return null
}
// 格式化时间（分钟转为小时分钟）
function formatTime(minutes) {
  if (minutes <= 0) return '0分钟'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`
  }
  return `${mins}分钟`
}

// 计算饥饿倒计时
function updateHungerDecayTime() {
  if (!selectedPet.value) {
    hungerDecayTime.value = 0
    return
  }
  const pet = selectedPet.value
  if (pet.is_test) {
    hungerDecayTime.value = 100 * 60 // 测试宠物永远满饱食度
    pet.level = 999
    return
  }
  
  if (pet.hunger <= 0) {
    hungerDecayTime.value = 0
    return
  }
  // 每小时饱食度减少1点，计算剩余时间
  if (!pet.last_fed_at) {
    hungerDecayTime.value = pet.hunger * 60 // 按小时计算
    return
  }
  const lastFed = new Date(pet.last_fed_at).getTime()
  const now = Date.now()
  const hoursElapsed = (now - lastFed) / (1000 * 60 * 60)
  const currentHunger = Math.max(0, pet.hunger - Math.floor(hoursElapsed))
  hungerDecayTime.value = currentHunger * 60 // 剩余小时数转为分钟
}

let hungerTimer = null
let refreshTimer = null
onMounted(async () => {
  try {
    await Promise.all([
      petStore.loadPets(),
      petStore.loadDecorations(),
      shopStore.loadBackpack()
    ])
    if (petStore.pets.length > 0) {
      const activePet = petStore.pets.find(p => p.is_active)
      selectedPet.value = activePet || petStore.pets[0]
      updateHungerDecayTime()
    }
    await nextTick()
    loadPanelEffect()
    hungerTimer = setInterval(updateHungerDecayTime, 5000)
    refreshTimer = setInterval(async () => {
      const currentPetId = selectedPet.value?.user_pet_id
      await petStore.loadPets()
      // 保持当前所选宠物不变
      if (currentPetId) {
        const found = petStore.pets.find(p => p.user_pet_id === currentPetId)
        if (found) {
          selectedPet.value = found
          updateHungerDecayTime()
        }
      }
    }, 5000)
  } catch (e) {
    console.error('PetPanel init error:', e)
  }
})

onUnmounted(() => {
  if (hungerTimer) clearInterval(hungerTimer)
  if (refreshTimer) clearInterval(refreshTimer)
  if (panelEffectInstance) {
    panelEffectInstance.destroy()
    panelEffectInstance = null
  }
})

watch(() => petStore.pets, () => {
  if (selectedPet.value) {
    selectedPet.value = petStore.pets.find(p => p.user_pet_id === selectedPet.value.user_pet_id)
    updateHungerDecayTime()
  }
})

// 宠物切换或装备变化时重新加载特效
watch(() => selectedPet.value?.equipped_decorations, async () => {
  await nextTick()
  loadPanelEffect()
}, { deep: true })

watch(selectedPet, async () => {
  await nextTick()
  loadPanelEffect()
})

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
    updateHungerDecayTime()

    showToast(`喂食成功！饱食度 +${result.hunger_restored}`)
  } catch (e) {
    if (e.overflow) {
      // 溢出确认
      overflowData.value = e.overflowData
      pendingFoodId.value = selectedFood.value.item_id
      showOverflowConfirm.value = true
      showFeedModal.value = false
    } else {
      showToast(e.message, 'error')
    }
  } finally {
    actionLoading.value = false
  }
}

async function confirmFeedOverflow() {
  if (!selectedPet.value || !pendingFoodId.value) return
  showOverflowConfirm.value = false
  actionLoading.value = true
  try {
    const result = await petStore.feedPet(selectedPet.value.user_pet_id, pendingFoodId.value, true)
    selectedPet.value = petStore.pets.find(p => p.user_pet_id === selectedPet.value.user_pet_id)
    await shopStore.loadBackpack()
    selectedFood.value = null
    pendingFoodId.value = null
    overflowData.value = null
    updateHungerDecayTime()
    showToast(`喂食成功！饱食度 +${result.hunger_restored}`)
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    actionLoading.value = false
  }
}

async function handleUpgrade() {
  if (!selectedPet.value || !canLevelUp.value) return
  actionLoading.value = true
  showUpgradeModal.value = false
  try {
    const result = await petStore.upgradePet(selectedPet.value.user_pet_id)
    selectedPet.value = petStore.pets.find(p => p.user_pet_id === selectedPet.value.user_pet_id)
    showToast(`🎉 恭喜！宠物升级到 Lv.${result.new_level}！`)
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    actionLoading.value = false
  }
}

async function handleUnequipByDec(dec) {
  if (!selectedPet.value) return
  
  const equipped = selectedPet.value.equipped_decorations || {}
  let slotType = null
  for (const [key, decId] of Object.entries(equipped)) {
    if (decId === dec.item_id) {
      slotType = key
      break
    }
  }
  
  if (slotType) {
    try {
      await petStore.unequipDecoration(selectedPet.value.user_pet_id, slotType)
      selectedPet.value = petStore.pets.find(p => p.user_pet_id === selectedPet.value.user_pet_id)
      await shopStore.loadBackpack()
      showToast(`卸下 ${dec.icon} ${dec.name} 成功！`)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }
}

async function handleEquip(dec) {
  if (!selectedPet.value) return
  
  // 测试宠物只能装备专属竹子
  if (isTestPet.value && !canEquipTestPet(dec)) {
    showToast('测试宠物只能装备专属饰品 🎋', 'error')
    return
  }
  
  let targetSlot = selectedSlot.value
  if (!targetSlot) {
    targetSlot = dec.slot_type || dec.bonus_type
  }
  
  if (selectedSlot.value && (dec.slot_type || dec.bonus_type) !== selectedSlot.value) {
    showToast(`该饰品只能装备到${petStore.slotConfig[dec.slot_type || dec.bonus_type]?.label}槽位！`, 'error')
    return
  }
  
  actionLoading.value = true
  try {
    const result = await petStore.equipDecoration(selectedPet.value.user_pet_id, targetSlot, dec.item_id)
    selectedPet.value = petStore.pets.find(p => p.user_pet_id === selectedPet.value.user_pet_id)
    await shopStore.loadBackpack()
    if (result.replaced_pet) {
      showToast(`装备 ${dec.icon} ${dec.name} 成功！已从 ${result.replaced_pet.icon} ${result.replaced_pet.name} 卸下`)
    } else {
      showToast(`装备 ${dec.icon} ${dec.name} 成功！`)
    }
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
    await shopStore.loadBackpack()
    showToast('装饰已卸下')
  } catch (e) {
    showToast(e.message, 'error')
  }
}
</script>

<style scoped>
.pet-panel {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
  min-height: calc(100vh - 48px);
}

/* ========== 上方70%：宠物展示区 ========== */
.pet-display-area {
  flex: 1 1 auto;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
}

.no-selection-hint {
  text-align: center;
  color: #888;
}

.hint-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 16px;
}

.empty-display {
  text-align: center;
  color: #999;
}

.empty-display .empty-icon {
  font-size: 5rem;
  display: block;
  margin-bottom: 16px;
}

.empty-hint {
  color: #bbb;
  font-size: 0.9rem;
}

/* 已选择宠物展示 */
.selected-pet-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  justify-content: center;
}

/* 宠物大图标容器 */
.pet-big-container {
  position: relative;
  width: min(384px, 80vw);
  height: min(384px, 80vw);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pet-big-icon {
  font-size: 240px;
  z-index: 10;
  animation: petFloat 3s ease-in-out infinite;
}

.panel-effect-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  height: 300px;
  z-index: 5;
  pointer-events: none;
  overflow: visible;
}

@keyframes petFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-25px); }
}

/* 装饰槽位（旋转） */
.decoration-slots {
  position: absolute;
  width: 100%;
  height: 100%;
  animation: slotsRotate 20s linear infinite;
  z-index: 15;
}

@keyframes slotsRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.deco-slot {
  position: absolute;
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 20;
}

.deco-slot:hover {
  transform: scale(1.15);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.3);
}

.deco-equipped {
  font-size: 48px;
}

.deco-empty {
  font-size: 43px;
  opacity: 0.5;
}

/* ========== 宠物控制面板（贴近宠物栏上方） ========== */
.pet-control-panel {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  gap: 8px;
}

.control-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex-direction: row;
  width: 100%;
}

.control-left .pet-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: #2c5a2a;
}

.rarity-badge {
  font-size: 0.65rem;
  color: white;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
}

.active-badge {
  font-size: 0.65rem;
  background: #4caf50;
  color: white;
  padding: 2px 8px;
  border-radius: 8px;
}

.level-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: #666;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 6px;
}

.bonus-display {
  font-size: 0.9rem;
  font-weight: 700;
  color: #4caf50;
}

.bonus-display.paused {
  color: #f44336;
}

.base-bonus-tag {
  font-size: 0.6rem;
  color: #888;
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 4px;
}

.bonus-display.test-bonus {
  color: #ff9800;
  font-size: 1rem;
  text-shadow: 0 0 8px rgba(255, 152, 0, 0.4);
}

.test-pet-badge {
  font-size: 0.65rem;
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: white;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
}

.test-tag {
  font-size: 0.6rem;
  background: #ff9800;
  color: white;
  padding: 1px 6px;
  border-radius: 6px;
  margin-left: 4px;
  vertical-align: middle;
}

.decoration-item.test-restricted {
  opacity: 0.3;
  cursor: not-allowed;
  border-color: #ff9800;
  background: rgba(255, 152, 0, 0.05);
}

.decoration-item.test-restricted::after {
  content: '🔒';
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 0.8rem;
}

.control-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-direction: row;
  width: 100%;
  justify-content: space-between;
}

.bars-row {
  display: flex;
  gap: 12px;
}

.mini-bar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mini-bar-group .bar-label {
  font-size: 0.65rem;
  color: #888;
  width: 32px;
}

.mini-bar {
  width: 60px;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.mini-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.mini-bar-fill.hunger {
  background: #4caf50;
}

.mini-bar-fill.hunger.mid {
  background: #ff9800;
}

.mini-bar-fill.hunger.low {
  background: #f44336;
}

.mini-bar-fill.growth {
  background: #2196f3;
}

.mini-bar-group .bar-value {
  font-size: 0.65rem;
  color: #888;
  width: 35px;
  text-align: right;
}

.action-btns {
  display: flex;
  gap: 6px;
}

.action-btns .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 36px;
  padding: 6px 12px;
  border: none;
  border-radius: 10px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-text {
  font-size: 0.85rem;
  font-weight: 600;
}

.action-btns .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-activate {
  background: #4caf50;
  color: white;
}

.btn-activate:hover:not(:disabled) {
  background: #43a047;
  transform: scale(1.05);
}

.btn-feed {
  background: #ff9800;
  color: white;
}

.btn-feed:hover:not(:disabled) {
  background: #f57c00;
  transform: scale(1.05);
}

.btn-upgrade {
  background: #9c27b0;
  color: white;
}

.btn-upgrade:hover:not(:disabled) {
  background: #7b1fa2;
  transform: scale(1.05);
}

.btn-equip {
  background: #2196f3;
  color: white;
}

.btn-equip:hover:not(:disabled) {
  background: #1976d2;
  transform: scale(1.05);
}

/* 弹窗按钮样式 */
.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 16px;
}

.modal-actions .btn {
  padding: 10px 24px;
  border: none;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-actions .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-actions .btn-cancel {
  background: #e0e0e0;
  color: #666;
}

.modal-actions .btn-cancel:hover:not(:disabled) {
  background: #d0d0d0;
}

.modal-actions .btn-feed {
  background: #ff9800;
  color: white;
}

.modal-actions .btn-feed:hover:not(:disabled) {
  background: #f57c00;
}


/* ========== 下方30%：宠物列表 ========== */
.pet-list-area {
  flex: 0 0 auto;
  max-height: 30vh;
  min-height: 120px;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.list-header h3 {
  font-size: 1rem;
  color: #2c5a2a;
  margin: 0;
}

.pet-count {
  font-size: 0.8rem;
  color: #999;
}

.pet-list-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
}

.pet-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.pet-list-item:hover {
  background: #e8f5e9;
}

.pet-list-item.selected {
  border-color: #4caf50;
  background: #e8f5e9;
}

.pet-list-item.active {
  border-color: #4caf50;
}

.list-pet-icon {
  font-size: 2rem;
}

.list-pet-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.list-pet-name {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.list-pet-level {
  font-size: 0.75rem;
  color: #888;
}

.list-pet-bonus {
  font-size: 0.85rem;
  font-weight: 600;
  color: #4caf50;
}

.list-pet-bonus.paused {
  color: #f44336;
}

.list-active-tag {
  font-size: 0.65rem;
  background: #4caf50;
  color: white;
  padding: 2px 8px;
  border-radius: 8px;
}

.list-empty {
  text-align: center;
  padding: 20px;
  color: #999;
}

/* ========== 喂食弹窗 ========== */
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
    background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
    color: #e0e0e0;
  }

  /* 宠物控制面板深色适配 */
  .pet-control-panel {
    background: rgba(30, 30, 35, 0.95);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .control-left .pet-name {
    color: #81c784;
  }

  .level-badge {
    background: #333;
    color: #aaa;
  }

  .mini-bar {
    background: #444;
  }

  .mini-bar-group .bar-label,
  .mini-bar-group .bar-value {
    color: #aaa;
  }

  .deco-slot {
    background: rgba(40, 40, 45, 0.9);
  }

  .pet-list-area {
    background: rgba(30, 30, 35, 0.95);
    border-top-color: rgba(255, 255, 255, 0.08);
  }

  .list-header h3 {
    color: #81c784;
  }

  .pet-list-item {
    background: #2a2a2f;
  }

  .pet-list-item:hover,
  .pet-list-item.selected {
    background: #2e3b2e;
  }

  .list-pet-name {
    color: #e0e0e0;
  }

  .list-pet-level {
    color: #aaa;
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
  .pet-panel {
    height: calc(100vh - 48px - 70px);
    min-height: auto;
  }

  /* 展示区占据剩余空间 */
  .pet-display-area {
    flex: 1;
    min-height: 0;
    padding: 8px;
  }

  .pet-big-container {
    width: min(180px, 60vw);
    height: min(180px, 60vw);
  }

  .pet-big-icon {
    font-size: 100px;
  }

  .deco-slot {
    width: 36px;
    height: 36px;
  }

  .deco-equipped {
    font-size: 20px;
  }

  .deco-empty {
    font-size: 14px;
  }

  /* 控制面板纵向堆叠 */
  .pet-control-panel {
    flex-direction: column;
    align-items: flex-start;
    padding: 10px 12px;
    gap: 8px;
  }

  .control-left {
    width: 100%;
    gap: 6px;
  }

  .control-left .pet-name {
    font-size: 0.95rem;
  }

  .rarity-badge,
  .active-badge,
  .test-pet-badge,
  .level-badge {
    font-size: 0.6rem;
    padding: 2px 6px;
  }

  .bonus-display {
    font-size: 0.8rem;
  }

  .base-bonus-tag {
    font-size: 0.55rem;
  }

  /* 右侧：进度条 + 按钮纵向 */
  .control-right {
    width: 100%;
    flex-direction: column;
    gap: 8px;
  }

  .bars-row {
    width: 100%;
    gap: 8px;
  }

  .mini-bar-group {
    flex: 1;
  }

  .mini-bar {
    flex: 1;
    min-width: 40px;
  }

  .mini-bar-group .bar-label {
    width: 28px;
    font-size: 0.6rem;
  }

  .mini-bar-group .bar-value {
    width: 40px;
    font-size: 0.6rem;
  }

  /* 操作按钮横向均分 */
  .action-btns {
    width: 100%;
    display: flex;
    gap: 6px;
  }

  .action-btns .btn {
    flex: 1;
    padding: 10px 0;
    font-size: 1.1rem;
    text-align: center;
  }

  /* 宠物列表 */
  .pet-list-area {
    flex: 0 0 auto;
    max-height: 30vh;
    min-height: 120px;
  }

  .pet-list-item {
    padding: 8px 12px;
  }

  .list-pet-icon {
    font-size: 1.3rem;
  }

  .list-pet-name {
    font-size: 0.8rem;
  }

  /* 移动端隐藏按钮文字 */
  .btn-text {
    display: none;
  }
}

/* ========== 饰品弹窗样式 ========== */
.equip-modal {
  max-width: 460px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #2c5a2a;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #999;
  padding: 4px 8px;
  border-radius: 8px;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.equip-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.equipped-section h4,
.inventory-section h4 {
  font-size: 0.95rem;
  color: #555;
  margin-bottom: 12px;
}

.equipped-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.equip-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 12px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.equip-slot:hover {
  background: #e8f5e9;
}

.equip-slot.selected {
  border-color: #4caf50;
  background: #e8f5e9;
}

.slot-icon {
  font-size: 1.2rem;
  margin-bottom: 4px;
}

.slot-name {
  font-size: 0.7rem;
  color: #888;
}

.slot-equipped {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.slot-equipped span {
  font-size: 1.5rem;
}

.unequip-btn {
  font-size: 0.65rem;
  background: #f44336;
  color: white;
  border: none;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.slot-empty-text {
  font-size: 0.7rem;
  color: #ccc;
  margin-top: 4px;
}

.decoration-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.decoration-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px;
  background: #f8f9fa;
  border-radius: 12px;
  cursor: pointer;
  border: 2px solid transparent;
  opacity: 0.5;
  position: relative;
}

.decoration-item.usable {
  opacity: 1;
  border-color: transparent;
  transition: all 0.2s ease;
}

.decoration-item.usable:hover {
  border-color: #4caf50;
  background: #e8f5e9;
}

.decoration-item.equipped {
  opacity: 0.6;
  background: #e0e0e0;
  border-color: #9e9e9e;
}

.decoration-item.equipped:hover {
  opacity: 0.8;
  background: #d0d0d0;
  border-color: #f44336;
}

.equipped-badge {
  font-size: 0.65rem;
  color: #757575;
  background: #e0e0e0;
  padding: 2px 8px;
  border-radius: 10px;
  margin-top: 4px;
}

.dec-icon {
  font-size: 2rem;
  margin-bottom: 6px;
}

.dec-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}

.dec-bonus {
  font-size: 0.75rem;
  color: #4caf50;
  font-weight: 600;
}

.dec-slot {
  font-size: 0.65rem;
  color: #888;
  margin-top: 2px;
}

.no-decorations {
  text-align: center;
  padding: 30px;
  color: #999;
  grid-column: 1 / -1;
}

.no-decorations .hint {
  font-size: 0.8rem;
  color: #ccc;
}

/* ========== 升级弹窗样式 ========== */
.upgrade-modal {
  text-align: center;
}

.upgrade-icon {
  font-size: 4rem;
  margin-bottom: 12px;
}

.upgrade-modal h3 {
  font-size: 1.4rem;
  color: #2c5a2a;
  margin: 0 0 8px;
}

.upgrade-modal p {
  color: #888;
  margin: 0 0 20px;
}

.upgrade-preview {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 0.95rem;
}

.preview-row span:first-child {
  color: #888;
}

.preview-row span:last-child {
  font-weight: 600;
  color: #2c5a2a;
}

.preview-arrow {
  text-align: center;
  padding: 8px 0;
  font-size: 1.2rem;
}

/* ========== 全局滚动条样式 ========== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* 深色模式滚动条 */
@media (prefers-color-scheme: dark) {
  ::-webkit-scrollbar-track {
    background: #333;
  }

  ::-webkit-scrollbar-thumb {
    background: #555;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #666;
  }

  .equip-modal {
    background: #2a2a2f;
  }

  .modal-header h3 {
    color: #81c784;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .equipped-section h4,
  .inventory-section h4 {
    color: #bbb;
  }

  .equip-slot {
    background: #333;
  }

  .equip-slot:hover,
  .equip-slot.selected {
    background: #2e3b2e;
  }

  .slot-name {
    color: #aaa;
  }

  .slot-empty-text {
    color: #555;
  }

  .decoration-item {
    background: #333;
  }

  .decoration-item.usable:hover {
    background: #2e3b2e;
  }

  .decoration-item.equipped {
    background: #444;
    border-color: #555;
  }

  .decoration-item.equipped:hover {
    background: #4a4a4a;
    border-color: #f44336;
  }

  .decoration-item.test-restricted {
    background: rgba(255, 152, 0, 0.08);
    border-color: #555;
  }

  .test-pet-badge {
    background: linear-gradient(135deg, #ff9800, #e65100);
  }

  .bonus-display.test-bonus {
    color: #ffb74d;
    text-shadow: 0 0 8px rgba(255, 183, 77, 0.4);
  }

  .test-tag {
    background: #e65100;
  }

  .equipped-badge {
    color: #bbb;
    background: #555;
  }

  .dec-name {
    color: #e0e0e0;
  }

  .no-decorations {
    color: #666;
  }

  .no-decorations .hint {
    color: #555;
  }

  .upgrade-modal {
    background: #2a2a2f;
  }

  .upgrade-modal h3 {
    color: #81c784;
  }

  .upgrade-preview {
    background: #333;
  }

  .preview-row span:first-child {
    color: #aaa;
  }

  .preview-row span:last-child {
    color: #81c784;
  }
}
</style>

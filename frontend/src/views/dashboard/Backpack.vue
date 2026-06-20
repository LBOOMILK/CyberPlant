<template>
  <div class="backpack-page">
    <h1>🎒 我的背包</h1>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-msg">加载中...</div>

    <!-- 分组列表 -->
    <div v-else class="groups-container">
      <div
        v-for="group in displayGroups"
        :key="group.type"
        class="group-section"
      >
        <!-- 分组标题（可折叠） -->
        <div class="group-header" @click="toggleGroup(group.type)">
          <span class="group-icon">{{ group.icon }}</span>
          <span class="group-label">{{ group.label }}</span>
          <span class="group-count">({{ group.items.length }}种 / {{ groupTotal(group.items) }}个)</span>
          <span class="collapse-arrow" :class="{ collapsed: !expanded[group.type] }">▼</span>
        </div>

        <!-- 物品网格 -->
        <div v-if="expanded[group.type]" class="items-grid">
          <div v-if="group.items.length === 0" class="empty-group-hint">
            暂无物品
          </div>
          <div
            v-for="item in group.items"
            :key="item.item_id"
            class="item-card"
            :class="[`rarity-border-${item.rarity}`]"
          >
            <div class="item-icon">{{ item.icon }}</div>
            <div class="item-name">{{ item.name }}</div>
            <div class="item-rarity" :class="`rarity-${item.rarity}`">{{ item.rarity }}</div>
            <div class="item-quantity">×{{ item.quantity }}</div>
            <div v-if="item.item_type !== 'decoration'" class="item-sell-price">
              卖价：
              <img
                :src="getCurrencyIcon(item.currency_type)"
                :alt="item.currency_type"
                class="currency-icon-sm"
              />
              {{ item.sell_price }}
            </div>
            <button
              v-if="item.item_type !== 'decoration'"
              class="sell-btn"
              @click="openSellModal(item)"
            >
              出售
            </button>
            <div v-else class="no-sell-hint">不可出售</div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
    </div>

    <!-- Toast -->
    <Toast ref="toastRef" />

    <!-- 出售确认弹窗 -->
    <Modal
      :visible="sellModalVisible"
      title="出售确认"
      :message="sellModalMessage"
      confirm-text="确认出售"
      cancel-text="取消"
      :showQuantity="true"
      :unitPrice="sellItem?.sell_price || 0"
      :initialQuantity="1"
      :maxQuantity="sellItem?.quantity || 1"
      :currencyName="shopStore.currencyNames[sellItem?.currency_type] || '银币'"
      @confirm="handleSellConfirm"
      @cancel="sellModalVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useShopStore } from '@/stores/shopStore'
import { useUserStore } from '@/stores/userStore'
import Modal from '@/components/common/Modal.vue'
import Toast from '@/components/common/Toast.vue'

const shopStore = useShopStore()
const userStore = useUserStore()
const toastRef = ref(null)
const loading = ref(true)

// 折叠状态
const expanded = reactive({
  seed: true,
  fertilizer: true,
  crop: true,
  pet_food: true,
  pet: true,
  decoration: true
})

// 分组配置
const groupConfig = {
  seed: { icon: '🌱', label: '种子' },
  fertilizer: { icon: '🧪', label: '肥料' },
  crop: { icon: '🌾', label: '作物' },
  pet_food: { icon: '🍖', label: '宠物粮' },
  pet: { icon: '🐾', label: '宠物' },
  decoration: { icon: '🎀', label: '装饰' }
}

// 货币图标
const currencyIconMap = {
  silver_coin: '/silver_icon.png',
  gold_coin: '/gold_icon.png',
  diamond: '/diamond.png'
}

// 出售弹窗状态
const sellModalVisible = ref(false)
const sellItem = ref(null)
const sellModalMessage = ref('')

// 计算显示的分组（显示所有分组）
const displayGroups = computed(() => {
  const groups = []
  const order = ['seed', 'fertilizer', 'crop', 'pet_food']
  for (const type of order) {
    const items = shopStore.backpack[type] || []
    groups.push({
      type,
      icon: groupConfig[type]?.icon || '📦',
      label: groupConfig[type]?.label || type,
      items
    })
  }
  return groups
})

// 总物品数
const totalItems = computed(() => {
  let total = 0
  for (const group of displayGroups.value) {
    total += group.items.length
  }
  return total
})

function groupTotal(items) {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}

function getCurrencyIcon(type) {
  return currencyIconMap[type] || '/silver_icon.png'
}

function toggleGroup(type) {
  expanded[type] = !expanded[type]
}

function addToast(message, type = 'info') {
  if (toastRef.value) {
    toastRef.value.addToast(message, type)
  }
}

// 打开出售弹窗
function openSellModal(item) {
  sellItem.value = item
  sellModalMessage.value = `出售 ${item.icon} ${item.name}？（单价 ${item.sell_price}）`
  sellModalVisible.value = true
}

// 确认出售
async function handleSellConfirm(quantity) {
  if (!sellItem.value) return
  try {
    await shopStore.sell(sellItem.value.item_id, quantity)
    const totalRevenue = sellItem.value.sell_price * quantity
    addToast(`出售成功！获得 ${totalRevenue} ${shopStore.currencyNames[sellItem.value.currency_type] || ''}`, 'success')
  } catch (error) {
    addToast(`💔 ${error.message || '出售失败'}`, 'error')
  } finally {
    sellModalVisible.value = false
    sellItem.value = null
  }
}

// 初始化
onMounted(async () => {
  try {
    await userStore.loadFromLocal()
    await shopStore.loadBackpack()
  } catch (error) {
    console.error('Backpack init error:', error)
    addToast(error.message || '加载失败', 'error')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.backpack-page {
  min-height: 100vh;
  padding: 40px 20px 80px;
  background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
}

.backpack-page h1 {
  text-align: center;
  color: #2c5a2a;
  margin-bottom: 24px;
}

.groups-container {
  max-width: 900px;
  margin: 0 auto;
}

/* 分组标题 */
.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  background: rgba(255, 248, 235, 0.9);
  border-radius: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.group-header:hover {
  background: rgba(255, 248, 235, 1);
}

.group-icon {
  font-size: 1.4rem;
}

.group-label {
  font-weight: bold;
  font-size: 1.1rem;
  color: #2c5a2a;
}

.group-count {
  color: #888;
  font-size: 0.9rem;
  margin-left: 4px;
}

.collapse-arrow {
  margin-left: auto;
  font-size: 0.8rem;
  color: #888;
  transition: transform 0.2s;
}

.collapse-arrow.collapsed {
  transform: rotate(-90deg);
}

/* 物品网格 */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
  padding: 0 8px;
}

.item-card {
  background: rgba(255, 248, 235, 0.95);
  border-radius: 20px;
  padding: 16px 12px;
  text-align: center;
  border: 3px solid transparent;
  transition: transform 0.2s;
}

.item-card:hover {
  transform: translateY(-2px);
}

.rarity-border-C { border-color: #9e9e9e33; }
.rarity-border-B { border-color: #4caf5033; }
.rarity-border-A { border-color: #2196f333; }
.rarity-border-S { border-color: #9c27b033; }
.rarity-border-SSS { border-color: #ffd70055; }

.item-icon {
  font-size: 40px;
  margin-bottom: 6px;
}

.item-name {
  font-weight: bold;
  font-size: 0.9rem;
  color: #333;
  margin-bottom: 4px;
}

.item-rarity {
  display: inline-block;
  padding: 2px 12px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: bold;
  margin-bottom: 6px;
}

.rarity-C { background: #9e9e9e; color: white; }
.rarity-B { background: #4caf50; color: white; }
.rarity-A { background: #2196f3; color: white; }
.rarity-S { background: #9c27b0; color: white; }
.rarity-SSR { background: #f44336; color: white; }
.rarity-SSS { background: linear-gradient(135deg, #ffd700, #ff8c00); color: #2d2b15; }

.item-quantity {
  font-size: 1.2rem;
  font-weight: bold;
  color: #2e7d32;
  margin-bottom: 4px;
}

.item-sell-price {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 0.8rem;
  color: #e65100;
  margin-bottom: 8px;
}

.currency-icon-sm {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.sell-btn {
  background: #ff9800;
  color: white;
  border: none;
  padding: 6px 20px;
  border-radius: 40px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.8rem;
  transition: background 0.2s;
}

.sell-btn:hover {
  background: #e68900;
}

.no-sell-hint {
  font-size: 0.75rem;
  color: #aaa;
  margin-top: 4px;
}

.empty-group-hint {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 0.9rem;
  grid-column: 1 / -1;
}

.loading-msg,
.empty-msg {
  text-align: center;
  padding: 60px 20px;
  color: #666;
  font-size: 1.1rem;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .backpack-page {
    background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
  }

  .backpack-page h1 {
    color: #8bc34a;
  }

  .group-header {
    background: rgba(30, 30, 25, 0.9);
  }

  .group-header:hover {
    background: rgba(30, 30, 25, 0.95);
  }

  .group-label {
    color: #8bc34a;
  }

  .group-count {
    color: #888;
  }

  .item-card {
    background: rgba(30, 30, 25, 0.95);
    color: #e0e0d0;
  }

  .item-name {
    color: #e0e0d0;
  }

  .item-quantity {
    color: #81c784;
  }

  .item-sell-price {
    color: #ffb74d;
  }

  .sell-btn {
    background: #e65100;
  }

  .sell-btn:hover {
    background: #bf360c;
  }

  .empty-group-hint {
    color: #888;
  }

  .loading-msg,
  .empty-msg {
    color: #aaa;
  }
}

@media (max-width: 768px) {
  .items-grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 12px;
  }

  .item-card {
    padding: 14px 10px;
  }

  .item-icon {
    font-size: 36px;
  }
}
</style>

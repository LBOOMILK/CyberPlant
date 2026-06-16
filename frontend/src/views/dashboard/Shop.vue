<template>
  <div class="shop-page">
    <h1>🛒 商店</h1>

    <!-- Tab 栏 -->
    <div class="tab-bar">
      <button
        v-for="tab in shopStore.tabs"
        :key="tab.key"
        :class="['tab-btn', { active: shopStore.currentTab === tab.key }]"
        @click="switchTab(tab.key)"
      >
        {{ tab.icon }} {{ tab.label }}
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="shopStore.loading" class="loading-msg">加载中...</div>

    <!-- 商品网格（过滤掉测试宠物） -->
    <div v-else-if="visibleShopItems.length > 0" class="items-grid">
      <div
        v-for="item in visibleShopItems"
        :key="item.id"
        class="item-card"
        :class="[`rarity-border-${item.rarity}`, { 'sold-out': item.sold_out }]"
      >
        <div class="item-icon">{{ item.icon }}</div>
        <div class="item-name">{{ item.name }}</div>
        <div class="item-rarity" :class="`rarity-${item.rarity}`">{{ item.rarity }}</div>
        <div class="item-price">
          <img
            :src="shopStore.currencyIcons[item.currency_type]"
            :alt="shopStore.currencyNames[item.currency_type]"
            class="currency-icon"
          />
          <span>{{ item.buy_price }}</span>
        </div>
        <div v-if="item.sold_out" class="sold-out-badge">
          {{ item.sold_out === '已拥有' ? '已拥有' : '售罄' }}
        </div>
        <div v-else-if="getOwnedQty(item.id, item.item_type) > 0" class="owned-badge">
          已拥有 {{ getOwnedQty(item.id, item.item_type) }}
        </div>
        <button class="buy-btn" @click="openBuyModal(item)" :disabled="!!item.sold_out || (item.item_type === 'decoration' && getOwnedQty(item.id, item.item_type) >= 1)">购买</button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-msg">
      暂无商品
    </div>

    <!-- Toast -->
    <Toast ref="toastRef" />

    <!-- 购买确认弹窗 -->
    <Modal
      :visible="buyModalVisible"
      title="购买确认"
      :message="buyModalMessage"
      confirm-text="确认购买"
      cancel-text="取消"
      :showQuantity="true"
      :unitPrice="buyItem?.buy_price || 0"
      :initialQuantity="1"
      :maxQuantity="maxBuyQty"
      :currencyName="shopStore.currencyNames[buyItem?.currency_type] || '积分'"
      @confirm="handleBuyConfirm"
      @cancel="buyModalVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useShopStore } from '@/stores/shopStore'
import { useUserStore } from '@/stores/userStore'
import Modal from '@/components/common/Modal.vue'
import Toast from '@/components/common/Toast.vue'

const shopStore = useShopStore()
const userStore = useUserStore()
const toastRef = ref(null)

// 购买弹窗状态
const buyModalVisible = ref(false)
const buyItem = ref(null)
const buyModalMessage = ref('')
const maxBuyQty = ref(1)

function addToast(message, type = 'info') {
  if (toastRef.value) {
    toastRef.value.addToast(message, type)
  }
}

// 过滤掉测试宠物（不可购买且标记为测试的宠物不在商店显示）
const visibleShopItems = computed(() => {
  return shopStore.shopItems.filter(item => {
    if (item.item_type === 'pet' && item.is_test && item.purchasable === false) {
      return false
    }
    return true
  })
})

// 获取背包中某物品的拥有数量（按 item_type 精确匹配）
function getOwnedQty(itemId, itemType) {
  // pets 和 decorations 不在背包里，数量为 0
  if (itemType === 'pet' || itemType === 'decoration') return 0
  return shopStore.getItemCount(itemId, itemType)
}

// 切换 Tab
async function switchTab(tab) {
  try {
    await shopStore.loadShop(tab)
    await shopStore.loadBackpack()
  } catch (error) {
    addToast(error.message || '加载失败', 'error')
  }
}

// 打开购买弹窗
function openBuyModal(item) {
  console.log('openBuyModal called', item)
  buyItem.value = item
  buyModalMessage.value = `购买 ${item.icon} ${item.name}？`

  // 计算最大可购买数量
  const balance = userStore.currencies[item.currency_type] || 0
  const maxByBalance = item.buy_price > 0 ? Math.floor(balance / item.buy_price) : 0
  // 宠物和装饰限购 1 个
  if (item.item_type === 'pet' || item.item_type === 'decoration') {
    maxBuyQty.value = 1
  } else {
    const maxByCap = 999 - getOwnedQty(item.id, item.item_type)
    maxBuyQty.value = Math.max(1, Math.min(maxByBalance, maxByCap))
  }

  console.log('maxBuyQty:', maxBuyQty.value, 'balance:', balance, 'currency:', item.currency_type)
  buyModalVisible.value = true
}

// 确认购买
async function handleBuyConfirm(quantity) {
  if (!buyItem.value) return
  try {
    await shopStore.purchase(buyItem.value.id, quantity, buyItem.value.item_type)
    addToast(`🎉 购买成功！获得 ${buyItem.value.icon} ${buyItem.value.name} ×${quantity}`, 'success')
  } catch (error) {
    addToast(`💔 ${error.message || '购买失败'}`, 'error')
  } finally {
    buyModalVisible.value = false
    buyItem.value = null
  }
}

// 初始化
onMounted(async () => {
  try {
    await userStore.loadFromLocal()
    await shopStore.loadShop('seeds')
    await shopStore.loadBackpack()
  } catch (error) {
    console.error('Shop init error:', error)
    addToast(error.message || '加载失败', 'error')
  }
})
</script>

<style scoped>
.shop-page {
  min-height: 100vh;
  padding: 40px 20px 80px;
  background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
}

.shop-page h1 {
  text-align: center;
  color: #2c5a2a;
  margin-bottom: 24px;
}

/* Tab 栏 */
.tab-bar {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  padding: 0 10px;
}

.tab-btn {
  padding: 10px 20px;
  border: 2px solid #2e7d32;
  border-radius: 40px;
  background: rgba(255, 255, 255, 0.8);
  color: #2e7d32;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.tab-btn:hover {
  background: #e8f5e9;
}

.tab-btn.active {
  background: #2e7d32;
  color: white;
}

/* 商品网格 */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.item-card {
  background: rgba(255, 248, 235, 0.95);
  border-radius: 24px;
  padding: 20px 16px;
  text-align: center;
  transition: transform 0.2s;
  position: relative;
  border: 3px solid transparent;
}

.item-card:hover {
  transform: translateY(-4px);
}

/* 稀有度边框 */
.rarity-border-C { border-color: #9e9e9e44; }
.rarity-border-B { border-color: #4caf5044; }
.rarity-border-A { border-color: #2196f344; }
.rarity-border-S { border-color: #9c27b044; }
.rarity-border-SSS { border-color: #ffd70066; }

.item-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.item-name {
  font-weight: bold;
  margin-bottom: 6px;
  color: #333;
  font-size: 0.95rem;
}

.item-rarity {
  display: inline-block;
  padding: 2px 14px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: bold;
  margin-bottom: 8px;
}

.rarity-C { background: #9e9e9e; color: white; }
.rarity-B { background: #4caf50; color: white; }
.rarity-A { background: #2196f3; color: white; }
.rarity-S { background: #9c27b0; color: white; }
.rarity-SSS { background: linear-gradient(135deg, #ffd700, #ff8c00); color: #2d2b15; }

.item-price {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 8px;
  font-weight: bold;
  color: #e65100;
  font-size: 1rem;
}

.currency-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.owned-badge {
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 8px;
}

.buy-btn {
  background: #2e7d32;
  color: white;
  border: none;
  padding: 8px 24px;
  border-radius: 40px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.buy-btn:hover {
  background: #1b5e20;
}

.buy-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 售罄样式 */
.sold-out {
  opacity: 0.5;
  filter: grayscale(100%);
  pointer-events: none;
}

.sold-out-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #f44336;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 12px;
  z-index: 2;
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
  .shop-page {
    background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
  }

  .shop-page h1 {
    color: #8bc34a;
  }

  .tab-btn {
    background: rgba(30, 30, 25, 0.95);
    border-color: #8bc34a;
    color: #8bc34a;
  }

  .tab-btn:hover {
    background: rgba(139, 195, 74, 0.2);
  }

  .tab-btn.active {
    background: #8bc34a;
    color: #1a2a1f;
  }

  .item-card {
    background: rgba(30, 30, 25, 0.95);
    color: #e0e0d0;
  }

  .item-name {
    color: #e0e0d0;
  }

  .item-price {
    color: #ffb74d;
  }

  .owned-badge {
    color: #aaa;
  }

  .buy-btn {
    background: #4caf50;
  }

  .buy-btn:hover {
    background: #388e3c;
  }

  .buy-btn:disabled {
    background: #555;
    cursor: not-allowed;
  }

  .loading-msg,
  .empty-msg {
    color: #aaa;
  }
}

@media (max-width: 768px) {
  .tab-bar {
    gap: 6px;
  }

  .tab-btn {
    padding: 8px 14px;
    font-size: 0.8rem;
  }

  .items-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 14px;
  }

  .item-card {
    padding: 16px 12px;
  }

  .item-icon {
    font-size: 40px;
  }
}
</style>

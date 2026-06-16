<template>
  <div v-if="visible" class="modal-overlay" @mousedown.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>🎁 送礼给 {{ friendName }}</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      <Toast ref="toastRef" />

      <!-- Tab 切换 -->
      <div class="gift-tabs">
        <button
          :class="['tab-btn', { active: mode === 'item' }]"
          @click="mode = 'item'"
        >📦 物品</button>
        <button
          :class="['tab-btn', { active: mode === 'currency' }]"
          @click="mode = 'currency'"
        ><img src="/gold_icon.png" class="btn-icon" /> 货币</button>
      </div>

      <div class="modal-body">
        <!-- 物品送礼 -->
        <div v-if="mode === 'item'" class="gift-section">
          <div v-if="backpackItems.length === 0" class="empty-hint">
            背包里没有可赠送的物品
          </div>
          <div v-else class="item-list">
            <div
              v-for="item in backpackItems"
              :key="item.item_id"
              :class="['item-card', { selected: selectedItemId === item.item_id }]"
              @click="selectedItemId = item.item_id"
            >
              <span class="item-icon">{{ item.icon }}</span>
              <span class="item-name">{{ item.name }}</span>
              <span class="item-qty">×{{ item.quantity }}</span>
            </div>
          </div>
        </div>

        <!-- 货币送礼 -->
        <div v-if="mode === 'currency'" class="gift-section">
          <div class="currency-select">
            <button
              v-for="c in currencyOptions"
              :key="c.key"
              :class="['currency-btn', { active: selectedCurrency === c.key }]"
              @click="selectedCurrency = c.key"
            >
              {{ c.icon }} {{ c.name }}
            </button>
          </div>
          <div class="amount-input">
            <label>赠送数量</label>
            <input
              type="number"
              v-model.number="giftAmount"
              :min="1"
              :max="maxCurrencyAmount"
              placeholder="输入数量"
            />
            <span class="max-hint">余额: {{ maxCurrencyAmount }}</span>
          </div>
          <div v-if="giftAmount > 0" class="discount-preview">
            <p>折算比率: <strong>{{ discountRateText }}</strong></p>
            <p>对方实际收到: <strong class="receive-amount">{{ receiveAmount }}</strong></p>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" @click="$emit('close')">取消</button>
        <button
          class="confirm-btn"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ submitting ? '发送中...' : '确认赠送' }}
        </button>
      </div>
    </div>

    <!-- 送礼确认弹窗 -->
    <ConfirmModal
      :visible="showConfirm"
      title="确认送礼"
      :message="confirmMessage"
      icon="🎁"
      confirm-text="送出"
      cancel-text="再想想"
      @confirm="confirmSendGift"
      @cancel="showConfirm = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useShopStore } from '@/stores/shopStore'
import Toast from '@/components/common/Toast.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const props = defineProps({
  visible: Boolean,
  friendId: String,
  friendName: String
})

const emit = defineEmits(['close', 'gift-sent'])

const userStore = useUserStore()
const shopStore = useShopStore()
const toastRef = ref(null)

const mode = ref('item')
const selectedItemId = ref(null)
const selectedCurrency = ref('silver_coin')
const giftAmount = ref(0)
const submitting = ref(false)
const showConfirm = ref(false)
const pendingGiftData = ref(null)

function addToast(message, type = 'info') {
  if (toastRef.value) {
    toastRef.value.addToast(message, type)
  }
}

const currencyOptions = [
  { key: 'silver_coin', name: '银币', icon: '/silver_icon.png' },
  { key: 'gold_coin', name: '金币', icon: '/gold_icon.png' },
  { key: 'diamond', name: '钻石', icon: '/diamond.png' }
]

// 背包物品（排除种子以外的物品也可以送）
const backpackItems = computed(() => {
  const items = []
  for (const group of Object.values(shopStore.backpack)) {
    for (const item of group) {
      if (item.quantity > 0) items.push(item)
    }
  }
  return items
})

const maxCurrencyAmount = computed(() => {
  return userStore.currencies[selectedCurrency.value] || 0
})

// 折算比率
const discountRate = computed(() => {
  const a = giftAmount.value
  if (a <= 0) return 1
  if (a <= 100) return 0.8
  if (a <= 500) return 0.6
  return 0.5
})

const discountRateText = computed(() => {
  return `${Math.round(discountRate.value * 100)}%`
})

const receiveAmount = computed(() => {
  return Math.max(0, Math.floor(giftAmount.value * discountRate.value))
})

const canSubmit = computed(() => {
  if (submitting.value) return false
  if (mode.value === 'item') return selectedItemId.value !== null
  return giftAmount.value > 0 && giftAmount.value <= maxCurrencyAmount.value
})

// 打开时加载背包
watch(() => props.visible, async (val) => {
  if (val) {
    await shopStore.loadBackpack()
    selectedItemId.value = null
    selectedCurrency.value = 'silver_coin'
    giftAmount.value = 0
    submitting.value = false
  }
})

// 确认弹窗文案
const confirmMessage = computed(() => {
  if (mode.value === 'item') {
    const item = backpackItems.value.find(i => i.item_id === selectedItemId.value)
    return `确认送给 ${props.friendName} ${item?.icon || ''} ${item?.name || '物品'} 吗？`
  }
  const currency = currencyOptions.find(c => c.key === selectedCurrency.value)
  return `确认送给 ${props.friendName} ${giftAmount.value} ${currency?.name || ''} 吗？`
})

async function handleSubmit() {
  if (!canSubmit.value) return
  // 准备数据，弹确认框
  if (mode.value === 'item') {
    pendingGiftData.value = {
      gift_type: 'item',
      item_id: selectedItemId.value
    }
  } else {
    pendingGiftData.value = {
      gift_type: 'currency',
      currency_type: selectedCurrency.value,
      amount: giftAmount.value
    }
  }
  showConfirm.value = true
}

async function confirmSendGift() {
  if (!pendingGiftData.value) return
  showConfirm.value = false
  submitting.value = true
  try {
    emit('gift-sent', pendingGiftData.value)
  } finally {
    submitting.value = false
    pendingGiftData.value = null
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  max-width: 440px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
  animation: slideUp 0.3s ease;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-header h3 {
  color: #2c5a2a;
  margin: 0;
  font-size: 1.15rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #999;
  padding: 4px 8px;
  border-radius: 50%;
  transition: all 0.2s;
}
.close-btn:hover {
  background: rgba(0,0,0,0.08);
  color: #333;
}

.gift-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 16px;
  background: white;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.2s;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.tab-btn.active {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.08);
  color: #2e7d32;
}

.tab-btn:hover:not(.active) {
  border-color: #aaa;
}

.modal-body {
  margin-bottom: 20px;
}

.empty-hint {
  text-align: center;
  color: #999;
  padding: 32px 0;
  font-size: 0.95rem;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 4px;
}

.item-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 2px solid #e8e8e8;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.item-card:hover {
  border-color: #a5d6a7;
  background: rgba(76, 175, 80, 0.04);
}

.item-card.selected {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
  box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.3);
}

.item-icon {
  font-size: 1.4rem;
}

.item-name {
  flex: 1;
  font-size: 0.95rem;
  color: #333;
  font-weight: 500;
}

.item-qty {
  font-size: 0.85rem;
  color: #888;
}

.currency-select {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.currency-btn {
  flex: 1;
  padding: 10px 8px;
  border: 2px solid #e0e0e0;
  border-radius: 14px;
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
  color: #666;
  text-align: center;
}

.currency-btn.active {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.08);
  color: #2e7d32;
}

.amount-input {
  margin-bottom: 12px;
}

.amount-input label {
  display: block;
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 6px;
}

.amount-input input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 14px;
  font-size: 1rem;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.amount-input input:focus {
  outline: none;
  border-color: #4caf50;
}

.max-hint {
  display: block;
  font-size: 0.8rem;
  color: #999;
  margin-top: 4px;
  text-align: right;
}

.discount-preview {
  background: rgba(255, 152, 0, 0.08);
  border: 1px solid rgba(255, 152, 0, 0.2);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}

.discount-preview p {
  margin: 4px 0;
  font-size: 0.9rem;
  color: #555;
}

.receive-amount {
  color: #ff9800;
  font-size: 1.1rem;
}

.modal-footer {
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
  transition: all 0.2s ease;
}

.cancel-btn {
  background: #e0e0e0;
  color: #333;
}

.confirm-btn {
  background: #2e7d32;
  color: white;
}

.confirm-btn:disabled {
  background: #a5d6a7;
  cursor: not-allowed;
}

.cancel-btn:hover { background: #d0d0d0; }
.confirm-btn:hover:not(:disabled) { background: #1b5e20; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

@media (prefers-color-scheme: dark) {
  .modal-content { background: rgba(30, 30, 25, 0.98); }
  .modal-header h3 { color: #8bc34a; }
  .close-btn { color: #aaa; }
  .close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .tab-btn { background: #2a2a2a; border-color: #555; color: #aaa; }
  .tab-btn.active { border-color: #4caf50; background: rgba(76, 175, 80, 0.15); color: #8bc34a; }
  .item-card { background: #2a2a2a; border-color: #444; }
  .item-card.selected { border-color: #4caf50; background: rgba(76, 175, 80, 0.15); }
  .item-name { color: #e0e0e0; }
  .currency-btn { background: #2a2a2a; border-color: #555; color: #aaa; }
  .currency-btn.active { border-color: #4caf50; background: rgba(76, 175, 80, 0.15); color: #8bc34a; }
  .amount-input input { background: #2a2a2a; border-color: #555; color: #fff; }
  .cancel-btn { background: #4a4a4a; color: #e0e0e0; }
  .confirm-btn { background: #4caf50; }
}
</style>

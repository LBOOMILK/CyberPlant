<template>
  <div v-if="visible" class="modal-overlay" @mousedown.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>🎁 送礼给 {{ friendName }}</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      <Toast ref="toastRef" />

      <div class="modal-body">
        <div class="gift-section">
          <div class="currency-display">
            <img src="/diamond.png" class="diamond-icon" />
            <span class="currency-label">钻石</span>
            <span class="currency-balance">余额: {{ userStore.currencies.diamond || 0 }}</span>
          </div>
          <div class="amount-input">
            <label>赠送数量（1~5）</label>
            <div class="amount-control">
              <button class="qty-btn" @click="giftAmount = Math.max(1, giftAmount - 1)">−</button>
              <input
                type="number"
                v-model.number="giftAmount"
                :min="1"
                :max="5"
                @input="clampAmount"
              />
              <button class="qty-btn" @click="giftAmount = Math.min(5, giftAmount + 1)">+</button>
            </div>
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

    <ConfirmModal
      :visible="showConfirm"
      title="确认送礼"
      :message="`确认送给 ${friendName} ${giftAmount} 颗钻石吗？`"
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
import Toast from '@/components/common/Toast.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const props = defineProps({
  visible: Boolean,
  friendId: String,
  friendName: String
})

const emit = defineEmits(['close', 'gift-sent'])

const userStore = useUserStore()
const toastRef = ref(null)

const giftAmount = ref(1)
const submitting = ref(false)
const showConfirm = ref(false)

function clampAmount() {
  giftAmount.value = Math.max(1, Math.min(5, Math.round(giftAmount.value) || 1))
}

const canSubmit = computed(() => {
  if (submitting.value) return false
  return giftAmount.value >= 1 && giftAmount.value <= 5 && giftAmount.value <= (userStore.currencies.diamond || 0)
})

watch(() => props.visible, async (val) => {
  if (val) {
    giftAmount.value = 1
    submitting.value = false
    await userStore.loadCurrencies()
  }
})

function handleSubmit() {
  if (!canSubmit.value) return
  showConfirm.value = true
}

async function confirmSendGift() {
  showConfirm.value = false
  submitting.value = true
  try {
    emit('gift-sent', { amount: giftAmount.value })
  } finally {
    submitting.value = false
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
  max-width: 380px;
  box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
  animation: slideUp 0.3s ease;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h3 { color: #2c5a2a; margin: 0; font-size: 1.15rem; }

.close-btn {
  background: none; border: none; font-size: 1.2rem;
  cursor: pointer; color: #999; padding: 4px 8px;
  border-radius: 50%; transition: all 0.2s;
}
.close-btn:hover { background: rgba(0,0,0,0.08); color: #333; }

.modal-body { margin-bottom: 20px; }

.currency-display {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 14px;
  border: 1px solid #e0e0e0;
}

.diamond-icon { width: 28px; height: 28px; object-fit: contain; }
.currency-label { font-weight: 600; font-size: 1rem; color: #333; }
.currency-balance { margin-left: auto; font-size: 0.85rem; color: #888; }

.amount-input label {
  display: block; font-size: 0.85rem; color: #666; margin-bottom: 8px;
}

.amount-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qty-btn {
  width: 36px; height: 36px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  background: white;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #333;
}
.qty-btn:hover { border-color: #4caf50; background: rgba(76,175,80,0.05); }

.amount-control input {
  flex: 1;
  text-align: center;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 14px;
  font-size: 1.2rem;
  font-weight: 700;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.amount-control input:focus { outline: none; border-color: #4caf50; }

.modal-footer { display: flex; gap: 12px; justify-content: center; }

.cancel-btn, .confirm-btn {
  padding: 10px 24px; border: none; border-radius: 40px;
  font-weight: bold; cursor: pointer; transition: all 0.2s ease;
}
.cancel-btn { background: #e0e0e0; color: #333; }
.confirm-btn { background: #2e7d32; color: white; }
.confirm-btn:disabled { background: #a5d6a7; cursor: not-allowed; }
.cancel-btn:hover { background: #d0d0d0; }
.confirm-btn:hover:not(:disabled) { background: #1b5e20; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

@media (prefers-color-scheme: dark) {
  .modal-content { background: rgba(30, 30, 25, 0.98); }
  .modal-header h3 { color: #8bc34a; }
  .close-btn { color: #aaa; }
  .close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .currency-display { background: rgba(40,40,35,0.6); border-color: #555; }
  .currency-label { color: #e0e0e0; }
  .qty-btn { background: #2a2a2a; border-color: #555; color: #e0e0e0; }
  .qty-btn:hover { border-color: #4caf50; }
  .amount-control input { background: #2a2a2a; border-color: #555; color: #fff; }
  .cancel-btn { background: #4a4a4a; color: #e0e0e0; }
}
</style>

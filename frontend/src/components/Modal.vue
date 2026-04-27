<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ title }}</h3>
      </div>
      <div class="modal-body">
        <p class="modal-message">{{ message }}</p>
        <div v-if="showQuantity" class="quantity-section">
          <div class="quantity-selector">
            <button @click="decreaseQuantity" class="quantity-btn" :disabled="quantity <= 1">-</button>
            <input
              type="number"
              v-model.number="quantity"
              :min="1"
              :max="maxQuantity"
              @change="validateQuantity"
              class="quantity-input"
            />
            <button @click="increaseQuantity" class="quantity-btn" :disabled="quantity >= maxQuantity">+</button>
          </div>
          <div v-if="totalPrice > 0" class="total-price">
            总价：<span class="price-value">{{ totalPrice }}</span> 积分
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="cancel-btn" @click="handleCancel">{{ cancelText }}</button>
        <button class="confirm-btn" @click="handleConfirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '确认操作'
  },
  message: {
    type: String,
    default: '确定要执行此操作吗？'
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  showQuantity: {
    type: Boolean,
    default: false
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  initialQuantity: {
    type: Number,
    default: 1
  },
  maxQuantity: {
    type: Number,
    default: 99
  }
})

const emit = defineEmits(['confirm', 'cancel', 'update:quantity'])

const quantity = ref(props.initialQuantity)

const totalPrice = computed(() => {
  return quantity.value * props.unitPrice
})

watch(() => props.initialQuantity, (newVal) => {
  quantity.value = newVal
})

watch(quantity, (newVal) => {
  emit('update:quantity', newVal)
})

function decreaseQuantity() {
  if (quantity.value > 1) {
    quantity.value--
  }
}

function increaseQuantity() {
  if (quantity.value < props.maxQuantity) {
    quantity.value++
  }
}

function validateQuantity() {
  if (quantity.value < 1) {
    quantity.value = 1
  } else if (quantity.value > props.maxQuantity) {
    quantity.value = props.maxQuantity
  }
}

function handleConfirm() {
  emit('confirm', quantity.value)
}

function handleCancel() {
  emit('cancel')
  quantity.value = props.initialQuantity
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
  border-radius: 48px;
  padding: 32px;
  width: 90%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
  animation: slideUp 0.3s ease;
}

.modal-header h3 {
  color: #2c5a2a;
  margin: 0 0 16px 0;
  font-size: 1.2rem;
}

.modal-body {
  padding: 0;
  margin: 0;
}

.modal-message {
  color: #555;
  font-size: 1rem;
  margin: 0 0 20px 0;
  line-height: 1.6;
  text-align: center;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.cancel-btn,
.confirm-btn {
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

.cancel-btn:hover {
  background: #d0d0d0;
}

.confirm-btn:hover {
  background: #1b5e20;
}

.quantity-section {
  margin-top: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0);
  border-radius: 16px;
}

.quantity-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 12px;
}

.quantity-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #2e7d32;
  color: white;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(46, 125, 50, 0.3);
}

.quantity-btn:hover:not(:disabled) {
  background: #1b5e20;
  transform: scale(1.05);
}

.quantity-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  box-shadow: none;
}

.quantity-input {
  width: 70px;
  height: 40px;
  text-align: center;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 18px;
  font-weight: bold;
  color: #333;
  background: white;
}

.quantity-input:focus {
  outline: none;
  border-color: #2e7d32;
}

.total-price {
  color: #666;
  font-size: 0.95rem;
  text-align: center;
}

.price-value {
  color: #ff9800;
  font-weight: bold;
  font-size: 1.2rem;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .modal-content {
    background: rgba(30, 30, 25, 0.98);
  }

  .modal-header h3 {
    color: #8bc34a;
  }

  .modal-message {
    color: #e0e0d0;
  }

  .cancel-btn {
    background: #4a4a4a;
    color: #e0e0e0;
  }

  .cancel-btn:hover {
    background: #5a5a5a;
  }

  .confirm-btn {
    background: #4caf50;
  }

  .confirm-btn:hover {
    background: #388e3c;
  }

  .quantity-section {
     background: rgba(255, 255, 255, 0);
   }

  .quantity-btn {
    background: #4caf50;
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
  }

  .quantity-btn:hover:not(:disabled) {
    background: #388e3c;
  }

  .quantity-btn:disabled {
    background: #555;
    cursor: not-allowed;
    box-shadow: none;
  }

  .quantity-input {
    background: #2a2a2a;
    border-color: #555;
    color: #fff;
  }

  .quantity-input:focus {
    border-color: #4caf50;
  }

  .price-value {
    color: #ffb74d;
  }
}
</style>
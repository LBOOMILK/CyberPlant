<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ title }}</h3>
      </div>
      <div class="modal-body">
        <p>{{ message }}</p>
      </div>
      <div class="modal-footer">
        <button class="cancel-btn" @click="handleCancel">{{ cancelText }}</button>
        <button class="confirm-btn" @click="handleConfirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
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
  }
})

const emit = defineEmits(['confirm', 'cancel'])

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
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

.modal-body p {
  color: #555;
  margin: 0 0 24px 0;
  line-height: 1.5;
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
    background: rgba(30, 30, 25, 0.95);
  }
  
  .modal-header h3 {
    color: #8bc34a;
  }
  
  .modal-body p {
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
}
</style>
<template>
  <transition name="modal-fade">
    <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
      <div class="confirm-panel">
        <div class="confirm-icon">{{ icon }}</div>
        <h3 class="confirm-title">{{ title }}</h3>
        <p class="confirm-message">{{ message }}</p>
        <div v-if="warning" class="confirm-warning">⚠️ {{ warning }}</div>
        <div class="confirm-actions">
          <button v-if="cancelText" class="confirm-cancel" @click="handleCancel">{{ cancelText }}</button>
          <button class="confirm-ok" :class="{ danger }" @click="handleConfirm">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '确定要执行此操作吗？' },
  warning: { type: String, default: '' },
  icon: { type: String, default: '⚠️' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false }
})

const emit = defineEmits(['confirm', 'cancel'])

function handleConfirm() { emit('confirm') }
function handleCancel() { emit('cancel') }
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10001;
}

.confirm-panel {
  background: rgba(255, 248, 235, 0.98);
  border-radius: 24px;
  padding: 28px 24px;
  width: 90%;
  max-width: 360px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
}

.confirm-icon {
  font-size: 2.5rem;
  margin-bottom: 8px;
}

.confirm-title {
  margin: 0 0 8px;
  color: #2c5a2a;
  font-size: 1.15rem;
}

.confirm-message {
  margin: 0 0 12px;
  color: #555;
  font-size: 0.95rem;
  line-height: 1.5;
}

.confirm-warning {
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 16px;
  color: #e65100;
  font-size: 0.85rem;
}

.confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.confirm-cancel,
.confirm-ok {
  flex: 1;
  padding: 10px 20px;
  border: none;
  border-radius: 16px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-cancel {
  background: #e0e0e0;
  color: #555;
}

.confirm-cancel:hover { background: #d0d0d0; }

.confirm-ok {
  background: #2e7d32;
  color: white;
}

.confirm-ok:hover { background: #1b5e20; }

.confirm-ok.danger {
  background: #d32f2f;
}

.confirm-ok.danger:hover { background: #b71c1c; }

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-fade-enter-active { transition: opacity 0.25s ease; }
.modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

@media (prefers-color-scheme: dark) {
  .confirm-panel { background: rgba(30, 30, 25, 0.98); }
  .confirm-title { color: #8bc34a; }
  .confirm-message { color: #ccc; }
  .confirm-cancel { background: #444; color: #ddd; }
  .confirm-cancel:hover { background: #555; }
  .confirm-ok { background: #4caf50; }
  .confirm-ok:hover { background: #388e3c; }
  .confirm-ok.danger { background: #e53935; }
  .confirm-ok.danger:hover { background: #c62828; }
}
</style>

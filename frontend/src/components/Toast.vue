<template>
  <div class="toast-container">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="['toast-message', toast.type]"
      :style="{ animationDelay: `${toast.index * 0.1}s` }"
    >
      <span class="toast-icon">{{ getIconForType(toast.type) }}</span>
      <span class="toast-text">{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const toasts = ref([])
let toastId = 0

function addToast(message, type = 'info') {
  if (toasts.value.length >= 3) {
    toasts.value.shift()
  }
  
  const newToast = {
    id: toastId++,
    message,
    type,
    index: toasts.value.length
  }
  
  toasts.value.push(newToast)
  
  setTimeout(() => {
    removeToast(newToast.id)
  }, 2800)
}

function removeToast(id) {
  const index = toasts.value.findIndex(toast => toast.id === id)
  if (index !== -1) {
    toasts.value.splice(index, 1)
    // 更新剩余 toast 的索引
    toasts.value.forEach((toast, i) => {
      toast.index = i
    })
  }
}

function getIconForType(type) {
  const icons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: '💡'
  }
  return icons[type] || '📢'
}

defineExpose({
  addToast
})
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 70px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
  max-width: 340px;
}

.toast-message {
  background: rgba(30, 30, 20, 0.94);
  backdrop-filter: blur(12px);
  color: #fef7e0;
  padding: 12px 20px;
  border-radius: 48px;
  font-size: 0.9rem;
  font-weight: 500;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  border-left: 5px solid #ffb347;
  animation: slideInRight 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1);
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  letter-spacing: 0.3px;
  transition: all 0.2s ease;
}

.toast-message:hover {
  transform: translateX(-5px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.toast-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.toast-text {
  flex: 1;
  line-height: 1.4;
}

.toast-message.success {
  border-left-color: #4caf50;
  background: rgba(40, 55, 35, 0.96);
}

.toast-message.warning {
  border-left-color: #ff9800;
  background: rgba(55, 40, 20, 0.96);
}

.toast-message.error {
  border-left-color: #f44336;
  background: rgba(55, 20, 25, 0.96);
}

.toast-message.info {
  border-left-color: #42a5f5;
  background: rgba(20, 35, 55, 0.96);
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(60px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes fadeOut {
  to {
    opacity: 0;
    transform: translateX(20px);
    visibility: hidden;
  }
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .toast-message {
    background: rgba(30, 30, 35, 0.94);
    color: #f0f0f0;
  }
  
  .toast-message.success {
    background: rgba(30, 45, 30, 0.96);
  }
  
  .toast-message.warning {
    background: rgba(45, 30, 15, 0.96);
  }
  
  .toast-message.error {
    background: rgba(45, 15, 20, 0.96);
  }
  
  .toast-message.info {
    background: rgba(15, 30, 45, 0.96);
  }
}
</style>
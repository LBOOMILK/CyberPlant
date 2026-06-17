<template>
  <div class="admin-page">
    <AdminSidebar />
    <div class="admin-content" ref="contentRef">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AdminSidebar from './AdminSidebar.vue'
import { useThemeStore } from '@/stores/themeStore'

const contentRef = ref(null)
const themeStore = useThemeStore()

onMounted(() => {
  themeStore.init()
})
</script>

<style scoped>
.admin-page {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary, #0f172a);
  color: var(--text-primary, #f1f5f9);
}
.admin-content {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
  height: 100vh;
  box-sizing: border-box;
  min-width: 0;
}

/* 浅色模式 */
[data-theme="light"] .admin-page {
  background: #f8fafc;
  color: #1e293b;
}

/* 深色模式 */
[data-theme="dark"] .admin-page {
  background: #0f172a;
  color: #f1f5f9;
}

@media (max-width: 767px) {
  .admin-content { padding: 16px; padding-top: 64px; }
}
</style>

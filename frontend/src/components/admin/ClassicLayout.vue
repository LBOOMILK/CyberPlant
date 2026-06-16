<template>
  <div class="admin-page">
    <AdminSidebar />
    <div class="admin-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
import AdminSidebar from './AdminSidebar.vue'
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
  min-height: 100vh;
}
@media (max-width: 767px) {
  .admin-content { padding: 16px; }
}
</style>

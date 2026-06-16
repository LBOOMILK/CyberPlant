<template>
  <div class="app" :data-theme="colorScheme">
    <NavBar />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import NavBar from './components/Navbar.vue'
import { useThemeStore } from './stores/themeStore'

const themeStore = useThemeStore()
const colorScheme = computed(() => themeStore.colorScheme)

onMounted(() => {
  themeStore.init()
})
</script>

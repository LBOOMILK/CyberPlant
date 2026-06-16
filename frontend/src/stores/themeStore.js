import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // admin_theme: 'hub' | 'classic'
  const adminTheme = ref(localStorage.getItem('admin_theme') || 'hub')
  // color_scheme: 'dark' | 'light'
  const colorScheme = ref(localStorage.getItem('color_scheme') || 'dark')

  function setAdminTheme(theme) {
    adminTheme.value = theme
    localStorage.setItem('admin_theme', theme)
  }

  function setColorScheme(scheme) {
    colorScheme.value = scheme
    localStorage.setItem('color_scheme', scheme)
    applyColorScheme(scheme)
  }

  function applyColorScheme(scheme) {
    document.documentElement.setAttribute('data-theme', scheme)
  }

  function init() {
    applyColorScheme(colorScheme.value)
  }

  return {
    adminTheme,
    colorScheme,
    setAdminTheme,
    setColorScheme,
    init
  }
})

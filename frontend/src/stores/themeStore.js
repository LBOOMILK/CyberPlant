import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // admin_theme: 'hub' | 'classic'
  const adminTheme = ref(localStorage.getItem('admin_theme') || 'hub')
  // color_scheme: 'dark' | 'light' — 跟随系统
  const colorScheme = ref('dark')

  function setAdminTheme(theme) {
    adminTheme.value = theme
    localStorage.setItem('admin_theme', theme)
  }

  function applyColorScheme(scheme) {
    colorScheme.value = scheme
    document.documentElement.setAttribute('data-theme', scheme)
  }

  function init() {
    // 检测系统偏好
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    applyColorScheme(mediaQuery.matches ? 'dark' : 'light')
    // 监听系统变化
    mediaQuery.addEventListener('change', (e) => {
      applyColorScheme(e.matches ? 'dark' : 'light')
    })
  }

  return {
    adminTheme,
    colorScheme,
    setAdminTheme,
    init
  }
})

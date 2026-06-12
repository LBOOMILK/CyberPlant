// frontend/src/stores/plotStore.js
import { defineStore } from 'pinia'
import { ref } from 'vue'

const API_URL = import.meta.env.VITE_API_URL

export const usePlotStore = defineStore('plot', () => {
  // ========== 状态 ==========
  const plots = ref([])
  const loading = ref(false)

  // 解锁费用配置
  const unlockCosts = {
    2: { type: 'silver_coin', amount: 200, icon: '🪙', label: '200 银币' },
    3: { type: 'silver_coin', amount: 800, icon: '🪙', label: '800 银币' },
    4: { type: 'gold_coin', amount: 300, icon: '🥇', label: '300 金币' },
    5: { type: 'gold_coin', amount: 800, icon: '🥇', label: '800 金币' },
    6: { type: 'diamond', amount: 100, icon: '💎', label: '100 钻石' }
  }

  // 升级费用配置
  const upgradeCosts = {
    2: { type: 'silver_coin', amount: 1500, icon: '🪙', label: '1500 银币' },
    3: { type: 'gold_coin', amount: 500, icon: '🥇', label: '500 金币' },
    4: { type: 'gold_coin', amount: 1500, icon: '🥇', label: '1500 金币' },
    5: { type: 'diamond', amount: 500, icon: '💎', label: '500 钻石' }
  }

  // 等级倍率
  const levelMultiplier = { 1: 1.0, 2: 1.2, 3: 1.5, 4: 2.0, 5: 3.0 }

  // 等级边框颜色
  const levelColors = {
    1: '#9CA3AF',
    2: '#22C55E',
    3: '#3B82F6',
    4: '#A855F7',
    5: '#EAB308'
  }

  // 阶段图标
  const stageIcons = ['🥜', '🌱', '🌿', '🌻']

  function getAuthHeaders() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  }

  // ========== 加载地块 ==========
  async function loadPlots() {
    loading.value = true
    try {
      const response = await fetch(`${API_URL}/user/plots`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) throw new Error('获取地块信息失败')
      const data = await response.json()
      plots.value = data.plots || []
      return plots.value
    } catch (error) {
      console.error('loadPlots error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // ========== 解锁地块 ==========
  async function unlockPlot(plotIndex) {
    const response = await fetch(`${API_URL}/user/plots/${plotIndex}/unlock`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '解锁失败')
    }
    const data = await response.json()
    await loadPlots()
    return data
  }

  // ========== 升级地块 ==========
  async function upgradePlot(plotIndex) {
    const response = await fetch(`${API_URL}/user/plots/${plotIndex}/upgrade`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '升级失败')
    }
    const data = await response.json()
    await loadPlots()
    return data
  }

  // ========== 种植 ==========
  async function plant(plotIndex, itemId) {
    const response = await fetch(`${API_URL}/user/plots/${plotIndex}/plant`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ item_id: itemId })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '种植失败')
    }
    const data = await response.json()
    await loadPlots()
    return data
  }

  // ========== 浇水 ==========
  async function water(plotIndex) {
    const response = await fetch(`${API_URL}/user/plots/${plotIndex}/water`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '浇水失败')
    }
    const data = await response.json()
    await loadPlots()
    return data
  }

  // ========== 施肥 ==========
  async function fertilize(plotIndex, itemId) {
    const response = await fetch(`${API_URL}/user/plots/${plotIndex}/fertilize`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ item_id: itemId })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '施肥失败')
    }
    const data = await response.json()
    await loadPlots()
    return data
  }

  // ========== 收获 ==========
  async function harvest(plotIndex) {
    const response = await fetch(`${API_URL}/user/plots/${plotIndex}/harvest`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '收获失败')
    }
    const data = await response.json()
    await loadPlots()
    return data
  }

  // ========== 铲除 ==========
  async function remove(plotIndex) {
    const response = await fetch(`${API_URL}/user/plots/${plotIndex}/remove`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '铲除失败')
    }
    const data = await response.json()
    await loadPlots()
    return data
  }

  return {
    plots,
    loading,
    unlockCosts,
    upgradeCosts,
    levelMultiplier,
    levelColors,
    stageIcons,
    loadPlots,
    unlockPlot,
    upgradePlot,
    plant,
    water,
    fertilize,
    harvest,
    remove
  }
})

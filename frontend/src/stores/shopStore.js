// frontend/src/stores/shopStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserStore } from './userStore'

const API_URL = import.meta.env.VITE_API_URL

export const useShopStore = defineStore('shop', () => {
  // ========== 状态 ==========
  const shopItems = ref([])
  const currentTab = ref('seeds')
  const backpack = ref({}) // { seed: [...], fertilizer: [...], ... }
  const loading = ref(false)
  const globalConfig = ref({})

  // Tab 配置
  const tabs = [
    { key: 'seeds', label: '种子', icon: '🌱' },
    { key: 'fertilizers', label: '肥料', icon: '🧪' },
    { key: 'pets', label: '宠物', icon: '🐾' },
    { key: 'pet_food', label: '宠物粮', icon: '🍖' },
    { key: 'decorations', label: '装饰', icon: '🎀' }
  ]

  // 货币图标配置
  const currencyIcons = {
    silver_coin: '/silver_icon.png',
    gold_coin: '/gold_icon.png',
    diamond: '/diamond.png'
  }

  const currencyNames = {
    silver_coin: '银币',
    gold_coin: '金币',
    diamond: '钻石'
  }

  // 稀有度颜色
  const rarityColors = {
    C: '#9e9e9e',
    B: '#4caf50',
    A: '#2196f3',
    S: '#9c27b0',
    SSS: '#FFD700'
  }

  // ========== 计算属性 ==========
  const backpackTotal = computed(() => {
    let total = 0
    for (const items of Object.values(backpack.value)) {
      for (const item of items) {
        total += item.quantity
      }
    }
    return total
  })

  // ========== 工具函数 ==========
  function getAuthHeaders() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  }

  // ========== 加载商店物品 ==========
  const rarityOrder = { C: 1, B: 2, A: 3, S: 4, SSS: 5 }
  async function loadShop(tab) {
    loading.value = true
    try {
      const response = await fetch(`${API_URL}/shop?tab=${tab}`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '获取商店物品失败')
      }
      const data = await response.json()
      const sorted = [...data].sort((a, b) => (rarityOrder[a.rarity] || 0) - (rarityOrder[b.rarity] || 0))
      shopItems.value = sorted
      currentTab.value = tab
      return sorted
    } catch (error) {
      console.error('loadShop error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // ========== 购买物品 ==========
  async function purchase(itemId, quantity, itemType) {
    let response
    if (itemType === 'pet') {
      response = await fetch(`${API_URL}/user/pets/purchase`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pet_id: itemId })
      })
    } else if (itemType === 'decoration') {
      response = await fetch(`${API_URL}/user/decorations/purchase`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ decoration_id: itemId, quantity: quantity || 1 })
      })
    } else {
      response = await fetch(`${API_URL}/user/shop/purchase`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ item_id: itemId, quantity })
      })
    }
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '购买失败')
    }
    const data = await response.json()

    // 更新货币余额
    const userStore = useUserStore()
    if (data.currencies) {
      userStore.currencies = {
        silver_coin: Number(data.currencies.silver_coin) || 0,
        gold_coin: Number(data.currencies.gold_coin) || 0,
        diamond: Number(data.currencies.diamond) || 0
      }
      userStore.saveToLocalStorage()
    }

    // 刷新背包
    await loadBackpack()

    return data
  }

  // ========== 出售物品 ==========
  async function sell(itemId, quantity) {
    const response = await fetch(`${API_URL}/user/shop/sell`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ item_id: itemId, quantity })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '出售失败')
    }
    const data = await response.json()

    // 更新货币余额
    const userStore = useUserStore()
    if (data.currencies) {
      userStore.currencies = {
        silver_coin: Number(data.currencies.silver_coin) || 0,
        gold_coin: Number(data.currencies.gold_coin) || 0,
        diamond: Number(data.currencies.diamond) || 0
      }
      userStore.saveToLocalStorage()
    }

    // 刷新背包
    await loadBackpack()

    return data
  }

  // ========== 加载背包 ==========
  async function loadBackpack() {
    try {
      const response = await fetch(`${API_URL}/user/backpack`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '获取背包失败')
      }
      const data = await response.json()
      backpack.value = data.groups || {}
      return backpack.value
    } catch (error) {
      console.error('loadBackpack error:', error)
      throw error
    }
  }

  // ========== 加载全局配置 ==========
  async function loadGlobalConfig() {
    try {
      const response = await fetch(`${API_URL}/config`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '获取全局配置失败')
      }
      const data = await response.json()
      globalConfig.value = {}
      for (const [key, val] of Object.entries(data)) {
        globalConfig.value[key] = val.value
      }
      return globalConfig.value
    } catch (error) {
      console.error('loadGlobalConfig error:', error)
      return {}
    }
  }

  // ========== 查询背包中某物品数量 ==========
  function getItemCount(itemId, itemType) {
    if (itemType && backpack.value[itemType]) {
      const found = backpack.value[itemType].find(i => i.item_id === itemId)
      return found ? found.quantity : 0
    }
    // fallback: 遍历所有分组（兼容旧调用）
    for (const items of Object.values(backpack.value)) {
      const found = items.find(i => i.item_id === itemId)
      if (found) return found.quantity
    }
    return 0
  }

  return {
    // 状态
    shopItems,
    currentTab,
    backpack,
    loading,
    globalConfig,
    // 配置
    tabs,
    currencyIcons,
    currencyNames,
    rarityColors,
    // 计算属性
    backpackTotal,
    // 方法
    loadShop,
    loadGlobalConfig,
    purchase,
    sell,
    loadBackpack,
    getItemCount
  }
})

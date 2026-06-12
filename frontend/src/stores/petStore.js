// frontend/src/stores/petStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserStore } from './userStore'

const API_URL = import.meta.env.VITE_API_URL

export const usePetStore = defineStore('pet', () => {
  // ========== 状态 ==========
  const pets = ref([])
  const activePet = ref(null)
  const activeBonus = ref(0)
  const decorations = ref([])
  const userDecorations = ref([])
  const loading = ref(false)

  // 稀有度配置
  const rarityConfig = {
    common: { label: '普通', color: '#9e9e9e', bg: '#f5f5f5' },
    rare: { label: '稀有', color: '#2196f3', bg: '#e3f2fd' },
    epic: { label: '史诗', color: '#9c27b0', bg: '#f3e5f5' },
    legendary: { label: '传说', color: '#FF9800', bg: '#fff3e0' }
  }

  // 槽位配置
  const slotConfig = {
    head: { label: '头部', icon: '👒' },
    neck: { label: '颈部', icon: '📿' },
    back: { label: '背部', icon: '🦸' },
    special: { label: '特殊', icon: '✨' }
  }

  // 宠物粮效果
  const foodEffects = {
    '普通粮': { growth: 30, hunger: 20, digest_hours: 4, icon: '🍖' },
    '精良粮': { growth: 60, hunger: 40, digest_hours: 8, icon: '🥩' },
    '高级粮': { growth: 100, hunger: 60, digest_hours: 12, icon: '🍱' },
    '稀有粮': { growth: 200, hunger: 100, digest_hours: 24, icon: '🍜' }
  }

  // ========== 计算属性 ==========
  const hasActivePet = computed(() => activePet.value !== null)

  // ========== 工具函数 ==========
  function getAuthHeaders() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  }

  function updateCurrencies(currencies) {
    if (!currencies) return
    const userStore = useUserStore()
    userStore.currencies.value = {
      silver_coin: Number(currencies.silver_coin) || 0,
      gold_coin: Number(currencies.gold_coin) || 0,
      diamond: Number(currencies.diamond) || 0
    }
    userStore.saveToLocalStorage()
  }

  // ========== 加载用户所有宠物 ==========
  async function loadPets() {
    loading.value = true
    try {
      const response = await fetch(`${API_URL}/user/pets`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '获取宠物列表失败')
      }
      const data = await response.json()
      pets.value = data.pets || []

      // 更新激活宠物
      const active = pets.value.find(p => p.is_active)
      if (active) {
        activePet.value = active
        activeBonus.value = active.current_bonus
      } else {
        activePet.value = null
        activeBonus.value = 0
      }

      return pets.value
    } catch (error) {
      console.error('loadPets error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // ========== 加载激活宠物 ==========
  async function loadActivePet() {
    try {
      const response = await fetch(`${API_URL}/user/pets/active`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '获取激活宠物失败')
      }
      const data = await response.json()
      activePet.value = data.pet
      activeBonus.value = data.bonus || 0
      return data
    } catch (error) {
      console.error('loadActivePet error:', error)
      throw error
    }
  }

  // ========== 购买宠物 ==========
  async function purchasePet(petId) {
    const response = await fetch(`${API_URL}/user/pets/purchase`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pet_id: petId })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '购买宠物失败')
    }
    const data = await response.json()
    updateCurrencies(data.currencies)
    await loadPets()
    return data
  }

  // ========== 激活宠物 ==========
  async function activatePet(userPetId) {
    const response = await fetch(`${API_URL}/user/pets/${userPetId}/activate`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '激活宠物失败')
    }
    const data = await response.json()
    await loadPets()
    return data
  }

  // ========== 喂食 ==========
  async function feedPet(userPetId, foodItemId) {
    const response = await fetch(`${API_URL}/user/pets/${userPetId}/feed`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ food_item_id: foodItemId })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '喂食失败')
    }
    const data = await response.json()
    await loadPets()
    return data
  }

  // ========== 加载装饰模板 ==========
  async function loadDecorations(slotType) {
    try {
      let url = `${API_URL}/decorations`
      if (slotType) url += `?slot_type=${slotType}`
      const response = await fetch(url, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '获取装饰列表失败')
      }
      const data = await response.json()
      decorations.value = data
      return data
    } catch (error) {
      console.error('loadDecorations error:', error)
      throw error
    }
  }

  // ========== 加载用户装饰 ==========
  async function loadUserDecorations() {
    try {
      const response = await fetch(`${API_URL}/user/decorations`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '获取用户装饰失败')
      }
      const data = await response.json()
      userDecorations.value = data
      return data
    } catch (error) {
      console.error('loadUserDecorations error:', error)
      throw error
    }
  }

  // ========== 购买装饰 ==========
  async function purchaseDecoration(decorationId, quantity = 1) {
    const response = await fetch(`${API_URL}/user/decorations/purchase`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ decoration_id: decorationId, quantity })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '购买装饰失败')
    }
    const data = await response.json()
    updateCurrencies(data.currencies)
    await loadUserDecorations()
    return data
  }

  // ========== 装备装饰 ==========
  async function equipDecoration(userPetId, decorationId) {
    const response = await fetch(`${API_URL}/user/pets/${userPetId}/equip`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ decoration_id: decorationId })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '装备装饰失败')
    }
    const data = await response.json()
    await loadPets()
    return data
  }

  // ========== 卸下装饰 ==========
  async function unequipDecoration(userPetId, slotType) {
    const response = await fetch(`${API_URL}/user/pets/${userPetId}/unequip`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ slot_type: slotType })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '卸下装饰失败')
    }
    const data = await response.json()
    await loadPets()
    return data
  }

  return {
    // 状态
    pets,
    activePet,
    activeBonus,
    decorations,
    userDecorations,
    loading,
    // 配置
    rarityConfig,
    slotConfig,
    foodEffects,
    // 计算属性
    hasActivePet,
    // 方法
    loadPets,
    loadActivePet,
    purchasePet,
    activatePet,
    feedPet,
    loadDecorations,
    loadUserDecorations,
    purchaseDecoration,
    equipDecoration,
    unequipDecoration
  }
})

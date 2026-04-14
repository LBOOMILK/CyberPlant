// frontend/src/stores/userStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  // ========== 状态 ==========
  const username = ref('绿色园丁')
  const points = ref(100)  // 初始积分
  const seeds = ref([])    // 种子背包 { id, rarity, purchasedAt }
  const crops = ref([])    // 作物背包 { id, rarity, harvestedAt }

  // ========== 稀有度配置 ==========
  const rarityConfig = {
    C: { buyPrice: 10, sellPrice: 20, name: '普通种子', cropName: '普通作物' },
    B: { buyPrice: 30, sellPrice: 60, name: '稀有种子', cropName: '稀有作物' },
    A: { buyPrice: 50, sellPrice: 100, name: '史诗种子', cropName: '史诗作物' },
    S: { buyPrice: 100, sellPrice: 200, name: '传说种子', cropName: '传说作物' },
    SSS: { buyPrice: 300, sellPrice: 600, name: '神级种子', cropName: '神级作物' }
  }

  // ========== 计算属性 ==========
  const totalPoints = computed(() => points.value)
  const seedCount = computed(() => seeds.value.length)
  const cropCount = computed(() => crops.value.length)
  
  // 按稀有度分组的种子
  const groupedSeeds = computed(() => {
    return seeds.value.reduce((groups, seed) => {
      const rarity = seed.rarity
      if (!groups[rarity]) {
        groups[rarity] = []
      }
      groups[rarity].push(seed)
      return groups
    }, {})
  })
  
  // 按稀有度分组的作物
  const groupedCrops = computed(() => {
    return crops.value.reduce((groups, crop) => {
      const rarity = crop.rarity
      if (!groups[rarity]) {
        groups[rarity] = []
      }
      groups[rarity].push(crop)
      return groups
    }, {})
  })

  // ========== 初始化 ==========
  async function loadFromLocal() {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        // 如果没有token，使用本地存储
        loadFromLocalStorage()
        return
      }
      
      // 从后端API获取用户信息
      const userResponse = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (userResponse.ok) {
        const userData = await userResponse.json()
        username.value = userData.name
        points.value = userData.points || 0
        // 保存用户ID到本地存储
        localStorage.setItem('user_id', userData.id)
      }
      
      // 从后端API获取背包数据
      const backpackResponse = await fetch(`${import.meta.env.VITE_API_URL}/user/backpack`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (backpackResponse.ok) {
        const backpackData = await backpackResponse.json()
        seeds.value = backpackData.seeds || []
        crops.value = backpackData.crops || []
        // 保存到本地存储
        saveToLocalStorage()
      }
    } catch (error) {
      console.error('Failed to load data from API:', error)
      // API加载失败时使用本地存储
      loadFromLocalStorage()
    }
  }

  function getCurrentUserKey() {
    const userId = localStorage.getItem('user_id') || 'guest'
    return `user_${userId}`
  }

  function loadFromLocalStorage() {
    const userKey = getCurrentUserKey()
    
    const savedPoints = localStorage.getItem(`${userKey}_points`)
    if (savedPoints) points.value = parseInt(savedPoints)

    const savedSeeds = localStorage.getItem(`${userKey}_seeds`)
    if (savedSeeds) seeds.value = JSON.parse(savedSeeds)

    const savedCrops = localStorage.getItem(`${userKey}_crops`)
    if (savedCrops) crops.value = JSON.parse(savedCrops)

    const savedUsername = localStorage.getItem(`${userKey}_username`)
    if (savedUsername) username.value = savedUsername
  }

  function saveToLocalStorage() {
    const userKey = getCurrentUserKey()
    
    localStorage.setItem(`${userKey}_points`, points.value.toString())
    localStorage.setItem(`${userKey}_seeds`, JSON.stringify(seeds.value))
    localStorage.setItem(`${userKey}_crops`, JSON.stringify(crops.value))
    localStorage.setItem(`${userKey}_username`, username.value)
  }

  // ========== 积分操作 ==========
  async function addPoints(amount) {
    points.value += amount
    await updatePoints()
    saveToLocalStorage()
  }

  async function deductPoints(amount) {
    if (points.value >= amount) {
      points.value -= amount
      await updatePoints()
      saveToLocalStorage()
      return true
    }
    return false
  }

  async function updatePoints() {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/user/points`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ points: points.value })
        })
        
        if (response.ok) {
          saveToLocalStorage()
        }
      }
    } catch (error) {
      console.error('Failed to update points:', error)
      saveToLocalStorage()
    }
  }

  // ========== 种子操作 ==========
  async function addSeed(rarity) {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/user/seeds`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ rarity })
        })
        
        if (response.ok) {
          const seed = await response.json()
          seeds.value.push(seed)
          saveToLocalStorage()
          return seed
        }
      }
      
      // API失败时使用本地添加
      const seed = {
        id: Date.now() + Math.random(),
        rarity: rarity,
        purchasedAt: Date.now()
      }
      seeds.value.push(seed)
      saveToLocalStorage()
      return seed
    } catch (error) {
      console.error('Failed to add seed:', error)
      // 错误时使用本地添加
      const seed = {
        id: Date.now() + Math.random(),
        rarity: rarity,
        purchasedAt: Date.now()
      }
      seeds.value.push(seed)
      saveToLocalStorage()
      return seed
    }
  }

  async function removeSeed(seedId) {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/user/seeds/${seedId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (response.ok) {
          const index = seeds.value.findIndex(s => s.id === seedId)
          if (index !== -1) {
            seeds.value.splice(index, 1)
            saveToLocalStorage()
            return true
          }
        }
      }
      
      // API失败时使用本地删除
      const index = seeds.value.findIndex(s => s.id === seedId)
      if (index !== -1) {
        seeds.value.splice(index, 1)
        saveToLocalStorage()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to remove seed:', error)
      // 错误时使用本地删除
      const index = seeds.value.findIndex(s => s.id === seedId)
      if (index !== -1) {
        seeds.value.splice(index, 1)
        saveToLocalStorage()
        return true
      }
      return false
    }
  }

  async function sellSeed(seedId) {
    const seed = seeds.value.find(s => s.id === seedId)
    if (seed) {
      const price = rarityConfig[seed.rarity].buyPrice
      await addPoints(price)
      await removeSeed(seedId)
      saveToLocalStorage()
      return { success: true, price }
    }
    return { success: false }
  }

  // ========== 作物操作 ==========
  async function addCrop(rarity) {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/user/crops`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ rarity })
        })
        
        if (response.ok) {
          const crop = await response.json()
          crops.value.push(crop)
          saveToLocalStorage()
          return crop
        }
      }
      
      // API失败时使用本地添加
      const crop = {
        id: Date.now() + Math.random(),
        rarity: rarity,
        harvestedAt: Date.now()
      }
      crops.value.push(crop)
      saveToLocalStorage()
      return crop
    } catch (error) {
      console.error('Failed to add crop:', error)
      // 错误时使用本地添加
      const crop = {
        id: Date.now() + Math.random(),
        rarity: rarity,
        harvestedAt: Date.now()
      }
      crops.value.push(crop)
      saveToLocalStorage()
      return crop
    }
  }

  async function removeCrop(cropId) {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/user/crops/${cropId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (response.ok) {
          const index = crops.value.findIndex(c => c.id === cropId)
          if (index !== -1) {
            crops.value.splice(index, 1)
            saveToLocalStorage()
            return true
          }
        }
      }
      
      // API失败时使用本地删除
      const index = crops.value.findIndex(c => c.id === cropId)
      if (index !== -1) {
        crops.value.splice(index, 1)
        saveToLocalStorage()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to remove crop:', error)
      // 错误时使用本地删除
      const index = crops.value.findIndex(c => c.id === cropId)
      if (index !== -1) {
        crops.value.splice(index, 1)
        saveToLocalStorage()
        return true
      }
      return false
    }
  }

  async function sellCrop(cropId) {
    const crop = crops.value.find(c => c.id === cropId)
    if (crop) {
      const price = rarityConfig[crop.rarity].sellPrice
      await addPoints(price)
      await removeCrop(cropId)
      saveToLocalStorage()
      return { success: true, price }
    }
    return { success: false }
  }

  // ========== 重置数据 ==========
  async function resetAllData() {
    points.value = 100
    seeds.value = []
    crops.value = []
    username.value = '绿色园丁'
    await updatePoints()
    saveToLocalStorage()
  }

  return {
    // 状态
    username,
    points,
    seeds,
    crops,
    rarityConfig,
    // 计算属性
    totalPoints,
    seedCount,
    cropCount,
    groupedSeeds,
    groupedCrops,
    // 方法
    loadFromLocal,
    addPoints,
    deductPoints,
    addSeed,
    removeSeed,
    sellSeed,
    addCrop,
    removeCrop,
    sellCrop,
    resetAllData
  }
})
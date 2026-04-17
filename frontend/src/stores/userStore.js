// frontend/src/stores/userStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  // ========== 状态 ==========
  const username = ref('绿色园丁')
  const points = ref(100)  // 初始积分
  const seeds = ref({})    // 种子背包 { rarity: quantity }
  const crops = ref({})    // 作物背包 { rarity: quantity }

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
  const seedCount = computed(() => {
    const values = Object.values(seeds.value)
    return values.reduce((sum, quantity) => {
      return sum + (typeof quantity === 'number' ? quantity : 0)
    }, 0)
  })
  const cropCount = computed(() => {
    const values = Object.values(crops.value)
    return values.reduce((sum, quantity) => {
      return sum + (typeof quantity === 'number' ? quantity : 0)
    }, 0)
  })
  
  // 按稀有度分组的种子（直接返回种子数量映射）
  const groupedSeeds = computed(() => {
    return { ...seeds.value }
  })
  
  // 按稀有度分组的作物（直接返回作物数量映射）
  const groupedCrops = computed(() => {
    return { ...crops.value }
  })

  // ========== 初始化 ==========
  async function loadFromLocal() {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      throw new Error('未登录，请先登录')
    }
    
    // 从后端API获取用户信息
    const userResponse = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!userResponse.ok) {
      throw new Error('获取用户信息失败，请检查网络连接')
    }
    
    const userData = await userResponse.json()
    username.value = userData.name
    points.value = userData.points || 0
    // 从用户数据中获取背包数据
    seeds.value = typeof userData.seeds === 'object' && userData.seeds !== null && !Array.isArray(userData.seeds) ? userData.seeds : {}
    crops.value = typeof userData.crops === 'object' && userData.crops !== null && !Array.isArray(userData.crops) ? userData.crops : {}
    // 保存用户ID到本地存储
    localStorage.setItem('user_id', userData.id)
    // 保存到本地存储
    saveToLocalStorage()
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
    if (savedSeeds) {
      try {
        const parsedSeeds = JSON.parse(savedSeeds)
        // 确保seeds始终是对象
        seeds.value = typeof parsedSeeds === 'object' && parsedSeeds !== null ? parsedSeeds : {}
      } catch (error) {
        console.error('Failed to parse seeds:', error)
        seeds.value = {}
      }
    } else {
      seeds.value = {}
    }

    const savedCrops = localStorage.getItem(`${userKey}_crops`)
    if (savedCrops) {
      try {
        const parsedCrops = JSON.parse(savedCrops)
        // 确保crops始终是对象
        crops.value = typeof parsedCrops === 'object' && parsedCrops !== null ? parsedCrops : {}
      } catch (error) {
        console.error('Failed to parse crops:', error)
        crops.value = {}
      }
    } else {
      crops.value = {}
    }

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
          const data = await response.json()
          seeds.value[rarity] = data.quantity
          saveToLocalStorage()
          return data
        }
      }
      
      // API失败时使用本地添加
      seeds.value[rarity] = (seeds.value[rarity] || 0) + 1
      saveToLocalStorage()
      return { rarity, quantity: seeds.value[rarity] }
    } catch (error) {
      console.error('Failed to add seed:', error)
      // 错误时使用本地添加
      seeds.value[rarity] = (seeds.value[rarity] || 0) + 1
      saveToLocalStorage()
      return { rarity, quantity: seeds.value[rarity] }
    }
  }

  async function removeSeed(rarity) {
    try {
      const token = localStorage.getItem('auth_token')
      console.log('removeSeed called with:', rarity, 'token:', token)
      if (token) {
        const url = `${import.meta.env.VITE_API_URL}/user/seeds/${rarity}`
        console.log('Fetch URL:', url)
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ quantity: 1 })
        })
        
        console.log('Response status:', response.status, response.statusText)
        if (response.ok) {
          const data = await response.json()
          seeds.value[rarity] = data.quantity
          saveToLocalStorage()
          return true
        } else {
          // API失败时返回失败消息
          console.error('API delete failed:', response.status, response.statusText)
          return false
        }
      } else {
        // 没有token时使用本地删除
        console.log('No token, using local delete')
        if (seeds.value[rarity] > 0) {
          seeds.value[rarity]--
          if (seeds.value[rarity] === 0) {
            delete seeds.value[rarity]
          }
          saveToLocalStorage()
          return true
        }
        return false
      }
    } catch (error) {
      console.error('Failed to remove seed:', error)
      // 错误时返回失败消息
      return false
    }
  }

  async function sellSeed(rarity) {
    if (seeds.value[rarity] > 0) {
      const price = rarityConfig[rarity].buyPrice
      await addPoints(price)
      const success = await removeSeed(rarity)
      if (success) {
        saveToLocalStorage()
        return { success: true, price }
      }
      return { success: false }
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
          const data = await response.json()
          crops.value[rarity] = data.quantity
          saveToLocalStorage()
          return data
        }
      }
      
      // API失败时使用本地添加
      crops.value[rarity] = (crops.value[rarity] || 0) + 1
      saveToLocalStorage()
      return { rarity, quantity: crops.value[rarity] }
    } catch (error) {
      console.error('Failed to add crop:', error)
      // 错误时使用本地添加
      crops.value[rarity] = (crops.value[rarity] || 0) + 1
      saveToLocalStorage()
      return { rarity, quantity: crops.value[rarity] }
    }
  }

  async function removeCrop(rarity) {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/user/crops/${rarity}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ quantity: 1 })
        })
        
        if (response.ok) {
          const data = await response.json()
          crops.value[rarity] = data.quantity
          saveToLocalStorage()
          return true
        }
      }
      
      // API失败时使用本地删除
      if (crops.value[rarity] > 0) {
        crops.value[rarity]--
        if (crops.value[rarity] === 0) {
          delete crops.value[rarity]
        }
        saveToLocalStorage()
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to remove crop:', error)
      // 错误时使用本地删除
      if (crops.value[rarity] > 0) {
        crops.value[rarity]--
        if (crops.value[rarity] === 0) {
          delete crops.value[rarity]
        }
        saveToLocalStorage()
        return true
      }
      return false
    }
  }

  async function sellCrop(rarity) {
    if (crops.value[rarity] > 0) {
      const price = rarityConfig[rarity].sellPrice
      await addPoints(price)
      const success = await removeCrop(rarity)
      if (success) {
        saveToLocalStorage()
        return { success: true, price }
      }
      return { success: false }
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
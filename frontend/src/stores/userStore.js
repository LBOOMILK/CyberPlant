// frontend/src/stores/userStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  // ========== 状态 ==========
  const username = ref('绿色园丁')
  const points = ref(100)  // 初始积分
  const seeds = ref({})    // 种子背包 { rarity: quantity }
  const crops = ref({})    // 作物背包 { rarity: quantity }
  const uses = ref({})     // 可使用物品背包 { rarity: quantity }

  // ========== 稀有度配置 ==========
  const rarityConfig = {
    C: { buyPrice: 10, sellPrice: 20, name: '普通种子', cropName: '普通作物' },
    B: { buyPrice: 30, sellPrice: 60, name: '稀有种子', cropName: '稀有作物' },
    A: { buyPrice: 50, sellPrice: 100, name: '史诗种子', cropName: '史诗作物' },
    S: { buyPrice: 100, sellPrice: 200, name: '传说种子', cropName: '传说作物'},
    SSS: { buyPrice: 300, sellPrice: 600, name: '神级种子', cropName: '神级作物' }
  }

  // 肥料价格配置（买卖价格相同，避免刷分）
  const fertilizerConfig = {
    C: { price: 20, name: '普通肥料' },
    B: { price: 60, name: '稀有肥料' },
    A: { price: 100, name: '史诗肥料' },
    S: { price: 200, name: '传说肥料' }
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
  
  // 可使用物品数量
  const useCount = computed(() => {
    const values = Object.values(uses.value)
    return values.reduce((sum, quantity) => {
      return sum + (typeof quantity === 'number' ? quantity : 0)
    }, 0)
  })
  
  // 稀有度排序顺序：C < B < A < S < SSS
const rarityOrder = ['C', 'B', 'A', 'S', 'SSS']

// 按稀有度排序对象
function sortByRarity(obj) {
  const sorted = {}
  for (const rarity of rarityOrder) {
    if (obj[rarity]) {
      sorted[rarity] = obj[rarity]
    }
  }
  return sorted
}

// 按稀有度分组的种子（按品质从低到高排序）
const groupedSeeds = computed(() => {
  return sortByRarity(seeds.value)
})

// 按稀有度分组的作物（按品质从低到高排序）
const groupedCrops = computed(() => {
  return sortByRarity(crops.value)
})

// 按稀有度分组的可使用物品（按品质从低到高排序）
const groupedUses = computed(() => {
  return sortByRarity(uses.value)
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
    uses.value = typeof userData.uses === 'object' && userData.uses !== null && !Array.isArray(userData.uses) ? userData.uses : {}
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

    const savedUses = localStorage.getItem(`${userKey}_uses`)
    if (savedUses) {
      try {
        const parsedUses = JSON.parse(savedUses)
        // 确保uses始终是对象
        uses.value = typeof parsedUses === 'object' && parsedUses !== null ? parsedUses : {}
      } catch (error) {
        console.error('Failed to parse uses:', error)
        uses.value = {}
      }
    } else {
      uses.value = {}
    }

    const savedUsername = localStorage.getItem(`${userKey}_username`)
    if (savedUsername) username.value = savedUsername
  }

  function saveToLocalStorage() {
    const userKey = getCurrentUserKey()
    
    localStorage.setItem(`${userKey}_points`, points.value.toString())
    localStorage.setItem(`${userKey}_seeds`, JSON.stringify(seeds.value))
    localStorage.setItem(`${userKey}_crops`, JSON.stringify(crops.value))
    localStorage.setItem(`${userKey}_uses`, JSON.stringify(uses.value))
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
  async function addSeed(rarity, totalPrice, quantity = 1) {
    try {
      // 先检查积分是否足够
      if (points.value < totalPrice) {
        return false
      }

      const token = localStorage.getItem('auth_token')
      if (token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/user/seeds`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ rarity, price: totalPrice / quantity, quantity })
        })

        if (response.ok) {
          const data = await response.json()
          seeds.value[rarity] = data.quantity
          points.value = data.points || points.value
          saveToLocalStorage()
          return data
        }
      }

      // API失败时使用本地添加
      console.log('API failed, using local add')
      seeds.value[rarity] = (seeds.value[rarity] || 0) + quantity
      if (totalPrice) {
        points.value -= totalPrice
      }
      saveToLocalStorage()
      return { rarity, quantity: seeds.value[rarity], points: points.value }
    } catch (error) {
      console.error('Failed to add seed:', error)
      // 错误时使用本地添加
      if (points.value >= totalPrice) {
        seeds.value[rarity] = (seeds.value[rarity] || 0) + quantity
        if (totalPrice) {
          points.value -= totalPrice
        }
        saveToLocalStorage()
        return { rarity, quantity: seeds.value[rarity], points: points.value }
      }
      return false
    }
  }

  async function removeSeed(rarity, price = 0) {
    try {
      const token = localStorage.getItem('auth_token')
      console.log('removeSeed called with:', rarity, 'price:', price, 'token:', token)
      if (token) {
        const url = `${import.meta.env.VITE_API_URL}/user/seeds/${rarity}`
        console.log('Fetch URL:', url)
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ quantity: 1, price })
        })
        
        console.log('Response status:', response.status, response.statusText)
        if (response.ok) {
          const data = await response.json()
          seeds.value[rarity] = data.quantity
          points.value = data.points || points.value
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
          if (price) {
            points.value += price
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
      const success = await removeSeed(rarity, price)
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

  async function removeCrop(rarity, price = 0) {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/user/crops/${rarity}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ quantity: 1, price })
        })
        
        if (response.ok) {
          const data = await response.json()
          crops.value[rarity] = data.quantity
          points.value = data.points || points.value
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
        if (price) {
          points.value += price
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
        if (price) {
          points.value += price
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
      const success = await removeCrop(rarity, price)
      if (success) {
        saveToLocalStorage()
        return { success: true, price }
      }
      return { success: false }
    }
    return { success: false }
  }

  async function removeUse(rarity, price = 0) {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const url = `${import.meta.env.VITE_API_URL}/user/uses/${rarity}`
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ quantity: 1, price })
        })
        
        if (response.ok) {
          const data = await response.json()
          uses.value[rarity] = data.quantity
          points.value = data.points || points.value
          saveToLocalStorage()
          return true
        } else {
          console.error('API delete failed:', response.status, response.statusText)
          return false
        }
      } else {
        if (uses.value[rarity] > 0) {
          uses.value[rarity]--
          if (uses.value[rarity] === 0) {
            delete uses.value[rarity]
          }
          if (price) {
            points.value += price
          }
          saveToLocalStorage()
          return true
        }
        return false
      }
    } catch (error) {
      console.error('Failed to remove use:', error)
      return false
    }
  }

  // 卖出可使用物品
  async function sellUse(rarity) {
    if (uses.value[rarity] > 0) {
      const price = fertilizerConfig[rarity].price
      const success = await removeUse(rarity, price)
      if (success) {
        saveToLocalStorage()
        return { success: true, price }
      }
      return { success: false }
    }
    return { success: false }
  }

  // 添加可使用物品
  async function addUse(rarity, totalPrice, quantity = 1) {
    try {
      // 先检查积分是否足够
      if (points.value < totalPrice) {
        return false
      }

      const token = localStorage.getItem('auth_token')
      if (token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/user/uses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ rarity, price: totalPrice / quantity, quantity })
        })

        if (response.ok) {
          const data = await response.json()
          uses.value[rarity] = data.quantity
          points.value = data.points || points.value
          saveToLocalStorage()
          return data
        }
      }

      // API失败时使用本地添加
      console.log('API failed, using local add')
      points.value -= totalPrice
      if (!uses.value[rarity]) {
        uses.value[rarity] = 0
      }
      uses.value[rarity] += quantity
      saveToLocalStorage()
      return { rarity, quantity: uses.value[rarity], points: points.value }
    } catch (error) {
      console.error('Failed to add use:', error)
      // 错误时使用本地添加
      if (points.value >= totalPrice) {
        points.value -= totalPrice
        if (!uses.value[rarity]) {
          uses.value[rarity] = 0
        }
        uses.value[rarity] += quantity
        saveToLocalStorage()
        return { rarity, quantity: uses.value[rarity], points: points.value }
      }
      return false
    }
  }

  // 重置所有数据
  function resetAllData() {
    username.value = '绿色园丁'
    points.value = 100
    seeds.value = {}
    crops.value = {}
    uses.value = {}
  }

  return {
    // 状态
    username,
    points,
    seeds,
    crops,
    uses,
    rarityConfig,
    fertilizerConfig,
    // 计算属性
    totalPoints,
    seedCount,
    cropCount,
    useCount,
    groupedSeeds,
    groupedCrops,
    groupedUses,
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
    addUse,
    sellUse,
    resetAllData
  }
})
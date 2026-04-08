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
  function loadFromLocal() {
    const savedPoints = localStorage.getItem('user_points')
    if (savedPoints) points.value = parseInt(savedPoints)

    const savedSeeds = localStorage.getItem('user_seeds')
    if (savedSeeds) seeds.value = JSON.parse(savedSeeds)

    const savedCrops = localStorage.getItem('user_crops')
    if (savedCrops) crops.value = JSON.parse(savedCrops)

    const savedUsername = localStorage.getItem('user_username')
    if (savedUsername) username.value = savedUsername
  }

  function saveToLocal() {
    localStorage.setItem('user_points', points.value)
    localStorage.setItem('user_seeds', JSON.stringify(seeds.value))
    localStorage.setItem('user_crops', JSON.stringify(crops.value))
    localStorage.setItem('user_username', username.value)
  }

  // ========== 积分操作 ==========
  function addPoints(amount) {
    points.value += amount
    saveToLocal()
  }

  function deductPoints(amount) {
    if (points.value >= amount) {
      points.value -= amount
      saveToLocal()
      return true
    }
    return false
  }

  // ========== 种子操作 ==========
  function addSeed(rarity) {
    seeds.value.push({
      id: Date.now() + Math.random(),
      rarity: rarity,
      purchasedAt: Date.now()
    })
    saveToLocal()
  }

  function removeSeed(seedId) {
    const index = seeds.value.findIndex(s => s.id === seedId)
    if (index !== -1) {
      seeds.value.splice(index, 1)
      saveToLocal()
      return true
    }
    return false
  }

  function sellSeed(seedId) {
    const seed = seeds.value.find(s => s.id === seedId)
    if (seed) {
      const price = rarityConfig[seed.rarity].buyPrice
      addPoints(price)
      removeSeed(seedId)
      return { success: true, price }
    }
    return { success: false }
  }

  // ========== 作物操作 ==========
  function addCrop(rarity) {
    crops.value.push({
      id: Date.now() + Math.random(),
      rarity: rarity,
      harvestedAt: Date.now()
    })
    saveToLocal()
  }

  function removeCrop(cropId) {
    const index = crops.value.findIndex(c => c.id === cropId)
    if (index !== -1) {
      crops.value.splice(index, 1)
      saveToLocal()
      return true
    }
    return false
  }

  function sellCrop(cropId) {
    const crop = crops.value.find(c => c.id === cropId)
    if (crop) {
      const price = rarityConfig[crop.rarity].sellPrice
      addPoints(price)
      removeCrop(cropId)
      return { success: true, price }
    }
    return { success: false }
  }

  // ========== 重置数据 ==========
  function resetAllData() {
    points.value = 100
    seeds.value = []
    crops.value = []
    username.value = '绿色园丁'
    saveToLocal()
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
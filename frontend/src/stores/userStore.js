// frontend/src/stores/userStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  // ========== 状态 ==========
  const username = ref('绿色园丁')
  const isNewUser = ref(false)
  const currencies = ref({
    silver_coin: 0,
    gold_coin: 0,
    diamond: 0
  })

  // ========== 货币符号配置 ==========
  const currencyConfig = {
    silver_coin: { name: '银币', icon: '🪙', color: '#C0C0C0' },
    gold_coin: { name: '金币', icon: '🥇', color: '#FFD700' },
    diamond: { name: '钻石', icon: '💎', color: '#B9F2FF' }
  }

  // ========== 兑换规则 ==========
  const exchangeRules = {
    'silver_coin->gold_coin': { rate: 100, loss: 0, desc: '100银币 → 1金币' },
    'gold_coin->diamond': { rate: 100, loss: 0, desc: '100金币 → 1钻石' },
    'gold_coin->silver_coin': { rate: 95, loss: 5, desc: '1金币 → 95银币 (5%损耗)' },
    'diamond->gold_coin': { rate: 90, loss: 10, desc: '1钻石 → 90金币 (10%损耗)' }
  }

  // ========== 计算属性 ==========
  const silverCoin = computed(() => currencies.value.silver_coin)
  const goldCoin = computed(() => currencies.value.gold_coin)
  const diamond = computed(() => currencies.value.diamond)

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
    isNewUser.value = userData.is_new_user || false

    // 更新货币
    if (userData.currencies) {
      currencies.value = {
        silver_coin: Number(userData.currencies.silver_coin) || 0,
        gold_coin: Number(userData.currencies.gold_coin) || 0,
        diamond: Number(userData.currencies.diamond) || 0
      }
    }

    // 保存用户ID到本地存储
    localStorage.setItem('user_id', userData.id)
    saveToLocalStorage()
  }

  // 加载货币余额
  async function loadCurrencies() {
    const token = localStorage.getItem('auth_token')
    if (!token) return

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/currencies`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        currencies.value = {
          silver_coin: Number(data.silver_coin) || 0,
          gold_coin: Number(data.gold_coin) || 0,
          diamond: Number(data.diamond) || 0
        }
        saveToLocalStorage()
      }
    } catch (error) {
      console.error('Failed to load currencies:', error)
    }
  }

  // 货币兑换
  async function exchangeCurrency(from, to, amount) {
    const token = localStorage.getItem('auth_token')
    if (!token) return { success: false, error: '未登录' }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/currencies/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ from, to, amount })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.currencies) {
          currencies.value = {
            silver_coin: Number(data.currencies.silver_coin) || 0,
            gold_coin: Number(data.currencies.gold_coin) || 0,
            diamond: Number(data.currencies.diamond) || 0
          }
          saveToLocalStorage()
        }
        return { success: true, data }
      } else {
        const errorData = await response.json()
        return { success: false, error: errorData.error }
      }
    } catch (error) {
      console.error('Exchange error:', error)
      return { success: false, error: '兑换失败，请稍后重试' }
    }
  }

  // 领取新手礼包
  async function claimNewbiePack() {
    const token = localStorage.getItem('auth_token')
    if (!token) return { success: false, error: '未登录' }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/newbie-pack`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        isNewUser.value = false
        if (data.currencies) {
          currencies.value = {
            silver_coin: Number(data.currencies.silver_coin) || 0,
            gold_coin: Number(data.currencies.gold_coin) || 0,
            diamond: Number(data.currencies.diamond) || 0
          }
          saveToLocalStorage()
        }
        return { success: true, data }
      } else {
        const errorData = await response.json()
        return { success: false, error: errorData.error }
      }
    } catch (error) {
      console.error('Claim newbie pack error:', error)
      return { success: false, error: '领取失败，请稍后重试' }
    }
  }

  // ========== 本地存储 ==========
  function getCurrentUserKey() {
    const userId = localStorage.getItem('user_id') || 'guest'
    return `user_${userId}`
  }

  function loadFromLocalStorage() {
    const userKey = getCurrentUserKey()

    const savedCurrencies = localStorage.getItem(`${userKey}_currencies`)
    if (savedCurrencies) {
      try {
        const parsed = JSON.parse(savedCurrencies)
        currencies.value = {
          silver_coin: Number(parsed.silver_coin) || 0,
          gold_coin: Number(parsed.gold_coin) || 0,
          diamond: Number(parsed.diamond) || 0
        }
      } catch (error) {
        console.error('Failed to parse currencies:', error)
      }
    }

    const savedUsername = localStorage.getItem(`${userKey}_username`)
    if (savedUsername) username.value = savedUsername

    const savedIsNewUser = localStorage.getItem(`${userKey}_is_new_user`)
    if (savedIsNewUser !== null) isNewUser.value = savedIsNewUser === 'true'
  }

  function saveToLocalStorage() {
    const userKey = getCurrentUserKey()
    localStorage.setItem(`${userKey}_currencies`, JSON.stringify(currencies.value))
    localStorage.setItem(`${userKey}_username`, username.value)
    localStorage.setItem(`${userKey}_is_new_user`, String(isNewUser.value))
  }

  function resetAllData() {
    username.value = '未获取用户名'
    isNewUser.value = false
    currencies.value = { silver_coin: 0, gold_coin: 0, diamond: 0 }
  }

  return {
    // 状态
    username,
    isNewUser,
    currencies,
    currencyConfig,
    exchangeRules,
    // 计算属性
    silverCoin,
    goldCoin,
    diamond,
    // 方法
    loadFromLocal,
    loadCurrencies,
    exchangeCurrency,
    claimNewbiePack,
    loadFromLocalStorage,
    saveToLocalStorage,
    resetAllData
  }
})

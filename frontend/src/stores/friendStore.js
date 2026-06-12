// frontend/src/stores/friendStore.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserStore } from './userStore'

const API_URL = import.meta.env.VITE_API_URL

export const useFriendStore = defineStore('friend', () => {
  // ========== 状态 ==========
  const friends = ref([])
  const pendingRequests = ref([])
  const sentRequests = ref([])
  const searchResults = ref([])
  const loading = ref(false)

  // ========== 工具函数 ==========
  function getAuthHeaders() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  }

  // ========== 加载好友列表 ==========
  async function loadFriends() {
    loading.value = true
    try {
      const response = await fetch(`${API_URL}/user/friends`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || '获取好友列表失败')
      }
      const data = await response.json()
      friends.value = data.friends || []
      pendingRequests.value = data.pending_requests || []
      sentRequests.value = data.sent_requests || []
      return data
    } catch (error) {
      console.error('loadFriends error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // ========== 发送好友请求 ==========
  async function sendRequest(friendId) {
    const response = await fetch(`${API_URL}/user/friends`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ friend_id: friendId })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '发送好友请求失败')
    }
    const data = await response.json()
    // 刷新列表
    await loadFriends()
    return data
  }

  // ========== 处理好友请求 ==========
  async function handleRequest(friendshipId, action) {
    const response = await fetch(`${API_URL}/user/friends/${friendshipId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action })
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '处理请求失败')
    }
    const data = await response.json()
    await loadFriends()
    return data
  }

  // ========== 删除好友 ==========
  async function deleteFriend(friendshipId) {
    const response = await fetch(`${API_URL}/user/friends/${friendshipId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '删除好友失败')
    }
    const data = await response.json()
    await loadFriends()
    return data
  }

  // ========== 搜索用户 ==========
  async function searchUsers(keyword) {
    if (!keyword || keyword.trim().length === 0) {
      searchResults.value = []
      return []
    }
    const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(keyword.trim())}`, {
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '搜索失败')
    }
    const data = await response.json()
    searchResults.value = data
    return data
  }

  // ========== 送礼 ==========
  async function sendGift(friendId, giftData) {
    const response = await fetch(`${API_URL}/user/friends/${friendId}/gift`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(giftData)
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '送礼失败')
    }
    const data = await response.json()

    // 更新货币余额
    const userStore = useUserStore()
    if (data.currencies) {
      userStore.currencies.value = {
        silver_coin: Number(data.currencies.silver_coin) || 0,
        gold_coin: Number(data.currencies.gold_coin) || 0,
        diamond: Number(data.currencies.diamond) || 0
      }
      userStore.saveToLocalStorage()
    }

    return data
  }

  // ========== 货币转让 ==========
  async function transfer(friendId, transferData) {
    const response = await fetch(`${API_URL}/user/friends/${friendId}/transfer`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(transferData)
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '转让失败')
    }
    const data = await response.json()

    // 更新货币余额
    const userStore = useUserStore()
    if (data.currencies) {
      userStore.currencies.value = {
        silver_coin: Number(data.currencies.silver_coin) || 0,
        gold_coin: Number(data.currencies.gold_coin) || 0,
        diamond: Number(data.currencies.diamond) || 0
      }
      userStore.saveToLocalStorage()
    }

    return data
  }

  return {
    friends,
    pendingRequests,
    sentRequests,
    searchResults,
    loading,
    loadFriends,
    sendRequest,
    handleRequest,
    deleteFriend,
    searchUsers,
    sendGift,
    transfer
  }
})

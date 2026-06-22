<template>
  <div class="friend-page">
    <Toast ref="toastRef" />
    <div class="page-header">
      <h2>👥 好友</h2>
      <button class="gift-box-btn" @click="openGiftBox">
        🎁 礼物箱
        <span v-if="pendingGiftCount > 0" class="gift-badge">{{ pendingGiftCount }}</span>
      </button>
    </div>

    <!-- 搜索区域 -->
    <div class="search-section">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索用户名或ID..."
          @input="onSearchInput"
          @focus="showSearch = true"
        />
        <button v-if="searchKeyword" class="clear-btn" @click="clearSearch">✕</button>
      </div>
      <!-- 搜索结果 -->
      <div v-if="showSearch && searchKeyword" class="search-results">
        <div v-if="searchLoading" class="search-loading">搜索中...</div>
        <div v-else-if="friendStore.searchResults.length === 0" class="search-empty">
          没有找到用户
        </div>
        <div
          v-for="user in friendStore.searchResults"
          :key="user.id"
          class="search-item"
        >
          <span class="user-avatar">👤</span>
          <span class="user-info">
            <span class="user-name">{{ user.name }}</span>
            <span class="user-id">ID: {{ user.id }}</span>
          </span>
          <button
            class="add-btn"
            :disabled="isAlreadyFriend(user.id)"
            @click="sendFriendRequest(user.id)"
          >
            {{ isAlreadyFriend(user.id) ? '已添加' : '添加' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 待处理请求 -->
    <div v-if="friendStore.pendingRequests.length > 0" class="section">
      <div class="section-header" @click="showPending = !showPending">
        <h3>📬 好友请求 <span class="badge">{{ friendStore.pendingRequests.length }}</span></h3>
        <span class="toggle-arrow">{{ showPending ? '▼' : '▶' }}</span>
      </div>
      <div v-if="showPending" class="request-list">
        <div
          v-for="req in friendStore.pendingRequests"
          :key="req.friendship_id"
          class="request-card"
        >
          <span class="user-avatar">👤</span>
          <div class="request-info">
            <span class="request-name">{{ req.sender_name }}</span>
            <span class="request-time">{{ formatTime(req.created_at) }}</span>
          </div>
          <div class="request-actions">
            <button class="accept-btn" @click="handleRequest(req.friendship_id, 'accept')">✓</button>
            <button class="reject-btn" @click="handleRequest(req.friendship_id, 'reject')">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 我发出的请求 -->
    <div v-if="friendStore.sentRequests.length > 0" class="section">
      <div class="section-header" @click="showSent = !showSent">
        <h3>📤 已发送请求 <span class="badge">{{ friendStore.sentRequests.length }}</span></h3>
        <span class="toggle-arrow">{{ showSent ? '▼' : '▶' }}</span>
      </div>
      <div v-if="showSent" class="request-list">
        <div
          v-for="req in friendStore.sentRequests"
          :key="req.friendship_id"
          class="request-card"
        >
          <span class="user-avatar">👤</span>
          <div class="request-info">
            <span class="request-name">{{ req.receiver_name }}</span>
            <span class="request-time">{{ formatTime(req.created_at) }}</span>
          </div>
          <span class="pending-label">等待接受</span>
        </div>
      </div>
    </div>

    <!-- 被拒绝的请求 -->
    <div v-if="friendStore.rejectedRequests.length > 0" class="section">
      <div class="section-header" @click="showRejected = !showRejected">
        <h3>❌ 被拒绝 <span class="badge-rejected">{{ friendStore.rejectedRequests.length }}</span></h3>
        <span class="toggle-arrow">{{ showRejected ? '▼' : '▶' }}</span>
      </div>
      <div v-if="showRejected" class="request-list">
        <div
          v-for="req in friendStore.rejectedRequests"
          :key="req.friendship_id"
          class="request-card rejected-card"
        >
          <span class="user-avatar">👤</span>
          <div class="request-info">
            <span class="request-name">{{ req.receiver_name }}</span>
            <span class="request-time">{{ formatTime(req.created_at) }}</span>
          </div>
          <span class="rejected-label">被拒绝</span>
          <div class="request-actions">
            <button class="resend-btn" @click="handleResend(req)" title="重新发送">🔄</button>
            <button class="delete-rejected-btn" @click="handleDeleteRejected(req)" title="删除">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 好友列表 -->
    <div class="section">
      <div class="section-header">
        <h3>💚 我的好友 <span class="badge">{{ friendStore.friends.length }}</span>/50</h3>
      </div>
      <div v-if="friendStore.loading" class="loading">加载中...</div>
      <div v-else-if="friendStore.friends.length === 0" class="empty-state">
        <p>🌿 还没有好友</p>
        <p class="empty-hint">搜索用户名添加好友吧！</p>
      </div>
      <div v-else class="friend-list">
        <div
          v-for="friend in friendStore.friends"
          :key="friend.friendship_id"
          class="friend-card"
        >
          <span class="user-avatar">👤</span>
          <div class="friend-info">
            <span class="friend-name">{{ friend.friend_name }}</span>
          </div>
          <div class="friend-actions">
            <button class="gift-btn" @click="openGiftModal(friend)">🎁</button>
            <button class="delete-btn" @click="confirmDelete(friend)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <Modal
      :visible="showDeleteModal"
      title="删除好友"
      :message="`确定要删除好友 ${deleteTarget?.friend_name} 吗？`"
      confirm-text="删除"
      cancel-text="取消"
      :danger="true"
      @confirm="doDeleteFriend"
      @cancel="showDeleteModal = false"
    />

    <!-- 送礼弹窗 -->
    <GiftModal
      :visible="showGiftModal"
      :friend-id="giftTarget?.friend_id"
      :friend-name="giftTarget?.friend_name"
      @close="showGiftModal = false"
      @gift-sent="handleGift"
    />

    <!-- 礼物箱弹窗 -->
    <div v-if="showGiftBox" class="modal-overlay" @mousedown.self="showGiftBox = false">
      <div class="modal-content gift-box-modal">
        <div class="modal-header">
          <h3>🎁 礼物箱</h3>
          <button class="close-btn" @click="showGiftBox = false">✕</button>
        </div>
        <div v-if="giftBoxLoading" class="loading">加载中...</div>
        <div v-else>
          <div v-if="expiredRefunded > 0" class="expired-banner">
            已过期并退回 {{ expiredRefunded }} 份（已自动返还发送方）
          </div>
          <div v-if="pendingGifts.length === 0" class="empty-state">
            <p>📭 没有待接收的礼物</p>
          </div>
          <div v-else class="gift-list">
            <div v-for="gift in pendingGifts" :key="gift.id" class="gift-card">
              <div class="gift-info">
                <span class="gift-sender">来自 {{ gift.sender_name }}</span>
                <span class="gift-detail">
                  <img src="/diamond.png" class="small-currency-icon" /> {{ gift.amount }} 钻石
                </span>
              </div>
              <button class="accept-btn" @click="acceptGift(gift.id)">接收</button>
            </div>
            <div class="daily-status">今日已收 {{ dailyReceived }}/{{ dailyLimit }}</div>
            <button class="accept-all-btn" @click="acceptAllGifts">一键接收全部</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useFriendStore } from '@/stores/friendStore'
import { useUserStore } from '@/stores/userStore'
import Modal from '@/components/common/Modal.vue'
import GiftModal from '@/components/user/GiftModal.vue'
import Toast from '@/components/common/Toast.vue'

const friendStore = useFriendStore()
const userStore = useUserStore()
const toastRef = ref(null)

function addToast(message, type = 'info') {
  if (toastRef.value) toastRef.value.addToast(message, type)
}

// 搜索
const searchKeyword = ref('')
const showSearch = ref(false)
const searchLoading = ref(false)
let searchTimer = null

// 展开/折叠
const showPending = ref(true)
const showSent = ref(false)
const showRejected = ref(false)

// 删除弹窗
const showDeleteModal = ref(false)
const deleteTarget = ref(null)

// 送礼弹窗
const showGiftModal = ref(false)
const giftTarget = ref(null)

// 礼物箱
const showGiftBox = ref(false)
const pendingGifts = ref([])
const pendingGiftCount = ref(0)
const giftBoxLoading = ref(false)
const expiredRefunded = ref(0)
const dailyReceived = ref(0)
const dailyLimit = ref(5)

let refreshTimer = null

onMounted(async () => {
  try {
    await friendStore.loadFriends()
    await loadPendingGifts()
    // 每30秒刷新一次好友列表，以便及时显示请求状态变化
    refreshTimer = setInterval(async () => {
      try {
        await friendStore.loadFriends()
      } catch (e) {
        console.error('Failed to refresh friends:', e)
      }
    }, 30000)
  } catch (e) {
    console.error('Failed to load friends:', e)
  }
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

async function loadPendingGifts() {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/user/gifts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      pendingGifts.value = data.gifts || []
      pendingGiftCount.value = data.count || 0
      expiredRefunded.value = data.expired_refunded || 0
      dailyReceived.value = data.daily_received || 0
      dailyLimit.value = data.daily_limit || 5
    }
  } catch (e) {
    console.error('Failed to load gifts:', e)
  }
}

async function openGiftBox() {
  showGiftBox.value = true
  giftBoxLoading.value = true
  await loadPendingGifts()
  giftBoxLoading.value = false
}

async function acceptGift(giftId) {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/user/gifts/${giftId}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '接收失败')
    }
    await loadPendingGifts()
    addToast('🎁 礼物接收成功', 'success')
  } catch (e) {
    addToast(e.message, 'error')
  }
}

async function acceptAllGifts() {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${import.meta.env.VITE_API_URL}/user/gifts/accept-all`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || '接收失败')
    }
    const data = await response.json()
    await loadPendingGifts()
    addToast(data.message, 'success')
  } catch (e) {
    addToast(e.message, 'error')
  }
}



// 搜索防抖
function onSearchInput() {
  clearTimeout(searchTimer)
  if (!searchKeyword.value.trim()) {
    friendStore.searchResults = []
    return
  }
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      await friendStore.searchUsers(searchKeyword.value)
    } catch (e) {
      console.error('Search error:', e)
    } finally {
      searchLoading.value = false
    }
  }, 400)
}

function clearSearch() {
  searchKeyword.value = ''
  friendStore.searchResults = []
  showSearch.value = false
}

function isAlreadyFriend(userId) {
  // 检查是否已是好友
  if (friendStore.friends.some(f => f.friend_id === userId)) return true
  // 检查是否已发送请求
  if (friendStore.sentRequests.some(r => r.receiver_id === userId)) return true
  // 检查自己
  const myId = localStorage.getItem('user_id')
  if (userId === myId) return true
  return false
}

async function sendFriendRequest(friendId) {
  try {
    await friendStore.sendRequest(friendId)
    searchKeyword.value = ''
    friendStore.searchResults = []
    showSearch.value = false
    addToast('好友请求已发送', 'success')
  } catch (e) {
    addToast(e.message, 'error')
  }
}

async function handleRequest(friendshipId, action) {
  try {
    await friendStore.handleRequest(friendshipId, action)
    addToast(action === 'accept' ? '已接受好友请求' : '已拒绝好友请求', 'success')
  } catch (e) {
    addToast(e.message, 'error')
  }
}

async function handleResend(req) {
  try {
    await friendStore.resendRequest(req.friendship_id, req.receiver_id)
    addToast('好友请求已重新发送', 'success')
  } catch (e) {
    addToast(e.message, 'error')
  }
}

async function handleDeleteRejected(req) {
  try {
    await friendStore.deleteFriend(req.friendship_id)
    addToast('已删除', 'success')
  } catch (e) {
    addToast(e.message, 'error')
  }
}

function confirmDelete(friend) {
  deleteTarget.value = friend
  showDeleteModal.value = true
}

async function doDeleteFriend() {
  if (!deleteTarget.value) return
  try {
    await friendStore.deleteFriend(deleteTarget.value.friendship_id)
    showDeleteModal.value = false
    deleteTarget.value = null
    addToast('好友已删除', 'success')
  } catch (e) {
    addToast(e.message, 'error')
  }
}

function openGiftModal(friend) {
  giftTarget.value = friend
  showGiftModal.value = true
}

// 友好化送礼错误信息
function formatGiftError(msg) {
  if (!msg) return '送礼失败'
  if (msg.includes('cooldown') || msg.includes('冷却')) {
    const match = msg.match(/(\d+)/)
    return match ? `⏳ 冷却中，请 ${match[1]} 小时后再试` : '⏳ 冷却中，请稍后再试'
  }
  if (msg.includes('limit') || msg.includes('上限') || msg.includes('限额')) {
    return '🚫 今日接收已达上限'
  }
  if (msg.includes('余额') || msg.includes('insufficient') || msg.includes('balance')) {
    return '💔 余额不足'
  }
  return msg
}

async function handleGift(giftData) {
  if (!giftTarget.value) return
  try {
    await friendStore.sendGift(giftTarget.value.friend_id, giftData)
    showGiftModal.value = false
    giftTarget.value = null
    addToast('🎁 礼物已送出，等待对方接收', 'success')
  } catch (e) {
    addToast(formatGiftError(e.message), 'error')
  }
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleDateString()
}
</script>

<style scoped>
.friend-page {
  min-height: 100vh;
  padding: 20px;
  padding-bottom: 100px;
  padding-top: 56px;
  max-width: 600px;
  margin: 0 auto;
  background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
}

.page-header {
  text-align: center;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  color: #2c5a2a;
  margin: 0;
  font-size: 1.4rem;
}

.gift-box-btn {
  position: relative;
  padding: 8px 16px;
  border: 2px solid #ff9800;
  border-radius: 20px;
  background: rgba(255, 152, 0, 0.08);
  color: #e65100;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.gift-box-btn:hover {
  background: rgba(255, 152, 0, 0.15);
  transform: translateY(-1px);
}

.gift-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #f44336;
  color: white;
  font-size: 0.7rem;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gift-box-modal {
  max-width: 440px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: rgba(255, 248, 235, 0.98);
  border-radius: 24px;
  padding: 24px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-header h3 {
  margin: 0;
  color: #2c5a2a;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #999;
  padding: 4px 8px;
}

.gift-list {
  max-height: 320px;
  overflow-y: auto;
}

.gift-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid #e8e8e8;
}

.gift-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gift-sender {
  font-size: 0.8rem;
  color: #888;
}

.gift-detail {
  font-weight: 600;
  color: #333;
}

.small-currency-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  margin-right: 4px;
  vertical-align: middle;
}

.accept-all-btn {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 12px;
  background: #4caf50;
  color: white;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: background 0.2s;
}

.accept-all-btn:hover {
  background: #388e3c;
}

.expired-banner {
  padding: 10px 14px;
  background: rgba(255, 152, 0, 0.08);
  border: 1px solid rgba(255, 152, 0, 0.2);
  border-radius: 10px;
  font-size: 0.85rem;
  color: #e65100;
  margin-bottom: 12px;
  text-align: center;
}

.daily-status {
  text-align: center;
  font-size: 0.8rem;
  color: #888;
  margin-top: 8px;
  margin-bottom: 4px;
}

/* 搜索区域 */
.search-section {
  position: relative;
  margin-bottom: 20px;
}

.search-box {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid #e0e0e0;
  border-radius: 40px;
  padding: 8px 16px;
  transition: border-color 0.2s;
}

.search-box:focus-within {
  border-color: #4caf50;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}

.search-icon {
  font-size: 1.1rem;
  margin-right: 8px;
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.95rem;
  color: #333;
}

.clear-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  font-size: 1rem;
  padding: 4px;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  margin-top: 8px;
  overflow: hidden;
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
}

.search-loading, .search-empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 0.9rem;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  transition: background 0.2s;
}

.search-item:hover {
  background: rgba(76, 175, 80, 0.06);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.user-id {
  font-size: 0.75rem;
  color: #999;
}

.add-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 20px;
  background: #4caf50;
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.add-btn:hover:not(:disabled) {
  background: #388e3c;
}

/* Section */
.section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 8px 0;
}

.section-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #2c5a2a;
}

.badge {
  background: #4caf50;
  color: white;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 4px;
}

.toggle-arrow {
  font-size: 0.8rem;
  color: #999;
}

/* 请求卡片 */
.request-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.request-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  border: 1px solid #e8e8e8;
}

.request-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.request-name {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.request-time {
  font-size: 0.75rem;
  color: #999;
}

.request-actions {
  display: flex;
  gap: 8px;
}

.accept-btn, .reject-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.accept-btn {
  background: #4caf50;
  color: white;
}

.accept-btn:hover {
  background: #388e3c;
  transform: scale(1.1);
}

.reject-btn {
  background: #ef5350;
  color: white;
}

.reject-btn:hover {
  background: #c62828;
  transform: scale(1.1);
}

.pending-label {
  font-size: 0.8rem;
  color: #ff9800;
  font-style: italic;
}

.rejected-label {
  font-size: 0.8rem;
  color: #f44336;
  font-weight: 600;
}

.rejected-card {
  border-color: #ffcdd2 !important;
}

.badge-rejected {
  background: #f44336;
  color: white;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 4px;
}

.resend-btn, .delete-rejected-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.04);
}

.resend-btn:hover {
  background: rgba(33, 150, 243, 0.15);
  transform: scale(1.1);
}

.delete-rejected-btn:hover {
  background: rgba(239, 83, 80, 0.15);
  transform: scale(1.1);
}

/* 好友列表 */
.friend-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.friend-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  border: 1px solid #e8e8e8;
  transition: all 0.2s;
}

.friend-card:hover {
  border-color: #a5d6a7;
  background: rgba(76, 175, 80, 0.04);
}

.user-avatar {
  font-size: 1.6rem;
}

.friend-info {
  flex: 1;
}

.friend-name {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.friend-actions {
  display: flex;
  gap: 6px;
}

.gift-btn, .delete-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.04);
}

.gift-btn:hover {
  background: rgba(255, 152, 0, 0.15);
  transform: scale(1.1);
}

.delete-btn:hover {
  background: rgba(239, 83, 80, 0.15);
  transform: scale(1.1);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 32px 0;
  color: #999;
}

.empty-state p {
  margin: 4px 0;
}

.empty-hint {
  font-size: 0.85rem;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #999;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .friend-page {
    background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
  }
  .page-header h2, .section-header h3 { color: #8bc34a; }
  .gift-box-btn { border-color: #ff9800; background: rgba(255,152,0,0.15); color: #ffb74d; }
  .modal-header h3 { color: #8bc34a; }
  .modal-content { background: rgba(30, 30, 25, 0.98); }
  .gift-card { background: rgba(40,40,40,0.8); border-color: #444; }
  .gift-detail { color: #e0e0e0; }
  .gift-sender { color: #aaa; }
  .accept-all-btn { background: #388e3c; }

  .search-box {
    background: rgba(40, 40, 40, 0.8);
    border-color: #555;
  }
  .search-box input { color: #e0e0e0; }

  .search-results {
    background: #2a2a2a;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }
  .user-name, .request-name, .friend-name { color: #e0e0e0; }
  .user-id { color: #888; }
  .search-loading, .search-empty { color: #888; }

  .request-card, .friend-card {
    background: rgba(40, 40, 40, 0.8);
    border-color: #444;
  }
  .friend-card:hover { border-color: #4caf50; background: rgba(76, 175, 80, 0.08); }

  .gift-btn, .delete-btn { background: rgba(255, 255, 255, 0.08); }

  .request-time { color: #888; }
  .pending-label { color: #ffb74d; }
  .rejected-label { color: #ef9a9a; }
  .rejected-card { border-color: #555 !important; }
  .badge-rejected { background: #c62828; }
  .resend-btn, .delete-rejected-btn { background: rgba(255, 255, 255, 0.08); }
  .badge { background: #388e3c; }
  .toggle-arrow { color: #888; }
  .accept-btn { background: #388e3c; }
  .reject-btn { background: #c62828; }
  .empty-state { color: #888; }
  .loading { color: #888; }
  .close-btn { color: #aaa; }
  .close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .add-btn { background: #388e3c; }
  .add-btn:disabled { background: #555; }
}
</style>

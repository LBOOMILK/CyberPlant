<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="ai-overlay" @click.self="close">
        <div class="ai-modal">
          <!-- 头部 -->
          <div class="ai-header">
            <div class="ai-header-left">
              <span class="ai-avatar">🤖</span>
              <div>
                <h3>AI 助手</h3>
                <span class="ai-subtitle">赛博花园百科</span>
              </div>
            </div>
            <div class="ai-header-actions">
              <button class="clear-btn" @click="clearChat" title="清空对话">🗑️</button>
              <button class="close-btn" @click="close">✕</button>
            </div>
          </div>

          <!-- 消息列表 -->
  <div class="ai-messages" ref="messagesRef">
    <div class="ai-welcome" v-if="messages.length === 0 && !loading">
      <div class="welcome-icon">🌱</div>
      <p>{{ greeting || '你好！我是赛博花园的 AI 助手' }}</p>
      <p class="welcome-hint">{{ greeting ? '可以问我关于种植、货币、商店等问题' : '可以问我关于种植、货币、商店等问题' }}</p>
      <div v-if="suggestedQuestions.length > 0" class="suggested-questions">
        <button
          v-for="(q, index) in suggestedQuestions"
          :key="index"
          class="suggested-btn"
          @click="sendSuggested(q)"
        >
          {{ q }}
        </button>
      </div>
    </div>

            <div
              v-for="(msg, index) in messages"
              :key="index"
              class="message-row"
              :class="{ 'user-row': msg.role === 'user', 'ai-row': msg.role === 'ai' }"
            >
              <div class="message-bubble" :class="{ 'user-bubble': msg.role === 'user', 'ai-bubble': msg.role === 'ai' }">
                <div class="message-text">{{ msg.text }}</div>
                <div class="message-time">{{ formatTime(msg.time) }}</div>
              </div>
            </div>

            <!-- AI 正在输入 -->
            <div v-if="loading" class="message-row ai-row">
              <div class="message-bubble ai-bubble">
                <div class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>

          <!-- 输入区域 -->
          <div class="ai-input-area">
            <input
              ref="inputRef"
              v-model="inputText"
              @keydown.enter="sendMessage"
              placeholder="输入问题..."
              :disabled="loading"
              maxlength="500"
              class="ai-input"
            />
            <button
              class="send-btn"
              @click="sendMessage"
              :disabled="loading || !inputText.trim()"
            >
              {{ loading ? '⏳' : '📤' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const conversationId = ref(null)
const messagesRef = ref(null)
const inputRef = ref(null)
const greeting = ref('你好！我是小草，赛博花园的 AI 向导～\n有什么游戏问题想问我吗？')
const suggestedQuestions = ref(['种子怎么获得？', '宠物怎么升级？', '怎么赚金币？'])

// 自动聚焦输入框
watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => inputRef.value?.focus())
  }
})

function close() {
  emit('close')
}

function clearChat() {
  messages.value = []
  conversationId.value = null
}

function sendSuggested(question) {
  inputText.value = question
  sendMessage()
}

function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  // 添加用户消息
  messages.value.push({ role: 'user', text, time: new Date() })
  inputText.value = ''
  loading.value = true
  await scrollToBottom()

  try {
    const token = localStorage.getItem('auth_token')
    const apiUrl = import.meta.env.VITE_API_URL || ''
    const response = await fetch(`${apiUrl}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        question: text,
        conversation_id: conversationId.value
      })
    })

    if (!response.ok) {
      throw new Error('请求失败')
    }

    const data = await response.json()
    messages.value.push({ role: 'ai', text: data.answer, time: new Date() })
    if (data.conversation_id) {
      conversationId.value = data.conversation_id
    }
    if (data.suggested_questions) {
      suggestedQuestions.value = data.suggested_questions
    }
  } catch (error) {
    messages.value.push({
      role: 'ai',
      text: '🤖 网络异常，请检查网络后重试。',
      time: new Date()
    })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}
</script>

<style scoped>
.ai-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.ai-modal {
  width: 100%;
  max-width: 480px;
  height: 85vh;
  max-height: 680px;
  background: #fff;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

/* 头部 */
.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  flex-shrink: 0;
}

.ai-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-avatar {
  font-size: 2rem;
}

.ai-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.ai-subtitle {
  font-size: 0.75rem;
  opacity: 0.85;
}

.ai-header-actions {
  display: flex;
  gap: 8px;
}

.clear-btn,
.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: background 0.2s;
}

.clear-btn:hover,
.close-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}

/* 消息区域 */
.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f8faf8;
}

/* 滚动条样式 */
.ai-messages::-webkit-scrollbar {
  width: 6px;
}
.ai-messages::-webkit-scrollbar-track {
  background: transparent;
}
.ai-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}
.ai-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

.ai-welcome {
  text-align: center;
  padding: 40px 20px;
  color: #888;
}

.welcome-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.ai-welcome p {
  margin: 4px 0;
  white-space: pre-line;
}

.welcome-hint {
  font-size: 0.85rem;
  color: #aaa;
}

.suggested-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 16px;
}

.suggested-btn {
  padding: 6px 14px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 20px;
  font-size: 0.8rem;
  color: #22c55e;
  cursor: pointer;
  transition: all 0.2s;
}

.suggested-btn:hover {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.5);
  transform: translateY(-1px);
}

/* 消息气泡 */
.message-row {
  display: flex;
}

.user-row {
  justify-content: flex-end;
}

.ai-row {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 16px;
  position: relative;
}

.user-bubble {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  border-bottom-right-radius: 4px;
}

.ai-bubble {
  background: white;
  color: #333;
  border: 1px solid #e8e8e8;
  border-bottom-left-radius: 4px;
}

.message-text {
  font-size: 0.9rem;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.message-time {
  font-size: 0.65rem;
  opacity: 0.6;
  margin-top: 4px;
  text-align: right;
}

/* 打字动画 */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #aaa;
  border-radius: 50%;
  animation: bounce 1.2s infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* 输入区域 */
.ai-input-area {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: white;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}

.ai-input {
  flex: 1;
  padding: 10px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 24px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.ai-input:focus {
  border-color: #22c55e;
}

.ai-input:disabled {
  background: #f5f5f5;
  color: #999;
}

.send-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 过渡动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-active .ai-modal,
.modal-fade-leave-active .ai-modal {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .ai-modal {
  transform: translateY(20px) scale(0.95);
  opacity: 0;
}

.modal-fade-leave-to .ai-modal {
  transform: translateY(20px) scale(0.95);
  opacity: 0;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .ai-modal {
    background: #1e1e1e;
  }

  .ai-messages {
    background: #141414;
  }

  .ai-bubble {
    background: #2a2a2a;
    border-color: #3a3a3a;
    color: #e0e0e0;
  }

  .ai-input-area {
    background: #1e1e1e;
    border-top-color: #333;
  }

  .ai-input {
    background: #2a2a2a;
    border-color: #444;
    color: #e0e0e0;
  }

  .ai-input:focus {
    border-color: #4caf50;
  }

  .ai-input:disabled {
    background: #222;
  }

  .ai-welcome { color: #777; }
  .welcome-hint { color: #555; }

  .suggested-btn {
    background: rgba(76, 175, 80, 0.1);
    border-color: rgba(76, 175, 80, 0.3);
    color: #8bc34a;
  }

  .suggested-btn:hover {
    background: rgba(76, 175, 80, 0.15);
    border-color: rgba(76, 175, 80, 0.5);
  }
}

/* 移动端适配 */
@media (max-width: 480px) {
  .ai-overlay {
    padding: 0;
  }

  .ai-modal {
    max-width: 100%;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
}
</style>

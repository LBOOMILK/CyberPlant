<template>
  <div class="currency-bar">
    <!-- 货币显示 -->
    <div
      v-for="curr in currencyList"
      :key="curr.key"
      class="currency-item"
      :class="{ 'animate-bounce': curr.animating }"
      @click="openExchange"
    >
      <img :src="curr.icon" :alt="curr.name" class="currency-icon" />
      <span class="currency-value">{{ formatNumber(curr.value) }}</span>
      <!-- 浮动提示 -->
      <transition name="float-up">
        <span
          v-if="curr.floatText"
          :class="['float-text', curr.floatType]"
        >{{ curr.floatText }}</span>
      </transition>
    </div>

    <!-- 兑换面板 -->
    <teleport to="body">
      <transition name="fade">
        <div v-if="showExchange" class="exchange-overlay" @click.self="showExchange = false">
          <div class="exchange-panel">
            <div class="exchange-header">
              <h3>💱 货币兑换</h3>
              <button class="close-btn" @click="showExchange = false">✕</button>
            </div>
            <div class="exchange-body">
              <div class="exchange-row">
                <label>兑换方向</label>
                <select v-model="exchangeFrom" class="exchange-select">
                  <option v-for="opt in exchangeOptions" :key="opt.key" :value="opt.key">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div class="exchange-arrow">⬇️</div>
              <div class="exchange-row">
                <label>兑换数量</label>
                <input
                  v-model.number="exchangeAmount"
                  type="number"
                  min="1"
                  class="exchange-input"
                  placeholder="输入数量"
                />
              </div>
              <div class="exchange-preview" v-if="exchangePreview">
                <span>预计获得：</span>
                <span class="preview-value">{{ exchangePreview }}</span>
              </div>
              <div class="exchange-desc" v-if="exchangeDesc">{{ exchangeDesc }}</div>
              <button
                class="exchange-confirm"
                :disabled="!canExchange"
                @click="doExchange"
              >确认兑换</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()

// 货币列表
const currencyList = reactive([
  { key: 'silver_coin', name: '银币', icon: '/silver_icon.png', value: 0, animating: false, floatText: '', floatType: '' },
  { key: 'gold_coin', name: '金币', icon: '/gold_icon.png', value: 0, animating: false, floatText: '', floatType: '' },
  { key: 'diamond', name: '钻石', icon: '/diamond.png', value: 0, animating: false, floatText: '', floatType: '' }
])

// 监听货币变化，触发动画
watch(
  () => userStore.currencies,
  (newVal) => {
    currencyList.forEach(curr => {
      const oldVal = curr.value
      const newValTyped = Number(newVal[curr.key]) || 0
      if (oldVal !== newValTyped && oldVal !== 0) {
        const diff = newValTyped - oldVal
        curr.animating = true
        curr.floatText = diff > 0 ? `+${diff}` : `${diff}`
        curr.floatType = diff > 0 ? 'gain' : 'loss'
        setTimeout(() => { curr.animating = false }, 500)
        setTimeout(() => { curr.floatText = '' }, 1500)
      }
      curr.value = newValTyped
    })
  },
  { deep: true, immediate: true }
)

// 数值格式化
function formatNumber(n) {
  if (n === null || n === undefined) return '0'
  n = Number(n)
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'm'
  if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toLocaleString()
}

// 兑换面板
const showExchange = ref(false)
const exchangeFrom = ref('silver_coin->gold_coin')
const exchangeAmount = ref(1)

const exchangeOptions = [
  { key: 'silver_coin->gold_coin', label: '银币 → 金币 (100:1)' },
  { key: 'gold_coin->diamond', label: '金币 → 钻石 (100:1)' },
  { key: 'gold_coin->silver_coin', label: '金币 → 银币 (1:95)' },
  { key: 'diamond->gold_coin', label: '钻石 → 金币 (1:90)' }
]

const exchangeRules = {
  'silver_coin->gold_coin': { rate: 100, toKey: 'gold_coin' },
  'gold_coin->diamond': { rate: 100, toKey: 'diamond' },
  'gold_coin->silver_coin': { rate: 95, toKey: 'silver_coin' },
  'diamond->gold_coin': { rate: 90, toKey: 'gold_coin' }
}

const exchangePreview = computed(() => {
  const rule = exchangeRules[exchangeFrom.value]
  if (!rule || !exchangeAmount.value || exchangeAmount.value <= 0) return ''
  const result = Math.floor(exchangeAmount.value * rule.rate / (exchangeFrom.value.includes('->silver_coin') || exchangeFrom.value.includes('->gold_coin') && exchangeFrom.value.startsWith('diamond') ? 1 : 1))
  // 正向：from / rate = to；反向：from * rate = to
  const isDowngrade = exchangeFrom.value === 'gold_coin->silver_coin' || exchangeFrom.value === 'diamond->gold_coin'
  const amount = isDowngrade
    ? exchangeAmount.value * rule.rate
    : Math.floor(exchangeAmount.value / rule.rate)
  const toName = { gold_coin: '金币', diamond: '钻石', silver_coin: '银币' }[rule.toKey]
  return `${amount} ${toName}`
})

const exchangeDesc = computed(() => {
  const opt = exchangeOptions.find(o => o.key === exchangeFrom.value)
  return opt ? opt.label : ''
})

const canExchange = computed(() => {
  return exchangeAmount.value > 0
})

function openExchange() {
  showExchange.value = true
}

async function doExchange() {
  const [from, to] = exchangeFrom.value.split('->')
  const result = await userStore.exchangeCurrency(from, to, exchangeAmount.value)
  if (result.success) {
    exchangeAmount.value = 1
    showExchange.value = false
  }
}
</script>

<style scoped>
.currency-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.currency-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  user-select: none;
}

.currency-item:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.currency-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.currency-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  min-width: 28px;
  text-align: center;
}

/* 数字跳动动画 */
.animate-bounce {
  animation: bounceNum 0.4s ease;
}

@keyframes bounceNum {
  0% { transform: scale(1); }
  30% { transform: scale(1.2); }
  60% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* 浮动文字 */
.float-text {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
}

.float-text.gain {
  color: #4caf50;
}

.float-text.loss {
  color: #f44336;
}

.float-up-enter-active {
  animation: floatUp 1.5s ease forwards;
}

.float-up-leave-active {
  display: none;
}

@keyframes floatUp {
  0% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-24px); }
}

/* 兑换面板 */
.exchange-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10002;
}

.exchange-panel {
  background: rgba(255, 248, 235, 0.98);
  border-radius: 24px;
  padding: 24px;
  width: 90%;
  max-width: 380px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.exchange-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.exchange-header h3 {
  margin: 0;
  color: #2c5a2a;
  font-size: 1.2rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #999;
  padding: 4px 8px;
  border-radius: 8px;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.exchange-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exchange-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.exchange-row label {
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
}

.exchange-select,
.exchange-input {
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 0.95rem;
  background: white;
  color: #333;
  outline: none;
  transition: border-color 0.2s;
}

.exchange-select:focus,
.exchange-input:focus {
  border-color: #4caf50;
}

.exchange-arrow {
  text-align: center;
  font-size: 1.2rem;
}

.exchange-preview {
  text-align: center;
  padding: 12px;
  background: rgba(76, 175, 80, 0.08);
  border-radius: 12px;
  font-size: 0.95rem;
  color: #555;
}

.preview-value {
  color: #2e7d32;
  font-weight: 700;
  font-size: 1.1rem;
}

.exchange-desc {
  text-align: center;
  font-size: 0.8rem;
  color: #999;
}

.exchange-confirm {
  padding: 12px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.exchange-confirm:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.exchange-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .currency-item {
    background: rgba(255, 255, 255, 0.08);
  }

  .currency-item:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .exchange-panel {
    background: rgba(30, 30, 25, 0.98);
  }

  .exchange-header h3 {
    color: #8bc34a;
  }

  .close-btn {
    color: #aaa;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .exchange-row label {
    color: #aaa;
  }

  .exchange-select,
  .exchange-input {
    background: #2a2a2a;
    border-color: #555;
    color: #e0e0e0;
  }

  .exchange-select:focus,
  .exchange-input:focus {
    border-color: #4caf50;
  }

  .exchange-preview {
    background: rgba(76, 175, 80, 0.12);
    color: #ccc;
  }

  .preview-value {
    color: #81c784;
  }
}
</style>

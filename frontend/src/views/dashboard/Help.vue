<template>
  <div class="help-page">
    <div class="page-header">
      <h2>❓ 帮助中心</h2>
    </div>

    <!-- 标签栏 -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- 内容区 -->
    <div class="tab-content">
      <transition name="fade" mode="out-in">
        <div :key="activeTab" class="tab-pane">

          <!-- 快速开始 -->
          <div v-if="activeTab === 'start'" class="help-card">
            <h3>🚀 快速开始</h3>
            <p class="card-sub">从零开始的赛博农场生活</p>
            <ol class="step-list">
              <li>注册账号并登录</li>
              <li>自动领取 <strong>新手礼包</strong>（银币 + 基础种子）</li>
              <li>进入 <strong>花园</strong>，选择空地块</li>
              <li>去 <strong>商店</strong> 购买种子，种到地块里</li>
              <li>按时 <strong>浇水</strong>，等作物成熟</li>
              <li>成熟后 <strong>收获</strong>，在背包中卖出换钱</li>
            </ol>
          </div>

          <!-- 浇水 -->
          <div v-if="activeTab === 'water'" class="help-card">
            <h3>💧 浇水规则</h3>
            <p class="card-sub">冷却、阶段、干涸机制</p>
            <ol class="step-list">
              <li>每个阶段需要浇水才能进入下一阶段</li>
              <li>浇水后有冷却时间（默认 <strong>5 秒</strong>，部分种子更长）</li>
              <li>作物共 <strong>5 个阶段</strong>：种子 → 发芽 → 出叶 → 初熟 → 成熟</li>
            </ol>
            <div class="tip warn">
              ⚠️ 超过 180 秒未浇水，作物将<strong>干涸死亡</strong>！请留意浇水倒计时。
            </div>
          </div>

          <!-- 收获 -->
          <div v-if="activeTab === 'harvest'" class="help-card">
            <h3>💰 收获与赚钱</h3>
            <p class="card-sub">卖出作物获取货币</p>
            <ol class="step-list">
              <li>作物成熟后，点击地块选择 <strong>收获</strong></li>
              <li>收获的作物存入 <strong>背包</strong></li>
              <li>在背包中选择作物，点击 <strong>卖出</strong> 获得银币</li>
              <li>高级作物卖出价格更高，收益更大</li>
            </ol>
            <div class="tip info">
              💡 地块等级越高（Lv1→Lv5），收获产量倍率越大。优先升级常用地块！
            </div>
          </div>

          <!-- 宠物 -->
          <div v-if="activeTab === 'pet'" class="help-card">
            <h3>🐾 宠物系统</h3>
            <p class="card-sub">出战、喂食、加成</p>
            <ol class="step-list">
              <li>在 <strong>商店</strong> 购买宠物（消耗钻石）</li>
              <li>进入 <strong>宠物</strong> 页面，点击 <strong>激活出战</strong></li>
              <li>出战宠物为每次收获提供 <strong>加成奖励</strong></li>
              <li>用 <strong>宠物粮</strong> 喂食，维持饱食度</li>
              <li>饱食度会随时间衰减，为 0 时加成<strong>暂停</strong></li>
            </ol>
            <div class="tip info">
              💡 喂食溢出的饱食度会转化为宠物成长值，有助于升级！
            </div>
          </div>

          <!-- 好友 -->
          <div v-if="activeTab === 'friend'" class="help-card">
            <h3>👥 好友系统</h3>
            <p class="card-sub">添加好友、互赠钻石</p>
            <ol class="step-list">
              <li>在 <strong>好友</strong> 页面搜索用户名，发送好友请求</li>
              <li>对方接受后成为好友</li>
              <li>好友之间可以 <strong>互赠钻石</strong></li>
              <li>每人每日最多赠送 <strong>5 颗</strong>、接收 <strong>5 颗</strong></li>
              <li>未领取的礼物 <strong>4 小时</strong> 后自动退回发送方</li>
            </ol>
            <div class="tip info">
              💡 新注册账号和新添加的好友都有冷却时间，之后才能互赠礼物。
            </div>
          </div>

          <!-- 货币 -->
          <div v-if="activeTab === 'currency'" class="help-card">
            <h3>💎 货币体系</h3>
            <p class="card-sub">三级经济循环</p>
            <div class="currency-grid">
              <div class="currency-item">
                <img src="/silver_icon.png" class="cur-icon" />
                <div class="cur-name">银币</div>
                <div class="cur-desc">基础货币，买卖种子和作物</div>
              </div>
              <div class="currency-item">
                <img src="/gold_icon.png" class="cur-icon" />
                <div class="cur-name">金币</div>
                <div class="cur-desc">中级货币，高级种子和肥料</div>
              </div>
              <div class="currency-item">
                <img src="/diamond.png" class="cur-icon" />
                <div class="cur-name">钻石</div>
                <div class="cur-desc">高级货币，宠物、饰品、好友赠送</div>
              </div>
            </div>
            <div class="tip info">
              💡 兑换比例：1000 银币 → 1 金币，1 金币 → 600 银币（可在个人中心操作兑换）
            </div>
          </div>

        </div>
      </transition>

      <!-- 进度指示 -->
      <div class="progress-dots">
        <span
          v-for="tab in tabs"
          :key="tab.key"
          :class="['dot', { active: activeTab === tab.key }]"
        />
      </div>
    </div>

    <!-- AI 助手入口 -->
    <div class="ai-bar" @click="showAI = true">
      <span class="ai-icon">🤖</span>
      <div class="ai-text">
        <div class="ai-title">还有问题？问 AI 助手</div>
        <div class="ai-hint">任何游戏问题都可以问我</div>
      </div>
    </div>

    <AIChatModal :visible="showAI" @close="showAI = false" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AIChatModal from '@/components/user/AIChatModal.vue'

const showAI = ref(false)
const activeTab = ref('start')

const tabs = [
  { key: 'start', icon: '🚀', label: '快速开始' },
  { key: 'water', icon: '💧', label: '浇水' },
  { key: 'harvest', icon: '💰', label: '收获' },
  { key: 'pet', icon: '🐾', label: '宠物' },
  { key: 'friend', icon: '👥', label: '好友' },
  { key: 'currency', icon: '💎', label: '货币' }
]
</script>

<style scoped>
.help-page {
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
  margin-bottom: 16px;
}

.page-header h2 {
  color: #2c5a2a;
  margin: 0;
  font-size: 1.4rem;
}

/* 标签栏 */
.tab-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 16px;
}

.tab-bar::-webkit-scrollbar { display: none; }

.tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 14px;
  border-radius: 20px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.4);
  color: #555;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.tab-btn:hover {
  border-color: #4caf50;
  color: #2e7d32;
}

.tab-btn.active {
  background: #4caf50;
  border-color: #4caf50;
  color: white;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.tab-icon { font-size: 1rem; }

/* 内容区 */
.tab-content {
  margin-bottom: 16px;
}

.help-card {
  background: rgba(255, 248, 235, 0.95);
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 8px 25px rgba(0, 20, 0, 0.12);
}

.help-card h3 {
  color: #2c5a2a;
  margin: 0 0 4px 0;
  font-size: 1.15rem;
}

.card-sub {
  color: #888;
  font-size: 0.85rem;
  margin: 0 0 16px 0;
}

.step-list {
  margin: 0;
  padding-left: 20px;
}

.step-list li {
  padding: 6px 0;
  font-size: 0.9rem;
  color: #444;
  line-height: 1.6;
}

.step-list li strong {
  color: #2e7d32;
}

.tip {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 0.85rem;
  line-height: 1.6;
}

.tip.info {
  background: rgba(33, 150, 243, 0.08);
  border: 1px solid rgba(33, 150, 243, 0.15);
  color: #1565c0;
}

.tip.warn {
  background: rgba(255, 152, 0, 0.08);
  border: 1px solid rgba(255, 152, 0, 0.15);
  color: #e65100;
}

/* 货币网格 */
.currency-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.currency-item {
  text-align: center;
  padding: 14px 8px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.cur-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  margin-bottom: 6px;
}

.cur-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: #333;
  margin-bottom: 2px;
}

.cur-desc {
  font-size: 0.75rem;
  color: #888;
  line-height: 1.4;
}

/* 进度指示 */
.progress-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 14px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.12);
  transition: all 0.2s;
}

.dot.active {
  background: #4caf50;
  width: 18px;
  border-radius: 3px;
}

/* AI 入口 */
.ai-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 248, 235, 0.95);
  border: 2px solid transparent;
  border-radius: 16px;
  box-shadow: 0 4px 15px rgba(0, 20, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s;
}

.ai-bar:hover {
  transform: translateY(-2px);
  border-color: #4caf50;
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.2);
}

.ai-icon { font-size: 1.5rem; }

.ai-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: #333;
}

.ai-hint {
  font-size: 0.8rem;
  color: #888;
  margin-top: 2px;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .help-page {
    background: linear-gradient(145deg, #1a2e1a 0%, #0d1f0d 100%);
  }

  .page-header h2 { color: #8bc34a; }

  .tab-btn {
    background: rgba(40, 40, 35, 0.6);
    border-color: rgba(255, 255, 255, 0.1);
    color: #aaa;
  }

  .tab-btn.active {
    background: #4caf50;
    border-color: #4caf50;
    color: white;
  }

  .help-card {
    background: rgba(30, 30, 25, 0.95);
  }

  .help-card h3 { color: #8bc34a; }
  .step-list li { color: #ccc; }
  .step-list li strong { color: #81c784; }

  .currency-item {
    background: rgba(40, 40, 35, 0.5);
    border-color: rgba(255, 255, 255, 0.06);
  }

  .cur-name { color: #e0e0e0; }

  .ai-bar {
    background: rgba(30, 30, 25, 0.95);
  }

  .ai-title { color: #e0e0e0; }
}
</style>

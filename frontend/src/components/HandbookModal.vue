<template>
  <transition name="modal-fade">
    <div v-if="visible" class="handbook-overlay" @click.self="$emit('close')">
      <div class="handbook-panel">
        <div class="handbook-header">
          <h3>📖 赛博花园手册</h3>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>
        <div class="handbook-body">
          <!-- 左侧目录 -->
          <nav class="handbook-toc">
            <button
              v-for="(section, idx) in sections"
              :key="section.id"
              :class="['toc-item', { active: activeSection === idx }]"
              @click="activeSection = idx"
            >
              <span class="toc-icon">{{ section.icon }}</span>
              <span class="toc-label">{{ section.title }}</span>
            </button>
          </nav>
          <!-- 右侧内容 -->
          <div class="handbook-content">
            <div class="content-header">
              <span class="content-icon">{{ currentSection.icon }}</span>
              <h4>{{ currentSection.title }}</h4>
            </div>
            <div class="content-body" v-html="currentSection.content"></div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed } from 'vue'

defineProps({
  visible: { type: Boolean, default: false }
})

defineEmits(['close'])

const activeSection = ref(0)

const sections = [
  {
    id: 'currency',
    icon: '💰',
    title: '货币系统',
    content: `
      <p>赛博花园有<strong>三种货币</strong>，价值依次递增：</p>
      <div class="info-card">
        <p><strong>🪙 银币</strong> — 最基础的货币</p>
        <ul>
          <li>获取：收获作物、日常任务</li>
          <li>用途：购买种子、解锁地块、喂养宠物</li>
          <li>兑换：100 银币 → 1 金币</li>
        </ul>
      </div>
      <div class="info-card">
        <p><strong>🥇 金币</strong> — 中级货币</p>
        <ul>
          <li>获取：高级作物收获、银币兑换</li>
          <li>用途：购买高级种子、升级地块</li>
          <li>兑换：100 金币 → 1 钻石 / 1 金币 → 95 银币（5% 损耗）</li>
        </ul>
      </div>
      <div class="info-card">
        <p><strong>💎 钻石</strong> — 高级货币</p>
        <ul>
          <li>获取：稀有作物收获、金币兑换</li>
          <li>用途：购买稀有种子、宠物装饰</li>
          <li>兑换：1 钻石 → 90 金币（10% 损耗）</li>
        </ul>
      </div>
      <p class="tip">💡 点击顶部货币栏可打开兑换面板</p>
    `
  },
  {
    id: 'plot',
    icon: '🏗️',
    title: '地块系统',
    content: `
      <p>花园中有多个地块可以种植作物：</p>
      <div class="info-card">
        <p><strong>🔓 解锁地块</strong></p>
        <ul>
          <li>初始有 4 块已解锁</li>
          <li>后续地块需要花费货币解锁</li>
          <li>越后面的地块解锁费用越高</li>
        </ul>
      </div>
      <div class="info-card">
        <p><strong>⬆️ 升级地块</strong></p>
        <ul>
          <li>地块等级 Lv.1 ~ Lv.5</li>
          <li>升级提高产出倍率（1x → 2x → 3x → 4x → 5x）</li>
          <li>Lv.4+ 地块有呼吸光效</li>
          <li>升级需要花费货币</li>
        </ul>
      </div>
      <p class="tip">💡 地块等级越高，收获的作物数量越多</p>
    `
  },
  {
    id: 'plant',
    icon: '🌱',
    title: '种植指南',
    content: `
      <p>种植是花园的核心玩法：</p>
      <div class="info-card">
        <p><strong>📋 种植流程</strong></p>
        <ol>
          <li>在商店购买种子</li>
          <li>点击空地块选择种子种植</li>
          <li>等待作物生长（种子 → 发芽 → 出叶 → 初熟 → 成熟）</li>
          <li>成熟后点击地块收获</li>
        </ol>
      </div>
      <div class="info-card">
        <p><strong>💧 浇水 & 施肥</strong></p>
        <ul>
          <li>浇水加速作物生长</li>
          <li>施肥大幅加速生长（需要肥料道具）</li>
          <li>肥料在商店购买</li>
        </ul>
      </div>
      <div class="info-card">
        <p><strong>🗑️ 铲除</strong></p>
        <ul>
          <li>可以铲除不想种的作物</li>
          <li>铲除后地块变为空地</li>
          <li>⚠️ 铲除后无法恢复</li>
        </ul>
      </div>
    `
  },
  {
    id: 'pet',
    icon: '🐾',
    title: '宠物系统',
    content: `
      <p>宠物能为你的花园提供加成：</p>
      <div class="info-card">
        <p><strong>🛒 购买宠物</strong></p>
        <ul>
          <li>在商店的宠物标签页购买</li>
          <li>不同宠物有不同的加成效果</li>
          <li>加成范围：+5% ~ +30%</li>
        </ul>
      </div>
      <div class="info-card">
        <p><strong>🍖 喂养宠物</strong></p>
        <ul>
          <li>宠物有饱食度属性</li>
          <li>饱食度归零时加成暂停</li>
          <li>需要定期喂养维持饱食度</li>
        </ul>
      </div>
      <div class="info-card">
        <p><strong>✨ 激活宠物</strong></p>
        <ul>
          <li>同时只能激活一只宠物</li>
          <li>激活后宠物悬浮在页面上</li>
          <li>加成自动生效</li>
        </ul>
      </div>
    `
  },
  {
    id: 'friend',
    icon: '👥',
    title: '好友系统',
    content: `
      <p>和朋友一起玩更有趣：</p>
      <div class="info-card">
        <p><strong>➕ 添加好友</strong></p>
        <ul>
          <li>在好友页面搜索用户名</li>
          <li>发送好友请求</li>
          <li>对方同意后成为好友</li>
        </ul>
      </div>
      <div class="info-card">
        <p><strong>🎁 送礼</strong></p>
        <ul>
          <li>可以给好友赠送背包中的物品</li>
          <li>选择物品和数量即可送出</li>
        </ul>
      </div>
      <div class="info-card">
        <p><strong>💱 货币转让</strong></p>
        <ul>
          <li>可以向好友转让货币</li>
          <li>支持银币、金币、钻石</li>
        </ul>
      </div>
    `
  },
  {
    id: 'ai',
    icon: '🤖',
    title: 'AI 问答',
    content: `
      <p>有种植问题？AI 助手来帮你：</p>
      <div class="info-card">
        <p><strong>💬 使用方式</strong></p>
        <ul>
          <li>花园页面右上角的 🤖 按钮</li>
          <li>输入你的问题</li>
          <li>AI 会根据游戏数据给出建议</li>
        </ul>
      </div>
      <div class="info-card">
        <p><strong>📋 可以问什么</strong></p>
        <ul>
          <li>哪种作物收益最高？</li>
          <li>如何高效管理地块？</li>
          <li>宠物应该怎么选？</li>
          <li>货币兑换策略建议</li>
        </ul>
      </div>
      <p class="tip">💡 AI 基于你的花园数据给出个性化建议</p>
    `
  }
]

const currentSection = computed(() => sections[activeSection.value])
</script>

<style scoped>
.handbook-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10001;
}

.handbook-panel {
  background: rgba(255, 248, 235, 0.98);
  border-radius: 24px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
  animation: slideUp 0.3s ease;
  overflow: hidden;
}

.handbook-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.handbook-header h3 {
  margin: 0;
  color: #2c5a2a;
  font-size: 1.15rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #999;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.handbook-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧目录 */
.handbook-toc {
  width: 140px;
  flex-shrink: 0;
  padding: 12px 8px;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.toc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  border-radius: 12px;
  background: none;
  cursor: pointer;
  font-size: 0.85rem;
  color: #666;
  text-align: left;
  transition: all 0.2s;
}

.toc-item:hover {
  background: rgba(76, 175, 80, 0.08);
  color: #333;
}

.toc-item.active {
  background: rgba(76, 175, 80, 0.15);
  color: #2e7d32;
  font-weight: 600;
}

.toc-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.toc-label {
  white-space: nowrap;
}

/* 右侧内容 */
.handbook-content {
  flex: 1;
  padding: 16px 24px;
  overflow-y: auto;
}

.content-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.content-icon {
  font-size: 1.5rem;
}

.content-header h4 {
  margin: 0;
  color: #2c5a2a;
  font-size: 1.1rem;
}

.content-body {
  font-size: 0.9rem;
  color: #444;
  line-height: 1.7;
}

.content-body :deep(p) {
  margin: 0 0 10px;
}

.content-body :deep(.info-card) {
  background: rgba(76, 175, 80, 0.06);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 10px;
}

.content-body :deep(.info-card p) {
  margin: 0 0 6px;
}

.content-body :deep(.info-card ul),
.content-body :deep(.info-card ol) {
  margin: 0;
  padding-left: 20px;
}

.content-body :deep(.info-card li) {
  padding: 2px 0;
  font-size: 0.85rem;
}

.content-body :deep(.tip) {
  background: rgba(255, 193, 7, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.85rem;
  color: #8d6e63;
  margin-top: 10px;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-fade-enter-active { transition: opacity 0.25s ease; }
.modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

/* 移动端：纵向布局 */
@media (max-width: 600px) {
  .handbook-panel {
    max-height: 90vh;
  }

  .handbook-body {
    flex-direction: column;
  }

  .handbook-toc {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    border-right: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    padding: 8px;
    gap: 4px;
  }

  .toc-item {
    padding: 6px 10px;
    font-size: 0.8rem;
  }

  .toc-label {
    display: none;
  }

  .toc-icon {
    font-size: 1.2rem;
  }

  .handbook-content {
    padding: 12px 16px;
  }
}

@media (prefers-color-scheme: dark) {
  .handbook-panel { background: rgba(30, 30, 25, 0.98); }
  .handbook-header { border-bottom-color: rgba(255, 255, 255, 0.06); }
  .handbook-header h3 { color: #8bc34a; }
  .handbook-toc { border-right-color: rgba(255, 255, 255, 0.06); }
  .toc-item { color: #aaa; }
  .toc-item:hover { background: rgba(76, 175, 80, 0.12); color: #ddd; }
  .toc-item.active { background: rgba(76, 175, 80, 0.2); color: #81c784; }
  .content-header h4 { color: #8bc34a; }
  .content-body { color: #ccc; }
  .content-body :deep(.info-card) { background: rgba(76, 175, 80, 0.1); }
  .content-body :deep(.tip) { background: rgba(255, 193, 7, 0.12); color: #ffb74d; }
}
</style>

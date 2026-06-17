<template>
  <div :class="['config-panel', isClassic ? 'theme-classic' : 'theme-hub']">
    <h1 class="panel-title">全局配置</h1>
    <div v-if="loading" class="panel-loading">加载中...</div>
    <div v-else>
      <div v-for="(group, cat) in configGroups" :key="cat" class="config-group">
        <h3 class="group-title">{{ cat }}</h3>
        <div class="config-list">
          <div v-for="item in group" :key="item.key" class="config-item">
            <div class="config-info">
              <span class="config-desc">{{ item.description }}</span>
              <span class="config-key">{{ item.key }}</span>
            </div>
            <div class="config-value-area">
              <span v-if="editingKey !== item.key" class="config-value">
                {{ isCurrencyType(item.key) ? CURRENCY_LABELS[item.value] || item.value : item.value }}
              </span>
              <input
                v-else-if="!isCurrencyType(item.key)"
                v-model.number="editValue"
                type="number"
                class="config-input"
                @keyup.enter="saveConfig(item.key)"
                @keyup.escape="cancelEdit"
              />
              <select
                v-else
                v-model="editValue"
                class="config-select"
              >
                <option v-for="opt in CURRENCY_OPTIONS" :key="opt" :value="opt">
                  {{ CURRENCY_LABELS[opt] }}
                </option>
              </select>
              <button
                v-if="editingKey !== item.key"
                class="edit-btn"
                @click="startEdit(item)"
              >编辑</button>
              <template v-else>
                <button class="save-btn" @click="saveConfig(item.key)">保存</button>
                <button class="cancel-btn" @click="cancelEdit">取消</button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Toast ref="toastRef" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '@/components/common/Toast.vue'

const route = useRoute()
const isClassic = computed(() => route.path.startsWith('/admin/classic'))

const loading = ref(true)
const configItems = ref([])
const editingKey = ref(null)
const editValue = ref(0)
const toastRef = ref(null)

const configDescriptions = {
  exchange_silver_to_gold: '银币兑换金币汇率',
  exchange_gold_to_silver: '金币兑换银币汇率',
  gift_daily_limit_silver: '每日银币赠送上限',
  friend_gift_cooldown_hours: '好友赠送冷却时间(小时)',
  account_gift_cooldown_hours: '账号赠送冷却时间(小时)',
  
  plot_unlock_2: '解锁地块2费用',
  plot_unlock_2_type: '解锁地块2货币类型',
  plot_unlock_3: '解锁地块3费用',
  plot_unlock_3_type: '解锁地块3货币类型',
  plot_unlock_4: '解锁地块4费用',
  plot_unlock_4_type: '解锁地块4货币类型',
  plot_unlock_5: '解锁地块5费用',
  plot_unlock_5_type: '解锁地块5货币类型',
  plot_unlock_6: '解锁地块6费用',
  plot_unlock_6_type: '解锁地块6货币类型',
  
  plot_upgrade_1_2: '地块1→2升级费用',
  plot_upgrade_1_2_type: '地块1→2升级货币类型',
  plot_upgrade_2_3: '地块2→3升级费用',
  plot_upgrade_2_3_type: '地块2→3升级货币类型',
  plot_upgrade_3_4: '地块3→4升级费用',
  plot_upgrade_3_4_type: '地块3→4升级货币类型',
  plot_upgrade_4_5: '地块4→5升级费用',
  plot_upgrade_4_5_type: '地块4→5升级货币类型',
  
  hunger_max: '宠物最大饱食度',
  hunger_decay_interval: '饱食度衰减间隔(秒)',
  pet_deco_bonus_cap: '宠物装饰加成上限(%)',
  sss_drop_base: 'SSS掉落基础概率',
  sss_drop_cap: 'SSS掉落概率上限',
  yield_accumulator_threshold: '累加值阈值',
  max_seed_count: '背包种子上限',
  max_crop_count: '背包作物上限',
  max_fertilizer_count: '背包肥料上限',
  max_pet_food_count: '背包宠物粮上限',
}

const CURRENCY_OPTIONS = ['silver_coin', 'gold_coin', 'diamond']
const CURRENCY_LABELS = { silver_coin: '银币', gold_coin: '金币', diamond: '钻石' }

const configCategories = {
  '💰 经济类': ['exchange_silver_to_gold', 'exchange_gold_to_silver', 'gift_daily_limit_silver', 'friend_gift_cooldown_hours', 'account_gift_cooldown_hours'],
  '🌱 地块解锁费用': ['plot_unlock_2', 'plot_unlock_2_type', 'plot_unlock_3', 'plot_unlock_3_type', 'plot_unlock_4', 'plot_unlock_4_type', 'plot_unlock_5', 'plot_unlock_5_type', 'plot_unlock_6', 'plot_unlock_6_type'],
  '⬆️ 地块升级费用': ['plot_upgrade_1_2', 'plot_upgrade_1_2_type', 'plot_upgrade_2_3', 'plot_upgrade_2_3_type', 'plot_upgrade_3_4', 'plot_upgrade_3_4_type', 'plot_upgrade_4_5', 'plot_upgrade_4_5_type'],
  '🐾 宠物类': ['hunger_max', 'hunger_decay_interval', 'pet_deco_bonus_cap'],
  '🎲 掉落类': ['sss_drop_base', 'sss_drop_cap'],
  '📈 累加值类': ['yield_accumulator_threshold'],
  '🎒 背包类': ['max_seed_count', 'max_crop_count', 'max_fertilizer_count', 'max_pet_food_count'],
}

const configGroups = computed(() => {
  const groups = {}
  for (const [cat, keys] of Object.entries(configCategories)) {
    const items = keys
      .map(k => configItems.value.find(c => c.key === k))
      .filter(Boolean)
      .map(c => ({ ...c, description: configDescriptions[c.key] || c.key }))
    if (items.length > 0) groups[cat] = items
  }
  return groups
})

async function loadConfig() {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/config`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      configItems.value = await r.json()
    }
  } catch (e) {
    console.error('Failed to load config:', e)
  } finally {
    loading.value = false
  }
}

function isCurrencyType(key) {
  return key.endsWith('_type') && (key.startsWith('plot_unlock') || key.startsWith('plot_upgrade'))
}

function startEdit(item) {
  editingKey.value = item.key
  if (isCurrencyType(item.key)) {
    editValue.value = item.value
  } else {
    editValue.value = Number(item.value)
  }
}

function cancelEdit() {
  editingKey.value = null
  editValue.value = 0
}

async function saveConfig(key) {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ key, value: editValue.value })
    })
    if (r.ok) {
      const idx = configItems.value.findIndex(c => c.key === key)
      if (idx !== -1) configItems.value[idx].value = editValue.value
      toastRef.value?.addToast(`${configDescriptions[key] || key} 已更新`, 'success')
    } else {
      const err = await r.json()
      toastRef.value?.addToast(err.error || '保存失败', 'error')
    }
  } catch (e) {
    toastRef.value?.addToast('网络错误', 'error')
  }
  cancelEdit()
}

onMounted(loadConfig)
</script>

<style scoped>
/* ===== Hub 主题（绿色/赛博） ===== */
.theme-hub .panel-title { display: none; }
.theme-hub .panel-loading { text-align: center; padding: 40px; color: var(--text-muted, #8b949e); }
.theme-hub .config-group { margin-bottom: 20px; }
.theme-hub .group-title {
  font-size: 13px; color: #00ff88; margin: 0 0 10px 0;
  padding-bottom: 6px; border-bottom: 1px solid rgba(0,255,136,0.15);
}
.theme-hub .config-list { display: flex; flex-direction: column; gap: 6px; }
.theme-hub .config-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 8px;
  transition: background 0.2s;
}
.theme-hub .config-item:hover { background: rgba(255,255,255,0.04); }
.theme-hub .config-info { display: flex; flex-direction: column; gap: 2px; }
.theme-hub .config-desc { font-weight: 600; color: var(--text-primary, #c9d1d9); font-size: 12px; }
.theme-hub .config-key { font-size: 10px; color: var(--text-muted, #6b7280); }
.theme-hub .config-value-area { display: flex; align-items: center; gap: 8px; }
.theme-hub .config-value { font-weight: 600; color: #00ff88; min-width: 60px; text-align: right; }
.theme-hub .config-input {
  width: 80px; padding: 4px 8px; background: var(--bg-primary, #0d1117);
  border: 1px solid #00ff88; color: #00ff88; border-radius: 4px; font-size: 12px; text-align: right;
}
.theme-hub .config-input:focus { outline: none; box-shadow: 0 0 8px rgba(0,255,136,0.3); }
.theme-hub .config-select {
  width: 90px; padding: 4px 8px; background: var(--bg-primary, #0d1117);
  border: 1px solid #00ff88; color: #00ff88; border-radius: 4px; font-size: 12px; cursor: pointer;
}
.theme-hub .edit-btn, .theme-hub .save-btn, .theme-hub .cancel-btn {
  padding: 3px 10px; border: 1px solid; border-radius: 4px; font-size: 11px;
  cursor: pointer; transition: all 0.2s;
}
.theme-hub .edit-btn { background: rgba(0,255,136,0.08); border-color: rgba(0,255,136,0.3); color: #00ff88; }
.theme-hub .edit-btn:hover { background: rgba(0,255,136,0.15); }
.theme-hub .save-btn { background: rgba(0,255,136,0.15); border-color: #00ff88; color: #00ff88; }
.theme-hub .cancel-btn { background: rgba(255,255,255,0.05); border-color: var(--border-color, #21262d); color: var(--text-muted, #8b949e); }

/* ===== Classic 主题（橙色） ===== */
.theme-classic .panel-title {
  margin: 0 0 32px 0; color: #f59e0b; font-size: 1.6rem;
}
.theme-classic .panel-loading { text-align: center; padding: 40px; color: var(--text-muted, #8b949e); }
.theme-classic .config-group { margin-bottom: 24px; }
.theme-classic .group-title {
  font-size: 1rem; color: #f59e0b; margin: 0 0 16px 0;
  padding-bottom: 8px; border-bottom: 1px solid rgba(245,158,11,0.2); font-weight: 600;
}
.theme-classic .config-list { display: flex; flex-direction: column; gap: 8px; }
.theme-classic .config-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; background: rgba(245,158,11,0.05);
  border: 1px solid rgba(245,158,11,0.1); border-radius: 8px; transition: all 0.2s;
}
.theme-classic .config-item:hover { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.2); }
.theme-classic .config-info { display: flex; flex-direction: column; gap: 4px; }
.theme-classic .config-desc { font-weight: 600; color: var(--text-primary, #f1f5f9); font-size: 13px; }
.theme-classic .config-key { font-size: 11px; color: var(--text-muted, #6b7280); }
.theme-classic .config-value-area { display: flex; align-items: center; gap: 12px; }
.theme-classic .config-value { font-weight: 600; color: #f59e0b; min-width: 80px; text-align: right; font-size: 13px; }
.theme-classic .config-input {
  width: 100px; padding: 8px 12px; background: var(--bg-secondary, #1e293b);
  border: 1px solid #f59e0b; color: #f59e0b; border-radius: 6px; font-size: 13px; text-align: right;
}
.theme-classic .config-input:focus { outline: none; box-shadow: 0 0 8px rgba(245,158,11,0.3); }
.theme-classic .config-select {
  width: 120px; padding: 8px 12px; background: var(--bg-secondary, #1e293b);
  border: 1px solid #f59e0b; color: #f59e0b; border-radius: 6px; font-size: 13px; cursor: pointer;
}
.theme-classic .config-select:focus { outline: none; box-shadow: 0 0 8px rgba(245,158,11,0.3); }
.theme-classic .edit-btn, .theme-classic .save-btn, .theme-classic .cancel-btn {
  padding: 6px 16px; border: 1px solid; border-radius: 6px; font-size: 12px;
  font-weight: 500; cursor: pointer; transition: all 0.2s;
}
.theme-classic .edit-btn { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.3); color: #f59e0b; }
.theme-classic .edit-btn:hover { background: rgba(245,158,11,0.2); }
.theme-classic .save-btn { background: #f59e0b; border-color: #f59e0b; color: white; }
.theme-classic .save-btn:hover { background: #d97706; }
.theme-classic .cancel-btn { background: rgba(255,255,255,0.05); border-color: var(--border-color, #334155); color: var(--text-muted, #8b949e); }
.theme-classic .cancel-btn:hover { background: rgba(255,255,255,0.1); }
</style>

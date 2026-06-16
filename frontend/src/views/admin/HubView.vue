<template>
  <div class="hub-container">
    <!-- SVG 连线 -->
    <svg class="hub-lines" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
      <line v-for="(mod, i) in modules" :key="'line-'+i"
        x1="500" y1="300"
        :x2="mod.svx" :y2="mod.svy"
        stroke="rgba(0,255,136,0.08)" stroke-width="1" />
    </svg>

    <!-- 顶部信息 -->
    <div class="hub-top">
      <span class="hub-title">CyberPlant Admin</span>
      <button class="theme-switch-btn" @click="switchToClassic">
        📋 经典面板
      </button>
    </div>

    <!-- 右上角主题切换 -->
    <div class="hub-theme-toggle">
      <button class="scheme-btn" @click="toggleColorScheme" :title="colorScheme === 'dark' ? '切换浅色' : '切换深色'">
        {{ colorScheme === 'dark' ? '☀️' : '🌙' }}
      </button>
    </div>

    <!-- 中心枢纽 -->
    <div class="hub-center" @click="resetSelection">
      <span class="hub-icon">⚡</span>
    </div>

    <!-- 6 个模块 -->
    <div
      v-for="(mod, i) in modules"
      :key="'mod-'+i"
      class="hub-module"
      :class="{ active: activeModule === mod.id }"
      :style="mod.posStyle"
      @click="openModule(mod.id)"
    >
      <span class="mod-icon">{{ mod.icon }}</span>
      <span class="mod-label">{{ mod.label }}</span>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="activeModule" class="detail-overlay" @mousedown.self="closeModule">
      <div class="detail-card">
        <button class="detail-close" @click="closeModule">✕</button>
        <h2>{{ currentModuleTitle }}</h2>
        <div class="detail-body">
          <!-- 物品管理 -->
          <div v-if="activeModule === 'items'">
            <div class="detail-toolbar">
              <select v-model="itemFilter" class="detail-select">
                <option value="all">全部类型</option>
                <option value="seed">🌱 种子</option>
                <option value="crop">🌾 作物</option>
                <option value="fertilizer">🧪 肥料</option>
                <option value="pet_food">🍖 宠物粮</option>
              </select>
              <button class="add-btn" @click="showAddItem = true">+ 添加物品</button>
            </div>
            <table class="detail-table">
              <thead>
                <tr><th>ID</th><th>图标</th><th>名称</th><th>类型</th><th>稀有度</th><th>买价</th><th>卖价</th><th>可购买</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredItems" :key="item.id">
                  <td>{{ item.id }}</td>
                  <td>{{ item.icon }}</td>
                  <td>{{ item.name }}</td>
                  <td>{{ itemTypeName(item.item_type) }}</td>
                  <td><span :class="['rarity-tag', item.rarity]">{{ item.rarity }}</span></td>
                  <td>{{ item.buy_price }}</td>
                  <td>{{ item.sell_price }}</td>
                  <td>{{ item.purchasable !== false ? '✅' : '❌' }}</td>
                  <td>
                    <button class="action-btn-sm" @click="editItem(item)">编辑</button>
                    <button class="action-btn-sm danger" @click="deleteItem(item.id)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- 编辑物品弹窗 -->
            <div v-if="showEditItem" class="modal-overlay" @mousedown.self="showEditItem = false">
              <div class="modal-card">
                <h3>编辑物品</h3>
                <div class="form-grid">
                  <label>名称 <input v-model="editItemForm.name" /></label>
                  <label>图标 <input v-model="editItemForm.icon" /></label>
                  <label>买价 <input v-model.number="editItemForm.buy_price" type="number" /></label>
                  <label>卖价 <input v-model.number="editItemForm.sell_price" type="number" /></label>
                  <label>货币
                    <select v-model="editItemForm.currency_type">
                      <option value="silver_coin">银币</option>
                      <option value="gold_coin">金币</option>
                      <option value="diamond">钻石</option>
                    </select>
                  </label>
                  <label>可购买 <input type="checkbox" v-model="editItemForm.purchasable" /></label>
                </div>
                <div class="modal-actions">
                  <button @click="showEditItem = false">取消</button>
                  <button class="primary" @click="saveItem">保存</button>
                </div>
              </div>
            </div>

            <!-- 添加物品弹窗 -->
            <div v-if="showAddItem" class="modal-overlay" @mousedown.self="showAddItem = false">
              <div class="modal-card">
                <h3>添加物品</h3>
                <div class="form-grid">
                  <label>名称 <input v-model="newItemForm.name" /></label>
                  <label>图标 <input v-model="newItemForm.icon" /></label>
                  <label>类型
                    <select v-model="newItemForm.item_type">
                      <option value="seed">种子</option>
                      <option value="crop">作物</option>
                      <option value="fertilizer">肥料</option>
                      <option value="pet_food">宠物粮</option>
                    </select>
                  </label>
                  <label>稀有度
                    <select v-model="newItemForm.rarity">
                      <option value="C">C</option>
                      <option value="B">B</option>
                      <option value="A">A</option>
                      <option value="S">S</option>
                      <option value="SSS">SSS</option>
                    </select>
                  </label>
                  <label>买价 <input v-model.number="newItemForm.buy_price" type="number" /></label>
                  <label>卖价 <input v-model.number="newItemForm.sell_price" type="number" /></label>
                  <label>基础产出 <input v-model.number="newItemForm.base_yield" type="number" /></label>
                </div>
                <div class="modal-actions">
                  <button @click="showAddItem = false">取消</button>
                  <button class="primary" @click="addItem">添加</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 用户管理 -->
          <div v-if="activeModule === 'users'">
            <table class="detail-table">
              <thead>
                <tr><th>ID</th><th>用户名</th><th>邮箱</th><th>银币</th><th>金币</th><th>钻石</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-for="u in hubUsers" :key="u.id">
                  <td>{{ u.id }}</td>
                  <td>{{ u.name }}</td>
                  <td>{{ u.email }}</td>
                  <td>{{ u.currencies?.silver_coin || 0 }}</td>
                  <td>{{ u.currencies?.gold_coin || 0 }}</td>
                  <td>{{ u.currencies?.diamond || 0 }}</td>
                  <td>
                    <button class="action-btn-sm" @click="editUser(u)">编辑</button>
                    <button class="action-btn-sm danger" @click="deleteUser(u.id)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- 编辑用户弹窗 -->
            <div v-if="showEditUser" class="modal-overlay" @mousedown.self="showEditUser = false">
              <div class="modal-card">
                <h3>编辑用户</h3>
                <div class="form-grid">
                  <label>用户名 <input v-model="editUserForm.name" /></label>
                  <label>邮箱 <input v-model="editUserForm.email" /></label>
                </div>
                <div class="modal-actions">
                  <button @click="showEditUser = false">取消</button>
                  <button class="primary" @click="saveUser">保存</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 订单管理 -->
          <div v-if="activeModule === 'orders'">
            <table class="detail-table">
              <thead>
                <tr><th>ID</th><th>用户ID</th><th>类型</th><th>货币</th><th>金额</th><th>时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-for="o in hubOrders" :key="o.id">
                  <td>{{ o.id }}</td>
                  <td>{{ o.user_id }}</td>
                  <td>{{ o.type }}</td>
                  <td>{{ o.currency_type }}</td>
                  <td :class="o.amount > 0 ? 'amount-pos' : 'amount-neg'">{{ o.amount > 0 ? '+' : '' }}{{ o.amount }}</td>
                  <td>{{ formatTime(o.created_at) }}</td>
                  <td>
                    <button class="action-btn-sm danger" @click="deleteOrder(o.id)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 宠物管理（含曲线编辑器） -->
          <div v-if="activeModule === 'pets'">
            <PetsPanel />
          </div>

          <!-- 全局配置 -->
          <div v-if="activeModule === 'config'">
            <ConfigPanel />
          </div>

          <!-- 统计 -->
          <div v-if="activeModule === 'stats'">
            <StatsPanel />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/themeStore'
import PetsPanel from './PetsPanel.vue'
import ConfigPanel from './ConfigPanel.vue'
import StatsPanel from './StatsPanel.vue'

const router = useRouter()
const themeStore = useThemeStore()
const colorScheme = computed(() => themeStore.colorScheme)

const activeModule = ref(null)
const itemFilter = ref('all')

// CRUD 状态
const showAddItem = ref(false)
const showEditItem = ref(false)
const showEditUser = ref(false)
const editItemForm = ref({})
const editUserForm = ref({})
const newItemForm = ref({ name: '', icon: '', item_type: 'seed', rarity: 'C', buy_price: 0, sell_price: 0, base_yield: 0, currency_type: 'silver_coin' })

// Hub data
const hubItems = ref([])
const hubUsers = ref([])
const hubOrders = ref([])

const modules = [
  { id: 'items',  icon: '📦', label: '物品', posStyle: { top: '14%',  left: '20%' }, svx: 240, svy: 160 },
  { id: 'pets',   icon: '🐾', label: '宠物', posStyle: { top: '14%',  right: '20%', left: 'auto' }, svx: 760, svy: 160 },
  { id: 'users',  icon: '👥', label: '用户', posStyle: { top: '45%',  left: '8%' }, svx: 100, svy: 300 },
  { id: 'orders', icon: '📋', label: '订单', posStyle: { top: '45%',  right: '8%', left: 'auto' }, svx: 900, svy: 300 },
  { id: 'config', icon: '⚙️', label: '配置', posStyle: { bottom: '14%', left: '20%', top: 'auto' }, svx: 240, svy: 440 },
  { id: 'stats',  icon: '📊', label: '统计', posStyle: { bottom: '14%', right: '20%', left: 'auto', top: 'auto' }, svx: 760, svy: 440 },
]

const currentModuleTitle = computed(() => {
  const mod = modules.find(m => m.id === activeModule.value)
  return mod ? `${mod.icon} ${mod.label}管理` : ''
})

const filteredItems = computed(() => {
  if (itemFilter.value === 'all') return hubItems.value
  return hubItems.value.filter(i => i.item_type === itemFilter.value)
})

function itemTypeName(type) {
  const map = { seed: '🌱 种子', crop: '🌾 作物', fertilizer: '🧪 肥料', pet_food: '🍖 宠物粮' }
  return map[type] || type
}

function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function openModule(id) {
  activeModule.value = id
  const token = localStorage.getItem('auth_token')
  try {
    if (id === 'items' && hubItems.value.length === 0) {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/items/all`, { headers: { Authorization: `Bearer ${token}` } })
      hubItems.value = await r.json()
    }
    if (id === 'users' && hubUsers.value.length === 0) {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
      const all = await r.json()
      hubUsers.value = all.filter(u => u.role !== 'admin')
    }
    if (id === 'orders' && hubOrders.value.length === 0) {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/orders?page=1&limit=20`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await r.json()
      hubOrders.value = data.orders || []
    }
  } catch (e) {
    console.error('Failed to load hub data:', e)
  }
}

function closeModule() { activeModule.value = null }
function resetSelection() { activeModule.value = null }

function switchToClassic() {
  themeStore.setAdminTheme('classic')
  router.push('/admin/classic/dashboard')
}

function toggleColorScheme() {
  themeStore.setColorScheme(colorScheme.value === 'dark' ? 'light' : 'dark')
}

// ========== 物品 CRUD ==========
function editItem(item) {
  editItemForm.value = { ...item }
  showEditItem.value = true
}

async function saveItem() {
  const token = localStorage.getItem('auth_token')
  const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/items/${editItemForm.value.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(editItemForm.value)
  })
  if (r.ok) {
    const idx = hubItems.value.findIndex(i => i.id === editItemForm.value.id)
    if (idx !== -1) hubItems.value[idx] = { ...editItemForm.value }
    showEditItem.value = false
  }
}

async function addItem() {
  const token = localStorage.getItem('auth_token')
  const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(newItemForm.value)
  })
  if (r.ok) {
    const data = await r.json()
    hubItems.value.push(data)
    showAddItem.value = false
    newItemForm.value = { name: '', icon: '', item_type: 'seed', rarity: 'C', buy_price: 0, sell_price: 0, base_yield: 0, currency_type: 'silver_coin' }
  }
}

async function deleteItem(id) {
  if (!confirm('确定删除此物品？')) return
  const token = localStorage.getItem('auth_token')
  await fetch(`${import.meta.env.VITE_API_URL}/admin/items/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  hubItems.value = hubItems.value.filter(i => i.id !== id)
}

// ========== 用户 CRUD ==========
function editUser(user) {
  editUserForm.value = { id: user.id, name: user.name, email: user.email }
  showEditUser.value = true
}

async function saveUser() {
  const token = localStorage.getItem('auth_token')
  const r = await fetch(`${import.meta.env.VITE_API_URL}/users/${editUserForm.value.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(editUserForm.value)
  })
  if (r.ok) {
    const idx = hubUsers.value.findIndex(u => u.id === editUserForm.value.id)
    if (idx !== -1) {
      hubUsers.value[idx].name = editUserForm.value.name
      hubUsers.value[idx].email = editUserForm.value.email
    }
    showEditUser.value = false
  }
}

async function deleteUser(id) {
  if (!confirm('确定删除此用户？')) return
  const token = localStorage.getItem('auth_token')
  await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  hubUsers.value = hubUsers.value.filter(u => u.id !== id)
}

// ========== 订单删除 ==========
async function deleteOrder(id) {
  if (!confirm('确定删除此订单？')) return
  const token = localStorage.getItem('auth_token')
  await fetch(`${import.meta.env.VITE_API_URL}/admin/orders/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  hubOrders.value = hubOrders.value.filter(o => o.id !== id)
}

onMounted(() => {
  themeStore.init()
})
</script>

<style scoped>
.hub-container {
  position: relative;
  width: 100%;
  height: 100vh;
  background: var(--bg-primary, #0d1117);
  overflow: hidden;
}

.hub-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

/* Top bar */
.hub-top {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16px;
}
.hub-title {
  font-size: 14px;
  color: var(--text-secondary, #8b949e);
}
.theme-switch-btn {
  background: rgba(0,255,136,0.1);
  color: #00ff88;
  border: 1px solid rgba(0,255,136,0.3);
  padding: 4px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.theme-switch-btn:hover {
  background: rgba(0,255,136,0.2);
}

/* Theme toggle */
.hub-theme-toggle {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 20;
}
.scheme-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-color, #21262d);
  color: var(--text-secondary, #8b949e);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.scheme-btn:hover {
  background: rgba(255,255,255,0.1);
}

/* Center hub */
.hub-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: radial-gradient(circle, #1a3a2a, #0d2b1a);
  border: 2px solid rgba(0,255,136,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 0 40px rgba(0,255,136,0.15);
  cursor: pointer;
  transition: all 0.3s;
}
.hub-center:hover {
  box-shadow: 0 0 60px rgba(0,255,136,0.3);
  transform: translate(-50%, -50%) scale(1.05);
}
.hub-icon {
  font-size: 36px;
}

/* Modules */
.hub-module {
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border-color, #21262d);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 5;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.hub-module:hover {
  border-color: #00ff88;
  box-shadow: 0 0 24px rgba(0,255,136,0.15);
  transform: scale(1.15);
  z-index: 20;
}
.hub-module.active {
  border-color: #00ff88;
  background: rgba(0,255,136,0.05);
}
.mod-icon {
  font-size: 24px;
  margin-bottom: 2px;
}
.mod-label {
  font-size: 10px;
  color: var(--text-muted, #8b949e);
}

/* Detail overlay */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
}
.detail-card {
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border-color, #21262d);
  border-radius: 16px;
  padding: 24px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  position: relative;
}
.detail-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--text-muted, #8b949e);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}
.detail-close:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-primary, #c9d1d9);
}
.detail-card h2 {
  font-size: 16px;
  color: #00ff88;
  margin: 0 0 16px 0;
}

/* Detail content */
.detail-body {
  font-size: 13px;
}
.detail-toolbar {
  margin-bottom: 12px;
}
.detail-select {
  padding: 6px 12px;
  background: var(--bg-tertiary, #0d1117);
  border: 1px solid var(--border-color, #21262d);
  color: var(--text-primary, #c9d1d9);
  border-radius: 6px;
  font-size: 12px;
}
.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.detail-table th {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color, #21262d);
  color: var(--text-muted, #8b949e);
  white-space: nowrap;
}
.detail-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  color: var(--text-primary, #c9d1d9);
}
.detail-table tr:hover td {
  background: rgba(255,255,255,0.02);
}
.detail-hint {
  margin-top: 12px;
  font-size: 11px;
  color: var(--text-muted, #8b949e);
}
.detail-hint a {
  color: #00ff88;
  text-decoration: none;
}
.detail-hint a:hover {
  text-decoration: underline;
}

.rarity-tag {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}
.rarity-tag.C { background: #9e9e9e; color: #fff; }
.rarity-tag.B { background: #4caf50; color: #fff; }
.rarity-tag.A { background: #2196f3; color: #fff; }
.rarity-tag.S { background: #9c27b0; color: #fff; }
.rarity-tag.SSS { background: #ff9800; color: #fff; }

.amount-pos { color: #4caf50; font-weight: 600; }
.amount-neg { color: #f44336; font-weight: 600; }

/* Light theme overrides */
[data-theme="light"] .hub-container {
  background: #f8fafc;
}
[data-theme="light"] .hub-center {
  background: radial-gradient(circle, #2d6a4f, #1b4332);
}
[data-theme="light"] .hub-module {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
[data-theme="light"] .hub-module:hover {
  box-shadow: 0 0 16px rgba(0,255,136,0.15);
}
[data-theme="light"] .detail-card {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
[data-theme="light"] .detail-table th {
  color: #64748b;
}
[data-theme="light"] .detail-table td {
  color: #1e293b;
}
[data-theme="light"] .detail-overlay {
  background: rgba(0,0,0,0.3);
}

@media (max-width: 767px) {
  .hub-module {
    width: 60px;
    height: 60px;
  }
  .mod-icon { font-size: 18px; }
  .mod-label { font-size: 9px; }
  .hub-center {
    width: 70px;
    height: 70px;
  }
  .hub-icon { font-size: 28px; }
  .detail-card {
    padding: 16px;
    max-height: 85vh;
  }
}

.add-btn {
  background: rgba(0,255,136,0.1);
  border: 1px solid rgba(0,255,136,0.3);
  color: #00ff88;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.add-btn:hover { background: rgba(0,255,136,0.2); }

.action-btn-sm {
  padding: 3px 8px;
  border: 1px solid rgba(0,255,136,0.3);
  border-radius: 4px;
  background: rgba(0,255,136,0.08);
  color: #00ff88;
  font-size: 11px;
  cursor: pointer;
  margin-right: 4px;
}
.action-btn-sm:hover { background: rgba(0,255,136,0.15); }
.action-btn-sm.danger {
  background: rgba(220,38,38,0.1);
  border-color: rgba(220,38,38,0.3);
  color: #f87171;
}
.action-btn-sm.danger:hover { background: rgba(220,38,38,0.2); }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 100; display: flex; align-items: center; justify-content: center;
}
.modal-card {
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border-color, #30363d);
  border-radius: 12px; padding: 24px; width: 90%; max-width: 500px;
}
.modal-card h3 { color: #00ff88; margin: 0 0 16px 0; font-size: 15px; }
.form-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;
}
.form-grid label {
  display: flex; flex-direction: column; gap: 4px;
  font-size: 12px; color: var(--text-secondary, #8b949e);
}
.form-grid input, .form-grid select {
  padding: 6px 10px; background: var(--bg-primary, #0d1117);
  border: 1px solid var(--border-color, #30363d); border-radius: 6px;
  color: var(--text-primary, #c9d1d9); font-size: 13px;
}
.form-grid input[type="checkbox"] { width: auto; }
.modal-actions {
  display: flex; justify-content: flex-end; gap: 8px;
}
.modal-actions button {
  padding: 6px 16px; border-radius: 6px; font-size: 13px;
  cursor: pointer; border: 1px solid var(--border-color, #30363d);
  background: var(--bg-tertiary, #21262d); color: var(--text-primary, #c9d1d9);
}
.modal-actions button.primary {
  background: rgba(0,255,136,0.15); border-color: #00ff88; color: #00ff88;
}
.modal-actions button:hover { opacity: 0.8; }

.detail-table {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
.detail-table th {
  text-align: left; padding: 8px; border-bottom: 1px solid var(--border-color, #30363d);
  color: var(--text-muted, #8b949e); font-size: 11px;
}
.detail-table td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.detail-table tr:hover { background: rgba(255,255,255,0.02); }
.amount-pos { color: #00ff88; }
.amount-neg { color: #f87171; }

.detail-toolbar {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
}
.detail-select {
  padding: 6px 10px; background: var(--bg-primary, #0d1117);
  border: 1px solid var(--border-color, #30363d); border-radius: 6px;
  color: var(--text-primary, #c9d1d9); font-size: 12px;
}
</style>

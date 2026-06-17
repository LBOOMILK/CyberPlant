<template>
  <div class="hub-container" ref="hubRef">
    <!-- SVG 动态连线 -->
    <svg v-if="centerExpanded" class="hub-lines">
      <line v-for="(line, i) in dynamicLines" :key="'line-'+i"
        :x1="line.x1" :y1="line.y1"
        :x2="line.x2" :y2="line.y2"
        stroke="rgba(0,255,136,0.2)" stroke-width="2"
        :style="{ animationDelay: i * 0.05 + 's' }"
        class="hub-line" />
    </svg>

    <!-- 顶部标题栏 -->
    <div class="hub-top">
      <span class="hub-title">🌿 CyberPlant 管理后台</span>
      <button class="theme-switch-btn" @click="switchToClassic">📋 经典面板</button>
    </div>

    <!-- 中心枢纽 -->
    <div class="hub-center" :class="{ expanded: centerExpanded }" @click="toggleCenter">
      <!-- 脉冲引导特效 -->
      <div v-if="!centerExpanded" class="pulse-ring"></div>
      <div v-if="!centerExpanded" class="pulse-ring delay"></div>
      <span class="hub-icon" :class="{ rotated: centerExpanded }">⚡</span>
    </div>

    <!-- 8 个模块按钮（中心展开，均匀分布） -->
    <div
      v-for="(mod, i) in allModules"
      :key="'mod-'+i"
      :ref="el => { if (el) moduleRefs[i] = el }"
      class="hub-module"
      :class="{ active: activeModule === mod.id, visible: centerExpanded }"
      :style="{ '--ox': mod.ox, '--oy': mod.oy }"
      @click="mod.action ? mod.action() : openModule(mod.id)"
    >
      <span class="mod-icon">{{ mod.icon }}</span>
      <span class="mod-label">{{ mod.label }}</span>
    </div>

    <!-- 退出登录确认 -->
    <div v-if="showLogoutConfirm" class="modal-overlay" @mousedown.self="showLogoutConfirm = false">
      <div class="modal-card" style="max-width:360px;text-align:center;">
        <h3>退出登录</h3>
        <p style="color:var(--text-secondary,#8b949e);margin:0 0 20px 0;font-size:13px;">确定要退出登录吗？</p>
        <div class="modal-actions" style="justify-content:center;">
          <button @click="showLogoutConfirm = false">取消</button>
          <button class="primary" style="background:rgba(220,38,38,0.15);border-color:#dc2626;color:#f87171;" @click="handleLogout">确定退出</button>
        </div>
      </div>
    </div>

    <!-- 重置确认 -->
    <div v-if="showResetConfirm" class="modal-overlay" @mousedown.self="showResetConfirm = false">
      <div class="modal-card" style="max-width:420px;">
        <h3>⚠️ 确认重置</h3>
        <p style="color:var(--text-secondary,#8b949e);margin:0 0 8px 0;font-size:13px;">此操作将清空所有数据并重建，包括：</p>
        <ul style="color:#f87171;font-size:12px;margin:0 0 16px 20px;line-height:1.8;">
          <li>所有用户账号和数据</li>
          <li>所有物品、宠物、装饰数据</li>
          <li>所有订单和好友关系</li>
        </ul>
        <p style="color:var(--text-secondary,#8b949e);margin:0 0 16px 0;font-size:13px;">重建后自动插入默认数据，并创建两个演示账号。</p>
        <div class="modal-actions" style="justify-content:center;">
          <button @click="showResetConfirm = false">取消</button>
          <button class="primary" style="background:rgba(220,38,38,0.15);border-color:#dc2626;color:#f87171;" @click="doReset">确认重置</button>
        </div>
      </div>
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
                  <label>买价 <span class="number-input-group"><button class="num-btn" @click="editItemForm.buy_price = Math.max(0, editItemForm.buy_price - 100)" type="button">−</button><input v-model.number="editItemForm.buy_price" type="number" min="0" /><button class="num-btn" @click="editItemForm.buy_price += 100" type="button">+</button></span></label>
                  <label>卖价 <span class="number-input-group"><button class="num-btn" @click="editItemForm.sell_price = Math.max(0, editItemForm.sell_price - 100)" type="button">−</button><input v-model.number="editItemForm.sell_price" type="number" min="0" /><button class="num-btn" @click="editItemForm.sell_price += 100" type="button">+</button></span></label>
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
                  <label>买价 <span class="number-input-group"><button class="num-btn" @click="newItemForm.buy_price = Math.max(0, newItemForm.buy_price - 100)" type="button">−</button><input v-model.number="newItemForm.buy_price" type="number" min="0" /><button class="num-btn" @click="newItemForm.buy_price += 100" type="button">+</button></span></label>
                  <label>卖价 <span class="number-input-group"><button class="num-btn" @click="newItemForm.sell_price = Math.max(0, newItemForm.sell_price - 100)" type="button">−</button><input v-model.number="newItemForm.sell_price" type="number" min="0" /><button class="num-btn" @click="newItemForm.sell_price += 100" type="button">+</button></span></label>
                  <label>基础产出 <span class="number-input-group"><button class="num-btn" @click="newItemForm.base_yield = Math.max(0, newItemForm.base_yield - 1)" type="button">−</button><input v-model.number="newItemForm.base_yield" type="number" min="0" /><button class="num-btn" @click="newItemForm.base_yield++" type="button">+</button></span></label>
                </div>
                <div class="modal-actions">
                  <button @click="showAddItem = false">取消</button>
                  <button class="primary" @click="addItem">添加</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 用户管理（含管理员 tab） -->
          <div v-if="activeModule === 'users'">
            <div class="user-tabs">
              <button :class="['tab-btn', { active: userTab === 'users' }]" @click="userTab = 'users'">👥 普通用户</button>
              <button :class="['tab-btn', { active: userTab === 'admins' }]" @click="switchToAdmins">🛡️ 管理员</button>
            </div>

            <!-- 普通用户 tab -->
            <div v-if="userTab === 'users'">
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
            </div>

            <!-- 管理员 tab -->
            <div v-if="userTab === 'admins'">
              <div class="detail-toolbar">
                <span></span>
                <button class="add-btn" @click="showAddAdmin = true">+ 添加管理员</button>
              </div>
              <table class="detail-table">
                <thead>
                  <tr><th>ID</th><th>邮箱</th><th>操作</th></tr>
                </thead>
                <tbody>
                  <tr v-for="a in hubAdmins" :key="a.id">
                    <td>{{ a.id }}</td>
                    <td>{{ a.email }}</td>
                    <td>
                      <button class="action-btn-sm danger" @click="deleteAdmin(a.id)">删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

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

            <!-- 添加管理员弹窗 -->
            <div v-if="showAddAdmin" class="modal-overlay" @mousedown.self="showAddAdmin = false">
              <div class="modal-card">
                <h3>添加管理员</h3>
                <div class="form-grid" style="grid-template-columns:1fr;">
                  <label>邮箱 <input v-model="newAdminForm.email" type="email" placeholder="admin@example.com" /></label>
                  <label>密码 <input v-model="newAdminForm.password" type="password" placeholder="至少6位" /></label>
                </div>
                <div class="modal-actions">
                  <button @click="showAddAdmin = false">取消</button>
                  <button class="primary" @click="addAdmin">添加</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 订单管理 -->
          <div v-if="activeModule === 'orders'">
            <table class="detail-table">
              <thead>
                <tr><th>ID</th><th>用户</th><th>类型</th><th>货币</th><th>金额</th><th>时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-for="o in hubOrders" :key="o.id">
                  <td>{{ o.id }}</td>
                  <td>{{ o.user?.name || o.user_id }}</td>
                  <td>{{ typeLabel(o.type) }}</td>
                  <td>{{ currencyLabel(o.currency_type) }}</td>
                  <td :class="o.amount > 0 ? 'amount-pos' : 'amount-neg'">{{ o.amount > 0 ? '+' : '' }}{{ o.amount }}</td>
                  <td>{{ formatTime(o.created_at) }}</td>
                  <td>
                    <button class="action-btn-sm danger" @click="deleteOrder(o.id)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 宠物管理 -->
          <div v-if="activeModule === 'pets'">
            <PetsPanel />
          </div>

          <!-- 全局配置 -->
          <div v-if="activeModule === 'config'">
            <ConfigPanel />
          </div>

          <!-- 特效管理 -->
          <div v-if="activeModule === 'effects'">
            <div class="detail-toolbar">
              <span></span>
              <button class="add-btn" @click="triggerUpload">+ 上传特效</button>
              <input type="file" ref="effectFileInput" accept=".js" style="display:none" @change="handleEffectUpload" />
            </div>
            <div v-if="loadingEffects" style="text-align:center;padding:20px;color:var(--text-muted,#8b949e);">加载中...</div>
            <div v-else-if="hubEffects.length === 0" style="text-align:center;padding:30px;color:var(--text-muted,#8b949e);">暂无特效文件</div>
            <table v-else class="detail-table">
              <thead>
                <tr><th>图标</th><th>名称</th><th>文件名</th></tr>
              </thead>
              <tbody>
                <tr v-for="eff in hubEffects" :key="eff.filename">
                  <td>{{ eff.icon || '✨' }}</td>
                  <td>{{ eff.name }}</td>
                  <td style="color:var(--text-muted,#8b949e);font-size:11px;">{{ eff.filename }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="effectUploadError" style="margin-top:8px;color:#f87171;font-size:12px;">{{ effectUploadError }}</div>
          </div>

          <!-- 统计 -->
          <div v-if="activeModule === 'stats'">
            <StatsPanel />
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border-color,#334155);">
              <h3 style="color:#ef4444;font-size:0.95rem;margin:0 0 12px 0;">⚠️ 危险操作</h3>
              <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);border-radius:10px;gap:12px;">
                <div>
                  <p style="margin:0;font-weight:600;font-size:0.9rem;">快速重置</p>
                  <p style="margin:4px 0 0 0;color:var(--text-muted,#8b949e);font-size:0.75rem;">清空所有数据并重建，创建两个演示账号</p>
                </div>
                <button class="add-btn" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.4);color:#ef4444;" @click="showResetConfirm = true">重置数据库</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/themeStore'
import PetsPanel from './PetsPanel.vue'
import ConfigPanel from './ConfigPanel.vue'
import StatsPanel from './StatsPanel.vue'

const router = useRouter()
const themeStore = useThemeStore()

const hubRef = ref(null)
const activeModule = ref(null)
const centerExpanded = ref(false)
const showLogoutConfirm = ref(false)
const showResetConfirm = ref(false)
const itemFilter = ref('all')
const userTab = ref('users')

// CRUD 状态
const showAddItem = ref(false)
const showEditItem = ref(false)
const showEditUser = ref(false)
const showAddAdmin = ref(false)
const editItemForm = ref({})
const editUserForm = ref({})
const newItemForm = ref({ name: '', icon: '', item_type: 'seed', rarity: 'C', buy_price: 0, sell_price: 0, base_yield: 0, currency_type: 'silver_coin' })
const newAdminForm = ref({ email: '', password: '' })
const effectFileInput = ref(null)
const effectUploadError = ref('')
const loadingEffects = ref(false)

// Hub data
const hubItems = ref([])
const hubUsers = ref([])
const hubOrders = ref([])
const hubAdmins = ref([])
const hubEffects = ref([])

// 模块按钮 refs
const moduleRefs = ref({})

// 8 个模块按钮（含退出）
const moduleDefs = [
  { id: 'items',   icon: '📦', label: '物品' },
  { id: 'pets',    icon: '🐾', label: '宠物' },
  { id: 'users',   icon: '👥', label: '用户' },
  { id: 'orders',  icon: '📋', label: '订单' },
  { id: 'config',  icon: '⚙️', label: '配置' },
  { id: 'effects', icon: '✨', label: '特效' },
  { id: 'stats',   icon: '📊', label: '统计', action: () => openStats() },
  { id: 'exit',    icon: '🚪', label: '退出', action: () => confirmLogout() },
]

// 计算 8 个按钮均匀分布在圆周上的位置
const CIRCLE_RADIUS = 30 // vh
const allModules = computed(() => {
  const count = moduleDefs.length
  return moduleDefs.map((def, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2 // 从顶部开始顺时针
    const ox = (Math.cos(angle) * CIRCLE_RADIUS).toFixed(1) + 'vh'
    const oy = (Math.sin(angle) * CIRCLE_RADIUS).toFixed(1) + 'vh'
    return { ...def, ox, oy }
  })
})

// 动态连线数据
const dynamicLines = ref([])
let resizeObserver = null

function calcLines() {
  if (!hubRef.value || !centerExpanded.value) return
  const container = hubRef.value
  const containerRect = container.getBoundingClientRect()
  const centerX = containerRect.width / 2
  const centerY = containerRect.height / 2

  const lines = []
  for (let i = 0; i < moduleDefs.length; i++) {
    const el = moduleRefs.value[i]
    if (!el) continue
    const rect = el.getBoundingClientRect()
    const modCenterX = rect.left - containerRect.left + rect.width / 2
    const modCenterY = rect.top - containerRect.top + rect.height / 2
    lines.push({ x1: centerX, y1: centerY, x2: modCenterX, y2: modCenterY })
  }
  dynamicLines.value = lines
}

watch(centerExpanded, async (val) => {
  if (val) {
    await nextTick()
    // 等按钮展开动画完成后再计算连线
    setTimeout(calcLines, 500)
    setTimeout(calcLines, 800)
  }
})

onMounted(() => {
  themeStore.init()
  resizeObserver = new ResizeObserver(() => {
    if (centerExpanded.value) calcLines()
  })
  if (hubRef.value) resizeObserver.observe(hubRef.value)
  window.addEventListener('resize', calcLines)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', calcLines)
})

const currentModuleTitle = computed(() => {
  const mod = moduleDefs.find(m => m.id === activeModule.value)
  if (mod) return `${mod.icon} ${mod.label}管理`
  if (activeModule.value === 'stats') return '📊 统计'
  return ''
})

const filteredItems = computed(() => {
  if (itemFilter.value === 'all') return hubItems.value
  return hubItems.value.filter(i => i.item_type === itemFilter.value)
})

function itemTypeName(type) {
  const map = { seed: '🌱 种子', crop: '🌾 作物', fertilizer: '🧪 肥料', pet_food: '🍖 宠物粮' }
  return map[type] || type
}

function typeLabel(type) {
  const map = { purchase: '购买', refund: '退款', gift: '赠送', reward: '奖励', admin: '管理' }
  return map[type] || type || '—'
}

function currencyLabel(type) {
  const map = { silver_coin: '银币', gold_coin: '金币', diamond: '钻石' }
  return map[type] || type || '—'
}

function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// 中心按钮
function toggleCenter() {
  centerExpanded.value = !centerExpanded.value
}

function openStats() {
  activeModule.value = 'stats'
}

function confirmLogout() {
  showLogoutConfirm.value = true
}

function triggerUpload() {
  effectFileInput.value?.click()
}

async function handleEffectUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.name.endsWith('.js')) {
    effectUploadError.value = '请选择 .js 文件'
    return
  }
  effectUploadError.value = ''
  try {
    const content = await file.text()
    if (!content.includes('name') || !content.includes('init')) {
      effectUploadError.value = '文件必须导出 { name, init } 对象'
      return
    }
    const token = localStorage.getItem('auth_token')
    const formData = new FormData()
    formData.append('effect', file)
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    if (r.ok) {
      hubEffects.value = []
      await loadEffects()
    } else {
      const err = await r.json()
      effectUploadError.value = err.error || '上传失败'
    }
  } catch {
    effectUploadError.value = '网络错误'
  }
  if (effectFileInput.value) effectFileInput.value.value = ''
}

async function loadEffects() {
  loadingEffects.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      const files = data.effects || data
      hubEffects.value = files.map(f => ({ filename: f, name: f.replace('.js', ''), icon: '✨' }))
    }
  } catch (e) {
    console.error('Failed to load effects:', e)
  } finally {
    loadingEffects.value = false
  }
}

function handleLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_role')
  localStorage.removeItem('user_email')
  localStorage.removeItem('user_name')
  localStorage.removeItem('user_key')
  showLogoutConfirm.value = false
  router.push('/')
}

async function doReset() {
  showResetConfirm.value = false
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      alert('重置成功！\n演示账号：' + data.accounts.map(a => `${a.email} / ${a.password}`).join('\n'))
    } else {
      const err = await r.json()
      alert(err.error || '重置失败')
    }
  } catch (e) {
    alert('网络错误')
  }
}

async function openModule(id) {
  // 不收起按钮，保持展开状态
  activeModule.value = id
  const token = localStorage.getItem('auth_token')
  try {
    if (id === 'items' && hubItems.value.length === 0) {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/items/all`, { headers: { Authorization: `Bearer ${token}` } })
      hubItems.value = await r.json()
    }
    if (id === 'users') {
      userTab.value = 'users'
      if (hubUsers.value.length === 0) {
        const r = await fetch(`${import.meta.env.VITE_API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
        const all = await r.json()
        hubUsers.value = all.filter(u => u.role !== 'admin')
      }
    }
    if (id === 'orders' && hubOrders.value.length === 0) {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/orders?page=1&limit=20`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await r.json()
      hubOrders.value = data.orders || []
    }
    if (id === 'effects' && hubEffects.value.length === 0) {
      await loadEffects()
    }
  } catch (e) {
    console.error('Failed to load hub data:', e)
  }
}

async function switchToAdmins() {
  userTab.value = 'admins'
  if (hubAdmins.value.length === 0) {
    try {
      const token = localStorage.getItem('auth_token')
      const r = await fetch(`${import.meta.env.VITE_API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
      const all = await r.json()
      hubAdmins.value = all.filter(u => u.role === 'admin')
    } catch (e) {
      console.error('Failed to load admins:', e)
    }
  }
}

function closeModule() { activeModule.value = null }

function switchToClassic() {
  themeStore.setAdminTheme('classic')
  router.push('/admin/classic/dashboard')
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

// ========== 管理员 CRUD ==========
async function addAdmin() {
  if (!newAdminForm.value.email || !newAdminForm.value.password) return alert('请填写邮箱和密码')
  const token = localStorage.getItem('auth_token')
  const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email: newAdminForm.value.email, password: newAdminForm.value.password, role: 'admin' })
  })
  if (r.ok) {
    const data = await r.json()
    hubAdmins.value.push(data.user || data)
    showAddAdmin.value = false
    newAdminForm.value = { email: '', password: '' }
  } else {
    const err = await r.json()
    alert(err.error || '添加失败')
  }
}

async function deleteAdmin(id) {
  if (!confirm('确定删除此管理员？')) return
  const token = localStorage.getItem('auth_token')
  await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  hubAdmins.value = hubAdmins.value.filter(a => a.id !== id)
}

// ========== 订单删除 ==========
async function deleteOrder(id) {
  if (!confirm('确定删除此订单？')) return
  const token = localStorage.getItem('auth_token')
  await fetch(`${import.meta.env.VITE_API_URL}/admin/orders/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  hubOrders.value = hubOrders.value.filter(o => o.id !== id)
}
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
.hub-line {
  animation: lineFadeIn 0.4s ease forwards;
  opacity: 0;
}
@keyframes lineFadeIn {
  to { opacity: 1; }
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
  animation: centerSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes centerSlideUp {
  from {
    transform: translate(-50%, calc(-50% + 100vh));
    opacity: 0;
  }
  to {
    transform: translate(-50%, -50%);
    opacity: 1;
  }
}
.hub-center:hover {
  box-shadow: 0 0 60px rgba(0,255,136,0.3);
  transform: translate(-50%, -50%) scale(1.05);
}
.hub-center.expanded {
  box-shadow: 0 0 80px rgba(0,255,136,0.4);
  border-color: rgba(0,255,136,0.6);
}

/* 脉冲引导特效 */
.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid rgba(0,255,136,0.4);
  animation: pulseExpand 2s ease-out infinite;
  pointer-events: none;
}
.pulse-ring.delay {
  animation-delay: 1s;
}
@keyframes pulseExpand {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

.hub-icon {
  font-size: 36px;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hub-icon.rotated {
  transform: rotate(180deg);
}

/* Modules */
.hub-module {
  position: absolute;
  top: 50%;
  left: 50%;
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
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  /* 默认隐藏在中心 */
  opacity: 0;
  transform: translate(-50%, -50%) scale(0);
  pointer-events: none;
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hub-module.visible {
  opacity: 1;
  transform: translate(calc(-50% + var(--ox)), calc(-50% + var(--oy))) scale(1);
  pointer-events: auto;
}
.hub-module:hover {
  border-color: #00ff88;
  box-shadow: 0 0 24px rgba(0,255,136,0.15);
  z-index: 20;
}
.hub-module.visible:hover {
  transform: translate(calc(-50% + var(--ox)), calc(-50% + var(--oy))) scale(1.15);
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

/* User tabs */
.user-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--bg-primary, #0d1117);
  border-radius: 8px;
  padding: 4px;
}
.tab-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted, #8b949e);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn:hover {
  color: var(--text-primary, #c9d1d9);
  background: rgba(255,255,255,0.04);
}
.tab-btn.active {
  background: rgba(0,255,136,0.1);
  color: #00ff88;
}

/* Detail content */
.detail-body {
  font-size: 13px;
}
.detail-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.amount-pos { color: #00ff88; font-weight: 600; }
.amount-neg { color: #f87171; font-weight: 600; }

/* Light theme */
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
[data-theme="light"] .user-tabs {
  background: #f1f5f9;
}
[data-theme="light"] .tab-btn.active {
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
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
</style>

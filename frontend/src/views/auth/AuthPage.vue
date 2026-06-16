<template>
  <div class="login-page">
    <!-- Toast 提示组件 -->
    <Toast ref="toastRef" />

    <!-- ============================================
         左右分区背景
         ============================================ -->
    <div class="bg-left"></div>
    <div class="bg-right"></div>

    <!-- 中间分隔线 -->
    <div class="divider"></div>

    <!-- ============================================
         背景树SVG容器
         ============================================ -->
    <div id="treeContainer"></div>

    <!-- ============================================
         落叶动画层
         ============================================ -->
    <div id="leafFallLayer"></div>

    <!-- ============================================
         中心嫩芽emoji
         ============================================ -->
    <div class="center-sprout">🌱</div>

    <!-- ============================================
         标题区域
         ============================================ -->
    <div class="title-area">
      <div class="title-main">赛博花园</div>
      <div class="title-sub">CyberPlant</div>
      
      <!-- ============================================
           注册按钮 - 放在标题下方，使用相对定位
           ============================================ -->
      <div class="register-btn-wrapper" id="registerBtnWrapper">
        <div class="register-btn" id="registerBtn">🌻 注册新用户</div>
      </div>
    </div>

    <!-- ============================================
         登录选项卡容器
         ============================================ -->
    <div class="panels">
      <!-- 用户登录面板 -->
      <div class="panel-wrapper">
        <!-- 春·SPRING 标签 -->
        <div class="panel-tag tag-left" id="tagLeft">春 · SPRING</div>
        <!-- 用户登录卡片 -->
        <div class="panel s" id="panelUser">
          <span class="panel-icon">🧑‍🌾</span>
          <div class="panel-title">用户登录</div>
          <div class="panel-desc">进入你的花园<br>种植、养成、交友</div>
          <div class="panel-arrow">→</div>
        </div>
      </div>

      <!-- 管理员登录面板 -->
      <div class="panel-wrapper">
        <!-- 秋·AUTUMN 标签 -->
        <div class="panel-tag tag-right" id="tagRight">秋 · AUTUMN</div>
        <!-- 管理员登录卡片 -->
        <div class="panel a" id="panelAdmin">
          <span class="panel-icon">⚙️</span>
          <div class="panel-title">管理员登录</div>
          <div class="panel-desc">管理花园数据<br>用户、物品、订单</div>
          <div class="panel-arrow">→</div>
        </div>
      </div>
    </div>

    <!-- 底部提示文字 -->
    <div class="hint">选择身份进入花园</div>

    <!-- ============================================
         管理员考验门（在真正登录表单之前）
         ============================================ -->
    <div v-if="showGate" class="gate-overlay">
      <div class="gate-card">
        <h2>🔐 管理员验证</h2>
        <div class="gate-sub">请输入管理员凭证</div>
        <form @submit.prevent="checkGate">
          <div class="form-group">
            <label>邮箱</label>
            <input
              type="text"
              v-model="gateForm.email"
              autocomplete="off"
              required
              placeholder="请输入管理员邮箱"
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              type="text"
              v-model="gateForm.password"
              autocomplete="off"
              required
              placeholder="请输入管理员密码"
            />
          </div>
          <button type="submit" class="login-btn gate-btn">验 证</button>
        </form>
        <button class="back-btn" @click="showGate = false">← 返回选择身份</button>
      </div>
    </div>

    <!-- ============================================
         用户登录表单（从下方滑入）
         ============================================ -->
    <div class="login-overlay" id="loginUser">
      <div class="login-card user-card">
        <h2>🧑‍🌾 用户登录</h2>
        <div class="login-sub">进入你的赛博花园</div>

        <form @submit.prevent="handleUserLogin">
          <div class="form-group">
            <label>邮箱</label>
            <input
              type="email"
              v-model="userForm.email"
              required
              placeholder="请输入邮箱"
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              :type="userShowPassword ? 'text' : 'password'"
              v-model="userForm.password"
              required
              placeholder="请输入密码"
            />
          </div>
          <button type="submit" class="login-btn">登 录</button>
        </form>

        <button class="back-btn" id="backUser">← 返回选择身份</button>
      </div>
    </div>

    <!-- ============================================
         管理员登录表单（从下方滑入）
         ============================================ -->
    <div class="login-overlay" id="loginAdmin">
      <div class="login-card admin-card">
        <h2>⚙️ 管理员登录</h2>
        <div class="login-sub">花园管理中心</div>

        <form @submit.prevent="handleAdminLogin">
          <div class="form-group">
            <label>邮箱</label>
            <input
              type="email"
              v-model="adminForm.email"
              required
              placeholder="请输入管理员邮箱"
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              :type="adminShowPassword ? 'text' : 'password'"
              v-model="adminForm.password"
              required
              placeholder="请输入密码"
            />
          </div>
          <button type="submit" class="login-btn">登 录</button>
        </form>

        <button class="back-btn" id="backAdmin">← 返回选择身份</button>
      </div>
    </div>

    <!-- ============================================
         注册表单（从上方滑入）
         ============================================ -->
    <div class="login-overlay" id="loginRegister">
      <div class="login-card register-card">
        <h2>🌻 注册新用户</h2>
        <div class="login-sub">创建你的赛博花园账号</div>

        <form @submit.prevent="handleRegister">
          <div class="form-group">
            <label>用户名</label>
            <input
              type="text"
              v-model="registerForm.name"
              required
              placeholder="请输入用户名"
            />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input
              type="email"
              v-model="registerForm.email"
              required
              placeholder="请输入邮箱"
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              type="password"
              v-model="registerForm.password"
              required
              placeholder="请输入密码"
            />
          </div>
          <div class="form-group">
            <label>确认密码</label>
            <input
              type="password"
              v-model="registerForm.confirmPassword"
              required
              placeholder="请再次输入密码"
            />
          </div>
          <button type="submit" class="login-btn">注 册</button>
        </form>

        <button class="back-btn" id="backRegister">← 返回选择身份</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '@/components/common/Toast.vue'

const router = useRouter()
const toastRef = ref(null)

// 用户登录表单
const userForm = ref({
  email: '',
  password: ''
})
const userShowPassword = ref(false)

// 管理员登录表单
const adminForm = ref({
  email: '',
  password: ''
})
const adminShowPassword = ref(false)

// 管理员考验门
const showGate = ref(false)
const gateForm = ref({ email: '', password: '' })
const gatePassed = ref(false)
const gateToasts = [
  '不是真正的管理员就别点这里了😅',
  '别试图当管理员了普通用户😓',
  '其实根本没有管理员登录--你信吗？😄',
  '你确定你是管理员？我怎么没见过你🤔',
  '管理员密码是123456哦（才不是）😏'
]

function checkGate() {
  if (
    gateForm.value.email === 'Administrator@Administrator.com' &&
    gateForm.value.password === "Admindoesn'tneedpassword"
  ) {
    gatePassed.value = true
    showGate.value = false
    loginAdmin.value.classList.add('active')
  } else {
    const msg = gateToasts[Math.floor(Math.random() * gateToasts.length)]
    if (toastRef.value) toastRef.value.addToast(msg, 'error')
  }
}

// 注册表单
const registerForm = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
})

// DOM元素引用
const panelUser = ref(null)
const panelAdmin = ref(null)
const tagLeft = ref(null)
const tagRight = ref(null)
const loginUser = ref(null)
const loginAdmin = ref(null)
const loginRegister = ref(null)
const registerBtnWrapper = ref(null)

// ==================== 落叶系统配置 ====================
const LEAF_CONFIG = {

  // ----- 数量控制 -----
  maxPerSide: 250,         // 每侧最大同时显示叶子数（达到上限暂停生成，等待销毁后补充）

  // ----- 叶子外观 -----
  leafSizeMin: 4,          // 叶子最小尺寸(px)，随机范围起点
  leafSizeMax: 10,         // 叶子最大尺寸(px)，随机范围终点
  leafAlphaMin: 0.45,      // 叶子最小初始透明度(0~1，0完全透明/1完全不透明)
  leafAlphaMax: 0.9,       // 叶子最大初始透明度(0~1)

  // ----- 出生区域（限制叶子生成时的X坐标范围，单位：屏幕宽度%） -----
  leftMinX: 15,            // 左侧叶子出生点最小X坐标（屏幕左边15%处）
  leftMaxX: 48,            // 左侧叶子出生点最大X坐标（屏幕左边48%处，不超过中线）
  rightMinX: 52,           // 右侧叶子出生点最小X坐标（屏幕右边52%处，不低于中线）
  rightMaxX: 85,           // 右侧叶子出生点最大X坐标（屏幕右边85%处）

  // ----- 飘落动画参数 -----
  fallDurationMin: 8,      // 飘落最短时长(秒)，叶子从出现到销毁的最短时间
  fallDurationMax: 18,     // 飘落最长时长(秒)，叶子从出现到销毁的最长时间
  driftMax: 300,           // 水平飘移最大距离(px)，正负双向随机，模拟风吹效果
  spinMax: 1080,           // 旋转最大角度(deg)，正负双向随机，1080=最多转3圈
  spawnDelayMax: 5,        // 出生最大延迟(秒)，叶子创建后等待0~5秒才开始动画

  // ----- 缩放控制 -----
  startScale: 1,           // 叶子出生时缩放比例（1=原始大小，0.5=一半大）
  endScale: 1,             // 叶子消失时缩放比例（1=不变小，0.3=缩小到30%）

  // ----- 初始批量生成（页面加载时的出场方式） -----
  batchCount: 40,          // 每批生成的叶子数量（左右同时各40片）
  batchInterval: 200,      // 批内每片间隔(ms)，200ms≈每秒5片
  batchGap: 1000,          // 批次间隔(ms)，上一批结束后等1秒开始下一批
  batchRounds: 4,          // 初始批次数（共4批，左右同时各4批）

  // ----- 持续循环生成（初始批量完成后，持续补充叶子） -----
  loopDelayMin: 100,       // 循环生成最小间隔(ms)，销毁一片后最快0.1秒补充
  loopDelayMax: 200,       // 循环生成最大间隔(ms)，销毁一片后最慢0.2秒补充

  // ----- 销毁时机 & 透明度衰减 -----
  destroyAtPercent: 0.98,  // 动画进度多少时销毁（0.98=下落98%路程时remove元素）
  opacityHoldPercent: 0.82,// 透明度保持到动画进度的多少（0.82=前82%路程保持峰值透明度，之后快速衰减）
  opacityPeak: 0.75,       // 峰值透明度（0.75=叶子最亮时75%不透明）

};

// 落叶动画函数
function initLeafFall() {
  const leafLayer = document.getElementById('leafFallLayer')
  if (!leafLayer) return

  const leftColors = ['#4CAF50', '#66BB6A', '#81C784', '#388E3C', '#A5D6A7']
  const rightColors = ['#FF9800', '#FFA726', '#FFB74D', '#F57C00', '#FFCC80']

  function leafSVG(size, color) {
    const sz = size
    return `<svg width="${sz * 2}" height="${sz * 2}" viewBox="0 0 ${sz * 2} ${sz * 2}" xmlns="http://www.w3.org/2000/svg">
      <path d="M ${sz} 0 C ${sz * 1.5} ${sz * 0.6} ${sz * 1.5} ${sz * 1.4} ${sz} ${sz * 2} C ${sz * 0.5} ${sz * 1.4} ${sz * 0.5} ${sz * 0.6} ${sz} 0 Z"
        fill="${color}" />
    </svg>`
  }

  function spawnLeaf(isLeft) {
    const side = isLeft ? 'left' : 'right'
    const currentCount = document.querySelectorAll(`.falling-leaf[data-side="${side}"]`).length
    if (currentCount >= LEAF_CONFIG.maxPerSide) return

    const colors = isLeft ? leftColors : rightColors
    const color = colors[Math.floor(Math.random() * colors.length)]
    const size = LEAF_CONFIG.leafSizeMin + Math.random() * (LEAF_CONFIG.leafSizeMax - LEAF_CONFIG.leafSizeMin)

    const leaf = document.createElement('div')
    leaf.className = 'falling-leaf'
    leaf.setAttribute('data-side', side)
    leaf.innerHTML = leafSVG(size, color)

    const startX = isLeft
      ? LEAF_CONFIG.leftMinX + Math.random() * (LEAF_CONFIG.leftMaxX - LEAF_CONFIG.leftMinX)
      : LEAF_CONFIG.rightMinX + Math.random() * (LEAF_CONFIG.rightMaxX - LEAF_CONFIG.rightMinX)
    leaf.style.left = startX + '%'

    const duration = LEAF_CONFIG.fallDurationMin + Math.random() * (LEAF_CONFIG.fallDurationMax - LEAF_CONFIG.fallDurationMin)
    const drift = (Math.random() - 0.5) * LEAF_CONFIG.driftMax * 2
    const spin = (Math.random() - 0.5) * LEAF_CONFIG.spinMax * 2
    const delay = Math.random() * LEAF_CONFIG.spawnDelayMax

    leaf.style.setProperty('--drift', drift + 'px')
    leaf.style.setProperty('--spin', spin + 'deg')
    leaf.style.setProperty('--start-scale', LEAF_CONFIG.startScale)
    leaf.style.setProperty('--end-scale', LEAF_CONFIG.endScale)
    leaf.style.setProperty('--peak-opacity', LEAF_CONFIG.opacityPeak)
    leaf.style.setProperty('--hold-percent', LEAF_CONFIG.opacityHoldPercent * 100 + '%')
    leaf.style.animationDuration = duration + 's'
    leaf.style.animationDelay = delay + 's'

    leafLayer.appendChild(leaf)

    const destroyTime = (duration * LEAF_CONFIG.destroyAtPercent + delay) * 1000
    const destroyTimer = setTimeout(() => {
      if (leaf.parentNode) leaf.remove()
    }, destroyTime)

    leaf.addEventListener('animationend', () => {
      clearTimeout(destroyTimer)
      leaf.remove()
    })
  }

  function spawnLeft() {
    spawnLeaf(true)
    setTimeout(spawnLeft, LEAF_CONFIG.loopDelayMin + Math.random() * (LEAF_CONFIG.loopDelayMax - LEAF_CONFIG.loopDelayMin))
  }

  function spawnRight() {
    spawnLeaf(false)
    setTimeout(spawnRight, LEAF_CONFIG.loopDelayMin + Math.random() * (LEAF_CONFIG.loopDelayMax - LEAF_CONFIG.loopDelayMin))
  }

  function batch(isLeft, count, interval) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnLeaf(isLeft), i * interval)
    }
  }

  for (let round = 0; round < LEAF_CONFIG.batchRounds; round++) {
    setTimeout(() => {
      batch(true, LEAF_CONFIG.batchCount, LEAF_CONFIG.batchInterval)
      batch(false, LEAF_CONFIG.batchCount, LEAF_CONFIG.batchInterval)
    }, LEAF_CONFIG.batchGap * round)
  }

  setTimeout(spawnLeft, LEAF_CONFIG.batchGap * LEAF_CONFIG.batchRounds + 500)
  setTimeout(spawnRight, LEAF_CONFIG.batchGap * LEAF_CONFIG.batchRounds + 500)
}

onMounted(() => {
  // 获取DOM元素
  panelUser.value = document.getElementById('panelUser')
  panelAdmin.value = document.getElementById('panelAdmin')
  tagLeft.value = document.getElementById('tagLeft')
  tagRight.value = document.getElementById('tagRight')
  loginUser.value = document.getElementById('loginUser')
  loginAdmin.value = document.getElementById('loginAdmin')
  loginRegister.value = document.getElementById('loginRegister')
  registerBtnWrapper.value = document.getElementById('registerBtnWrapper')

  // 加载背景树SVG
  fetch('/assets/login/treenew.svg')
    .then(res => res.text())
    .then(svgText => {
      document.getElementById('treeContainer').innerHTML = svgText
    })
    .catch(() => {
      console.log('tree.svg 加载失败')
    })

  // 初始化落叶动画
  initLeafFall()

  // 用户面板点击事件
  panelUser.value.addEventListener('click', () => {
    hideRegisterBtn()
    resetPanels()
    panelUser.value.style.animation = 'panelSlideOutLeft 0.6s cubic-bezier(0.55,0,1,0.45) forwards'
    panelAdmin.value.style.animation = 'panelSlideOutRight 0.6s cubic-bezier(0.55,0,1,0.45) forwards'
    tagLeft.value.classList.add('rgb-glow')
    setTimeout(() => { loginUser.value.classList.add('active') }, 600)
  })

  // 管理员面板点击事件
  panelAdmin.value.addEventListener('click', () => {
    hideRegisterBtn()
    resetPanels()
    panelUser.value.style.animation = 'panelSlideOutLeft 0.6s cubic-bezier(0.55,0,1,0.45) forwards'
    panelAdmin.value.style.animation = 'panelSlideOutRight 0.6s cubic-bezier(0.55,0,1,0.45) forwards'
    tagRight.value.classList.add('tag-animate')
    if (gatePassed.value) {
      setTimeout(() => { loginAdmin.value.classList.add('active') }, 600)
    } else {
      setTimeout(() => { showGate.value = true }, 600)
    }
  })

  // 注册按钮点击事件
  registerBtnWrapper.value.addEventListener('click', () => {
    hideRegisterBtn()
    resetPanels()
    panelUser.value.style.animation = 'panelSlideOutLeft 0.6s cubic-bezier(0.55,0,1,0.45) forwards'
    panelAdmin.value.style.animation = 'panelSlideOutRight 0.6s cubic-bezier(0.55,0,1,0.45) forwards'
    setTimeout(() => { loginRegister.value.classList.add('active') }, 600)
  })

  // 返回按钮事件
  document.getElementById('backUser').addEventListener('click', () => goBack(loginUser.value, true, false))
  document.getElementById('backAdmin').addEventListener('click', () => {
    showGate.value = false
    goBack(loginAdmin.value, false, false)
  })
  document.getElementById('backRegister').addEventListener('click', () => goBack(loginRegister.value, false, true))
})

// 隐藏注册按钮 - 向上移出屏幕
function hideRegisterBtn() {
  registerBtnWrapper.value.style.animation = 'registerBtnSlideOut 0.6s cubic-bezier(0.55,0,1,0.45) forwards'
}

// 显示注册按钮 - 从上方移入屏幕
function showRegisterBtn() {
  registerBtnWrapper.value.style.animation = 'none'
  registerBtnWrapper.value.style.transform = 'none'
  void registerBtnWrapper.value.offsetWidth
  registerBtnWrapper.value.style.animation = 'registerBtnSlideIn 0.6s cubic-bezier(0.16,1,0.3,1) forwards'
}

// 重置面板动画
function resetPanels() {
  panelUser.value.style.animation = 'none'
  panelAdmin.value.style.animation = 'none'
  void panelUser.value.offsetWidth
  void panelAdmin.value.offsetWidth
}

// 返回函数
function goBack(overlay, isUser, isRegister) {
  overlay.classList.remove('active')
  setTimeout(() => {
    panelUser.value.style.transform = 'translateX(-100vw) scale(0.8)'
    panelUser.value.style.opacity = '0'
    panelAdmin.value.style.transform = 'translateX(100vw) scale(0.8)'
    panelAdmin.value.style.opacity = '0'
    panelUser.value.style.animation = 'none'
    panelAdmin.value.style.animation = 'none'
    void panelUser.value.offsetWidth
    void panelAdmin.value.offsetWidth
    panelUser.value.style.animation = 'panelSlideInLeft 0.6s cubic-bezier(0.16,1,0.3,1) forwards'
    panelAdmin.value.style.animation = 'panelSlideInRight 0.6s cubic-bezier(0.16,1,0.3,1) forwards'
    
    // 移除标签的动画效果
    if (isUser) {
      tagLeft.value.classList.remove('rgb-glow')
    } else if (!isRegister) {
      tagRight.value.classList.remove('tag-animate')
    }
    
    // 显示注册按钮
    showRegisterBtn()
  }, 600)
}

// 用户登录处理
async function handleUserLogin() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: userForm.value.email,
        password: userForm.value.password
      })
    })

    const data = await response.json()

    if (!response.ok) {
      if (toastRef.value) {
        toastRef.value.addToast(data.error || '登录失败', 'error')
      }
      return
    }

    // 保存登录信息
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user_id', data.user.id)
    localStorage.setItem('user_role', data.user.role)
    localStorage.setItem('user_email', data.user.email)
    localStorage.setItem('user_name', data.user.name)

    // 检查是否是管理员账号
    if (data.user.role === 'admin') {
      if (toastRef.value) {
        toastRef.value.addToast('请使用管理员登录入口', 'error')
      }
      // 清除登录信息
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_id')
      localStorage.removeItem('user_role')
      localStorage.removeItem('user_email')
      localStorage.removeItem('user_name')
      return
    }

    // 跳转到用户仪表盘
    router.push('/dashboard')
  } catch (error) {
    console.error('登录失败:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

// 管理员登录处理
async function handleAdminLogin() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: adminForm.value.email,
        password: adminForm.value.password
      })
    })

    const data = await response.json()

    if (!response.ok) {
      if (toastRef.value) {
        toastRef.value.addToast(data.error || '登录失败', 'error')
      }
      return
    }

    // 保存登录信息
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user_id', data.user.id)
    localStorage.setItem('user_role', data.user.role)
    localStorage.setItem('user_email', data.user.email)
    localStorage.setItem('user_name', data.user.name)

    // 检查是否是普通用户账号
    if (data.user.role !== 'admin') {
      if (toastRef.value) {
        toastRef.value.addToast('请使用普通用户登录入口', 'error')
      }
      // 清除登录信息
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_id')
      localStorage.removeItem('user_role')
      localStorage.removeItem('user_email')
      localStorage.removeItem('user_name')
      return
    }

    // 跳转到管理员仪表盘
    router.push('/admin')
  } catch (error) {
    console.error('登录失败:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}

// 注册处理
async function handleRegister() {
  // 验证密码
  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    if (toastRef.value) {
      toastRef.value.addToast('两次输入的密码不一致', 'error')
    }
    return
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: registerForm.value.name,
        email: registerForm.value.email,
        password: registerForm.value.password
      })
    })

    const data = await response.json()

    if (!response.ok) {
      if (toastRef.value) {
        toastRef.value.addToast(data.error || '注册失败', 'error')
      }
      return
    }

    if (toastRef.value) {
      toastRef.value.addToast('注册成功！请登录', 'success')
    }

    // 清空表单
    registerForm.value = {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    }

    // 隐藏注册表单
    loginRegister.value.classList.remove('active')
    
    // 显示面板和注册按钮
    setTimeout(() => {
      panelUser.value.style.transform = 'translateX(-100vw) scale(0.8)'
      panelUser.value.style.opacity = '0'
      panelAdmin.value.style.transform = 'translateX(100vw) scale(0.8)'
      panelAdmin.value.style.opacity = '0'
      panelUser.value.style.animation = 'none'
      panelAdmin.value.style.animation = 'none'
      void panelUser.value.offsetWidth
      void panelAdmin.value.offsetWidth
      panelUser.value.style.animation = 'panelSlideInLeft 0.6s cubic-bezier(0.16,1,0.3,1) forwards'
      panelAdmin.value.style.animation = 'panelSlideInRight 0.6s cubic-bezier(0.16,1,0.3,1) forwards'
      showRegisterBtn()
    }, 300)
  } catch (error) {
    console.error('注册失败:', error)
    if (toastRef.value) {
      toastRef.value.addToast('网络错误，请稍后再试', 'error')
    }
  }
}
</script>

<style>
/* ============================================
   基础重置样式
   ============================================ */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.login-page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  font-family: system-ui, 'Segoe UI', sans-serif;
  background: #0a0f0a;
}

/* ============================================
   背景样式
   ============================================ */
.bg-left, .bg-right {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 50%;
  z-index: 0;
}
.bg-left { left: 0; background: linear-gradient(180deg, #0d1a0a, #162816); }
.bg-right { right: 0; background: linear-gradient(180deg, #1a1208, #251a0a); }

/* ============================================
   中间分隔线
   ============================================ */
.divider {
  position: fixed;
  top: 0; bottom: 0; left: 50%; width: 1px;
  z-index: 50; pointer-events: none;
  background: linear-gradient(180deg, transparent 10%, rgba(255,255,255,0.08) 50%, transparent 90%);
  opacity: 0; animation: fadeIn 2s ease 1.2s forwards;
}
@keyframes fadeIn { to { opacity: 1; } }

/* ============================================
   背景树SVG容器
   ============================================ */
#treeContainer {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 10; pointer-events: none;
  opacity: 0; animation: treeIn 3s ease 0.3s forwards;
}
#treeContainer svg { width: 100% !important; height: 100% !important; }
@keyframes treeIn {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ============================================
   落叶动画层
   ============================================ */
#leafFallLayer {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 12; pointer-events: none; overflow: hidden;
}
.falling-leaf {
  position: absolute; top: -40px;
  animation: leafFall linear forwards;
}
@keyframes leafFall {
  0% { transform: translateY(0) translateX(0) rotate(0deg) scale(var(--start-scale, 1)); opacity: 0; }
  3% { opacity: var(--peak-opacity, 0.75); }
  95% { opacity: var(--peak-opacity, 0.75); }
  100% { transform: translateY(100vh) translateX(var(--drift)) rotate(var(--spin)) scale(var(--end-scale, 1)); opacity: 0; }
}

/* ============================================
   中心嫩芽emoji
   ============================================ */
.center-sprout {
  position: fixed; top: 38%; left: 50%;
  transform: translate(-50%,-50%) scale(0);
  z-index: 20; font-size: 5rem; opacity: 0;
  animation: sprout 1.5s cubic-bezier(0.16,1,0.3,1) 1.5s forwards;
  filter: drop-shadow(0 0 25px rgba(76,175,80,0.35));
}
@keyframes sprout {
  from { opacity:0; transform:translate(-50%,-50%) scale(0) rotate(-8deg); }
  to { opacity:1; transform:translate(-50%,-50%) scale(1.4) rotate(0); }
}

/* ============================================
   标题区域
   ============================================ */
.title-area {
  position: fixed; top: 45%; left: 50%; transform: translateX(-50%);
  z-index: 20; text-align: center; opacity: 0;
  animation: fadeIn 1s ease 2s forwards;
}
.title-main {
  font-size: 2.5rem; font-weight: 800; color: #A5D6A7; letter-spacing: 5px;
  text-shadow: 0 0 30px rgba(76,175,80,0.25), 0 0 60px rgba(76,175,80,0.15);
  animation: titleGlow 4s ease-in-out infinite;
}
@keyframes titleGlow {
  0%, 100% { text-shadow: 0 0 30px rgba(76,175,80,0.25), 0 0 60px rgba(76,175,80,0.15); }
  50% { text-shadow: 0 0 35px rgba(76,175,80,0.35), 0 0 70px rgba(76,175,80,0.2); }
}
.title-sub {
  font-size: 0.85rem; color: rgba(200,230,201,0.3); letter-spacing: 8px; margin-top: 6px;
}

/* ============================================
   注册按钮
   ============================================ */
.register-btn-wrapper {
  position: relative;
  margin-top: 20px;
  z-index: 25; 
  opacity: 0; 
  animation: registerBtnIn 0.6s ease 2.6s forwards;
}
@keyframes registerBtnIn {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes registerBtnSlideOut {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(-100vh) scale(0.8); }
}
@keyframes registerBtnSlideIn {
  from { opacity: 0; transform: translateY(-100vh) scale(0.8); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.register-btn {
  padding: 12px 40px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 3px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: rgba(255, 255, 255, 0.9);
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.4) 0%, rgba(255, 152, 0, 0.4) 100%);
  position: relative;
  overflow: hidden;
  outline: none;
  text-shadow: 0 0 12px rgba(255, 255, 255, 0.3);
}

/* 渐变边框 - 使用伪元素实现圆角支持 */
.register-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 8px;
  padding: 2px;
  background: linear-gradient(90deg, #4CAF50 0%, #FF9800 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.register-btn:hover {
  color: #fff;
  transform: translateY(-2px);
  text-shadow: 0 0 15px rgba(255, 255, 255, 0.6);
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.55) 0%, rgba(255, 152, 0, 0.55) 100%);
  box-shadow: 0 4px 20px rgba(76, 175, 80, 0.3), 0 4px 20px rgba(255, 152, 0, 0.3);
}

.register-btn:hover::before {
  background: linear-gradient(90deg, #66BB6A 0%, #FFB74D 100%);
}

@keyframes marqueeBorder {
  0% { background-position: 200% 50%; }
  100% { background-position: -200% 50%; }
}

/* ============================================
   面板容器
   ============================================ */
.panels {
  position: fixed; bottom: 15%; left: 14%; right: 14%;
  z-index: 30; display: flex; justify-content: space-between;
  pointer-events: none; gap: 20px;
}
.panel-wrapper { position: relative; width: 230px; pointer-events: none; }

/* ============================================
   季节标签样式
   ============================================ */
.panel-tag {
  position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
  margin-bottom: 12px; font-size: 1rem; font-weight: 700;
  letter-spacing: 4px; text-transform: uppercase; white-space: nowrap;
  opacity: 0; pointer-events: none;
}

.panel-tag.tag-left {
  animation: tagSlideL 0.8s ease 2.2s forwards;
  background: linear-gradient(90deg, #4CAF50, #FF9800, #4CAF50);
  background-size: 200% 100%;
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 6px rgba(255,255,255,0.15));
}
.panel-tag.tag-left.rgb-glow {
  animation: tagSlideL 0.8s ease 2.2s forwards, rgbFlow 2s linear infinite;
  filter: drop-shadow(0 0 12px rgba(255,255,255,0.4)) drop-shadow(0 0 25px rgba(255,255,255,0.2));
}

.panel-tag.tag-right {
  animation: tagSlideL 0.8s ease 2.4s forwards;
  background: linear-gradient(90deg, #FF9800, #4CAF50, #FF9800);
  background-size: 200% 100%;
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 8px rgba(255,193,7,0.4));
}
.panel-tag.tag-right.tag-animate {
  animation: tagSlideL 0.8s ease 2.2s forwards, rgbFlow 2s linear infinite;
  filter: drop-shadow(0 0 12px rgba(255,255,255,0.4)) drop-shadow(0 0 25px rgba(255,255,255,0.2));
}

@keyframes tagSlideL {
  from { opacity:0; transform:translateX(-50%) translateX(-12px); }
  to { opacity:1; transform:translateX(-50%) translateX(0); }
}

@keyframes rgbFlow {
  0% { background-position: 0% 50%; filter: drop-shadow(0 0 10px rgba(76,175,80,0.7)) drop-shadow(0 0 25px rgba(76,175,80,0.4)); }
  25% { filter: drop-shadow(0 0 10px rgba(255,152,0,0.7)) drop-shadow(0 0 25px rgba(255,152,0,0.4)); }
  50% { background-position: 100% 50%; filter: drop-shadow(0 0 10px rgba(255,80,80,0.7)) drop-shadow(0 0 25px rgba(255,80,80,0.4)); }
  75% { filter: drop-shadow(0 0 10px rgba(100,180,255,0.7)) drop-shadow(0 0 25px rgba(100,180,255,0.4)); }
  100% { background-position: 0% 50%; filter: drop-shadow(0 0 10px rgba(76,175,80,0.7)) drop-shadow(0 0 25px rgba(76,175,80,0.4)); }
}

/* ============================================
   登录面板卡片样式
   ============================================ */
.panel {
  width: 100%; padding: 24px 20px; border-radius: 20px;
  text-align: center; cursor: pointer; pointer-events: auto; opacity: 0;
  backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.07);
}
.panel.s { background: rgba(76,175,80,0.2); animation: pIn 0.7s ease 2.8s forwards; }
.panel.a { background: rgba(255,152,0,0.2); animation: pInR 0.7s ease 3s forwards; }

@keyframes pIn {
  from { opacity:0; transform:translateX(-25px); }
  to { opacity:1; transform:translateX(0); }
}
@keyframes pInR {
  from { opacity:0; transform:translateX(25px); }
  to { opacity:1; transform:translateX(0); }
}

@keyframes panelSlideOutLeft {
  from { opacity: 1; transform: translateX(0) scale(1); }
  to { opacity: 0; transform: translateX(-100vw) scale(0.8); }
}
@keyframes panelSlideOutRight {
  from { opacity: 1; transform: translateX(0) scale(1); }
  to { opacity: 0; transform: translateX(100vw) scale(0.8); }
}
@keyframes panelSlideInLeft {
  from { opacity: 0; transform: translateX(-100vw) scale(0.8); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes panelSlideInRight {
  from { opacity: 0; transform: translateX(100vw) scale(0.8); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}

.panel:hover { transform: translateY(-5px) scale(1.02); }
.panel.s:hover { box-shadow: 0 8px 25px rgba(76,175,80,0.15); border-color: rgba(76,175,80,0.25); }
.panel.a:hover { box-shadow: 0 8px 25px rgba(255,152,0,0.15); border-color: rgba(255,152,0,0.25); }

.panel-icon { font-size: 2.2rem; margin-bottom: 10px; display: block; }
.panel-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 6px; }
.panel-desc { font-size: 0.75rem; line-height: 1.5; margin-bottom: 14px; }
.panel-arrow {
  width: 30px; height: 30px; border-radius: 50%; margin: 0 auto;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; transition: all 0.3s ease;
}

.s .panel-title { color: #A5D6A7; }
.s .panel-desc { color: rgba(165,214,167,0.45); }
.s .panel-arrow { border: 1.5px solid rgba(76,175,80,0.25); color: #4CAF50; }
.s:hover .panel-arrow { border-color: #4CAF50; background: rgba(76,175,80,0.08); }

.a .panel-title { color: #FFCC80; }
.a .panel-desc { color: rgba(255,204,128,0.45); }
.a .panel-arrow { border: 1.5px solid rgba(255,152,0,0.25); color: #FF9800; }
.a:hover .panel-arrow { border-color: #FF9800; background: rgba(255,152,0,0.08); }

/* ============================================
   底部提示文字
   ============================================ */
.hint {
  position: fixed; bottom: 4%; left: 50%; transform: translateX(-50%);
  font-size: 0.65rem; letter-spacing: 3px; z-index: 40;
  color: rgba(255,255,255,0.12); opacity: 0;
  animation: fadeIn 0.8s ease 3.5s forwards;
}

/* ============================================
   登录表单弹窗
   ============================================ */
.login-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 60; display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.login-overlay.active { pointer-events: auto; }

/* 登录表单从下方滑入 */
.login-card {
  position: relative; width: 380px; max-width: 90vw;
  padding: 40px 36px; border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  transform: translateY(100vh);
  transition: transform 0.6s cubic-bezier(0.16,1,0.3,1);
}
.login-overlay.active .login-card { transform: translateY(0); }

/* 注册表单从上方滑入 */
.login-overlay#loginRegister .login-card {
  transform: translateY(-100vh) scale(1);
}
.login-overlay#loginRegister.active .login-card {
  transform: translateY(0) scale(1);
}

.login-card.user-card {
  background: rgba(13,26,10,0.92);
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 50px rgba(76,175,80,0.15);
  border-color: rgba(76,175,80,0.2);
}
.login-card.admin-card {
  background: rgba(26,18,8,0.92);
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 50px rgba(255,152,0,0.15);
  border-color: rgba(255,152,0,0.2);
}
.login-card.register-card {
  background: rgba(13,20,10,0.95);
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 50px rgba(76,175,80,0.12), 0 0 50px rgba(255,152,0,0.08);
  border: 1px solid rgba(76,175,80,0.15);
  position: relative;
}

/* 注册表单跑马灯边框 */
.login-card.register-card::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 22px;
  background: linear-gradient(90deg, transparent, #FFD700, #4CAF50, transparent);
  background-size: 200% 100%;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: marqueeBorder 4s linear infinite;
  padding: 2px;
  pointer-events: none;
}

.login-card h2 {
  font-size: 1.5rem; font-weight: 800; margin-bottom: 6px; text-align: center;
}
.user-card h2 { color: #A5D6A7; }
.admin-card h2 { color: #FFCC80; }
.register-card h2 { color: #A5D6A7; }

.login-card .login-sub {
  font-size: 0.75rem; text-align: center; margin-bottom: 28px; letter-spacing: 2px;
}
.user-card .login-sub { color: rgba(165,214,167,0.4); }
.admin-card .login-sub { color: rgba(255,204,128,0.4); }
.register-card .login-sub { color: rgba(200,230,201,0.5); }

.form-group { margin-bottom: 22px; }
.form-group label {
  display: block; font-size: 0.85rem; font-weight: 700;
  margin-bottom: 10px; padding-left: 2px; letter-spacing: 1px;
}
.user-card label, .register-card label { color: #A5D6A7; }
.admin-card label { color: #FFCC80; }

.form-group input {
  width: 100%; padding: 12px 16px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);
  color: #e0e0e0; font-size: 0.9rem; outline: none;
  transition: all 0.3s ease;
}
.form-group input:focus {
  border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.06);
}
.user-card input:focus, .register-card input:focus {
  border-color: rgba(76,175,80,0.4); box-shadow: 0 0 15px rgba(76,175,80,0.1);
}
.admin-card input:focus {
  border-color: rgba(255,152,0,0.4); box-shadow: 0 0 15px rgba(255,152,0,0.1);
}

.login-btn {
  width: 100%; padding: 13px; border: none; border-radius: 10px;
  font-size: 0.95rem; font-weight: 700; cursor: pointer;
  letter-spacing: 2px; margin-top: 8px; transition: all 0.3s ease;
}
.user-card .login-btn { background: rgba(76,175,80,0.2); color: #A5D6A7; border: 1px solid rgba(76,175,80,0.25); }
.user-card .login-btn:hover { background: rgba(76,175,80,0.35); box-shadow: 0 4px 20px rgba(76,175,80,0.2); }
.admin-card .login-btn { background: rgba(255,152,0,0.2); color: #FFCC80; border: 1px solid rgba(255,152,0,0.25); }
.admin-card .login-btn:hover { background: rgba(255,152,0,0.35); box-shadow: 0 4px 20px rgba(255,152,0,0.2); }
.register-card .login-btn { background: rgba(76,175,80,0.2); color: #A5D6A7; border: 1px solid rgba(76,175,80,0.25); }
.register-card .login-btn:hover { background: rgba(76,175,80,0.35); box-shadow: 0 4px 20px rgba(76,175,80,0.2); }

.back-btn {
  display: block; width: 100%; padding: 10px; margin-top: 12px;
  border-radius: 10px; background: transparent;
  border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.4);
  font-size: 0.8rem; letter-spacing: 1px; cursor: pointer;
  transition: all 0.3s ease;
}
.back-btn:hover {
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7);
  border-color: rgba(255,255,255,0.15);
}

/* ============================================
   响应式适配
   ============================================ */

/* 中等屏幕：平板/小屏电脑 */
@media (max-width: 900px) {
  .center-sprout { font-size: 4rem; top: 36%; }
  .title-main { font-size: 2rem; letter-spacing: 4px; }
  .title-sub { font-size: 0.75rem; letter-spacing: 6px; }
  .register-btn-wrapper { margin-top: 16px; }
  .register-btn { padding: 8px 20px; font-size: 0.75rem; }
  .panels { bottom: 12%; left: 8%; right: 8%; gap: 12px; }
  .panel-wrapper { width: calc(50% - 6px); }
  .panel { padding: 18px 14px; }
  .panel-icon { font-size: 1.6rem; margin-bottom: 8px; }
  .panel-title { font-size: 0.95rem; }
  .panel-desc { font-size: 0.7rem; margin-bottom: 10px; }
  .panel-arrow { width: 26px; height: 26px; font-size: 0.75rem; }
  .panel-tag { font-size: 0.9rem; letter-spacing: 3px; margin-bottom: 8px; }
  
  /* 表单响应式 */
  .login-card { width: 340px; padding: 32px 28px; }
  .login-card h2 { font-size: 1.3rem; }
  .form-group { margin-bottom: 18px; }
  .form-group label { font-size: 0.8rem; }
  .form-group input { padding: 10px 14px; font-size: 0.85rem; }
  .login-btn { padding: 11px; font-size: 0.9rem; }
}

/* 窄屏幕：大屏手机 */
@media (max-width: 650px) {
  .center-sprout { font-size: 3rem; top: 34%; }
  .title-main { font-size: 1.5rem; letter-spacing: 3px; }
  .title-sub { font-size: 0.65rem; letter-spacing: 5px; }
  .register-btn-wrapper { margin-top: 12px; }
  .register-btn { padding: 7px 16px; font-size: 0.7rem; }
  .panels { bottom: 10%; left: 5%; right: 5%; gap: 8px; }
  .panel-wrapper { width: calc(50% - 4px); }
  .panel { padding: 14px 10px; border-radius: 16px; }
  .panel-icon { font-size: 1.3rem; margin-bottom: 6px; }
  .panel-title { font-size: 0.8rem; }
  .panel-desc { font-size: 0.6rem; margin-bottom: 8px; line-height: 1.3; }
  .panel-arrow { width: 22px; height: 22px; font-size: 0.65rem; }
  .panel-tag { font-size: 0.8rem; letter-spacing: 2px; margin-bottom: 6px; }
  .hint { font-size: 0.55rem; bottom: 3%; }
  
  /* 表单响应式 */
  .login-card { width: 300px; padding: 26px 22px; }
  .login-card h2 { font-size: 1.2rem; }
  .login-card .login-sub { font-size: 0.7rem; margin-bottom: 22px; }
  .form-group { margin-bottom: 16px; }
  .form-group label { font-size: 0.75rem; margin-bottom: 8px; }
  .form-group input { padding: 9px 12px; font-size: 0.8rem; }
  .login-btn { padding: 10px; font-size: 0.85rem; }
  .back-btn { padding: 8px; font-size: 0.75rem; }
}

/* ============================================
   管理员考验门样式
   ============================================ */
.gate-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 60; display: flex; align-items: center; justify-content: center;
}
.gate-card {
  background: rgba(10, 5, 5, 0.95);
  border: 2px solid rgba(255, 60, 60, 0.4);
  border-radius: 20px;
  padding: 40px 36px;
  width: 380px; max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,60,60,0.1);
  animation: gateSlideIn 0.4s cubic-bezier(0.16,1,0.3,1);
}
@keyframes gateSlideIn {
  from { opacity: 0; transform: scale(0.9) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.gate-card h2 {
  text-align: center; font-size: 1.5rem; font-weight: 800;
  color: #ff6b6b; margin-bottom: 6px;
}
.gate-sub {
  text-align: center; font-size: 0.75rem; color: rgba(255,120,120,0.5);
  margin-bottom: 28px; letter-spacing: 2px;
}
.gate-card label { color: #ff9999; }
.gate-card input {
  width: 100%; padding: 12px 16px; border-radius: 10px;
  border: 1px solid rgba(255,60,60,0.2); background: rgba(60,10,10,0.4);
  color: #e0e0e0; font-size: 0.9rem; outline: none;
  transition: all 0.3s ease;
}
.gate-card input:focus {
  border-color: rgba(255,60,60,0.5); box-shadow: 0 0 15px rgba(255,60,60,0.15);
}
.gate-btn {
  background: rgba(255,60,60,0.2) !important; color: #ff9999 !important;
  border: 1px solid rgba(255,60,60,0.3) !important;
}
.gate-btn:hover {
  background: rgba(255,60,60,0.35) !important;
  box-shadow: 0 4px 20px rgba(255,60,60,0.2) !important;
}

/* 超窄屏幕：小屏手机 */
@media (max-width: 400px) {
  .center-sprout { font-size: 2.2rem; top: 30%; }
  .title-area { top: 40%; }
  .title-main { font-size: 1.2rem; letter-spacing: 2px; }
  .title-sub { font-size: 0.55rem; letter-spacing: 4px; }
  .register-btn-wrapper { margin-top: 10px; }
  .register-btn { padding: 6px 14px; font-size: 0.65rem; }
  .panels { bottom: 8%; left: 4%; right: 4%; gap: 6px; }
  .panel-wrapper { width: calc(50% - 3px); }
  .panel { padding: 10px 6px; border-radius: 14px; }
  .panel-icon { font-size: 1rem; margin-bottom: 4px; }
  .panel-title { font-size: 0.7rem; margin-bottom: 2px; }
  .panel-desc { font-size: 0.5rem; margin-bottom: 6px; line-height: 1.2; }
  .panel-arrow { width: 20px; height: 20px; font-size: 0.55rem; }
  .panel-tag { font-size: 0.5rem; letter-spacing: 2px; margin-bottom: 4px; }
  .hint { font-size: 0.45rem; bottom: 2%; }
  
  /* 表单响应式 - 重要调整 */
  .login-card { 
    width: calc(100vw - 32px); 
    max-width: 320px; 
    padding: 20px 16px; 
    margin: 0 16px;
    transform-origin: center center;
  }
  /* 登录表单从下方滑入并缩小至80% */
  .login-overlay:not(#loginRegister) .login-card {
    transform: translateY(100vh) scale(0.8);
  }
  .login-overlay:not(#loginRegister).active .login-card {
    transform: translateY(0) scale(0.8);
  }
  /* 注册表单从上方滑入并缩小至80% */
  .login-overlay#loginRegister .login-card {
    transform: translateY(-100vh) scale(0.8);
  }
  .login-overlay#loginRegister.active .login-card {
    transform: translateY(0) scale(0.8);
  }
  .login-card h2 { font-size: 1.1rem; }
  .login-card .login-sub { font-size: 0.65rem; margin-bottom: 18px; }
  .form-group { margin-bottom: 14px; }
  .form-group label { font-size: 0.7rem; margin-bottom: 6px; }
  .form-group input { padding: 8px 10px; font-size: 0.75rem; }
  .login-btn { padding: 9px; font-size: 0.8rem; }
  .back-btn { padding: 7px; font-size: 0.7rem; margin-top: 10px; }
}
</style>

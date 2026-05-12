<template>
    <div class="app">
        <!-- 右上角用户信息（登录/注册页面除外，User 页面除外，管理端页面除外） -->
        <div 
            v-if="!isAuthPage && !isAdminPage && $route.path !== '/dashboard/user'" 
            class="user-info"
            :class="{ 'dragging': isUserInfoDragging }"
            :style="userInfoStyle"
        >
            <span class="username">🌱 {{ userStore.username }}</span>
            <span class="points">⭐ {{ userStore.totalPoints }} 积分</span>
            <div class="user-info-drag-handle" @mousedown="startUserInfoDrag" @touchstart="startUserInfoDrag">
                <span>⠿</span>
            </div>
        </div>
        <!-- 路由视图 -->
        <main class="main-content">
            <router-view />
        </main>

        <!-- 移动端底部导航栏（登录/注册页面除外，管理端页面除外） -->
        <nav v-if="!isAuthPage && !isAdminPage" class="bottom-nav" :class="{ 'hidden': !isMobile }">
            <router-link to="/dashboard/garden">🌱 花园</router-link>
            <router-link to="/dashboard/shop">🛒 商城</router-link>
            <router-link to="/dashboard/backpack">🎒 背包</router-link>
            <router-link to="/dashboard/orders">📋 订单</router-link>
            <router-link to="/dashboard/user">👤 我的</router-link>
        </nav>

        <!-- 平板/PC 端悬浮胶囊导航栏（登录/注册页面除外，管理端页面除外） -->
        <nav 
            v-if="!isAuthPage && !isAdminPage" 
            class="floating-nav" 
            :class="{ 'visible': !isMobile, 'dragging': isDragging }"
            :style="navStyle"
        >
            <div class="nav-capsule">
                <router-link to="/dashboard/garden" class="nav-item" :class="{ active: $route.path === '/dashboard/garden' }">
                    <span class="nav-icon">🌱</span>
                    <span class="nav-label">花园</span>
                </router-link>
                <router-link to="/dashboard/shop" class="nav-item" :class="{ active: $route.path === '/dashboard/shop' }">
                    <span class="nav-icon">🛒</span>
                    <span class="nav-label">商城</span>
                </router-link>
                <router-link to="/dashboard/backpack" class="nav-item" :class="{ active: $route.path === '/dashboard/backpack' }">
                    <span class="nav-icon">🎒</span>
                    <span class="nav-label">背包</span>
                </router-link>
                <router-link to="/dashboard/orders" class="nav-item" :class="{ active: $route.path === '/dashboard/orders' }">
                    <span class="nav-icon">📋</span>
                    <span class="nav-label">订单</span>
                </router-link>
                <router-link to="/dashboard/user" class="nav-item" :class="{ active: $route.path === '/dashboard/user' }">
                    <span class="nav-icon">👤</span>
                    <span class="nav-label">我的</span>
                </router-link>
            </div>
            <div class="drag-handle" @mousedown="startDrag" @touchstart="startDrag">
                <span class="drag-icon">⠿</span>
            </div>
        </nav>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const route = useRoute()
const userStore = useUserStore()

// 响应式判断是否为移动端
const isMobile = ref(window.innerWidth < 768)

// 判断是否为登录/注册页面（包含登录选择页面）
const isAuthPage = computed(() => {
    return route.path === '/' || route.path === '/login' || route.path === '/register'
})

// 判断是否为管理端页面
const isAdminPage = computed(() => {
    return route.path.startsWith('/admin')
})

const handleResize = () => {
    isMobile.value = window.innerWidth < 768
}

// 悬浮导航拖动相关状态
const isDragging = ref(false)
const navPosition = ref({ x: 20, y: 100 })
const navDragOffset = ref({ x: 0, y: 0 })

const navStyle = computed(() => ({
    left: `${navPosition.value.x}px`,
    top: `${navPosition.value.y}px`
}))

const startDrag = (e) => {
    e.stopPropagation()
    isDragging.value = true
    const touch = e.touches ? e.touches[0] : e
    navDragOffset.value = {
        x: touch.clientX - navPosition.value.x,
        y: touch.clientY - navPosition.value.y
    }
    document.addEventListener('mousemove', onNavDrag)
    document.addEventListener('mouseup', stopNavDrag)
    document.addEventListener('touchmove', onNavDrag)
    document.addEventListener('touchend', stopNavDrag)
}

const onNavDrag = (e) => {
    if (!isDragging.value) return
    const touch = e.touches ? e.touches[0] : e
    const newX = touch.clientX - navDragOffset.value.x
    const newY = touch.clientY - navDragOffset.value.y
    
    navPosition.value = {
        x: Math.max(0, Math.min(newX, window.innerWidth - 400)),
        y: Math.max(0, Math.min(newY, window.innerHeight - 80))
    }
}

const stopNavDrag = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onNavDrag)
    document.removeEventListener('mouseup', stopNavDrag)
    document.removeEventListener('touchmove', onNavDrag)
    document.removeEventListener('touchend', stopNavDrag)
}

// 用户信息拖动相关状态
const isUserInfoDragging = ref(false)
const userInfoPosition = ref({ x: 20, y: 16 })
const userInfoDragOffset = ref({ x: 0, y: 0 })

const userInfoStyle = computed(() => ({
    right: `${userInfoPosition.value.x}px`,
    top: `${userInfoPosition.value.y}px`
}))

const startUserInfoDrag = (e) => {
    e.stopPropagation()
    isUserInfoDragging.value = true
    const touch = e.touches ? e.touches[0] : e
    userInfoDragOffset.value = {
        x: window.innerWidth - touch.clientX - userInfoPosition.value.x,
        y: touch.clientY - userInfoPosition.value.y
    }
    document.addEventListener('mousemove', onUserInfoDrag)
    document.addEventListener('mouseup', stopUserInfoDrag)
    document.addEventListener('touchmove', onUserInfoDrag)
    document.addEventListener('touchend', stopUserInfoDrag)
}

const onUserInfoDrag = (e) => {
    if (!isUserInfoDragging.value) return
    const touch = e.touches ? e.touches[0] : e
    const newX = window.innerWidth - touch.clientX - userInfoDragOffset.value.x
    const newY = touch.clientY - userInfoDragOffset.value.y
    
    userInfoPosition.value = {
        x: Math.max(0, Math.min(newX, window.innerWidth - 200)),
        y: Math.max(0, Math.min(newY, window.innerHeight - 60))
    }
}

const stopUserInfoDrag = () => {
    isUserInfoDragging.value = false
    document.removeEventListener('mousemove', onUserInfoDrag)
    document.removeEventListener('mouseup', stopUserInfoDrag)
    document.removeEventListener('touchmove', onUserInfoDrag)
    document.removeEventListener('touchend', stopUserInfoDrag)
}

onMounted(async () => {
    window.addEventListener('resize', handleResize)
    // 加载用户信息
    try {
        await userStore.loadFromLocal()
    } catch (error) {
        console.error('Failed to load user data in Navbar:', error)
    }
})

onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    document.removeEventListener('mousemove', onNavDrag)
    document.removeEventListener('mouseup', stopNavDrag)
    document.removeEventListener('touchmove', onNavDrag)
    document.removeEventListener('touchend', stopNavDrag)
    document.removeEventListener('mousemove', onUserInfoDrag)
    document.removeEventListener('mouseup', stopUserInfoDrag)
    document.removeEventListener('touchmove', onUserInfoDrag)
    document.removeEventListener('touchend', stopUserInfoDrag)
})

</script>

<style>


.app {
    min-height: 100vh;
    position: relative;
    background: transparent;
    overflow-y: visible;
}

.main-content {
    min-height: 100vh;
    width: 100%;
    overflow-y: visible;
}

/* ========== 移动端底部导航栏样式 ========== */
.bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-around;
    align-items: center;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    padding: 10px 8px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
    z-index: 1000;
    transition: transform 0.3s ease;
    min-height: 60px;
}

.bottom-nav a {
    text-decoration: none;
    font-size: 0.85rem;
    font-weight: 500;
    color: #999;
    padding: 8px 12px;
    border-radius: 30px;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    flex: 1;
    min-width: 60px;
    max-width: 80px;
    height: 44px;
}

.bottom-nav a.router-link-active {
    color: #4caf50;
    background: rgba(76, 175, 80, 0.12);
}

.bottom-nav a:active {
    transform: scale(0.95);
}

.bottom-nav a span:first-child {
    font-size: 1.2rem;
    line-height: 1;
}

.bottom-nav a span:last-child {
    font-size: 0.7rem;
    line-height: 1;
}

/* 移动端隐藏悬浮导航 */
.bottom-nav.hidden {
    display: none;
}

/* ========== 平板/PC 端悬浮胶囊导航栏 ========== */
.floating-nav {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease, transform 0.1s ease;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}

.floating-nav.visible {
    opacity: 1;
    visibility: visible;
}

.floating-nav.dragging {
    cursor: grabbing;
    opacity: 0.9;
    transform: scale(1.02);
}

.nav-capsule {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(15px);
    padding: 12px 10px;
    border-radius: 40px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.5);
    transition: all 0.2s ease;
}

.nav-capsule:hover {
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.12);
}

.drag-handle {
    position: absolute;
    top: 50%;
    right: -28px;
    transform: translateY(-50%);
    width: 28px;
    height: 60px;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(76, 175, 80, 0.3));
    border-radius: 0 12px 12px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 12px;
    color: #4caf50;
    cursor: grab;
    opacity: 0.7;
    transition: all 0.2s ease;
    border: 1px solid rgba(76, 175, 80, 0.3);
    border-left: none;
    box-shadow: 2px 2px 8px rgba(76, 175, 80, 0.2);
}

.drag-handle:hover {
    opacity: 1;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(76, 175, 80, 0.4));
    box-shadow: 3px 3px 12px rgba(76, 175, 80, 0.3);
}

.drag-handle .drag-icon {
    font-size: 14px;
}

.drag-handle .drag-text {
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.5px;
}

.floating-nav.dragging .drag-handle {
    cursor: grabbing;
    opacity: 1;
}

/* 竖向布局的导航项 */
.nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 12px;
    border-radius: 30px;
    text-decoration: none;
    color: #555;
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
    /* 固定最小宽度，让所有项大小一致 */
    min-width: 60px;
}

.nav-icon {
    font-size: 1.3rem;
    flex-shrink: 0;
    transition: transform 0.2s ease;
}

.nav-label {
    font-size: 0.7rem;
    opacity: 0.8;
    white-space: nowrap;
}

/* hover 效果 - 轻微上浮和变色 */
.nav-item:hover {
    background: rgba(76, 175, 80, 0.12);
    color: #4caf50;
    transform: translateY(-2px);
}

.nav-item:hover .nav-icon {
    transform: scale(1.05);
}

/* 选中状态 */
.nav-item.active {
    background: #4caf50;
    color: white;
}

.nav-item.active .nav-icon {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.nav-item.active .nav-label {
    opacity: 1;
    font-weight: 500;
}

/* 选中状态下 hover 保持原有样式 */
.nav-item.active:hover {
    background: #4caf50;
    color: white;
    transform: translateY(-2px);
}

/* 用户信息悬浮窗 */
.user-info {
    position: fixed;
    top: 16px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(12px);
    padding: 8px 20px;
    padding-right: 48px;
    border-radius: 40px;
    z-index: 1001;
    font-weight: bold;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.5);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    min-width: 200px;
    max-width: 220px;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
}

.user-info:hover {
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.user-info.dragging {
    cursor: grabbing;
    transform: scale(1.02);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.user-info-drag-handle {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 36px;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.25));
    border-radius: 0 40px 40px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #4caf50;
    cursor: grab;
    opacity: 0.6;
    transition: all 0.2s ease;
    border-left: 1px solid rgba(76, 175, 80, 0.2);
}

.user-info-drag-handle:hover {
    opacity: 1;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.25), rgba(76, 175, 80, 0.35));
}

.user-info.dragging .user-info-drag-handle {
    cursor: grabbing;
    opacity: 1;
}

.username {
    color: #2c5a2a;
}

.points {
    color: #ff9800;
    margin-top: -10px;
}

/* ========== 深色模式适配 ========== */
@media (prefers-color-scheme: dark) {
    .bottom-nav {
        background: rgba(30, 30, 35, 0.95);
        border-top-color: rgba(255, 255, 255, 0.08);
    }

    .bottom-nav a {
        color: #aaa;
    }

    .bottom-nav a.router-link-active {
        color: #8bc34a;
        background: rgba(139, 195, 74, 0.15);
    }
    
    .bottom-nav a span:last-child {
        color: inherit;
    }

    .nav-capsule {
        background: rgba(30, 30, 35, 0.85);
        border-color: rgba(255, 255, 255, 0.1);
    }

    .nav-capsule:hover {
        background: rgba(40, 40, 45, 0.95);
    }

    .nav-item {
        color: #ccc;
    }

    .nav-item:hover {
        background: rgba(139, 195, 74, 0.15);
        color: #9ccc65;
    }

    .nav-item.active {
        background: #4a4a4f;
        color: #9ccc65;
    }

    .nav-item.active .nav-icon {
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    }

    .nav-item.active:hover {
        background: #4a4a4f;
        color: #9ccc65;
    }
}

/* ========== 响应式断点 ========== */
/* 极窄屏（<385px）：只显示图标，隐藏文字 */
@media (max-width: 384px) {
    .bottom-nav a {
        min-width: 48px;
        max-width: 56px;
        height: 40px;
        padding: 6px 8px;
    }
    
    .bottom-nav a span:last-child {
        display: none;
    }
    
    .bottom-nav a span:first-child {
        font-size: 1.3rem;
    }
    
    .user-info {
        display: none;
    }
}

/* 移动端（385px - 767px） */
@media (min-width: 385px) and (max-width: 767px) {
    .bottom-nav {
        display: flex;
    }

    .floating-nav {
        display: none;
    }
}

/* 平板端（768px - 1023px）和 PC 端（≥1024px）统一使用悬浮导航 */
@media (min-width: 768px) {
    .bottom-nav {
        display: none;
    }

    .floating-nav {
        display: block;
    }
}

/* 平板端微调 */
@media (min-width: 768px) and (max-width: 1023px) {
    .nav-capsule {
        gap: 6px;
        padding: 10px 8px;
    }

    .nav-item {
        min-width: 50px;
        padding: 6px 10px;
    }

    .nav-icon {
        font-size: 1.1rem;
    }

    .nav-label {
        font-size: 0.65rem;
    }
}

/* 大屏幕 PC 端 */
@media (min-width: 1024px) {
    .nav-capsule {
        gap: 10px;
        padding: 14px 12px;
    }

    .nav-item {
        min-width: 70px;
        padding: 10px 14px;
    }

    .nav-icon {
        font-size: 1.5rem;
    }

    .nav-label {
        font-size: 0.75rem;
    }
}
</style>
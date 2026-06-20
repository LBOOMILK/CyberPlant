<template>
    <div class="app">
        <!-- 顶部信息栏已移除，改为悬浮窗显示 -->

        <!-- 路由视图 -->
        <main class="main-content" :class="{ 'no-topbar': isAuthPage || isAdminPage }">
            <router-view v-slot="{ Component }">
                <transition name="page-fade" mode="out-in">
                    <component :is="Component" />
                </transition>
            </router-view>
        </main>

        <!-- 移动端底部导航栏 -->
        <nav v-if="!isAuthPage && !isAdminPage" class="bottom-nav">
            <router-link to="/dashboard/garden" class="nav-link">
                <span class="nav-emoji">🌱</span>
                <span class="nav-text">花园</span>
            </router-link>
            <router-link to="/dashboard/shop" class="nav-link">
                <span class="nav-emoji">🛒</span>
                <span class="nav-text">商店</span>
            </router-link>
            <router-link to="/dashboard/backpack" class="nav-link">
                <span class="nav-emoji">🎒</span>
                <span class="nav-text">背包</span>
            </router-link>
            <router-link to="/dashboard/friends" class="nav-link">
                <span class="nav-emoji">👥</span>
                <span class="nav-text">好友</span>
                <span v-if="friendStore.pendingRequests.length > 0" class="badge">{{ friendStore.pendingRequests.length }}</span>
            </router-link>
            <router-link to="/dashboard/pets" class="nav-link">
                <span class="nav-emoji">🐾</span>
                <span class="nav-text">宠物</span>
            </router-link>
            <router-link to="/dashboard/orders" class="nav-link">
                <span class="nav-emoji">📋</span>
                <span class="nav-text">订单</span>
            </router-link>
            <router-link to="/dashboard/user" class="nav-link">
                <span class="nav-emoji">👤</span>
                <span class="nav-text">个人</span>
            </router-link>
        </nav>

        <!-- 宠物悬浮组件（合并用户信息和货币） -->
        <PetFloating />

        <!-- 平板/PC 端悬浮胶囊导航栏 -->
        <nav
            v-if="!isAuthPage && !isAdminPage"
            class="floating-nav"
            :class="{ visible: !isMobile, dragging: isDragging }"
            :style="navStyle"
        >
            <div class="nav-capsule">
                <router-link to="/dashboard/garden" class="nav-item" :class="{ active: $route.path === '/dashboard/garden' }">
                    <span class="nav-icon">🌱</span>
                    <span class="nav-label">花园</span>
                </router-link>
                <router-link to="/dashboard/shop" class="nav-item" :class="{ active: $route.path === '/dashboard/shop' }">
                    <span class="nav-icon">🛒</span>
                    <span class="nav-label">商店</span>
                </router-link>
                <router-link to="/dashboard/backpack" class="nav-item" :class="{ active: $route.path === '/dashboard/backpack' }">
                    <span class="nav-icon">🎒</span>
                    <span class="nav-label">背包</span>
                </router-link>
                <router-link to="/dashboard/friends" class="nav-item" :class="{ active: $route.path === '/dashboard/friends' }">
                    <span class="nav-icon">👥</span>
                    <span class="nav-label">好友</span>
                    <span v-if="friendStore.pendingRequests.length > 0" class="badge">{{ friendStore.pendingRequests.length }}</span>
                </router-link>
                <router-link to="/dashboard/pets" class="nav-item" :class="{ active: $route.path === '/dashboard/pets' }">
                    <span class="nav-icon">🐾</span>
                    <span class="nav-label">宠物</span>
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

        <!-- 新手欢迎弹窗（仅在用户仪表盘页面显示） -->
        <WelcomeModal
            v-if="isDashboardPage"
            :visible="showWelcome"
            @close="showWelcome = false"
        />
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useFriendStore } from '@/stores/friendStore'
import PetFloating from './user/PetFloating.vue'
import WelcomeModal from './user/WelcomeModal.vue'

const route = useRoute()
const userStore = useUserStore()
const friendStore = useFriendStore()

// 新手欢迎
const showWelcome = ref(false)

// 判断是否为登录页面
const isAuthPage = computed(() => {
    return route.path === '/' || route.path === '/login'
})

// 判断是否为管理端页面
const isAdminPage = computed(() => {
    return route.path.startsWith('/admin')
})

// 判断是否为用户仪表盘页面
const isDashboardPage = computed(() => {
    return route.path.startsWith('/dashboard')
})

// 悬浮导航拖动相关状态
const isDragging = ref(false)
const hasDragged = ref(false) // 是否真正拖拽过（移动距离超过阈值）
const dragStartPosition = ref({ x: 0, y: 0 })
const navPosition = ref({ x: 20, y: 100 })
const navDragOffset = ref({ x: 0, y: 0 })

const handleResize = () => {
  // 响应式处理
}

const navStyle = computed(() => ({
    left: `${navPosition.value.x}px`,
    top: `${navPosition.value.y}px`
}))

const startDrag = (e) => {
    e.stopPropagation()
    if (e.cancelable) e.preventDefault()
    isDragging.value = true
    hasDragged.value = false
    const touch = e.touches ? e.touches[0] : e
    dragStartPosition.value = { x: touch.clientX, y: touch.clientY }
    navDragOffset.value = {
        x: touch.clientX - navPosition.value.x,
        y: touch.clientY - navPosition.value.y
    }
    document.addEventListener('mousemove', onNavDrag)
    document.addEventListener('mouseup', stopNavDrag)
    document.addEventListener('touchmove', onNavDrag, { passive: false })
    document.addEventListener('touchend', stopNavDrag)
}

const onNavDrag = (e) => {
    if (!isDragging.value) return
    if (e.cancelable) e.preventDefault()
    const touch = e.touches ? e.touches[0] : e
    // 检查是否真正拖拽（移动距离超过5px）
    const moveDistance = Math.abs(touch.clientX - dragStartPosition.value.x) + Math.abs(touch.clientY - dragStartPosition.value.y)
    if (moveDistance > 5) {
        hasDragged.value = true
    }
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

onMounted(async () => {
    window.addEventListener('resize', handleResize)
    try {
        await userStore.loadFromLocal()
        // 加载好友请求（用于红点显示）
        try {
            await friendStore.loadFriends()
        } catch (e) {
            // 好友加载失败不影响主流程
        }
        // 检查新手状态（仅在用户仪表盘页面弹出）
        if (userStore.isNewUser && isDashboardPage.value) {
            showWelcome.value = true
        }
    } catch (error) {
        console.error('Failed to load user data in Navbar:', error)
    }
})

// 路由变化时检查是否需要弹出新手欢迎
watch(isDashboardPage, async (onDash) => {
    if (onDash && !showWelcome.value) {
        try {
            await userStore.loadFromLocal()
            if (userStore.isNewUser) {
                showWelcome.value = true
            }
        } catch (e) {
            // ignore
        }
    }
})

onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    document.removeEventListener('mousemove', onNavDrag)
    document.removeEventListener('mouseup', stopNavDrag)
    document.removeEventListener('touchmove', onNavDrag)
    document.removeEventListener('touchend', stopNavDrag)
})
</script>

<style>
/* 全局样式重置 */
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

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
    padding-top: 0; /* 移除顶部栏高度 */
}

.main-content.no-topbar {
    padding-top: 0;
}

/* 移动端：topbar 高度为 44px，主内容下移避免遮挡 */
@media (max-width: 767px) {
    .main-content:not(.no-topbar) {
        padding-top: 44px;
    }
    .bottom-nav {
        bottom: 0;
    }
}

/* 页面过渡动画 */
.page-fade-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.page-fade-leave-active { transition: opacity 0.15s ease; }
.page-fade-enter-from { opacity: 0; transform: translateY(8px); }
.page-fade-leave-to { opacity: 0; }

/* ========== 移动端底部导航栏 ========== */
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
    transition: transform 0.3s ease, height 0.3s ease;
    min-height: 60px;
}

.nav-link {
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
    position: relative;
}

.nav-link.router-link-active {
    color: #4caf50;
    background: rgba(76, 175, 80, 0.12);
}

.nav-link:active {
    transform: scale(0.95);
}

.nav-emoji {
    font-size: 1.2rem;
    line-height: 1;
}

.nav-text {
    font-size: 0.7rem;
    line-height: 1;
}

/* 红点徽章 */
.badge {
    position: absolute;
    top: 2px;
    right: 6px;
    min-width: 16px;
    height: 16px;
    background: #f44336;
    color: white;
    font-size: 0.6rem;
    font-weight: 700;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    box-shadow: 0 1px 4px rgba(244, 67, 54, 0.4);
    animation: badgePop 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

@keyframes badgePop {
    from { transform: scale(0); }
    to { transform: scale(1); }
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
    user-select: none;
}

.floating-nav.visible {
    opacity: 1;
    visibility: visible;
}

.floating-nav.dragging {
    opacity: 0.9;
    transform: scale(1.02);
}

.floating-nav.dragging .nav-item {
    pointer-events: none; /* 拖拽时禁止点击导航项 */
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
    cursor: default; /* 导航胶囊默认cursor */
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
    font-size: 12px;
    color: #4caf50;
    cursor: grab; /* 只有拖拽手柄是grab */
    opacity: 0.7;
    transition: all 0.2s ease;
    border: 1px solid rgba(76, 175, 80, 0.3);
    border-left: none;
    z-index: 10; /* 确保拖拽手柄在最上层 */
}

.drag-handle:hover {
    opacity: 1;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.3), rgba(76, 175, 80, 0.4));
}

.drag-handle:active {
    cursor: grabbing;
}

.floating-nav.dragging .drag-handle {
    opacity: 1;
}

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
    min-width: 60px;
    position: relative;
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

.nav-item:hover {
    background: rgba(76, 175, 80, 0.12);
    color: #4caf50;
    transform: translateY(-2px);
}

.nav-item:hover .nav-icon {
    transform: scale(1.05);
}

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

.nav-item.active:hover {
    background: #4caf50;
    color: white;
    transform: translateY(-2px);
}

/* 浮动导航上的 badge 位置调整 */
.floating-nav .badge {
    top: 0;
    right: 2px;
}

/* ========== 深色模式适配 ========== */
@media (prefers-color-scheme: dark) {
    .bottom-nav {
        background: rgba(30, 30, 35, 0.95);
        border-top-color: rgba(255, 255, 255, 0.08);
    }

    .nav-link {
        color: #aaa;
    }

    .nav-link.router-link-active {
        color: #8bc34a;
        background: rgba(139, 195, 74, 0.15);
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

    .nav-item.active:hover {
        background: #4a4a4f;
        color: #9ccc65;
    }
}

/* ========== 响应式断点 ========== */
@media (max-width: 384px) {
    .nav-link {
        min-width: 48px;
        max-width: 56px;
        height: 40px;
        padding: 6px 8px;
    }

    .nav-text {
        display: none;
    }

    .nav-emoji {
        font-size: 1.3rem;
    }

    .floating-nav {
        display: none;
    }
}

@media (min-width: 385px) and (max-width: 767px) {
    .bottom-nav {
        display: flex;
    }

    .floating-nav {
        display: none;
    }
}

@media (min-width: 768px) {
    .bottom-nav {
        display: none;
    }

    .floating-nav {
        display: block;
    }
}

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

<template>
    <div class="garden-page">
        <!-- 右上角提示容器 -->
        <Toast ref="toastRef" />

        <!-- 主卡片 -->
        <div class="card">
            <h1>🌱 赛博花园</h1>

            <!-- 无植物状态 -->
            <div v-if="!hasPlant" class="empty-state">
                <div class="empty-emoji">🌾</div>
                <p class="empty-text">还没有植物呢</p>
                <p class="empty-hint">点击「种植」按钮开始你的花园之旅</p>
            </div>

            <!-- 有植物状态 -->
            <div v-else>
                <div class="plant-emoji">{{ stageEmoji }}</div>
                <div class="info-panel">
                    <div class="info-row"><span>🏷️ 植物名称</span><span>{{ plant.name }}</span></div>
                    <div class="info-row"><span>⭐ 稀有度</span><span :class="['badge', rarityClass]">{{ rarityName
                            }}</span></div>
                    <div class="info-row"><span>🌱 成长阶段</span><span><strong>{{ stageName }}</strong> {{ stageEmoji
                            }}</span></div>
                    <div class="info-row"><span>📊 阶段进度</span><span>{{ plant.stageIdx + 1 }} / {{ STAGES.length
                            }}</span></div>
                    <div class="info-row"><span>⏲️ 上次浇水</span><span>{{ lastWaterDisplay }}</span></div>
                    <div class="info-row"><span>🌿 生命状态</span><span :class="plant.dead ? 'dead-text' : 'status-alive'">
                            {{ plant.dead ? '枯萎死亡 💔' : '生机勃勃 🌟' }}
                        </span></div>
                    <div class="info-row" v-if="!plant.dead && !isMature && !plant.dead">
                        <span>⏳ 生存状态</span><span v-html="deathRemainHtml"></span>
                    </div>
                    <div class="info-row" v-if="!plant.dead && isMature">
                        <span>🏆 收获条件</span><span style="color:#d97706;">✅ 已成熟！点击「收获」获得作物</span>
                    </div>
                    <div class="info-row" v-else-if="!plant.dead && !isMature">
                        <span>🌾 距离成熟</span><span>还需浇水 {{ MATURE_STAGE_INDEX - plant.stageIdx }} 次</span>
                    </div>
                </div>
            </div>

            <!-- 2x2 田字格按钮 -->
            <div class="button-grid">
                <button class="grid-btn water-btn" @click="waterPlant" :disabled="!hasPlant || plant.dead || isMature">
                    💧 浇水
                </button>
                <button class="grid-btn harvest-btn" @click="showHarvestModal"
                    :disabled="!hasPlant || !isMature || plant.dead">
                    🏆 收获
                </button>
                <button class="grid-btn plant-btn" @click="openPlantDialog">
                    🌱 种植
                </button>
                <button class="grid-btn remove-btn" @click="showRemoveModal" :disabled="!hasPlant">
                    🗑️ 铲除
                </button>
            </div>

            <div class="cooldown" v-if="hasPlant && !plant.dead && !isMature" v-html="cooldownMsg"></div>
            <footer>🌸 成熟后可以收获作物 | 作物可在背包中卖出</footer>
        </div>

        <!-- 种植弹窗 -->
        <div v-if="showPlantDialog" class="modal-overlay" @click.self="closePlantDialog">
            <div class="modal-content">
                <h3>🌱 选择种子</h3>
                <div v-if="userStore.seeds.length === 0" class="empty-seeds">
                    <p>背包里没有种子</p>
                    <button @click="closePlantDialog" class="close-modal-btn">去商城购买</button>
                </div>
                <div v-else class="seeds-list">
                    <div v-for="(seedList, rarity) in userStore.groupedSeeds" :key="rarity" class="seed-item" @click="showPlantConfirmModal({ rarity, seeds: seedList })">
                        <span class="seed-rarity" :class="`rarity-${rarity}`">{{ rarity }} ({{ seedList.length }})</span>
                        <span class="seed-name">{{ rarityConfig[rarity].name }}</span>
                        <span class="seed-price">💰 {{ rarityConfig[rarity].buyPrice }}</span>
                    </div>
                </div>
                <button @click="closePlantDialog" class="cancel-btn">取消</button>
            </div>
        </div>
        
        <!-- 收获确认弹窗 -->
        <Modal
            :visible="showHarvestModalVisible"
            title="🏆 收获确认"
            :message="`确定要收获 ${plant?.name} 吗？\n将获得一个${plant ? rarityConfig[plant.rarity].cropName : '作物'}，可在背包卖出`"
            confirm-text="确定收获"
            cancel-text="取消"
            @confirm="handleHarvestConfirm"
            @cancel="showHarvestModalVisible = false"
        />
        
        <!-- 铲除确认弹窗 -->
        <Modal
            :visible="showRemoveModalVisible"
            title="🗑️ 铲除确认"
            :message="`确定要铲除 ${plant?.name} 吗？此操作不可恢复`"
            confirm-text="确定铲除"
            cancel-text="取消"
            @confirm="handleRemoveConfirm"
            @cancel="showRemoveModalVisible = false"
        />
        
        <!-- 种植确认弹窗 -->
        <Modal
            :visible="showPlantConfirmModalVisible"
            title="🌱 种植确认"
            :message="hasPlant ? `⚠️ 当前已有植物，种植新种子会覆盖当前植物，确定吗？` : `确定要种植 ${currentSeed ? rarityConfig[currentSeed.rarity].name : '种子'} 吗？\n剩余数量：${currentSeed ? currentSeed.seeds.length : 0}`"
            confirm-text="确定种植"
            cancel-text="取消"
            @confirm="handlePlantConfirm"
            @cancel="showPlantConfirmModalVisible = false"
        />
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import Modal from '@/components/Modal.vue'
import Toast from '@/components/Toast.vue'

const userStore = useUserStore()

// ---------- 配置 ----------
const STAGES = ['种子', '发芽', '出叶', '初熟', '成熟']
const STAGE_EMOJI = ['🥜', '🌱', '🌿', '🌻', '🌸']
const COOLDOWN_SECONDS = 5
const DEATH_TIMEOUT_SECONDS = 60
const MATURE_STAGE_INDEX = 4

// 响应式数据
const plant = ref(null)
const hasPlant = ref(false)
const showPlantDialog = ref(false)
const showHarvestModalVisible = ref(false)
const showRemoveModalVisible = ref(false)
const showPlantConfirmModalVisible = ref(false)
const currentSeed = ref(null)
const toastRef = ref(null)
const cooldownMsg = ref('')
const lastWaterDisplay = ref('')
const deathRemainHtml = ref('')

let timer = null

// 计算属性
const isMature = computed(() => hasPlant.value && plant.value?.stageIdx === MATURE_STAGE_INDEX)
const rarityConfig = computed(() => userStore.rarityConfig)
const rarityName = computed(() => {
    if (!hasPlant.value) return ''
    return plant.value.rarity
})
const rarityClass = computed(() => {
    if (!hasPlant.value) return ''
    return `rarity-${plant.value.rarity}`
})
const stageName = computed(() => {
    if (!hasPlant.value) return ''
    return STAGES[plant.value.stageIdx]
})
const stageEmoji = computed(() => {
    if (!hasPlant.value) return '🌰'
    return STAGE_EMOJI[plant.value.stageIdx]
})

// ---------- 植物数据操作 ----------
function loadPlant() {
    const saved = localStorage.getItem('current_plant')
    if (saved) {
        try {
            const p = JSON.parse(saved)
            // 检查死亡
            const now = Date.now()
            const secondsSinceWater = (now - p.lastWatered) / 1000
            if (!p.dead && p.stageIdx !== MATURE_STAGE_INDEX && secondsSinceWater > DEATH_TIMEOUT_SECONDS) {
                p.dead = true
                savePlant(p)
            }
            plant.value = p
            hasPlant.value = true
        } catch (e) {
            hasPlant.value = false
            plant.value = null
        }
    } else {
        hasPlant.value = false
        plant.value = null
    }
    updateUI()
}

function savePlant(p) {
    localStorage.setItem('current_plant', JSON.stringify(p))
    plant.value = p
    hasPlant.value = true
}

function clearPlant() {
    localStorage.removeItem('current_plant')
    plant.value = null
    hasPlant.value = false
    updateUI()
}

function createNewPlant(rarity) {
    const now = Date.now()
    return {
        name: `${rarityConfig.value[rarity].name}`,
        rarity: rarity,
        stageIdx: 0,
        lastWatered: now,
        createdAt: now,
        dead: false
    }
}

// ---------- 按钮功能 ----------
function waterPlant() {
    if (!hasPlant.value || plant.value.dead || isMature.value) return

    const now = Date.now()
    const secondsSinceWater = (now - plant.value.lastWatered) / 1000

    if (secondsSinceWater < COOLDOWN_SECONDS) {
        addToast(`💧 还需等待 ${Math.ceil(COOLDOWN_SECONDS - secondsSinceWater)} 秒`, 'warning')
        return
    }

    plant.value.lastWatered = now
    plant.value.stageIdx = Math.min(plant.value.stageIdx + 1, MATURE_STAGE_INDEX)
    if (plant.value.dead) plant.value.dead = false
    savePlant(plant.value)

    if (plant.value.stageIdx === MATURE_STAGE_INDEX) {
        addToast(`🎉 ${plant.value.name} 成熟了！可以收获了`, 'success')
    } else {
        addToast(`💧 浇水成功！${plant.value.name} 成长了`, 'success')
    }
    updateUI()
}

function showHarvestModal() {
    if (!hasPlant.value || !isMature.value || plant.value.dead) return
    showHarvestModalVisible.value = true
}

function handleHarvestConfirm() {
    if (!hasPlant.value || !isMature.value || plant.value.dead) return
    
    // 添加作物到背包
    userStore.addCrop(plant.value.rarity)
    // 清除当前植物
    clearPlant()
    addToast(`🏆 收获成功！获得 ${rarityConfig.value[plant.value?.rarity || 'C'].cropName}`, 'success')
    showHarvestModalVisible.value = false
}

function openPlantDialog() {
    showPlantDialog.value = true
}

function closePlantDialog() {
    showPlantDialog.value = false
}

function showPlantConfirmModal(seedGroup) {
    currentSeed.value = seedGroup
    showPlantConfirmModalVisible.value = true
}

function handlePlantConfirm() {
    if (!currentSeed.value || !currentSeed.value.seeds || currentSeed.value.seeds.length === 0) return
    
    // 取第一个种子来种植
    const seedToUse = currentSeed.value.seeds[0]
    // 创建新植物
    const newPlant = createNewPlant(seedToUse.rarity)
    savePlant(newPlant)
    // 移除使用的种子
    userStore.removeSeed(seedToUse.id)
    closePlantDialog()
    showPlantConfirmModalVisible.value = false
    addToast(`🌱 种植成功！获得 ${newPlant.name}`, 'success')
    updateUI()
    currentSeed.value = null
}

function showRemoveModal() {
    if (!hasPlant.value) return
    showRemoveModalVisible.value = true
}

function handleRemoveConfirm() {
    if (!hasPlant.value) return
    
    clearPlant()
    addToast(`🗑️ 已铲除植物`, 'info')
    showRemoveModalVisible.value = false
}

// ---------- UI 更新 ----------
function updateUI() {
    if (!hasPlant.value || !plant.value) {
        // 无植物状态，不需要更新详细信息
        return
    }

    const now = Date.now()
    const secondsSinceWater = (now - plant.value.lastWatered) / 1000
    const secondsAgo = Math.floor(secondsSinceWater)

    lastWaterDisplay.value = secondsAgo < 60
        ? `${secondsAgo} 秒前`
        : `${Math.floor(secondsAgo / 60)}分${secondsAgo % 60}秒前`

    if (!plant.value.dead && !isMature.value) {
        const remainingSec = Math.max(0, DEATH_TIMEOUT_SECONDS - secondsSinceWater)
        if (remainingSec <= 10) {
            deathRemainHtml.value = `<span style="color:#c0392b; font-weight:bold;">⚠️ 即将枯萎 (${Math.ceil(remainingSec)}秒内需浇水)</span>`
        } else {
            deathRemainHtml.value = `<span>💧 枯萎倒计时 ${Math.ceil(remainingSec)}秒</span>`
        }
    } else {
        deathRemainHtml.value = ''
    }

    if (plant.value.dead) {
        cooldownMsg.value = `🥀 植物已枯萎，请「铲除」后重新种植`
    } else if (!isMature.value) {
        const remainingCooldown = COOLDOWN_SECONDS - secondsSinceWater
        cooldownMsg.value = remainingCooldown > 0
            ? `⏳ 浇水冷却中 · 还需 ${Math.ceil(remainingCooldown)} 秒`
            : `💧 可以浇水了！`
    }
}

// ---------- Toast 提示 ----------
function addToast(message, type = 'info') {
    if (toastRef.value) {
        toastRef.value.addToast(message, type)
    }
}

// ---------- 定时器 ----------
function startTimer() {
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
        if (hasPlant.value && plant.value && !plant.value.dead && plant.value.stageIdx !== MATURE_STAGE_INDEX) {
            const now = Date.now()
            const secondsSinceWater = (now - plant.value.lastWatered) / 1000
            if (secondsSinceWater > DEATH_TIMEOUT_SECONDS) {
                plant.value.dead = true
                savePlant(plant.value)
                addToast(`💀 ${plant.value.name} 因未及时浇水而枯萎了`, 'error')
            }
        }
        loadPlant()
    }, 1000)
}

// ---------- 生命周期 ----------
onMounted(() => {
    userStore.loadFromLocal()
    loadPlant()
    startTimer()
})

onUnmounted(() => {
    if (timer) clearInterval(timer)
    activeToasts.forEach(toast => {
        if (toast && toast.remove) toast.remove()
    })
    activeToasts = []
})
</script>

<style scoped>
/* 页面容器 */
.garden-page {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
    padding: 20px;
    position: relative;
}

/* 卡片样式 */
.card {
    background: rgba(255, 248, 235, 0.98);
    border-radius: 64px;
    padding: 28px 24px 36px;
    max-width: 580px;
    width: 100%;
    box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
    text-align: center;
}

h1 {
    font-size: 1.9rem;
    margin: 0 0 8px 0;
    color: #2c5a2a;
}

/* 空状态 */
.empty-state {
    padding: 40px 20px;
}

.empty-emoji {
    font-size: 80px;
    margin-bottom: 16px;
}

.empty-text {
    font-size: 1.2rem;
    color: #666;
    margin-bottom: 8px;
}

.empty-hint {
    font-size: 0.9rem;
    color: #999;
}

/* 植物表情 */
.plant-emoji {
    font-size: 130px;
    margin: 15px 0;
    filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.2));
}

/* 信息面板 */
.info-panel {
    background: #fef7e8;
    border-radius: 48px;
    padding: 20px 24px;
    text-align: left;
    margin: 18px 0;
}

.info-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #e9dbbc;
}

.info-row:last-child {
    border-bottom: none;
}

/* 稀有度徽章 */
.badge {
    display: inline-block;
    padding: 5px 16px;
    border-radius: 60px;
    font-weight: bold;
}

.rarity-C {
    background: #9e9e9e;
    color: white;
}

.rarity-B {
    background: #4caf50;
    color: white;
}

.rarity-A {
    background: #2196f3;
    color: white;
}

.rarity-S {
    background: #9c27b0;
    color: white;
}

.rarity-SSS {
    background: linear-gradient(135deg, #ffd700, #ff8c00);
    color: #2d2b15;
}

/* 2x2 田字格按钮 */
.button-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin: 24px 0 16px;
}

.grid-btn {
    padding: 14px 0;
    font-size: 1.1rem;
    font-weight: bold;
    border: none;
    border-radius: 60px;
    cursor: pointer;
    transition: all 0.1s ease;
}

.grid-btn:active {
    transform: scale(0.96);
}

.water-btn {
    background: #2e7d32;
    color: white;
}

.harvest-btn {
    background: #ff9800;
    color: white;
}

.plant-btn {
    background: #5c6bc0;
    color: white;
}

.remove-btn {
    background: #f44336;
    color: white;
}

.grid-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

.cooldown {
    font-size: 0.85rem;
    background: #e9f0e3;
    padding: 8px 16px;
    border-radius: 60px;
    display: inline-block;
    margin-top: 8px;
}

footer {
    font-size: 0.7rem;
    color: #7f6b4a;
    margin-top: 20px;
}

/* 弹窗 */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 48px;
    padding: 24px;
    width: 90%;
    max-width: 400px;
    text-align: center;
}

.seeds-list {
    max-height: 300px;
    overflow-y: auto;
    margin: 16px 0;
}

.seed-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    transition: background 0.1s;
}

.seed-item:hover {
    background: #f5f5f5;
}

.seed-rarity {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
}

.cancel-btn,
.close-modal-btn {
    margin-top: 12px;
    padding: 10px 20px;
    border: none;
    border-radius: 40px;
    background: #ccc;
    cursor: pointer;
}

.empty-seeds {
    padding: 20px;
    color: #666;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
    .garden-page {
        background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
    }

    .card {
        background: rgba(30, 30, 25, 0.95);
    }

    h1 {
        color: #8bc34a;
    }

    .info-panel {
        background: #2a2a25;
    }

    .info-row {
        color: #e0e0d0;
        border-bottom-color: #4a4a3a;
    }

    .cooldown {
        background: #2a3a25;
        color: #b8d9a0;
    }

    footer {
        color: #a0a080;
    }

    .modal-content {
        background: #2a2a25;
        color: #e0e0d0;
    }

    .seed-item {
        border-bottom-color: #4a4a3a;
    }

    .seed-item:hover {
        background: #3a3a35;
    }
}
</style>
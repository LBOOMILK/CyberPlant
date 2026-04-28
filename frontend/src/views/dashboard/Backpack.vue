<template>
    <div class="inventory-page">
        <h1>🎒 我的背包</h1>

        <div class="tabs">
            <button :class="{ active: activeTab === 'seeds' }" @click="activeTab = 'seeds'">
                🌱 种子 ({{ userStore.seedCount }})
            </button>
            <button :class="{ active: activeTab === 'crops' }" @click="activeTab = 'crops'">
                🌾 作物 ({{ userStore.cropCount }})
            </button>
            <button :class="{ active: activeTab === 'uses' }" @click="activeTab = 'uses'">
                📦 可使用物品 ({{ userStore.useCount }})
            </button>
        </div>

        <!-- 种子列表 -->
        <div v-if="activeTab === 'seeds'" class="items-grid">
            <div class="item-card" v-if="userStore.groupedSeeds.C > 0">
                <div class="item-icon">{{ seedIcon('C') }}</div>
                <div class="item-name">{{ rarityConfig.C.name }}</div>
                <div class="item-rarity rarity-C">C ({{ userStore.groupedSeeds.C }})</div>
                <div class="item-price">💰 买入价 {{ rarityConfig.C.buyPrice }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('seed', { rarity: 'C', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('seed', { rarity: 'C', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedSeeds.B > 0">
                <div class="item-icon">{{ seedIcon('B') }}</div>
                <div class="item-name">{{ rarityConfig.B.name }}</div>
                <div class="item-rarity rarity-B">B ({{ userStore.groupedSeeds.B }})</div>
                <div class="item-price">💰 买入价 {{ rarityConfig.B.buyPrice }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('seed', { rarity: 'B', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('seed', { rarity: 'B', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedSeeds.A > 0">
                <div class="item-icon">{{ seedIcon('A') }}</div>
                <div class="item-name">{{ rarityConfig.A.name }}</div>
                <div class="item-rarity rarity-A">A ({{ userStore.groupedSeeds.A }})</div>
                <div class="item-price">💰 买入价 {{ rarityConfig.A.buyPrice }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('seed', { rarity: 'A', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('seed', { rarity: 'A', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedSeeds.S > 0">
                <div class="item-icon">{{ seedIcon('S') }}</div>
                <div class="item-name">{{ rarityConfig.S.name }}</div>
                <div class="item-rarity rarity-S">S ({{ userStore.groupedSeeds.S }})</div>
                <div class="item-price">💰 买入价 {{ rarityConfig.S.buyPrice }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('seed', { rarity: 'S', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('seed', { rarity: 'S', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedSeeds.SSS > 0">
                <div class="item-icon">{{ seedIcon('SSS') }}</div>
                <div class="item-name">{{ rarityConfig.SSS.name }}</div>
                <div class="item-rarity rarity-SSS">SSS ({{ userStore.groupedSeeds.SSS }})</div>
                <div class="item-price">💰 买入价 {{ rarityConfig.SSS.buyPrice }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('seed', { rarity: 'SSS', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('seed', { rarity: 'SSS', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div v-if="userStore.seedCount === 0" class="empty-msg">
                还没有种子，去商店买点吧~
            </div>
        </div>

        <!-- 作物列表 -->
        <div v-else-if="activeTab === 'crops'" class="items-grid">
            <div class="item-card" v-if="userStore.groupedCrops.C > 0">
                <div class="item-icon">{{ cropIcon('C') }}</div>
                <div class="item-name">{{ rarityConfig.C.cropName }}</div>
                <div class="item-rarity rarity-C">C ({{ userStore.groupedCrops.C }})</div>
                <div class="item-price">💰 卖出价 {{ rarityConfig.C.sellPrice }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('crop', { rarity: 'C', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('crop', { rarity: 'C', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedCrops.B > 0">
                <div class="item-icon">{{ cropIcon('B') }}</div>
                <div class="item-name">{{ rarityConfig.B.cropName }}</div>
                <div class="item-rarity rarity-B">B ({{ userStore.groupedCrops.B }})</div>
                <div class="item-price">💰 卖出价 {{ rarityConfig.B.sellPrice }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('crop', { rarity: 'B', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('crop', { rarity: 'B', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedCrops.A > 0">
                <div class="item-icon">{{ cropIcon('A') }}</div>
                <div class="item-name">{{ rarityConfig.A.cropName }}</div>
                <div class="item-rarity rarity-A">A ({{ userStore.groupedCrops.A }})</div>
                <div class="item-price">💰 卖出价 {{ rarityConfig.A.sellPrice }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('crop', { rarity: 'A', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('crop', { rarity: 'A', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedCrops.S > 0">
                <div class="item-icon">{{ cropIcon('S') }}</div>
                <div class="item-name">{{ rarityConfig.S.cropName }}</div>
                <div class="item-rarity rarity-S">S ({{ userStore.groupedCrops.S }})</div>
                <div class="item-price">💰 卖出价 {{ rarityConfig.S.sellPrice }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('crop', { rarity: 'S', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('crop', { rarity: 'S', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedCrops.SSS > 0">
                <div class="item-icon">{{ cropIcon('SSS') }}</div>
                <div class="item-name">{{ rarityConfig.SSS.cropName }}</div>
                <div class="item-rarity rarity-SSS">SSS ({{ userStore.groupedCrops.SSS }})</div>
                <div class="item-price">💰 卖出价 {{ rarityConfig.SSS.sellPrice }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('crop', { rarity: 'SSS', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('crop', { rarity: 'SSS', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div v-if="userStore.cropCount === 0" class="empty-msg">
                还没有作物，去花园收获吧~
            </div>
        </div>

        <!-- 可使用物品列表 -->
        <div v-else-if="activeTab === 'uses'" class="items-grid">
            <div class="item-card" v-if="userStore.groupedUses.C > 0">
                <div class="item-icon">{{ useIcon('C') }}</div>
                <div class="item-name">{{ fertilizerConfig.C.name }}</div>
                <div class="item-rarity rarity-C">C ({{ userStore.groupedUses.C }})</div>
                <div class="item-price">💰 卖出价 {{ fertilizerConfig.C.price }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('use', { rarity: 'C', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('use', { rarity: 'C', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedUses.B > 0">
                <div class="item-icon">{{ useIcon('B') }}</div>
                <div class="item-name">{{ fertilizerConfig.B.name }}</div>
                <div class="item-rarity rarity-B">B ({{ userStore.groupedUses.B }})</div>
                <div class="item-price">💰 卖出价 {{ fertilizerConfig.B.price }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('use', { rarity: 'B', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('use', { rarity: 'B', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedUses.A > 0">
                <div class="item-icon">{{ useIcon('A') }}</div>
                <div class="item-name">{{ fertilizerConfig.A.name }}</div>
                <div class="item-rarity rarity-A">A ({{ userStore.groupedUses.A }})</div>
                <div class="item-price">💰 卖出价 {{ fertilizerConfig.A.price }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('use', { rarity: 'A', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('use', { rarity: 'A', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedUses.S > 0">
                <div class="item-icon">{{ useIcon('S') }}</div>
                <div class="item-name">{{ fertilizerConfig.S.name }}</div>
                <div class="item-rarity rarity-S">S ({{ userStore.groupedUses.S }})</div>
                <div class="item-price">💰 卖出价 {{ fertilizerConfig.S.price }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('use', { rarity: 'S', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('use', { rarity: 'S', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div class="item-card" v-if="userStore.groupedUses.SSS > 0">
                <div class="item-icon">{{ useIcon('SSS') }}</div>
                <div class="item-name">{{ fertilizerConfig.SSS.name }}</div>
                <div class="item-rarity rarity-SSS">SSS ({{ userStore.groupedUses.SSS }})</div>
                <div class="item-price">💰 卖出价 {{ fertilizerConfig.SSS.price }} 积分</div>
                <div class="sell-buttons">
                    <button @click="showSellModal('use', { rarity: 'SSS', type: 'all' })" class="sell-btn all-sell-btn">全部卖出</button>
                    <button @click="showSellModal('use', { rarity: 'SSS', type: 'part' })" class="sell-btn part-sell-btn">部分卖出</button>
                </div>
            </div>
            <div v-if="userStore.useCount === 0" class="empty-msg">
                还没有可使用物品，去商店买点吧~
            </div>
        </div>

        <Toast ref="toastRef" />
        
        <!-- 卖出确认弹窗 -->
        <Modal
            :visible="showSellModalVisible"
            title="💰 卖出确认"
            :message="sellModalMessage"
            confirm-text="确认卖出"
            cancel-text="取消"
            @confirm="handleSellConfirm"
            @cancel="showSellModalVisible = false"
        />
        
        <!-- 数量输入弹窗 -->
        <div v-if="showQuantityModalVisible" class="modal-overlay" @click.self="showQuantityModalVisible = false">
            <div class="modal-content">
                <h3>🔢 输入数量</h3>
                <div class="form-group">
                    <label for="sellQuantity">卖出数量</label>
                    <input type="number" id="sellQuantity" v-model="sellQuantity" min="1" :max="maxQuantity" step="1" required>
                    <div class="quantity-info">
                        可卖数量: {{ maxQuantity }}
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="cancel-btn" @click="showQuantityModalVisible = false">取消</button>
                    <button type="button" class="confirm-btn" @click="handlePartSellConfirm">确认卖出</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/userStore'
import Modal from '@/components/Modal.vue'
import Toast from '@/components/Toast.vue'

const userStore = useUserStore()
const activeTab = ref('seeds')
const toastRef = ref(null)
const showSellModalVisible = ref(false)
const showQuantityModalVisible = ref(false)
const currentItemType = ref('')
const currentItem = ref(null)
const sellModalMessage = ref('')
const sellType = ref('')
const sellQuantity = ref(0)
const maxQuantity = ref(0)

const rarityConfig = userStore.rarityConfig
const fertilizerConfig = userStore.fertilizerConfig

// 生成稀有度数组
const rarities = ['C', 'B', 'A', 'S', 'SSS']

// 生命周期
onMounted(async () => {
    try {
        await userStore.loadFromLocal()
        console.log('userStore.groupedSeeds:', userStore.groupedSeeds)
        console.log('userStore.seedCount:', userStore.seedCount)
        console.log('userStore.seeds:', userStore.seeds)
        console.log('userStore.groupedCrops:', userStore.groupedCrops)
        console.log('userStore.cropCount:', userStore.cropCount)
        console.log('userStore.crops:', userStore.crops)
        console.log('userStore.groupedUses:', userStore.groupedUses)
        console.log('userStore.useCount:', userStore.useCount)
        console.log('userStore.uses:', userStore.uses)
    } catch (error) {
        console.error('Failed to load user data:', error)
        if (toastRef.value) {
            toastRef.value.addToast(error.message || '获取用户数据失败，请检查网络连接', 'error')
        }
    }
})

function seedIcon(rarity) {
    const icons = { C: '🌱', B: '🍃', A: '🌿', S: '🌺', SSS: '✨' }
    return icons[rarity] || '🌱'
}

function cropIcon(rarity) {
    const icons = { C: '🌾', B: '🍚', A: '🌻', S: '🏵️', SSS: '👑' }
    return icons[rarity] || '🌾'
}

function useIcon(rarity) {
    const icons = { C: '💩', B: '🧪', A: '⚗️', S: '🌟', SSS: '💎' }
    return icons[rarity] || '💩'
}

function addToast(message, type = 'info') {
    if (toastRef.value) {
        toastRef.value.addToast(message, type)
    }
}

function showSellModal(type, item) {
    currentItemType.value = type
    currentItem.value = item
    sellType.value = item.type
    
    if (sellType.value === 'all') {
        // 全部卖出，显示确认弹窗
        if (type === 'seed') {
            const price = rarityConfig[item.rarity].buyPrice
            const qty = userStore.seeds[item.rarity]
            const totalPrice = price * qty
            sellModalMessage.value = `确认卖出全部 ${qty} 个 ${rarityConfig[item.rarity].name}？\n获得 ${totalPrice} 积分`
        } else if (type === 'crop') {
            const price = rarityConfig[item.rarity].sellPrice
            const qty = userStore.crops[item.rarity]
            const totalPrice = price * qty
            sellModalMessage.value = `确认卖出全部 ${qty} 个 ${rarityConfig[item.rarity].cropName}？\n获得 ${totalPrice} 积分`
        } else if (type === 'use') {
            const price = rarityConfig[item.rarity].buyPrice
            const qty = userStore.uses[item.rarity]
            const totalPrice = price * qty
            sellModalMessage.value = `确认卖出全部 ${qty} 个 ${rarityConfig[item.rarity].useName || '物品'}？\n获得 ${totalPrice} 积分`
        }
        showSellModalVisible.value = true
    } else if (sellType.value === 'part') {
        // 部分卖出，显示数量输入弹窗
        if (type === 'seed') {
            maxQuantity.value = userStore.seeds[item.rarity]
        } else if (type === 'crop') {
            maxQuantity.value = userStore.crops[item.rarity]
        } else if (type === 'use') {
            maxQuantity.value = userStore.uses[item.rarity]
        }
        sellQuantity.value = 1
        showQuantityModalVisible.value = true
    }
}

async function handleSellConfirm() {
    if (currentItem.value) {
        if (currentItemType.value === 'seed') {
            const price = rarityConfig[currentItem.value.rarity].buyPrice
            const quantity = userStore.seeds[currentItem.value.rarity]
            const totalPrice = price * quantity
            // 卖出所有该稀有度的种子
            for (let i = 0; i < quantity; i++) {
                await userStore.sellSeed(currentItem.value.rarity)
            }
            addToast(`💰 卖出成功！获得 ${totalPrice} 积分`, 'success')
        } else if (currentItemType.value === 'crop') {
            const price = rarityConfig[currentItem.value.rarity].sellPrice
            const quantity = userStore.crops[currentItem.value.rarity]
            const totalPrice = price * quantity
            // 卖出所有该稀有度的作物
            for (let i = 0; i < quantity; i++) {
                await userStore.sellCrop(currentItem.value.rarity)
            }
            addToast(`💰 卖出成功！获得 ${totalPrice} 积分`, 'success')
        } else if (currentItemType.value === 'use') {
            const price = userStore.fertilizerConfig[currentItem.value.rarity].price
            const quantity = userStore.uses[currentItem.value.rarity]
            let totalEarned = 0
            let allSuccess = true
            // 卖出所有该稀有度的可使用物品
            for (let i = 0; i < quantity; i++) {
                const result = await userStore.sellUse(currentItem.value.rarity)
                if (result.success) {
                    totalEarned += result.price
                } else {
                    allSuccess = false
                    break
                }
            }
            if (allSuccess) {
                addToast(`💰 卖出成功！获得 ${totalEarned} 积分`, 'success')
            } else {
                addToast('卖出失败，请稍后重试', 'error')
            }
        }
        showSellModalVisible.value = false
        currentItem.value = null
        currentItemType.value = ''
        sellType.value = ''
    }
}

async function handlePartSellConfirm() {
    if (currentItem.value && sellQuantity.value > 0 && sellQuantity.value <= maxQuantity.value) {
        if (currentItemType.value === 'seed') {
            const price = rarityConfig[currentItem.value.rarity].buyPrice
            const totalPrice = price * sellQuantity.value
            // 卖出指定数量的种子
            for (let i = 0; i < sellQuantity.value; i++) {
                await userStore.sellSeed(currentItem.value.rarity)
            }
            addToast(`💰 卖出成功！获得 ${totalPrice} 积分`, 'success')
        } else if (currentItemType.value === 'crop') {
            const price = rarityConfig[currentItem.value.rarity].sellPrice
            const totalPrice = price * sellQuantity.value
            // 卖出指定数量的作物
            for (let i = 0; i < sellQuantity.value; i++) {
                await userStore.sellCrop(currentItem.value.rarity)
            }
            addToast(`💰 卖出成功！获得 ${totalPrice} 积分`, 'success')
        } else if (currentItemType.value === 'use') {
            const price = userStore.fertilizerConfig[currentItem.value.rarity].price
            let totalEarned = 0
            let allSuccess = true
            // 卖出指定数量的可使用物品
            for (let i = 0; i < sellQuantity.value; i++) {
                const result = await userStore.sellUse(currentItem.value.rarity)
                if (result.success) {
                    totalEarned += result.price
                } else {
                    allSuccess = false
                    break
                }
            }
            if (allSuccess) {
                addToast(`💰 卖出成功！获得 ${totalEarned} 积分`, 'success')
            } else {
                addToast('卖出失败，请稍后重试', 'error')
            }
        }
        showQuantityModalVisible.value = false
        currentItem.value = null
        currentItemType.value = ''
        sellType.value = ''
        sellQuantity.value = 0
        maxQuantity.value = 0
    } else {
        addToast('请输入有效的数量', 'error')
    }
}
</script>

<style scoped>
.inventory-page {
    min-height: 100vh;
    padding: 40px 20px 80px;
    background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
}

.inventory-page h1 {
    text-align: center;
    color: #2c5a2a;
    margin-bottom: 20px;
}

.tabs {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-bottom: 30px;
}

.tabs button {
    padding: 10px 24px;
    border: none;
    border-radius: 40px;
    background: rgba(255, 248, 235, 0.8);
    cursor: pointer;
    font-weight: bold;
    font-size: 1rem;
}

.tabs button.active {
    background: #2e7d32;
    color: white;
}

.items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 20px;
    max-width: 800px;
    margin: 0 auto;
}

.item-card {
    background: rgba(255, 248, 235, 0.95);
    border-radius: 32px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.item-icon {
    font-size: 48px;
}

.item-name {
    font-weight: bold;
    margin: 8px 0;
}

.item-rarity {
    display: inline-block;
    padding: 2px 12px;
    border-radius: 20px;
    font-size: 0.75rem;
    margin-bottom: 8px;
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

.item-price {
    color: #ff9800;
    font-weight: bold;
    margin: 8px 0;
}

.sell-btn {
    flex: 1;
    border: none;
    padding: 8px 4px;
    border-radius: 12px;
    cursor: pointer;
    font-weight: bold;
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
}

.sell-buttons {
    display: flex;
    gap: 6px;
    margin-top: 8px;
}

.all-sell-btn {
    background: #ff9800;
    color: white;
}

.all-sell-btn:hover {
    background: #e68900;
}

.part-sell-btn {
    background: #2196f3;
    color: white;
}

.part-sell-btn:hover {
    background: #1976d2;
}

.empty-msg {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px;
    color: #666;
}

/* 弹窗样式 */
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
    background: rgba(255, 248, 235, 0.98);
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal-content h3 {
    margin: 0 0 24px 0;
    color: #2c5a2a;
    text-align: center;
}

.form-group {
    margin-bottom: 20px;
    text-align: left;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: #555;
}

.form-group input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.2s ease;
    box-sizing: border-box;
}

.form-group input:focus {
    outline: none;
    border-color: #4caf50;
}

.quantity-info {
    margin-top: 8px;
    font-size: 0.8rem;
    color: #666;
}

.modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 32px;
    justify-content: flex-end;
}

.cancel-btn,
.confirm-btn {
    padding: 10px 24px;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.cancel-btn {
    background: #9e9e9e;
    color: white;
}

.cancel-btn:hover {
    background: #757575;
}

.confirm-btn {
    background: #4caf50;
    color: white;
}

.confirm-btn:hover {
    background: #388e3c;
}

@media (prefers-color-scheme: dark) {
    .inventory-page {
        background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
    }

    .inventory-page h1 {
        color: #8bc34a;
    }

    .tabs button {
        background: rgba(30, 30, 25, 0.8);
        color: #ccc;
    }

    .tabs button.active {
        background: #4a4a4f;
        color: #9ccc65;
    }

    .item-card {
        background: rgba(30, 30, 25, 0.95);
        color: #e0e0d0;
    }

    .empty-msg {
        color: #aaa;
    }
    
    .sell-buttons .all-sell-btn {
        background: #e65100;
    }
    
    .sell-buttons .all-sell-btn:hover {
        background: #bf360c;
    }
    
    .sell-buttons .part-sell-btn {
        background: #1565c0;
    }
    
    .sell-buttons .part-sell-btn:hover {
        background: #0d47a1;
    }
    
    .modal-content {
        background: rgba(30, 30, 25, 0.95);
    }
    
    .modal-content h3 {
        color: #8bc34a;
    }
    
    .form-group label {
        color: #e0e0e0;
    }
    
    .form-group input {
        background: rgba(40, 40, 35, 0.8);
        border-color: #555;
        color: #e0e0e0;
    }
    
    .form-group input:focus {
        border-color: #8bc34a;
    }
    
    .quantity-info {
        color: #aaa;
    }
    
    .cancel-btn {
        background: #555;
    }
    
    .cancel-btn:hover {
        background: #444;
    }
    
    .confirm-btn {
        background: #388e3c;
    }
    
    .confirm-btn:hover {
        background: #2e7d32;
    }
}
</style>
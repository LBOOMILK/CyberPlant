<template>
    <div class="inventory-page">
        <h1>🎒 我的背包</h1>

        <div class="tabs">
            <button :class="{ active: activeTab === 'seeds' }" @click="activeTab = 'seeds'">
                🌱 种子 ({{ userStore.seeds.length }})
            </button>
            <button :class="{ active: activeTab === 'crops' }" @click="activeTab = 'crops'">
                🌾 作物 ({{ userStore.crops.length }})
            </button>
        </div>

        <!-- 种子列表 -->
        <div v-if="activeTab === 'seeds'" class="items-grid">
            <div v-for="(seedList, rarity) in userStore.groupedSeeds" :key="rarity" class="item-card">
                <div class="item-icon">{{ seedIcon(rarity) }}</div>
                <div class="item-name">{{ rarityConfig[rarity].name }}</div>
                <div class="item-rarity" :class="`rarity-${rarity}`">{{ rarity }} ({{ seedList.length }})</div>
                <div class="item-price">💰 买入价 {{ rarityConfig[rarity].buyPrice }} 积分</div>
                <button @click="showSellModal('seed', { rarity, seeds: seedList })" class="sell-btn">卖出</button>
            </div>
            <div v-if="userStore.seedCount === 0" class="empty-msg">
                还没有种子，去商店买点吧~
            </div>
        </div>

        <!-- 作物列表 -->
        <div v-else class="items-grid">
            <div v-for="(cropList, rarity) in userStore.groupedCrops" :key="rarity" class="item-card">
                <div class="item-icon">{{ cropIcon(rarity) }}</div>
                <div class="item-name">{{ rarityConfig[rarity].cropName }}</div>
                <div class="item-rarity" :class="`rarity-${rarity}`">{{ rarity }} ({{ cropList.length }})</div>
                <div class="item-price">💰 卖出价 {{ rarityConfig[rarity].sellPrice }} 积分</div>
                <button @click="showSellModal('crop', { rarity, crops: cropList })" class="sell-btn">卖出</button>
            </div>
            <div v-if="userStore.cropCount === 0" class="empty-msg">
                还没有作物，去花园收获吧~
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
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'
import Modal from '@/components/Modal.vue'
import Toast from '@/components/Toast.vue'

const userStore = useUserStore()
const activeTab = ref('seeds')
const toastRef = ref(null)
const showSellModalVisible = ref(false)
const currentItemType = ref('')
const currentItem = ref(null)
const sellModalMessage = ref('')

const rarityConfig = userStore.rarityConfig

function seedIcon(rarity) {
    const icons = { C: '🌱', B: '🍃', A: '🌿', S: '🌺', SSS: '✨' }
    return icons[rarity] || '🌱'
}

function cropIcon(rarity) {
    const icons = { C: '🌾', B: '🍚', A: '🌻', S: '🏵️', SSS: '👑' }
    return icons[rarity] || '🌾'
}

function addToast(message, type = 'info') {
    if (toastRef.value) {
        toastRef.value.addToast(message, type)
    }
}

function showSellModal(type, item) {
    currentItemType.value = type
    currentItem.value = item
    if (type === 'seed') {
        const price = rarityConfig[item.rarity].buyPrice
        const totalPrice = price * item.seeds.length
        sellModalMessage.value = `卖出 ${item.seeds.length} 个 ${rarityConfig[item.rarity].name}？\n获得 ${totalPrice} 积分`
    } else if (type === 'crop') {
        const price = rarityConfig[item.rarity].sellPrice
        const totalPrice = price * item.crops.length
        sellModalMessage.value = `卖出 ${item.crops.length} 个 ${rarityConfig[item.rarity].cropName}？\n获得 ${totalPrice} 积分`
    }
    showSellModalVisible.value = true
}

function handleSellConfirm() {
    if (currentItem.value) {
        if (currentItemType.value === 'seed') {
            const price = rarityConfig[currentItem.value.rarity].buyPrice
            const totalPrice = price * currentItem.value.seeds.length
            // 卖出所有该稀有度的种子
            currentItem.value.seeds.forEach(seed => {
                userStore.sellSeed(seed.id)
            })
            addToast(`💰 卖出成功！获得 ${totalPrice} 积分`, 'success')
        } else if (currentItemType.value === 'crop') {
            const price = rarityConfig[currentItem.value.rarity].sellPrice
            const totalPrice = price * currentItem.value.crops.length
            // 卖出所有该稀有度的作物
            currentItem.value.crops.forEach(crop => {
                userStore.sellCrop(crop.id)
            })
            addToast(`💰 卖出成功！获得 ${totalPrice} 积分`, 'success')
        }
        showSellModalVisible.value = false
        currentItem.value = null
        currentItemType.value = ''
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
    background: #ff9800;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 40px;
    cursor: pointer;
    font-weight: bold;
}

.sell-btn:hover {
    background: #e68900;
}

.empty-msg {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px;
    color: #666;
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
}
</style>
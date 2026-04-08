<template>
    <div class="shop-page">
        <h1>🛒 魔法种子商店</h1>

        <div class="items-grid">
            <div v-for="item in shopItems" :key="item.rarity" class="item-card">
                <div class="item-icon">{{ item.icon }}</div>
                <div class="item-name">{{ item.name }}</div>
                <div class="item-rarity" :class="`rarity-${item.rarity}`">{{ item.rarity }}</div>
                <div class="item-price">💰 {{ item.price }} 积分</div>
                <button @click="showBuyModal(item)" class="buy-btn">购买</button>
            </div>
        </div>

        <Toast ref="toastRef" />
        
        <!-- 购买确认弹窗 -->
        <Modal
            :visible="showBuyModalVisible"
            title="💰 购买确认"
            :message="buyModalMessage"
            confirm-text="确认购买"
            cancel-text="取消"
            @confirm="handleBuyConfirm"
            @cancel="showBuyModalVisible = false"
        />
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'
import Modal from '@/components/Modal.vue'
import Toast from '@/components/Toast.vue'

const userStore = useUserStore()
const toastRef = ref(null)
const showBuyModalVisible = ref(false)
const currentItem = ref(null)
const buyModalMessage = ref('')

const shopItems = ref([
    { rarity: 'C', name: '🌰 普通种子', price: 10, icon: '🌰', sellPrice: 20 },
    { rarity: 'B', name: '🍃 稀有种子', price: 30, icon: '🍃', sellPrice: 60 },
    { rarity: 'A', name: '🌿 史诗种子', price: 50, icon: '🌿', sellPrice: 100 },
    { rarity: 'S', name: '🌺 传说种子', price: 100, icon: '🌺', sellPrice: 200 },
    { rarity: 'SSS', name: '✨ 神级种子', price: 300, icon: '✨', sellPrice: 600 }
])

function addToast(message, type = 'info') {
    if (toastRef.value) {
        toastRef.value.addToast(message, type)
    }
}

function showBuyModal(item) {
    currentItem.value = item
    buyModalMessage.value = `购买 ${item.name}？\n价格：${item.price} 积分`
    showBuyModalVisible.value = true
}

function handleBuyConfirm() {
    if (currentItem.value) {
        const item = currentItem.value
        const success = userStore.deductPoints(item.price)
        if (success) {
            userStore.addSeed(item.rarity)
            addToast(`🎉 购买成功！获得 ${item.name}`, 'success')
        } else {
            addToast(`💔 积分不足，还需要 ${item.price - userStore.points} 积分`, 'error')
        }
        showBuyModalVisible.value = false
        currentItem.value = null
    }
}
</script>

<style scoped>
.shop-page {
    min-height: 100vh;
    padding: 40px 20px;
    background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
}

.shop-page h1 {
    text-align: center;
    color: #2c5a2a;
    margin-bottom: 30px;
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
    transition: transform 0.2s;
}

.item-card:hover {
    transform: translateY(-4px);
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

.buy-btn {
    background: #2e7d32;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 40px;
    cursor: pointer;
    font-weight: bold;
}

.buy-btn:hover {
    background: #1b5e20;
}



@media (prefers-color-scheme: dark) {
    .shop-page {
        background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
    }

    .shop-page h1 {
        color: #8bc34a;
    }

    .item-card {
        background: rgba(30, 30, 25, 0.95);
        color: #e0e0d0;
    }
}
</style>
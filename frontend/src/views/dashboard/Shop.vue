<template>
    <div class="shop-page">
        <h1>🛒 魔法种子商店</h1>

        <!-- 商品类型筛选 -->
        <div class="filter-bar">
            <span class="filter-label">筛选：</span>
            <button 
                v-for="filter in filters" 
                :key="filter.value"
                @click="selectedFilter = filter.value"
                :class="['filter-btn', { active: selectedFilter === filter.value }]"
            >
                {{ filter.label }}
            </button>
        </div>

        <div class="items-grid">
            <div v-for="item in filteredItems" :key="item.rarity + item.name" class="item-card">
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
            :showQuantity="true"
            :unitPrice="currentItem?.price || 0"
            :initialQuantity="buyQuantity"
            :maxQuantity="maxBuyQuantity"
            @confirm="handleBuyConfirm"
            @cancel="showBuyModalVisible = false"
        />
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import Modal from '@/components/Modal.vue'
import Toast from '@/components/Toast.vue'

const userStore = useUserStore()
const toastRef = ref(null)
const showBuyModalVisible = ref(false)
const currentItem = ref(null)
const buyModalMessage = ref('')
const shopItems = ref([])
const buyQuantity = ref(1)
const maxBuyQuantity = ref(99)

// 筛选选项
const filters = [
    { value: 'all', label: '全部' },
    { value: 'seed', label: '种子' },
    { value: 'use', label: '肥料' }
]
const selectedFilter = ref('all')

// 过滤后的商品列表
const filteredItems = computed(() => {
    return shopItems.value.filter(item => {
        // 筛选类型
        if (selectedFilter.value === 'seed') {
            return item.plants_role === 'seed'
        } else if (selectedFilter.value === 'use') {
            return item.plants_role === 'use'
        }
        // 全部显示
        return true
    })
})

// 从后端API获取植物数据
async function loadShopItems() {
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/plants`)
        if (!response.ok) {
            throw new Error('获取商品列表失败，请检查网络连接')
        }
        const plants = await response.json()
        // 按id排序
        plants.sort((a, b) => a.id - b.id)
        // 转换数据格式以匹配现有代码
        shopItems.value = plants.map(plant => ({
            rarity: plant.rarity,
            name: `${plant.icon} ${plant.name}`,
            price: plant.price,
            icon: plant.icon,
            plants_role: plant.plants_role || 'seed',
            sellPrice: plant.price * 2 // 假设售价是价格的两倍
        }))
    } catch (error) {
        console.error('Error loading plants:', error)
        addToast(error.message || '网络错误，请检查网络连接', 'error')
    }
}

// 生命周期
onMounted(async () => {
    try {
        await userStore.loadFromLocal()
        loadShopItems()
    } catch (error) {
        console.error('Failed to load user data:', error)
        addToast(error.message || '获取用户数据失败，请检查网络连接', 'error')
    }
})

function addToast(message, type = 'info') {
    if (toastRef.value) {
        toastRef.value.addToast(message, type)
    }
}

function showBuyModal(item) {
    currentItem.value = item
    buyQuantity.value = 1
    maxBuyQuantity.value = Math.max(1, Math.floor(userStore.points / item.price))
    buyModalMessage.value = `购买 ${item.name}？`
    showBuyModalVisible.value = true
}

function handleBuyConfirm(quantity) {
    if (currentItem.value) {
        const item = currentItem.value
        const totalPrice = item.price * quantity
        let addMethod
        
        if (item.plants_role === 'use') {
            addMethod = userStore.addUse
        } else {
            addMethod = userStore.addSeed
        }
        
        if (userStore.points < totalPrice) {
            const neededPoints = totalPrice - userStore.points
            addToast(`💔 积分不足，还需要 ${neededPoints} 积分`, 'error')
            showBuyModalVisible.value = false
            currentItem.value = null
            return
        }
        
        addMethod(item.rarity, totalPrice).then(result => {
            if (result) {
                addToast(`🎉 购买成功！获得 ${item.name} x${quantity}`, 'success')
            } else {
                addToast(`💔 购买失败，请稍后再试`, 'error')
            }
            showBuyModalVisible.value = false
            currentItem.value = null
        })
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
    margin-bottom: 20px;
}

.filter-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-bottom: 20px;
}

.filter-label {
    font-weight: bold;
    color: #2c5a2a;
}

.filter-btn {
    background: rgba(255, 255, 255, 0.8);
    border: 2px solid #2e7d32;
    color: #2e7d32;
    padding: 6px 16px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.2s;
}

.filter-btn:hover {
    background: #e8f5e9;
}

.filter-btn.active {
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

    .filter-label {
        color: #8bc34a;
    }

    .filter-btn {
        background: rgba(30, 30, 25, 0.95);
        border-color: #8bc34a;
        color: #8bc34a;
    }

    .filter-btn:hover {
        background: rgba(139, 195, 74, 0.2);
    }

    .filter-btn.active {
        background: #8bc34a;
        color: #1a2a1f;
    }

    .item-card {
        background: rgba(30, 30, 25, 0.95);
        color: #e0e0d0;
    }
}
</style>
<template>
    <div class="profile-page">
        <div class="profile-card">
            <div class="avatar">🧑‍🌾</div>
            <h2>{{ userStore.username }}</h2>

            <div class="stats">
                <div class="stat-item">
                    <span class="stat-label">⭐ 总积分</span>
                    <span class="stat-value">{{ userStore.totalPoints }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🌱 种子数量</span>
                    <span class="stat-value">{{ userStore.seedCount }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🌾 作物数量</span>
                    <span class="stat-value">{{ userStore.cropCount }}</span>
                </div>
            </div>

            <button class="reset-btn" @click="showResetModal = true">🔄 重置所有数据</button>
        </div>

        <Toast ref="toastRef" />
        
        <!-- 重置数据弹窗 -->
        <Modal
            :visible="showResetModal"
            title="⚠️ 重置数据"
            message="重置所有数据将清空积分、种子、作物和当前植物，确定吗？"
            confirm-text="确定重置"
            cancel-text="取消"
            @confirm="handleResetConfirm"
            @cancel="showResetModal = false"
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
const showResetModal = ref(false)

function addToast(message, type = 'info') {
    if (toastRef.value) {
        toastRef.value.addToast(message, type)
    }
}

function handleResetConfirm() {
    userStore.resetAllData()
    localStorage.removeItem('current_plant')
    addToast('所有数据已重置', 'info')
    showResetModal.value = false
    setTimeout(() => {
        window.location.reload()
    }, 1000)
}
</script>

<style scoped>
.profile-page {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40px 20px;
    background: linear-gradient(145deg, #d0e7d9 0%, #b8d9c6 100%);
}

.profile-card {
    background: rgba(255, 248, 235, 0.95);
    border-radius: 64px;
    padding: 40px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: 0 25px 45px rgba(0, 20, 0, 0.25);
}

.avatar {
    font-size: 80px;
    margin-bottom: 16px;
}

.profile-card h2 {
    color: #2c5a2a;
    margin-bottom: 24px;
}

.stats {
    text-align: left;
    margin: 24px 0;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #e9dbbc;
}

.stat-label {
    font-weight: 500;
    color: #555;
}

.stat-value {
    font-weight: bold;
    color: #2e7d32;
}

.reset-btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 40px;
    background: #dd9040;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    margin-top: 12px;
}



@media (prefers-color-scheme: dark) {
    .profile-page {
        background: linear-gradient(145deg, #1a2a1f 0%, #0d1f0a 100%);
    }

    .profile-card {
        background: rgba(30, 30, 25, 0.95);
    }

    .profile-card h2 {
        color: #8bc34a;
    }

    .stat-item {
        border-bottom-color: #4a4a3a;
    }

    .stat-label {
        color: #aaa;
    }

    .stat-value {
        color: #8bc34a;
    }
}
</style>
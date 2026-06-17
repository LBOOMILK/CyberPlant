<template>
  <div :class="['pets-panel', isClassic ? 'theme-classic' : 'theme-hub']">
    <h1 class="panel-title">宠物管理</h1>
    <div v-if="loading" class="panel-loading">加载中...</div>
    <div v-else>
      <!-- 宠物选择 -->
      <div class="pet-selector">
        <label>选择宠物：</label>
        <select v-model="selectedPetId" @change="loadPetCurve" class="pet-select">
          <option v-for="p in pets" :key="p.id" :value="p.id">
            {{ p.icon }} {{ p.name }} ({{ p.rarity }})
          </option>
        </select>
      </div>

      <div v-if="selectedPet" class="curve-editor">
        <!-- bonus_curve 编辑 -->
        <div class="curve-section">
          <h4>📈 加成曲线 (bonus_curve)</h4>
          <p class="curve-hint">每个等级的加成百分比</p>
          <div class="curve-bars">
            <div v-for="(val, i) in bonusCurve" :key="'b-'+i" class="bar-col">
              <div class="bar-wrapper">
                <div class="bar" :style="{ height: Math.max(4, (val / maxBonus) * 100) + '%' }"></div>
              </div>
              <input
                v-model.number="bonusCurve[i]"
                type="number"
                class="bar-input"
                min="0"
                max="999"
              />
              <span class="bar-label">Lv{{ i + 1 }}</span>
            </div>
          </div>
        </div>

        <!-- growth_curve 编辑 -->
        <div class="curve-section">
          <h4>🌱 成长曲线 (growth_curve)</h4>
          <p class="curve-hint">每个等级所需经验值</p>
          <div class="curve-bars">
            <div v-for="(val, i) in growthCurve" :key="'g-'+i" class="bar-col">
              <div class="bar-wrapper">
                <div class="bar growth" :style="{ height: Math.max(4, (val / maxGrowth) * 100) + '%' }"></div>
              </div>
              <input
                v-model.number="growthCurve[i]"
                type="number"
                class="bar-input"
                min="0"
              />
              <span class="bar-label">Lv{{ i + 1 }}</span>
            </div>
          </div>
        </div>

        <div class="curve-actions">
          <button class="save-btn" @click="saveCurve">💾 保存曲线</button>
          <button class="reset-btn" @click="resetCurve">↩️ 重置</button>
        </div>
      </div>
    </div>
    <Toast ref="toastRef" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '@/components/common/Toast.vue'

const route = useRoute()
const isClassic = computed(() => route.path.startsWith('/admin/classic'))

const loading = ref(true)
const pets = ref([])
const selectedPetId = ref(null)
const bonusCurve = ref([])
const growthCurve = ref([])
const toastRef = ref(null)

const selectedPet = computed(() => pets.value.find(p => p.id === selectedPetId.value))
const maxBonus = computed(() => Math.max(...bonusCurve.value, 1))
const maxGrowth = computed(() => Math.max(...growthCurve.value, 1))

async function loadPets() {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/pets/all`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      pets.value = await r.json()
      if (pets.value.length > 0) {
        selectedPetId.value = pets.value[0].id
        loadPetCurve()
      }
    }
  } catch (e) {
    console.error('Failed to load pets:', e)
  } finally {
    loading.value = false
  }
}

async function loadPetCurve() {
  if (!selectedPetId.value) return
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/pets/${selectedPetId.value}/curve`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      bonusCurve.value = [...(data.bonus_curve || new Array(10).fill(0))]
      growthCurve.value = [...(data.growth_curve || new Array(10).fill(0))]
    }
  } catch (e) {
    console.error('Failed to load curve:', e)
  }
}

function resetCurve() {
  loadPetCurve()
}

async function saveCurve() {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/pets/${selectedPetId.value}/curve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        bonus_curve: bonusCurve.value,
        growth_curve: growthCurve.value
      })
    })
    if (r.ok) {
      toastRef.value?.addToast('曲线保存成功', 'success')
    } else {
      const err = await r.json()
      toastRef.value?.addToast(err.error || '保存失败', 'error')
    }
  } catch (e) {
    toastRef.value?.addToast('网络错误', 'error')
  }
}

onMounted(loadPets)
</script>

<style scoped>
/* ===== Hub 主题（绿色/赛博） ===== */
.theme-hub .panel-title { display: none; }
.theme-hub .panel-loading { text-align: center; padding: 40px; color: var(--text-muted, #8b949e); }
.theme-hub .pet-selector { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
.theme-hub .pet-selector label { color: var(--text-secondary, #8b949e); }
.theme-hub .pet-select {
  padding: 6px 12px; background: var(--bg-primary, #0d1117);
  border: 1px solid var(--border-color, #21262d); color: var(--text-primary, #c9d1d9);
  border-radius: 6px; font-size: 13px;
}
.theme-hub .curve-section { margin-bottom: 24px; }
.theme-hub .curve-section h4 { color: #00ff88; margin: 0 0 4px 0; font-size: 13px; }
.theme-hub .curve-hint { font-size: 11px; color: var(--text-muted, #8b949e); margin: 0 0 12px 0; }
.theme-hub .curve-bars { display: flex; gap: 8px; justify-content: center; }
.theme-hub .bar-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; max-width: 60px; }
.theme-hub .bar-wrapper {
  width: 100%; height: 80px; display: flex; align-items: flex-end;
  justify-content: center;
}
.theme-hub .bar {
  width: 70%; background: linear-gradient(to top, #00ff88, #00cc6a);
  border-radius: 3px 3px 0 0; min-height: 4px; transition: height 0.3s;
}
.theme-hub .bar.growth { background: linear-gradient(to top, #f59e0b, #f97316); }
.theme-hub .bar-input {
  width: 100%; text-align: center; padding: 2px;
  background: var(--bg-primary, #0d1117); border: 1px solid var(--border-color, #21262d);
  color: var(--text-primary, #c9d1d9); border-radius: 3px; font-size: 10px;
}
.theme-hub .bar-input:focus { outline: none; border-color: #00ff88; }
.theme-hub .bar-label { font-size: 9px; color: var(--text-muted, #8b949e); }
.theme-hub .curve-actions { display: flex; gap: 10px; margin-top: 16px; justify-content: center; }
.theme-hub .save-btn, .theme-hub .reset-btn {
  padding: 8px 20px; border: 1px solid; border-radius: 6px; font-size: 12px;
  cursor: pointer; transition: all 0.2s;
}
.theme-hub .save-btn { background: rgba(0,255,136,0.1); border-color: rgba(0,255,136,0.3); color: #00ff88; }
.theme-hub .save-btn:hover { background: rgba(0,255,136,0.2); }
.theme-hub .reset-btn { background: rgba(255,255,255,0.05); border-color: var(--border-color, #21262d); color: var(--text-muted, #8b949e); }
.theme-hub .reset-btn:hover { background: rgba(255,255,255,0.08); }

/* ===== Classic 主题（橙色） ===== */
.theme-classic .panel-title { margin: 0 0 32px 0; color: #f59e0b; font-size: 1.6rem; }
.theme-classic .panel-loading { text-align: center; padding: 40px; color: var(--text-muted, #8b949e); }
.theme-classic .pet-selector { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.theme-classic .pet-selector label { color: var(--text-secondary, #8b949e); font-size: 13px; }
.theme-classic .pet-select {
  padding: 8px 16px; background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border-color, #334155); color: var(--text-primary, #f1f5f9);
  border-radius: 6px; font-size: 13px;
}
.theme-classic .curve-section { margin-bottom: 28px; }
.theme-classic .curve-section h4 { color: #f59e0b; margin: 0 0 8px 0; font-size: 1rem; font-weight: 600; }
.theme-classic .curve-hint { font-size: 12px; color: var(--text-muted, #8b949e); margin: 0 0 16px 0; }
.theme-classic .curve-bars { display: flex; gap: 10px; justify-content: center; }
.theme-classic .bar-col { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; max-width: 60px; }
.theme-classic .bar-wrapper {
  width: 100%; height: 100px; display: flex; align-items: flex-end;
  justify-content: center; background: rgba(245,158,11,0.05); border-radius: 6px; padding-bottom: 8px;
}
.theme-classic .bar {
  width: 70%; background: linear-gradient(to top, #f59e0b, #fbbf24);
  border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.3s;
}
.theme-classic .bar.growth { background: linear-gradient(to top, #ef4444, #f87171); }
.theme-classic .bar-input {
  width: 100%; text-align: center; padding: 4px 8px;
  background: var(--bg-secondary, #1e293b); border: 1px solid var(--border-color, #334155);
  color: var(--text-primary, #f1f5f9); border-radius: 4px; font-size: 11px;
}
.theme-classic .bar-input:focus { outline: none; border-color: #f59e0b; }
.theme-classic .bar-label { font-size: 10px; color: var(--text-muted, #8b949e); }
.theme-classic .curve-actions { display: flex; gap: 12px; margin-top: 20px; justify-content: center; }
.theme-classic .save-btn, .theme-classic .reset-btn {
  padding: 10px 24px; border: 1px solid; border-radius: 6px; font-size: 13px;
  font-weight: 500; cursor: pointer; transition: all 0.2s;
}
.theme-classic .save-btn { background: #f59e0b; border-color: #f59e0b; color: white; }
.theme-classic .save-btn:hover { background: #d97706; }
.theme-classic .reset-btn { background: rgba(255,255,255,0.05); border-color: var(--border-color, #334155); color: var(--text-muted, #8b949e); }
.theme-classic .reset-btn:hover { background: rgba(255,255,255,0.1); }
</style>

<template>
  <div :class="{'admin-page': isStandalone}">
    <AdminSidebar v-if="isStandalone" />
    <div :class="{'admin-content': isStandalone}" class="effects-panel">
      <div class="upload-area">
        <h4>📤 上传特效文件</h4>
        <p class="upload-hint">支持 .js 文件，需导出 {{ '{' }} name, init {{ '}' }} 对象</p>
        <div class="upload-row">
          <input type="file" ref="fileInput" accept=".js" @change="handleFileSelect" class="file-input" />
          <button class="upload-btn" @click="uploadFile" :disabled="!selectedFile || uploading">
            {{ uploading ? '上传中...' : '上传' }}
          </button>
        </div>
        <div v-if="uploadError" class="upload-error">{{ uploadError }}</div>
      </div>

      <div class="effects-list">
        <h4>📋 已上传特效</h4>
        <div v-if="loadingEffects" class="panel-loading">加载中...</div>
        <div v-else-if="effects.length === 0" class="empty-msg">暂无特效文件</div>
        <div v-else class="effects-grid">
          <div v-for="eff in effects" :key="eff.filename" class="effect-card">
            <span class="effect-icon">{{ eff.icon || '✨' }}</span>
            <span class="effect-name">{{ eff.name }}</span>
            <span class="effect-file">{{ eff.filename }}</span>
          </div>
        </div>
      </div>
      <Toast ref="toastRef" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '@/components/common/Toast.vue'
import AdminSidebar from '@/components/admin/AdminSidebar.vue'

const route = useRoute()
const isStandalone = computed(() => route.name === 'admin-effects')

const fileInput = ref(null)
const selectedFile = ref(null)
const uploading = ref(false)
const uploadError = ref('')
const effects = ref([])
const loadingEffects = ref(true)
const toastRef = ref(null)

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  if (!file.name.endsWith('.js')) {
    uploadError.value = '请选择 .js 文件'
    return
  }
  selectedFile.value = file
  uploadError.value = ''
}

async function uploadFile() {
  if (!selectedFile.value) return
  uploading.value = true
  uploadError.value = ''

  try {
    // Validate file content
    const content = await selectedFile.value.text()
    if (!content.includes('name') || !content.includes('init')) {
      uploadError.value = '文件必须导出 { name, init } 对象'
      uploading.value = false
      return
    }

    const token = localStorage.getItem('auth_token')
    const formData = new FormData()
    formData.append('effect', selectedFile.value)

    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })

    if (r.ok) {
      toastRef.value?.addToast('特效上传成功', 'success')
      selectedFile.value = null
      if (fileInput.value) fileInput.value.value = ''
      await loadEffects()
    } else {
      const err = await r.json()
      uploadError.value = err.error || '上传失败'
    }
  } catch (e) {
    uploadError.value = '网络错误'
  } finally {
    uploading.value = false
  }
}

async function loadEffects() {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      effects.value = await r.json()
    }
  } catch (e) {
    console.error('Failed to load effects:', e)
  } finally {
    loadingEffects.value = false
  }
}

onMounted(loadEffects)
</script>

<style scoped>
.effects-panel { font-size: 13px; }
.panel-loading { text-align: center; padding: 20px; color: var(--text-muted, #8b949e); }

.upload-area {
  margin-bottom: 24px;
  padding: 16px;
  background: rgba(0,255,136,0.03);
  border: 1px dashed rgba(0,255,136,0.2);
  border-radius: 10px;
}
.upload-area h4 { color: #00ff88; margin: 0 0 6px 0; font-size: 13px; }
.upload-hint { font-size: 11px; color: var(--text-muted, #8b949e); margin: 0 0 12px 0; }
.upload-row { display: flex; gap: 10px; align-items: center; }
.file-input {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary, #c9d1d9);
}
.upload-btn {
  padding: 6px 18px;
  background: rgba(0,255,136,0.1);
  border: 1px solid rgba(0,255,136,0.3);
  color: #00ff88;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.upload-btn:hover:not(:disabled) { background: rgba(0,255,136,0.2); }
.upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.upload-error { margin-top: 8px; color: #f44336; font-size: 11px; }

.effects-list h4 { color: #00ff88; margin: 0 0 12px 0; font-size: 13px; }
.empty-msg { text-align: center; padding: 20px; color: var(--text-muted, #8b949e); }
.effects-grid { display: flex; flex-direction: column; gap: 6px; }
.effect-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  transition: background 0.2s;
}
.effect-card:hover { background: rgba(255,255,255,0.04); }
.effect-icon { font-size: 18px; }
.effect-name { font-weight: 600; color: var(--text-primary, #c9d1d9); }
.effect-file { font-size: 11px; color: var(--text-muted, #8b949e); margin-left: auto; }
</style>

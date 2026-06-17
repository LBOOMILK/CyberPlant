<template>
  <div class="effects-panel">
    <h1>特效管理</h1>
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
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Toast from '@/components/common/Toast.vue'

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
      const data = await r.json()
      const files = data.effects || data
      effects.value = files.map(f => ({ filename: f, name: f.replace('.js', ''), icon: '✨' }))
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
.effects-panel h1 {
  margin: 0 0 32px 0;
  color: #f59e0b;
  font-size: 1.6rem;
}
.panel-loading { text-align: center; padding: 20px; color: var(--text-muted, #8b949e); }

.upload-area {
  margin-bottom: 24px;
  padding: 20px;
  background: rgba(245,158,11,0.05);
  border: 1px dashed rgba(245,158,11,0.3);
  border-radius: 10px;
}
.upload-area h4 { color: #f59e0b; margin: 0 0 8px 0; font-size: 1rem; font-weight: 600; }
.upload-hint { font-size: 12px; color: var(--text-muted, #8b949e); margin: 0 0 16px 0; }
.upload-row { display: flex; gap: 12px; align-items: center; }
.file-input {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary, #f1f5f9);
  padding: 8px 12px;
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border-color, #334155);
  border-radius: 6px;
}
.upload-btn {
  padding: 10px 24px;
  background: rgba(245,158,11,0.1);
  border: 1px solid rgba(245,158,11,0.3);
  color: #f59e0b;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.upload-btn:hover:not(:disabled) { background: rgba(245,158,11,0.2); }
.upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.upload-error { margin-top: 10px; color: #ef4444; font-size: 12px; }

.effects-list h4 { color: #f59e0b; margin: 0 0 16px 0; font-size: 1rem; font-weight: 600; }
.empty-msg { text-align: center; padding: 40px; color: var(--text-muted, #8b949e); }
.effects-grid { display: flex; flex-direction: column; gap: 8px; }
.effect-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(245,158,11,0.05);
  border: 1px solid rgba(245,158,11,0.1);
  border-radius: 8px;
  transition: all 0.2s;
}
.effect-card:hover { 
  background: rgba(245,158,11,0.1);
  border-color: rgba(245,158,11,0.2);
}
.effect-icon { font-size: 20px; }
.effect-name { font-weight: 600; color: var(--text-primary, #f1f5f9); font-size: 13px; }
.effect-file { font-size: 12px; color: var(--text-muted, #8b949e); margin-left: auto; }
</style>

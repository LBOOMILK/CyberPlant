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
            <span v-if="eff.builtin" class="builtin-tag">默认</span>
            <div class="effect-actions">
              <button class="view-btn" @click="viewEffect(eff)">查看</button>
              <button class="delete-btn" :disabled="eff.builtin" @click="deleteEffect(eff)">
                {{ eff.builtin ? '默认' : '删除' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 代码编辑弹窗 -->
      <div v-if="showEditor" class="modal-overlay" @mousedown.self="showEditor = false">
        <div class="editor-modal">
          <div class="editor-header">
            <h3>{{ editingEffect?.filename }}</h3>
            <span v-if="editingEffect?.builtin" class="builtin-tag">默认</span>
            <button class="close-btn" @click="showEditor = false">✕</button>
          </div>
          <div class="editor-body">
            <textarea
              v-model="editorContent"
              class="code-editor"
              :readonly="editingEffect?.builtin"
              spellcheck="false"
            ></textarea>
          </div>
          <div class="editor-footer">
            <span class="editor-hint" v-if="editingEffect?.builtin">内置特效为只读，不可修改</span>
            <span class="editor-hint" v-else>修改后点击保存生效</span>
            <div class="editor-actions">
              <button class="cancel-btn" @click="showEditor = false">关闭</button>
              <button
                v-if="!editingEffect?.builtin"
                class="save-btn"
                :disabled="saving"
                @click="saveEffect"
              >
                {{ saving ? '保存中...' : '💾 保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast ref="toastRef" />

      <ConfirmModal
        :visible="showDeleteEffectConfirm"
        title="删除确认"
        :message="'确定删除特效 ' + (pendingDeleteEffect?.name || '') + ' ？'"
        icon="🗑️"
        confirm-text="确认删除"
        cancel-text="取消"
        :danger="true"
        @confirm="doDeleteEffect"
        @cancel="showDeleteEffectConfirm = false; pendingDeleteEffect = null"
      />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Toast from '@/components/common/Toast.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const BUILTIN_EFFECTS = ['bubble-fish.js', 'cat-paw.js', 'star-rabbit.js', 'thunder-eagle.js', 'crystal-dragon.js', 'lbooktest.js']

const fileInput = ref(null)
const selectedFile = ref(null)
const uploading = ref(false)
const uploadError = ref('')
const effects = ref([])
const loadingEffects = ref(true)
const toastRef = ref(null)

const showEditor = ref(false)
const editingEffect = ref(null)
const editorContent = ref('')
const saving = ref(false)

const showDeleteEffectConfirm = ref(false)
const pendingDeleteEffect = ref(null)

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
      effects.value = files.map(f => ({
        filename: f,
        name: f.replace('.js', ''),
        icon: '✨',
        builtin: BUILTIN_EFFECTS.includes(f)
      }))
    }
  } catch (e) {
    console.error('Failed to load effects:', e)
  } finally {
    loadingEffects.value = false
  }
}

async function viewEffect(eff) {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects/${eff.filename}/content`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      editingEffect.value = { ...eff, builtin: data.builtin }
      editorContent.value = data.content
      showEditor.value = true
    } else {
      toastRef.value?.addToast('获取特效内容失败', 'error')
    }
  } catch (e) {
    toastRef.value?.addToast('网络错误', 'error')
  }
}

async function saveEffect() {
  if (!editingEffect.value) return
  saving.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects/${editingEffect.value.filename}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ content: editorContent.value })
    })
    if (r.ok) {
      toastRef.value?.addToast('特效保存成功', 'success')
      showEditor.value = false
    } else {
      const err = await r.json()
      toastRef.value?.addToast(err.error || '保存失败', 'error')
    }
  } catch (e) {
    toastRef.value?.addToast('网络错误', 'error')
  } finally {
    saving.value = false
  }
}

async function deleteEffect(eff) {
  if (eff.builtin) return
  pendingDeleteEffect.value = eff
  showDeleteEffectConfirm.value = true
}
async function doDeleteEffect() {
  const eff = pendingDeleteEffect.value
  showDeleteEffectConfirm.value = false
  pendingDeleteEffect.value = null
  if (!eff) return
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects/${eff.filename}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      toastRef.value?.addToast('特效删除成功', 'success')
      await loadEffects()
    } else {
      const err = await r.json()
      toastRef.value?.addToast(err.error || '删除失败', 'error')
    }
  } catch (e) {
    toastRef.value?.addToast('网络错误', 'error')
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
.effect-file { font-size: 12px; color: var(--text-muted, #8b949e); }
.builtin-tag {
  font-size: 10px;
  padding: 2px 8px;
  background: rgba(0,255,136,0.15);
  color: #00ff88;
  border-radius: 10px;
  white-space: nowrap;
}
.effect-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.view-btn, .delete-btn {
  padding: 4px 12px;
  border: 1px solid;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.view-btn {
  background: rgba(245,158,11,0.1);
  border-color: rgba(245,158,11,0.3);
  color: #f59e0b;
}
.view-btn:hover { background: rgba(245,158,11,0.2); }
.delete-btn {
  background: rgba(239,68,68,0.1);
  border-color: rgba(239,68,68,0.3);
  color: #ef4444;
}
.delete-btn:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
.delete-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: #00ff88;
  border-color: rgba(0,255,136,0.3);
  background: rgba(0,255,136,0.1);
}

/* 编辑弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.editor-modal {
  width: 90vw;
  max-width: 900px;
  height: 80vh;
  background: var(--bg-secondary, #1e293b);
  border: 1px solid var(--border-color, #334155);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #334155);
}
.editor-header h3 { margin: 0; color: #f59e0b; font-size: 1rem; }
.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-muted, #8b949e);
  font-size: 18px;
  cursor: pointer;
}
.editor-body { flex: 1; overflow: hidden; }
.code-editor {
  width: 100%;
  height: 100%;
  background: var(--bg-primary, #0d1117);
  color: #e6edf3;
  border: none;
  padding: 16px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  tab-size: 2;
}
.code-editor:focus { outline: none; }
.code-editor[readonly] { opacity: 0.7; }
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #334155);
}
.editor-hint { font-size: 12px; color: var(--text-muted, #8b949e); }
.editor-actions { display: flex; gap: 10px; }
.cancel-btn {
  padding: 8px 16px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-color, #334155);
  color: var(--text-muted, #8b949e);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.save-btn {
  padding: 8px 20px;
  background: rgba(245,158,11,0.1);
  border: 1px solid rgba(245,158,11,0.3);
  color: #f59e0b;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.save-btn:hover:not(:disabled) { background: rgba(245,158,11,0.2); }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

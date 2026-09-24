<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { verificationQueue, verificationStats, verify } from '@/services/api/admin'
import { useOfficeOptions } from '@/composables/useOfficeOptions'
import { apiErrorText } from '@/utils/apiErrors'
import type { QueueItem, VerificationErrorType, VerificationStats } from '@/types'

const { offices, load: loadOffices, servicesOf } = useOfficeOptions()

const filter = reactive({ office_id: undefined as string | undefined, service_id: undefined as string | undefined })
const serviceOptions = computed(() => (filter.office_id ? servicesOf(filter.office_id) : []))

const loading = ref(false)
const loadError = ref('')
const items = ref<QueueItem[]>([])
const total = ref(0)
const errorTypes = ref<Record<VerificationErrorType, string>>({} as Record<VerificationErrorType, string>)

const stats = ref<VerificationStats | null>(null)
const statsLoading = ref(false)

async function loadStats() {
  statsLoading.value = true
  try {
    stats.value = await verificationStats(filter.office_id, filter.service_id)
  } catch (e) {
    message.error(apiErrorText(e))
  } finally {
    statsLoading.value = false
  }
}

async function loadQueue() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await verificationQueue({ office_id: filter.office_id, service_id: filter.service_id, limit: 30 })
    items.value = res.data
    total.value = res.total
    errorTypes.value = res.error_types
  } catch (e) {
    loadError.value = apiErrorText(e)
  } finally {
    loading.value = false
  }
}

function onOfficeChange() {
  filter.service_id = undefined
}

function reloadAll() {
  loadQueue()
  loadStats()
}

// ---------- ตรวจ ----------
const wrongOpenFor = ref('') // message id ที่กำลังกรอกฟอร์ม "ผิด"
const wrongForm = reactive({ error_type: '' as VerificationErrorType | '', correct_answer: '', note: '' })
const submitting = ref(false)

function openWrong(id: string) {
  wrongOpenFor.value = id
  wrongForm.error_type = ''
  wrongForm.correct_answer = ''
  wrongForm.note = ''
}

async function markCorrect(messageId: string) {
  submitting.value = true
  try {
    await verify({ message_id: messageId, status: 'correct' })
    items.value = items.value.filter((i) => i.answer.id !== messageId)
    message.success('บันทึกว่าถูกแล้ว')
    loadStats()
  } catch (e) {
    message.error(apiErrorText(e))
  } finally {
    submitting.value = false
  }
}

async function submitWrong() {
  if (!wrongForm.error_type || !wrongForm.correct_answer.trim()) return
  submitting.value = true
  try {
    await verify({
      message_id: wrongOpenFor.value, status: 'wrong',
      error_type: wrongForm.error_type, correct_answer: wrongForm.correct_answer.trim(), note: wrongForm.note.trim(),
    })
    items.value = items.value.filter((i) => i.answer.id !== wrongOpenFor.value)
    wrongOpenFor.value = ''
    message.success('บันทึกว่าผิดแล้ว')
    loadStats()
  } catch (e) {
    message.error(apiErrorText(e))
  } finally {
    submitting.value = false
  }
}

function fmt(v?: string) {
  return v ? new Date(v).toLocaleString('th-TH') : '—'
}

onMounted(() => {
  loadOffices()
  reloadAll()
})
</script>

<template>
  <div class="page-head">
    <h1>ตรวจคำตอบ</h1>
    <p class="sub">
      เทียบคำตอบของ AI กับหน้าจอจริง แล้วบอกว่าถูกหรือผิด — ผิดต้องเลือกประเภท + พิมพ์คำตอบที่ถูกไว้เป็นชุดทดสอบถาวร
      ระบบนี้ต้องตรวจครบก่อนเปิดใช้จริง (G4)
    </p>
  </div>

  <a-card size="small" class="tidy" style="margin-bottom: 16px">
    <div class="filters">
      <a-select v-model:value="filter.office_id" placeholder="ทุก office" style="width: 160px" allow-clear @change="onOfficeChange">
        <a-select-option v-for="o in offices" :key="o.id" :value="o.id">{{ o.label }}</a-select-option>
      </a-select>
      <a-select v-model:value="filter.service_id" placeholder="ทุก service" style="width: 160px" allow-clear :disabled="!filter.office_id">
        <a-select-option v-for="s in serviceOptions" :key="s.id" :value="s.id">{{ s.label }}</a-select-option>
      </a-select>
      <a-button type="primary" :loading="loading" @click="reloadAll">ค้นหา</a-button>
    </div>
  </a-card>

  <!-- % ถูกต้องมาคู่กับจำนวนยังไม่ตรวจเสมอ (AC-28) -->
  <a-card size="small" class="tidy stats-card" style="margin-bottom: 16px">
    <a-spin v-if="statsLoading" />
    <div v-else-if="stats" class="stats">
      <div class="stat-num">
        <span class="big">{{ stats.verified > 0 ? stats.percent_correct.toFixed(1) : '—' }}<template v-if="stats.verified > 0">%</template></span>
        <span class="hint">ถูก {{ stats.correct }} จากที่ตรวจแล้ว {{ stats.verified }}</span>
      </div>
      <div class="stat-num">
        <span class="big pending">{{ stats.pending }}</span>
        <span class="hint">ยังไม่ตรวจ (จากทั้งหมด {{ stats.total }})</span>
      </div>
      <div class="basis hint">{{ stats.basis }}</div>
    </div>
  </a-card>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <div v-if="!loading && items.length === 0 && !loadError" class="empty">
    <p class="empty-title">คิวว่าง — ไม่มีคำตอบรอตรวจ</p>
    <p class="empty-sub">ตรวจครบแล้ว หรือยังไม่มีการสนทนาใหม่</p>
  </div>

  <a-card v-for="it in items" :key="it.answer.id" size="small" class="tidy queue-card">
    <div class="hint">{{ it.answer.office_id }} / {{ it.answer.service_id }} · {{ fmt(it.answer.created_at) }}</div>
    <p class="q">ถาม: {{ it.question || '—' }}</p>
    <p class="a">{{ it.answer.text }}</p>

    <div v-if="it.answer.cards.length" class="cards-summary hint">
      การ์ด: <span v-for="c in it.answer.cards" :key="c.id">{{ c.title }} ({{ c.kind }}) </span>
    </div>

    <template v-if="wrongOpenFor !== it.answer.id">
      <div class="row">
        <a-button type="primary" :loading="submitting" @click="markCorrect(it.answer.id)">ถูก</a-button>
        <a-button danger :loading="submitting" @click="openWrong(it.answer.id)">ผิด</a-button>
      </div>
    </template>
    <template v-else>
      <div class="wrong-form">
        <label class="f-label">ประเภทที่ผิด</label>
        <a-select v-model:value="wrongForm.error_type" style="width: 100%" placeholder="เลือก 1 ใน 5 ประเภท">
          <a-select-option v-for="(label, key) in errorTypes" :key="key" :value="key">{{ label }}</a-select-option>
        </a-select>
        <label class="f-label">คำตอบที่ถูกต้อง</label>
        <a-textarea v-model:value="wrongForm.correct_answer" :rows="2" placeholder="พิมพ์คำตอบที่ควรจะเป็น" />
        <label class="f-label">หมายเหตุ <span class="opt">— ไม่บังคับ</span></label>
        <a-input v-model:value="wrongForm.note" />
        <div class="row" style="margin-top: 10px">
          <a-button
            type="primary" danger :loading="submitting"
            :disabled="!wrongForm.error_type || !wrongForm.correct_answer.trim()"
            @click="submitWrong"
          >บันทึกว่าผิด</a-button>
          <a-button @click="wrongOpenFor = ''">ยกเลิก</a-button>
        </div>
      </div>
    </template>
  </a-card>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.filters { display: flex; gap: 8px; align-items: center; }
.hint { font-size: 12px; color: var(--muted); }

.stats-card :deep(.ant-card-body) { padding: 16px 20px; }
.stats { display: flex; gap: 32px; align-items: flex-end; flex-wrap: wrap; }
.stat-num { display: flex; flex-direction: column; gap: 2px; }
.big { font-family: var(--font-head); font-size: 26px; font-weight: 700; color: var(--ink); }
.big.pending { color: var(--danger); }
.basis { flex-basis: 100%; margin-top: 4px; }

.queue-card { margin-bottom: 14px; }
.q { margin: 6px 0 4px; font-size: 13px; color: var(--muted); }
.a { margin: 0 0 8px; font-size: 14px; white-space: pre-wrap; line-height: 1.6; }
.cards-summary { margin-bottom: 8px; }
.row { display: flex; gap: 8px; }
.wrong-form { margin-top: 4px; }
.f-label { display: block; font-size: 12.5px; color: var(--muted); margin: 10px 0 4px; }
.f-label .opt { color: var(--muted); font-weight: 400; }

.empty { text-align: center; padding: 40px 0; }
.empty-title { margin: 0; font-size: 14.5px; font-weight: 600; }
.empty-sub { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
</style>

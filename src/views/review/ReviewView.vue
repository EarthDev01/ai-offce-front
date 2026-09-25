<script setup lang="ts">
import { matchOption } from '@/utils/selectSearch'
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { verificationQueue, verificationStats, verify } from '@/services/api/chats'
import { listOffices } from '@/services/api/offices'
import DomainSelect from '@/components/DomainSelect.vue'
import ChatCard from '@/components/ChatCard.vue'
import type { Office, QueueItem, VerificationStats } from '@/types'

const QUEUE_SIZE = 30

const offices = ref<Office[]>([])
const filter = reactive({ office_id: undefined as string | undefined, service_id: undefined as string | undefined })
const serviceOptions = computed(() => offices.value.find((o) => o.id === filter.office_id)?.services ?? [])

const loading = ref(false)
const loadError = ref('')
const items = ref<QueueItem[]>([])
const total = ref(0)
const errorTypes = ref<Record<string, string>>({})

const stats = ref<VerificationStats | null>(null)
const statsLoading = ref(false)

async function loadStats() {
  statsLoading.value = true
  try {
    stats.value = await verificationStats(filter.office_id, filter.service_id)
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    statsLoading.value = false
  }
}

async function loadQueue() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await verificationQueue({ office_id: filter.office_id, service_id: filter.service_id, limit: QUEUE_SIZE })
    items.value = res.data
    total.value = res.total
    errorTypes.value = res.error_types
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function onOfficeChange() {
  filter.service_id = undefined
  reloadAll()
}

function reloadAll() {
  loadQueue()
  loadStats()
}

const hasFilter = computed(() => !!(filter.office_id || filter.service_id))

function resetFilters() {
  filter.office_id = undefined
  filter.service_id = undefined
  reloadAll()
}

// ปุ่มรีเฟรชหมุนเฉพาะตอนกดเอง — ไม่ผูกกับการโหลดคิวครั้งอื่น
const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  await Promise.all([loadQueue(), loadStats()])
  refreshing.value = false
}

// ---------- ตรวจ ----------
const wrongOpenFor = ref('') // message id ที่กำลังกรอกฟอร์ม "ผิด"
const wrongForm = reactive({ error_type: undefined as string | undefined, correct_answer: '', note: '' })
const submitting = ref('')

function openWrong(id: string) {
  wrongOpenFor.value = id
  wrongForm.error_type = undefined
  wrongForm.correct_answer = ''
  wrongForm.note = ''
}

function done(id: string) {
  items.value = items.value.filter((i) => i.answer.id !== id)
  total.value = Math.max(0, total.value - 1)
  loadStats()
}

async function markCorrect(id: string) {
  submitting.value = id
  try {
    await verify({ message_id: id, status: 'correct' })
    message.success('บันทึกว่าถูกแล้ว')
    done(id)
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    submitting.value = ''
  }
}

async function submitWrong() {
  const id = wrongOpenFor.value
  if (!wrongForm.error_type || !wrongForm.correct_answer.trim()) return
  submitting.value = id
  try {
    await verify({
      message_id: id, status: 'wrong', error_type: wrongForm.error_type,
      correct_answer: wrongForm.correct_answer.trim(), note: wrongForm.note.trim(),
    })
    wrongOpenFor.value = ''
    message.success('บันทึกว่าผิดแล้ว')
    done(id)
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    submitting.value = ''
  }
}

function fmt(v?: string) {
  return v ? new Date(v).toLocaleString('th-TH') : '—'
}

onMounted(async () => {
  try {
    offices.value = (await listOffices()).data
  } catch {
    /* ตัวกรอง office ว่างได้ — คิวยังโหลดได้ */
  }
  reloadAll()
})
</script>

<template>
  <div class="page-head">
    <h1>ตรวจคำตอบ</h1>
    <p class="sub">
      เทียบคำตอบของ AI กับการ์ดและหน้าจอจริง แล้วบอกว่าถูกหรือผิด — ตอบผิดต้องเลือกประเภทและพิมพ์คำตอบที่ถูกเก็บไว้เป็นชุดทดสอบ ·
      คิวมีเฉพาะคำตอบที่ตอบสำเร็จ เรียงจากเก่าสุด
    </p>
  </div>

  <a-card size="small" class="tidy" style="margin-bottom: 16px">
    <div class="filter-grid">
      <div>
        <label class="f-label">domain</label>
        <DomainSelect v-model:value="filter.office_id" :offices="offices" @change="onOfficeChange" />
      </div>
      <div>
        <label class="f-label">service</label>
        <a-select v-model:value="filter.service_id" show-search :filter-option="matchOption" placeholder="ทุก service" style="width: 100%" allow-clear :disabled="!filter.office_id" @change="reloadAll">
          <a-select-option v-for="s in serviceOptions" :key="s.id" :value="s.id" :search="`${s.id} ${s.label}`">{{ s.label }}</a-select-option>
        </a-select>
      </div>
    </div>
    <div class="filter-foot">
      <span class="f-count">รอตรวจ {{ total }} รายการ</span>
      <span class="grow" />
      <a-button v-if="hasFilter" size="small" @click="resetFilters">ล้างตัวกรอง</a-button>
      <a-button size="small" :loading="refreshing" @click="refresh">รีเฟรช</a-button>
    </div>
  </a-card>

  <!-- % ถูกต้องแสดงคู่กับจำนวนที่ยังไม่ตรวจเสมอ -->
  <a-card size="small" class="tidy stats-card" style="margin-bottom: 16px">
    <a-spin v-if="statsLoading && !stats" />
    <div v-else-if="stats" class="stats">
      <div class="stat-num">
        <span class="big">{{ stats.verified > 0 ? stats.percent_correct.toFixed(1) + '%' : '—' }}</span>
        <span class="hint">ถูก {{ stats.correct }} จากที่ตรวจแล้ว {{ stats.verified }}</span>
      </div>
      <div class="stat-num">
        <span class="big pending">{{ stats.pending }}</span>
        <span class="hint">ยังไม่ตรวจ (จากคำตอบทั้งหมด {{ stats.total }})</span>
      </div>
      <div class="basis hint">{{ stats.basis }}</div>
    </div>
  </a-card>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <div v-if="total > items.length && items.length" class="hint" style="margin-bottom: 8px">
    แสดง {{ items.length }} รายการแรกจากที่รอตรวจ {{ total }} รายการ — ตรวจเสร็จแล้วกดรีเฟรชเพื่อโหลดรายการถัดไป
  </div>

  <div v-if="!loading && items.length === 0 && !loadError" class="empty">
    <p class="empty-title">คิวว่าง — ไม่มีคำตอบรอตรวจ</p>
    <p class="empty-sub">ตรวจครบแล้ว หรือยังไม่มีการสนทนาใหม่</p>
  </div>

  <a-card v-for="it in items" :key="it.answer.id" size="small" class="tidy queue-card">
    <div class="hint">
      {{ it.answer.office_id }} / {{ it.answer.service_id }} · {{ fmt(it.answer.created_at) }}
      <template v-if="it.answer.category"> · {{ it.answer.category }}</template>
    </div>
    <p class="q">ถาม: {{ it.question || '—' }}</p>
    <p class="a">{{ it.answer.text }}</p>

    <ChatCard v-for="c in it.answer.cards ?? []" :key="c.id" :card="c" />

    <div v-if="it.answer.tool_calls?.length" class="tool-calls">
      <span v-for="(t, i) in it.answer.tool_calls" :key="i" class="tool-chip" :class="{ err: !t.ok }">
        {{ t.tool }} · {{ t.method }} {{ t.endpoint }} · {{ t.status || '—' }}<template v-if="t.cached"> · cache</template>
        <template v-if="t.error"> · {{ t.error }}</template>
      </span>
    </div>

    <div v-if="wrongOpenFor !== it.answer.id" class="row">
      <a-button type="primary" :loading="submitting === it.answer.id" @click="markCorrect(it.answer.id)">ถูก</a-button>
      <a-button danger :disabled="!!submitting" @click="openWrong(it.answer.id)">ผิด</a-button>
    </div>
    <div v-else class="wrong-form">
      <label class="f-label">ประเภทที่ผิด</label>
      <a-select v-model:value="wrongForm.error_type" show-search :filter-option="matchOption" style="width: 100%" placeholder="เลือก 1 ใน 5 ประเภท">
        <a-select-option v-for="(label, key) in errorTypes" :key="key" :value="key" :search="label">{{ label }}</a-select-option>
      </a-select>
      <label class="f-label">คำตอบที่ถูกต้อง</label>
      <a-textarea v-model:value="wrongForm.correct_answer" :rows="2" placeholder="พิมพ์คำตอบที่ควรจะเป็น" />
      <label class="f-label">หมายเหตุ <span class="opt">— ไม่บังคับ</span></label>
      <a-input v-model:value="wrongForm.note" />
      <div class="row" style="margin-top: 10px">
        <a-button
          type="primary"
          danger
          :loading="submitting === it.answer.id"
          :disabled="!wrongForm.error_type || !wrongForm.correct_answer.trim()"
          @click="submitWrong"
        >บันทึกว่าผิด</a-button>
        <a-button @click="wrongOpenFor = ''">ยกเลิก</a-button>
      </div>
    </div>
  </a-card>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
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
.tool-calls { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.tool-chip { font-size: 11px; font-family: var(--font-mono); background: var(--ground); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; }
.tool-chip.err { color: var(--danger); border-color: var(--danger); }
.row { display: flex; gap: 8px; }
.wrong-form { margin-top: 4px; }
.wrong-form .f-label { margin: 10px 0 4px; }
.wrong-form .f-label .opt { font-weight: 400; }

.empty { text-align: center; padding: 40px 0; }
.empty-title { margin: 0; font-size: 14.5px; font-weight: 600; }
.empty-sub { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
</style>

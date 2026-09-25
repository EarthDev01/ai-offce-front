<script setup lang="ts">
import { matchOption } from '@/utils/selectSearch'
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { listOffices } from '@/services/api/offices'
import DomainSelect from '@/components/DomainSelect.vue'
import { createDeletion, listAccessLog, listDeletions } from '@/services/api/ops'
import { useAuthStore } from '@/stores/auth'
import DateRangeFilter from '@/components/DateRangeFilter.vue'
import type { AccessLog, DeletionRequest, Office } from '@/types'

const auth = useAuthStore()
const canDelete = computed(() => auth.can('deletion.manage'))
const canLog = computed(() => auth.can('accesslog.view'))
const tab = ref(canDelete.value ? 'delete' : 'log')

const offices = ref<Office[]>([])

function fmt(v?: string) {
  return v ? new Date(v).toLocaleString('th-TH') : '—'
}

// ---------- ขอลบ ----------
const form = reactive({
  office_id: undefined as string | undefined,
  service_id: undefined as string | undefined,
  user: '',
  range: undefined as [string, string] | undefined, // YYYY-MM-DD ตั้งแต่–ถึง (รวมทั้งวัน)
  reason: '',
})
const serviceOptions = computed(() => offices.value.find((o) => o.id === form.office_id)?.services ?? [])
const scopeTooWide = computed(() => !form.service_id && !form.user.trim() && !form.range)
const canSubmit = computed(() => !!form.office_id && !!form.reason.trim() && !scopeTooWide.value)

const confirmOpen = ref(false)
const confirmText = ref('')
const deleting = ref(false)
const lastResult = ref<DeletionRequest | null>(null)

// วันที่ → เวลาจริงที่ส่งให้ server: ต้นวันแรก ถึง สิ้นวันสุดท้าย (เวลาเครื่อง)
function dayStart(d: string) {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(y, m - 1, dd).toISOString()
}
function dayEnd(d: string) {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(y, m - 1, dd, 23, 59, 59, 999).toISOString()
}

function askConfirm() {
  confirmText.value = ''
  confirmOpen.value = true
}

async function doDelete() {
  if (confirmText.value !== form.office_id) return
  deleting.value = true
  try {
    lastResult.value = await createDeletion({
      office_id: form.office_id!, service_id: form.service_id, user: form.user.trim() || undefined,
      from: form.range ? dayStart(form.range[0]) : undefined, to: form.range ? dayEnd(form.range[1]) : undefined,
      reason: form.reason.trim(),
    })
    confirmOpen.value = false
    message.success('ลบข้อมูลตามคำขอแล้ว')
    loadDeletions()
  } catch (e) {
    message.error((e as Error).message, 6)
    loadDeletions() // ลบไม่ครบก็ยังมีบันทึกคำขอไว้
  } finally {
    deleting.value = false
  }
}

const deletions = ref<DeletionRequest[]>([])
const delTotal = ref(0)
const delLoading = ref(false)

async function loadDeletions() {
  if (!canDelete.value) return
  delLoading.value = true
  try {
    const res = await listDeletions(50, 0)
    deletions.value = res.data
    delTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    delLoading.value = false
  }
}

function scopeText(d: DeletionRequest) {
  const s = d.scope
  const parts = [s.service_id && `service ${s.service_id}`, s.user && `ผู้ใช้ ${s.user}`]
  if (s.from || s.to) parts.push(`${fmt(s.from)} – ${fmt(s.to)}`)
  return parts.filter(Boolean).join(' · ')
}

const delColumns = [
  { title: 'เวลา', key: 'created_at', width: 170 },
  { title: 'domain', key: 'office', width: 120 },
  { title: 'ขอบเขต', key: 'scope' },
  { title: 'เหตุผล', dataIndex: 'reason', key: 'reason' },
  { title: 'ผู้ขอ', dataIndex: 'requested_by', key: 'requested_by', width: 120 },
  { title: 'ผล', key: 'status', width: 260 },
]

// ---------- บันทึกการเข้าถึง ----------
const logFilter = reactive({ office_id: undefined as string | undefined, operator: '' })
const logs = ref<AccessLog[]>([])
const logTotal = ref(0)
const logPage = ref(1)
const logLoading = ref(false)
const LOG_PAGE = 50

async function loadLogs() {
  if (!canLog.value) return
  logLoading.value = true
  try {
    const res = await listAccessLog({
      office_id: logFilter.office_id, operator: logFilter.operator.trim() || undefined,
      limit: LOG_PAGE, offset: (logPage.value - 1) * LOG_PAGE,
    })
    logs.value = res.data
    logTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    logLoading.value = false
  }
}

const logDraft = ref('') // ช่องผู้ใช้คอนโซล — ค้นเมื่อกด Enter/แว่นขยาย
const hasLogFilter = computed(() => !!(logFilter.office_id || logFilter.operator))

function searchLogs() {
  logPage.value = 1
  loadLogs()
}

function applyLogText() {
  logFilter.operator = logDraft.value.trim()
  searchLogs()
}

function resetLogFilters() {
  logFilter.office_id = undefined
  logFilter.operator = ''
  logDraft.value = ''
  searchLogs()
}

// ปุ่มรีเฟรชหมุนเฉพาะตอนกดเอง — เปลี่ยนหน้าตาราง/ตัวกรองหมุนแค่ที่ตาราง ปุ่มไม่ขยับ
const logRefreshing = ref(false)
async function refreshLogs() {
  logRefreshing.value = true
  await loadLogs()
  logRefreshing.value = false
}

const ACTION: Record<string, string> = {
  search: 'ค้นห้องแชท', read_conversation: 'เปิดอ่านห้อง', read_old: 'เปิดอ่านห้องเก่า (>90 วัน)',
  read_queue: 'เปิดคิวตรวจ', verify: 'ตรวจคำตอบ', delete: 'ลบตามคำขอ',
}

const logColumns = [
  { title: 'เวลา', key: 'at', width: 170 },
  { title: 'ผู้ใช้คอนโซล', dataIndex: 'operator', key: 'operator', width: 140 },
  { title: 'การกระทำ', key: 'action', width: 180 },
  { title: 'domain / service', key: 'service', width: 200 },
  { title: 'ห้อง / ข้อความ', key: 'target' },
  { title: 'รายละเอียด', dataIndex: 'detail', key: 'detail', ellipsis: true },
]

onMounted(async () => {
  try {
    offices.value = (await listOffices()).data
  } catch {
    /* เลือก office ไม่ได้ — ยังดูประวัติได้ */
  }
  loadDeletions()
  loadLogs()
})
</script>

<template>
  <div class="page-head">
    <h1>ลบข้อมูลตามคำขอ</h1>
    <p class="sub">ลบข้อมูลแชทถาวรตามคำขอเจ้าของข้อมูล (PDPA) — ทุกคำขอถูกเก็บเป็นใบรับรองการลบ · กู้คืนไม่ได้</p>
  </div>

  <a-tabs v-model:active-key="tab">
    <a-tab-pane v-if="canDelete" key="delete" tab="ขอลบข้อมูล">
      <a-card size="small" class="tidy" style="margin-bottom: 16px">
        <div class="grid">
          <div>
            <label>domain <span class="req">*</span></label>
            <DomainSelect v-model:value="form.office_id" :offices="offices" placeholder="เลือก domain" :allow-clear="false" @change="form.service_id = undefined" />
          </div>
          <div>
            <label>service</label>
            <a-select v-model:value="form.service_id" show-search :filter-option="matchOption" placeholder="ทุก service" style="width: 100%" allow-clear :disabled="!form.office_id">
              <a-select-option v-for="s in serviceOptions" :key="s.id" :value="s.id" :search="`${s.id} ${s.label}`">{{ s.label }}</a-select-option>
            </a-select>
          </div>
          <div>
            <label>ผู้ใช้ (id หรือ username ในหลังบ้าน)</label>
            <a-input v-model:value="form.user" placeholder="เช่น example_admin" allow-clear />
          </div>
          <div>
            <label>ช่วงวันที่ของข้อความ</label>
            <DateRangeFilter v-model="form.range" />
          </div>
        </div>
        <label style="margin-top: 12px">เหตุผล / เลขที่คำขอ <span class="req">*</span></label>
        <a-input v-model:value="form.reason" placeholder="เช่น คำขอ PDPA #12" />

        <a-alert
          v-if="form.office_id && scopeTooWide"
          type="warning"
          show-icon
          message="ต้องระบุ service, ผู้ใช้ หรือช่วงเวลาอย่างน้อย 1 อย่าง — ลบทั้ง domain ในครั้งเดียวไม่ได้"
          style="margin-top: 12px"
        />
        <div class="hint" style="margin-top: 12px">
          ลบ: ข้อความในขอบเขต · ผลตรวจของข้อความเหล่านั้น · ห้องที่ไม่เหลือข้อความ ·
          ไม่ลบ: ตัวเลขการใช้ token/สรุปรายวัน บันทึกการเข้าถึง และประวัติการทำงาน
        </div>
        <a-button type="primary" danger :disabled="!canSubmit" style="margin-top: 12px" @click="askConfirm">ลบข้อมูล…</a-button>

        <a-alert
          v-if="lastResult"
          :type="lastResult.status === 'done' ? 'success' : 'error'"
          show-icon
          style="margin-top: 12px"
          :message="`ลบแล้ว: ข้อความ ${lastResult.result.messages} · ห้อง ${lastResult.result.conversations} · ผลตรวจ ${lastResult.result.verifications}`"
        />
      </a-card>

      <a-card size="small" class="tidy" :title="`ประวัติคำขอลบ (${delTotal})`">
        <a-table :columns="delColumns" :data-source="deletions" :loading="delLoading" row-key="id" size="middle" :pagination="false">
          <template #emptyText><div class="hint" style="padding: 16px">ยังไม่มีคำขอลบ</div></template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'created_at'">{{ fmt(record.created_at) }}</template>
            <template v-else-if="column.key === 'office'">{{ record.scope.office_id }}</template>
            <template v-else-if="column.key === 'scope'">{{ scopeText(record) }}</template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.status === 'done' ? 'green' : record.status === 'failed' ? 'red' : 'orange'">{{ record.status }}</a-tag>
              <span class="hint">ข้อความ {{ record.result.messages }} · ห้อง {{ record.result.conversations }} · ผลตรวจ {{ record.result.verifications }}</span>
              <div v-if="record.error" class="err">{{ record.error }}</div>
            </template>
          </template>
        </a-table>
      </a-card>
    </a-tab-pane>

    <a-tab-pane v-if="canLog" key="log" tab="บันทึกการเข้าถึง">
      <a-card size="small" class="tidy">
        <div class="filter-grid">
          <div>
            <label class="f-label">domain</label>
            <DomainSelect v-model:value="logFilter.office_id" :offices="offices" @change="searchLogs" />
          </div>
          <div>
            <label class="f-label">ผู้ใช้คอนโซล</label>
            <a-input-search v-model:value="logDraft" placeholder="username" allow-clear @search="applyLogText" />
          </div>
        </div>
        <div class="filter-foot" style="margin-bottom: 12px">
          <span class="f-count">ใครเปิดดู ค้น ตรวจ หรือลบข้อมูลแชท เมื่อไหร่ · {{ logTotal }} รายการ</span>
          <span class="grow" />
          <a-button v-if="hasLogFilter" size="small" @click="resetLogFilters">ล้างตัวกรอง</a-button>
          <a-button size="small" :loading="logRefreshing" @click="refreshLogs">รีเฟรช</a-button>
        </div>
        <a-table
          :columns="logColumns"
          :data-source="logs"
          :loading="logLoading"
          row-key="id"
          size="middle"
          :pagination="{ current: logPage, pageSize: LOG_PAGE, total: logTotal, showSizeChanger: false, onChange: (p: number) => { logPage = p; loadLogs() } }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'at'">{{ fmt(record.at) }}</template>
            <template v-else-if="column.key === 'action'">{{ ACTION[record.action] ?? record.action }}</template>
            <template v-else-if="column.key === 'service'">{{ record.office_id || '—' }} / {{ record.service_id || '—' }}</template>
            <template v-else-if="column.key === 'target'"><code v-if="record.conversation_id">{{ record.conversation_id }}</code><code v-if="record.message_id"> {{ record.message_id }}</code></template>
          </template>
        </a-table>
      </a-card>
    </a-tab-pane>
  </a-tabs>

  <a-modal
    :open="confirmOpen"
    title="ยืนยันการลบ — ทำแล้วกู้คืนไม่ได้"
    ok-text="ลบถาวร"
    cancel-text="ยกเลิก"
    :ok-button-props="{ danger: true, disabled: confirmText !== form.office_id, loading: deleting }"
    @ok="doDelete"
    @cancel="confirmOpen = false"
  >
    <p>พิมพ์รหัส domain <code>{{ form.office_id }}</code> เพื่อยืนยัน</p>
    <a-input v-model:value="confirmText" :placeholder="form.office_id" />
  </a-modal>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.hint { font-size: 12px; color: var(--muted); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
label:not(.f-label) { display: block; font-size: 13px; margin-bottom: 4px; }
.req { color: var(--danger); }
.err { color: var(--danger); font-size: 12px; margin-top: 2px; }
</style>

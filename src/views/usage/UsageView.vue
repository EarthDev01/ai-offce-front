<script setup lang="ts">
import { matchOption } from '@/utils/selectSearch'
import { computed, onMounted, reactive, ref } from 'vue'
import { listOffices } from '@/services/api/offices'
import DomainSelect from '@/components/DomainSelect.vue'
import { listRollups, listUsage } from '@/services/api/ops'
import type { Dayjs } from 'dayjs'
import DateRangeFilter from '@/components/DateRangeFilter.vue'
import type { DailyRollup, Office, UsagePeriod } from '@/types'

const offices = ref<Office[]>([])
// token ของผู้ช่วย AI ในคอนโซลนับแยกไว้ใต้รหัสนี้ (ไม่ใช่ domain ของลูกค้า)
const CONSOLE_USAGE = '_console'
const nf = new Intl.NumberFormat('th-TH')
const n = (v: number) => nf.format(v ?? 0)

function labelOf(officeID: string, serviceID: string) {
  if (officeID === CONSOLE_USAGE) return 'ผู้ช่วยคอนโซล'
  const o = offices.value.find((x) => x.id === officeID)
  const s = o?.services.find((x) => x.id === serviceID)
  return `${o?.label ?? officeID} / ${s?.label ?? serviceID}`
}

// ---------- รายเดือน ----------
const period = ref('') // YYYY-MM · ว่าง = เดือนนี้ (server ตัดสินตามเวลาไทย)
const usage = ref<UsagePeriod[]>([])
const usageLoading = ref(false)
const usageError = ref('')

function totalOf(u: { input_tokens: number; output_tokens: number; cache_read: number; cache_write: number }) {
  return u.input_tokens + u.output_tokens + u.cache_read + u.cache_write
}

const usageTotal = computed(() =>
  usage.value.reduce(
    (a, u) => ({ questions: a.questions + u.questions, tokens: a.tokens + totalOf(u) }),
    { questions: 0, tokens: 0 },
  ),
)

async function loadUsage() {
  usageLoading.value = true
  usageError.value = ''
  try {
    const res = await listUsage(period.value || undefined)
    period.value = res.period
    usage.value = res.data
  } catch (e) {
    usageError.value = (e as Error).message
  } finally {
    usageLoading.value = false
  }
}

const usageColumns = [
  { title: 'domain / service', key: 'service' },
  { title: 'คำถาม', key: 'questions', align: 'right' as const },
  { title: 'input', key: 'input_tokens', align: 'right' as const },
  { title: 'output', key: 'output_tokens', align: 'right' as const },
  { title: 'cache อ่าน / เขียน', key: 'cache', align: 'right' as const },
  { title: 'รวม token', key: 'total', align: 'right' as const },
  { title: 'เฉลี่ยต่อคำถาม', key: 'avg', align: 'right' as const },
]

// ---------- รายวัน ----------
const filter = reactive({
  office_id: undefined as string | undefined,
  service_id: undefined as string | undefined,
  range: undefined as [string, string] | undefined, // ไม่เลือก = 30 วันล่าสุด (server ตัดสิน)
})
const hasFilter = computed(() => !!(filter.office_id || filter.service_id || filter.range))
const serviceOptions = computed(() => offices.value.find((o) => o.id === filter.office_id)?.services ?? [])
const rollups = ref<DailyRollup[]>([])
const rollLoading = ref(false)
const rollError = ref('')

async function loadRollups() {
  rollLoading.value = true
  rollError.value = ''
  try {
    rollups.value = (
      await listRollups({ office_id: filter.office_id, service_id: filter.service_id, from: filter.range?.[0], to: filter.range?.[1] })
    ).data
  } catch (e) {
    rollError.value = (e as Error).message
  } finally {
    rollLoading.value = false
  }
}

function onOfficeChange() {
  filter.service_id = undefined
  loadRollups()
}

function resetRollFilters() {
  Object.assign(filter, { office_id: undefined, service_id: undefined, range: undefined })
  loadRollups()
}

// ปุ่มรีเฟรชหมุนเฉพาะตอนกดเอง
const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  await Promise.all([loadUsage(), loadRollups()])
  refreshing.value = false
}

// เลือกเดือนในอนาคตไม่ได้
function futureMonth(current: Dayjs) {
  const now = new Date()
  return current.format('YYYY-MM') > `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const rollColumns = [
  { title: 'วันที่', dataIndex: 'date', key: 'date' },
  { title: 'domain / service', key: 'service' },
  { title: 'ห้องใหม่', key: 'conversations', align: 'right' as const },
  { title: 'คำถาม', key: 'questions', align: 'right' as const },
  { title: 'token in / out', key: 'tokens', align: 'right' as const },
  { title: 'ปฏิเสธ', key: 'refusals', align: 'right' as const },
  { title: 'tool ล้ม', key: 'tool_errors', align: 'right' as const },
  { title: 'guard', key: 'guard_hits', align: 'right' as const },
  { title: 'ตรวจ ถูก / ผิด', key: 'verify', align: 'right' as const },
]

onMounted(async () => {
  try {
    offices.value = (await listOffices()).data
  } catch {
    /* แสดง id แทนชื่อได้ */
  }
  loadUsage()
  loadRollups()
})
</script>

<template>
  <div class="page-head">
    <h1>การใช้งาน token</h1>
    <p class="sub">
      token ที่ผู้ช่วยใช้ต่อ service — นับจากตัวเลขที่ผู้ให้บริการ LLM ส่งกลับมาทุกครั้งที่เรียก (คำตอบ 1 ข้อเรียก 1–2 รอบ) ·
      ยังไม่มีการจำกัดหรือคิดเงิน
    </p>
  </div>

  <a-card size="small" class="tidy" style="margin-bottom: 16px">
    <div class="filter-grid">
      <div>
        <label class="f-label">เดือน</label>
        <a-date-picker
          v-model:value="period"
          picker="month"
          value-format="YYYY-MM"
          format="MM/YYYY"
          placeholder="เดือนนี้"
          :disabled-date="futureMonth"
          style="width: 100%"
          @change="loadUsage"
        />
      </div>
    </div>
    <div class="filter-foot" style="margin-bottom: 12px">
      <span class="f-count">รายเดือน · รวม {{ n(usageTotal.questions) }} คำถาม · {{ n(usageTotal.tokens) }} token</span>
      <span class="grow" />
      <a-button size="small" :loading="refreshing" @click="refresh">รีเฟรช</a-button>
    </div>
    <a-alert v-if="usageError" type="error" :message="usageError" show-icon style="margin-bottom: 12px" />
    <a-table :columns="usageColumns" :data-source="usage" :loading="usageLoading" :pagination="false" row-key="id" size="middle">
      <template #emptyText><div class="hint" style="padding: 16px">ยังไม่มีการใช้งานในเดือนนี้</div></template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'service'">{{ labelOf(record.office_id, record.service_id) }}</template>
        <template v-else-if="column.key === 'questions'">{{ n(record.questions) }}</template>
        <template v-else-if="column.key === 'input_tokens'">{{ n(record.input_tokens) }}</template>
        <template v-else-if="column.key === 'output_tokens'">{{ n(record.output_tokens) }}</template>
        <template v-else-if="column.key === 'cache'">{{ n(record.cache_read) }} / {{ n(record.cache_write) }}</template>
        <template v-else-if="column.key === 'total'"><strong>{{ n(totalOf(record)) }}</strong></template>
        <template v-else-if="column.key === 'avg'">{{ record.questions ? n(Math.round(totalOf(record) / record.questions)) : '—' }}</template>
      </template>
    </a-table>
  </a-card>

  <a-card size="small" class="tidy">
    <div class="filter-grid">
      <div>
        <label class="f-label">domain</label>
        <DomainSelect v-model:value="filter.office_id" :offices="offices" @change="onOfficeChange" />
      </div>
      <div>
        <label class="f-label">service</label>
        <a-select v-model:value="filter.service_id" show-search :filter-option="matchOption" placeholder="ทุก service" style="width: 100%" allow-clear :disabled="!filter.office_id" @change="loadRollups">
          <a-select-option v-for="s in serviceOptions" :key="s.id" :value="s.id" :search="`${s.id} ${s.label}`">{{ s.label }}</a-select-option>
        </a-select>
      </div>
      <div class="span-2">
        <label class="f-label">ช่วงวันที่ <span class="f-hint">(ไม่เลือก = 30 วันล่าสุด)</span></label>
        <DateRangeFilter v-model="filter.range" @change="loadRollups" />
      </div>
    </div>
    <div class="filter-foot" style="margin-bottom: 12px">
      <span class="f-count">สรุปรายวัน · {{ rollups.length }} แถว</span>
      <span class="grow" />
      <a-button v-if="hasFilter" size="small" @click="resetRollFilters">ล้างตัวกรอง</a-button>
    </div>
    <a-alert v-if="rollError" type="error" :message="rollError" show-icon style="margin: 12px 0" />
    <a-table :columns="rollColumns" :data-source="rollups" :loading="rollLoading" :pagination="{ pageSize: 31 }" row-key="id" size="middle">
      <template #emptyText><div class="hint" style="padding: 16px">ไม่มีข้อมูลในช่วงนี้</div></template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'service'">{{ labelOf(record.office_id, record.service_id) }}</template>
        <template v-else-if="column.key === 'conversations'">{{ n(record.conversations) }}</template>
        <template v-else-if="column.key === 'questions'">{{ n(record.questions) }}</template>
        <template v-else-if="column.key === 'tokens'">
          {{ n(record.input_tokens + record.cache_read + record.cache_write) }} / {{ n(record.output_tokens) }}
        </template>
        <template v-else-if="column.key === 'refusals'">{{ n(record.refusals) }}</template>
        <template v-else-if="column.key === 'tool_errors'">
          <span :class="{ bad: record.tool_errors > 0 }">{{ n(record.tool_errors) }}</span>
        </template>
        <template v-else-if="column.key === 'guard_hits'">{{ n(record.guard_hits) }}</template>
        <template v-else-if="column.key === 'verify'">{{ n(record.correct) }} / {{ n(record.wrong) }}</template>
      </template>
    </a-table>
  </a-card>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.hint { font-size: 12px; color: var(--muted); font-weight: 400; }
.bad { color: var(--danger); font-weight: 600; }
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'
import type { Dayjs } from 'dayjs'
import { listAuditActors, listAuditLogs } from '@/services/api/audit'
import AuditValue from '@/components/AuditValue.vue'
import {
  ACTION_LABELS, CATEGORY_META, META_LABELS, REASON_LABELS, actionVerb, fieldLabel,
} from '@/utils/auditLabels'
import type { AuditEntry, AuditQuery } from '@/services/api/types'

const route = useRoute()
const router = useRouter()

// ---------- ตัวกรอง (ผูกกับ URL — ลิงก์จากหน้าผู้ใช้ / refresh แล้วยังอยู่) ----------
interface Filters {
  actor: string
  category: string
  action: string
  status: string
  target_type: string
  target_id: string
  q: string
  from: string // YYYY-MM-DD (วันตามเวลาเครื่อง)
  to: string // YYYY-MM-DD (รวมทั้งวัน)
  page: number
  page_size: number
}

const PAGE_SIZE_DEFAULT = 50

// ประวัติไม่มีวันหมดอายุ server จึงให้ค้นทีละช่วง: ไม่เลือก = 30 วันล่าสุด · กว้างสุด 62 วัน (2 เดือน)
const RANGE_DEFAULT_DAYS = 30
const RANGE_MAX_DAYS = 62

// YYYY-MM-DD ตามเวลาเครื่อง
function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number)
  return ymd(new Date(y, m - 1, d + n))
}
function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}
function defaultRange() {
  const to = ymd(new Date())
  return { from: addDays(to, -(RANGE_DEFAULT_DAYS - 1)), to }
}

function str(v: LocationQuery[string]) {
  return typeof v === 'string' ? v : ''
}

function filtersFromQuery(q: LocationQuery): Filters {
  const to = str(q.to) || defaultRange().to
  const from = str(q.from) || addDays(to, -(RANGE_DEFAULT_DAYS - 1))
  return {
    actor: str(q.actor),
    category: str(q.category),
    action: str(q.action),
    status: str(q.status),
    target_type: str(q.target_type),
    target_id: str(q.target_id),
    q: str(q.q),
    from,
    to,
    page: Number(str(q.page)) || 1,
    page_size: Number(str(q.page_size)) || PAGE_SIZE_DEFAULT,
  }
}

const filters = reactive<Filters>(filtersFromQuery(route.query))
const searchDraft = ref(filters.q)

// ล้างช่วงวันที่ (กด x) = กลับไปใช้ 30 วันล่าสุด ไม่ใช่ "ทั้งหมด"
const dateRange = computed<[string, string] | undefined>({
  get: () => (filters.from && filters.to ? ([filters.from, filters.to] as [string, string]) : undefined),
  set: (v: [string, string] | undefined) => {
    const d = v?.[0] && v?.[1] ? { from: v[0], to: v[1] } : defaultRange()
    filters.from = d.from
    filters.to = d.to
  },
})

// วันแรกที่คลิกระหว่างเลือกช่วง — ใช้ปิดวันที่ห่างเกิน RANGE_MAX_DAYS
const pickingFrom = ref<string | null>(null)

function onCalendarChange(v: [unknown, unknown] | null) {
  const first = v?.[0] ?? v?.[1]
  pickingFrom.value = !first ? null : typeof first === 'string' ? first : (first as Dayjs).format('YYYY-MM-DD')
}

function disabledDate(current: Dayjs) {
  const day = current.format('YYYY-MM-DD')
  if (day > ymd(new Date())) return true // ยังไม่มีประวัติในอนาคต
  if (!pickingFrom.value) return false
  return Math.abs(daysBetween(pickingFrom.value, day)) > RANGE_MAX_DAYS - 1
}

function pushQuery(resetPage = true) {
  if (resetPage) filters.page = 1
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(filters)) {
    if (k === 'page' && v === 1) continue
    if (k === 'page_size' && v === PAGE_SIZE_DEFAULT) continue
    if (v !== '' && v !== undefined) q[k] = String(v)
  }
  router.replace({ query: q })
}

function resetFilters() {
  Object.assign(filters, filtersFromQuery({}))
  searchDraft.value = ''
  pushQuery()
}

function applySearch() {
  filters.q = searchDraft.value.trim()
  pushQuery()
}

const isDefaultRange = computed(() => {
  const d = defaultRange()
  return filters.from === d.from && filters.to === d.to
})

const hasFilter = computed(() =>
  !!(filters.actor || filters.category || filters.action || filters.status || filters.target_type ||
    filters.target_id || filters.q || !isDefaultRange.value),
)

// วันที่ในตัวกรองเป็นเวลาเครื่อง → แปลงเป็นช่วง [เที่ยงคืนวันแรก, เที่ยงคืนวันถัดจากวันสุดท้าย)
function dayStartISO(day: string, addDays = 0) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d + addDays).toISOString()
}

function toApiQuery(f: Filters): AuditQuery {
  return {
    actor: f.actor, category: f.category, action: f.action, status: f.status,
    target_type: f.target_type, target_id: f.target_id, q: f.q,
    from: f.from ? dayStartISO(f.from) : undefined,
    to: f.to ? dayStartISO(f.to, 1) : undefined,
    page: f.page, page_size: f.page_size,
  }
}

// ---------- โหลดข้อมูล ----------
const items = ref<AuditEntry[]>([])
const total = ref(0)
const totalCapped = ref(false)
const loading = ref(false)
const loadError = ref('')
const actors = ref<string[]>([])
let seq = 0

async function reload() {
  const my = ++seq
  loading.value = true
  loadError.value = ''
  try {
    const res = await listAuditLogs(toApiQuery(filters))
    if (my !== seq) return // ผลของ request เก่าที่กลับมาช้า ไม่เอามาทับ
    items.value = res.items
    total.value = res.total
    totalCapped.value = res.total_capped
  } catch (e) {
    if (my === seq) loadError.value = (e as Error).message
  } finally {
    if (my === seq) loading.value = false
  }
}

async function loadActors() {
  try {
    actors.value = (await listAuditActors()).actors
  } catch {
    /* ตัวกรองผู้ใช้ว่างได้ ไม่บล็อกหน้า */
  }
}

watch(
  () => route.query,
  (q) => {
    Object.assign(filters, filtersFromQuery(q))
    searchDraft.value = filters.q
    reload()
  },
)

onMounted(() => {
  reload()
  loadActors()
})

// ---------- ตาราง ----------
const columns = [
  { title: 'เวลา', key: 'at', width: 150 },
  { title: 'ผู้ใช้', key: 'actor', width: 150 },
  { title: 'การกระทำ', key: 'action', width: 170 },
  { title: 'รายละเอียด', key: 'summary' },
  { title: 'ผล', key: 'status', width: 110 },
  { title: 'IP', key: 'ip', width: 200 }, // IPv6 เต็มยาวได้ถึง 39 ตัว
]

const pagination = computed(() => ({
  current: filters.page,
  pageSize: filters.page_size,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100', '200'],
  showTotal: (t: number, range: [number, number]) =>
    `${range[0]}–${range[1]} จาก ${t.toLocaleString('th-TH')}${totalCapped.value ? '+' : ''} รายการ`,
}))

function onTableChange(p: { current?: number; pageSize?: number }) {
  const sizeChanged = p.pageSize && p.pageSize !== filters.page_size
  filters.page_size = p.pageSize ?? filters.page_size
  filters.page = sizeChanged ? 1 : (p.current ?? 1)
  pushQuery(false)
}

const categoryOptions = Object.entries(CATEGORY_META).map(([value, m]) => ({ value, label: m.label }))

// เลือกหมวดแล้ว dropdown การกระทำโชว์เฉพาะของหมวดนั้น
const actionOptions = computed(() =>
  Object.entries(ACTION_LABELS)
    .filter(([k]) => !filters.category || k.startsWith(filters.category + '.'))
    .map(([value, label]) => ({ value, label })),
)

watch(
  () => filters.category,
  (c) => {
    if (filters.action && c && !filters.action.startsWith(c + '.')) filters.action = ''
  },
)

function actionLabel(a: string) {
  return ACTION_LABELS[a] ?? a
}

function categoryOf(e: AuditEntry) {
  return CATEGORY_META[e.category] ?? { label: e.category, color: 'default' }
}

function fmtTime(v: string) {
  return new Date(v).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function fmtFull(v: string) {
  return new Date(v).toLocaleString('th-TH', { dateStyle: 'full', timeStyle: 'medium' })
}

const rtf = new Intl.RelativeTimeFormat('th', { numeric: 'auto' })
function relTime(v: string) {
  const sec = Math.round((new Date(v).getTime() - Date.now()) / 1000)
  const abs = Math.abs(sec)
  if (abs < 60) return 'เมื่อสักครู่'
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), 'day')
  return ''
}

// user-agent ยาวอ่านยาก — ย่อเป็น "เบราว์เซอร์ · ระบบ" แล้วเก็บตัวเต็มไว้ใน title
function shortUA(ua: string) {
  if (!ua) return '—'
  const browser =
    /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''
  const os =
    /Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS'
      : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : ''
  return [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 40)
}

function targetText(e: AuditEntry) {
  if (!e.target_type || e.target_type === 'role_matrix') return ''
  const kind: Record<string, string> = { office: 'office', service: 'service', user: 'ผู้ใช้', role: 'role' }
  const name = e.target_label && e.target_label !== e.target_id ? `${e.target_label} · ${e.target_id}` : e.target_id
  return `${kind[e.target_type] ?? e.target_type}: ${name}`
}

function changeFieldLabel(e: AuditEntry, field: string) {
  // matrix สิทธิ์: field = role key
  if (e.target_type === 'role_matrix') return `role ${field}`
  return fieldLabel(e.target_type, field)
}

function isPermissionList(e: AuditEntry, field: string) {
  return e.target_type === 'role_matrix' || field === 'permissions'
}

function metaEntries(e: AuditEntry) {
  return Object.entries(e.meta ?? {}).filter(([, v]) => v !== '')
}

// เจาะดูเฉพาะคนนี้ / เป้าหมายนี้ จากในตาราง
function filterActor(a: string) {
  filters.actor = a
  pushQuery()
}
function filterTarget(e: AuditEntry) {
  filters.target_type = e.target_type
  filters.target_id = e.target_id
  pushQuery()
}
function clearTarget() {
  filters.target_type = ''
  filters.target_id = ''
  pushQuery()
}

const VERB_ICON: Record<string, string> = {
  create: 'M12 5v14M5 12h14',
  update: 'M4 20h4L19 9l-4-4L4 16v4Z',
  delete: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  auth: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  deny: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM5.6 5.6l12.8 12.8',
}
</script>

<template>
  <div class="page-head">
    <h1>ประวัติการทำงาน</h1>
    <p class="sub">
      ทุกการเข้าสู่ระบบ สร้าง แก้ไข และลบในคอนโซล — ใคร ทำอะไร กับอะไร เมื่อไร จากที่ไหน
      กดที่แถวเพื่อดูค่าก่อน–หลังของแต่ละช่องที่ถูกแก้
    </p>
  </div>

  <a-card size="small" class="tidy filters">
    <div class="filter-grid">
      <div>
        <label class="f-label">ผู้ใช้</label>
        <a-select
          v-model:value="filters.actor"
          show-search
          allow-clear
          placeholder="ทุกคน"
          style="width: 100%"
          :options="actors.map((a) => ({ value: a, label: a }))"
          @change="pushQuery()"
        />
      </div>
      <div>
        <label class="f-label">หมวด</label>
        <a-select
          v-model:value="filters.category"
          allow-clear
          placeholder="ทุกหมวด"
          style="width: 100%"
          :options="categoryOptions"
          @change="pushQuery()"
        />
      </div>
      <div>
        <label class="f-label">การกระทำ</label>
        <a-select
          v-model:value="filters.action"
          allow-clear
          show-search
          option-filter-prop="label"
          placeholder="ทั้งหมด"
          style="width: 100%"
          :options="actionOptions"
          @change="pushQuery()"
        />
      </div>
      <div>
        <label class="f-label">ผล</label>
        <a-select v-model:value="filters.status" allow-clear placeholder="ทั้งหมด" style="width: 100%" @change="pushQuery()">
          <a-select-option value="success">สำเร็จ</a-select-option>
          <a-select-option value="failure">ไม่สำเร็จ</a-select-option>
        </a-select>
      </div>
      <div class="span-2">
        <label class="f-label">ช่วงวันที่ <span class="f-hint">(สูงสุด 2 เดือน)</span></label>
        <a-range-picker
          v-model:value="dateRange"
          value-format="YYYY-MM-DD"
          format="DD/MM/YYYY"
          :placeholder="['ตั้งแต่', 'ถึง']"
          :disabled-date="disabledDate"
          style="width: 100%"
          @calendar-change="onCalendarChange"
          @open-change="(open: boolean) => { if (!open) pickingFrom = null }"
          @change="pushQuery()"
        />
      </div>
      <div class="span-2">
        <label class="f-label">ค้นหา</label>
        <a-input-search
          v-model:value="searchDraft"
          placeholder="ชื่อ office / service / ผู้ใช้ / IP / ข้อความ"
          allow-clear
          @search="applySearch"
        />
      </div>
    </div>
    <div class="filter-foot">
      <span v-if="filters.target_id" class="target-chip">
        เฉพาะ {{ filters.target_type }}: <b>{{ filters.target_id }}</b>
        <a @click="clearTarget">ล้าง</a>
      </span>
      <span class="grow" />
      <a-button v-if="hasFilter" size="small" @click="resetFilters">ล้างตัวกรอง</a-button>
      <a-button size="small" :loading="loading" @click="reload">รีเฟรช</a-button>
    </div>
  </a-card>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin: 16px 0" />

  <a-card size="small" class="tidy">
    <a-table
      class="audit-table"
      :columns="columns"
      :data-source="items"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="middle"
      :expand-row-by-click="true"
      :scroll="{ x: 1000 }"
      table-layout="fixed"
      @change="onTableChange"
    >
      <template #emptyText>
        <div class="empty">
          <p class="empty-title">{{ hasFilter ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีประวัติ' }}</p>
          <p class="empty-sub">{{ hasFilter ? 'ลองขยายช่วงวันที่หรือล้างตัวกรอง' : 'ประวัติจะเริ่มบันทึกตั้งแต่ตอนนี้เป็นต้นไป' }}</p>
        </div>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'at'">
          <div class="time" :title="fmtFull(record.at)">{{ fmtTime(record.at) }}</div>
          <div class="rel">{{ relTime(record.at) }}</div>
        </template>

        <template v-else-if="column.key === 'actor'">
          <a class="actor" :title="`ดูเฉพาะ ${record.actor}`" @click.stop="filterActor(record.actor)">
            <span class="avatar" aria-hidden="true">{{ (record.actor || '?').charAt(0).toUpperCase() }}</span>
            <span class="actor-text">
              <span class="actor-name">{{ record.actor || '—' }}</span>
              <span v-if="record.actor_role" class="actor-role">{{ record.actor_role }}</span>
              <span v-else-if="!record.actor_id" class="actor-role">ไม่ได้ล็อกอิน</span>
            </span>
          </a>
        </template>

        <template v-else-if="column.key === 'action'">
          <div class="action">
            <span class="verb" :class="actionVerb(record.action)" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path :d="VERB_ICON[actionVerb(record.action)]" />
              </svg>
            </span>
            <span class="action-text">
              <span class="action-name">{{ actionLabel(record.action) }}</span>
              <a-tag :color="categoryOf(record).color" class="cat">{{ categoryOf(record).label }}</a-tag>
            </span>
          </div>
        </template>

        <template v-else-if="column.key === 'summary'">
          <div class="summary">{{ record.summary }}</div>
          <div class="meta-line">
            <a v-if="targetText(record)" class="target" @click.stop="filterTarget(record)">{{ targetText(record) }}</a>
            <span v-if="record.changes?.length" class="n-changes">แก้ {{ record.changes.length }} ช่อง</span>
          </div>
        </template>

        <template v-else-if="column.key === 'status'">
          <a-tag v-if="record.status === 'success'" color="green">สำเร็จ</a-tag>
          <template v-else>
            <a-tag color="red">ไม่สำเร็จ</a-tag>
            <div v-if="record.reason" class="reason">{{ REASON_LABELS[record.reason] ?? record.reason }}</div>
          </template>
        </template>

        <template v-else-if="column.key === 'ip'">
          <span class="mono">{{ record.ip || '—' }}</span>
          <div class="rel" :title="record.user_agent">{{ shortUA(record.user_agent) }}</div>
        </template>
      </template>

      <template #expandedRowRender="{ record }">
        <div class="detail">
          <section v-if="record.changes?.length">
            <h3>สิ่งที่เปลี่ยน</h3>
            <table class="diff">
              <thead>
                <tr><th>ช่อง</th><th>ก่อน</th><th aria-hidden="true" /><th>หลัง</th></tr>
              </thead>
              <tbody>
                <tr v-for="c in record.changes" :key="c.field">
                  <td class="field">
                    {{ changeFieldLabel(record, c.field) }}
                    <span v-if="changeFieldLabel(record, c.field) !== c.field" class="raw">{{ c.field }}</span>
                  </td>
                  <td class="before">
                    <AuditValue :field="c.field" :value="c.before" :other="c.after" side="before" :permissions="isPermissionList(record, c.field)" />
                  </td>
                  <td class="arrow" aria-hidden="true">→</td>
                  <td class="after">
                    <AuditValue :field="c.field" :value="c.after" :other="c.before" side="after" :permissions="isPermissionList(record, c.field)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section v-if="metaEntries(record).length">
            <h3>ข้อมูลเพิ่มเติม</h3>
            <dl class="kv">
              <template v-for="[k, v] in metaEntries(record)" :key="k">
                <dt>{{ META_LABELS[k] ?? k }}</dt>
                <dd>{{ k === 'locked_until' ? fmtFull(v) : v }}</dd>
              </template>
            </dl>
          </section>

          <section>
            <h3>คำขอ</h3>
            <dl class="kv">
              <dt>เวลา</dt><dd>{{ fmtFull(record.at) }}</dd>
              <dt>ผู้ใช้</dt>
              <dd>{{ record.actor || '—' }}<span v-if="record.actor_role"> · {{ record.actor_role }}</span><span v-if="record.actor_id" class="mono dim"> · {{ record.actor_id }}</span></dd>
              <dt>การกระทำ</dt><dd class="mono">{{ record.action }}</dd>
              <dt>API</dt><dd class="mono">{{ record.method }} {{ record.path }}</dd>
              <dt>IP</dt><dd class="mono">{{ record.ip || '—' }}</dd>
              <dt>อุปกรณ์</dt><dd class="ua">{{ record.user_agent || '—' }}</dd>
              <dt>รหัสรายการ</dt><dd class="mono dim">{{ record.id }}</dd>
            </dl>
          </section>
        </div>
      </template>
    </a-table>
  </a-card>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.filters { margin-bottom: 16px; }
.filter-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px 12px; }
.span-2 { grid-column: span 2; }
.f-label { display: block; font-size: 12.5px; color: var(--muted); margin: 4px 0 4px; }
.f-hint { opacity: 0.75; }
.filter-foot { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.grow { flex: 1; }
.target-chip { font-size: 13px; color: var(--muted); background: var(--accent-soft); padding: 2px 10px; border-radius: var(--r-tag); }
.target-chip b { color: var(--accent-strong); }
.target-chip a { margin-left: 8px; }

.audit-table :deep(.ant-table-thead > tr > th) {
  background: var(--ground); color: var(--muted); font-weight: 600; font-size: 12.5px; border-bottom-color: var(--line);
}
.audit-table :deep(.ant-table-tbody > tr > td) { vertical-align: top; border-bottom-color: var(--line); }
.audit-table :deep(.ant-table-tbody > tr.ant-table-row:hover > td) { background: var(--accent-soft); cursor: pointer; }
.audit-table :deep(.ant-table-expanded-row > td) { background: #fafbfb; }

.time { font-size: 13px; white-space: nowrap; }
.rel { font-size: 12px; color: var(--muted); }

.actor { display: flex; align-items: center; gap: 8px; color: var(--ink); }
.actor:hover .actor-name { color: var(--accent-strong); text-decoration: underline; }
.avatar {
  display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%;
  background: var(--accent-soft); color: var(--accent-strong); font-size: 12px; font-weight: 600; flex: none;
}
.actor-text { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
.actor-name { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.actor-role { font-size: 11.5px; color: var(--muted); }

.action { display: flex; gap: 8px; align-items: flex-start; }
.verb {
  display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 7px; flex: none; margin-top: 1px;
}
.verb.create { background: #e8f5ec; color: #1f6b36; }
.verb.update { background: #e8f0fb; color: #2455a4; }
.verb.delete { background: #fbecea; color: var(--danger); }
.verb.auth { background: var(--ground); color: var(--muted); }
.verb.deny { background: #fdf0e4; color: #b4541a; }
.action-text { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; line-height: 1.3; }
.action-name { font-size: 13.5px; font-weight: 600; }
.cat { margin: 0; font-size: 11px; line-height: 18px; }

.summary { font-size: 13.5px; word-break: break-word; }
.meta-line { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 2px; font-size: 12px; }
.target { color: var(--muted); }
.target:hover { color: var(--accent-strong); text-decoration: underline; }
.n-changes { color: var(--accent-strong); }
.reason { font-size: 12px; color: var(--danger); margin-top: 2px; }
.mono { font-family: var(--font-mono); font-size: 12.5px; word-break: break-all; }
.dim { color: var(--muted); }

.detail { display: flex; flex-direction: column; gap: 18px; padding: 6px 4px 10px; }
.detail h3 { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
.diff { width: 100%; border-collapse: collapse; font-size: 13px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.diff th { text-align: left; font-weight: 600; font-size: 12px; color: var(--muted); padding: 8px 12px; background: var(--ground); }
.diff td { padding: 9px 12px; border-top: 1px solid var(--line); vertical-align: top; }
.diff .field { width: 200px; font-weight: 600; }
.diff .raw { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--muted); font-weight: 400; }
.diff .before { width: 42%; color: #7a3e38; }
.diff .after { width: 42%; color: #1f5a33; }
.diff .arrow { width: 24px; color: var(--muted); text-align: center; }

.kv { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; margin: 0; font-size: 13px; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; word-break: break-word; }
.ua { font-size: 12px; color: var(--muted); }

.empty { padding: 28px 16px; text-align: center; }
.empty-title { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--ink); }
.empty-sub { margin: 0; font-size: 13px; color: var(--muted); }

/* จอกว้าง: ตัวกรองทั้งหมดอยู่แถวเดียว (4 dropdown + ช่วงวันที่ 2 ช่อง + ค้นหา 2 ช่อง = 8) */
@media (min-width: 1600px) {
  .filter-grid { grid-template-columns: repeat(8, minmax(0, 1fr)); }
}

@media (max-width: 860px) {
  .filter-grid { grid-template-columns: 1fr 1fr; }
  .span-2 { grid-column: span 2; }
  .kv { grid-template-columns: 110px 1fr; }
  .diff .field { width: auto; }
}
</style>

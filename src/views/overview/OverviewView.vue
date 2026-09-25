<script setup lang="ts">
import { matchOption } from '@/utils/selectSearch'
import { computed, onMounted, ref, watch } from 'vue'
import { listOffices } from '@/services/api/offices'
import { listRollups } from '@/services/api/ops'
import { verificationStats } from '@/services/api/chats'
import { useAuthStore } from '@/stores/auth'
import StackedBarChart, { type Series } from '@/components/charts/StackedBarChart.vue'
import HBarChart, { type HBarItem } from '@/components/charts/HBarChart.vue'
import { OTHER_COLOR, OTHER_KEY, STATUS_COLORS, colorMap, fmtCompact, fmtFull, seriesKey } from '@/utils/chartPalette'
import type { DailyRollup, Office } from '@/types'

const auth = useAuthStore()
const canVerify = computed(() => auth.can('verification.write'))

const offices = ref<Office[]>([])
const rollups = ref<DailyRollup[]>([])
const pending = ref<number | null>(null) // ยังไม่ตรวจ (สะสมทั้งหมด) — เฉพาะคนที่มีสิทธิ์ตรวจ
const loading = ref(true)
const loadError = ref('')

const svc = ref('ALL') // 'ALL' | office|service
const days = ref<7 | 30>(30)

// เว็บทั้งหมดเรียงตามรายชื่อ office/service — ใช้กำหนดสีให้คงที่ต่อเว็บ
const allKeys = computed(() => offices.value.flatMap((o) => o.services.map((s) => `${o.id}|${s.id}`)))
const colors = computed(() => colorMap(allKeys.value))
const labelOf = computed(() => {
  const m: Record<string, string> = {}
  for (const o of offices.value) for (const s of o.services) m[`${o.id}|${s.id}`] = `${s.label || s.id}`
  return m
})
const officeOf = (k: string) => k.split('|')[0]
const serviceOf = (k: string) => k.split('|')[1]

// ช่วงวันตามเวลาไทย (ตรงกับที่ server ตัดวันของสรุปรายวัน)
function bkkDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}
const dayList = computed(() => Array.from({ length: days.value }, (_, i) => bkkDate(i - days.value + 1)))

async function load() {
  loading.value = true
  loadError.value = ''
  const [o, s] = svc.value === 'ALL' ? [undefined, undefined] : [officeOf(svc.value), serviceOf(svc.value)]
  try {
    rollups.value = (await listRollups({ office_id: o, service_id: s, from: dayList.value[0], to: dayList.value[dayList.value.length - 1] })).data
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
  if (canVerify.value) {
    try {
      pending.value = (await verificationStats(o, s)).pending
    } catch {
      pending.value = null
    }
  }
}

watch([svc, days], load)

// ---------- ตัวเลขรวม ----------
const tokensOf = (r: DailyRollup) => r.input_tokens + r.output_tokens + r.cache_read + r.cache_write

const totals = computed(() => {
  const t = { chats: 0, questions: 0, tokens: 0, correct: 0, wrong: 0, refusals: 0, toolErrors: 0 }
  for (const r of rollups.value) {
    t.chats += r.conversations
    t.questions += r.questions
    t.tokens += tokensOf(r)
    t.correct += r.correct
    t.wrong += r.wrong
    t.refusals += r.refusals
    t.toolErrors += r.tool_errors
  }
  return t
})
const graded = computed(() => totals.value.correct + totals.value.wrong)
const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) : '—')

const kpis = computed(() => {
  const t = totals.value
  return [
    { k: 'แชท', v: fmtFull(t.chats), u: 'ห้อง', d: `ห้องที่เปิดใหม่ในช่วง ${days.value} วัน` },
    { k: 'คำถาม', v: fmtFull(t.questions), u: '', d: 'ข้อความที่แอดมินพิมพ์ แล้วผู้ช่วยเรียก LLM' },
    { k: 'token ที่ใช้', v: fmtCompact(t.tokens), u: '', d: t.questions ? `เฉลี่ย ${fmtCompact(Math.round(t.tokens / t.questions))} ต่อคำถาม` : 'ยังไม่มีคำถาม' },
    {
      k: 'ตอบถูก',
      v: graded.value ? pct(t.correct, graded.value) : '—',
      u: graded.value ? '%' : '',
      d: graded.value
        ? `ตรวจแล้ว ${fmtFull(graded.value)}` + (pending.value !== null ? ` · ยังไม่ตรวจ ${fmtFull(pending.value)}` : '')
        : 'ยังไม่มีการตรวจในช่วงนี้' + (pending.value ? ` · รอตรวจ ${fmtFull(pending.value)}` : ''),
    },
    { k: 'อัตราปฏิเสธ', v: pct(t.refusals, t.questions), u: t.questions ? '%' : '', d: `${fmtFull(t.refusals)} จาก ${fmtFull(t.questions)} คำถาม` },
    { k: 'tool ล้ม', v: fmtFull(t.toolErrors), u: 'ครั้ง', d: 'ยิง API หลังบ้านไม่สำเร็จ', bad: t.toolErrors > 0 },
  ]
})

// ---------- กราฟ token ต่อวัน (แท่งซ้อน) ----------
// เว็บลำดับที่ 9+ รวมเป็น "อื่น ๆ" · ลำดับชั้น/สีตามรายชื่อเว็บ ไม่ตามยอด
const stack = computed(() => {
  const values: Record<string, Record<string, number>> = {}
  const present = new Set<string>()
  for (const r of rollups.value) {
    const key = seriesKey(allKeys.value, `${r.office_id}|${r.service_id}`)
    present.add(key)
    const row = (values[r.date] ??= {})
    row[key] = (row[key] ?? 0) + tokensOf(r)
  }
  const series: Series[] = allKeys.value
    .filter((k) => present.has(k))
    .map((k) => ({ key: k, label: labelOf.value[k] ?? serviceOf(k), color: colors.value[k] }))
  if (present.has(OTHER_KEY)) series.push({ key: OTHER_KEY, label: 'อื่น ๆ', color: OTHER_COLOR })
  return { series, values }
})

// ---------- ต่อเว็บ ----------
interface Row {
  key: string
  label: string
  office: string
  color: string
  chats: number
  questions: number
  tokens: number
  correct: number
  wrong: number
  refusals: number
  toolErrors: number
}

const perService = computed<Row[]>(() => {
  const m: Record<string, Row> = {}
  for (const r of rollups.value) {
    const key = `${r.office_id}|${r.service_id}`
    const row = (m[key] ??= {
      key, label: labelOf.value[key] ?? r.service_id, office: r.office_id, color: colors.value[key] ?? OTHER_COLOR,
      chats: 0, questions: 0, tokens: 0, correct: 0, wrong: 0, refusals: 0, toolErrors: 0,
    })
    row.chats += r.conversations
    row.questions += r.questions
    row.tokens += tokensOf(r)
    row.correct += r.correct
    row.wrong += r.wrong
    row.refusals += r.refusals
    row.toolErrors += r.tool_errors
  }
  return Object.values(m).sort((a, b) => b.tokens - a.tokens)
})

const hbar = computed<HBarItem[]>(() =>
  perService.value.map((r) => ({
    key: r.key, label: r.label, color: r.color, value: r.tokens,
    detail: `${fmtFull(r.questions)} คำถาม · ${fmtFull(r.chats)} ห้อง`,
  })),
)

// ---------- แถบผลตรวจ ----------
const verifyParts = computed(() => {
  const parts = [
    { key: 'correct', label: 'ถูก', v: totals.value.correct, color: STATUS_COLORS.correct },
    { key: 'wrong', label: 'ผิด', v: totals.value.wrong, color: STATUS_COLORS.wrong },
  ]
  if (pending.value !== null) parts.push({ key: 'pending', label: 'ยังไม่ตรวจ', v: pending.value, color: STATUS_COLORS.pending })
  const sum = parts.reduce((a, p) => a + p.v, 0)
  return { parts, sum }
})

const hasData = computed(() => rollups.value.length > 0)

onMounted(async () => {
  try {
    offices.value = (await listOffices()).data
  } catch {
    /* แสดงรหัสแทนชื่อได้ */
  }
  load()
})
</script>

<template>
  <div class="page-head head-row">
    <div>
      <h1>ภาพรวม</h1>
      <p class="sub">ผู้ช่วยถูกใช้แค่ไหน ใช้ token เท่าไหร่ และตอบถูกแค่ไหน — นับจากสรุปรายวันตามเวลาไทย</p>
    </div>
    <div class="filters">
      <a-select v-model:value="svc" show-search :filter-option="matchOption" style="width: 220px">
        <a-select-option value="ALL" search="ทุก service">ทุก service</a-select-option>
        <a-select-opt-group v-for="o in offices" :key="o.id" :label="o.label || o.id">
          <a-select-option v-for="s in o.services" :key="`${o.id}|${s.id}`" :value="`${o.id}|${s.id}`" :search="`${o.label} ${o.id} ${s.id} ${s.label}`">{{ s.label || s.id }}</a-select-option>
        </a-select-opt-group>
      </a-select>
      <a-radio-group v-model:value="days" button-style="solid">
        <a-radio-button :value="7">7 วัน</a-radio-button>
        <a-radio-button :value="30">30 วัน</a-radio-button>
      </a-radio-group>
    </div>
  </div>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <a-spin :spinning="loading">
    <div class="kpis">
      <div v-for="x in kpis" :key="x.k" class="kpi">
        <div class="k">{{ x.k }}</div>
        <div class="v" :class="{ bad: x.bad }">{{ x.v }}<span v-if="x.u" class="u">{{ x.u }}</span></div>
        <div class="d">{{ x.d }}</div>
      </div>
    </div>

    <div v-if="!hasData && !loading" class="empty">
      ยังไม่มีข้อมูลในช่วง {{ days }} วันนี้ — ตัวเลขเริ่มนับเมื่อแอดมินแชทกับผู้ช่วย
    </div>

    <template v-else>
      <div class="grid2">
        <figure class="box">
          <figcaption>token ที่ใช้ต่อวัน<template v-if="svc === 'ALL'"> แยกตามเว็บ</template></figcaption>
          <p class="note">ชี้ที่แท่งเพื่อดูรายละเอียดของวันนั้น</p>
          <StackedBarChart :days="dayList" :series="stack.series" :values="stack.values" unit="token" />
        </figure>
        <figure class="box">
          <figcaption>token รวมต่อเว็บ</figcaption>
          <p class="note">เรียงจากมากไปน้อยในช่วงที่เลือก</p>
          <HBarChart :items="hbar" unit="token" />
        </figure>
      </div>

      <div class="box">
        <div class="box-title">ผลการตรวจคำตอบ</div>
        <p class="note">
          % ตอบถูกคิดจากที่ตรวจแล้วในช่วงนี้เท่านั้น
          <template v-if="pending !== null"> · "ยังไม่ตรวจ" นับคำตอบที่ค้างทั้งหมด ไม่จำกัดช่วง</template>
        </p>
        <div v-if="verifyParts.sum > 0" class="bar3">
          <span
            v-for="p in verifyParts.parts.filter((x) => x.v > 0)"
            :key="p.key"
            :style="{ flex: `${p.v} 1 0`, background: p.color }"
            :class="{ light: p.key === 'pending' }"
            :title="`${p.label} ${fmtFull(p.v)}`"
          >{{ (p.v / verifyParts.sum) * 100 >= 8 ? `${((p.v / verifyParts.sum) * 100).toFixed(0)}%` : '' }}</span>
        </div>
        <div v-else class="note">ยังไม่มีคำตอบที่ตรวจหรือรอตรวจ</div>
        <div class="legend">
          <span v-for="p in verifyParts.parts" :key="p.key"><i :style="{ background: p.color }"></i>{{ p.label }} <strong>{{ fmtFull(p.v) }}</strong></span>
        </div>
      </div>

      <h3 class="sec">สรุปรายเว็บ</h3>
      <div class="box table-box">
        <table>
          <thead>
            <tr>
              <th>เว็บ</th>
              <th class="r">แชท</th>
              <th class="r">คำถาม</th>
              <th class="r">token</th>
              <th class="r">ตอบถูก</th>
              <th class="r">ปฏิเสธ</th>
              <th class="r">tool ล้ม</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in perService" :key="r.key">
              <td><i class="dot" :style="{ background: r.color }"></i>{{ r.label }} <span class="note">{{ r.office }}</span></td>
              <td class="r mono">{{ fmtFull(r.chats) }}</td>
              <td class="r mono">{{ fmtFull(r.questions) }}</td>
              <td class="r mono">{{ fmtFull(r.tokens) }}</td>
              <td class="r mono">
                {{ r.correct + r.wrong ? `${pct(r.correct, r.correct + r.wrong)}%` : '—' }}
                <span v-if="r.correct + r.wrong" class="note">({{ r.correct + r.wrong }})</span>
              </td>
              <td class="r mono">{{ r.questions ? `${pct(r.refusals, r.questions)}%` : '—' }}</td>
              <td class="r mono" :class="{ bad: r.toolErrors > 0 }">{{ fmtFull(r.toolErrors) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </a-spin>
</template>

<style scoped>
.head-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; margin-bottom: 16px; }
.kpi { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); padding: 14px 16px; }
.kpi .k { font-size: 12.5px; color: var(--muted); }
.kpi .v { font-family: var(--font-head); font-size: 26px; font-weight: 700; color: var(--ink); line-height: 1.3; font-variant-numeric: tabular-nums; }
.kpi .v.bad { color: var(--danger); }
.kpi .u { font-size: 14px; font-weight: 600; color: var(--muted); margin-left: 3px; }
.kpi .d { font-size: 12px; color: var(--muted); margin-top: 2px; line-height: 1.5; }

.grid2 { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 12px; margin-bottom: 12px; }
@media (max-width: 1100px) { .grid2 { grid-template-columns: minmax(0, 1fr); } }
.box { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); padding: 14px 16px; margin: 0 0 12px; }
figcaption, .box-title { font-family: var(--font-head); font-weight: 600; font-size: 14px; color: var(--ink); }
.note { font-size: 12px; color: var(--muted); margin: 2px 0 10px; }

.bar3 { display: flex; gap: 2px; height: 28px; border-radius: 6px; overflow: hidden; }
.bar3 span { display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 600; min-width: 4px; }
.bar3 span.light { color: var(--ink); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 10px; font-size: 12.5px; color: var(--ink); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.legend strong { font-family: var(--font-mono); }

.sec { font-size: 15px; margin: 20px 0 10px; }
.table-box { padding: 0; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
th { text-align: left; font-size: 12px; font-weight: 600; color: var(--muted); background: var(--ground); padding: 9px 12px; border-bottom: 1px solid var(--line); }
td { padding: 10px 12px; border-bottom: 1px solid var(--line); }
tbody tr:last-child td { border-bottom: none; }
.r { text-align: right; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.bad { color: var(--danger); font-weight: 600; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 8px; }
.empty { background: var(--surface); border: 1px dashed var(--line); border-radius: var(--r-card); padding: 40px 16px; text-align: center; color: var(--muted); font-size: 13.5px; }
</style>

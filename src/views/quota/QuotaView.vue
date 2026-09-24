<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { listQuotas, listRollups, getSettings } from '@/services/api/admin'
import { increaseQuota } from '@/services/api/offices'
import { useAuthStore } from '@/stores/auth'
import { useOfficeOptions } from '@/composables/useOfficeOptions'
import { apiErrorText } from '@/utils/apiErrors'
import type { DailyRollup, QuotaStatus } from '@/types'

const auth = useAuthStore()
const { offices, load: loadOffices, servicesOf } = useOfficeOptions()

const loading = ref(false)
const loadError = ref('')
const quotas = ref<QuotaStatus[]>([])
const fxToLocal = ref(0)
const localCurrency = ref('')

async function loadQuotas() {
  loading.value = true
  loadError.value = ''
  try {
    quotas.value = (await listQuotas()).data
  } catch (e) {
    loadError.value = apiErrorText(e)
  } finally {
    loading.value = false
  }
}

async function loadFx() {
  try {
    const st = await getSettings()
    fxToLocal.value = st.pricing.fx_to_local
    localCurrency.value = st.pricing.local_currency
  } catch {
    /* ไม่มีสิทธิ์/โหลดไม่ได้ — แสดงต้นทุนแค่สกุลตั้งต้น (USD) พอ */
  }
}

function thb(amount: number) {
  return fxToLocal.value > 0 ? amount * fxToLocal.value : null
}

function pctColor(p: number) {
  if (p >= 100) return '#c2453b'
  if (p >= 95) return '#c2453b'
  if (p >= 80) return '#b8860b'
  return '#0f6e63'
}

const columns = [
  { title: 'office / service', key: 'service' },
  { title: 'รอบ', dataIndex: 'period', key: 'period' },
  { title: 'เพดาน', key: 'limit' },
  { title: 'ใช้ไป', key: 'used' },
  { title: 'เหลือ', key: 'remaining' },
  { title: '%', key: 'percent' },
  { title: 'ต้นทุน', key: 'cost' },
  { title: '', key: 'actions' },
]

// ---------- เพิ่มโควตาชั่วคราว ----------
const increaseOpen = ref(false)
const increaseTarget = ref<QuotaStatus | null>(null)
const increaseForm = reactive({ amount: '', reason: '' })
const increaseSaving = ref(false)

function openIncrease(q: QuotaStatus) {
  increaseTarget.value = q
  increaseForm.amount = ''
  increaseForm.reason = ''
  increaseOpen.value = true
}

const canSubmitIncrease = computed(() => {
  const n = Number(increaseForm.amount)
  return Number.isFinite(n) && n > 0 && increaseForm.reason.trim().length > 0
})

async function submitIncrease() {
  const q = increaseTarget.value
  if (!q || !canSubmitIncrease.value) return
  increaseSaving.value = true
  try {
    await increaseQuota(q.office_id, q.service_id, Number(increaseForm.amount), increaseForm.reason.trim())
    message.success('เพิ่มโควตาชั่วคราวแล้ว — ใช้ต่อได้ทันที')
    increaseOpen.value = false
    await loadQuotas()
  } catch (e) {
    message.error(apiErrorText(e))
  } finally {
    increaseSaving.value = false
  }
}

function showHistory(q: QuotaStatus) {
  const lines = q.temp_increases.length
    ? q.temp_increases
        .map((t) => `รอบ ${t.period} · +${t.amount.toLocaleString('th-TH')} · โดย ${t.by} · ${new Date(t.at).toLocaleString('th-TH')}\nเหตุผล: ${t.reason}`)
        .join('\n\n')
    : 'ยังไม่เคยเพิ่มโควตาชั่วคราว'
  Modal.info({
    title: `ประวัติเพิ่มโควตาชั่วคราว — ${q.service_label || q.service_id}`,
    width: 520,
    content: lines.split('\n').map((l) => h('div', l)),
    okText: 'ปิด',
  })
}

// ---------- rollup รายวัน ----------
const rollupFilter = reactive({ office_id: undefined as string | undefined, service_id: undefined as string | undefined, from: '', to: '' })
const rollupServiceOptions = computed(() => (rollupFilter.office_id ? servicesOf(rollupFilter.office_id) : []))
const rollups = ref<DailyRollup[]>([])
const rollupLoading = ref(false)

async function loadRollups() {
  if (!rollupFilter.office_id) {
    rollups.value = []
    return
  }
  rollupLoading.value = true
  try {
    rollups.value = (await listRollups(rollupFilter.office_id, rollupFilter.service_id, rollupFilter.from || undefined, rollupFilter.to || undefined)).data
  } catch (e) {
    message.error(apiErrorText(e))
  } finally {
    rollupLoading.value = false
  }
}

function onRollupOfficeChange() {
  rollupFilter.service_id = undefined
}

onMounted(() => {
  loadOffices()
  loadQuotas()
  loadFx()
})
</script>

<template>
  <div class="page-head">
    <h1>โควตา / ต้นทุน</h1>
    <p class="sub">เพดานการใช้ต่อเดือนของแต่ละเว็บ ใช้ไปเท่าไร เหลือเท่าไร และต้นทุนที่เกิดขึ้นจริงด้วยเรต ณ ตอนบันทึก</p>
  </div>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <a-card size="small" class="tidy" style="margin-bottom: 24px">
    <a-table
      class="rows-table" :columns="columns" :data-source="quotas" :loading="loading" :pagination="false"
      row-key="service_id" size="middle"
    >
      <template #emptyText>
        <div class="empty">
          <p class="empty-title">ยังไม่มี service ให้แสดงโควตา</p>
        </div>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'service'">
          <div><strong>{{ record.service_label || record.service_id }}</strong></div>
          <div class="hint">{{ record.office_id }} / {{ record.service_id }}</div>
        </template>
        <template v-else-if="column.key === 'limit'">{{ record.limit.toLocaleString('th-TH') }}</template>
        <template v-else-if="column.key === 'used'">{{ record.used_tokens.toLocaleString('th-TH') }} <span class="hint">({{ record.used_questions }} คำถาม)</span></template>
        <template v-else-if="column.key === 'remaining'">{{ Math.max(0, record.limit - record.used_tokens).toLocaleString('th-TH') }}</template>
        <template v-else-if="column.key === 'percent'">
          <span :style="{ color: pctColor(record.percent), fontWeight: 700 }">{{ record.percent.toFixed(1) }}%</span>
          <a-tag v-if="record.cut" color="red" style="margin-left: 6px">เต็มแล้ว</a-tag>
        </template>
        <template v-else-if="column.key === 'cost'">
          <div>${{ record.cost_amount.toFixed(4) }} {{ record.currency }}</div>
          <div v-if="thb(record.cost_amount) !== null" class="hint">≈ {{ thb(record.cost_amount)!.toFixed(2) }} {{ localCurrency }} (ประมาณ)</div>
        </template>
        <template v-else-if="column.key === 'actions'">
          <div class="row">
            <a-button size="small" type="link" @click="showHistory(record)">
              ประวัติเพิ่ม ({{ record.temp_increases.length }})
            </a-button>
            <a-button size="small" :disabled="!auth.can('quota.manage')" @click="openIncrease(record)">เพิ่มชั่วคราว</a-button>
          </div>
        </template>
      </template>
    </a-table>
  </a-card>

  <a-card size="small" class="tidy" title="สรุปรายวัน">
    <div class="filters">
      <a-select v-model:value="rollupFilter.office_id" placeholder="เลือก office" style="width: 160px" @change="onRollupOfficeChange">
        <a-select-option v-for="o in offices" :key="o.id" :value="o.id">{{ o.label }}</a-select-option>
      </a-select>
      <a-select v-model:value="rollupFilter.service_id" placeholder="ทุก service" style="width: 160px" allow-clear :disabled="!rollupFilter.office_id">
        <a-select-option v-for="s in rollupServiceOptions" :key="s.id" :value="s.id">{{ s.label }}</a-select-option>
      </a-select>
      <a-input v-model:value="rollupFilter.from" placeholder="from (YYYY-MM-DD)" style="width: 150px" />
      <a-input v-model:value="rollupFilter.to" placeholder="to (YYYY-MM-DD)" style="width: 150px" />
      <a-button type="primary" :loading="rollupLoading" :disabled="!rollupFilter.office_id" @click="loadRollups">ดูสรุป</a-button>
    </div>

    <p v-if="!rollupFilter.office_id" class="hint" style="margin-top: 12px">เลือก office ก่อนเพื่อดูสรุปรายวัน</p>
    <table v-else class="rollup-table">
      <thead>
        <tr><th>วันที่</th><th>ห้อง</th><th>คำถาม</th><th>token in</th><th>token out</th><th>ต้นทุน</th><th>ถูก</th><th>ผิด</th></tr>
      </thead>
      <tbody>
        <tr v-for="r in rollups" :key="r.id">
          <td>{{ r.date }}</td>
          <td>{{ r.conversations }}</td>
          <td>{{ r.questions }}</td>
          <td>{{ r.tokens_in }}</td>
          <td>{{ r.tokens_out }}</td>
          <td>${{ r.cost_amount.toFixed(4) }}</td>
          <td>{{ r.correct }}</td>
          <td>{{ r.wrong }}</td>
        </tr>
        <tr v-if="rollups.length === 0"><td colspan="8" class="hint" style="text-align: center; padding: 16px">ยังไม่มีข้อมูลในช่วงนี้</td></tr>
      </tbody>
    </table>
  </a-card>

  <a-modal
    v-model:open="increaseOpen"
    title="เพิ่มโควตาชั่วคราว"
    ok-text="เพิ่ม" cancel-text="ยกเลิก"
    :confirm-loading="increaseSaving"
    :ok-button-props="{ disabled: !canSubmitIncrease }"
    @ok="submitIncrease"
  >
    <p class="modal-intro">
      เพิ่มให้เฉพาะ {{ increaseTarget?.service_label || increaseTarget?.service_id }} รอบเดือนปัจจุบันเท่านั้น — มีผลใช้ต่อได้ทันที และบันทึกไว้ว่าใครเป็นคนเพิ่ม
    </p>
    <div class="field">
      <label>จำนวน token ที่เพิ่ม</label>
      <a-input v-model:value="increaseForm.amount" placeholder="เช่น 500000" />
    </div>
    <div class="field">
      <label>เหตุผล</label>
      <a-input v-model:value="increaseForm.reason" placeholder="เช่น แคมเปญพิเศษวันนี้" />
    </div>
  </a-modal>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.hint { font-size: 12px; color: var(--muted); }
.filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.row { display: flex; gap: 4px; }

.rows-table :deep(.ant-table-thead > tr > th) { background: var(--ground); color: var(--muted); font-weight: 600; font-size: 12.5px; }
.empty { padding: 20px 0; text-align: center; }
.empty-title { margin: 0; font-size: 14px; color: var(--muted); }

.rollup-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 12px; }
.rollup-table th, .rollup-table td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; }
.rollup-table th { color: var(--muted); font-weight: 600; background: var(--ground); }
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { createDeletion, listAccessLog, listDeletions } from '@/services/api/admin'
import { useAuthStore } from '@/stores/auth'
import { useOfficeOptions } from '@/composables/useOfficeOptions'
import { apiErrorText } from '@/utils/apiErrors'
import type { AccessLog, DeletionRequest } from '@/types'

const auth = useAuthStore()
const { offices, load: loadOffices, servicesOf } = useOfficeOptions()

const activeTab = ref('delete')

// ---------- ฟอร์มขอลบ ----------
const form = reactive({
  office_id: undefined as string | undefined,
  service_id: undefined as string | undefined,
  user_id: '',
  from: '',
  to: '',
  reason: '',
})
const serviceOptions = computed(() => (form.office_id ? servicesOf(form.office_id) : []))

const hasScope = computed(() => !!(form.service_id || form.user_id.trim() || form.from || form.to))
const canSubmitForm = computed(() => !!form.office_id && form.reason.trim().length > 0 && hasScope.value)

const confirmOpen = ref(false)
const confirmText = ref('')
const submitting = ref(false)
const lastResult = ref<DeletionRequest | null>(null)

function openConfirm() {
  if (!canSubmitForm.value) return
  confirmText.value = ''
  confirmOpen.value = true
}

async function submitDelete() {
  if (confirmText.value.trim() !== form.office_id) return
  submitting.value = true
  try {
    const req = await createDeletion({
      office_id: form.office_id!,
      service_id: form.service_id || undefined,
      user_id: form.user_id.trim() || undefined,
      from: form.from ? new Date(form.from).toISOString() : undefined,
      to: form.to ? new Date(form.to).toISOString() : undefined,
      reason: form.reason.trim(),
    })
    lastResult.value = req
    message.success(`ลบแล้ว — ข้อความ ${req.result.messages} · ห้อง ${req.result.conversations} · ผลตรวจ ${req.result.verifications}`)
    confirmOpen.value = false
    form.service_id = undefined
    form.user_id = ''
    form.from = ''
    form.to = ''
    form.reason = ''
    await loadDeletions()
  } catch (e) {
    message.error(apiErrorText(e))
  } finally {
    submitting.value = false
  }
}

function onOfficeChange() {
  form.service_id = undefined
}

// ---------- ประวัติคำขอลบ ----------
const deletions = ref<DeletionRequest[]>([])
const deletionsLoading = ref(false)
const deletionsError = ref('')

async function loadDeletions() {
  deletionsLoading.value = true
  deletionsError.value = ''
  try {
    const res = await listDeletions(50, 0)
    deletions.value = res.data
  } catch (e) {
    deletionsError.value = apiErrorText(e)
  } finally {
    deletionsLoading.value = false
  }
}

const deletionColumns = [
  { title: 'เวลา', key: 'created_at' },
  { title: 'office/service', key: 'scope' },
  { title: 'ขอบเขต', key: 'detail' },
  { title: 'เหตุผล', dataIndex: 'reason', key: 'reason' },
  { title: 'ผู้ขอ / อนุมัติ', key: 'by' },
  { title: 'ผลลัพธ์', key: 'result' },
]

// ---------- บันทึกการเข้าถึง ----------
const accessFilter = reactive({ office_id: undefined as string | undefined, service_id: undefined as string | undefined, operator: '' })
const accessServiceOptions = computed(() => (accessFilter.office_id ? servicesOf(accessFilter.office_id) : []))
const accessLog = ref<AccessLog[]>([])
const accessLoading = ref(false)
const accessTotal = ref(0)

async function loadAccessLog() {
  accessLoading.value = true
  try {
    const res = await listAccessLog({ office_id: accessFilter.office_id, service_id: accessFilter.service_id, operator: accessFilter.operator || undefined, limit: 100 })
    accessLog.value = res.data
    accessTotal.value = res.total
  } catch (e) {
    message.error(apiErrorText(e))
  } finally {
    accessLoading.value = false
  }
}

function onAccessOfficeChange() {
  accessFilter.service_id = undefined
}

const accessColumns = [
  { title: 'เวลา', key: 'at' },
  { title: 'ผู้เปิด', dataIndex: 'operator', key: 'operator' },
  { title: 'การกระทำ', key: 'action' },
  { title: 'office/service', key: 'scope' },
  { title: 'รายละเอียด', dataIndex: 'detail', key: 'detail' },
]

const ACTION_LABEL: Record<string, string> = {
  read_conversation: 'เปิดอ่านห้อง',
  read_message: 'เปิดอ่านข้อความ',
  read_old: 'เปิดอ่าน (เก่ากว่า 90 วัน)',
  read_queue: 'เปิดคิวตรวจ',
  search: 'ค้นห้อง',
  search_messages: 'ค้นข้อความ',
  verify: 'ตรวจคำตอบ',
  delete: 'ลบข้อมูล',
}

function fmt(v?: string) {
  return v ? new Date(v).toLocaleString('th-TH') : '—'
}

function onTabChange(key: string) {
  if (key === 'access' && accessLog.value.length === 0) loadAccessLog()
}

onMounted(() => {
  loadOffices()
  loadDeletions()
})
</script>

<template>
  <div class="page-head">
    <h1>ลบตามคำขอ (PDPA)</h1>
    <p class="sub">
      ลบประวัติแชทตามขอบเขตที่เลือก (ผู้ใช้ / เว็บ / ช่วงเวลา) — ลบแล้วค้นหาไม่พบอีก บันทึกไว้เสมอว่าใครขอ ใครอนุมัติ และเหตุผล
    </p>
  </div>

  <a-tabs v-model:active-key="activeTab" @change="onTabChange">
    <a-tab-pane key="delete" tab="ขอลบข้อมูล">
      <a-card size="small" class="tidy" style="margin-bottom: 16px">
        <label class="f-label">office <span class="opt">— บังคับ</span></label>
        <a-select v-model:value="form.office_id" style="width: 100%" placeholder="เลือก office" @change="onOfficeChange">
          <a-select-option v-for="o in offices" :key="o.id" :value="o.id">{{ o.label }}</a-select-option>
        </a-select>

        <label class="f-label">service <span class="opt">— ไม่บังคับ ถ้าเลือกขอบเขตอื่นแทน</span></label>
        <a-select v-model:value="form.service_id" style="width: 100%" placeholder="ทุก service ใน office นี้" allow-clear :disabled="!form.office_id">
          <a-select-option v-for="s in serviceOptions" :key="s.id" :value="s.id">{{ s.label }}</a-select-option>
        </a-select>

        <label class="f-label">ผู้ใช้ (user id) <span class="opt">— ไม่บังคับ</span></label>
        <a-input v-model:value="form.user_id" placeholder="เช่น emp_1" />

        <div class="two-col">
          <div>
            <label class="f-label">ตั้งแต่</label>
            <a-input v-model:value="form.from" type="datetime-local" />
          </div>
          <div>
            <label class="f-label">ถึง</label>
            <a-input v-model:value="form.to" type="datetime-local" />
          </div>
        </div>
        <p v-if="!hasScope" class="hint warn">ต้องระบุ service, ผู้ใช้ หรือช่วงเวลาอย่างน้อย 1 อย่าง — ลบทั้ง office เลยไม่ได้</p>

        <label class="f-label">เหตุผล / เลขที่คำขอ</label>
        <a-input v-model:value="form.reason" placeholder="เช่น คำขอ PDPA #12" />

        <div class="row" style="margin-top: 14px">
          <a-button
            type="primary" danger :disabled="!canSubmitForm || !auth.can('deletion.manage')"
            @click="openConfirm"
          >ลบตามขอบเขตนี้</a-button>
        </div>

        <div v-if="lastResult" class="hint" style="margin-top: 10px">
          ล่าสุด: ลบข้อความ {{ lastResult.result.messages }} · ห้อง {{ lastResult.result.conversations }} · ผลตรวจ {{ lastResult.result.verifications }}
        </div>
      </a-card>

      <a-card size="small" class="tidy" title="ประวัติคำขอลบ">
        <a-alert v-if="deletionsError" type="error" :message="deletionsError" show-icon style="margin-bottom: 12px" />
        <a-table :columns="deletionColumns" :data-source="deletions" :loading="deletionsLoading" :pagination="false" row-key="id" size="middle">
          <template #emptyText><span class="hint">ยังไม่เคยมีคำขอลบ</span></template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'created_at'">{{ fmt(record.created_at) }}</template>
            <template v-else-if="column.key === 'scope'">{{ record.office_id }}<template v-if="record.service_id"> / {{ record.service_id }}</template></template>
            <template v-else-if="column.key === 'detail'">
              <span v-if="record.scope.user_id">ผู้ใช้ {{ record.scope.user_id }}</span>
              <span v-if="record.scope.from || record.scope.to"> · {{ fmt(record.scope.from) }} – {{ fmt(record.scope.to) }}</span>
            </template>
            <template v-else-if="column.key === 'by'">{{ record.requested_by }}<template v-if="record.approved_by"> · อนุมัติโดย {{ record.approved_by }}</template></template>
            <template v-else-if="column.key === 'result'">
              <a-tag :color="record.status === 'done' ? 'green' : 'red'">{{ record.status }}</a-tag>
              ข้อความ {{ record.result.messages }} · ห้อง {{ record.result.conversations }}
            </template>
          </template>
        </a-table>
      </a-card>
    </a-tab-pane>

    <a-tab-pane key="access" tab="บันทึกการเข้าถึง" force-render>
      <a-card size="small" class="tidy" style="margin-bottom: 16px">
        <div class="filters">
          <a-select v-model:value="accessFilter.office_id" placeholder="ทุก office" style="width: 160px" allow-clear @change="onAccessOfficeChange">
            <a-select-option v-for="o in offices" :key="o.id" :value="o.id">{{ o.label }}</a-select-option>
          </a-select>
          <a-select v-model:value="accessFilter.service_id" placeholder="ทุก service" style="width: 160px" allow-clear :disabled="!accessFilter.office_id">
            <a-select-option v-for="s in accessServiceOptions" :key="s.id" :value="s.id">{{ s.label }}</a-select-option>
          </a-select>
          <a-input v-model:value="accessFilter.operator" placeholder="ผู้เปิด" style="width: 160px" @keyup.enter="loadAccessLog" />
          <a-button type="primary" :loading="accessLoading" @click="loadAccessLog">ค้นหา</a-button>
        </div>
      </a-card>

      <a-card size="small" class="tidy">
        <div class="hint" style="margin-bottom: 10px">ทั้งหมด {{ accessTotal }} รายการ</div>
        <a-table :columns="accessColumns" :data-source="accessLog" :loading="accessLoading" :pagination="false" row-key="id" size="middle">
          <template #emptyText><span class="hint">ยังไม่มีบันทึกการเข้าถึงตามเงื่อนไขนี้</span></template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'at'">{{ fmt(record.at) }}</template>
            <template v-else-if="column.key === 'action'">{{ ACTION_LABEL[record.action] || record.action }}</template>
            <template v-else-if="column.key === 'scope'">{{ record.office_id }}<template v-if="record.service_id"> / {{ record.service_id }}</template></template>
          </template>
        </a-table>
      </a-card>
    </a-tab-pane>
  </a-tabs>

  <a-modal
    v-model:open="confirmOpen"
    title="ยืนยันการลบ — ทำแล้วกู้คืนไม่ได้"
    ok-text="ลบถาวร" cancel-text="ยกเลิก"
    :confirm-loading="submitting"
    :ok-button-props="{ danger: true, disabled: confirmText.trim() !== form.office_id }"
    @ok="submitDelete"
  >
    <p>ลบประวัติแชทตามขอบเขตที่เลือกถาวร ไม่มีระบบกู้คืน — พิมพ์รหัส office <code>{{ form.office_id }}</code> เพื่อยืนยัน</p>
    <a-input v-model:value="confirmText" :placeholder="form.office_id" @keyup.enter="submitDelete" />
  </a-modal>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.hint { font-size: 12px; color: var(--muted); }
.hint.warn { color: var(--danger); }
.f-label { display: block; font-size: 12.5px; color: var(--muted); margin: 12px 0 4px; }
.f-label .opt { font-weight: 400; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.row { display: flex; gap: 8px; }
.filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
</style>

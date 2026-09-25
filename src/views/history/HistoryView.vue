<script setup lang="ts">
import { matchOption } from '@/utils/selectSearch'
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getConversation, listConversations } from '@/services/api/chats'
import { listOffices } from '@/services/api/offices'
import DomainSelect from '@/components/DomainSelect.vue'
import ChatCard from '@/components/ChatCard.vue'
import DateRangeFilter from '@/components/DateRangeFilter.vue'
import type { Conversation, ConversationView, Office, VerificationStatus } from '@/types'

// ห้องที่เปิดมาเกินนี้ต้องยืนยันก่อนเปิดอ่าน (backend ตรวจซ้ำอีกชั้น)
const OLD_MS = 90 * 24 * 60 * 60 * 1000
const PAGE_SIZE = 20

const offices = ref<Office[]>([])
const list = ref<Conversation[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadError = ref('')

const filter = reactive({
  office_id: undefined as string | undefined,
  service_id: undefined as string | undefined,
  user: '',
  q: '',
  verification: undefined as VerificationStatus | undefined,
  range: undefined as [string, string] | undefined, // YYYY-MM-DD ตั้งแต่–ถึง (รวมทั้งวัน)
})
// ช่องพิมพ์ค้นเมื่อกด Enter/แว่นขยาย — แยกค่าที่กำลังพิมพ์ออกจากค่าที่ใช้ค้น
const userDraft = ref('')
const qDraft = ref('')

const hasFilter = computed(
  () => !!(filter.office_id || filter.service_id || filter.user || filter.q || filter.verification || filter.range),
)

const serviceOptions = computed(() => offices.value.find((o) => o.id === filter.office_id)?.services ?? [])

function onOfficeChange() {
  filter.service_id = undefined
  search()
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listConversations({
      office_id: filter.office_id, service_id: filter.service_id, user: filter.user.trim(), q: filter.q.trim(),
      verification: filter.verification, from: filter.range?.[0], to: filter.range?.[1],
      limit: PAGE_SIZE, offset: (page.value - 1) * PAGE_SIZE,
    })
    list.value = res.data
    total.value = res.total
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

// เปลี่ยนตัวกรองแล้วค้นทันที (กลับไปหน้า 1)
function search() {
  page.value = 1
  load()
}

function applyText() {
  filter.user = userDraft.value.trim()
  filter.q = qDraft.value.trim()
  search()
}

function resetFilters() {
  Object.assign(filter, { office_id: undefined, service_id: undefined, user: '', q: '', verification: undefined, range: undefined })
  userDraft.value = ''
  qDraft.value = ''
  search()
}

// ปุ่มรีเฟรชหมุนเฉพาะตอนกดเอง — เปลี่ยนหน้าตาราง/ตัวกรองหมุนแค่ที่ตาราง ปุ่มไม่ขยับ
const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  await load()
  refreshing.value = false
}

function onPage(p: number) {
  page.value = p
  load()
}

// ---------- รายละเอียดห้อง ----------
const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<ConversationView | null>(null)
const confirmOldFor = ref('')

function openRow(c: Conversation) {
  if (Date.now() - new Date(c.created_at).getTime() > OLD_MS) {
    confirmOldFor.value = c.id
    return
  }
  openDetail(c.id, false)
}

async function openDetail(id: string, confirmOld: boolean) {
  confirmOldFor.value = ''
  detailLoading.value = true
  detailOpen.value = true
  detail.value = null
  try {
    detail.value = await getConversation(id, confirmOld)
  } catch (e) {
    detailOpen.value = false
    message.error((e as Error).message)
  } finally {
    detailLoading.value = false
  }
}

const VERIFY: Record<VerificationStatus, { label: string; color: string }> = {
  pending: { label: 'รอตรวจ', color: 'orange' },
  correct: { label: 'ตรวจแล้ว: ถูก', color: 'green' },
  wrong: { label: 'ตรวจแล้ว: ผิด', color: 'red' },
}

function fmt(v?: string) {
  return v ? new Date(v).toLocaleString('th-TH') : '—'
}

const columns = [
  { title: 'เปิดห้อง', key: 'created_at', width: 170 },
  { title: 'domain / service', key: 'service', width: 200 },
  { title: 'ผู้ถาม', key: 'user', width: 140 },
  { title: 'หัวข้อ (คำถามแรก)', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: 'ข้อความ', dataIndex: 'message_count', key: 'message_count', width: 80 },
  { title: 'ข้อความล่าสุด', key: 'updated_at', width: 170 },
]

onMounted(async () => {
  try {
    offices.value = (await listOffices()).data
  } catch {
    /* ตัวกรอง office ว่างได้ — ตารางยังค้นได้ */
  }
  load()
})
</script>

<template>
  <div class="page-head">
    <h1>ประวัติแชท</h1>
    <p class="sub">
      ห้องแชทของแอดมินทุกเว็บ — คลิกแถวเพื่อดูข้อความ การ์ด และเส้นที่ผู้ช่วยยิงไปหลังบ้าน ·
      ทุกครั้งที่ค้นหรือเปิดอ่านจะถูกบันทึกว่าใครดูเมื่อไหร่
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
        <a-select v-model:value="filter.service_id" show-search :filter-option="matchOption" placeholder="ทุก service" style="width: 100%" allow-clear :disabled="!filter.office_id" @change="search">
          <a-select-option v-for="s in serviceOptions" :key="s.id" :value="s.id" :search="`${s.id} ${s.label}`">{{ s.label }}</a-select-option>
        </a-select>
      </div>
      <div>
        <label class="f-label">ผู้ถาม</label>
        <a-input-search v-model:value="userDraft" placeholder="id หรือ username" allow-clear @search="applyText" />
      </div>
      <div>
        <label class="f-label">สถานะตรวจ</label>
        <a-select v-model:value="filter.verification" placeholder="ทั้งหมด" style="width: 100%" allow-clear @change="search">
          <a-select-option value="pending">มีคำตอบรอตรวจ</a-select-option>
          <a-select-option value="correct">มีคำตอบที่ถูก</a-select-option>
          <a-select-option value="wrong">มีคำตอบที่ผิด</a-select-option>
        </a-select>
      </div>
      <div class="span-2">
        <label class="f-label">ช่วงวันที่เปิดห้อง</label>
        <DateRangeFilter v-model="filter.range" @change="search" />
      </div>
      <div class="span-2">
        <label class="f-label">ค้นหา</label>
        <a-input-search v-model:value="qDraft" placeholder="คำในหัวข้อห้อง (คำถามแรก)" allow-clear @search="applyText" />
      </div>
    </div>
    <div class="filter-foot">
      <span class="f-count">ทั้งหมด {{ total }} ห้อง</span>
      <span class="grow" />
      <a-button v-if="hasFilter" size="small" @click="resetFilters">ล้างตัวกรอง</a-button>
      <a-button size="small" :loading="refreshing" @click="refresh">รีเฟรช</a-button>
    </div>
  </a-card>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <a-card size="small" class="tidy">
    <a-table
      class="rows-table"
      :columns="columns"
      :data-source="list"
      :loading="loading"
      row-key="id"
      size="middle"
      :pagination="{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, onChange: onPage }"
      :custom-row="(r: Conversation) => ({ onClick: () => openRow(r), style: 'cursor:pointer' })"
    >
      <template #emptyText>
        <div class="empty">
          <p class="empty-title">ไม่พบห้องแชทตามเงื่อนไขนี้</p>
          <p class="empty-sub">ลองล้างตัวกรองบางตัว หรือขยายช่วงเวลา</p>
        </div>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'created_at'">{{ fmt(record.created_at) }}</template>
        <template v-else-if="column.key === 'service'">{{ record.office_id }} / {{ record.service_id }}</template>
        <template v-else-if="column.key === 'user'">{{ record.username || record.admin_id }}</template>
        <template v-else-if="column.key === 'updated_at'">{{ fmt(record.updated_at) }}</template>
      </template>
    </a-table>
  </a-card>

  <a-modal
    :open="!!confirmOldFor"
    title="ข้อมูลเก่ากว่า 90 วัน"
    ok-text="เปิดอ่านต่อ"
    cancel-text="ยกเลิก"
    @ok="openDetail(confirmOldFor, true)"
    @cancel="confirmOldFor = ''"
  >
    <p>ห้องนี้เปิดมาเกิน 90 วันแล้ว — การเปิดอ่านจะถูกบันทึกเป็น "read_old" ในบันทึกการเข้าถึง ยืนยันจะเปิดอ่านต่อไหม</p>
  </a-modal>

  <a-drawer v-model:open="detailOpen" title="รายละเอียดห้องแชท" width="760" :body-style="{ paddingBottom: '32px' }">
    <a-spin v-if="detailLoading" />
    <template v-else-if="detail">
      <div class="conv-meta">
        <div><strong>{{ detail.conversation.office_id }} / {{ detail.conversation.service_id }}</strong></div>
        <div class="hint">
          ผู้ถาม {{ detail.conversation.username || detail.conversation.admin_id }} · เปิดห้อง {{ fmt(detail.conversation.created_at) }}
          · {{ detail.conversation.message_count }} ข้อความ
        </div>
      </div>

      <div v-for="m in detail.messages" :key="m.id" class="msg">
        <div class="msg-head">
          <a-tag :color="m.role === 'user' ? 'blue' : 'green'">{{ m.role === 'user' ? 'ผู้ถาม' : 'AI' }}</a-tag>
          <span class="mono hint">{{ fmt(m.created_at) }}</span>
          <a-tag v-if="m.category">{{ m.category }}</a-tag>
          <a-tag v-if="m.verification_status" :color="VERIFY[m.verification_status].color">
            {{ VERIFY[m.verification_status].label }}
          </a-tag>
          <a-tag v-if="m.status === 'error'" color="red">ตอบไม่สำเร็จ</a-tag>
          <a-tag v-else-if="m.status === 'aborted'">ผู้ใช้ยกเลิก</a-tag>
          <a-tag v-if="m.guard_hits" color="volcano">guard ×{{ m.guard_hits }}</a-tag>
        </div>
        <p v-if="m.text" class="msg-text">{{ m.text }}</p>

        <ChatCard v-for="c in m.cards ?? []" :key="c.id" :card="c" />

        <div v-if="m.tool_calls?.length" class="tool-calls">
          <span v-for="(t, i) in m.tool_calls" :key="i" class="tool-chip" :class="{ err: !t.ok }" :title="t.error || ''">
            {{ t.tool }} · {{ t.method }} {{ t.endpoint }} · {{ t.status || '—' }} · {{ t.ms }}ms<template v-if="t.cached"> · cache</template>
            <template v-if="t.error"> · {{ t.error }}</template>
          </span>
        </div>

        <div v-if="detail.verifications[m.id]" class="verify-box" :class="detail.verifications[m.id].status">
          <div>
            <strong>{{ detail.verifications[m.id].status === 'correct' ? 'ตรวจแล้ว: ถูก' : 'ตรวจแล้ว: ผิด' }}</strong>
            <span class="hint"> · โดย {{ detail.verifications[m.id].verified_by }} · {{ fmt(detail.verifications[m.id].verified_at) }}</span>
          </div>
          <div v-if="detail.verifications[m.id].correct_answer">คำตอบที่ถูก: {{ detail.verifications[m.id].correct_answer }}</div>
          <div v-if="detail.verifications[m.id].note" class="hint">หมายเหตุ: {{ detail.verifications[m.id].note }}</div>
        </div>

        <div v-if="m.role === 'assistant'" class="usage-line hint mono">
          token in {{ m.usage?.input_tokens ?? 0 }} / out {{ m.usage?.output_tokens ?? 0 }}
          <template v-if="m.first_token_ms"> · คำแรก {{ m.first_token_ms }}ms</template>
        </div>
      </div>
    </template>
  </a-drawer>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.hint { font-size: 12px; color: var(--muted); }
.mono { font-family: var(--font-mono); }

.rows-table :deep(.ant-table-thead > tr > th) { background: var(--ground); color: var(--muted); font-weight: 600; font-size: 12.5px; }
.rows-table :deep(.ant-table-tbody > tr:hover > td) { background: var(--accent-soft); }

.empty { padding: 24px 0; text-align: center; }
.empty-title { margin: 0; font-size: 14px; font-weight: 600; }
.empty-sub { margin: 4px 0 0; font-size: 12.5px; color: var(--muted); }

.conv-meta { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.msg { padding: 10px 0; border-bottom: 1px dashed var(--line); }
.msg-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
.msg-text { margin: 0 0 8px; white-space: pre-wrap; font-size: 13.5px; line-height: 1.6; }

.tool-calls { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.tool-chip { font-size: 11px; font-family: var(--font-mono); background: var(--ground); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; }
.tool-chip.err { color: var(--danger); border-color: var(--danger); }

.verify-box { font-size: 12.5px; border-left: 3px solid var(--accent); padding: 4px 10px; margin: 6px 0; }
.verify-box.wrong { border-left-color: var(--danger); }
.usage-line { margin-top: 4px; }
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getConversation, listConversations } from '@/services/api/admin'
import { useOfficeOptions } from '@/composables/useOfficeOptions'
import { apiErrorCode, apiErrorText, ERR_CONFIRM_OLD_REQUIRED } from '@/utils/apiErrors'
import type { Conversation, ConversationView } from '@/types'

const { offices, load: loadOffices, servicesOf } = useOfficeOptions()

const list = ref<Conversation[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')

const filter = reactive({
  office_id: undefined as string | undefined,
  service_id: undefined as string | undefined,
  user: '',
  q: '',
  from: undefined as string | undefined,
  to: undefined as string | undefined,
  verification: undefined as 'pending' | 'correct' | 'wrong' | undefined,
})

const serviceOptions = computed(() => (filter.office_id ? servicesOf(filter.office_id) : []))

function onOfficeChange() {
  filter.service_id = undefined
}

async function search() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listConversations({
      office_id: filter.office_id, service_id: filter.service_id, user: filter.user || undefined,
      q: filter.q || undefined, from: filter.from, to: filter.to, verification: filter.verification, limit: 100,
    })
    list.value = res.data
    total.value = res.total
  } catch (e) {
    loadError.value = apiErrorText(e)
  } finally {
    loading.value = false
  }
}

function onDateChange(v: [string, string] | null) {
  filter.from = v?.[0]
  filter.to = v?.[1]
}

// ---------- detail ----------
const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<ConversationView | null>(null)
const confirmOldFor = ref('')

async function openDetail(id: string, confirmOld = false) {
  detailLoading.value = true
  try {
    detail.value = await getConversation(id, confirmOld)
    detailOpen.value = true
    confirmOldFor.value = ''
  } catch (e) {
    if (apiErrorCode(e) === ERR_CONFIRM_OLD_REQUIRED) {
      confirmOldFor.value = id
    } else {
      message.error(apiErrorText(e))
    }
  } finally {
    detailLoading.value = false
  }
}

function fmt(v?: string) {
  return v ? new Date(v).toLocaleString('th-TH') : '—'
}

const columns = [
  { title: 'เปิดห้อง', key: 'opened_at' },
  { title: 'service', key: 'service' },
  { title: 'ผู้ถาม', key: 'user' },
  { title: 'หัวข้อ (คำถามแรก)', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: 'ข้อความ', dataIndex: 'message_count', key: 'message_count' },
  { title: 'ข้อความล่าสุด', key: 'last_message_at' },
  { title: 'สถานะ', key: 'status' },
]

onMounted(() => {
  loadOffices()
  search()
})
</script>

<template>
  <div class="page-head">
    <h1>ประวัติแชท</h1>
    <p class="sub">
      รายการห้องแยก office/service — เปิดอ่านทีละห้องเพื่อดูรายละเอียด (การ์ด/เครื่องมือ/ต้นทุน) ทุกครั้งที่เปิดจะถูกบันทึกไว้ว่าใครเปิดเมื่อไร
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
      <a-input v-model:value="filter.user" placeholder="user id / username" style="width: 160px" @keyup.enter="search" />
      <a-input v-model:value="filter.q" placeholder="ค้นคำในบทสนทนา" style="width: 200px" @keyup.enter="search" />
      <a-select v-model:value="filter.verification" placeholder="สถานะตรวจ: ทั้งหมด" style="width: 150px" allow-clear>
        <a-select-option value="pending">รอตรวจ</a-select-option>
        <a-select-option value="correct">ถูก</a-select-option>
        <a-select-option value="wrong">ผิด</a-select-option>
      </a-select>
      <a-range-picker show-time style="width: 340px" @change="(v: any) => onDateChange(v ? [v[0].toISOString(), v[1].toISOString()] : null)" />
      <a-button type="primary" :loading="loading" @click="search">ค้นหา</a-button>
    </div>
  </a-card>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <a-card size="small" class="tidy">
    <div class="header-row">
      <span class="count">ทั้งหมด {{ total }} ห้อง</span>
    </div>
    <a-table
      class="rows-table" :columns="columns" :data-source="list" :loading="loading" :pagination="false"
      row-key="id" size="middle" :custom-row="(r: Conversation) => ({ onClick: () => openDetail(r.id), style: 'cursor:pointer' })"
    >
      <template #emptyText>
        <div class="empty">
          <p class="empty-title">ไม่พบห้องแชทตามเงื่อนไขนี้</p>
          <p class="empty-sub">ลองล้างตัวกรองบางตัว หรือขยายช่วงเวลา</p>
        </div>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'opened_at'">{{ fmt(record.opened_at) }}</template>
        <template v-else-if="column.key === 'service'">{{ record.office_id }} / {{ record.service_id }}</template>
        <template v-else-if="column.key === 'user'">{{ record.user_name || record.user_id }}</template>
        <template v-else-if="column.key === 'last_message_at'">{{ fmt(record.last_message_at) }}</template>
        <template v-else-if="column.key === 'status'">
          <a-tag v-if="record.closed_at" color="default">ปิดแล้ว</a-tag>
          <a-tag v-else color="green">เปิดอยู่</a-tag>
        </template>
      </template>
    </a-table>
  </a-card>

  <!-- เก่ากว่า 90 วัน ต้องกดยืนยันเพิ่ม -->
  <a-modal
    :open="!!confirmOldFor"
    title="ข้อมูลเก่ากว่า 90 วัน"
    ok-text="เปิดอ่านต่อ" cancel-text="ยกเลิก"
    @ok="openDetail(confirmOldFor, true)"
    @cancel="confirmOldFor = ''"
  >
    <p>ห้องนี้เก่ากว่า 90 วัน — การเปิดอ่านจะถูกบันทึกเป็น "read_old" ในบันทึกการเข้าถึง ยืนยันจะเปิดอ่านต่อไหม</p>
  </a-modal>

  <!-- รายละเอียดห้อง -->
  <a-drawer v-model:open="detailOpen" title="รายละเอียดห้องแชท" width="720" :body-style="{ paddingBottom: '32px' }">
    <template v-if="detail">
      <div class="conv-meta">
        <div><strong>{{ detail.conversation.office_id }} / {{ detail.conversation.service_id }}</strong></div>
        <div class="hint">ผู้ถาม {{ detail.conversation.user_name || detail.conversation.user_id }} · เปิดห้อง {{ fmt(detail.conversation.opened_at) }}</div>
        <div v-if="detail.conversation.closed_reason" class="hint">ปิดห้อง: {{ detail.conversation.closed_reason }}</div>
      </div>

      <div v-for="m in detail.messages" :key="m.id" class="msg" :class="m.role">
        <div class="msg-head">
          <a-tag :color="m.role === 'user' ? 'blue' : 'green'">{{ m.role === 'user' ? 'ผู้ถาม' : 'AI' }}</a-tag>
          <span class="mono hint">{{ fmt(m.created_at) }}</span>
          <a-tag v-if="m.category" color="default">{{ m.category }}</a-tag>
          <a-tag v-if="m.verification_status === 'correct'" color="green">ตรวจแล้ว: ถูก</a-tag>
          <a-tag v-else-if="m.verification_status === 'wrong'" color="red">ตรวจแล้ว: ผิด</a-tag>
          <a-tag v-else-if="m.verification_status === 'pending'" color="orange">รอตรวจ</a-tag>
          <a-tag v-if="m.guard_hits > 0" color="volcano">guard ×{{ m.guard_hits }}</a-tag>
        </div>
        <p class="msg-text">{{ m.text }}</p>

        <div v-if="m.error" class="msg-error">error: {{ m.error }}</div>

        <div v-for="c in m.cards" :key="c.id" class="card-box">
          <div class="card-box-head">
            <strong>{{ c.title }}</strong>
            <a-tag size="small" :color="c.kind === 'ok' ? 'green' : c.kind === 'error' ? 'red' : 'default'">{{ c.kind }}</a-tag>
            <span v-if="c.cached" class="hint">(cache)</span>
          </div>
          <div v-if="c.fields.length" class="card-fields">
            <span v-for="f in c.fields" :key="f.label" class="card-field"><span class="hint">{{ f.label }}</span> {{ f.display }}</span>
          </div>
          <table v-if="c.table" class="card-table">
            <thead><tr><th v-for="col in c.table.columns" :key="col.label">{{ col.label }}</th></tr></thead>
            <tbody>
              <tr v-for="(row, i) in c.table.rows" :key="i">
                <td v-for="(cell, j) in row" :key="j">{{ cell.display }}</td>
              </tr>
            </tbody>
          </table>
          <div class="hint">ดึงเมื่อ {{ fmt(c.fetched_at) }} <template v-if="c.link"> · <a :href="c.link.path" target="_blank" rel="noopener">{{ c.link.label }}</a></template></div>
        </div>

        <div v-if="m.tool_calls.length" class="tool-calls">
          <span v-for="(t, i) in m.tool_calls" :key="i" class="tool-chip" :class="{ err: !t.ok }">
            {{ t.tool }} · {{ t.status }} · {{ t.ms }}ms<template v-if="t.cached"> · cache</template>
          </span>
        </div>

        <div v-if="m.role === 'assistant'" class="usage-line hint mono">
          token in {{ m.usage.in }} / out {{ m.usage.out }} · ${{ m.cost.amount.toFixed(4) }} {{ m.cost.currency }} · {{ m.latency_ms }}ms
        </div>
      </div>
    </template>
    <a-spin v-else-if="detailLoading" />
  </a-drawer>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.count { font-size: 13px; color: var(--muted); }
.hint { font-size: 12px; color: var(--muted); }

.rows-table :deep(.ant-table-thead > tr > th) { background: var(--ground); color: var(--muted); font-weight: 600; font-size: 12.5px; }
.rows-table :deep(.ant-table-tbody > tr:hover > td) { background: var(--accent-soft); }

.empty { padding: 24px 0; text-align: center; }
.empty-title { margin: 0; font-size: 14px; font-weight: 600; }
.empty-sub { margin: 4px 0 0; font-size: 12.5px; color: var(--muted); }

.conv-meta { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.msg { padding: 10px 0; border-bottom: 1px dashed var(--line); }
.msg-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
.msg-text { margin: 0 0 8px; white-space: pre-wrap; font-size: 13.5px; line-height: 1.6; }
.msg-error { color: var(--danger); font-size: 12.5px; margin-bottom: 8px; }

.card-box { border: 1px solid var(--line); border-radius: var(--r-control); padding: 10px 12px; margin-bottom: 8px; background: var(--ground); }
.card-box-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.card-fields { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 12.5px; margin-bottom: 4px; }
.card-field { display: flex; gap: 4px; }
.card-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 6px 0; }
.card-table th, .card-table td { border: 1px solid var(--line); padding: 4px 8px; text-align: left; }

.tool-calls { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.tool-chip { font-size: 11px; font-family: var(--font-mono); background: var(--ground); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; }
.tool-chip.err { color: var(--danger); border-color: var(--danger); }
.usage-line { margin-top: 4px; }
</style>

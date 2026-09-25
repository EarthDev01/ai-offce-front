<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  createGroup, createOffice, deleteGroup, listGroups, listOffices, patchService, renameGroup,
} from '@/services/api/offices'
import { listUsage } from '@/services/api/ops'
import { useAuthStore } from '@/stores/auth'
import InfoTip from '@/components/InfoTip.vue'
import type { Office, OfficeGroup, Service, UsagePeriod } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const canEdit = computed(() => auth.can('office.edit'))
const canDelete = computed(() => auth.can('office.delete'))
const canUsage = computed(() => auth.can('usage.view'))

// ลำดับชั้น: กลุ่ม → domain (1 URL) → service
const groups = ref<OfficeGroup[]>([])
const offices = ref<Office[]>([])
const loading = ref(true)
const loadError = ref('')
const q = ref('')

// การใช้ token เดือนนี้ key = office|service (โหลดเฉพาะคนที่มีสิทธิ์ usage.view)
const usage = ref<Record<string, UsagePeriod>>({})
const nf = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 })

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [g, o] = await Promise.all([listGroups(), listOffices()])
    groups.value = g.data
    offices.value = o.data
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
  if (canUsage.value) {
    try {
      const m: Record<string, UsagePeriod> = {}
      for (const u of (await listUsage()).data) m[`${u.office_id}|${u.service_id}`] = u
      usage.value = m
    } catch {
      /* ไม่แสดงคอลัมน์เดือนนี้ */
    }
  }
}

const stats = computed(() => {
  const services = offices.value.flatMap((o) => o.services.map((s) => ({ o, s })))
  return {
    groups: groups.value.length,
    domains: offices.value.length,
    domainsOff: offices.value.filter((o) => !o.enabled).length,
    services: services.length,
    // service ทำงานจริง = ตัวเองเปิด และ domain เปิด
    live: services.filter(({ o, s }) => o.enabled && s.enabled).length,
  }
})

const urlOf = (o: Office) => o.allowed_origins[0] ?? ''

interface DomainRow { office: Office; services: Service[] }
interface GroupRow { group: OfficeGroup | null; domains: DomainRow[]; total: number }

// ค้นได้ทั้ง 3 ชั้น · ตรงที่กลุ่ม = โชว์ทั้งกลุ่ม · ตรงที่ domain = โชว์ทุก service ของ domain นั้น
const shown = computed<GroupRow[]>(() => {
  const k = q.value.trim().toLowerCase()
  const hit = (...vs: string[]) => !k || vs.some((v) => v.toLowerCase().includes(k))
  const known = new Set(groups.value.map((g) => g.id))

  const domainsOf = (all: Office[], groupHit: boolean): DomainRow[] =>
    all
      .map((o) => {
        if (groupHit || hit(o.id, o.label, urlOf(o))) return { office: o, services: o.services }
        return { office: o, services: o.services.filter((s) => hit(s.id, s.label, s.display_name)) }
      })
      .filter((d) => groupHit || d.services.length > 0 || hit(d.office.id, d.office.label, urlOf(d.office)))

  const rows: GroupRow[] = groups.value.map((g) => {
    const all = offices.value.filter((o) => o.group_id === g.id)
    const groupHit = !!k && hit(g.name)
    return { group: g, domains: domainsOf(all, groupHit), total: all.length, groupHit }
  })
    .filter((r) => !k || r.groupHit || r.domains.length > 0)

  const loose = offices.value.filter((o) => !o.group_id || !known.has(o.group_id))
  const looseRows = domainsOf(loose, false)
  if (looseRows.length) rows.push({ group: null, domains: looseRows, total: loose.length })
  return rows
})

function usageText(o: Office, s: Service) {
  const u = usage.value[`${o.id}|${s.id}`]
  if (!u) return '—'
  const tokens = u.input_tokens + u.output_tokens + u.cache_read + u.cache_write
  return `${nf.format(u.questions)} คำถาม · ${nf.format(tokens)} token`
}

// ---------- เปิด/ปิด service ----------
const toggling = reactive<Record<string, boolean>>({})

async function setEnabled(o: Office, s: Service, enabled: boolean) {
  const key = `${o.id}|${s.id}`
  toggling[key] = true
  try {
    const updated = await patchService(o.id, s.id, { enabled })
    const i = offices.value.findIndex((x) => x.id === updated.id)
    if (i >= 0) offices.value[i] = updated
    message.success(`${enabled ? 'เปิด' : 'ปิด'} ${s.label || s.id} แล้ว`)
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    toggling[key] = false
  }
}

function onToggle(o: Office, s: Service, enabled: boolean) {
  if (enabled) {
    setEnabled(o, s, true)
    return
  }
  // ปิด = ปุ่ม AI หายจากหน้าแอดมินของเว็บนี้ทันที — ถามก่อน
  Modal.confirm({
    centered: true,
    title: `ปิด service "${s.label || s.id}" ?`,
    content: `ปุ่มผู้ช่วย AI จะหายจาก ${urlOf(o) || o.label} ทันที แอดมินที่กำลังคุยอยู่จะถามต่อไม่ได้ · เปิดกลับได้ทุกเมื่อ`,
    okText: 'ปิด service',
    okType: 'danger',
    cancelText: 'ยกเลิก',
    onOk: () => setEnabled(o, s, false),
  })
}

function openSettings(o: Office, s?: Service) {
  router.push({ path: `/offices/${encodeURIComponent(o.id)}`, query: s ? { service: s.id } : {} })
}

// ---------- กลุ่ม ----------
const groupOpen = ref(false)
const groupSaving = ref(false)
const groupForm = reactive({ id: '', name: '' }) // id ว่าง = สร้างใหม่

function newGroup() {
  Object.assign(groupForm, { id: '', name: '' })
  groupOpen.value = true
}

function editGroup(g: OfficeGroup) {
  Object.assign(groupForm, { id: g.id, name: g.name })
  groupOpen.value = true
}

async function submitGroup() {
  const name = groupForm.name.trim()
  if (!name) return
  groupSaving.value = true
  try {
    if (groupForm.id) {
      const g = await renameGroup(groupForm.id, name)
      const i = groups.value.findIndex((x) => x.id === g.id)
      if (i >= 0) groups.value[i] = g
      message.success('เปลี่ยนชื่อกลุ่มแล้ว')
    } else {
      groups.value.push(await createGroup(name))
      message.success(`สร้างกลุ่ม ${name} แล้ว — เพิ่ม domain ต่อได้เลย`)
    }
    groupOpen.value = false
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    groupSaving.value = false
  }
}

function onGroupMenu(key: string, g: OfficeGroup) {
  if (key === 'rename') editGroup(g)
  else if (key === 'delete') removeGroup(g)
}

function removeGroup(g: OfficeGroup) {
  Modal.confirm({
    centered: true,
    title: `ลบกลุ่ม "${g.name}" ?`,
    content: 'กลุ่มนี้ไม่มี domain แล้ว ลบได้เลย',
    okText: 'ลบกลุ่ม',
    okType: 'danger',
    cancelText: 'ยกเลิก',
    async onOk() {
      try {
        await deleteGroup(g.id)
        groups.value = groups.value.filter((x) => x.id !== g.id)
        message.success('ลบกลุ่มแล้ว')
      } catch (e) {
        message.error((e as Error).message)
      }
    },
  })
}

// ---------- เพิ่ม domain ในกลุ่ม ----------
const domainOpen = ref(false)
const creating = ref(false)
const domainForm = reactive({ group_id: '', group_name: '', origin: '', id: '', label: '' })

function newDomain(g: OfficeGroup) {
  Object.assign(domainForm, { group_id: g.id, group_name: g.name, origin: '', id: '', label: '' })
  domainOpen.value = true
}

async function submitDomain() {
  const id = domainForm.id.trim()
  if (!id) return
  creating.value = true
  try {
    const o = await createOffice({
      id, label: domainForm.label.trim(), group_id: domainForm.group_id, origin: domainForm.origin.trim(),
    })
    domainOpen.value = false
    message.success(`เพิ่ม domain ${o.label || o.id} แล้ว — เพิ่ม service ต่อได้เลย`)
    router.push(`/offices/${encodeURIComponent(o.id)}`)
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page-head">
    <h1>หลังบ้านลูกค้า</h1>
    <p class="sub">
      จัดเป็น <strong>กลุ่ม → domain → service</strong> · 1 domain = หลังบ้าน 1 URL ที่มีการตั้งค่าของตัวเอง ·
      เปิด/ปิดผู้ช่วยของแต่ละ service ได้จากที่นี่ กด "ตั้งค่า" เพื่อแก้หน้าตาและข้อความของผู้ช่วย
    </p>
  </div>

  <div v-if="loading" class="loading-state"><a-spin /></div>
  <a-alert v-else-if="loadError" type="error" :message="loadError" show-icon />

  <div v-else-if="groups.length === 0 && offices.length === 0" class="empty">
    <h2>ยังไม่มีกลุ่ม</h2>
    <p>สร้างกลุ่มแรก แล้วเพิ่ม domain ของลูกค้าเข้าไป</p>
    <a-button type="primary" size="large" :disabled="!canEdit" @click="newGroup">สร้างกลุ่ม</a-button>
  </div>

  <template v-else>
    <div class="stats">
      <div class="stat">
        <span class="num">{{ stats.groups }}</span>
        <span class="lbl">กลุ่ม</span>
      </div>
      <div class="stat">
        <span class="num">{{ stats.domains }}</span>
        <span class="lbl">domain<template v-if="stats.domainsOff"> · <span class="warn">ปิดอยู่ {{ stats.domainsOff }}</span></template></span>
      </div>
      <div class="stat">
        <span class="num">{{ stats.services }}</span>
        <span class="lbl">service ทั้งหมด</span>
      </div>
      <div class="stat">
        <span class="num ok">{{ stats.live }}<small> / {{ stats.services }}</small></span>
        <span class="lbl">service ที่ผู้ช่วยทำงานอยู่</span>
      </div>
    </div>

    <div class="toolbar">
      <a-input v-model:value="q" placeholder="ค้นกลุ่ม · domain / URL · service" allow-clear style="max-width: 340px" />
      <a-button type="primary" :disabled="!canEdit" @click="newGroup">+ สร้างกลุ่ม</a-button>
    </div>

    <div v-if="shown.length === 0" class="hint" style="padding: 24px 0; text-align: center">ไม่พบกลุ่ม domain หรือ service ที่ตรงกับ "{{ q }}"</div>

    <section v-for="row in shown" :key="row.group?.id ?? '_loose'" class="group" :class="{ loose: !row.group }">
      <header class="group-head">
        <div class="group-title">
          <h2>{{ row.group ? row.group.name : 'ยังไม่ได้จัดกลุ่ม' }}</h2>
          <span class="count">{{ row.total }} domain</span>
        </div>
        <div v-if="row.group && (canEdit || canDelete)" class="group-actions">
          <a-button v-if="canEdit" @click="newDomain(row.group)">+ เพิ่ม domain</a-button>
          <a-dropdown placement="bottomRight" :trigger="['click']">
            <a-button class="more" aria-label="จัดการกลุ่ม">⋯</a-button>
            <template #overlay>
              <a-menu @click="({ key }: any) => onGroupMenu(String(key), row.group!)">
                <a-menu-item v-if="canEdit" key="rename">เปลี่ยนชื่อกลุ่ม</a-menu-item>
                <a-menu-item v-if="canDelete" key="delete" danger :disabled="row.total > 0">
                  ลบกลุ่ม<span v-if="row.total" class="menu-note"> · ย้ายหรือลบ domain ออกก่อน</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
        <span v-else class="hint">เลือกกลุ่มให้ได้ในหน้าตั้งค่า domain</span>
      </header>

      <div v-if="row.domains.length === 0" class="hint group-empty">ยังไม่มี domain ในกลุ่มนี้</div>

      <a-card v-for="{ office: o, services } in row.domains" :key="o.id" size="small" class="tidy domain-card">
        <div class="domain-head">
          <div class="domain-title">
            <h3>{{ o.label || o.id }}</h3>
            <code class="hint">{{ o.id }}</code>
            <a-tag :color="o.enabled ? 'green' : 'red'">{{ o.enabled ? 'เปิดอยู่' : 'ปิดอยู่' }}</a-tag>
            <a-tag v-if="o.is_hidden">ซ่อนปุ่มลอย</a-tag>
          </div>
          <a-button size="small" @click="openSettings(o)">ตั้งค่า domain →</a-button>
        </div>
        <div class="domain-meta">
          <span>
            URL:
            <code v-if="urlOf(o)" class="chip">{{ urlOf(o) }}</code>
            <span v-else class="warn">ยังไม่ได้ใส่ — widget ยังขึ้นไม่ได้</span>
          </span>
          <span v-if="o.host_api_base">API: <code class="chip">{{ o.host_api_base }}</code></span>
        </div>
        <a-alert
          v-if="!o.enabled"
          type="warning"
          show-icon
          message="domain ปิดอยู่ — ทุก service ใน domain นี้ไม่ทำงาน แม้สวิตช์ของ service จะเปิดอยู่ (เปิดได้ในหน้าตั้งค่า)"
          style="margin: 10px 0 0"
        />

        <table v-if="services.length" class="svc-table">
          <thead>
            <tr>
              <th>service</th>
              <th>ชื่อผู้ช่วย</th>
              <th v-if="canUsage">เดือนนี้</th>
              <th class="c">สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in services" :key="s.id">
              <td>
                <div class="svc-name">{{ s.label || s.id }}</div>
                <code class="hint">{{ s.id }}</code>
              </td>
              <td>{{ s.display_name || '—' }}</td>
              <td v-if="canUsage" class="hint">{{ usageText(o, s) }}</td>
              <td class="c">
                <a-switch
                  v-if="canEdit"
                  :checked="s.enabled"
                  :loading="toggling[`${o.id}|${s.id}`]"
                  checked-children="เปิด"
                  un-checked-children="ปิด"
                  @change="(v: any) => onToggle(o, s, !!v)"
                />
                <a-tag v-else :color="s.enabled ? 'green' : 'default'">{{ s.enabled ? 'เปิด' : 'ปิด' }}</a-tag>
              </td>
              <td class="r"><a-button type="link" size="small" @click="openSettings(o, s)">ตั้งค่า →</a-button></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="hint" style="margin-top: 10px">ยังไม่มี service — เพิ่มได้ในหน้าตั้งค่า domain</div>
      </a-card>
    </section>
  </template>

  <a-modal
    v-model:open="groupOpen"
    centered
    :title="groupForm.id ? 'เปลี่ยนชื่อกลุ่ม' : 'สร้างกลุ่ม'"
    :width="420"
    :confirm-loading="groupSaving"
    :ok-text="groupForm.id ? 'บันทึก' : 'สร้างกลุ่ม'"
    cancel-text="ยกเลิก"
    :ok-button-props="{ disabled: !groupForm.name.trim() }"
    @ok="submitGroup"
  >
    <p class="hint">กลุ่มใช้จัดหมวด domain ที่มาจากระบบเดียวกัน · ไม่มีผลกับการทำงานของ widget</p>
    <label>ชื่อกลุ่ม</label>
    <a-input v-model:value="groupForm.name" :maxlength="60" placeholder="เช่น example-group" @keyup.enter="submitGroup" />
  </a-modal>

  <a-modal
    v-model:open="domainOpen"
    centered
    :title="`เพิ่ม domain ใน ${domainForm.group_name}`"
    :width="460"
    :confirm-loading="creating"
    ok-text="เพิ่ม domain"
    cancel-text="ยกเลิก"
    :ok-button-props="{ disabled: !domainForm.id.trim() }"
    @ok="submitDomain"
  >
    <p class="hint">domain คือหลังบ้าน 1 เว็บ (1 URL) ที่จะให้ปุ่มผู้ช่วย AI ขึ้น</p>
    <label>
      URL ของ domain
      <InfoTip>
        ที่อยู่เว็บหลังบ้านที่แอดมินเปิดใช้ — AI จะขึ้นเฉพาะเว็บที่ URL ตรงกับช่องนี้<br />
        ใส่แค่ส่วนหน้า เช่น <code>https://office.example.com</code> ไม่ต้องมี / ต่อท้าย<br />
        1 URL อยู่ได้แค่ domain เดียว · เว้นไว้ใส่ทีหลังได้
      </InfoTip>
    </label>
    <a-input v-model:value="domainForm.origin" placeholder="เช่น https://office.example.com" />
    <label>
      รหัส domain
      <InfoTip>
        ชื่อเรียกภายในระบบ ลูกค้าไม่เห็น<br />
        ใช้ภาษาอังกฤษ ตัวเลข - _ เท่านั้น<br />
        <strong>ตั้งแล้วเปลี่ยนไม่ได้</strong>
      </InfoTip>
    </label>
    <a-input v-model:value="domainForm.id" placeholder="เช่น example-domain" @keyup.enter="submitDomain" />
    <label>
      ชื่อที่แสดง <span class="hint">— ไม่บังคับ</span>
      <InfoTip text="ชื่อที่เห็นในหน้า console นี้ ให้จำง่ายว่าเป็นเว็บไหน · ไม่ใส่จะใช้รหัส domain แทน · แก้ทีหลังได้" />
    </label>
    <a-input v-model:value="domainForm.label" placeholder="เช่น Example Domain" @keyup.enter="submitDomain" />
    <p class="hint after">เพิ่มเสร็จแล้วระบบจะพาไปหน้าตั้งค่า เพื่อเพิ่ม service และปรับหน้าตาต่อ</p>
  </a-modal>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.hint { font-size: 12px; color: var(--muted); }
.hint.after { margin: 14px 0 0; }
label { display: flex; align-items: center; font-size: 12.5px; color: var(--muted); margin: 12px 0 4px; }
label .hint { margin-left: 4px; }
code { font-family: var(--font-mono); font-size: 11.5px; }

.stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; margin-bottom: 20px; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
.num { font-family: var(--font-head); font-size: 26px; font-weight: 700; color: var(--ink); line-height: 1.2; }
.num small { font-size: 15px; color: var(--muted); font-weight: 600; }
.num.ok { color: var(--accent); }
.lbl { font-size: 12.5px; color: var(--muted); }

.toolbar { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }

/* ชั้น 1: กลุ่ม */
.group { border-left: 3px solid var(--accent); padding: 2px 0 4px 16px; margin-bottom: 28px; }
.group.loose { border-left-color: var(--line); }
.group-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.group-title { display: flex; align-items: baseline; gap: 10px; }
.group-title h2 { margin: 0; font-size: 19px; }
.count { font-size: 12.5px; color: var(--muted); }
.group-actions { display: flex; align-items: center; gap: 8px; }
.more { width: 32px; padding: 0; font-size: 18px; line-height: 1; letter-spacing: 1px; }
.menu-note { font-size: 12px; color: var(--muted); }
.group-empty { padding: 14px 0; }

/* ชั้น 2: domain */
.domain-card { margin-bottom: 12px; }
.domain-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.domain-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.domain-title h3 { margin: 0; font-size: 15.5px; }
.domain-meta { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 6px; font-size: 12.5px; color: var(--muted); }
.chip { background: var(--ground); border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; margin-left: 4px; color: var(--ink); }
.warn { color: var(--danger); }

/* ชั้น 3: service */
.svc-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
.svc-table th { text-align: left; font-size: 12px; font-weight: 600; color: var(--muted); padding: 8px 10px; border-bottom: 1px solid var(--line); background: var(--ground); }
.svc-table td { padding: 10px; border-bottom: 1px solid var(--line); vertical-align: middle; font-size: 13.5px; }
.svc-table tbody tr:last-child td { border-bottom: none; }
.svc-table .c { text-align: center; width: 110px; }
.svc-table .r { text-align: right; width: 90px; padding-right: 0; }
/* ปลายลิงก์ "ตั้งค่า →" ตรงกับขอบขวาของปุ่ม "ตั้งค่า domain" */
.svc-table .r :deep(.ant-btn) { padding-right: 0; }
.svc-name { font-weight: 600; }

.empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; max-width: 460px; margin: 8px auto; padding: 48px 32px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); }
.empty h2 { font-size: 18px; }
.empty p { margin: 0 0 16px; font-size: 13.5px; color: var(--muted); }
.loading-state { display: flex; justify-content: center; align-items: center; min-height: 320px; }
</style>

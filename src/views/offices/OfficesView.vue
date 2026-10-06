<script setup lang="ts">
import { matchOption } from '@/utils/selectSearch'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  listOffices, listGroups, listKinds, patchOffice, deleteOffice,
  addService, patchService, removeService, listWidgetAssets,
  type OfficeKind, type WidgetAssets,
} from '@/services/api/offices'
import LookPicker from '@/components/LookPicker.vue'
import InfoTip from '@/components/InfoTip.vue'
import { API_BASE } from '@/services/api/client'
import WidgetPreview from '@/components/WidgetPreview.vue'
import { useAuthStore } from '@/stores/auth'
import type { Office, OfficeGroup, Service } from '@/types'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const offices = ref<Office[]>([])
// office มาจาก URL /offices/:id · service ที่เลือกไว้มาจาก ?service= (กดมาจากหน้าภาพรวม)
const officeId = ref(String(route.params.id ?? ''))
const serviceId = ref(String(route.query.service ?? ''))
const loadError = ref('')
const loading = ref(true)
const saving = ref(false)

const groups = ref<OfficeGroup[]>([])
const kinds = ref<OfficeKind[]>([])
// คลังรูปของ widget — โหลดไม่ได้ก็ยังใส่ลิงก์รูปเองได้
const assets = ref<WidgetAssets>({ avatars: [], backgrounds: [], patterns: [], launchers: [] })
// ว่าง = ชนิดตั้งต้นของระบบ (domain ที่สร้างก่อนมีตัวเลือกนี้)
const kind = ref('')
// 1 domain = 1 URL
const originText = ref('')
const hostApiBase = ref('')

// ฟอร์ม modal เพิ่ม service (เพิ่ม domain ทำที่หน้าภาพรวม ในกลุ่มของมัน)
const newServiceOpen = ref(false)
const creating = ref(false)
const serviceForm = reactive({ id: '', label: '' })

const office = computed(() => offices.value.find((o) => o.id === officeId.value) ?? null)
const service = computed(() => office.value?.services.find((s) => s.id === serviceId.value) ?? null)

// snippet ชุดเดียวใช้ได้กับทุก office / ทุกโดเมน — หลังบ้าน ai แยกลูกค้าจากโดเมนที่เรียกเข้ามาเอง
const snippet = `<script src="${API_BASE}/widget/v1/ai-office.js" defer><\/script>`

async function reload(keepService = true) {
  loadError.value = ''
  try {
    const [res, g, k] = await Promise.all([listOffices(), listGroups(), listKinds()])
    offices.value = res.data
    groups.value = g.data
    kinds.value = k
    listWidgetAssets().then((a) => (assets.value = a)).catch(() => {})
    if (!office.value) {
      // ไม่มี office รหัสนี้ (ถูกลบไปแล้ว / พิมพ์ URL ผิด) — กลับหน้าภาพรวม
      router.replace('/offices')
      return
    }
    syncForm(keepService)
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function syncForm(keepService = true) {
  const o = office.value
  originText.value = o?.allowed_origins[0] ?? ''
  hostApiBase.value = o?.host_api_base ?? ''
  kind.value = o?.kind || kinds.value.find((k) => k.default)?.kind || ''
  if (!keepService || !service.value) serviceId.value = o?.services[0]?.id ?? ''
}

watch(officeId, (id) => {
  syncForm(false)
  if (id && id !== route.params.id) router.replace(`/offices/${encodeURIComponent(id)}`)
})
watch(() => route.params.id, (id) => {
  if (typeof id === 'string' && id && id !== officeId.value) officeId.value = id
})
watch(serviceId, (sid) => {
  if (sid && sid !== route.query.service) router.replace({ query: { ...route.query, service: sid } })
})

function apply(updated: Office) {
  const i = offices.value.findIndex((o) => o.id === updated.id)
  if (i >= 0) offices.value[i] = updated
  else offices.value.push(updated)
}

async function run(fn: () => Promise<Office | null>, okMsg: string): Promise<boolean> {
  saving.value = true
  try {
    const updated = await fn()
    if (updated) apply(updated)
    message.success(okMsg)
    return true
  } catch (e) {
    message.error((e as Error).message)
    return false
  } finally {
    saving.value = false
  }
}

// สีหลักของ widget — ว่าง = สีตั้งต้นของ widget (DEFAULT_ACCENT) · ตัวเลือกสำเร็จรูปให้กดง่าย
const DEFAULT_ACCENT = '#0f6e63'
const HEX = /^#[0-9a-f]{6}$/i
// เลือกสีเอง = ไล่สี 2–4 สีเท่านั้น · ชุดสำเร็จรูปแบบหัวแชทของเว็บผู้เล่น
const GRADIENT_PRESETS: string[][] = [
  ['#f5d76e', '#2563eb'], ['#7b2ff7', '#f107a3'], ['#06b6d4', '#2563eb'], ['#f59e0b', '#dc2626'],
  ['#10b981', '#0f766e'], ['#ec4899', '#8b5cf6'], ['#1e293b', '#475569'],
  ['#f5d76e', '#22c55e', '#2563eb'], ['#f97316', '#ec4899', '#8b5cf6'], ['#22d3ee', '#3b82f6', '#6366f1', '#a855f7'],
]
// domain เก่าที่ตั้งสีเดียวไว้ → เริ่มเป็นไล่สีเดียวกัน 2 จุด · ยังไม่ตั้งเลย → ชุดแรก
const gradStops = computed<string[]>(() => {
  const o = office.value
  if (o?.accent_colors?.length) return o.accent_colors
  if (o?.accent_color) return [o.accent_color, o.accent_color]
  return GRADIENT_PRESETS[0]
})
const stopsInvalid = computed(() => gradStops.value.some((c) => !HEX.test(c)))
const gradientCss = (stops: string[]) => `linear-gradient(110deg, ${stops.join(', ')})`
function setStops(stops: string[]) {
  if (office.value) office.value.accent_colors = stops.map((c) => c.toLowerCase())
}
function setStop(i: number, v: string) {
  const next = [...gradStops.value]
  next[i] = v.trim().toLowerCase()
  setStops(next)
}
function addStop() {
  const s = gradStops.value
  if (s.length < 4) setStops([...s, s[s.length - 1]])
}
function removeStop(i: number) {
  if (gradStops.value.length > 2) setStops(gradStops.value.filter((_, k) => k !== i))
}
function setColorSource(v: string) {
  if (office.value) office.value.color_source = v
}
// ชนิดหลังบ้านที่เลือกอยู่มีสีของแบรนด์ให้อ่านไหม
const siteColorsAvailable = computed(() => !!kinds.value.find((k) => k.kind === kind.value)?.site_colors)
const useSiteColors = computed(() => siteColorsAvailable.value && office.value?.color_source === 'site')

// ตัวเลือก domain จัดหัวตามกลุ่ม · domain ที่ยังไม่มีกลุ่มอยู่ท้ายสุด
const domainOptions = computed(() => {
  const out = groups.value.map((g) => ({ label: g.name, items: offices.value.filter((o) => o.group_id === g.id) }))
  const known = new Set(groups.value.map((g) => g.id))
  const rest = offices.value.filter((o) => !o.group_id || !known.has(o.group_id))
  if (rest.length) out.push({ label: 'ยังไม่ได้จัดกลุ่ม', items: rest })
  return out.filter((g) => g.items.length)
})

async function saveOffice() {
  const o = office.value
  if (!o) return
  const ok = await run(
    () =>
      patchOffice(o.id, {
        label: o.label,
        enabled: o.enabled,
        is_hidden: o.is_hidden,
        theme: o.theme,
        // ใช้สีของเว็บ = ไม่เก็บสีเอง · เลือกเอง = ไล่สี 2–4 สี (สีแรกเก็บใน accent_color ด้วย สำหรับ widget รุ่นเก่า)
        ...(useSiteColors.value
          ? { color_source: 'site', accent_colors: [], accent_color: '' }
          : { color_source: '', accent_colors: gradStops.value, accent_color: gradStops.value[0] }),
        placement: o.placement,
        allowed_origins: originText.value.trim() ? [originText.value.trim()] : [],
        ...(o.group_id ? { group_id: o.group_id } : {}),
        host_api_base: hostApiBase.value.trim(),
        ...(kind.value ? { kind: kind.value } : {}),
      }),
    'บันทึก domain แล้ว',
  )
  // server เก็บโดเมนในรูปแบบมาตรฐาน (ตัวพิมพ์เล็ก ไม่มี / ท้าย ตัดตัวซ้ำ) — โชว์ค่าที่เก็บจริง
  // ถ้าบันทึกไม่ผ่าน (เช่นโดเมนซ้ำกับ office อื่น) คงข้อความที่พิมพ์ไว้ให้แก้ต่อ
  if (ok) syncForm()
}

function confirmDeleteOffice() {
  const o = office.value
  if (!o) return
  Modal.confirm({
    centered: true,
    title: `ลบ domain "${o.label}" ?`,
    content: `widget บน ${o.allowed_origins[0] ?? 'domain นี้'} จะหยุดทำงานทันที และ service ทั้ง ${o.services.length} ตัวจะถูกลบไปด้วย`,
    okText: 'ลบ',
    okType: 'danger',
    cancelText: 'ยกเลิก',
    async onOk() {
      await deleteOffice(o.id)
      message.success('ลบแล้ว')
      router.push('/offices')
    },
  })
}

// ---------- service ----------
function newService() {
  if (!office.value) return
  serviceForm.id = ''
  serviceForm.label = ''
  newServiceOpen.value = true
}

async function submitNewService() {
  const o = office.value
  const id = serviceForm.id.trim()
  if (!o || !id) return
  creating.value = true
  try {
    const updated = await addService(o.id, id, serviceForm.label.trim())
    apply(updated)
    serviceId.value = id
    newServiceOpen.value = false
    message.success('เพิ่ม service แล้ว')
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    creating.value = false
  }
}

function saveService() {
  const o = office.value
  const s = service.value
  if (!o || !s) return
  run(
    () =>
      patchService(o.id, s.id, {
        label: s.label,
        enabled: s.enabled,
        display_name: s.display_name,
        greeting: s.greeting,
        // ไม่ได้เลือก = สุ่มจากคลังรูป
        avatar_url: s.avatar_url || 'random',
        tagline: s.tagline ?? '',
        background: s.background || 'random',
        launcher_icon: s.launcher_icon ?? '',
      }),
    'บันทึก service แล้ว',
  )
}

function confirmDeleteService() {
  const o = office.value
  const s = service.value
  if (!o || !s) return
  Modal.confirm({
    centered: true,
    title: `ลบ service "${s.label}" ?`,
    content: 'แอดมินที่กำลังดู service นี้จะไม่เห็นปุ่ม AI อีก · snippet ไม่ต้องแก้',
    okText: 'ลบ',
    okType: 'danger',
    cancelText: 'ยกเลิก',
    async onOk() {
      apply(await removeService(o.id, s.id))
      serviceId.value = office.value?.services[0]?.id ?? ''
      message.success('ลบแล้ว')
    },
  })
}

function copySnippet() {
  navigator.clipboard
    ?.writeText(snippet)
    .then(() => message.success('คัดลอกแล้ว'))
    .catch(() => message.error('คัดลอกไม่ได้ — เลือกข้อความแล้วกด copy เอง'))
}

// keepService = true → คง service จาก ?service= ไว้ถ้ามีอยู่จริง ไม่งั้นเลือกตัวแรก
onMounted(() => reload(true))
</script>

<template>
  <div class="page-head">
    <RouterLink to="/offices" class="back">← หลังบ้านลูกค้าทั้งหมด</RouterLink>
    <h1>ตั้งค่า domain</h1>
    <p class="sub">
      1 domain = หลังบ้าน 1 URL — มีการตั้งค่าหน้าตาของตัวเอง และมีได้หลาย service (แบรนด์) ที่แชทแยกกัน
    </p>
  </div>

  <!-- กำลังโหลด — กัน empty state แว๊บก่อนข้อมูลมา -->
  <div v-if="loading" class="loading-state">
    <a-spin />
  </div>

  <a-alert v-else-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <!-- empty state — ยังไม่มี domain -->
  <div v-else-if="offices.length === 0" class="empty">
    <span class="empty-mark" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 3.5V17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="currentColor" />
      </svg>
    </span>
    <h2>ยังไม่มี domain</h2>
    <p>สร้างกลุ่มและ domain แรกที่หน้าหลังบ้านลูกค้า</p>
    <a-button type="primary" size="large" @click="router.push('/offices')">ไปหน้าหลังบ้านลูกค้า</a-button>
  </div>

  <div v-else class="cols">
    <div class="form">
      <a-card size="small" class="tidy" style="margin-bottom: 16px">
        <div class="row">
          <a-select v-model:value="officeId" show-search :filter-option="matchOption" style="flex: 1" placeholder="เลือก domain">
            <a-select-opt-group v-for="g in domainOptions" :key="g.label" :label="g.label">
              <a-select-option v-for="o in g.items" :key="o.id" :value="o.id" :search="`${g.label} ${o.id} ${o.label} ${o.allowed_origins[0] ?? ''}`">
                {{ o.label }} · {{ o.allowed_origins[0] ?? 'ยังไม่ใส่ URL' }} · {{ o.services.length }} service
              </a-select-option>
            </a-select-opt-group>
          </a-select>
        </div>
      </a-card>

      <template v-if="office">
        <a-card size="small" class="tidy" title="Snippet สำหรับหลังบ้านลูกค้า" style="margin-bottom: 16px">
          <pre class="snippet">{{ snippet }}</pre>
          <div class="row" style="margin-top: 12px">
            <a-button size="small" type="primary" @click="copySnippet">คัดลอก snippet</a-button>
          </div>
          <div class="hint">
            <strong>ชุดเดียวใช้ได้ทุก domain</strong> — แปะครั้งเดียวในโค้ดของหลังบ้านลูกค้า (เช่น <code>index.html</code>)
            แล้ว deploy ไปกี่ URL ก็ได้ · หลังบ้าน ai ดูจาก URL ที่เปิดอยู่ว่าเป็น domain ไหน
            จึงต้องสร้าง domain ให้ครบทุก URL
          </div>
        </a-card>

        <a-card size="small" class="tidy" title="ตั้งค่า domain" style="margin-bottom: 16px">
          <label>กลุ่ม</label>
          <a-select v-model:value="office.group_id" show-search :filter-option="matchOption" placeholder="เลือกกลุ่ม" style="width: 100%">
            <a-select-option v-for="g in groups" :key="g.id" :value="g.id" :search="g.name">{{ g.name }}</a-select-option>
          </a-select>

          <label>ชื่อที่แสดง</label>
          <a-input v-model:value="office.label" />

          <label>URL ของ domain</label>
          <a-input v-model:value="originText" placeholder="เช่น https://office.example.com" allow-clear />
          <div class="hint">
            <strong>ใช้ระบุว่า widget ที่เปิดอยู่เป็นของ domain ไหน</strong> — ใส่แค่ <code>https://โดเมน</code> ห้ามมี path ·
            1 URL อยู่ได้แค่ domain เดียว · <code>www.</code> กับไม่มี <code>www.</code> นับเป็นคนละ URL (ต้องสร้างเป็น 2 domain)
          </div>

          <label>ชนิดหลังบ้าน</label>
          <a-select v-model:value="kind" placeholder="เลือกชนิดหลังบ้าน" style="width: 100%">
            <a-select-option v-for="k in kinds" :key="k.kind" :value="k.kind">{{ k.label }} ({{ k.kind }})</a-select-option>
          </a-select>
          <div class="hint">
            <strong>ต้องตรงกับหลังบ้านที่แปะ snippet</strong> — widget อ่านการล็อกอินและยิง API ตามชนิดนี้ ·
            เลือกผิด = ปุ่มไม่โผล่ (อ่าน token ไม่เจอ)
          </div>

          <label>URL API หลังบ้าน (ไม่บังคับ)</label>
          <a-input v-model:value="hostApiBase" placeholder="https://demo-dev-office.example.com/api" allow-clear />
          <div class="hint">
            ว่าง = widget ยิง API ที่ <code>&lt;URL ของ domain&gt;/api</code> เอง ·
            ใส่เฉพาะตอนที่ API อยู่คนละที่กับหน้าเว็บ เช่น <strong>หน้า dev</strong> ที่รันบน localhost
          </div>

          <a-divider style="margin: 14px 0" />

          <a-switch v-model:checked="office.enabled" />
          <span class="sw">เปิดใช้งาน domain นี้</span>
          <div class="hint"><strong>สวิตช์ฉุกเฉิน</strong> — ปิดแล้วทุก service ใน domain นี้ปิดตามทันที</div>

          <div style="margin-top: 12px">
            <a-switch v-model:checked="office.is_hidden" />
            <span class="sw">ซ่อนปุ่มลอย</span>
          </div>
          <div class="hint">widget ยังโหลดแต่ไม่มีปุ่ม — ให้หลังบ้านลูกค้าเรียกเองด้วย <code>window.__aiOffice.open()</code></div>

          <label>ธีม</label>
          <a-radio-group v-model:value="office.theme" button-style="solid">
            <a-radio-button value="auto">ตามเครื่องผู้ใช้</a-radio-button>
            <a-radio-button value="light">สว่าง</a-radio-button>
            <a-radio-button value="dark">มืด</a-radio-button>
          </a-radio-group>

          <label>สีของ widget<InfoTip text="ใช้กับปุ่มลอย หัวแชท ฟองข้อความของผู้ใช้ และปุ่มส่ง · สีตัวอักษรบนสี (ขาว/เข้ม) เลือกให้อัตโนมัติ" /></label>
          <a-radio-group
            v-if="siteColorsAvailable"
            :value="useSiteColors ? 'site' : ''"
            button-style="solid"
            style="margin-bottom: 10px"
            @update:value="(v: string) => setColorSource(v)"
          >
            <a-radio-button value="site">ใช้สีของเว็บ</a-radio-button>
            <a-radio-button value="">เลือกเอง (ไล่สี)</a-radio-button>
          </a-radio-group>

          <div v-if="useSiteColors" class="hint">
            widget อ่านสีของแบรนด์จากหน้าเว็บเอง — แต่ละแบรนด์ได้สีของตัวเองโดยไม่ต้องตั้ง · ถ้าอ่านไม่ได้จะใช้สีตั้งต้นของ widget ·
            หน้าตัวอย่างด้านขวาแสดงสีตั้งต้น (คอนโซลอ่านสีของหน้าเว็บผู้เล่นไม่ได้)
          </div>

          <template v-else>
            <div class="accent-row">
              <button
                v-for="g in GRADIENT_PRESETS"
                :key="g.join()"
                type="button"
                class="swatch grad"
                :class="{ on: gradStops.join() === g.join() }"
                :style="{ background: gradientCss(g) }"
                :aria-label="`ไล่สี ${g.join(' → ')}`"
                @click="setStops([...g])"
              />
            </div>
            <div class="grad-bar" :style="{ background: gradientCss(gradStops) }" />
            <div v-for="(c, i) in gradStops" :key="i" class="stop-row">
              <span class="stop-n">สี {{ i + 1 }}</span>
              <input type="color" class="picker" :value="HEX.test(c) ? c : DEFAULT_ACCENT" :aria-label="`เลือกสีที่ ${i + 1}`" @input="setStop(i, ($event.target as HTMLInputElement).value)" />
              <a-input :value="c" style="width: 130px" :status="HEX.test(c) ? '' : 'error'" @update:value="(v: string) => setStop(i, v)" />
              <a-button v-if="gradStops.length > 2" size="small" type="link" danger @click="removeStop(i)">ลบ</a-button>
            </div>
            <a-button v-if="gradStops.length < 4" size="small" style="margin-top: 6px" @click="addStop">+ เพิ่มสี</a-button>
            <div class="hint">ไล่สีอย่างน้อย 2 สี เพิ่มได้ถึง 4 สี<span v-if="stopsInvalid" class="err"> — ทุกสีต้องเป็นรหัส #rrggbb</span></div>
          </template>

          <label>ตำแหน่งปุ่มลอย</label>
          <a-radio-group v-model:value="office.placement.position" button-style="solid">
            <a-radio-button value="bottom-right">ขวาล่าง</a-radio-button>
            <a-radio-button value="bottom-left">ซ้ายล่าง</a-radio-button>
          </a-radio-group>

          <label>ระยะจากขอบซ้าย/ขวา — {{ office.placement.offset_x }} px</label>
          <a-slider v-model:value="office.placement.offset_x" :min="0" :max="200" />
          <label>ระยะจากขอบล่าง — {{ office.placement.offset_y }} px</label>
          <a-slider v-model:value="office.placement.offset_y" :min="0" :max="200" />
          <div class="hint">
            อยู่ระดับ domain เพราะทุก service เปิดในหน้าหลังบ้านเดียวกัน — ถ้าให้ต่างกันรายแบรนด์ ปุ่มจะเด้งไปมาตอนสลับ service
          </div>

          <div class="row" style="margin-top: 14px">
            <a-button type="primary" :loading="saving" :disabled="!auth.can('office.edit')" @click="saveOffice">บันทึก domain</a-button>
            <a-button danger :disabled="!auth.can('office.delete')" @click="confirmDeleteOffice">ลบ domain</a-button>
          </div>
          <div v-if="office.updated_by" class="hint">
            แก้ล่าสุดโดย {{ office.updated_by }} · {{ new Date(office.updated_at).toLocaleString('th-TH') }}
          </div>
        </a-card>

        <a-card size="small" class="tidy" title="Services" style="margin-bottom: 16px">
          <div class="row">
            <a-select v-model:value="serviceId" show-search :filter-option="matchOption" style="flex: 1" placeholder="ยังไม่มี service">
              <a-select-option v-for="s in office.services" :key="s.id" :value="s.id" :search="`${s.id} ${s.label}`">
                {{ s.label }} ({{ s.id }}) {{ s.enabled ? '· เปิด' : '· ปิด' }}
              </a-select-option>
            </a-select>
            <a-button :disabled="!auth.can('office.edit')" @click="newService">เพิ่ม service</a-button>
          </div>
          <p v-if="office.services.length === 0" class="empty-inline">
            ยังไม่มี service ใน domain นี้ — เพิ่ม service แรกเพื่อกำหนดชื่อ รูป และคำทักทายของ AI
          </p>

          <template v-if="service">
            <a-divider style="margin: 14px 0" />

            <label>ชื่อ service</label>
            <a-input v-model:value="service.label" />

            <label>ชื่อที่ AI ใช้แสดง</label>
            <a-input v-model:value="service.display_name" />

            <label>ปุ่มเปิดแชท<InfoTip text="ฟองแชท 3D ลอยมุมจอ · ระบบย้อมสีตามสีของ widget (สีของเว็บ หรือสีที่เลือก) ให้เอง" /></label>
            <LookPicker v-model="service.launcher_icon" :options="assets.launchers" shape="avatar" :random="false" tint :accent="gradStops[0]" />

            <label>รูปผู้ช่วย<InfoTip text="ขึ้นบนหัวแชท · ตั้งรูป คำโปรย หรือพื้นหลังอย่างใดอย่างหนึ่ง หัวแชทจะเปลี่ยนเป็นแบบไล่สีตามสีหลัก" /></label>
            <LookPicker v-model="service.avatar_url" :options="assets.avatars" shape="avatar" />

            <label>คำโปรยใต้ชื่อ<InfoTip text="แสดงใต้ชื่อบนหัวแชท เช่น ผู้ช่วยดูแลลูกค้า · ตอบทันที 24 ชม. (ไม่เกิน 80 ตัวอักษร)" /></label>
            <a-input v-model:value="service.tagline" :maxlength="80" allow-clear placeholder="เช่น ผู้ช่วยดูแลลูกค้า · ตอบทันที 24 ชม." />

            <label>พื้นหลังห้องแชท<InfoTip text="ลายวาดตามสีหลักของ domain หรือรูปจากคลัง/ลิงก์ · ฟองข้อความมีพื้นของตัวเองจึงอ่านออกเสมอ" /></label>
            <LookPicker
              v-model="service.background"
              :options="[...assets.patterns, ...assets.backgrounds]"
              shape="background"
              :accent="gradStops[0]"
            />

            <label>คำทักทายแรก</label>
            <a-textarea v-model:value="service.greeting" :rows="3" />
            <div class="hint">ต้องบอกให้รู้ว่าเป็นระบบอัตโนมัติไม่ใช่คน (Policy P-8)</div>

            <a-divider style="margin: 14px 0" />

            <a-switch v-model:checked="service.enabled" />
            <span class="sw">เปิดใช้งาน service นี้</span>

            <div class="hint">
              แอดมินที่ล็อกอิน หลังบ้านลูกค้าสำเร็จ + มีสิทธิ์ service นี้ (<code>list_service</code> ใน token) จะเห็นปุ่ม AI ได้เลย
              — ไม่ต้องกำหนดรายชื่อ
            </div>

            <div class="row" style="margin-top: 14px">
              <a-button type="primary" :loading="saving" :disabled="!auth.can('office.edit')" @click="saveService">บันทึก service</a-button>
              <a-button danger :disabled="!auth.can('office.delete')" @click="confirmDeleteService">ลบ service</a-button>
            </div>
          </template>
        </a-card>
      </template>
    </div>

    <!-- :key = office.id → สลับ office แล้ว preview re-mount ใหม่เอง ไม่ต้อง refresh -->
    <WidgetPreview v-if="office" :key="office.id" :office="office" :service="service" :assets="assets" />
  </div>

  <!-- เพิ่ม service -->
  <a-modal centered
    v-model:open="newServiceOpen"
    title="เพิ่ม service"
    :width="440"
    :confirm-loading="creating"
    ok-text="เพิ่ม service"
    cancel-text="ยกเลิก"
    :ok-button-props="{ disabled: !serviceForm.id.trim() }"
    @ok="submitNewService"
  >
    <p class="modal-intro">service = แบรนด์หรือเว็บย่อยใต้ domain นี้ · สลับดูได้โดยไม่ต้องแก้ snippet</p>
    <div class="field">
      <label>รหัส service</label>
      <a-input v-model:value="serviceForm.id" placeholder="เช่น EXAMPLE" @keyup.enter="submitNewService" />
      <span class="fhint">ต้องตรงกับ <code>localStorage["web-service"]</code> ของหลังบ้านลูกค้าตอนแอดมินเลือกเว็บนั้น</span>
    </div>
    <div class="field">
      <label>ชื่อที่แสดง <span class="opt">— ไม่บังคับ</span></label>
      <a-input v-model:value="serviceForm.label" placeholder="เช่น เว็บ Example" @keyup.enter="submitNewService" />
      <span class="fhint">ชื่อที่เห็นในคอนโซล</span>
    </div>
  </a-modal>
</template>

<style scoped>
.back { display: inline-block; font-size: 13px; color: var(--accent); text-decoration: none; margin-bottom: 8px; }
.back:hover { text-decoration: underline; }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 24px; align-items: start; }
@media (max-width: 1100px) { .cols { grid-template-columns: minmax(0, 1fr); } }
.row { display: flex; gap: 8px; align-items: center; }
/* เฉพาะ label ป้ายฟอร์มปกติ (ไม่มี class) — ไม่แตะ .ant-radio-button-wrapper ซึ่งก็เป็น <label> */
label:not([class]) { display: block; font-size: 12.5px; color: var(--muted); margin: 12px 0 4px; }
.hint { font-size: 12px; color: var(--muted); margin-top: 6px; line-height: 1.65; }
.sw { margin-left: 8px; font-size: 14px; }
.accent-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--line); cursor: pointer; padding: 0; }
.swatch.on { box-shadow: 0 0 0 2px var(--ink); }
.swatch.grad { width: 34px; border-radius: 13px; }
.grad-bar { height: 14px; border-radius: 7px; margin: 10px 0 8px; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .06); }
.stop-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.stop-n { width: 34px; font-size: 12.5px; color: var(--muted); }
.picker { width: 34px; height: 30px; padding: 0 2px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); cursor: pointer; }
.err { color: var(--danger, #c0392b); }
.snippet { font-family: var(--font-mono); font-size: 11.5px; background: #16252b; color: #d9e6e2; padding: 14px; border-radius: 10px; overflow: auto; margin: 0; line-height: 1.6; }
code { font-family: var(--font-mono); font-size: 11.5px; }

/* card ให้เข้ากับ token — มุม 14, เส้น --line, หัวการ์ดใช้ฟอนต์หัวเรื่อง ไม่มีเงา */
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.tidy :deep(.ant-card-head-title) { font-family: var(--font-head); font-weight: 600; font-size: 15px; }
.tidy :deep(.ant-card-head) { border-bottom-color: var(--line); min-height: 46px; }

.empty-inline { margin: 12px 0 0; font-size: 13px; line-height: 1.6; color: var(--muted); }

/* empty state — ยังไม่มี domain */
.empty {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 6px; max-width: 460px; margin: 8px auto; padding: 48px 32px;
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card);
}
.empty-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 60px; height: 60px; margin-bottom: 6px; border-radius: 16px;
  background: var(--accent-soft); color: var(--accent);
}
.empty h2 { font-size: 18px; }
.empty p { margin: 0 0 16px; font-size: 13.5px; color: var(--muted); max-width: 34ch; }
.loading-state { display: flex; justify-content: center; align-items: center; min-height: 320px; }
</style>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  listOffices, createOffice, patchOffice, deleteOffice, rotateKey,
  addService, patchService, removeService,
} from '@/services/api/offices'
import { API_BASE } from '@/services/api/client'
import WidgetPreview from '@/components/WidgetPreview.vue'
import type { Office, Service } from '@/types'

const offices = ref<Office[]>([])
const officeId = ref('')
const serviceId = ref('')
const loadError = ref('')
const saving = ref(false)

const originsText = ref('')
const allowlistText = ref('')

const office = computed(() => offices.value.find((o) => o.id === officeId.value) ?? null)
const service = computed(() => office.value?.services.find((s) => s.id === serviceId.value) ?? null)

const snippet = computed(() =>
  office.value
    ? `<script src="${API_BASE}/widget/v1/${office.value.public_key}/ai-office.js" defer><\/script>`
    : '',
)

async function reload(keepService = true) {
  loadError.value = ''
  try {
    const res = await listOffices()
    offices.value = res.data
    if (!office.value) officeId.value = res.data[0]?.id ?? ''
    syncForm(keepService)
  } catch (e) {
    loadError.value = (e as Error).message
  }
}

function syncForm(keepService = true) {
  const o = office.value
  originsText.value = o?.allowed_origins.join('\n') ?? ''
  if (!keepService || !service.value) serviceId.value = o?.services[0]?.id ?? ''
  allowlistText.value = service.value?.allowlist.join('\n') ?? ''
}

watch(officeId, () => syncForm(false))
watch(serviceId, () => { allowlistText.value = service.value?.allowlist.join('\n') ?? '' })

function apply(updated: Office) {
  const i = offices.value.findIndex((o) => o.id === updated.id)
  if (i >= 0) offices.value[i] = updated
  else offices.value.push(updated)
}

async function run(fn: () => Promise<Office | null>, okMsg: string) {
  saving.value = true
  try {
    const updated = await fn()
    if (updated) apply(updated)
    message.success(okMsg)
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

// ---------- office ----------
function newOffice() {
  let id = ''
  let label = ''
  Modal.confirm({
    title: 'เพิ่ม office ใหม่',
    content: () => [
      h('p', { style: 'font-size:12.5px;color:#778785' }, 'office = หลังบ้าน 1 ชุด (1 การติดตั้ง) ที่จะเอา snippet ไปแปะ'),
      h('input', { placeholder: 'id เช่น acme', class: 'ant-input', onInput: (e: any) => (id = e.target.value) }),
      h('div', { style: 'height:8px' }),
      h('input', { placeholder: 'ชื่อที่แสดง', class: 'ant-input', onInput: (e: any) => (label = e.target.value) }),
    ],
    okText: 'สร้าง',
    cancelText: 'ยกเลิก',
    async onOk() {
      const o = await createOffice(id.trim(), label.trim())
      apply(o)
      officeId.value = o.id
      message.success(`สร้าง office ${o.id} แล้ว`)
    },
  })
}

function saveOffice() {
  const o = office.value
  if (!o) return
  run(
    () =>
      patchOffice(o.id, {
        label: o.label,
        enabled: o.enabled,
        is_hidden: o.is_hidden,
        theme: o.theme,
        placement: o.placement,
        backoffice_api_url: o.backoffice_api_url,
        allowed_origins: originsText.value.split('\n').map((s) => s.trim()).filter(Boolean),
      }),
    'บันทึก office แล้ว',
  )
}

function confirmDeleteOffice() {
  const o = office.value
  if (!o) return
  Modal.confirm({
    title: `ลบ office "${o.label}" ?`,
    content: `snippet ที่แปะอยู่ในเว็บของเขาจะหยุดทำงานทันที และ service ทั้ง ${o.services.length} ตัวจะถูกลบไปด้วย`,
    okText: 'ลบ',
    okType: 'danger',
    cancelText: 'ยกเลิก',
    async onOk() {
      await deleteOffice(o.id)
      offices.value = offices.value.filter((x) => x.id !== o.id)
      officeId.value = offices.value[0]?.id ?? ''
      message.success('ลบแล้ว')
    },
  })
}

function confirmRotate() {
  const o = office.value
  if (!o) return
  Modal.confirm({
    title: 'เปลี่ยน public key ?',
    content: 'snippet เดิมที่แปะอยู่จะใช้ไม่ได้ทันที ต้องส่ง snippet ใหม่ให้ลูกค้าไปเปลี่ยน',
    okText: 'เปลี่ยน key',
    okType: 'danger',
    cancelText: 'ยกเลิก',
    async onOk() {
      apply(await rotateKey(o.id))
      message.success('เปลี่ยน key แล้ว — อย่าลืมส่ง snippet ใหม่ให้ลูกค้า')
    },
  })
}

// ---------- service ----------
function newService() {
  const o = office.value
  if (!o) return
  let id = ''
  let label = ''
  Modal.confirm({
    title: `เพิ่ม service ใน ${o.label}`,
    content: () => [
      h('p', { style: 'font-size:12.5px;color:#778785' }, 'service = แบรนด์/เว็บย่อยที่แอดมินสลับดูในหลังบ้านชุดนี้ · ไม่ต้องแก้ snippet'),
      h('input', { placeholder: 'id เช่น K11S', class: 'ant-input', onInput: (e: any) => (id = e.target.value) }),
      h('div', { style: 'height:8px' }),
      h('input', { placeholder: 'ชื่อที่แสดง', class: 'ant-input', onInput: (e: any) => (label = e.target.value) }),
    ],
    okText: 'เพิ่ม',
    cancelText: 'ยกเลิก',
    async onOk() {
      const updated = await addService(o.id, id.trim(), label.trim())
      apply(updated)
      serviceId.value = id.trim()
      message.success('เพิ่ม service แล้ว')
    },
  })
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
        avatar_url: s.avatar_url,
        allowlist: allowlistText.value.split('\n').map((x) => x.trim()).filter(Boolean),
      }),
    'บันทึก service แล้ว',
  )
}

function confirmDeleteService() {
  const o = office.value
  const s = service.value
  if (!o || !s) return
  Modal.confirm({
    title: `ลบ service "${s.label}" ?`,
    content: 'แอดมินที่กำลังดู service นี้จะไม่เห็นปุ่ม AI อีก · snippet ของ office ไม่ต้องแก้',
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
    ?.writeText(snippet.value)
    .then(() => message.success('คัดลอกแล้ว'))
    .catch(() => message.error('คัดลอกไม่ได้ — เลือกข้อความแล้วกด copy เอง'))
}

import { h } from 'vue'
onMounted(() => reload(false))
</script>

<template>
  <h1 style="font-size: 20px; margin-bottom: 4px">Offices &amp; Services</h1>
  <p style="color: var(--muted); font-size: 13.5px; margin: 0 0 18px">
    <strong>office</strong> = หลังบ้าน 1 ชุด (1 snippet) · <strong>service</strong> = แบรนด์/เว็บย่อยใต้ office นั้น
    — 1 office มีได้หลาย service และสลับได้โดยไม่ต้องแก้ snippet
  </p>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <div class="cols">
    <div class="form">
      <a-card size="small" style="margin-bottom: 14px">
        <div class="row">
          <a-select v-model:value="officeId" style="flex: 1" placeholder="เลือก office">
            <a-select-option v-for="o in offices" :key="o.id" :value="o.id">
              {{ o.label }} ({{ o.id }}) · {{ o.services.length }} service
            </a-select-option>
          </a-select>
          <a-button @click="newOffice">+ office</a-button>
        </div>
      </a-card>

      <template v-if="office">
        <a-card size="small" title="snippet ที่ให้ลูกค้าแปะ" style="margin-bottom: 14px">
          <pre class="snippet">{{ snippet }}</pre>
          <div class="row" style="margin-top: 10px">
            <a-button size="small" @click="copySnippet">คัดลอก</a-button>
            <a-button size="small" danger @click="confirmRotate">เปลี่ยน key</a-button>
          </div>
          <div class="hint">
            key ไม่ใช่ความลับ — มันบอกแค่ว่าหน้านี้เป็นของ office ไหน
            ด่านจริงคือ <strong>โดเมนที่อนุญาต</strong> ด้านล่าง
          </div>
        </a-card>

        <a-card size="small" title="office" style="margin-bottom: 14px">
          <label>ชื่อที่แสดง</label>
          <a-input v-model:value="office.label" />

          <label>โดเมนที่อนุญาต (บรรทัดละ 1 origin)</label>
          <a-textarea v-model:value="originsText" :rows="3" placeholder="http://localhost:5174" />
          <div class="hint">
            ต้องเป็น scheme + host เท่านั้น ห้ามมี path · key ที่หลุดออกไปใช้จากโดเมนอื่นไม่ได้
            <br />เพิ่มตรงนี้แล้ว CORS เปิดให้ทันทีโดยไม่ต้อง deploy
          </div>

          <label>URL ของ API หลังบ้านเดิม</label>
          <a-input v-model:value="office.backoffice_api_url" placeholder="https://api.k11s.local" />
          <div class="hint">
            ใช้ตรวจตัวตนของแอดมิน (<code>GET /api/employees-byid</code>) และจะใช้ต่อ tool ใน Phase 3
            <br>เว้นว่างไว้ = office นี้จะรับได้แค่ token ปลอม <code>dev:...</code> ตอน <code>APP_MODE=dev</code>
          </div>

          <a-divider style="margin: 14px 0" />

          <a-switch v-model:checked="office.enabled" />
          <span class="sw">เปิดใช้งาน office นี้</span>
          <div class="hint"><strong>สวิตช์ฉุกเฉิน</strong> — ปิดแล้วทุก service ใน office นี้ปิดตามทันที</div>

          <div style="margin-top: 12px">
            <a-switch v-model:checked="office.is_hidden" />
            <span class="sw">ซ่อนปุ่มลอย</span>
          </div>
          <div class="hint">widget ยังโหลดแต่ไม่มีปุ่ม — ให้ office เรียกเองด้วย <code>window.__aiOffice.open()</code></div>

          <label>ธีม</label>
          <a-radio-group v-model:value="office.theme" button-style="solid">
            <a-radio-button value="auto">ตามเครื่องผู้ใช้</a-radio-button>
            <a-radio-button value="light">สว่าง</a-radio-button>
            <a-radio-button value="dark">มืด</a-radio-button>
          </a-radio-group>

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
            อยู่ระดับ office เพราะเป็นหลังบ้านชุดเดียวกัน — ถ้าให้ต่างกันรายแบรนด์ ปุ่มจะเด้งไปมาตอนสลับ service
          </div>

          <div class="row" style="margin-top: 14px">
            <a-button type="primary" :loading="saving" @click="saveOffice">บันทึก office</a-button>
            <a-button danger @click="confirmDeleteOffice">ลบ office</a-button>
          </div>
          <div v-if="office.updated_by" class="hint">
            แก้ล่าสุดโดย {{ office.updated_by }} · {{ new Date(office.updated_at).toLocaleString('th-TH') }}
          </div>
        </a-card>

        <a-card size="small" title="services" style="margin-bottom: 14px">
          <div class="row">
            <a-select v-model:value="serviceId" style="flex: 1" placeholder="ยังไม่มี service">
              <a-select-option v-for="s in office.services" :key="s.id" :value="s.id">
                {{ s.label }} ({{ s.id }}) {{ s.enabled ? '· เปิด' : '· ปิด' }}
              </a-select-option>
            </a-select>
            <a-button @click="newService">+ service</a-button>
          </div>

          <template v-if="service">
            <a-divider style="margin: 14px 0" />

            <label>ชื่อ service</label>
            <a-input v-model:value="service.label" />

            <label>ชื่อที่ AI ใช้แสดง</label>
            <a-input v-model:value="service.display_name" />

            <label>รูปประจำตัว (URL)</label>
            <a-input v-model:value="service.avatar_url" placeholder="เว้นว่างได้ — จะขึ้นเป็นตัวอักษร AI" />

            <label>คำทักทายแรก</label>
            <a-textarea v-model:value="service.greeting" :rows="3" />
            <div class="hint">ต้องบอกให้รู้ว่าเป็นระบบอัตโนมัติไม่ใช่คน (Policy P-8)</div>

            <a-divider style="margin: 14px 0" />

            <a-switch v-model:checked="service.enabled" />
            <span class="sw">เปิดใช้งาน service นี้</span>

            <label>รายชื่อบัญชีที่ใช้ได้ (บรรทัดละ 1 ชื่อ)</label>
            <a-textarea v-model:value="allowlistText" :rows="4" placeholder="adm_ploy" />
            <div class="hint">
              ว่างไว้ = ยังไม่มีใครใช้ได้ · รอบแรกเปิดตามรายชื่อ ไม่เปิดทุกคน
              <br>ใส่เป็น <strong>username ของหลังบ้าน</strong> · นี่คือด่านคุมการปล่อยของเรา
              คนละเรื่องกับสิทธิ์จริงที่ office เป็นคนตัดสิน (แอดมินที่ไม่มีสิทธิ์ใน service นี้อยู่แล้ว
              จะถูกปฏิเสธก่อนถึงรายชื่อนี้)
            </div>

            <div class="row" style="margin-top: 14px">
              <a-button type="primary" :loading="saving" @click="saveService">บันทึก service</a-button>
              <a-button danger @click="confirmDeleteService">ลบ service</a-button>
            </div>
          </template>
        </a-card>
      </template>
    </div>

    <WidgetPreview v-if="office" :office="office" :service="service" />
  </div>
</template>

<style scoped>
.cols { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 22px; align-items: start; }
@media (max-width: 1100px) { .cols { grid-template-columns: minmax(0, 1fr); } }
.row { display: flex; gap: 8px; align-items: center; }
label { display: block; font-size: 12.5px; color: var(--muted); margin: 12px 0 4px; }
.hint { font-size: 12px; color: var(--muted); margin-top: 6px; line-height: 1.65; }
.sw { margin-left: 8px; font-size: 14px; }
.snippet { font-family: var(--font-mono); font-size: 11.5px; background: #16252b; color: #d9e6e2; padding: 12px; border-radius: 8px; overflow: auto; margin: 0; }
code { font-family: var(--font-mono); font-size: 11.5px; }
</style>

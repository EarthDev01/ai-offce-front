<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  listOffices, createOffice, patchOffice, deleteOffice, rotateKey,
  addService, patchService, removeService,
} from '@/services/api/offices'
import { API_BASE } from '@/services/api/client'
import WidgetPreview from '@/components/WidgetPreview.vue'
import { useAuthStore } from '@/stores/auth'
import type { Office, Service } from '@/types'

const auth = useAuthStore()
const offices = ref<Office[]>([])
const officeId = ref('')
const serviceId = ref('')
const loadError = ref('')
const loading = ref(true)
const saving = ref(false)

const originsText = ref('')

// ฟอร์ม modal สร้าง office / service
const newOfficeOpen = ref(false)
const newServiceOpen = ref(false)
const creating = ref(false)
const officeForm = reactive({ id: '', label: '' })
const serviceForm = reactive({ id: '', label: '' })

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
  } finally {
    loading.value = false
  }
}

function syncForm(keepService = true) {
  const o = office.value
  originsText.value = o?.allowed_origins.join('\n') ?? ''
  if (!keepService || !service.value) serviceId.value = o?.services[0]?.id ?? ''
}

watch(officeId, () => syncForm(false))

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
  officeForm.id = ''
  officeForm.label = ''
  newOfficeOpen.value = true
}

async function submitNewOffice() {
  const id = officeForm.id.trim()
  if (!id) return
  creating.value = true
  try {
    const o = await createOffice(id, officeForm.label.trim())
    apply(o)
    officeId.value = o.id
    newOfficeOpen.value = false
    message.success(`สร้าง office ${o.id} แล้ว`)
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    creating.value = false
  }
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
        avatar_url: s.avatar_url,
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

onMounted(() => reload(false))
</script>

<template>
  <div class="page-head">
    <h1>Offices</h1>
    <p class="sub">
      แต่ละ office คือหลังบ้าน 1 ชุด (snippet 1 ชิ้นที่เอาไปแปะในเว็บลูกค้า)
      เพิ่ม service ไว้ข้างในได้หลายแบรนด์ และสลับดูได้โดยไม่ต้องแก้ snippet
    </p>
  </div>

  <!-- กำลังโหลด — กัน empty state แว๊บก่อนข้อมูลมา -->
  <div v-if="loading" class="loading-state">
    <a-spin />
  </div>

  <a-alert v-else-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <!-- empty state — ยังไม่มี office -->
  <div v-else-if="offices.length === 0" class="empty">
    <span class="empty-mark" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 3.5V17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="currentColor" />
      </svg>
    </span>
    <h2>ยังไม่มี office</h2>
    <p>สร้าง office แรกเพื่อเริ่มติดตั้ง widget ให้ลูกค้า</p>
    <a-button type="primary" size="large" :disabled="!auth.can('office.edit')" @click="newOffice">สร้าง office</a-button>
  </div>

  <div v-else class="cols">
    <div class="form">
      <a-card size="small" class="tidy" style="margin-bottom: 16px">
        <div class="row">
          <a-select v-model:value="officeId" style="flex: 1" placeholder="เลือก office">
            <a-select-option v-for="o in offices" :key="o.id" :value="o.id">
              {{ o.label }} ({{ o.id }}) · {{ o.services.length }} service
            </a-select-option>
          </a-select>
          <a-button :disabled="!auth.can('office.edit')" @click="newOffice">สร้าง office</a-button>
        </div>
      </a-card>

      <template v-if="office">
        <a-card size="small" class="tidy" title="Snippet ที่ให้ลูกค้าแปะ" style="margin-bottom: 16px">
          <pre class="snippet">{{ snippet }}</pre>
          <div class="row" style="margin-top: 12px">
            <a-button size="small" type="primary" @click="copySnippet">คัดลอก snippet</a-button>
            <a-button size="small" danger :disabled="!auth.can('office.rotate')" @click="confirmRotate">เปลี่ยน key</a-button>
          </div>
          <div class="hint">
            key ไม่ใช่ความลับ — มันบอกแค่ว่าหน้านี้เป็นของ office ไหน
            ด่านจริงคือ <strong>โดเมนที่อนุญาต</strong> ด้านล่าง
          </div>
        </a-card>

        <a-card size="small" class="tidy" title="ตั้งค่า office" style="margin-bottom: 16px">
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
            <a-button type="primary" :loading="saving" :disabled="!auth.can('office.edit')" @click="saveOffice">บันทึก office</a-button>
            <a-button danger :disabled="!auth.can('office.delete')" @click="confirmDeleteOffice">ลบ office</a-button>
          </div>
          <div v-if="office.updated_by" class="hint">
            แก้ล่าสุดโดย {{ office.updated_by }} · {{ new Date(office.updated_at).toLocaleString('th-TH') }}
          </div>
        </a-card>

        <a-card size="small" class="tidy" title="Services" style="margin-bottom: 16px">
          <div class="row">
            <a-select v-model:value="serviceId" style="flex: 1" placeholder="ยังไม่มี service">
              <a-select-option v-for="s in office.services" :key="s.id" :value="s.id">
                {{ s.label }} ({{ s.id }}) {{ s.enabled ? '· เปิด' : '· ปิด' }}
              </a-select-option>
            </a-select>
            <a-button :disabled="!auth.can('office.edit')" @click="newService">เพิ่ม service</a-button>
          </div>
          <p v-if="office.services.length === 0" class="empty-inline">
            ยังไม่มี service ใน office นี้ — เพิ่ม service แรกเพื่อกำหนดชื่อ รูป และคำทักทายของ AI
          </p>

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

            <div class="hint">
              ใครก็ตามที่ล็อกอินหลังบ้านสำเร็จ + มีสิทธิ์ใน service นี้ จะเห็นปุ่ม AI ได้เลย
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

    <!-- :key = public_key → พอ rotate key หรือสลับ office ตัว preview re-mount โหลด script ใหม่เอง ไม่ต้อง refresh -->
    <WidgetPreview v-if="office" :key="office.public_key" :office="office" :service="service" />
  </div>

  <!-- สร้าง office -->
  <a-modal
    v-model:open="newOfficeOpen"
    title="เพิ่ม office"
    :width="440"
    :confirm-loading="creating"
    ok-text="สร้าง office"
    cancel-text="ยกเลิก"
    :ok-button-props="{ disabled: !officeForm.id.trim() }"
    @ok="submitNewOffice"
  >
    <p class="modal-intro">office คือหลังบ้าน 1 ชุด — snippet 1 ชิ้นที่เอาไปแปะในเว็บลูกค้า</p>
    <div class="field">
      <label>รหัส office</label>
      <a-input v-model:value="officeForm.id" placeholder="เช่น acme" @keyup.enter="submitNewOffice" />
      <span class="fhint">ตัวอักษร ตัวเลข - _ · ใช้อ้างอิงภายใน เปลี่ยนภายหลังไม่ได้</span>
    </div>
    <div class="field">
      <label>ชื่อที่แสดง <span class="opt">— ไม่บังคับ</span></label>
      <a-input v-model:value="officeForm.label" placeholder="เช่น Acme Thailand" @keyup.enter="submitNewOffice" />
      <span class="fhint">ชื่อที่เห็นในคอนโซล เว้นว่างได้ จะใช้รหัสแทน</span>
    </div>
  </a-modal>

  <!-- เพิ่ม service -->
  <a-modal
    v-model:open="newServiceOpen"
    title="เพิ่ม service"
    :width="440"
    :confirm-loading="creating"
    ok-text="เพิ่ม service"
    cancel-text="ยกเลิก"
    :ok-button-props="{ disabled: !serviceForm.id.trim() }"
    @ok="submitNewService"
  >
    <p class="modal-intro">service = แบรนด์หรือเว็บย่อยใต้ office นี้ · สลับดูได้โดยไม่ต้องแก้ snippet</p>
    <div class="field">
      <label>รหัส service</label>
      <a-input v-model:value="serviceForm.id" placeholder="เช่น K11S" @keyup.enter="submitNewService" />
      <span class="fhint">ต้องตรงกับ web-service ที่หลังบ้านส่งมาตอนแอดมินเปิดเว็บนั้น</span>
    </div>
    <div class="field">
      <label>ชื่อที่แสดง <span class="opt">— ไม่บังคับ</span></label>
      <a-input v-model:value="serviceForm.label" placeholder="เช่น เว็บ K11S" @keyup.enter="submitNewService" />
      <span class="fhint">ชื่อที่เห็นในคอนโซล</span>
    </div>
  </a-modal>
</template>

<style scoped>
.cols { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 24px; align-items: start; }
@media (max-width: 1100px) { .cols { grid-template-columns: minmax(0, 1fr); } }
.row { display: flex; gap: 8px; align-items: center; }
/* เฉพาะ label ป้ายฟอร์มปกติ (ไม่มี class) — ไม่แตะ .ant-radio-button-wrapper ซึ่งก็เป็น <label> */
label:not([class]) { display: block; font-size: 12.5px; color: var(--muted); margin: 12px 0 4px; }
.hint { font-size: 12px; color: var(--muted); margin-top: 6px; line-height: 1.65; }
.sw { margin-left: 8px; font-size: 14px; }
.snippet { font-family: var(--font-mono); font-size: 11.5px; background: #16252b; color: #d9e6e2; padding: 14px; border-radius: 10px; overflow: auto; margin: 0; line-height: 1.6; }
code { font-family: var(--font-mono); font-size: 11.5px; }

/* card ให้เข้ากับ token — มุม 14, เส้น --line, หัวการ์ดใช้ฟอนต์หัวเรื่อง ไม่มีเงา */
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.tidy :deep(.ant-card-head-title) { font-family: var(--font-head); font-weight: 600; font-size: 15px; }
.tidy :deep(.ant-card-head) { border-bottom-color: var(--line); min-height: 46px; }

.empty-inline { margin: 12px 0 0; font-size: 13px; line-height: 1.6; color: var(--muted); }

/* empty state — ยังไม่มี office */
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

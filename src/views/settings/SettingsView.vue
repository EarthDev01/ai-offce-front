<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ASSISTANT_CHANGED } from '@/services/api/assistant'
import { getSettings, patchSettings, testLLM } from '@/services/api/ops'
import { useAuthStore } from '@/stores/auth'
import InfoTip from '@/components/InfoTip.vue'
import LLMKeyModal from '@/components/LLMKeyModal.vue'
import type { LLMProvider, LLMSettings, LLMTestResult, Settings, SettingsView } from '@/types'

const auth = useAuthStore()
const canEdit = computed(() => auth.can('settings.manage'))

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const view = ref<SettingsView | null>(null)
const form = reactive<Settings>({
  max_concurrent: 5, ticket_ttl_min: 30, support_message: '', llm_timeout_sec: 25, stream_timeout_sec: 60,
  max_output_tokens: 1024, history_turns: 10, tool_timeout_ms: 20000, assistant_enabled: false,
  llm: { provider: 'anthropic', model: '', effort: 'low', base_url: '' },
  updated_at: '', updated_by: '',
})

// ---------- โมเดล AI ----------
const providers = computed(() => view.value?.llm_providers ?? [])
const provider = computed(() => providers.value.find((p) => p.id === form.llm.provider))
const modelOptions = computed(() => (provider.value?.models ?? []).map((m) => ({ value: m })))

const EFFORT_LABEL: Record<string, string> = { low: 'ต่ำ', medium: 'กลาง', high: 'สูง', xhigh: 'สูงมาก', max: 'สูงสุด' }

// ค่าที่กรอกค้างไว้ของแต่ละ provider (ยังไม่บันทึก) — สลับไปมาในหน้านี้แล้วไม่หาย · ล้างเมื่อโหลดใหม่
const drafts = reactive<Record<string, LLMSettings>>({})

// เปลี่ยน provider: ใช้ค่าที่กรอกค้างไว้ → ค่าล่าสุดที่เคยบันทึกของ provider นั้น → ค่าแนะนำ
// ---------- API key ----------
const canKey = computed(() => auth.can('llm.key.manage'))
const keyOpen = ref(false)
const keyMode = ref<'set' | 'delete'>('set')
const keyProvider = ref<LLMProvider | null>(null)

function openKey(p: LLMProvider, mode: 'set' | 'delete') {
  keyProvider.value = p
  keyMode.value = mode
  keyOpen.value = true
}

// Base URL ที่เติมให้ในหน้าต่างตั้ง key: ค่าที่กรอกอยู่ → ค่าที่เคยกรอกของ provider นั้น → ค่าล่าสุดที่เคยบันทึก
const keyBaseUrl = computed(() => {
  const id = keyProvider.value?.id
  if (!id) return undefined
  if (id === form.llm.provider) return form.llm.base_url
  return drafts[id]?.base_url || view.value?.settings.llm_recent?.[id]?.base_url || undefined
})

function keyTitle(p: LLMProvider) {
  const k = p.key
  if (!k?.updated_by) return ''
  return `ตั้งโดย ${k.updated_by} · ${fmt(k.updated_at)}`
}

// ตั้ง key เสร็จ — Base URL ที่กรอกในหน้าต่างใช้ต่อในการ์ดโมเดลเลย ไม่ต้องกรอกซ้ำ
function onKeyDone(baseUrl?: string) {
  const id = keyProvider.value?.id
  if (id && baseUrl) {
    if (form.llm.provider === id) {
      if (form.llm.base_url !== baseUrl) {
        form.llm.base_url = baseUrl
        message.info('ใส่ Base URL ในการ์ดโมเดลให้แล้ว — กด "บันทึกตั้งค่าระบบ" เพื่อใช้กับแชท')
      }
    } else {
      const p = providers.value.find((x) => x.id === id)
      const base = drafts[id] ?? view.value?.settings.llm_recent?.[id] ?? {
        provider: id, model: p?.models[0] ?? '', effort: p?.efforts?.length ? 'low' : '', base_url: '',
      }
      drafts[id] = { ...base, base_url: baseUrl }
    }
  }
  refreshKeys()
}

// โหลดสถานะ key ใหม่ โดยไม่ทับค่าที่กำลังแก้อยู่ในฟอร์ม
async function refreshKeys() {
  try {
    const v = await getSettings()
    if (view.value) {
      view.value.llm_providers = v.llm_providers
      view.value.llm_ready = v.llm_ready
      view.value.llm_key_store = v.llm_key_store
    }
  } catch (e) {
    message.error((e as Error).message)
  }
}

function selectProvider(id: string) {
  if (id === form.llm.provider) return
  drafts[form.llm.provider] = { ...form.llm }
  const p = providers.value.find((x) => x.id === id)
  const prev = drafts[id] ?? view.value?.settings.llm_recent?.[id]
  if (prev) {
    form.llm = { ...prev, provider: id }
  } else {
    form.llm = { provider: id, model: p?.models[0] ?? '', effort: p?.efforts?.length ? 'low' : '', base_url: '' }
  }
  testResult.value = null
  testError.value = ''
}

const testing = ref(false)
const testResult = ref<LLMTestResult | null>(null)
const testError = ref('')

async function runTest() {
  testing.value = true
  testResult.value = null
  testError.value = ''
  try {
    testResult.value = await testLLM({ ...form.llm })
  } catch (e) {
    testError.value = (e as Error).message
  } finally {
    testing.value = false
  }
}

// ช่องตัวเลข: key → [ป้าย, คำอธิบาย] · กรอบ min/max มาจาก server
const numberFields: { key: keyof Settings; label: string; hint: string; unit: string }[] = [
  { key: 'max_concurrent', label: 'คนถามพร้อมกันต่อ service', hint: 'เกินจำนวนนี้ผู้ใช้จะได้ข้อความ "ผู้ช่วยกำลังตอบคนอื่นอยู่" ทันที ไม่เข้าคิว', unit: 'คน' },
  { key: 'ticket_ttl_min', label: 'อายุตั๋วแชทของ widget', hint: 'widget ขอตั๋วใหม่เองก่อนหมด', unit: 'นาที' },
  { key: 'llm_timeout_sec', label: 'เวลารอ LLM รอบเลือกเครื่องมือ', hint: 'เกินแล้วแจ้งผู้ใช้ว่าผู้ช่วยไม่ตอบกลับ', unit: 'วินาที' },
  { key: 'stream_timeout_sec', label: 'เวลารอ LLM รอบเขียนคำตอบ', hint: 'นับตั้งแต่เริ่มเขียนจนจบ', unit: 'วินาที' },
  { key: 'max_output_tokens', label: 'ความยาวคำตอบสูงสุด', hint: 'จำกัด token ของรอบเขียนคำตอบ', unit: 'token' },
  { key: 'history_turns', label: 'ประวัติที่ส่งให้ LLM', hint: '0 = ไม่ส่งประวัติ (ถามต่อจากข้อก่อนไม่ได้) · ยิ่งมากยิ่งใช้ token มาก', unit: 'รอบถาม-ตอบ' },
  { key: 'tool_timeout_ms', label: 'เวลารอหลังบ้านตอบต่อ 1 เส้น', hint: 'ใช้เมื่อ connector ไม่ได้กำหนดเวลาของเส้นนั้นไว้', unit: 'ms' },
]

function range(key: string): [number, number] {
  return view.value?.ranges[key] ?? [0, 999999]
}

// จำนวน field ที่แก้แต่ยังไม่บันทึก = เทียบฟอร์มกับค่าล่าสุดจาก server (เฉพาะ field ที่แก้ได้)
const LLM_FIELDS = ['provider', 'model', 'effort', 'base_url'] as const
const changedCount = computed(() => {
  const saved = view.value?.settings
  if (!saved || !canEdit.value) return 0
  let n = numberFields.filter((f) => form[f.key] !== saved[f.key]).length
  if (form.support_message !== saved.support_message) n++
  if (form.assistant_enabled !== !!saved.assistant_enabled) n++
  n += LLM_FIELDS.filter((k) => form.llm[k] !== saved.llm[k]).length
  return n
})

// ยกเลิกการแก้ = กลับไปค่าที่โหลดไว้ ไม่ยิง server
function discard() {
  if (!view.value) return
  Object.assign(form, view.value.settings, { llm: { ...view.value.settings.llm } })
  for (const k of Object.keys(drafts)) delete drafts[k]
  testResult.value = null
  testError.value = ''
}

async function reload() {
  loading.value = true
  loadError.value = ''
  try {
    view.value = await getSettings()
    Object.assign(form, view.value.settings, { llm: { ...view.value.settings.llm } })
    for (const k of Object.keys(drafts)) delete drafts[k]
    testResult.value = null
    testError.value = ''
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const { updated_by: _by, llm_recent: _recent, ...patch } = form
    const saved = await patchSettings(patch)
    Object.assign(form, saved, { llm: { ...saved.llm } })
    delete drafts[saved.llm.provider]
    // สถานะพร้อมใช้ของโมเดลขึ้นกับค่าที่บันทึก — โหลดใหม่ให้ตรงกับ server
    if (view.value) {
      view.value.settings = saved
      view.value.llm_ready = !!providers.value.find((p) => p.id === saved.llm.provider)?.has_key
    }
    window.dispatchEvent(new Event(ASSISTANT_CHANGED)) // ให้ปุ่มผู้ช่วยโชว์/ซ่อนตามค่าใหม่ทันที
    message.success('บันทึกตั้งค่าระบบแล้ว')
  } catch (e) {
    // 409 = มีคนแก้ไปก่อน · 400 = ค่านอกช่วง — ข้อความจาก server บอกรายละเอียดแล้ว
    message.error((e as Error).message, 6)
  } finally {
    saving.value = false
  }
}

function fmt(v?: string) {
  return v && !v.startsWith('0001-') ? new Date(v).toLocaleString('th-TH') : '—'
}

onMounted(reload)
</script>

<template>
  <div class="page-head">
    <h1>ตั้งค่าระบบ</h1>
    <p class="sub">ค่าที่มีผลกับทุก domain/service — บันทึกแล้วมีผลกับคำถามถัดไปทันทีโดยไม่ต้อง deploy หรือ restart</p>
  </div>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />
  <a-alert
    v-if="!canEdit"
    type="info"
    show-icon
    message="ดูได้อย่างเดียว — ต้องมีสิทธิ์ settings.manage ถึงจะแก้ได้"
    style="margin-bottom: 16px"
  />

  <a-spin :spinning="loading">
    <a-card size="small" class="tidy llm-card" style="margin-bottom: 16px">
      <template #title>
        <span class="card-title">
          โมเดล AI
          <span v-if="view" class="status" :class="view.llm_ready ? 'on' : 'off'">
            <i class="dot" />{{ view.llm_ready ? 'พร้อมตอบแชท' : 'ปิดอยู่ — โมเดลที่บันทึกไว้ไม่มี API key' }}
          </span>
        </span>
      </template>

      <!-- ผู้ให้บริการ: การ์ดให้กดเลือก · ไม่มี key = กดไม่ได้ พร้อมบอกตัวแปรที่ต้องใส่ -->
      <div class="section-label">
        ผู้ให้บริการ
        <InfoTip>
          บริษัทเจ้าของโมเดล · เลือกได้เฉพาะตัวที่ตั้ง API key แล้ว<br />
          key เก็บแบบเข้ารหัส หน้าเว็บเห็นแค่ 4 ตัวท้าย · ตั้ง เปลี่ยน หรือลบ key ต้องยืนยันรหัส 2FA ทุกครั้ง
        </InfoTip>
      </div>
      <a-alert
        v-if="view && !view.llm_key_store"
        type="info"
        show-icon
        message="ตั้ง API key จากหน้าเว็บยังไม่ได้ — ต้องตั้ง LLM_KEY_SECRET ใน .env ของหลังบ้าน ai ก่อน (ตอนนี้ใช้ key จาก .env)"
        style="margin-bottom: 12px"
      />
      <div class="providers" role="radiogroup">
        <div
          v-for="p in providers"
          :key="p.id"
          class="prov"
          :class="{ active: form.llm.provider === p.id, locked: !p.has_key }"
        >
          <button
            type="button"
            role="radio"
            class="prov-pick"
            :aria-checked="form.llm.provider === p.id"
            :disabled="!canEdit || !p.has_key"
            @click="selectProvider(p.id)"
          >
            <span class="prov-mark">{{ p.label.charAt(0) }}</span>
            <span class="prov-body">
              <span class="prov-name">{{ p.label }}</span>
            </span>
            <span v-if="form.llm.provider === p.id" class="prov-check" aria-hidden="true">✓</span>
          </button>

          <!-- สถานะ key: เห็นแค่ 4 ตัวท้าย -->
          <div class="prov-key">
            <span v-if="p.key?.broken" class="key-state bad">ถอดรหัสไม่ได้ — ตั้งใหม่</span>
            <span v-else-if="p.has_key" class="key-state" :title="keyTitle(p)">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 6 0v2M4 7h8v6H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg>
              ••••{{ p.key?.last4 }}<span v-if="p.key?.source === 'env'" class="src">· .env</span>
            </span>
            <span v-else class="key-state none">ยังไม่มี API key</span>
            <span v-if="canKey && view?.llm_key_store" class="key-actions">
              <a-button type="link" size="small" @click="openKey(p, 'set')">{{ p.key?.last4 || p.key?.broken ? 'เปลี่ยน' : 'ตั้ง key' }}</a-button>
              <a-button
                v-if="p.key?.source === 'db'"
                type="link"
                size="small"
                danger
                :disabled="view?.settings.llm.provider === p.id"
                :title="view?.settings.llm.provider === p.id ? 'แชทใช้ผู้ให้บริการนี้อยู่ — เปลี่ยนโมเดลก่อน' : ''"
                @click="openKey(p, 'delete')"
              >ลบ</a-button>
            </span>
          </div>
        </div>
      </div>

      <div class="grid model-grid">
        <div class="field">
          <label>
            โมเดล
            <InfoTip>
              ชื่อรุ่นของโมเดล · เลือกจากรายการแนะนำ หรือพิมพ์ชื่อรุ่นอื่นเองได้<br />
              ไม่แน่ใจว่าชื่อถูกไหม กด "ทดสอบการเชื่อมต่อ" ก่อนบันทึก
            </InfoTip>
          </label>
          <a-auto-complete
            v-model:value="form.llm.model"
            :options="modelOptions"
            :disabled="!canEdit"
            :filter-option="(input: string, opt: any) => String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())"
            placeholder="เช่น example-model"
            style="width: 100%"
          />
        </div>

        <div v-if="provider?.efforts?.length" class="field">
          <label>
            ระดับการคิด (effort)
            <InfoTip>
              ยิ่งสูง โมเดลยิ่งคิดละเอียด แต่ตอบช้าลงและใช้ token มากขึ้น<br />
              แชทหลังบ้านต้องตอบไว แนะนำ "ต่ำ"
            </InfoTip>
          </label>
          <a-radio-group v-model:value="form.llm.effort" :disabled="!canEdit" button-style="solid" class="effort">
            <a-radio-button v-for="e in provider.efforts" :key="e" :value="e">{{ EFFORT_LABEL[e] ?? e }}</a-radio-button>
          </a-radio-group>
        </div>

        <div v-if="provider?.needs_base_url" class="field">
          <label>
            Base URL
            <InfoTip>
              ที่อยู่ API แบบ Chat Completions ของผู้ให้บริการ เช่น <code>https://api.example.com/v1</code><br />
              ไม่ต้องใส่ <code>/chat/completions</code> ต่อท้าย
            </InfoTip>
          </label>
          <a-input v-model:value="form.llm.base_url" :disabled="!canEdit" placeholder="เช่น https://api.example.com/v1" />
        </div>
      </div>

      <!-- ทดสอบ: ปุ่มกับผลอยู่แถวเดียวกัน -->
      <div class="test-bar">
        <a-button :loading="testing" :disabled="!canEdit || !provider?.has_key || !form.llm.model" @click="runTest">
          ทดสอบการเชื่อมต่อ
        </a-button>
        <template v-if="testResult">
          <span class="result ok"><i class="dot" />เชื่อมต่อได้</span>
          <span class="metric"><b>{{ (testResult.latency_ms / 1000).toFixed(1) }}</b> วินาที</span>
          <span class="metric">
            <b>{{ testResult.usage.input_tokens + testResult.usage.cache_read + testResult.usage.cache_write }}</b> token เข้า ·
            <b>{{ testResult.usage.output_tokens }}</b> ออก
          </span>
          <span v-if="testResult.reply" class="metric reply" :title="testResult.reply">ตอบว่า “{{ testResult.reply }}”</span>
        </template>
        <span v-else-if="testError" class="result bad"><i class="dot" />{{ testError }}</span>
        <span v-else class="hint">ส่งข้อความสั้น 1 ครั้งด้วยค่าที่กรอกอยู่ (ยังไม่บันทึก) · ใช้ token เล็กน้อย</span>
      </div>
    </a-card>

    <LLMKeyModal
      v-model:open="keyOpen"
      :provider="keyProvider"
      :mode="keyMode"
      :test-model="keyProvider?.id === form.llm.provider ? form.llm.model : undefined"
      :test-base-url="keyBaseUrl"
      @done="onKeyDone"
    />

    <a-card size="small" class="tidy" title="ประสิทธิภาพ" style="margin-bottom: 16px">
      <div class="grid">
        <div v-for="f in numberFields" :key="f.key" class="field">
          <label>{{ f.label }}</label>
          <a-input-number
            v-model:value="(form[f.key] as number)"
            :min="range(f.key)[0]"
            :max="range(f.key)[1]"
            :disabled="!canEdit"
            style="width: 100%"
            :addon-after="f.unit"
          />
          <div class="hint">{{ f.hint }} · รับ {{ range(f.key)[0] }}–{{ range(f.key)[1] }}</div>
        </div>
      </div>
    </a-card>

    <a-card size="small" class="tidy" title="ผู้ช่วย AI ในคอนโซล" style="margin-bottom: 16px">
      <a-switch v-model:checked="form.assistant_enabled" :disabled="!canEdit" />
      <span class="sw">เปิดปุ่มผู้ช่วยมุมขวาล่างของคอนโซล</span>
      <InfoTip>
        ให้ทุกคนที่ล็อกอินถามวิธีใช้คอนโซลและข้อมูลในระบบได้ · อ่านอย่างเดียว เห็นตามสิทธิ์ของคนถาม<br />
        ใช้โมเดลเดียวกับด้านบน และใช้ token จริงทุกคำถาม (นับแยกเป็น "ผู้ช่วยคอนโซล")
      </InfoTip>
      <div v-if="form.assistant_enabled && view && !view.llm_ready" class="hint warn-text">
        โมเดลที่บันทึกไว้ยังไม่มี API key — ปุ่มจะยังไม่ขึ้นจนกว่าจะตั้ง key
      </div>
    </a-card>

    <a-card size="small" class="tidy" title="ข้อความ" style="margin-bottom: 16px">
      <label>ช่องทางติดต่อ support</label>
      <a-textarea v-model:value="form.support_message" :rows="2" :disabled="!canEdit" />
      <div class="hint">ผู้ช่วยบอกข้อความนี้เมื่อตอบไม่ได้หรือผู้ใช้ถามซ้ำ · ใช้เมื่อ connector ของหลังบ้านนั้นไม่ได้ตั้งไว้เอง</div>
    </a-card>

    <p class="hint last-edit">แก้ล่าสุดโดย {{ form.updated_by || '—' }} · {{ fmt(form.updated_at) }}</p>

    <!-- ปุ่มบันทึกลอยอยู่ล่างจอ เฉพาะตอนมีค่าที่ยังไม่บันทึก -->
    <div v-if="changedCount > 0" class="save-bar">
      <span><strong>เปลี่ยน {{ changedCount }} รายการ</strong> · ยังไม่บันทึก</span>
      <div class="save-actions">
        <a-button :disabled="saving" @click="discard">ยกเลิกการแก้ไข</a-button>
        <a-button type="primary" :loading="saving" @click="save">บันทึกตั้งค่าระบบ</a-button>
      </div>
    </div>
  </a-spin>
</template>

<style scoped>
.sw { margin-left: 8px; font-size: 14px; }
.warn-text { color: var(--danger); margin-top: 8px; }
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.hint { font-size: 12px; color: var(--muted); }

/* โมเดล AI */
/* ป้ายสถานะทำให้หัวการ์ดสูงกว่าขนาด small — เว้นบน-ล่างให้หัวข้อไม่ชิดขอบ */
.llm-card :deep(.ant-card-head) { padding-top: 10px; padding-bottom: 10px; }
.card-title { display: inline-flex; align-items: center; gap: 10px; }
.status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 999px; }
.status.on { color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.status.off { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; display: inline-block; flex: none; }

.section-label { display: flex; align-items: center; font-size: 13px; margin-bottom: 8px; }
.providers { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; margin-bottom: 18px; }
.prov {
  position: relative; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 12px;
  background: var(--surface); transition: border-color .15s, box-shadow .15s, background .15s; overflow: hidden;
}
.prov:not(.locked):hover { border-color: var(--accent); }
.prov-pick {
  display: flex; align-items: center; gap: 12px; text-align: left; width: 100%;
  padding: 12px 14px; border: 0; background: transparent; cursor: pointer; font: inherit; color: var(--ink);
}
.prov-pick:disabled { cursor: not-allowed; }
.prov.locked .prov-pick { opacity: .55; }
.prov-pick:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 12px; }
.prov-key {
  display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 34px;
  padding: 2px 6px 2px 14px; border-top: 1px dashed var(--line); font-size: 12px;
}
.key-state { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); color: var(--ink); }
.key-state.none { font-family: inherit; color: var(--muted); }
.key-state.bad { font-family: inherit; color: var(--danger); }
.key-state .src { font-family: inherit; color: var(--muted); }
.key-actions { display: inline-flex; }
.key-actions :deep(.ant-btn) { padding: 0 6px; font-size: 12px; }
.prov.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
.prov-mark {
  width: 34px; height: 34px; border-radius: 10px; flex: none; display: grid; place-items: center;
  font-weight: 700; font-size: 15px; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.prov.active .prov-mark { color: #fff; background: var(--accent); }
.prov-body { display: flex; flex-direction: column; min-width: 0; }
.prov-name { font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prov-check { position: absolute; top: 8px; right: 10px; font-size: 12px; font-weight: 700; color: var(--accent); }

.model-grid { margin-bottom: 4px; }

.test-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin: 18px -12px -12px; padding: 12px; border-top: 1px solid var(--line); background: var(--ground);
  border-radius: 0 0 var(--r-card) var(--r-card);
}
.result { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
.result.ok { color: var(--accent); }
.result.bad { color: var(--danger); font-weight: 500; }
.metric { font-size: 12.5px; color: var(--muted); padding: 3px 10px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); }
.metric b { color: var(--ink); font-weight: 600; }
.metric.reply { max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
/* เฉพาะป้ายชื่อช่อง — ปุ่มของ a-radio-group ก็เป็น <label> ห้ามโดนกฎนี้ */
.field > label, .ant-card-body > label { display: flex; align-items: center; font-size: 13px; margin-bottom: 4px; }
.effort { display: flex; width: 100%; }
.effort :deep(.ant-radio-button-wrapper) { flex: 1; text-align: center; }
.last-edit { margin: 4px 0 0; }
.save-bar {
  position: sticky; bottom: 16px; margin-top: 16px; z-index: 5;
  display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 12px 16px; border: 1px solid var(--line); border-radius: var(--r-card);
  background: var(--surface); box-shadow: 0 6px 20px rgba(19, 40, 43, .12); font-size: 13.5px;
}
.save-actions { display: flex; gap: 8px; }
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getSettings, patchSettings } from '@/services/api/ops'
import { useAuthStore } from '@/stores/auth'
import type { Settings, SettingsView } from '@/types'

const auth = useAuthStore()
const canEdit = computed(() => auth.can('settings.manage'))

const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const view = ref<SettingsView | null>(null)
const form = reactive<Settings>({
  max_concurrent: 5, ticket_ttl_min: 30, support_message: '', llm_timeout_sec: 25, stream_timeout_sec: 60,
  max_output_tokens: 1024, history_turns: 10, tool_timeout_ms: 20000, updated_at: '', updated_by: '',
})

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

async function reload() {
  loading.value = true
  loadError.value = ''
  try {
    view.value = await getSettings()
    Object.assign(form, view.value.settings)
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const { updated_by: _by, ...patch } = form
    const saved = await patchSettings(patch)
    Object.assign(form, saved)
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
    <p class="sub">ค่าที่มีผลกับทุก office/service — บันทึกแล้วมีผลกับคำถามถัดไปทันทีโดยไม่ต้อง deploy</p>
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
    <a-card size="small" class="tidy" title="โมเดล" style="margin-bottom: 16px">
      <template v-if="view">
        <div class="kv"><span class="hint">provider</span><code>{{ view.llm.provider }}</code></div>
        <div class="kv"><span class="hint">model</span><code>{{ view.llm.model || '—' }}</code></div>
        <div class="kv">
          <span class="hint">สถานะ</span>
          <a-tag :color="view.llm.enabled ? 'green' : 'red'">{{ view.llm.enabled ? 'เปิดใช้งาน' : 'ปิด (ไม่มี API key)' }}</a-tag>
        </div>
      </template>
      <div class="hint" style="margin-top: 6px">ตั้งที่ไฟล์ <code>.env</code> ของหลังบ้าน ai (LLM_PROVIDER / LLM_MODEL) — แก้จากหน้านี้ไม่ได้</div>
    </a-card>

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

    <a-card size="small" class="tidy" title="ข้อความ" style="margin-bottom: 16px">
      <label>ช่องทางติดต่อ support</label>
      <a-textarea v-model:value="form.support_message" :rows="2" :disabled="!canEdit" />
      <div class="hint">ผู้ช่วยบอกข้อความนี้เมื่อตอบไม่ได้หรือผู้ใช้ถามซ้ำ · ใช้เมื่อ connector ของหลังบ้านนั้นไม่ได้ตั้งไว้เอง</div>
    </a-card>

    <div class="actions">
      <a-button v-if="canEdit" type="primary" :loading="saving" @click="save">บันทึกตั้งค่าระบบ</a-button>
      <a-button @click="reload">โหลดค่าล่าสุด</a-button>
      <span class="hint">แก้ล่าสุดโดย {{ form.updated_by || '—' }} · {{ fmt(form.updated_at) }}</span>
    </div>
  </a-spin>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.hint { font-size: 12px; color: var(--muted); }
.kv { display: flex; gap: 12px; align-items: center; margin-bottom: 4px; }
.kv .hint { width: 80px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.field label, label { display: block; font-size: 13px; margin-bottom: 4px; }
.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
</style>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getSettings, patchSettings } from '@/services/api/admin'
import { useAuthStore } from '@/stores/auth'
import { apiErrorText } from '@/utils/apiErrors'
import type { Settings } from '@/types'

const auth = useAuthStore()
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const canEdit = auth.can('settings.manage')

const form = reactive<Settings>({
  model: '', max_concurrent: 3, ticket_ttl_min: 30, default_monthly_limit: 1_000_000, support_message: '',
  telegram_rooms: { alerts: '', contract_tests: '' },
  pricing: { currency: 'USD', input_per_mtok: 0, output_per_mtok: 0, cache_write_per_mtok: 0, cache_read_per_mtok: 0, fx_to_local: 0, local_currency: '' },
  llm_timeout_sec: 25, max_output_tokens: 1024, history_turns: 6, tool_timeout_ms: 6000, effort: '',
  updated_at: '', updated_by: '',
})

async function reload() {
  loading.value = true
  loadError.value = ''
  try {
    Object.assign(form, await getSettings())
  } catch (e) {
    loadError.value = apiErrorText(e)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    Object.assign(form, await patchSettings({
      model: form.model, max_concurrent: form.max_concurrent, ticket_ttl_min: form.ticket_ttl_min,
      default_monthly_limit: form.default_monthly_limit, support_message: form.support_message,
      telegram_rooms: form.telegram_rooms, pricing: form.pricing, llm_timeout_sec: form.llm_timeout_sec,
      max_output_tokens: form.max_output_tokens, history_turns: form.history_turns, tool_timeout_ms: form.tool_timeout_ms,
      effort: form.effort,
    }))
    message.success('บันทึกตั้งค่าระบบแล้ว')
  } catch (e) {
    message.error(apiErrorText(e))
  } finally {
    saving.value = false
  }
}

onMounted(reload)
</script>

<template>
  <div class="page-head">
    <h1>ตั้งค่าระบบ</h1>
    <p class="sub">
      ค่าที่มีผลกับทุก office/service — แก้จากที่นี่มีผลภายในไม่กี่วินาทีโดยไม่ต้อง deploy
      (กฎความปลอดภัย สิทธิ์ และรายการ tool ตั้งจากตรงนี้ไม่ได้ — แก้ผ่าน deploy เท่านั้น)
    </p>
  </div>

  <div v-if="loading" class="loading-state"><a-spin /></div>
  <a-alert v-else-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <template v-else>
    <a-alert v-if="!canEdit" type="info" show-icon message="ดูได้อย่างเดียว — ต้องมีสิทธิ์ settings.manage ถึงจะแก้ได้" style="margin-bottom: 16px" />

    <a-card size="small" class="tidy" title="โมเดล/ประสิทธิภาพ" style="margin-bottom: 16px">
      <label class="f-label">โมเดล</label>
      <a-input v-model:value="form.model" :disabled="!canEdit" />

      <label class="f-label">จำนวนคำขอพร้อมกันสูงสุด (max_concurrent)</label>
      <a-input-number v-model:value="form.max_concurrent" :min="1" :max="50" :disabled="!canEdit" style="width: 100%" />

      <label class="f-label">อายุตั๋ว (นาที)</label>
      <a-input-number v-model:value="form.ticket_ttl_min" :min="5" :max="120" :disabled="!canEdit" style="width: 100%" />

      <label class="f-label">timeout เรียกโมเดล (วินาที)</label>
      <a-input-number v-model:value="form.llm_timeout_sec" :min="1" :max="120" :disabled="!canEdit" style="width: 100%" />

      <label class="f-label">timeout เรียก tool (มิลลิวินาที)</label>
      <a-input-number v-model:value="form.tool_timeout_ms" :min="500" :max="30000" :disabled="!canEdit" style="width: 100%" />

      <label class="f-label">token คำตอบสูงสุด</label>
      <a-input-number v-model:value="form.max_output_tokens" :min="256" :max="8192" :disabled="!canEdit" style="width: 100%" />

      <label class="f-label">จำนวนรอบสนทนาก่อนหน้าที่ส่งให้โมเดล (history_turns)</label>
      <a-input-number v-model:value="form.history_turns" :min="0" :max="20" :disabled="!canEdit" style="width: 100%" />

      <label class="f-label">effort</label>
      <a-select v-model:value="form.effort" :disabled="!canEdit" style="width: 100%">
        <a-select-option value="">ค่าเริ่มต้นของโมเดล</a-select-option>
        <a-select-option value="low">low</a-select-option>
        <a-select-option value="medium">medium</a-select-option>
        <a-select-option value="high">high</a-select-option>
      </a-select>
    </a-card>

    <a-card size="small" class="tidy" title="โควตา/ข้อความ" style="margin-bottom: 16px">
      <label class="f-label">เพดานเริ่มต้นต่อเดือน (token) — ใช้เมื่อ service ไม่ได้ตั้งเพดานของตัวเอง</label>
      <a-input-number v-model:value="form.default_monthly_limit" :min="1" :disabled="!canEdit" style="width: 100%" />

      <label class="f-label">ข้อความเมื่อระบบข้อมูลล่ม (support_message)</label>
      <a-textarea v-model:value="form.support_message" :rows="2" :disabled="!canEdit" />
    </a-card>

    <a-card size="small" class="tidy" title="ราคาต่อ 1 ล้าน token (rate_snapshot)" style="margin-bottom: 16px">
      <div class="grid4">
        <div><label class="f-label">สกุลเงิน</label><a-input v-model:value="form.pricing.currency" :disabled="!canEdit" /></div>
        <div><label class="f-label">input / MTok</label><a-input-number v-model:value="form.pricing.input_per_mtok" :min="0" :step="0.1" :disabled="!canEdit" style="width: 100%" /></div>
        <div><label class="f-label">output / MTok</label><a-input-number v-model:value="form.pricing.output_per_mtok" :min="0" :step="0.1" :disabled="!canEdit" style="width: 100%" /></div>
        <div><label class="f-label">cache write / MTok</label><a-input-number v-model:value="form.pricing.cache_write_per_mtok" :min="0" :step="0.1" :disabled="!canEdit" style="width: 100%" /></div>
        <div><label class="f-label">cache read / MTok</label><a-input-number v-model:value="form.pricing.cache_read_per_mtok" :min="0" :step="0.1" :disabled="!canEdit" style="width: 100%" /></div>
        <div><label class="f-label">อัตราแลกเป็นสกุลท้องถิ่น (0 = ไม่แปลง)</label><a-input-number v-model:value="form.pricing.fx_to_local" :min="0" :step="0.01" :disabled="!canEdit" style="width: 100%" /></div>
        <div><label class="f-label">สกุลท้องถิ่น</label><a-input v-model:value="form.pricing.local_currency" placeholder="เช่น THB" :disabled="!canEdit" /></div>
      </div>
      <div class="hint">ค่านี้คือเรตที่บันทึกลงทุกข้อความใหม่ (rate snapshot) — แก้แล้วไม่กระทบต้นทุนที่บันทึกไปแล้วย้อนหลัง</div>
    </a-card>

    <a-card size="small" class="tidy" title="ห้อง Telegram แจ้งเตือน" style="margin-bottom: 16px">
      <label class="f-label">แจ้งเตือนทั่วไป (alerts)</label>
      <a-input v-model:value="form.telegram_rooms.alerts" :disabled="!canEdit" />
      <label class="f-label">ผล contract test รายวัน</label>
      <a-input v-model:value="form.telegram_rooms.contract_tests" :disabled="!canEdit" />
    </a-card>

    <div class="row">
      <a-button type="primary" :loading="saving" :disabled="!canEdit" @click="save">บันทึกตั้งค่าระบบ</a-button>
      <span v-if="form.updated_by" class="hint">แก้ล่าสุดโดย {{ form.updated_by }} · {{ new Date(form.updated_at).toLocaleString('th-TH') }}</span>
    </div>
  </template>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); max-width: 640px; }
.tidy :deep(.ant-card-head-title) { font-family: var(--font-head); font-weight: 600; font-size: 15px; }
.f-label { display: block; font-size: 12.5px; color: var(--muted); margin: 12px 0 4px; }
.hint { font-size: 12px; color: var(--muted); margin-top: 8px; }
.grid4 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
.row { display: flex; align-items: center; gap: 12px; }
.loading-state { display: flex; justify-content: center; padding: 60px 0; }
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import InfoTip from '@/components/InfoTip.vue'
import PinInput from '@/components/PinInput.vue'
import { deleteLLMKey, setLLMKey } from '@/services/api/ops'
import type { LLMProvider } from '@/types'

// ตั้ง/เปลี่ยน/ลบ API key — ยืนยัน 2FA ทุกครั้ง · key อยู่ในช่องนี้แค่ตอนกรอก ปิดหน้าต่าง = ล้างทิ้ง
const props = defineProps<{
  provider: LLMProvider | null
  mode: 'set' | 'delete'
  /** โมเดล/Base URL ที่ใช้ทดสอบ key ก่อนบันทึก (ค่าที่กรอกอยู่ในการ์ด ถ้าเป็น provider เดียวกัน) */
  testModel?: string
  testBaseUrl?: string
}>()
const open = defineModel<boolean>('open', { default: false })
// done ส่ง Base URL ที่ใช้ทดสอบผ่านกลับไป ให้การ์ดโมเดลใช้ต่อ ไม่ต้องกรอกซ้ำ
const emit = defineEmits<{ done: [baseUrl?: string] }>()

const key = ref('')
const code = ref('')
// provider ที่ต้องมี Base URL (OpenAI-compatible) — ใช้ทดสอบ key ก่อนบันทึก
const baseUrl = ref('')
const needsUrl = computed(() => props.mode === 'set' && !!props.provider?.needs_base_url)
const busy = ref(false)
const error = ref('')

// ปิดหน้าต่าง = ล้าง key ออกจาก memory ของหน้าเว็บทันที
watch(open, (v) => {
  if (v) baseUrl.value = props.testBaseUrl ?? ''
  if (!v) {
    key.value = ''
    code.value = ''
    error.value = ''
  }
})

const replacing = computed(() => !!props.provider?.key?.last4)
const title = computed(() => {
  const name = props.provider?.label ?? ''
  if (props.mode === 'delete') return `ลบ API key ของ ${name}`
  return replacing.value ? `เปลี่ยน API key ของ ${name}` : `ตั้ง API key ของ ${name}`
})
const ready = computed(() =>
  code.value.length === 6 &&
  (props.mode === 'delete' || (key.value.trim().length >= 12 && (!needsUrl.value || !!baseUrl.value.trim()))),
)

async function submit() {
  if (!props.provider || !ready.value) return
  busy.value = true
  error.value = ''
  try {
    if (props.mode === 'delete') {
      await deleteLLMKey(props.provider.id, code.value)
      message.success(`ลบ API key ของ ${props.provider.label} แล้ว`)
    } else {
      const info = await setLLMKey(props.provider.id, {
        key: key.value.trim(), code: code.value, model: props.testModel,
        base_url: needsUrl.value ? baseUrl.value.trim() : props.testBaseUrl,
      })
      message.success(`บันทึก API key ••••${info.last4 ?? ''} แล้ว — ใช้กับแชทถัดไปทันที`)
    }
    const usedUrl = needsUrl.value ? baseUrl.value.trim() : undefined
    open.value = false
    emit('done', usedUrl)
  } catch (e) {
    error.value = (e as Error).message
    code.value = '' // รหัสใช้ได้ครั้งเดียวต่อช่วง — ให้พิมพ์ใหม่
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:open="open"
    centered
    :title="title"
    :width="460"
    :mask-closable="!busy"
    :confirm-loading="busy"
    :ok-text="mode === 'delete' ? 'ลบ key' : 'ทดสอบและบันทึก'"
    :ok-button-props="{ disabled: !ready, danger: mode === 'delete' }"
    cancel-text="ยกเลิก"
    destroy-on-close
    @ok="submit"
  >
    <template v-if="mode === 'set'">
      <p class="intro">
        key ถูกเข้ารหัสก่อนเก็บ และจะไม่แสดงกลับมาอีก — หลังบันทึกเห็นแค่ 4 ตัวท้าย ·
        ระบบลองเรียกผู้ให้บริการด้วย key นี้ก่อน ใช้ไม่ได้จะไม่บันทึก
      </p>
      <label for="llm-key-input">
        API key
        <span v-if="replacing" class="muted">— แทนที่ ••••{{ provider?.key?.last4 }}</span>
      </label>
      <a-input-password
        id="llm-key-input"
        v-model:value="key"
        placeholder="วาง API key ที่นี่"
        autocomplete="new-password"
        :spellcheck="false"
        :visibility-toggle="false"
      />
      <template v-if="needsUrl">
        <label for="llm-base-url">
          Base URL
          <InfoTip>
            ที่อยู่ API แบบ Chat Completions ของผู้ให้บริการ เช่น <code>https://api.example.com/v1</code><br />
            ใช้ทดสอบ key นี้ก่อนบันทึก · ไม่ต้องใส่ <code>/chat/completions</code> ต่อท้าย
          </InfoTip>
        </label>
        <a-input id="llm-base-url" v-model:value="baseUrl" placeholder="เช่น https://api.example.com/v1" />
      </template>
    </template>
    <p v-else class="intro">
      ลบ key <b>••••{{ provider?.key?.last4 }}</b> — ผู้ให้บริการนี้จะใช้ไม่ได้จนกว่าจะตั้ง key ใหม่
    </p>

    <label>รหัส 2FA จากแอป Authenticator</label>
    <PinInput v-model="code" :autofocus="mode === 'delete'" @complete="submit" />
    <p class="muted small">ใส่ผิด 5 ครั้งบัญชีจะถูกล็อก 15 นาที</p>

    <a-alert v-if="error" type="error" show-icon :message="error" style="margin-top: 12px" />
  </a-modal>
</template>

<style scoped>
.intro { font-size: 13px; color: var(--muted); line-height: 1.6; margin: 0 0 6px; }
label { display: flex; align-items: center; font-size: 13px; margin: 14px 0 6px; }
.muted { color: var(--muted); font-weight: 400; }
.small { font-size: 12px; margin: 8px 0 0; }
</style>

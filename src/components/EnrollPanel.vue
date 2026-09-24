<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import QRCode from 'qrcode'
import { message } from 'ant-design-vue'
import PinInput from './PinInput.vue'
import { useAuthStore } from '@/stores/auth'
import { authErrorText, authErrorCode, AUTH_CODE_INVALID_TICKET } from '@/utils/authErrors'

const props = defineProps<{
  mode: 'enroll' | 'verify'
  otpauthUri?: string
  secret?: string
}>()

const emit = defineEmits<{
  (e: 'done', recoveryCodes?: string[]): void
  /** ticket หมดอายุ — parent ต้องรีเซ็ตกลับไป Phase A */
  (e: 'expired'): void
}>()

const auth = useAuthStore()

const code = ref('')
const loading = ref(false)
const errorMsg = ref('')
const qrDataUrl = ref('')
const recoveryCodes = ref<string[] | null>(null)

const heading = computed(() =>
  props.mode === 'enroll' ? 'ตั้งค่า 2FA ครั้งแรก' : 'กรอกรหัสจากแอป Authenticator',
)

async function renderQr(uri?: string) {
  if (!uri) {
    qrDataUrl.value = ''
    return
  }
  try {
    qrDataUrl.value = await QRCode.toDataURL(uri, {
      width: 260,
      margin: 1,
      color: { dark: '#13282b', light: '#ffffff' },
    })
  } catch {
    qrDataUrl.value = ''
  }
}

watch(() => props.otpauthUri, (uri) => renderQr(uri))
onMounted(() => {
  if (props.mode === 'enroll') renderQr(props.otpauthUri)
})

async function submit() {
  if (code.value.length !== 6 || loading.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const recovery = await auth.submitTotp(code.value)
    if (props.mode === 'enroll' && recovery && recovery.length) {
      recoveryCodes.value = recovery // ค้างไว้ให้ผู้ใช้กดรับทราบก่อนไปต่อ
    } else {
      emit('done', recovery)
    }
  } catch (err) {
    if (authErrorCode(err) === AUTH_CODE_INVALID_TICKET) {
      emit('expired')
      return
    }
    errorMsg.value = authErrorText(err)
    code.value = ''
  } finally {
    loading.value = false
  }
}

async function copyCodes() {
  if (!recoveryCodes.value) return
  try {
    await navigator.clipboard.writeText(recoveryCodes.value.join('\n'))
    message.success('คัดลอกรหัสสำรองแล้ว')
  } catch {
    message.warning('คัดลอกไม่สำเร็จ — กรุณาจดด้วยตนเอง')
  }
}

function acknowledge() {
  emit('done', recoveryCodes.value ?? undefined)
}
</script>

<template>
  <!-- แผงรหัสสำรอง — โชว์ครั้งเดียวหลัง enroll สำเร็จ -->
  <section v-if="recoveryCodes" class="recovery">
    <h2 class="rc-head">รหัสสำรอง</h2>
    <div class="rc-warn">
      เก็บรหัสสำรองนี้ไว้ที่ปลอดภัย
      <strong>แสดงครั้งเดียวเท่านั้น</strong> — ใช้เข้าระบบเมื่อเข้าถึงแอป Authenticator ไม่ได้
    </div>
    <ul class="rc-grid mono">
      <li v-for="rc in recoveryCodes" :key="rc">{{ rc }}</li>
    </ul>
    <div class="rc-actions">
      <a-button block @click="copyCodes">คัดลอก</a-button>
      <a-button type="primary" block @click="acknowledge">ฉันเก็บแล้ว เข้าสู่ระบบ</a-button>
    </div>
  </section>

  <!-- ขั้นตอนสแกน/ยืนยัน -->
  <section v-else class="verify">
    <h2 class="v-head">{{ heading }}</h2>

    <template v-if="mode === 'enroll'">
      <p class="hint">สแกน QR ด้วยแอป Authenticator (Google / Microsoft Authenticator)</p>
      <div class="qr-frame">
        <img v-if="qrDataUrl" :src="qrDataUrl" alt="TOTP QR" width="200" height="200" />
        <div v-else class="qr-skeleton">กำลังสร้าง QR…</div>
      </div>
      <div v-if="secret" class="secret">
        <span class="secret-label">หรือกรอกรหัสนี้ด้วยตนเอง</span>
        <code class="mono secret-val">{{ secret }}</code>
      </div>
    </template>

    <template v-else>
      <p class="hint">กรอกรหัส 6 หลักจากแอป Authenticator เพื่อยืนยันตัวตน</p>
    </template>

    <div class="field">
      <PinInput v-model="code" :length="6" autofocus @complete="submit" />
    </div>
    <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

    <a-button
      type="primary"
      block
      size="large"
      :loading="loading"
      :disabled="code.length !== 6"
      @click="submit"
    >
      {{ mode === 'enroll' ? 'ยืนยันและเปิดใช้งาน' : 'ยืนยัน' }}
    </a-button>
  </section>
</template>

<style scoped>
.v-head,
.rc-head {
  font-family: var(--font-head);
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 6px;
}
.hint {
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
  margin: 0 0 16px;
}
.qr-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 232px;
  height: 232px;
  margin: 0 auto 16px;
  padding: 14px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
}
.qr-skeleton {
  font-size: 13px;
  color: var(--muted);
}
.secret {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  margin-bottom: 20px;
}
.secret-label {
  font-size: 12px;
  color: var(--muted);
}
.secret-val {
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--ink);
  background: var(--ground);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 12px;
  word-break: break-all;
  text-align: center;
}
.field {
  margin: 4px 0 14px;
}
.err {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--danger);
  text-align: center;
}

/* recovery */
.rc-warn {
  font-size: 13px;
  line-height: 1.55;
  color: #92400e;
  background: #fef6e7;
  border: 1px solid #f5d99a;
  border-radius: 10px;
  padding: 11px 13px;
  margin-bottom: 16px;
}
.rc-grid {
  list-style: none;
  margin: 0 0 18px;
  padding: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  background: var(--ground);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.rc-grid li {
  font-size: 15px;
  letter-spacing: 0.06em;
  color: var(--ink);
  text-align: center;
  padding: 4px 0;
}
.rc-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>

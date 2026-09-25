<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PinInput from '@/components/PinInput.vue'
import AuthShell from '@/components/AuthShell.vue'
import EnrollPanel from '@/components/EnrollPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { authErrorCode, authErrorText, AUTH_CODE_INVALID_TICKET } from '@/utils/authErrors'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

const totpCode = ref('')
const totpLoading = ref(false)
const totpError = ref('')
const totpRef = ref<InstanceType<typeof PinInput> | null>(null)

const pending = computed(() => auth.pending)
const canSubmit = computed(() => username.value.trim().length > 0 && password.value.length > 0)

const modalOpen = computed({
  get: () => !!pending.value,
  set: (v: boolean) => {
    if (!v) resetToPhaseA()
  },
})

const modalTitle = computed(() =>
  pending.value?.stage === 'enroll' ? 'ตั้งค่า 2FA ครั้งแรก' : 'ยืนยันด้วยรหัสจากแอป Authenticator',
)

onMounted(() => {
  if (auth.isAuthed) {
    router.replace('/')
    return
  }
  // เริ่มที่ Phase A เสมอ — ล้าง state ค้างจากรอบก่อน
  auth.pending = null
})

function goNext() {
  // กัน open-redirect: รับเฉพาะ path เดียวกัน origin (ขึ้นต้น '/' แต่ไม่ใช่ '//' ซึ่งเป็น protocol-relative URL)
  const r = route.query.redirect
  const isSafePath = typeof r === 'string' && r.startsWith('/') && !r.startsWith('//')
  router.replace(isSafePath ? r : '/')
}

async function submitCredentials() {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    await auth.startLogin(username.value.trim(), password.value)
    // pending ถูกตั้งค่าแล้ว → modal เปิดอัตโนมัติ
  } catch (err) {
    errorMsg.value = authErrorText(err)
    password.value = ''
  } finally {
    loading.value = false
  }
}

async function submitTotpCode() {
  if (totpCode.value.length !== 6 || totpLoading.value) return
  totpLoading.value = true
  totpError.value = ''
  try {
    await auth.submitTotp(totpCode.value)
    goNext()
  } catch (err) {
    if (authErrorCode(err) === AUTH_CODE_INVALID_TICKET) {
      resetToPhaseA()
      return
    }
    totpError.value = authErrorText(err)
    totpCode.value = ''
    totpRef.value?.focus()
  } finally {
    totpLoading.value = false
  }
}

function resetToPhaseA() {
  auth.pending = null
  password.value = ''
  totpCode.value = ''
  totpError.value = ''
}
</script>

<template>
  <AuthShell title="เข้าสู่ระบบ" subtitle="สำหรับผู้ดูแลคอนโซล AI Office">
    <!-- Phase A: username + password -->
    <form class="phase-a" @submit.prevent="submitCredentials">
      <label class="field">
        <span class="label">ชื่อผู้ใช้</span>
        <a-input
          v-model:value="username"
          size="large"
          placeholder="username"
          autocomplete="username"
          :maxlength="64"
        />
      </label>

      <label class="field">
        <span class="label">รหัสผ่าน</span>
        <a-input-password
          v-model:value="password"
          size="large"
          placeholder="รหัสผ่าน"
          autocomplete="current-password"
        />
      </label>

      <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

      <a-button
        type="primary"
        html-type="submit"
        block
        size="large"
        :loading="loading"
        :disabled="!canSubmit"
      >
        เข้าสู่ระบบ
      </a-button>
    </form>

    <!-- Phase B: 2FA (verify หรือ enroll) — อยู่ใน modal -->
    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :footer="null"
      :mask-closable="false"
      :width="440"
      centered
    >
      <template v-if="pending?.stage === 'totp'">
        <p class="hint totp-hint">กรอกรหัส 6 หลักจากแอป Authenticator เพื่อยืนยันตัวตน</p>
        <div class="field totp-field">
          <PinInput ref="totpRef" v-model="totpCode" :length="6" autofocus @complete="submitTotpCode" />
        </div>
        <p v-if="totpError" class="err">{{ totpError }}</p>
        <a-button
          type="primary"
          block
          size="large"
          :loading="totpLoading"
          :disabled="totpCode.length !== 6"
          @click="submitTotpCode"
        >
          ยืนยัน
        </a-button>
      </template>

      <EnrollPanel
        v-else-if="pending?.stage === 'enroll'"
        mode="enroll"
        :otpauth-uri="pending.otpauthUri"
        :secret="pending.secret"
        @done="goNext"
        @expired="resetToPhaseA"
      />
    </a-modal>
  </AuthShell>
</template>

<style scoped>
.phase-a {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.totp-hint {
  text-align: center;
  margin: 2px 0 8px;
}
.totp-field {
  align-items: center;
  justify-content: center;
  /* เพิ่มความสูง — เว้นบน/ล่างรอบช่อง PIN ให้โปร่ง */
  margin: 26px 0 28px;
}
.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
.hint {
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
  margin: 0 0 16px;
}
.err {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--danger);
  text-align: center;
}
</style>

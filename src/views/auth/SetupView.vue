<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import EnrollPanel from '@/components/EnrollPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { authStatus } from '@/services/api/auth'
import { authErrorText } from '@/utils/authErrors'

const router = useRouter()
const auth = useAuthStore()

const checking = ref(true)
const username = ref('')
const displayName = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')

const pending = computed(() => auth.pending)
const canSubmit = computed(
  () =>
    username.value.trim().length > 0 &&
    displayName.value.trim().length > 0 &&
    password.value.length >= 8 &&
    confirmPassword.value.length >= 8,
)

const modalOpen = computed({
  get: () => !!pending.value,
  set: (v: boolean) => {
    if (!v) resetToForm()
  },
})

onMounted(async () => {
  if (auth.isAuthed) {
    router.replace('/')
    return
  }
  auth.pending = null
  try {
    const status = await authStatus()
    if (!status.needs_setup) {
      router.replace('/login')
      return
    }
  } catch {
    // เช็ค status ไม่ได้ — ปล่อยให้ผู้ใช้เห็นฟอร์ม (backend อาจล่ม)
  } finally {
    checking.value = false
  }
})

async function submitRegister() {
  if (loading.value) return
  if (!username.value.trim() || !displayName.value.trim() || password.value.length < 8) {
    errorMsg.value = 'กรอกข้อมูลให้ครบ — รหัสผ่านต้องมีอย่างน้อย 8 ตัว'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMsg.value = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'
    confirmPassword.value = ''
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await auth.startRegister(username.value.trim(), displayName.value.trim(), password.value)
    // pending.stage === 'enroll' → modal เปิดอัตโนมัติ
  } catch (err) {
    errorMsg.value = authErrorText(err)
  } finally {
    loading.value = false
  }
}

function goNext() {
  router.replace('/')
}

function resetToForm() {
  auth.pending = null
  password.value = ''
  confirmPassword.value = ''
  errorMsg.value = 'หมดเวลา เริ่มตั้งค่าใหม่'
}
</script>

<template>
  <AuthShell title="ตั้งค่าผู้ดูแลคนแรก" subtitle="สร้างบัญชีแอดมินสำหรับติดตั้งครั้งแรก">
    <div v-if="checking" class="loading">กำลังตรวจสอบสถานะระบบ…</div>

    <!-- ฟอร์มสร้างแอดมิน -->
    <form v-else class="form" @submit.prevent="submitRegister">
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
        <span class="label">ชื่อที่แสดง</span>
        <a-input
          v-model:value="displayName"
          size="large"
          placeholder="ชื่อ-นามสกุล"
          :maxlength="64"
        />
      </label>

      <label class="field">
        <span class="label">รหัสผ่าน (อย่างน้อย 8 ตัว)</span>
        <a-input-password
          v-model:value="password"
          size="large"
          placeholder="รหัสผ่าน"
          autocomplete="new-password"
        />
      </label>

      <label class="field">
        <span class="label">ยืนยันรหัสผ่าน</span>
        <a-input-password
          v-model:value="confirmPassword"
          size="large"
          placeholder="ยืนยันรหัสผ่าน"
          autocomplete="new-password"
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
        สร้างบัญชีผู้ดูแล
      </a-button>
    </form>

    <!-- Enroll 2FA — modal -->
    <a-modal v-model:open="modalOpen" title="ตั้งค่า 2FA เพื่อความปลอดภัย" :footer="null" :mask-closable="false" :width="440" centered>
      <EnrollPanel
        v-if="pending"
        mode="enroll"
        :otpauth-uri="pending.otpauthUri"
        :secret="pending.secret"
        @done="goNext"
        @expired="resetToForm"
      />
    </a-modal>
  </AuthShell>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
.err {
  margin: 0;
  font-size: 13px;
  color: var(--danger);
  text-align: center;
}
.loading {
  padding: 24px 0;
  text-align: center;
  font-size: 14px;
  color: var(--muted);
}
</style>

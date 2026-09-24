<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import { authErrorCode, authErrorText } from '@/utils/authErrors'

const open = defineModel<boolean>('open', { default: false })

const auth = useAuthStore()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')

const canSubmit = computed(
  () =>
    oldPassword.value.length >= 8 &&
    newPassword.value.length >= 8 &&
    confirmPassword.value.length >= 8,
)

watch(open, (v) => {
  if (v) {
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    errorMsg.value = ''
  }
})

async function submit() {
  errorMsg.value = ''
  if (oldPassword.value.length < 8 || newPassword.value.length < 8) {
    errorMsg.value = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'
    return
  }
  loading.value = true
  try {
    await auth.changePassword(oldPassword.value, newPassword.value)
    message.success('เปลี่ยนรหัสผ่านแล้ว')
    open.value = false
  } catch (err) {
    const code = authErrorCode(err)
    if (code === 'INVALID_CREDENTIALS') errorMsg.value = 'รหัสผ่านปัจจุบันไม่ถูกต้อง'
    else if (code === 'INVALID_PASSWORD') errorMsg.value = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว'
    else errorMsg.value = authErrorText(err)
  } finally {
    loading.value = false
  }
}

function cancel() {
  open.value = false
}
</script>

<template>
  <a-modal centered
    v-model:open="open"
    title="เปลี่ยนรหัสผ่าน"
    :confirm-loading="loading"
    ok-text="บันทึก"
    cancel-text="ยกเลิก"
    :ok-button-props="{ disabled: !canSubmit }"
    @ok="submit"
    @cancel="cancel"
  >
    <div class="field">
      <span class="label">รหัสผ่านปัจจุบัน</span>
      <a-input-password v-model:value="oldPassword" size="large" autocomplete="current-password" />
    </div>
    <div class="field">
      <span class="label">รหัสผ่านใหม่</span>
      <a-input-password v-model:value="newPassword" size="large" autocomplete="new-password" />
    </div>
    <div class="field">
      <span class="label">ยืนยันรหัสผ่านใหม่</span>
      <a-input-password v-model:value="confirmPassword" size="large" autocomplete="new-password" />
    </div>

    <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
  </a-modal>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
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
</style>

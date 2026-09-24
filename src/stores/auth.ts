import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getConsoleToken, setConsoleToken } from '@/services/api/client'
import { changePassword as apiChangePassword, login, me, register, verifyTotp } from '@/services/api/auth'
import type { ConsoleUser, PermissionKey } from '@/services/api/types'

interface PendingLogin {
  ticket: string
  stage: 'enroll' | 'totp'
  otpauthUri?: string
  secret?: string
}

/**
 * pending ห้าม persist ลง localStorage เด็ดขาด — เป็น state ชั่วคราวระหว่างขั้นตอน login/register
 * เท่านั้น (ticket มีอายุสั้น ๆ ฝั่ง backend)
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(getConsoleToken())
  const user = ref<ConsoleUser | null>(null)
  const permissions = ref<PermissionKey[]>([])
  const roleLabel = ref<string>('')
  const pending = ref<PendingLogin | null>(null)

  const isAuthed = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  function can(perm: PermissionKey) {
    return permissions.value.includes(perm)
  }
  const canEdit = computed(() => can('office.edit'))

  async function startLogin(username: string, password: string) {
    const res = await login({ username, password })
    pending.value = { ticket: res.ticket, stage: res.stage, otpauthUri: res.otpauth_uri, secret: res.secret }
    return res.stage
  }

  async function startRegister(username: string, display_name: string, password: string) {
    const res = await register({ username, display_name, password })
    pending.value = { ticket: res.ticket, stage: res.stage, otpauthUri: res.otpauth_uri, secret: res.secret }
    return res.stage
  }

  async function submitTotp(code: string) {
    if (!pending.value) throw new Error('ไม่มีขั้นตอนเข้าสู่ระบบค้างอยู่ — เริ่มใหม่อีกครั้ง')
    const res = await verifyTotp({ ticket: pending.value.ticket, code })
    token.value = res.token
    setConsoleToken(res.token)
    user.value = res.user
    pending.value = null
    // verify response ไม่ได้ส่ง permissions มาด้วย — โหลดจาก /me อีกทีให้ครบ
    await loadMe()
    return res.recovery_codes
  }

  async function loadMe() {
    const res = await me()
    user.value = res.user
    permissions.value = res.permissions ?? []
    roleLabel.value = res.role_label ?? ''
    return res.user
  }

  function logout() {
    token.value = ''
    setConsoleToken('')
    user.value = null
    permissions.value = []
    roleLabel.value = ''
    pending.value = null
  }

  async function changePassword(oldPassword: string, newPassword: string) {
    await apiChangePassword({ old_password: oldPassword, new_password: newPassword })
  }

  return {
    token,
    user,
    permissions,
    roleLabel,
    pending,
    isAuthed,
    isAdmin,
    canEdit,
    can,
    startLogin,
    startRegister,
    submitTotp,
    loadMe,
    logout,
    changePassword,
  }
})

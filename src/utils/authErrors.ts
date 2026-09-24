/**
 * Envelope error-code → ข้อความไทย
 * client.ts โยน ApiError(json.error) มา ดังนั้น err.message = โค้ด (เช่น INVALID_CREDENTIALS)
 */
const MAP: Record<string, string> = {
  INVALID_CREDENTIALS: 'username หรือรหัสผ่านไม่ถูกต้อง',
  ACCOUNT_LOCKED: 'บัญชีถูกล็อกชั่วคราว ลองใหม่ภายหลัง',
  ACCOUNT_DISABLED: 'บัญชีถูกปิดใช้งาน',
  INVALID_2FA: 'รหัสไม่ถูกต้อง',
  INVALID_TICKET: 'หมดเวลา เริ่มใหม่',
  INVALID_PASSWORD: 'รหัสผ่านไม่ถูกต้อง',
  USERNAME_TAKEN: 'username นี้ถูกใช้แล้ว',
  LAST_ADMIN: 'ต้องมี admin ที่ใช้งานได้อย่างน้อย 1 คน',
  CANNOT_DELETE_SELF: 'ลบบัญชีตัวเองไม่ได้',
  INVALID_ROLE: 'role ไม่ถูกต้อง',
}

export const AUTH_CODE_INVALID_TICKET = 'INVALID_TICKET'

export function authErrorCode(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function authErrorText(err: unknown): string {
  const code = authErrorCode(err)
  if (MAP[code]) return MAP[code]
  // โค้ดที่ไม่รู้จัก — ไม่โชว์โค้ดดิบ ๆ ให้ผู้ใช้
  return 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'
}

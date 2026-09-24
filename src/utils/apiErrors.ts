/**
 * Envelope error-code → ข้อความไทย สำหรับ endpoint ฝั่งแอดมิน (K1–K5)
 * ส่วนใหญ่ backend ส่ง err.Error() มาเป็นข้อความไทยอยู่แล้ว (ดู AdminHandler.fail / OfficeHandler.fail)
 * ที่นี่แปลเฉพาะโค้ดคงที่ที่ backend ส่งเป็น "code" ล้วน ๆ
 */
const MAP: Record<string, string> = {
  FORBIDDEN: 'ไม่มีสิทธิ์ทำรายการนี้',
  NOT_FOUND: 'ไม่พบรายการนี้',
  CONFIRM_OLD_REQUIRED: 'ข้อมูลเก่ากว่า 90 วัน ต้องกดยืนยันเพิ่มก่อนเปิดอ่าน',
  CONFLICT: 'id นี้ถูกใช้ไปแล้ว',
}

export function apiErrorCode(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function apiErrorText(err: unknown): string {
  const code = apiErrorCode(err)
  return MAP[code] || code
}

export const ERR_CONFIRM_OLD_REQUIRED = 'CONFIRM_OLD_REQUIRED'

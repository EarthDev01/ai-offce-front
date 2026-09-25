// token ของผู้ช่วย AI ในคอนโซลถูกบันทึกไว้ใต้ office_id นี้ (backend เก็บไว้ครบ)
// หน้าภาพรวมและการใช้งาน token แสดงเฉพาะของ domain ลูกค้า — ตัดแถวพวกนี้ออกก่อนคำนวณ/แสดง
export const CONSOLE_USAGE_OFFICE = '_console'

export function customerUsageOnly<T extends { office_id: string }>(rows: T[]): T[] {
  return rows.filter((r) => r.office_id !== CONSOLE_USAGE_OFFICE)
}

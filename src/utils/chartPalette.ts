// สีประจำเว็บในกราฟ — ชุด 8 สีเรียงตามลำดับที่ผ่านการตรวจแยกสีสำหรับคนตาบอดสี (ห้ามสลับลำดับ)
// ตรวจแล้วบนพื้น #ffffff: ทุกเกณฑ์ผ่าน · 3 สี (aqua/yellow/magenta) ต่ำกว่า 3:1 → หน้าต้องมี legend + ตาราง
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']

/** สีของกลุ่ม "อื่น ๆ" (เว็บลำดับที่ 9 ขึ้นไป) — เทากลาง ไม่ใช่สีใหม่ */
export const OTHER_COLOR = '#8a918f'
export const OTHER_KEY = '__other__'

// สถานะผลตรวจ — สีสถานะ (ไม่ใช่สีประจำเว็บ) มาพร้อมป้ายข้อความเสมอ
export const STATUS_COLORS = { correct: '#0ca30c', wrong: '#d03b3b', pending: '#cfd6d3' }

/**
 * กำหนดสีตาม "ตัวเว็บ" ไม่ใช่อันดับ — ลำดับมาจากรายชื่อเว็บทั้งหมด (คงที่) ไม่ใช่จากยอดในช่วงที่เลือก
 * กรองแล้วเหลือกี่เว็บ สีของเว็บที่เหลือก็ไม่เปลี่ยน
 */
export function colorMap(allKeys: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  allKeys.forEach((k, i) => {
    out[k] = i < SERIES_COLORS.length ? SERIES_COLORS[i] : OTHER_COLOR
  })
  return out
}

/** เว็บลำดับที่ 9+ รวมเป็น "อื่น ๆ" */
export function seriesKey(allKeys: string[], key: string): string {
  const i = allKeys.indexOf(key)
  return i >= 0 && i < SERIES_COLORS.length ? key : OTHER_KEY
}

const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat('th-TH')
export const fmtCompact = (v: number) => compact.format(v)
export const fmtFull = (v: number) => full.format(v)

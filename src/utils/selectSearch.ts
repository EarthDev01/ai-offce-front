// ให้ a-select ที่ตัวเลือกมาจาก API พิมพ์ค้นได้ · ใส่ attr `search` บนตัวเลือกเป็นข้อความที่ให้ค้น (ไม่ใส่ = ใช้ label/value)
// ใช้คู่กับ `show-search :filter-option="matchOption"`
export function matchOption(input: string, option?: Record<string, unknown>) {
  const text = option?.search ?? option?.label ?? option?.value ?? ''
  return String(text).toLowerCase().includes(input.trim().toLowerCase())
}

import { request } from './client'

const base = '/api/ai/admin'

/** คู่มือ (Markdown) — แหล่งเดียวกับที่ผู้ช่วย AI ในคอนโซลใช้ตอบ */
export const getGuide = () => request<{ markdown: string }>(`${base}/guide`)

/** ปุ่มผู้ช่วยควรโชว์ไหม: enabled = เปิดในตั้งค่าระบบ · ready = โมเดลมี API key */
export const getAssistantStatus = () => request<{ enabled: boolean; ready: boolean }>(`${base}/assistant/status`)

/** ชื่อ event ที่หน้าตั้งค่าส่งหลังบันทึก ให้ปุ่มผู้ช่วยเช็กสถานะใหม่ */
export const ASSISTANT_CHANGED = 'ai-office:assistant-changed'

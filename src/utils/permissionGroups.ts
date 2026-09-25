import type { PermissionKey } from '@/services/api/types'

// หมวดเดียวกันทั้งเมนูซ้ายและหน้าสิทธิ์ของ role — แก้ที่นี่ที่เดียว

export interface NavItem {
  to: string
  label: string
  /** ชื่อ icon ใน NavIcon.vue */
  icon: string
  /** มีสิทธิ์ข้อใดข้อหนึ่ง = เห็นเมนู · ไม่ใส่ = ทุกคนที่ล็อกอิน */
  perms?: PermissionKey[]
}

export interface NavGroup {
  /** ว่าง = ไม่แสดงหัวหมวด (หมวดที่มีรายการเดียวและชื่อซ้ำกัน) */
  title: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  { title: '', items: [{ to: '/overview', label: 'ภาพรวม', icon: 'overview', perms: ['usage.view'] }] },
  { title: 'ลูกค้า', items: [{ to: '/offices', label: 'หลังบ้านลูกค้า', icon: 'customer' }] },
  {
    title: 'แชท',
    items: [
      { to: '/history', label: 'ประวัติแชท', icon: 'history', perms: ['conversation.read'] },
      { to: '/review', label: 'ตรวจคำตอบ', icon: 'review', perms: ['verification.write'] },
    ],
  },
  { title: 'รายงาน', items: [{ to: '/usage', label: 'การใช้งาน token', icon: 'usage', perms: ['usage.view'] }] },
  {
    title: 'ข้อมูลส่วนบุคคล',
    items: [{ to: '/deletion', label: 'ลบข้อมูลตามคำขอ', icon: 'privacy', perms: ['deletion.manage', 'accesslog.view'] }],
  },
  {
    title: 'ผู้ดูแลระบบ',
    items: [
      { to: '/users', label: 'ผู้ใช้คอนโซล', icon: 'users', perms: ['user.manage'] },
      { to: '/roles', label: 'สิทธิ์ของ role', icon: 'roles', perms: ['user.manage'] },
      { to: '/activity', label: 'ประวัติการทำงาน', icon: 'activity', perms: ['audit.view'] },
      { to: '/settings', label: 'ตั้งค่าระบบ', icon: 'settings', perms: ['office.view'] },
    ],
  },
]

export const SOON_ITEMS: string[] = []

/** สิทธิ์ 1 ข้อบนหน้าสิทธิ์ของ role — opens บอกว่าเปิดเมนู/ปุ่มอะไร */
export interface PermItem {
  key: PermissionKey
  opens: string
}

export interface PermGroup {
  title: string
  items: PermItem[]
}

export const PERM_GROUPS: PermGroup[] = [
  {
    title: 'ลูกค้า',
    items: [
      { key: 'office.view', opens: 'เมนูหลังบ้านลูกค้า และดูตั้งค่าระบบ' },
      { key: 'office.edit', opens: 'สร้าง/แก้ กลุ่ม domain service และ snippet' },
      { key: 'office.delete', opens: 'ลบกลุ่ม domain และ service' },
    ],
  },
  {
    title: 'แชท',
    items: [
      { key: 'conversation.read', opens: 'เมนูประวัติแชท (ทุกการเปิดอ่านถูกบันทึก)' },
      { key: 'verification.write', opens: 'เมนูตรวจคำตอบ' },
    ],
  },
  { title: 'รายงาน', items: [{ key: 'usage.view', opens: 'เมนูภาพรวม และการใช้งาน token' }] },
  {
    title: 'ข้อมูลส่วนบุคคล',
    items: [
      { key: 'deletion.manage', opens: 'เมนูลบข้อมูลตามคำขอ › แท็บขอลบ (ลบถาวร)' },
      { key: 'accesslog.view', opens: 'เมนูลบข้อมูลตามคำขอ › แท็บบันทึกการเข้าถึง' },
    ],
  },
  {
    title: 'ผู้ดูแลระบบ',
    items: [
      { key: 'user.manage', opens: 'เมนูผู้ใช้คอนโซล และหน้านี้ (สิทธิ์ของ role)' },
      { key: 'audit.view', opens: 'เมนูประวัติการทำงาน' },
      { key: 'settings.manage', opens: 'แก้ค่าในหน้าตั้งค่าระบบ' },
      { key: 'llm.key.manage', opens: 'ตั้ง/เปลี่ยน/ลบ API key ของโมเดล AI (ยืนยัน 2FA ทุกครั้ง)' },
    ],
  },
]

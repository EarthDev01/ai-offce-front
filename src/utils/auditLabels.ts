// ป้ายภาษาไทยของประวัติการทำงาน — key ต้องตรงกับ domain.Audit* / json field ใน ai-office-backend
// key ที่ไม่รู้จัก (backend เพิ่มใหม่ก่อน FE) จะแสดงค่าดิบแทน ไม่พัง

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  auth: { label: 'เข้าสู่ระบบ', color: 'geekblue' },
  office: { label: 'Office', color: 'cyan' },
  service: { label: 'Service', color: 'blue' },
  user: { label: 'ผู้ใช้', color: 'purple' },
  role: { label: 'Role / สิทธิ์', color: 'gold' },
  access: { label: 'ถูกปฏิเสธสิทธิ์', color: 'volcano' },
}

export const ACTION_LABELS: Record<string, string> = {
  'auth.setup': 'ตั้งค่าระบบครั้งแรก',
  'auth.login': 'เข้าสู่ระบบ',
  'auth.login_failed': 'เข้าสู่ระบบไม่สำเร็จ',
  'auth.account_locked': 'บัญชีถูกล็อก',
  'auth.2fa_enrolled': 'ตั้งค่า 2FA',
  'auth.recovery_code_used': 'ใช้ recovery code',
  'auth.logout': 'ออกจากระบบ',
  'auth.password_changed': 'เปลี่ยนรหัสผ่าน',

  'office.create': 'สร้าง office',
  'office.update': 'แก้ไข office',
  'office.delete': 'ลบ office',
  'office.rotate_key': 'เปลี่ยน public key (เลิกใช้แล้ว)',

  'service.create': 'เพิ่ม service',
  'service.update': 'แก้ไข service',
  'service.delete': 'ลบ service',

  'user.create': 'เพิ่มผู้ใช้',
  'user.update': 'แก้ไขผู้ใช้',
  'user.reset_password': 'รีเซ็ตรหัสผ่าน',
  'user.reset_2fa': 'รีเซ็ต 2FA',
  'user.delete': 'ลบผู้ใช้',

  'role.create': 'สร้าง role',
  'role.rename': 'เปลี่ยนชื่อ role',
  'role.delete': 'ลบ role',
  'role.permissions_update': 'แก้สิทธิ์ของ role',

  'access.denied': 'ถูกปฏิเสธสิทธิ์',
}

// action ไหนเป็นการ "สร้าง / แก้ / ลบ" — ใช้ทำไอคอนนำหน้า
export function actionVerb(action: string): 'create' | 'update' | 'delete' | 'auth' | 'deny' {
  if (action.startsWith('access.')) return 'deny'
  if (action.startsWith('auth.')) return 'auth'
  if (/\.(create|setup)$/.test(action)) return 'create'
  if (/\.delete$/.test(action)) return 'delete'
  return 'update'
}

const COMMON_FIELDS: Record<string, string> = {
  label: 'ชื่อ',
  enabled: 'เปิดใช้งาน',
  public_key: 'public key',
  permissions: 'สิทธิ์',
}

const FIELD_LABELS: Record<string, Record<string, string>> = {
  office: {
    allowed_origins: 'โดเมนที่อนุญาต',
    host_api_base: 'URL API หลังบ้าน',
    backoffice_api_url: 'URL API officeลูกค้า',
    use_real_token: 'ใช้ token จริง',
    enabled: 'สวิตช์ฉุกเฉิน (เปิดใช้งาน)',
    is_hidden: 'ซ่อนปุ่มลอย',
    theme: 'ธีม',
    placement: 'ตำแหน่งปุ่มลอย',
  },
  service: {
    display_name: 'ชื่อ AI',
    greeting: 'คำทักทาย',
    avatar_url: 'รูป AI',
    allowlist: 'allowlist',
  },
  user: {
    username: 'username',
    display_name: 'ชื่อที่แสดง',
    role: 'บทบาท',
    status: 'สถานะ',
  },
  role: {},
}

export function fieldLabel(targetType: string, field: string) {
  return FIELD_LABELS[targetType]?.[field] ?? COMMON_FIELDS[field] ?? field
}

export const PERMISSION_LABELS: Record<string, string> = {
  'office.view': 'ดู office/service',
  'office.edit': 'สร้าง/แก้ office และ service',
  'office.delete': 'ลบ office/service',
  'user.manage': 'จัดการผู้ใช้ และตั้งสิทธิ์ role',
  'audit.view': 'ดูประวัติการทำงาน',
}

export const REASON_LABELS: Record<string, string> = {
  INVALID_CREDENTIALS: 'รหัสผ่านผิด',
  UNKNOWN_USER: 'ไม่พบ username',
  ACCOUNT_LOCKED: 'บัญชีถูกล็อก',
  ACCOUNT_DISABLED: 'บัญชีถูกปิด',
  INVALID_2FA: 'รหัส 2FA ผิด',
  TOO_MANY_ATTEMPTS: 'ผิดเกินจำนวนครั้ง',
  FORBIDDEN: 'ไม่มีสิทธิ์',
}

export const META_LABELS: Record<string, string> = {
  office_id: 'office id',
  office_label: 'office',
  services: 'service ที่มีตอนลบ',
  public_key: 'public key ตอนลบ',
  locked_until: 'ล็อกถึง',
  remaining: 'recovery code ที่เหลือ',
  method: 'ยืนยันด้วย',
  permission: 'สิทธิ์ที่ขาด',
  display_name: 'ชื่อที่แสดง',
  role: 'บทบาท',
}

const STATUS_VALUE: Record<string, string> = { active: 'ใช้งาน', disabled: 'ปิด' }
const THEME_VALUE: Record<string, string> = { auto: 'ตามระบบ', light: 'สว่าง', dark: 'มืด' }
const POSITION_VALUE: Record<string, string> = { 'bottom-right': 'ขวาล่าง', 'bottom-left': 'ซ้ายล่าง' }

/** แปลงค่าที่อ่านแล้วเข้าใจได้สำหรับ field ที่รู้จัก — คืน null ถ้าต้องแสดงแบบทั่วไป */
export function friendlyValue(field: string, v: unknown): string | null {
  if (typeof v === 'boolean') return v ? 'เปิด' : 'ปิด'
  if (typeof v !== 'string') {
    if (field === 'placement' && v && typeof v === 'object') {
      const p = v as { position?: string; offset_x?: number; offset_y?: number }
      return `${POSITION_VALUE[p.position ?? ''] ?? p.position ?? '—'} · x ${p.offset_x ?? 0} / y ${p.offset_y ?? 0}px`
    }
    return null
  }
  if (field === 'status') return STATUS_VALUE[v] ?? v
  if (field === 'theme') return THEME_VALUE[v] ?? v
  return v
}

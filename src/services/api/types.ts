// role เป็น string ธรรมดา — admin เพิ่ม/ลบ/เปลี่ยนชื่อ role ได้จากหน้า "สิทธิ์ของ role" (ไม่ hardcode ชุด literal อีกต่อไป)
export type Role = string

export type PermissionKey =
  | 'office.view'
  | 'office.edit'
  | 'office.delete'
  | 'office.rotate'
  | 'user.manage'
  // w-17 · K1–K5
  | 'secret.manage'
  | 'conversation.read'
  | 'verification.write'
  | 'quota.view'
  | 'quota.manage'
  | 'deletion.manage'
  | 'settings.manage'
  | 'accesslog.view'
  | 'audit.view'

export interface RoleDef {
  key: string
  label: string
  builtin: boolean
}

export type RolePermissionMatrix = Record<string, PermissionKey[]>

export interface RolePermissionsPayload {
  roles: RoleDef[]
  matrix: RolePermissionMatrix
  catalog: { key: PermissionKey; label: string }[]
}

export interface ConsoleUser {
  id: string
  username: string
  display_name: string
  role: string
  status: string
  last_login_at?: string
}

export interface LoginStage {
  stage: 'enroll' | 'totp'
  ticket: string
  otpauth_uri?: string
  secret?: string
}

export interface VerifyResult {
  token: string
  user: ConsoleUser
  recovery_codes?: string[]
}

/** ค่าก่อน/หลังของ field เดียว — เป็นค่าดิบจาก backend (string, bool, list, object) */
export interface AuditChange {
  field: string
  before: unknown
  after: unknown
}

export type AuditCategory = 'auth' | 'office' | 'service' | 'user' | 'role' | 'access'

/** 1 เหตุการณ์ในประวัติการทำงาน — ดู domain.AuditEntry ใน ai-office-backend */
export interface AuditEntry {
  id: string
  at: string
  actor_id: string
  actor: string
  actor_role: string
  action: string
  category: AuditCategory | string
  target_type: string
  target_id: string
  target_label: string
  summary: string
  changes: AuditChange[]
  meta: Record<string, string>
  status: 'success' | 'failure'
  reason: string
  ip: string
  user_agent: string
  method: string
  path: string
}

export interface AuditQuery {
  actor?: string
  category?: string
  action?: string
  status?: string
  target_type?: string
  target_id?: string
  q?: string
  from?: string // RFC3339
  to?: string // RFC3339 (ไม่รวมตัวเอง)
  page?: number
  page_size?: number
}

export interface AuditPage {
  items: AuditEntry[]
  total: number
  total_capped: boolean // จำนวนจริงมากกว่า total (server นับถึงแค่ 10,000)
  page: number
  page_size: number
}

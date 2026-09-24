// role เป็น string ธรรมดา — admin เพิ่ม/ลบ/เปลี่ยนชื่อ role ได้จากหน้า "สิทธิ์ของ role" (ไม่ hardcode ชุด literal อีกต่อไป)
export type Role = string

export type PermissionKey = 'office.view' | 'office.edit' | 'office.delete' | 'office.rotate' | 'user.manage'

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

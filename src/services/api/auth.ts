import { request } from './client'
import type {
  ConsoleUser,
  LoginStage,
  PermissionKey,
  Role,
  RolePermissionMatrix,
  RolePermissionsPayload,
  VerifyResult,
} from './types'

const base = '/api/ai/admin/auth'
const usersBase = '/api/ai/admin/users'
const rolePermissionsBase = '/api/ai/admin/role-permissions'
const rolesBase = '/api/ai/admin/roles'
const enc = encodeURIComponent

export const authStatus = () => request<{ needs_setup: boolean }>(`${base}/status`)

export const register = (body: { username: string; display_name: string; password: string }) =>
  request<LoginStage>(`${base}/register`, { method: 'POST', body: JSON.stringify(body) })

export const login = (body: { username: string; password: string }) =>
  request<LoginStage>(`${base}/login`, { method: 'POST', body: JSON.stringify(body) })

export const verifyTotp = (body: { ticket: string; code: string }) =>
  request<VerifyResult>(`${base}/totp/verify`, { method: 'POST', body: JSON.stringify(body) })

export const me = () =>
  request<{ user: ConsoleUser; permissions: PermissionKey[]; role_label: string }>(`${base}/me`)

export const changePassword = (body: { old_password: string; new_password: string }) =>
  request<void>(`${base}/change-password`, { method: 'POST', body: JSON.stringify(body) })

export const listUsers = () => request<{ users: ConsoleUser[] }>(usersBase)

export const createUser = (body: { username: string; display_name: string; role: Role; password: string }) =>
  request<{ user: ConsoleUser }>(usersBase, { method: 'POST', body: JSON.stringify(body) })

export const patchUser = (id: string, body: { display_name?: string; role?: Role; status?: string }) =>
  request<{ user: ConsoleUser }>(`${usersBase}/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(body) })

export const resetPassword = (id: string, password: string) =>
  request<void>(`${usersBase}/${enc(id)}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) })

export const reset2fa = (id: string) => request<void>(`${usersBase}/${enc(id)}/reset-2fa`, { method: 'POST' })

export const deleteUser = (id: string) => request<void>(`${usersBase}/${enc(id)}`, { method: 'DELETE' })

export const getRolePermissions = () => request<RolePermissionsPayload>(rolePermissionsBase)

export const saveRolePermissions = (matrix: RolePermissionMatrix) =>
  request<RolePermissionsPayload>(rolePermissionsBase, {
    method: 'PUT',
    body: JSON.stringify({ matrix }),
  })

export const createRole = (key: string, label: string) =>
  request<RolePermissionsPayload>(rolesBase, { method: 'POST', body: JSON.stringify({ key, label }) })

export const renameRole = (key: string, label: string) =>
  request<RolePermissionsPayload>(`${rolesBase}/${enc(key)}`, { method: 'PATCH', body: JSON.stringify({ label }) })

export const deleteRole = (key: string) =>
  request<RolePermissionsPayload>(`${rolesBase}/${enc(key)}`, { method: 'DELETE' })

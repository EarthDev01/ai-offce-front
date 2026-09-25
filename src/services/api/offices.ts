import { request } from './client'
import type { Office, OfficeGroup, OfficePatch, ServicePatch } from '@/types'

const base = '/api/ai/admin/offices'
const enc = encodeURIComponent

export const listOffices = () => request<{ total: number; data: Office[] }>(base)

export const getOffice = (id: string) => request<Office>(`${base}/${enc(id)}`)

/** เพิ่ม domain ในกลุ่ม · origin = URL ของ domain (ว่างได้) */
export const createOffice = (in_: { id: string; label: string; group_id: string; origin: string }) =>
  request<Office>(base, { method: 'POST', body: JSON.stringify(in_) })

export const patchOffice = (id: string, patch: OfficePatch) =>
  request<Office>(`${base}/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })

export const deleteOffice = (id: string) => request<null>(`${base}/${enc(id)}`, { method: 'DELETE' })

/** ทำให้ snippet เดิมใช้ไม่ได้ทันที — ต้องถามยืนยันก่อนเรียก */

export const addService = (officeID: string, id: string, label: string) =>
  request<Office>(`${base}/${enc(officeID)}/services`, { method: 'POST', body: JSON.stringify({ id, label }) })

export const patchService = (officeID: string, serviceID: string, patch: ServicePatch) =>
  request<Office>(`${base}/${enc(officeID)}/services/${enc(serviceID)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })

export const removeService = (officeID: string, serviceID: string) =>
  request<Office>(`${base}/${enc(officeID)}/services/${enc(serviceID)}`, { method: 'DELETE' })

// ---- กลุ่มของ domain ----
const groupsBase = '/api/ai/admin/groups'

export const listGroups = () => request<{ data: OfficeGroup[] }>(groupsBase)

export const createGroup = (name: string) =>
  request<OfficeGroup>(groupsBase, { method: 'POST', body: JSON.stringify({ name }) })

export const renameGroup = (id: string, name: string) =>
  request<OfficeGroup>(`${groupsBase}/${enc(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) })

export const deleteGroup = (id: string) => request<null>(`${groupsBase}/${enc(id)}`, { method: 'DELETE' })

import { request } from './client'
import type { ConnectorInfo, Office, OfficePatch, ServicePatch } from '@/types'

const base = '/api/ai/admin/offices'
const enc = encodeURIComponent

export const listOffices = () => request<{ total: number; data: Office[] }>(base)

export const getOffice = (id: string) => request<Office>(`${base}/${enc(id)}`)

export const listConnectors = () => request<{ data: ConnectorInfo[] }>('/api/ai/admin/connectors')

export const createOffice = (id: string, label: string, kind = '') =>
  request<Office>(base, { method: 'POST', body: JSON.stringify({ id, label, kind }) })

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

// ---- โควตาชั่วคราว (K4) ----

export const increaseQuota = (officeID: string, serviceID: string, amount: number, reason: string) =>
  request<Office>(`${base}/${enc(officeID)}/services/${enc(serviceID)}/quota/increase`, {
    method: 'POST',
    body: JSON.stringify({ amount, reason }),
  })

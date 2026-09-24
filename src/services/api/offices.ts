import { request } from './client'
import type { ConnectorInfo, Office, OfficePatch, SecretIssueResult, ServicePatch } from '@/types'

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

// ---- secret_key ต่อ service (R3) — แสดงครั้งเดียวในคำตอบของ issue/rotate เท่านั้น ----

const secretBase = (officeID: string, serviceID: string) =>
  `${base}/${enc(officeID)}/services/${enc(serviceID)}/secret`

export const issueSecret = (officeID: string, serviceID: string) =>
  request<SecretIssueResult>(secretBase(officeID, serviceID), { method: 'POST' })

export const rotateSecret = (officeID: string, serviceID: string) =>
  request<SecretIssueResult>(`${secretBase(officeID, serviceID)}/rotate`, { method: 'POST' })

export const commitSecret = (officeID: string, serviceID: string) =>
  request<Office>(`${secretBase(officeID, serviceID)}/commit`, { method: 'POST' })

export const revokeSecret = (officeID: string, serviceID: string) =>
  request<Office>(`${secretBase(officeID, serviceID)}/revoke`, { method: 'POST' })

// ---- โควตาชั่วคราว (K4) ----

export const increaseQuota = (officeID: string, serviceID: string, amount: number, reason: string) =>
  request<Office>(`${base}/${enc(officeID)}/services/${enc(serviceID)}/quota/increase`, {
    method: 'POST',
    body: JSON.stringify({ amount, reason }),
  })

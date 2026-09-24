import { request } from './client'
import type { AuditPage, AuditQuery } from './types'

const base = '/api/ai/admin/audit-logs'

export function listAuditLogs(query: AuditQuery) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return request<AuditPage>(qs ? `${base}?${qs}` : base)
}

export const listAuditActors = () => request<{ actors: string[] }>(`${base}/actors`)

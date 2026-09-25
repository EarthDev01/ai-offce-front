import { request } from './client'
import type {
  Conversation, ConversationFilter, ConversationView, QueueItem, Verification, VerificationStats, VerifyInput,
} from '@/types'

const base = '/api/ai/admin'

function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

/** ค้นห้องแชท — ทุกครั้งถูกบันทึกลง access_log */
export const listConversations = (f: ConversationFilter) =>
  request<{ total: number; data: Conversation[] }>(`${base}/conversations${qs({ ...f })}`)

/** เปิดอ่านห้อง — ห้องที่เปิดมาเกิน 90 วันต้องส่ง confirmOld */
export const getConversation = (id: string, confirmOld = false) =>
  request<ConversationView>(`${base}/conversations/${encodeURIComponent(id)}${confirmOld ? '?confirm_old=1' : ''}`)

export const verificationQueue = (f: { office_id?: string; service_id?: string; limit?: number; offset?: number }) =>
  request<{ total: number; data: QueueItem[]; error_types: Record<string, string> }>(
    `${base}/verifications/queue${qs({ ...f })}`,
  )

export const verify = (in_: VerifyInput) =>
  request<Verification>(`${base}/verifications`, { method: 'POST', body: JSON.stringify(in_) })

export const verificationStats = (officeID?: string, serviceID?: string) =>
  request<VerificationStats>(`${base}/verifications/stats${qs({ office_id: officeID, service_id: serviceID })}`)

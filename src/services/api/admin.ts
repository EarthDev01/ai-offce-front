import { request } from './client'
import type {
  AccessLog,
  ChatMessage,
  Conversation,
  ConversationView,
  DailyRollup,
  DeletionRequest,
  QueueItem,
  QuotaStatus,
  Settings,
  SettingsPatch,
  Verification,
  VerificationErrorType,
  VerificationStats,
} from '@/types'

const base = '/api/ai/admin'
const enc = encodeURIComponent

function qs(params: object) {
  const p = new URLSearchParams()
  Object.entries(params as Record<string, string | number | undefined | null>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ---------------------------------------------------------------------------
// K2 — ประวัติแชท
// ---------------------------------------------------------------------------

export interface ConversationFilter {
  office_id?: string
  service_id?: string
  user?: string
  from?: string
  to?: string
  q?: string
  /** ห้องที่มีคำตอบของ AI อย่างน้อย 1 ข้อความอยู่ในสถานะนี้ */
  verification?: 'pending' | 'correct' | 'wrong'
  limit?: number
  offset?: number
}

export const listConversations = (f: ConversationFilter) =>
  request<{ total: number; data: Conversation[] }>(`${base}/conversations${qs(f)}`)

export const getConversation = (id: string, confirmOld = false) =>
  request<ConversationView>(`${base}/conversations/${enc(id)}${confirmOld ? '?confirm_old=1' : ''}`)

export interface MessageFilter {
  office_id?: string
  service_id?: string
  user?: string
  role?: string
  verification?: string
  q?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export const searchMessages = (f: MessageFilter) =>
  request<{ total: number; data: ChatMessage[] }>(`${base}/messages${qs(f)}`)

export const getMessage = (id: string, confirmOld = false) =>
  request<{ message: ChatMessage; verification: Verification | null }>(
    `${base}/messages/${enc(id)}${confirmOld ? '?confirm_old=1' : ''}`,
  )

// ---------------------------------------------------------------------------
// K3 — ตรวจคำตอบ
// ---------------------------------------------------------------------------

export const verificationQueue = (f: { office_id?: string; service_id?: string; status?: string; limit?: number; offset?: number }) =>
  request<{ total: number; data: QueueItem[]; error_types: Record<VerificationErrorType, string> }>(
    `${base}/verifications/queue${qs(f)}`,
  )

export interface VerifyInput {
  message_id: string
  status: 'correct' | 'wrong'
  error_type?: VerificationErrorType | ''
  correct_answer?: string
  note?: string
}

export const verify = (in_: VerifyInput) =>
  request<Verification>(`${base}/verifications`, { method: 'POST', body: JSON.stringify(in_) })

export const verificationStats = (officeID?: string, serviceID?: string) =>
  request<VerificationStats>(`${base}/verifications/stats${qs({ office_id: officeID, service_id: serviceID })}`)

// ---------------------------------------------------------------------------
// K4 — โควตา/ต้นทุน
// ---------------------------------------------------------------------------

export const listQuotas = () => request<{ data: QuotaStatus[] }>(`${base}/quotas`)

export const listRollups = (officeID?: string, serviceID?: string, from?: string, to?: string) =>
  request<{ data: DailyRollup[] }>(`${base}/rollups${qs({ office_id: officeID, service_id: serviceID, from, to })}`)

// ---------------------------------------------------------------------------
// K5 — ลบตามคำขอ (PDPA) + บันทึกการเข้าถึง
// ---------------------------------------------------------------------------

export interface DeletionInput {
  office_id: string
  service_id?: string
  user_id?: string
  from?: string
  to?: string
  reason: string
  approved_by?: string
}

export const createDeletion = (in_: DeletionInput) =>
  request<DeletionRequest>(`${base}/deletion-requests`, { method: 'POST', body: JSON.stringify(in_) })

export const listDeletions = (limit = 50, offset = 0) =>
  request<{ total: number; data: DeletionRequest[] }>(`${base}/deletion-requests${qs({ limit, offset })}`)

export const listAccessLog = (f: { office_id?: string; service_id?: string; operator?: string; limit?: number; offset?: number }) =>
  request<{ total: number; data: AccessLog[] }>(`${base}/access-log${qs(f)}`)

// ---------------------------------------------------------------------------
// settings ระดับระบบ (K1)
// ---------------------------------------------------------------------------

export const getSettings = () => request<Settings>(`${base}/settings`)

export const patchSettings = (p: SettingsPatch) =>
  request<Settings>(`${base}/settings`, { method: 'PATCH', body: JSON.stringify(p) })

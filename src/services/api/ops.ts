import { request } from './client'
import type {
  AccessLog, DailyRollup, DeletionInput, DeletionRequest, LLMKeyInfo, LLMSettings, LLMTestResult, Settings, SettingsPatch, SettingsView,
  UsagePeriod,
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

export const getSettings = () => request<SettingsView>(`${base}/settings`)

/** ต้องส่ง updated_at ที่เห็นล่าสุด — ถ้ามีคนแก้ไปก่อน server ตอบ 409 */
export const patchSettings = (p: SettingsPatch) =>
  request<Settings>(`${base}/settings`, { method: 'PATCH', body: JSON.stringify(p) })

/** ยิงข้อความสั้น 1 ครั้งด้วยค่าที่กรอก (ยังไม่บันทึก) */
export const testLLM = (cfg: LLMSettings) =>
  request<LLMTestResult>(`${base}/settings/llm/test`, { method: 'POST', body: JSON.stringify(cfg) })

/** ตั้ง/เปลี่ยน API key — ต้องมีรหัส 2FA · server ทดสอบ key ก่อนบันทึก · ตอบกลับแค่ 4 ตัวท้าย */
export const setLLMKey = (provider: string, body: { key: string; code: string; model?: string; base_url?: string }) =>
  request<LLMKeyInfo>(`${base}/settings/llm/keys/${encodeURIComponent(provider)}`, { method: 'PUT', body: JSON.stringify(body) })

export const deleteLLMKey = (provider: string, code: string) =>
  request<null>(`${base}/settings/llm/keys/${encodeURIComponent(provider)}`, { method: 'DELETE', body: JSON.stringify({ code }) })

export const listUsage = (period?: string) =>
  request<{ period: string; data: UsagePeriod[] }>(`${base}/usage${qs({ period })}`)

export const listRollups = (f: { office_id?: string; service_id?: string; from?: string; to?: string }) =>
  request<{ data: DailyRollup[] }>(`${base}/rollups${qs({ ...f })}`)

export const createDeletion = (in_: DeletionInput) =>
  request<DeletionRequest>(`${base}/deletion-requests`, { method: 'POST', body: JSON.stringify(in_) })

export const listDeletions = (limit = 50, offset = 0) =>
  request<{ total: number; data: DeletionRequest[] }>(`${base}/deletion-requests${qs({ limit, offset })}`)

export const listAccessLog = (f: { office_id?: string; service_id?: string; operator?: string; limit?: number; offset?: number }) =>
  request<{ total: number; data: AccessLog[] }>(`${base}/access-log${qs({ ...f })}`)

export type Position = 'bottom-right' | 'bottom-left'
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Placement {
  position: Position
  offset_x: number
  offset_y: number
}

/** service = แบรนด์/เว็บย่อยใต้ office หนึ่ง — แอดมินสลับไปมาได้ในหน้าเดิม */
export interface Service {
  id: string
  label: string
  enabled: boolean
  allowlist: string[]
  display_name: string
  greeting: string
  avatar_url: string
}

/** office = การติดตั้ง 1 ชุด · public_key ตัวนี้คือตัวที่อยู่ใน snippet */
export interface Office {
  id: string
  label: string
  public_key: string
  allowed_origins: string[]
  /** URL API หลังบ้านที่ widget ของ office นี้ยิง · ว่าง = <โดเมนหน้าเว็บ>/api */
  host_api_base?: string
  /** กลุ่มที่ domain นี้อยู่ · ว่าง = ยังไม่ได้จัดกลุ่ม */
  group_id?: string
  enabled: boolean
  is_hidden: boolean
  theme: ThemeMode
  placement: Placement
  services: Service[]
  created_at: string
  updated_at: string
  updated_by: string
}

export type OfficePatch = Partial<
  Pick<Office, 'label' | 'allowed_origins' | 'host_api_base' | 'group_id' | 'enabled' | 'is_hidden' | 'theme' | 'placement'>
>

export type ServicePatch = Partial<
  Pick<Service, 'label' | 'enabled' | 'allowlist' | 'display_name' | 'greeting' | 'avatar_url'>
>

export interface ApiResponse<T> {
  code: number
  message: string
  error: string
  payload: T
}

// ---- ประวัติแชท / ตรวจคำตอบ (ดู domain/chat.go ใน ai-office-backend) ----

/** การ์ดที่ระบบสร้างจากผล API หลังบ้าน — ค่าจริงอยู่ที่นี่ ไม่ได้มาจาก LLM */
export interface ChatCard {
  id: string
  kind: 'ok' | 'not_found' | 'error' | 'denied' | 'reference'
  tool: string
  title: string
  fields: { label: string; display: string }[] | null
  table?: { columns: { label: string }[]; rows: { display: string }[][] }
  note?: string
  fetched_at: string
  link?: { label: string; path: string }
  cached?: boolean
}

/** บันทึกการเรียก tool 1 ครั้ง — endpoint เป็น template ไม่ใช่ค่าจริง */
export interface ToolCall {
  tool: string
  endpoint: string
  method: string
  status: number
  ms: number
  ok: boolean
  cached: boolean
  error?: string
}

export type VerificationStatus = 'pending' | 'correct' | 'wrong'

export interface Conversation {
  id: string
  office_id: string
  service_id: string
  admin_id: string
  username: string
  title: string
  message_count: number
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  office_id: string
  service_id: string
  role: 'user' | 'assistant'
  text: string
  cards?: ChatCard[]
  tool_calls?: ToolCall[]
  usage: { input_tokens: number; output_tokens: number }
  first_token_ms?: number
  guard_hits?: number
  category?: string
  status?: 'ok' | 'aborted' | 'error'
  verification_status?: VerificationStatus
  created_at: string
}

export interface Verification {
  id: string
  message_id: string
  status: 'correct' | 'wrong'
  error_type?: string
  correct_answer?: string
  note?: string
  verified_by: string
  verified_at: string
}

export interface ConversationView {
  conversation: Conversation
  messages: ChatMessage[]
  verifications: Record<string, Verification>
}

export interface ConversationFilter {
  office_id?: string
  service_id?: string
  user?: string
  q?: string
  verification?: VerificationStatus
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface QueueItem {
  question: string
  answer: ChatMessage
}

export interface VerificationStats {
  correct: number
  wrong: number
  pending: number
  verified: number
  total: number
  percent_correct: number
  basis: string
}

export interface VerifyInput {
  message_id: string
  status: 'correct' | 'wrong'
  error_type?: string
  correct_answer?: string
  note?: string
}

// ---- ตั้งค่าระบบ / การใช้ token / ลบตามคำขอ (ดู domain/settings.go, usage.go, deletion.go) ----

export interface Settings {
  max_concurrent: number
  ticket_ttl_min: number
  support_message: string
  llm_timeout_sec: number
  stream_timeout_sec: number
  max_output_tokens: number
  history_turns: number
  tool_timeout_ms: number
  llm: LLMSettings
  /** ค่าล่าสุดที่เคยบันทึกของแต่ละ provider (key = provider id) — server ดูแลเอง ไม่ต้องส่งกลับ */
  llm_recent?: Record<string, LLMSettings>
  updated_at: string
  updated_by: string
}

/** โมเดลที่ใช้ตอบแชท — API key อยู่ใน .env ของหลังบ้าน ai ไม่ผ่านหน้าเว็บ */
export interface LLMSettings {
  provider: string
  model: string
  /** anthropic เท่านั้น */
  effort: string
  /** openai เท่านั้น */
  base_url: string
}

export interface LLMProvider {
  id: string
  label: string
  env_key: string
  models: string[]
  efforts?: string[]
  needs_base_url: boolean
  /** มี key พร้อมใช้ไหม (server ไม่เคยส่งตัว key มา) */
  has_key: boolean
  key: LLMKeyInfo
}

/** สถานะ API key ของ provider — มีแค่ 4 ตัวท้าย ไม่มีตัว key */
export interface LLMKeyInfo {
  has_key?: boolean
  last4?: string
  /** db = ตั้งจากคอนโซล (เข้ารหัส) · env = มาจาก .env (ยังไม่ได้ตั้ง LLM_KEY_SECRET) */
  source?: 'db' | 'env'
  /** มีใน DB แต่ถอดรหัสไม่ได้ (กุญแจหลักเปลี่ยน) ต้องตั้งใหม่ */
  broken?: boolean
  updated_at?: string
  updated_by?: string
}

export interface LLMTestResult {
  latency_ms: number
  reply: string
  usage: { input_tokens: number; output_tokens: number; cache_read: number; cache_write: number }
}

export type SettingsPatch = Partial<Omit<Settings, 'updated_at' | 'updated_by' | 'llm_recent'>> & { updated_at: string }

export interface SettingsView {
  settings: Settings
  ranges: Record<string, [number, number]>
  llm_providers: LLMProvider[]
  /** โมเดลที่บันทึกไว้มี key พร้อมตอบแชท */
  llm_ready: boolean
  /** false = ยังไม่ตั้ง LLM_KEY_SECRET ตั้ง key จากหน้าเว็บไม่ได้ */
  llm_key_store: boolean
}

export interface UsagePeriod {
  id: string
  office_id: string
  service_id: string
  period: string
  questions: number
  input_tokens: number
  output_tokens: number
  cache_read: number
  cache_write: number
  updated_at: string
}

export interface DailyRollup {
  id: string
  office_id: string
  service_id: string
  date: string
  conversations: number
  questions: number
  input_tokens: number
  output_tokens: number
  cache_read: number
  cache_write: number
  refusals: number
  tool_errors: number
  guard_hits: number
  correct: number
  wrong: number
}

export interface DeletionRequest {
  id: string
  scope: { office_id: string; service_id?: string; user?: string; from?: string; to?: string }
  reason: string
  requested_by: string
  status: 'running' | 'done' | 'failed'
  result: { messages: number; conversations: number; verifications: number }
  error?: string
  created_at: string
  completed_at?: string
}

export interface DeletionInput {
  office_id: string
  service_id?: string
  user?: string
  from?: string
  to?: string
  reason: string
}

export interface AccessLog {
  id: string
  operator: string
  action: string
  office_id?: string
  service_id?: string
  conversation_id?: string
  message_id?: string
  detail?: string
  at: string
}

/** หัวกลุ่มของ domain (ตั้งชื่อเอง) — ลำดับชั้น: กลุ่ม → domain (Office) → service */
export interface OfficeGroup {
  id: string
  name: string
  created_at: string
  updated_at: string
  updated_by: string
}

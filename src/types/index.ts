export type Position = 'bottom-right' | 'bottom-left'
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Placement {
  position: Position
  offset_x: number
  offset_y: number
}

/** เพิ่มโควตาชั่วคราวให้รอบเดือนหนึ่ง — บันทึกผู้ทำเสมอ (P-13/AC-25) */
export interface TempIncrease {
  period: string
  amount: number
  by: string
  reason: string
  at: string
}

/** เพดานการใช้ต่อเดือนของ service — ≤0 = ใช้ค่าเริ่มต้นจาก settings ระดับระบบ */
export interface ServiceQuota {
  monthly_limit: number
  temp_increases: TempIncrease[]
}

/** service = แบรนด์/เว็บย่อยใต้ office หนึ่ง — แอดมินสลับไปมาได้ในหน้าเดิม */
export interface Service {
  id: string
  label: string
  enabled: boolean
  /** true = ทุกคนที่ host ยืนยันตัวตนแล้วใช้ได้ · false = เฉพาะ allowlist (ว่าง = ไม่มีใคร) */
  allow_all: boolean
  allowlist: string[]
  display_name: string
  greeting: string
  avatar_url: string
  quota: ServiceQuota

  // secret_key — ค่าจริงไม่เคยอยู่ใน payload นี้ (โชว์ครั้งเดียวตอนออก/หมุนเท่านั้น)
  has_secret: boolean
  has_prev_secret: boolean
  secret_created_at?: string
  secret_rotated_at?: string
  secret_last_used_at?: string
}

/** office = การติดตั้ง 1 ชุด · public_key ตัวนี้คือตัวที่อยู่ใน snippet */
export interface Office {
  id: string
  label: string
  /** ชนิดหลังบ้าน = ปลั๊ก connectors/<kind>/ ที่ใช้ — ยังไม่ตั้ง = ใช้ widget ไม่ได้ */
  kind: string
  public_key: string
  allowed_origins: string[]
  /** URL ของ API หลังบ้าน — ระบบ AI ใช้ขอกุญแจดอกเล็กและอ่านข้อมูล (w-17) */
  backoffice_api_url: string
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
  Pick<
    Office,
    'label' | 'kind' | 'allowed_origins' | 'backoffice_api_url' | 'enabled' | 'is_hidden' | 'theme' | 'placement'
  >
>

export type ServicePatch = Partial<
  Pick<Service, 'label' | 'enabled' | 'allow_all' | 'allowlist' | 'display_name' | 'greeting' | 'avatar_url'>
> & { monthly_limit?: number }

/** ผลเรียก secret ที่ออก/หมุนใหม่ — ค่า secret_key แสดงได้ครั้งเดียวเท่านั้น */
export interface SecretIssueResult {
  secret_key: string
  note: string
  office: Office
}

/** connector ที่ปลั๊กเข้าระบบไว้แล้ว (อ่านอย่างเดียว — แก้ผ่าน deploy เท่านั้น) */
export interface ConnectorTool {
  name: string
  questions: string[]
  permission: string
  freshness: string
}

export interface ConnectorInfo {
  kind: string
  label: string
  questions: string[]
  tools: ConnectorTool[]
}

// ---------------------------------------------------------------------------
// K2 — ประวัติแชท
// ---------------------------------------------------------------------------

export interface CardField {
  label: string
  display: string
  value: unknown
  format: string
}

export interface CardColumn {
  label: string
  format: string
}

export interface CardCell {
  display: string
  value: unknown
}

export interface CardTable {
  columns: CardColumn[]
  rows: CardCell[][]
}

export interface CardLink {
  label: string
  path: string
}

/** Card = ค่าที่มาจาก tool โดยตรง ไม่ผ่านการพิมพ์ของโมเดล (B-4) */
export interface Card {
  id: string
  kind: 'ok' | 'not_found' | 'error' | 'denied' | 'reference'
  tool: string
  title: string
  fields: CardField[]
  table?: CardTable
  note?: string
  fetched_at: string
  link?: CardLink
  cached: boolean
}

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

export interface Usage {
  in: number
  out: number
  cache_read: number
  cache_write: number
}

export interface Pricing {
  currency: string
  input_per_mtok: number
  output_per_mtok: number
  cache_write_per_mtok: number
  cache_read_per_mtok: number
  fx_to_local: number
  local_currency: string
}

export interface Cost {
  amount: number
  currency: string
  amount_local: number
  local_currency: string
  rate_snapshot: Pricing
}

export type VerificationStatus = '' | 'pending' | 'correct' | 'wrong'

export interface ChatMessage {
  id: string
  office_id: string
  service_id: string
  conversation_id: string
  user_id: string
  user_name: string
  role: 'user' | 'assistant'
  text: string
  cards: Card[]
  tool_calls: ToolCall[]
  usage: Usage
  cost: Cost
  latency_ms: number
  first_token_ms: number
  model: string
  category: string
  guard_hits: number
  error?: string
  aborted?: boolean
  verification_status: VerificationStatus
  created_at: string
}

export interface Conversation {
  id: string
  office_id: string
  service_id: string
  kind: string
  user_id: string
  user_name: string
  title: string
  message_count: number
  opened_at: string
  last_message_at: string
  closed_at?: string
  closed_reason?: string
  created_at: string
}

export interface ConversationView {
  conversation: Conversation
  messages: ChatMessage[]
}

// ---------------------------------------------------------------------------
// K3 — ตรวจคำตอบ
// ---------------------------------------------------------------------------

export type VerificationErrorType = 'wrong_number' | 'wrong_question' | 'wrong_menu' | 'should_refuse' | 'should_answer'

export interface Verification {
  id: string
  office_id: string
  service_id: string
  message_id: string
  conversation_id: string
  status: 'correct' | 'wrong'
  error_type: VerificationErrorType | ''
  correct_answer: string
  note: string
  verified_by: string
  verified_at: string
  created_at: string
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
  office_id: string
  service_id: string
}

// ---------------------------------------------------------------------------
// K4 — โควตา/ต้นทุน
// ---------------------------------------------------------------------------

export interface QuotaStatus {
  office_id: string
  service_id: string
  service_label: string
  period: string
  limit: number
  used_tokens: number
  used_questions: number
  percent: number
  cost_amount: number
  currency: string
  cut: boolean
  temp_increases: TempIncrease[]
}

export interface DailyRollup {
  id: string
  office_id: string
  service_id: string
  date: string
  conversations: number
  questions: number
  tokens_in: number
  tokens_out: number
  cost_amount: number
  latency_sum_ms: number
  latency_buckets: Record<string, number>
  refusals: number
  tool_errors: number
  guard_hits: number
  correct: number
  wrong: number
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// K5 — ลบตามคำขอ (PDPA) + บันทึกการเข้าถึง
// ---------------------------------------------------------------------------

export interface DeletionScope {
  office_id: string
  service_id: string
  user_id: string
  from?: string
  to?: string
}

export interface DeletionResult {
  messages: number
  conversations: number
  verifications: number
}

export interface DeletionRequest {
  id: string
  office_id: string
  service_id: string
  scope: DeletionScope
  reason: string
  requested_by: string
  approved_by: string
  status: 'running' | 'done' | 'failed'
  result: DeletionResult
  error?: string
  created_at: string
  completed_at?: string
}

export interface AccessLog {
  id: string
  operator: string
  action: string
  office_id: string
  service_id: string
  conversation_id: string
  message_id: string
  detail: string
  at: string
  created_at: string
}

// ---------------------------------------------------------------------------
// settings ระดับระบบ (K1)
// ---------------------------------------------------------------------------

export interface TelegramRooms {
  alerts: string
  contract_tests: string
}

export interface Settings {
  model: string
  max_concurrent: number
  ticket_ttl_min: number
  default_monthly_limit: number
  support_message: string
  telegram_rooms: TelegramRooms
  pricing: Pricing
  llm_timeout_sec: number
  max_output_tokens: number
  history_turns: number
  tool_timeout_ms: number
  effort: '' | 'low' | 'medium' | 'high'
  updated_at: string
  updated_by: string
}

export type SettingsPatch = Partial<
  Omit<Settings, 'updated_at' | 'updated_by'>
>

export interface ApiResponse<T> {
  code: number
  message: string
  error: string
  payload: T
}

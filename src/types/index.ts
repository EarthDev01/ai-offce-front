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
  Pick<Office, 'label' | 'allowed_origins' | 'backoffice_api_url' | 'enabled' | 'is_hidden' | 'theme' | 'placement'>
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

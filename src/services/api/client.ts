import type { ApiResponse } from '@/types'

export const API_BASE = import.meta.env.VITE_AI_API_BASE ?? 'http://localhost:6767'

const TOKEN_KEY = 'ai_office_console_token'

export function getConsoleToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setConsoleToken(v: string) {
  try {
    localStorage.setItem(TOKEN_KEY, v)
  } catch {
    /* private mode — ยอมให้ใช้งานต่อได้ในรอบนี้ */
  }
}

export class ApiError extends Error {}

/**
 * คอนโซลนี้อ่านข้ามทุกเว็บ จึงใช้ auth คนละชุดกับแอดมินเว็บ
 * ██ รอบนี้เป็น static token · ของจริงต้องเป็น JWT (02-SPEC §6)
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getConsoleToken()}`,
      ...(init.headers ?? {}),
    },
  })

  let json: ApiResponse<T> | null = null
  try {
    json = (await res.json()) as ApiResponse<T>
  } catch {
    /* ปล่อยให้ตกไปที่ error ข้างล่าง */
  }

  if (!res.ok) {
    if (res.status === 401) throw new ApiError('console token ไม่ถูกต้อง — ใส่ token ที่มุมขวาบนก่อน')
    throw new ApiError(json?.error || `เรียก API ไม่สำเร็จ (${res.status})`)
  }
  if (!json) throw new ApiError('เซิร์ฟเวอร์ตอบกลับมาในรูปแบบที่อ่านไม่ได้')
  return json.payload
}

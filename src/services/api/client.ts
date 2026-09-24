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

// 401 ที่เป็น business-logic error (เช่น รหัสผ่าน/2FA ผิด) ไม่ใช่ session/token หมดอายุ
// อย่า clear token + redirect ในเคสพวกนี้ — ปล่อยให้ component ที่เรียกจัดการ error เอง
const BUSINESS_401_CODES = ['INVALID_CREDENTIALS', 'INVALID_2FA', 'INVALID_TICKET', 'INVALID_PASSWORD']

/**
 * คอนโซลนี้อ่านข้ามทุกเว็บ จึงใช้ auth คนละชุดกับแอดมินเว็บ
 * ██ รอบนี้เป็น static token · ของจริงต้องเป็น JWT (02-SPEC §6)
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // จำไว้ก่อนยิง — ถ้ามี token อยู่แล้วโดน 401 แปลว่า token หมดอายุ/ไม่ถูกต้อง
  // (ถ้ายังไม่มี token เช่นตอน login/verify ยังไม่สำเร็จ 401 คือ credential ผิด ไม่ใช่ session หมด)
  const hadToken = !!getConsoleToken()

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
    if (res.status === 401) {
      const isBusinessError = !!json?.error && BUSINESS_401_CODES.includes(json.error)
      if (hadToken && !isBusinessError) {
        setConsoleToken('')
        // token หมดอายุกลางคัน — เตะกลับ login แหล่งเดียว พร้อมเก็บ redirect ไว้
        // (กัน race กับ router guard ที่จะ redirect ซ้ำแล้วทำ ?redirect= หาย:
        //  hard-nav นี้ reload ทั้งแอป guard เลยไม่ได้ทำงานต่อ แต่ query ยังอยู่ครบ)
        if (typeof location !== 'undefined' && location.pathname !== '/login') {
          const here = location.pathname + location.search
          location.assign(`/login?redirect=${encodeURIComponent(here)}`)
        }
      }
      throw new ApiError(json?.error || 'ไม่ได้รับอนุญาต (401) — กรุณาเข้าสู่ระบบใหม่')
    }
    throw new ApiError(json?.error || `เรียก API ไม่สำเร็จ (${res.status})`)
  }
  if (!json) throw new ApiError('เซิร์ฟเวอร์ตอบกลับมาในรูปแบบที่อ่านไม่ได้')
  return json.payload
}

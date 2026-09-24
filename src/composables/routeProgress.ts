import { ref } from 'vue'

/**
 * แถบ progress ตอนเปลี่ยน route — คลุมช่วงที่ guard ทำงาน async (เช็ค status / loadMe)
 * และช่วงโหลด chunk ของหน้า เพื่อไม่ให้จอว่างวูบ/กระพริบ
 */
export const progress = ref(0) // 0–100
export const active = ref(false)

let trickle: ReturnType<typeof setInterval> | undefined
let resetTimer: ReturnType<typeof setTimeout> | undefined

export function startProgress() {
  clearInterval(trickle)
  clearTimeout(resetTimer)
  active.value = true
  if (progress.value < 8) progress.value = 8
  // ไต่เข้าหา 90% แบบ ease — ยังไม่ถึง 100 จนกว่าจะ done
  trickle = setInterval(() => {
    if (progress.value < 90) progress.value += (90 - progress.value) * 0.14
  }, 160)
}

export function doneProgress() {
  clearInterval(trickle)
  progress.value = 100
  // เต็มแล้วค่อย fade ออก แล้วรีเซ็ตเงียบ ๆ
  resetTimer = setTimeout(() => {
    active.value = false
    resetTimer = setTimeout(() => {
      progress.value = 0
    }, 260)
  }, 160)
}

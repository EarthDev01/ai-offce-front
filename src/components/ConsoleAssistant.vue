<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { API_BASE, getConsoleToken } from '@/services/api/client'
import { ASSISTANT_CHANGED, getAssistantStatus } from '@/services/api/assistant'

/**
 * ปุ่มผู้ช่วย AI ในคอนโซล — ใช้ bundle widget ตัวจริง (UI ชุดเดียวกับที่ลูกค้าเห็น) ในโหมดคอนโซล
 *
 * โหลด script แยก id จาก preview — bundle แต่ละครั้งที่โหลดมี state ของตัวเอง จึงอยู่หน้าเดียวกันได้
 * token ส่งผ่าน callback ตอน mount (ไม่ใส่ใน DOM) และอ่านสดทุกครั้งที่ถาม
 */
const SCRIPT_ID = 'ai-office-console-assistant'
const route = useRoute()

type ConsoleAPI = {
  mount: (o: { getToken: () => string; getPage: () => string }) => Promise<void>
  unmount: () => void
}

let mounted = false

function api(): ConsoleAPI | undefined {
  return (window as unknown as { __aiOfficeConsole?: ConsoleAPI }).__aiOfficeConsole
}

function show() {
  if (mounted) return
  mounted = true
  const start = () => void api()?.mount({ getToken: getConsoleToken, getPage: () => route.fullPath })
  if (api()) return start()
  const s = document.createElement('script')
  s.id = SCRIPT_ID
  s.src = `${API_BASE}/widget/v1/ai-office.js`
  s.dataset.consoleMode = ''
  s.onload = start
  s.onerror = () => {
    mounted = false
    console.warn('[ai-office] โหลดผู้ช่วยคอนโซลไม่ได้ — หลังบ้าน ai ทำงานอยู่ไหม')
  }
  document.head.appendChild(s)
}

function hide() {
  if (!mounted) return
  mounted = false
  api()?.unmount()
}

async function refresh() {
  try {
    const st = await getAssistantStatus()
    if (st.enabled && st.ready) show()
    else hide()
  } catch {
    hide()
  }
}

onMounted(() => {
  void refresh()
  window.addEventListener(ASSISTANT_CHANGED, refresh)
})
onBeforeUnmount(() => {
  window.removeEventListener(ASSISTANT_CHANGED, refresh)
  hide()
})
// เปลี่ยนหน้า = เช็กสถานะใหม่ (มีคนเปิด/ปิดในตั้งค่าระบบ หรือ key เปลี่ยน)
watch(() => route.path, () => void refresh())
</script>

<template>
  <span hidden />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { API_BASE } from '@/services/api/client'
import type { Office, Service } from '@/types'

const props = defineProps<{ office: Office; service: Service | null }>()

const SCRIPT_ID = 'ai-office-widget-preview'

/**
 * preview ต้องโหลด "bundle ตัวจริง" ไม่ใช่เขียน UI จำลองขึ้นใหม่ในนี้
 *
 * ถ้าเขียนใหม่จะกลายเป็น 2 แหล่งความจริง — แก้สี/ระยะที่ widget แล้วลืมแก้ที่นี่
 * คนตั้งค่าจะเห็นไม่ตรงกับที่ลูกค้าได้จริง (04-SPEC §6)
 */
function pushConfig() {
  const p = props.office.placement
  // ██ ต้องเป็น plain object — postMessage clone Vue reactive proxy ไม่ได้ (DataCloneError)
  const config = {
    // หน้าตาระดับ service
    display_name: props.service?.display_name ?? '',
    greeting: props.service?.greeting ?? '',
    avatar_url: props.service?.avatar_url ?? '',
    service_label: props.service?.label ?? '',
    // หน้าตาระดับ office (เหมือนกันทุก service เพราะเป็นหลังบ้านชุดเดียวกัน)
    theme: props.office.theme,
    placement: { position: p.position, offset_x: p.offset_x, offset_y: p.offset_y },
    is_hidden: props.office.is_hidden,
  }
  window.postMessage({ type: 'ai-office:preview-config', config }, window.location.origin)
}

onMounted(() => {
  document.getElementById(SCRIPT_ID)?.remove()

  const s = document.createElement('script')
  s.id = SCRIPT_ID
  // bundle ชุดเดียวกับที่ officeลูกค้า โหลด — โหมด preview ไม่ยิง API อยู่แล้ว
  s.src = `${API_BASE}/widget/v1/ai-office.js`
  s.dataset.previewMount = '#widget-preview'
  s.onload = () => pushConfig()
  s.onerror = () => {
    const box = document.getElementById('widget-preview')
    if (box) box.textContent = 'โหลด widget ไม่ได้ — หลังบ้าน ai ทำงานอยู่ไหม และ build widget แล้วหรือยัง'
  }
  document.head.appendChild(s)
})

onBeforeUnmount(() => document.getElementById(SCRIPT_ID)?.remove())

watch(() => [props.office, props.service], pushConfig, { deep: true })
</script>

<template>
  <div class="wrap">
    <div class="frame">
      <div class="bar">
        <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="bar-label">ตัวอย่างที่ผู้ใช้เห็น</span>
        <span class="note mono">bundle จริง</span>
      </div>
      <div id="widget-preview" class="box"></div>
    </div>
    <div class="foot">
      ชื่อ คำทักทาย และรูป มาจาก <strong>service</strong> — ตำแหน่งและธีมมาจาก <strong>office</strong>
    </div>
  </div>
</template>

<style scoped>
.wrap { position: sticky; top: 76px; }
.frame { border: 1px solid var(--line); border-radius: var(--r-card); background: var(--surface); overflow: hidden; box-shadow: var(--shadow-raise); }
.bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, #f6f8f7, var(--surface)); }
.dots { display: inline-flex; gap: 5px; }
.dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--line); }
.bar-label { font-size: 12.5px; font-weight: 600; color: var(--ink); }
.note { font-size: 10.5px; color: var(--muted); margin-left: auto; padding: 2px 7px; border: 1px solid var(--line); border-radius: 999px; }
.box {
  /* สูงตามจอ (กล่องนี้ sticky — ต้องไม่ล้นจอ) · แผงแชทจริงสูง 560 + ปุ่มลอย จึงให้ถึง ~760 */
  position: relative; height: clamp(512px, calc(100vh - 190px), 760px); overflow: hidden;
  background:
    radial-gradient(circle at 1px 1px, rgba(19, 40, 43, 0.05) 1px, transparent 0) 0 0 / 18px 18px,
    var(--ground);
}
.foot { font-size: 11.5px; color: var(--muted); margin-top: 10px; line-height: 1.6; }
</style>

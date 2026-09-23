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
  window.postMessage(
    {
      type: 'ai-office:preview-config',
      config: {
        // หน้าตาระดับ service
        display_name: props.service?.display_name ?? '',
        greeting: props.service?.greeting ?? '',
        avatar_url: props.service?.avatar_url ?? '',
        service_label: props.service?.label ?? '',
        // หน้าตาระดับ office (เหมือนกันทุก service เพราะเป็นหลังบ้านชุดเดียวกัน)
        theme: props.office.theme,
        placement: props.office.placement,
        is_hidden: props.office.is_hidden,
      },
    },
    window.location.origin,
  )
}

onMounted(() => {
  document.getElementById(SCRIPT_ID)?.remove()

  const s = document.createElement('script')
  s.id = SCRIPT_ID
  // ใช้ key จริงของ office ที่กำลังตั้งค่า — โหมด preview ไม่ยิง API อยู่แล้ว
  s.src = `${API_BASE}/widget/v1/${encodeURIComponent(props.office.public_key)}/ai-office.js`
  s.dataset.previewMount = '#widget-preview'
  s.onload = () => pushConfig()
  s.onerror = () => {
    const box = document.getElementById('widget-preview')
    if (box) box.textContent = 'โหลด widget ไม่ได้ — backend ทำงานอยู่ไหม และ build widget แล้วหรือยัง'
  }
  document.head.appendChild(s)
})

onBeforeUnmount(() => document.getElementById(SCRIPT_ID)?.remove())

watch(() => [props.office, props.service], pushConfig, { deep: true })
</script>

<template>
  <div class="wrap">
    <div class="label">
      ตัวอย่างที่ผู้ใช้เห็น <span class="note">— โหลดจาก bundle ตัวจริง</span>
    </div>
    <div id="widget-preview" class="box"></div>
    <div class="foot">
      หน้าตาส่วนชื่อ/คำทักทาย/รูป มาจาก <strong>service</strong> · ตำแหน่งและธีมมาจาก <strong>office</strong>
    </div>
  </div>
</template>

<style scoped>
.wrap { position: sticky; top: 22px; }
.label { font-size: 12.5px; color: var(--muted); margin-bottom: 8px; }
.note { font-family: var(--font-mono); font-size: 11px; }
.box { position: relative; height: 520px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); overflow: hidden; }
.foot { font-size: 11.5px; color: var(--muted); margin-top: 8px; line-height: 1.6; }
</style>

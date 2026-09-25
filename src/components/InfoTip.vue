<script setup lang="ts">
// ไอคอน "!" วางต่อท้ายป้ายชื่อช่อง · ชี้แล้วโชว์คำอธิบาย (ใส่ผ่าน slot ได้ทั้งข้อความและ HTML)
defineProps<{ text?: string }>()
</script>

<template>
  <a-tooltip placement="topLeft" :overlay-style="{ maxWidth: '320px' }">
    <template #title><slot>{{ text }}</slot></template>
    <span class="info-tip" tabindex="0" role="img" aria-label="คำอธิบาย">
      <!-- วาดเป็น SVG ให้ "!" อยู่กลางวงกลมพอดีทุกฟอนต์ -->
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.3" />
        <line x1="8" y1="4.4" x2="8" y2="9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        <circle cx="8" cy="11.4" r="0.95" fill="currentColor" />
      </svg>
    </span>
  </a-tooltip>
</template>

<style scoped>
.info-tip {
  display: inline-flex; align-items: center; justify-content: center;
  margin-left: 6px; color: var(--muted); cursor: help; border-radius: 50%;
  transition: color .15s;
}
.info-tip:hover, .info-tip:focus-visible { color: var(--accent); outline: none; }
</style>

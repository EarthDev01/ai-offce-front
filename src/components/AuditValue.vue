<script setup lang="ts">
import { computed } from 'vue'
import { PERMISSION_LABELS, friendlyValue } from '@/utils/auditLabels'

/**
 * แสดงค่าก่อน/หลังของ 1 field ในประวัติ
 * - ว่าง → "—" · list → chip ทีละตัว · bool/สถานะ/ธีม → คำไทย · object อื่น → JSON
 * - highlight = ตัวที่อยู่ฝั่งเดียว (เพิ่มเข้า/ถูกเอาออก) เวลาเทียบ list สองฝั่ง
 */
const props = defineProps<{
  field: string
  value: unknown
  other?: unknown // ค่าอีกฝั่ง ไว้หาว่า item ไหนใน list เพิ่ม/หาย
  side?: 'before' | 'after'
  permissions?: boolean // list นี้เป็น permission key → แสดงชื่อไทย
}>()

const isEmpty = computed(() => {
  const v = props.value
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
})

const list = computed(() => (Array.isArray(props.value) ? props.value.map((x) => String(x)) : null))
const otherSet = computed(() => new Set(Array.isArray(props.other) ? props.other.map((x) => String(x)) : []))

function chipLabel(item: string) {
  return props.permissions ? (PERMISSION_LABELS[item] ?? item) : item
}

const friendly = computed(() => friendlyValue(props.field, props.value))
const json = computed(() => JSON.stringify(props.value, null, 2))
</script>

<template>
  <span v-if="isEmpty" class="empty">—</span>
  <span v-else-if="list" class="chips">
    <span
      v-for="item in list"
      :key="item"
      class="chip"
      :class="{ added: side === 'after' && !otherSet.has(item), removed: side === 'before' && !otherSet.has(item) }"
      :title="item"
    >{{ chipLabel(item) }}</span>
  </span>
  <span v-else-if="friendly !== null" class="text">{{ friendly }}</span>
  <pre v-else class="json">{{ json }}</pre>
</template>

<style scoped>
.empty { color: var(--muted); }
.text { white-space: pre-wrap; word-break: break-word; }
.chips { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.chip {
  display: inline-block; padding: 0 7px; border-radius: var(--r-tag); font-size: 12px; line-height: 20px;
  background: var(--ground); border: 1px solid var(--line); color: var(--ink);
}
.chip.added { background: #e8f5ec; border-color: #b7e0c3; color: #1f6b36; }
.chip.removed { background: #fbecea; border-color: #f0c6c1; color: var(--danger); text-decoration: line-through; }
.json {
  margin: 0; font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap; word-break: break-all;
  background: var(--ground); padding: 6px 8px; border-radius: 6px;
}
</style>

<script setup lang="ts">
import type { ChatCard } from '@/types'

defineProps<{ card: ChatCard }>()

const KIND: Record<string, { label: string; color: string }> = {
  ok: { label: 'ข้อมูล', color: 'green' },
  not_found: { label: 'ไม่พบ', color: 'default' },
  denied: { label: 'ไม่มีสิทธิ์', color: 'red' },
  error: { label: 'ดึงไม่สำเร็จ', color: 'red' },
  reference: { label: 'อ้างอิงเมนู', color: 'blue' },
}

function fmt(v?: string) {
  return v ? new Date(v).toLocaleString('th-TH') : '—'
}
</script>

<template>
  <!-- ค่าจากหลังบ้านลงด้วย text interpolation ทั้งหมด ไม่ใช้ v-html -->
  <div class="card-box" :class="`k-${card.kind}`">
    <div class="card-head">
      <strong>{{ card.title }}</strong>
      <a-tag :color="KIND[card.kind]?.color ?? 'default'">{{ KIND[card.kind]?.label ?? card.kind }}</a-tag>
      <span v-if="card.cached" class="hint">(cache)</span>
    </div>
    <div v-if="card.fields?.length" class="fields">
      <template v-for="f in card.fields" :key="f.label">
        <span class="hint">{{ f.label }}</span>
        <span class="val">{{ f.display }}</span>
      </template>
    </div>
    <div v-if="card.table && card.table.rows.length" class="table-wrap">
      <table>
        <thead>
          <tr><th v-for="col in card.table.columns" :key="col.label">{{ col.label }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in card.table.rows" :key="i">
            <td v-for="(cell, j) in row" :key="j">{{ cell.display }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="card.note" class="note">{{ card.note }}</div>
    <div class="hint">
      ดึงเมื่อ {{ fmt(card.fetched_at) }}
      <template v-if="card.link"> · หน้าในหลังบ้าน <code>{{ card.link.path }}</code></template>
    </div>
  </div>
</template>

<style scoped>
.card-box { border: 1px solid var(--line); border-radius: var(--r-control); padding: 10px 12px; margin-bottom: 8px; background: var(--ground); }
.card-box.k-denied, .card-box.k-error { border-color: var(--danger); }
.card-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.fields { display: grid; grid-template-columns: auto 1fr; gap: 2px 14px; font-size: 12.5px; margin-bottom: 4px; }
.val { font-family: var(--font-mono); word-break: break-word; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 6px 0; }
th, td { border: 1px solid var(--line); padding: 4px 8px; text-align: left; white-space: nowrap; }
th { color: var(--muted); font-weight: 500; }
.note { font-size: 12.5px; margin: 4px 0; }
.hint { font-size: 12px; color: var(--muted); }
</style>

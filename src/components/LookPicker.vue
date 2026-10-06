<script setup lang="ts">
// เลือกรูป/พื้นหลังของ widget จากคลังรูปของระบบ AI
// ค่าที่ได้: random (สุ่มจากคลังทุกครั้งที่ widget โหลด) | asset:<ไฟล์> | pattern:<id> · ว่าง (ค่าเก่า) แสดงเป็น "สุ่ม"
import { computed } from 'vue'
import { API_BASE } from '@/services/api/client'

const props = defineProps<{
  modelValue?: string
  /** ตัวเลือกจากคลัง (asset:… / pattern:…) */
  options: string[]
  /** avatar = วงกลม · background = สี่เหลี่ยม */
  shape: 'avatar' | 'background'
  /** สีแรกของ widget — ใช้วาดตัวอย่างลาย / ย้อมสีตัวอย่างปุ่ม */
  accent?: string
  /** false = ไม่มีตัวเลือก "สุ่ม" (ค่าว่าง = ตัวเลือกแรก) */
  random?: boolean
  /** ย้อมสีรูปตัวอย่างด้วย accent (รูปปุ่มเปิดแชท) */
  tint?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const PATTERN_NAMES: Record<string, string> = { dots: 'จุด', grid: 'ตาราง', diagonal: 'เส้นเฉียง', glow: 'แสงมุม' }

const allowRandom = computed(() => props.random !== false)
const current = computed(() => props.modelValue || (allowRandom.value ? 'random' : props.options[0] ?? ''))
// ค่าที่เคยบันทึกไว้แต่ไม่อยู่ในคลังแล้ว (ลิงก์รูปเอง / ลายที่เลิกให้เลือก) — โชว์ไว้ให้รู้ว่าใช้อะไรอยู่
const legacy = computed(() => (current.value && current.value !== 'random' && !props.options.includes(current.value) ? current.value : ''))

function src(v: string) {
  return v.startsWith('asset:') ? `${API_BASE}/widget/v1/assets/${v.slice(6)}` : v
}
function label(v: string) {
  if (v.startsWith('pattern:')) return PATTERN_NAMES[v.slice(8)] ?? v.slice(8)
  return v.slice(v.lastIndexOf('/') + 1).replace(/\.[a-z]+$/i, '')
}
// ลายเดียวกับที่ widget วาด (styles.ts .log[data-bg]) — ย่อขนาดไว้โชว์ในช่องเลือก
function patternStyle(v: string) {
  const soft = (props.accent || '#0f6e63') + '40'
  switch (v.slice(8)) {
    case 'dots': return { backgroundImage: `radial-gradient(${soft} 1.6px, transparent 1.8px)`, backgroundSize: '10px 10px' }
    case 'grid': return { backgroundImage: `linear-gradient(${soft} 1px, transparent 1px),linear-gradient(90deg, ${soft} 1px, transparent 1px)`, backgroundSize: '12px 12px' }
    case 'diagonal': return { backgroundImage: `repeating-linear-gradient(135deg, ${soft} 0 2px, transparent 2px 9px)` }
    case 'glow': return { backgroundImage: `radial-gradient(90% 55% at 0% 0%, ${soft}, transparent 70%),radial-gradient(90% 55% at 100% 100%, ${soft}, transparent 70%)` }
  }
  return {}
}
const pick = (v: string) => emit('update:modelValue', v)
</script>

<template>
  <div class="look-picker" :class="shape">
    <button v-if="allowRandom" type="button" class="tile" :class="{ on: current === 'random' }" title="สุ่มจากคลังรูปทุกครั้งที่เปิดหน้า" @click="pick('random')">
      <span class="thumb dice" aria-hidden="true">🎲</span>
      <span class="cap">สุ่ม</span>
    </button>
    <button v-for="v in options" :key="v" type="button" class="tile" :class="{ on: current === v }" :title="label(v)" @click="pick(v)">
      <span v-if="v.startsWith('pattern:')" class="thumb" :style="patternStyle(v)" />
      <span v-else-if="tint" class="thumb tinted" :style="{ '--img': `url(&quot;${src(v)}&quot;)`, '--tint': accent || '#0f6e63' }">
        <img :src="src(v)" alt="" referrerpolicy="no-referrer" /><span class="tint" />
      </span>
      <img v-else class="thumb" :src="src(v)" alt="" referrerpolicy="no-referrer" />
      <span class="cap">{{ label(v) }}</span>
    </button>
    <button v-if="legacy" type="button" class="tile on" title="ค่าที่ตั้งไว้ก่อนหน้า (ไม่อยู่ในคลังแล้ว)">
      <span v-if="legacy.startsWith('pattern:')" class="thumb" :style="patternStyle(legacy)" />
      <img v-else class="thumb" :src="src(legacy)" alt="" referrerpolicy="no-referrer" />
      <span class="cap">ค่าเดิม</span>
    </button>
  </div>
  <p v-if="!options.length" class="look-empty">ยังไม่มีรูปในคลัง — ให้ทีมเพิ่มรูปใน ai-office-backend <code>static/widget/assets</code></p>
</template>

<style scoped>
.look-picker { display: flex; flex-wrap: wrap; gap: 8px; }
.tile {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  width: 72px; padding: 6px 4px; border: 1px solid var(--line); border-radius: 10px;
  background: var(--surface); cursor: pointer; font: inherit; color: var(--ink-2);
}
.tile.on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft, rgba(15, 110, 99, .2)); }
.thumb { width: 56px; height: 44px; border-radius: 6px; object-fit: cover; background: var(--surface-2, #eef1f0); display: block; }
.avatar .thumb { width: 44px; height: 44px; border-radius: 50%; }
.dice { display: grid; place-items: center; font-size: 22px; }
/* ตัวอย่างปุ่มฟองแชท — ย้อมสีแบบเดียวกับ widget (styles.ts .licon) */
.tinted { position: relative; background: none; }
.tinted img { width: 100%; height: 100%; object-fit: contain; display: block; }
.tinted .tint { position: absolute; inset: 0; background: var(--tint); mix-blend-mode: color; -webkit-mask: var(--img) center/contain no-repeat; mask: var(--img) center/contain no-repeat; }
.cap { font-size: 11px; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.look-empty { font-size: 12px; color: var(--muted); margin: 6px 0 0; line-height: 1.6; }
</style>

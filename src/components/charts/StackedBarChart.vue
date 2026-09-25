<script setup lang="ts">
import { computed, ref } from 'vue'
import { fmtCompact, fmtFull } from '@/utils/chartPalette'

export interface Series {
  key: string
  label: string
  color: string
}

const props = defineProps<{
  /** แกน X — วันที่ YYYY-MM-DD เรียงเก่า→ใหม่ */
  days: string[]
  series: Series[]
  /** values[day][seriesKey] */
  values: Record<string, Record<string, number>>
  unit: string
}>()

const W = 640
const H = 240
const PAD = { top: 12, right: 8, bottom: 26, left: 44 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom
const GAP = 2 // ช่องว่างสีพื้นระหว่างชั้นของแท่งซ้อน

const totals = computed(() => props.days.map((d) => props.series.reduce((a, s) => a + (props.values[d]?.[s.key] ?? 0), 0)))

// สเกลแกน Y ปัดขึ้นเป็นเลขกลม ๆ · 4 เส้นอ้างอิง
const yMax = computed(() => {
  const m = Math.max(0, ...totals.value)
  if (m === 0) return 1
  const step = Math.pow(10, Math.floor(Math.log10(m)))
  const nice = [1, 2, 2.5, 5, 10].map((f) => f * step).find((v) => v * 4 >= m) ?? 10 * step
  return nice * 4
})
const ticks = computed(() => [0, 1, 2, 3, 4].map((i) => (yMax.value / 4) * i))
const y = (v: number) => PAD.top + plotH - (v / yMax.value) * plotH

const band = computed(() => plotW / Math.max(1, props.days.length))
const barW = computed(() => Math.min(24, band.value * 0.7))
const barX = (i: number) => PAD.left + band.value * i + (band.value - barW.value) / 2

// ป้ายวันที่ไม่ให้ชนกัน — แสดงทุก n วัน
const labelEvery = computed(() => Math.max(1, Math.ceil(props.days.length / 8)))
const dayLabel = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`

// ชั้นของแต่ละแท่ง: ล่างสุด = series แรก · มุมมนเฉพาะปลายบนสุด 4px ฐานเหลี่ยม
function segments(i: number) {
  const d = props.days[i]
  let acc = 0
  const segs: { key: string; color: string; y: number; h: number }[] = []
  for (const s of props.series) {
    const v = props.values[d]?.[s.key] ?? 0
    if (v <= 0) continue
    const top = y(acc + v)
    const bottom = y(acc)
    segs.push({ key: s.key, color: s.color, y: top, h: bottom - top })
    acc += v
  }
  return segs.map((sg, j) => ({ ...sg, h: j < segs.length - 1 ? Math.max(0, sg.h - GAP) : sg.h, last: j === segs.length - 1 }))
}

function barPath(x: number, yTop: number, w: number, h: number, round: boolean) {
  const r = round ? Math.min(4, w / 2, h) : 0
  const b = yTop + h
  return `M${x},${b} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + w - r} Q${x + w},${yTop} ${x + w},${yTop + r} V${b} Z`
}

// ---------- tooltip ----------
const hover = ref<number | null>(null)
const tipStyle = ref<Record<string, string>>({})
const wrap = ref<HTMLElement | null>(null)

function onEnter(i: number, ev: PointerEvent | FocusEvent) {
  hover.value = i
  const box = wrap.value?.getBoundingClientRect()
  const x = 'clientX' in ev && box ? ev.clientX - box.left : ((barX(i) + barW.value / 2) / W) * (box?.width ?? W)
  const left = Math.min(Math.max(8, x + 12), (box?.width ?? W) - 200)
  tipStyle.value = { left: `${left}px`, top: '8px' }
}

const tipRows = computed(() => {
  if (hover.value === null) return []
  const d = props.days[hover.value]
  return props.series
    .map((s) => ({ ...s, v: props.values[d]?.[s.key] ?? 0 }))
    .filter((r) => r.v > 0)
    .reverse() // บนลงล่างตามลำดับในแท่ง
})
</script>

<template>
  <div ref="wrap" class="chart" @pointerleave="hover = null">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`กราฟแท่งซ้อน ${unit} ต่อวัน`">
      <g class="grid">
        <template v-for="t in ticks" :key="t">
          <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(t)" :y2="y(t)" />
          <text :x="PAD.left - 6" :y="y(t) + 4" text-anchor="end">{{ fmtCompact(t) }}</text>
        </template>
      </g>
      <g v-for="(d, i) in days" :key="d">
        <path
          v-for="sg in segments(i)"
          :key="sg.key"
          :d="barPath(barX(i), sg.y, barW, sg.h, sg.last)"
          :fill="sg.color"
          :opacity="hover === null || hover === i ? 1 : 0.45"
        />
        <text v-if="i % labelEvery === 0" class="xlab" :x="barX(i) + barW / 2" :y="H - 8" text-anchor="middle">{{ dayLabel(d) }}</text>
        <!-- พื้นที่ชี้ = ทั้งคอลัมน์ของวันนั้น ใหญ่กว่าแท่ง -->
        <rect
          class="hit"
          :x="PAD.left + band * i"
          :y="PAD.top"
          :width="band"
          :height="plotH"
          tabindex="0"
          :aria-label="`${d} รวม ${fmtFull(totals[i])} ${unit}`"
          @pointermove="onEnter(i, $event)"
          @focus="onEnter(i, $event)"
          @blur="hover = null"
        />
      </g>
    </svg>
    <div v-if="hover !== null" class="tip" :style="tipStyle">
      <div class="tip-head">{{ days[hover] }}</div>
      <div v-for="r in tipRows" :key="r.key" class="tip-row">
        <i :style="{ background: r.color }"></i><strong>{{ fmtFull(r.v) }}</strong><span>{{ r.label }}</span>
      </div>
      <div class="tip-total"><strong>{{ fmtFull(totals[hover]) }}</strong> {{ unit }} รวม</div>
    </div>
    <div v-if="series.length > 1" class="legend">
      <span v-for="s in series" :key="s.key"><i :style="{ background: s.color }"></i>{{ s.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.chart { position: relative; }
svg { width: 100%; height: auto; display: block; }
.grid line { stroke: var(--line); stroke-width: 1; }
.grid text, .xlab { font-size: 10.5px; fill: var(--muted); font-family: var(--font-mono); }
.hit { fill: transparent; cursor: default; outline: none; }
.hit:focus-visible { stroke: var(--accent); stroke-width: 1.5; }
.tip {
  position: absolute; z-index: 5; pointer-events: none; min-width: 170px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px;
  box-shadow: 0 4px 14px rgba(19, 40, 43, .12); font-size: 12px; color: var(--ink);
}
.tip-head { font-family: var(--font-mono); color: var(--muted); margin-bottom: 4px; }
.tip-row { display: flex; align-items: center; gap: 6px; line-height: 1.7; }
.tip-row i { width: 10px; height: 2px; border-radius: 1px; flex: none; }
.tip-row strong { font-family: var(--font-mono); min-width: 56px; text-align: right; }
.tip-row span { color: var(--muted); }
.tip-total { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--line); color: var(--muted); }
.tip-total strong { color: var(--ink); font-family: var(--font-mono); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: 12px; color: var(--ink); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
</style>

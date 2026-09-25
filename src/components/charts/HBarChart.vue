<script setup lang="ts">
import { computed, ref } from 'vue'
import { fmtCompact, fmtFull } from '@/utils/chartPalette'

export interface HBarItem {
  key: string
  label: string
  color: string
  value: number
  /** บรรทัดเสริมใน tooltip */
  detail?: string
}

const props = defineProps<{ items: HBarItem[]; unit: string }>()

const ROW = 34
const BAR = 20 // ≤ 24px
const LABEL_W = 150
const VALUE_W = 60
const W = 480

const sorted = computed(() => [...props.items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value))
const max = computed(() => Math.max(1, ...sorted.value.map((i) => i.value)))
const H = computed(() => sorted.value.length * ROW + 4)
const plotW = W - LABEL_W - VALUE_W
const w = (v: number) => Math.max(2, (v / max.value) * plotW)

function barPath(x: number, yTop: number, width: number, h: number) {
  const r = Math.min(4, width / 2)
  return `M${x},${yTop} H${x + width - r} Q${x + width},${yTop} ${x + width},${yTop + r} V${yTop + h - r} Q${x + width},${yTop + h} ${x + width - r},${yTop + h} H${x} Z`
}

const hover = ref<string | null>(null)
const tipStyle = ref<Record<string, string>>({})
const wrap = ref<HTMLElement | null>(null)

function onEnter(it: HBarItem, idx: number, ev: PointerEvent | FocusEvent) {
  hover.value = it.key
  const box = wrap.value?.getBoundingClientRect()
  const x = 'clientX' in ev && box ? ev.clientX - box.left : (box?.width ?? W) / 2
  const topPx = ((idx * ROW) / H.value) * (box?.height ?? H.value) + 28
  tipStyle.value = { left: `${Math.min(Math.max(8, x + 12), (box?.width ?? W) - 200)}px`, top: `${topPx}px` }
}

const hovered = computed(() => sorted.value.find((i) => i.key === hover.value) ?? null)
const truncate = (s: string) => (s.length > 20 ? s.slice(0, 19) + '…' : s)
</script>

<template>
  <div ref="wrap" class="chart" @pointerleave="hover = null">
    <svg v-if="sorted.length" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`กราฟแท่งแนวนอน ${unit} ต่อเว็บ`">
      <g v-for="(it, idx) in sorted" :key="it.key">
        <text class="lab" :x="LABEL_W - 8" :y="idx * ROW + ROW / 2 + 4" text-anchor="end">{{ truncate(it.label) }}</text>
        <path
          :d="barPath(LABEL_W, idx * ROW + (ROW - BAR) / 2, w(it.value), BAR)"
          :fill="it.color"
          :opacity="hover === null || hover === it.key ? 1 : 0.45"
        />
        <text class="val" :x="LABEL_W + w(it.value) + 6" :y="idx * ROW + ROW / 2 + 4">{{ fmtCompact(it.value) }}</text>
        <rect
          class="hit"
          x="0"
          :y="idx * ROW"
          :width="W"
          :height="ROW"
          tabindex="0"
          :aria-label="`${it.label} ${fmtFull(it.value)} ${unit}`"
          @pointermove="onEnter(it, idx, $event)"
          @focus="onEnter(it, idx, $event)"
          @blur="hover = null"
        />
      </g>
    </svg>
    <div v-if="hovered" class="tip" :style="tipStyle">
      <div class="tip-head">{{ hovered.label }}</div>
      <div><strong>{{ fmtFull(hovered.value) }}</strong> {{ unit }}</div>
      <div v-if="hovered.detail" class="muted">{{ hovered.detail }}</div>
    </div>
  </div>
</template>

<style scoped>
.chart { position: relative; }
svg { width: 100%; height: auto; display: block; }
.lab { font-size: 12px; fill: var(--ink); }
.val { font-size: 11.5px; fill: var(--muted); font-family: var(--font-mono); }
.hit { fill: transparent; outline: none; }
.hit:focus-visible { stroke: var(--accent); stroke-width: 1.5; }
.tip {
  position: absolute; z-index: 5; pointer-events: none; min-width: 160px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px;
  box-shadow: 0 4px 14px rgba(19, 40, 43, .12); font-size: 12px; color: var(--ink);
}
.tip-head { color: var(--muted); margin-bottom: 2px; }
.tip strong { font-family: var(--font-mono); }
.muted { color: var(--muted); }
</style>

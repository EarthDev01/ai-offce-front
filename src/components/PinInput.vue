<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    length?: number
    autofocus?: boolean
    mask?: boolean
  }>(),
  { length: 6, autofocus: false, mask: false },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'complete', v: string): void
}>()

const len = () => props.length ?? 6
const cells = ref<string[]>(Array.from({ length: len() }, () => ''))
const inputs = ref<HTMLInputElement[]>([])

function setRef(el: Element | null, i: number) {
  if (el) inputs.value[i] = el as HTMLInputElement
}

// parent → cells
watch(
  () => props.modelValue,
  (v) => {
    const chars = (v ?? '').replace(/\D/g, '').slice(0, len()).split('')
    const next = Array.from({ length: len() }, (_, i) => chars[i] ?? '')
    if (next.join('') !== cells.value.join('')) cells.value = next
  },
  { immediate: true },
)

function emitValue() {
  const val = cells.value.join('')
  emit('update:modelValue', val)
  if (val.length === len() && cells.value.every((c) => c !== '')) emit('complete', val)
}

function onInput(i: number, e: Event) {
  const el = e.target as HTMLInputElement
  const digit = el.value.replace(/\D/g, '').slice(-1) // เก็บเฉพาะตัวเลขตัวสุดท้ายที่พิมพ์
  cells.value[i] = digit
  el.value = digit // กันกรณี model ไม่เปลี่ยน DOM ไม่ถูก patch
  emitValue()
  if (digit && i < len() - 1) focusCell(i + 1)
}

function onKeydown(i: number, e: KeyboardEvent) {
  if (e.key === 'Backspace') {
    e.preventDefault()
    if (cells.value[i]) {
      cells.value[i] = ''
    } else if (i > 0) {
      cells.value[i - 1] = ''
      focusCell(i - 1)
    }
    emitValue()
  } else if (e.key === 'ArrowLeft' && i > 0) {
    e.preventDefault()
    focusCell(i - 1)
  } else if (e.key === 'ArrowRight' && i < len() - 1) {
    e.preventDefault()
    focusCell(i + 1)
  }
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, len())
  if (!text) return
  cells.value = Array.from({ length: len() }, (_, i) => text[i] ?? '')
  emitValue()
  focusCell(Math.min(text.length, len() - 1))
}

async function focusCell(i: number) {
  await nextTick()
  inputs.value[i]?.focus()
  inputs.value[i]?.select()
}

function focus() {
  focusCell(0)
}
defineExpose({ focus })

onMounted(() => {
  if (props.autofocus) focus()
})
</script>

<template>
  <div class="pin" role="group" aria-label="รหัส 6 หลัก">
    <input
      v-for="(cell, i) in cells"
      :key="i"
      :ref="(el) => setRef(el as Element | null, i)"
      class="pin-box mono"
      :type="mask ? 'password' : 'text'"
      inputmode="numeric"
      autocomplete="off"
      pattern="[0-9]*"
      maxlength="1"
      :value="cell"
      @input="onInput(i, $event)"
      @keydown="onKeydown(i, $event)"
      @paste="onPaste"
      @focus="($event.target as HTMLInputElement).select()"
    />
  </div>
</template>

<style scoped>
.pin {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.pin-box {
  width: 48px;
  height: 56px;
  text-align: center;
  font-size: 22px;
  font-weight: 600;
  color: var(--ink);
  background: var(--surface);
  border: 1.5px solid var(--line);
  border-radius: 12px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  caret-color: var(--accent);
}
.pin-box:hover {
  border-color: var(--muted);
}
.pin-box:focus {
  border-color: var(--accent);
  background: #fff;
  box-shadow: 0 0 0 3px var(--accent-soft);
}
@media (max-width: 420px) {
  .pin {
    gap: 7px;
  }
  .pin-box {
    width: 42px;
    height: 50px;
    font-size: 20px;
  }
}
</style>

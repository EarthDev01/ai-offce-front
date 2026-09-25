<script setup lang="ts">
import { ref } from 'vue'
import type { Dayjs } from 'dayjs'

// ช่องช่วงวันที่มาตรฐานของคอนโซล — วันที่อย่างเดียว DD/MM/YYYY · วันในอนาคตเลือกไม่ได้
// ค่าเข้า/ออกเป็น [YYYY-MM-DD, YYYY-MM-DD] (รวมทั้งสองวัน) · ล้างค่า = undefined
const props = defineProps<{
  modelValue?: [string, string]
  /** ช่วงกว้างสุดที่เลือกได้ (วัน) · ไม่ใส่ = ไม่จำกัด */
  maxDays?: number
}>()
const emit = defineEmits<{
  'update:modelValue': [v: [string, string] | undefined]
  change: [v: [string, string] | undefined]
}>()

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

// วันแรกที่คลิกระหว่างเลือกช่วง — ใช้ปิดวันที่ห่างเกิน maxDays
const pickingFrom = ref<string | null>(null)

function onCalendarChange(v: [unknown, unknown] | null) {
  const first = v?.[0] ?? v?.[1]
  pickingFrom.value = !first ? null : typeof first === 'string' ? first : (first as Dayjs).format('YYYY-MM-DD')
}

function disabledDate(current: Dayjs) {
  const day = current.format('YYYY-MM-DD')
  if (day > ymd(new Date())) return true
  if (!props.maxDays || !pickingFrom.value) return false
  return Math.abs(daysBetween(pickingFrom.value, day)) > props.maxDays - 1
}

function onChange(v: [string, string] | null) {
  const out = v?.[0] && v?.[1] ? ([v[0], v[1]] as [string, string]) : undefined
  emit('update:modelValue', out)
  emit('change', out)
}
</script>

<template>
  <a-range-picker
    :value="modelValue"
    value-format="YYYY-MM-DD"
    format="DD/MM/YYYY"
    :placeholder="['ตั้งแต่', 'ถึง']"
    :disabled-date="disabledDate"
    style="width: 100%"
    @calendar-change="onCalendarChange"
    @open-change="(open: boolean) => { if (!open) pickingFrom = null }"
    @change="(v: any) => onChange(v)"
  />
</template>

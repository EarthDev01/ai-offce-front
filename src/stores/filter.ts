import { defineStore } from 'pinia'
import { ref } from 'vue'

export type RangeKey = '7d' | '30d'

/**
 * ตัวกรองร่วมที่ทุกหน้าใช้
 * 'all' = รวมทุกเว็บ — คอนโซลนี้มองข้ามเว็บได้โดยเจตนา (04-SPEC §7)
 */
export const useFilterStore = defineStore('filter', () => {
  const websiteId = ref<string>('all')
  const range = ref<RangeKey>('7d')
  return { websiteId, range }
})

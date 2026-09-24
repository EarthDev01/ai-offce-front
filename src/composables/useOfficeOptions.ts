import { ref } from 'vue'
import { listOffices } from '@/services/api/offices'
import type { Office } from '@/types'

/**
 * รายชื่อ office/service ที่ใช้เป็นตัวกรองร่วมในหน้าประวัติ/ตรวจคำตอบ/โควตา/ลบ (K2–K5)
 * โหลดครั้งเดียวต่อการเข้าหน้า — ไม่ผูกกับฟอร์มแก้ office ใน OfficesView
 */
export function useOfficeOptions() {
  const offices = ref<Office[]>([])
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    try {
      offices.value = (await listOffices()).data
    } catch {
      /* ตัวกรองจะว่าง — หน้าที่เรียกยังใช้งานได้ (พิมพ์ office_id เองไม่ได้ แต่ดูรวมได้) */
    } finally {
      loaded.value = true
    }
  }

  function servicesOf(officeId: string) {
    return offices.value.find((o) => o.id === officeId)?.services ?? []
  }

  return { offices, load, servicesOf }
}

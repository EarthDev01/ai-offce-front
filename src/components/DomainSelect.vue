<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listGroups } from '@/services/api/offices'
import { matchOption } from '@/utils/selectSearch'
import type { Office, OfficeGroup } from '@/types'

// ตัวเลือก domain จัดหัวตามกลุ่ม · โหลดกลุ่มไม่ได้ (ไม่มีสิทธิ์) = แสดงเป็นรายการเดียว
const props = withDefaults(defineProps<{ offices: Office[]; placeholder?: string; allowClear?: boolean }>(), {
  placeholder: 'ทุก domain',
  allowClear: true,
})
const value = defineModel<string | undefined>('value')
const emit = defineEmits<{ change: [v: string | undefined] }>()

const groups = ref<OfficeGroup[]>([])
onMounted(async () => {
  try {
    groups.value = (await listGroups()).data
  } catch {
    /* ไม่มีหัวกลุ่ม */
  }
})

const options = computed(() => {
  const out = groups.value.map((g) => ({ key: g.id, label: g.name, items: props.offices.filter((o) => o.group_id === g.id) }))
  const known = new Set(groups.value.map((g) => g.id))
  const rest = props.offices.filter((o) => !o.group_id || !known.has(o.group_id))
  if (rest.length) out.push({ key: '_loose', label: groups.value.length ? 'ยังไม่ได้จัดกลุ่ม' : '', items: rest })
  return out.filter((g) => g.items.length)
})

const urlText = (o: Office) => (o.allowed_origins[0] ?? '').replace(/^https?:\/\//, '')

function onChange(v: unknown) {
  emit('change', v as string | undefined)
}
</script>

<template>
  <a-select
    v-model:value="value"
    :placeholder="placeholder"
    :allow-clear="allowClear"
    show-search
    :filter-option="matchOption"
    style="width: 100%"
    @change="onChange"
  >
    <template v-for="g in options" :key="g.key">
      <a-select-opt-group v-if="g.label" :label="g.label">
        <a-select-option v-for="o in g.items" :key="o.id" :value="o.id" :search="`${g.label} ${o.id} ${o.label} ${urlText(o)}`">
          {{ o.label || o.id }}<span v-if="urlText(o)" class="url"> · {{ urlText(o) }}</span>
        </a-select-option>
      </a-select-opt-group>
      <template v-else>
        <a-select-option v-for="o in g.items" :key="o.id" :value="o.id" :search="`${o.id} ${o.label} ${urlText(o)}`">
          {{ o.label || o.id }}<span v-if="urlText(o)" class="url"> · {{ urlText(o) }}</span>
        </a-select-option>
      </template>
    </template>
  </a-select>
</template>

<style scoped>
.url { color: var(--muted); font-size: 12px; }
</style>

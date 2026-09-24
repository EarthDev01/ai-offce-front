<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  getRolePermissions, saveRolePermissions, createRole, renameRole, deleteRole,
} from '@/services/api/auth'
import { useAuthStore } from '@/stores/auth'
import { authErrorCode, authErrorText } from '@/utils/authErrors'
import type { PermissionKey, RoleDef, RolePermissionMatrix } from '@/services/api/types'

const auth = useAuthStore()

// role/matrix/catalog เป็น data-driven ทั้งหมด — โหลดจากเซิร์ฟเวอร์ ไม่ hardcode admin/operator/viewer
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const catalog = ref<{ key: PermissionKey; label: string }[]>([])
const roles = ref<RoleDef[]>([])
const matrix = reactive<RolePermissionMatrix>({})

// server บังคับ admin ต้องมี user.manage เสมอ (กันล็อกตัวเองออกจากระบบ)
function isLocked(roleKey: string, perm: PermissionKey) {
  return roleKey === 'admin' && perm === 'user.manage'
}

function has(roleKey: string, perm: PermissionKey) {
  return isLocked(roleKey, perm) ? true : (matrix[roleKey] ?? []).includes(perm)
}

function toggle(roleKey: string, perm: PermissionKey, checked: boolean) {
  if (isLocked(roleKey, perm)) return
  const list = matrix[roleKey] ?? (matrix[roleKey] = [])
  const idx = list.indexOf(perm)
  if (checked && idx === -1) list.push(perm)
  else if (!checked && idx !== -1) list.splice(idx, 1)
}

function applyPayload(res: { roles: RoleDef[]; matrix: RolePermissionMatrix; catalog: { key: PermissionKey; label: string }[] }) {
  roles.value = res.roles
  catalog.value = res.catalog
  Object.keys(matrix).forEach((k) => delete matrix[k])
  Object.entries(res.matrix).forEach(([k, v]) => { matrix[k] = [...v] })
}

async function reload() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getRolePermissions()
    applyPayload(res)
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function submit() {
  saving.value = true
  try {
    const plain: RolePermissionMatrix = {}
    Object.entries(matrix).forEach(([k, v]) => { plain[k] = [...v] })
    const res = await saveRolePermissions(plain)
    applyPayload(res)
    message.success('บันทึกสิทธิ์แล้ว')
    // สิทธิ์/label ของผู้ใช้ปัจจุบันอาจเปลี่ยนไปด้วย — โหลด /me ใหม่ให้ nav/ปุ่มอัปเดตทันที
    await auth.loadMe()
  } catch (e) {
    message.error(authErrorText(e))
  } finally {
    saving.value = false
  }
}

// error ของ role management บางเคส (เช่น "ยังมี user ใช้ role นี้") เซิร์ฟเวอร์ส่งข้อความไทยมาตรง ๆ
// ที่ไม่อยู่ใน map ทั่วไปของ authErrors — เลยแปลเฉพาะโค้ดที่รู้จัก ที่เหลือโชว์ตามที่เซิร์ฟเวอร์ส่งมา
const ROLE_ERROR_MAP: Record<string, string> = {
  ROLE_EXISTS: 'มี role นี้อยู่แล้ว',
  DUPLICATE_ROLE: 'มี role นี้อยู่แล้ว',
  INVALID_ROLE: 'รูปแบบ key ไม่ถูกต้อง — ใช้ a-z, 0-9, _ หรือ - เท่านั้น และห้ามใช้ "admin"',
  INVALID_ROLE_KEY: 'รูปแบบ key ไม่ถูกต้อง — ใช้ a-z, 0-9, _ หรือ - เท่านั้น และห้ามใช้ "admin"',
  ROLE_KEY_INVALID: 'รูปแบบ key ไม่ถูกต้อง — ใช้ a-z, 0-9, _ หรือ - เท่านั้น และห้ามใช้ "admin"',
  BUILTIN_ROLE: 'แก้ไขหรือลบ role ระบบไม่ได้',
  ROLE_LOCKED: 'แก้ไขหรือลบ role ระบบไม่ได้',
  ROLE_NOT_FOUND: 'ไม่พบ role นี้',
  ROLE_IN_USE: 'ยังมี user ใช้ role นี้อยู่ — ย้าย user ออกก่อนแล้วค่อยลบ',
}

function roleErrorText(e: unknown): string {
  const code = authErrorCode(e)
  return ROLE_ERROR_MAP[code] ?? code
}

// ---------- เพิ่ม role ----------
const addOpen = ref(false)
const addSaving = ref(false)
const addForm = reactive({ key: '', label: '' })
const KEY_PATTERN = /^[a-z][a-z0-9_-]{1,29}$/

const canAdd = computed(
  () => KEY_PATTERN.test(addForm.key) && addForm.key !== 'admin' && addForm.label.trim().length > 0,
)

function openAdd() {
  addForm.key = ''
  addForm.label = ''
  addOpen.value = true
}

async function submitAdd() {
  if (!canAdd.value) return
  addSaving.value = true
  try {
    const res = await createRole(addForm.key.trim(), addForm.label.trim())
    applyPayload(res)
    message.success('เพิ่ม role แล้ว')
    addOpen.value = false
  } catch (e) {
    message.error(roleErrorText(e))
  } finally {
    addSaving.value = false
  }
}

// ---------- แก้ชื่อ role ----------
const renameOpen = ref(false)
const renameSaving = ref(false)
const renameTarget = ref<RoleDef | null>(null)
const renameForm = reactive({ label: '' })

function openRename(role: RoleDef) {
  renameTarget.value = role
  renameForm.label = role.label
  renameOpen.value = true
}

async function submitRename() {
  const target = renameTarget.value
  if (!target || !renameForm.label.trim()) return
  renameSaving.value = true
  try {
    const res = await renameRole(target.key, renameForm.label.trim())
    applyPayload(res)
    message.success('เปลี่ยนชื่อ role แล้ว')
    renameOpen.value = false
  } catch (e) {
    message.error(roleErrorText(e))
  } finally {
    renameSaving.value = false
  }
}

// ---------- ลบ role ----------
async function confirmDeleteRole(role: RoleDef) {
  try {
    const res = await deleteRole(role.key)
    applyPayload(res)
    message.success('ลบ role แล้ว')
  } catch (e) {
    message.error(roleErrorText(e))
  }
}

onMounted(reload)
</script>

<template>
  <div class="page-head">
    <h1>สิทธิ์ของ role</h1>
    <p class="sub">
      กำหนดว่าแต่ละ role ทำอะไรได้บ้าง — ติ๊กเพื่อเปิด/ปิดสิทธิ์รายอย่าง แล้วกดบันทึกเพื่อมีผลทันที
      เพิ่ม/แก้ไข/ลบ role ได้จากที่นี่เช่นกัน
    </p>
  </div>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <a-card size="small" class="tidy">
    <div class="header-row">
      <span class="count">ทั้งหมด {{ roles.length }} role</span>
      <a-button @click="openAdd">เพิ่ม role</a-button>
    </div>

    <div class="table-scroll" v-if="!loading || catalog.length">
      <table class="perm-table">
        <thead>
          <tr>
            <th class="perm-col">สิทธิ์</th>
            <th v-for="r in roles" :key="r.key" class="role-col">
              <div class="role-head">
                <div class="role-head-title">
                  <span>{{ r.label }}</span>
                  <a-tag v-if="r.builtin" color="#0f6e63" class="builtin-badge">ระบบ</a-tag>
                </div>
                <div v-if="!r.builtin" class="role-head-actions">
                  <a-button size="small" type="link" @click="openRename(r)">แก้ไข</a-button>
                  <a-popconfirm
                    title="ลบ role นี้? user ที่ใช้ role นี้อยู่ต้องย้ายไป role อื่นก่อน"
                    ok-text="ลบ"
                    ok-type="danger"
                    cancel-text="ยกเลิก"
                    @confirm="confirmDeleteRole(r)"
                  >
                    <a-button size="small" type="link" danger>ลบ</a-button>
                  </a-popconfirm>
                </div>
                <div v-else class="role-head-actions lock-hint">ล็อกไว้ แก้ไข/ลบไม่ได้</div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in catalog" :key="item.key">
            <td class="perm-col">
              <span class="perm-label">{{ item.label }}</span>
              <span class="perm-key">{{ item.key }}</span>
            </td>
            <td v-for="r in roles" :key="r.key" class="cell">
              <a-checkbox
                :checked="has(r.key, item.key)"
                :disabled="isLocked(r.key, item.key)"
                @change="(e: any) => toggle(r.key, item.key, e.target.checked)"
              />
              <div v-if="isLocked(r.key, item.key)" class="lock-note">บังคับเปิด — กันแอดมินล็อกตัวเองออก</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <a-skeleton v-else active :paragraph="{ rows: 5 }" />

    <div class="footer-row">
      <a-button type="primary" :loading="saving" :disabled="loading" @click="submit">บันทึกสิทธิ์</a-button>
    </div>
  </a-card>

  <!-- เพิ่ม role -->
  <a-modal centered
    v-model:open="addOpen"
    title="เพิ่ม role"
    ok-text="เพิ่ม"
    cancel-text="ยกเลิก"
    :confirm-loading="addSaving"
    :ok-button-props="{ disabled: !canAdd }"
    @ok="submitAdd"
  >
    <label class="f-label">key</label>
    <a-input v-model:value="addForm.key" placeholder="เช่น editor, support_lv1" />
    <p class="f-hint">a-z, 0-9, _ หรือ - เท่านั้น ขึ้นต้นด้วยตัวอักษร ยาว 2-30 ตัว และห้ามใช้ "admin"</p>

    <label class="f-label">ชื่อที่แสดง</label>
    <a-input v-model:value="addForm.label" placeholder="เช่น ผู้แก้ไขเนื้อหา" />
  </a-modal>

  <!-- แก้ชื่อ role -->
  <a-modal centered
    v-model:open="renameOpen"
    title="แก้ไขชื่อ role"
    ok-text="บันทึก"
    cancel-text="ยกเลิก"
    :confirm-loading="renameSaving"
    :ok-button-props="{ disabled: !renameForm.label.trim() }"
    @ok="submitRename"
  >
    <p class="f-hint" style="margin-top: 0">key: {{ renameTarget?.key }} (แก้ไม่ได้)</p>
    <label class="f-label">ชื่อที่แสดง</label>
    <a-input v-model:value="renameForm.label" />
  </a-modal>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.count { font-size: 13px; color: var(--muted); }

.table-scroll { overflow-x: auto; }

.perm-table { width: 100%; border-collapse: collapse; }
.perm-table th, .perm-table td { padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: center; }
.perm-table th { background: var(--ground); color: var(--muted); font-weight: 600; font-size: 12.5px; vertical-align: top; }
.perm-table thead th.perm-col, .perm-table td.perm-col { text-align: left; }
.perm-table tbody tr:last-child td { border-bottom: none; }

.perm-col { min-width: 220px; }
.role-col { min-width: 160px; }
.perm-label { display: block; font-size: 14px; color: var(--ink); font-weight: 600; }
.perm-key { display: block; font-size: 12px; color: var(--muted); font-family: var(--font-mono, monospace); margin-top: 2px; }

.role-head { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.role-head-title { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.builtin-badge { font-size: 11px; line-height: 16px; padding: 0 6px; }
.role-head-actions { display: flex; gap: 0; }
.role-head-actions.lock-hint { font-size: 11px; color: var(--muted); font-weight: 400; }

.cell { position: relative; }
.lock-note { margin-top: 4px; font-size: 11px; color: var(--muted); line-height: 1.3; max-width: 140px; margin-inline: auto; }

.footer-row { display: flex; justify-content: flex-end; margin-top: 20px; }

.f-label { display: block; font-size: 12.5px; color: var(--muted); margin: 12px 0 4px; }
.f-hint { margin: 4px 0 0; font-size: 12px; color: var(--muted); line-height: 1.4; }
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  getRolePermissions, saveRolePermissions, createRole, renameRole, deleteRole, listUsers,
} from '@/services/api/auth'
import { PERM_GROUPS } from '@/utils/permissionGroups'
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

// matrix ตามที่ server ส่งมาล่าสุด — ใช้เทียบว่าแก้อะไรไปแล้วบ้างก่อนบันทึก
const saved = reactive<RolePermissionMatrix>({})
// จำนวนผู้ใช้ต่อ role (โหลดไม่ได้ก็ไม่แสดง)
const userCount = ref<Record<string, number>>({})

// admin ได้ทุกสิทธิ์เสมอ (server ไม่เช็ค matrix ของ admin) — แสดงติ๊กครบแบบล็อก
const isAdmin = (roleKey: string) => roleKey === 'admin'

function has(roleKey: string, perm: PermissionKey) {
  return isAdmin(roleKey) || (matrix[roleKey] ?? []).includes(perm)
}

function wasSaved(roleKey: string, perm: PermissionKey) {
  return isAdmin(roleKey) || (saved[roleKey] ?? []).includes(perm)
}

function isChanged(roleKey: string, perm: PermissionKey) {
  return has(roleKey, perm) !== wasSaved(roleKey, perm)
}

function toggle(roleKey: string, perm: PermissionKey, checked: boolean) {
  if (isAdmin(roleKey)) return
  const list = matrix[roleKey] ?? (matrix[roleKey] = [])
  const idx = list.indexOf(perm)
  if (checked && idx === -1) list.push(perm)
  else if (!checked && idx !== -1) list.splice(idx, 1)
}

// จัดสิทธิ์ตามหมวด · สิทธิ์ที่ server มีแต่ยังไม่อยู่ในหมวดไหน ไปอยู่ "อื่น ๆ" (ไม่หายไปเงียบ ๆ)
const labelOf = computed(() => {
  const m: Record<string, string> = {}
  for (const c of catalog.value) m[c.key] = c.label
  return m
})

const groups = computed(() => {
  const known = new Set(Object.keys(labelOf.value))
  const used = new Set<string>()
  const out = PERM_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((it) => known.has(it.key)).map((it) => {
      used.add(it.key)
      return { key: it.key, label: labelOf.value[it.key], opens: it.opens }
    }),
  })).filter((g) => g.items.length > 0)
  const rest = [...known].filter((k) => !used.has(k))
  if (rest.length) {
    out.push({ title: 'อื่น ๆ', items: rest.map((k) => ({ key: k as PermissionKey, label: labelOf.value[k], opens: '' })) })
  }
  return out
})

// ติ๊กทั้งหมวด: all = ครบทุกข้อ · some = บางข้อ
function groupState(roleKey: string, keys: PermissionKey[]) {
  const n = keys.filter((k) => has(roleKey, k)).length
  return { all: n === keys.length, some: n > 0 && n < keys.length }
}

function toggleGroup(roleKey: string, keys: PermissionKey[], checked: boolean) {
  for (const k of keys) toggle(roleKey, k, checked)
}

const changedCount = computed(() => {
  let n = 0
  for (const r of roles.value) {
    for (const g of groups.value) for (const it of g.items) if (isChanged(r.key, it.key)) n++
  }
  return n
})

function resetEdits() {
  Object.keys(matrix).forEach((k) => delete matrix[k])
  Object.entries(saved).forEach(([k, v]) => { matrix[k] = [...v] })
}

function applyPayload(res: { roles: RoleDef[]; matrix: RolePermissionMatrix; catalog: { key: PermissionKey; label: string }[] }) {
  roles.value = res.roles
  catalog.value = res.catalog
  Object.keys(saved).forEach((k) => delete saved[k])
  Object.entries(res.matrix).forEach(([k, v]) => { saved[k] = [...v] })
  resetEdits()
}

async function loadUserCount() {
  try {
    const counts: Record<string, number> = {}
    for (const u of (await listUsers()).users) counts[u.role] = (counts[u.role] ?? 0) + 1
    userCount.value = counts
  } catch {
    /* ไม่แสดงจำนวนผู้ใช้ */
  }
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
    // admin ได้ทุกสิทธิ์อยู่แล้ว — เก็บให้ครบตาม catalog ให้ข้อมูลใน DB ตรงกับความจริง
    plain.admin = [...new Set(catalog.value.map((c) => c.key))]
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

onMounted(() => {
  reload()
  loadUserCount()
})
</script>

<template>
  <div class="page-head">
    <h1>ตั้งค่า Permissions</h1>
    <p class="sub">
      กำหนดว่าแต่ละ role เห็นเมนูและทำอะไรได้บ้าง — คลิกช่องเพื่อเปิด/ปิดสิทธิ์ หรือติ๊กที่หัวหมวดเพื่อให้ทั้งหมวด
      แล้วกดบันทึก · ผู้ใช้เห็นผลเมื่อโหลดหน้าใหม่
    </p>
  </div>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <a-card size="small" class="tidy">
    <div class="header-row">
      <span class="count">ทั้งหมด {{ roles.length }} role</span>
      <a-button @click="openAdd">เพิ่ม role</a-button>
    </div>

    <div v-if="!loading || catalog.length" class="table-scroll">
      <table class="perm-table">
        <thead>
          <tr>
            <th class="perm-col">สิทธิ์ · เปิดอะไรได้</th>
            <th v-for="r in roles" :key="r.key" class="role-col">
              <div class="role-head">
                <div class="role-head-title">
                  <span>{{ r.label }}</span>
                  <a-tag v-if="r.builtin" color="#0f6e63" class="builtin-badge">ระบบ</a-tag>
                </div>
                <div class="role-meta">
                  <code>{{ r.key }}</code>
                  <template v-if="userCount[r.key] !== undefined"> · {{ userCount[r.key] }} ผู้ใช้</template>
                </div>
                <div v-if="isAdmin(r.key)" class="role-meta">ได้ทุกสิทธิ์เสมอ</div>
                <div v-else-if="!r.builtin" class="role-head-actions">
                  <a-button size="small" type="link" @click="openRename(r)">แก้ชื่อ</a-button>
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
              </div>
            </th>
          </tr>
        </thead>
        <tbody v-for="g in groups" :key="g.title">
          <tr class="group-row">
            <td class="perm-col">{{ g.title }}</td>
            <td v-for="r in roles" :key="r.key" class="cell">
              <a-tooltip v-if="!isAdmin(r.key)" :title="`${groupState(r.key, g.items.map((i) => i.key)).all ? 'เอาออก' : 'ให้'}ทุกสิทธิ์ในหมวด ${g.title}`">
                <a-checkbox
                  :checked="groupState(r.key, g.items.map((i) => i.key)).all"
                  :indeterminate="groupState(r.key, g.items.map((i) => i.key)).some"
                  @change="(e: any) => toggleGroup(r.key, g.items.map((i) => i.key), e.target.checked)"
                />
              </a-tooltip>
            </td>
          </tr>
          <tr v-for="item in g.items" :key="item.key">
            <td class="perm-col">
              <span class="perm-label">{{ item.label }}</span>
              <span v-if="item.opens" class="perm-opens">{{ item.opens }}</span>
              <span class="perm-key">{{ item.key }}</span>
            </td>
            <td
              v-for="r in roles"
              :key="r.key"
              class="cell"
              :class="{ changed: isChanged(r.key, item.key), clickable: !isAdmin(r.key) }"
              @click="!isAdmin(r.key) && toggle(r.key, item.key, !has(r.key, item.key))"
            >
              <a-checkbox
                :checked="has(r.key, item.key)"
                :disabled="isAdmin(r.key)"
                @click.stop
                @change="(e: any) => toggle(r.key, item.key, e.target.checked)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <a-skeleton v-else active :paragraph="{ rows: 5 }" />
  </a-card>

  <div v-if="changedCount > 0" class="save-bar">
    <span><strong>เปลี่ยน {{ changedCount }} รายการ</strong> · ยังไม่บันทึก (ช่องที่แก้มีพื้นสีเหลือง)</span>
    <div class="save-actions">
      <a-button :disabled="saving" @click="resetEdits">ยกเลิกการแก้ไข</a-button>
      <a-button type="primary" :loading="saving" @click="submit">บันทึกสิทธิ์</a-button>
    </div>
  </div>

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
.perm-table th, .perm-table td { padding: 10px 14px; border-bottom: 1px solid var(--line); text-align: center; }
.perm-table th { background: var(--ground); color: var(--muted); font-weight: 600; font-size: 12.5px; vertical-align: top; position: sticky; top: 0; z-index: 1; }
.perm-table thead th.perm-col, .perm-table td.perm-col { text-align: left; }

.perm-col { min-width: 280px; }
.role-col { min-width: 150px; }
.perm-label { display: block; font-size: 14px; color: var(--ink); font-weight: 600; }
.perm-opens { display: block; font-size: 12.5px; color: var(--ink); opacity: .72; margin-top: 2px; }
.perm-key { display: block; font-size: 11px; color: var(--muted); font-family: var(--font-mono, monospace); margin-top: 2px; }

.group-row td { background: var(--ground); font-size: 12px; font-weight: 700; letter-spacing: .03em; color: var(--muted); padding-top: 14px; }
.group-row td.perm-col { text-transform: uppercase; }

.role-head { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.role-head-title { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--ink); }
.role-meta { font-size: 11.5px; font-weight: 400; color: var(--muted); }
.builtin-badge { font-size: 11px; line-height: 16px; padding: 0 6px; }
.role-head-actions { display: flex; }

.cell.clickable { cursor: pointer; }
.cell.clickable:hover { background: var(--accent-soft); }
.cell.changed { background: #fff4d6; }
.cell.changed:hover { background: #ffecb3; }

.save-bar {
  position: sticky; bottom: 16px; margin-top: 16px; z-index: 5;
  display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 12px 16px; border: 1px solid var(--line); border-radius: var(--r-card);
  background: var(--surface); box-shadow: 0 6px 20px rgba(19, 40, 43, .12); font-size: 13.5px;
}
.save-actions { display: flex; gap: 8px; }

.f-label { display: block; font-size: 12.5px; color: var(--muted); margin: 12px 0 4px; }
.f-hint { margin: 4px 0 0; font-size: 12px; color: var(--muted); line-height: 1.4; }
</style>

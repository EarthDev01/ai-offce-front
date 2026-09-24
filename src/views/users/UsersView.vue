<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  listUsers, createUser, patchUser, resetPassword, reset2fa, deleteUser, getRolePermissions,
} from '@/services/api/auth'
import { useAuthStore } from '@/stores/auth'
import { authErrorText } from '@/utils/authErrors'
import type { ConsoleUser, Role, RoleDef } from '@/services/api/types'

const auth = useAuthStore()

const users = ref<ConsoleUser[]>([])
const loading = ref(false)
const loadError = ref('')

// role เป็น data-driven — โหลดจาก /role-permissions (ไม่ hardcode admin/operator/viewer)
const roles = ref<RoleDef[]>([])
const roleOptions = computed(() => roles.value.map((r) => ({ value: r.key, label: r.label })))

function roleLabel(key: string) {
  return roles.value.find((r) => r.key === key)?.label ?? key
}

const columns = [
  { title: 'username', dataIndex: 'username', key: 'username' },
  { title: 'ชื่อ', dataIndex: 'display_name', key: 'display_name' },
  { title: 'บทบาท', key: 'role' },
  { title: 'สถานะ', key: 'status' },
  { title: 'เข้าระบบล่าสุด', key: 'last_login_at' },
  { title: 'การจัดการ', key: 'actions' },
]

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: 'ใช้งาน' },
  disabled: { color: 'default', label: 'ปิด' },
}

function fmtDate(v?: string) {
  if (!v) return '—'
  return new Date(v).toLocaleString('th-TH')
}

async function loadRoles() {
  try {
    const res = await getRolePermissions()
    roles.value = res.roles
  } catch {
    /* ไม่บล็อกหน้าถ้าโหลด role list ไม่สำเร็จ — dropdown จะว่างแต่หน้าใช้งานได้ */
  }
}

async function reload() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listUsers()
    users.value = res.users
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

// ---------- create ----------
const createOpen = ref(false)
const createSaving = ref(false)
const createForm = reactive({ username: '', display_name: '', role: '' as Role, password: '' })

const canCreate = computed(
  () =>
    createForm.username.trim().length > 0 &&
    createForm.display_name.trim().length > 0 &&
    createForm.password.length >= 8,
)

function openCreate() {
  createForm.username = ''
  createForm.display_name = ''
  createForm.role = roles.value.find((r) => !r.builtin)?.key ?? roles.value[0]?.key ?? ''
  createForm.password = ''
  createOpen.value = true
}

async function submitCreate() {
  if (!canCreate.value) return
  createSaving.value = true
  try {
    await createUser({
      username: createForm.username.trim(),
      display_name: createForm.display_name.trim(),
      role: createForm.role,
      password: createForm.password,
    })
    message.success('เพิ่มผู้ใช้แล้ว')
    createOpen.value = false
    await reload()
  } catch (e) {
    message.error(authErrorText(e))
  } finally {
    createSaving.value = false
  }
}

// ---------- edit ----------
const editOpen = ref(false)
const editSaving = ref(false)
const editTarget = ref<ConsoleUser | null>(null)
const editForm = reactive({ display_name: '', role: '' as Role, status: 'active' as string })

function openEdit(row: ConsoleUser) {
  editTarget.value = row
  editForm.display_name = row.display_name
  editForm.role = row.role
  editForm.status = row.status
  editOpen.value = true
}

async function submitEdit() {
  const row = editTarget.value
  if (!row) return
  editSaving.value = true
  try {
    const patch: { display_name?: string; role?: Role; status?: string } = {}
    if (editForm.display_name !== row.display_name) patch.display_name = editForm.display_name
    if (editForm.role !== row.role) patch.role = editForm.role
    if (editForm.status !== row.status) patch.status = editForm.status
    if (Object.keys(patch).length > 0) {
      await patchUser(row.id, patch)
      message.success('บันทึกแล้ว')
    }
    editOpen.value = false
    await reload()
  } catch (e) {
    message.error(authErrorText(e))
  } finally {
    editSaving.value = false
  }
}

// ---------- reset password ----------
const passwordOpen = ref(false)
const passwordSaving = ref(false)
const passwordTarget = ref<ConsoleUser | null>(null)
const passwordValue = ref('')

function openResetPassword(row: ConsoleUser) {
  passwordTarget.value = row
  passwordValue.value = ''
  passwordOpen.value = true
}

async function submitResetPassword() {
  const row = passwordTarget.value
  if (!row || passwordValue.value.length < 8) return
  passwordSaving.value = true
  try {
    await resetPassword(row.id, passwordValue.value)
    message.success('ตั้งรหัสผ่านใหม่แล้ว')
    passwordOpen.value = false
  } catch (e) {
    message.error(authErrorText(e))
  } finally {
    passwordSaving.value = false
  }
}

// ---------- reset 2fa ----------
async function confirmReset2fa(row: ConsoleUser) {
  try {
    await reset2fa(row.id)
    message.success('รีเซ็ต 2FA แล้ว')
  } catch (e) {
    message.error(authErrorText(e))
  }
}

// ---------- delete ----------
async function confirmDelete(row: ConsoleUser) {
  try {
    await deleteUser(row.id)
    message.success('ลบแล้ว')
    await reload()
  } catch (e) {
    message.error(authErrorText(e))
  }
}

onMounted(() => {
  reload()
  loadRoles()
})
</script>

<template>
  <div class="page-head">
    <h1>ผู้ใช้คอนโซล</h1>
    <p class="sub">
      บัญชีสำหรับเข้าคอนโซลนี้ แยกจากบัญชีหลังบ้านของแต่ละ office —
      จัดการบทบาท สถานะ รหัสผ่าน และ 2FA ได้จากที่นี่
    </p>
  </div>

  <a-alert v-if="loadError" type="error" :message="loadError" show-icon style="margin-bottom: 16px" />

  <a-card size="small" class="tidy">
    <div class="header-row">
      <span class="count">ทั้งหมด {{ users.length }} คน</span>
      <a-button type="primary" @click="openCreate">เพิ่มผู้ใช้</a-button>
    </div>

    <a-table
      class="users-table"
      :columns="columns"
      :data-source="users"
      :loading="loading"
      :pagination="false"
      row-key="id"
      size="middle"
    >
      <template #emptyText>
        <div class="empty">
          <span class="empty-mark" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14Z" fill="currentColor" />
            </svg>
          </span>
          <p class="empty-title">ยังไม่มีผู้ใช้คอนโซล</p>
          <p class="empty-sub">เพิ่มผู้ใช้คนแรกเพื่อให้ทีมเข้ามาจัดการ office ได้</p>
        </div>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'role'">
          <a-tag :color="record.role === 'admin' ? '#0f6e63' : 'blue'">
            {{ roleLabel(record.role) }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="STATUS_TAG[record.status]?.color ?? 'default'">
            {{ STATUS_TAG[record.status]?.label ?? record.status }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'last_login_at'">
          {{ fmtDate(record.last_login_at) }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <div class="actions">
            <a-button size="small" type="link" @click="openEdit(record)">แก้ไข</a-button>
            <RouterLink
              v-if="auth.can('audit.view')"
              v-slot="{ navigate }"
              :to="{ path: '/activity', query: { actor: record.username } }"
              custom
            >
              <a-button size="small" type="link" @click="navigate">ประวัติ</a-button>
            </RouterLink>
            <a-button size="small" type="link" @click="openResetPassword(record)">รีเซ็ตรหัสผ่าน</a-button>
            <a-popconfirm
              title="รีเซ็ต 2FA ของผู้ใช้นี้? เขาจะต้องตั้งค่าใหม่ตอน login ครั้งหน้า"
              ok-text="รีเซ็ต"
              cancel-text="ยกเลิก"
              @confirm="confirmReset2fa(record)"
            >
              <a-button size="small" type="link">รีเซ็ต 2FA</a-button>
            </a-popconfirm>
            <a-popconfirm
              v-if="record.id !== auth.user?.id"
              title="ลบผู้ใช้นี้?"
              ok-text="ลบ"
              ok-type="danger"
              cancel-text="ยกเลิก"
              @confirm="confirmDelete(record)"
            >
              <a-button size="small" type="link" danger>ลบ</a-button>
            </a-popconfirm>
          </div>
        </template>
      </template>
    </a-table>
  </a-card>

  <!-- create -->
  <a-modal centered
    v-model:open="createOpen"
    title="เพิ่มผู้ใช้"
    ok-text="สร้าง"
    cancel-text="ยกเลิก"
    :confirm-loading="createSaving"
    :ok-button-props="{ disabled: !canCreate }"
    @ok="submitCreate"
  >
    <label class="f-label">username</label>
    <a-input v-model:value="createForm.username" placeholder="เช่น adm_ploy" />

    <label class="f-label">ชื่อที่แสดง</label>
    <a-input v-model:value="createForm.display_name" />

    <label class="f-label">บทบาท</label>
    <a-select v-model:value="createForm.role" style="width: 100%">
      <a-select-option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
    </a-select>

    <label class="f-label">รหัสผ่าน (อย่างน้อย 8 ตัว)</label>
    <a-input-password v-model:value="createForm.password" autocomplete="new-password" />
  </a-modal>

  <!-- edit -->
  <a-modal centered
    v-model:open="editOpen"
    title="แก้ไขผู้ใช้"
    ok-text="บันทึก"
    cancel-text="ยกเลิก"
    :confirm-loading="editSaving"
    @ok="submitEdit"
  >
    <label class="f-label">ชื่อที่แสดง</label>
    <a-input v-model:value="editForm.display_name" />

    <label class="f-label">บทบาท</label>
    <a-select v-model:value="editForm.role" style="width: 100%">
      <a-select-option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
    </a-select>

    <label class="f-label">สถานะ</label>
    <a-select v-model:value="editForm.status" style="width: 100%">
      <a-select-option value="active">ใช้งาน</a-select-option>
      <a-select-option value="disabled">ปิด</a-select-option>
    </a-select>
  </a-modal>

  <!-- reset password -->
  <a-modal centered
    v-model:open="passwordOpen"
    title="รีเซ็ตรหัสผ่าน"
    ok-text="ตั้งรหัสผ่านใหม่"
    cancel-text="ยกเลิก"
    :confirm-loading="passwordSaving"
    :ok-button-props="{ disabled: passwordValue.length < 8 }"
    @ok="submitResetPassword"
  >
    <p style="font-size: 13px; color: var(--muted); margin-bottom: 12px">
      ตั้งรหัสผ่านใหม่ให้ {{ passwordTarget?.display_name }} ({{ passwordTarget?.username }}) — แจ้งรหัสผ่านนี้ให้เจ้าตัวนอกระบบ
    </p>
    <a-input-password v-model:value="passwordValue" autocomplete="new-password" />
  </a-modal>
</template>

<style scoped>
.tidy { border-radius: var(--r-card); border-color: var(--line); }
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.count { font-size: 13px; color: var(--muted); }
.actions { display: flex; gap: 2px; flex-wrap: wrap; }
.f-label { display: block; font-size: 12.5px; color: var(--muted); margin: 12px 0 4px; }

/* ตารางโปร่งขึ้น — แถวสูง เส้นคั่นจาง หัวตารางเงียบ */
.users-table :deep(.ant-table-thead > tr > th) {
  background: var(--ground);
  color: var(--muted);
  font-weight: 600;
  font-size: 12.5px;
  border-bottom-color: var(--line);
}
.users-table :deep(.ant-table-tbody > tr > td) {
  padding-top: 14px;
  padding-bottom: 14px;
  border-bottom-color: var(--line);
}
.users-table :deep(.ant-table-tbody > tr:hover > td) { background: var(--accent-soft); }

.empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 28px 16px; }
.empty-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 48px; height: 48px; margin-bottom: 8px; border-radius: 14px;
  background: var(--accent-soft); color: var(--accent);
}
.empty-title { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--ink); }
.empty-sub { margin: 0; font-size: 13px; color: var(--muted); }
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'

const router = useRouter()
const auth = useAuthStore()

const changePasswordOpen = ref(false)

// สีสำหรับ role ที่ไม่ใช่ admin — เลือกจาก hash ของ key ให้นิ่ง (role เดียวกันได้สีเดิมเสมอ)
const ROLE_COLOR_PALETTE = ['blue', 'purple', 'cyan', 'gold', 'volcano', 'geekblue', 'magenta', 'green']

function colorForRoleKey(key: string) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return ROLE_COLOR_PALETTE[hash % ROLE_COLOR_PALETTE.length]
}

const roleTag = computed(() => {
  const key = auth.user?.role ?? ''
  const label = auth.roleLabel || key || '—'
  if (key === 'admin') return { color: '#0f6e63', label }
  return { color: colorForRoleKey(key), label }
})

function onMenuClick({ key }: { key: string }) {
  if (key === 'change-password') changePasswordOpen.value = true
  else if (key === 'logout') doLogout()
}

async function doLogout() {
  await auth.signOut()
  router.push('/login')
}

onMounted(() => {
  if (auth.isAuthed && !auth.user) auth.loadMe()
})
</script>

<template>
  <div class="shell">
    <aside class="rail">
      <div class="brand">
        <span class="mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 3.5V17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
              fill="currentColor"
            />
            <circle cx="9" cy="10.5" r="1.15" fill="#fff" />
            <circle cx="12.5" cy="10.5" r="1.15" fill="#fff" />
            <circle cx="16" cy="10.5" r="1.15" fill="#fff" />
          </svg>
        </span>
        <div class="brand-text">
          <span class="brand-name">AI OFFICE</span>
          <span class="brand-role">คอนโซลผู้ดูแล</span>
        </div>
      </div>
      <nav>
        <RouterLink to="/offices">Offices</RouterLink>
        <RouterLink v-if="auth.can('conversation.read')" to="/history">ประวัติแชท</RouterLink>
        <RouterLink v-if="auth.can('verification.write')" to="/review">ตรวจคำตอบ</RouterLink>
        <RouterLink v-if="auth.can('quota.view')" to="/quota">โควตา/ต้นทุน</RouterLink>
        <RouterLink v-if="auth.can('deletion.manage')" to="/deletion">ลบตามคำขอ (PDPA)</RouterLink>
        <RouterLink to="/settings">ตั้งค่าระบบ</RouterLink>
        <div class="soon-group">
          <span class="soon-head">เร็วๆ นี้</span>
          <span class="soon">ภาพรวม</span>
        </div>
        <div class="admin-group">
          <span class="admin-head">ผู้ดูแลคอนโซล</span>
          <RouterLink v-if="auth.can('user.manage')" to="/users">ผู้ใช้คอนโซล</RouterLink>
          <RouterLink v-if="auth.can('user.manage')" to="/roles">สิทธิ์ของ role</RouterLink>
          <RouterLink v-if="auth.can('audit.view')" to="/activity">ประวัติการทำงาน</RouterLink>
        </div>
      </nav>
    </aside>

    <div class="body">
      <header>
        <a-dropdown placement="bottomRight" @click.prevent>
          <a class="user-menu" @click.prevent>
            <span class="avatar" aria-hidden="true">{{ (auth.user?.display_name || auth.user?.username || '?').charAt(0).toUpperCase() }}</span>
            <span class="user-name">{{ auth.user?.display_name || auth.user?.username || '…' }}</span>
            <a-tag :color="roleTag.color">{{ roleTag.label }}</a-tag>
          </a>
          <template #overlay>
            <a-menu @click="onMenuClick">
              <a-menu-item key="change-password">เปลี่ยนรหัสผ่าน</a-menu-item>
              <a-menu-divider />
              <a-menu-item key="logout">ออกจากระบบ</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </header>
      <main><div class="page-wrap"><RouterView /></div></main>
    </div>

    <ChangePasswordModal v-model:open="changePasswordOpen" />
  </div>
</template>

<style scoped>
.shell { display: block; }
.rail {
  background: var(--surface); border-right: 1px solid var(--line); padding: 16px 12px;
  /* fixed กับ viewport — นิ่งไม่ขยับเลย (แบบ office-v10x) · scroll ภายในถ้ายาวเกิน */
  position: fixed; top: 0; left: 0; bottom: 0; width: 240px; z-index: 100; overflow-y: auto;
}

/* เนื้อหาเยื้องให้พ้น rail (ซ้าย) + header (บน) แล้วเลื่อนหน้าปกติ */
.body { margin-left: 240px; padding-top: 62px; min-width: 0; }

.brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 16px; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
.mark { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px; background: var(--accent); color: #fff; flex: none; }
.brand-text { display: flex; flex-direction: column; line-height: 1.2; }
.brand-name { font-family: var(--font-head); font-weight: 700; font-size: 15px; color: var(--ink); }
.brand-role { font-size: 12px; color: var(--muted); }

nav { display: flex; flex-direction: column; gap: 2px; }
nav a { position: relative; padding: 10px 12px; font-size: 14px; text-decoration: none; color: var(--ink); border-radius: var(--r-control); transition: background .12s, color .12s; }
nav a:hover { background: var(--ground); }
nav a.router-link-active { background: var(--accent-soft); color: var(--accent-strong); font-weight: 600; }
nav a.router-link-active::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--accent); }

.soon-group { display: flex; flex-direction: column; gap: 1px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.soon-head { padding: 0 12px 4px; font-size: 11px; color: var(--muted); }
.soon { padding: 7px 12px; font-size: 13px; color: var(--muted); opacity: .75; }
.admin-group { display: flex; flex-direction: column; gap: 2px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.admin-head { padding: 0 12px 4px; font-size: 11px; color: var(--muted); }

header {
  display: flex; gap: 8px; justify-content: flex-end; align-items: center;
  padding: 12px 24px; border-bottom: 1px solid var(--line); background: var(--surface);
  /* fixed บนสุด นิ่งไม่ขยับ (พ้น rail ด้วย left:240px) */
  position: fixed; top: 0; left: 240px; right: 0; height: 62px; z-index: 90; box-sizing: border-box;
}
main { padding: 28px 24px; }
/* เต็มความกว้างจอทุกหน้า
   ห้ามตั้งชื่อ class ว่า "container" — ชนกับ utility ของ Tailwind ที่ใส่ max-width ตาม breakpoint ให้เอง */
.page-wrap { width: 100%; min-width: 0; }

.user-menu { display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--ink); padding: 5px 8px; border-radius: var(--r-control); transition: background .12s; }
.user-menu:hover { background: var(--ground); }
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--accent-soft); color: var(--accent-strong); font-size: 13px; font-weight: 600; flex: none; }
.user-name { font-size: 13.5px; font-weight: 600; }

@media (max-width: 860px) {
  /* จอเล็ก: rail เป็นแถบบนปกติ ไม่ fixed · เลื่อนทั้งหน้า */
  .body { margin-left: 0; padding-top: 0; }
  header { position: static; left: auto; right: auto; height: auto; }
  .rail { position: static; width: auto; height: auto; overflow: visible; border-right: none; border-bottom: 1px solid var(--line); padding: 12px 16px; }
  .brand { padding-bottom: 12px; margin-bottom: 10px; }
  nav { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px; }
  nav a.router-link-active::before { display: none; }
  .soon-group, .admin-group { flex-direction: row; flex-wrap: wrap; align-items: center; margin-top: 0; padding-top: 0; border-top: none; border-left: 1px solid var(--line); padding-left: 10px; margin-left: 4px; }
  .soon-head, .admin-head { display: none; }
  main { padding: 20px 16px; }
}
</style>

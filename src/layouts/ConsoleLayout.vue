<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'
import NavIcon from '@/components/NavIcon.vue'
import ConsoleAssistant from '@/components/ConsoleAssistant.vue'
import { NAV_GROUPS, SOON_ITEMS } from '@/utils/permissionGroups'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const changePasswordOpen = ref(false)

// หมวดที่ไม่มีเมนูที่ผู้ใช้มีสิทธิ์ = ซ่อนทั้งหมวด
const navGroups = computed(() =>
  NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((it) => !it.perms || it.perms.some((p) => auth.can(p))),
  })).filter((g) => g.items.length > 0),
)

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
        <div v-for="g in navGroups" :key="g.title || g.items[0].to" class="nav-group">
          <span v-if="g.title" class="nav-head">{{ g.title }}</span>
          <!-- หน้าลูก (เช่น /offices/:id) ให้เมนูแม่ยังไฮไลต์อยู่ -->
          <RouterLink
            v-for="it in g.items"
            :key="it.to"
            :to="it.to"
            :class="{ 'router-link-active': route.path.startsWith(it.to + '/') }"
          ><NavIcon :name="it.icon" /><span>{{ it.label }}</span></RouterLink>
        </div>
        <div v-if="SOON_ITEMS.length" class="soon-group">
          <span class="soon-head">เร็ว ๆ นี้</span>
          <span v-for="x in SOON_ITEMS" :key="x" class="soon">{{ x }}</span>
        </div>
      </nav>
    </aside>

    <div class="body">
      <header>
        <RouterLink to="/guide" class="guide-link" :class="{ on: route.path === '/guide' }">
          <NavIcon name="guide" />
          <span>คู่มือ</span>
        </RouterLink>
        <span class="head-sep" aria-hidden="true" />
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
    <ConsoleAssistant />
  </div>
</template>

<style scoped>
.shell { display: block; }
/* เมนูซ้ายพื้นเขียวเข้ม (โทนเดียวกับสีหลัก) — แยกจากพื้นที่ทำงานสีสว่างชัด ๆ */
.rail {
  --rail-ink: rgba(255, 255, 255, .86);
  --rail-muted: rgba(214, 238, 232, .52);
  --rail-hover: rgba(255, 255, 255, .07);
  --rail-active: rgba(255, 255, 255, .13);
  --rail-glow: #5fd3bf;
  background:
    radial-gradient(120% 60% at 0% 0%, rgba(95, 211, 191, .16), transparent 60%),
    linear-gradient(180deg, #0f4a44 0%, #0b302d 55%, #092523 100%);
  color: var(--rail-ink); padding: 0;
  /* fixed กับ viewport — นิ่งไม่ขยับเลย · scroll ภายในถ้ายาวเกิน */
  position: fixed; top: 0; left: 0; bottom: 0; width: 248px; z-index: 100; overflow-y: auto;
}

/* เนื้อหาเยื้องให้พ้น rail (ซ้าย) + header (บน) แล้วเลื่อนหน้าปกติ */
.body { margin-left: 248px; padding-top: 62px; min-width: 0; }

/* สูงเท่า header (62px) — เส้นใต้โลโก้ต่อกับเส้นใต้ header เป็นเส้นเดียว */
.brand {
  display: flex; align-items: center; gap: 12px; height: 62px; box-sizing: border-box;
  padding: 0 18px; border-bottom: 1px solid rgba(255, 255, 255, .09);
}
.mark {
  display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex: none;
  border-radius: 11px; color: #fff;
  background: linear-gradient(135deg, #3fbfa9 0%, #148a7b 100%);
  box-shadow: 0 4px 14px rgba(63, 191, 169, .35), inset 0 1px 0 rgba(255, 255, 255, .25);
}
.mark :deep(circle) { fill: #0f4a44; }
.brand-text { display: flex; flex-direction: column; line-height: 1.15; }
.brand-name { font-family: var(--font-head); font-weight: 700; font-size: 17px; letter-spacing: .03em; color: #fff; }
.brand-role { font-size: 12.5px; color: var(--rail-muted); }

nav { display: flex; flex-direction: column; gap: 10px; padding: 14px 12px 24px; }
.nav-group { display: flex; flex-direction: column; gap: 2px; }
/* หัวหมวด: ชิดซ้ายกว่ารายการ สีมิ้นต์สว่าง + เส้นยาวต่อท้าย ให้เห็นว่าเริ่มหมวดใหม่ */
.nav-head {
  display: flex; align-items: center; gap: 10px; padding: 8px 2px 5px;
  font-size: 12.5px; font-weight: 700; letter-spacing: .05em; color: #9fe3d6;
}
.nav-head::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(159, 227, 214, .35), transparent); }
nav a {
  position: relative; display: flex; align-items: center; gap: 12px; height: 42px; padding: 0 12px;
  font-size: 15.5px; text-decoration: none; color: var(--rail-ink); border-radius: 10px;
  transition: background .15s, color .15s, transform .15s;
}
nav a :deep(.nav-icon) { width: 20px; height: 20px; color: var(--rail-muted); transition: color .15s; }
nav a:hover { background: var(--rail-hover); color: #fff; }
nav a:hover :deep(.nav-icon) { color: #fff; }
nav a.router-link-active {
  background: var(--rail-active); color: #fff; font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08);
}
nav a.router-link-active :deep(.nav-icon) { color: var(--rail-glow); }
nav a.router-link-active::before {
  content: ""; position: absolute; left: -12px; top: 9px; bottom: 9px; width: 4px; border-radius: 0 4px 4px 0;
  background: var(--rail-glow); box-shadow: 0 0 12px rgba(95, 211, 191, .7);
}

.soon-group { display: flex; flex-direction: column; gap: 1px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, .09); }
.soon-head { padding: 0 12px 4px; font-size: 11px; color: var(--rail-muted); }
.soon { padding: 7px 12px; font-size: 13px; color: var(--rail-muted); }

header {
  display: flex; gap: 8px; justify-content: flex-end; align-items: center;
  padding: 12px 24px; border-bottom: 1px solid var(--line); background: var(--surface);
  /* fixed บนสุด นิ่งไม่ขยับ (พ้น rail ด้วย left:248px) */
  position: fixed; top: 0; left: 248px; right: 0; height: 62px; z-index: 90; box-sizing: border-box;
}
main { padding: 40px 32px 32px; }
/* เต็มความกว้างจอทุกหน้า
   ห้ามตั้งชื่อ class ว่า "container" — ชนกับ utility ของ Tailwind ที่ใส่ max-width ตาม breakpoint ให้เอง */
.page-wrap { width: 100%; min-width: 0; }

.guide-link {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
  font-size: 13.5px; font-weight: 500; color: var(--muted); text-decoration: none;
  border: 1px solid var(--line); transition: color .12s, border-color .12s, background .12s;
}
.guide-link:hover { color: var(--accent); border-color: var(--accent); }
.guide-link.on { color: var(--accent); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.head-sep { width: 1px; height: 22px; background: var(--line); margin: 0 4px; }
.user-menu { display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--ink); padding: 5px 8px; border-radius: var(--r-control); transition: background .12s; }
.user-menu:hover { background: var(--ground); }
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--accent-soft); color: var(--accent-strong); font-size: 13px; font-weight: 600; flex: none; }
.user-name { font-size: 13.5px; font-weight: 600; }

@media (max-width: 860px) {
  /* จอเล็ก: rail เป็นแถบบนปกติ ไม่ fixed · เลื่อนทั้งหน้า */
  .body { margin-left: 0; padding-top: 0; }
  header { position: static; left: auto; right: auto; height: auto; }
  .rail { position: static; width: auto; height: auto; overflow: visible; padding: 0 0 8px; }
  .brand { height: 56px; }
  nav { padding: 8px 12px 0; }
  nav { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px; }
  .nav-group { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px; }
  .nav-head { display: none; }
  nav a.router-link-active::before { display: none; }
  .soon-group { flex-direction: row; flex-wrap: wrap; align-items: center; padding-top: 0; border-top: none; border-left: 1px solid var(--line); padding-left: 10px; margin-left: 4px; }
  .soon-head { display: none; }
  main { padding: 20px 16px; }
}
</style>

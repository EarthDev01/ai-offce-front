import { createRouter, createWebHistory } from 'vue-router'
import ConsoleLayout from '@/layouts/ConsoleLayout.vue'
import OfficesView from '@/views/offices/OfficesView.vue'
import { useAuthStore } from '@/stores/auth'
import { authStatus } from '@/services/api/auth'
import { startProgress, doneProgress } from '@/composables/routeProgress'
import type { PermissionKey } from '@/services/api/types'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    requiresConsoleAuth?: boolean
    perm?: PermissionKey
  }
}

const LoginView = () => import('@/views/auth/LoginView.vue')
const SetupView = () => import('@/views/auth/SetupView.vue')
const UsersView = () => import('@/views/users/UsersView.vue')
const RolePermissionsView = () => import('@/views/roles/RolePermissionsView.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/setup', name: 'setup', component: SetupView, meta: { public: true } },
    {
      path: '/',
      component: ConsoleLayout,
      children: [
        { path: '', redirect: '/offices' },
        { path: 'offices', name: 'offices', component: OfficesView, meta: { requiresConsoleAuth: true } },
        {
          path: 'users',
          name: 'users',
          component: UsersView,
          meta: { requiresConsoleAuth: true, perm: 'user.manage' },
        },
        {
          path: 'roles',
          name: 'roles',
          component: RolePermissionsView,
          meta: { requiresConsoleAuth: true, perm: 'user.manage' },
        },
        // overview / history / review / quota — Phase 5
      ],
    },
  ],
})

/**
 * ด่านเข้าคอนโซล — ต้อง init store ในนี้ (ตอน beforeEach ทำงาน pinia พร้อมใช้แล้ว)
 * กันวน redirect ด้วยการเช็ค to.path ก่อน return ทุกครั้ง
 */
router.beforeEach(async (to) => {
  startProgress()
  const auth = useAuthStore()

  if (to.meta.public) return true

  if (!auth.isAuthed) {
    let needsSetup = false
    try {
      const status = await authStatus()
      needsSetup = status.needs_setup
    } catch {
      /* เช็ค status ไม่สำเร็จ (เช่น backend ล่ม) — ปล่อยให้ไปหน้า login ตามปกติ */
    }
    if (needsSetup) return to.path === '/setup' ? true : { path: '/setup' }
    return to.path === '/login' ? true : { path: '/login', query: { redirect: to.fullPath } }
  }

  if (!auth.user) {
    try {
      await auth.loadMe()
    } catch {
      auth.logout()
      return to.path === '/login' ? true : { path: '/login', query: { redirect: to.fullPath } }
    }
  }

  if (to.meta.perm && !auth.can(to.meta.perm)) {
    return to.path === '/offices' ? true : { path: '/offices' }
  }

  return true
})

router.afterEach(() => doneProgress())
router.onError(() => doneProgress())

export default router

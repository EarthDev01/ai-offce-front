import { createRouter, createWebHistory } from 'vue-router'
import ConsoleLayout from '@/layouts/ConsoleLayout.vue'
import OfficesOverview from '@/views/offices/OfficesOverview.vue'
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
    /** เข้าได้ถ้ามีสิทธิ์ข้อใดข้อหนึ่ง (หน้าที่มีหลายแท็บ แต่ละแท็บใช้สิทธิ์ต่างกัน) */
    anyPerm?: PermissionKey[]
  }
}

const LoginView = () => import('@/views/auth/LoginView.vue')
const SetupView = () => import('@/views/auth/SetupView.vue')
const UsersView = () => import('@/views/users/UsersView.vue')
const RolePermissionsView = () => import('@/views/roles/RolePermissionsView.vue')
const AuditLogView = () => import('@/views/audit/AuditLogView.vue')
const OverviewView = () => import('@/views/overview/OverviewView.vue')
const HistoryView = () => import('@/views/history/HistoryView.vue')
const ReviewView = () => import('@/views/review/ReviewView.vue')
const UsageView = () => import('@/views/usage/UsageView.vue')
const DeletionView = () => import('@/views/deletion/DeletionView.vue')
const SettingsView = () => import('@/views/settings/SettingsView.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/setup', name: 'setup', component: SetupView, meta: { public: true } },
    {
      path: '/',
      component: ConsoleLayout,
      children: [
        // หน้าแรกหลัง login = ภาพรวม · ไม่มีสิทธิ์ usage.view ด่านข้างล่างพาไป /offices เอง
        { path: '', redirect: '/overview' },
        {
          path: 'overview',
          name: 'overview',
          component: OverviewView,
          meta: { requiresConsoleAuth: true, perm: 'usage.view' },
        },
        { path: 'offices', name: 'offices', component: OfficesOverview, meta: { requiresConsoleAuth: true } },
        { path: 'offices/:id', name: 'office', component: OfficesView, meta: { requiresConsoleAuth: true } },
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
        {
          path: 'activity',
          name: 'activity',
          component: AuditLogView,
          meta: { requiresConsoleAuth: true, perm: 'audit.view' },
        },
        {
          path: 'history',
          name: 'history',
          component: HistoryView,
          meta: { requiresConsoleAuth: true, perm: 'conversation.read' },
        },
        {
          path: 'review',
          name: 'review',
          component: ReviewView,
          meta: { requiresConsoleAuth: true, perm: 'verification.write' },
        },
        {
          path: 'usage',
          name: 'usage',
          component: UsageView,
          meta: { requiresConsoleAuth: true, perm: 'usage.view' },
        },
        {
          path: 'deletion',
          name: 'deletion',
          component: DeletionView,
          meta: { requiresConsoleAuth: true, anyPerm: ['deletion.manage', 'accesslog.view'] },
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingsView,
          meta: { requiresConsoleAuth: true, perm: 'office.view' },
        },
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

  if ((to.meta.perm && !auth.can(to.meta.perm)) || (to.meta.anyPerm && !to.meta.anyPerm.some((p) => auth.can(p)))) {
    return to.path === '/offices' ? true : { path: '/offices' }
  }

  return true
})

router.afterEach(() => doneProgress())
router.onError(() => doneProgress())

export default router

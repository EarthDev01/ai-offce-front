import { createRouter, createWebHistory } from 'vue-router'
import ConsoleLayout from '@/layouts/ConsoleLayout.vue'
import OfficesView from '@/views/offices/OfficesView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: ConsoleLayout,
      children: [
        { path: '', redirect: '/offices' },
        { path: 'offices', name: 'offices', component: OfficesView, meta: { requiresConsoleAuth: true } },
        // overview / history / review / quota — Phase 5
      ],
    },
  ],
})

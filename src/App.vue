<template>
  <a-config-provider
    :theme="{
      token: {
        colorPrimary: '#0f6e63',
        colorLink: '#0f6e63',
        colorError: '#c2453b',
        borderRadius: 9,
        fontFamily: 'IBM Plex Sans Thai, sans-serif',
        fontSize: 14,
        colorTextBase: '#13282b',
        controlHeight: 38,
      },
      components: {
        Button: { primaryShadow: 'none', defaultShadow: 'none', fontWeight: 500 },
      },
    }"
  >
    <RouteProgress />
    <RouterView v-slot="{ Component }">
      <transition name="app-fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>
  </a-config-provider>
</template>

<script setup lang="ts">
import RouteProgress from '@/components/RouteProgress.vue'
</script>

<style>
/* เปลี่ยนหน้า login ↔ console ให้ค่อย ๆ จางแทนการตัดวูบ */
.app-fade-enter-active,
.app-fade-leave-active {
  transition: opacity 0.22s ease;
}
.app-fade-enter-from,
.app-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .app-fade-enter-active,
  .app-fade-leave-active {
    transition: none;
  }
}
</style>

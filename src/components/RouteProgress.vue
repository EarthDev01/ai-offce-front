<script setup lang="ts">
import { progress, active } from '@/composables/routeProgress'
</script>

<template>
  <div
    class="route-progress"
    :class="{ on: active }"
    :style="{ transform: `scaleX(${progress / 100})` }"
    aria-hidden="true"
  ></div>
</template>

<style scoped>
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2.5px;
  z-index: 3000;
  transform-origin: left center;
  transform: scaleX(0);
  background: linear-gradient(90deg, var(--accent), #37a892);
  box-shadow: 0 0 10px rgba(15, 110, 99, 0.45);
  opacity: 0;
  transition: transform 0.2s ease, opacity 0.3s ease;
  pointer-events: none;
}
.route-progress.on {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .route-progress {
    transition: opacity 0.12s ease;
  }
}
</style>

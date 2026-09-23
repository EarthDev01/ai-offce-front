<script setup lang="ts">
import { ref } from 'vue'
import { getConsoleToken, setConsoleToken } from '@/services/api/client'

const token = ref(getConsoleToken())
function saveToken() {
  setConsoleToken(token.value)
  location.reload()
}
</script>

<template>
  <div class="shell">
    <aside class="rail">
      <div class="brand">
        <div class="kicker">AI OFFICE</div>
        <div class="name">คอนโซลผู้ดูแล</div>
      </div>
      <nav>
        <RouterLink to="/offices">Offices &amp; Services</RouterLink>
        <span class="soon">ภาพรวม · Phase 5</span>
        <span class="soon">ประวัติแชท · Phase 5</span>
        <span class="soon">ตรวจคำตอบ · Phase 5</span>
        <span class="soon">โควตา · Phase 5</span>
      </nav>
    </aside>

    <div class="body">
      <header>
        <!-- รอบนี้ auth เป็น static token · ของจริงเป็น JWT คนละชุดกับแอดมินเว็บ -->
        <a-input-password
          v-model:value="token"
          placeholder="console token"
          style="max-width: 260px"
          @press-enter="saveToken"
        />
        <a-button size="small" @click="saveToken">ใช้ token นี้</a-button>
      </header>
      <main><RouterView /></main>
    </div>
  </div>
</template>

<style scoped>
.shell { display: grid; grid-template-columns: 232px minmax(0, 1fr); min-height: 100vh; }
.rail { background: var(--surface); border-right: 1px solid var(--line); padding: 20px 0; }
.brand { padding: 0 18px 16px; border-bottom: 1px solid var(--line); margin-bottom: 10px; }
.kicker { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; color: var(--muted); }
.name { font-family: var(--font-head); font-weight: 700; font-size: 16px; margin-top: 3px; }
nav { display: flex; flex-direction: column; }
nav a, nav .soon { padding: 9px 18px; font-size: 14px; text-decoration: none; color: var(--ink); }
nav a.router-link-active { background: var(--accent-soft); color: var(--accent); font-weight: 600; box-shadow: inset 3px 0 var(--accent); }
nav .soon { color: var(--muted); font-size: 13px; }
header { display: flex; gap: 8px; justify-content: flex-end; align-items: center; padding: 12px 22px; border-bottom: 1px solid var(--line); background: var(--surface); }
main { padding: 22px; }
</style>

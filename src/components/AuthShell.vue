<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="auth-ground">
    <div class="auth-card">
      <header class="brand">
        <span class="mark" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
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
      </header>

      <div class="head">
        <h1 class="title">{{ title }}</h1>
        <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
      </div>

      <div class="content">
        <slot />
      </div>
    </div>
    <p class="foot">AI Office · คอนโซลสำหรับทีมงานภายใน</p>
  </div>
</template>

<style scoped>
.auth-ground {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 40px 16px;
  background:
    radial-gradient(900px 460px at 50% -12%, var(--accent-soft) 0%, transparent 62%),
    linear-gradient(180deg, #f3f6f5 0%, var(--ground) 100%);
}
.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 32px 32px 30px;
  box-shadow: var(--shadow-raise);
}
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding-bottom: 22px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--line);
}
.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: var(--accent);
  color: #fff;
  flex: none;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.brand-name {
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 16px;
  color: var(--ink);
}
.brand-role {
  font-size: 12.5px;
  color: var(--muted);
  margin-top: 1px;
}
.head {
  margin-bottom: 22px;
}
.title {
  font-family: var(--font-head);
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
}
.subtitle {
  margin: 6px 0 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--muted);
}
.foot {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}
</style>

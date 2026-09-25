<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import { getGuide } from '@/services/api/assistant'

// คู่มือใช้งานคอนโซล — ทุกคนที่ล็อกอินเปิดได้ · หัวข้อที่ต้องใช้สิทธิ์บอกไว้ที่หัวข้อนั้น
// เนื้อหามาจาก ai-office-backend/docs/guide.md (แหล่งเดียวกับที่ผู้ช่วย AI ในคอนโซลใช้ตอบ) — แก้คู่มือแก้ที่ไฟล์นั้น
const route = useRoute()

const toc = ref<{ id: string; title: string }[]>([])
const active = ref('')
const loading = ref(true)
const loadError = ref('')
const docEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
}

// "## ชื่อ {#id}" → <h2 id> · แล้วจัดเป็น <section> ละหัวข้อ ให้หน้าตาและสารบัญเหมือนเดิม
function render(md: string) {
  const src = md.replace(/^## (.+?) \{#([\w-]+)\}[ \t]*$/gm, (_, title: string, id: string) => `<h2 id="${id}">${title}</h2>`)
  // เนื้อหามาจากไฟล์ในโค้ดของหลังบ้าน ai เอง (ฝังตอน build) ไม่ใช่ข้อความจากผู้ใช้
  const tpl = document.createElement('div')
  tpl.innerHTML = marked.parse(src, { async: false }) as string

  const sections: HTMLElement[] = []
  let cur: HTMLElement | null = null
  for (const node of Array.from(tpl.childNodes)) {
    if (node instanceof HTMLHeadingElement && node.tagName === 'H2' && node.id) {
      cur = document.createElement('section')
      cur.id = node.id
      node.removeAttribute('id')
      sections.push(cur)
    }
    if (cur) cur.appendChild(node)
  }
  for (const sec of sections) {
    if (sec.id === 'trouble') sec.classList.add('faq')
    else sec.querySelectorAll(':scope > ol').forEach((ol) => ol.classList.add('steps'))
  }
  docEl.value?.replaceChildren(...sections)
  toc.value = sections.map((sec) => {
    const h = sec.querySelector('h2')!.cloneNode(true) as HTMLElement
    h.querySelectorAll('.perm').forEach((p) => p.remove())
    return { id: sec.id, title: (h.textContent ?? '').trim() }
  })
  active.value = toc.value[0]?.id ?? ''
}

function watchScroll() {
  // ไฮไลต์หัวข้อที่กำลังอ่านอยู่ในสารบัญ
  observer = new IntersectionObserver(
    (entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (seen[0]) active.value = seen[0].target.id
    },
    { rootMargin: '-80px 0px -65% 0px' },
  )
  toc.value.forEach((t) => {
    const el = document.getElementById(t.id)
    if (el) observer!.observe(el)
  })
}

onMounted(async () => {
  try {
    const { markdown } = await getGuide()
    loading.value = false
    await nextTick()
    render(markdown)
    await nextTick()
    watchScroll()
    const hash = route.hash.replace('#', '')
    if (hash) document.getElementById(hash)?.scrollIntoView({ block: 'start' })
  } catch (e) {
    loadError.value = (e as Error).message
    loading.value = false
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="page-head">
    <h1>คู่มือการใช้งาน</h1>
    <p class="sub">วิธีติดตั้งผู้ช่วย AI ให้หลังบ้านลูกค้า และการใช้งานแต่ละเมนูของคอนโซล</p>
  </div>

  <a-alert v-if="loadError" type="error" show-icon :message="`โหลดคู่มือไม่ได้: ${loadError}`" />
  <div v-else-if="loading" class="loading-state"><a-spin /></div>

  <div v-show="!loading && !loadError" class="guide">
    <nav class="toc" aria-label="สารบัญ">
      <span class="toc-head">สารบัญ</span>
      <a v-for="t in toc" :key="t.id" :href="`#${t.id}`" :class="{ on: active === t.id }" @click.prevent="go(t.id)">{{ t.title }}</a>
    </nav>

    <article ref="docEl" class="doc" />
  </div>
</template>

<style scoped>
.guide { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 28px; align-items: start; }

.toc { position: sticky; top: 84px; display: flex; flex-direction: column; gap: 2px; }
.toc-head { font-size: 12px; font-weight: 700; color: var(--muted); letter-spacing: .04em; margin: 0 0 6px 12px; }
.toc a {
  font-size: 13.5px; color: var(--muted); text-decoration: none; padding: 6px 12px;
  border-left: 2px solid var(--line); transition: color .12s, border-color .12s, background .12s;
}
.toc a:hover { color: var(--ink); }
.toc a.on { color: var(--accent); border-left-color: var(--accent); font-weight: 600; background: color-mix(in srgb, var(--accent) 6%, transparent); }

.doc { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); padding: 8px 32px 32px; max-width: 860px; }
.doc :deep(section) { padding-top: 24px; scroll-margin-top: 80px; }
.doc :deep(section + section) { border-top: 1px solid var(--line); margin-top: 24px; }
.doc :deep(h2) { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; font-size: 19px; margin: 0 0 10px; }
.doc :deep(.perm) { font-size: 11.5px; font-weight: 500; color: var(--muted); font-family: var(--font-mono); background: var(--ground); border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px; }
.doc :deep(p), .doc :deep(li) { font-size: 14px; line-height: 1.75; color: var(--ink); }
.doc :deep(p) { margin: 0 0 10px; }
.doc :deep(ul), .doc :deep(ol) { margin: 0 0 10px; padding-left: 22px; }
.doc :deep(code) { font-family: var(--font-mono); font-size: 12.5px; background: var(--ground); border: 1px solid var(--line); border-radius: 5px; padding: 0 5px; }
.doc :deep(em) { font-style: normal; font-weight: 600; }
.doc :deep(.note) { font-size: 12.5px; color: var(--muted); line-height: 1.6; }
.doc :deep(blockquote) { font-size: 13px; padding: 10px 14px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 7%, transparent); border-left: 3px solid var(--accent); margin: 6px 0 10px; }

.doc :deep(.tiers) { display: flex; align-items: stretch; gap: 10px; flex-wrap: wrap; margin: 6px 0 18px; }
.doc :deep(.tier) { flex: 1 1 160px; display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--ground); }
.doc :deep(.tier b) { color: var(--accent); font-size: 14.5px; }
.doc :deep(.tier span) { font-size: 12.5px; color: var(--muted); line-height: 1.5; }
.doc :deep(.arrow) { align-self: center; color: var(--muted); font-size: 18px; }

.doc :deep(.steps) { counter-reset: s; list-style: none; padding-left: 0; }
.doc :deep(.steps > li) { counter-increment: s; position: relative; padding-left: 40px; margin-bottom: 12px; }
.doc :deep(.steps > li::before) {
  content: counter(s); position: absolute; left: 0; top: 2px; width: 26px; height: 26px; border-radius: 50%;
  display: grid; place-items: center; font-size: 13px; font-weight: 700; color: #fff; background: var(--accent);
}

.doc :deep(.faq h3) { font-weight: 600; font-size: 14.5px; margin: 14px 0 4px; }
.doc :deep(.faq ol) { margin: 4px 0 6px; }
.doc :deep(blockquote p) { margin: 0; }
.loading-state { display: flex; justify-content: center; align-items: center; min-height: 320px; }

@media (max-width: 900px) {
  .guide { grid-template-columns: 1fr; }
  .toc { position: static; flex-direction: row; flex-wrap: wrap; gap: 6px; }
  .toc-head { display: none; }
  .toc a { border-left: none; border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; font-size: 12.5px; }
  .doc { padding: 4px 18px 24px; }
}
</style>

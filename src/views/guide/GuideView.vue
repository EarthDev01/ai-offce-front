<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

// คู่มือใช้งานคอนโซล — ทุกคนที่ล็อกอินเปิดได้ · หัวข้อที่ต้องใช้สิทธิ์บอกไว้ที่หัวข้อนั้น
const route = useRoute()

const TOC = [
  { id: 'start', title: 'เริ่มต้นติดตั้ง' },
  { id: 'customers', title: 'หลังบ้านลูกค้า' },
  { id: 'overview', title: 'ภาพรวม' },
  { id: 'history', title: 'ประวัติแชท' },
  { id: 'review', title: 'ตรวจคำตอบ' },
  { id: 'usage', title: 'การใช้งาน token' },
  { id: 'deletion', title: 'ลบข้อมูลตามคำขอ' },
  { id: 'admin', title: 'ผู้ใช้และสิทธิ์' },
  { id: 'activity', title: 'ประวัติการทำงาน' },
  { id: 'settings', title: 'ตั้งค่าระบบ' },
  { id: 'trouble', title: 'แก้ปัญหาที่พบบ่อย' },
]

const active = ref(TOC[0].id)
let observer: IntersectionObserver | null = null

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
}

onMounted(async () => {
  await nextTick()
  // ไฮไลต์หัวข้อที่กำลังอ่านอยู่ในสารบัญ
  observer = new IntersectionObserver(
    (entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (seen[0]) active.value = seen[0].target.id
    },
    { rootMargin: '-80px 0px -65% 0px' },
  )
  TOC.forEach((t) => {
    const el = document.getElementById(t.id)
    if (el) observer!.observe(el)
  })
  const hash = route.hash.replace('#', '')
  if (hash) document.getElementById(hash)?.scrollIntoView({ block: 'start' })
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="page-head">
    <h1>คู่มือการใช้งาน</h1>
    <p class="sub">วิธีติดตั้งผู้ช่วย AI ให้หลังบ้านลูกค้า และการใช้งานแต่ละเมนูของคอนโซล</p>
  </div>

  <div class="guide">
    <nav class="toc" aria-label="สารบัญ">
      <span class="toc-head">สารบัญ</span>
      <a v-for="t in TOC" :key="t.id" :href="`#${t.id}`" :class="{ on: active === t.id }" @click.prevent="go(t.id)">{{ t.title }}</a>
    </nav>

    <article class="doc">
      <!-- ---------------- เริ่มต้น ---------------- -->
      <section id="start">
        <h2>เริ่มต้นติดตั้ง</h2>
        <p>ผู้ช่วย AI จัดเป็น 3 ชั้น — ทำตามลำดับนี้ครั้งเดียวต่อหลังบ้านลูกค้า 1 เว็บ</p>
        <div class="tiers">
          <div class="tier"><b>กลุ่ม</b><span>หัวจัดหมวด ตั้งชื่อเอง เช่น ระบบเดียวกันหลายเว็บ</span></div>
          <span class="arrow" aria-hidden="true">→</span>
          <div class="tier"><b>domain</b><span>หลังบ้าน 1 URL มีการตั้งค่าหน้าตาของตัวเอง</span></div>
          <span class="arrow" aria-hidden="true">→</span>
          <div class="tier"><b>service</b><span>แบรนด์/เว็บย่อยใน domain นั้น แชทแยกกัน</span></div>
        </div>
        <ol class="steps">
          <li><b>สร้างกลุ่ม</b> — เมนู <em>หลังบ้านลูกค้า</em> → ปุ่ม "+ สร้างกลุ่ม"</li>
          <li>
            <b>เพิ่ม domain</b> — ในกลุ่มนั้นกด "+ เพิ่ม domain" แล้วใส่ URL ของหลังบ้าน เช่น <code>https://office.example.com</code>
            <div class="note">AI จะขึ้นเฉพาะเว็บที่ URL ตรงกับช่องนี้ · 1 domain ใส่ได้ 1 URL · <code>www.</code> กับไม่มี <code>www.</code> นับเป็นคนละ domain</div>
          </li>
          <li>
            <b>เพิ่ม service</b> — ในหน้าตั้งค่า domain กด "เพิ่ม service"
            <div class="note">รหัส service ต้องตรงกับค่าที่หลังบ้านลูกค้าใช้ระบุเว็บที่แอดมินเลือกอยู่</div>
          </li>
          <li>
            <b>แปะ snippet</b> — คัดลอกบรรทัด <code>&lt;script&gt;</code> จากหน้าตั้งค่า domain ไปแปะในโค้ดหลังบ้านครั้งเดียว
            <div class="note">snippet ชุดเดียวใช้ได้ทุก domain — deploy ไปกี่ URL ก็ได้ ไม่ต้องแก้</div>
          </li>
          <li><b>เปิด service</b> — กดสวิตช์ของ service ให้เป็น "เปิด" แอดมินที่ล็อกอินหลังบ้านและมีสิทธิ์ service นั้นจะเห็นปุ่ม AI ทันที</li>
        </ol>
      </section>

      <!-- ---------------- หลังบ้านลูกค้า ---------------- -->
      <section id="customers">
        <h2>หลังบ้านลูกค้า <span class="perm">office.view · แก้ไขต้องมี office.edit</span></h2>
        <p>หน้ารวมทุกกลุ่ม domain และ service — ค้นได้ทั้งชื่อกลุ่ม URL และชื่อ service</p>
        <ul>
          <li><b>สวิตช์ของ service</b> — ปิดแล้วปุ่ม AI หายจากเว็บนั้นทันที (ระบบถามยืนยันก่อน) เปิดกลับได้ทุกเมื่อ</li>
          <li><b>ปุ่ม ⋯ ของกลุ่ม</b> — เปลี่ยนชื่อ หรือลบกลุ่ม (ลบได้เมื่อไม่มี domain เหลือในกลุ่ม)</li>
          <li><b>ตั้งค่า domain</b> — URL, กลุ่ม, URL API หลังบ้าน (เว้นว่าง = ใช้ <code>&lt;URL ของ domain&gt;/api</code>), ธีม ตำแหน่งปุ่มลอย และซ่อนปุ่มลอย</li>
          <li><b>สวิตช์ "เปิดใช้งาน domain นี้"</b> — สวิตช์ฉุกเฉิน ปิดแล้วทุก service ใน domain ปิดตาม</li>
          <li><b>ตั้งค่า service</b> — ชื่อที่ AI ใช้แสดง รูป และคำทักทายแรก (ต้องบอกว่าเป็นระบบอัตโนมัติ) มีหน้าตัวอย่างให้ดูทางขวา</li>
        </ul>
      </section>

      <!-- ---------------- ภาพรวม ---------------- -->
      <section id="overview">
        <h2>ภาพรวม <span class="perm">usage.view</span></h2>
        <p>สรุป 7 หรือ 30 วันล่าสุด — จำนวนคำถาม token ที่ใช้ ผลตรวจคำตอบ และตารางราย service · เลือกดูเฉพาะ service ได้ที่มุมขวาบน</p>
      </section>

      <!-- ---------------- ประวัติแชท ---------------- -->
      <section id="history">
        <h2>ประวัติแชท <span class="perm">conversation.read</span></h2>
        <p>ค้นบทสนทนาตาม domain, service, ผู้ใช้, ผลตรวจ และช่วงวันที่ · กดแถวเพื่อดูบทสนทนาเต็ม พร้อมการ์ดข้อมูลและเครื่องมือที่ AI เรียกใช้</p>
        <div class="callout">การเปิดอ่านบทสนทนาถูกบันทึกไว้ในบันทึกการเข้าถึงทุกครั้ง</div>
      </section>

      <!-- ---------------- ตรวจคำตอบ ---------------- -->
      <section id="review">
        <h2>ตรวจคำตอบ <span class="perm">verification.write</span></h2>
        <p>คิวคำตอบที่ยังไม่ได้ตรวจ เรียงจากเก่าสุด — เทียบคำตอบกับการ์ดและหน้าจอจริง แล้วกด</p>
        <ul>
          <li><b>ถูก</b> — บันทึกทันที</li>
          <li><b>ผิด</b> — เลือกประเภทที่ผิด และพิมพ์คำตอบที่ถูกต้อง (เก็บไว้เป็นชุดทดสอบ)</li>
        </ul>
        <p>ตัวเลข % ถูกต้องแสดงคู่กับจำนวนที่ยังไม่ตรวจเสมอ — ตรวจน้อย % อาจยังไม่สะท้อนความจริง</p>
      </section>

      <!-- ---------------- การใช้งาน token ---------------- -->
      <section id="usage">
        <h2>การใช้งาน token <span class="perm">usage.view</span></h2>
        <p>
          token ที่ผู้ช่วยใช้ต่อ service — นับจากตัวเลขที่ผู้ให้บริการ LLM ส่งกลับมา (คำตอบ 1 ข้อเรียก LLM 1–2 รอบ)
          · ส่วนบนสรุปรายเดือน ส่วนล่างสรุปรายวันพร้อมจำนวนปฏิเสธ เครื่องมือล้ม และผลตรวจ
        </p>
      </section>

      <!-- ---------------- ลบข้อมูล ---------------- -->
      <section id="deletion">
        <h2>ลบข้อมูลตามคำขอ <span class="perm">deletion.manage · บันทึกการเข้าถึงต้องมี accesslog.view</span></h2>
        <p>ใช้เมื่อเจ้าของข้อมูลขอให้ลบ (PDPA)</p>
        <ol class="steps">
          <li>เลือก domain แล้วระบุอย่างน้อย 1 อย่าง: service, ผู้ใช้ หรือช่วงเวลา (ลบทั้ง domain ครั้งเดียวไม่ได้)</li>
          <li>พิมพ์รหัส domain เพื่อยืนยัน</li>
          <li>ดูผลได้ในตารางคำขอ — ลบแล้วกู้คืนไม่ได้</li>
        </ol>
        <p>แท็บ <em>บันทึกการเข้าถึง</em> บอกว่าใครเปิดอ่านบทสนทนาไหน เมื่อไร</p>
      </section>

      <!-- ---------------- ผู้ใช้และสิทธิ์ ---------------- -->
      <section id="admin">
        <h2>ผู้ใช้และสิทธิ์ <span class="perm">user.manage</span></h2>
        <ul>
          <li><b>ผู้ใช้คอนโซล</b> — เพิ่มผู้ใช้ กำหนดบทบาท ระงับ รีเซ็ตรหัสผ่าน หรือรีเซ็ต 2FA</li>
          <li><b>สิทธิ์ของ role</b> — ติ๊กว่าแต่ละบทบาททำอะไรได้ · แต่ละสิทธิ์บอกว่าเปิดเมนูหรือปุ่มไหน · admin มีทุกสิทธิ์เสมอ</li>
        </ul>
        <p>เปลี่ยนรหัสผ่านของตัวเองได้จากเมนูชื่อผู้ใช้มุมขวาบน</p>
      </section>

      <!-- ---------------- ประวัติการทำงาน ---------------- -->
      <section id="activity">
        <h2>ประวัติการทำงาน <span class="perm">audit.view</span></h2>
        <p>ทุกการแก้ไขในคอนโซล (ใคร ทำอะไร ค่าก่อน/หลัง) รวมถึงการเข้าสู่ระบบและการถูกปฏิเสธสิทธิ์ · กรองตามผู้ใช้ หมวด การกระทำ และช่วงเวลา</p>
      </section>

      <!-- ---------------- ตั้งค่าระบบ ---------------- -->
      <section id="settings">
        <h2>ตั้งค่าระบบ <span class="perm">ดู office.view · แก้ไขต้องมี settings.manage</span></h2>
        <p>มีผลกับทุก domain และ service — บันทึกแล้วใช้กับคำถามถัดไปทันที ไม่ต้อง restart</p>
        <ul>
          <li>
            <b>โมเดล AI</b> — เลือกผู้ให้บริการ โมเดล และระดับการคิด · กด "ทดสอบการเชื่อมต่อ" ก่อนบันทึกได้
            <div class="note">ผู้ให้บริการที่ยังไม่มี API key กดเลือกไม่ได้</div>
          </li>
          <li>
            <b>API key</b> <span class="perm">llm.key.manage</span> — กด "ตั้ง key" / "เปลี่ยน" / "ลบ" ที่การ์ดผู้ให้บริการ แล้วใส่รหัส 2FA จากแอป
            <div class="note">
              ระบบลองเรียกผู้ให้บริการด้วย key ใหม่ก่อน ใช้ไม่ได้จะไม่บันทึก (key เดิมยังใช้ต่อ) · key ถูกเข้ารหัสก่อนเก็บ หน้าเว็บเห็นแค่ 4 ตัวท้าย ·
              ลบ key ของผู้ให้บริการที่แชทใช้อยู่ไม่ได้ ต้องเปลี่ยนโมเดลก่อน · ใส่รหัส 2FA ผิด 5 ครั้ง บัญชีถูกล็อก 15 นาที
            </div>
          </li>
          <li><b>ประสิทธิภาพ</b> — จำนวนคนถามพร้อมกัน เวลารอ LLM ความยาวคำตอบ และจำนวนประวัติที่ส่งให้ LLM</li>
          <li><b>ข้อความ</b> — ช่องทางติดต่อ support ที่ผู้ช่วยบอกเมื่อตอบไม่ได้</li>
        </ul>
        <div class="callout">ถ้ามีคนแก้ไปก่อน ระบบจะไม่ให้บันทึกทับ — กด "โหลดค่าล่าสุด" แล้วแก้ใหม่</div>
      </section>

      <!-- ---------------- แก้ปัญหา ---------------- -->
      <section id="trouble">
        <h2>แก้ปัญหาที่พบบ่อย</h2>
        <dl class="faq">
          <dt>ปุ่ม AI ไม่ขึ้นบนหลังบ้าน</dt>
          <dd>
            ไล่เช็กตามลำดับ:
            <ol>
              <li>URL ของหน้าเว็บตรงกับ "URL ของ domain" ทุกตัวอักษร (รวม <code>https</code> และ <code>www.</code>)</li>
              <li>domain เปิดอยู่ และไม่ได้เปิด "ซ่อนปุ่มลอย"</li>
              <li>service ที่แอดมินเลือกอยู่มีในรายการ service และเปิดอยู่</li>
              <li>แอดมินมีสิทธิ์ service นั้นในหลังบ้านลูกค้า</li>
            </ol>
            เปิด Console ของเบราว์เซอร์ (F12) จะมีข้อความ <code>[ai-office]</code> บอกสาเหตุ
          </dd>
          <dt><code>ORIGIN_NOT_REGISTERED</code></dt>
          <dd>URL ของหน้าเว็บยังไม่ได้ลงทะเบียน — เพิ่มใน "URL ของ domain" หรือสร้าง domain ใหม่สำหรับ URL นั้น</dd>
          <dt>ถามแล้วขึ้น error ทันทีทุกข้อความ (<code>LLM_NOT_CONFIGURED</code>)</dt>
          <dd>โมเดลที่เลือกไว้ไม่มี API key — ดูป้ายสถานะในหน้าตั้งค่าระบบ แล้วตั้ง key ที่การ์ดผู้ให้บริการ หรือเลือกผู้ให้บริการที่มี key</dd>
          <dt>การ์ดผู้ให้บริการขึ้น "ถอดรหัสไม่ได้"</dt>
          <dd>กุญแจหลัก (<code>LLM_KEY_SECRET</code>) ของหลังบ้าน ai ถูกเปลี่ยน — key เดิมใช้ไม่ได้แล้ว ต้องตั้ง key ใหม่</dd>
          <dt>ผู้ช่วยตอบว่า "กำลังตอบคนอื่นอยู่"</dt>
          <dd>มีคนถามพร้อมกันเกินที่ตั้งไว้ — เพิ่ม "คนถามพร้อมกันต่อ service" ในตั้งค่าระบบ</dd>
          <dt>ผู้ช่วยตอบว่า "ไม่ตอบกลับในเวลาที่กำหนด"</dt>
          <dd>LLM ตอบช้ากว่าเวลารอ — กดทดสอบการเชื่อมต่อในตั้งค่าระบบ ถ้าช้าจริงให้เพิ่มเวลารอ หรือลดระดับการคิด</dd>
          <dt>เมนูบางเมนูไม่เห็น</dt>
          <dd>บทบาทของคุณไม่มีสิทธิ์เมนูนั้น — ติดต่อผู้ดูแลให้เพิ่มสิทธิ์ในหน้า "สิทธิ์ของ role"</dd>
        </dl>
      </section>
    </article>
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
section { padding-top: 24px; scroll-margin-top: 80px; }
section + section { border-top: 1px solid var(--line); margin-top: 24px; }
h2 { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; font-size: 19px; margin: 0 0 10px; }
.perm { font-size: 11.5px; font-weight: 500; color: var(--muted); font-family: var(--font-mono); background: var(--ground); border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px; }
p, li, dd { font-size: 14px; line-height: 1.75; color: var(--ink); }
p { margin: 0 0 10px; }
ul, ol { margin: 0 0 10px; padding-left: 22px; }
code { font-family: var(--font-mono); font-size: 12.5px; background: var(--ground); border: 1px solid var(--line); border-radius: 5px; padding: 0 5px; }
em { font-style: normal; font-weight: 600; }
.note { font-size: 12.5px; color: var(--muted); line-height: 1.6; }
.callout { font-size: 13px; padding: 10px 14px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 7%, transparent); border-left: 3px solid var(--accent); margin: 6px 0 10px; }

.tiers { display: flex; align-items: stretch; gap: 10px; flex-wrap: wrap; margin: 6px 0 18px; }
.tier { flex: 1 1 160px; display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--ground); }
.tier b { color: var(--accent); font-size: 14.5px; }
.tier span { font-size: 12.5px; color: var(--muted); line-height: 1.5; }
.arrow { align-self: center; color: var(--muted); font-size: 18px; }

.steps { counter-reset: s; list-style: none; padding-left: 0; }
.steps > li { counter-increment: s; position: relative; padding-left: 40px; margin-bottom: 12px; }
.steps > li::before {
  content: counter(s); position: absolute; left: 0; top: 2px; width: 26px; height: 26px; border-radius: 50%;
  display: grid; place-items: center; font-size: 13px; font-weight: 700; color: #fff; background: var(--accent);
}

.faq dt { font-weight: 600; font-size: 14.5px; margin-top: 14px; }
.faq dd { margin: 4px 0 0; }
.faq dd ol { margin: 4px 0 6px; }

@media (max-width: 900px) {
  .guide { grid-template-columns: 1fr; }
  .toc { position: static; flex-direction: row; flex-wrap: wrap; gap: 6px; }
  .toc-head { display: none; }
  .toc a { border-left: none; border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; font-size: 12.5px; }
  .doc { padding: 4px 18px 24px; }
}
</style>

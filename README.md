# ai-office-report

คอนโซลผู้ดูแลของ AI ผู้ช่วยหลังบ้าน
spec อยู่ที่ `Claude/.workflow/AI Office/04-SPEC-REPORT.md`

## ทำอะไรได้แล้ว (รอบนี้)

หน้า **Offices & Services**

- สร้าง / ลบ / แก้ **office** (= หลังบ้าน 1 ชุด = 1 snippet)
- copy snippet ที่ให้ลูกค้าไปแปะ · **rotate key** (ถามยืนยันก่อน เพราะ snippet เดิมพังทันที)
- โดเมนที่อนุญาต · URL ของ API หลังบ้านเดิม · สวิตช์ฉุกเฉิน · ธีม · ตำแหน่งปุ่มลอย · ซ่อนปุ่ม
- สร้าง / ลบ / แก้ **service** ใต้ office (ชื่อ AI, รูป, คำทักทาย, เปิด-ปิด, allowlist)
- **ตัวอย่างสดที่โหลด bundle ตัวจริง** ผ่าน `data-preview-mount` ไม่ได้เขียน UI จำลองขึ้นใหม่

**ยังไม่มี:** ภาพรวม · ประวัติแชท · ตรวจคำตอบ · โควตา — Phase 5 ของ `05-PLAN.md`

## รัน

ต้องให้ `ai-office-backend` ทำงานอยู่ที่ :6767 ก่อน

```bash
npm install
cp .env.example .env
npm run dev
```

เปิด http://localhost:5173 แล้วใส่ console token (`dev-console-token`) ที่มุมขวาบน

## หมายเหตุ

auth รอบนี้เป็น static token เก็บใน localStorage — ของจริงต้องเป็น JWT คนละชุดกับแอดมินเว็บ
เพราะคอนโซลนี้อ่านข้อมูลข้ามทุก office (`04-SPEC §7`)

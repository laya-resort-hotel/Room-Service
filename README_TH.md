# LAYA Room Service QR v2.3 Multilingual

เวอร์ชันนี้เพิ่มระบบภาษา 4 ภาษาในหน้าลูกค้า:

- ภาษาไทย (TH)
- English (EN)
- 中文 / Chinese (ZH)
- Русский / Russian (RU)

## สิ่งที่เพิ่มใน v2.3

1. ปุ่มเปลี่ยนภาษาที่มุมขวาบนของหน้าลูกค้า
   - กดวนภาษา: TH → EN → 中文 → RU
   - ระบบจำภาษาที่ลูกค้าเลือกไว้ในเครื่องนั้น

2. หน้า Admin เพิ่มช่องข้อมูล 4 ภาษา
   - ชื่อเมนูภาษาไทย
   - Menu name English
   - 中文菜单名称
   - Название на русском
   - รายละเอียด/Description/中文说明/Описание

3. หน้าลูกค้าแสดงชื่อเมนูและรายละเอียดตามภาษาที่เลือก
   - ถ้าภาษาใดยังไม่ได้ใส่ ระบบจะแสดงชื่อไทยหรืออังกฤษแทนชั่วคราว

4. ข้อความหลักในหน้าลูกค้าแปลแล้ว เช่น
   - หน้าแรก / แชท / คำสั่งของฉัน
   - ตะกร้าอาหาร
   - ส่งออเดอร์
   - สถานะออเดอร์
   - ข้อความว่าง / ข้อความแจ้งเตือน

## วิธีอัปเดตบน GitHub

แนะนำให้อัปโหลดไฟล์ทั้งหมดใน ZIP นี้ทับของเดิมใน repo `Room-Service`

ถ้าอยากอัปโหลดเฉพาะไฟล์ที่เกี่ยวกับภาษา ให้ใช้ไฟล์เหล่านี้:

- index.html
- customer.js
- admin.html
- admin.js
- firebase-service.js
- styles.css
- README_TH.md

## วิธีใช้งาน

หน้าลูกค้า:
`https://laya-resort-hotel.github.io/Room-Service/index.html?room=A101`

หน้า Admin:
`https://laya-resort-hotel.github.io/Room-Service/admin.html`

หน้า Staff:
`https://laya-resort-hotel.github.io/Room-Service/staff.html`

หน้า QR:
`https://laya-resort-hotel.github.io/Room-Service/qr.html`

## หมายเหตุ

- Firebase Config ถูกใส่ไว้แล้วใน `firebase-config.js`
- DEMO_MODE ถูกตั้งเป็น `false`
- ถ้าบันทึกไม่ได้ ให้ตรวจ Firestore Rules ก่อน
- งานจริงควรเปลี่ยน PIN ใน `firebase-config.js`

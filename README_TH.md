# LAYA Room Service QR Web App v2

เวอร์ชันนี้ปรับหน้าลูกค้าให้ใกล้เคียงตัวอย่างที่ส่งมา: มี Cover image ด้านบน, การ์ดโรงแรมมุมโค้ง, ไอคอนบริการ, เมนูอาหารแบบเลื่อนแนวนอน, ปุ่มบวกบนการ์ด, แถบล่าง หน้าแรก / แชท / คำสั่งของฉัน

## ไฟล์หลัก

- `index.html` — หน้าลูกค้าหลังสแกน QR เช่น `index.html?room=A101`
- `staff.html` — หน้าพนักงานรับออเดอร์ Realtime + แชท
- `admin.html` — หน้าเพิ่ม/แก้ไขเมนู ราคา รูปภาพ
- `qr.html` — หน้าสร้าง QR Code ตามเลขห้อง
- `firebase-config.js` — ไฟล์ใส่ Firebase Config
- `firebase-service.js` — ระบบเมนู / ออเดอร์ / แชท
- `styles.css` — ดีไซน์ทั้งหมด

## วิธีทดสอบเร็ว

1. เปิด `index.html?room=A101`
2. เลือกเมนู กด `+`
3. กดแถบตะกร้าด้านล่าง
4. ส่งออเดอร์
5. เปิด `staff.html` แล้วใส่ PIN เริ่มต้น `1234`
6. จะเห็นออเดอร์และสามารถเปลี่ยนสถานะ/แชทได้

> โหมดเริ่มต้นคือ `DEMO_MODE = true` ข้อมูลจะเก็บในเครื่อง/browser เดียว เหมาะสำหรับดูหน้าตาและทดลองเร็ว

## ใช้งานจริงแบบ Realtime หลายเครื่อง

1. สร้าง Firebase Project
2. เปิด Cloud Firestore
3. คัดลอก Web Config มาใส่ใน `firebase-config.js`
4. เปลี่ยน `DEMO_MODE = false`
5. Deploy ทั้งโฟลเดอร์ขึ้น GitHub Pages
6. เปิด `qr.html` แล้วใส่ URL จริงของ `index.html`
7. Generate QR ตามเลขห้องและพิมพ์ติดห้องพัก

## แก้เมนูอาหาร

เปิด `admin.html` แล้วใส่ PIN `1234`

สามารถแก้:
- หมวดเมนู เช่น `Room Service`, `Western Food`, `Beverage`
- ชื่อไทย / ชื่ออังกฤษ
- รายละเอียด
- ราคา
- รูปภาพ URL หรืออัปโหลดรูปให้ระบบย่อเป็น Base64
- ลำดับแสดงผล

## หมายเหตุสำหรับงานจริง

- ควรเปลี่ยน `STAFF_PIN` ใน `firebase-config.js` ก่อนใช้งานจริง
- QR ตามเลขห้องอย่างเดียวเดาได้ง่าย ถ้าจะใช้จริงควรเพิ่ม token ต่อห้อง หรือระบบ Login พนักงาน/ลูกค้าในเวอร์ชันถัดไป
- ถ้าต้องการให้เหมือนแอปโรงแรมมากขึ้น ควรเพิ่มหน้า Hotel Info, Housekeeping Request, Maintenance Request, Transportation Booking แยกจาก Chat

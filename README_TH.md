# LAYA Room Service QR v4.3 - SUNMI Legacy Staff Fix

เวอร์ชันนี้แก้ปัญหาเครื่อง SUNMI / Android Browser รุ่นเก่าเปิด Staff Board แล้วค้างที่ `กำลังโหลดออเดอร์...`

## สาเหตุ
เครื่อง SUNMI บางรุ่นใช้ Chrome/WebView เก่า ทำให้ไม่รองรับ `type="module"` และ Firebase SDK รุ่นใหม่แบบ ES Module เต็มรูปแบบ หน้าเว็บจึงแสดงผลได้ แต่ JavaScript สำหรับโหลดออเดอร์ไม่ทำงาน

## สิ่งที่แก้ใน v4.3
- เปลี่ยนหน้า `staff.html` เป็นโหมด Legacy สำหรับ SUNMI
- ใช้ Firebase SDK v8 แบบ script ธรรมดา ไม่ใช้ `type="module"`
- เพิ่มไฟล์ `firebase-config-legacy.js`
- เพิ่มไฟล์ `staff-legacy.js`
- ไม่มี PIN Staff Login
- ถ้า Firestore อ่านไม่ได้ จะแสดง error บนหน้า ไม่ค้างเงียบ
- ยังรองรับออเดอร์, เปลี่ยนสถานะ, แชท, ปิดแชท, เสียงแจ้งเตือน, Auto Print และพิมพ์ Order Ticket

## ไฟล์ที่ต้องอัปโหลดทับ GitHub
อย่างน้อยอัปโหลด 3 ไฟล์นี้:

- `staff.html`
- `staff-legacy.js`
- `firebase-config-legacy.js`

ถ้ามีไฟล์เสียงแจ้งเตือนอยู่แล้ว ไม่ต้องอัปโหลดใหม่ แต่ถ้ายังไม่มีให้อัปโหลด `alert-sound.mp3` ด้วย

## หลังอัปโหลด
1. รอ GitHub Pages deploy
2. เปิดบนเครื่อง SUNMI:
   `https://laya-resort-hotel.github.io/Room-Service/staff.html`
3. ปิด/เปิด Browser ใหม่ หรือกด Reload
4. ถ้ายังขึ้น error ให้ดูข้อความในกล่องด้านบน จะบอกว่าเป็นปัญหา Firebase Rules หรืออินเทอร์เน็ต


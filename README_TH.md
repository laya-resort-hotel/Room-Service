# LAYA Room Service QR v4.1 - SUNMI Staff Login Fix

เวอร์ชันนี้แก้ปัญหาหน้า Staff Board บนเครื่อง SUNMI / Android Browser บางรุ่น กดปุ่ม Login แล้วไม่เข้าใช้งาน

## สิ่งที่แก้
- เปลี่ยน Staff Login เป็น `<form>` เพื่อให้กดปุ่ม Enter/Done แล้วเข้าได้
- เพิ่ม event รองรับ `click`, `touchend`, `pointerup` สำหรับจอสัมผัส SUNMI
- ปรับให้ตรวจ PIN แบบ trim ช่องว่าง
- ถ้าไฟล์ `firebase-config.js` เก่าไม่มี `STAFF_PIN` ระบบจะ fallback เป็น `1234`
- กันระบบ start ซ้ำเมื่อ touch/click เกิดซ้ำ

## ไฟล์ที่ต้องอัปโหลดทับ
อัปโหลดเฉพาะไฟล์นี้ก็พอ:
- `staff.html`
- `staff.js`

## PIN เริ่มต้น
- `1234`

หลังอัปโหลดให้เปิดหน้า `staff.html` แล้วกด Refresh / Ctrl+F5 หรือปิดเปิด Browser บนเครื่อง SUNMI ใหม่

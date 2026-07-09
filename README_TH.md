# LAYA Room Service QR v2.4 - Firebase Storage

เวอร์ชันนี้เพิ่มระบบอัปโหลดรูปเมนูเข้า **Firebase Storage** แล้วเก็บเฉพาะ URL ของรูปไว้ใน Firestore
ทำให้ฐานข้อมูลเบากว่าแบบ Base64 และเหมาะกับงานจริงมากขึ้น

## ไฟล์สำคัญ
- `index.html` หน้าลูกค้า
- `staff.html` หน้าพนักงานรับออเดอร์/แชท
- `admin.html` หน้าแอดมินเพิ่ม/แก้ไขเมนู 4 ภาษา + อัปโหลดรูป
- `qr.html` หน้าสร้าง QR ตามเลขห้อง
- `firebase-config.js` ตั้งค่า Firebase
- `firestore-rules.txt` Rules สำหรับ Firestore
- `storage-rules.txt` Rules สำหรับ Firebase Storage

## วิธีอัปเดตบน GitHub
อัปโหลดไฟล์ทั้งหมดใน ZIP นี้ทับของเดิมใน repo `Room-Service` แล้วรอ GitHub Pages deploy 1-3 นาที

ถ้าต้องอัปโหลดเฉพาะไฟล์สำคัญ ให้ทับไฟล์เหล่านี้:
- `admin.html`
- `admin.js`
- `firebase-service.js`
- `styles.css`
- `storage-rules.txt`

## ต้องเปิด Firebase Storage
1. เข้า Firebase Console
2. เลือกโปรเจกต์ `roomservice-3f58c`
3. ไปที่ Build > Storage
4. กด Get started / Create bucket
5. ไปที่แท็บ Rules
6. คัดลอกจาก `storage-rules.txt` ไปวาง แล้วกด Publish

## วิธีใช้
1. เข้า `admin.html`
2. เพิ่มเมนูหรือกดแก้ไขเมนูเดิม
3. เลือกรูปจากเครื่องในช่อง “อัปโหลดรูปภาพไป Firebase Storage”
4. กดบันทึก
5. ระบบจะย่อรูปก่อน แล้วอัปโหลดเข้า Storage จากนั้นบันทึก URL ลง Firestore

## ย้ายรูป Base64 เดิม
ถ้าเคยบันทึกรูปแบบ Base64 ไว้แล้ว ให้เข้า `admin.html` แล้วกดปุ่ม:

**ย้ายรูป Base64 ไป Storage**

ระบบจะไล่ย้ายรูปเดิมทีละรายการ แล้วอัปเดต URL ให้เอง

## หมายเหตุความปลอดภัย
Rules ที่ให้มาเป็นแบบเปิดสำหรับทดสอบเท่านั้น งานจริงควรเพิ่ม Firebase Authentication และจำกัดสิทธิ์ให้เฉพาะ Admin/Staff เท่านั้น

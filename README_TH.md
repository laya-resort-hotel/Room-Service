# LAYA Room Service QR v4.2 — No Staff PIN

เวอร์ชันนี้ปิดหน้า Staff Login แล้ว เพื่อให้เครื่อง SUNMI เปิด Staff Board ได้ทันทีโดยไม่ต้องใส่รหัส PIN

## สิ่งที่แก้
- ปิด PIN Gate ใน `staff.html`
- `staff.js` เรียกเปิด Staff Board อัตโนมัติ
- เหมาะสำหรับเครื่อง SUNMI ที่กดปุ่ม Login แล้วไม่ทำงาน

## ไฟล์ที่ต้องอัปโหลดทับ
- `staff.html`
- `staff.js`

หลังอัปโหลดขึ้น GitHub แล้ว ให้เปิด `staff.html` บนเครื่อง SUNMI แล้วกด Refresh หรือปิด/เปิด Browser ใหม่

หมายเหตุ: การเอารหัสออกเหมาะกับการใช้งานภายในเท่านั้น ถ้าจะใช้งานจริงระยะยาว ควรทำ Login ที่เสถียรกว่าแบบ PIN เช่น Firebase Authentication หรือจำกัดสิทธิ์ตามเครื่อง/บัญชีพนักงาน

import { HOTEL_NAME, STAFF_PIN } from './firebase-config.js';
import { isDemo, listenMenu, saveMenuItem, removeMenuItem, seedSampleMenuToFirebase, thb } from './firebase-service.js';

const $ = id => document.getElementById(id);
let menu = [];

$('hotelName').textContent = HOTEL_NAME;
if (isDemo) { $('modePill').classList.remove('hidden'); $('modePill').classList.add('demo'); $('modePill').textContent = 'Demo Mode'; }

function unlock() { sessionStorage.setItem('layaAdminOk', '1'); $('pinGate').classList.add('hidden'); start(); }
if (sessionStorage.getItem('layaAdminOk') === '1') unlock();
$('pinBtn').addEventListener('click', () => { if ($('pinInput').value === STAFF_PIN) unlock(); else $('pinErr').classList.remove('hidden'); });
$('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('pinBtn').click(); });

function start() {
  setAdminStatus('กำลังเชื่อมต่อ Firebase / โหลดเมนู...', 'info');
  listenMenu((items) => {
    menu = items;
    renderTable();
    setAdminStatus(isDemo ? 'กำลังใช้งาน Demo Mode' : 'เชื่อมต่อ Firebase แล้ว สามารถบันทึก/แก้ไขเมนูได้', 'good');
  }, true, (err) => {
    console.error(err);
    setAdminStatus('โหลดข้อมูลจาก Firebase ไม่ได้: ' + friendlyFirebaseError(err), 'bad');
    $('menuCount').textContent = 'โหลดเมนูไม่ได้';
    $('menuTable').innerHTML = '<tr><td colspan="6" class="empty">กรุณาตรวจ Firestore Database และ Rules ใน Firebase</td></tr>';
  });
}

$('menuForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = $('saveBtn');
  const editing = Boolean($('itemId').value);
  const oldText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = editing ? 'กำลังอัปเดต...' : 'กำลังบันทึก...';
  setAdminStatus(editing ? 'กำลังอัปเดตเมนู...' : 'กำลังบันทึกเมนู...', 'info');
  const item = {
    id: $('itemId').value || null,
    category: $('category').value.trim(),
    nameTh: $('nameTh').value.trim(),
    nameEn: $('nameEn').value.trim(),
    description: $('description').value.trim(),
    price: Number($('price').value || 0),
    sort: Number($('sort').value || 999),
    image: $('image').value.trim(),
    active: $('active') ? $('active').checked : true
  };
  try {
    await saveMenuItem(item);
    resetForm();
    setAdminStatus(editing ? 'แก้ไขเมนูสำเร็จแล้ว' : 'บันทึกเมนูสำเร็จแล้ว', 'good');
    alert(editing ? 'แก้ไขเมนูสำเร็จแล้ว' : 'บันทึกเมนูสำเร็จแล้ว');
  } catch (err) {
    console.error(err);
    setAdminStatus('บันทึกไม่ได้: ' + friendlyFirebaseError(err), 'bad');
    alert('บันทึกไม่ได้: ' + friendlyFirebaseError(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = oldText;
  }
});
$('resetForm').addEventListener('click', resetForm);
$('seedMenu').addEventListener('click', async () => {
  try {
    setAdminStatus('กำลังใส่เมนูตัวอย่าง...', 'info');
    await seedSampleMenuToFirebase();
    setAdminStatus('ใส่เมนูตัวอย่างแล้ว', 'good');
    alert('ใส่เมนูตัวอย่างแล้ว');
  } catch (err) {
    console.error(err);
    setAdminStatus('ใส่เมนูตัวอย่างไม่ได้: ' + friendlyFirebaseError(err), 'bad');
    alert('ใส่เมนูตัวอย่างไม่ได้: ' + friendlyFirebaseError(err));
  }
});
$('image').addEventListener('input', updatePreview);
$('imageUpload').addEventListener('change', async () => {
  const file = $('imageUpload').files?.[0];
  if (!file) return;
  try {
    setAdminStatus('กำลังย่อรูปภาพ...', 'info');
    const dataUrl = await resizeImageToLimit(file, 650000);
    $('image').value = dataUrl;
    updatePreview();
    setAdminStatus(`ใส่รูปแล้ว ขนาดประมาณ ${Math.round(dataUrl.length / 1024)} KB`, 'good');
  } catch (err) {
    console.error(err);
    setAdminStatus('รูปใหญ่เกินไป แนะนำใช้รูป URL หรืออัปโหลดรูปที่เล็กกว่า', 'bad');
    alert('รูปใหญ่เกินไป แนะนำใช้รูป URL หรืออัปโหลดรูปที่เล็กกว่า');
  }
});

function renderTable() {
  $('menuCount').textContent = `มีเมนูทั้งหมด ${menu.length} รายการ`;
  if (!menu.length) { $('menuTable').innerHTML = '<tr><td colspan="6" class="empty">ยังไม่มีเมนู</td></tr>'; return; }
  $('menuTable').innerHTML = menu.map(item => `<tr>
    <td><img class="menu-admin-img" src="${escapeHtml(item.image || '')}" onerror="this.style.display='none'" /></td>
    <td><strong>${escapeHtml(item.nameTh || item.nameEn)}</strong><br><small style="color:var(--muted)">${escapeHtml(item.nameEn || '')}</small><br><small style="color:var(--muted)">${escapeHtml(item.description || '')}</small></td>
    <td>${escapeHtml(item.category || '')}<br><small style="color:var(--muted)">ลำดับ ${Number(item.sort ?? 999)}</small></td>
    <td>${thb(item.price)}</td>
    <td>${item.active === false ? '<span class="status-pill off">ปิดขาย</span>' : '<span class="status-pill">เปิดขาย</span>'}</td>
    <td><div class="action-stack"><button class="secondary" data-edit="${item.id}">✏️ แก้ไขข้อมูล/รูป</button><button class="danger" data-del="${item.id}">🗑️ ลบ</button></div></td>
  </tr>`).join('');
  document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => editItem(btn.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (confirm('ลบเมนูนี้?')) {
      try { await removeMenuItem(btn.dataset.del); setAdminStatus('ลบเมนูแล้ว', 'good'); }
      catch (err) { setAdminStatus('ลบไม่ได้: ' + friendlyFirebaseError(err), 'bad'); alert('ลบไม่ได้: ' + friendlyFirebaseError(err)); }
    }
  }));
}
function editItem(id) {
  const item = menu.find(x => x.id === id);
  if (!item) return;
  $('formTitle').textContent = 'แก้ไขเมนู: ' + (item.nameTh || item.nameEn || '');
  $('editHint').classList.remove('hidden');
  $('saveBtn').textContent = 'บันทึกการแก้ไข';
  $('itemId').value = item.id;
  $('category').value = item.category || '';
  $('nameTh').value = item.nameTh || '';
  $('nameEn').value = item.nameEn || '';
  $('description').value = item.description || '';
  $('price').value = item.price || 0;
  $('sort').value = item.sort || 999;
  $('image').value = item.image || '';
  if ($('active')) $('active').checked = item.active !== false;
  updatePreview();
  setAdminStatus('กำลังแก้ไขเมนูเดิม เปลี่ยนข้อมูลหรือเลือกรูปใหม่ แล้วกด “บันทึกการแก้ไข”', 'info');
  window.scrollTo({top:0, behavior:'smooth'});
  setTimeout(() => $('nameTh').focus(), 250);
}
function resetForm() {
  $('formTitle').textContent = 'เพิ่มเมนูใหม่';
  $('editHint').classList.add('hidden');
  $('saveBtn').textContent = 'บันทึกเมนูใหม่';
  $('menuForm').reset();
  $('itemId').value = '';
  $('sort').value = 999;
  if ($('active')) $('active').checked = true;
  updatePreview();
}
function updatePreview() {
  const src = $('image').value.trim();
  if (!src) { $('imagePreviewWrap').classList.add('hidden'); $('imagePreview').removeAttribute('src'); return; }
  $('imagePreview').src = src;
  $('imagePreviewWrap').classList.remove('hidden');
}
async function resizeImageToLimit(file, maxChars=650000) {
  let width = 720;
  let quality = .68;
  let dataUrl = '';
  for (let i = 0; i < 6; i++) {
    dataUrl = await resizeImage(file, width, quality);
    if (dataUrl.length <= maxChars) return dataUrl;
    width = Math.round(width * .75);
    quality = Math.max(.45, quality - .06);
  }
  if (dataUrl.length > maxChars) throw new Error('image-too-large');
  return dataUrl;
}

function resizeImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function setAdminStatus(message, type='info') {
  let box = document.getElementById('adminStatus');
  if (!box) {
    box = document.createElement('div');
    box.id = 'adminStatus';
    box.className = 'notice';
    const formTitle = document.getElementById('formTitle');
    formTitle.insertAdjacentElement('afterend', box);
    box.style.marginBottom = '12px';
  }
  box.className = 'notice' + (type === 'bad' ? ' bad' : type === 'good' ? ' good' : '');
  box.textContent = message;
}

function friendlyFirebaseError(err) {
  const code = err?.code || '';
  const msg = String(err?.message || err || 'Unknown error');
  if (code.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
    return 'Firebase Rules ยังไม่อนุญาตให้เขียน/อ่านข้อมูล ให้ไป Firestore Database > Rules แล้ว Publish rules สำหรับทดสอบ';
  }
  if (code.includes('not-found') || msg.includes('database') || msg.includes('Cloud Firestore')) {
    return 'ยังไม่ได้สร้าง Cloud Firestore Database ใน Firebase project นี้';
  }
  if (code.includes('resource-exhausted') || msg.includes('too large') || msg.includes('maximum')) {
    return 'ข้อมูลหรือรูปภาพใหญ่เกินไป ให้ใช้รูป URL หรือรูปที่เล็กลง';
  }
  if (code.includes('unavailable') || code.includes('deadline-exceeded')) {
    return 'เชื่อมต่อ Firebase ไม่ได้ชั่วคราว กรุณาลองใหม่';
  }
  return code ? `${code}: ${msg}` : msg;
}

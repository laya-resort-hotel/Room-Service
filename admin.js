import { HOTEL_NAME, STAFF_PIN } from './firebase-config.js';
import { isDemo, listenMenu, saveMenuItem, removeMenuItem, seedSampleMenuToFirebase, uploadMenuImage, thb } from './firebase-service.js';

const $ = id => document.getElementById(id);
let menu = [];
let pendingImageUpload = null;
let pendingPreviewUrl = '';
let currentImageStoragePath = '';

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
  submitBtn.textContent = pendingImageUpload ? 'กำลังอัปโหลดรูป...' : (editing ? 'กำลังอัปเดต...' : 'กำลังบันทึก...');
  setAdminStatus(pendingImageUpload ? 'กำลังอัปโหลดรูปไป Firebase Storage...' : (editing ? 'กำลังอัปเดตเมนู...' : 'กำลังบันทึกเมนู...'), 'info');

  let imageUrl = $('image').value.trim();
  let imageStoragePath = currentImageStoragePath;

  try {
    if (pendingImageUpload) {
      const uploaded = await uploadMenuImage(pendingImageUpload.blob, pendingImageUpload.filename);
      imageUrl = uploaded.url;
      imageStoragePath = uploaded.path;
      $('image').value = imageUrl;
      submitBtn.textContent = editing ? 'กำลังอัปเดต...' : 'กำลังบันทึก...';
      setAdminStatus('อัปโหลดรูปสำเร็จ กำลังบันทึกข้อมูลเมนู...', 'good');
    }

    const item = {
      id: $('itemId').value || null,
      category: $('category').value.trim(),
      nameTh: $('nameTh').value.trim(),
      nameEn: $('nameEn').value.trim(),
      nameZh: $('nameZh').value.trim(),
      nameRu: $('nameRu').value.trim(),
      description: $('descriptionTh').value.trim(),
      descriptionTh: $('descriptionTh').value.trim(),
      descriptionEn: $('descriptionEn').value.trim(),
      descriptionZh: $('descriptionZh').value.trim(),
      descriptionRu: $('descriptionRu').value.trim(),
      price: Number($('price').value || 0),
      sort: Number($('sort').value || 999),
      image: imageUrl,
      imageStoragePath,
      active: $('active') ? $('active').checked : true
    };

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

$('image').addEventListener('input', () => {
  clearPendingUpload(false);
  currentImageStoragePath = '';
  updatePreview();
});

$('imageUpload').addEventListener('change', async () => {
  const file = $('imageUpload').files?.[0];
  if (!file) return;
  try {
    setAdminStatus('กำลังย่อรูปภาพก่อนอัปโหลด...', 'info');
    const blob = await resizeImageToBlob(file, 1280, 0.78);
    clearPendingUpload(false);
    pendingPreviewUrl = URL.createObjectURL(blob);
    pendingImageUpload = { blob, filename: file.name || 'menu-image.jpg' };
    updatePreview();
    setAdminStatus(`เลือกรูปแล้ว ขนาดหลังย่อประมาณ ${Math.round(blob.size / 1024)} KB กดบันทึกเพื่ออัปโหลดไป Firebase Storage`, 'good');
  } catch (err) {
    console.error(err);
    setAdminStatus('ย่อรูปไม่ได้ กรุณาลองเลือกรูปอื่น หรือใช้รูป URL แทน', 'bad');
    alert('ย่อรูปไม่ได้ กรุณาลองเลือกรูปอื่น หรือใช้รูป URL แทน');
  }
});

const migrateBtn = $('migrateImages');
if (migrateBtn) {
  migrateBtn.addEventListener('click', async () => {
    const targets = menu.filter(item => isBase64Image(item.image));
    if (!targets.length) { alert('ไม่มีรูป Base64 ที่ต้องย้าย'); return; }
    if (!confirm(`พบรูป Base64 ${targets.length} รายการ ต้องการย้ายไป Firebase Storage ตอนนี้ไหม?`)) return;
    migrateBtn.disabled = true;
    try {
      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        setAdminStatus(`กำลังย้ายรูป ${i + 1}/${targets.length}: ${item.nameTh || item.nameEn || item.id}`, 'info');
        const blob = dataUrlToBlob(item.image);
        const uploaded = await uploadMenuImage(blob, `${item.nameEn || item.nameTh || item.id || 'menu'}.jpg`);
        await saveMenuItem({ ...item, image: uploaded.url, imageStoragePath: uploaded.path });
      }
      setAdminStatus('ย้ายรูป Base64 ไป Firebase Storage สำเร็จแล้ว', 'good');
      alert('ย้ายรูปสำเร็จแล้ว');
    } catch (err) {
      console.error(err);
      setAdminStatus('ย้ายรูปไม่ได้: ' + friendlyFirebaseError(err), 'bad');
      alert('ย้ายรูปไม่ได้: ' + friendlyFirebaseError(err));
    } finally {
      migrateBtn.disabled = false;
    }
  });
}

function renderTable() {
  $('menuCount').textContent = `มีเมนูทั้งหมด ${menu.length} รายการ`;
  if (!menu.length) { $('menuTable').innerHTML = '<tr><td colspan="6" class="empty">ยังไม่มีเมนู</td></tr>'; return; }
  $('menuTable').innerHTML = menu.map(item => `<tr>
    <td><img class="menu-admin-img" src="${escapeHtml(item.image || '')}" onerror="this.style.display='none'" /></td>
    <td><strong>TH: ${escapeHtml(item.nameTh || '')}</strong><br><small style="color:var(--muted)">EN: ${escapeHtml(item.nameEn || '')}</small><br><small style="color:var(--muted)">中文: ${escapeHtml(item.nameZh || '')}</small><br><small style="color:var(--muted)">RU: ${escapeHtml(item.nameRu || '')}</small><br><small style="color:var(--muted)">${escapeHtml(item.descriptionTh || item.description || '')}</small><br>${imageTypeBadge(item)}</td>
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

function imageTypeBadge(item) {
  if (!item.image) return '<small class="img-badge warn">ไม่มีรูป</small>';
  if (isBase64Image(item.image)) return '<small class="img-badge bad">Base64 ใน Firestore — ควรย้าย</small>';
  if (item.imageStoragePath || String(item.image).includes('firebasestorage.googleapis.com')) return '<small class="img-badge good">Firebase Storage</small>';
  return '<small class="img-badge">URL ภายนอก</small>';
}

function editItem(id) {
  const item = menu.find(x => x.id === id);
  if (!item) return;
  clearPendingUpload(false);
  $('formTitle').textContent = 'แก้ไขเมนู: ' + (item.nameTh || item.nameEn || '');
  $('editHint').classList.remove('hidden');
  $('saveBtn').textContent = 'บันทึกการแก้ไข';
  $('itemId').value = item.id;
  $('category').value = item.category || '';
  $('nameTh').value = item.nameTh || '';
  $('nameEn').value = item.nameEn || '';
  $('nameZh').value = item.nameZh || '';
  $('nameRu').value = item.nameRu || '';
  $('descriptionTh').value = item.descriptionTh || item.description || '';
  $('descriptionEn').value = item.descriptionEn || '';
  $('descriptionZh').value = item.descriptionZh || '';
  $('descriptionRu').value = item.descriptionRu || '';
  $('price').value = item.price || 0;
  $('sort').value = item.sort || 999;
  $('image').value = item.image || '';
  currentImageStoragePath = item.imageStoragePath || '';
  if ($('active')) $('active').checked = item.active !== false;
  updatePreview();
  setAdminStatus('กำลังแก้ไขเมนูเดิม หากต้องการเปลี่ยนรูป ให้เลือกรูปใหม่ แล้วกด “บันทึกการแก้ไข”', 'info');
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
  currentImageStoragePath = '';
  clearPendingUpload(false);
  updatePreview();
}

function updatePreview() {
  const src = pendingPreviewUrl || $('image').value.trim();
  if (!src) { $('imagePreviewWrap').classList.add('hidden'); $('imagePreview').removeAttribute('src'); return; }
  $('imagePreview').src = src;
  $('imagePreviewWrap').classList.remove('hidden');
}

function clearPendingUpload(clearFileInput=true) {
  pendingImageUpload = null;
  if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
  pendingPreviewUrl = '';
  if (clearFileInput && $('imageUpload')) $('imageUpload').value = '';
}

function resizeImageToBlob(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('image-convert-failed')), 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = String(dataUrl).split(',');
  const mime = (header.match(/data:(.*?);base64/) || [])[1] || 'image/jpeg';
  const binary = atob(data || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type:mime });
}

function isBase64Image(value) { return String(value || '').startsWith('data:image/'); }
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
  if (code.includes('permission-denied') || code.includes('unauthorized') || msg.includes('Missing or insufficient permissions')) {
    return 'Firebase Rules ยังไม่อนุญาตให้เขียน/อ่านข้อมูล ให้ตรวจทั้ง Firestore Rules และ Storage Rules แล้วกด Publish';
  }
  if (code.includes('storage/unauthorized')) {
    return 'Storage Rules ยังไม่อนุญาตให้อัปโหลดรูป ให้ไป Firebase Storage > Rules แล้ว Publish rules สำหรับทดสอบ';
  }
  if (code.includes('storage/unknown') || code.includes('storage/bucket-not-found')) {
    return 'ยังไม่ได้เปิด Firebase Storage หรือ bucket ไม่ถูกต้อง';
  }
  if (code.includes('not-found') || msg.includes('database') || msg.includes('Cloud Firestore')) {
    return 'ยังไม่ได้สร้าง Cloud Firestore Database ใน Firebase project นี้';
  }
  if (code.includes('resource-exhausted') || msg.includes('too large') || msg.includes('maximum')) {
    return 'ข้อมูลหรือรูปภาพใหญ่เกินไป';
  }
  if (code.includes('unavailable') || code.includes('deadline-exceeded')) {
    return 'เชื่อมต่อ Firebase ไม่ได้ชั่วคราว กรุณาลองใหม่';
  }
  return code ? `${code}: ${msg}` : msg;
}

import { HOTEL_NAME, STAFF_PIN } from './firebase-config.js';
import { isDemo, listenMenu, listenSiteSettings, saveSiteSettings, saveMenuItem, removeMenuItem, seedSampleMenuToFirebase, uploadMenuImage, uploadSiteImage, DEFAULT_SITE_SETTINGS, thb } from './firebase-service.js';

const $ = id => document.getElementById(id);
let menu = [];
let pendingImageUpload = null;
let pendingPreviewUrl = '';
let currentImageStoragePath = '';
let currentCoverStoragePath = '';
let pendingCoverUpload = null;
let pendingCoverPreviewUrl = '';
let currentSiteSettings = { ...DEFAULT_SITE_SETTINGS };
let siteSettingsUnsub = null;

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
  if (siteSettingsUnsub) siteSettingsUnsub();
  siteSettingsUnsub = listenSiteSettings((settings) => {
    currentSiteSettings = { ...DEFAULT_SITE_SETTINGS, ...settings };
    renderSiteSettingsForm();
  }, (err) => {
    console.error(err);
    setSiteStatus('โหลดการตั้งค่า Cover ไม่ได้: ' + friendlyFirebaseError(err), 'bad');
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


const translateFormMissingBtn = $('translateFormMissing');
const translateFormOverwriteBtn = $('translateFormOverwrite');
const translateAllMissingBtn = $('translateAllMissing');
const translateAllOverwriteBtn = $('translateAllOverwrite');
const autoTranslateToggle = $('autoTranslateToggle');
let autoTranslateTimer = null;
let autoTranslating = false;

if (translateFormMissingBtn) {
  translateFormMissingBtn.addEventListener('click', () => translateCurrentForm(false, { silent:false }));
}
if (translateFormOverwriteBtn) {
  translateFormOverwriteBtn.addEventListener('click', () => {
    if (!confirm('แปลใหม่ทับช่องภาษาอังกฤษ จีน และรัสเซียในฟอร์มนี้ใช่ไหม?')) return;
    translateCurrentForm(true, { silent:false });
  });
}
if (translateAllMissingBtn) {
  translateAllMissingBtn.addEventListener('click', () => translateAllExistingMenu(false));
}
if (translateAllOverwriteBtn) {
  translateAllOverwriteBtn.addEventListener('click', () => translateAllExistingMenu(true));
}
['nameTh', 'descriptionTh'].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input', () => scheduleAutoTranslate());
  el.addEventListener('blur', () => {
    if (autoTranslateToggle?.checked) translateCurrentForm(true, { silent:true, auto:true });
  });
});

function scheduleAutoTranslate() {
  if (!autoTranslateToggle?.checked) return;
  clearTimeout(autoTranslateTimer);
  autoTranslateTimer = setTimeout(() => translateCurrentForm(true, { silent:true, auto:true }), 900);
}

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


const coverImageUrlEl = $('coverImageUrl');
const coverImageUploadEl = $('coverImageUpload');
const saveSiteSettingsBtn = $('saveSiteSettings');
const resetCoverDefaultBtn = $('resetCoverDefault');

if (coverImageUrlEl) {
  coverImageUrlEl.addEventListener('input', () => {
    clearPendingCoverUpload(false);
    currentCoverStoragePath = '';
    updateCoverPreview();
  });
}
if (coverImageUploadEl) {
  coverImageUploadEl.addEventListener('change', async () => {
    const file = coverImageUploadEl.files?.[0];
    if (!file) return;
    try {
      setSiteStatus('กำลังย่อรูป Cover ก่อนอัปโหลด...', 'info');
      const blob = await resizeImageToBlob(file, 1600, 0.82);
      clearPendingCoverUpload(false);
      pendingCoverPreviewUrl = URL.createObjectURL(blob);
      pendingCoverUpload = { blob, filename:file.name || 'cover.jpg' };
      updateCoverPreview();
      setSiteStatus(`เลือกรูป Cover แล้ว ขนาดหลังย่อประมาณ ${Math.round(blob.size / 1024)} KB กด “บันทึกรูป Cover” เพื่อใช้งาน`, 'good');
    } catch (err) {
      console.error(err);
      setSiteStatus('ย่อรูป Cover ไม่ได้ กรุณาลองรูปอื่น', 'bad');
      alert('ย่อรูป Cover ไม่ได้ กรุณาลองรูปอื่น');
    }
  });
}
if (saveSiteSettingsBtn) {
  saveSiteSettingsBtn.addEventListener('click', async () => {
    const oldText = saveSiteSettingsBtn.textContent;
    saveSiteSettingsBtn.disabled = true;
    saveSiteSettingsBtn.textContent = pendingCoverUpload ? 'กำลังอัปโหลด Cover...' : 'กำลังบันทึก...';
    try {
      let coverImage = coverImageUrlEl?.value.trim() || DEFAULT_SITE_SETTINGS.coverImage;
      let coverImageStoragePath = currentCoverStoragePath;
      if (pendingCoverUpload) {
        const uploaded = await uploadSiteImage(pendingCoverUpload.blob, pendingCoverUpload.filename);
        coverImage = uploaded.url;
        coverImageStoragePath = uploaded.path;
        if (coverImageUrlEl) coverImageUrlEl.value = coverImage;
        saveSiteSettingsBtn.textContent = 'กำลังบันทึก...';
      }
      const hotelName = $('siteHotelName')?.value.trim() || HOTEL_NAME || DEFAULT_SITE_SETTINGS.hotelName;
      await saveSiteSettings({ hotelName, coverImage, coverImageStoragePath, coverAlt:hotelName });
      currentCoverStoragePath = coverImageStoragePath;
      clearPendingCoverUpload(true);
      updateCoverPreview();
      setSiteStatus('บันทึก Cover สำเร็จแล้ว หน้า QR ลูกค้าจะเปลี่ยนตาม Realtime', 'good');
      alert('บันทึก Cover สำเร็จแล้ว');
    } catch (err) {
      console.error(err);
      setSiteStatus('บันทึก Cover ไม่ได้: ' + friendlyFirebaseError(err), 'bad');
      alert('บันทึก Cover ไม่ได้: ' + friendlyFirebaseError(err));
    } finally {
      saveSiteSettingsBtn.disabled = false;
      saveSiteSettingsBtn.textContent = oldText;
    }
  });
}
if (resetCoverDefaultBtn) {
  resetCoverDefaultBtn.addEventListener('click', async () => {
    if (!confirm('ต้องการกลับไปใช้รูป Cover เริ่มต้นใช่ไหม?')) return;
    try {
      await saveSiteSettings({ ...currentSiteSettings, coverImage:DEFAULT_SITE_SETTINGS.coverImage, coverImageStoragePath:'' });
      currentCoverStoragePath = '';
      clearPendingCoverUpload(true);
      setSiteStatus('กลับไปใช้รูป Cover เริ่มต้นแล้ว', 'good');
    } catch (err) {
      console.error(err);
      setSiteStatus('เปลี่ยนรูปเริ่มต้นไม่ได้: ' + friendlyFirebaseError(err), 'bad');
    }
  });
}

function renderSiteSettingsForm() {
  if ($('siteHotelName')) $('siteHotelName').value = currentSiteSettings.hotelName || HOTEL_NAME || DEFAULT_SITE_SETTINGS.hotelName;
  if (coverImageUrlEl) coverImageUrlEl.value = currentSiteSettings.coverImage || DEFAULT_SITE_SETTINGS.coverImage;
  currentCoverStoragePath = currentSiteSettings.coverImageStoragePath || '';
  if ($('hotelName')) $('hotelName').textContent = currentSiteSettings.hotelName || HOTEL_NAME;
  updateCoverPreview();
}

function updateCoverPreview() {
  const src = pendingCoverPreviewUrl || coverImageUrlEl?.value.trim() || '';
  if (!$('coverPreviewWrap') || !$('coverPreview')) return;
  if (!src) { $('coverPreviewWrap').classList.add('hidden'); $('coverPreview').removeAttribute('src'); return; }
  $('coverPreview').src = src;
  $('coverPreviewWrap').classList.remove('hidden');
}

function clearPendingCoverUpload(clearFileInput=true) {
  pendingCoverUpload = null;
  if (pendingCoverPreviewUrl) URL.revokeObjectURL(pendingCoverPreviewUrl);
  pendingCoverPreviewUrl = '';
  if (clearFileInput && coverImageUploadEl) coverImageUploadEl.value = '';
}

function setSiteStatus(message, type='info') {
  const box = $('siteSettingsStatus');
  if (!box) return;
  box.className = 'notice' + (type === 'bad' ? ' bad' : type === 'good' ? ' good' : type === 'warn' ? ' warn' : '');
  box.textContent = message;
  box.classList.remove('hidden');
}

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


const TRANSLATION_TARGETS = [
  { label:'อังกฤษ', api:'en', nameId:'nameEn', descId:'descriptionEn', nameKey:'nameEn', descKey:'descriptionEn' },
  { label:'จีน', api:'zh-CN', nameId:'nameZh', descId:'descriptionZh', nameKey:'nameZh', descKey:'descriptionZh' },
  { label:'รัสเซีย', api:'ru', nameId:'nameRu', descId:'descriptionRu', nameKey:'nameRu', descKey:'descriptionRu' }
];
const translateCache = new Map();

async function translateCurrentForm(overwrite=false, options={}) {
  if (autoTranslating) return;
  const silent = Boolean(options.silent);
  const sourceName = $('nameTh').value.trim();
  const sourceDesc = $('descriptionTh').value.trim();
  const tasks = [];

  for (const target of TRANSLATION_TARGETS) {
    if (sourceName && (overwrite || !$(target.nameId).value.trim())) tasks.push({ inputId:target.nameId, source:sourceName, target, field:'ชื่อเมนู' });
    if (sourceDesc && (overwrite || !$(target.descId).value.trim())) tasks.push({ inputId:target.descId, source:sourceDesc, target, field:'รายละเอียด' });
  }

  if (!tasks.length) {
    if (!silent) {
      setTranslateStatus('ไม่มีช่องว่างให้แปล ถ้าต้องการแปลใหม่ให้กด “แปลใหม่ทับภาษาอื่น”', 'info');
      alert('ไม่มีช่องว่างให้แปล');
    }
    return;
  }

  autoTranslating = true;
  setTranslateButtonsDisabled(true);
  try {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      setTranslateStatus(`กำลังแปล${task.field}เป็นภาษา${task.target.label} (${i + 1}/${tasks.length})...`, 'info');
      $(task.inputId).value = await translateText(task.source, task.target.api);
      await sleep(150);
    }
    setTranslateStatus('แปลภาษาในฟอร์มเสร็จแล้ว กรุณาตรวจคำแปลก่อนบันทึก', 'good');
    if (!silent) alert('แปลภาษาในฟอร์มเสร็จแล้ว กรุณาตรวจคำแปลก่อนบันทึก');
  } catch (err) {
    console.error(err);
    setTranslateStatus('แปลภาษาไม่ได้: ' + (err?.message || err), 'bad');
    if (!silent) alert('แปลภาษาไม่ได้: ' + (err?.message || err));
  } finally {
    autoTranslating = false;
    setTranslateButtonsDisabled(false);
  }
}

async function translateAllExistingMenu(overwrite=false) {
  if (!menu.length) { alert('ยังไม่มีเมนูให้แปล'); return; }
  const targets = overwrite
    ? menu.filter(item => String(item.nameTh || item.descriptionTh || item.description || '').trim())
    : menu.filter(item => menuNeedsTranslation(item));
  if (!targets.length) { alert(overwrite ? 'ไม่พบเมนูที่มีภาษาไทยสำหรับแปล' : 'เมนูทั้งหมดมีคำแปลครบแล้ว หรือไม่มีชื่อภาษาไทยให้ใช้แปล'); return; }
  const message = overwrite
    ? `พบเมนูที่มีภาษาไทย ${targets.length} รายการ ต้องการแปลใหม่ทับภาษาอังกฤษ/จีน/รัสเซียทั้งหมดไหม?\n\nเหมาะสำหรับแก้เมนูที่เคยแปลผิด หรือชื่อไทยเปลี่ยนแล้วภาษาอื่นยังเป็นชื่อเก่า`
    : `พบเมนูที่ยังแปลไม่ครบ ${targets.length} รายการ ต้องการแปลช่องที่ว่างทั้งหมดตอนนี้ไหม?\n\nระบบจะไม่ทับช่องที่คุณกรอกไว้แล้ว`;
  if (!confirm(message)) return;

  if (translateAllMissingBtn) translateAllMissingBtn.disabled = true;
  if (translateAllOverwriteBtn) translateAllOverwriteBtn.disabled = true;
  setTranslateButtonsDisabled(true);
  let updated = 0;
  try {
    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      const title = item.nameTh || item.nameEn || item.id;
      setTranslateStatus(`${overwrite ? 'กำลังแปลใหม่ทับเมนูเดิม' : 'กำลังแปลเมนูเดิม'} ${i + 1}/${targets.length}: ${title}`, 'info');
      const patch = await buildTranslatedMenuPatch(item, overwrite);
      if (patch.changed) {
        await saveMenuItem(patch.item);
        updated++;
        await sleep(350);
      }
    }
    setTranslateStatus(`แปลเมนูเดิมเสร็จแล้ว อัปเดต ${updated} รายการ`, 'good');
    alert(`แปลเมนูเดิมเสร็จแล้ว อัปเดต ${updated} รายการ\nกรุณารีเฟรชหน้าและตรวจคำแปลอีกครั้ง`);
  } catch (err) {
    console.error(err);
    setTranslateStatus('แปลเมนูเดิมไม่ได้: ' + (err?.message || friendlyFirebaseError(err)), 'bad');
    alert('แปลเมนูเดิมไม่ได้: ' + (err?.message || friendlyFirebaseError(err)));
  } finally {
    if (translateAllMissingBtn) translateAllMissingBtn.disabled = false;
    if (translateAllOverwriteBtn) translateAllOverwriteBtn.disabled = false;
    setTranslateButtonsDisabled(false);
  }
}

function menuNeedsTranslation(item) {
  const sourceName = String(item.nameTh || '').trim();
  const sourceDesc = String(item.descriptionTh || item.description || '').trim();
  if (!sourceName && !sourceDesc) return false;
  for (const target of TRANSLATION_TARGETS) {
    if (sourceName && !String(item[target.nameKey] || '').trim()) return true;
    if (sourceDesc && !String(item[target.descKey] || '').trim()) return true;
  }
  return false;
}

async function buildTranslatedMenuPatch(item, overwrite=false) {
  const next = { ...item };
  let changed = false;
  const sourceName = String(item.nameTh || '').trim();
  const sourceDesc = String(item.descriptionTh || item.description || '').trim();

  for (const target of TRANSLATION_TARGETS) {
    if (sourceName && (overwrite || !String(next[target.nameKey] || '').trim())) {
      next[target.nameKey] = await translateText(sourceName, target.api);
      changed = true;
      await sleep(120);
    }
    if (sourceDesc && (overwrite || !String(next[target.descKey] || '').trim())) {
      next[target.descKey] = await translateText(sourceDesc, target.api);
      changed = true;
      await sleep(120);
    }
  }
  return { item:next, changed };
}

async function translateText(text, targetLang) {
  const sourceText = String(text || '').trim();
  if (!sourceText) return '';
  const cacheKey = `th|${targetLang}|${sourceText}`;
  if (translateCache.has(cacheKey)) return translateCache.get(cacheKey);

  // First use a hotel/Thai-food glossary. Public translation APIs often mistranslate menu names
  // such as "ข้าวกระเพราเนื้อ" as literal/awkward words. The glossary keeps food names consistent.
  const glossaryTranslation = translateThaiMenuWithGlossary(sourceText, targetLang);
  if (glossaryTranslation) {
    translateCache.set(cacheKey, glossaryTranslation);
    return glossaryTranslation;
  }

  let translated = '';
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sourceText)}&langpair=th|${encodeURIComponent(targetLang)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      translated = decodeHtml(data?.responseData?.translatedText || '').trim();
    }
  } catch (err) {
    console.warn('MyMemory translate failed, trying fallback', err);
  }

  if (!translated || translated.toLowerCase() === sourceText.toLowerCase() || translated.includes('NO QUERY SPECIFIED')) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=th&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(sourceText)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        translated = (data?.[0] || []).map(part => part?.[0] || '').join('').trim();
      }
    } catch (err) {
      console.warn('Fallback translate failed', err);
    }
  }

  if (!translated) throw new Error('เชื่อมต่อบริการแปลภาษาไม่ได้ กรุณาตรวจอินเทอร์เน็ต หรือลองใหม่อีกครั้ง');
  translateCache.set(cacheKey, translated);
  return translated;
}

function normalizeThaiText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[ๆฯ,.()\[\]{}:;!?'"“”‘’\-_/\\]/g, '')
    .replace(/กระเพรา/g, 'กะเพรา')
    .replace(/กระเพา/g, 'กะเพรา')
    .replace(/กระเพา/g, 'กะเพรา')
    .replace(/กระเพาะ/g, 'กะเพรา')
    .replace(/กระเพร่า/g, 'กะเพรา');
}

function translateThaiMenuWithGlossary(text, targetLang) {
  const source = String(text || '').trim();
  const key = normalizeThaiText(source);
  if (!key) return '';

  const exact = MENU_TRANSLATION_GLOSSARY[key];
  if (exact) return exact[targetLang] || exact.en || '';

  const ruleBased = translateThaiMenuByRules(key, targetLang);
  if (ruleBased) return ruleBased;

  return '';
}

const MENU_TRANSLATION_GLOSSARY = {
  'ข้าวผัดกะเพราหมู': {
    en: 'Pork Fried Rice with Holy Basil',
    'zh-CN': '泰式罗勒猪肉炒饭',
    ru: 'Жареный рис со свининой и тайским базиликом'
  },
  'ข้าวผัดกะเพราไก่': {
    en: 'Chicken Fried Rice with Holy Basil',
    'zh-CN': '泰式罗勒鸡肉炒饭',
    ru: 'Жареный рис с курицей и тайским базиликом'
  },
  'ข้าวผัดกะเพราเนื้อ': {
    en: 'Beef Fried Rice with Holy Basil',
    'zh-CN': '泰式罗勒牛肉炒饭',
    ru: 'Жареный рис с говядиной и тайским базиликом'
  },
  'ข้าวผัดกะเพรากุ้ง': {
    en: 'Prawn Fried Rice with Holy Basil',
    'zh-CN': '泰式罗勒虾仁炒饭',
    ru: 'Жареный рис с креветками и тайским базиликом'
  },
  'ข้าวผัดกะเพราทะเล': {
    en: 'Seafood Fried Rice with Holy Basil',
    'zh-CN': '泰式罗勒海鲜炒饭',
    ru: 'Жареный рис с морепродуктами и тайским базиликом'
  },
  'ข้าวกะเพราเนื้อ': {
    en: 'Stir-fried Beef with Holy Basil on Rice',
    'zh-CN': '泰式罗勒炒牛肉盖饭',
    ru: 'Рис с говядиной и тайским базиликом'
  },
  'ข้าวกะเพราหมู': {
    en: 'Stir-fried Pork with Holy Basil on Rice',
    'zh-CN': '泰式罗勒炒猪肉盖饭',
    ru: 'Рис со свининой и тайским базиликом'
  },
  'ข้าวกะเพราไก่': {
    en: 'Stir-fried Chicken with Holy Basil on Rice',
    'zh-CN': '泰式罗勒炒鸡肉盖饭',
    ru: 'Рис с курицей и тайским базиликом'
  },
  'ข้าวกะเพรากุ้ง': {
    en: 'Stir-fried Prawns with Holy Basil on Rice',
    'zh-CN': '泰式罗勒炒虾盖饭',
    ru: 'Рис с креветками и тайским базиликом'
  },
  'ข้าวกะเพราทะเล': {
    en: 'Stir-fried Seafood with Holy Basil on Rice',
    'zh-CN': '泰式罗勒炒海鲜盖饭',
    ru: 'Рис с морепродуктами и тайским базиликом'
  },
  'ผัดไทยกุ้ง': {
    en: 'Pad Thai with Prawns',
    'zh-CN': '泰式炒河粉配虾',
    ru: 'Пад тай с креветками'
  },
  'ผัดไทยไก่': {
    en: 'Pad Thai with Chicken',
    'zh-CN': '泰式炒河粉配鸡肉',
    ru: 'Пад тай с курицей'
  },
  'กุ้งสะโหร่ง': {
    en: 'Goong Sa-Rong (Crispy Prawns Wrapped in Vermicelli)',
    'zh-CN': '酥炸粉丝裹虾',
    ru: 'Креветки в хрустящей вермишели'
  },
  'ต้มยำกุ้ง': {
    en: 'Tom Yum Goong',
    'zh-CN': '冬阴功虾汤',
    ru: 'Том ям с креветками'
  },
  'ต้มยำทะเล': {
    en: 'Tom Yum Seafood',
    'zh-CN': '冬阴功海鲜汤',
    ru: 'Том ям с морепродуктами'
  },
  'ต้มข่าไก่': {
    en: 'Chicken Coconut Soup with Galangal',
    'zh-CN': '南姜椰奶鸡汤',
    ru: 'Куриный суп с кокосовым молоком и галангалом'
  },
  'ข้าวผัดไก่': {
    en: 'Chicken Fried Rice',
    'zh-CN': '鸡肉炒饭',
    ru: 'Жареный рис с курицей'
  },
  'ข้าวผัดหมู': {
    en: 'Pork Fried Rice',
    'zh-CN': '猪肉炒饭',
    ru: 'Жареный рис со свининой'
  },
  'ข้าวผัดเนื้อ': {
    en: 'Beef Fried Rice',
    'zh-CN': '牛肉炒饭',
    ru: 'Жареный рис с говядиной'
  },
  'ข้าวผัดกุ้ง': {
    en: 'Prawn Fried Rice',
    'zh-CN': '虾仁炒饭',
    ru: 'Жареный рис с креветками'
  },
  'ข้าวผัดทะเล': {
    en: 'Seafood Fried Rice',
    'zh-CN': '海鲜炒饭',
    ru: 'Жареный рис с морепродуктами'
  },
  'ส้มตำไทย': {
    en: 'Thai Papaya Salad',
    'zh-CN': '泰式青木瓜沙拉',
    ru: 'Тайский салат из папайи'
  },
  'ส้มตำกุ้งสด': {
    en: 'Papaya Salad with Fresh Prawns',
    'zh-CN': '鲜虾青木瓜沙拉',
    ru: 'Салат из папайи со свежими креветками'
  },
  'ลาบหมู': {
    en: 'Spicy Minced Pork Salad',
    'zh-CN': '香辣猪肉末沙拉',
    ru: 'Острый салат из рубленой свинины'
  },
  'ลาบไก่': {
    en: 'Spicy Minced Chicken Salad',
    'zh-CN': '香辣鸡肉末沙拉',
    ru: 'Острый салат из рубленой курицы'
  },
  'แกงเขียวหวานไก่': {
    en: 'Green Curry with Chicken',
    'zh-CN': '鸡肉绿咖喱',
    ru: 'Зеленое карри с курицей'
  },
  'แกงเขียวหวานเนื้อ': {
    en: 'Green Curry with Beef',
    'zh-CN': '牛肉绿咖喱',
    ru: 'Зеленое карри с говядиной'
  },
  'มัสมั่นไก่': {
    en: 'Massaman Curry with Chicken',
    'zh-CN': '马萨曼鸡肉咖喱',
    ru: 'Массаман карри с курицей'
  },
  'มัสมั่นเนื้อ': {
    en: 'Massaman Curry with Beef',
    'zh-CN': '马萨曼牛肉咖喱',
    ru: 'Массаман карри с говядиной'
  },
  'ไก่ผัดเม็ดมะม่วง': {
    en: 'Stir-fried Chicken with Cashew Nuts',
    'zh-CN': '腰果炒鸡肉',
    ru: 'Курица с кешью'
  },
  'ปอเปี๊ยะทอด': {
    en: 'Crispy Spring Rolls',
    'zh-CN': '炸春卷',
    ru: 'Жареные спринг-роллы'
  },
  'เฟรนช์ฟรายส์': {
    en: 'French Fries',
    'zh-CN': '炸薯条',
    ru: 'Картофель фри'
  },
  'สปาเก็ตตี้คาโบนาร่า': {
    en: 'Spaghetti Carbonara',
    'zh-CN': '培根蛋黄酱意大利面',
    ru: 'Спагетти карбонара'
  },
  'สปาเก็ตตี้โบโลเนส': {
    en: 'Spaghetti Bolognese',
    'zh-CN': '肉酱意大利面',
    ru: 'Спагетти болоньезе'
  },
  'คลับแซนด์วิช': {
    en: 'Club Sandwich',
    'zh-CN': '总汇三明治',
    ru: 'Клаб-сэндвич'
  },
  'ซีซาร์สลัด': {
    en: 'Caesar Salad',
    'zh-CN': '凯撒沙拉',
    ru: 'Салат Цезарь'
  },
  'เบอร์เกอร์เนื้อ': {
    en: 'Beef Burger',
    'zh-CN': '牛肉汉堡',
    ru: 'Бургер с говядиной'
  },
  'เบอร์เกอร์ไก่': {
    en: 'Chicken Burger',
    'zh-CN': '鸡肉汉堡',
    ru: 'Бургер с курицей'
  }
};

const PROTEIN_MAP = {
  'ไก่': { en:'Chicken', zh:'鸡肉', ruWith:'с курицей', ruPlain:'курицей' },
  'หมู': { en:'Pork', zh:'猪肉', ruWith:'со свининой', ruPlain:'свининой' },
  'เนื้อ': { en:'Beef', zh:'牛肉', ruWith:'с говядиной', ruPlain:'говядиной' },
  'กุ้ง': { en:'Prawns', zh:'虾', ruWith:'с креветками', ruPlain:'креветками' },
  'ทะเล': { en:'Seafood', zh:'海鲜', ruWith:'с морепродуктами', ruPlain:'морепродуктами' },
  'ปลาหมึก': { en:'Squid', zh:'鱿鱼', ruWith:'с кальмарами', ruPlain:'кальмарами' },
  'ปลา': { en:'Fish', zh:'鱼', ruWith:'с рыбой', ruPlain:'рыбой' },
  'ผัก': { en:'Vegetables', zh:'蔬菜', ruWith:'с овощами', ruPlain:'овощами' }
};

function translateThaiMenuByRules(key, targetLang) {
  let match;

  // ข้าวผัดกะเพรา/กระเพรา + protein = basil fried rice, not normal fried rice.
  // Example: ข้าวผัดกะเพราหมู -> Pork Fried Rice with Holy Basil
  match = key.match(/^ข้าวผัดกะเพรา(.+)$/);
  if (match) {
    const protein = PROTEIN_MAP[match[1]];
    if (protein) {
      if (targetLang === 'en') return `${protein.en} Fried Rice with Holy Basil`;
      if (targetLang === 'zh-CN') return `泰式罗勒${protein.zh}炒饭`;
      if (targetLang === 'ru') return `Жареный рис ${protein.ruWith} и тайским базиликом`;
    }
  }

  // ข้าวกะเพรา/ข้าวกระเพรา + protein = stir-fried basil topping on rice.
  match = key.match(/^ข้าวกะเพรา(.+)$/);
  if (match) {
    const protein = PROTEIN_MAP[match[1]];
    if (protein) {
      if (targetLang === 'en') return `Stir-fried ${protein.en} with Holy Basil on Rice`;
      if (targetLang === 'zh-CN') return `泰式罗勒炒${protein.zh}盖饭`;
      if (targetLang === 'ru') return `Рис ${protein.ruWith} и тайским базиликом`;
    }
  }

  match = key.match(/^ข้าวผัด(.+)$/);
  if (match) {
    const protein = PROTEIN_MAP[match[1]];
    if (protein) {
      if (targetLang === 'en') return `${protein.en} Fried Rice`;
      if (targetLang === 'zh-CN') return `${protein.zh}炒饭`;
      if (targetLang === 'ru') return `Жареный рис ${protein.ruWith}`;
    }
  }

  match = key.match(/^ผัดไทย(.+)$/);
  if (match) {
    const protein = PROTEIN_MAP[match[1]];
    if (protein) {
      if (targetLang === 'en') return `Pad Thai with ${protein.en}`;
      if (targetLang === 'zh-CN') return `泰式炒河粉配${protein.zh}`;
      if (targetLang === 'ru') return `Пад тай ${protein.ruWith}`;
    }
  }

  match = key.match(/^ต้มยำ(.+)$/);
  if (match) {
    const protein = PROTEIN_MAP[match[1]];
    if (protein) {
      if (targetLang === 'en') return `Tom Yum with ${protein.en}`;
      if (targetLang === 'zh-CN') return `冬阴功${protein.zh}汤`;
      if (targetLang === 'ru') return `Том ям ${protein.ruWith}`;
    }
  }

  return '';
}

function decodeHtml(value) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(value || '');
  return textarea.value;
}

function setTranslateButtonsDisabled(disabled) {
  [translateFormMissingBtn, translateFormOverwriteBtn, translateAllMissingBtn, translateAllOverwriteBtn].forEach(btn => { if (btn) btn.disabled = disabled; });
}

function setTranslateStatus(message, type='info') {
  const box = $('translateStatus');
  if (!box) return;
  box.className = 'notice' + (type === 'bad' ? ' bad' : type === 'good' ? ' good' : '');
  box.textContent = message;
  box.classList.remove('hidden');
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

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

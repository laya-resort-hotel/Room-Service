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


const translateFormMissingBtn = $('translateFormMissing');
const translateFormOverwriteBtn = $('translateFormOverwrite');
const translateAllMissingBtn = $('translateAllMissing');
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
  translateAllMissingBtn.addEventListener('click', () => translateAllExistingMenu());
}
['nameTh', 'descriptionTh'].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input', () => scheduleAutoTranslate());
  el.addEventListener('blur', () => {
    if (autoTranslateToggle?.checked) translateCurrentForm(false, { silent:true });
  });
});

function scheduleAutoTranslate() {
  if (!autoTranslateToggle?.checked) return;
  clearTimeout(autoTranslateTimer);
  autoTranslateTimer = setTimeout(() => translateCurrentForm(false, { silent:true }), 1200);
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

async function translateAllExistingMenu() {
  if (!menu.length) { alert('ยังไม่มีเมนูให้แปล'); return; }
  const targets = menu.filter(item => menuNeedsTranslation(item));
  if (!targets.length) { alert('เมนูทั้งหมดมีคำแปลครบแล้ว หรือไม่มีชื่อภาษาไทยให้ใช้แปล'); return; }
  if (!confirm(`พบเมนูที่ยังแปลไม่ครบ ${targets.length} รายการ ต้องการแปลช่องที่ว่างทั้งหมดตอนนี้ไหม?\n\nระบบจะไม่ทับช่องที่คุณกรอกไว้แล้ว`)) return;

  translateAllMissingBtn.disabled = true;
  setTranslateButtonsDisabled(true);
  let updated = 0;
  try {
    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      const title = item.nameTh || item.nameEn || item.id;
      setTranslateStatus(`กำลังแปลเมนูเดิม ${i + 1}/${targets.length}: ${title}`, 'info');
      const patch = await buildTranslatedMenuPatch(item, false);
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
    translateAllMissingBtn.disabled = false;
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

function decodeHtml(value) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(value || '');
  return textarea.value;
}

function setTranslateButtonsDisabled(disabled) {
  [translateFormMissingBtn, translateFormOverwriteBtn, translateAllMissingBtn].forEach(btn => { if (btn) btn.disabled = disabled; });
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

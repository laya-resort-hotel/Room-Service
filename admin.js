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

function start() { listenMenu((items) => { menu = items; renderTable(); }, true); }

$('menuForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = {
    id: $('itemId').value || null,
    category: $('category').value.trim(),
    nameTh: $('nameTh').value.trim(),
    nameEn: $('nameEn').value.trim(),
    description: $('description').value.trim(),
    price: Number($('price').value || 0),
    sort: Number($('sort').value || 999),
    image: $('image').value.trim(),
    active: true
  };
  await saveMenuItem(item);
  resetForm();
});
$('resetForm').addEventListener('click', resetForm);
$('seedMenu').addEventListener('click', async () => { await seedSampleMenuToFirebase(); alert('ใส่เมนูตัวอย่างแล้ว'); });
$('imageUpload').addEventListener('change', async () => {
  const file = $('imageUpload').files?.[0];
  if (!file) return;
  const dataUrl = await resizeImage(file, 800, .72);
  $('image').value = dataUrl;
});

function renderTable() {
  $('menuCount').textContent = `มีเมนูทั้งหมด ${menu.length} รายการ`;
  if (!menu.length) { $('menuTable').innerHTML = '<tr><td colspan="5" class="empty">ยังไม่มีเมนู</td></tr>'; return; }
  $('menuTable').innerHTML = menu.map(item => `<tr>
    <td><img class="menu-admin-img" src="${escapeHtml(item.image || '')}" onerror="this.style.display='none'" /></td>
    <td><strong>${escapeHtml(item.nameTh || item.nameEn)}</strong><br><small style="color:var(--muted)">${escapeHtml(item.description || '')}</small></td>
    <td>${escapeHtml(item.category || '')}</td>
    <td>${thb(item.price)}</td>
    <td style="white-space:nowrap"><button class="secondary" data-edit="${item.id}">แก้ไข</button> <button class="danger" data-del="${item.id}">ลบ</button></td>
  </tr>`).join('');
  document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => editItem(btn.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (confirm('ลบเมนูนี้?')) await removeMenuItem(btn.dataset.del);
  }));
}
function editItem(id) {
  const item = menu.find(x => x.id === id);
  if (!item) return;
  $('formTitle').textContent = 'แก้ไขเมนู';
  $('itemId').value = item.id;
  $('category').value = item.category || '';
  $('nameTh').value = item.nameTh || '';
  $('nameEn').value = item.nameEn || '';
  $('description').value = item.description || '';
  $('price').value = item.price || 0;
  $('sort').value = item.sort || 999;
  $('image').value = item.image || '';
  window.scrollTo({top:0, behavior:'smooth'});
}
function resetForm() {
  $('formTitle').textContent = 'เพิ่มเมนูใหม่';
  $('menuForm').reset();
  $('itemId').value = '';
  $('sort').value = 999;
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

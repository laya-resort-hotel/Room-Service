import { HOTEL_NAME } from './firebase-config.js';
import { isDemo, listenMenu, createOrder, listenOrders, listenChat, sendChat, thb, fmtDate, statusText } from './firebase-service.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let room = (params.get('room') || sessionStorage.getItem('layaRoom') || '').toUpperCase().trim();
let menu = [];
let cart = new Map();
let activeCategory = 'All';
let orders = [];
let unsubs = [];
let lang = 'TH';

const fallbackImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop';
const services = [
  { id:'room-service', icon:'🍽️', label:'บริการอาหารในห้อง', hot:true, action:'menu' },
  { id:'minibar', icon:'▰', label:'มินิบาร์', message:'ขอเติม/สอบถามมินิบาร์ในห้องนี้' },
  { id:'housekeeping', icon:'🧹', label:'งานแม่บ้าน', message:'ขอใช้บริการแม่บ้านที่ห้องนี้' },
  { id:'transport', icon:'🚐', label:'การขนส่ง', message:'ขอข้อมูลรถรับส่ง / Shuttle / Taxi' },
  { id:'front', icon:'🛎️', label:'แผนกต้อนรับ', message:'ขอติดต่อแผนกต้อนรับ' },
  { id:'maintenance', icon:'🛠️', label:'การซ่อมบำรุง', message:'ขอแจ้งซ่อมภายในห้องพักนี้' },
  { id:'review', icon:'💬', label:'ทบทวน', message:'ต้องการให้พนักงานติดต่อกลับเรื่องรีวิว/ข้อเสนอแนะ' },
  { id:'info', icon:'☷', label:'ข้อมูลโรงแรม', message:'ขอข้อมูลโรงแรมและเวลาเปิด-ปิดบริการต่าง ๆ' },
  { id:'voucher', icon:'🎟️', label:'Voucher', message:'ขอสอบถาม Voucher / Promotion' }
];

$('hotelName').textContent = HOTEL_NAME;
if (isDemo) {
  $('modePill').classList.remove('hidden');
  $('modePill').classList.add('demo');
  $('modePill').textContent = 'Demo';
}

function setRoom(value) {
  room = String(value || '').toUpperCase().trim();
  if (room) sessionStorage.setItem('layaRoom', room);
  $('roomPill').textContent = room ? `Room ${room}` : 'Room -';
  $('roomMissing').classList.toggle('hidden', !!room);
  setupRoomRealtime();
}

$('saveManualRoom').addEventListener('click', () => setRoom($('manualRoom').value));
$('manualRoom').addEventListener('keydown', e => { if (e.key === 'Enter') setRoom($('manualRoom').value); });
setRoom(room);

function setupRoomRealtime() {
  unsubs.forEach(fn => fn && fn());
  unsubs = [];
  if (!room) {
    renderOrders([]);
    renderChat([]);
    return;
  }
  unsubs.push(listenOrders((items) => { orders = items; renderOrders(items); }, room));
  unsubs.push(listenChat(room, renderChat));
}

listenMenu((items) => {
  menu = items;
  if (!categories().includes(activeCategory)) activeCategory = 'All';
  renderCategoryStrip();
  renderMenuSections();
  renderAllMenuList();
});

renderServiceGrid();
renderCart();

function renderServiceGrid() {
  $('serviceGrid').innerHTML = services.map(s => `
    <button class="service-btn ${s.hot ? 'hot' : ''}" data-service-id="${escapeAttr(s.id)}" ${s.message ? `data-service-prefill="${escapeAttr(s.message)}"` : ''}>
      <span class="service-icon" aria-hidden="true">${s.icon}</span>
      <small>${escapeHtml(s.label)}</small>
    </button>
  `).join('');
}

function categories() {
  const cats = Array.from(new Set(menu.map(x => x.category || 'Room Service')));
  return ['All', ...cats];
}

function itemsForCategory(category) {
  if (category === 'All') return menu;
  return menu.filter(x => (x.category || 'Room Service') === category);
}

function groupedItems() {
  const cats = categories().filter(c => c !== 'All');
  const selected = activeCategory === 'All' ? cats : cats.filter(c => c === activeCategory);
  return selected.map(cat => ({ category: cat, items: itemsForCategory(cat) })).filter(g => g.items.length);
}

function renderCategoryStrip() {
  $('categoryStrip').innerHTML = categories().map(cat => `
    <button class="category-chip ${cat === activeCategory ? 'active' : ''}" data-category="${escapeAttr(cat)}">${cat === 'All' ? 'ทั้งหมด' : escapeHtml(cat)}</button>
  `).join('');
}

function renderMenuSections() {
  const groups = groupedItems();
  if (!groups.length) {
    $('menuSections').innerHTML = '<div class="empty-state">ยังไม่มีเมนูในระบบ พนักงานสามารถเพิ่มได้จากหน้า Admin</div>';
    return;
  }
  $('menuSections').innerHTML = groups.map(group => `
    <section class="menu-category-section" id="cat-${slug(group.category)}">
      <div class="menu-category-head">
        <h3>${escapeHtml(group.category)}</h3>
        <button class="view-all" data-open-category="${escapeAttr(group.category)}">ดูทั้งหมด <span>▶</span></button>
      </div>
      <div class="horizontal-products">
        ${group.items.slice(0, 12).map(productCard).join('')}
      </div>
    </section>
  `).join('');
}

function productCard(item) {
  const name = item.nameTh || item.nameEn || 'Unnamed item';
  const qty = cart.get(item.id)?.qty || 0;
  return `
    <article class="product-card">
      <img src="${escapeAttr(item.image || fallbackImage)}" alt="${escapeAttr(name)}" loading="lazy" onerror="this.src='${fallbackImage}'" />
      <div class="product-body">
        <button class="add-btn" data-plus="${escapeAttr(item.id)}" aria-label="Add ${escapeAttr(name)}">+</button>
        ${qty ? `<span class="qty-badge">${qty}</span>` : ''}
        <div class="product-tags">${escapeHtml(item.tags || item.nameEn || 'Room Service')}</div>
        <h4>${escapeHtml(name)}</h4>
        <div class="product-price">${thb(item.price)}</div>
      </div>
    </article>
  `;
}

function renderAllMenuList(category = activeCategory) {
  if (!$('allMenuList')) return;
  const rows = itemsForCategory(category || 'All');
  $('allMenuTitle').textContent = category && category !== 'All' ? category : 'เมนูทั้งหมด';
  if (!rows.length) {
    $('allMenuList').innerHTML = '<div class="empty-state">ยังไม่มีเมนู</div>';
    return;
  }
  $('allMenuList').innerHTML = rows.map(item => {
    const name = item.nameTh || item.nameEn || 'Unnamed item';
    return `
      <article class="all-menu-item">
        <img src="${escapeAttr(item.image || fallbackImage)}" alt="${escapeAttr(name)}" loading="lazy" onerror="this.src='${fallbackImage}'" />
        <div>
          <h4>${escapeHtml(name)}</h4>
          <p>${escapeHtml(item.description || item.nameEn || item.category || '')}</p>
          <strong class="price">${thb(item.price)}</strong>
        </div>
        <button class="add-btn" style="position:static" data-plus="${escapeAttr(item.id)}">+</button>
      </article>
    `;
  }).join('');
}

function addToCart(id, delta = 1) {
  const item = menu.find(x => x.id === id);
  if (!item) return;
  const current = cart.get(id)?.qty || 0;
  const qty = Math.max(0, current + delta);
  if (!qty) cart.delete(id);
  else cart.set(id, { item, qty });
  renderMenuSections();
  renderAllMenuList($('allMenuTitle')?.dataset?.category || activeCategory);
  renderCart();
}

function renderCart() {
  const rows = Array.from(cart.values());
  const count = rows.reduce((sum, row) => sum + row.qty, 0);
  const sum = total();
  $('cartCount').textContent = count;
  $('cartTotalBar').textContent = thb(sum);
  $('cartBar').classList.toggle('hidden', !count);
  $('cartTotal').textContent = thb(sum);
  if (!rows.length) {
    $('cartItems').innerHTML = '<div class="empty-state">ยังไม่มีรายการอาหาร</div>';
    return;
  }
  $('cartItems').innerHTML = rows.map(({item, qty}) => {
    const name = item.nameTh || item.nameEn || 'Unnamed item';
    return `
      <div class="guest-cart-row">
        <div><h4>${escapeHtml(name)}</h4><small>${qty} x ${thb(item.price)} = ${thb(qty * Number(item.price || 0))}</small></div>
        <div class="cart-qty"><button data-minus="${escapeAttr(item.id)}">−</button><strong>${qty}</strong><button data-plus="${escapeAttr(item.id)}">+</button></div>
      </div>
    `;
  }).join('');
}

function total() {
  return Array.from(cart.values()).reduce((sum, x) => sum + x.qty * Number(x.item.price || 0), 0);
}

$('placeOrder').addEventListener('click', async () => {
  if (!room) return showOrderResult('กรุณาใส่เลขห้องก่อนส่งออเดอร์', 'bad');
  const rows = Array.from(cart.values());
  if (!rows.length) return showOrderResult('กรุณาเลือกเมนูก่อนส่งออเดอร์', 'bad');
  $('placeOrder').disabled = true;
  try {
    const order = await createOrder({
      room,
      guestName: $('guestName').value.trim(),
      note: $('orderNote').value.trim(),
      total: total(),
      items: rows.map(({item, qty}) => ({
        id:item.id,
        name:item.nameTh || item.nameEn,
        price:Number(item.price || 0),
        qty,
        subtotal:qty * Number(item.price || 0)
      }))
    });
    cart.clear();
    renderCart();
    renderMenuSections();
    renderAllMenuList();
    $('orderNote').value = '';
    closeDrawer('cartDrawer');
    toast(`ส่งออเดอร์แล้ว เลขอ้างอิง ${String(order.id).slice(-6).toUpperCase()}`);
    await sendChat(room, 'system', `ลูกค้าส่งออเดอร์ใหม่ ${thb(order.total)}`);
    setPage('ordersPage');
  } catch (err) {
    console.error(err);
    showOrderResult('ส่งออเดอร์ไม่สำเร็จ กรุณาแจ้งพนักงาน', 'bad');
  } finally {
    $('placeOrder').disabled = false;
  }
});

function showOrderResult(text, type) {
  $('orderResult').innerHTML = `<div class="notice ${type}">${escapeHtml(text)}</div>`;
}

function renderOrders(items) {
  orders = items || [];
  if (!room) {
    $('ordersList').innerHTML = '<div class="empty-state">กรุณาใส่เลขห้องก่อนดูคำสั่งซื้อ</div>';
    return;
  }
  if (!orders.length) {
    $('ordersList').innerHTML = '<div class="empty-state">ยังไม่มีคำสั่งซื้อของห้องนี้</div>';
    return;
  }
  $('ordersList').innerHTML = orders.map(o => `
    <article class="guest-order-card">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
        <div><h3>Room ${escapeHtml(o.room)}</h3><div class="order-meta">${fmtDate(o.createdAtText)} • Ref ${String(o.id || '').slice(-6).toUpperCase()}</div></div>
        <span class="status ${escapeAttr(o.status)}">${statusText(o.status)}</span>
      </div>
      <ol>${(o.items || []).map(i => `<li>${escapeHtml(i.name)} x ${i.qty} <strong>${thb(i.subtotal)}</strong></li>`).join('')}</ol>
      ${o.note ? `<div class="notice warn"><strong>หมายเหตุ:</strong> ${escapeHtml(o.note)}</div>` : ''}
      <div class="drawer-total"><span>Total</span><strong>${thb(o.total)}</strong></div>
    </article>
  `).join('');
}

function renderChat(messages) {
  if (!room) {
    $('chatMessages').innerHTML = '<div class="empty-state">กรุณาใส่เลขห้องก่อนใช้แชท</div>';
    return;
  }
  $('chatMessages').innerHTML = messages.length ? messages.map(m => `
    <div class="msg ${m.sender === 'guest' ? 'me' : ''}">${escapeHtml(m.text)}<small>${m.sender === 'guest' ? 'คุณ' : m.sender === 'staff' ? 'พนักงาน' : 'ระบบ'} • ${fmtDate(m.createdAtText)}</small></div>
  `).join('') : '<div class="empty-state">เริ่มแชทกับพนักงานได้เลย</div>';
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

$('sendChat').addEventListener('click', sendGuestChat);
$('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendGuestChat(); });
async function sendGuestChat() {
  if (!room) return toast('กรุณาใส่เลขห้องก่อนใช้แชท');
  const text = $('chatInput').value.trim();
  if (!text) return;
  $('chatInput').value = '';
  await sendChat(room, 'guest', text);
}

function setPage(pageId) {
  document.querySelectorAll('.app-page').forEach(page => page.classList.toggle('active', page.id === pageId));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.page === pageId));
  window.scrollTo({ top: pageId === 'homePage' ? 0 : Math.max(0, $('phone-app')?.offsetTop || 0), behavior:'smooth' });
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-page]');
  if (nav) return setPage(nav.dataset.page);

  const cat = e.target.closest('[data-category]');
  if (cat) {
    activeCategory = cat.dataset.category;
    renderCategoryStrip();
    renderMenuSections();
    return;
  }

  const openCat = e.target.closest('[data-open-category]');
  if (openCat) return openAllMenu(openCat.dataset.openCategory);

  const plus = e.target.closest('[data-plus]');
  if (plus) return addToCart(plus.dataset.plus, 1);

  const minus = e.target.closest('[data-minus]');
  if (minus) return addToCart(minus.dataset.minus, -1);

  const service = e.target.closest('[data-service-id]');
  if (service?.dataset.serviceId === 'room-service') {
    setPage('homePage');
    document.getElementById('roomServiceArea')?.scrollIntoView({ behavior:'smooth', block:'start' });
    return;
  }

  const prefill = e.target.closest('[data-service-prefill]');
  if (prefill) {
    setPage('chatPage');
    $('chatInput').value = prefill.dataset.servicePrefill;
    $('chatInput').focus();
    toast('พิมพ์ข้อความไว้ให้แล้ว กดส่งเพื่อแจ้งพนักงาน');
  }
});

$('cartBar').addEventListener('click', () => openDrawer('cartDrawer'));
$('closeCart').addEventListener('click', () => closeDrawer('cartDrawer'));
$('closeCartBackdrop').addEventListener('click', () => closeDrawer('cartDrawer'));
$('viewAllMenu').addEventListener('click', () => openAllMenu(activeCategory));
$('closeAllMenu').addEventListener('click', () => closeDrawer('allMenuDrawer'));
$('closeAllMenuBackdrop').addEventListener('click', () => closeDrawer('allMenuDrawer'));

function openAllMenu(category = 'All') {
  $('allMenuTitle').dataset.category = category;
  renderAllMenuList(category);
  openDrawer('allMenuDrawer');
}

function openDrawer(id) {
  $(id).classList.remove('hidden');
  $(id).setAttribute('aria-hidden', 'false');
}
function closeDrawer(id) {
  $(id).classList.add('hidden');
  $(id).setAttribute('aria-hidden', 'true');
  $('orderResult').innerHTML = '';
}

document.querySelectorAll('[data-quick]').forEach(btn => btn.addEventListener('click', () => {
  $('chatInput').value = btn.dataset.quick;
  $('chatInput').focus();
}));

$('langToggle').addEventListener('click', () => {
  lang = lang === 'TH' ? 'EN' : 'TH';
  $('langToggle').textContent = lang;
  toast(lang === 'TH' ? 'ภาษาไทย' : 'English mode: v1.1 will translate full labels later');
});

function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.remove('hidden');
  clearTimeout(window.__layaToastTimer);
  window.__layaToastTimer = setTimeout(() => $('toast').classList.add('hidden'), 2600);
}

function slug(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9ก-ฮ]+/gi, '-').replace(/^-|-$/g, ''); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

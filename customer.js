import { HOTEL_NAME } from './firebase-config.js';
import { isDemo, listenSiteSettings, listenMenu, createOrder, listenOrders, listenChat, sendChat, thb, fmtDate, statusText } from './firebase-service.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let room = (params.get('room') || sessionStorage.getItem('layaRoom') || '').toUpperCase().trim();
let menu = [];
let cart = new Map();
let activeCategory = 'All';
let orders = [];
let siteSettings = {};
let unsubs = [];
let settingsUnsub = null;

const LANGS = ['TH', 'EN', 'ZH', 'RU'];
let lang = LANGS.includes(localStorage.getItem('layaLang')) ? localStorage.getItem('layaLang') : 'TH';

const I18N = {
  TH: {
    langBtn:'TH', cover:'Cover', environment:'Environment', roomMissing:'ไม่พบเลขห้องจาก QR Code กรุณาใส่เลขห้องเพื่อทดสอบระบบ', start:'เริ่ม', roomService:'LAYA Room Service', viewAll:'ดูทั้งหมด', all:'ทั้งหมด', allMenu:'เมนูทั้งหมด', spaServices:'Spa & บริการ', spaPromo:'Relaxing Spa Package', transportPromo:'Airport Transfer / Shuttle',
    navHome:'หน้าแรก', navChat:'แชท', navOrders:'คำสั่งของฉัน', chatTitle:'แชทกับพนักงาน', chatDesc:'สอบถามเมนู แจ้งแพ้อาหาร ขอแม่บ้าน หรือบริการอื่น ๆ ได้ที่นี่', chatPlaceholder:'พิมพ์ข้อความถึงพนักงาน...', send:'ส่ง', ordersTitle:'คำสั่งของฉัน', ordersDesc:'ติดตามสถานะออเดอร์ล่าสุดของห้องนี้',
    cart:'ตะกร้าอาหาร', items:'รายการ', openCart:'ดูตะกร้า', guestName:'ชื่อผู้สั่ง / Guest name', optional:'ไม่บังคับ', note:'หมายเหตุ', notePlaceholder:'เช่น ไม่เผ็ด / ขอช้อนเพิ่ม / แพ้อาหาร...', total:'รวมทั้งหมด', placeOrder:'ส่งออเดอร์',
    noMenu:'ยังไม่มีเมนูในระบบ พนักงานสามารถเพิ่มได้จากหน้า Admin', noItems:'ยังไม่มีเมนู', noCart:'ยังไม่มีรายการอาหาร', needRoomOrder:'กรุณาใส่เลขห้องก่อนส่งออเดอร์', needMenu:'กรุณาเลือกเมนูก่อนส่งออเดอร์', orderSuccess:'ส่งออเดอร์แล้ว เลขอ้างอิง', orderFail:'ส่งออเดอร์ไม่สำเร็จ กรุณาแจ้งพนักงาน', needRoomOrders:'กรุณาใส่เลขห้องก่อนดูคำสั่งซื้อ', noOrders:'ยังไม่มีคำสั่งซื้อของห้องนี้', ref:'Ref', you:'คุณ', staff:'พนักงาน', system:'ระบบ', needRoomChat:'กรุณาใส่เลขห้องก่อนใช้แชท', chatEmpty:'เริ่มแชทกับพนักงานได้เลย', prefillToast:'พิมพ์ข้อความไว้ให้แล้ว กดส่งเพื่อแจ้งพนักงาน', languageToast:'เปลี่ยนภาษาเป็นภาษาไทยแล้ว', recommended:'เมนูแนะนำ', extraCutlery:'ช้อนส้อมเพิ่ม', kidsMenu:'อาหารเด็ก',
    serviceRoom:'บริการอาหารในห้อง', serviceMinibar:'มินิบาร์', serviceHousekeeping:'งานแม่บ้าน', serviceTransport:'การขนส่ง', serviceFront:'แผนกต้อนรับ', serviceMaintenance:'การซ่อมบำรุง', serviceReview:'ทบทวน', serviceInfo:'ข้อมูลโรงแรม', serviceVoucher:'Voucher', serviceClosed:'ยังไม่เปิด'
  },
  EN: {
    langBtn:'EN', cover:'Cover', environment:'Environment', roomMissing:'Room number was not found from the QR code. Please enter a room number for testing.', start:'Start', roomService:'LAYA Room Service', viewAll:'View all', all:'All', allMenu:'All menu', spaServices:'Spa & Services', spaPromo:'Relaxing Spa Package', transportPromo:'Airport Transfer / Shuttle',
    navHome:'Home', navChat:'Chat', navOrders:'My Orders', chatTitle:'Chat with Staff', chatDesc:'Ask about menus, allergies, housekeeping, or any hotel service here.', chatPlaceholder:'Type a message to staff...', send:'Send', ordersTitle:'My Orders', ordersDesc:'Track the latest order status for this room.',
    cart:'Food Cart', items:'items', openCart:'View cart', guestName:'Guest name', optional:'Optional', note:'Note', notePlaceholder:'e.g. not spicy / extra cutlery / food allergy...', total:'Total', placeOrder:'Place order',
    noMenu:'No menu items yet. Staff can add items from Admin.', noItems:'No menu items yet', noCart:'No food items in cart', needRoomOrder:'Please enter a room number before placing an order.', needMenu:'Please select menu items first.', orderSuccess:'Order sent. Reference', orderFail:'Order failed. Please contact staff.', needRoomOrders:'Please enter a room number before viewing orders.', noOrders:'No orders for this room yet.', ref:'Ref', you:'You', staff:'Staff', system:'System', needRoomChat:'Please enter a room number before using chat.', chatEmpty:'Start chatting with staff here.', prefillToast:'Message prepared. Tap Send to notify staff.', languageToast:'Language changed to English', recommended:'Recommended menu', extraCutlery:'Extra cutlery', kidsMenu:'Kids menu',
    serviceRoom:'Room Service', serviceMinibar:'Minibar', serviceHousekeeping:'Housekeeping', serviceTransport:'Transportation', serviceFront:'Front Office', serviceMaintenance:'Maintenance', serviceReview:'Review', serviceInfo:'Hotel Info', serviceVoucher:'Voucher', serviceClosed:'Closed'
  },
  ZH: {
    langBtn:'中文', cover:'封面', environment:'环境', roomMissing:'未从二维码中找到房号。请输入房号进行测试。', start:'开始', roomService:'LAYA 客房送餐', viewAll:'查看全部', all:'全部', allMenu:'全部菜单', spaServices:'水疗与服务', spaPromo:'放松水疗套餐', transportPromo:'机场接送 / 班车',
    navHome:'首页', navChat:'聊天', navOrders:'我的订单', chatTitle:'与员工聊天', chatDesc:'可在这里咨询菜单、过敏、客房清洁或其他酒店服务。', chatPlaceholder:'输入给员工的消息...', send:'发送', ordersTitle:'我的订单', ordersDesc:'查看本房间最新订单状态。',
    cart:'餐品购物车', items:'项', openCart:'查看购物车', guestName:'客人姓名', optional:'选填', note:'备注', notePlaceholder:'例如：不要辣 / 加餐具 / 食物过敏...', total:'总计', placeOrder:'提交订单',
    noMenu:'系统中还没有菜单，员工可在 Admin 页面添加。', noItems:'暂无菜单', noCart:'购物车为空', needRoomOrder:'提交订单前请先输入房号。', needMenu:'请先选择菜单。', orderSuccess:'订单已发送，参考号', orderFail:'订单提交失败，请联系员工。', needRoomOrders:'查看订单前请先输入房号。', noOrders:'此房间暂无订单。', ref:'参考号', you:'您', staff:'员工', system:'系统', needRoomChat:'使用聊天前请先输入房号。', chatEmpty:'可在这里开始与员工聊天。', prefillToast:'消息已准备好，点击发送通知员工。', languageToast:'语言已切换为中文', recommended:'今日推荐', extraCutlery:'加餐具', kidsMenu:'儿童餐',
    serviceRoom:'客房送餐', serviceMinibar:'迷你吧', serviceHousekeeping:'客房清洁', serviceTransport:'交通服务', serviceFront:'前台', serviceMaintenance:'维修服务', serviceReview:'评价', serviceInfo:'酒店信息', serviceVoucher:'优惠券', serviceClosed:'暂未开放'
  },
  RU: {
    langBtn:'RU', cover:'Обложка', environment:'Окружение', roomMissing:'Номер комнаты не найден в QR-коде. Введите номер комнаты для теста.', start:'Начать', roomService:'LAYA Обслуживание в номере', viewAll:'Все', all:'Все', allMenu:'Все меню', spaServices:'Спа и услуги', spaPromo:'Расслабляющий спа-пакет', transportPromo:'Трансфер / шаттл',
    navHome:'Главная', navChat:'Чат', navOrders:'Мои заказы', chatTitle:'Чат с персоналом', chatDesc:'Здесь можно спросить о меню, аллергиях, уборке или других услугах отеля.', chatPlaceholder:'Напишите сообщение персоналу...', send:'Отправить', ordersTitle:'Мои заказы', ordersDesc:'Отслеживайте статус заказов для этой комнаты.',
    cart:'Корзина', items:'поз.', openCart:'Открыть корзину', guestName:'Имя гостя', optional:'Необязательно', note:'Примечание', notePlaceholder:'например: не остро / дополнительные приборы / аллергия...', total:'Итого', placeOrder:'Отправить заказ',
    noMenu:'Пока нет меню. Сотрудник может добавить позиции в Admin.', noItems:'Пока нет меню', noCart:'Корзина пуста', needRoomOrder:'Введите номер комнаты перед отправкой заказа.', needMenu:'Сначала выберите блюда.', orderSuccess:'Заказ отправлен. Номер', orderFail:'Не удалось отправить заказ. Обратитесь к персоналу.', needRoomOrders:'Введите номер комнаты перед просмотром заказов.', noOrders:'Для этой комнаты пока нет заказов.', ref:'№', you:'Вы', staff:'Персонал', system:'Система', needRoomChat:'Введите номер комнаты перед использованием чата.', chatEmpty:'Начните чат с персоналом здесь.', prefillToast:'Сообщение подготовлено. Нажмите Отправить.', languageToast:'Язык изменен на русский', recommended:'Рекомендации', extraCutlery:'Приборы', kidsMenu:'Детское меню',
    serviceRoom:'Обслуживание в номере', serviceMinibar:'Мини-бар', serviceHousekeeping:'Уборка', serviceTransport:'Транспорт', serviceFront:'Ресепшен', serviceMaintenance:'Ремонт', serviceReview:'Отзывы', serviceInfo:'Информация отеля', serviceVoucher:'Ваучер', serviceClosed:'Закрыто'
  }
};

const fallbackImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop';
const serviceBase = [
  { id:'room-service', icon:'🍽️', labelKey:'serviceRoom', hot:true, action:'menu' },
  { id:'minibar', icon:'▰', labelKey:'serviceMinibar', disabled:true, message:{TH:'ขอเติม/สอบถามมินิบาร์ในห้องนี้',EN:'Please assist with minibar for this room.',ZH:'请协助处理本房间迷你吧。',RU:'Пожалуйста, помогите с мини-баром в этой комнате.'} },
  { id:'housekeeping', icon:'🧹', labelKey:'serviceHousekeeping', disabled:true, message:{TH:'ขอใช้บริการแม่บ้านที่ห้องนี้',EN:'Please send housekeeping to this room.',ZH:'请安排客房清洁服务。',RU:'Пожалуйста, пришлите уборку в эту комнату.'} },
  { id:'transport', icon:'🚐', labelKey:'serviceTransport', disabled:true, message:{TH:'ขอข้อมูลรถรับส่ง / Shuttle / Taxi',EN:'Please send shuttle / taxi information.',ZH:'请提供接送/出租车信息。',RU:'Пожалуйста, пришлите информацию о трансфере/такси.'} },
  { id:'front', icon:'🛎️', labelKey:'serviceFront', disabled:true, message:{TH:'ขอติดต่อแผนกต้อนรับ',EN:'Please contact me from Front Office.',ZH:'请前台联系我。',RU:'Пожалуйста, свяжитесь со мной с ресепшена.'} },
  { id:'maintenance', icon:'🛠️', labelKey:'serviceMaintenance', disabled:true, message:{TH:'ขอแจ้งซ่อมภายในห้องพักนี้',EN:'I would like to report a maintenance issue in this room.',ZH:'我想报告房间内的维修问题。',RU:'Я хочу сообщить о проблеме с ремонтом в комнате.'} },
  { id:'review', icon:'💬', labelKey:'serviceReview', disabled:true, message:{TH:'ต้องการให้พนักงานติดต่อกลับเรื่องรีวิว/ข้อเสนอแนะ',EN:'Please contact me about feedback / review.',ZH:'请就评价/反馈联系我。',RU:'Пожалуйста, свяжитесь со мной по отзыву/предложению.'} },
  { id:'info', icon:'☷', labelKey:'serviceInfo', disabled:true, message:{TH:'ขอข้อมูลโรงแรมและเวลาเปิด-ปิดบริการต่าง ๆ',EN:'Please send hotel information and service hours.',ZH:'请提供酒店信息和服务时间。',RU:'Пожалуйста, пришлите информацию об отеле и часах работы услуг.'} },
  { id:'voucher', icon:'🎟️', labelKey:'serviceVoucher', disabled:true, message:{TH:'ขอสอบถาม Voucher / Promotion',EN:'Please send voucher / promotion information.',ZH:'请提供优惠券/促销信息。',RU:'Пожалуйста, пришлите информацию о ваучерах/акциях.'} }
];

applySiteSettings({ hotelName: HOTEL_NAME });
if (isDemo) {
  $('modePill').classList.remove('hidden');
  $('modePill').classList.add('demo');
  $('modePill').textContent = 'Demo';
}

function t(key) { return I18N[lang]?.[key] || I18N.EN[key] || key; }
function itemName(item) { return item[`name${lang}`] || item.nameTh || item.nameEn || item.nameZh || item.nameRu || 'Unnamed item'; }
function itemDesc(item) { return item[`description${lang}`] || item.description || item.descriptionTh || item.descriptionEn || item.descriptionZh || item.descriptionRu || item.nameEn || item.category || ''; }
function categoryLabel(cat) { return cat === 'All' ? t('all') : cat; }
function messageFor(obj) { return typeof obj === 'string' ? obj : (obj?.[lang] || obj?.TH || obj?.EN || ''); }

function applySiteSettings(settings = {}) {
  siteSettings = settings || {};
  const hotel = siteSettings.hotelName || HOTEL_NAME || 'LAYA Resort';
  if ($('hotelName')) $('hotelName').textContent = hotel;
  if ($('coverImage') && siteSettings.coverImage) {
    $('coverImage').src = siteSettings.coverImage;
    $('coverImage').alt = siteSettings.coverAlt || hotel;
  }
}

function applyTranslations() {
  document.documentElement.lang = lang === 'TH' ? 'th' : lang === 'ZH' ? 'zh-CN' : lang === 'RU' ? 'ru' : 'en';
  $('langToggle').textContent = t('langBtn');
  $('coverTabText').textContent = t('cover');
  $('environmentTabText').textContent = t('environment');
  $('roomMissingText').textContent = t('roomMissing');
  $('saveManualRoom').textContent = t('start');
  $('manualRoom').placeholder = lang === 'TH' ? 'เช่น A101' : 'e.g. A101';
  $('roomServiceTitle').textContent = t('roomService');
  $('viewAllMenuText').textContent = t('viewAll');
  $('viewAllSpaText').textContent = t('viewAll');
  $('spaTitle').textContent = t('spaServices');
  $('spaPromoTitle').textContent = t('spaPromo');
  $('transportPromoTitle').textContent = t('transportPromo');
  $('navHomeText').textContent = t('navHome');
  $('navChatText').textContent = t('navChat');
  $('navOrdersText').textContent = t('navOrders');
  $('chatPageTitle').textContent = t('chatTitle');
  $('chatPageDesc').textContent = t('chatDesc');
  $('chatInput').placeholder = t('chatPlaceholder');
  $('sendChat').textContent = t('send');
  $('ordersPageTitle').textContent = t('ordersTitle');
  $('ordersPageDesc').textContent = t('ordersDesc');
  $('cartTitle').textContent = t('cart');
  $('cartBarItemsText').textContent = t('items');
  $('cartBarOpenText').textContent = t('openCart');
  $('guestNameLabel').textContent = t('guestName');
  $('guestName').placeholder = t('optional');
  $('orderNoteLabel').textContent = t('note');
  $('orderNote').placeholder = t('notePlaceholder');
  $('cartTotalText').textContent = t('total');
  $('placeOrder').textContent = t('placeOrder');
  $('viewAllSpa').dataset.servicePrefill = lang === 'TH' ? 'ขอข้อมูล Spa Promotion' : lang === 'ZH' ? '请提供水疗促销信息。' : lang === 'RU' ? 'Пожалуйста, пришлите информацию о спа-акциях.' : 'Please send Spa promotion information.';
  $('spaPromoRow').dataset.servicePrefill = lang === 'TH' ? 'สนใจโปรโมชันสปา กรุณาส่งรายละเอียดให้หน่อย' : lang === 'ZH' ? '我对水疗促销感兴趣，请发送详情。' : lang === 'RU' ? 'Меня интересует спа-акция, пришлите детали.' : 'I am interested in the spa promotion. Please send details.';
  $('transportPromoRow').dataset.servicePrefill = lang === 'TH' ? 'ขอจองรถรับส่ง กรุณาติดต่อกลับที่ห้องนี้' : lang === 'ZH' ? '我想预订接送服务，请联系本房间。' : lang === 'RU' ? 'Я хочу заказать трансфер, пожалуйста, свяжитесь с этой комнатой.' : 'I would like to book transportation. Please contact this room.';
  renderServiceGrid();
  renderQuickChat();
  renderCategoryStrip();
  renderMenuSections();
  renderAllMenuList($('allMenuTitle')?.dataset?.category || activeCategory);
  renderCart();
  renderOrders(orders);
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

settingsUnsub = listenSiteSettings(applySiteSettings, (err) => console.error('listenSiteSettings error', err));

listenMenu((items) => {
  menu = items;
  if (!categories().includes(activeCategory)) activeCategory = 'All';
  renderCategoryStrip();
  renderMenuSections();
  renderAllMenuList($('allMenuTitle')?.dataset?.category || activeCategory);
});

renderServiceGrid();
renderQuickChat();
renderCart();
applyTranslations();

function renderServiceGrid() {
  $('serviceGrid').innerHTML = serviceBase.map(s => {
    const disabled = Boolean(s.disabled);
    const attrs = disabled
      ? 'disabled aria-disabled="true" title="Service temporarily closed"'
      : `data-service-id="${escapeAttr(s.id)}" ${s.message ? `data-service-prefill="${escapeAttr(messageFor(s.message))}"` : ''}`;
    return `
      <button class="service-btn ${s.hot ? 'hot' : ''} ${disabled ? 'is-disabled' : ''}" ${attrs}>
        <span class="service-icon" aria-hidden="true">${s.icon}</span>
        <small>${escapeHtml(t(s.labelKey))}</small>
        ${disabled ? `<em class="service-closed-badge">${escapeHtml(t('serviceClosed'))}</em>` : ''}
      </button>
    `;
  }).join('');
}

function renderQuickChat() {
  const quick = [
    { label:t('recommended'), text:{TH:'ขอเมนูแนะนำสำหรับวันนี้',EN:'Please recommend today’s menu.',ZH:'请推荐今日菜单。',RU:'Пожалуйста, порекомендуйте меню на сегодня.'} },
    { label:t('extraCutlery'), text:{TH:'ขอช้อนส้อมเพิ่ม',EN:'Please send extra cutlery.',ZH:'请送额外餐具。',RU:'Пожалуйста, принесите дополнительные приборы.'} },
    { label:t('kidsMenu'), text:{TH:'มีอาหารสำหรับเด็กไหม',EN:'Do you have a kids menu?',ZH:'有儿童菜单吗？',RU:'Есть ли детское меню?'} }
  ];
  $('quickChat').innerHTML = quick.map(q => `<button data-quick="${escapeAttr(messageFor(q.text))}">${escapeHtml(q.label)}</button>`).join('');
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
    <button class="category-chip ${cat === activeCategory ? 'active' : ''}" data-category="${escapeAttr(cat)}">${escapeHtml(categoryLabel(cat))}</button>
  `).join('');
}

function renderMenuSections() {
  const groups = groupedItems();
  if (!groups.length) {
    $('menuSections').innerHTML = `<div class="empty-state">${escapeHtml(t('noMenu'))}</div>`;
    return;
  }
  $('menuSections').innerHTML = groups.map(group => `
    <section class="menu-category-section" id="cat-${slug(group.category)}">
      <div class="menu-category-head">
        <h3>${escapeHtml(group.category)}</h3>
        <button class="view-all" data-open-category="${escapeAttr(group.category)}">${escapeHtml(t('viewAll'))} <span>▶</span></button>
      </div>
      <div class="horizontal-products">
        ${group.items.slice(0, 12).map(productCard).join('')}
      </div>
    </section>
  `).join('');
}

function productCard(item) {
  const name = itemName(item);
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
  $('allMenuTitle').textContent = category && category !== 'All' ? category : t('allMenu');
  if (!rows.length) {
    $('allMenuList').innerHTML = `<div class="empty-state">${escapeHtml(t('noItems'))}</div>`;
    return;
  }
  $('allMenuList').innerHTML = rows.map(item => {
    const name = itemName(item);
    return `
      <article class="all-menu-item">
        <img src="${escapeAttr(item.image || fallbackImage)}" alt="${escapeAttr(name)}" loading="lazy" onerror="this.src='${fallbackImage}'" />
        <div>
          <h4>${escapeHtml(name)}</h4>
          <p>${escapeHtml(itemDesc(item))}</p>
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
    $('cartItems').innerHTML = `<div class="empty-state">${escapeHtml(t('noCart'))}</div>`;
    return;
  }
  $('cartItems').innerHTML = rows.map(({item, qty}) => {
    const name = itemName(item);
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
  if (!room) return showOrderResult(t('needRoomOrder'), 'bad');
  const rows = Array.from(cart.values());
  if (!rows.length) return showOrderResult(t('needMenu'), 'bad');
  $('placeOrder').disabled = true;
  try {
    const order = await createOrder({
      room,
      guestName: $('guestName').value.trim(),
      note: $('orderNote').value.trim(),
      total: total(),
      language: lang,
      items: rows.map(({item, qty}) => ({
        id:item.id,
        name:itemName(item),
        nameTh:item.nameTh || '',
        nameEn:item.nameEn || '',
        nameZh:item.nameZh || '',
        nameRu:item.nameRu || '',
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
    toast(`${t('orderSuccess')} ${String(order.id).slice(-6).toUpperCase()}`);
    await sendChat(room, 'system', `${t('orderSuccess')} ${thb(order.total)}`);
    setPage('ordersPage');
  } catch (err) {
    console.error(err);
    showOrderResult(t('orderFail'), 'bad');
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
    $('ordersList').innerHTML = `<div class="empty-state">${escapeHtml(t('needRoomOrders'))}</div>`;
    return;
  }
  if (!orders.length) {
    $('ordersList').innerHTML = `<div class="empty-state">${escapeHtml(t('noOrders'))}</div>`;
    return;
  }
  $('ordersList').innerHTML = orders.map(o => `
    <article class="guest-order-card">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
        <div><h3>Room ${escapeHtml(o.room)}</h3><div class="order-meta">${fmtDate(o.createdAtText)} • ${escapeHtml(t('ref'))} ${String(o.id || '').slice(-6).toUpperCase()}</div></div>
        <span class="status ${escapeAttr(o.status)}">${statusText(o.status, lang)}</span>
      </div>
      <ol>${(o.items || []).map(i => `<li>${escapeHtml(i.name)} x ${i.qty} <strong>${thb(i.subtotal)}</strong></li>`).join('')}</ol>
      ${o.note ? `<div class="notice warn"><strong>${escapeHtml(t('note'))}:</strong> ${escapeHtml(o.note)}</div>` : ''}
      <div class="drawer-total"><span>${escapeHtml(t('total'))}</span><strong>${thb(o.total)}</strong></div>
    </article>
  `).join('');
}

function renderChat(messages) {
  if (!room) {
    $('chatMessages').innerHTML = `<div class="empty-state">${escapeHtml(t('needRoomChat'))}</div>`;
    return;
  }
  $('chatMessages').innerHTML = messages.length ? messages.map(m => {
    const cls = m.sender === 'guest' ? 'msg guest-bubble' : m.sender === 'staff' ? 'msg staff-bubble' : 'msg system-bubble';
    return `
    <div class="${cls}">${escapeHtml(m.text)}<small>${m.sender === 'guest' ? t('you') : m.sender === 'staff' ? t('staff') : t('system')} • ${fmtDate(m.createdAtText)}</small></div>`;
  }).join('') : `<div class="empty-state">${escapeHtml(t('chatEmpty'))}</div>`;
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

$('sendChat').addEventListener('click', sendGuestChat);
$('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendGuestChat(); });
async function sendGuestChat() {
  if (!room) return toast(t('needRoomChat'));
  const text = $('chatInput').value.trim();
  if (!text) return;
  $('chatInput').value = '';
  await sendChat(room, 'guest', text);
}

function setPage(pageId) {
  document.querySelectorAll('.app-page').forEach(page => page.classList.toggle('active', page.id === pageId));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.page === pageId));
  window.scrollTo({ top: pageId === 'homePage' ? 0 : Math.max(0, $('phoneApp')?.offsetTop || 0), behavior:'smooth' });
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
    toast(t('prefillToast'));
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

document.addEventListener('click', (e) => {
  const quick = e.target.closest('[data-quick]');
  if (!quick) return;
  $('chatInput').value = quick.dataset.quick;
  $('chatInput').focus();
});

$('langToggle').addEventListener('click', () => {
  const i = LANGS.indexOf(lang);
  lang = LANGS[(i + 1) % LANGS.length];
  localStorage.setItem('layaLang', lang);
  applyTranslations();
  toast(t('languageToast'));
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

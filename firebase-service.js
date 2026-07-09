import { firebaseConfig, DEMO_MODE } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, collectionGroup, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, getDocs, increment
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const hasConfig = firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey;
export const isDemo = DEMO_MODE || !hasConfig;
let app = null;
let db = null;
let storage = null;

if (!isDemo) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
}

const LS_MENU = 'laya.rs.menu.v2';
const LS_ORDERS = 'laya.rs.orders.v2';
const LS_CHAT = 'laya.rs.chat.v2.';
const LS_CLOSED_CHATS = 'laya.rs.closedChats.v1';

const sampleMenu = [
  { id:'demo-andaman-salad', active:true, category:'Room Service', nameTh:'🌶️🌶️ อันดามันซีฟู้ดสลัด', nameEn:'Andaman Seafood Salad', nameZh:'安达曼海鲜沙拉', nameRu:'Андаманский салат с морепродуктами', tags:'🌶️🌶️ Signature', description:'ซีฟู้ดสด น้ำสลัดรสจัด เสิร์ฟเย็นแบบเบา ๆ', descriptionTh:'ซีฟู้ดสด น้ำสลัดรสจัด เสิร์ฟเย็นแบบเบา ๆ', descriptionEn:'Fresh seafood salad with spicy dressing, served chilled.', descriptionZh:'新鲜海鲜沙拉，搭配香辣酱汁，冷食清爽。', descriptionRu:'Свежий салат с морепродуктами и пикантной заправкой, подается охлажденным.', price:470, image:'https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=600&auto=format&fit=crop', sort:10 },
  { id:'demo-grilled-prawn', active:true, category:'Room Service', nameTh:'🦐 กุ้งแม่น้ำย่าง', nameEn:'Grilled River Prawn', nameZh:'烤河虾', nameRu:'Жареная речная креветка', tags:'🦐 Recommended', description:'กุ้งย่าง เสิร์ฟพร้อมซอสซีฟู้ด', descriptionTh:'กุ้งย่าง เสิร์ฟพร้อมซอสซีฟู้ด', descriptionEn:'Grilled prawn served with Thai seafood sauce.', descriptionZh:'烤大虾，配泰式海鲜酱。', descriptionRu:'Жареная креветка с тайским соусом из морепродуктов.', price:660, image:'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?q=80&w=600&auto=format&fit=crop', sort:20 },
  { id:'demo-padthai', active:true, category:'Room Service', nameTh:'ผัดไทยกุ้ง', nameEn:'Pad Thai Goong', nameZh:'泰式炒河粉配虾', nameRu:'Пад Тай с креветками', tags:'Thai Classic', description:'กุ้งสด เส้นจันท์ ซอสผัดไทย', descriptionTh:'กุ้งสด เส้นจันท์ ซอสผัดไทย', descriptionEn:'Thai rice noodles with fresh prawns and Pad Thai sauce.', descriptionZh:'泰式米粉配鲜虾和经典炒河粉酱。', descriptionRu:'Тайская рисовая лапша со свежими креветками и соусом Пад Тай.', price:240, image:'https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=600&auto=format&fit=crop', sort:30 },
  { id:'demo-tomyum', active:true, category:'Room Service', nameTh:'ต้มยำกุ้ง', nameEn:'Tom Yum Goong', nameZh:'冬阴功虾汤', nameRu:'Том Ям с креветками', tags:'Spicy Soup', description:'ซุปต้มยำรสจัด หอมสมุนไพรไทย', descriptionTh:'ซุปต้มยำรสจัด หอมสมุนไพรไทย', descriptionEn:'Spicy Thai soup with prawns and aromatic herbs.', descriptionZh:'香辣泰式虾汤，带有泰国香草风味。', descriptionRu:'Острый тайский суп с креветками и ароматными травами.', price:280, image:'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?q=80&w=600&auto=format&fit=crop', sort:40 },
  { id:'demo-club', active:true, category:'Western Food', nameTh:'คลับแซนด์วิช', nameEn:'Club Sandwich', nameZh:'总汇三明治', nameRu:'Клаб-сэндвич', tags:'Western', description:'ไก่ ไข่ เบคอน เสิร์ฟพร้อมเฟรนช์ฟรายส์', descriptionTh:'ไก่ ไข่ เบคอน เสิร์ฟพร้อมเฟรนช์ฟรายส์', descriptionEn:'Chicken, egg, bacon, served with French fries.', descriptionZh:'鸡肉、鸡蛋、培根，配薯条。', descriptionRu:'Курица, яйцо, бекон, подается с картофелем фри.', price:260, image:'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=600&auto=format&fit=crop', sort:50 },
  { id:'demo-carbonara', active:true, category:'Western Food', nameTh:'สปาเก็ตตี้คาโบนาร่า', nameEn:'Spaghetti Carbonara', nameZh:'培根奶油意大利面', nameRu:'Спагетти Карбонара', tags:'Pasta', description:'ครีมซอส เบคอน ชีสพาร์เมซาน', descriptionTh:'ครีมซอส เบคอน ชีสพาร์เมซาน', descriptionEn:'Cream sauce, bacon, and parmesan cheese.', descriptionZh:'奶油酱、培根和帕玛森芝士。', descriptionRu:'Сливочный соус, бекон и сыр пармезан.', price:290, image:'https://images.unsplash.com/photo-1612874742237-6526221588e3?q=80&w=600&auto=format&fit=crop', sort:60 },
  { id:'demo-burger', active:true, category:'Western Food', nameTh:'ชีสเบอร์เกอร์', nameEn:'Cheese Burger', nameZh:'芝士汉堡', nameRu:'Чизбургер', tags:'Burger', description:'เบอร์เกอร์เนื้อ/ไก่ เสิร์ฟพร้อมเฟรนช์ฟรายส์', descriptionTh:'เบอร์เกอร์เนื้อ/ไก่ เสิร์ฟพร้อมเฟรนช์ฟรายส์', descriptionEn:'Beef or chicken burger served with French fries.', descriptionZh:'牛肉或鸡肉汉堡，配薯条。', descriptionRu:'Бургер с говядиной или курицей, подается с картофелем фри.', price:320, image:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop', sort:70 },
  { id:'demo-coke', active:true, category:'Beverage', nameTh:'โค้ก', nameEn:'Coca-Cola', nameZh:'可口可乐', nameRu:'Кока-Кола', tags:'Soft Drink', description:'กระป๋องเย็น', descriptionTh:'กระป๋องเย็น', descriptionEn:'Chilled can.', descriptionZh:'冰镇罐装。', descriptionRu:'Охлажденная банка.', price:70, image:'https://images.unsplash.com/photo-1554866585-cd94860890b7?q=80&w=600&auto=format&fit=crop', sort:80 },
  { id:'demo-water', active:true, category:'Beverage', nameTh:'น้ำแร่', nameEn:'Mineral Water', nameZh:'矿泉水', nameRu:'Минеральная вода', tags:'Water', description:'น้ำแร่ขวด', descriptionTh:'น้ำแร่ขวด', descriptionEn:'Bottled mineral water.', descriptionZh:'瓶装矿泉水。', descriptionRu:'Бутилированная минеральная вода.', price:60, image:'https://images.unsplash.com/photo-1564419320461-6870880221ad?q=80&w=600&auto=format&fit=crop', sort:90 },
  { id:'demo-coconut', active:true, category:'Beverage', nameTh:'มะพร้าวสด', nameEn:'Fresh Coconut', nameZh:'新鲜椰子', nameRu:'Свежий кокос', tags:'Fresh', description:'มะพร้าวเย็น สดชื่น', descriptionTh:'มะพร้าวเย็น สดชื่น', descriptionEn:'Cold fresh coconut.', descriptionZh:'冰镇新鲜椰子。', descriptionRu:'Охлажденный свежий кокос.', price:120, image:'https://images.unsplash.com/photo-1580984969071-a8da5656c2fb?q=80&w=600&auto=format&fit=crop', sort:100 }
];

function readLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function writeLS(key, value) { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('laya-local-change')); }
function ensureDemoMenu() { if (!localStorage.getItem(LS_MENU)) writeLS(LS_MENU, sampleMenu); }
function safeRoom(room) { return String(room || 'UNKNOWN').replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase(); }
export function uid(prefix='id') { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2,8)}`; }
export function thb(value) { return Number(value || 0).toLocaleString('th-TH', { style:'currency', currency:'THB', maximumFractionDigits:0 }); }
export function fmtDate(value) {
  if (!value) return '-';
  const d = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('th-TH', { dateStyle:'short', timeStyle:'short' });
}
export function statusText(status, lang='TH') {
  const map = {
    TH:{new:'รับออเดอร์ใหม่', preparing:'กำลังเตรียม', delivering:'กำลังนำส่ง', done:'สำเร็จ', cancelled:'ยกเลิก'},
    EN:{new:'New order', preparing:'Preparing', delivering:'Delivering', done:'Completed', cancelled:'Cancelled'},
    ZH:{new:'新订单', preparing:'准备中', delivering:'配送中', done:'已完成', cancelled:'已取消'},
    RU:{new:'Новый заказ', preparing:'Готовится', delivering:'Доставка', done:'Завершено', cancelled:'Отменено'}
  };
  return (map[lang] || map.TH)[status] || status;
}

export function listenMenu(callback, includeInactive=false, onError=null) {
  if (isDemo) {
    ensureDemoMenu();
    let last = '';
    const emit = () => {
      const items = readLS(LS_MENU, []);
      const filtered = includeInactive ? items : items.filter(x => x.active !== false);
      filtered.sort((a,b) => (a.sort ?? 999) - (b.sort ?? 999) || String(a.category).localeCompare(String(b.category)));
      const str = JSON.stringify(filtered);
      if (str !== last) { last = str; callback(filtered); }
    };
    emit();
    const timer = setInterval(emit, 1000);
    window.addEventListener('storage', emit);
    window.addEventListener('laya-local-change', emit);
    return () => { clearInterval(timer); window.removeEventListener('storage', emit); window.removeEventListener('laya-local-change', emit); };
  }
  return onSnapshot(collection(db, 'menu'), snap => {
    const items = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const filtered = includeInactive ? items : items.filter(x => x.active !== false);
    filtered.sort((a,b) => (a.sort ?? 999) - (b.sort ?? 999) || String(a.category).localeCompare(String(b.category)));
    callback(filtered);
  }, err => { if (onError) onError(err); else console.error(err); });
}


export async function uploadMenuImage(fileOrBlob, filename='menu-image.jpg') {
  if (!fileOrBlob) throw new Error('no-image-file');
  const safeName = String(filename || 'menu-image.jpg')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'menu-image.jpg';
  const ext = (safeName.split('.').pop() || 'jpg').toLowerCase();
  const path = `menu-images/${new Date().toISOString().slice(0,10)}/${Date.now()}_${Math.random().toString(16).slice(2,8)}.${ext === 'png' ? 'png' : 'jpg'}`;

  if (isDemo) {
    return { url: await blobToDataUrl(fileOrBlob), path: '' };
  }
  const metadata = {
    contentType: fileOrBlob.type || (ext === 'png' ? 'image/png' : 'image/jpeg'),
    cacheControl: 'public,max-age=31536000'
  };
  const ref = storageRef(storage, path);
  await uploadBytes(ref, fileOrBlob, metadata);
  const url = await getDownloadURL(ref);
  return { url, path };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function saveMenuItem(item) {
  const payload = {
    active: item.active !== false,
    category: item.category || 'Other',
    nameTh: item.nameTh || '',
    nameEn: item.nameEn || '',
    nameZh: item.nameZh || '',
    nameRu: item.nameRu || '',
    description: item.description || item.descriptionTh || '',
    descriptionTh: item.descriptionTh || item.description || '',
    descriptionEn: item.descriptionEn || '',
    descriptionZh: item.descriptionZh || '',
    descriptionRu: item.descriptionRu || '',
    price: Number(item.price || 0),
    image: item.image || '',
    imageStoragePath: item.imageStoragePath || '',
    sort: Number(item.sort || 999),
    updatedAtText: new Date().toISOString()
  };
  if (isDemo) {
    ensureDemoMenu();
    const items = readLS(LS_MENU, []);
    if (item.id) {
      const i = items.findIndex(x => x.id === item.id);
      if (i >= 0) items[i] = { ...items[i], ...payload, id:item.id };
      else items.push({ ...payload, id:item.id });
    } else items.push({ ...payload, id:uid('menu') });
    writeLS(LS_MENU, items);
    return;
  }
  if (item.id) await updateDoc(doc(db, 'menu', item.id), payload);
  else await addDoc(collection(db, 'menu'), { ...payload, createdAt:serverTimestamp(), createdAtText:new Date().toISOString() });
}

export async function removeMenuItem(id) {
  if (isDemo) {
    const items = readLS(LS_MENU, []).filter(x => x.id !== id);
    writeLS(LS_MENU, items);
    return;
  }
  await deleteDoc(doc(db, 'menu', id));
}

export async function seedSampleMenuToFirebase() {
  if (isDemo) { writeLS(LS_MENU, sampleMenu); return; }
  const existing = await getDocs(collection(db, 'menu'));
  if (!existing.empty) return;
  for (const item of sampleMenu) await setDoc(doc(db, 'menu', item.id), { ...item, createdAt:serverTimestamp(), createdAtText:new Date().toISOString() });
}

export async function createOrder(order) {
  const payload = {
    room: safeRoom(order.room),
    guestName: order.guestName || '',
    items: order.items || [],
    note: order.note || '',
    total: Number(order.total || 0),
    language: order.language || '',
    status: 'new',
    createdAtText: new Date().toISOString(),
    updatedAtText: new Date().toISOString()
  };
  if (isDemo) {
    const orders = readLS(LS_ORDERS, []);
    const newOrder = { ...payload, id:uid('order') };
    orders.unshift(newOrder);
    writeLS(LS_ORDERS, orders);
    return newOrder;
  }
  const ref = await addDoc(collection(db, 'orders'), { ...payload, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
  return { ...payload, id:ref.id };
}

export function listenOrders(callback, room=null) {
  const roomSafe = room ? safeRoom(room) : null;
  if (isDemo) {
    let last = '';
    const emit = () => {
      let orders = readLS(LS_ORDERS, []);
      if (roomSafe) orders = orders.filter(x => safeRoom(x.room) === roomSafe);
      orders.sort((a,b) => new Date(b.createdAtText) - new Date(a.createdAtText));
      const str = JSON.stringify(orders);
      if (str !== last) { last = str; callback(orders); }
    };
    emit();
    const timer = setInterval(emit, 1000);
    window.addEventListener('storage', emit);
    window.addEventListener('laya-local-change', emit);
    return () => { clearInterval(timer); window.removeEventListener('storage', emit); window.removeEventListener('laya-local-change', emit); };
  }
  return onSnapshot(collection(db, 'orders'), snap => {
    let orders = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if (roomSafe) orders = orders.filter(x => safeRoom(x.room) === roomSafe);
    orders.sort((a,b) => new Date(b.createdAtText || 0) - new Date(a.createdAtText || 0));
    callback(orders);
  }, err => console.error('listenOrders error', err));
}

export async function updateOrderStatus(id, status) {
  if (isDemo) {
    const orders = readLS(LS_ORDERS, []);
    const i = orders.findIndex(x => x.id === id);
    if (i >= 0) orders[i] = { ...orders[i], status, updatedAtText:new Date().toISOString() };
    writeLS(LS_ORDERS, orders);
    return;
  }
  await updateDoc(doc(db, 'orders', id), { status, updatedAt:serverTimestamp(), updatedAtText:new Date().toISOString() });
}

export function listenChat(room, callback) {
  const r = safeRoom(room);
  if (isDemo) {
    let last = '';
    const key = LS_CHAT + r;
    const emit = () => {
      const msgs = readLS(key, []).sort((a,b) => new Date(a.createdAtText) - new Date(b.createdAtText));
      const str = JSON.stringify(msgs);
      if (str !== last) { last = str; callback(msgs); }
    };
    emit();
    const timer = setInterval(emit, 900);
    window.addEventListener('storage', emit);
    window.addEventListener('laya-local-change', emit);
    return () => { clearInterval(timer); window.removeEventListener('storage', emit); window.removeEventListener('laya-local-change', emit); };
  }
  return onSnapshot(collection(db, 'chats', r, 'messages'), snap => {
    const msgs = snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => new Date(a.createdAtText || 0) - new Date(b.createdAtText || 0));
    callback(msgs);
  }, err => console.error('listenChat error', err));
}


export function listenRecentChats(callback) {
  if (isDemo) {
    let last = '';
    const emit = () => {
      const rooms = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(LS_CHAT)) continue;
        const room = key.slice(LS_CHAT.length);
        const msgs = readLS(key, []).sort((a,b) => new Date(a.createdAtText || 0) - new Date(b.createdAtText || 0));
        if (!msgs.length) continue;
        const lastMsg = msgs[msgs.length - 1];
        const unread = msgs.filter(m => m.sender !== 'staff' && !m.staffSeenAtText).length;
        const closedRooms = readLS(LS_CLOSED_CHATS, {});
        if (closedRooms[room] && unread === 0) continue;
        rooms.push({ room, lastMessage:lastMsg.text || '', lastSender:lastMsg.sender || '', lastAtText:lastMsg.createdAtText || '', unread, count:msgs.length, closed:!!closedRooms[room] });
      }
      rooms.sort((a,b) => new Date(b.lastAtText || 0) - new Date(a.lastAtText || 0));
      const str = JSON.stringify(rooms);
      if (str !== last) { last = str; callback(rooms); }
    };
    emit();
    const timer = setInterval(emit, 900);
    window.addEventListener('storage', emit);
    window.addEventListener('laya-local-change', emit);
    return () => { clearInterval(timer); window.removeEventListener('storage', emit); window.removeEventListener('laya-local-change', emit); };
  }

  // v3.1: use a lightweight chatRooms inbox collection instead of collectionGroup.
  // This is faster, easier for Firestore Rules, and avoids the staff page staying at "loading".
  return onSnapshot(collection(db, 'chatRooms'), snap => {
    const rooms = snap.docs.map(d => {
      const data = d.data() || {};
      return {
        id: d.id,
        room: safeRoom(data.room || d.id),
        lastMessage: data.lastMessage || '',
        lastSender: data.lastSender || '',
        lastAtText: data.lastAtText || '',
        unread: Number(data.unreadForStaff || 0),
        count: Number(data.count || 0),
        closed: data.closedByStaff === true
      };
    }).filter(x => x.room && !(x.closed && Number(x.unread || 0) === 0))
      .sort((a,b) => new Date(b.lastAtText || 0) - new Date(a.lastAtText || 0));
    callback(rooms);
  }, err => {
    console.error('listenRecentChats error', err);
    callback([]);
  });
}

export async function markChatSeen(room) {
  const r = safeRoom(room);
  if (!r) return;
  if (isDemo) {
    const key = LS_CHAT + r;
    const msgs = readLS(key, []).map(m => m.sender !== 'staff' ? { ...m, staffSeenAtText:new Date().toISOString() } : m);
    writeLS(key, msgs);
    return;
  }
  const snap = await getDocs(collection(db, 'chats', r, 'messages'));
  const updates = snap.docs
    .filter(d => d.data().sender !== 'staff' && !d.data().staffSeenAtText)
    .map(d => updateDoc(d.ref, { staffSeenAtText:new Date().toISOString() }));
  updates.push(setDoc(doc(db, 'chatRooms', r), { room:r, unreadForStaff:0, staffSeenAtText:new Date().toISOString(), updatedAt:serverTimestamp() }, { merge:true }));
  await Promise.all(updates);
}


export async function closeChatRoom(room) {
  const r = safeRoom(room);
  if (!r) return;
  if (isDemo) {
    const closedRooms = readLS(LS_CLOSED_CHATS, {});
    closedRooms[r] = new Date().toISOString();
    writeLS(LS_CLOSED_CHATS, closedRooms);
    await markChatSeen(r);
    return;
  }
  await setDoc(doc(db, 'chatRooms', r), {
    room:r,
    unreadForStaff:0,
    closedByStaff:true,
    closedAtText:new Date().toISOString(),
    staffSeenAtText:new Date().toISOString(),
    updatedAt:serverTimestamp()
  }, { merge:true });
  await markChatSeen(r).catch(() => {});
}

export async function sendChat(room, sender, text) {
  const r = safeRoom(room);
  const payload = { room:r, sender, text:String(text || '').trim(), createdAtText:new Date().toISOString() };
  if (!payload.text) return;
  if (isDemo) {
    const key = LS_CHAT + r;
    const msgs = readLS(key, []);
    msgs.push({ ...payload, id:uid('msg') });
    if (sender !== 'staff') {
      const closedRooms = readLS(LS_CLOSED_CHATS, {});
      if (closedRooms[r]) { delete closedRooms[r]; writeLS(LS_CLOSED_CHATS, closedRooms); }
    }
    writeLS(key, msgs);
    return;
  }
  await addDoc(collection(db, 'chats', r, 'messages'), { ...payload, createdAt:serverTimestamp() });
  const roomSummary = {
    room:r,
    lastMessage:payload.text,
    lastSender:sender,
    lastAt:serverTimestamp(),
    lastAtText:payload.createdAtText,
    updatedAt:serverTimestamp(),
    count:increment(1)
  };
  if (sender !== 'staff') {
    roomSummary.unreadForStaff = increment(1);
    roomSummary.closedByStaff = false;
    roomSummary.reopenedAtText = payload.createdAtText;
  }
  await setDoc(doc(db, 'chatRooms', r), roomSummary, { merge:true });
}

export function csvEscape(v) { return `"${String(v ?? '').replaceAll('"','""')}"`; }
export function downloadCsv(filename, rows) {
  const blob = new Blob([rows.map(r => r.map(csvEscape).join(',')).join('\n')], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

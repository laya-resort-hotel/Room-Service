import { firebaseConfig, DEMO_MODE } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const hasConfig = firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey;
export const isDemo = DEMO_MODE || !hasConfig;
let app = null;
let db = null;

if (!isDemo) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

const LS_MENU = 'laya.rs.menu.v2';
const LS_ORDERS = 'laya.rs.orders.v2';
const LS_CHAT = 'laya.rs.chat.v2.';

const sampleMenu = [
  { id:'demo-andaman-salad', active:true, category:'Room Service', nameTh:'🌶️🌶️ อันดามันซีฟู้ดสลัด', nameEn:'Andaman Seafood Salad', tags:'🌶️🌶️ Signature', description:'ซีฟู้ดสด น้ำสลัดรสจัด เสิร์ฟเย็นแบบเบา ๆ', price:470, image:'https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=600&auto=format&fit=crop', sort:10 },
  { id:'demo-grilled-prawn', active:true, category:'Room Service', nameTh:'🦐 กุ้งแม่น้ำย่าง', nameEn:'Grilled River Prawn', tags:'🦐 Recommended', description:'กุ้งย่าง เสิร์ฟพร้อมซอสซีฟู้ด', price:660, image:'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?q=80&w=600&auto=format&fit=crop', sort:20 },
  { id:'demo-padthai', active:true, category:'Room Service', nameTh:'ผัดไทยกุ้ง', nameEn:'Pad Thai Goong', tags:'Thai Classic', description:'กุ้งสด เส้นจันท์ ซอสผัดไทย', price:240, image:'https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=600&auto=format&fit=crop', sort:30 },
  { id:'demo-tomyum', active:true, category:'Room Service', nameTh:'ต้มยำกุ้ง', nameEn:'Tom Yum Goong', tags:'Spicy Soup', description:'ซุปต้มยำรสจัด หอมสมุนไพรไทย', price:280, image:'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?q=80&w=600&auto=format&fit=crop', sort:40 },
  { id:'demo-club', active:true, category:'Western Food', nameTh:'คลับแซนด์วิช', nameEn:'Club Sandwich', tags:'Western', description:'ไก่ ไข่ เบคอน เสิร์ฟพร้อมเฟรนช์ฟรายส์', price:260, image:'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=600&auto=format&fit=crop', sort:50 },
  { id:'demo-carbonara', active:true, category:'Western Food', nameTh:'สปาเก็ตตี้คาโบนาร่า', nameEn:'Spaghetti Carbonara', tags:'Pasta', description:'ครีมซอส เบคอน ชีสพาร์เมซาน', price:290, image:'https://images.unsplash.com/photo-1612874742237-6526221588e3?q=80&w=600&auto=format&fit=crop', sort:60 },
  { id:'demo-burger', active:true, category:'Western Food', nameTh:'ชีสเบอร์เกอร์', nameEn:'Cheese Burger', tags:'Burger', description:'เบอร์เกอร์เนื้อ/ไก่ เสิร์ฟพร้อมเฟรนช์ฟรายส์', price:320, image:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop', sort:70 },
  { id:'demo-coke', active:true, category:'Beverage', nameTh:'โค้ก', nameEn:'Coca-Cola', tags:'Soft Drink', description:'กระป๋องเย็น', price:70, image:'https://images.unsplash.com/photo-1554866585-cd94860890b7?q=80&w=600&auto=format&fit=crop', sort:80 },
  { id:'demo-water', active:true, category:'Beverage', nameTh:'น้ำแร่', nameEn:'Mineral Water', tags:'Water', description:'น้ำแร่ขวด', price:60, image:'https://images.unsplash.com/photo-1564419320461-6870880221ad?q=80&w=600&auto=format&fit=crop', sort:90 },
  { id:'demo-coconut', active:true, category:'Beverage', nameTh:'มะพร้าวสด', nameEn:'Fresh Coconut', tags:'Fresh', description:'มะพร้าวเย็น สดชื่น', price:120, image:'https://images.unsplash.com/photo-1580984969071-a8da5656c2fb?q=80&w=600&auto=format&fit=crop', sort:100 }
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
export function statusText(status) {
  return ({new:'รับออเดอร์ใหม่', preparing:'กำลังเตรียม', delivering:'กำลังนำส่ง', done:'สำเร็จ', cancelled:'ยกเลิก'})[status] || status;
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

export async function saveMenuItem(item) {
  const payload = {
    active: item.active !== false,
    category: item.category || 'Other',
    nameTh: item.nameTh || '',
    nameEn: item.nameEn || '',
    description: item.description || '',
    price: Number(item.price || 0),
    image: item.image || '',
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

export async function sendChat(room, sender, text) {
  const r = safeRoom(room);
  const payload = { room:r, sender, text:String(text || '').trim(), createdAtText:new Date().toISOString() };
  if (!payload.text) return;
  if (isDemo) {
    const key = LS_CHAT + r;
    const msgs = readLS(key, []);
    msgs.push({ ...payload, id:uid('msg') });
    writeLS(key, msgs);
    return;
  }
  await addDoc(collection(db, 'chats', r, 'messages'), { ...payload, createdAt:serverTimestamp() });
}

export function csvEscape(v) { return `"${String(v ?? '').replaceAll('"','""')}"`; }
export function downloadCsv(filename, rows) {
  const blob = new Blob([rows.map(r => r.map(csvEscape).join(',')).join('\n')], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

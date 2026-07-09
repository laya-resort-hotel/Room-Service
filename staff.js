import { HOTEL_NAME, STAFF_PIN } from './firebase-config.js';
import { isDemo, listenOrders, updateOrderStatus, listenChat, sendChat, listenRecentChats, markChatSeen, closeChatRoom as closeChatRoomData, thb, fmtDate, statusText, downloadCsv } from './firebase-service.js';

const $ = (id) => document.getElementById(id);
let allOrders = [];
let activeRoom = '';
let unsubChat = null;
let knownNewOrderIds = new Set();
let firstLoad = true;
let chatSummaries = [];
let staffReadRooms = new Set();
let chatFirstLoad = true;
let knownChatRooms = new Map();
let pendingAlertRoom = '';
let alertToneTimer = null;
let alertSoundEnabled = localStorage.getItem('laya.rs.staffAlertSound') !== '0';
let titleFlashTimer = null;
const originalTitle = document.title;

$('hotelName').textContent = HOTEL_NAME;
if (isDemo) { $('modePill').classList.remove('hidden'); $('modePill').classList.add('demo'); $('modePill').textContent = 'Demo Mode'; }
updateAlertButton();

function unlock() { sessionStorage.setItem('layaStaffOk', '1'); $('pinGate').classList.add('hidden'); unlockAudioForBrowser(); updateAlertButton(); start(); }
if (sessionStorage.getItem('layaStaffOk') === '1') unlock();
$('pinBtn').addEventListener('click', () => { if ($('pinInput').value === STAFF_PIN) unlock(); else $('pinErr').classList.remove('hidden'); });
$('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('pinBtn').click(); });

if ($('enableAlerts')) $('enableAlerts').addEventListener('click', toggleStaffAlerts);
if ($('enableAlertsPanel')) $('enableAlertsPanel').addEventListener('click', toggleStaffAlerts);
if ($('stopAlertSound')) $('stopAlertSound').addEventListener('click', stopAlertSoundOnly);
if ($('alertOpenChat')) $('alertOpenChat').addEventListener('click', () => {
  if (pendingAlertRoom) openChat(pendingAlertRoom);
  hideStaffAlert();
});
if ($('alertSilence')) $('alertSilence').addEventListener('click', stopAlertSoundOnly);
if ($('alertDismiss')) $('alertDismiss').addEventListener('click', hideStaffAlert);
if ($('closeChatRoom')) $('closeChatRoom').addEventListener('click', closeActiveChatRoom);

function start() {
  listenOrders((orders) => {
    allOrders = orders;
    checkNewOrderSound(orders);
    renderOrders();
  });
  listenRecentChats((rooms) => {
    chatSummaries = rooms || [];
    renderChatInbox();
    checkChatAlerts(chatSummaries);
  });
}

$('statusFilter').addEventListener('change', renderOrders);
$('roomSearch').addEventListener('input', renderOrders);

function filteredOrders() {
  const status = $('statusFilter').value;
  const roomQ = $('roomSearch').value.trim().toUpperCase();
  return allOrders.filter(o => {
    const matchStatus = status === 'all' ? true : status === 'active' ? !['done','cancelled'].includes(o.status) : o.status === status;
    const matchRoom = !roomQ || String(o.room || '').toUpperCase().includes(roomQ);
    return matchStatus && matchRoom;
  });
}
function renderOrders() {
  const orders = filteredOrders();
  const active = allOrders.filter(o => !['done','cancelled'].includes(o.status)).length;
  const totalNew = allOrders.filter(o => o.status === 'new').length;
  $('orderSummary').innerHTML = `งานค้าง ${active} รายการ • ออเดอร์ใหม่ ${totalNew} รายการ • ทั้งหมดวันนี้/ทั้งหมดในระบบ ${allOrders.length} รายการ`;
  if (!orders.length) { $('orders').innerHTML = '<div class="empty">ไม่มีออเดอร์ในเงื่อนไขนี้</div>'; return; }
  $('orders').innerHTML = orders.map(o => orderHtml(o)).join('');
  document.querySelectorAll('[data-status]').forEach(btn => btn.addEventListener('click', async () => {
    await updateOrderStatus(btn.dataset.id, btn.dataset.status);
  }));
  document.querySelectorAll('[data-chat-room]').forEach(btn => btn.addEventListener('click', () => openChat(btn.dataset.chatRoom)));
}
function orderHtml(o) {
  const items = (o.items || []).map(i => `<li>${escapeHtml(i.name)} x ${i.qty} <strong>${thb(i.subtotal)}</strong></li>`).join('');
  return `<article class="order-card">
    <div class="order-head">
      <div><h3>Room ${escapeHtml(o.room)} ${o.guestName ? '• ' + escapeHtml(o.guestName) : ''}</h3><div class="order-meta">${fmtDate(o.createdAtText)} • Ref ${String(o.id || '').slice(-6).toUpperCase()}</div></div>
      <span class="status ${o.status}">${statusText(o.status)}</span>
    </div>
    <ol class="order-items">${items}</ol>
    ${o.note ? `<div class="notice warn"><strong>หมายเหตุ:</strong> ${escapeHtml(o.note)}</div>` : ''}
    <div class="total" style="font-size:17px"><span>Total</span><span>${thb(o.total)}</span></div>
    <div class="order-actions">
      <button class="secondary" data-chat-room="${escapeHtml(o.room)}">แชท</button>
      <button class="small-btn" title="ออเดอร์ใหม่" data-id="${o.id}" data-status="new">N</button>
      <button class="secondary" data-id="${o.id}" data-status="preparing">กำลังเตรียม</button>
      <button class="secondary" data-id="${o.id}" data-status="delivering">นำส่ง</button>
      <button class="primary" data-id="${o.id}" data-status="done">สำเร็จ</button>
      <button class="danger" data-id="${o.id}" data-status="cancelled">ยกเลิก</button>
    </div>
  </article>`;
}
function checkNewOrderSound(orders) {
  const newIds = new Set(orders.filter(o => o.status === 'new').map(o => o.id));
  if (!firstLoad) {
    for (const id of newIds) if (!knownNewOrderIds.has(id)) beep();
  }
  knownNewOrderIds = newIds;
  firstLoad = false;
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; gain.gain.value = .08;
    osc.start(); setTimeout(() => { osc.stop(); ctx.close(); }, 240);
  } catch {}
}


function toggleStaffAlerts() {
  alertSoundEnabled = !alertSoundEnabled;
  localStorage.setItem('laya.rs.staffAlertSound', alertSoundEnabled ? '1' : '0');
  if (alertSoundEnabled) {
    unlockAudioForBrowser();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(() => updateAlertButton());
    }
    showSmallNotice('เปิดเสียงแจ้งเตือนแล้ว ถ้าลูกค้าทักมา เสียงจะดังซ้ำจนกว่าพนักงานจะรับทราบ');
  } else {
    stopAlertSoundOnly();
    showSmallNotice('ปิดเสียงแจ้งเตือนแล้ว แต่กล่องแจ้งเตือนบนหน้าจอยังแสดงอยู่');
  }
  updateAlertButton();
}

function updateAlertButton() {
  document.querySelectorAll('.alert-toggle').forEach(btn => {
    btn.textContent = alertSoundEnabled ? '🔊 เสียงแจ้งเตือนเปิดอยู่' : '🔇 เสียงแจ้งเตือนปิดอยู่';
    btn.classList.toggle('alert-on', alertSoundEnabled);
    btn.classList.toggle('alert-off', !alertSoundEnabled);
  });
}

function stopAlertSoundOnly() {
  if (alertToneTimer) { clearInterval(alertToneTimer); alertToneTimer = null; }
  stopTitleFlash();
}

function unlockAudioForBrowser() {
  // Browsers often block sound until staff clicks once. This silent tone unlocks audio after login/button click.
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { try { osc.stop(); ctx.close(); } catch {} }, 40);
  } catch {}
}

function checkChatAlerts(rooms) {
  const activeChats = (rooms || []).filter(c => c && c.room && Number(c.unread || 0) > 0 && c.lastSender !== 'staff');

  // First load: if there are already unread guest messages, still show a visible alert so staff won't miss them.
  if (chatFirstLoad) {
    activeChats.forEach(c => knownChatRooms.set(c.room, { unread:Number(c.unread||0), lastAtText:c.lastAtText || '' }));
    chatFirstLoad = false;
    if (activeChats.length) triggerChatAlert(activeChats[0], activeChats.length, true);
    return;
  }

  let newest = null;
  for (const c of activeChats) {
    const prev = knownChatRooms.get(c.room) || { unread:0, lastAtText:'' };
    const unread = Number(c.unread || 0);
    const changed = unread > Number(prev.unread || 0) || String(c.lastAtText || '') !== String(prev.lastAtText || '');
    if (changed && (!newest || new Date(c.lastAtText || 0) > new Date(newest.lastAtText || 0))) newest = c;
  }

  (rooms || []).forEach(c => {
    if (c && c.room) knownChatRooms.set(c.room, { unread:Number(c.unread||0), lastAtText:c.lastAtText || '' });
  });

  if (newest) triggerChatAlert(newest, activeChats.length, false);
}

function triggerChatAlert(chat, totalUnreadRooms=1, fromExisting=false) {
  if (!chat || !chat.room) return;
  pendingAlertRoom = chat.room;
  const title = totalUnreadRooms > 1
    ? `มีข้อความลูกค้า ${totalUnreadRooms} ห้อง`
    : `มีข้อความใหม่จาก Room ${chat.room}`;
  const body = `${fromExisting ? 'มีแชทค้าง: ' : ''}${chat.lastMessage || 'ลูกค้าส่งข้อความใหม่'}`;
  showStaffAlert(title, body, chat.room);
  if (alertSoundEnabled) playChatAlertTone();
  vibrateStaffDevice();
  flashPageTitle(`🔔 Room ${chat.room}`);
  sendDesktopNotification(title, body, chat.room);
}

function showStaffAlert(title, body, room) {
  const box = $('staffAlert');
  if (!box) return;
  $('staffAlertTitle').textContent = title;
  $('staffAlertText').textContent = body;
  box.dataset.room = room || '';
  box.classList.remove('hidden');
  box.classList.add('shake-once');
  setTimeout(() => box.classList.remove('shake-once'), 900);
}

function hideStaffAlert() {
  const box = $('staffAlert');
  if (box) box.classList.add('hidden');
  stopAlertSoundOnly();
}

function playChatAlertTone() {
  loudAlertBeep();
  if (alertToneTimer) clearInterval(alertToneTimer);
  // ดังซ้ำไปเรื่อย ๆ จนกว่าพนักงานจะกดเปิดแชท / หยุดเสียง / ปิดแจ้งเตือน
  alertToneTimer = setInterval(() => {
    const box = $('staffAlert');
    if (!box || box.classList.contains('hidden') || !alertSoundEnabled) {
      clearInterval(alertToneTimer); alertToneTimer = null; return;
    }
    loudAlertBeep();
  }, 1300);
}

function loudAlertBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.82);
    gain.connect(ctx.destination);
    [880, 1175, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.22);
      osc.connect(gain);
      osc.start(ctx.currentTime + idx * 0.22);
      osc.stop(ctx.currentTime + idx * 0.22 + 0.18);
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, 1000);
  } catch { beep(); setTimeout(beep, 220); }
}

function vibrateStaffDevice() {
  try { if (navigator.vibrate) navigator.vibrate([250, 100, 250]); } catch {}
}

function flashPageTitle(text) {
  stopTitleFlash();
  let on = false;
  titleFlashTimer = setInterval(() => {
    document.title = on ? originalTitle : text;
    on = !on;
  }, 900);
}

function stopTitleFlash() {
  if (titleFlashTimer) clearInterval(titleFlashTimer);
  titleFlashTimer = null;
  document.title = originalTitle;
}

function sendDesktopNotification(title, body, room) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification(title, { body, tag:`laya-chat-${room}`, renotify:true, silent:false });
    n.onclick = () => { window.focus(); openChat(room); hideStaffAlert(); n.close(); };
    setTimeout(() => n.close(), 9000);
  } catch {}
}

function showSmallNotice(text) {
  const title = 'ระบบแจ้งเตือนพร้อมใช้งาน';
  showStaffAlert(title, text, pendingAlertRoom || '');
  setTimeout(() => {
    const box = $('staffAlert');
    if (box && box.dataset.room === '') box.classList.add('hidden');
  }, 3000);
}


function renderChatInbox() {
  const inbox = $('chatInbox');
  const summary = $('chatInboxSummary');
  if (!inbox) return;
  const activeChats = chatSummaries.filter(c => c && c.room);
  const totalUnread = activeChats.reduce((sum, c) => sum + Number(c.unread || 0), 0);
  if (summary) summary.textContent = activeChats.length ? `${activeChats.length} ห้อง • ยังไม่อ่าน ${totalUnread}` : 'ยังไม่มีแชท';
  if (!activeChats.length) {
    inbox.innerHTML = '<div class="empty">ยังไม่มีแชทจากลูกค้า</div>';
    return;
  }
  inbox.innerHTML = activeChats.map(c => {
    const unread = Number(c.unread || 0);
    const activeCls = activeRoom === c.room ? ' active' : '';
    const senderText = c.lastSender === 'staff' ? 'พนักงาน' : c.lastSender === 'guest' ? 'ลูกค้า' : 'ระบบ';
    return `<button class="chat-inbox-item${activeCls}" data-inbox-room="${escapeHtml(c.room)}">
      <span class="chat-room-line"><strong>Room ${escapeHtml(c.room)}</strong>${unread ? `<em>${unread}</em>` : ''}</span>
      <span class="chat-last-line">${escapeHtml(senderText)}: ${escapeHtml(c.lastMessage || '')}</span>
      <small>${fmtDate(c.lastAtText)}</small>
    </button>`;
  }).join('');
  document.querySelectorAll('[data-inbox-room]').forEach(btn => btn.addEventListener('click', () => openChat(btn.dataset.inboxRoom)));
}

$('openChat').addEventListener('click', () => openChat($('chatRoom').value));
$('chatRoom').addEventListener('keydown', e => { if (e.key === 'Enter') openChat($('chatRoom').value); });
async function openChat(room) {
  activeRoom = String(room || '').toUpperCase().trim();
  if (!activeRoom) return;
  $('chatRoom').value = activeRoom;
  $('chatTitle').innerHTML = `กำลังคุยกับ <strong>Room ${escapeHtml(activeRoom)}</strong>`;
  $('closeChatRoom').disabled = false;
  if (unsubChat) unsubChat();
  unsubChat = listenChat(activeRoom, renderChat);
  await markChatSeen(activeRoom).catch(() => {});
  knownChatRooms.set(activeRoom, { unread:0, lastAtText:(knownChatRooms.get(activeRoom)||{}).lastAtText || '' });
  if (pendingAlertRoom === activeRoom) hideStaffAlert();
  renderChatInbox();
}
function renderChat(messages) {
  if (activeRoom) {
    markChatSeen(activeRoom).catch(() => {});
    if (pendingAlertRoom === activeRoom) hideStaffAlert();
  }
  $('chatMessages').innerHTML = messages.length ? messages.map(m => {
    const cls = m.sender === 'staff' ? 'msg staff-bubble' : m.sender === 'guest' ? 'msg guest-bubble' : 'msg system-bubble';
    return `<div class="${cls}">${escapeHtml(m.text)}<small>${m.sender === 'staff' ? 'พนักงาน' : m.sender === 'guest' ? 'ลูกค้า' : 'ระบบ'} • ${fmtDate(m.createdAtText)}</small></div>`;
  }).join('') : '<div class="empty">ยังไม่มีข้อความ</div>';
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}
$('sendChat').addEventListener('click', sendStaffChat);
$('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendStaffChat(); });
async function sendStaffChat() {
  const text = $('chatInput').value.trim();
  if (!activeRoom || !text) return;
  $('chatInput').value = '';
  await sendChat(activeRoom, 'staff', text);
}

async function closeActiveChatRoom() {
  if (!activeRoom) return;
  const room = activeRoom;
  const ok = confirm(`ปิดแชท Room ${room} ใช่ไหม?

แชทจะหายจากกล่องข้อความเข้า แต่ถ้าลูกค้าทักมาใหม่ ห้องนี้จะเด้งกลับมาอีกครั้ง`);
  if (!ok) return;
  await closeChatRoomData(room);
  if (unsubChat) { unsubChat(); unsubChat = null; }
  activeRoom = '';
  pendingAlertRoom = pendingAlertRoom === room ? '' : pendingAlertRoom;
  hideStaffAlert();
  $('chatRoom').value = '';
  $('chatTitle').innerHTML = `ปิดแชท Room <strong>${escapeHtml(room)}</strong> แล้ว`;
  $('chatMessages').innerHTML = '<div class="empty">ปิดแชทแล้ว ถ้าลูกค้าทักมาใหม่ ห้องนี้จะกลับมาในกล่องข้อความเข้า</div>';
  $('closeChatRoom').disabled = true;
  renderChatInbox();
}

$('exportCsv').addEventListener('click', () => {
  const rows = [['Created At','Room','Guest','Status','Items','Note','Total','Ref']];
  allOrders.forEach(o => rows.push([o.createdAtText, o.room, o.guestName, statusText(o.status), (o.items||[]).map(i => `${i.name} x ${i.qty}`).join(' | '), o.note, o.total, o.id]));
  downloadCsv(`room-service-orders-${new Date().toISOString().slice(0,10)}.csv`, rows);
});
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

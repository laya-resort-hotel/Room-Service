import * as AppConfig from './firebase-config.js';
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
const HOTEL_NAME = AppConfig.HOTEL_NAME || 'LAYA Resort';
const STAFF_PIN = String(AppConfig.STAFF_PIN || '1234');
const ALERT_SOUND_URL = './alert-sound.mp3';
let alertAudio = null;
let fallbackToneTimer = null;
let autoPrintEnabled = localStorage.getItem('laya.rs.autoPrintOrders') === '1';

$('hotelName').textContent = HOTEL_NAME;
if (isDemo) { $('modePill').classList.remove('hidden'); $('modePill').classList.add('demo'); $('modePill').textContent = 'Demo Mode'; }
updateAlertButton();
updateAutoPrintButton();

let appStarted = false;
function unlock() {
  try { sessionStorage.setItem('layaStaffOk', '1'); } catch {}
  const gate = $('pinGate');
  if (gate) gate.classList.add('hidden');
  unlockAudioForBrowser();
  updateAlertButton();
  if (!appStarted) { appStarted = true; start(); }
}
function showPinError(text='PIN ไม่ถูกต้อง') {
  const err = $('pinErr');
  if (err) { err.textContent = text; err.classList.remove('hidden'); }
}
function handlePinLogin(event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  const input = String(($('pinInput') && $('pinInput').value) || '').trim();
  if (input === STAFF_PIN || input === '1234') {
    unlock();
  } else {
    showPinError('PIN ไม่ถูกต้อง กรุณาใส่ 1234 หรือตรวจรหัสใน firebase-config.js');
  }
}
try { if (sessionStorage.getItem('layaStaffOk') === '1') unlock(); } catch {}
if ($('pinBtn')) {
  $('pinBtn').addEventListener('click', handlePinLogin);
  $('pinBtn').addEventListener('touchend', handlePinLogin, { passive:false });
  $('pinBtn').addEventListener('pointerup', handlePinLogin);
}
if ($('pinForm')) $('pinForm').addEventListener('submit', handlePinLogin);
if ($('pinInput')) $('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') handlePinLogin(e); });

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
if ($('autoPrintOrders')) $('autoPrintOrders').addEventListener('click', toggleAutoPrintOrders);
if ($('printVisibleOrders')) $('printVisibleOrders').addEventListener('click', () => printOrdersTicket(filteredOrders()));

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
  document.querySelectorAll('[data-print-order]').forEach(btn => btn.addEventListener('click', () => printOrderById(btn.dataset.printOrder)));
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
      <button class="secondary print-order-btn" data-print-order="${escapeHtml(o.id)}">🖨️ พิมพ์</button>
      <button class="small-btn" title="ออเดอร์ใหม่" data-id="${o.id}" data-status="new">N</button>
      <button class="secondary" data-id="${o.id}" data-status="preparing">กำลังเตรียม</button>
      <button class="secondary" data-id="${o.id}" data-status="delivering">นำส่ง</button>
      <button class="primary" data-id="${o.id}" data-status="done">สำเร็จ</button>
      <button class="danger" data-id="${o.id}" data-status="cancelled">ยกเลิก</button>
    </div>
  </article>`;
}
function checkNewOrderSound(orders) {
  const newOrders = orders.filter(o => o.status === 'new');
  const newIds = new Set(newOrders.map(o => o.id));
  if (!firstLoad) {
    const justArrived = newOrders.filter(o => !knownNewOrderIds.has(o.id));
    if (justArrived.length) {
      const sortedNew = justArrived.sort((a,b) => new Date(b.createdAtText || 0) - new Date(a.createdAtText || 0));
      const newestOrder = sortedNew[0];
      triggerOrderAlert(newestOrder, justArrived.length);
      if (autoPrintEnabled) setTimeout(() => printOrdersTicket(sortedNew, { auto:true }), 350);
    }
  }
  knownNewOrderIds = newIds;
  firstLoad = false;
}
function triggerOrderAlert(order, count=1) {
  if (!order) return;
  const room = String(order.room || '').toUpperCase();
  pendingAlertRoom = room;
  const title = count > 1 ? `มีออเดอร์ใหม่ ${count} รายการ` : `มีออเดอร์ใหม่จาก Room ${room}`;
  const ref = String(order.id || '').slice(-6).toUpperCase();
  const body = `ยอด ${thb(order.total || 0)} • Ref ${ref} • รีบตรวจสอบใน Order Board`;
  showStaffAlert(title, body, room);
  if (alertSoundEnabled) playAlertSoundLoop();
  vibrateStaffDevice();
  flashPageTitle(`🔔 Order ${room}`);
  sendDesktopNotification(title, body, room);
}
function beep() {
  playAlertSoundOnce().catch(() => fallbackBeep());
}
function fallbackBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; gain.gain.value = .12;
    osc.start(); setTimeout(() => { osc.stop(); ctx.close(); }, 280);
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
  if (fallbackToneTimer) { clearInterval(fallbackToneTimer); fallbackToneTimer = null; }
  stopCustomAlertAudio();
  stopTitleFlash();
}

function unlockAudioForBrowser() {
  // Browsers often block sound until staff clicks once. This silent tone / muted audio unlocks sound after login/button click.
  try {
    getAlertAudio();
    alertAudio.muted = true;
    alertAudio.play().then(() => {
      alertAudio.pause();
      alertAudio.currentTime = 0;
      alertAudio.muted = false;
    }).catch(() => { alertAudio.muted = false; });
  } catch {}
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
  playAlertSoundLoop();
}

function getAlertAudio() {
  if (!alertAudio) {
    alertAudio = new Audio(ALERT_SOUND_URL);
    alertAudio.preload = 'auto';
    alertAudio.volume = 1;
  }
  return alertAudio;
}

async function playAlertSoundOnce() {
  const audio = getAlertAudio();
  audio.loop = false;
  audio.volume = 1;
  audio.currentTime = 0;
  await audio.play();
}

function playAlertSoundLoop() {
  if (!alertSoundEnabled) return;
  stopCustomAlertAudio();
  try {
    const audio = getAlertAudio();
    audio.loop = true;
    audio.volume = 1;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => startFallbackLoopTone());
    }
  } catch {
    startFallbackLoopTone();
  }
  if (alertToneTimer) clearInterval(alertToneTimer);
  // ตรวจซ้ำว่ากล่องแจ้งเตือนยังเปิดอยู่ไหม ถ้าปิดแล้วให้หยุดเสียงทันที
  alertToneTimer = setInterval(() => {
    const box = $('staffAlert');
    if (!box || box.classList.contains('hidden') || !alertSoundEnabled) {
      stopAlertSoundOnly();
    }
  }, 900);
}

function stopCustomAlertAudio() {
  try {
    if (alertAudio) {
      alertAudio.pause();
      alertAudio.currentTime = 0;
      alertAudio.loop = false;
    }
  } catch {}
}

function startFallbackLoopTone() {
  fallbackBeep();
  if (fallbackToneTimer) clearInterval(fallbackToneTimer);
  fallbackToneTimer = setInterval(() => {
    const box = $('staffAlert');
    if (!box || box.classList.contains('hidden') || !alertSoundEnabled) {
      if (fallbackToneTimer) clearInterval(fallbackToneTimer);
      fallbackToneTimer = null;
      return;
    }
    fallbackBeep();
  }, 1300);
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


function toggleAutoPrintOrders() {
  autoPrintEnabled = !autoPrintEnabled;
  localStorage.setItem('laya.rs.autoPrintOrders', autoPrintEnabled ? '1' : '0');
  updateAutoPrintButton();
  showSmallNotice(autoPrintEnabled
    ? 'เปิด Auto Print แล้ว: เมื่อมีออเดอร์ใหม่ ระบบจะเรียกหน้าต่างพิมพ์อัตโนมัติ'
    : 'ปิด Auto Print แล้ว: พนักงานยังสามารถกดปุ่มพิมพ์ในแต่ละออเดอร์ได้');
}

function updateAutoPrintButton() {
  const btn = $('autoPrintOrders');
  if (!btn) return;
  btn.textContent = autoPrintEnabled ? '🖨️ Auto Print: เปิด' : '🖨️ Auto Print: ปิด';
  btn.classList.toggle('auto-on', autoPrintEnabled);
  btn.classList.toggle('auto-off', !autoPrintEnabled);
}

function printOrderById(orderId) {
  const order = allOrders.find(o => String(o.id) === String(orderId));
  if (!order) return alert('ไม่พบออเดอร์นี้');
  printOrdersTicket([order]);
}

function printOrdersTicket(inputOrders, options = {}) {
  const rows = Array.isArray(inputOrders) ? inputOrders : [inputOrders];
  const orders = rows.filter(Boolean);
  if (!orders.length) return alert('ไม่มีออเดอร์ให้พิมพ์');

  const html = buildPrintHtml(orders, options);
  const frame = document.createElement('iframe');
  frame.className = 'print-frame';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (err) {
      console.error('print failed', err);
      alert('สั่งพิมพ์ไม่สำเร็จ กรุณาลองกดพิมพ์อีกครั้ง');
    }
    setTimeout(() => frame.remove(), 1200);
  }, options.auto ? 650 : 300);
}

function buildPrintHtml(orders, options = {}) {
  const printedAt = new Date().toLocaleString('th-TH', { dateStyle:'short', timeStyle:'short' });
  const tickets = orders.map(o => printTicketHtml(o, printedAt)).join('<div class="page-break"></div>');
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>Print Room Service Order</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { margin:0; background:#fff; color:#111; font-family: Arial, Tahoma, sans-serif; font-size:12px; line-height:1.35; }
  .ticket { width:72mm; max-width:72mm; margin:0 auto; padding:0; }
  .center { text-align:center; }
  h1 { margin:0; font-size:18px; letter-spacing:.5px; }
  h2 { margin:4px 0 0; font-size:22px; }
  .muted { color:#555; }
  .line { border-top:1px dashed #333; margin:8px 0; }
  .row { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; }
  .row strong { white-space:nowrap; }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  th { text-align:left; border-bottom:1px solid #111; padding:3px 0; font-size:11px; }
  td { padding:4px 0; vertical-align:top; border-bottom:1px dotted #ddd; }
  .qty { width:12mm; text-align:center; }
  .amt { width:20mm; text-align:right; white-space:nowrap; }
  .total { font-size:18px; font-weight:900; }
  .note { border:1px solid #111; padding:6px; margin-top:6px; font-weight:700; white-space:pre-wrap; }
  .footer { margin-top:8px; text-align:center; font-size:11px; color:#555; }
  .page-break { break-after: page; page-break-after: always; }
</style>
</head><body>${tickets}</body></html>`;
}

function printTicketHtml(o, printedAt) {
  const ref = String(o.id || '').slice(-6).toUpperCase();
  const items = (o.items || []).map(i => `
    <tr>
      <td>${escapeHtml(i.name || i.nameTh || i.nameEn || 'Item')}<br><span class="muted">${thb(i.price || 0)} each</span></td>
      <td class="qty">${Number(i.qty || 0)}</td>
      <td class="amt">${thb(i.subtotal || (Number(i.qty || 0) * Number(i.price || 0)))}</td>
    </tr>`).join('');
  return `<section class="ticket">
    <div class="center">
      <h1>LAYA ROOM SERVICE</h1>
      <div class="muted">Order Ticket / Kitchen Copy</div>
      <h2>ROOM ${escapeHtml(o.room || '-')}</h2>
    </div>
    <div class="line"></div>
    <div class="row"><span>Reference</span><strong>${escapeHtml(ref)}</strong></div>
    <div class="row"><span>Order time</span><strong>${escapeHtml(fmtDate(o.createdAtText))}</strong></div>
    <div class="row"><span>Print time</span><strong>${escapeHtml(printedAt)}</strong></div>
    ${o.guestName ? `<div class="row"><span>Guest</span><strong>${escapeHtml(o.guestName)}</strong></div>` : ''}
    <div class="row"><span>Status</span><strong>${escapeHtml(statusText(o.status || 'new'))}</strong></div>
    <div class="line"></div>
    <table>
      <thead><tr><th>Item</th><th class="qty">Qty</th><th class="amt">Amount</th></tr></thead>
      <tbody>${items}</tbody>
    </table>
    ${o.note ? `<div class="note">NOTE: ${escapeHtml(o.note)}</div>` : ''}
    <div class="line"></div>
    <div class="row total"><span>TOTAL</span><span>${thb(o.total || 0)}</span></div>
    <div class="footer">Please verify room number before delivery.</div>
  </section>`;
}

$('exportCsv').addEventListener('click', () => {
  const rows = [['Created At','Room','Guest','Status','Items','Note','Total','Ref']];
  allOrders.forEach(o => rows.push([o.createdAtText, o.room, o.guestName, statusText(o.status), (o.items||[]).map(i => `${i.name} x ${i.qty}`).join(' | '), o.note, o.total, o.id]));
  downloadCsv(`room-service-orders-${new Date().toISOString().slice(0,10)}.csv`, rows);
});
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

import { HOTEL_NAME, STAFF_PIN } from './firebase-config.js';
import { isDemo, listenOrders, updateOrderStatus, listenChat, sendChat, listenRecentChats, markChatSeen, thb, fmtDate, statusText, downloadCsv } from './firebase-service.js';

const $ = (id) => document.getElementById(id);
let allOrders = [];
let activeRoom = '';
let unsubChat = null;
let knownNewOrderIds = new Set();
let firstLoad = true;
let chatSummaries = [];
let staffReadRooms = new Set();

$('hotelName').textContent = HOTEL_NAME;
if (isDemo) { $('modePill').classList.remove('hidden'); $('modePill').classList.add('demo'); $('modePill').textContent = 'Demo Mode'; }

function unlock() { sessionStorage.setItem('layaStaffOk', '1'); $('pinGate').classList.add('hidden'); start(); }
if (sessionStorage.getItem('layaStaffOk') === '1') unlock();
$('pinBtn').addEventListener('click', () => { if ($('pinInput').value === STAFF_PIN) unlock(); else $('pinErr').classList.remove('hidden'); });
$('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('pinBtn').click(); });

function start() {
  listenOrders((orders) => {
    allOrders = orders;
    checkNewOrderSound(orders);
    renderOrders();
  });
  listenRecentChats((rooms) => {
    chatSummaries = rooms || [];
    renderChatInbox();
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
  if (unsubChat) unsubChat();
  unsubChat = listenChat(activeRoom, renderChat);
  await markChatSeen(activeRoom).catch(() => {});
  renderChatInbox();
}
function renderChat(messages) {
  if (activeRoom) markChatSeen(activeRoom).catch(() => {});
  $('chatMessages').innerHTML = messages.length ? messages.map(m => `<div class="msg ${m.sender === 'staff' ? 'me' : ''}">${escapeHtml(m.text)}<small>${m.sender === 'staff' ? 'พนักงาน' : m.sender === 'guest' ? 'ลูกค้า' : 'ระบบ'} • ${fmtDate(m.createdAtText)}</small></div>`).join('') : '<div class="empty">ยังไม่มีข้อความ</div>';
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
$('exportCsv').addEventListener('click', () => {
  const rows = [['Created At','Room','Guest','Status','Items','Note','Total','Ref']];
  allOrders.forEach(o => rows.push([o.createdAtText, o.room, o.guestName, statusText(o.status), (o.items||[]).map(i => `${i.name} x ${i.qty}`).join(' | '), o.note, o.total, o.id]));
  downloadCsv(`room-service-orders-${new Date().toISOString().slice(0,10)}.csv`, rows);
});
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

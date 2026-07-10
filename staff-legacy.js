(function () {
  'use strict';

  var cfg = window.LAYA_RS_CONFIG || {};
  var firebaseConfig = cfg.firebaseConfig || {};
  var HOTEL_NAME = cfg.HOTEL_NAME || 'LAYA Resort';
  var db = null;
  var allOrders = [];
  var chatRooms = [];
  var activeRoom = '';
  var unsubOrders = null;
  var unsubChats = null;
  var unsubActiveChat = null;
  var firstOrderLoad = true;
  var firstChatLoad = true;
  var knownNewOrderIds = {};
  var knownUnreadRooms = {};
  var alertSoundEnabled = localStorage.getItem('laya.rs.staffAlertSound') !== '0';
  var autoPrintEnabled = localStorage.getItem('laya.rs.autoPrintOrders') === '1';
  var alertAudio = null;
  var soundTimer = null;
  var pendingAlertRoom = '';
  var originalTitle = document.title;
  var titleFlashTimer = null;

  function $(id) { return document.getElementById(id); }
  function text(id, value) { var el = $(id); if (el) el.textContent = value; }
  function html(id, value) { var el = $(id); if (el) el.innerHTML = value; }
  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m];
    });
  }
  function safeRoom(room) {
    var r = String(room || '').replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
    return r || 'UNKNOWN';
  }
  function thb(value) {
    try { return Number(value || 0).toLocaleString('th-TH', { style:'currency', currency:'THB', maximumFractionDigits:0 }); }
    catch (e) { return '฿' + Math.round(Number(value || 0)); }
  }
  function fmtDate(value) {
    if (!value) return '-';
    var d = value && value.toDate ? value.toDate() : new Date(value);
    if (!d || isNaN(d.getTime())) return '-';
    try { return d.toLocaleString('th-TH', { dateStyle:'short', timeStyle:'short' }); }
    catch (e) { return d.toLocaleDateString() + ' ' + d.toLocaleTimeString(); }
  }
  function nowIso() { return new Date().toISOString(); }
  function uid(prefix) { return String(prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8); }
  function statusText(status) {
    var map = { 'new':'รับออเดอร์ใหม่', 'preparing':'กำลังเตรียม', 'delivering':'กำลังนำส่ง', 'done':'สำเร็จ', 'cancelled':'ยกเลิก' };
    return map[status] || status || '-';
  }
  function setNotice(message, kind) {
    var el = $('legacyNotice');
    if (!el) return;
    el.textContent = message;
    el.className = 'notice' + (kind ? ' ' + kind : '');
  }

  function initFirebase() {
    if (!window.firebase || !firebase.initializeApp || !firebase.firestore) {
      setNotice('เครื่องนี้โหลด Firebase SDK ไม่ได้: กรุณาเช็กอินเทอร์เน็ต หรือเปิดด้วย Chrome', 'warn');
      html('orderSummary', 'โหลด Firebase SDK ไม่ได้');
      html('orders', '<div class="empty">กรุณาเช็กอินเทอร์เน็ตบนเครื่อง SUNMI หรือเปิดด้วย Chrome</div>');
      return false;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      if (db.enablePersistence) {
        db.enablePersistence({ synchronizeTabs:true }).catch(function () {});
      }
      setNotice('โหมด SUNMI Legacy: เชื่อมต่อ Firebase แล้ว กำลังโหลดข้อมูล...', 'ok');
      return true;
    } catch (e) {
      setNotice('เชื่อมต่อ Firebase ไม่สำเร็จ: ' + (e.message || e), 'warn');
      html('orderSummary', 'เชื่อมต่อ Firebase ไม่สำเร็จ');
      html('orders', '<div class="empty">' + escapeHtml(e.message || e) + '</div>');
      return false;
    }
  }

  function start() {
    text('hotelName', HOTEL_NAME);
    updateAlertButton();
    updateAutoPrintButton();
    bindEvents();
    if (!initFirebase()) return;
    listenOrders();
    listenRecentChats();
    setTimeout(function () {
      var sum = $('orderSummary');
      if (sum && /กำลังโหลด/.test(sum.textContent)) {
        html('orderSummary', 'ยังโหลดออเดอร์ไม่ได้ — ถ้าค้างนาน ให้ตรวจ Firestore Rules หรืออินเทอร์เน็ตบนเครื่อง SUNMI');
        setNotice('ถ้ายังค้างที่โหลดข้อมูล ให้ลองเปิด Chrome/อัปเดต WebView หรือเช็ก Firestore Rules', 'warn');
      }
    }, 10000);
  }

  function bindEvents() {
    var ids = ['enableAlerts', 'enableAlertsPanel'];
    for (var i=0;i<ids.length;i++) { var b = $(ids[i]); if (b) b.onclick = toggleStaffAlerts; }
    var stop = $('stopAlertSound'); if (stop) stop.onclick = stopAlertSoundOnly;
    var alertSilence = $('alertSilence'); if (alertSilence) alertSilence.onclick = stopAlertSoundOnly;
    var alertDismiss = $('alertDismiss'); if (alertDismiss) alertDismiss.onclick = hideStaffAlert;
    var alertOpen = $('alertOpenChat'); if (alertOpen) alertOpen.onclick = function () { if (pendingAlertRoom) openChat(pendingAlertRoom); hideStaffAlert(); };
    var close = $('closeChatRoom'); if (close) close.onclick = closeActiveChatRoom;
    var open = $('openChat'); if (open) open.onclick = function () { openChat(($('chatRoom') && $('chatRoom').value) || ''); };
    var send = $('sendChat'); if (send) send.onclick = sendStaffChat;
    var chatInput = $('chatInput'); if (chatInput) chatInput.onkeydown = function (e) { if ((e.key || e.keyCode) === 'Enter' || e.keyCode === 13) sendStaffChat(); };
    var filter = $('statusFilter'); if (filter) filter.onchange = renderOrders;
    var roomSearch = $('roomSearch'); if (roomSearch) roomSearch.oninput = renderOrders;
    var autoBtn = $('autoPrintOrders'); if (autoBtn) autoBtn.onclick = toggleAutoPrintOrders;
    var printBtn = $('printVisibleOrders'); if (printBtn) printBtn.onclick = function () { printOrdersTicket(filteredOrders()); };
    var exp = $('exportCsv'); if (exp) exp.onclick = exportOrdersCsv;
  }

  function listenOrders() {
    if (unsubOrders) unsubOrders();
    unsubOrders = db.collection('orders').onSnapshot(function (snap) {
      var orders = [];
      snap.forEach(function (d) { var data = d.data() || {}; data.id = d.id; orders.push(data); });
      orders.sort(function (a,b) { return new Date(b.createdAtText || 0) - new Date(a.createdAtText || 0); });
      allOrders = orders;
      setNotice('โหมด SUNMI Legacy: โหลดออเดอร์สำเร็จ ' + orders.length + ' รายการ', 'ok');
      checkNewOrderSound(orders);
      renderOrders();
    }, function (err) {
      setNotice('อ่านออเดอร์ไม่ได้: ' + (err.message || err), 'warn');
      html('orderSummary', 'อ่านออเดอร์ไม่ได้');
      html('orders', '<div class="empty">' + escapeHtml(err.message || err) + '<br>ให้เช็ก Firestore Rules ว่า orders เปิด read/write แล้ว</div>');
    });
  }

  function filteredOrders() {
    var status = ($('statusFilter') && $('statusFilter').value) || 'active';
    var roomQ = (($('roomSearch') && $('roomSearch').value) || '').toUpperCase();
    var out = [];
    for (var i=0;i<allOrders.length;i++) {
      var o = allOrders[i];
      var st = o.status || 'new';
      var matchStatus = status === 'all' ? true : status === 'active' ? (st !== 'done' && st !== 'cancelled') : st === status;
      var matchRoom = !roomQ || String(o.room || '').toUpperCase().indexOf(roomQ) >= 0;
      if (matchStatus && matchRoom) out.push(o);
    }
    return out;
  }

  function renderOrders() {
    var orders = filteredOrders();
    var active = 0, totalNew = 0;
    for (var i=0;i<allOrders.length;i++) {
      var st = allOrders[i].status || 'new';
      if (st !== 'done' && st !== 'cancelled') active++;
      if (st === 'new') totalNew++;
    }
    html('orderSummary', 'งานค้าง ' + active + ' รายการ • ออเดอร์ใหม่ ' + totalNew + ' รายการ • ทั้งหมดในระบบ ' + allOrders.length + ' รายการ');
    if (!orders.length) { html('orders', '<div class="empty">ไม่มีออเดอร์ในเงื่อนไขนี้</div>'); return; }
    var s = '';
    for (var i=0;i<orders.length;i++) s += orderHtml(orders[i]);
    html('orders', s);
    var buttons = document.querySelectorAll('[data-status]');
    for (var b=0;b<buttons.length;b++) buttons[b].onclick = function () { updateOrderStatus(this.getAttribute('data-id'), this.getAttribute('data-status')); };
    var chats = document.querySelectorAll('[data-chat-room]');
    for (var c=0;c<chats.length;c++) chats[c].onclick = function () { openChat(this.getAttribute('data-chat-room')); };
    var prints = document.querySelectorAll('[data-print-order]');
    for (var p=0;p<prints.length;p++) prints[p].onclick = function () { printOrderById(this.getAttribute('data-print-order')); };
  }

  function orderHtml(o) {
    var items = o.items || [];
    var itemHtml = '';
    for (var i=0;i<items.length;i++) {
      var it = items[i] || {};
      itemHtml += '<li>' + escapeHtml(it.name || it.nameTh || '-') + ' x ' + Number(it.qty || 1) + ' <strong>' + thb(it.subtotal || (Number(it.price || 0) * Number(it.qty || 1))) + '</strong></li>';
    }
    return '<article class="order-card">' +
      '<div class="order-head"><div><h3>Room ' + escapeHtml(o.room) + (o.guestName ? ' • ' + escapeHtml(o.guestName) : '') + '</h3><div class="order-meta">' + fmtDate(o.createdAtText) + ' • Ref ' + escapeHtml(String(o.id || '').slice(-6).toUpperCase()) + '</div></div>' +
      '<span class="status ' + escapeHtml(o.status || 'new') + '">' + statusText(o.status || 'new') + '</span></div>' +
      '<ol class="order-items">' + itemHtml + '</ol>' +
      (o.note ? '<div class="notice warn"><strong>หมายเหตุ:</strong> ' + escapeHtml(o.note) + '</div>' : '') +
      '<div class="total" style="font-size:17px"><span>Total</span><span>' + thb(o.total) + '</span></div>' +
      '<div class="order-actions">' +
      '<button class="secondary" data-chat-room="' + escapeHtml(o.room) + '">แชท</button>' +
      '<button class="secondary print-order-btn" data-print-order="' + escapeHtml(o.id) + '">🖨️ พิมพ์</button>' +
      '<button class="small-btn" data-id="' + escapeHtml(o.id) + '" data-status="new">N</button>' +
      '<button class="secondary" data-id="' + escapeHtml(o.id) + '" data-status="preparing">กำลังเตรียม</button>' +
      '<button class="secondary" data-id="' + escapeHtml(o.id) + '" data-status="delivering">นำส่ง</button>' +
      '<button class="primary" data-id="' + escapeHtml(o.id) + '" data-status="done">สำเร็จ</button>' +
      '<button class="danger" data-id="' + escapeHtml(o.id) + '" data-status="cancelled">ยกเลิก</button>' +
      '</div></article>';
  }

  function updateOrderStatus(id, status) {
    if (!id) return;
    db.collection('orders').doc(id).update({ status:status, updatedAtText:nowIso(), updatedAt:firebase.firestore.FieldValue.serverTimestamp() }).catch(function (err) {
      alert('เปลี่ยนสถานะไม่ได้: ' + (err.message || err));
    });
  }

  function checkNewOrderSound(orders) {
    var current = {};
    var justArrived = [];
    for (var i=0;i<orders.length;i++) {
      var o = orders[i];
      if ((o.status || 'new') === 'new') {
        current[o.id] = true;
        if (!firstOrderLoad && !knownNewOrderIds[o.id]) justArrived.push(o);
      }
    }
    knownNewOrderIds = current;
    firstOrderLoad = false;
    if (justArrived.length) {
      var newest = justArrived[0];
      triggerAlert('มีออเดอร์ใหม่จาก Room ' + safeRoom(newest.room), 'ยอด ' + thb(newest.total || 0) + ' • Ref ' + String(newest.id || '').slice(-6).toUpperCase(), safeRoom(newest.room), '🔔 Order ' + safeRoom(newest.room));
      if (autoPrintEnabled) setTimeout(function () { printOrdersTicket(justArrived); }, 350);
    }
  }

  function listenRecentChats() {
    if (unsubChats) unsubChats();
    unsubChats = db.collection('chatRooms').onSnapshot(function (snap) {
      var rooms = [];
      snap.forEach(function (d) {
        var data = d.data() || {};
        var room = safeRoom(data.room || d.id);
        var unread = Number(data.unreadForStaff || 0);
        if (data.closedByStaff === true && unread === 0) return;
        rooms.push({ room:room, lastMessage:data.lastMessage || '', lastSender:data.lastSender || '', lastAtText:data.lastAtText || '', unread:unread, count:Number(data.count || 0), closed:data.closedByStaff === true });
      });
      rooms.sort(function (a,b) { return new Date(b.lastAtText || 0) - new Date(a.lastAtText || 0); });
      chatRooms = rooms;
      renderChatInbox();
      checkChatAlerts(rooms);
    }, function (err) {
      text('chatInboxSummary', 'อ่านแชทไม่ได้');
      html('chatInbox', '<div class="empty">' + escapeHtml(err.message || err) + '<br>ให้เช็ก Firestore Rules ว่า chatRooms เปิด read/write แล้ว</div>');
    });
  }

  function renderChatInbox() {
    var unread = 0;
    for (var i=0;i<chatRooms.length;i++) unread += Number(chatRooms[i].unread || 0);
    text('chatInboxSummary', chatRooms.length + ' ห้อง • ยังไม่อ่าน ' + unread);
    if (!chatRooms.length) { html('chatInbox', '<div class="empty">ยังไม่มีแชทจากลูกค้า</div>'); return; }
    var s = '';
    for (var i=0;i<chatRooms.length;i++) {
      var r = chatRooms[i];
      s += '<button type="button" class="chat-room-card ' + (activeRoom === r.room ? 'active' : '') + '" data-room="' + escapeHtml(r.room) + '">' +
        '<strong>Room ' + escapeHtml(r.room) + '</strong>' + (r.unread > 0 ? '<span class="badge">' + r.unread + '</span>' : '') +
        '<small>' + escapeHtml((r.lastSender === 'staff' ? 'พนักงาน: ' : r.lastSender === 'system' ? 'ระบบ: ' : 'ลูกค้า: ') + (r.lastMessage || '-')) + '</small>' +
        '<small>' + fmtDate(r.lastAtText) + '</small>' +
        '</button>';
    }
    html('chatInbox', s);
    var cards = document.querySelectorAll('[data-room]');
    for (var c=0;c<cards.length;c++) cards[c].onclick = function () { openChat(this.getAttribute('data-room')); };
  }

  function checkChatAlerts(rooms) {
    for (var i=0;i<rooms.length;i++) {
      var r = rooms[i];
      var prev = knownUnreadRooms[r.room] || 0;
      if (!firstChatLoad && r.unread > prev && r.lastSender !== 'staff') {
        triggerAlert('ลูกค้าทักแชท Room ' + r.room, r.lastMessage || 'มีข้อความใหม่', r.room, '🔔 Chat ' + r.room);
      }
      knownUnreadRooms[r.room] = r.unread;
    }
    firstChatLoad = false;
  }

  function openChat(room) {
    var r = safeRoom(room);
    if (!r) return;
    activeRoom = r;
    if ($('chatRoom')) $('chatRoom').value = r;
    text('chatTitle', 'Room ' + r);
    if ($('closeChatRoom')) $('closeChatRoom').disabled = false;
    if (unsubActiveChat) unsubActiveChat();
    html('chatMessages', '<div class="empty">กำลังโหลดแชท...</div>');
    stopAlertSoundOnly();
    unsubActiveChat = db.collection('chats').doc(r).collection('messages').onSnapshot(function (snap) {
      var msgs = [];
      snap.forEach(function (d) { var data = d.data() || {}; data.id = d.id; msgs.push(data); });
      msgs.sort(function (a,b) { return new Date(a.createdAtText || 0) - new Date(b.createdAtText || 0); });
      renderMessages(msgs);
      markChatSeen(r);
    }, function (err) {
      html('chatMessages', '<div class="empty">อ่านแชทไม่ได้: ' + escapeHtml(err.message || err) + '</div>');
    });
  }

  function renderMessages(msgs) {
    if (!msgs.length) { html('chatMessages', '<div class="empty">ยังไม่มีข้อความ</div>'); return; }
    var s = '';
    for (var i=0;i<msgs.length;i++) {
      var m = msgs[i];
      var cls = m.sender === 'staff' ? 'from-staff' : (m.sender === 'system' ? 'from-system' : 'from-guest');
      var who = m.sender === 'staff' ? 'Staff' : (m.sender === 'system' ? 'System' : 'Guest');
      s += '<div class="chat-bubble ' + cls + '"><div>' + escapeHtml(m.text || '') + '</div><small>' + who + ' • ' + fmtDate(m.createdAtText) + '</small></div>';
    }
    html('chatMessages', s);
    var box = $('chatMessages'); if (box) box.scrollTop = box.scrollHeight;
  }

  function sendStaffChat() {
    var input = $('chatInput');
    var msg = input ? input.value : '';
    if (!activeRoom || !String(msg || '').replace(/\s/g, '')) return;
    var r = safeRoom(activeRoom);
    var payload = { room:r, sender:'staff', text:String(msg).trim(), createdAtText:nowIso(), createdAt:firebase.firestore.FieldValue.serverTimestamp() };
    db.collection('chats').doc(r).collection('messages').add(payload).then(function () {
      if (input) input.value = '';
      return db.collection('chatRooms').doc(r).set({
        room:r, lastMessage:payload.text, lastSender:'staff', lastAtText:payload.createdAtText,
        lastAt:firebase.firestore.FieldValue.serverTimestamp(), updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
        count:firebase.firestore.FieldValue.increment(1)
      }, { merge:true });
    }).catch(function (err) { alert('ส่งแชทไม่ได้: ' + (err.message || err)); });
  }

  function markChatSeen(room) {
    var r = safeRoom(room);
    db.collection('chatRooms').doc(r).set({ unreadForStaff:0, staffSeenAtText:nowIso(), updatedAt:firebase.firestore.FieldValue.serverTimestamp() }, { merge:true }).catch(function () {});
  }

  function closeActiveChatRoom() {
    if (!activeRoom) return;
    var r = activeRoom;
    db.collection('chatRooms').doc(r).set({
      room:r, unreadForStaff:0, closedByStaff:true, closedAtText:nowIso(), staffSeenAtText:nowIso(), updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, { merge:true }).then(function () {
      if (unsubActiveChat) { unsubActiveChat(); unsubActiveChat = null; }
      activeRoom = '';
      if ($('chatRoom')) $('chatRoom').value = '';
      text('chatTitle', 'ยังไม่ได้เลือกห้อง');
      if ($('closeChatRoom')) $('closeChatRoom').disabled = true;
      html('chatMessages', '<div class="empty">เลือกห้องเพื่อดูแชท</div>');
    }).catch(function (err) { alert('ปิดแชทไม่ได้: ' + (err.message || err)); });
  }

  function triggerAlert(title, body, room, flashTitle) {
    pendingAlertRoom = room;
    text('staffAlertTitle', title);
    text('staffAlertText', body);
    var el = $('staffAlert'); if (el) el.className = 'staff-alert';
    if (alertSoundEnabled) playAlertLoop();
    flashPageTitle(flashTitle || '🔔 New');
    try { if (navigator.vibrate) navigator.vibrate([250,120,250,120,400]); } catch (e) {}
  }
  function hideStaffAlert() { var el = $('staffAlert'); if (el) el.className = 'staff-alert hidden'; stopAlertSoundOnly(); }
  function getAudio() {
    if (!alertAudio) {
      alertAudio = new Audio('./alert-sound.mp3');
      alertAudio.preload = 'auto';
      alertAudio.volume = 1;
    }
    return alertAudio;
  }
  function playOnce() {
    try {
      var a = getAudio();
      a.pause(); a.currentTime = 0; a.volume = 1;
      var p = a.play();
      if (p && p.catch) p.catch(function () { fallbackBeep(); });
    } catch (e) { fallbackBeep(); }
  }
  function playAlertLoop() {
    stopAlertSoundOnly();
    playOnce();
    soundTimer = setInterval(playOnce, 3500);
  }
  function stopAlertSoundOnly() {
    if (soundTimer) { clearInterval(soundTimer); soundTimer = null; }
    try { if (alertAudio) { alertAudio.pause(); alertAudio.currentTime = 0; } } catch (e) {}
    stopTitleFlash();
  }
  function fallbackBeep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 980; gain.gain.value = 0.18;
      osc.start(); setTimeout(function () { try { osc.stop(); ctx.close(); } catch (e) {} }, 320);
    } catch (e) {}
  }
  function toggleStaffAlerts() {
    alertSoundEnabled = !alertSoundEnabled;
    localStorage.setItem('laya.rs.staffAlertSound', alertSoundEnabled ? '1' : '0');
    updateAlertButton();
    if (alertSoundEnabled) {
      try { var a = getAudio(); a.muted = true; a.play().then(function () { a.pause(); a.currentTime = 0; a.muted = false; }).catch(function () { a.muted = false; }); } catch (e) {}
      playOnce();
    } else stopAlertSoundOnly();
  }
  function updateAlertButton() {
    var btns = document.querySelectorAll('.alert-toggle');
    for (var i=0;i<btns.length;i++) {
      btns[i].textContent = alertSoundEnabled ? '🔊 เสียงแจ้งเตือนเปิดอยู่' : '🔇 เสียงแจ้งเตือนปิดอยู่';
      btns[i].className = (btns[i].className.replace(/\balert-on\b|\balert-off\b/g, '') + ' ' + (alertSoundEnabled ? 'alert-on' : 'alert-off')).replace(/\s+/g, ' ');
    }
  }
  function flashPageTitle(title) {
    stopTitleFlash();
    var on = false;
    titleFlashTimer = setInterval(function () { document.title = on ? title : originalTitle; on = !on; }, 900);
  }
  function stopTitleFlash() { if (titleFlashTimer) { clearInterval(titleFlashTimer); titleFlashTimer = null; document.title = originalTitle; } }

  function toggleAutoPrintOrders() {
    autoPrintEnabled = !autoPrintEnabled;
    localStorage.setItem('laya.rs.autoPrintOrders', autoPrintEnabled ? '1' : '0');
    updateAutoPrintButton();
  }
  function updateAutoPrintButton() { var b = $('autoPrintOrders'); if (b) b.textContent = autoPrintEnabled ? '🖨️ Auto Print: เปิด' : '🖨️ Auto Print: ปิด'; }
  function printOrderById(id) {
    for (var i=0;i<allOrders.length;i++) if (allOrders[i].id === id) { printOrdersTicket([allOrders[i]]); return; }
  }
  function printOrdersTicket(orders) {
    if (!orders || !orders.length) { alert('ไม่มีออเดอร์ให้พิมพ์'); return; }
    var body = '';
    for (var i=0;i<orders.length;i++) body += ticketHtml(orders[i]);
    var w = window.open('', '_blank', 'width=420,height=700');
    if (!w) { alert('Browser บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up'); return; }
    w.document.open();
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Order Ticket</title><style>@page{size:80mm auto;margin:4mm}body{font-family:Arial,sans-serif;font-size:12px;color:#000}.ticket{width:72mm;margin:0 auto 8mm;border-bottom:1px dashed #000;padding-bottom:8px}.center{text-align:center}.row{display:flex;justify-content:space-between;gap:8px}.line{border-top:1px dashed #000;margin:6px 0}h2,h3{margin:2px 0}.item{margin:4px 0}.total{font-size:16px;font-weight:bold}</style></head><body>' + body + '<script>setTimeout(function(){window.print()},350)<\/script></body></html>');
    w.document.close();
  }
  function ticketHtml(o) {
    var s = '<div class="ticket"><div class="center"><h2>LAYA Resort</h2><h3>ROOM SERVICE</h3></div><div class="line"></div>';
    s += '<div class="row"><strong>Room</strong><strong>' + escapeHtml(o.room) + '</strong></div>';
    s += '<div class="row"><span>Ref</span><span>' + escapeHtml(String(o.id || '').slice(-6).toUpperCase()) + '</span></div>';
    s += '<div class="row"><span>Time</span><span>' + fmtDate(o.createdAtText) + '</span></div><div class="line"></div>';
    var items = o.items || [];
    for (var i=0;i<items.length;i++) {
      var it = items[i] || {};
      s += '<div class="item"><div><strong>' + escapeHtml(it.name || it.nameTh || '-') + '</strong></div><div class="row"><span>x ' + Number(it.qty || 1) + '</span><span>' + thb(it.subtotal || (Number(it.price || 0) * Number(it.qty || 1))) + '</span></div></div>';
    }
    if (o.note) s += '<div class="line"></div><strong>Note:</strong><br>' + escapeHtml(o.note);
    s += '<div class="line"></div><div class="row total"><span>Total</span><span>' + thb(o.total) + '</span></div></div>';
    return s;
  }

  function exportOrdersCsv() {
    var rows = [['Room','Ref','Status','Time','Total','Items','Note']];
    var orders = filteredOrders();
    for (var i=0;i<orders.length;i++) {
      var o = orders[i];
      var items = (o.items || []).map(function (it) { return (it.name || it.nameTh || '-') + ' x ' + (it.qty || 1); }).join('; ');
      rows.push([o.room || '', String(o.id || '').slice(-6).toUpperCase(), statusText(o.status || 'new'), fmtDate(o.createdAtText), o.total || 0, items, o.note || '']);
    }
    var csv = rows.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'room-service-orders.csv'; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

import { HOTEL_NAME } from './firebase-config.js';
import { downloadCsv } from './firebase-service.js';
const $ = id => document.getElementById(id);
$('hotelName').textContent = HOTEL_NAME;

const defaultUrl = new URL('./index.html', location.href).href;
$('baseUrl').value = defaultUrl;
let lastLinks = [];

$('generate').addEventListener('click', generate);
$('print').addEventListener('click', () => window.print());
$('downloadLinks').addEventListener('click', () => {
  const rows = [['Room','URL'], ...lastLinks.map(x => [x.room, x.url])];
  downloadCsv('room-service-qr-links.csv', rows);
});

generate();
function generate() {
  const base = $('baseUrl').value.trim() || defaultUrl;
  const rooms = $('rooms').value.split(/[\n,]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
  const unique = Array.from(new Set(rooms));
  const grid = $('qrGrid');
  grid.innerHTML = '';
  lastLinks = unique.map(room => ({ room, url: makeUrl(base, room) }));
  lastLinks.forEach(({room, url}) => {
    const card = document.createElement('article');
    card.className = 'qr-card';
    card.innerHTML = `<div class="qr-canvas" id="qr-${room.replace(/[^a-zA-Z0-9_-]/g,'_')}"></div><h3>Room ${escapeHtml(room)}</h3><p>${escapeHtml(url)}</p>`;
    grid.appendChild(card);
    const holder = card.querySelector('.qr-canvas');
    if (window.QRCode) new QRCode(holder, { text:url, width:150, height:150, correctLevel: QRCode.CorrectLevel.M });
    else holder.innerHTML = '<div class="notice bad">โหลด QR library ไม่สำเร็จ</div>';
  });
}
function makeUrl(base, room) {
  const u = new URL(base, location.href);
  u.searchParams.set('room', room);
  return u.toString();
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

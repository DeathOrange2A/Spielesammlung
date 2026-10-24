// Seite für Mitspielende: per Link/QR beitreten und eigene Karte/Aktionen sehen.
import { h } from './util.js';
import { renderView } from './view.js';

const root = document.getElementById('app');
const fromPath = location.pathname.match(/\/j\/([A-Za-z]{4})/);
let code = (fromPath?.[1] || new URLSearchParams(location.search).get('c') || '').toUpperCase();
const storeKey = c => 'spieleabend.player.' + c;

let me = loadMe();
let lobby = null;
let view = null;
let state = code ? 'connecting' : 'code';
let error = '';
let connected = false;
let hostOnline = true;
let socket = null;

function loadMe() {
  try { return code ? JSON.parse(localStorage.getItem(storeKey(code))) : null; } catch (e) { return null; }
}
function saveMe() {
  if (me) localStorage.setItem(storeKey(code), JSON.stringify(me));
  else localStorage.removeItem(storeKey(code));
}

function connect() {
  if (typeof io === 'undefined') { state = 'offline'; draw(); return; }
  socket = io();
  socket.on('connect', () => { connected = true; hello(); });
  socket.on('disconnect', () => { connected = false; draw(); });
  socket.on('view', v => { v._recv = Date.now(); view = v; if (state === 'joined') draw(); });
  socket.on('lobby', l => { lobby = l; if (state === 'pickname') draw(); });
  socket.on('hostStatus', on => { hostOnline = on; draw(); });
  socket.on('kicked', () => { me = null; saveMe(); view = null; state = 'pickname'; error = 'Du wurdest von der Spielleitung entfernt.'; draw(); });
  socket.on('closed', () => { state = 'closed'; draw(); });
  socket.on('replaced', () => { state = 'replaced'; draw(); socket.disconnect(); });
}

function hello() {
  if (!code) { state = 'code'; draw(); return; }
  socket.emit('player:hello', { code }, res => {
    if (!res.ok) { state = 'noroom'; error = res.error; draw(); setTimeout(() => { if (state === 'noroom' && connected) hello(); }, 5000); return; }
    lobby = res.lobby;
    hostOnline = res.hostOnline;
    if (me?.name) join(me.name);
    else { state = 'pickname'; draw(); }
  });
}

function join(name) {
  socket.emit('player:join', { code, pid: me?.pid, name }, res => {
    if (!res.ok) { error = res.error; state = 'pickname'; if (res.needName) me = null; draw(); return; }
    me = { pid: res.pid, name: res.name };
    saveMe();
    error = '';
    state = 'joined';
    hostOnline = res.hostOnline;
    view = res.view;
    if (view) view._recv = Date.now();
    draw();
  });
}

function leave() {
  socket.emit('player:leave');
  me = null;
  saveMe();
  view = null;
  state = 'pickname';
  draw();
}

function bar() {
  return h('div', { class: 'pbar' },
    h('span', { class: 'dot ' + (connected && hostOnline ? 'on' : 'off') }),
    h('span', { class: 'grow' }, '🎲 ', me?.name || 'Spieleabend', code ? h('span', { class: 'muted small' }, ' · Raum ' + code) : null),
    state === 'joined' ? h('button', { class: 'btn small ghost', onclick: () => { if (confirm('Name wechseln / Raum verlassen?')) leave(); } }, 'Wechseln') : null);
}

function draw() {
  root.innerHTML = '';
  root.append(bar());
  if (connected && !hostOnline && state === 'joined') {
    root.append(h('p', { class: 'warn center small' }, 'Die Spielleitung ist gerade nicht verbunden – einfach warten.'));
  }
  if (!connected && state !== 'code' && state !== 'replaced' && state !== 'closed') {
    root.append(h('p', { class: 'warn center small' }, 'Verbindung wird hergestellt …'));
  }

  switch (state) {
    case 'code': {
      const inp = h('input', { placeholder: 'ABCD', maxlength: 4, style: { textAlign: 'center', fontSize: '2rem', letterSpacing: '.3em', textTransform: 'uppercase' } });
      const go = () => {
        const c = inp.value.trim().toUpperCase();
        if (!/^[A-Z]{4}$/.test(c)) return;
        location.href = '/j/' + c;
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      root.append(h('div', { class: 'card center' }, h('h2', {}, 'Raum-Code eingeben'), inp, h('button', { class: 'btn primary big block', style: { marginTop: '12px' }, onclick: go }, 'Beitreten')));
      break;
    }
    case 'connecting':
      root.append(h('div', { class: 'view' }, h('div', { class: 'view-emoji' }, '⏳'), h('p', {}, 'Verbinde …'), h('p', { class: 'small muted' }, 'Kann beim ersten Aufruf bis zu einer Minute dauern.')));
      break;
    case 'noroom':
      root.append(h('div', { class: 'view' }, h('div', { class: 'view-emoji' }, '🔍'), h('h2', { class: 'view-title' }, 'Raum nicht gefunden'), h('p', { class: 'muted' }, error), h('p', { class: 'small muted' }, 'Es wird automatisch erneut versucht …')));
      break;
    case 'pickname': {
      const names = lobby?.names || [];
      const inp = h('input', { placeholder: 'Dein Name', maxlength: 24, enterkeyhint: 'go' });
      const go = () => { const n = inp.value.trim(); if (n) join(n); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      root.append(h('div', { class: 'card' },
        h('h2', { style: { marginTop: 0 } }, 'Wer bist du?'),
        error ? h('p', { class: 'warn' }, error) : null,
        names.length ? h('div', { class: 'name-grid' }, names.map(n => h('button', { class: 'btn big', onclick: () => join(n) }, n))) : null,
        names.length ? h('p', { class: 'small muted' }, 'Nicht dabei? Neuen Namen eingeben:') : null,
        h('div', { class: 'row' }, inp, h('button', { class: 'btn primary', onclick: go }, 'Los'))));
      break;
    }
    case 'joined': {
      const box = h('div');
      root.append(box);
      renderView(box, view || { game: '🎲 Spieleabend', emoji: '✅', title: `Hallo ${me.name}!`, text: 'Du bist verbunden. Warte, bis das Spiel startet.\nTipp: Lass diese Seite geöffnet.' }, data => {
        if (socket?.connected) socket.emit('player:action', data);
      });
      break;
    }
    case 'replaced':
      root.append(h('div', { class: 'view' }, h('div', { class: 'view-emoji' }, '📱'), h('h2', { class: 'view-title' }, 'In einem anderen Fenster geöffnet'), h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Hier weiterspielen')));
      break;
    case 'closed':
      root.append(h('div', { class: 'view' }, h('div', { class: 'view-emoji' }, '👋'), h('h2', { class: 'view-title' }, 'Der Raum wurde geschlossen'), h('p', { class: 'muted' }, 'Danke fürs Mitspielen!')));
      break;
    case 'offline':
      root.append(h('div', { class: 'view' }, h('div', { class: 'view-emoji' }, '📡'), h('h2', { class: 'view-title' }, 'Server nicht erreichbar'), h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Neu laden')));
      break;
  }
}

draw();
connect();

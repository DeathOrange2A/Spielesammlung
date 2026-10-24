// Raum-Verwaltung auf dem Host: verbindet Handys über den Server und
// verteilt die Spieler-Ansichten. Nicht verbundene Spieler sind „lokal“ –
// ihre Ansicht wird auf diesem Gerät gezeigt (Handy herumreichen).

import { S, save, addPlayer, pname, player } from './store.js';
import { h, app, toast, modal, copyText, confirmDialog } from './util.js';
import { renderView } from './view.js';

export const R = { connected: false, players: [], views: {}, active: null };
const games = {}; // gameId -> { action(eid, data), push() }
const sent = {};
let socket = null;
let inviteDraw = null;

export function register(gameId, handlers) { games[gameId] = handlers; }

const map = () => (S.room && S.room.map) || {};
export function pidOf(eid) { const m = map(); return Object.keys(m).find(k => m[k] === eid); }
export function isLocal(eid) { return !pidOf(eid); }
export function status(eid) {
  const pid = pidOf(eid);
  if (!pid) return 'local';
  return R.players.find(p => p.pid === pid)?.connected ? 'online' : 'offline';
}
export function onlineCount() { return R.players.filter(p => p.connected).length; }
export function joinLink() { return S.room ? location.origin + '/j/' + S.room.code : ''; }

export function openRoom() {
  if (socket) return;
  if (typeof io === 'undefined') { toast('Server nicht erreichbar – nur Offline-Modus'); return; }
  socket = io();
  socket.on('connect', () => {
    socket.emit('host:open', { code: S.room?.code, hostToken: S.room?.hostToken }, res => {
      if (!S.room || S.room.code !== res.code) S.room = { code: res.code, map: {} };
      S.room.hostToken = res.hostToken;
      save();
      R.connected = true;
      for (const k of Object.keys(sent)) delete sent[k];
      onPlayers(res.players);
    });
  });
  socket.on('disconnect', () => { R.connected = false; inviteDraw?.(); app.rerender(); });
  socket.on('players', onPlayers);
  socket.on('action', ({ pid, data }) => {
    const eid = map()[pid];
    if (eid) dispatch(eid, data);
  });
}

function onPlayers(list) {
  R.players = list || [];
  const m = S.room.map;
  for (const k of Object.keys(m)) if (!R.players.some(p => p.pid === k)) delete m[k];
  for (const p of R.players) {
    if (m[p.pid] && player(m[p.pid])) continue;
    const ev = S.players.find(x => x.name.toLowerCase() === p.name.toLowerCase()) || addPlayer(p.name);
    for (const k of Object.keys(m)) if (m[k] === ev.id && k !== p.pid) delete m[k];
    m[p.pid] = ev.id;
  }
  save();
  pushLobby();
  if (R.active && games[R.active]?.push) games[R.active].push();
  else flush();
  inviteDraw?.();
  app.rerender();
}

function pushLobby() {
  if (!socket?.connected) return;
  const taken = new Set(Object.values(map()));
  socket.emit('host:lobby', { names: S.players.filter(p => !taken.has(p.id)).map(p => p.name) });
}
export function lobbyChanged() { pushLobby(); }

function idleView() {
  return { game: '🎲 Spieleabend', emoji: '⏳', title: 'Gleich geht’s weiter', text: 'Du bist verbunden. Warte, bis das nächste Spiel startet.' };
}

// Ein Spiel übergibt hier die Ansichten aller Mitspielenden (eid -> view).
export function publish(gameId, views) {
  R.active = gameId;
  if (S.activeGame !== gameId) { S.activeGame = gameId; save(); }
  const now = Date.now();
  R.views = {};
  for (const p of S.players) R.views[p.id] = { ...(views[p.id] || idleView()), _recv: now };
  flush();
  renderOverlay();
}

// Spiel beendet/abgebrochen: alle Handys zurück in den Wartemodus.
export function release(gameId) {
  if (gameId && R.active !== gameId) return;
  R.active = null;
  S.activeGame = null;
  save();
  R.views = {};
  flush();
  closeOverlay();
}

function flush() {
  if (!socket?.connected) return;
  for (const [pid, eid] of Object.entries(map())) {
    const { _recv, ...clean } = R.views[eid] || idleView();
    const json = JSON.stringify(clean);
    if (sent[pid] === json) continue;
    sent[pid] = json;
    socket.emit('host:view', { pid, view: clean });
  }
}

export function dispatch(eid, data) {
  games[R.active]?.action?.(eid, data);
}

export function kick(pid) { socket?.emit('host:kick', { pid }); }

export function closeRoom() {
  socket?.emit('host:close');
  socket?.disconnect();
  socket = null;
  S.room = null;
  save();
  R.players = [];
  R.connected = false;
  app.rerender();
}

// ---------- Einladen (QR / Link) ----------
export function inviteModal() {
  openRoom();
  const body = h('div');
  modal('📱 Handys verbinden', body);
  inviteDraw = () => {
    if (!body.isConnected) { inviteDraw = null; return; }
    body.innerHTML = '';
    if (!S.room?.code || !R.connected) {
      body.append(h('p', { class: 'muted center' }, 'Verbinde mit dem Server …'),
        h('p', { class: 'small muted center' }, 'Kostenlose Render-Server schlafen nach Inaktivität ein – das Aufwachen kann bis zu einer Minute dauern.'));
      return;
    }
    const link = joinLink();
    body.append(
      h('p', { class: 'muted' }, 'Mitspielende scannen den QR-Code (oder öffnen den Link) und wählen ihren Namen. Sie bleiben den ganzen Abend verbunden – für alle Spiele.'),
      h('div', { class: 'qr' }, h('img', { src: '/qr.svg?t=' + encodeURIComponent(link), alt: 'QR-Code zum Beitreten' })),
      h('div', { class: 'code-big' }, S.room.code),
      h('div', { class: 'linkbox' },
        h('input', { readonly: true, value: link, onclick: e => e.target.select() }),
        h('button', { class: 'btn', onclick: () => copyText(link) }, 'Kopieren')),
      navigator.share ? h('button', { class: 'btn block', onclick: () => navigator.share({ title: 'Spieleabend', text: 'Mach mit beim Spieleabend!', url: link }).catch(() => {}) }, '🔗 Link teilen') : null,
      h('h4', {}, `Verbunden (${onlineCount()})`),
      R.players.length
        ? h('ul', { class: 'plist' }, R.players.map(p => h('li', {},
          h('span', { class: 'dot ' + (p.connected ? 'on' : 'off') }),
          h('span', { class: 'grow' }, p.name, p.connected ? '' : ' (getrennt)'),
          h('button', { class: 'btn small ghost', onclick: () => kick(p.pid) }, 'Entfernen'))))
        : h('p', { class: 'muted' }, 'Noch niemand verbunden.'),
      h('p', { class: 'small muted' }, 'Wer nicht verbunden ist, spielt „auf diesem Gerät“ – das Handy wird dann für diese Person herumgereicht. Beides lässt sich mischen.'),
      h('button', {
        class: 'btn ghost small', onclick: async () => {
          if (await confirmDialog('Raum schließen? Alle Handys werden getrennt.', 'Schließen', true)) { closeRoom(); inviteDraw?.(); }
        },
      }, 'Raum schließen'));
  };
  inviteDraw();
}

// ---------- Lokale Spieler (Handy herumreichen) ----------
let overlay = null;

export function needsLocal(eid) { return isLocal(eid) && !!R.views[eid]?.needsInput; }

export function openLocal(eid, { anonymous = false } = {}) {
  closeOverlay();
  const el = h('div', { class: 'overlay' });
  document.body.append(el);
  overlay = { eid, el, anonymous };
  renderOverlay();
}

function renderOverlay() {
  if (!overlay) return;
  const v = R.views[overlay.eid];
  if (!v || !v.needsInput) { closeOverlay(); app.rerender(); return; }
  const eid = overlay.eid;
  const body = h('div', { class: 'overlay-body' });
  overlay.el.innerHTML = '';
  overlay.el.append(
    h('div', { class: 'overlay-top' },
      h('span', {}, overlay.anonymous ? '🤫 Geheime Aktion' : '📱 ' + pname(eid)),
      h('button', { class: 'btn small ghost', onclick: () => { closeOverlay(); app.rerender(); } }, 'Schließen ✕')),
    body);
  renderView(body, v, data => dispatch(eid, data));
}

export function closeOverlay() {
  overlay?.el.remove();
  overlay = null;
}

// Panel „Handy weitergeben an …“ für alle lokalen Spieler, die gerade etwas tun müssen.
export function passPanel(eids, verb = 'Karte ansehen') {
  const pending = eids.filter(needsLocal);
  if (!pending.length) return null;
  const next = pending[0];
  const p = player(next);
  return h('div', { class: 'card pass' },
    h('div', { class: 'muted' }, 'Gib das Handy an'),
    h('div', { class: 'pass-name' }, (p?.emoji || '') + ' ' + pname(next)),
    h('button', { class: 'btn primary big block', onclick: () => openLocal(next) }, `Ich bin ${pname(next)} – ${verb}`),
    pending.length > 1 ? h('p', { class: 'small muted' }, 'Danach: ' + pending.slice(1).map(pname).join(', ')) : null);
}

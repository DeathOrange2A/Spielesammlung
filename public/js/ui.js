// Wiederverwendbare Bausteine für die Host-Oberfläche.
import { S, save, player, pname, addPlayer, record } from './store.js';
import { h, app, toast, modal } from './util.js';
import * as room from './room.js';
import { RULES } from './rules.js';

export function topbar(title, { rules, invite = false, back = '#/' } = {}) {
  const online = room.onlineCount();
  return h('header', { class: 'topbar' },
    h('a', { class: 'icon-btn', href: back, 'aria-label': 'Zurück' }, '‹'),
    h('h1', {}, title),
    h('div', { class: 'topbar-actions' },
      invite ? h('button', { class: 'icon-btn', onclick: room.inviteModal, title: 'Handys verbinden', 'aria-label': 'Handys verbinden' }, '📱', online ? h('span', { class: 'badge' }, online) : null) : null,
      rules ? h('button', { class: 'icon-btn', onclick: () => rulesModal(rules), title: 'Anleitung', 'aria-label': 'Anleitung' }, '?') : null));
}

export function rulesModal(key) {
  const r = RULES[key];
  modal(r.title, h('div', { class: 'rules', html: r.html }));
}

export function selectedIds(s) {
  const d = s.desel || [];
  return S.players.filter(p => !d.includes(p.id)).map(p => p.id);
}

export function pill(id, extra) {
  const p = player(id);
  return h('span', { class: 'pill', style: { '--c': p?.color || '#888' } }, (p?.emoji || '👤') + ' ' + pname(id), extra || null);
}

// Spielerauswahl: standardmäßig sind alle Spieler des Abends dabei.
export function playerPicker(s, { min = 2, max = 99, showStatus = false, title = 'Mitspielende' } = {}) {
  const sel = selectedIds(s);
  const wrap = h('div', { class: 'card' });
  wrap.append(h('div', { class: 'row between' },
    h('h3', {}, `${title} (${sel.length})`),
    h('span', { class: 'small muted' }, 'Tippen = an/ab')));
  const chips = h('div', { class: 'chips' });
  for (const p of S.players) {
    const on = !(s.desel || []).includes(p.id);
    const st = showStatus ? room.status(p.id) : null;
    chips.append(h('button', {
      class: 'chip' + (on ? ' on' : ''), style: { '--c': p.color },
      onclick: () => {
        s.desel ||= [];
        if (on) s.desel.push(p.id); else s.desel = s.desel.filter(x => x !== p.id);
        save(); app.rerender();
      },
    }, p.emoji + ' ' + p.name,
    st === 'online' ? h('span', { class: 'dot on', title: 'Handy verbunden' }) : st === 'offline' ? h('span', { class: 'dot off', title: 'Handy getrennt' }) : null));
  }
  if (!S.players.length) chips.append(h('span', { class: 'muted' }, 'Noch keine Spieler – füge unten welche hinzu.'));
  wrap.append(chips);
  const inp = h('input', { placeholder: 'Neuer Name', maxlength: 24, enterkeyhint: 'done' });
  const add = () => {
    const p = addPlayer(inp.value);
    if (p) {
      s.desel = (s.desel || []).filter(x => x !== p.id);
      save();
      room.lobbyChanged();
      app.rerender();
    }
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  wrap.append(h('div', { class: 'row' }, inp, h('button', { class: 'btn', onclick: add }, '＋')));
  if (showStatus) wrap.append(h('p', { class: 'small muted' }, '🟢 = eigenes Handy verbunden. Alle anderen spielen auf diesem Gerät (herumreichen).'));
  if (sel.length < min) wrap.append(h('p', { class: 'warn' }, `Mindestens ${min} Spieler nötig.`));
  if (sel.length > max) wrap.append(h('p', { class: 'warn' }, `Höchstens ${max} Spieler.`));
  return wrap;
}

export function stepper(value, onChange, { min = -Infinity, max = Infinity, step = 1, big = false, fmt } = {}) {
  return h('div', { class: 'stepper' + (big ? ' big' : '') },
    h('button', { class: 'btn', disabled: value <= min, onclick: () => onChange(Math.max(min, value - step)), 'aria-label': 'weniger' }, '−'),
    h('span', { class: 'stepper-val' }, fmt ? fmt(value) : value),
    h('button', { class: 'btn', disabled: value >= max, onclick: () => onChange(Math.min(max, value + step)), 'aria-label': 'mehr' }, '+'));
}

export function toggle(label, checked, onChange, hint) {
  return h('label', { class: 'toggle' },
    h('input', { type: 'checkbox', checked: !!checked, onchange: e => onChange(e.target.checked) }),
    h('span', { class: 'toggle-ui' }),
    h('span', {}, label, hint ? h('small', { class: 'muted block' }, hint) : null));
}

export function card(title, ...content) {
  return h('div', { class: 'card' }, title ? h('h3', {}, title) : null, ...content);
}

// Platzierung mit geteilten Plätzen bei Gleichstand.
export function rank(ids, score, lowerBetter = false) {
  const sorted = [...ids].sort((a, b) => lowerBetter ? score(a) - score(b) : score(b) - score(a));
  let place = 0, prev = null;
  return sorted.map((id, i) => {
    const sc = score(id);
    if (sc !== prev) { place = i + 1; prev = sc; }
    return { id, place, score: sc };
  });
}

export function recordBlock(s, game, results) {
  if (s.recorded) return h('p', { class: 'good center' }, '✓ Ins Abend-Ranking eingetragen');
  return h('button', {
    class: 'btn good big block',
    onclick: () => {
      record(game, results());
      s.recorded = true;
      save();
      toast('Ergebnis eingetragen 🏆');
      app.rerender();
    },
  }, '🏆 Ins Abend-Ranking eintragen');
}

export function rankingTable(ranked, unit = 'Punkte') {
  return h('div', { class: 'table-wrap' }, h('table', { class: 'score' },
    h('tr', {}, h('th', {}, '#'), h('th', { class: 'l' }, 'Spieler'), h('th', {}, unit)),
    ranked.map(r => h('tr', {},
      h('td', { class: r.place === 1 ? 'rank-1' : '' }, r.place === 1 ? '🏆' : r.place + '.'),
      h('td', { class: 'l' }, pill(r.id)),
      h('td', {}, r.score)))));
}

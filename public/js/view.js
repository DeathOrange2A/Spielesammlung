// Generische Spieler-Ansicht. Wird auf verbundenen Handys UND auf dem Host-Gerät
// (wenn das Handy herumgereicht wird) gleich dargestellt.
//
// view = {
//   game, title, text, emoji, tone: 'night'|'day'|'danger'|'dead'|'good',
//   card: { emoji, name, text, color }, cardMode: 'reveal' (große Karte zum Aufdecken), seen,
//   choose: { key, options:[{id,label,sub,disabled}], count, chosen, submit, locked, allowNone, noneLabel },
//   buttons: [{ id, label, style }], list: [{ label, sub }],
//   timer: { remainingMs, paused }, key, needsInput, vibrate
// }
// Aktionen: { a:'seen' } | { a:'choose', key, ids } | { a:'btn', id, key }

import { h, fmtTime, vibrate } from './util.js';

const tentative = {}; // Auswahl, die noch nicht abgeschickt wurde (überlebt Neuzeichnen)
const revealed = {};
let lastVibrateKey = null;

export function renderView(root, v, send) {
  root.innerHTML = '';
  if (!v) {
    root.append(h('div', { class: 'view' }, h('p', { class: 'muted' }, 'Verbinde …')));
    return;
  }
  const wrap = h('div', { class: 'view tone-' + (v.tone || 'plain') });
  if (v.game) wrap.append(h('div', { class: 'view-game' }, v.game));
  if (v.emoji) wrap.append(h('div', { class: 'view-emoji' }, v.emoji));
  if (v.title) wrap.append(h('h2', { class: 'view-title' }, v.title));
  if (v.text) for (const para of String(v.text).split('\n')) if (para.trim()) wrap.append(h('p', { class: 'view-text' }, para));
  if (v.card && v.cardMode === 'reveal') wrap.append(flipCard(v, send));
  if (v.timer) wrap.append(timerEl(v));
  if (v.list && v.list.length) {
    wrap.append(h('ul', { class: 'view-list' }, v.list.map(it =>
      h('li', {}, h('b', {}, it.label), it.sub ? h('span', { class: 'muted' }, ' ' + it.sub) : null))));
  }
  if (v.choose) wrap.append(chooser(v.choose, send));
  if (v.buttons && v.buttons.length) {
    wrap.append(h('div', { class: 'view-buttons' }, v.buttons.map(b =>
      h('button', { class: 'btn big ' + (b.style || ''), disabled: !!b.disabled, onclick: () => send({ a: 'btn', id: b.id, key: v.key }) }, b.label))));
  }
  if (v.card && v.cardMode !== 'reveal') wrap.append(miniCard(v.card));
  root.append(wrap);

  if (v.vibrate && v.key && v.key !== lastVibrateKey) vibrate([200, 100, 200]);
  lastVibrateKey = v.key || lastVibrateKey;
}

function timerEl(v) {
  const t = v.timer;
  if (t.paused) return h('div', { class: 'timer paused' }, fmtTime(t.remainingMs) + ' ⏸');
  const end = (v._recv || Date.now()) + t.remainingMs;
  return h('div', { class: 'timer', 'data-end': String(end) }, fmtTime(end - Date.now()));
}

function flipCard(v, send) {
  const k = v.key || 'card';
  let btn = null;
  const card = h('div', { class: 'flip' + (revealed[k] ? ' on' : '') },
    h('div', { class: 'flip-front' },
      h('div', { class: 'flip-q' }, '🂠'),
      h('div', {}, 'Tippen zum Aufdecken'),
      h('small', { class: 'muted' }, 'Niemand sonst sollte hinschauen!')),
    h('div', { class: 'flip-back', style: { background: v.card.color || '#334' } },
      h('div', { class: 'card-emoji' }, v.card.emoji || '🃏'),
      h('div', { class: 'card-name' }, v.card.name),
      v.card.text ? h('div', { class: 'card-text' }, v.card.text) : null));
  card.addEventListener('click', () => {
    revealed[k] = !revealed[k];
    card.classList.toggle('on', revealed[k]);
    if (btn) btn.disabled = !revealed[k];
  });
  const out = h('div', { class: 'flip-wrap' }, card);
  if (!v.seen) {
    btn = h('button', {
      class: 'btn primary big', disabled: !revealed[k],
      onclick: () => { revealed[k] = false; send({ a: 'seen', key: v.key }); },
    }, 'Gesehen – Karte verdecken ✓');
    out.append(btn);
  }
  return out;
}

function miniCard(c) {
  const box = h('div', { class: 'mini-card hidden' },
    h('div', { class: 'card-emoji' }, c.emoji),
    h('div', { class: 'card-name' }, c.name),
    c.text ? h('div', { class: 'card-text small' }, c.text) : null);
  const btn = h('button', { class: 'btn ghost small' }, '🂠 Meine Karte zeigen');
  btn.addEventListener('click', () => {
    const hidden = box.classList.toggle('hidden');
    btn.textContent = hidden ? '🂠 Meine Karte zeigen' : '🙈 Karte verdecken';
  });
  return h('div', { class: 'stack' }, btn, box);
}

function chooser(c, send) {
  const k = c.key || 'choose';
  if (!tentative[k]) tentative[k] = c.chosen ? [...c.chosen] : [];
  const sel = tentative[k];
  const need = c.count || 1;
  const grid = h('div', { class: 'choose-grid' });
  const submit = h('button', { class: 'btn primary big' });
  const update = () => {
    for (const b of grid.children) b.classList.toggle('sel', sel.includes(b.dataset.id));
    const none = c.allowNone && sel.length === 0;
    submit.disabled = !!c.locked || !(sel.length === need || none);
    submit.textContent = none ? (c.noneLabel || 'Niemanden wählen') : (c.submit || 'Bestätigen');
  };
  for (const o of c.options) {
    grid.append(h('button', {
      class: 'choose-opt', 'data-id': o.id, disabled: !!(o.disabled || c.locked),
      onclick: () => {
        const i = sel.indexOf(o.id);
        if (i >= 0) sel.splice(i, 1);
        else {
          if (need === 1) sel.length = 0;
          else if (sel.length >= need) sel.shift();
          sel.push(o.id);
        }
        update();
      },
    }, h('span', {}, o.label), o.sub ? h('small', {}, o.sub) : null));
  }
  submit.addEventListener('click', () => send({ a: 'choose', key: k, ids: [...sel] }));
  update();
  return h('div', { class: 'choose' },
    c.prompt ? h('p', { class: 'choose-prompt' }, c.prompt) : null,
    grid,
    c.locked ? h('p', { class: 'muted' }, c.lockedText || 'Abgeschickt ✓') : submit);
}

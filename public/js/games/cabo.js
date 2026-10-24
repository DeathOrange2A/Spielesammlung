// Cabo-Zähler: Punkte pro Runde, Cabo-Rufer, Kamikaze, 100→50.
import { S, save, pname } from '../store.js';
import { h, app, toast, confirmDialog } from '../util.js';
import { topbar, playerPicker, selectedIds, stepper, toggle, pill, recordBlock, card, rank, rankingTable } from '../ui.js';

const def = () => ({ desel: [], players: null, rounds: [], draft: { raw: {}, caller: null, kamikaze: null }, opts: { limit: 100, penalty: 5, reset: true, tieWins: false } });
const st = () => (S.games.cabo ||= def());
const commit = () => { save(); app.rerender(); };

function roundScores(s, r) {
  const ids = s.players;
  const f = {};
  if (r.kamikaze) {
    for (const id of ids) f[id] = id === r.kamikaze ? 0 : 50;
    return f;
  }
  const min = Math.min(...ids.map(id => r.raw[id]));
  const atMin = ids.filter(id => r.raw[id] === min).length;
  for (const id of ids) {
    let v = r.raw[id];
    if (id === r.caller) {
      const lowest = r.raw[id] === min && (atMin === 1 || s.opts.tieWins);
      v = lowest ? 0 : v + s.opts.penalty;
    }
    f[id] = v;
  }
  return f;
}

function totals(s) {
  const t = {}, used = {}, resets = [];
  for (const id of s.players) t[id] = 0;
  const hist = s.rounds.map(r => {
    const f = roundScores(s, r);
    const resetNow = [];
    for (const id of s.players) {
      t[id] += f[id];
      if (s.opts.reset && t[id] === s.opts.limit && !used[id]) {
        t[id] = Math.round(s.opts.limit / 2);
        used[id] = true;
        resetNow.push(id);
      }
    }
    resets.push(resetNow);
    return { f, t: { ...t } };
  });
  return { t, hist, resets };
}

export function render() {
  const s = st();
  const el = h('div', {}, topbar('🃏 Cabo', { rules: 'cabo' }));
  if (!s.players) {
    el.append(
      playerPicker(s, { min: 2, max: 8 }),
      card('Regeln',
        h('div', { class: 'row between' }, h('span', {}, 'Spielende über'), stepper(s.opts.limit, v => { s.opts.limit = v; commit(); }, { min: 50, max: 300, step: 10 })),
        h('div', { class: 'row between' }, h('span', {}, 'Strafpunkte Cabo-Rufer'), stepper(s.opts.penalty, v => { s.opts.penalty = v; commit(); }, { min: 0, max: 20 })),
        toggle(`Genau ${s.opts.limit} → zurück auf ${Math.round(s.opts.limit / 2)}`, s.opts.reset, v => { s.opts.reset = v; save(); }, 'Einmal pro Spieler und Spiel.'),
        toggle('Gleichstand: Cabo-Rufer bekommt trotzdem 0', s.opts.tieWins, v => { s.opts.tieWins = v; save(); }, 'Aus = bei Gleichstand bekommt der Rufer Strafpunkte.')),
      h('button', {
        class: 'btn primary big block', disabled: selectedIds(s).length < 2,
        onclick: () => { s.players = selectedIds(s); s.rounds = []; s.draft = { raw: {}, caller: null, kamikaze: null }; s.recorded = false; commit(); },
      }, '▶ Spiel starten'),
      quickRef());
    return el;
  }

  const { t, hist, resets } = totals(s);
  const over = s.players.some(id => t[id] > s.opts.limit);
  const minT = Math.min(...s.players.map(id => t[id]));

  // Punktetabelle
  el.append(card(over ? '🏁 Endstand' : `Spielstand nach ${s.rounds.length} ${s.rounds.length === 1 ? 'Runde' : 'Runden'}`,
    h('div', { class: 'table-wrap' }, h('table', { class: 'score' },
      h('tr', {}, h('th', { class: 'l' }, '#'), s.players.map(id => h('th', {}, pill(id)))),
      hist.map((row, i) => h('tr', {},
        h('td', { class: 'l muted' }, i + 1),
        s.players.map(id => h('td', {},
          row.t[id],
          h('small', {}, (s.rounds[i].caller === id ? '📣 ' : '') + (s.rounds[i].kamikaze === id ? '💥 ' : '') + '+' + row.f[id] + (resets[i].includes(id) ? ' ↺50' : '')))))),
      h('tr', { class: 'total' }, h('td', { class: 'l' }, 'Σ'), s.players.map(id => h('td', { class: t[id] === minT ? 'lead' : t[id] > s.opts.limit ? 'over' : '' }, t[id]))))),
    s.rounds.length ? h('button', {
      class: 'btn ghost small', style: { marginTop: '8px' },
      onclick: async () => { if (await confirmDialog('Letzte Runde löschen?', 'Löschen', true)) { s.rounds.pop(); s.recorded = false; commit(); } },
    }, '↶ Letzte Runde löschen') : null));

  if (over) {
    const ranked = rank(s.players, id => t[id], true);
    el.append(
      h('div', { class: 'banner' }, h('div', { class: 'big-emoji' }, '🏆'), h('h2', {}, `${pname(ranked[0].id)} gewinnt!`), h('p', {}, `mit ${ranked[0].score} Punkten`)),
      rankingTable(ranked),
      recordBlock(s, 'Cabo', () => ranked.map(r => ({ id: r.id, place: r.place }))));
  } else {
    el.append(roundForm(s));
  }

  el.append(h('button', {
    class: 'btn big block', style: { marginTop: '12px' },
    onclick: async () => { if (over || await confirmDialog('Neues Spiel starten? Der aktuelle Stand geht verloren.', 'Neues Spiel', true)) { s.players = null; commit(); } },
  }, '🔁 Neues Spiel'), quickRef());
  return el;
}

function roundForm(s) {
  const d = s.draft;
  const inputs = s.players.map(id => h('div', { class: 'player-row' },
    h('span', { class: 'grow' }, pill(id)),
    h('input', {
      class: 'num', type: 'number', inputmode: 'numeric', min: 0, max: 99, placeholder: '0',
      value: d.raw[id] ?? '',
      oninput: e => { d.raw[id] = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0); save(); },
    })));
  const chip = (id, field, label) => h('button', {
    class: 'chip' + (d[field] === id ? ' on' : ''),
    onclick: () => { d[field] = d[field] === id ? null : id; commit(); },
  }, label || pname(id));
  return card(`Runde ${s.rounds.length + 1} eintragen`,
    h('p', { class: 'small muted' }, 'Kartensumme jedes Spielers eingeben:'),
    ...inputs,
    h('h4', { style: { margin: '14px 0 4px' } }, '📣 Wer hat Cabo gerufen?'),
    h('div', { class: 'chips' }, s.players.map(id => chip(id, 'caller'))),
    h('h4', { style: { margin: '10px 0 4px' } }, '💥 Kamikaze (12, 12, 13, 13)?'),
    h('div', { class: 'chips' }, s.players.map(id => chip(id, 'kamikaze'))),
    h('button', {
      class: 'btn primary big block', style: { marginTop: '10px' },
      onclick: () => {
        if (!d.kamikaze && s.players.some(id => d.raw[id] === undefined)) return toast('Bitte für alle eine Summe eintragen');
        const raw = {};
        for (const id of s.players) raw[id] = d.raw[id] ?? 0;
        s.rounds.push({ raw, caller: d.caller, kamikaze: d.kamikaze });
        s.draft = { raw: {}, caller: null, kamikaze: null };
        commit();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    }, '✓ Runde speichern'));
}

function quickRef() {
  return h('details', { class: 'card' },
    h('summary', {}, '📋 Kurzübersicht Kartenaktionen'),
    h('ul', {},
      h('li', {}, '7 / 8 – Peek: eigene Karte ansehen'),
      h('li', {}, '9 / 10 – Spy: fremde Karte ansehen'),
      h('li', {}, '11 / 12 – Swap: eigene mit fremder Karte blind tauschen'),
      h('li', {}, 'Cabo-Rufer mit niedrigster Summe: 0 Punkte, sonst Summe + Strafe'),
      h('li', {}, 'Kamikaze (12, 12, 13, 13): alle anderen 50 Punkte')));
}

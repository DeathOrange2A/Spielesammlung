// Kniffel: digitaler Spielblock – wahlweise mit Würfeln in der App oder mit echten Würfeln.
import { S, save, pname } from '../store.js';
import { h, app, toast, confirmDialog, modal, vibrate } from '../util.js';
import { topbar, playerPicker, selectedIds, toggle, pill, recordBlock, card, rank, rankingTable } from '../ui.js';

const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const UPPER = [
  { id: 'n1', name: 'Einser', hint: 'Summe der 1er' },
  { id: 'n2', name: 'Zweier', hint: 'Summe der 2er' },
  { id: 'n3', name: 'Dreier', hint: 'Summe der 3er' },
  { id: 'n4', name: 'Vierer', hint: 'Summe der 4er' },
  { id: 'n5', name: 'Fünfer', hint: 'Summe der 5er' },
  { id: 'n6', name: 'Sechser', hint: 'Summe der 6er' },
];
const LOWER = [
  { id: 'p3', name: 'Dreierpasch', hint: 'Augensumme' },
  { id: 'p4', name: 'Viererpasch', hint: 'Augensumme' },
  { id: 'fh', name: 'Full House', hint: '25 Punkte' },
  { id: 'ks', name: 'Kleine Straße', hint: '30 Punkte' },
  { id: 'gs', name: 'Große Straße', hint: '40 Punkte' },
  { id: 'kn', name: 'Kniffel', hint: '50 Punkte' },
  { id: 'ch', name: 'Chance', hint: 'Augensumme' },
];
const ALL = [...UPPER, ...LOWER];

const def = () => ({ desel: [], players: null, opts: { appDice: true, extraKniffel: false }, sheets: {}, turn: 0, dice: [], held: [], rolls: 0 });
const st = () => (S.games.kniffel ||= def());
const commit = () => { save(); app.rerender(); };

// ---------- Wertung ----------
function counts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}
const sum = dice => dice.reduce((a, b) => a + b, 0);
function hasRun(c, len) {
  for (let start = 1; start + len - 1 <= 6; start++) {
    let ok = true;
    for (let v = start; v < start + len; v++) if (!c[v]) ok = false;
    if (ok) return true;
  }
  return false;
}
export function score(cat, dice) {
  if (dice.length !== 5) return 0;
  const c = counts(dice);
  const max = Math.max(...c);
  if (cat[0] === 'n') { const v = +cat[1]; return c[v] * v; }
  switch (cat) {
    case 'p3': return max >= 3 ? sum(dice) : 0;
    case 'p4': return max >= 4 ? sum(dice) : 0;
    case 'fh': return (c.includes(3) && c.includes(2)) ? 25 : 0;
    case 'ks': return hasRun(c, 4) ? 30 : 0;
    case 'gs': return hasRun(c, 5) ? 40 : 0;
    case 'kn': return max === 5 ? 50 : 0;
    case 'ch': return sum(dice);
  }
  return 0;
}

function totals(sheet) {
  const up = UPPER.reduce((a, c) => a + (sheet[c.id] ?? 0), 0);
  const bonus = up >= 63 ? 35 : 0;
  const low = LOWER.reduce((a, c) => a + (sheet[c.id] ?? 0), 0) + (sheet.extra || 0);
  return { up, bonus, low, total: up + bonus + low };
}
const full = sheet => ALL.every(c => sheet[c.id] !== undefined);

// ---------- Spielablauf ----------
function current(s) { return s.players[s.turn % s.players.length]; }

function nextTurn(s) {
  s.dice = [];
  s.held = [];
  s.rolls = 0;
  for (let i = 1; i <= s.players.length; i++) {
    const idx = (s.turn + i) % s.players.length;
    if (!full(s.sheets[s.players[idx]])) { s.turn = idx; return; }
  }
}

function roll(s) {
  if (s.rolls >= 3) return;
  const dice = [];
  for (let i = 0; i < 5; i++) dice.push(s.held[i] && s.dice[i] ? s.dice[i] : 1 + Math.floor(Math.random() * 6));
  s.dice = dice;
  s.rolls++;
  vibrate(40);
  commit();
  document.querySelectorAll('.kn-die:not(.held)').forEach(el => { el.classList.remove('roll'); void el.offsetWidth; el.classList.add('roll'); });
}

function enter(s, cat) {
  const id = current(s);
  const sheet = s.sheets[id];
  if (sheet[cat] !== undefined || s.dice.length !== 5) return;
  const pts = score(cat, s.dice);
  if (s.opts.extraKniffel && score('kn', s.dice) && sheet.kn === 50) sheet.extra = (sheet.extra || 0) + 50;
  sheet[cat] = pts;
  nextTurn(s);
  commit();
  toast(`${pname(id)}: ${pts} Punkte bei ${ALL.find(c => c.id === cat).name}`);
}

// ---------- Oberfläche ----------
export function render() {
  const s = st();
  const el = h('div', {}, topbar('🎲 Kniffel', { rules: 'kniffel' }));
  if (!s.players) {
    el.append(
      playerPicker(s, { min: 1, max: 10, title: 'Mitspielende (Reihenfolge = Startseite)' }),
      card('Würfel',
        h('button', { class: 'mode-opt' + (s.opts.appDice ? ' on' : ''), onclick: () => { s.opts.appDice = true; commit(); } },
          h('b', {}, '📱 In der App würfeln'), h('span', {}, 'Keine Würfel nötig: 3 Würfe pro Zug, Würfel zum Halten antippen. Die App schlägt die Punkte vor.')),
        h('button', { class: 'mode-opt' + (!s.opts.appDice ? ' on' : ''), onclick: () => { s.opts.appDice = false; commit(); } },
          h('b', {}, '🎲 Eigene Würfel'), h('span', {}, 'Ihr würfelt echt und tippt den Wurf ein – die App rechnet und führt den Block.'))),
      card('Variante',
        toggle('Extra-Kniffel: +50 Bonus', s.opts.extraKniffel, v => { s.opts.extraKniffel = v; save(); }, 'Jeder weitere Kniffel gibt 50 Bonuspunkte, wenn das Kniffel-Feld schon mit 50 belegt ist.')),
      h('button', {
        class: 'btn primary big block', disabled: !selectedIds(s).length,
        onclick: () => {
          s.players = selectedIds(s);
          s.sheets = {};
          for (const id of s.players) s.sheets[id] = {};
          s.turn = 0; s.dice = []; s.held = []; s.rolls = 0; s.recorded = false;
          commit();
        },
      }, '▶ Spiel starten'));
    return el;
  }

  const over = s.players.every(id => full(s.sheets[id]));
  if (over) {
    const ranked = rank(s.players, id => totals(s.sheets[id]).total);
    el.append(
      h('div', { class: 'banner' }, h('div', { class: 'big-emoji' }, '🏆'), h('h2', {}, `${pname(ranked[0].id)} gewinnt!`), h('p', {}, `mit ${ranked[0].score} Punkten`)),
      rankingTable(ranked),
      recordBlock(s, 'Kniffel', () => ranked.map(r => ({ id: r.id, place: r.place }))));
  } else {
    if (full(s.sheets[current(s)])) { nextTurn(s); save(); } // z. B. nach einer Korrektur im Block
    el.append(turnCard(s));
  }
  el.append(sheetTable(s));
  el.append(h('button', {
    class: 'btn big block', style: { marginTop: '12px' },
    onclick: async () => { if (over || await confirmDialog('Neues Spiel starten? Der aktuelle Block geht verloren.', 'Neues Spiel', true)) { s.players = null; commit(); } },
  }, '🔁 Neues Spiel'));
  return el;
}

function turnCard(s) {
  const id = current(s);
  const sheet = s.sheets[id];
  const parts = [h('div', { class: 'center' }, h('p', { class: 'muted', style: { margin: 0 } }, 'Am Zug'), h('div', { class: 'pass-name', style: { margin: '2px 0 8px' } }, pill(id)))];

  if (s.opts.appDice) {
    const canHold = s.rolls > 0 && s.rolls < 3;
    parts.push(
      h('div', { class: 'kn-dice' }, [0, 1, 2, 3, 4].map(i => h('button', {
        class: 'kn-die' + (s.held[i] ? ' held' : '') + (s.dice[i] ? '' : ' empty'),
        disabled: !canHold,
        onclick: () => { s.held[i] = !s.held[i]; commit(); },
      }, s.dice[i] ? FACES[s.dice[i]] : '·'))),
      h('p', { class: 'small muted center' }, s.rolls === 0 ? 'Los geht’s – würfeln!' : s.rolls < 3 ? 'Würfel antippen zum Halten 🔒, dann nochmal würfeln – oder unten eintragen.' : 'Keine Würfe mehr – trag dein Ergebnis unten ein.'),
      h('button', { class: 'btn primary big block', disabled: s.rolls >= 3, onclick: () => roll(s) },
        s.rolls === 0 ? '🎲 Würfeln' : `🎲 Nochmal würfeln (${3 - s.rolls} übrig)`));
  } else {
    parts.push(
      h('p', { class: 'small muted center' }, 'Endgültigen Wurf eintippen (5 Würfel):'),
      h('div', { class: 'kn-dice' }, [0, 1, 2, 3, 4].map(i => h('button', {
        class: 'kn-die' + (s.dice[i] ? '' : ' empty'),
        onclick: () => { s.dice.splice(i, 1); commit(); },
        title: 'Entfernen',
      }, s.dice[i] ? FACES[s.dice[i]] : '·'))),
      h('div', { class: 'kn-faces' }, [1, 2, 3, 4, 5, 6].map(v => h('button', {
        class: 'btn', disabled: s.dice.length >= 5,
        onclick: () => { s.dice.push(v); s.dice.sort((a, b) => a - b); commit(); },
      }, FACES[v]))),
      s.dice.length ? h('button', { class: 'btn ghost small', onclick: () => { s.dice = []; commit(); } }, 'Wurf löschen') : null);
  }

  if (s.dice.length === 5) {
    const open = ALL.filter(c => sheet[c.id] === undefined).map(c => ({ ...c, pts: score(c.id, s.dice) }));
    const best = Math.max(...open.map(c => c.pts));
    parts.push(h('h3', { style: { marginTop: '14px' } }, 'Eintragen'),
      h('div', { class: 'kn-options' }, open.map(c => h('button', {
        class: 'kn-opt' + (c.pts === best && best > 0 ? ' best' : '') + (c.pts === 0 ? ' zero' : ''),
        onclick: async () => {
          if (c.pts === 0 && !(await confirmDialog(`${c.name} mit 0 Punkten streichen?`, 'Streichen'))) return;
          enter(s, c.id);
        },
      }, h('span', {}, c.name), h('b', {}, c.pts === 0 ? '✗ 0' : c.pts)))));
  }
  return card(null, ...parts);
}

function sheetTable(s) {
  const id = !s.players.every(p => full(s.sheets[p])) ? current(s) : null;
  const t = Object.fromEntries(s.players.map(p => [p, totals(s.sheets[p])]));
  const best = Math.max(...s.players.map(p => t[p].total));
  const cell = (p, cat) => {
    const v = s.sheets[p][cat.id];
    return h('td', {
      class: p === id ? 'kn-cur' : '',
      onclick: () => editCell(s, p, cat),
    }, v === undefined ? h('span', { class: 'muted' }, '·') : v === 0 ? h('span', { class: 'muted' }, '✗') : v);
  };
  const sumRow = (label, fn, cls = '') => h('tr', { class: cls }, h('td', { class: 'l' }, label), s.players.map(p => h('td', { class: p === id ? 'kn-cur' : '' }, fn(p))));
  return card('📋 Spielblock',
    h('div', { class: 'table-wrap' }, h('table', { class: 'score kn-table' },
      h('tr', {}, h('th', { class: 'l' }, ''), s.players.map(p => h('th', { class: p === id ? 'kn-cur' : '' }, pill(p)))),
      UPPER.map(c => h('tr', {}, h('td', { class: 'l' }, c.name), s.players.map(p => cell(p, c)))),
      sumRow('Oben', p => t[p].up, 'kn-sum'),
      sumRow('Bonus (ab 63)', p => t[p].bonus ? '+35' : h('small', {}, `noch ${Math.max(0, 63 - t[p].up)}`), 'kn-sum'),
      LOWER.map(c => h('tr', {}, h('td', { class: 'l' }, c.name), s.players.map(p => cell(p, c)))),
      s.opts.extraKniffel ? sumRow('Extra-Kniffel', p => s.sheets[p].extra || 0, 'kn-sum') : null,
      sumRow('Gesamt', p => h('span', { class: t[p].total === best ? 'lead' : '' }, t[p].total), 'total'))),
    h('p', { class: 'small muted' }, 'Feld antippen, um einen Wert zu korrigieren.'));
}

function editCell(s, p, cat) {
  modal(`${cat.name} – ${pname(p)}`, close => {
    const inp = h('input', { type: 'number', inputmode: 'numeric', min: 0, max: 50, value: s.sheets[p][cat.id] ?? '' });
    return h('div', {},
      h('p', { class: 'small muted' }, cat.hint),
      inp,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => { delete s.sheets[p][cat.id]; close(); commit(); } }, 'Leeren'),
        h('button', {
          class: 'btn primary', onclick: () => {
            const v = parseInt(inp.value, 10);
            if (isNaN(v) || v < 0) return toast('Bitte eine Zahl eingeben');
            s.sheets[p][cat.id] = v;
            close(); commit();
          },
        }, 'Speichern')));
  });
}

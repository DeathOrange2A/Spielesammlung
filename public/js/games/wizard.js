// Wizard-Zähler: Ansagen und Stiche pro Runde, automatische Wertung.
import { S, save, pname } from '../store.js';
import { h, app, toast, confirmDialog } from '../util.js';
import { topbar, playerPicker, selectedIds, stepper, toggle, pill, recordBlock, card, rank, rankingTable } from '../ui.js';

const def = () => ({ desel: [], players: null, dealer0: 0, rounds: [], cur: null, opts: { noEven: false } });
const st = () => (S.games.wizard ||= def());
const commit = () => { save(); app.rerender(); };

const totalRounds = n => Math.floor(60 / n);
const roundScore = (bid, got) => bid === got ? 20 + 10 * got : -10 * Math.abs(bid - got);

function newCur(s) {
  const c = { stage: 'bid', bids: {}, tricks: {} };
  for (const id of s.players) { c.bids[id] = 0; c.tricks[id] = 0; }
  return c;
}

function seatOrder(s, roundNo) {
  const n = s.players.length;
  const dealer = (s.dealer0 + roundNo - 1) % n;
  const order = [];
  for (let i = 1; i <= n; i++) order.push(s.players[(dealer + i) % n]);
  return { dealer: s.players[dealer], order };
}

function totals(s) {
  const t = {};
  for (const id of s.players) t[id] = 0;
  const hist = s.rounds.map(r => {
    const d = {};
    for (const id of s.players) { d[id] = roundScore(r.bids[id], r.tricks[id]); t[id] += d[id]; }
    return { d, t: { ...t }, r };
  });
  return { t, hist };
}

export function render() {
  const s = st();
  const el = h('div', {}, topbar('🧙 Wizard', { rules: 'wizard' }));
  if (!s.players) {
    const ids = selectedIds(s);
    el.append(
      playerPicker(s, { min: 3, max: 6, title: 'Mitspielende (Sitzreihenfolge)' }),
      h('p', { class: 'small muted' }, 'Die Reihenfolge entspricht der Spielerliste auf der Startseite (dort umsortierbar).'),
      card('Einstellungen',
        h('label', { class: 'field' }, h('span', {}, 'Wer gibt in Runde 1?'),
          h('select', { onchange: e => { s.dealer0 = +e.target.value; save(); } },
            ids.map((id, i) => h('option', { value: i, selected: s.dealer0 === i }, pname(id))))),
        toggle('Ansagen-Summe ≠ Kartenzahl', s.opts.noEven, v => { s.opts.noEven = v; save(); }, 'Variante: Es darf nicht aufgehen – mindestens einer liegt daneben.'),
        ids.length >= 3 ? h('p', { class: 'small muted' }, `${ids.length} Spieler → ${totalRounds(ids.length)} Runden`) : null),
      h('button', {
        class: 'btn primary big block', disabled: ids.length < 3 || ids.length > 6,
        onclick: () => { s.players = ids; s.dealer0 = Math.min(s.dealer0, ids.length - 1); s.rounds = []; s.cur = newCur(s); s.recorded = false; commit(); },
      }, '▶ Spiel starten'));
    return el;
  }

  const N = totalRounds(s.players.length);
  const { t, hist } = totals(s);
  const finished = s.rounds.length >= N;

  if (finished) {
    const ranked = rank(s.players, id => t[id]);
    el.append(
      h('div', { class: 'banner' }, h('div', { class: 'big-emoji' }, '🏆'), h('h2', {}, `${pname(ranked[0].id)} gewinnt!`), h('p', {}, `mit ${ranked[0].score} Punkten`)),
      rankingTable(ranked),
      recordBlock(s, 'Wizard', () => ranked.map(r => ({ id: r.id, place: r.place }))));
  } else {
    el.append(roundCard(s, N));
  }

  el.append(card('Punkte',
    h('div', { class: 'table-wrap' }, h('table', { class: 'score' },
      h('tr', {}, h('th', { class: 'l' }, 'R'), s.players.map(id => h('th', {}, pill(id)))),
      hist.map((row, i) => h('tr', {},
        h('td', { class: 'l muted' }, i + 1),
        s.players.map(id => h('td', {}, row.t[id], h('small', { class: row.d[id] >= 0 ? 'good' : 'bad' }, `${row.r.bids[id]}/${row.r.tricks[id]} · ${row.d[id] > 0 ? '+' : ''}${row.d[id]}`))))),
      h('tr', { class: 'total' }, h('td', { class: 'l' }, 'Σ'), s.players.map(id => h('td', { class: t[id] === Math.max(...s.players.map(x => t[x])) ? 'lead' : '' }, t[id]))))),
    h('p', { class: 'small muted' }, 'Klein: Ansage/Stiche · Punkte der Runde'),
    s.rounds.length ? h('button', {
      class: 'btn ghost small', onclick: async () => {
        if (!(await confirmDialog('Letzte Runde zurücknehmen und neu eintragen?', 'Zurücknehmen'))) return;
        const r = s.rounds.pop();
        s.cur = { stage: 'tricks', bids: { ...r.bids }, tricks: { ...r.tricks } };
        s.recorded = false;
        commit();
      },
    }, '↶ Letzte Runde korrigieren') : null));

  el.append(h('button', {
    class: 'btn big block', style: { marginTop: '12px' },
    onclick: async () => { if (finished || await confirmDialog('Neues Spiel starten? Der aktuelle Stand geht verloren.', 'Neues Spiel', true)) { s.players = null; commit(); } },
  }, '🔁 Neues Spiel'));
  return el;
}

function roundCard(s, N) {
  const no = s.rounds.length + 1;
  const c = s.cur || (s.cur = newCur(s));
  const { dealer, order } = seatOrder(s, no);
  const bidSum = s.players.reduce((a, id) => a + c.bids[id], 0);
  const trickSum = s.players.reduce((a, id) => a + c.tricks[id], 0);
  const evenBlocked = s.opts.noEven && bidSum === no;

  const head = h('div', { class: 'center' },
    h('h2', { style: { margin: '0' } }, `Runde ${no} / ${N}`),
    h('p', { class: 'muted' }, `${no} ${no === 1 ? 'Karte' : 'Karten'} · Geber: `, pill(dealer)),
    h('p', { class: 'small muted' }, no === N ? 'Letzte Runde: kein Trumpf!' : 'Trumpf: nächste Karte aufdecken (Zauberer → Geber wählt, Narr → kein Trumpf)'));

  if (c.stage === 'bid') {
    return card(null, head,
      h('h3', {}, '1. Ansagen'),
      ...order.map(id => h('div', { class: 'player-row' }, h('span', { class: 'grow' }, pill(id)), stepper(c.bids[id], v => { c.bids[id] = v; commit(); }, { min: 0, max: no }))),
      h('p', { class: 'center ' + (evenBlocked ? 'warn' : 'muted') },
        `Summe Ansagen: ${bidSum} von ${no} Stichen` + (bidSum === no ? ' – geht genau auf' : bidSum > no ? ' – überreizt' : ' – unterreizt'),
        evenBlocked ? h('br') : null, evenBlocked ? 'Variante aktiv: Die Summe darf nicht aufgehen!' : null),
      h('button', { class: 'btn primary big block', disabled: evenBlocked, onclick: () => { c.stage = 'tricks'; for (const id of s.players) c.tricks[id] = c.bids[id]; commit(); } }, 'Ansagen fertig → Stiche'));
  }

  return card(null, head,
    h('h3', {}, '2. Gemachte Stiche'),
    ...order.map(id => h('div', { class: 'player-row' },
      h('span', { class: 'grow' }, pill(id), h('span', { class: 'small muted' }, ` Ansage ${c.bids[id]}`)),
      stepper(c.tricks[id], v => { c.tricks[id] = v; commit(); }, { min: 0, max: no }),
      h('span', { class: 'small ' + (c.tricks[id] === c.bids[id] ? 'good' : 'bad'), style: { width: '44px', textAlign: 'right' } }, (roundScore(c.bids[id], c.tricks[id]) > 0 ? '+' : '') + roundScore(c.bids[id], c.tricks[id])))),
    h('p', { class: 'center ' + (trickSum === no ? 'good' : 'warn') }, `Stiche gesamt: ${trickSum} von ${no}`),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => { c.stage = 'bid'; commit(); } }, '← Ansagen'),
      h('button', {
        class: 'btn primary big', disabled: trickSum !== no,
        onclick: () => {
          if (trickSum !== no) return toast('Die Stiche müssen genau aufgehen');
          s.rounds.push({ bids: { ...c.bids }, tricks: { ...c.tricks } });
          s.cur = newCur(s);
          commit();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      }, '✓ Runde werten')));
}

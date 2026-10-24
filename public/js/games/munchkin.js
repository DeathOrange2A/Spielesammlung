// Munchkin-Zähler: Stufe, Ausrüstung, Kampfstärke, Kampfrechner und Würfel.
import { S, save, pname } from '../store.js';
import { h, app, confirmDialog } from '../util.js';
import { topbar, playerPicker, selectedIds, stepper, toggle, pill, recordBlock, card, rank, rankingTable } from '../ui.js';

const def = () => ({ desel: [], players: null, p: {}, opts: { max: 10 }, fight: null, dice: null });
const st = () => (S.games.munchkin ||= def());
const commit = () => { save(); app.rerender(); };
const power = m => m.level + m.gear;
const newFight = () => ({ hero: null, helper: null, monster: 1, heroMod: 0, monsterMod: 0 });

export function render() {
  const s = st();
  const el = h('div', {}, topbar('⚔️ Munchkin', { rules: 'munchkin' }));
  if (!s.players) {
    el.append(
      playerPicker(s, { min: 2, max: 10 }),
      card('Einstellungen',
        toggle('Epic Munchkin (bis Stufe 20)', s.opts.max === 20, v => { s.opts.max = v ? 20 : 10; save(); app.rerender(); })),
      h('button', {
        class: 'btn primary big block', disabled: selectedIds(s).length < 2,
        onclick: () => {
          s.players = selectedIds(s);
          s.p = {};
          for (const id of s.players) s.p[id] = { level: 1, gear: 0, sex: 'm', notes: '' };
          s.fight = newFight();
          s.recorded = false;
          commit();
        },
      }, '▶ Spiel starten'));
    return el;
  }

  const winner = s.players.find(id => s.p[id].level >= s.opts.max);
  if (winner) {
    const ranked = rank(s.players, id => s.p[id].level * 1000 + power(s.p[id]));
    el.append(
      h('div', { class: 'banner' }, h('div', { class: 'big-emoji' }, '👑'), h('h2', {}, `${pname(winner)} gewinnt!`), h('p', {}, `Stufe ${s.opts.max} erreicht`)),
      rankingTable(ranked.map(r => ({ ...r, score: 'Stufe ' + s.p[r.id].level })), 'Stufe'),
      recordBlock(s, 'Munchkin', () => ranked.map(r => ({ id: r.id, place: r.place }))));
  }

  for (const id of s.players) el.append(playerCard(s, id));
  el.append(fightCard(s), diceCard(s));
  el.append(h('button', {
    class: 'btn big block', style: { marginTop: '12px' },
    onclick: async () => { if (winner || await confirmDialog('Neues Spiel starten? Der aktuelle Stand geht verloren.', 'Neues Spiel', true)) { s.players = null; commit(); } },
  }, '🔁 Neues Spiel'));
  return el;
}

function playerCard(s, id) {
  const m = s.p[id];
  return h('div', { class: 'mk-card' },
    h('div', { class: 'mk-head' },
      pill(id),
      h('button', { class: 'btn small ghost', onclick: () => { m.sex = m.sex === 'm' ? 'w' : 'm'; commit(); }, title: 'Geschlecht wechseln' }, m.sex === 'm' ? '♂' : '♀'),
      h('div', { class: 'mk-power' }, h('b', {}, power(m)), h('span', { class: 'small muted' }, 'Kampfstärke'))),
    h('div', { class: 'mk-grid' },
      h('div', {}, h('label', {}, 'Stufe'), stepper(m.level, v => { m.level = v; commit(); }, { min: 1, max: s.opts.max })),
      h('div', {}, h('label', {}, 'Ausrüstung'), stepper(m.gear, v => { m.gear = v; commit(); }, { min: -10, max: 99 }))),
    h('input', {
      style: { marginTop: '10px' }, placeholder: 'Rasse / Klasse / Notizen', value: m.notes || '',
      onchange: e => { m.notes = e.target.value; save(); },
    }));
}

function fightCard(s) {
  const f = s.fight ||= newFight();
  const heroSide = (f.hero ? power(s.p[f.hero]) : 0) + (f.helper ? power(s.p[f.helper]) : 0) + f.heroMod;
  const monsterSide = f.monster + f.monsterMod;
  const set = (k, v) => { f[k] = v; commit(); };
  const chips = (field, exclude) => h('div', { class: 'chips' }, s.players.filter(id => id !== exclude).map(id =>
    h('button', { class: 'chip' + (f[field] === id ? ' on' : ''), onclick: () => set(field, f[field] === id ? null : id) }, pname(id))));
  let verdict = null;
  if (f.hero) {
    verdict = heroSide > monsterSide
      ? h('p', { class: 'center good', style: { fontSize: '1.3rem', fontWeight: 800 } }, `⚔️ Sieg! (${heroSide} gegen ${monsterSide})`)
      : h('p', { class: 'center bad', style: { fontSize: '1.3rem', fontWeight: 800 } }, `💀 Das Monster gewinnt (${heroSide} gegen ${monsterSide}) – es fehlen ${monsterSide - heroSide + 1}`);
  }
  return card('⚔️ Kampfrechner',
    h('p', { class: 'small muted' }, 'Kämpfer'), chips('hero'),
    h('p', { class: 'small muted' }, 'Helfer (optional)'), chips('helper', f.hero),
    h('div', { class: 'mk-grid', style: { marginTop: '10px' } },
      h('div', {}, h('label', {}, 'Monsterstufe'), stepper(f.monster, v => set('monster', v), { min: 1, max: 50 })),
      h('div', {}, h('label', {}, 'Monster-Bonus'), stepper(f.monsterMod, v => set('monsterMod', v), { min: -20, max: 50 })),
      h('div', {}, h('label', {}, 'Bonus Helden (Tränke etc.)'), stepper(f.heroMod, v => set('heroMod', v), { min: -20, max: 50 })),
      h('div', {}, h('label', {}, 'Helden gesamt'), h('div', { class: 'stepper-val', style: { fontSize: '2rem' } }, heroSide))),
    verdict,
    h('p', { class: 'small muted center' }, 'Gleichstand gewinnt das Monster (Krieger gewinnen bei Gleichstand).'),
    h('button', { class: 'btn ghost small', onclick: () => { s.fight = newFight(); commit(); } }, 'Kampf zurücksetzen'));
}

function diceCard(s) {
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const diceEl = h('div', { class: 'dice' }, s.dice ? faces[s.dice - 1] : '🎲');
  const info = h('p', { class: 'center' }, s.dice ? (s.dice >= 5 ? `${s.dice} – Weglaufen gelingt! 🏃` : `${s.dice} – Weglaufen gescheitert …`) : 'Weglaufen gelingt bei 5 oder 6.');
  return card('🎲 Würfel', diceEl, info,
    h('button', {
      class: 'btn primary big block', onclick: () => {
        s.dice = 1 + Math.floor(Math.random() * 6);
        save();
        diceEl.classList.remove('roll');
        void diceEl.offsetWidth;
        diceEl.classList.add('roll');
        diceEl.textContent = faces[s.dice - 1];
        info.textContent = s.dice >= 5 ? `${s.dice} – Weglaufen gelingt! 🏃` : `${s.dice} – Weglaufen gescheitert …`;
      },
    }, 'Würfeln'));
}

// Imposter: Alle kennen das geheime Wort – außer dem Imposter.
import { S, save, pname, newId } from '../store.js';
import { h, app, beep, shuffle, pick, timerSpan, confirmDialog, modal, toast } from '../util.js';
import * as room from '../room.js';
import { topbar, playerPicker, selectedIds, stepper, toggle, pill, recordBlock, card } from '../ui.js';
import { PACKS } from './words.js';

const GAME = '🕵️ Imposter';
const def = () => ({ phase: 'setup', desel: [], packs: ['orte', 'filme', 'tiere', 'essen'], imps: 1, minutes: 5, hint: true, undercover: false });
const st = () => (S.games.imposter ||= def());

function commit() { save(); push(); app.rerender(); }

function allPacks() { return [...PACKS, ...S.customPacks]; }

function maxImps(n) { return Math.max(1, Math.floor((n - 1) / 2)); }

function start() {
  const s = st();
  const ids = selectedIds(s);
  const packs = allPacks().filter(p => s.packs.includes(p.id) && p.words.length);
  if (!packs.length) return toast('Bitte mindestens eine Kategorie wählen');
  let pool = packs.flatMap(p => p.words.map(w => ({ w, pack: p })));
  const fresh = pool.filter(x => !S.usedWords.includes(x.w));
  if (fresh.length) pool = fresh; else S.usedWords = [];
  const choice = pick(pool);
  S.usedWords.push(choice.w);
  const alt = pick(choice.pack.words.filter(w => w !== choice.w)) || choice.w;
  const k = Math.min(s.imps, maxImps(ids.length));
  s.round = {
    id: Date.now(), ids, word: choice.w, cat: choice.pack.name, alt,
    imps: shuffle(ids).slice(0, k), seen: {}, starter: pick(ids),
    endAt: null, pausedLeft: null, accused: [], winner: null,
  };
  s.phase = 'reveal';
  s.recorded = false;
  commit();
}

function abort() {
  const s = st();
  s.phase = 'setup';
  room.release('imposter');
  save();
  app.rerender();
}

// ---------- Spieler-Ansichten ----------
function cardFor(s, id) {
  const r = s.round;
  const imp = r.imps.includes(id);
  if (imp && !s.undercover) {
    const lines = [];
    if (s.hint) lines.push('Kategorie: ' + r.cat);
    lines.push('Du kennst das Wort nicht. Hör gut zu und bluffe dich durch!');
    if (r.imps.length > 1) lines.push(`Es gibt ${r.imps.length} Imposter.`);
    return { emoji: '🕵️', name: 'IMPOSTER', text: lines.join('\n'), color: '#7f1d1d' };
  }
  return { emoji: '🔑', name: imp ? r.alt : r.word, text: `Kategorie: ${r.cat}\nBeschreibe das Wort, ohne es zu verraten.`, color: '#1e3a8a' };
}

function timerObj(r) {
  if (r.pausedLeft != null) return { remainingMs: r.pausedLeft, paused: true };
  return { remainingMs: Math.max(0, r.endAt - Date.now()) };
}

function viewFor(s, id) {
  const r = s.round;
  const base = { game: GAME, card: cardFor(s, id) };
  switch (s.phase) {
    case 'reveal':
      if (!r.seen[id]) return { ...base, cardMode: 'reveal', key: `imp-${r.id}-${id}`, title: 'Deine Karte', needsInput: true };
      return { ...base, emoji: '⏳', title: 'Warte auf die anderen …', text: 'Gleich geht es los.' };
    case 'play':
      return { ...base, emoji: '🗣️', title: `${pname(r.starter)} beginnt`, text: 'Reihum sagt jede Person ein Wort zum Begriff. Dann diskutiert ihr: Wer ist der Imposter?', timer: timerObj(r) };
    case 'vote':
    case 'guess':
      return { ...base, emoji: '🗳️', title: 'Abstimmung', text: 'Zeigt auf drei gleichzeitig auf eure Verdächtigen!' };
    case 'result': {
      const imp = r.imps.includes(id);
      const won = (r.winner === 'imp') === imp;
      return { game: GAME, tone: won ? 'good' : 'danger', emoji: won ? '🏆' : '😵', title: r.winner === 'imp' ? 'Der Imposter gewinnt!' : 'Die Crew gewinnt!', text: `Imposter: ${r.imps.map(pname).join(', ')}\nDas Wort war: ${r.word}${s.undercover ? `\n(Undercover-Wort: ${r.alt})` : ''}` };
    }
  }
  return base;
}

export function push() {
  const s = st();
  if (s.phase === 'setup' || !s.round) return;
  const views = {};
  for (const id of s.round.ids) views[id] = viewFor(s, id);
  room.publish('imposter', views);
}

function onAction(eid, d) {
  const s = st();
  if (s.phase === 'reveal' && d.a === 'seen' && s.round.ids.includes(eid)) {
    s.round.seen[eid] = true;
    commit();
  }
}

function startPlay(s) {
  s.phase = 'play';
  s.round.endAt = Date.now() + s.minutes * 60000;
  s.round.pausedLeft = null;
}

function tick() {
  const s = S.games.imposter;
  if (!s || s.phase !== 'play' || !s.round.endAt || s.round.pausedLeft != null) return;
  if (Date.now() >= s.round.endAt) {
    s.phase = 'vote';
    beep();
    commit();
  }
}
setInterval(tick, 500);

room.register('imposter', { action: onAction, push });

// ---------- Host-Oberfläche ----------
export function render() {
  const s = st();
  const el = h('div', {}, topbar('🕵️ Imposter', { rules: 'imposter', invite: true }));
  const r = s.round;
  const parts = {
    setup: renderSetup, reveal: renderReveal, play: renderPlay, vote: renderVote, guess: renderGuess, result: renderResult,
  }[s.phase]?.(s) || [];
  el.append(...parts.filter(Boolean));
  if (s.phase !== 'setup' && s.phase !== 'result' && r) {
    el.append(h('div', { class: 'center', style: { marginTop: '24px' } },
      h('button', { class: 'btn ghost small', onclick: async () => { if (await confirmDialog('Runde abbrechen?', 'Abbrechen', true)) abort(); } }, 'Runde abbrechen')));
  }
  return el;
}

function packEditor(existing) {
  modal(existing ? 'Kategorie bearbeiten' : 'Eigene Kategorie', close => {
    const name = h('input', { value: existing?.name || '', placeholder: 'z. B. Unsere Insider', maxlength: 40 });
    const words = h('textarea', { placeholder: 'Ein Begriff pro Zeile oder durch Kommas getrennt' });
    words.value = existing ? existing.words.join('\n') : '';
    return h('div', {},
      h('label', { class: 'field' }, h('span', {}, 'Name'), name),
      h('label', { class: 'field' }, h('span', {}, 'Begriffe (mindestens 2)'), words),
      h('div', { class: 'btn-row' },
        existing ? h('button', {
          class: 'btn danger', onclick: () => {
            S.customPacks = S.customPacks.filter(p => p.id !== existing.id);
            st().packs = st().packs.filter(x => x !== existing.id);
            save(); close(); app.rerender();
          },
        }, 'Löschen') : null,
        h('button', {
          class: 'btn primary', onclick: () => {
            const list = words.value.split(/[\n,]/).map(w => w.trim()).filter(Boolean);
            if (!name.value.trim() || list.length < 2) return toast('Name und mindestens 2 Begriffe angeben');
            if (existing) Object.assign(existing, { name: name.value.trim(), words: list });
            else {
              const p = { id: 'c-' + newId(), emoji: '✏️', name: name.value.trim(), words: list, custom: true };
              S.customPacks.push(p);
              st().packs.push(p.id);
            }
            save(); close(); app.rerender();
          },
        }, 'Speichern')));
  });
}

function renderSetup(s) {
  const n = selectedIds(s).length;
  const ok = n >= 3 && s.packs.length > 0;
  return [
    playerPicker(s, { min: 3, showStatus: true }),
    card('Kategorien',
      h('div', { class: 'pack-grid' }, allPacks().map(p => {
        const on = s.packs.includes(p.id);
        return h('button', {
          class: 'pack' + (on ? ' on' : ''),
          onclick: () => { s.packs = on ? s.packs.filter(x => x !== p.id) : [...s.packs, p.id]; save(); app.rerender(); },
        }, `${p.emoji} ${p.name}`, h('small', {}, `${p.words.length} Begriffe`),
        p.custom ? h('small', { onclick: e => { e.stopPropagation(); packEditor(p); }, style: { textDecoration: 'underline' } }, 'bearbeiten') : null);
      })),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn small', onclick: () => { s.packs = allPacks().map(p => p.id); save(); app.rerender(); } }, 'Alle'),
        h('button', { class: 'btn small', onclick: () => { s.packs = []; save(); app.rerender(); } }, 'Keine'),
        h('button', { class: 'btn small primary', onclick: () => packEditor(null) }, '＋ Eigene'))),
    card('Einstellungen',
      h('div', { class: 'row between' }, h('span', {}, 'Anzahl Imposter'), stepper(Math.min(s.imps, maxImps(n)), v => { s.imps = v; save(); app.rerender(); }, { min: 1, max: maxImps(n) })),
      h('div', { class: 'row between' }, h('span', {}, 'Zeit pro Runde'), stepper(s.minutes, v => { s.minutes = v; save(); app.rerender(); }, { min: 1, max: 20, fmt: v => v + ' min' })),
      toggle('Imposter sieht die Kategorie', s.hint, v => { s.hint = v; save(); }, 'Erleichtert das Bluffen.'),
      toggle('Undercover-Modus', s.undercover, v => { s.undercover = v; save(); }, 'Der Imposter bekommt ein ähnliches Wort und weiß nicht, dass er Imposter ist.')),
    h('button', { class: 'btn primary big block', disabled: !ok, onclick: start }, '🂠 Karten verteilen'),
  ];
}

function renderReveal(s) {
  const r = s.round;
  const all = r.ids.every(id => r.seen[id]);
  return [
    h('div', { class: 'card center' }, h('h2', {}, '🂠 Karten ansehen'), h('p', { class: 'muted' }, 'Jeder schaut sich geheim seine Karte an.')),
    room.passPanel(r.ids),
    card(`Status (${r.ids.filter(id => r.seen[id]).length}/${r.ids.length})`,
      h('ul', { class: 'status-list' }, r.ids.map(id => h('li', {}, pill(id), h('span', { class: 's' }, r.seen[id] ? '✓ gesehen' : room.isLocal(id) ? '🤚 auf diesem Gerät' : '📱 schaut gerade'))))),
    all ? h('button', { class: 'btn primary big block', onclick: () => { startPlay(s); commit(); } }, '▶ Los geht’s') : h('p', { class: 'center muted' }, 'Warte, bis alle ihre Karte gesehen haben …'),
  ];
}

function renderPlay(s) {
  const r = s.round;
  const paused = r.pausedLeft != null;
  return [
    h('div', { class: 'narration tone-day' },
      h('div', { class: 'big-emoji' }, '🗣️'),
      h('h2', {}, `${pname(r.starter)} beginnt`),
      h('p', {}, 'Reihum im Uhrzeigersinn: ein Wort zum Begriff. Danach diskutieren!'),
      timerSpan(r.endAt, paused ? r.pausedLeft : null)),
    h('div', { class: 'btn-row' },
      h('button', {
        class: 'btn', onclick: () => {
          if (paused) { r.endAt = Date.now() + r.pausedLeft; r.pausedLeft = null; }
          else { r.pausedLeft = r.endAt - Date.now(); }
          commit();
        },
      }, paused ? '▶ Weiter' : '⏸ Pause'),
      h('button', { class: 'btn', onclick: () => { if (paused) r.pausedLeft += 60000; else r.endAt += 60000; commit(); } }, '+1 min'),
      h('button', { class: 'btn primary', onclick: () => { s.phase = 'vote'; commit(); } }, '🗳️ Abstimmen')),
    card('Reihenfolge', h('p', {}, rotate(r.ids, r.starter).map(pname).join(' → '))),
  ];
}

function rotate(ids, first) {
  const i = ids.indexOf(first);
  return [...ids.slice(i), ...ids.slice(0, i)];
}

function renderVote(s) {
  const r = s.round;
  const need = r.imps.length;
  return [
    h('div', { class: 'narration tone-day' }, h('div', { class: 'big-emoji' }, '🗳️'), h('h2', {}, 'Wen verdächtigt ihr?'),
      h('p', {}, need > 1 ? `Wählt ${need} Personen aus.` : 'Zeigt auf drei gleichzeitig auf euren Verdacht – dann hier auswählen.')),
    card(null, h('div', { class: 'chips' }, r.ids.map(id => {
      const on = r.accused.includes(id);
      return h('button', {
        class: 'chip' + (on ? ' on' : ''),
        onclick: () => {
          if (on) r.accused = r.accused.filter(x => x !== id);
          else { r.accused = [...r.accused, id]; if (r.accused.length > need) r.accused.shift(); }
          save(); app.rerender();
        },
      }, pname(id));
    }))),
    h('button', {
      class: 'btn primary big block', disabled: r.accused.length !== need,
      onclick: () => {
        const caught = r.accused.every(id => r.imps.includes(id));
        if (caught && !s.undercover) s.phase = 'guess';
        else { r.winner = caught ? 'crew' : 'imp'; s.phase = 'result'; }
        commit();
      },
    }, 'Auflösen'),
  ];
}

function renderGuess(s) {
  const r = s.round;
  const finish = w => { r.winner = w; s.phase = 'result'; commit(); };
  return [
    h('div', { class: 'narration tone-good' }, h('div', { class: 'big-emoji' }, '🎯'),
      h('h2', {}, 'Erwischt!'),
      h('p', {}, `${r.imps.map(pname).join(' & ')} ${r.imps.length > 1 ? 'waren die Imposter' : 'war der Imposter'}.`),
      h('p', { class: 'say' }, 'Letzte Chance: Wie lautet das Wort?')),
    h('details', { class: 'card' }, h('summary', {}, 'Wort anzeigen (für die Crew)'), h('p', { class: 'say center' }, r.word)),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn danger big', onclick: () => finish('imp') }, '✓ Richtig geraten'),
      h('button', { class: 'btn good big', onclick: () => finish('crew') }, '✗ Falsch')),
  ];
}

function renderResult(s) {
  const r = s.round;
  const impWin = r.winner === 'imp';
  return [
    h('div', { class: 'banner' }, h('div', { class: 'big-emoji' }, impWin ? '🕵️' : '🎉'),
      h('h2', {}, impWin ? 'Der Imposter gewinnt!' : 'Die Crew gewinnt!'),
      h('p', {}, 'Das Wort war: ', h('b', {}, r.word)),
      s.undercover ? h('p', { class: 'small' }, 'Undercover-Wort: ' + r.alt) : null,
      h('p', {}, 'Imposter: ', r.imps.map(id => pill(id)))),
    recordBlock(s, 'Imposter', () => r.ids.map(id => ({ id, won: r.imps.includes(id) === impWin }))),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary big', onclick: start }, '🔁 Nächste Runde'),
      h('button', { class: 'btn big', onclick: abort }, '⚙️ Einstellungen')),
  ];
}

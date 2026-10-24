// Host-App: Startseite (Spieleabend), Routing, Ranking, Verlauf, Einstellungen.
import { S, save, addPlayer, removePlayer, movePlayer, player, pname, leaderboard, record, EMOJI } from './store.js';
import { h, app, toast, modal, confirmDialog, speak } from './util.js';
import * as room from './room.js';
import { topbar, pill, card, selectedIds, playerPicker, rulesModal } from './ui.js';
import { RULES } from './rules.js';
import * as werwolf from './games/werwolf.js';
import * as imposter from './games/imposter.js';
import * as cabo from './games/cabo.js';
import * as wizard from './games/wizard.js';
import * as munchkin from './games/munchkin.js';
import * as kniffel from './games/kniffel.js';

const GAMES = [
  { id: 'werwolf', mod: werwolf, emoji: '🐺', name: 'Werwolf', desc: 'App als Spielleitung oder Assistent', live: s => s && s.phase !== 'setup' },
  { id: 'imposter', mod: imposter, emoji: '🕵️', name: 'Imposter', desc: 'Wer kennt das Wort nicht?', live: s => s && s.phase !== 'setup' },
  { id: 'cabo', mod: cabo, emoji: '🃏', name: 'Cabo', desc: 'Punktezähler & Regeln', live: s => s && s.players },
  { id: 'wizard', mod: wizard, emoji: '🧙', name: 'Wizard', desc: 'Ansagen, Stiche, Punkte', live: s => s && s.players },
  { id: 'munchkin', mod: munchkin, emoji: '⚔️', name: 'Munchkin', desc: 'Stufen, Kampf & Würfel', live: s => s && s.players },
  { id: 'kniffel', mod: kniffel, emoji: '🎲', name: 'Kniffel', desc: 'Block – mit oder ohne Würfel', live: s => s && s.players },
];

const ROUTES = {
  home: renderHome,
  verlauf: renderHistory,
  einstellungen: renderSettings,
  frei: renderFree,
  regeln: renderRules,
};
for (const g of GAMES) ROUTES[g.id] = g.mod.render;

let lastRoute = null;
function render() {
  const route = location.hash.replace(/^#\/?/, '').split('/')[0] || 'home';
  const root = document.getElementById('app');
  const y = window.scrollY;
  root.innerHTML = '';
  root.append((ROUTES[route] || renderHome)());
  if (route === lastRoute) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
  lastRoute = route;
}
app.rerender = render;
window.addEventListener('hashchange', render);

// ---------- Startseite ----------
function renderHome() {
  const online = room.onlineCount();
  const el = h('div', {},
    h('div', { class: 'hero' },
      h('div', { class: 'row end' }, h('a', { class: 'icon-btn', href: '#/einstellungen', 'aria-label': 'Einstellungen' }, '⚙️')),
      h('h1', {}, '🎲 Spieleabend'),
      h('p', { class: 'muted' }, 'Einmal Spieler eintragen – für alle Spiele des Abends.')));

  // Spieler
  const inp = h('input', { placeholder: 'Name eingeben', maxlength: 24, enterkeyhint: 'done' });
  const add = () => {
    if (addPlayer(inp.value)) { room.lobbyChanged(); render(); document.querySelector('#add-player')?.focus(); }
  };
  inp.id = 'add-player';
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  el.append(card(`👥 Mitspielende (${S.players.length})`,
    S.players.length
      ? h('div', { class: 'chips' }, S.players.map(p => h('button', { class: 'chip on', style: { '--c': p.color }, onclick: () => editPlayer(p.id) },
        p.emoji + ' ' + p.name,
        room.status(p.id) === 'online' ? h('span', { class: 'dot on' }) : null)))
      : h('p', { class: 'muted' }, 'Noch niemand dabei. Trag die Namen ein oder verbinde Handys.'),
    h('div', { class: 'row' }, inp, h('button', { class: 'btn primary', onclick: add }, '＋')),
    h('button', { class: 'btn block', style: { marginTop: '10px' }, onclick: room.inviteModal },
      '📱 Handys per QR-Code verbinden', online ? h('span', { class: 'pill', style: { '--c': '#22c55e' } }, `${online} verbunden`) : null)));

  // Spiele
  el.append(h('div', { class: 'grid-games' },
    GAMES.map(g => h('a', { class: 'tile', href: '#/' + g.id },
      g.live(S.games[g.id]) ? h('span', { class: 't-badge' }, 'läuft') : null,
      h('span', { class: 't-emoji' }, g.emoji),
      h('span', { class: 't-name' }, g.name),
      h('span', { class: 't-desc' }, g.desc))),
    h('a', { class: 'tile', href: '#/frei' },
      h('span', { class: 't-emoji' }, '📝'),
      h('span', { class: 't-name' }, 'Anderes Spiel'),
      h('span', { class: 't-desc' }, 'Ergebnis eines beliebigen Spiels eintragen'))));

  // Ranking
  const lb = leaderboard().filter(x => x.games > 0 || !x.gone);
  const anyGames = S.history.length > 0;
  el.append(card('🏆 Abend-Ranking',
    anyGames
      ? h('div', { class: 'table-wrap' }, h('table', { class: 'score' },
        h('tr', {}, h('th', {}, '#'), h('th', { class: 'l' }, 'Spieler'), h('th', {}, 'Punkte'), h('th', {}, 'Siege'), h('th', {}, 'Spiele')),
        lb.map((x, i) => {
          const place = lb.findIndex(y => y.points === x.points) + 1;
          return h('tr', {},
          h('td', { class: place === 1 ? 'rank-1' : '' }, place === 1 && x.points > 0 ? '👑' : place),
          h('td', { class: 'l' }, player(x.id) ? pill(x.id) : x.name),
          h('td', {}, h('b', {}, x.points)), h('td', {}, x.wins), h('td', {}, x.games));
        })))
      : h('p', { class: 'muted' }, 'Noch keine Ergebnisse. Nach jedem Spiel kannst du das Ergebnis mit einem Tipp eintragen.'),
    h('p', { class: 'small muted' }, `Punkte: Platz 1/2/3 = ${S.settings.place.join('/')} · Teamsieg = ${S.settings.teamWin} (änderbar in den Einstellungen)`),
    h('div', { class: 'btn-row' },
      h('a', { class: 'btn', href: '#/verlauf' }, `📜 Verlauf (${S.history.length})`),
      h('a', { class: 'btn', href: '#/regeln' }, '📖 Anleitungen'))));
  return el;
}

function editPlayer(id) {
  const p = player(id);
  if (!p) return;
  modal('Spieler bearbeiten', close => {
    const name = h('input', { value: p.name, maxlength: 24 });
    return h('div', {},
      h('label', { class: 'field' }, h('span', {}, 'Name'), name),
      h('label', { class: 'field' }, h('span', {}, 'Symbol')),
      h('div', { class: 'chips' }, EMOJI.map(e => h('button', { class: 'chip' + (p.emoji === e ? ' on' : ''), onclick: ev => { p.emoji = e; save(); ev.target.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === ev.target)); } }, e))),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => { movePlayer(id, -1); render(); } }, '▲ nach vorne'),
        h('button', { class: 'btn', onclick: () => { movePlayer(id, 1); render(); } }, '▼ nach hinten')),
      h('p', { class: 'small muted' }, 'Die Reihenfolge gilt als Sitzreihenfolge (z. B. für Wizard).'),
      h('div', { class: 'btn-row' },
        h('button', {
          class: 'btn danger', onclick: async () => {
            if (!(await confirmDialog(`${p.name} entfernen? Bisherige Ergebnisse bleiben im Verlauf.`, 'Entfernen', true))) return;
            const pid = room.pidOf(id);
            if (pid) room.kick(pid);
            removePlayer(id); room.lobbyChanged(); close(); render();
          },
        }, 'Entfernen'),
        h('button', {
          class: 'btn primary', onclick: () => {
            const n = name.value.trim();
            if (n && !S.players.some(x => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) p.name = n;
            else if (n !== p.name) toast('Name leer oder schon vergeben');
            save(); room.lobbyChanged(); close(); render();
          },
        }, 'Speichern')));
  });
}

// ---------- Verlauf ----------
function renderHistory() {
  const el = h('div', {}, topbar('📜 Verlauf'));
  if (!S.history.length) el.append(card(null, h('p', { class: 'muted' }, 'Noch keine Spiele eingetragen.')));
  for (const e of S.history) {
    const sorted = [...e.results].sort((a, b) => b.points - a.points);
    el.append(card(null,
      h('div', { class: 'row between' },
        h('h3', { style: { margin: 0 } }, e.game),
        h('span', { class: 'small muted' }, new Date(e.ts).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }))),
      h('ul', { class: 'status-list' }, sorted.map(r => h('li', {},
        player(r.id) ? pill(r.id) : h('span', {}, r.name),
        h('span', { class: 'small muted' }, r.place ? `${r.place}. Platz` : r.won ? 'gewonnen' : 'verloren'),
        h('span', { class: 's' }, h('b', {}, `+${r.points}`))))),
      h('button', {
        class: 'btn ghost small', onclick: async () => {
          if (await confirmDialog('Diesen Eintrag löschen?', 'Löschen', true)) { S.history = S.history.filter(x => x.id !== e.id); save(); render(); }
        },
      }, 'Löschen')));
  }
  return el;
}

// ---------- Freies Spiel ----------
function renderFree() {
  const s = (S.games.frei ||= { desel: [], name: '', places: {} });
  const ids = selectedIds(s);
  const el = h('div', {}, topbar('📝 Anderes Spiel'));
  const name = h('input', { value: s.name, placeholder: 'z. B. Siedler, Uno, Mario Kart …', maxlength: 40, oninput: e => { s.name = e.target.value; save(); } });
  el.append(
    card('Spiel', name),
    playerPicker(s, { min: 1 }),
    card('Platzierung',
      h('p', { class: 'small muted' }, 'Gleiche Platzierung = geteilter Platz. Bei Teamspielen einfach alle Gewinner auf Platz 1.'),
      ...ids.map(id => h('div', { class: 'player-row' },
        h('span', { class: 'grow' }, pill(id)),
        h('select', { style: { width: '130px' }, onchange: e => { s.places[id] = +e.target.value || 0; save(); } },
          h('option', { value: '0' }, '–'),
          ids.map((_, i) => h('option', { value: i + 1, selected: s.places[id] === i + 1 }, `${i + 1}. Platz`)))))),
    h('button', {
      class: 'btn good big block', onclick: () => {
        const results = ids.filter(id => s.places[id] > 0).map(id => ({ id, place: s.places[id] }));
        if (!s.name.trim()) return toast('Bitte den Spielnamen eintragen');
        if (!results.length) return toast('Bitte mindestens eine Platzierung wählen');
        record(s.name.trim(), results);
        s.places = {};
        save();
        toast('Eingetragen 🏆');
        location.hash = '#/';
      },
    }, '🏆 Ins Abend-Ranking eintragen'));
  return el;
}

// ---------- Anleitungen ----------
function renderRules() {
  return h('div', {}, topbar('📖 Anleitungen'),
    ...Object.entries(RULES).map(([k, r]) => h('button', { class: 'mode-opt', onclick: () => rulesModal(k) }, h('b', {}, r.title.replace(' – Anleitung', '')), h('span', {}, 'Regeln anzeigen'))));
}

// ---------- Einstellungen ----------
function renderSettings() {
  const st = S.settings;
  const placeInput = h('input', {
    value: st.place.join(', '),
    onchange: e => {
      const arr = e.target.value.split(/[,; ]+/).map(x => parseInt(x, 10)).filter(x => !isNaN(x));
      if (arr.length) { st.place = arr; save(); toast('Gespeichert'); }
    },
  });
  return h('div', {}, topbar('⚙️ Einstellungen'),
    card('Punkte fürs Abend-Ranking',
      h('label', { class: 'field' }, h('span', {}, 'Punkte für Platz 1, 2, 3, … (kommagetrennt)'), placeInput),
      h('label', { class: 'field' }, h('span', {}, 'Punkte pro Person bei Teamsieg (Werwolf, Imposter)'),
        h('input', { type: 'number', value: st.teamWin, min: 0, onchange: e => { st.teamWin = Math.max(0, parseInt(e.target.value, 10) || 0); save(); toast('Gespeichert'); } })),
      h('p', { class: 'small muted' }, 'Gilt für neue Einträge. Bereits eingetragene Ergebnisse behalten ihre Punkte.')),
    card('Ton',
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: st.tts, onchange: e => { st.tts = e.target.checked; save(); } }), h('span', { class: 'toggle-ui' }), h('span', {}, 'Sprachausgabe (Werwolf-Erzähler)')),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: st.sound, onchange: e => { st.sound = e.target.checked; save(); } }), h('span', { class: 'toggle-ui' }), h('span', {}, 'Signalton & Vibration bei Timer-Ende')),
      h('button', { class: 'btn small', onclick: () => speak('Es wird Nacht im Dorf. Alle schließen die Augen.', true) }, '🔊 Stimme testen')),
    card('Handy-Verbindung',
      S.room ? h('p', {}, 'Raum-Code: ', h('b', {}, S.room.code), ` · ${room.onlineCount()} verbunden`) : h('p', { class: 'muted' }, 'Kein Raum geöffnet.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: room.inviteModal }, '📱 QR-Code zeigen'),
        S.room ? h('button', { class: 'btn ghost', onclick: async () => { if (await confirmDialog('Raum schließen? Alle Handys werden getrennt.', 'Schließen', true)) { room.closeRoom(); } } }, 'Raum schließen') : null)),
    card('Neuer Abend',
      h('p', { class: 'small muted' }, 'Setzt Ranking und Verlauf zurück. Die Spielerliste bleibt erhalten.'),
      h('button', {
        class: 'btn danger', onclick: async () => {
          if (!(await confirmDialog('Ranking und Verlauf löschen und neuen Abend starten?', 'Neuer Abend', true))) return;
          S.history = [];
          S.usedWords = [];
          save(); toast('Neuer Abend gestartet 🎉'); location.hash = '#/';
        },
      }, '🌅 Neuen Abend starten'),
      h('hr'),
      h('button', {
        class: 'btn ghost small', onclick: async () => {
          if (!(await confirmDialog('Wirklich ALLES löschen (Spieler, Ranking, laufende Spiele, eigene Kategorien)?', 'Alles löschen', true))) return;
          room.closeRoom();
          localStorage.removeItem('spieleabend.v1');
          location.hash = '';
          location.reload();
        },
      }, 'Alle Daten löschen')),
    h('p', { class: 'small muted center' }, 'Alle Daten bleiben auf diesem Gerät gespeichert.'));
}

// ---------- Start ----------
if (S.room?.code) room.openRoom();
const active = GAMES.find(g => g.id === S.activeGame);
active?.mod.push?.();
render();

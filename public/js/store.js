// Gespeicherter Zustand des Spieleabends (nur auf dem Host-Gerät, im localStorage).

const KEY = 'spieleabend.v1';
const EMOJI = ['🦊', '🐼', '🐸', '🦁', '🐯', '🐨', '🐙', '🦄', '🐝', '🐧', '🦉', '🐢', '🐳', '🦖', '🐱', '🐶', '🐰', '🦋', '🐞', '🐲', '🦔', '🐹', '🦩', '🐮'];
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#84cc16', '#06b6d4', '#f43f5e', '#a855f7'];
export { EMOJI };

function defaults() {
  return {
    players: [],
    history: [],
    settings: { place: [3, 2, 1], teamWin: 2, tts: true, sound: true },
    games: {},
    room: null,
    customPacks: [],
    usedWords: [],
    activeGame: null,
  };
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d) {
      const def = defaults();
      return { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) } };
    }
  } catch (e) { /* kaputte Daten ignorieren */ }
  return defaults();
}

export const S = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('Speichern fehlgeschlagen', e); }
}

export const newId = () => Math.random().toString(36).slice(2, 10);
export const player = id => S.players.find(p => p.id === id);
export const pname = id => player(id)?.name ?? 'Unbekannt';

export function addPlayer(name) {
  name = String(name || '').trim().slice(0, 24);
  if (!name) return null;
  const existing = S.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const used = new Set(S.players.map(p => p.emoji));
  const p = {
    id: newId(),
    name,
    emoji: EMOJI.find(e => !used.has(e)) || EMOJI[S.players.length % EMOJI.length],
    color: COLORS[S.players.length % COLORS.length],
  };
  S.players.push(p);
  save();
  return p;
}

export function removePlayer(id) {
  S.players = S.players.filter(p => p.id !== id);
  save();
}

export function movePlayer(id, dir) {
  const i = S.players.findIndex(p => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= S.players.length) return;
  [S.players[i], S.players[j]] = [S.players[j], S.players[i]];
  save();
}

// results: [{ id, place }] oder [{ id, won: true|false }]
export function pointsFor(r) {
  if (r.won !== undefined) return r.won ? S.settings.teamWin : 0;
  return S.settings.place[r.place - 1] || 0;
}

export function record(game, results) {
  const entry = {
    id: newId(),
    game,
    ts: Date.now(),
    results: results.map(r => ({ ...r, name: pname(r.id), points: pointsFor(r) })),
  };
  S.history.unshift(entry);
  save();
  return entry;
}

export function leaderboard() {
  const m = {};
  for (const p of S.players) m[p.id] = { id: p.id, name: p.name, points: 0, wins: 0, games: 0 };
  for (const e of S.history) {
    for (const r of e.results) {
      const x = (m[r.id] ||= { id: r.id, name: r.name, points: 0, wins: 0, games: 0, gone: true });
      x.points += r.points;
      x.games++;
      if (r.won || r.place === 1) x.wins++;
    }
  }
  return Object.values(m).sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}

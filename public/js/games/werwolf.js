// Werwolf – zwei Modi:
//  auto:   Die App leitet (Sprachausgabe, Aktionen auf den Handys / heimlich am Gerät).
//  leader: Ein Mensch leitet, die App verteilt Karten und hilft mit Skript & Übersicht.
import { S, save, pname } from '../store.js';
import { h, app, speak, stopSpeaking, beep, shuffle, pick, timerSpan, confirmDialog, modal } from '../util.js';
import * as room from '../room.js';
import { topbar, playerPicker, selectedIds, stepper, toggle, pill, recordBlock, card } from '../ui.js';

export const ROLES = {
  werwolf: { name: 'Werwolf', emoji: '🐺', team: 'wolf', color: '#7f1d1d', text: 'Jede Nacht wählst du mit den anderen Werwölfen ein Opfer. Tagsüber tarnst du dich als harmloser Dorfbewohner.' },
  seherin: { name: 'Seherin', emoji: '🔮', team: 'dorf', color: '#4c1d95', text: 'Jede Nacht darfst du die wahre Rolle einer Person erfahren.' },
  hexe: { name: 'Hexe', emoji: '🧪', team: 'dorf', color: '#14532d', text: 'Du hast einen Heiltrank und einen Gifttrank – je einmal pro Spiel. Nachts erfährst du das Opfer der Werwölfe.' },
  jaeger: { name: 'Jäger', emoji: '🏹', team: 'dorf', color: '#713f12', text: 'Wenn du stirbst, reißt du mit deinem letzten Schuss eine Person mit in den Tod.' },
  amor: { name: 'Amor', emoji: '💘', team: 'dorf', color: '#9d174d', text: 'In der ersten Nacht verliebst du zwei Personen. Stirbt eine, stirbt auch die andere.' },
  beschuetzer: { name: 'Beschützer', emoji: '🛡️', team: 'dorf', color: '#1e3a8a', text: 'Jede Nacht beschützt du eine Person vor den Werwölfen – nie zweimal hintereinander dieselbe.' },
  maedchen: { name: 'Mädchen', emoji: '👧', team: 'dorf', color: '#831843', text: 'Du darfst blinzeln, wenn die Werwölfe erwachen. Lass dich nicht erwischen!' },
  dorf: { name: 'Dorfbewohner', emoji: '🧑‍🌾', team: 'dorf', color: '#334155', text: 'Du hast keine besondere Fähigkeit. Finde mit dem Dorf die Werwölfe!' },
};
const ORDER = ['werwolf', 'seherin', 'hexe', 'jaeger', 'amor', 'beschuetzer', 'maedchen'];

const STEPS = {
  intro: { label: 'Einschlafen', say: 'Es wird Nacht im Dorf. Alle schließen die Augen.' },
  amor: { label: 'Amor', say: 'Amor erwacht und wählt zwei Menschen, die sich unsterblich ineinander verlieben.', sleep: 'Amor schläft wieder ein.' },
  lovers: { label: 'Verliebte', say: 'Die Verliebten erwachen und erkennen einander.', sleep: 'Die Verliebten schlafen wieder ein.' },
  beschuetzer: { label: 'Beschützer', say: 'Der Beschützer erwacht und wählt, wen er heute Nacht beschützt.', sleep: 'Der Beschützer schläft wieder ein.' },
  werwolf: { label: 'Werwölfe', say: 'Die Werwölfe erwachen und einigen sich auf ein Opfer.', sleep: 'Die Werwölfe schlafen wieder ein.' },
  seherin: { label: 'Seherin', say: 'Die Seherin erwacht und blickt in die Seele eines Mitspielers.', sleep: 'Die Seherin schläft wieder ein.' },
  hexe: { label: 'Hexe', say: 'Die Hexe erwacht. Sie erfährt das Opfer der Nacht und darf ihre Tränke einsetzen.', sleep: 'Die Hexe schläft wieder ein.' },
};

const GAME = '🐺 Werwolf';
const def = () => ({ phase: 'setup', mode: 'auto', desel: [], counts: null, opts: { day: 3, reveal: true, tieNoLynch: true } });
const st = () => (S.games.werwolf ||= def());
const P = (s, id) => s.players.find(p => p.id === id);
const aliveOf = s => s.players.filter(p => p.alive);
const isWolf = p => ROLES[p.role].team === 'wolf';
const roleName = (s, id) => ROLES[P(s, id).role].name;

function commit() { save(); push(); app.rerender(); }

// ---------- Rollenverteilung ----------
function recommend(n) {
  return {
    werwolf: Math.max(1, Math.round(n / 4.5)),
    seherin: n >= 5 ? 1 : 0,
    hexe: n >= 6 ? 1 : 0,
    jaeger: n >= 7 ? 1 : 0,
    amor: n >= 8 ? 1 : 0,
    beschuetzer: n >= 10 ? 1 : 0,
    maedchen: n >= 11 ? 1 : 0,
  };
}
function fullCounts(s, n) {
  const c = { ...recommend(n), ...(s.counts || {}) };
  c.dorf = n - ORDER.reduce((a, r) => a + (c[r] || 0), 0);
  return c;
}

function start() {
  const s = st();
  const ids = selectedIds(s);
  const c = fullCounts(s, ids.length);
  let roles = [];
  for (const r of [...ORDER, 'dorf']) for (let i = 0; i < c[r]; i++) roles.push(r);
  roles = shuffle(roles);
  Object.assign(s, {
    phase: 'reveal', startedAt: Date.now(),
    players: ids.map((id, i) => ({ id, role: roles[i], alive: true })),
    seen: {}, night: 0, lovers: [], loversKnown: false,
    potions: { heal: true, poison: true }, protectedLast: null,
    hunterQueue: [], hunterSeq: 0, winner: null, recorded: false,
    step: null, steps: [], stepIdx: -1, stepAt: null, act: {}, pending: {}, wolfVotes: {}, witch: { stage: 'main' },
    announce: null, votes: {}, dayEnd: null, dayEndHandled: true,
    leader: { phase: 'night', done: {} },
  });
  commit();
}

function abort() {
  const s = st();
  s.phase = 'setup';
  stopSpeaking();
  room.release('werwolf');
  save();
  app.rerender();
}

// ---------- Ansichten für die Spieler ----------
function cardFor(s, p) {
  const r = ROLES[p.role];
  let text = r.text;
  if (p.role === 'werwolf') {
    const mates = s.players.filter(x => x.role === 'werwolf' && x.id !== p.id).map(x => pname(x.id));
    text += mates.length ? '\n\nDein Rudel: ' + mates.join(', ') : '\n\nDu bist der einzige Werwolf.';
  }
  if (s.lovers.includes(p.id) && (s.loversKnown || s.mode === 'leader')) {
    text += '\n\n💘 Verliebt in ' + pname(s.lovers.find(x => x !== p.id));
  }
  return { emoji: r.emoji, name: r.name, text, color: r.color };
}

const optsAlive = (s, exclude = []) => aliveOf(s).filter(p => !exclude.includes(p.id)).map(p => ({ id: p.id, label: pname(p.id) }));
const timerObj = end => ({ remainingMs: Math.max(0, end - Date.now()) });

function viewFor(s, p) {
  const base = { game: GAME, card: cardFor(s, p) };
  if (s.phase === 'reveal') {
    if (!s.seen[p.id]) return { ...base, cardMode: 'reveal', key: `ww-reveal-${s.startedAt}-${p.id}`, title: 'Deine Rolle', needsInput: true, tone: 'night' };
    return { ...base, tone: 'night', emoji: '⏳', title: 'Warte auf die anderen …', text: 'Gleich beginnt die erste Nacht.' };
  }
  if (s.phase === 'end') {
    const won = winnersOf(s).includes(p.id);
    return { ...base, tone: won ? 'good' : 'danger', emoji: won ? '🏆' : '💀', title: winnerText(s.winner), text: won ? 'Du hast gewonnen!' : 'Du hast verloren.' };
  }
  if (s.phase === 'hunter' && s.hunterQueue[0] === p.id) {
    return { ...base, tone: 'danger', emoji: '🏹', title: 'Dein letzter Schuss', text: 'Du bist gestorben – aber wen nimmst du mit in den Tod?', key: 'hunter-' + s.hunterSeq, needsInput: true, vibrate: true, choose: { key: 'hunter-' + s.hunterSeq, options: optsAlive(s), count: 1, submit: 'Schießen 🏹' } };
  }
  if (!p.alive) return { ...base, tone: 'dead', emoji: '💀', title: 'Du bist ausgeschieden', text: 'Verrate nichts und rede nicht mehr mit.' };

  if (s.mode === 'leader') {
    const night = s.leader.phase === 'night';
    return {
      ...base, tone: night ? 'night' : 'day', emoji: night ? '🌙' : '☀️',
      title: night ? `Nacht ${s.night}` : `Tag ${s.night}`,
      text: night ? 'Augen zu! Höre auf die Spielleitung.' : 'Diskutiert: Wer ist ein Werwolf?',
      timer: !night && s.dayEnd ? timerObj(s.dayEnd) : null,
    };
  }

  switch (s.phase) {
    case 'night': return nightView(s, p, base);
    case 'announce': return { ...base, tone: 'day', emoji: '📢', title: s.announce.title, text: [s.announce.intro, ...s.announce.lines].join('\n') };
    case 'hunter':
      return { ...base, tone: 'day', emoji: '🏹', title: 'Der Jäger zielt …', text: `${pname(s.hunterQueue[0])} war der Jäger und nimmt jemanden mit.` };
    case 'day': return { ...base, tone: 'day', emoji: '☀️', title: `Tag ${s.night}`, text: 'Diskutiert: Wer ist ein Werwolf?', timer: timerObj(s.dayEnd) };
    case 'vote': {
      const voted = s.votes[p.id];
      return {
        ...base, tone: 'day', emoji: '🗳️', title: 'Abstimmung', text: voted ? 'Du kannst deine Stimme noch ändern, bis alle abgestimmt haben.' : 'Wer soll aus dem Dorf verbannt werden?',
        key: 'vote-' + s.night, needsInput: !voted, vibrate: true,
        choose: { key: 'vote-' + s.night, options: optsAlive(s, [p.id]), count: 1, chosen: voted ? [voted] : null, submit: voted ? 'Stimme ändern' : 'Abstimmen' },
      };
    }
  }
  return { ...base, tone: 'night', emoji: '🌙', title: 'Werwolf' };
}

function nightView(s, p, base) {
  const sleep = { ...base, tone: 'night', emoji: '🌙', title: `Nacht ${s.night}`, text: 'Das Dorf schläft. Leg das Handy weg und schließe die Augen.' };
  const step = s.step;
  const a = s.act || {};
  const nightKey = `${s.startedAt}-${s.night}`;
  if (step === 'amor' && p.role === 'amor' && !a.done) {
    return { ...base, tone: 'night', emoji: '💘', title: 'Amor, erwache!', text: 'Wähle zwei Personen, die sich verlieben. Du darfst dich selbst wählen.', key: 'amor-' + nightKey, needsInput: true, vibrate: true, choose: { key: 'amor-' + nightKey, options: optsAlive(s), count: 2, submit: 'Verlieben lassen 💘' } };
  }
  if (step === 'lovers' && s.lovers.includes(p.id) && !a.ok?.[p.id]) {
    const other = s.lovers.find(x => x !== p.id);
    return { ...base, tone: 'night', emoji: '💘', title: 'Du bist verliebt!', text: `Dein Herz gehört ${pname(other)}. Stirbt einer von euch, stirbt auch der andere. Seid ihr am Ende die letzten beiden, gewinnt ihr gemeinsam.`, key: 'lovers-' + nightKey, needsInput: true, vibrate: true, buttons: [{ id: 'ok', label: 'Verstanden', style: 'primary' }] };
  }
  if (step === 'beschuetzer' && p.role === 'beschuetzer' && !a.done) {
    const opts = optsAlive(s).map(o => o.id === s.protectedLast ? { ...o, disabled: true, label: o.label, sub: 'letzte Nacht' } : o);
    return { ...base, tone: 'night', emoji: '🛡️', title: 'Beschützer, erwache!', text: 'Wen beschützt du heute Nacht?', key: 'protect-' + nightKey, needsInput: true, vibrate: true, choose: { key: 'protect-' + nightKey, options: opts, count: 1, submit: 'Beschützen 🛡️' } };
  }
  if (step === 'werwolf' && p.role === 'werwolf') {
    const wolves = aliveOf(s).filter(isWolf);
    const mine = s.wolfVotes[p.id];
    return {
      ...base, tone: 'danger', emoji: '🐺', title: 'Werwölfe, erwacht!', text: wolves.length > 1 ? 'Einigt euch auf ein Opfer. Sobald alle gewählt haben, zählt die Mehrheit.' : 'Wähle dein Opfer.',
      list: wolves.length > 1 ? wolves.map(w => ({ label: pname(w.id), sub: s.wolfVotes[w.id] ? '→ ' + pname(s.wolfVotes[w.id]) : '… wählt noch' })) : null,
      key: 'wolf-' + nightKey, needsInput: !mine, vibrate: true,
      choose: { key: 'wolf-' + nightKey, options: optsAlive(s, wolves.map(w => w.id)), count: 1, chosen: mine ? [mine] : null, submit: mine ? 'Wahl ändern' : 'Opfer wählen 🐺' },
    };
  }
  if (step === 'werwolf' && p.role === 'maedchen' && s.girlHint && !room.isLocal(p.id)) {
    return { ...base, tone: 'night', emoji: '👧', title: 'Du blinzelst …', text: `Schemenhaft erkennst du: ${pname(s.girlHint[0])} oder ${pname(s.girlHint[1])} ist ein Werwolf.` };
  }
  if (step === 'seherin' && p.role === 'seherin' && !a.done) {
    if (a.target) {
      const t = P(s, a.target);
      return { ...base, tone: 'night', emoji: ROLES[t.role].emoji, title: pname(t.id), text: `ist ${ROLES[t.role].name}.`, key: 'seer-res-' + nightKey, needsInput: true, buttons: [{ id: 'ok', label: 'Verstanden – schlafen', style: 'primary' }] };
    }
    return { ...base, tone: 'night', emoji: '🔮', title: 'Seherin, erwache!', text: 'Wessen Rolle willst du sehen?', key: 'seer-' + nightKey, needsInput: true, vibrate: true, choose: { key: 'seer-' + nightKey, options: optsAlive(s, [p.id]), count: 1, submit: 'Rolle ansehen 🔮' } };
  }
  if (step === 'hexe' && p.role === 'hexe' && !a.done) return witchView(s, p, base, nightKey);
  return sleep;
}

function witchVictim(s) {
  const w = s.pending.wolf;
  return w && w !== s.pending.protect ? w : null;
}

function witchView(s, p, base, nightKey) {
  const key = 'witch-' + nightKey;
  if (s.witch.stage === 'poison') {
    return { ...base, tone: 'night', emoji: '☠️', title: 'Gifttrank', text: 'Wen willst du vergiften?', key: key + '-p', needsInput: true, choose: { key: key + '-p', options: optsAlive(s, [p.id]), count: 1, submit: 'Vergiften ☠️' }, buttons: [{ id: 'back', label: 'Zurück', style: 'ghost' }] };
  }
  const victim = witchVictim(s);
  const lines = [victim ? `Die Werwölfe haben ${pname(victim)} angegriffen.` : 'Heute Nacht wurde niemand angegriffen.'];
  if (s.pending.heal) lines.push(`✔ Du rettest ${pname(victim)}.`);
  if (s.pending.poison) lines.push(`☠️ Du vergiftest ${pname(s.pending.poison)}.`);
  lines.push(`Heiltrank: ${s.potions.heal ? 'verfügbar' : 'verbraucht'} · Gifttrank: ${s.potions.poison ? 'verfügbar' : 'verbraucht'}`);
  const buttons = [];
  if (victim && s.potions.heal && !s.pending.heal) buttons.push({ id: 'heal', label: `🧪 ${pname(victim)} retten`, style: 'good' });
  if (s.potions.poison && !s.pending.poison) buttons.push({ id: 'poison', label: '☠️ Gifttrank einsetzen', style: 'danger' });
  buttons.push({ id: 'done', label: 'Fertig – schlafen', style: 'primary' });
  return { ...base, tone: 'night', emoji: '🧪', title: 'Hexe, erwache!', text: lines.join('\n'), key, needsInput: true, vibrate: true, buttons };
}

export function push() {
  const s = st();
  if (s.phase === 'setup') return;
  const views = {};
  for (const p of s.players) views[p.id] = viewFor(s, p);
  room.publish('werwolf', views);
}

// ---------- Nacht (App-Leitung) ----------
function actorsOf(s, step) {
  const alive = aliveOf(s);
  if (step === 'lovers') return alive.filter(p => s.lovers.includes(p.id));
  if (!STEPS[step] || step === 'intro') return [];
  return alive.filter(p => p.role === step);
}

function buildSteps(s) {
  const has = r => s.players.some(p => p.role === r);
  const steps = [];
  if (s.night === 1 && has('amor')) steps.push('amor', 'lovers');
  if (has('beschuetzer')) steps.push('beschuetzer');
  steps.push('werwolf');
  if (has('seherin')) steps.push('seherin');
  if (has('hexe')) steps.push('hexe');
  return steps;
}

function beginNight(s) {
  s.night++;
  s.phase = 'night';
  s.steps = buildSteps(s);
  s.stepIdx = -1;
  s.step = 'intro';
  s.act = {};
  s.pending = { wolf: null, protect: null, heal: false, poison: null };
  s.wolfVotes = {};
  s.witch = { stage: 'main' };
  const wolves = aliveOf(s).filter(isWolf);
  const others = aliveOf(s).filter(p => !isWolf(p) && p.role !== 'maedchen');
  s.girlHint = wolves.length && others.length ? shuffle([pick(wolves).id, pick(others).id]) : null;
  s.stepAt = Date.now() + 6000;
  speak(STEPS.intro.say);
}

function nextStep(s) {
  if (s.step && STEPS[s.step]?.sleep) speak(STEPS[s.step].sleep);
  s.stepIdx++;
  if (s.stepIdx >= s.steps.length) { dawn(s); return; }
  s.step = s.steps[s.stepIdx];
  s.act = {};
  s.witch = { stage: 'main' };
  speak(STEPS[s.step].say);
  // Tote oder fehlende Rollen werden trotzdem aufgerufen – damit niemand etwas merkt.
  if (actorsOf(s, s.step).length === 0) s.stepAt = Date.now() + 7000 + Math.random() * 6000;
}

function isStepDone(s) {
  const a = s.act;
  switch (s.step) {
    case 'lovers': return actorsOf(s, 'lovers').every(p => a.ok?.[p.id]);
    case 'werwolf': return aliveOf(s).filter(isWolf).every(w => s.wolfVotes[w.id]);
    default: return !!a.done;
  }
}

function resolveWolves(s) {
  const cnt = {};
  for (const w of aliveOf(s).filter(isWolf)) {
    const t = s.wolfVotes[w.id];
    if (t) cnt[t] = (cnt[t] || 0) + 1;
  }
  const max = Math.max(0, ...Object.values(cnt));
  const top = Object.keys(cnt).filter(k => cnt[k] === max);
  s.pending.wolf = top.length ? pick(top) : null;
}

function nightAction(s, p, d) {
  if (s.stepAt || !p.alive) return; // Schritt ist schon fertig
  const step = s.step;
  const a = s.act;
  if (step === 'amor' && p.role === 'amor' && d.a === 'choose' && d.ids?.length === 2) {
    s.lovers = d.ids.slice(0, 2);
    a.done = true;
  } else if (step === 'lovers' && s.lovers.includes(p.id) && d.a === 'btn') {
    (a.ok ||= {})[p.id] = true;
  } else if (step === 'beschuetzer' && p.role === 'beschuetzer' && d.a === 'choose' && d.ids?.[0] && d.ids[0] !== s.protectedLast) {
    s.pending.protect = d.ids[0];
    a.done = true;
  } else if (step === 'werwolf' && p.role === 'werwolf' && d.a === 'choose' && d.ids?.[0]) {
    // Mehrere Werwölfe auf demselben Gerät stimmen gemeinsam ab.
    const voters = room.isLocal(p.id) ? aliveOf(s).filter(w => isWolf(w) && room.isLocal(w.id)) : [p];
    for (const w of voters) s.wolfVotes[w.id] = d.ids[0];
  } else if (step === 'seherin' && p.role === 'seherin') {
    if (d.a === 'choose' && d.ids?.[0]) a.target = d.ids[0];
    else if (d.a === 'btn' && a.target) a.done = true;
  } else if (step === 'hexe' && p.role === 'hexe') {
    if (d.a === 'btn') {
      if (d.id === 'heal' && s.potions.heal && witchVictim(s)) s.pending.heal = true;
      if (d.id === 'poison' && s.potions.poison) s.witch.stage = 'poison';
      if (d.id === 'back') s.witch.stage = 'main';
      if (d.id === 'done') {
        a.done = true;
        if (s.pending.heal) s.potions.heal = false;
        if (s.pending.poison) s.potions.poison = false;
      }
    } else if (d.a === 'choose' && d.ids?.[0]) {
      s.pending.poison = d.ids[0];
      s.witch.stage = 'main';
    }
  }
  if (isStepDone(s)) finishStep(s);
}

function finishStep(s) {
  if (s.step === 'werwolf') resolveWolves(s);
  if (s.step === 'beschuetzer') s.protectedLast = s.pending.protect;
  if (s.step === 'lovers') s.loversKnown = true;
  s.stepAt = Date.now() + 2500;
}

function kill(s, id, cause, out) {
  const p = P(s, id);
  if (!p || !p.alive) return;
  p.alive = false;
  out.push({ id, cause });
  if (s.lovers.includes(id)) kill(s, s.lovers.find(x => x !== id), 'liebe', out);
  if (p.role === 'jaeger') s.hunterQueue.push(id);
}

function dawn(s) {
  s.step = null;
  s.stepAt = null;
  const out = [];
  const pd = s.pending;
  if (pd.wolf && pd.wolf !== pd.protect && !pd.heal) kill(s, pd.wolf, 'wolf', out);
  if (pd.poison) kill(s, pd.poison, 'gift', out);
  if (!s.players.some(p => p.role === 'beschuetzer' && p.alive)) s.protectedLast = null;
  announce(s, out, `☀️ Morgen ${s.night}`, 'Das Dorf erwacht.', 'day');
}

function deathLine(s, d) {
  let t = '💀 ' + pname(d.id);
  if (s.opts.reveal) t += ` (${roleName(s, d.id)})`;
  if (d.cause === 'liebe') t += ' – starb aus Liebeskummer';
  return t;
}

function announce(s, out, title, intro, next) {
  s.phase = 'announce';
  s.announce = { title, intro, lines: out.length ? out.map(d => deathLine(s, d)) : ['Niemand ist gestorben.'], next };
  const spoken = out.length
    ? (out.length === 1 ? 'Gestorben ist ' : 'Gestorben sind ') + out.map(d => pname(d.id) + (s.opts.reveal ? ', ' + roleName(s, d.id) : '')).join(' und ') + '.'
    : 'Niemand ist gestorben.';
  speak(intro + ' ' + spoken);
}

function afterAnnounce(s) {
  if (s.hunterQueue.length) {
    s.phase = 'hunter';
    s.hunterSeq++;
    speak(`${pname(s.hunterQueue[0])} war der Jäger und gibt einen letzten Schuss ab.`);
    return;
  }
  const w = winner(s);
  if (w) return endGame(s, w);
  if (s.announce.next === 'day') startDay(s);
  else beginNight(s);
}

function hunterShot(s, target) {
  const hunter = s.hunterQueue.shift();
  const out = [];
  kill(s, target, 'jaeger', out);
  announce(s, out, '🏹 Der Jäger schießt', `${pname(hunter)} reißt ${pname(target)} mit in den Tod.`, s.announce.next);
}

function startDay(s) {
  s.phase = 'day';
  s.dayEnd = Date.now() + s.opts.day * 60000;
  s.dayEndHandled = false;
  speak(`Ihr habt ${s.opts.day} ${s.opts.day === 1 ? 'Minute' : 'Minuten'}, um zu diskutieren, wer ein Werwolf ist.`);
}

function startVote(s) {
  s.phase = 'vote';
  s.votes = {};
  s.dayEndHandled = true;
  speak('Die Zeit ist um. Stimmt jetzt ab, wer das Dorf verlassen muss.');
}

function tally(s) {
  const cnt = {};
  for (const [voter, t] of Object.entries(s.votes)) if (P(s, voter)?.alive && t) cnt[t] = (cnt[t] || 0) + 1;
  const max = Math.max(0, ...Object.values(cnt));
  const top = Object.keys(cnt).filter(k => cnt[k] === max);
  const tallyLines = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${pname(k)}: ${n} ${n === 1 ? 'Stimme' : 'Stimmen'}`);
  const out = [];
  let intro;
  if (max === 0) intro = 'Niemand hat abgestimmt – niemand muss gehen.';
  else if (top.length > 1 && s.opts.tieNoLynch) intro = 'Gleichstand! Heute muss niemand gehen.';
  else {
    const t = top.length > 1 ? pick(top) : top[0];
    intro = `Das Dorf hat entschieden: ${pname(t)} muss gehen.`;
    kill(s, t, 'dorf', out);
  }
  announce(s, out, '🗳️ Urteil', intro, 'night');
  s.announce.lines = [...tallyLines, ...(out.length ? s.announce.lines : [])];
}

function winner(s) {
  const alive = aliveOf(s);
  if (!alive.length) return 'none';
  const wolves = alive.filter(isWolf).length;
  if (s.lovers.length === 2 && alive.length === 2 && alive.every(p => s.lovers.includes(p.id))) {
    const [a, b] = s.lovers.map(id => P(s, id));
    if (isWolf(a) !== isWolf(b)) return 'lovers';
  }
  if (wolves === 0) return 'dorf';
  if (wolves >= alive.length - wolves) return 'wolf';
  return null;
}

function winnerText(w) {
  return { wolf: 'Die Werwölfe gewinnen! 🐺', dorf: 'Das Dorf gewinnt! 🏡', lovers: 'Das Liebespaar gewinnt! 💘', none: 'Niemand hat überlebt …' }[w] || '';
}

function winnersOf(s) {
  if (s.winner === 'lovers') return [...s.lovers];
  if (s.winner === 'wolf') return s.players.filter(isWolf).map(p => p.id);
  if (s.winner === 'dorf') return s.players.filter(p => !isWolf(p)).map(p => p.id);
  return [];
}

function endGame(s, w) {
  s.phase = 'end';
  s.winner = w;
  s.step = null;
  s.stepAt = null;
  speak(winnerText(w).replace(/[^\p{L}\p{N}\s!.,]/gu, ''));
}

// ---------- Aktionen von Spielern ----------
function onAction(eid, d) {
  const s = st();
  const p = s.players && P(s, eid);
  if (!p || s.phase === 'setup') return;
  if (d.a === 'seen' && s.phase === 'reveal') {
    s.seen[eid] = true;
    return commit();
  }
  if (s.mode !== 'auto') return;
  if (s.phase === 'night') nightAction(s, p, d);
  else if (s.phase === 'hunter' && d.a === 'choose' && s.hunterQueue[0] === eid && d.ids?.[0]) hunterShot(s, d.ids[0]);
  else if (s.phase === 'vote' && d.a === 'choose' && p.alive && d.ids?.[0]) {
    s.votes[eid] = d.ids[0];
    if (aliveOf(s).every(x => s.votes[x.id])) tally(s);
  }
  commit();
}

function tick() {
  const s = S.games.werwolf;
  if (!s || s.phase === 'setup' || s.phase === 'end') return;
  if (s.mode === 'auto' && s.phase === 'night' && s.stepAt && Date.now() >= s.stepAt) {
    s.stepAt = null;
    nextStep(s);
    commit();
  }
  if (s.dayEnd && !s.dayEndHandled && Date.now() >= s.dayEnd) {
    s.dayEndHandled = true;
    beep();
    if (s.mode === 'auto' && s.phase === 'day') startVote(s);
    commit();
  }
}
setInterval(tick, 500);

room.register('werwolf', { action: onAction, push });

// ---------- Host-Oberfläche ----------
export function render() {
  const s = st();
  const el = h('div', {}, topbar('🐺 Werwolf', { rules: 'werwolf', invite: true }));
  const add = parts => el.append(...parts.filter(Boolean));
  if (s.phase === 'setup') add(renderSetup(s));
  else {
    if (s.phase === 'reveal') add(renderReveal(s));
    else if (s.mode === 'leader' && s.phase !== 'end') add(renderLeader(s));
    else if (s.phase === 'night') add(renderNight(s));
    else if (s.phase === 'announce') add(renderAnnounce(s));
    else if (s.phase === 'hunter') add(renderHunter(s));
    else if (s.phase === 'day') add(renderDay(s));
    else if (s.phase === 'vote') add(renderVote(s));
    else if (s.phase === 'end') add(renderEnd(s));
    if (s.phase !== 'end') {
      el.append(h('div', { class: 'center', style: { marginTop: '24px' } },
        h('button', { class: 'btn ghost small', onclick: async () => { if (await confirmDialog('Spiel wirklich abbrechen?', 'Abbrechen', true)) abort(); } }, 'Spiel abbrechen')));
    }
  }
  return el;
}

function renderSetup(s) {
  const ids = selectedIds(s);
  const n = ids.length;
  const c = fullCounts(s, n);
  const setCount = (r, v) => {
    s.counts = { ...c };
    delete s.counts.dorf;
    s.counts[r] = v;
    save(); app.rerender();
  };
  const modeBtn = (mode, title, desc) => h('button', { class: 'mode-opt' + (s.mode === mode ? ' on' : ''), onclick: () => { s.mode = mode; save(); app.rerender(); } }, h('b', {}, title), h('span', {}, desc));
  const ok = n >= 4 && c.dorf >= 0 && c.werwolf >= 1;
  return [
    playerPicker(s, { min: 4, showStatus: true }),
    card('Spielleitung',
      modeBtn('auto', '🤖 Die App leitet das Spiel', 'Erzählt mit Sprachausgabe, ruft die Rollen auf und wertet aus. Alle spielen mit – mit eigenem Handy oder heimlich auf diesem Gerät.'),
      modeBtn('leader', '🧑‍⚖️ Eigene Spielleitung', 'Eine Person leitet und spielt nicht mit. Die App verteilt Karten und hilft mit Skript, Übersicht und Timer.')),
    card('Rollen',
      ...ORDER.map(r => h('div', { class: 'role-row' },
        h('span', { class: 'r-emoji' }, ROLES[r].emoji),
        h('span', { class: 'grow' }, ROLES[r].name),
        stepper(c[r], v => setCount(r, v), { min: r === 'werwolf' ? 1 : 0, max: r === 'werwolf' ? Math.max(1, n - 1) : 1 }))),
      h('div', { class: 'role-row' }, h('span', { class: 'r-emoji' }, ROLES.dorf.emoji), h('span', { class: 'grow' }, 'Dorfbewohner (Rest)'), h('b', { class: c.dorf < 0 ? 'bad' : '' }, c.dorf)),
      c.dorf < 0 ? h('p', { class: 'warn' }, 'Zu viele Sonderrollen für die Spielerzahl.') : null,
      h('button', { class: 'btn small ghost', onclick: () => { s.counts = null; save(); app.rerender(); } }, '↺ Empfohlene Verteilung')),
    card('Optionen',
      h('div', { class: 'row between' }, h('span', {}, 'Diskussion am Tag'), stepper(s.opts.day, v => { s.opts.day = v; save(); app.rerender(); }, { min: 1, max: 15, fmt: v => v + ' min' })),
      toggle('Rolle beim Tod aufdecken', s.opts.reveal, v => { s.opts.reveal = v; save(); }),
      toggle('Gleichstand: niemand stirbt', s.opts.tieNoLynch, v => { s.opts.tieNoLynch = v; save(); }, 'Sonst entscheidet das Los zwischen den Meistgewählten.'),
      toggle('Sprachausgabe', S.settings.tts, v => { S.settings.tts = v; save(); })),
    h('button', { class: 'btn primary big block', disabled: !ok, onclick: start }, '🂠 Rollen verteilen'),
  ];
}

function statusList(s, fn) {
  return h('ul', { class: 'status-list' }, s.players.map(p => h('li', { class: p.alive ? '' : 'dead' }, pill(p.id), h('span', { class: 's' }, fn(p)))));
}

function renderReveal(s) {
  const ids = s.players.map(p => p.id);
  const allSeen = ids.every(id => s.seen[id]);
  return [
    h('div', { class: 'card center' },
      h('h2', {}, '🂠 Rollen ansehen'),
      h('p', { class: 'muted' }, 'Jeder schaut sich geheim seine Rolle an. Verbundene Handys zeigen sie direkt an.')),
    room.passPanel(ids),
    card(`Status (${ids.filter(id => s.seen[id]).length}/${ids.length})`,
      statusList(s, p => s.seen[p.id] ? '✓ gesehen' : room.isLocal(p.id) ? '🤚 auf diesem Gerät' : room.status(p.id) === 'online' ? '📱 schaut gerade' : '📵 getrennt')),
    allSeen
      ? h('button', {
        class: 'btn primary big block',
        onclick: () => {
          if (s.mode === 'auto') beginNight(s);
          else { s.phase = 'lead'; s.night = 1; s.leader = { phase: 'night', done: {} }; }
          commit();
        },
      }, s.mode === 'auto' ? '🌙 Erste Nacht beginnen' : '🧑‍⚖️ Zur Spielleiter-Ansicht')
      : h('p', { class: 'center muted' }, 'Warte, bis alle ihre Rolle gesehen haben …'),
  ];
}

function aliveOverview(s) {
  return card('Dorf', statusList(s, p => p.alive ? 'lebt' : (s.opts.reveal ? ROLES[p.role].emoji + ' ' + ROLES[p.role].name : '💀')));
}

function renderNight(s) {
  const info = STEPS[s.step] || { say: 'Die Nacht geht weiter …' };
  const local = actorsOf(s, s.step).filter(p => room.needsLocal(p.id));
  return [
    h('div', { class: 'narration tone-night' },
      h('div', { class: 'big-emoji' }, '🌙'),
      h('h2', {}, `Nacht ${s.night}`),
      h('p', { class: 'say' }, info.say),
      h('div', { class: 'steps-dots' }, s.steps.map((_, i) => h('span', { class: i < s.stepIdx ? 'done' : i === s.stepIdx ? 'cur' : '' })))),
    local.length ? h('button', { class: 'btn primary big block', style: { marginTop: '14px' }, onclick: () => room.openLocal(local[0].id, { anonymous: true }) }, '🤫 Gerufene Rolle: hier tippen') : null,
    h('p', { class: 'small muted center' }, 'Wer ein eigenes Handy hat, handelt dort. Alle anderen nehmen heimlich dieses Gerät, wenn ihre Rolle gerufen wird.'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn ghost small', onclick: () => speak(info.say, true) }, '🔊 Wiederholen'),
      h('button', {
        class: 'btn ghost small', onclick: async () => {
          if (!(await confirmDialog('Diesen Schritt überspringen? (Nur nutzen, wenn jemand hängt.)', 'Überspringen'))) return;
          if (s.step === 'werwolf') resolveWolves(s);
          s.stepAt = Date.now();
          commit();
        },
      }, '⏭ Schritt überspringen')),
  ];
}

function renderAnnounce(s) {
  const a = s.announce;
  return [
    h('div', { class: 'narration tone-day' },
      h('div', { class: 'big-emoji' }, '📢'),
      h('h2', {}, a.title),
      h('p', { class: 'say' }, a.intro),
      ...a.lines.map(l => h('p', {}, l))),
    h('button', { class: 'btn primary big block', style: { marginTop: '14px' }, onclick: () => { afterAnnounce(s); commit(); } }, 'Weiter ▶'),
    h('button', { class: 'btn ghost small block', style: { marginTop: '8px' }, onclick: () => speak(a.intro + ' ' + a.lines.join('. '), true) }, '🔊 Nochmal vorlesen'),
    aliveOverview(s),
  ];
}

function renderHunter(s) {
  const hunter = s.hunterQueue[0];
  return [
    h('div', { class: 'narration tone-danger' },
      h('div', { class: 'big-emoji' }, '🏹'),
      h('h2', {}, 'Der Jäger zielt'),
      h('p', { class: 'say' }, `${pname(hunter)} war der Jäger und nimmt jemanden mit in den Tod.`)),
    room.needsLocal(hunter) ? h('button', { class: 'btn primary big block', style: { marginTop: '14px' }, onclick: () => room.openLocal(hunter) }, `🏹 ${pname(hunter)}: jetzt zielen`) : h('p', { class: 'center muted' }, 'Der Jäger wählt auf seinem Handy …'),
  ];
}

function renderDay(s) {
  return [
    h('div', { class: 'narration tone-day' },
      h('div', { class: 'big-emoji' }, '☀️'),
      h('h2', {}, `Tag ${s.night}`),
      h('p', {}, 'Diskutiert: Wer ist ein Werwolf?'),
      timerSpan(s.dayEnd)),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => { s.dayEnd += 60000; s.dayEndHandled = false; commit(); } }, '+1 Minute'),
      h('button', { class: 'btn primary', onclick: () => { startVote(s); commit(); } }, '🗳️ Jetzt abstimmen')),
    aliveOverview(s),
  ];
}

function renderVote(s) {
  const alive = aliveOf(s);
  return [
    h('div', { class: 'narration tone-day' },
      h('div', { class: 'big-emoji' }, '🗳️'),
      h('h2', {}, 'Abstimmung'),
      h('p', {}, `${alive.filter(p => s.votes[p.id]).length} von ${alive.length} haben abgestimmt.`)),
    card('Stimmen',
      h('p', { class: 'small muted' }, 'Handys stimmen selbst ab. Für Spieler ohne Handy hier auswählen (z. B. per Handzeichen).'),
      h('ul', { class: 'status-list' }, alive.map(p => h('li', {},
        pill(p.id),
        room.isLocal(p.id)
          ? h('select', {
            style: { marginLeft: 'auto', width: 'auto', maxWidth: '50%' },
            onchange: e => { if (e.target.value) { s.votes[p.id] = e.target.value; if (alive.every(x => s.votes[x.id])) tally(s); commit(); } },
          }, h('option', { value: '' }, '– wählen –'), alive.filter(o => o.id !== p.id).map(o => h('option', { value: o.id, selected: s.votes[p.id] === o.id }, pname(o.id))))
          : h('span', { class: 's' }, s.votes[p.id] ? '✓ abgestimmt' : '⏳'))))),
    h('button', { class: 'btn primary big block', onclick: () => { tally(s); commit(); } }, 'Jetzt auszählen'),
  ];
}

function renderEnd(s) {
  const winners = winnersOf(s);
  return [
    h('div', { class: 'banner' }, h('div', { class: 'big-emoji' }, { wolf: '🐺', dorf: '🏡', lovers: '💘', none: '💀' }[s.winner]), h('h2', {}, winnerText(s.winner))),
    card('Alle Rollen', h('ul', { class: 'status-list' }, s.players.map(p => h('li', {},
      pill(p.id),
      h('span', { class: 's' }, `${ROLES[p.role].emoji} ${ROLES[p.role].name}${p.alive ? '' : ' 💀'}${winners.includes(p.id) ? ' 🏆' : ''}`))))),
    recordBlock(s, 'Werwolf', () => s.players.map(p => ({ id: p.id, won: winners.includes(p.id) }))),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary big', onclick: start }, '🔁 Neue Runde'),
      h('button', { class: 'btn big', onclick: abort }, '⚙️ Einstellungen')),
  ];
}

// ---------- Spielleiter-Ansicht (menschliche Leitung) ----------
function leaderSteps(s) {
  const has = r => s.players.some(p => p.role === r);
  const out = [{ k: 'intro', title: '🌙 Einschlafen', say: 'Es wird Nacht im Dorf. Alle schließen die Augen.' }];
  if (s.night === 1 && has('amor')) {
    out.push({ k: 'amor', role: 'amor', title: '💘 Amor', say: 'Amor erwacht und zeigt auf zwei Personen, die sich ineinander verlieben. … Amor schläft wieder ein.' });
    out.push({ k: 'lovers', title: '💞 Verliebte', say: 'Ich tippe die Verliebten an. Die Verliebten erwachen, erkennen einander und schlafen wieder ein.', note: 'Markiere das Paar unten mit 💘.' });
  }
  if (has('beschuetzer')) out.push({ k: 'beschuetzer', role: 'beschuetzer', title: '🛡️ Beschützer', say: 'Der Beschützer erwacht und zeigt auf die Person, die er heute Nacht beschützen will. … Der Beschützer schläft wieder ein.', note: 'Nicht zweimal hintereinander dieselbe Person.' });
  out.push({ k: 'werwolf', role: 'werwolf', title: '🐺 Werwölfe', say: 'Die Werwölfe erwachen, erkennen einander und einigen sich leise auf ein Opfer. … Die Werwölfe schlafen wieder ein.', note: has('maedchen') ? 'Das Mädchen darf jetzt blinzeln.' : '' });
  if (has('seherin')) out.push({ k: 'seherin', role: 'seherin', title: '🔮 Seherin', say: 'Die Seherin erwacht und zeigt auf eine Person, deren Rolle sie sehen möchte. … Die Seherin schläft wieder ein.', note: 'Zeige ihr die Rolle (siehe Liste unten).' });
  if (has('hexe')) out.push({ k: 'hexe', role: 'hexe', title: '🧪 Hexe', say: 'Die Hexe erwacht. Ich zeige ihr das Opfer der Werwölfe. Will sie ihren Heiltrank benutzen? Will sie ihren Gifttrank benutzen? … Die Hexe schläft wieder ein.', potions: true });
  out.push({ k: 'dawn', title: '☀️ Morgen', say: 'Das Dorf erwacht.', note: 'Verkünde die Opfer und markiere sie unten als tot. Jäger tot? Er schießt sofort.' });
  return out;
}

function renderLeader(s) {
  const L = s.leader;
  const night = L.phase === 'night';
  const w = winner(s);
  const els = [];
  els.push(h('div', { class: 'btn-row' },
    h('button', { class: 'btn big ' + (night ? 'primary' : ''), onclick: () => { L.phase = 'night'; s.dayEnd = null; commit(); } }, `🌙 Nacht ${s.night}`),
    h('button', { class: 'btn big ' + (!night ? 'primary' : ''), onclick: () => { L.phase = 'day'; commit(); } }, `☀️ Tag ${s.night}`)));
  if (w) els.push(h('div', { class: 'card accent center' }, h('b', {}, 'Laut Übersicht: ' + winnerText(w)), h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: () => { endGame(s, w); commit(); } }, 'Spiel beenden'))));

  if (night) {
    const steps = leaderSteps(s);
    els.push(card(`Ablauf Nacht ${s.night}`,
      ...steps.map(step => {
        const holders = step.role ? s.players.filter(p => p.role === step.role) : step.k === 'lovers' ? s.players.filter(p => s.lovers.includes(p.id)) : [];
        const done = !!L.done[step.k];
        return h('div', { class: 'step' + (done ? ' done' : '') },
          h('h4', {},
            h('input', { type: 'checkbox', checked: done, style: { width: '20px', height: '20px' }, onchange: e => { L.done[step.k] = e.target.checked; save(); app.rerender(); } }),
            step.title,
            h('button', { class: 'btn ghost small', style: { marginLeft: 'auto' }, onclick: () => speak(step.say.replace(/…/g, ''), true) }, '🔊')),
          holders.length ? h('div', { class: 'row wrap' }, holders.map(p => h('span', { class: p.alive ? '' : 'dead' }, pill(p.id)))) : null,
          h('p', { class: 'script' }, '„' + step.say + '“'),
          step.note ? h('p', { class: 'small muted' }, step.note) : null,
          step.potions ? h('div', {},
            toggle('Heiltrank noch verfügbar', s.potions.heal, v => { s.potions.heal = v; save(); }),
            toggle('Gifttrank noch verfügbar', s.potions.poison, v => { s.potions.poison = v; save(); })) : null);
      })));
  } else {
    els.push(card(`Tag ${s.night}`,
      h('p', {}, 'Diskutiert und stimmt ab. Die Person mit den meisten Stimmen scheidet aus (unten als tot markieren).'),
      h('div', { class: 'center' }, s.dayEnd ? timerSpan(s.dayEnd) : null),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => { s.dayEnd = Date.now() + s.opts.day * 60000; s.dayEndHandled = false; commit(); } }, `⏱ Timer ${s.opts.day} min`),
        s.dayEnd ? h('button', { class: 'btn ghost', onclick: () => { s.dayEnd = null; commit(); } }, 'Timer stoppen') : null),
      h('button', { class: 'btn primary big block', style: { marginTop: '10px' }, onclick: () => { s.night++; L.done = {}; L.phase = 'night'; s.dayEnd = null; commit(); } }, `🌙 Weiter zu Nacht ${s.night + 1}`)));
  }

  els.push(card('Spieler & Rollen',
    h('p', { class: 'small muted' }, 'Tippe 💀 zum Töten/Wiederbeleben und 💘 für das Liebespaar.'),
    h('ul', { class: 'status-list' }, s.players.map(p => h('li', {},
      h('span', { class: p.alive ? '' : 'dead' }, pill(p.id)),
      h('span', { class: 'small' }, ROLES[p.role].emoji + ' ' + ROLES[p.role].name),
      h('span', { class: 's row' },
        h('button', {
          class: 'btn small ' + (s.lovers.includes(p.id) ? 'primary' : 'ghost'),
          onclick: () => {
            if (s.lovers.includes(p.id)) s.lovers = s.lovers.filter(x => x !== p.id);
            else s.lovers = [...s.lovers, p.id].slice(-2);
            commit();
          },
        }, '💘'),
        h('button', { class: 'btn small ' + (p.alive ? 'ghost' : 'danger'), onclick: () => { p.alive = !p.alive; commit(); } }, p.alive ? '💀' : '↺'))))),
    s.lovers.length === 2 ? h('p', { class: 'small' }, `💘 Liebespaar: ${pname(s.lovers[0])} & ${pname(s.lovers[1])} – stirbt einer, stirbt auch der andere!`) : null));

  els.push(h('button', {
    class: 'btn big block', onclick: () => modal('Wer hat gewonnen?', close => h('div', { class: 'stack' },
      ...['dorf', 'wolf', 'lovers'].map(k => h('button', { class: 'btn big block', onclick: () => { close(); endGame(s, k); commit(); } }, winnerText(k)))))
  }, '🏁 Spiel beenden'));
  return els;
}

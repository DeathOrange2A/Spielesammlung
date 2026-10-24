// Kleine Helfer: DOM-Bau, Dialoge, Sprache, Töne, Timer.
import { S } from './store.js';

// Wird von app.js gesetzt.
export const app = { rerender() {} };

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const pick = a => a[Math.floor(Math.random() * a.length)];

export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export function toast(msg, ms = 2200) {
  const el = h('div', { class: 'toast' }, msg);
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}

export function modal(title, content) {
  const back = h('div', { class: 'modal-back' });
  const close = () => back.remove();
  const body = h('div', { class: 'modal-body' });
  body.append(typeof content === 'function' ? content(close) : content);
  back.append(h('div', { class: 'modal' },
    h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { class: 'icon-btn', onclick: close, 'aria-label': 'Schließen' }, '✕')),
    body));
  back.addEventListener('click', e => { if (e.target === back) close(); });
  document.body.append(back);
  return close;
}

export function confirmDialog(text, okLabel = 'OK', danger = false) {
  return new Promise(resolve => {
    modal('Bitte bestätigen', close => h('div', {},
      h('p', {}, text),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => { close(); resolve(false); } }, 'Abbrechen'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { close(); resolve(true); } }, okLabel))));
  });
}

// ---------- Sprachausgabe ----------
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /^de/i.test(v.lang) && /google|neural|natural|online/i.test(v.name)) || vs.find(v => /^de/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
export function speak(text, force = false) {
  if (!text || !('speechSynthesis' in window)) return;
  if (!force && !S.settings.tts) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  if (voice) u.voice = voice;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}
export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// ---------- Töne & Vibration ----------
let actx = null;
export function beep(times = 3) {
  if (!S.settings.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.start(t); o.stop(t + 0.3);
    }
  } catch (e) { /* kein Audio */ }
  vibrate([300, 100, 300]);
}
export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch (e) { /* egal */ }
}

// ---------- Bildschirm wach halten ----------
let wakeLock = null;
export async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) { /* nicht unterstützt */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
document.addEventListener('click', keepAwake);

// ---------- Timer-Anzeigen ----------
// <span data-end="timestamp"> wird automatisch heruntergezählt.
export function timerSpan(endAt, pausedMs = null) {
  if (pausedMs != null) return h('span', { class: 'timer paused' }, fmtTime(pausedMs));
  return h('span', { class: 'timer', 'data-end': String(endAt) }, fmtTime(endAt - Date.now()));
}
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll('[data-end]').forEach(el => {
    const left = +el.dataset.end - now;
    el.textContent = fmtTime(left);
    el.classList.toggle('urgent', left < 10000 && left > 0);
  });
}, 250);

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Kopiert ✓');
  } catch (e) {
    toast('Kopieren nicht möglich');
  }
}

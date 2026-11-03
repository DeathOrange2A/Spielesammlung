/* Brotkarte Hannover – App-Logik
   Daten liegen entweder in Supabase (gemeinsam, mit Anmeldung) oder im
   Testmodus nur im Browser dieses Geräts. */
(function () {
"use strict";

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  json(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
  put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2));

/* ================= Datenquellen ================= */

class CloudStore {
  constructor(url, key) {
    this.kind = "cloud";
    this.sb = supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "brot.auth" } });
    this.uid = null;
  }
  async session() { const { data } = await this.sb.auth.getSession(); this.uid = data.session ? data.session.user.id : null; return data.session; }
  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.uid = data.user.id; return data.session;
  }
  async signOut() { await this.sb.auth.signOut(); this.uid = null; }
  async load() {
    const q = t => this.sb.from(t).select("*").limit(10000);
    const [b, r, p] = await Promise.all([q("bakeries"), q("breads"), q("profiles")]);
    for (const x of [b, r, p]) if (x.error) throw x.error;
    return { bakeries: b.data, breads: r.data, profiles: p.data };
  }
  async _save(table, row, id) {
    row.updated_at = new Date().toISOString();
    const res = id ? await this.sb.from(table).update(row).eq("id", id).select().single()
                   : await this.sb.from(table).insert(row).select().single();
    if (res.error) throw res.error; return res.data;
  }
  async _del(table, id) { const { error } = await this.sb.from(table).delete().eq("id", id); if (error) throw error; }
  saveBakery(row, id) { return this._save("bakeries", row, id); }
  saveBread(row, id) { return this._save("breads", row, id); }
  deleteBakery(id) { return this._del("bakeries", id); }
  deleteBread(id) { return this._del("breads", id); }
  async setName(name) {
    const { error } = await this.sb.from("profiles").upsert({ id: this.uid, name, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  subscribe(cb) {
    let t = null; const fire = () => { clearTimeout(t); t = setTimeout(cb, 250); };
    this.ch = this.sb.channel("brotkarte")
      .on("postgres_changes", { event: "*", schema: "public", table: "bakeries" }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "breads" }, fire)
      .subscribe();
  }
}

class LocalStore {
  constructor() { this.kind = "local"; this.uid = "local"; this.key = "brot.local.v1"; }
  _db() { return ls.json(this.key) || { bakeries: [], breads: [], profiles: [] }; }
  _put(db) { ls.put(this.key, db); }
  async session() { return { local: true }; }
  async signOut() {}
  async load() { return this._db(); }
  async _save(table, row, id) {
    const db = this._db(); const now = new Date().toISOString();
    let rec;
    if (id) { rec = db[table].find(x => x.id === id); if (!rec) throw new Error("Eintrag nicht gefunden"); Object.assign(rec, row, { updated_at: now }); }
    else { rec = { id: uuid(), created_by: this.uid, created_at: now, updated_at: now, ...row }; db[table].push(rec); }
    if (table === "bakeries" && !id) {} // nichts weiter
    this._put(db); return rec;
  }
  async _del(table, id) {
    const db = this._db(); db[table] = db[table].filter(x => x.id !== id);
    if (table === "bakeries") db.breads.forEach(r => { if (r.bakery_id === id) r.bakery_id = null; });
    this._put(db);
  }
  saveBakery(row, id) { return this._save("bakeries", row, id); }
  saveBread(row, id) { return this._save("breads", row, id); }
  deleteBakery(id) { return this._del("bakeries", id); }
  deleteBread(id) { return this._del("breads", id); }
  async setName(name) { const db = this._db(); db.profiles = [{ id: this.uid, name }]; this._put(db); }
  subscribe(cb) { addEventListener("storage", e => { if (e.key === this.key) cb(); }); }
}

/* ================= Zustand ================= */

const S = {
  store: null, bakeries: [], breads: [], profiles: {},
  scale: ls.get("brot.scale") === "5" ? "5" : "10",
  view: "map", sort: "new", filter: "all", query: "",
  showOsm: ls.get("brot.osm") !== "0", osm: [],
  placing: null, sheetBk: null, rerate: null, loaded: false
};

/* ================= Formatierung ================= */

const nf1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const dfmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" });
const fmtDate = s => { if (!s) return ""; const d = new Date(s + "T12:00:00"); return isNaN(d) ? s : dfmt.format(d); };
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const numOrNull = v => (v === null || v === undefined || v === "" ? null : Number(v));
const avg = a => { a = a.filter(v => typeof v === "number" && !isNaN(v)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const maxLabel = () => (S.scale === "5" ? "/5" : "/10");
function scoreText(v) {
  if (v == null) return "–";
  const x = S.scale === "5" ? v / 2 : v;
  return Number.isInteger(x) ? String(x) : nf1.format(x);
}
const starsHTML = (v, kind) => `<span class="stars ${kind}" aria-hidden="true">★★★★★<span class="fill" style="width:${v == null ? 0 : Math.max(0, Math.min(100, v * 10))}%">★★★★★</span></span>`;
function barHTML(v, kind) {
  const n = v == null ? 0 : Math.round(v); let h = "";
  for (let i = 1; i <= 10; i++) h += `<i class="${i <= n ? "on" : ""}"></i>`;
  return `<span class="bar ${kind}" aria-hidden="true">${h}</span>`;
}
const visual = (v, kind) => (S.scale === "5" ? starsHTML(v, kind) : barHTML(v, kind));
function scoreRow(v, kind) {
  const label = kind === "pur" ? "pur" : "getoastet";
  return `<div class="score ${v == null ? "none" : ""}" aria-label="${label}: ${v == null ? "nicht bewertet" : scoreText(v) + maxLabel()}"><span class="k">${label}</span>${visual(v, kind)}<span class="v">${scoreText(v)}${v == null ? "" : `<small>${maxLabel()}</small>`}</span></div>`;
}
const tagScore = v => (v == null ? "neu" : (S.scale === "5" ? "★ " : "") + scoreText(v));
function parsePrice(t) {
  if (t == null) return null;
  t = String(t).replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d*\.?\d*$/.test(t)) return NaN;
  const n = parseFloat(t); return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/* ================= abgeleitete Daten ================= */

const bakeryById = id => S.bakeries.find(b => b.id === id) || null;
const breadsOf = id => S.breads.filter(r => r.bakery_id === id);
function bakeryStats(id) {
  const rs = breadsOf(id);
  return { n: rs.length, p: avg(rs.map(r => r.plain)), t: avg(rs.map(r => r.toasted)), all: avg(rs.flatMap(r => [r.plain, r.toasted])) };
}
function placeOf(r) {
  if (r.bakery_id) { const b = bakeryById(r.bakery_id); return b ? b.name : (r.bakery_name || "Bäckerei"); }
  return r.place || (r.bakery_name ? r.bakery_name : "Unterwegs");
}
function whoName(id) {
  if (!id || S.store.kind === "local") return "";
  if (id === S.store.uid) return "du";
  return (S.profiles[id] && S.profiles[id].name) || "";
}
function normalize(data) {
  S.bakeries = (data.bakeries || []).map(b => ({ ...b, lat: Number(b.lat), lng: Number(b.lng) })).filter(b => b.name && isFinite(b.lat) && isFinite(b.lng));
  S.breads = (data.breads || []).map(r => ({ ...r, price: numOrNull(r.price), plain: numOrNull(r.plain), toasted: numOrNull(r.toasted) })).filter(r => r.name);
  S.profiles = {}; (data.profiles || []).forEach(p => (S.profiles[p.id] = p));
}

/* ================= UI-Helfer ================= */

let toastT = null;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }
function errText(e) {
  const m = (e && (e.message || e.error_description)) || "";
  if (!navigator.onLine) return "Keine Internetverbindung. Versuch es gleich nochmal.";
  if (/JWT|token|auth/i.test(m)) return "Deine Anmeldung ist abgelaufen. Melde dich in den Einstellungen neu an.";
  if (/row-level security|permission/i.test(m)) return "Keine Berechtigung. Ist das SQL-Skript in Supabase ausgeführt?";
  return "Speichern hat nicht geklappt" + (m ? ": " + m : ".");
}

const sheet = $("#sheet"), scrim = $("#scrim"), body = $("#sheetBody");
let onSheetClose = null;
function openSheet(html, onClose) {
  S.sheetBk = null; S.rerate = null;
  body.innerHTML = html; sheet.scrollTop = 0; onSheetClose = onClose || null;
  sheet.classList.add("open"); scrim.classList.add("open");
  const x = body.querySelector(".x"); if (x) x.onclick = closeSheet;
}
function closeSheet() {
  if (!sheet.classList.contains("open")) return;
  sheet.classList.remove("open"); scrim.classList.remove("open"); S.sheetBk = null; S.rerate = null;
  const f = onSheetClose; onSheetClose = null; if (f) f();
}
scrim.onclick = closeSheet;
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (sheet.classList.contains("open")) closeSheet(); else if (S.placing) $("#placeCancel").click();
});
const head = (eyebrow, title) => `<div class="sheet-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h2 id="sheetTitle">${esc(title)}</h2></div><button class="x" type="button" aria-label="Schließen">×</button></div>`;
function confirmButton(btn, label, action) {
  let sure = false;
  btn.onclick = async () => {
    if (!sure) { sure = true; btn.classList.add("sure"); btn.textContent = label; return; }
    btn.disabled = true;
    try { await action(); } catch (e) { btn.disabled = false; toast(errText(e)); }
  };
}

/* ================= Karte ================= */

const map = L.map("map", { zoomControl: false, minZoom: 5, maxZoom: 19, zoomSnap: 0.5, worldCopyJump: true }).setView([52.3745, 9.7385], 13);
map.attributionControl.setPrefix(false);
$("#zin").onclick = () => map.zoomIn();
$("#zout").onclick = () => map.zoomOut();

const darkQ = matchMedia("(prefers-color-scheme: dark)");
let tiles = null;
function setTiles() {
  if (tiles) tiles.remove();
  const style = darkQ.matches ? "dark_all" : "light_all";
  tiles = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`, {
    subdomains: "abcd", maxZoom: 20, detectRetina: false,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
  }).addTo(map);
}
setTiles();
try { darkQ.addEventListener("change", () => { setTiles(); renderOsm(); }); } catch (e) {}

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const pins = L.layerGroup().addTo(map);
const osmLayer = L.layerGroup().addTo(map);
const osmRenderer = L.canvas({ padding: 0.3 });
let tempPin = null, meMarker = null;

function pinIcon(text, name, temp) {
  return L.divIcon({ className: "", iconSize: [0, 0], html: `<div class="pin ${temp ? "temp" : ""}"><div class="tag">${esc(text)}${name ? `<em>${esc(name)}</em>` : ""}</div><div class="stem"></div><div class="dot"></div></div>` });
}
function setTempPin(lat, lng) {
  if (tempPin) tempPin.remove();
  tempPin = L.marker([lat, lng], { icon: pinIcon("hier", "", true), interactive: false }).addTo(map);
}
function clearTempPin() { if (tempPin) { tempPin.remove(); tempPin = null; } }

function renderPins() {
  pins.clearLayers();
  const showNames = map.getZoom() >= 14;
  S.bakeries.forEach(b => {
    const st = bakeryStats(b.id);
    const m = L.marker([b.lat, b.lng], { icon: pinIcon(tagScore(st.all), showNames ? b.name : "", false), title: b.name, riseOnHover: true, zIndexOffset: 1000 });
    m.on("click", () => openBakery(b.id));
    pins.addLayer(m);
  });
  $("#mapEmpty").hidden = !(S.loaded && S.bakeries.length === 0 && !S.placing);
  renderOsm();
}
map.on("zoomend", () => { if (S.loaded) renderPins(); });

/* --- Bäckereien aus OpenStreetMap (Overpass) --- */
const OSM_KEY = "brot.osm.cache.v1";
const OSM_BBOX = "52.29,9.60,52.46,9.93"; // Stadtgebiet Hannover mit etwas Rand
async function loadOsm(force) {
  const cached = ls.json(OSM_KEY);
  if (cached && !force && Date.now() - cached.t < 7 * 864e5) { S.osm = cached.items; renderOsm(); return; }
  if (cached) { S.osm = cached.items; renderOsm(); }
  const q = `[out:json][timeout:25];nwr["shop"="bakery"](${OSM_BBOX});out center tags;`;
  for (const ep of ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]) {
    try {
      const res = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (!res.ok) continue;
      const js = await res.json();
      const items = js.elements.map(e => {
        const t = e.tags || {}; const lat = e.lat ?? (e.center && e.center.lat), lng = e.lon ?? (e.center && e.center.lon);
        const addr = [t["addr:street"] && (t["addr:street"] + (t["addr:housenumber"] ? " " + t["addr:housenumber"] : "")), t["addr:city"] && t["addr:city"] !== "Hannover" ? t["addr:city"] : ""].filter(Boolean).join(", ");
        return { id: e.type + "/" + e.id, name: t.name || t.brand || "Bäckerei ohne Namen", brand: t.brand || "", addr, hours: t.opening_hours || "", lat, lng };
      }).filter(x => isFinite(x.lat) && isFinite(x.lng));
      S.osm = items; ls.put(OSM_KEY, { t: Date.now(), items }); renderOsm(); return;
    } catch (e) { /* nächster Server */ }
  }
}
function renderOsm() {
  osmLayer.clearLayers();
  if (!S.showOsm || !S.osm.length) return;
  if (map.getZoom() < 12.5) return;
  const known = new Set(S.bakeries.map(b => b.osm_id).filter(Boolean));
  const ink = css("--ink"), bg = css("--bg");
  S.osm.forEach(o => {
    if (known.has(o.id)) return;
    const m = L.circleMarker([o.lat, o.lng], { renderer: osmRenderer, radius: 5.5, weight: 1.5, color: ink, opacity: 0.55, fillColor: bg, fillOpacity: 1 });
    m.on("click", () => openOsm(o));
    osmLayer.addLayer(m);
  });
}
function setOsm(on) {
  S.showOsm = on; ls.set("brot.osm", on ? "1" : "0");
  $("#osmToggle").setAttribute("aria-pressed", on);
  if (on) loadOsm(); renderOsm();
  note(on ? "Bäckereien aus OpenStreetMap eingeblendet" : "OpenStreetMap-Bäckereien ausgeblendet");
}
$("#osmToggle").onclick = () => setOsm(!S.showOsm);
$("#osmToggle").setAttribute("aria-pressed", S.showOsm);

let noteT = null;
function note(text) { const n = $("#mapNote"); n.textContent = text; n.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => (n.hidden = true), 2200); }

/* --- Standort --- */
let lastPos = null;
function locate(cb) {
  if (!navigator.geolocation) { toast("Dein Gerät gibt keinen Standort frei."); return; }
  navigator.geolocation.getCurrentPosition(p => {
    lastPos = { lat: p.coords.latitude, lng: p.coords.longitude };
    if (meMarker) meMarker.remove();
    meMarker = L.marker([lastPos.lat, lastPos.lng], { interactive: false, icon: L.divIcon({ className: "", iconSize: [0, 0], html: '<div class="me-dot"></div>' }) }).addTo(map);
    if (cb) cb(lastPos); else map.setView([lastPos.lat, lastPos.lng], Math.max(map.getZoom(), 16));
  }, err => toast(err.code === 1 ? "Standort nicht erlaubt. Gib ihn in den Browser-Einstellungen frei." : "Standort nicht gefunden."), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}
$("#locate").onclick = () => locate();

/* --- Adresssuche (Nominatim) --- */
async function geocode(q) {
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=de&viewbox=9.60,52.46,9.93,52.29&q=${encodeURIComponent(q)}`;
  const res = await fetch(u); if (!res.ok) throw new Error("Suche fehlgeschlagen");
  return (await res.json()).map(x => ({ lat: +x.lat, lng: +x.lon, title: x.name || x.display_name.split(",")[0], sub: x.display_name, addr: shortAddr(x.address) }));
}
async function reverse(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=de&lat=${lat}&lon=${lng}`);
    if (!res.ok) return ""; const x = await res.json(); return shortAddr(x.address);
  } catch (e) { return ""; }
}
function shortAddr(a) {
  if (!a) return "";
  const street = a.road || a.pedestrian || a.footway || a.square || "";
  const line = street ? street + (a.house_number ? " " + a.house_number : "") : "";
  const city = a.city || a.town || a.village || "";
  return [line, city && city !== "Hannover" ? city : (line ? "" : (a.suburb || city))].filter(Boolean).join(", ");
}
function parseCoords(s) {
  if (!s) return null; s = String(s);
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
            s.match(/[?&](?:q|ll|query|center)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/) || s.match(/mlat=(-?\d+\.\d+)&mlon=(-?\d+\.\d+)/) ||
            s.match(/^\s*(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})\s*$/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  return lat > -90 && lat < 90 && lng > -180 && lng < 180 ? { lat, lng } : null;
}

/* --- Pin setzen --- */
function startPlacing(p) {
  S.placing = p; onSheetClose = null; closeSheet(); showView("map");
  $("#placeText").textContent = p.mode === "move" ? "Tippe auf die neue Position" : "Tippe auf die Karte, wo die Bäckerei ist";
  $("#placeBanner").hidden = false; $("#mapEmpty").hidden = true;
  map.getContainer().style.cursor = "crosshair";
}
function stopPlacing() {
  S.placing = null; $("#placeBanner").hidden = true; map.getContainer().style.cursor = ""; renderPins();
}
$("#placeCancel").onclick = () => { const p = S.placing; stopPlacing(); clearTempPin(); if (p && p.returnTo) p.returnTo(); };
map.on("click", e => {
  if (!S.placing) return;
  const p = S.placing; const ll = e.latlng;
  setTempPin(ll.lat, ll.lng); stopPlacing();
  if (p.mode === "move") bakeryForm(bakeryById(p.bakeryId), { lat: ll.lat, lng: ll.lng, draft: p.draft });
  else bakeryForm(null, { lat: ll.lat, lng: ll.lng, draft: p.draft, afterCreate: p.afterCreate });
});

/* ================= Bäckerei ansehen ================= */

function openBakery(id) {
  const b = bakeryById(id); if (!b) return;
  const st = bakeryStats(id);
  const rs = breadsOf(id).sort((a, c) => (c.eaten_on || "").localeCompare(a.eaten_on || ""));
  const osm = `https://www.openstreetmap.org/?mlat=${b.lat.toFixed(5)}&mlon=${b.lng.toFixed(5)}#map=18/${b.lat.toFixed(5)}/${b.lng.toFixed(5)}`;
  const route = `https://www.google.com/maps/dir/?api=1&destination=${b.lat.toFixed(6)},${b.lng.toFixed(6)}`;
  const big = v => (v == null ? "–" : scoreText(v) + `<small>${maxLabel()}</small>`);
  const scrollY = S.sheetBk === id ? sheet.scrollTop : 0;
  openSheet(`${head("Bäckerei", b.name)}
    <div class="bk-meta">${b.address ? `<span>${esc(b.address)}</span>` : ""}<a href="${route}" target="_blank" rel="noopener">Route ↗</a><a href="${osm}" target="_blank" rel="noopener">OpenStreetMap ↗</a></div>
    <div class="bk-scores">
      <div class="bk-score pur"><span>Ø pur</span><b>${big(st.p)}</b>${visual(st.p, "pur")}</div>
      <div class="bk-score toast"><span>Ø getoastet</span><b>${big(st.t)}</b>${visual(st.t, "toast")}</div>
    </div>
    <p class="eyebrow" style="margin-bottom:6px">${st.n === 1 ? "1 Brot" : st.n + " Brote"}</p>
    ${rs.length ? `<div class="breads">${rs.map(breadRow).join("")}</div>` : `<div class="empty">Hier ist noch nichts probiert.</div>`}
    <div class="actions" style="margin-top:18px">
      <button class="btn primary" id="bkAdd" type="button">Brot eintragen</button>
      <button class="btn" id="bkEdit" type="button">Bearbeiten</button>
    </div>`);
  S.sheetBk = id; sheet.scrollTop = scrollY;
  body.querySelectorAll(".bread").forEach(el => (el.onclick = () => { const r = S.breads.find(x => x.id === el.dataset.id); if (r) breadForm(r); }));
  $("#bkAdd").onclick = () => breadForm(null, { bakery_id: id });
  $("#bkEdit").onclick = () => bakeryForm(b);
}

function openOsm(o) {
  const osm = `https://www.openstreetmap.org/${o.id}`;
  openSheet(`${head("Aus OpenStreetMap", o.name)}
    <div class="bk-meta">${o.addr ? `<span>${esc(o.addr)}</span>` : ""}<a href="${osm}" target="_blank" rel="noopener">OpenStreetMap ↗</a></div>
    ${o.hours ? `<p class="hint" style="margin:-4px 0 14px">Öffnungszeiten laut OSM: ${esc(o.hours)}</p>` : ""}
    <div class="empty" style="text-align:left">Noch nicht bewertet. Wenn ihr hier etwas probiert habt, tragt es ein. Die Bäckerei landet dann als Pin auf eurer Karte.</div>
    <div class="actions" style="margin-top:18px">
      <button class="btn primary" id="osmBread" type="button">Brot hier eintragen</button>
      <button class="btn" id="osmSave" type="button">Nur merken</button>
    </div>`);
  const adopt = async () => {
    const existing = S.bakeries.find(b => b.osm_id === o.id); if (existing) return existing;
    const rec = await S.store.saveBakery({ name: o.name, address: o.addr, lat: o.lat, lng: o.lng, osm_id: o.id });
    await refresh(); return bakeryById(rec.id) || rec;
  };
  $("#osmBread").onclick = async e => { e.target.disabled = true; try { const b = await adopt(); breadForm(null, { bakery_id: b.id }); } catch (err) { e.target.disabled = false; toast(errText(err)); } };
  $("#osmSave").onclick = async e => { e.target.disabled = true; try { const b = await adopt(); toast("Bäckerei gemerkt"); openBakery(b.id); } catch (err) { e.target.disabled = false; toast(errText(err)); } };
}

/* ================= Bäckerei anlegen / bearbeiten ================= */

function bakeryForm(b, opts) {
  opts = opts || {};
  const isNew = !b;
  let pos = opts.lat != null ? { lat: opts.lat, lng: opts.lng } : (b ? { lat: b.lat, lng: b.lng } : null);
  const d = opts.draft || { name: b ? b.name : "", address: b ? b.address || "" : "" };
  const afterCreate = opts.afterCreate;
  let saved = false;
  openSheet(`${head(isNew ? "Neue Bäckerei" : "Bäckerei bearbeiten", isNew ? "Wo gab’s Brot?" : b.name)}
    <form id="bkForm" novalidate>
      <div class="field"><label for="bkName">Name</label><input type="text" id="bkName" autocomplete="off" placeholder="z. B. Bäckerei an der Limmerstraße" value="${esc(d.name)}"></div>
      <div class="field"><label for="bkSearch">Position</label>
        <input type="search" id="bkSearch" autocomplete="off" placeholder="Adresse suchen oder Google-Maps-Link einfügen" enterkeyhint="search">
        <div class="results" id="bkResults" hidden></div>
        <span class="hint" id="bkPosHint">${pos ? "Pin gesetzt." : "Noch keine Position."}</span>
        <div class="linkrow"><button type="button" class="linkbtn" id="bkMove">${pos ? "Auf der Karte verschieben" : "Auf der Karte tippen"}</button><button type="button" class="linkbtn" id="bkHere">Mein Standort</button></div>
      </div>
      <div class="field"><label for="bkAddr">Adresse <span class="opt">(optional)</span></label><input type="text" id="bkAddr" autocomplete="off" placeholder="z. B. Limmerstraße 12" value="${esc(d.address)}"></div>
      <p class="err" id="bkErr" hidden></p>
      <div class="actions">
        <button class="btn primary" type="submit" id="bkSave">${isNew ? "Bäckerei speichern" : "Speichern"}</button>
        <button class="btn" type="button" id="bkCancel">Abbrechen</button>
        <span class="spacer"></span>
        ${isNew ? "" : `<button class="btn danger" type="button" id="bkDel">Löschen</button>`}
      </div>
    </form>`, () => { clearTempPin(); if (!saved && afterCreate) afterCreate(null); });

  const addr = $("#bkAddr"), hint = $("#bkPosHint");
  const setPos = (p, label) => {
    pos = p; setTempPin(p.lat, p.lng); hint.textContent = label || "Pin gesetzt.";
    map.setView([p.lat, p.lng], Math.max(map.getZoom(), 16));
  };
  if (pos && opts.lat != null && isNew && !d.address) reverse(pos.lat, pos.lng).then(a => { if (a && !addr.value) addr.value = a; });

  // Suche
  const search = $("#bkSearch"), results = $("#bkResults");
  let sT = null;
  const runSearch = async () => {
    const q = search.value.trim(); if (!q) { results.hidden = true; return; }
    const c = parseCoords(q);
    if (c) { results.hidden = true; setPos(c, "Position aus dem Link übernommen."); if (!addr.value) reverse(c.lat, c.lng).then(a => { if (a && !addr.value) addr.value = a; }); return; }
    if (q.length < 3) return;
    try {
      const rs = await geocode(q);
      results.innerHTML = rs.length ? rs.map((r, i) => `<button type="button" data-i="${i}">${esc(r.title)}<small>${esc(r.sub)}</small></button>`).join("") : `<button type="button" disabled>Nichts gefunden</button>`;
      results.hidden = false;
      results.querySelectorAll("[data-i]").forEach(el => (el.onclick = () => {
        const r = rs[+el.dataset.i]; results.hidden = true; search.value = "";
        setPos(r, "Position aus der Suche übernommen.");
        if (r.addr) addr.value = r.addr;
        const nm = $("#bkName"); if (!nm.value.trim() && r.title && !/^\d/.test(r.title) && r.title !== r.addr) nm.value = r.title;
      }));
    } catch (e) { results.innerHTML = `<button type="button" disabled>Suche gerade nicht erreichbar</button>`; results.hidden = false; }
  };
  search.addEventListener("input", () => { clearTimeout(sT); sT = setTimeout(runSearch, 700); });
  search.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(sT); runSearch(); } });

  const draft = () => ({ name: $("#bkName").value, address: addr.value });
  $("#bkMove").onclick = () => {
    if (b) startPlacing({ mode: "move", bakeryId: b.id, draft: draft(), returnTo: () => bakeryForm(b) });
    else startPlacing({ mode: "new", draft: draft(), afterCreate, returnTo: () => (afterCreate ? afterCreate(null) : null) });
  };
  $("#bkHere").onclick = () => locate(p => { setPos(p, "Pin auf deinen Standort gesetzt."); if (!addr.value) reverse(p.lat, p.lng).then(a => { if (a && !addr.value) addr.value = a; }); });
  $("#bkCancel").onclick = closeSheet;
  if (isNew && !pos) setTimeout(() => $("#bkName").focus(), 60);
  if (b) confirmButton($("#bkDel"), breadsOf(b.id).length ? `Wirklich löschen? Die ${breadsOf(b.id).length} Brote bleiben erhalten.` : "Wirklich löschen?", async () => {
    await S.store.deleteBakery(b.id); saved = true; closeSheet(); toast("Bäckerei gelöscht"); refresh();
  });

  $("#bkForm").onsubmit = async e => {
    e.preventDefault();
    const err = $("#bkErr"); const fail = m => { err.textContent = m; err.hidden = false; };
    const name = $("#bkName").value.trim();
    if (!name) return fail("Gib der Bäckerei einen Namen.");
    if (!pos) return fail("Such die Adresse, tippe auf die Karte oder nimm deinen Standort.");
    const row = { name, address: addr.value.trim() || null, lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6) };
    $("#bkSave").disabled = true;
    try {
      const rec = await S.store.saveBakery(row, b ? b.id : null);
      saved = true; clearTempPin(); onSheetClose = null; closeSheet();
      toast(isNew ? "Bäckerei gespeichert" : "Gespeichert");
      await refresh();
      if (afterCreate) afterCreate(rec.id); else setTimeout(() => openBakery(rec.id), 280);
    } catch (e2) { $("#bkSave").disabled = false; fail(errText(e2)); }
  };
}

/* ================= Bewertung eingeben ================= */

function rateHTML(kind, v) {
  const label = kind === "pur" ? "Pur" : "Getoastet";
  let ctl = "";
  if (S.scale === "5") {
    for (let i = 1; i <= 5; i++) {
      const fill = v == null ? 0 : Math.max(0, Math.min(1, v / 2 - (i - 1)));
      ctl += `<button type="button" data-star="${i}" aria-label="${i} Sterne"><span>★</span><span class="f" style="width:${fill * 100}%">★</span></button>`;
    }
    ctl = `<div class="five">${ctl}</div><span class="hint">Nochmal auf denselben Stern tippen = halber Stern.</span>`;
  } else {
    for (let i = 1; i <= 10; i++) ctl += `<button type="button" data-n="${i}" class="${v != null && i <= v ? "on" : ""}" aria-label="${i} von 10">${i}</button>`;
    ctl = `<div class="ten">${ctl}</div>`;
  }
  const val = v == null ? `<span class="val none">nicht probiert</span>` : `<span class="val">${scoreText(v)} ${S.scale === "5" ? "/ 5" : "/ 10"}</span>`;
  return `<div class="rate-top"><span class="lab">${label}</span>${val}</div>${ctl}${v == null ? "" : `<button type="button" class="clear">Nicht probiert</button>`}`;
}
function mountRate(el, kind, get, set) {
  const draw = () => {
    el.innerHTML = rateHTML(kind, get());
    el.querySelectorAll("[data-n]").forEach(b => (b.onclick = () => { set(+b.dataset.n); draw(); }));
    el.querySelectorAll("[data-star]").forEach(b => (b.onclick = () => { const i = +b.dataset.star; set(get() === 2 * i ? 2 * i - 1 : 2 * i); draw(); }));
    const c = el.querySelector(".clear"); if (c) c.onclick = () => { set(null); draw(); };
  };
  draw();
}

/* ================= Brot eintragen / bearbeiten ================= */

function breadForm(r, preset, draft) {
  const isNew = !r;
  const d = draft || (r ? { ...r, priceText: r.price != null ? String(r.price).replace(".", ",") : "" }
                        : { name: "", bakery_id: "", place: "", priceText: "", eaten_on: today(), plain: null, toasted: null, note: "", ...(preset || {}) });
  let mode = d.mode || (d.bakery_id ? "bk" : (isNew && S.bakeries.length && !d.place ? "bk" : "away"));
  const opts = [...S.bakeries].sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map(b => `<option value="${esc(b.id)}" ${b.id === d.bakery_id ? "selected" : ""}>${esc(b.name)}${b.address ? " – " + esc(b.address) : ""}</option>`).join("");
  const gone = d.bakery_id && !bakeryById(d.bakery_id) ? `<option value="${esc(d.bakery_id)}" selected>${esc(d.bakery_name || "Gelöschte Bäckerei")}</option>` : "";
  openSheet(`${head(isNew ? "Brot eintragen" : "Brot bearbeiten", isNew ? "Was gab’s?" : r.name)}
    <form id="brForm" novalidate>
      <div class="field"><label for="brName">Brot</label><input type="text" id="brName" autocomplete="off" placeholder="z. B. Dinkel-Vollkorn, Roggen-Sauerteig" value="${esc(d.name)}"></div>
      <div class="field"><span class="lab">Wo gekauft</span>
        <div class="seg" role="group" aria-label="Wo gekauft"><button type="button" id="mBk" aria-pressed="${mode === "bk"}">Bäckerei auf der Karte</button><button type="button" id="mAway" aria-pressed="${mode === "away"}">Unterwegs</button></div>
      </div>
      <div class="field" id="fBk" ${mode === "bk" ? "" : "hidden"}>
        <select id="brBk" aria-label="Bäckerei"><option value="">${S.bakeries.length ? "Bäckerei wählen …" : "Noch keine Bäckerei angelegt"}</option>${opts}${gone}</select>
        <button type="button" class="linkbtn" id="brNewBk">+ Neue Bäckerei anlegen</button>
      </div>
      <div class="field" id="fAway" ${mode === "away" ? "" : "hidden"}>
        <input type="text" id="brPlace" autocomplete="off" placeholder="z. B. Markthalle Hamburg, Bahnhof Celle" value="${esc(d.place || "")}" aria-label="Ort">
        <span class="hint">Für alles außerhalb eurer Karte: Urlaub, Bahnhof, Wochenmarkt.</span>
      </div>
      <div class="row2">
        <div class="field"><label for="brPrice">Preis in €</label><input type="text" id="brPrice" inputmode="decimal" autocomplete="off" placeholder="3,20" value="${esc(d.priceText || "")}"></div>
        <div class="field"><label for="brDate">Datum</label><input type="date" id="brDate" value="${esc(d.eaten_on || today())}"></div>
      </div>
      <div class="rate pur" id="rPur"></div>
      <div class="rate toast" id="rToast"></div>
      <div class="field"><label for="brNote">Notiz <span class="opt">(optional)</span></label><textarea id="brNote" placeholder="Kruste, Krume, Säure, wie lange frisch …">${esc(d.note || "")}</textarea></div>
      <p class="err" id="brErr" hidden></p>
      <div class="actions">
        <button class="btn primary" type="submit" id="brSave">${isNew ? "Eintragen" : "Speichern"}</button>
        <button class="btn" type="button" id="brCancel">Abbrechen</button>
        <span class="spacer"></span>
        ${isNew ? "" : `<button class="btn danger" type="button" id="brDel">Löschen</button>`}
      </div>
    </form>`);
  const setMode = m => { mode = m; $("#mBk").setAttribute("aria-pressed", m === "bk"); $("#mAway").setAttribute("aria-pressed", m === "away"); $("#fBk").hidden = m !== "bk"; $("#fAway").hidden = m !== "away"; };
  $("#mBk").onclick = () => setMode("bk");
  $("#mAway").onclick = () => setMode("away");
  S.rerate = () => { mountRate($("#rPur"), "pur", () => d.plain, v => (d.plain = v)); mountRate($("#rToast"), "toast", () => d.toasted, v => (d.toasted = v)); };
  S.rerate();
  const collect = () => { d.name = $("#brName").value; d.place = $("#brPlace").value; d.bakery_id = $("#brBk").value; d.priceText = $("#brPrice").value; d.eaten_on = $("#brDate").value; d.note = $("#brNote").value; d.mode = mode; };
  $("#brNewBk").onclick = () => {
    collect();
    const back = id => { if (id) { d.bakery_id = id; d.mode = "bk"; } setTimeout(() => breadForm(r, null, d), 280); };
    bakeryForm(null, { afterCreate: back });
  };
  $("#brCancel").onclick = closeSheet;
  if (isNew && !preset && !draft) setTimeout(() => $("#brName").focus(), 60);
  if (r) confirmButton($("#brDel"), "Wirklich löschen?", async () => { await S.store.deleteBread(r.id); closeSheet(); toast("Brot gelöscht"); refresh(); });

  $("#brForm").onsubmit = async e => {
    e.preventDefault(); collect();
    const err = $("#brErr"); const fail = m => { err.textContent = m; err.hidden = false; };
    const name = d.name.trim();
    if (!name) return fail("Wie heißt das Brot?");
    if (mode === "bk" && !d.bakery_id) return fail("Wähle eine Bäckerei oder stelle auf „Unterwegs“ um.");
    const price = parsePrice(d.priceText);
    if (Number.isNaN(price)) return fail("Den Preis bitte als Zahl, z. B. 3,20.");
    const bk = mode === "bk" ? bakeryById(d.bakery_id) : null;
    const row = {
      name, bakery_id: mode === "bk" ? d.bakery_id : null,
      bakery_name: mode === "bk" ? (bk ? bk.name : d.bakery_name || null) : null,
      place: mode === "away" ? (d.place.trim() || null) : null,
      price, eaten_on: d.eaten_on || today(), plain: d.plain ?? null, toasted: d.toasted ?? null, note: d.note.trim() || null
    };
    $("#brSave").disabled = true;
    try {
      await S.store.saveBread(row, r ? r.id : null);
      closeSheet(); toast(isNew ? "Brot eingetragen" : "Gespeichert"); refresh();
    } catch (e2) { $("#brSave").disabled = false; fail(errText(e2)); }
  };
}

/* ================= Übersicht ================= */

function breadRow(r) {
  const meta = [];
  if (!r.bakery_id) meta.push(`<span class="away">unterwegs</span>`);
  meta.push(`<span>${esc(placeOf(r))}</span>`);
  if (r.price != null) meta.push(`<span class="num">· ${money.format(r.price)}</span>`);
  if (r.eaten_on) meta.push(`<span>· ${fmtDate(r.eaten_on)}</span>`);
  const w = whoName(r.created_by); if (w) meta.push(`<span>· ${esc(w)}</span>`);
  return `<button type="button" class="bread" data-id="${esc(r.id)}">
    <h3>${esc(r.name)}</h3>
    <div class="meta">${meta.join(" ")}</div>
    <div class="scores">${scoreRow(r.plain, "pur")}${scoreRow(r.toasted, "toast")}</div>
    ${r.note ? `<div class="note">${esc(r.note)}</div>` : ""}
  </button>`;
}

function renderList() {
  if (S.view !== "list") return;
  const all = S.breads;
  let rs = all.slice();
  if (S.filter === "bk") rs = rs.filter(r => r.bakery_id);
  if (S.filter === "away") rs = rs.filter(r => !r.bakery_id);
  if (S.filter === "me") rs = rs.filter(r => r.created_by === S.store.uid);
  if (S.filter === "both") rs = rs.filter(r => r.plain != null && r.toasted != null);
  const q = S.query.trim().toLowerCase();
  if (q) rs = rs.filter(r => (r.name + " " + placeOf(r) + " " + (r.note || "")).toLowerCase().includes(q));
  const n = v => (typeof v === "number" ? v : -1);
  const sorters = {
    new: (a, b) => (b.eaten_on || "").localeCompare(a.eaten_on || "") || (b.created_at || "").localeCompare(a.created_at || ""),
    pur: (a, b) => n(b.plain) - n(a.plain),
    toast: (a, b) => n(b.toasted) - n(a.toasted),
    diff: (a, b) => ((b.toasted ?? -99) - (b.plain ?? 99)) - ((a.toasted ?? -99) - (a.plain ?? 99)),
    price: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9)
  };
  rs.sort(sorters[S.sort]);
  const ap = avg(all.map(r => r.plain)), at = avg(all.map(r => r.toasted)), apr = avg(all.map(r => r.price));
  const bks = S.bakeries.map(b => ({ b, st: bakeryStats(b.id) })).filter(x => x.st.n > 0).sort((x, y) => (y.st.all ?? -1) - (x.st.all ?? -1));
  const chip = (grp, val, label) => `<button type="button" class="chip" data-${grp}="${val}" aria-pressed="${S[grp] === val}">${label}</button>`;
  const hasOthers = S.store.kind === "cloud";
  const inner = $("#listInner");
  const searchHadFocus = document.activeElement && document.activeElement.id === "q";
  inner.innerHTML = `
    <div><p class="eyebrow">Übersicht</p><h2 class="sec">Alle Brote</h2></div>
    ${S.store.kind === "local" ? `<div class="notice">Testmodus: Die Einträge liegen nur in diesem Browser. Für die gemeinsame Karte Supabase in den Einstellungen verbinden.</div>` : ""}
    <div class="stats">
      <div class="stat"><b>${all.length}</b><span>Brote probiert</span></div>
      <div class="stat"><b class="pur">${scoreText(ap)}${ap == null ? "" : `<small>${maxLabel()}</small>`}</b><span>Ø pur</span></div>
      <div class="stat"><b class="toast">${scoreText(at)}${at == null ? "" : `<small>${maxLabel()}</small>`}</b><span>Ø getoastet</span></div>
      <div class="stat"><b>${apr == null ? "–" : money.format(apr)}</b><span>Ø Preis</span></div>
    </div>
    <div class="controls">
      <input type="search" class="search" id="q" placeholder="Suchen: Brot, Bäckerei, Ort, Notiz" value="${esc(S.query)}" autocomplete="off">
      <div class="chips" role="group" aria-label="Sortieren">${chip("sort", "new", "Neueste")}${chip("sort", "pur", "Beste pur")}${chip("sort", "toast", "Beste getoastet")}${chip("sort", "diff", "Toast lohnt sich")}${chip("sort", "price", "Günstigste")}</div>
      <div class="chips" role="group" aria-label="Filtern">${chip("filter", "all", "Alle")}${chip("filter", "bk", "Hannover-Bäckereien")}${chip("filter", "away", "Unterwegs")}${chip("filter", "both", "Beides probiert")}${hasOthers ? chip("filter", "me", "Meine") : ""}</div>
    </div>
    ${rs.length ? `<div class="breads">${rs.map(breadRow).join("")}</div>` :
      (all.length ? `<div class="empty">Nichts gefunden.</div>` : `<div class="empty"><b>Noch kein Brot eingetragen</b>Tippe unten auf das Plus: Name, Ort, Preis und zwei Noten, einmal pur und einmal getoastet.</div>`)}
    ${bks.length ? `<div><p class="eyebrow">Rangliste</p><h2 class="sec">Bäckereien</h2></div>
      <div class="ranking">${bks.map((x, i) => `<button type="button" class="rank" data-bk="${esc(x.b.id)}"><span class="pos">${i + 1}</span><span class="nm"><b>${esc(x.b.name)}</b><span>${x.st.n === 1 ? "1 Brot" : x.st.n + " Brote"}${x.b.address ? " · " + esc(x.b.address) : ""}</span></span><span class="sc">${scoreRow(x.st.p, "pur")}${scoreRow(x.st.t, "toast")}</span></button>`).join("")}</div>` : ""}`;
  const qi = $("#q");
  qi.oninput = () => { S.query = qi.value; const pos = qi.selectionStart; renderList(); const n2 = $("#q"); n2.focus(); try { n2.setSelectionRange(pos, pos); } catch (e) {} };
  if (searchHadFocus) qi.focus();
  inner.querySelectorAll("[data-sort]").forEach(b => (b.onclick = () => { S.sort = b.dataset.sort; renderList(); }));
  inner.querySelectorAll("[data-filter]").forEach(b => (b.onclick = () => { S.filter = b.dataset.filter; renderList(); }));
  inner.querySelectorAll(".bread").forEach(el => (el.onclick = () => { const r = S.breads.find(x => x.id === el.dataset.id); if (r) breadForm(r); }));
  inner.querySelectorAll("[data-bk]").forEach(el => (el.onclick = () => {
    const b = bakeryById(el.dataset.bk); if (!b) return;
    showView("map"); map.setView([b.lat, b.lng], Math.max(map.getZoom(), 15)); setTimeout(() => openBakery(b.id), 200);
  }));
}

/* ================= Einstellungen ================= */

function openSettings() {
  const cloud = S.store.kind === "cloud";
  const me = cloud ? (S.profiles[S.store.uid] || {}).name || "" : "";
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openSheet(`${head("Einstellungen", "Brotkarte")}
    <div class="settings">
      ${cloud ? `<section><p class="eyebrow">Dein Name</p>
        <form id="nameForm" novalidate><div class="field"><input type="text" id="myName" value="${esc(me)}" maxlength="40" autocomplete="nickname" aria-label="Dein Name"></div>
        <div class="actions"><button class="btn" type="submit">Namen speichern</button></div></form></section>` :
        `<section><p class="eyebrow">Testmodus</p><p>Einträge liegen nur in diesem Browser. Verbinde Supabase, damit ihr zu zweit auf dieselbe Karte schreibt. Die Testeinträge bleiben dabei hier liegen und werden nicht übertragen.</p>
        <div class="actions"><button class="btn primary" type="button" id="goSetup">Supabase verbinden</button></div></section>`}
      <section><p class="eyebrow">Aufs Handy holen</p>
        <p>${isIOS ? "In Safari unten auf Teilen tippen, dann „Zum Home-Bildschirm“." : "Im Browser-Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen."} Die Brotkarte startet dann wie eine App und zeigt die letzten Daten auch ohne Netz.</p>
        <div class="actions" id="installRow" hidden><button class="btn" type="button" id="installBtn">Jetzt installieren</button></div></section>
      <section><p class="eyebrow">Daten</p>
        <p>${S.breads.length} Brote, ${S.bakeries.length} Bäckereien.</p>
        <div class="actions"><button class="btn" type="button" id="csvBtn">Als Tabelle (CSV) sichern</button><button class="btn" type="button" id="osmReload">Bäckereien aus OSM neu laden</button></div></section>
      ${cloud ? `<section><p class="eyebrow">Konto</p><div class="actions"><button class="btn" type="button" id="logout">Abmelden</button></div></section>` : ""}
    </div>`);
  if (cloud) $("#nameForm").onsubmit = async e => {
    e.preventDefault(); const n = $("#myName").value.trim(); if (!n) return;
    try { await S.store.setName(n); await refresh(); toast("Name gespeichert"); } catch (err) { toast(errText(err)); }
  };
  if (!cloud) $("#goSetup").onclick = () => { closeSheet(); showGate("setup"); };
  if (deferredInstall) { $("#installRow").hidden = false; $("#installBtn").onclick = async () => { deferredInstall.prompt(); deferredInstall = null; $("#installRow").hidden = true; }; }
  $("#csvBtn").onclick = exportCsv;
  $("#osmReload").onclick = () => { loadOsm(true); toast("Lade Bäckereien aus OpenStreetMap …"); };
  if (cloud) $("#logout").onclick = async () => { await S.store.signOut(); closeSheet(); showGate("login"); };
}
$("#settingsBtn").onclick = openSettings;

function exportCsv() {
  const cols = ["Datum", "Brot", "Bäckerei / Ort", "Adresse", "Unterwegs", "Preis", "Pur (1-10)", "Getoastet (1-10)", "Notiz", "Von"];
  const q = v => { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lines = [cols.join(";")];
  [...S.breads].sort((a, b) => (a.eaten_on || "").localeCompare(b.eaten_on || "")).forEach(r => {
    const b = r.bakery_id ? bakeryById(r.bakery_id) : null;
    lines.push([r.eaten_on, r.name, placeOf(r), b ? b.address : "", r.bakery_id ? "" : "ja", r.price != null ? String(r.price).replace(".", ",") : "", r.plain, r.toasted, r.note, whoName(r.created_by)].map(q).join(";"));
  });
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `brotkarte-${today()}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

let deferredInstall = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; });

/* ================= Ansichten ================= */

function showView(v) {
  S.view = v;
  $("#mapview").hidden = v !== "map"; $("#list").hidden = v !== "list";
  $("#tabMap").setAttribute("aria-selected", v === "map"); $("#tabList").setAttribute("aria-selected", v === "list");
  if (v === "map") setTimeout(() => map.invalidateSize(), 0); else renderList();
}
$("#tabMap").onclick = () => showView("map");
$("#tabList").onclick = () => showView("list");
$("#addBread").onclick = () => { if (S.placing) { stopPlacing(); clearTempPin(); } breadForm(null); };
$("#addBakery").onclick = () => bakeryForm(null);

function setScale(s) {
  S.scale = s; ls.set("brot.scale", s);
  $("#sc10").setAttribute("aria-pressed", s === "10"); $("#sc5").setAttribute("aria-pressed", s === "5");
  renderAll();
  if (sheet.classList.contains("open")) { if (S.rerate) S.rerate(); else if (S.sheetBk) openBakery(S.sheetBk); }
}
$("#sc10").onclick = () => setScale("10");
$("#sc5").onclick = () => setScale("5");

function renderAll() {
  renderPins(); renderList();
  const n = S.breads.length, b = S.bakeries.length;
  $("#sub").textContent = `${b} ${b === 1 ? "Bäckerei" : "Bäckereien"} · ${n} ${n === 1 ? "Brot" : "Brote"}`;
  if (S.sheetBk && sheet.classList.contains("open") && bakeryById(S.sheetBk)) openBakery(S.sheetBk);
}

/* ================= Laden & Synchronisieren ================= */

const CACHE_KEY = "brot.cache.v1";
async function refresh() {
  try {
    const data = await S.store.load();
    normalize(data); S.loaded = true; $("#offline").hidden = true;
    if (S.store.kind === "cloud") ls.put(CACHE_KEY, { uid: S.store.uid, data });
  } catch (e) {
    $("#offline").hidden = false;
    if (!S.loaded) { const c = ls.json(CACHE_KEY); if (c && c.uid === S.store.uid) { normalize(c.data); S.loaded = true; } }
    if (!navigator.onLine) toast("Offline: du siehst den letzten Stand.");
    else if (e && /JWT|token/i.test(e.message || "")) { showGate("login"); return; }
  }
  renderAll();
}

function showApp() {
  $("#gate").hidden = true;
  ["#top", "#main", "#tabs"].forEach(s => ($(s).hidden = false));
  setTimeout(() => map.invalidateSize(), 0);
}
function hideApp() { ["#top", "#main", "#tabs"].forEach(s => ($(s).hidden = true)); closeSheet(); }

const LOAF = `<svg class="loaf" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M10 34c0-11 10-19 22-19s22 8 22 19c0 2.6-1.6 4.4-3.5 5.2V49a3 3 0 0 1-3 3h-31a3 3 0 0 1-3-3v-9.8C11.6 38.4 10 36.6 10 34z" fill="#c49a4f"/><path d="M24 24l-3 6M33 22l-2 7M42 24l-1 6" stroke="#86461f" stroke-width="3" stroke-linecap="round"/></svg>`;

function showGate(kind) {
  hideApp();
  const g = $("#gate"), c = $("#gateCard"); g.hidden = false;
  if (kind === "setup") {
    c.innerHTML = `${LOAF}<div><h1>Brotkarte Hannover</h1><p class="lead">Damit ihr beide auf dieselbe Karte schreibt, braucht die App eine kostenlose Supabase-Datenbank. Die Schritte stehen in der README im Repository.</p></div>
      <form id="setupForm" novalidate>
        <div class="field"><label for="sbUrl">Project URL</label><input type="url" id="sbUrl" placeholder="https://abcd1234.supabase.co" autocomplete="off" spellcheck="false"></div>
        <div class="field"><label for="sbKey">anon public key</label><input type="text" id="sbKey" placeholder="eyJhbGciOi…" autocomplete="off" spellcheck="false"></div>
        <p class="err" id="setupErr" hidden></p>
        <button class="btn primary block" type="submit">Verbinden</button>
        <p class="hint">Wird nur in diesem Browser gespeichert. Damit das andere Handy die Daten nicht eintippen muss, tragt sie in <code>public/brot/config.js</code> ein.</p>
      </form>
      <div class="or">oder</div>
      <button class="btn block" type="button" id="tryLocal">Erst mal nur auf diesem Gerät testen</button>`;
    $("#setupForm").onsubmit = e => {
      e.preventDefault();
      const url = $("#sbUrl").value.trim().replace(/\/+$/, ""), key = $("#sbKey").value.trim();
      const err = $("#setupErr");
      if (!/^https:\/\/[^/]+$/.test(url)) { err.textContent = "Die URL sieht so aus: https://abcd1234.supabase.co"; err.hidden = false; return; }
      if (key.length < 30) { err.textContent = "Der Schlüssel ist zu kurz. Kopiere den ganzen anon-public-Key."; err.hidden = false; return; }
      ls.put("brot.cfg", { supabaseUrl: url, supabaseAnonKey: key }); ls.del("brot.mode");
      start();
    };
    $("#tryLocal").onclick = () => { ls.set("brot.mode", "local"); start(); };
  } else if (kind === "login") {
    c.innerHTML = `${LOAF}<div><h1>Brotkarte Hannover</h1><p class="lead">Melde dich an. Ihr seht beide dieselbe Karte und alle Brote.</p></div>
      <form id="loginForm" novalidate>
        <div class="field"><label for="em">E-Mail</label><input type="email" id="em" autocomplete="username" inputmode="email"></div>
        <div class="field"><label for="pw">Passwort</label><input type="password" id="pw" autocomplete="current-password"></div>
        <p class="err" id="loginErr" hidden></p>
        <button class="btn primary block" type="submit" id="loginBtn">Anmelden</button>
      </form>
      ${configFromFile() ? "" : `<button class="linkbtn" type="button" id="resetCfg">Andere Supabase-Datenbank verbinden</button>`}`;
    $("#loginForm").onsubmit = async e => {
      e.preventDefault();
      const err = $("#loginErr"); err.hidden = true; $("#loginBtn").disabled = true;
      try { await S.store.signIn($("#em").value.trim(), $("#pw").value); await afterLogin(); }
      catch (ex) {
        $("#loginBtn").disabled = false;
        err.textContent = /invalid/i.test(ex.message || "") ? "E-Mail oder Passwort stimmt nicht." : (!navigator.onLine ? "Keine Internetverbindung." : "Anmeldung fehlgeschlagen: " + (ex.message || "unbekannter Fehler"));
        err.hidden = false;
      }
    };
    const rc = $("#resetCfg"); if (rc) rc.onclick = () => { ls.del("brot.cfg"); showGate("setup"); };
    setTimeout(() => $("#em").focus(), 50);
  } else if (kind === "name") {
    c.innerHTML = `${LOAF}<div><h1>Wie heißt du?</h1><p class="lead">Steht bei deinen Einträgen, damit ihr seht, wer was probiert hat.</p></div>
      <form id="nmForm" novalidate>
        <div class="field"><label for="nm">Name</label><input type="text" id="nm" maxlength="40" autocomplete="given-name"></div>
        <p class="err" id="nmErr" hidden></p>
        <button class="btn primary block" type="submit">Weiter</button>
      </form>`;
    $("#nmForm").onsubmit = async e => {
      e.preventDefault(); const n = $("#nm").value.trim(); const err = $("#nmErr");
      if (!n) { err.textContent = "Ein Vorname reicht."; err.hidden = false; return; }
      try { await S.store.setName(n); await enterApp(); } catch (ex) { err.textContent = errText(ex); err.hidden = false; }
    };
    setTimeout(() => $("#nm").focus(), 50);
  }
}

function configFromFile() { const c = window.BROT_CONFIG || {}; return c.supabaseUrl && c.supabaseAnonKey ? c : null; }

let subscribed = false;
async function enterApp() {
  showApp();
  await refresh();
  if (!subscribed) { subscribed = true; S.store.subscribe(refresh); }
  if (S.showOsm) loadOsm();
}
async function afterLogin() {
  await refresh().catch(() => {});
  if (S.store.kind === "cloud" && !(S.profiles[S.store.uid] && S.profiles[S.store.uid].name) && navigator.onLine) { showGate("name"); return; }
  await enterApp();
}

async function start() {
  const cfg = configFromFile() || ls.json("brot.cfg");
  if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey && ls.get("brot.mode") !== "local") {
    try { S.store = new CloudStore(cfg.supabaseUrl, cfg.supabaseAnonKey); }
    catch (e) { ls.del("brot.cfg"); showGate("setup"); return; }
    let session = null;
    try { session = await S.store.session(); } catch (e) {}
    if (!session) { showGate("login"); return; }
    await afterLogin();
  } else if (ls.get("brot.mode") === "local") {
    S.store = new LocalStore(); await enterApp();
  } else {
    S.store = new LocalStore(); showGate("setup");
  }
}

addEventListener("online", () => { if (S.store && S.loaded) refresh(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.store && S.loaded) refresh(); });
setScale(S.scale);
start();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
})();

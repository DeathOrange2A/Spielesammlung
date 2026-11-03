// Brotkarte – Service Worker: App-Hülle offline, Kartenkacheln und Schriften zwischenspeichern.
// Datenbank-Anfragen (Supabase) gehen immer direkt ans Netz.
const VERSION = "brot-v1";
const SHELL = [
  "./", "index.html", "app.css", "app.js", "config.js", "manifest.webmanifest",
  "vendor/leaflet-1.9.4.js", "vendor/leaflet-1.9.4.css", "vendor/supabase-2.117.3.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png"
];
const TILE_CACHE = "brot-tiles", FONT_CACHE = "brot-fonts", TILE_MAX = 600;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("brot-v") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName); const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Kartenkacheln: erst Cache, sonst Netz
  if (url.hostname.endsWith("basemaps.cartocdn.com")) {
    e.respondWith(caches.open(TILE_CACHE).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { c.put(req, res.clone()); trim(TILE_CACHE, TILE_MAX); }
      return res;
    }));
    return;
  }
  // Schriften
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // App-Hülle: Netz zuerst (damit Updates sofort ankommen), offline aus dem Cache
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match("index.html"))));
  }
});

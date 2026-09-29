/* Simulacro · service worker
   IMPORTANTE: incrementa CACHE en cada publicación para que los equipos descarguen la versión nueva. */
const CACHE = "simulacro-v2";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/config.js", "js/docx.js", "js/store.js", "js/app.js",
  "lib/jszip.min.js", "lib/chart.umd.min.js",
  "plantillas/circular.docx", "plantillas/acta.docx",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith("simulacro-")).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                        // las llamadas a Supabase (POST) van siempre a la red
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return;

  // Tipografías de Google: se guardan la primera vez que se descargan
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE + "-fuentes").then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }
      catch (err) { return new Response("", { status: 504 }); }
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Archivos de la app: primero la copia guardada, así funciona sin red
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => req.mode === "navigate" ? caches.match("index.html") : new Response("", { status: 504 }))));
});

/* Service worker dell'app Circuiti: la rende installabile e usabile anche con poco segnale.
   - pagina, codice e dati pubblicati: prima la rete (così gli aggiornamenti arrivano subito), se manca la rete l'ultima copia salvata
   - foto dei muri: subito dalla copia salvata, aggiornata in sottofondo
   - modello di riconoscimento e librerie: scaricati una volta sola */
const CACHE = 'circuiti-v5';
const CORE = ['./', './index.html', './app.js', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(req){
  const c = await caches.open(CACHE);
  try{
    const r = await fetch(req);
    if(r && r.ok) c.put(req, r.clone());
    return r;
  }catch(e){
    const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate' });
    if(hit) return hit;
    if(req.mode === 'navigate'){ const home = await c.match('./index.html'); if(home) return home; }
    throw e;
  }
}
async function cacheFirst(req){
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if(hit) return hit;
  const r = await fetch(req);
  if(r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
  return r;
}
async function staleWhileRevalidate(req){
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  const net = fetch(req).then(r => { if(r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const u = new URL(req.url);
  if(u.origin === self.location.origin){
    if(u.pathname.includes('/models/')) return e.respondWith(cacheFirst(req));
    if(u.pathname.includes('/img/')) return e.respondWith(staleWhileRevalidate(req));
    return e.respondWith(networkFirst(req));
  }
  if(u.hostname.endsWith('.supabase.co')){
    if(u.pathname.startsWith('/rest/v1/app_state')) return e.respondWith(networkFirst(req));
    if(u.pathname.startsWith('/storage/v1/object/public/')) return e.respondWith(cacheFirst(req));
    return; /* accesso, login, caricamenti: sempre dalla rete */
  }
  if(u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') return e.respondWith(cacheFirst(req));
});

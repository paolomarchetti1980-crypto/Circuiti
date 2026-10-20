/* Service worker dell'app Circuiti: la rende installabile e usabile anche con poco segnale.
   - pagina, codice e dati pubblicati: prima la rete (così gli aggiornamenti arrivano subito), se manca la rete l'ultima copia salvata
   - foto dei muri: subito dalla copia salvata, aggiornata in sottofondo
   - modello di riconoscimento e librerie: scaricati una volta sola */
const CACHE = 'circuiti-v114';
/* modello di riconoscimento e librerie (decine di MB): in una cache a parte che NON si svuota a ogni aggiornamento dell'app */
const MODELS = 'circuiti-modelli';
const CORE = ['./', './index.html', './app.js?v=114', './namegen.js', './config.js', './manifest.webmanifest', './icon-192-g3.png', './icon-512-g3.png', './icon-maskable-512-g3.png', './apple-touch-icon-g3.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== MODELS).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(req, fresh){
  const c = await caches.open(CACHE);
  try{
    /* fresh: chiede sempre al server se il file è cambiato, così pagina e codice arrivano della stessa versione */
    const r = await fetch(fresh ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : req);
    if(r && r.ok) c.put(req, r.clone());
    return r;
  }catch(e){
    const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate' });
    if(hit) return hit;
    if(req.mode === 'navigate'){ const home = await c.match('./index.html'); if(home) return home; }
    throw e;
  }
}
async function cacheFirst(req, name){
  const c = await caches.open(name || CACHE);
  const hit = await c.match(req);
  if(hit && hit.type !== 'opaque') return hit;
  const r = await fetch(req);
  /* solo copie "aperte": quelle opache non si possono leggere dal riconoscimento delle prese */
  if(r && r.ok && r.type !== 'opaque') c.put(req, r.clone());
  return r;
}
async function staleWhileRevalidate(req){
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  const net = fetch(req).then(r => { if(r && r.ok && r.type !== 'opaque') c.put(req, r.clone()); return r; }).catch(() => null);
  return (hit && hit.type !== 'opaque' ? hit : null) || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const u = new URL(req.url);
  if(u.origin === self.location.origin){
    if(u.pathname.includes('/models/')) return e.respondWith(cacheFirst(req, MODELS));
    if(u.pathname.includes('/img/')) return e.respondWith(staleWhileRevalidate(req));
    return e.respondWith(networkFirst(req, true));
  }
  if(u.hostname.endsWith('.supabase.co')){
    if(u.pathname.startsWith('/rest/v1/app_state')) return e.respondWith(networkFirst(req));
    if(u.pathname.startsWith('/storage/v1/object/public/')) return e.respondWith(cacheFirst(req));
    return; /* accesso, login, caricamenti: sempre dalla rete */
  }
  if(u.hostname === 'cdn.jsdelivr.net') return e.respondWith(cacheFirst(req, MODELS));
  if(u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') return e.respondWith(cacheFirst(req));
});

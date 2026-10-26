
(function(){
'use strict';

/* ---- struttura della pagina ---- */
const BODY = `
<div id="app">
  <nav class="secbar" id="secbar" aria-label="Sezione">
    <button data-act="sec" data-v="circ">Circuiti</button>
    <button data-act="sec" data-v="boulder">Boulder</button>
  </nav>
  <header class="top">
    <button class="backbtn" id="backBtn" data-act="bback" aria-label="Torna ai settori" hidden><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 3L5 9l6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button class="wallbtn" id="wallBtn" data-act="wall" aria-label="Scegli un muro">
      <span id="wallName">Nessun muro</span>
      <svg id="chev" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button class="btn" id="instBtn" data-act="install" hidden>Installa app</button>
    <button class="menubtn minebtn" id="mineBtn" data-act="mine" aria-label="Le mie salite" title="Le mie salite" hidden></button>
    <button class="menubtn" id="prevBtn" data-act="preview" hidden></button>
    <button class="menubtn" id="menuBtn" data-act="menu" aria-label="Altro: stampa, condividi, installa">&#8942;</button>
  </header>
  <div class="viewbar" id="viewbar" hidden></div>
  <div class="pubbar" id="pubbar" hidden>
    <span>Modifiche non pubblicate</span>
    <button class="btn primary" id="pubBtn" data-act="publish">Pubblica</button>
  </div>
  <div class="stagewrap">
    <div id="box">
      <div id="empty" class="empty" hidden></div>
      <div id="stage" hidden>
        <img id="photo" alt="Foto del muro" draggable="false" crossorigin="anonymous">
        <svg id="ov" xmlns="http://www.w3.org/2000/svg" aria-label="Circuiti tracciati sul muro"></svg>
      </div>
    </div>
    <div class="zoom" id="zoom" hidden>
      <button data-act="zoom" data-d="1" aria-label="Ingrandisci">+</button>
      <button data-act="zoom" data-d="-1" aria-label="Riduci">&minus;</button>
    </div>
  </div>
  <div class="fcard" id="fcard" hidden></div>
  <footer class="dock">
    <div class="chips" id="chips"></div>
    <div class="tools" id="tools"></div>
  </footer>
</div>
<div class="sheet" id="sheet" hidden><div class="card" id="card"></div></div>
<div class="toast" id="toast" hidden></div>
<div id="print" aria-hidden="true"></div>
<div class="busy" id="busy" hidden role="status" aria-live="polite"><i class="spin" aria-hidden="true"></i><span></span></div>
`;
document.getElementById('root').innerHTML = BODY;

const $ = s => document.querySelector(s);
const PALETTE = [['Giallo','#f2c200'],['Arancio','#ff7a1a'],['Rosso','#e5312b'],['Rosa','#ff5fa2'],['Viola','#8a4dff'],
                 ['Blu','#1e6bff'],['Azzurro','#22c3e6'],['Verde','#23b45a'],['Bianco','#ffffff'],['Nero','#111111']];
const GRADES = ['','3','4','5a','5b','5c','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c'];
const STYLES = ['','Equilibrio','Dinamico','Forza','Tecnico','Resistenza','Coordinazione','Tacche','Svasi','Volumi'];
const ANGLES = Array.from({length:41}, (_,i) => i);
/* boulder: difficoltà a colori della palestra, dalla più facile alla più difficile */
const DIFFS = [['bianco','Bianco','#ffffff'],['blu','Blu','#1e6bff'],['verde','Verde','#23b45a'],['giallo','Giallo','#f2c200'],['rosso','Rosso','#e5312b'],['nero','Nero','#111111']];
const NODIFF = '#8d939b';
/* circuiti: il colore non ha significato, serve solo a staccare un circuito dal vicino.
   Lo assegna l'app seguendo l'ordine dell'elenco (filtri compresi), così due vicini non sono mai uguali. */
/* circuiti: piedi obbligati, contorno tratteggiato giallo e bollino con l'impronta. Non sono movimenti: niente numero, niente linea */
const FOOT_COL = '#ffd400';
const isFoot = h => h && h.role === 'foot';
const CPAL = ['#ff7a1a','#1e6bff','#23b45a','#ff5fa2','#22c3e6','#8a4dff','#e5312b'];
function colOf(c){
  const w = curWall();
  if(!w || isSec(w) || !w.circuits.includes(c)) return c.color;
  let i = sortedVisible(w).indexOf(c);
  if(i < 0) i = w.circuits.slice().sort(circCmp).indexOf(c);
  return CPAL[i % CPAL.length];
}
const diffOf = c => DIFFS.find(d => d[0] === (c && c.diff)) || null;
const diffIdx = c => { const i = DIFFS.findIndex(d => d[0] === (c && c.diff)); return i < 0 ? 99 : i; };
const bTitle = c => { const d = diffOf(c); return d ? d[1] + ' ' + (c.num || 1) : 'Nuovo boulder'; };
const bTitleHtml = c => esc(bTitle(c)) + (c.name && diffOf(c) ? ` <span style="font-weight:600;color:var(--muted)">· ${esc(c.name)}</span>` : '') + (bLabel(c) ? ` <span class="newb ${bLabel(c) === 'Recente' ? 'rec' : ''}">${bLabel(c)}</span>` : '');
/* età dei boulder, a settimane: 1ª settimana "Nuovo", 2ª "Recente" (per i clienti), dalla 9ª "Scaduto" (solo per lo staff).
   I settori si rinnovano interi a rotazione, quindi l'etichetta va sul settore; un singolo boulder ce l'ha
   solo se è stato aggiunto dopo il rinnovo del suo settore (le eccezioni). */
const daysOld = d => { if(!d || d > todayISO()) return null; const t = Date.parse(d + 'T00:00:00'); return isNaN(t) ? null : Math.floor((Date.now() - t) / 864e5); };
const AGE_NEW = 7, AGE_RECENT = 14, AGE_EXPIRED = 56;
const ageLabel = d => { const a = daysOld(d); return a === null ? '' : a < AGE_NEW ? 'Nuovo' : a < AGE_RECENT ? 'Recente' : a >= AGE_EXPIRED ? 'Scaduto' : ''; };
/* data di rinnovo del settore: il boulder in parete più vecchio */
const secRenew = w => (w.circuits || []).filter(c => c.diff && c.dateSet && !isOff(c)).map(c => c.dateSet).sort()[0] || '';
const secLabel = w => { if(!isSec(w)) return ''; const l = ageLabel(secRenew(w)); return l === 'Scaduto' ? (EDIT ? l : '') : (EDIT ? '' : l); };
const wallOfC = c => S.walls.find(w => (w.circuits || []).includes(c));
const bLabel = c => { if(EDIT || !c || !c.diff || isOff(c)) return ''; const l = ageLabel(c.dateSet); if(l !== 'Nuovo' && l !== 'Recente') return ''; const w = wallOfC(c); return w && c.dateSet > secRenew(w) ? l : ''; };
const isNewB = c => !!bLabel(c);
/* circuiti: si cambiano uno alla volta, quindi l'etichetta va sul singolo circuito (solo per i clienti) */
const cLabel = c => { if(EDIT || !c) return ''; const l = ageLabel(c.dateSet); return l === 'Nuovo' || l === 'Recente' ? l : ''; };
const cTitleHtml = c => esc(c.name) + (cLabel(c) ? ` <span class="newb ${cLabel(c) === 'Recente' ? 'rec' : ''}">${cLabel(c)}</span>` : '');
/* numero: il più piccolo libero tra i boulder in parete della stessa difficoltà nel settore */
function assignNum(w, c){
  if(!diffOf(c)) { delete c.num; return; }
  const used = new Set(w.circuits.filter(x => x !== c && x.diff === c.diff && !isOff(x)).map(x => x.num));
  let n = 1; while(used.has(n)) n++;
  c.num = n;
}
/* boulder: move, stile e particolarità (si possono scegliere più voci) */
const BTAGS = ['Placca','Verticale','Strapiombo','Tetto','Spigolo','Diedro','Partenza seduta','Traverso','Dinamico','Lancio','Equilibrio','Compressione','Opposizione','Tallone','Punta','Incastro','Ribaltamento','Tacche','Svasi','Pinze','Buchi','Volumi','Uscita alta','Morfologico'];

/* lo stato arriva dal database (vedi avvio in fondo); qui si parte vuoti */
const S = {
  walls: [],
  active: null,
  rev: 0,
  mode: 'view',
  prefs: Object.assign({ numbers:false, lines:false, others:true, dim:true, handL:'#e5312b', handR:'#111111', r:0.03 })
};
let PUBREV = S.rev;
let PUBWALLS = [];
/* preferenze di visualizzazione (numeri, linee, altri blocchi, oscura): sono di chi guarda, restano sul suo telefono
   e non vengono pubblicate. I numeri partono accesi. */
const VIEW_KEYS = ['numbers', 'lines', 'others', 'othersV', 'dim'];   /* others = staff mentre traccia, othersV = chi guarda */
function applyViewPrefs(){
  let v = {};
  try{ v = JSON.parse(localStorage.getItem('view-prefs') || '{}') || {}; }catch(e){}
  Object.assign(S.prefs, { numbers: true, lines: false, others: true, othersV: false, dim: true }, v);
}
function saveViewPrefs(){ const v = {}; VIEW_KEYS.forEach(k => v[k] = !!S.prefs[k]); try{ localStorage.setItem('view-prefs', JSON.stringify(v)); }catch(e){} }   /* muri come sono pubblicati adesso */
let EDIT = false, SB = null, BASE = null, ME = null;
/* REAL_EDIT: l'account è dello staff. EDIT: in questo momento si modifica (falso se il gestore guarda "come cliente").
   ui.viewAs permette allo staff di vedere l'app come la vede un ruolo con meno permessi. */
let REAL_EDIT = false;
/* nuova parte clienti: finché NEWC_LIVE è false la vede solo lo staff, da menu ⋮ → Anteprima parte clienti */
const NEWC_LIVE = true;
/* account cliente e "Le mie salite": finché ACCT_LIVE è false li vede solo lo staff, da menu ⋮ → Anteprima con Le mie salite
   (prima bisogna collegare a Supabase un servizio per l'invio delle email) */
const ACCT_LIVE = false;
/* link dell'email già usato o scaduto: Supabase torna con #error=…; si spiega in italiano e si pulisce l'indirizzo */
(() => { try{ const h = location.hash;
  if(/[#&]error=/.test(h)){ history.replaceState(null, '', location.pathname + location.search);
    const expired = /otp_expired|expired|invalid/i.test(decodeURIComponent(h));
    setTimeout(() => toast(expired ? 'Questo link è già stato usato o è scaduto. Se hai già confermato l\'account, entra con email e password dal menu ⋮.' : 'Il link dell\'email non ha funzionato: riprova dal menu ⋮.', 8000), 1500); }
}catch(e){} })();
/* link segreto per provare gli account da cliente su un solo telefono: #prova-account-<codice> li accende, #prova-account-off li spegne */
(() => { try{ const h = location.hash;
  if(h === '#prova-account-6bfacd47'){ localStorage.setItem('mr-acct-test', '1'); history.replaceState(null, '', location.pathname + location.search); setTimeout(() => toast('Prova account cliente attiva su questo telefono.', 4000), 1500); }
  else if(h === '#prova-account-off'){ localStorage.removeItem('mr-acct-test'); history.replaceState(null, '', location.pathname + location.search); }
}catch(e){} })();
const acctTest = (() => { try{ return localStorage.getItem('mr-acct-test') === '1'; }catch(e){ return false; } })();
const acctOn = () => ACCT_LIVE || acctTest || (REAL_EDIT && !!ui.prevNew);
let CL = null;   /* account cliente: { id, email } */
const newC = () => !EDIT && (NEWC_LIVE || !!ui.prevNew);
/* chi salva le salite: il cliente, oppure lo staff mentre prova l'anteprima */
const ACC = () => CL || (REAL_EDIT && ME && ME.uid ? { id: ME.uid, email: ME.email } : null);
const isMgr = () => !ME || (ME.role === 'gestore' && ui.viewAs !== 'tracciatore' && ui.viewAs !== 'cliente');
const ui = { bline:false, lineDraft:[], view:null, pinchAt:0, trash:[], tool:'detect', draft:[], redraw:null, csel:null, busy:false, sel:null, move:false, nextRole:'start', zoom:1, sheet:null, confirm:null, imgUrl:null, ready:false, publishing:false, saveWarned:false, scan:null, nextHand:'L', crop:null };
/* filtri dei circuiti: gli stessi per tutti i muri e per la ricerca in palestra */
ui.sq = { ang: '', min: '', max: '', sty: '', feet: '' };
try{ const f = JSON.parse(localStorage.getItem('circ-filters2') || '{}'); for(const k in ui.sq) if(typeof f[k] === 'string') ui.sq[k] = f[k]; }catch(e){}
ui.section = 'circ'; ui.home = true; ui.secOver = true; ui.bLevel = 'sectors'; ui.bShow = 'on'; ui.bColor = []; ui.lastSec = {};
try{ const f = JSON.parse(localStorage.getItem('boulder-ui') || '{}'); if(f.sec === 'boulder') ui.section = 'boulder'; ui.bShow = f.show || 'on'; ui.bColor = Array.isArray(f.c) ? f.c : f.c ? [f.c] : []; ui.lastSec = f.last || {}; }catch(e){}
/* filtro colori dei boulder: più colori insieme (es. dai gialli in su) */
ui.bColor = (Array.isArray(ui.bColor) ? ui.bColor : []).filter(v => DIFFS.some(d => d[0] === v));
/* dopo Pubblica o il login la pagina si ricarica: si torna dove si era invece che alla schermata iniziale */
try{ const r = JSON.parse(sessionStorage.getItem('mr-resume') || 'null'); sessionStorage.removeItem('mr-resume');
  if(r && Date.now() - r.t < 120000){ ui.home = false; ui.section = r.sec === 'boulder' ? 'boulder' : 'circ'; ui.bLevel = r.lvl === 'sector' ? 'sector' : 'sectors';
    try{ history.pushState({ grid: 1 }, ''); if(ui.bLevel === 'sector') history.pushState({ sec: 1 }, ''); }catch(e){} } }catch(e){}
function rememberPlace(){ try{ if(!ui.home) sessionStorage.setItem('mr-resume', JSON.stringify({ sec: ui.section, lvl: ui.bLevel, t: Date.now() })); }catch(e){} }
function saveBUI(){ try{ localStorage.setItem('boulder-ui', JSON.stringify({ sec: ui.section, show: ui.bShow, c: ui.bColor, last: ui.lastSec })); }catch(e){} }
function saveCF(){ try{ localStorage.setItem('circ-filters2', JSON.stringify(ui.sq)); }catch(e){} }
const cMatch = c => { const q = ui.sq; return (q.ang === '' || String(c.angle) === q.ang) && (!q.sty || c.style === q.sty) && (!q.feet || c.feet === q.feet) &&
  (!q.min || (gradeIdx(c.grade) < 999 && gradeIdx(c.grade) >= gradeIdx(q.min))) && (!q.max || gradeIdx(c.grade) <= gradeIdx(q.max)); };
const sqCount = () => { const q = ui.sq; return (q.ang !== '' ? 1 : 0) + (q.min || q.max ? 1 : 0) + (q.sty ? 1 : 0) + (q.feet ? 1 : 0); };
/* dopo un cambio di filtro: se il blocco attivo non è più in elenco, si passa al primo visibile */
function afterFilter(){
  const w = curWall(); if(!w) return;
  const vis = sortedVisible(w);
  if(vis.length && !vis.some(x => x.id === w.activeCircuit)){ w.activeCircuit = vis[0].id; ui.sel = null; ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit()); }
  render(); if(ui.sheet === 'clist') renderSheet();
}

const uid = () => Math.random().toString(36).slice(2,9);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lum = h => { const n = parseInt(h.slice(1),16); return (0.2126*(n>>16&255)+0.7152*(n>>8&255)+0.0722*(n&255))/255; };
const haloOf = c => lum(c) < 0.3 ? '#ffffff' : '#000000';
const inkOn = c => lum(c) > 0.6 ? '#111111' : '#ffffff';
/* due sezioni: "circ" (muri con circuiti) e "boulder" (settori con linee boulder); i settori sono muri con kind:'sector' */
const isSec = w => !!w && w.kind === 'sector';
const secOf = w => isSec(w) ? 'boulder' : 'circ';
/* un muro dei circuiti con le prese ancora da preparare lo vede solo il gestore (né tracciatori né clienti) */
const wallShown = w => !w.archived && (secOf(w) === 'boulder' || !!w.locked || (EDIT && isMgr()));
const secWalls = () => S.walls.filter(w => secOf(w) === ui.section && wallShown(w));
/* muri e settori archiviati: spariti per i clienti, il gestore li ripristina o li elimina da "Archiviati" */
const archWalls = () => S.walls.filter(w => secOf(w) === ui.section && w.archived);
const curWall = () => { const l = secWalls(); return l.find(w => w.id === S.active) || l[0] || null; };
const BO = () => ui.section === 'boulder';
/* boulder, per chi guarda: tre livelli. 1) griglia dei settori, 2) settore con tutte le linee, 3) blocco a schermo intero */
const bView = () => BO() && (!EDIT || S.mode === 'view');
const bLv = () => !ui.home && !ui.full && !(EDIT && S.mode === 'wall' && ui.bLevel === 'sector');
/* si passa sempre dalla griglia, anche con un solo muro o settore */
const bGrid = () => bLv() && ui.bLevel === 'sectors' && secWalls().length > 0;
/* foto d'insieme con tutte le linee: il cliente la vede sempre, lo staff appena entra nel settore (poi tocca un boulder per tracciarlo) */
/* circuiti visti dal cliente: foto piccola in alto, lo spazio va alla scelta del circuito */
/* il rilevamento automatico gira anche mentre si guarda altro: blocca solo il muro su cui sta lavorando */
const scanHere = () => !!(ui.scan && curWall() && ui.scan.wid === curWall().id);
const cCompact = () => !BO() && !ui.home && !ui.full && !bGrid() && (!EDIT || S.mode === 'view') && !!curWall();
const bOver = () => BO() && !ui.home && !ui.full && !bGrid() && (bView() || (EDIT && ui.secOver && !scanHere()));
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const isOff = c => !!(c && c.dateRemoved && c.dateRemoved <= todayISO());
const fmtDate = d => { if(!d) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d); return m ? (+m[3]) + '/' + (+m[2]) + '/' + m[1].slice(2) : d; };
const curCircuit = () => { const w = curWall(); return w ? (w.circuits.find(c => c.id === w.activeCircuit) || w.circuits[0] || null) : null; };
const dirty = () => EDIT && S.rev > PUBREV;

/* se il catalogo pubblicato è più recente di quello della bozza, lo adotta tenendo i contorni disegnati a mano che non lo duplicano */
function upgradeCatalog(w, sw){
  if(!sw || !sw.holds) return;
  if(!w.holds || !w.holds.length){ w.holds = sw.holds; w.catalogV = sw.catalogV; return; }
  if((sw.catalogV || 0) <= (w.catalogV || 0)) return;
  const keep = w.holds.filter(h => h.det !== 1 && !sw.holds.some(a => inPoly(a.poly, h.x, h.y) || inPoly(h.poly, a.x, a.y)));
  w.holds = sw.holds.concat(keep); w.catalogV = sw.catalogV;
  if(keep.length) S.rev = Math.max(Date.now(), S.rev + 1);
}
function snapshot(){ return { walls:S.walls, active:S.active, prefs:S.prefs, rev:S.rev }; }
/* ---------- bozza locale (solo per chi può modificare) ---------- */
function openDB(){
  return new Promise((res,rej) => {
    try{
      const r = indexedDB.open('circuiti-muro',1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }catch(e){ rej(e); }
  });
}
/* ultima versione pubblicata salvata sul telefono: l'app si apre subito (anche senza rete) e poi si aggiorna */
async function loadPub(){
  try{
    const db = await openDB();
    return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get('pub'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  }catch(e){ return null; }
}
async function savePub(data, rev){
  try{
    const db = await openDB();
    await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ data, rev, at: Date.now() }, 'pub'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }catch(e){}
}
/* foto dei muri salvate sul telefono: si tengono solo quelle ancora usate (una foto sostituita non serve più) */
async function prunePhotos(walls){
  try{
    if(!window.caches) return;
    const used = new Set(walls.map(w => w.img).filter(Boolean).map(u => { try{ return new URL(u, location.href).href; }catch(e){ return u; } }));
    const c = await caches.open('circuiti-dati');
    for(const req of await c.keys()) if(req.url.includes('/storage/v1/object/public/') && !used.has(req.url)) await c.delete(req);
  }catch(e){}
}
async function loadDraft(){
  try{
    const db = await openDB();
    const d = await new Promise((res,rej) => {
      const q = db.transaction('kv').objectStore('kv').get('draft');
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
    if(d && Array.isArray(d.walls) && (d.rev || 0) > S.rev){
      S.walls = d.walls; S.active = d.active; S.rev = d.rev;
      S.prefs = Object.assign(S.prefs, d.prefs || {}); applyViewPrefs();
      if(Array.isArray(d.base)) BASE = d.base;
    }
  }catch(e){}
  /* il catalogo pubblicato più di recente vince sempre, anche se la bozza locale è più "nuova" di orario */
  S.walls.forEach(w => upgradeCatalog(w, PUBWALLS.find(x => x.id === w.id)));
  /* muri già pubblicati che la bozza locale non conosce ancora (es. aggiunti da un'altra sessione) */
  PUBWALLS.forEach(sw => { if(!S.walls.some(w => w.id === sw.id)) S.walls.push(sw); });
}
async function saveNow(){
  if(!EDIT) return;
  try{
    const db = await openDB();
    await new Promise((res,rej) => {
      const tx = db.transaction('kv','readwrite');
      tx.objectStore('kv').put(Object.assign(snapshot(), { base: BASE }), 'draft');
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }catch(e){
    if(!ui.saveWarned){ ui.saveWarned = true; toast('Bozza locale non disponibile: pubblica per non perdere le modifiche.'); }
  }
}
let saveTimer;
function save(){ if(!EDIT) return; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
function touch(){ S.rev = Math.max(Date.now(), S.rev + 1); save(); try{ renderPub(); }catch(e){} }

/* ---------- installazione come app ---------- */
let installEvt = null;
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canInstall = () => !isStandalone() && (!!installEvt || isIOS());
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; try{ renderTop(); }catch(err){} });
window.addEventListener('appinstalled', () => { installEvt = null; try{ renderTop(); toast('App installata: la trovi sulla schermata Home.'); }catch(err){} });
async function doInstall(){
  if(installEvt){
    installEvt.prompt();
    try{ await installEvt.userChoice; }catch(e){}
    installEvt = null; renderTop(); return;
  }
  openSheet('install');
}
if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
/* ---------- segnale "sto lavorando" ---------- */
const busyStack = [];
/* schermo acceso durante il rilevamento: con lo schermo spento il telefono sospende l'app */
let wakeLock = null;
async function scanWake(on){
  try{
    if(on && !wakeLock && navigator.wakeLock && document.visibilityState === 'visible'){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if(!on && wakeLock){ const l = wakeLock; wakeLock = null; await l.release(); }
  }catch(e){ wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if(ui.scan && document.visibilityState === 'visible') scanWake(true); });
/* toccando l'avviso del rilevamento si torna al muro su cui sta lavorando */
document.addEventListener('click', e => {
  if(!e.target.closest || !e.target.closest('#busy.go') || !ui.scan) return;
  const sw = S.walls.find(x => x.id === ui.scan.wid); if(!sw) return;
  ui.section = secOf(sw) === 'boulder' ? 'boulder' : 'circ'; ui.home = false; ui.full = false; ui.sheet = null; renderSheet();
  S.active = sw.id; ui.bLevel = 'sector'; if(EDIT && isMgr()) S.mode = 'wall'; ui.zoom = 1; saveBUI();
  try{ history.pushState({ sec: 1 }, ''); }catch(err){} render();
});
function scanEnd(){ ui.scan = null; scanWake(false); }
function renderBusy(){
  const el = document.getElementById('busy'); if(!el) return;
  const top = busyStack[busyStack.length - 1];
  const sw = ui.scan && !scanHere() ? S.walls.find(x => x.id === ui.scan.wid) : null;
  const label = top ? top.label : (ui.scan ? (ui.scan.prep ? 'Preparo il riconoscimento…' : `Rilevamento automatico${sw ? ' · ' + sw.name : ''}: ${Math.round(100 * ui.scan.i / Math.max(1, ui.scan.total))}%`) : '');
  el.classList.toggle('go', !top && !!sw);
  el.hidden = !label;
  if(label) el.querySelector('span').textContent = label;
}
function busy(label){
  const t = { label }; busyStack.push(t); renderBusy();
  return () => { const i = busyStack.indexOf(t); if(i >= 0) busyStack.splice(i, 1); renderBusy(); };
}
/* lascia al telefono il tempo di disegnare il segnale prima di un calcolo pesante */
const nextPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
let toastTimer;
function toast(msg, ms, undo){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  /* avviso con Annulla: per rimediare a un tocco sbagliato senza chiedere conferme */
  if(undo){ const b = document.createElement('button'); b.className = 'undo'; b.textContent = 'Annulla';
    b.addEventListener('click', e => { e.stopPropagation(); t.hidden = true; clearTimeout(toastTimer); undo(); }); t.append(' ', b); }
  /* a schermo intero la scheda in basso è piena di tasti: l'avviso va in alto */
  t.classList.toggle('top', !!ui.full);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms || 4500);
}

/* ---------- foto ---------- */
function readPhoto(file){
  return new Promise((res,rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const im = new Image();
      im.onerror = rej;
      im.onload = () => {
        const k = Math.min(1, 2000 / Math.max(im.width, im.height));
        const w = Math.round(im.width*k), h = Math.round(im.height*k);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        res({ w, h, img: c.toDataURL('image/jpeg', 0.86) });
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
const loadImg1 = src => new Promise((res,rej) => { const i = new Image(); if(!/^data:/.test(src)) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
/* se una copia salvata male blocca la lettura dei pixel, riprova scavalcandola */
const loadImg = src => loadImg1(src).catch(e => /^data:/.test(src) ? Promise.reject(e) : loadImg1(src + (src.includes('?') ? '&' : '?') + 'px=1'));
function newCircuit(w){
  if(isSec(w)){
    /* il nome dato dal gestore nella lista Staff vale per tutti i telefoni; poi l'ultimo scritto a mano su questo telefono */
    let setter = (ME && ME.name) || ''; if(!setter){ try{ setter = localStorage.getItem('boulder-setter') || ''; }catch(e){} }
    if(!setter && ME && ME.email) setter = ME.email.split('@')[0];
    return { id: uid(), name: '', color: NODIFF, holds: [], dateSet: todayISO(), ...(setter ? { setter } : {}) };
  }
  const used = w.circuits.map(c => c.color);
  const p = PALETTE.find(p => !used.includes(p[1])) || PALETTE[0];
  let n = w.circuits.length + 1; while(w.circuits.some(c => c.name === 'Circuito ' + n)) n++;
  const name = window.genCircuitName ? window.genCircuitName('', w.circuits.map(c => c.name)) : 'Circuito ' + n;
  return { id: uid(), name, color: p[1], holds: [], dateSet: todayISO() };
}
function roleFor(c){ return c && c.holds.length ? 'hold' : 'start'; }
/* mano della prossima presa: l'opposta dell'ultima segnata (si parte con la sinistra) */
function handFor(c){ const hs = c ? c.holds.filter(h => h.hand) : [], l = hs.length ? hs[hs.length-1].hand : null; return l === 'L' ? 'R' : 'L'; }

/* SEG-START */
function enhanceLocal(px, W, H, R, gain){
  const out = new Uint8ClampedArray(px.length);
  const stride = W + 1;
  for(let c=0;c<3;c++){
    const I = new Float64Array((W+1)*(H+1));
    for(let y=0;y<H;y++){ let row = 0; for(let x=0;x<W;x++){ row += px[(y*W+x)*4+c]; I[(y+1)*stride + x+1] = I[y*stride + x+1] + row; } }
    for(let y=0;y<H;y++){
      const y0 = Math.max(0,y-R), y1 = Math.min(H,y+R+1);
      for(let x=0;x<W;x++){
        const x0 = Math.max(0,x-R), x1 = Math.min(W,x+R+1);
        const sum = I[y1*stride+x1] - I[y0*stride+x1] - I[y1*stride+x0] + I[y0*stride+x0];
        const mean = sum / ((x1-x0)*(y1-y0));
        const v = px[(y*W+x)*4+c];
        out[(y*W+x)*4+c] = 128 + gain*(v - mean);
      }
    }
  }
  for(let i=3;i<px.length;i+=4) out[i] = 255;
  return out;
}
function makeSeg(px0, W, H, opt){
  const px = px0;
  opt = opt || {};
  const N = W*H;
    const TOL = opt.tol || 28;
  const STEP = opt.step || 12;
  const lin = new Float32Array(256);
  for(let i=0;i<256;i++){ const c=i/255; lin[i] = c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
  const fx = t => t > 0.008856 ? Math.cbrt(t) : 7.787*t + 16/116;
  const lab = [0,0,0];
  function labAt(i){
    const r = lin[cpx[i*4]|0], g = lin[cpx[i*4+1]|0], b = lin[cpx[i*4+2]|0];
    const fX = fx((0.4124*r + 0.3576*g + 0.1805*b)/0.95047);
    const fY = fx(0.2126*r + 0.7152*g + 0.0722*b);
    const fZ = fx((0.0193*r + 0.1192*g + 0.9505*b)/1.08883);
    lab[0] = 116*fY - 16; lab[1] = 500*(fX - fY); lab[2] = 200*(fY - fZ);
  }
  const E = px0;
  const cpx = px0;
  let PE = null;
  /* mappa dei bordi: gradiente di Sobel, massimo sui tre canali */
  const edge = new Uint8Array(N);
  for(let y=1;y<H-1;y++){
    for(let x=1;x<W-1;x++){
      const i = y*W + x; let m = 0;
      for(let c=0;c<3;c++){
        const a = E[(i-W-1)*4+c], b = E[(i-W)*4+c], d = E[(i-W+1)*4+c];
        const e = E[(i-1)*4+c],                       f = E[(i+1)*4+c];
        const g = E[(i+W-1)*4+c], h = E[(i+W)*4+c], k = E[(i+W+1)*4+c];
        const gx = (d + 2*f + k) - (a + 2*e + g);
        const gy = (g + 2*h + k) - (a + 2*b + d);
        const v = (Math.abs(gx) + Math.abs(gy))/4;
        if(v > m) m = v;
      }
      edge[i] = m > 255 ? 255 : m;
    }
  }
  /* colore dominante = pannello */
  const bins = new Int32Array(4096);
  for(let i=0;i<N;i+=5){ bins[(px[i*4]>>4)*256 + (px[i*4+1]>>4)*16 + (px[i*4+2]>>4)]++; }
  let bb = 0; for(let i=1;i<4096;i++) if(bins[i] > bins[bb]) bb = i;
  let pr = 0, pg = 0, pbb = 0, pc = 0;
  for(let i=0;i<N;i+=5){ if(((px[i*4]>>4)*256 + (px[i*4+1]>>4)*16 + (px[i*4+2]>>4)) === bb){ pr += px[i*4]; pg += px[i*4+1]; pbb += px[i*4+2]; pc++; } }
  const PANEL = (function(){ const save = [px[0],px[1],px[2]]; return { r:pr/pc, g:pg/pc, b:pbb/pc }; })();
  function labOfRGB(r,g,b){
    const R = lin[Math.round(r)], G = lin[Math.round(g)], B = lin[Math.round(b)];
    const fX = fx((0.4124*R + 0.3576*G + 0.1805*B)/0.95047), fY = fx(0.2126*R + 0.7152*G + 0.0722*B), fZ = fx((0.0193*R + 0.1192*G + 0.9505*B)/1.08883);
    return [116*fY-16, 500*(fX-fY), 200*(fY-fZ)];
  }
  const PLAB = labOfRGB(PANEL.r, PANEL.g, PANEL.b);
  const vis = new Int32Array(N); let stamp = 0;
  const queue = new Int32Array(Math.floor(N*0.03) + 16);

  function grow(si, sL, sA, sB, tol, step, T){
    stamp++;
    let head = 0, tail = 0;
    queue[tail++] = si; vis[si] = stamp;
    const cap = queue.length - 8;
    let minx = W, maxx = 0, miny = H, maxy = 0;
    while(head < tail){
      const i = queue[head++];
      const x = i % W, y = (i - x)/W;
      if(x < minx) minx = x; if(x > maxx) maxx = x; if(y < miny) miny = y; if(y > maxy) maxy = y;
      labAt(i); const pL = lab[0], pA = lab[1], pB = lab[2];
      for(let d=0; d<4; d++){
        let nx = x, ny = y;
        if(d === 0) nx = x+1; else if(d === 1) nx = x-1; else if(d === 2) ny = y+1; else ny = y-1;
        if(nx < 1 || ny < 1 || nx >= W-1 || ny >= H-1) continue;
        const n = ny*W + nx;
        if(vis[n] === stamp || edge[n] > T) continue;
        labAt(n);
        const dl = lab[0]-sL, da = lab[1]-sA, db = lab[2]-sB;
        if(dl*dl + da*da + db*db > tol*tol) continue;
        const el = lab[0]-pL, ea = lab[1]-pA, eb = lab[2]-pB;
        if(el*el + ea*ea + eb*eb > step*step) continue;
        vis[n] = stamp;
        queue[tail++] = n;
        if(tail >= cap) return null;
      }
    }
    return { count: tail, minx, maxx, miny, maxy };
  }
  function dilate(m, w, h, r){
    const t = new Uint8Array(w*h), o = new Uint8Array(w*h);
    for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ let v = 0; for(let k=-r;k<=r && !v;k++){ const xx = x+k; if(xx >= 0 && xx < w && m[y*w+xx]) v = 1; } t[y*w+x] = v; } }
    for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ let v = 0; for(let k=-r;k<=r && !v;k++){ const yy = y+k; if(yy >= 0 && yy < h && t[yy*w+x]) v = 1; } o[y*w+x] = v; } }
    return o;
  }
  function erode(m, w, h, r){
    const inv = new Uint8Array(w*h); for(let i=0;i<w*h;i++) inv[i] = m[i] ? 0 : 1;
    const d = dilate(inv, w, h, r); const o = new Uint8Array(w*h); for(let i=0;i<w*h;i++) o[i] = d[i] ? 0 : 1;
    return o;
  }
  const DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  function trace(m, w, h, sx, sy){
    const pts = [];
    let x = sx, y = sy, bx = sx-1, by = sy;
    const ix = sx, iy = sy, ibx = bx, iby = by;
    let guard = 0, moved = false;
    pts.push([x,y]);
    while(guard++ < 200000){
      let idx = 0;
      for(let k=0;k<8;k++){ if(DIRS[k][0] === bx-x && DIRS[k][1] === by-y){ idx = k; break; } }
      let found = false;
      for(let k=1;k<=8;k++){
        const d = (idx+k) % 8, nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if(nx >= 0 && ny >= 0 && nx < w && ny < h && m[ny*w+nx]){
          const pd = (d+7) % 8;
          bx = x + DIRS[pd][0]; by = y + DIRS[pd][1];
          x = nx; y = ny; found = true; break;
        }
      }
      if(!found) break;
      if(x === ix && y === iy && bx === ibx && by === iby && moved) break;
      moved = true; pts.push([x,y]);
    }
    return pts;
  }
  function rdp(p, eps){
    if(p.length < 4) return p;
    const keep = new Uint8Array(p.length); keep[0] = 1; keep[p.length-1] = 1;
    const st = [[0, p.length-1]];
    while(st.length){
      const [a, b] = st.pop();
      let md = 0, mi = -1;
      const ax = p[a][0], ay = p[a][1], bx = p[b][0], by = p[b][1];
      const dx = bx-ax, dy = by-ay, L = Math.hypot(dx,dy) || 1;
      for(let i=a+1;i<b;i++){
        const d = Math.abs(dy*(p[i][0]-ax) - dx*(p[i][1]-ay))/L;
        if(d > md){ md = d; mi = i; }
      }
      if(md > eps && mi > 0){ keep[mi] = 1; st.push([a,mi],[mi,b]); }
    }
    return p.filter((_,i) => keep[i]);
  }
  const PANEL_SAMPLES = (opt.panelSamples || []).map(s => ({ x: s.x, y: s.y, lab: labOfRGB(s.rgb[0], s.rgb[1], s.rgb[2]) }));
  function nearestPanelLab(cx, cy){
    if(!PANEL_SAMPLES.length) return null;
    let best = null, bd = Infinity;
    for(const s of PANEL_SAMPLES){ const d = (s.x-cx)*(s.x-cx) + (s.y-cy)*(s.y-cy); if(d < bd){ bd = d; best = s; } }
    return best.lab;
  }
  function localPanelLab(cx, cy){
    const bins = {};
    for(const rad of [45,60,75]) for(let a=0;a<24;a++){
      const x = Math.round(cx + rad*Math.cos(a*Math.PI/12)), y = Math.round(cy + rad*Math.sin(a*Math.PI/12));
      if(x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y*W + x)*4, k = (px[i]>>4) + ',' + (px[i+1]>>4) + ',' + (px[i+2]>>4);
      (bins[k] = bins[k] || []).push(i);
    }
    let best = null; for(const k in bins) if(!best || bins[k].length > best.length) best = bins[k];
    if(!best) return null;
    let r = 0, g = 0, b = 0; best.forEach(i => { r += px[i]; g += px[i+1]; b += px[i+2]; });
    return labOfRGB(r/best.length, g/best.length, b/best.length);
  }
  function localDist(cx, cy){
    const bins = {};
    for(const rad of [45,60,75]) for(let a=0;a<24;a++){
      const x = Math.round(cx + rad*Math.cos(a*Math.PI/12)), y = Math.round(cy + rad*Math.sin(a*Math.PI/12));
      if(x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y*W + x)*4, k = (px[i]>>4) + ',' + (px[i+1]>>4) + ',' + (px[i+2]>>4);
      (bins[k] = bins[k] || []).push(i);
    }
    let best = null; for(const k in bins) if(!best || bins[k].length > best.length) best = bins[k];
    if(!best) return 99;
    let r = 0, g = 0, b = 0; best.forEach(i => { r += px[i]; g += px[i+1]; b += px[i+2]; });
    const p = labOfRGB(r/best.length, g/best.length, b/best.length);
    labAt(cy*W + cx);
    const dLocal = Math.hypot(lab[0]-p[0], lab[1]-p[1], lab[2]-p[2]);
    const fixed = nearestPanelLab(cx, cy);
    if(!fixed) return dLocal;
    const dFixed = Math.hypot(lab[0]-fixed[0], lab[1]-fixed[1], lab[2]-fixed[2]);
    return Math.min(dLocal, dFixed); /* vicino alla stima locale O al campione di riferimento piu' vicino */
  }
  function hullArea(pts){
    const p = pts.slice().sort((a,b) => a[0]-b[0] || a[1]-b[1]);
    const cross = (o,a,b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
    const lo = []; for(const q of p){ while(lo.length >= 2 && cross(lo[lo.length-2], lo[lo.length-1], q) <= 0) lo.pop(); lo.push(q); }
    const up = []; for(let i=p.length-1;i>=0;i--){ const q = p[i]; while(up.length >= 2 && cross(up[up.length-2], up[up.length-1], q) <= 0) up.pop(); up.push(q); }
    const h = lo.slice(0,-1).concat(up.slice(0,-1)); let A = 0;
    for(let i=0;i<h.length;i++){ const a = h[i], b = h[(i+1) % h.length]; A += a[0]*b[1] - b[0]*a[1]; }
    return Math.abs(A)/2;
  }
  const TS = opt.ts || [70, 55, 42, 32, 24, 18, 14, 10];
  /* contorno polare: percorso ottimo lungo i bordi radiali attorno al tocco (per prese chiare) */
  function polarOnce(cx, cy, sc){
    const NT = 48, R0 = 7, R1 = opt.rmax || 70, NR = R1 - R0 + 1, CY = 3;
    if(!PE) PE = enhanceLocal(px0, W, H, 30, 2);
    const S = PE;
    const samp = (x, y, c) => {
      if(x < 0 || y < 0 || x >= W-1 || y >= H-1) return 0;
      const x0 = Math.floor(x), y0 = Math.floor(y), fx_ = x - x0, fy_ = y - y0, i = (y0*W + x0)*4 + c;
      return (S[i]*(1-fx_) + S[i+4]*fx_)*(1-fy_) + (S[i+W*4]*(1-fx_) + S[i+W*4+4]*fx_)*fy_;
    };
    const D = [];
    for(let t=0;t<NT;t++){
      const a = t*2*Math.PI/NT, ca = Math.cos(a), sa = Math.sin(a), row = new Float32Array(NR);
      for(let k=0;k<NR;k++){
        const r = R0 + k; let m = 0;
        for(let c=0;c<3;c++){
          const d = Math.abs(samp(cx + (r+2)*ca, cy + (r+2)*sa, c) - samp(cx + (r-2)*ca, cy + (r-2)*sa, c));
          if(d > m) m = d;
        }
        row[k] = m;
      }
      D.push(row);
    }
    const L = NT*CY, score = [], back = [];
    for(let j=0;j<L;j++){ score.push(new Float32Array(NR)); back.push(new Int16Array(NR)); }
    const LAM = opt.lam || 2.0, BON = (opt.bonus || 0.10);
    for(let k=0;k<NR;k++) score[0][k] = D[0][k] + BON*k;
    for(let j=1;j<L;j++){
      const dr = D[j % NT];
      for(let k=0;k<NR;k++){
        let best = -1e9, bk = k;
        for(let q=-2;q<=2;q++){
          const kk = k+q; if(kk < 0 || kk >= NR) continue;
          const v = score[j-1][kk] - LAM*Math.abs(q)*2;
          if(v > best){ best = v; bk = kk; }
        }
        score[j][k] = best + dr[k] + BON*k; back[j][k] = bk;
      }
    }
    let bk = 0; for(let k=1;k<NR;k++) if(score[L-1][k] > score[L-1][bk]) bk = k;
    const path = new Int16Array(L);
    for(let j=L-1;j>=0;j--){ path[j] = bk; if(j > 0) bk = back[j][bk]; }
    const mid = NT;   /* ciclo centrale */
    const rr = []; let sumD = 0, strong = 0;
    for(let t=0;t<NT;t++){ const k = path[mid + t]; rr.push(R0 + k); const v = D[t][k]; sumD += v; if(v > (opt.dmin || 10)) strong++; }
    /* mediana mobile per togliere i picchi */
    const sm = rr.map((_,t) => { const w = [-2,-1,0,1,2].map(o => rr[(t+o+NT) % NT]).sort((a,b) => a-b); return w[2]; });
    const meanD = sumD/NT, frac = strong/NT;
    const rmin = Math.min(...sm), rmax = Math.max(...sm);
    const flat = []; let A = 0, gx = 0, gy = 0;
    sm.forEach((r,t) => { const a = t*2*Math.PI/NT; flat.push(Math.round(cx + r*Math.cos(a)), Math.round(cy + r*Math.sin(a))); });
    for(let i=0;i<flat.length;i+=2){
      const x0 = flat[i], y0 = flat[i+1], x1 = flat[(i+2) % flat.length], y1 = flat[(i+3) % flat.length];
      const c = x0*y1 - x1*y0; A += c; gx += (x0+x1)*c; gy += (y0+y1)*c;
    }
    A /= 2; if(Math.abs(A) < 60) return null;
    return { poly: flat, cx: gx/(6*A), cy: gy/(6*A), area: Math.abs(A), k: 'polar', meanD, frac, rmin, rmax };
  }
  function insideMean(poly){
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for(let i=0;i<poly.length;i+=2){ if(poly[i]<x0)x0=poly[i]; if(poly[i]>x1)x1=poly[i]; if(poly[i+1]<y0)y0=poly[i+1]; if(poly[i+1]>y1)y1=poly[i+1]; }
    let r = 0, g = 0, b = 0, n = 0;
    for(let y=Math.max(0,y0); y<=Math.min(H-1,y1); y+=2) for(let x=Math.max(0,x0); x<=Math.min(W-1,x1); x+=2){
      let c = false;
      for(let i=0, j=poly.length-2; i<poly.length; j=i, i+=2){
        const xi = poly[i], yi = poly[i+1], xj = poly[j], yj = poly[j+1];
        if(((yi > y) !== (yj > y)) && (x < (xj-xi)*(y-yi)/(yj-yi) + xi)) c = !c;
      }
      if(c){ const k = (y*W + x)*4; r += px[k]; g += px[k+1]; b += px[k+2]; n++; }
    }
    return n ? labOfRGB(r/n, g/n, b/n) : null;
  }
  function polarFit(x, y, sc, strict){
    let cx = x, cy = y, res = null;
    for(let it=0; it<(opt.iters||1); it++){
      res = polarOnce(cx, cy, sc); if(!res) return null;
      cx = clampI(res.cx, 8, W-9); cy = clampI(res.cy, 8, H-9);
    }
    const med = res.poly.length ? Math.hypot(res.poly[0]-res.cx, res.poly[1]-res.cy) : 0;
    if(opt.debug) console.log('   polar rmax',res.rmax,'area',Math.round(res.area),'frac',res.frac.toFixed(2));
    if(res.rmax > (opt.rcap || 46) || res.area < 220 || res.area > 6500) return null;
    if(res.frac < (strict ? 0.78 : (opt.fracMin || 0.6))) return null;
    /* deve distinguersi nettamente dal pannello circostante, non solo per rumore/ombra */
    const m = insideMean(res.poly);
    if(!m) return null;
    labAt(Math.round(cy)*W + Math.round(cx));
    const p = localPanelLab(Math.round(x), Math.round(y));
    if(!p) return null;
    let dd = Math.hypot(m[0]-p[0], m[1]-p[1], m[2]-p[2]);
    const fixedHere = nearestPanelLab(x, y);
    if(fixedHere) dd = Math.min(dd, Math.hypot(m[0]-fixedHere[0], m[1]-fixedHere[1], m[2]-fixedHere[2]));
    res.dpanel = dd; if(opt.debug) console.log('   dpanel',dd.toFixed(1));
    if(dd < (strict ? 15 : (opt.dpan || 3))) return null;
    /* Contorno -/+: allarga o restringe il contorno attorno al baricentro */
    if(sc && Math.abs(sc - 1) > 0.01){
      const f = Math.pow(sc, 0.7);
      res.poly = res.poly.map((v,i) => Math.round(i % 2 === 0 ? res.cx + (v - res.cx)*f : res.cy + (v - res.cy)*f));
      res.area *= f*f;
    }
    return res;
  }
  const TOLS = [1, 0.5];
  function attempt(sx, sy, tolScale, strict){
    const bgLike = localDist(sx, sy) < (opt.bg || 12);
    if(bgLike){ if(strict) return null; const pr = polarFit(sx, sy, tolScale, strict); if(pr) return pr; }
    const tols = strict === 2 ? [TOLS[0]] : TOLS, tss = strict === 2 ? [TS[0]] : TS;
    search: for(const tk of tols) for(const T of tss){
      let si = sy*W + sx, ox = sx, oy = sy;
      if(edge[si] > T){
        let best = -1, bd = 1e9;
        for(let dy=-6;dy<=6;dy++) for(let dx=-6;dx<=6;dx++){
          const x = sx+dx, y = sy+dy; if(x<1||y<1||x>=W-1||y>=H-1) continue;
          const j = y*W+x; const d = dx*dx+dy*dy;
          if(edge[j] <= T && d < bd){ bd = d; best = j; }
        }
        if(best < 0) continue; si = best; ox = si % W; oy = (si - ox)/W;
      }
      let sL = 0, sA = 0, sB = 0, cnt = 0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        const j = (oy+dy)*W + (ox+dx);
        labAt(j); sL += lab[0]; sA += lab[1]; sB += lab[2]; cnt++;
      }
      sL /= cnt; sA /= cnt; sB /= cnt;
      const g = grow(si, sL, sA, sB, TOL*tolScale*tk, STEP*tolScale*Math.max(tk,0.7), T);
      if(opt.debug) console.log('   tk',tk,'T', T, 'grow', g ? g.count : 'LEAK');
      if(!g) continue;               /* troppo grande: sbordo sullo sfondo, provo bordi piu sensibili */
      if(g.count < 60) break search;  /* troppo piccola: provo il contorno polare */
      const pad = 8, bw = g.maxx - g.minx + 1 + pad*2, bh = g.maxy - g.miny + 1 + pad*2;
      let m = new Uint8Array(bw*bh);
      for(let q=0;q<g.count;q++){ const i = queue[q]; const x = i % W, y = (i - x)/W; m[(y - g.miny + pad)*bw + (x - g.minx + pad)] = 1; }
      m = dilate(m, bw, bh, 2);
      m = erode(dilate(m, bw, bh, 3), bw, bh, 3);
      let sx0 = -1, sy0 = -1;
      const seedX = ox - g.minx + pad, seedY = oy - g.miny + pad;
      if(!m[seedY*bw + seedX]) break search;
      /* componente connessa del seme */
      const comp = new Uint8Array(bw*bh), st = [seedY*bw + seedX]; comp[st[0]] = 1;
      while(st.length){
        const i = st.pop(), x = i % bw, y = (i - x)/bw;
        if(x > 0 && m[i-1] && !comp[i-1]){ comp[i-1] = 1; st.push(i-1); }
        if(x < bw-1 && m[i+1] && !comp[i+1]){ comp[i+1] = 1; st.push(i+1); }
        if(y > 0 && m[i-bw] && !comp[i-bw]){ comp[i-bw] = 1; st.push(i-bw); }
        if(y < bh-1 && m[i+bw] && !comp[i+bw]){ comp[i+bw] = 1; st.push(i+bw); }
      }
      outer: for(let y=0;y<bh;y++){ for(let x=0;x<bw;x++){ if(comp[y*bw+x]){ sx0 = x; sy0 = y; break outer; } } }
      let raw = trace(comp, bw, bh, sx0, sy0);
      let eps = 1.4, poly = rdp(raw, eps);
      while(poly.length > 90 && eps < 6){ eps += 0.6; poly = rdp(raw, eps); }
      if(poly.length < 4) continue;
      let A = 0, cx = 0, cy = 0;
      for(let i=0;i<poly.length;i++){
        const [x0,y0] = poly[i], [x1,y1] = poly[(i+1) % poly.length];
        const c = x0*y1 - x1*y0; A += c; cx += (x0+x1)*c; cy += (y0+y1)*c;
      }
      A /= 2;
      if(Math.abs(A) < 40) continue;
      const fcx = cx/(6*A) + g.minx - pad, fcy = cy/(6*A) + g.miny - pad;
      const solid = Math.abs(A) / (hullArea(poly) || 1);
      const distSeed = Math.hypot(fcx - sx, fcy - sy);
      const maxDist = Math.max(40, Math.sqrt(Math.abs(A)) * 1.5);
      if(opt.debug) console.log('   solidity', solid.toFixed(2), 'area', Math.round(Math.abs(A)), 'bgLike', bgLike, 'distSeed', distSeed.toFixed(1));
      if(bgLike ? (solid < 0.8 || Math.abs(A) > 7000) : (solid < (strict === 2 ? 0.76 : 0.66) || Math.abs(A) > 8000)) continue;
      if(distSeed > maxDist) continue;
      cx = fcx; cy = fcy;
      const flat = [];
      poly.forEach(p => { flat.push(p[0] + g.minx - pad, p[1] + g.miny - pad); });
      return { poly: flat, cx, cy, area: Math.abs(A), k: T, solid };
    }
    return bgLike && !strict ? polarFit(sx, sy, tolScale, strict) : null;
  }
  return { polar: (x, y) => polarFit(Math.round(x), Math.round(y)), segment: (x, y, scale, strict) => attempt(Math.round(clampI(x, 2, W-3)), Math.round(clampI(y, 2, H-3)), scale || 1, !!strict), edge };
  function clampI(v, a, b){ return Math.max(a, Math.min(b, v)); }
}
/* SEG-END */

async function samplePanelColor(w, x, y){
  const im = await loadImg(w.img);
  const r = 7;
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
  const g = cv.getContext('2d');
  g.drawImage(im, Math.max(0, x-r), Math.max(0, y-r), r*2, r*2, 0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

/* ---------- SAM (MobileSAM) nel browser: il telefono "studia" la foto una volta, poi ogni tocco dà il contorno quasi subito ---------- */
const SAMCFG = { ort: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/', enc: 'models/mobilesam_encoder.onnx', dec: 'models/mobilesam_decoder.onnx' };
const sam = { state: 'off', enc: null, dec: null, emb: {}, loading: null };
const samMaybe = () => sam.state !== 'failed' || (!sam.noWasm && Date.now() - (sam.failedAt || 0) > 15000);
function loadScript(src){ return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = rej; document.head.appendChild(el); }); }
async function samInit(){
  if(sam.state === 'ready') return true;
  /* se lo scaricamento è fallito (rete debole), si riprova dopo un po' invece di rinunciare per tutta la sessione */
  if(sam.state === 'failed'){ if(!sam.noWasm && Date.now() - (sam.failedAt || 0) > 15000) sam.state = 'off'; else return false; }
  if(sam.loading) return sam.loading;
  sam.loading = (async () => {
    sam.state = 'loading'; renderTools();
    const done = busy('Scarico il riconoscimento intelligente (solo la prima volta)…');
    try{
      if(!window.ort) await loadScript(SAMCFG.ort + 'ort.min.js');
      ort.env.wasm.wasmPaths = SAMCFG.ort;
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
      ort.env.wasm.proxy = true;   /* i calcoli girano in un processo separato: l'app resta toccabile mentre SAM lavora */
      const o = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
      sam.dec = await ort.InferenceSession.create(SAMCFG.dec, o);
      sam.enc = await ort.InferenceSession.create(SAMCFG.enc, o);
      sam.state = 'ready'; return true;
    }catch(e){ console.warn('SAM non disponibile', e); sam.state = 'failed'; sam.failedAt = Date.now(); sam.noWasm = typeof WebAssembly !== 'object'; sam.dec = null; sam.enc = null; return false; }
    finally{ done(); sam.loading = null; renderTools(); }
  })();
  return sam.loading;
}
function samKey(w){ return w.id + '|' + w.w + 'x' + w.h + '|' + String(w.img).length + String(w.img).slice(-32); }
async function samEmbed(w){
  const key = samKey(w), cur = sam.emb[w.id];
  if(cur && cur.key === key){ return cur.e ? cur : cur.pending; }
  const pending = (async () => {
    const done = busy('Studio la foto del muro…');
    try{
    await nextPaint();
    const im = await loadImg(w.img);
    const s = 1024 / Math.max(w.w, w.h);
    const rw = Math.max(1, Math.round(w.w*s)), rh = Math.max(1, Math.round(w.h*s));
    const cv = document.createElement('canvas'); cv.width = rw; cv.height = rh;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, rw, rh);
    const d = g.getImageData(0, 0, rw, rh).data, P = 1024*1024, t = new Float32Array(3*P);
    for(let y=0; y<rh; y++) for(let x=0; x<rw; x++){
      const i = (y*rw + x)*4, j = y*1024 + x;
      t[j] = (d[i] - 123.675)/58.395; t[P+j] = (d[i+1] - 116.28)/57.12; t[2*P+j] = (d[i+2] - 103.53)/57.375;
    }
    const out = await sam.enc.run({ image: new ort.Tensor('float32', t, [1,3,1024,1024]) });
    /* teniamo una copia: in modalità "processo separato" i dati passati al calcolo vengono ceduti e non si possono riusare */
    return { key, e: true, ed: new Float32Array(out.embeddings.data), edims: out.embeddings.dims.slice(), s, rw, rh };
    } finally { done(); }
  })();
  sam.emb[w.id] = { key, pending };
  renderTools();
  try{ const r = await pending; if(sam.emb[w.id] && sam.emb[w.id].key === key) sam.emb[w.id] = r; return r; }
  catch(e){ delete sam.emb[w.id]; throw e; }
  finally{ renderTools(); }
}
/* prepara il modello e la foto in anticipo, così il primo tocco non aspetta */
function samWarm(w){
  if(!w || !samMaybe()) return;
  samInit().then(ok => { if(ok) samEmbed(w).catch(() => {}); });
}
/* ---------- rifinitura: SAM sulla zona della presa ingrandita ----------
   La foto intera entra in SAM a 1024 px e la maschera esce a 256: su una foto grande ogni "pixel" della maschera
   copre una decina di pixel veri. Qui la foto si divide in riquadri (lato = 1/3 della foto, sovrapposti a metà),
   ognuno studiato a 1024 px quando serve, e la presa si ricalcola nel riquadro che la contiene meglio. */
sam.tiles = new Map();
/* griglia fissa di riquadri (lato 40% della foto, sovrapposti un po'): pochi, così si possono studiare in anticipo */
function tileGrid(w){
  const L = Math.max(w.w, w.h), T = Math.max(384, Math.round(L*0.4));
  const axis = D => { if(D <= T) return [0]; const n = Math.ceil((D - T)/(L*0.3)) + 1; return Array.from({ length: n }, (_, i) => Math.round((D - T)*i/(n - 1))); };
  return { T, xs: axis(w.w), ys: axis(w.h) };
}
async function tileEmbed(w, tx, ty, T){
  const key = samKey(w) + '|' + tx + ',' + ty + ',' + T;
  if(sam.tiles.has(key)){ const v = sam.tiles.get(key); sam.tiles.delete(key); sam.tiles.set(key, v); return v.e ? v : v.pending; }
  const pending = (async () => {
    const im = await loadImg(w.img), s = 1024 / T;
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1024;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
    g.drawImage(im, tx, ty, T, T, 0, 0, 1024, 1024);
    const d = g.getImageData(0, 0, 1024, 1024).data, P = 1024*1024, t = new Float32Array(3*P);
    for(let j = 0; j < P; j++){ const i = j*4; t[j] = (d[i] - 123.675)/58.395; t[P+j] = (d[i+1] - 116.28)/57.12; t[2*P+j] = (d[i+2] - 103.53)/57.375; }
    const out = await sam.enc.run({ image: new ort.Tensor('float32', t, [1,3,1024,1024]) });
    return { e: true, ed: new Float32Array(out.embeddings.data), edims: out.embeddings.dims.slice(), s, tx, ty };
  })();
  sam.tiles.set(key, { pending });
  try{ const r = await pending; sam.tiles.set(key, r); while(sam.tiles.size > 12) sam.tiles.delete(sam.tiles.keys().next().value); return r; }
  catch(e){ sam.tiles.delete(key); throw e; }
}
/* quanto due contorni coincidono (area comune / area totale), disegnandoli su una piccola tela */
function polyIoU(a, b){
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  a.concat(b).forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
  const S = 160/Math.max(1, x1 - x0, y1 - y0), W = Math.ceil((x1 - x0)*S) + 2, H = Math.ceil((y1 - y0)*S) + 2;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.globalCompositeOperation = 'lighter';
  [[a, '#ff0000'], [b, '#00ff00']].forEach(([p, col]) => { g.beginPath(); p.forEach((q, i) => { const X = (q[0] - x0)*S + 1, Y = (q[1] - y0)*S + 1; if(i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.fillStyle = col; g.fill(); });
  const d = g.getImageData(0, 0, W, H).data; let I = 0, U = 0;
  for(let i = 0; i < d.length; i += 4){ const ra = d[i] > 127, gb = d[i+1] > 127; if(ra || gb) U++; if(ra && gb) I++; }
  return U ? I/U : 0;
}
/* seconda passata ad alta risoluzione + scelta tra contorno fedele e lati dritti */
async function refineContour(w, op0, so, x, y){
  let op = op0, trusted = false;
  try{
    const rf = await samRefine(w, op0, x, y);
    /* la seconda passata deve confermare la stessa forma: se se ne discosta troppo (pezzi di pannello, una faccia sola del volume) si tiene la prima */
    if(rf && polyIoU(rf, op0) >= 0.85){ op = rf; trusted = true; }
  }catch(e){ console.warn('rifinitura', e); }
  /* lati dritti solo se la forma vera è davvero a lati dritti (volumi): le macro tondeggianti tengono il contorno fedele */
  if(so && (trusted ? polyIoU(so, op) >= 0.93 : polyIoU(so, op0) >= 0.9)) op = so;
  return op;
}
/* rilevamento automatico, alla fine: rifinitura delle prese trovate, raggruppate per zona della foto */
async function refineAuto(w, list){
  if(!list.length || sam.state !== 'ready') return;
  const { T } = tileGrid(w);
  list.sort((a, b) => (Math.floor(a.y/T) - Math.floor(b.y/T)) || (a.x - b.x));
  ui.scan.refine = true; ui.scan.i = 0; ui.scan.total = list.length; renderTools();
  for(const h of list){
    if(ui.scan.stop) break;
    const op0 = []; for(let i = 0; i < h.poly.length; i += 2) op0.push([h.poly[i], h.poly[i+1]]);
    const op = await refineContour(w, op0, h._so || null, h.sx, h.sy);
    if(op !== op0 && op.length >= 3){
      h.poly = []; op.forEach(p => h.poly.push(Math.round(p[0]), Math.round(p[1])));
      let A = 0, cx = 0, cy = 0;
      for(let i = 0; i < op.length; i++){ const a = op[i], b = op[(i+1) % op.length], c = a[0]*b[1] - b[0]*a[1]; A += c; cx += (a[0]+b[0])*c; cy += (a[1]+b[1])*c; }
      if(Math.abs(A) > 1){ h.x = cx/(3*A); h.y = cy/(3*A); }
    }
    ui.scan.i++;
    if(ui.scan.i % 2 === 0){ renderTools(); await new Promise(r => setTimeout(r, 0)); }
    if(ui.scan.i % 40 === 0){ touch(); render(); }
  }
  list.forEach(h => { delete h._so; });
}
/* studio preliminare: appena la foto è pronta, si studiano in sottofondo anche i riquadri della griglia,
   così la seconda passata ad alta risoluzione non fa aspettare al tocco */
async function preStudy(w){
  const key = samKey(w);
  if(sam.pre && sam.pre.key === key) return;
  const { T, xs, ys } = tileGrid(w), list = [];
  ys.forEach(ty => xs.forEach(tx => list.push([tx, ty])));
  sam.pre = { key, done: 0, total: list.length };
  await new Promise(r => setTimeout(r, 600));
  for(const [tx, ty] of list){
    const cw = curWall();
    if(!cw || samKey(cw) !== key || !needsSam(cw) || sam.state !== 'ready'){ sam.pre = null; return; }   /* si riprende quando si torna */
    try{ await tileEmbed(w, tx, ty, T); }catch(e){ sam.pre = null; return; }
    if(sam.pre && sam.pre.key === key){ sam.pre.done++; renderTools(); }
  }
}
async function samRefine(w, op, x, y){
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, A0 = 0;
  op.forEach((p, i) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); const q = op[(i+1) % op.length]; A0 += p[0]*q[1] - q[0]*p[1]; });
  A0 = Math.abs(A0)/2;
  const { T, xs, ys } = tileGrid(w), bw = x1 - x0, bh = y1 - y0;
  if(A0 < 4) return null;
  let tx, ty, E;
  /* riquadro della griglia che contiene la presa con più margine (se ci sta tutta) */
  const bestPos = (a0, a1, P) => { let b = P[0], bm = -1e9; P.forEach(v => { const m = Math.min(a0 - v, v + T - a1); if(m > bm){ bm = m; b = v; } }); return [b, bm]; };
  const [gx, mx] = bestPos(x0, x1, xs), [gy, my] = bestPos(y0, y1, ys);
  if(Math.min(mx, my) >= 4){ tx = gx; ty = gy; E = await tileEmbed(w, tx, ty, T); }
  else if(Math.max(bw, bh) > T*0.7){
    /* macro e volumi: un riquadro su misura attorno alla forma (se non è quasi tutta la foto, dove non si guadagna niente) */
    const T2 = Math.round(Math.max(bw, bh)*1.35);
    if(T2 >= 0.85*Math.max(w.w, w.h)) return null;
    tx = Math.round(Math.max(0, Math.min((x0 + x1)/2 - T2/2, w.w - T2))); ty = Math.round(Math.max(0, Math.min((y0 + y1)/2 - T2/2, w.h - T2)));
    E = await tileEmbed(w, tx, ty, T2);
  } else {
    /* a cavallo tra due riquadri: uno su misura centrato sulla presa */
    tx = Math.round(Math.max(0, Math.min((x0 + x1)/2 - T/2, w.w - T))); ty = Math.round(Math.max(0, Math.min((y0 + y1)/2 - T/2, w.h - T)));
    E = await tileEmbed(w, tx, ty, T);
  }
  const s = E.s;
  const px = (x - tx)*s, py = (y - ty)*s, m = 0.12;
  const box = [(x0 - bw*m - tx)*s, (y0 - bh*m - ty)*s, (x1 + bw*m - tx)*s, (y1 + bh*m - ty)*s];
  const r = await sam.dec.run({
    image_embeddings: new ort.Tensor('float32', E.ed.slice(), E.edims),
    point_coords: new ort.Tensor('float32', new Float32Array([px, py, box[0], box[1], box[2], box[3]]), [1,3,2]),
    point_labels: new ort.Tensor('float32', new Float32Array([1, 2, 3]), [1,3]),
    mask_input: new ort.Tensor('float32', new Float32Array(256*256), [1,1,256,256]),
    has_mask_input: new ort.Tensor('float32', new Float32Array([0]), [1]),
    orig_im_size: new ort.Tensor('float32', new Float32Array([1024, 1024]), [2])
  });
  const md = r.masks.data, iou = r.iou_predictions.data, nm = r.masks.dims[1], N = 1024*1024;
  let best = null;
  for(let k = 0; k < nm; k++){
    let a = 0; const off = k*N; for(let i = 0; i < N; i++) if(md[off+i] > 0) a++;
    const ap = a/(s*s);   /* area in pixel della foto */
    if(ap < A0*0.6 || ap > A0*1.6) continue;   /* deve restare la stessa presa */
    if(!best || iou[k] > best.q) best = { k, q: iou[k] };
  }
  if(!best) return null;
  const mk = new Uint8Array(N), off = best.k*N; for(let i = 0; i < N; i++) mk[i] = md[off+i] > 0 ? 1 : 0;
  const tr = maskToPoly(mk, 1024, 1024, px, py);
  if(!tr || tr.pts.length < 8) return null;
  const k = 1/s, pts = tr.pts.map(p => [tx + (p[0] + 0.5)*k, ty + (p[1] + 0.5)*k]);
  return rdpPts(smoothClosed(pts, 2), Math.max(0.5, 0.7*k));
}
const SDIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
function maskToPoly(m, W, H, tx, ty){
  /* componente connessa che contiene il tocco (o la più vicina) */
  let seed = -1;
  const tix = Math.max(0, Math.min(W-1, Math.round(tx))), tiy = Math.max(0, Math.min(H-1, Math.round(ty)));
  if(m[tiy*W + tix]) seed = tiy*W + tix;
  else{
    let best = 1e18;
    const r = 12;
    for(let y = Math.max(0, tiy-r); y <= Math.min(H-1, tiy+r); y++) for(let x = Math.max(0, tix-r); x <= Math.min(W-1, tix+r); x++){
      if(m[y*W+x]){ const dd = (x-tix)*(x-tix) + (y-tiy)*(y-tiy); if(dd < best){ best = dd; seed = y*W+x; } }
    }
  }
  if(seed < 0) return null;
  const comp = new Uint8Array(W*H), st = [seed]; comp[seed] = 1;
  let n = 0, top = seed;
  while(st.length){
    const p = st.pop(); n++; if(p < top) top = p;
    const x = p % W, y = (p - x)/W;
    if(x > 0 && m[p-1] && !comp[p-1]){ comp[p-1] = 1; st.push(p-1); }
    if(x < W-1 && m[p+1] && !comp[p+1]){ comp[p+1] = 1; st.push(p+1); }
    if(y > 0 && m[p-W] && !comp[p-W]){ comp[p-W] = 1; st.push(p-W); }
    if(y < H-1 && m[p+W] && !comp[p+W]){ comp[p+W] = 1; st.push(p+W); }
  }
  /* bordo (Moore), partendo dal pixel più in alto a sinistra */
  const sx = top % W, sy = (top - sx)/W, pts = [[sx, sy]];
  let x = sx, y = sy, bx = sx-1, by = sy, guard = 0, moved = false;
  while(guard++ < 400000){
    let idx = 0;
    for(let k=0; k<8; k++){ if(SDIRS[k][0] === bx-x && SDIRS[k][1] === by-y){ idx = k; break; } }
    let found = false;
    for(let k=1; k<=8; k++){
      const dd = (idx+k) % 8, nx = x + SDIRS[dd][0], ny = y + SDIRS[dd][1];
      if(nx >= 0 && ny >= 0 && nx < W && ny < H && comp[ny*W+nx]){
        const pd = (dd+7) % 8; bx = x + SDIRS[pd][0]; by = y + SDIRS[pd][1]; x = nx; y = ny; found = true; break;
      }
    }
    if(!found) break;
    if(x === sx && y === sy && moved) break;
    moved = true; pts.push([x, y]);
  }
  return { pts, n, inside: !!m[tiy*W + tix] };
}
function rdpPts(p, eps){
  if(p.length < 4) return p;
  const keep = new Uint8Array(p.length); keep[0] = 1; keep[p.length-1] = 1;
  const st = [[0, p.length-1]];
  while(st.length){
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const ax = p[a][0], ay = p[a][1], dx = p[b][0]-ax, dy = p[b][1]-ay, L = Math.hypot(dx, dy) || 1;
    for(let i=a+1; i<b; i++){ const dd = Math.abs(dy*(p[i][0]-ax) - dx*(p[i][1]-ay))/L; if(dd > md){ md = dd; mi = i; } }
    if(md > eps && mi > 0){ keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return p.filter((_, i) => keep[i]);
}
/* volumi e prese spigolose: se il contorno si descrive bene con pochi lati dritti (scarto massimo ~3,5% della misura),
   lo si sostituisce con un poligono a lati netti; gli angoli nascono dall'incrocio delle rette che seguono ogni lato */
function straightPoly(pts, nPix){
  const fits = r => { if(!r) return null; let A = 0; r.forEach((p, i) => { const q = r[(i+1) % r.length]; A += p[0]*q[1] - q[0]*p[1]; }); return Math.abs(A)/2 <= nPix*1.12 ? r : null; };
  const r = fits(straightCore(pts, nPix));
  if(r) return r;
  /* volumi con prese montate sul bordo: si prova sull'involucro convesso, se la forma è quasi convessa */
  const h = hullPts(pts);
  if(h.length < 3) return null;
  let HA = 0; h.forEach((q, i) => { const n2 = h[(i+1) % h.length]; HA += q[0]*n2[1] - n2[0]*q[1]; }); HA = Math.abs(HA)/2;
  if(!HA || nPix/HA < 0.85) return null;   /* solo forme quasi convesse: niente mezzelune "chiuse" in un triangolo */
  const dense = [];
  h.forEach((q, i) => { const n2 = h[(i+1) % h.length], L = Math.max(1, Math.round(Math.hypot(n2[0]-q[0], n2[1]-q[1]))); for(let t=0; t<L; t++) dense.push([q[0] + (n2[0]-q[0])*t/L, q[1] + (n2[1]-q[1])*t/L]); });
  return straightCore(dense, HA);
}
function hullPts(pts){
  const q = pts.slice().sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const cr = (o,a,b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lo = []; for(const t of q){ while(lo.length >= 2 && cr(lo[lo.length-2], lo[lo.length-1], t) <= 0) lo.pop(); lo.push(t); }
  const up = []; for(let i=q.length-1;i>=0;i--){ const t = q[i]; while(up.length >= 2 && cr(up[up.length-2], up[up.length-1], t) <= 0) up.pop(); up.push(t); }
  return lo.slice(0,-1).concat(up.slice(0,-1));
}
function straightCore(pts, nPix){
  const D = Math.sqrt(nPix);
  if(D < 20 || pts.length < 12) return null;
  for(const f of [0.018, 0.025, 0.035]){
    const idx = rdpIdx(pts, f*D), V = idx.length - 1;
    if(V < 3 || V > 12) continue;
    const r = polyFromIdx(pts, idx, D);
    if(!r || r.length < 3 || r.length > 8) continue;
    /* il poligono deve coprire quasi la stessa superficie della presa: altrimenti era una forma tondeggiante */
    let A2 = 0; r.forEach((q, i) => { const n2 = r[(i+1) % r.length]; A2 += q[0]*n2[1] - n2[0]*q[1]; });
    if(Math.abs(Math.abs(A2/2)/nPix - 1) >= 0.07) continue;
    /* e il contorno deve stare attaccato ai lati: una presa tonda somiglia a un ottagono per superficie, ma non per forma */
    let dev = 0;
    for(let i = 0; i < pts.length; i += 2){ let m = 1e9; for(let j = 0; j < r.length; j++){ const a = r[j], b = r[(j+1) % r.length]; m = Math.min(m, segDist(pts[i][0], pts[i][1], a[0], a[1], b[0], b[1])); } dev += m; }
    if(dev / Math.ceil(pts.length/2) < 0.011*D) return r;
  }
  return null;
}
function polyFromIdx(pts, idx, D){
  const N = pts.length, P = i => pts[i % N], V = idx.length - 1;
  /* una retta per lato (tolto il 20% alle estremità, dove l'angolo è arrotondato) */
  const fit = (a, b) => {
    const len = b - a, s0 = a + Math.floor(len*0.2), s1 = b - Math.floor(len*0.2);
    let mx = 0, my = 0, n = 0;
    for(let i=s0; i<=s1; i++){ const q = P(i); mx += q[0]; my += q[1]; n++; }
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for(let i=s0; i<=s1; i++){ const q = P(i), dx = q[0]-mx, dy = q[1]-my; sxx += dx*dx; syy += dy*dy; sxy += dx*dy; }
    const th = 0.5*Math.atan2(2*sxy, sxx - syy), A = P(a), B = P(b);
    return { mx, my, dx: Math.cos(th), dy: Math.sin(th), a, b, L: Math.hypot(B[0]-A[0], B[1]-A[1]) };
  };
  let edges = [];
  for(let e=0; e<V; e++) edges.push(fit(idx[e], idx[e+1]));
  /* i lati cortissimi sono angoli smussati: si tolgono e l'angolo nasce dall'incrocio dei vicini */
  while(edges.length > 3){
    let mi = -1, ml = 0.16*D;
    edges.forEach((e, i) => { if(e.L < ml){ ml = e.L; mi = i; } });
    if(mi < 0) break;
    edges.splice(mi, 1);
  }
  /* due lati quasi in linea sono lo stesso lato spezzato dal rumore: si tiene il più lungo */
  for(let guard=0; guard<20 && edges.length > 3; guard++){
    let hit = -1;
    for(let k=0; k<edges.length; k++){
      const A = edges[k], B = edges[(k+1) % edges.length];
      if(Math.abs(A.dx*B.dy - A.dy*B.dx) < 0.2){ hit = k; break; }
    }
    if(hit < 0) break;
    /* si uniscono in un solo lato, con la retta ricalcolata su tutti i punti dei due */
    const k2 = (hit + 1) % edges.length, A = edges[hit], B = edges[k2];
    const merged = fit(A.a, B.b < A.a ? B.b + N : B.b);
    if(k2 === 0){ edges[hit] = merged; edges.splice(0, 1); } else edges.splice(hit, 2, merged);
  }
  const out = [], E = edges.length;
  for(let k=0; k<E; k++){
    const L1 = edges[(k + E - 1) % E], L2 = edges[k];
    const f1 = P(L1.b), f2 = P(L2.a), fx = (f1[0] + f2[0])/2, fy = (f1[1] + f2[1])/2;
    let px = fx, py = fy;
    const den = L1.dx*L2.dy - L1.dy*L2.dx;
    if(Math.abs(den) > 0.2){
      const t = ((L2.mx - L1.mx)*L2.dy - (L2.my - L1.my)*L2.dx)/den;
      const ix = L1.mx + t*L1.dx, iy = L1.my + t*L1.dy;
      if(Math.hypot(ix - fx, iy - fy) < 0.3*D){ px = ix; py = iy; }
      else return null;
    } else return null;
    out.push([px, py]);
  }
  return out;
}
function rdpIdx(pts, eps){
  const p = pts.concat([pts[0]]);
  /* si parte dal punto più lontano dal primo, così la chiusura non crea un vertice finto */
  let far = 0, fd = -1;
  for(let i=1; i<pts.length; i++){ const d = (pts[i][0]-pts[0][0])**2 + (pts[i][1]-pts[0][1])**2; if(d > fd){ fd = d; far = i; } }
  const keep = new Uint8Array(p.length); keep[0] = 1; keep[far] = 1; keep[p.length-1] = 1;
  const st = [[0, far], [far, p.length-1]];
  while(st.length){
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const ax = p[a][0], ay = p[a][1], dx = p[b][0]-ax, dy = p[b][1]-ay, L = Math.hypot(dx, dy) || 1;
    for(let i=a+1; i<b; i++){ const dd = Math.abs(dy*(p[i][0]-ax) - dx*(p[i][1]-ay))/L; if(dd > md){ md = dd; mi = i; } }
    if(md > eps && mi > 0){ keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  const r = []; keep.forEach((k, i) => { if(k) r.push(i); });
  /* il primo punto è un vertice solo se lì il contorno piega davvero */
  if(r.length > 4){
    const a = p[r[r.length-2]], b = p[0], c = p[r[1]];
    const L = Math.hypot(c[0]-a[0], c[1]-a[1]) || 1, d = Math.abs((c[1]-a[1])*(b[0]-a[0]) - (c[0]-a[0])*(b[1]-a[1]))/L;
    if(d <= eps){ const q = r.slice(1, -1); return q.concat([q[0] + pts.length]); }
  }
  return r;
}
async function samSegment(w, x, y, ts, strict, auto, defer){
  if(!(await samInit())) return undefined;
  const E = await samEmbed(w);
  const N = E.rw*E.rh;
  const r = await sam.dec.run({
    image_embeddings: new ort.Tensor('float32', E.ed.slice(), E.edims),
    point_coords: new ort.Tensor('float32', new Float32Array([x*E.s, y*E.s, 0, 0]), [1,2,2]),
    point_labels: new ort.Tensor('float32', new Float32Array([1, -1]), [1,2]),
    mask_input: new ort.Tensor('float32', new Float32Array(256*256), [1,1,256,256]),
    has_mask_input: new ort.Tensor('float32', new Float32Array([0]), [1]),
    orig_im_size: new ort.Tensor('float32', new Float32Array([E.rh, E.rw]), [2])
  });
  const md = r.masks.data, iou = r.iou_predictions.data, nm = r.masks.dims[1];
  const cands = [];
  for(let k = (nm > 1 ? 1 : 0); k < nm; k++){
    let a = 0; const off = k*N; for(let i=0; i<N; i++) if(md[off+i] > 0) a++;
    cands.push({ k, a, q: iou[k] });
  }
  const ok = cands.filter(c => c.a > 6 && c.q > (auto ? 0.86 : strict ? 0.8 : 0.5));
  if(!ok.length) return null;
  ok.sort((a, b) => a.a - b.a);
  let base = ok.findIndex(c => c.k === 1); if(base < 0) base = 0;
  const step = Math.round(Math.log(ts || 1)/Math.log(1.35));
  let pi = Math.max(0, Math.min(ok.length-1, base + step));
  /* rilevamento automatico: la maschera di cui SAM è più sicuro (a parità, la più piccola) */
  if(auto){ pi = 0; ok.forEach((c, j) => { if(c.q > ok[pi].q + 0.015) pi = j; }); }
  let pick = ok[pi];
  const trace = c => { const m = new Uint8Array(N), off = c.k*N; for(let i=0; i<N; i++) m[i] = md[off+i] > 0 ? 1 : 0; return maskToPoly(m, E.rw, E.rh, x*E.s, y*E.s); };
  let tr = trace(pick);
  if(!tr || tr.pts.length < 3) return null;
  if(strict && !tr.inside) return null;
  /* lati dritti solo per i volumi e le prese grandi: sulle prese normali la seconda passata ad alta risoluzione
     segue già bene gli spigoli, e "raddrizzare" una presa tondeggiante o a mezzaluna la trasformava in un poligono
     che copriva anche il pannello */
  const bigShape = n => n >= 0.004*N;   /* il confronto con il contorno fedele decide poi se tenere i lati dritti */
  let st = bigShape(tr.n) ? straightPoly(tr.pts, tr.n) : null;
  /* volume con due facce di luce diversa: la maschera scelta ne prende solo un pezzo frastagliato.
     Se una maschera più grande (fino a 5 volte) contiene il tocco ed è un poligono netto, si usa quella. */
  if(!st && !strict && !auto && (!ts || ts === 1)){
    for(let j = pi + 1; j < ok.length; j++){
      if(ok[j].a > pick.a*5) break;
      const t2 = trace(ok[j]); if(!t2 || !t2.inside) continue;
      const s2 = bigShape(t2.n) ? straightPoly(t2.pts, t2.n) : null;
      if(s2){ tr = t2; st = s2; pick = ok[j]; break; }
    }
  }
  const k = 1/E.s;
  let op, so = null;   /* contorno nelle coordinate della foto originale */
  {
    /* la maschera di SAM è a bassa risoluzione: si aggancia il contorno ai bordi veri della presa nella foto */
    let EM = null; try{ EM = await edgeMap(w); }catch(e){ EM = null; }
    const raw = tr.pts.map(p => [(p[0] + 0.5)*k, (p[1] + 0.5)*k]);
    /* niente scalini: si ammorbidisce la maschera prima di agganciarla ai bordi e il risultato dopo */
    const sm = smoothClosed(raw, 2);
    op = rdpPts(smoothClosed(EM ? snapContour(sm, EM, k) : sm, 2), EM ? 0.6/EM.es : 0.8*k);
    /* seconda passata ad alta risoluzione: SAM riguarda solo la zona attorno alla presa, ingrandita */
    so = st ? st.map(p => [(p[0] + 0.5)*k, (p[1] + 0.5)*k]) : null;
    /* nel rilevamento automatico la rifinitura si fa alla fine, solo sulle prese accettate (molto più veloce) */
    if(!defer) op = await refineContour(w, op, so, x, y);
  }
  if(op.length < 3) return null;
  const flat = []; op.forEach(p => { flat.push(Math.round(p[0]), Math.round(p[1])); });
  let A = 0, cx = 0, cy = 0;
  for(let i=0; i<op.length; i++){ const a = op[i], b = op[(i+1) % op.length], c = a[0]*b[1] - b[0]*a[1]; A += c; cx += (a[0]+b[0])*c; cy += (a[1]+b[1])*c; }
  if(Math.abs(A) < 1) return null;
  A /= 2; cx = cx/(6*A); cy = cy/(6*A);
  const area = Math.abs(A);
  const solid = Math.abs(A) / (hullAreaFlat(op.flat()) || 1);
  if(strict && solid < 0.6) return null;
  return { poly: flat, cx, cy, area, solid, score: pick.q, sam: true, so: defer ? so : undefined };
}
/* bordi della foto (intensità del cambio di colore), a risoluzione alta, calcolati una volta per foto */
const edgeCache = {};
async function edgeMap(w){
  const key = w.id + '|' + String(w.img).length + String(w.img).slice(-24), c = edgeCache[w.id];
  if(c && c.key === key) return c.map ? c.map : c.pending;
  const pending = (async () => {
    const im = await loadImg(w.img), es = Math.min(1, 2048 / Math.max(w.w, w.h));
    const ew = Math.max(1, Math.round(w.w*es)), eh = Math.max(1, Math.round(w.h*es));
    const cv = document.createElement('canvas'); cv.width = ew; cv.height = eh;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, ew, eh);
    const d = g.getImageData(0, 0, ew, eh).data, G = new Uint8Array(ew*eh);
    for(let y = 1; y < eh-1; y++) for(let x = 1; x < ew-1; x++){
      const i = (y*ew + x)*4; let sx = 0, sy = 0;
      for(let ch = 0; ch < 3; ch++){
        const L = d[i-4+ch], Rr = d[i+4+ch], U = d[i-ew*4+ch], D = d[i+ew*4+ch];
        sx += Math.abs(Rr - L); sy += Math.abs(D - U);
      }
      G[y*ew + x] = Math.min(255, (sx + sy) >> 1);
    }
    return { es, ew, eh, G };
  })();
  edgeCache[w.id] = { key, pending };
  const map = await pending; edgeCache[w.id] = { key, map }; return map;
}
/* ogni punto del contorno si sposta lungo la perpendicolare fino al bordo più netto lì vicino (entro la precisione della maschera);
   gli spostamenti si ammorbidiscono con quelli dei vicini, così il contorno resta pulito */
/* media mobile lungo un contorno chiuso (due passate ≈ curva gaussiana): toglie la scalettatura dei pixel */
function smoothClosed(p, r){
  const n = p.length; if(n < 2*r + 3) return p;
  let cur = p;
  for(let pass = 0; pass < 2; pass++){
    const out = new Array(n);
    for(let i = 0; i < n; i++){ let sx = 0, sy = 0; for(let j = -r; j <= r; j++){ const q = cur[(i + j + n) % n]; sx += q[0]; sy += q[1]; } out[i] = [sx/(2*r + 1), sy/(2*r + 1)]; }
    cur = out;
  }
  return cur;
}
function snapContour(pts, EM, k){
  const n = pts.length; if(n < 8) return pts;
  const R = Math.max(2, Math.round(1.6*k*EM.es)), off = new Float32Array(n);
  const at = (x, y) => { const xi = Math.round(x*EM.es), yi = Math.round(y*EM.es); return (xi < 0 || yi < 0 || xi >= EM.ew || yi >= EM.eh) ? 0 : EM.G[yi*EM.ew + xi]; };
  for(let i = 0; i < n; i++){
    const a = pts[(i - 3 + n) % n], b = pts[(i + 3) % n];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nx = ty, ny = -tx, p = pts[i];
    let best = 0, bs = -1, top = 0;
    for(let t = -R; t <= R; t++){ const gv = at(p[0] + nx*t/EM.es, p[1] + ny*t/EM.es); top = Math.max(top, gv); const sc = gv - 1.5*Math.abs(t); if(sc > bs){ bs = sc; best = t; } }
    off[i] = top >= 28 ? best : 0;
  }
  const out = [];
  for(let i = 0; i < n; i++){
    const win = []; for(let j = -4; j <= 4; j++) win.push(off[(i + j + n) % n]); win.sort((x, y) => x - y);
    const o = win[4]/EM.es, a = pts[(i - 3 + n) % n], b = pts[(i + 3) % n];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    out.push([pts[i][0] + ty*o, pts[i][1] - tx*o]);
  }
  return out;
}
const segCache = {};
async function getSeg(w){
  if(Object.prototype.hasOwnProperty.call(segCache, w.id)) return segCache[w.id];
  try{
    const im = await loadImg(w.img);
    const f = Math.max(1, Math.max(w.w, w.h) / 1400);
    const sw = Math.round(w.w/f), sh = Math.round(w.h/f);
    const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0, sw, sh);
    const panelSamples = (w.panelSamples || []).map(s => ({ x: s.x/f, y: s.y/f, rgb: s.rgb }));
    segCache[w.id] = makeSeg(g.getImageData(0, 0, sw, sh).data, sw, sh, { panelSamples });
    if(f > 1){
      const inner = segCache[w.id];
      segCache[w.id] = { segment: (x, y, ts, strict) => {
        const r = inner.segment(x/f, y/f, ts, strict); if(!r) return null;
        r.poly = r.poly.map(v => Math.round(v*f)); r.cx *= f; r.cy *= f; r.area *= f*f; return r;
      } };
    }
  }catch(e){ segCache[w.id] = null; }
  return segCache[w.id];
}
async function detect(w, x, y, ts, strict){
  if(strict) return detect0(w, x, y, ts, strict);
  const done = busy('Rilevo la presa…');
  try{ await nextPaint(); return await detect0(w, x, y, ts, strict); } finally { done(); }
}
async function detect0(w, x, y, ts, strict){
  if(samMaybe()){
    try{
      const r = await samSegment(w, x, y, ts || 1, strict);
      if(r) return r;
      if(r === null && strict) return null;
    }catch(e){ console.warn('SAM errore', e); }
  }
  const sg = await Promise.race([getSeg(w), new Promise(r => setTimeout(() => r(null), 6000))]); if(!sg) return null;
  try{ return sg.segment(x, y, ts || 1, strict); }catch(e){ return null; }
}

/* mappa dei "candidati": pixel che si staccano dal pannello circostante (mediana locale), a bassa risoluzione */
async function samCandidates(w){
  const im = await loadImg(w.img);
  const S = 480 / Math.max(w.w, w.h), cw = Math.max(1, Math.round(w.w*S)), ch = Math.max(1, Math.round(w.h*S));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, cw, ch);
  const d = g.getImageData(0, 0, cw, ch).data, N = cw*ch, R = 15;
  const bg = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  for(let c = 0; c < 3; c++){
    const out = bg[c], hist = new Int32Array(256), half = ((2*R+1)*(2*R+1)) >> 1;
    const px = (x, y) => d[(Math.min(ch-1, Math.max(0, y))*cw + Math.min(cw-1, Math.max(0, x)))*4 + c];
    for(let y = 0; y < ch; y++){
      hist.fill(0);
      for(let dy = -R; dy <= R; dy++) for(let dx = -R; dx <= R; dx++) hist[px(dx, y+dy)]++;
      for(let x = 0; x < cw; x++){
        if(x > 0){ for(let dy = -R; dy <= R; dy++){ hist[px(x-R-1, y+dy)]--; hist[px(x+R, y+dy)]++; } }
        let acc = 0, v = 0; while(v < 255){ acc += hist[v]; if(acc > half) break; v++; }
        out[y*cw + x] = v;
      }
    }
    if(c < 2) await new Promise(r => setTimeout(r, 0));
  }
  let m = new Uint8Array(N);
  for(let i = 0; i < N; i++){
    const a = d[i*4]-bg[0][i], b = d[i*4+1]-bg[1][i], e = d[i*4+2]-bg[2][i];
    m[i] = a*a + b*b + e*e > 22*22 ? 1 : 0;
  }
  /* apertura (erosione + dilatazione a croce) per togliere il rumore */
  const morph = (src, er) => { const o = new Uint8Array(N); for(let y = 0; y < ch; y++) for(let x = 0; x < cw; x++){ const i = y*cw+x;
    const n = [src[i], x>0?src[i-1]:0, x<cw-1?src[i+1]:0, y>0?src[i-cw]:0, y<ch-1?src[i+cw]:0];
    o[i] = er ? (n[0]&&n[1]&&n[2]&&n[3]&&n[4] ? 1 : 0) : (n[0]||n[1]||n[2]||n[3]||n[4] ? 1 : 0); } return o; };
  m = morph(morph(m, true), false);
  return { m, cw, ch, S };
}
function candSeeds(C){
  const { m, cw, ch } = C, N = cw*ch, dt = new Float32Array(N);
  for(let i = 0; i < N; i++) dt[i] = m[i] ? 1e9 : 0;
  for(let y = 0; y < ch; y++) for(let x = 0; x < cw; x++){ const i = y*cw+x; if(!dt[i]) continue;
    let v = dt[i]; if(x > 0) v = Math.min(v, dt[i-1]+1); if(y > 0) v = Math.min(v, dt[i-cw]+1);
    if(x > 0 && y > 0) v = Math.min(v, dt[i-cw-1]+1.414); if(x < cw-1 && y > 0) v = Math.min(v, dt[i-cw+1]+1.414); dt[i] = v; }
  for(let y = ch-1; y >= 0; y--) for(let x = cw-1; x >= 0; x--){ const i = y*cw+x; if(!dt[i]) continue;
    let v = dt[i]; if(x < cw-1) v = Math.min(v, dt[i+1]+1); if(y < ch-1) v = Math.min(v, dt[i+cw]+1);
    if(x < cw-1 && y < ch-1) v = Math.min(v, dt[i+cw+1]+1.414); if(x > 0 && y < ch-1) v = Math.min(v, dt[i+cw-1]+1.414); dt[i] = v; }
  const lab = new Int32Array(N), seeds = []; let id = 0;
  for(let i = 0; i < N; i++){
    if(!m[i] || lab[i]) continue;
    id++; const st = [i]; lab[i] = id; let n = 0, best = i, pix = [];
    while(st.length){ const p = st.pop(); n++; pix.push(p); if(dt[p] > dt[best]) best = p;
      const x = p % cw;
      if(x > 0 && m[p-1] && !lab[p-1]){ lab[p-1] = id; st.push(p-1); }
      if(x < cw-1 && m[p+1] && !lab[p+1]){ lab[p+1] = id; st.push(p+1); }
      if(p >= cw && m[p-cw] && !lab[p-cw]){ lab[p-cw] = id; st.push(p-cw); }
      if(p < N-cw && m[p+cw] && !lab[p+cw]){ lab[p+cw] = id; st.push(p+cw); } }
    if(n < 3){ pix.forEach(p => { m[p] = 0; }); continue; }
    seeds.push([best % cw, Math.floor(best / cw)]);
  }
  return seeds;
}
function candClear(C, x0, y0, x1, y1, test){
  const { m, cw, ch } = C;
  for(let y = Math.max(0, y0); y <= Math.min(ch-1, y1); y++) for(let x = Math.max(0, x0); x <= Math.min(cw-1, x1); x++){
    if(!test || test(x, y)) m[y*cw + x] = 0;
  }
}
/* scansione con SAM: semi dove qualcosa si stacca dal pannello, ogni seme rifinito da SAM; più giri per separare prese vicine */
let autoPanel = null;
/* colore del pannello: dai campioni del gestore, altrimenti stimato (pixel chiari e poco saturi più comuni) */
async function panelInfo(w){
  const im = await loadImg(w.img), S = 360 / Math.max(w.w, w.h), cw = Math.max(1, Math.round(w.w*S)), ch = Math.max(1, Math.round(w.h*S));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, cw, ch);
  const d = g.getImageData(0, 0, cw, ch).data;
  let refs = (w.panelSamples || []).map(p => p.rgb);
  if(!refs.length){
    const bins = {}; for(let i = 0; i < d.length; i += 4){ const r = d[i], gg = d[i+1], b = d[i+2], mx = Math.max(r,gg,b), mn = Math.min(r,gg,b);
      if(mx > 120 && (mx - mn) < 0.28*mx){ const k = (r>>4)+'_'+(gg>>4)+'_'+(b>>4); bins[k] = (bins[k] || 0) + 1; } }
    const top = Object.entries(bins).sort((a, b) => b[1] - a[1]).slice(0, 3);
    refs = top.map(([k]) => k.split('_').map(v => (+v)*16 + 8));
  }
  return { d, cw, ch, S, refs };
}
function panelLike(P, r, g, b, tol){
  const sm = r + g + b + 1;
  return P.refs.some(c => { const cs = c[0] + c[1] + c[2] + 1, k = sm / cs;
    return k > 0.5 && k < 1.3 && Math.abs(r/sm - c[0]/cs) + Math.abs(g/sm - c[1]/cs) + Math.abs(b/sm - c[2]/cs) < tol; });
}
/* una presa trovata è buona se: non è un pezzo di pannello vuoto, non si sovrappone a prese già trovate, non ne unisce più di una */
function autoAccept(w, holds, res, volArea){
  const P = autoPanel, poly = res.poly;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for(let i = 0; i < poly.length; i += 2){ x0 = Math.min(x0, poly[i]); x1 = Math.max(x1, poly[i]); y0 = Math.min(y0, poly[i+1]); y1 = Math.max(y1, poly[i+1]); }
  const pts = [];
  for(let gy = 0; gy < 9; gy++) for(let gx = 0; gx < 9; gx++){ const x = x0 + (gx + 0.5)*(x1 - x0)/9, y = y0 + (gy + 0.5)*(y1 - y0)/9; if(inPoly(poly, x, y)) pts.push([x, y]); }
  if(!pts.length) return false;
  /* troppo grande o attaccato ai bordi della foto: è pannello, cornice o soffitto, non una presa */
  const W = w.w, H = w.h, e = 3;
  if(x1 - x0 > W*0.35 || y1 - y0 > H*0.35) return false;
  if((x0 < e) + (y0 < e) + (x1 > W - e) + (y1 > H - e) >= 2) return false;
  if(P){
    /* pannello: stessa tinta del pannello (anche in ombra o più illuminato). Le zone grandi così sono pannello vuoto;
       per le piccole (possibili prese bianche) serve una somiglianza più stretta */
    const big = res.area > W*H*0.004;
    let near = 0;
    pts.forEach(([x, y]) => { const i = (Math.min(P.ch-1, Math.round(y*P.S))*P.cw + Math.min(P.cw-1, Math.round(x*P.S)))*4;
      if(panelLike(P, P.d[i], P.d[i+1], P.d[i+2], big ? 0.04 : 0.022)) near++; });
    if(near / pts.length > (big ? 0.55 : 0.75)) return false;
  }
  let over = 0, inside = 0;
  for(const h of holds){
    if(!h.poly) continue;
    const big = polyArea(h.poly) >= volArea;
    if(big){ if(res.area < polyArea(h.poly)*0.35) continue; }
    if(inPoly(poly, h.x, h.y)) inside++;
  }
  if(inside >= 2) return false;
  /* sovrapposizione: con le prese normali sempre; con quelle grandi solo se la nuova è di misura simile (doppione) */
  const blocking = holds.filter(h => h.poly && (polyArea(h.poly) < volArea || res.area >= polyArea(h.poly)*0.35));
  pts.forEach(([x, y]) => { for(const h of blocking){ if(inPoly(h.poly, x, y)){ over++; break; } } });
  return over / pts.length <= 0.25;
}
/* passata a griglia: punti regolari su tutta la foto, dal largo al fitto. Trova anche le prese grandi e quelle
   che si staccano poco dal pannello, che la ricerca per colore perde. */
async function samGridPass(w, holds, maxArea, volArea){
  try{ autoPanel = await panelInfo(w); }catch(e){ autoPanel = null; }
  const L = Math.max(w.w, w.h), pts = [];
  [10, 20, 34].forEach(n => { const st = L / n; for(let y = st/2; y < w.h; y += st) for(let x = st/2; x < w.w; x += st) pts.push([x, y]); });
  ui.scan.prep = false; ui.scan.total = pts.length; ui.scan.round = 1; renderTools();
  const covered = (x, y) => holds.some(h => h.poly && polyArea(h.poly) < volArea && inPoly(h.poly, x, y));
  /* pannello liscio intorno al punto (tutto chiaro, grigio e uniforme): inutile chiedere a SAM, si risparmia tempo */
  const plainPanel = (x, y, r) => { const P = autoPanel; if(!P) return false; let lo = 1e9, hi = -1e9;
    for(let k = 0; k < 9; k++){ const a = k*0.785, q = k ? r : 0, px = Math.round((x + Math.cos(a)*q)*P.S), py = Math.round((y + Math.sin(a)*q)*P.S);
      if(px < 0 || py < 0 || px >= P.cw || py >= P.ch) continue;
      const i = (py*P.cw + px)*4, R = P.d[i], G = P.d[i+1], B = P.d[i+2];
      if(!panelLike(P, R, G, B, 0.03)) return false; const v = R + G + B; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return hi - lo < 80; };
  let i = 0;
  for(const [x, y] of pts){
    if(ui.scan.stop) break;
    i++; ui.scan.i = i;
    if(!covered(x, y) && !plainPanel(x, y, L/60)){
      let res = null;
      try{ res = await samSegment(w, x, y, 1, false, true, true); }catch(e){ res = null; }
      if(res && res.area > 60 && res.area < maxArea && res.solid >= 0.45 && inPoly(res.poly, x, y) && autoAccept(w, holds, res, volArea)){
        holds.push({ id: uid(), poly: res.poly, x: res.cx, y: res.cy, sx: x, sy: y, det: 1, _so: res.so, _new: 1 }); ui.scan.found++;
      }
    }
    if(i % 4 === 0){ renderTools(); await new Promise(r => setTimeout(r, 0)); }
    if(i % 80 === 0){ touch(); render(); }
  }
}
async function samAutoScan(w){
  const holds = (w.holds = w.holds || []);
  /* prese e volumi grandi fino all'8% della foto: sui muri con macro e volumi le prese grandi sono tante */
  const maxArea = w.w * w.h * 0.08, volArea = w.w * w.h * 0.012;
  ui.scan = { i: 0, total: 1, found: 0, stop: false, prep: true, wid: w.id }; scanWake(true); renderTools();
  try{ await samEmbed(w); }catch(e){ scanEnd(); toast('Non riesco a preparare il riconoscimento su questa foto.'); render(); return; }
  const C = await samCandidates(w);
  /* le prese grandi (volumi) non "coprono" i punti: sopra ci possono essere altre prese */
  const inAny = (x, y) => { for(let k = 0; k < holds.length; k++){ const p = holds[k].poly; if(p && polyArea(p) < volArea && inPoly(p, x, y)) return true; } return false; };
  let done = 0;
  await samGridPass(w, holds, maxArea, volArea);
  if(ui.scan.stop){ const found = ui.scan.found; holds.forEach(h => { delete h._so; delete h._new; }); scanEnd(); touch(); render(); toast(`Fermato: ${found} nuove prese aggiunte.`); return; }
  done = ui.scan.i;
  for(let round = 0; round < 4 && !ui.scan.stop; round++){
    const seeds = candSeeds(C);
    if(!seeds.length) break;
    ui.scan.prep = false; ui.scan.total = done + seeds.length; ui.scan.round = round + 1; renderTools();
    for(const [sx, sy] of seeds){
      if(ui.scan.stop) break;
      const X = (sx + 0.5)/C.S, Y = (sy + 0.5)/C.S;
      let ok = false;
      if(inAny(X, Y)) ok = true;
      else{
        let res = null;
        try{ res = await samSegment(w, X, Y, 1, true, false, true); }catch(e){ res = null; }
        if(res && res.area > 90 && res.area < maxArea && autoAccept(w, holds, res, volArea)){
          const poly = res.poly;
          holds.push({ id: uid(), poly, x: res.cx, y: res.cy, sx: X, sy: Y, det: 1, _so: res.so, _new: 1 }); ui.scan.found++; ok = true;
          let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
          for(let i = 0; i < poly.length; i += 2){ bx0 = Math.min(bx0, poly[i]); bx1 = Math.max(bx1, poly[i]); by0 = Math.min(by0, poly[i+1]); by1 = Math.max(by1, poly[i+1]); }
          candClear(C, Math.floor(bx0*C.S)-1, Math.floor(by0*C.S)-1, Math.ceil(bx1*C.S)+1, Math.ceil(by1*C.S)+1,
            (x, y) => inPoly(poly, (x+0.5)/C.S, (y+0.5)/C.S) || inPoly(poly, (x-0.5)/C.S, (y+0.5)/C.S) || inPoly(poly, (x+1.5)/C.S, (y+0.5)/C.S) || inPoly(poly, (x+0.5)/C.S, (y-0.5)/C.S) || inPoly(poly, (x+0.5)/C.S, (y+1.5)/C.S));
        }
      }
      if(!ok) candClear(C, sx-3, sy-3, sx+3, sy+3);
      else candClear(C, sx-1, sy-1, sx+1, sy+1);
      done++; ui.scan.i = done;
      if(done % 3 === 0){ renderTools(); await new Promise(r => setTimeout(r, 0)); }
      if(done % 60 === 0){ touch(); render(); }
    }
  }
  if(!ui.scan.stop){ touch(); render(); await refineAuto(w, holds.filter(h => h._new)); }
  holds.forEach(h => { delete h._so; delete h._new; });
  const stopped = ui.scan.stop, found = ui.scan.found;
  scanEnd(); touch(); render();
  toast(stopped ? `Fermato: ${found} nuove prese aggiunte (riconoscimento intelligente).` : `Fatto con il riconoscimento intelligente: ${found} nuove prese. Controlla e aggiungi a mano quelle mancanti.`);
}
async function autoDetectAll(w){
  if(!w || ui.scan || w.locked) return;
  ui.cleared = null;
  const useSam = samMaybe() && await samInit();
  if(useSam) return samAutoScan(w);
  const step = useSam ? Math.max(14, Math.round(Math.max(w.w, w.h) / 64)) : Math.max(14, Math.round(Math.max(w.w, w.h) / 85));
  const cols = Math.max(1, Math.floor(w.w / step)), rows = Math.max(1, Math.floor(w.h / step));
  const total = cols * rows;
  const holds = (w.holds = w.holds || []);
  const maxArea = w.w * w.h * 0.008;
  ui.scan = { i: 0, total: total * (useSam ? 1 : 2), found: 0, stop: false, wid: w.id }; scanWake(true);
  renderTools();
  let idx = 0;
  /* due passate: 1) tentativo unico, il piu' severo possibile; 2) solo sui buchi rimasti, piu' permissiva (rischia qualche fusione in cambio di piu' prese) */
  for(const level of (useSam ? [2] : [2, 1])){
    outer: for(let ry = 0; ry < rows; ry++){
      for(let rx = 0; rx < cols; rx++){
        idx++;
        if(ui.scan.stop) break outer;
        const x = Math.round(step/2 + rx*step), y = Math.round(step/2 + ry*step);
        let covered = false;
        for(let k = 0; k < holds.length; k++){ if(holds[k].poly && inPoly(holds[k].poly, x, y)){ covered = true; break; } }
        if(!covered){
          const res = await detect(w, x, y, 1, level);
          if(res && res.area > 90 && res.area < maxArea){
            let dup = false;
            for(let k = 0; k < holds.length; k++){ if(holds[k].poly && inPoly(holds[k].poly, res.cx, res.cy)){ dup = true; break; } }
            if(!dup){ holds.push({ id: uid(), poly: res.poly.map(v => Math.round(v)), x: res.cx, y: res.cy, sx: x, sy: y, det: 1 }); ui.scan.found++; }
          }
        }
        ui.scan.i = idx;
        if(idx % (useSam ? 5 : 30) === 0){ renderTools(); await new Promise(r => setTimeout(r, 0)); }
        if(idx % 200 === 0){ touch(); render(); }
      }
    }
    if(ui.scan.stop) break;
  }
  const stopped = ui.scan.stop, found = ui.scan.found;
  scanEnd();
  touch(); render();
  toast(stopped ? `Fermato: ${found} nuove prese aggiunte (metodo semplice).` : `Fatto con il metodo semplice (il riconoscimento intelligente non è disponibile su questo telefono): ${found} nuove prese.`);
}
function applySeg(h, r, x, y, w){
  h.sx = x; h.sy = y;
  if(r){
    h.poly = r.poly.map(v => Math.round(v)); h.x = r.cx; h.y = r.cy;
    h.r = clamp(Math.sqrt(r.area/Math.PI)/w.w, 0.012, 0.06);
  } else { delete h.poly; h.x = x; h.y = y; }
}
function inPoly(p, x, y){
  let c = false;
  for(let i=0, j=p.length-2; i<p.length; j=i, i+=2){
    const xi = p[i], yi = p[i+1], xj = p[j], yj = p[j+1];
    if(((yi > y) !== (yj > y)) && (x < (xj-xi)*(y-yi)/(yj-yi) + xi)) c = !c;
  }
  return c;
}
function hitIndex(c, W, x, y, tol){
  for(let i=c.holds.length-1;i>=0;i--){
    const h = c.holds[i];
    if(h.poly ? inPoly(h.poly, x, y) : Math.hypot(h.x-x, h.y-y) <= Math.max(h.r*W*1.1, tol)) return i;
  }
  for(let i=c.holds.length-1;i>=0;i--){ const h = c.holds[i]; if(Math.hypot(h.x-x, h.y-y) <= tol) return i; }
  return -1;
}
function holdBox(h, W){
  if(h.poly){
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for(let i=0;i<h.poly.length;i+=2){ const x = h.poly[i], y = h.poly[i+1]; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    return { x0, y0, x1, y1 };
  }
  const rr = h.r*W; return { x0: h.x-rr, y0: h.y-rr, x1: h.x+rr, y1: h.y+rr };
}
function polyArea(p){
  let A = 0;
  for(let i=0, j=p.length-2; i<p.length; j=i, i+=2) A += p[j]*p[i+1] - p[i]*p[j+1];
  return Math.abs(A)/2;
}
function hullAreaFlat(p){
  const q = []; for(let i=0;i<p.length;i+=2) q.push([p[i], p[i+1]]);
  q.sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const cr = (o,a,b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lo = []; for(const t of q){ while(lo.length >= 2 && cr(lo[lo.length-2], lo[lo.length-1], t) <= 0) lo.pop(); lo.push(t); }
  const up = []; for(let i=q.length-1;i>=0;i--){ const t = q[i]; while(up.length >= 2 && cr(up[up.length-2], up[up.length-1], t) <= 0) up.pop(); up.push(t); }
  const h = lo.slice(0,-1).concat(up.slice(0,-1)); let A = 0;
  for(let i=0;i<h.length;i++){ const a = h[i], b = h[(i+1) % h.length]; A += a[0]*b[1] - b[0]*a[1]; }
  return Math.abs(A)/2;
}
/* tutti i contorni sotto il tocco, dal più piccolo al più grande; altrimenti il più vicino per baricentro */
function catList(w, x, y, tol){
  const cat = w.holds || [], hits = [];
  cat.forEach((h,i) => { if(inPoly(h.poly, x, y)) hits.push([i, polyArea(h.poly)]); });
  if(hits.length) return hits.sort((a,b) => a[1]-b[1]).map(t => t[0]);
  let best = -1, bd = tol;
  for(let i=0;i<cat.length;i++){ const d = Math.hypot(cat[i].x - x, cat[i].y - y); if(d < bd){ bd = d; best = i; } }
  return best >= 0 ? [best] : [];
}
function catHit(w, x, y, tol){ const l = catList(w, x, y, tol); return l.length ? l[0] : -1; }
/* contorni dall'aspetto dubbio: troppo piccoli/grandi, forma irregolare, sovrapposti ad altri */
function catSuspects(w){
  const cat = w.holds || [], W2 = w.w*w.w, out = new Set();
  const bb = cat.map(h => { let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(let i=0;i<h.poly.length;i+=2){ const x=h.poly[i], y=h.poly[i+1]; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } return [x0,y0,x1,y1]; });
  const ar = cat.map(h => polyArea(h.poly));
  /* i contorni disegnati a mano (es. i volumi) sono scelti apposta: non si segnalano, e le prese montate sopra non contano come sovrapposizioni */
  const manual = h => h.det !== 1;
  /* le prese confermate a mano ("Va bene") non si segnalano più */
  const okd = h => manual(h) || !!h.ok;
  cat.forEach((h,i) => {
    if(okd(h)) return;
    const f = ar[i]/W2, bw = bb[i][2]-bb[i][0], bh = bb[i][3]-bb[i][1];
    if(f < 1.2e-4 || f > 0.06) out.add(i);
    else if(Math.max(bw,bh)/Math.max(1,Math.min(bw,bh)) > 3.6) out.add(i);
    else if(ar[i]/(hullAreaFlat(h.poly) || 1) < 0.62) out.add(i);
  });
  for(let i=0;i<cat.length;i++) for(let j=i+1;j<cat.length;j++){
    if(manual(cat[i]) || manual(cat[j]) || (okd(cat[i]) && okd(cat[j]))) continue;
    if(bb[i][2] < bb[j][0] || bb[j][2] < bb[i][0] || bb[i][3] < bb[j][1] || bb[j][3] < bb[i][1]) continue;
    /* una presa piccola sopra una grande (presa su volume) è normale */
    if(Math.min(ar[i], ar[j]) < Math.max(ar[i], ar[j])*0.35) continue;
    if(inPoly(cat[i].poly, cat[j].x, cat[j].y) || inPoly(cat[j].poly, cat[i].x, cat[i].y)){
      /* se una delle due è confermata, il doppione da controllare è l'altra */
      if(okd(cat[i])) out.add(j); else if(okd(cat[j])) out.add(i);
      else { if(ar[i] >= ar[j]) out.add(i); if(ar[j] >= ar[i]) out.add(j); }
    }
  }
  return out;
}
function focusCat(w, ch){
  ui.zoom = Math.max(ui.zoom, 2.5); fit();
  requestAnimationFrame(() => {
    const box = $('#box'), st = $('#stage');
    box.scrollLeft = st.offsetLeft + ch.x*st.clientWidth/w.w - box.clientWidth/2;
    box.scrollTop = st.offsetTop + ch.y*st.clientHeight/w.h - box.clientHeight/2;
  });
}
function delCat(w, i){
  const ch = w.holds[i]; if(!ch) return;
  w.holds.splice(i, 1); ui.trash.push(ch); if(ui.trash.length > 30) ui.trash.shift();
  ui.csel = null; touch(); render();
}
function circlePoly(cx, cy, r){
  const p = []; for(let i=0;i<20;i++){ const a = i*Math.PI/10; p.push(Math.round(cx + r*Math.cos(a)), Math.round(cy + r*Math.sin(a))); }
  return p;
}
function syncCat(w, ch){
  w.circuits.forEach(c => c.holds.forEach(h => { if(h.cid === ch.id){ h.poly = ch.poly.slice(); h.x = ch.x; h.y = ch.y; } }));
}
async function resizeCat(w, ch, up){
  if(ch.det){
    const ts = clamp((ch.ts || 1) * (up ? 1.35 : 1/1.35), 0.4, 3);
    const res = await detect(w, ch.sx, ch.sy, ts);
    if(!res) return false;
    ch.poly = res.poly.map(v => Math.round(v)); ch.x = res.cx; ch.y = res.cy; ch.ts = ts;
  } else {
    const f = up ? 1.15 : 1/1.15;
    ch.poly = ch.poly.map((v,i) => Math.round(i % 2 === 0 ? ch.x + (v - ch.x)*f : ch.y + (v - ch.y)*f));
  }
  syncCat(w, ch); return true;
}
function finishDraw(w){
  const pts = ui.draft; if(pts.length < 3) return;
  const flat = []; pts.forEach(q => { flat.push(q[0], q[1]); });
  let A = 0, cx = 0, cy = 0;
  for(let i=0;i<pts.length;i++){ const a = pts[i], b = pts[(i+1) % pts.length], c = a[0]*b[1] - b[0]*a[1]; A += c; cx += (a[0]+b[0])*c; cy += (a[1]+b[1])*c; }
  if(Math.abs(A) < 1){ cx = pts.reduce((t,q) => t + q[0], 0)/pts.length; cy = pts.reduce((t,q) => t + q[1], 0)/pts.length; }
  else { A /= 2; cx /= 6*A; cy /= 6*A; }
  w.holds = w.holds || [];
  if(ui.redraw != null && w.holds[ui.redraw]){
    const ch = w.holds[ui.redraw];
    ch.poly = flat; ch.x = cx; ch.y = cy; ch.sx = cx; ch.sy = cy; ch.det = 0; delete ch.ts;
    syncCat(w, ch); ui.csel = ui.redraw;
  } else {
    w.holds.push({ id: uid(), poly: flat, x: cx, y: cy, sx: cx, sy: cy, det: 0 });
    ui.csel = w.holds.length - 1;
  }
  ui.draft = []; ui.redraw = null; touch(); render();
}
function polyPath(p){
  let d = 'M' + p[0] + ',' + p[1];
  for(let i=2;i<p.length;i+=2) d += 'L' + p[i] + ',' + p[i+1];
  return d + 'Z';
}

/* ---------- disegno ---------- */
/* ---- etichette: tonde, tangenti al contorno della presa, nel punto che copre meno linee e prese ---- */
function holdPts(h, W, scale){
  if(h.poly) return h.poly;
  const r = h.r*W*(scale || 1), p = [];
  for(let k=0;k<20;k++){ const a = k/20*Math.PI*2; p.push(h.x + Math.cos(a)*r, h.y + Math.sin(a)*r); }
  return p;
}
function segDist(px, py, x1, y1, x2, y2){
  const dx = x2-x1, dy = y2-y1, L = dx*dx + dy*dy;
  let t = L ? ((px-x1)*dx + (py-y1)*dy)/L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - x1 - t*dx, py - y1 - t*dy);
}
function polyDist(px, py, p){
  if(inPoly(p, px, py)) return 0;
  let m = 1e9;
  for(let i=0, j=p.length-2; i<p.length; j=i, i+=2){ const d = segDist(px, py, p[j], p[j+1], p[i], p[i+1]); if(d < m) m = d; }
  return m;
}
function rayExit(p, cx, cy, dx, dy){
  let best = 0;
  for(let i=0, j=p.length-2; i<p.length; j=i, i+=2){
    const x1 = p[j], y1 = p[j+1], ex = p[i]-x1, ey = p[i+1]-y1, den = dx*ey - dy*ex;
    if(Math.abs(den) < 1e-9) continue;
    const t = ((x1-cx)*ey - (y1-cy)*ex)/den, u = ((x1-cx)*dy - (y1-cy)*dx)/den;
    if(t > best && u >= 0 && u <= 1) best = t;
  }
  return best;
}
/* mappa "foto piena": dove c'è una presa o un colore che si stacca dal pannello (bassa risoluzione, calcolata una volta per foto) */
const busyCache = {};
function busyMap(w){
  const key = w.id + '|' + String(w.img).length + String(w.img).slice(-24);
  const e = busyCache[w.id];
  if(e && e.key === key) return e.map;
  if(e && e.key === key + ':pending') return null;
  busyCache[w.id] = { key: key + ':pending', map: null };
  loadImg(w.img).then(im => {
    const s = 280 / Math.max(w.w, w.h), bw = Math.max(8, Math.round(w.w*s)), bh = Math.max(8, Math.round(w.h*s));
    const cv = document.createElement('canvas'); cv.width = bw; cv.height = bh;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, bw, bh);
    const d = g.getImageData(0, 0, bw, bh).data, N = bw*bh, lum = new Float32Array(N), sat = new Float32Array(N);
    for(let i=0;i<N;i++){ const r = d[i*4]/255, gg = d[i*4+1]/255, b = d[i*4+2]/255, mx = Math.max(r,gg,b), mn = Math.min(r,gg,b); lum[i] = 0.3*r + 0.59*gg + 0.11*b; sat[i] = mx > 0.15 ? (mx-mn)/mx : 0; }
    /* luminosità media locale (finestra larga) con immagine integrale */
    const I = new Float64Array((bw+1)*(bh+1));
    for(let y=0;y<bh;y++){ let row = 0; for(let x=0;x<bw;x++){ row += lum[y*bw+x]; I[(y+1)*(bw+1)+x+1] = I[y*(bw+1)+x+1] + row; } }
    const R = Math.max(4, Math.round(Math.max(bw, bh)*0.08)), out = new Float32Array(N);
    for(let y=0;y<bh;y++) for(let x=0;x<bw;x++){
      const x0 = Math.max(0, x-R), x1 = Math.min(bw, x+R+1), y0 = Math.max(0, y-R), y1 = Math.min(bh, y+R+1);
      const m = (I[y1*(bw+1)+x1] - I[y0*(bw+1)+x1] - I[y1*(bw+1)+x0] + I[y0*(bw+1)+x0]) / ((x1-x0)*(y1-y0));
      const i = y*bw + x, v = Math.max((sat[i] - 0.25)/0.35, (Math.abs(lum[i] - m) - 0.07)/0.18);
      out[i] = Math.max(0, Math.min(1, v));
    }
    busyCache[w.id] = { key, map: { s, bw, bh, d: out } };
    try{ renderStage(); }catch(err){}
  }).catch(() => { busyCache[w.id] = { key, map: null }; });
  return null;
}
/* quanta parte della bolla cade su un'altra presa della foto. I punti sopra la presa stessa non contano
   (la bolla ci sta appoggiata per scelta): altrimenti ogni posizione risultava "mezza piena" e le prese vicine pesavano poco. */
function busyAt(m, x, y, r, own){
  if(!m) return 0;
  let t = 0, n = 0;
  const pad = r*0.2;
  for(let k=0;k<19;k++){
    const a = k*2.4, q = k === 0 ? 0 : Math.sqrt(k/18)*r*0.95, sx = x + Math.cos(a)*q, sy = y + Math.sin(a)*q;
    if(own && polyDist(sx, sy, own) < pad) continue;
    const px = Math.round(sx*m.s), py = Math.round(sy*m.s);
    if(px < 0 || py < 0 || px >= m.bw || py >= m.bh) continue;
    /* valori alti contano di più: un pezzo di presa sotto il numero disturba anche se il resto è pannello */
    const v = m.d[py*m.bw + px]; t += v > 0.5 ? 1 : v*v*2; n++;
  }
  return n ? t/n : 0;
}
/* etichette: una o più bolle, ognuna tangente al contorno della presa.
   Si calcola per 72 direzioni il punto in cui una bolla tocca appena la presa; le bolle di una presa con più passaggi
   si mettono in fila lungo il contorno (fuse tra loro), scegliendo partenza e verso che coprono meno linee, prese ed etichette. */
function bubbleCost(x, y, br, gap, env){
  let cost = 0;
  if(x - br < 0 || y - br < 0 || x + br > env.W || y + br > env.H) cost += 6;
  /* la bolla con il suo bordino e lo stacco scuro intorno: nessun contorno vicino deve toccarla */
  const lim = br*1.25 + gap;
  for(const q of env.shapes){
    if(q.bb.x0 - lim > x || q.bb.x1 + lim < x || q.bb.y0 - lim > y || q.bb.y1 + lim < y) continue;
    /* sopra (o a contatto con) un'altra presa del circuito: da evitare quasi a ogni costo */
    const d = polyDist(x, y, q.p); if(d < lim) cost += 6*(1 - d/lim) + (d === 0 ? 20 : d < br ? 12 : 0);
    else if(d < lim*2.2) cost += 0.8*(1 - (d - lim)/(lim*1.2));   /* anche oltre il contatto: meglio dove c'è più spazio libero */
  }
  for(const sg of env.segs){ const d = segDist(x, y, sg[0], sg[1], sg[2], sg[3]); if(d < lim) cost += 2.5*(1 - d/lim); }
  /* due numeri che si toccano si leggono male: costo alto finché non c'è aria tra le due bolle */
  for(const b of env.badges){ const d = Math.hypot(x - b[0], y - b[1]); if(d < br*2.9) cost += 9*(1 - d/(br*2.9)) + (d < br*2.25 ? 8 : 0); else if(d < br*5) cost += 0.8*(1 - (d - br*2.9)/(br*2.1)); }
  /* prese della foto non mappate: è il caso più comune sui muri dei circuiti, quindi pesa come un contorno mappato */
  return cost + 7*busyAt(env.busy, x, y, br, env.own);
}
function placeBubbles(h, W, br, gap, env, n, tw){
  const own = holdPts(h, W), bb = holdBox(h, W), cx = (bb.x0+bb.x1)/2, cy = (bb.y0+bb.y1)/2, N = 72;
  env.own = own;
  /* lato da cui si arriva: a parità di spazio libero, il numero va verso la presa precedente */
  const dirs = (tw || []).map(q => { if(!q) return null; const vx = q[0] - cx, vy = q[1] - cy, L = Math.hypot(vx, vy); return L > 1 ? [vx/L, vy/L] : null; });
  const hasDir = dirs.some(Boolean);
  const dirCost = (p, j) => { const d = dirs[j]; if(!d) return 0; const vx = p.x - cx, vy = p.y - cy, L = Math.hypot(vx, vy) || 1; return 2.0*(1 - (vx*d[0] + vy*d[1])/L)/2; };   /* solo a parità di spazio libero dalle prese del circuito */
  const T = [];
  for(let k=0;k<N;k++){
    const a = -Math.PI/4 + k/N*Math.PI*2, dx = Math.cos(a), dy = Math.sin(a);
    const t0 = rayExit(own, cx, cy, dx, dy);
    let t = t0 + gap, x = cx + dx*t, y = cy + dy*t;
    /* si parte appoggiati al bordo e ci si allontana a piccoli passi finché la bolla è fuori: così resta tangente */
    for(let g=0; g<80 && polyDist(x, y, own) < br + gap; g++){ t += br*0.12; x = cx + dx*t; y = cy + dy*t; }
    /* poi la bolla rientra un po' dentro il contorno della presa (circa un terzo del raggio) */
    t -= br*0.32 + gap; x = cx + dx*t; y = cy + dy*t;
    T.push({ x, y, k, c: bubbleCost(x, y, br, gap, env) + (t - t0)/br*0.15 + (hasDir ? 0 : Math.min(k, N-k)*0.007) });
    /* se lì intorno è affollato, la bolla può staccarsi un po' dalla presa (costa qualcosa, ma resta leggibile) */
    if(n <= 1) for(const ex of [0.9, 1.8, 2.7]){ const t2 = t + br*ex, x2 = cx + dx*t2, y2 = cy + dy*t2;
      T.push({ x: x2, y: y2, k, far: ex, c: bubbleCost(x2, y2, br, gap, env) + (t2 - t0)/br*0.15 + ex*1.2 + (hasDir ? 0 : Math.min(k, N-k)*0.007) }); }
  }
  if(n <= 1){ let best = T[0], bc = Infinity; for(const p of T){ const cc = p.c + dirCost(p, 0); if(cc < bc){ bc = cc; best = p; } } return [best]; }
  const step = br*1.45;
  let best = null;
  for(let s0=0; s0<N; s0++) for(const dir of [1, -1]){
    const chain = [T[s0]]; let idx = s0, ok = true;
    for(let j=1;j<n && ok;j++){
      const last = chain[chain.length-1]; let found = null;
      for(let m=1;m<N/2;m++){ const p = T[((idx + dir*m) % N + N) % N]; if(Math.hypot(p.x - last.x, p.y - last.y) >= step*0.95){ found = p; idx = p.k; break; } }
      if(!found) ok = false; else chain.push(found);
    }
    if(!ok) continue;
    /* senza presa precedente: i numeri si leggono da sinistra a destra (o dall'alto in basso) */
    if(!hasDir){ const f = chain[0], l = chain[chain.length - 1];
      if(Math.abs(f.x - l.x) > Math.abs(f.y - l.y) * 0.5 ? f.x > l.x : f.y > l.y) chain.reverse(); }
    /* con la presa precedente: il primo numero è quello più vicino al lato da cui si arriva */
    else { const d = dirs.find(Boolean), f = chain[0], l = chain[chain.length - 1];
      if((l.x - cx)*d[0] + (l.y - cy)*d[1] > (f.x - cx)*d[0] + (f.y - cy)*d[1]) chain.reverse(); }
    /* le bolle si accavallano tra loro: si conta il costo di ognuna, non le loro sovrapposizioni reciproche */
    const cost = chain.reduce((t, p, j) => t + p.c + dirCost(p, j), 0);
    if(!best || cost < best.cost) best = { cost, chain };
  }
  return best ? best.chain : [T[0]];
}
/* contorno rientrato verso l'interno di d: ogni vertice si sposta lungo la bisettrice delle normali dei due lati,
   senza superare il 45% della sua distanza dal centro (sulle prese piccole non si chiude su se stesso) */
function insetPoly(pl, d){
  const n = pl.length/2; if(n < 3) return pl;
  let A = 0, cx = 0, cy = 0;
  for(let i=0;i<n;i++){ const j = (i+1)%n; A += pl[2*i]*pl[2*j+1] - pl[2*j]*pl[2*i+1]; cx += pl[2*i]; cy += pl[2*i+1]; }
  cx /= n; cy /= n; const sg = A > 0 ? 1 : -1, out = [];
  for(let i=0;i<n;i++){
    const a = (i-1+n)%n, b = (i+1)%n, x = pl[2*i], y = pl[2*i+1];
    let e1x = x - pl[2*a], e1y = y - pl[2*a+1], e2x = pl[2*b] - x, e2y = pl[2*b+1] - y;
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
    /* normale interna: per un poligono antiorario (in coordinate schermo) è (-dy, dx) */
    const n1x = -e1y/l1*sg, n1y = e1x/l1*sg, n2x = -e2y/l2*sg, n2y = e2x/l2*sg;
    let bx = n1x + n2x, by = n1y + n2y; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
    const cosh = Math.max(0.5, bx*n1x + by*n1y);
    const k = Math.min(d/cosh, Math.hypot(cx - x, cy - y)*0.45);
    out.push(x + bx*k, y + by*k);
  }
  return out;
}
/* tasto sulla presa selezionata: "Accoppia" se è l'ultima presa segnata (il nuovo passaggio viene subito dopo),
   altrimenti "Secondo passaggio", "Terzo passaggio"… */
function dupLabel(c, i){
  if(!c || i == null || !c.holds[i]) return 'Accoppia';
  if(i === c.holds.length - 1) return 'Accoppia';
  const h = c.holds[i], same = c.holds.filter(q => q.cid != null && h.cid != null ? q.cid === h.cid : (Math.round(q.x) === Math.round(h.x) && Math.round(q.y) === Math.round(h.y))).length;
  return (['', 'Secondo', 'Terzo', 'Quarto', 'Quinto'][same] || 'Altro') + ' passaggio';
}
const LBL_CACHE = new Map();
function circuitSVG(c, W, alpha, o){
  const segs = [], labels = [];
  const sw = Math.max(2, W*0.0028), hw = sw*0.5;
  const col = colOf(c), ha = haloOf(col);
  let s = `<g opacity="${alpha}">`;
  if(o.lines && c.holds.length > 1){
    const lw = Math.max(3, W*0.0032), P = q => q[0].toFixed(1)+','+q[1].toFixed(1);
    const st = c.holds.filter(h => h.role === 'start'), rest = c.holds.filter(h => h.role !== 'start' && !isFoot(h));
    const paths = [];
    if(st.length >= 2 && rest.length){
      /* partenze a Y: ogni partenza raggiunge un punto d'incontro, da lì un solo tratto verso la prima presa */
      const mx = st.reduce((t,h) => t + h.x, 0)/st.length, my = st.reduce((t,h) => t + h.y, 0)/st.length, f = rest[0];
      const J = [mx + (f.x - mx)*0.45, my + (f.y - my)*0.45];
      st.forEach(h => paths.push([[h.x, h.y], J]));
      paths.push([J].concat(rest.map(h => [h.x, h.y])));
    } else paths.push(c.holds.filter(h => !isFoot(h)).map(h => [h.x, h.y]));
    paths.forEach(pl => { for(let k=1;k<pl.length;k++) segs.push([pl[k-1][0], pl[k-1][1], pl[k][0], pl[k][1]]); });
    const d = paths.map(pl => 'M' + pl.map(P).join('L')).join('');
    s += `<path d="${d}" fill="none" stroke="${ha}" stroke-opacity=".5" stroke-width="${lw*2.6}" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${lw}" stroke-dasharray="${lw*3} ${lw*2.2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const base = colOf(c);
  const grp = {};
  let seqN = 0;
  const seqOf = {};
  c.holds.forEach((h,i) => {
    if(h.role !== 'hold') return;
    seqN++; seqOf[i] = seqN;
    const key = h.cid != null ? ('c'+h.cid) : ('p'+Math.round(h.x)+'_'+Math.round(h.y));
    (grp[key] = grp[key] || []).push(i);
  });
  const starts = []; c.holds.forEach((h,i) => { if(h.role === 'start') starts.push(i); });
  if(starts.length > 1 && !o.boulder && !(o.lines && c.holds.some(h => h.role !== 'start' && !isFoot(h)))){
 for(let k=1;k<starts.length;k++){ const a = c.holds[starts[k-1]], b = c.holds[starts[k]]; segs.push([a.x, a.y, b.x, b.y]); }
    const p = starts.map(i => c.holds[i].x.toFixed(1)+','+c.holds[i].y.toFixed(1)).join(' ');
    const lw = Math.max(3, W*0.0032);
    s += `<polyline points="${p}" fill="none" stroke="${ha}" stroke-opacity=".6" stroke-width="${lw*2.2}" stroke-linecap="round"/>`+
         `<polyline points="${p}" fill="none" stroke="${base}" stroke-width="${lw*0.85}" stroke-dasharray="${lw*1.4} ${lw*1.4}" stroke-linecap="round"/>`;
  }
 /* centro delle prese di partenza (per orientare le tacche dei boulder) */
  const sHolds = o.boulder ? c.holds.filter(isStart) : [];
  const sCen = sHolds.length > 1 ? [sHolds.reduce((t,q) => t + q.x, 0)/sHolds.length, sHolds.reduce((t,q) => t + q.y, 0)/sHolds.length] : null;
 const handCol = h => !o.boulder && h.hand === 'L' ? S.prefs.handL : !o.boulder && h.hand === 'R' ? S.prefs.handR : base;
  c.holds.forEach((h,i) => {
    let col = isFoot(h) ? FOOT_COL : !o.boulder && h.hand === 'L' ? S.prefs.handL : !o.boulder && h.hand === 'R' ? S.prefs.handR : base, ha = isFoot(h) ? '#000' : haloOf(col);
    const dash = isFoot(h) ? ` stroke-dasharray="${(sw*2.4).toFixed(1)} ${(sw*1.5).toFixed(1)}"` : '';
    const key = h.cid != null ? ('c'+h.cid) : ('p'+Math.round(h.x)+'_'+Math.round(h.y));
    const g = h.role === 'hold' ? grp[key] : null, gi = g ? g.indexOf(i) : 0;
    /* passaggi sulla stessa presa: ogni "livello" è un contorno, dal più grande al più piccolo.
       Due passaggi consecutivi con mano sinistra e destra sono un accoppio: un solo contorno diviso a metà. */
    let lv = null;
    if(!o.boulder && g && g.length > 1){
      const levels = [];
      for(let k = 0; k < g.length;){
        const a1 = c.holds[g[k]], a2 = k + 1 < g.length ? c.holds[g[k+1]] : null;
        if(a2 && g[k+1] === g[k] + 1 && ((a1.hand === 'L' && a2.hand === 'R') || (a1.hand === 'R' && a2.hand === 'L'))){ levels.push({ split: true, idx: [g[k], g[k+1]] }); k += 2; }
        else { levels.push({ split: false, idx: [g[k]] }); k += 1; }
      }
      const li = levels.findIndex(L => L.idx.includes(i));
      lv = { n: li, split: levels[li].split, first: levels[li].idx[0] === i, lastSplit: levels[levels.length-1].split };
    }
    const split = !!(lv && lv.split);
    /* contorni dei passaggi successivi: rientrano di una distanza fissa (uno spessore e mezzo: le linee colorate restano separate solo dal bordino),
       così restano vicini al primo anche sulle prese grandi e sui volumi */
    const lvN = lv ? lv.n : gi, inset = lvN > 0 ? lvN*sw*1.5 : 0;
    const sc = (pl) => inset ? insetPoly(pl, inset) : pl;
    const rIn = rr0 => Math.max(rr0*0.5, rr0 - inset);
    /* boulder: tacche di partenza attaccate al contorno, come il manico di una lente.
       L'alone delle tacche va sotto il contorno, il colore sopra: nessuno stacco tra bordo e tacca. */
    const marks = o.boulder && isStart(h) ? ((o.mk && o.mk.get(h)) || markSegs(h, W, sCen, 0)) : null, tw = sw*1.6;
    const tack = (q, cl, wd, op) => `<path d="M${q[0].toFixed(1)},${q[1].toFixed(1)}L${q[2].toFixed(1)},${q[3].toFixed(1)}" stroke="${cl}" stroke-opacity="${op}" stroke-width="${wd}" stroke-linecap="butt" fill="none"/><circle cx="${q[2].toFixed(1)}" cy="${q[3].toFixed(1)}" r="${wd/2}" fill="${cl}" fill-opacity="${op}"/>`;
    if(marks) marks.forEach(q => { s += tack(q, ha, tw + hw*2, .55); });
    if(lv && !lv.first){ /* già disegnata col primo passaggio di questo livello */ }
    else if(split){
      const bb = holdBox(h, W), mx = (bb.x0 + bb.x1)/2, id = 'sp' + String(c.id).replace(/[^\w-]/g, '') + '_' + i;
      const shape = (cl) => { const hh = haloOf(cl);
        if(h.poly){ const d = polyPath(sc(h.poly));
          return `<path d="${d}" fill="none" stroke="${hh}" stroke-opacity=".55" stroke-width="${sw+hw*2}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${cl}" stroke-width="${sw*1.15}" stroke-linejoin="round"/>`; }
        const rr = rIn(h.r*W), rsw = Math.max(2, rr*0.10), rhw = rsw*0.55;
        return `<circle cx="${h.x}" cy="${h.y}" r="${rr}" fill="none" stroke="${hh}" stroke-opacity=".55" stroke-width="${rsw+rhw*2}"/><circle cx="${h.x}" cy="${h.y}" r="${rr}" fill="none" stroke="${cl}" stroke-width="${rsw}"/>`; };
      s += `<defs><clipPath id="${id}L" clipPathUnits="userSpaceOnUse"><rect x="${mx - 1e5}" y="-100000" width="100000" height="200000"/></clipPath>`+
           `<clipPath id="${id}R" clipPathUnits="userSpaceOnUse"><rect x="${mx}" y="-100000" width="100000" height="200000"/></clipPath></defs>`+
           `<g clip-path="url(#${id}L)">${shape(S.prefs.handL)}</g><g clip-path="url(#${id}R)">${shape(S.prefs.handR)}</g>`;
    }
    else if(h.poly){
      const poly = sc(h.poly);
      const d = polyPath(poly);
      s += `<path d="${d}" fill="${col}" fill-opacity="0" stroke="${ha}" stroke-opacity=".55" stroke-width="${sw+hw*2}" stroke-linejoin="round"/>`+
           `<path d="${d}" fill="none" stroke="${col}" stroke-width="${isFoot(h) ? sw*1.2 : sw}" stroke-linejoin="round"${dash}/>`;
    } else {
      const rr = rIn(h.r*W), rsw = Math.max(2, rr*0.10), rhw = rsw*0.55;
      s += `<circle cx="${h.x}" cy="${h.y}" r="${rr}" fill="none" stroke="${ha}" stroke-opacity=".55" stroke-width="${rsw+rhw*2}"/>`+
           `<circle cx="${h.x}" cy="${h.y}" r="${rr}" fill="none" stroke="${col}" stroke-width="${rsw}"${dash}/>`;
    }
    if(marks){ marks.forEach(q => { segs.push(q); s += tack(q, col, tw, 1); }); return; }
    let label = h.role === 'start' ? (starts.length > 1 && !o.boulder ? 'S' + (starts.indexOf(i)+1) : 'S') : h.role === 'top' ? 'T' : isFoot(h) ? 'P' : '';
    /* presa precedente del percorso (diversa da questa): il numero si mette dal lato da cui si arriva */
    const prevOf = j => { const me = c.holds[j]; for(let k = j - 1; k >= 0; k--){ const q = c.holds[k]; if(me.cid != null ? q.cid !== me.cid : (Math.abs(q.x - me.x) > 1 || Math.abs(q.y - me.y) > 1)) return [q.x, q.y]; } return null; };
    if(!label && o.numbers && h.role === 'hold'){
      if(gi < g.length - 1) return; /* i numeri si mettono una sola volta, sull'ultimo passaggio del gruppo */
      /* passaggi consecutivi (accoppio) = bolle fuse; passaggi lontani (es. 3 e 22) = bolle separate, ognuna al suo posto */
      const clusters = [];
      g.forEach(j => { const last = clusters[clusters.length-1]; if(last && j === last[last.length-1] + 1) last.push(j); else clusters.push([j]); });
      clusters.forEach(cl => {
        if(cl.length > 1) labels.push({ h: c.holds[g[0]], label: cl.map(j => seqOf[j]).join(','), col: base, ha: haloOf(base), segs: cl.map(j => ({ n: seqOf[j], col: handCol(c.holds[j]) })), tw: cl.map(prevOf) });
        else { const hc = handCol(c.holds[cl[0]]); labels.push({ h: c.holds[g[0]], label: String(seqOf[cl[0]]), col: hc, ha: haloOf(hc), segs: null, tw: [prevOf(cl[0])] }); }
      });
      return;
    }
    if(label){
      if(lv && lv.lastSplit){ col = base; ha = haloOf(base); }
      /* presa con più passaggi: etichetta a capsula, un numero per passaggio nel colore della sua mano */
      const segs = g && g.length > 1 && o.numbers && h.role === 'hold' ? g.map(j => ({ n: seqOf[j], col: handCol(c.holds[j]) })) : null;
      labels.push({ h: lv ? c.holds[g[0]] : h, label, col, ha, segs, tw: segs ? g.map(prevOf) : [h.role === 'start' ? null : prevOf(i)] });
    }
  });
  if(labels.length){
    const br = Math.max(W*0.018, 12), gap = Math.max(1.5, br*0.12);
    const shapes = [];
    const seen = new Set();
    c.holds.forEach(h => { const k = h.cid != null ? 'c'+h.cid : h.x+'_'+h.y; if(seen.has(k)) return; seen.add(k); const p = holdPts(h, W); shapes.push({ p, bb: holdBox(h, W), cid: h.cid, h }); });
    /* le prese che non fanno parte del circuito non contano: un numero sopra una presa qualsiasi si legge bene,
       sopra una presa del circuito invece non si capisce di chi è */
    const env = { W, H: o.H || 1e9, segs, badges: [], shapes: [], busy: null };
    /* posizioni: un primo giro in ordine, poi due giri di ritocco in cui ogni numero vede anche quelli venuti dopo */
    /* le posizioni costano (tre giri di ricerca): si ricordano finché il circuito e la vista non cambiano */
    const ckey = [c.id, W, br, o.lines ? 1 : 0, o.boulder ? 1 : 0, 'v2', labels.map(L => L.label + '@' + Math.round(L.h.x) + ',' + Math.round(L.h.y)).join('|'),
      c.holds.map(h => (h.cid || '') + Math.round(h.x) + ',' + Math.round(h.y) + h.role + (h.hand || '') + (h.poly ? h.poly.length : 0)).join('|')].join('#');
    const cached = LBL_CACHE.get(ckey);
    const P = cached ? cached.map(ps => ps.map(p => ({ x: p.x, y: p.y }))) : [];
    const place = li => { const L = labels[li];
      env.shapes = shapes.filter(q => q.h !== L.h && !(q.cid != null && q.cid === L.h.cid));
      env.badges = []; P.forEach((ps, j) => { if(j !== li && ps) ps.forEach(p => env.badges.push([p.x, p.y])); });
      /* più passaggi: bolle fuse, una per passaggio, ognuna nel colore della sua mano e tangente alla presa */
      P[li] = placeBubbles(L.h, W, br, gap, env, L.segs ? L.segs.length : 1, L.tw); };
    if(!cached){
      labels.forEach((L, li) => place(li));
      for(let r = 0; r < 2; r++) labels.forEach((L, li) => place(li));
      LBL_CACHE.set(ckey, P.map(ps => ps.map(p => ({ x: p.x, y: p.y }))));
      if(LBL_CACHE.size > 60) LBL_CACHE.delete(LBL_CACHE.keys().next().value);
    }
    labels.forEach((L, li) => {
      const ps = P[li], pos = ps[0];
      if(L.segs){
        const hw = br*0.22;
        s += ps.map(p => `<circle cx="${p.x}" cy="${p.y}" r="${br + hw/2}" fill="#ffffff" fill-opacity=".8"/>`).join('')+
             L.segs.map((g2, k) => `<circle cx="${ps[k].x}" cy="${ps[k].y}" r="${br - hw/2}" fill="${g2.col}"/>`).join('')+
             L.segs.map((g2, k) => { const nx = ps[k+1] ? ps[k].x - (ps[k+1].x - ps[k].x)*0.12 : ps[k].x, ny = ps[k+1] ? ps[k].y - (ps[k+1].y - ps[k].y)*0.12 : ps[k].y;
               return `<text x="${nx}" y="${ny}" dy=".35em" text-anchor="middle" font-family="Barlow Semi Condensed, Arial, sans-serif" font-weight="700" font-size="${br*1.02}" fill="${inkOn(g2.col)}">${g2.n}</text>`; }).join('');
        return;
      }
      const bx = pos.x.toFixed(1), by = pos.y.toFixed(1);
      /* forme diverse: partenza quadrata, arrivo a rombo, prese intermedie tonde */
      if(L.label === 'P'){   /* piede obbligato: bollino giallo con l'impronta */
        const k = br/10;
        s += `<circle cx="${bx}" cy="${by}" r="${br*0.92}" fill="${FOOT_COL}" stroke="#000" stroke-opacity=".7" stroke-width="${br*0.22}"/>`+
          `<g fill="#141414" transform="translate(${bx} ${by}) scale(${k.toFixed(3)})"><path d="M-1.6,7.2c-2.6,0-3.6-2.4-3.2-5.2.4-2.6,1.2-5.3,3.6-5.3s3.4,2.2,3.3,4.6C2,4.2,1,7.2-1.6,7.2z"/><circle cx="-2.6" cy="-6.2" r="1.25"/><circle cx="-0.2" cy="-6.9" r="1.1"/><circle cx="1.9" cy="-6.1" r="1"/><circle cx="3.4" cy="-4.4" r=".9"/></g>`;
        return;
      }
      const isS = /^S\d*$/.test(L.label), isT = L.label === 'T', bst = `fill="${L.col}" stroke="${L.ha}" stroke-opacity=".7" stroke-width="${br*0.22}"`;
      s += (isS ? `<rect x="${(pos.x - br*0.95).toFixed(1)}" y="${(pos.y - br*0.95).toFixed(1)}" width="${(br*1.9).toFixed(1)}" height="${(br*1.9).toFixed(1)}" rx="${(br*0.32).toFixed(1)}" ${bst}/>` :
            isT ? `<path d="M${bx},${(pos.y - br*1.32).toFixed(1)}L${(pos.x + br*1.32).toFixed(1)},${by}L${bx},${(pos.y + br*1.32).toFixed(1)}L${(pos.x - br*1.32).toFixed(1)},${by}Z" stroke-linejoin="round" ${bst}/>` :
            `<circle cx="${bx}" cy="${by}" r="${br}" ${bst}/>`)+
           `<text x="${bx}" y="${by}" dy=".35em" text-anchor="middle" font-family="Barlow Semi Condensed, Arial, sans-serif" font-weight="700" font-size="${br*(L.label.length>3?0.62:L.label.length>2?0.8:1.02)}" fill="${inkOn(L.col)}">${L.label}</text>`;
    });
  }
  return s + '</g>';
}
/* punti e linea del disegno restano della stessa misura sullo schermo anche ingrandendo, così il contorno resta visibile */
/* modalità disegno del contorno (scheda Muro → Disegna, oppure "Disegna a mano" dei boulder) */
const drawMode = () => EDIT && ((S.mode === 'wall' && ui.tool === 'draw') || (S.mode === 'edit' && !!ui.bdraw));
function draftSVG(w){ return ui.draft.length ? `<g id="draftg">${draftInner(w)}</g>` : ''; }
function draftInner(w){
  if(!ui.draft.length) return '';
  const st = $('#stage'), px = st && st.clientWidth ? w.w / st.clientWidth : w.w / 400;   /* un pixel di schermo, in pixel della foto */
  const t = Math.max(0.5, px*1.6), pts = ui.draft.map(q => q[0] + ',' + q[1]).join(' ');
  let s = `<polyline points="${pts}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="${t*3}" stroke-linejoin="round" stroke-linecap="round"/>`+
          `<polyline points="${pts}" fill="none" stroke="#ff3b7a" stroke-width="${t*1.4}" stroke-linejoin="round" stroke-linecap="round"/>`;
  ui.draft.forEach((q,i) => { s += `<circle cx="${q[0]}" cy="${q[1]}" r="${i === 0 ? t*2.6 : t*1.5}" fill="${i === 0 ? '#ff3b7a' : '#fff'}" stroke="#000" stroke-width="${t*0.5}"/>`; });
  return s;
}
/* boulder: contorno disegnato a mano (nuova presa, oppure ridisegna quella selezionata) */
/* boulder: segni di partenza "come in gara". Ogni segno è un punto toccato sulla presa; si disegna come una tacca
   che esce dal contorno in quella direzione. Al massimo 4 (mani e piedi). */
const isStart = h => h && (h.role === 'start' || h.role === 'foot');
function startMarks(c){ return c ? c.holds.reduce((t, h) => t + (isStart(h) ? Math.max(1, (h.marks || []).length) : 0), 0) : 0; }
function addMark(c, h, x, y){
  if(startMarks(c) >= 4 && isStart(h)){ toast('Ci sono già 4 punti di partenza.'); return; }
  const prev = isStart(h) ? null : { role: h.role, marks: h.marks };
  if(prev){ if(startMarks(c) >= 4){ toast('Ci sono già 4 punti di partenza.'); return; } h.role = 'start'; h.marks = []; }
  (h.marks = h.marks || []).push([Math.round(x), Math.round(y)]);
  ui.markUndo = { h, prev }; touch(); render();
}
/* disposizione automatica delle tacche, come i nastri in gara:
   - una tacca per presa: esce dal lato rivolto al centro delle partenze e punta verso di esso;
   - più tacche sulla stessa presa (2, 3 o 4): parallele, una accanto all'altra, dal lato rivolto al centro.
   La tacca parte appena fuori dal contorno, senza coprire la presa. */
function markSegs(h, W, C, off, dir){
  const pts = holdPts(h, W), bb = holdBox(h, W), cx = (bb.x0+bb.x1)/2, cy = (bb.y0+bb.y1)/2;
  const n = Math.max(1, Math.min(4, (h.marks || []).length));
  const L = Math.max(W*0.03, 14);
  /* direzione: verso il centro delle partenze; se la presa è l'unica, dove ha toccato il tracciatore (o in basso) */
  let ux = 0, uy = 0;
  if(C && Math.hypot(C[0]-cx, C[1]-cy) > Math.max(bb.x1-bb.x0, bb.y1-bb.y0)*0.25){ ux = C[0]-cx; uy = C[1]-cy; }
  else (h.marks || []).forEach(m => { const dx = m[0]-cx, dy = m[1]-cy, l = Math.hypot(dx, dy); if(l > 1){ ux += dx/l; uy += dy/l; } });
  let ul = Math.hypot(ux, uy); if(ul < 1e-6){ ux = 0; uy = 1; ul = 1; }
  ux /= ul; uy /= ul;
  if(dir){ ux = dir[0]; uy = dir[1]; }
  const vx = -uy, vy = ux;
  const exitAlong = (sx, sy, dx, dy) => { const t = rayExit(pts, sx, sy, dx, dy); return [sx + dx*t, sy + dy*t]; };
  if(n >= 2){
    let lo = 1e9, hi = -1e9; for(let i=0;i<pts.length;i+=2){ const o = (pts[i]-cx)*vx + (pts[i+1]-cy)*vy; lo = Math.min(lo, o); hi = Math.max(hi, o); }
    /* coppie e terzetti: tacche strette, quasi a contatto; i quartetti si allargano sulla presa */
    const swm = Math.max(2, W*0.0028), tight = swm*3.4;
    const gapv = n < 4 ? Math.min(tight, (hi - lo)*0.8/(n - 1)) : Math.min((hi - lo)*0.8/(n - 1), L*0.5), mid = (lo + hi)/2;
    return Array.from({length: n}, (_, j) => j - (n - 1)/2).map(k => {
      const sx = cx + vx*(mid + k*gapv), sy = cy + vy*(mid + k*gapv), e = exitAlong(sx, sy, ux, uy);
      return [e[0] + ux*off, e[1] + uy*off, e[0] + ux*(off + L), e[1] + uy*(off + L)];
    });
  }
  const e0 = exitAlong(cx, cy, ux, uy);
  return [[e0[0] + ux*off, e0[1] + uy*off, e0[0] + ux*(off + L), e0[1] + uy*(off + L)]];
}
/* tacche di tutto il settore, scelte una volta sola: ogni tacca parte dalla direzione preferita (verso il centro
   delle partenze) e, se lì coprirebbe un'altra presa o un'altra tacca, ruota fino al primo spazio libero */
const marksCache = {};
function wallMarks(w){
  const W = w.w, key = W + '|' + w.circuits.map(c => c.id + (isOff(c) ? 'x' : '') + ':' + c.holds.map(h => Math.round(h.x) + ',' + Math.round(h.y) + h.role + ((h.marks || []).length) + (h.poly ? h.poly.length : 'c')).join(';')).join('|');
  const ce = marksCache[w.id]; if(ce && ce.key === key) return ce.map;
  const map = new Map(), placed = [], all = [];
  w.circuits.forEach(c => c.holds.forEach(h => all.push(h)));
  const tw = Math.max(2, W*0.0028)*1.6;
  /* una tacca deve stare lontana dalle altre prese almeno un paio di spessori (dentro o troppo vicino conta uguale) */
  const shapes = all.map(o => { const p = holdPts(o, W), b = holdBox(o, W); return { o, p, b }; });
  const inHold = (x, y, self) => { const m = tw*2; return shapes.some(({ o, p, b }) => o !== self && !(Math.abs(o.x - self.x) < 1 && Math.abs(o.y - self.y) < 1) &&
    x > b.x0 - m && x < b.x1 + m && y > b.y0 - m && y < b.y1 + m && (inPoly(p, x, y) || polyDist(x, y, p) < m)); };
  const cost = (segs, h) => {
    let c = 0;
    segs.forEach(q => {
      for(let k = 0; k <= 6; k++){
        const t = k/6, x = q[0] + (q[2]-q[0])*t, y = q[1] + (q[3]-q[1])*t;
        if(x < 0 || y < 0 || x > W || y > w.h) c += 20;
        if(inHold(x, y, h)) c += 10;
        for(const p of placed) if(segDist(x, y, p[0], p[1], p[2], p[3]) < tw*2.2) c += 8;
      }
    });
    return c;
  };
  const order = w.circuits.filter(c => !isOff(c)).concat(w.circuits.filter(isOff));
  order.forEach(c => {
    const ss = c.holds.filter(isStart); if(!ss.length) return;
    const C = ss.length > 1 ? [ss.reduce((t, q) => t + q.x, 0)/ss.length, ss.reduce((t, q) => t + q.y, 0)/ss.length] : null;
    ss.forEach(h => {
      const base = markSegs(h, W, C, 0), u = [base[0][2] - base[0][0], base[0][3] - base[0][1]], ul = Math.hypot(u[0], u[1]) || 1;
      const a0 = Math.atan2(u[1]/ul, u[0]/ul);
      let best = base, bc = cost(base, h);
      if(bc > 0) for(let k = 1; k <= 12 && bc > 0; k++) for(const sgn of [1, -1]){
        const a = a0 + sgn*k*Math.PI/12, segs = markSegs(h, W, C, 0, [Math.cos(a), Math.sin(a)]);
        const cc = cost(segs, h) + k*0.6;
        if(cc < bc){ bc = cc; best = segs; }
      }
      map.set(h, best); best.forEach(q => placed.push(q));
    });
  });
  marksCache[w.id] = { key, map };
  return map;
}
function finishBDraw(w, c){
  const pts = ui.draft; if(!c || pts.length < 3) return;
  const flat = []; pts.forEach(q => { flat.push(q[0], q[1]); });
  let A = 0, cx = 0, cy = 0;
  for(let i=0;i<pts.length;i++){ const a = pts[i], b = pts[(i+1) % pts.length], k = a[0]*b[1] - b[0]*a[1]; A += k; cx += (a[0]+b[0])*k; cy += (a[1]+b[1])*k; }
  if(Math.abs(A) < 1){ cx = pts.reduce((t,q) => t + q[0], 0)/pts.length; cy = pts.reduce((t,q) => t + q[1], 0)/pts.length; }
  else { A /= 2; cx /= 6*A; cy /= 6*A; }
  const old = ui.sel != null ? c.holds[ui.sel] : null;
  if(old){ old.poly = flat; old.x = cx; old.y = cy; old.sx = cx; old.sy = cy; old.drawn = 1; delete old.ts; }
  else { c.holds.push({ x: cx, y: cy, sx: cx, sy: cy, r: S.prefs.r, role: ui.nextRole, poly: flat, drawn: 1 }); if(ui.nextRole !== 'start') ui.nextRole = 'hold'; }
  ui.draft = []; ui.bdraw = false; ui.sel = null; ui.markUndo = null; touch(); render();
}
/* boulder: linea indicativa disegnata a mano dal tracciatore (direzione generale, non le prese) */
/* linea automatica. Parte dalla zona tra le prese di partenza e i piedi di partenza e arriva al Top;
   la direzione la dà la posizione media delle prese in 3 fasce (non l'ordine in cui sono state segnate).
   Poi il percorso si cerca su una griglia della foto che evita le prese: quelle segnate in tutti i boulder
   del settore e quelle che si vedono nella foto (colore/contrasto). Infine si tira dritto dove si può. */
const lineCache = {};
function autoLine(c, w){
  const H = c.holds, W = w.w; if(H.length < 2) return null;
  const avg = l => [l.reduce((t,h) => t + h.x, 0)/l.length, l.reduce((t,h) => t + h.y, 0)/l.length];
  const st = H.filter(isStart), tops = H.filter(h => h.role === 'top');
  /* partenza della linea: sotto i punti di partenza (mani e piedi) */
  const st0 = st.length ? st : [H[0]];
  const sBot = Math.max(...st0.map(h => holdBox(h, W).y1));
  const S = [avg(st0)[0], Math.min(sBot + W*0.025, w.h - W*0.01)];
  let T = tops.length ? avg(tops) : null;
  if(!T){ let far = H[0]; H.forEach(h => { if(Math.hypot(h.x-S[0], h.y-S[1]) > Math.hypot(far.x-S[0], far.y-S[1])) far = h; }); T = [far.x, far.y]; }
  const ax = T[0]-S[0], ay = T[1]-S[1], L2 = ax*ax + ay*ay; if(L2 < 1) return null;
  const mid = H.filter(h => h.role === 'hold'), K = 3, bins = Array.from({length:K}, () => []);
  mid.forEach(h => { const t = ((h.x-S[0])*ax + (h.y-S[1])*ay)/L2; if(t > 0.02 && t < 0.98) bins[Math.min(K-1, Math.floor(t*K))].push(h); });
  const guide = [S]; bins.forEach(b => { if(b.length) guide.push(avg(b)); }); guide.push(T);
  const bm = busyMap(w);
  const key = JSON.stringify([guide.map(q => q.map(Math.round)), w.circuits.map(x => x.holds.length + ':' + (x.holds[0] ? Math.round(x.holds[0].x) : 0) + ':' + x.holds.map(h => isStart(h) ? (h.marks || []).length : '').join('')), !!bm]);
  const ce = lineCache[c.id]; if(ce && ce.key === key) return ce.pts;
  let pts = routeLine(w, guide, bm, sBot);
  if(!pts) pts = guide;
  const out = pts.flatMap(q => [Math.round(q[0]), Math.round(q[1])]);
  lineCache[c.id] = { key, pts: out };
  return out;
}
function routeLine(w, guide, bm, sBot){
  const W = w.w, Hh = w.h, s = bm ? bm.s : 140 / Math.max(W, Hh);
  const gw = bm ? bm.bw : Math.max(8, Math.round(W*s)), gh = bm ? bm.bh : Math.max(8, Math.round(Hh*s)), N = gw*gh;
  /* ostacoli: 0 parete libera … 1 presa */
  const O0 = new Float32Array(N), B = new Float32Array(N);
  if(bm) for(let i=0;i<N;i++) B[i] = bm.d[i];
  w.circuits.forEach(x => { if(isOff(x)) return; x.holds.forEach(h => {
    const p = h.poly ? h.poly : null, bb = holdBox(h, W);
    const x0 = Math.max(0, Math.floor(bb.x0*s)), x1 = Math.min(gw-1, Math.ceil(bb.x1*s)), y0 = Math.max(0, Math.floor(bb.y0*s)), y1 = Math.min(gh-1, Math.ceil(bb.y1*s));
    for(let yy=y0; yy<=y1; yy++) for(let xx=x0; xx<=x1; xx++){
      const px = (xx+0.5)/s, py = (yy+0.5)/s;
      if(p ? inPoly(p, px, py) : Math.hypot(px-h.x, py-h.y) <= h.r*W) O0[yy*gw+xx] = 1;
    }
  }); });
  /* anche le tacche di partenza sono ostacoli */
  wallMarks(w).forEach(segs => segs.forEach(q => {
      const n = Math.ceil(Math.hypot(q[2]-q[0], q[3]-q[1])*s*2) + 1;
      for(let k=0;k<=n;k++){ const gx = Math.round((q[0] + (q[2]-q[0])*k/n)*s - 0.5), gy = Math.round((q[1] + (q[3]-q[1])*k/n)*s - 0.5);
        if(gx >= 0 && gy >= 0 && gx < gw && gy < gh) O0[gy*gw+gx] = 1; }
  }));

  /* allargo di una cella: la linea ha uno spessore */
  const O = new Float32Array(N);
  for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){
    let m = 0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const xx = x+dx, yy = y+dy; if(xx>=0 && yy>=0 && xx<gw && yy<gh){ const v = O0[yy*gw+xx]*(dx||dy ? 0.85 : 1); if(v > m) m = v; } }
    O[y*gw+x] = m;
  }
  /* prese viste nella foto: si evitano, ma con meno forza di quelle segnate (sono tante e farebbero zig-zag) */
  const Bs = new Float32Array(N);
  for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){ let m = 0; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const xx = x+dx, yy = y+dy; if(xx>=0 && yy>=0 && xx<gw && yy<gh) m = Math.max(m, B[yy*gw+xx]*(dx||dy ? 0.7 : 1)); } Bs[y*gw+x] = m; }
  /* distanza dalla linea guida, per non allontanarsi dalla zona del blocco */
  const G = guide.map(q => [q[0]*s, q[1]*s]), span = Math.max(4, Math.hypot(G[G.length-1][0]-G[0][0], G[G.length-1][1]-G[0][1])*0.12);
  const gd = (x, y) => { let d = 1e9; for(let k=0;k<G.length-1;k++) d = Math.min(d, segDist(x, y, G[k][0], G[k][1], G[k+1][0], G[k+1][1])); return d; };
  const cost = new Float32Array(N); for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){ const d = gd(x+0.5, y+0.5)/span; cost[y*gw+x] = 1 + 60*O[y*gw+x] + 4*Bs[y*gw+x]*Bs[y*gw+x] + 0.5*d*d; }
  const cl = (v, m) => Math.max(0, Math.min(m-1, Math.round(v)));
  /* partenza e arrivo: il punto di parete libera più vicino (non si parte né si arriva sopra una presa) */
  /* si cerca solo dalla parte dell'altra estremità: la linea non deve girare attorno alle prese di partenza o al Top */
  const freeNear = (x0, y0, toward, back, minY) => { let best = null, bd = 1e9;
    const L = Math.hypot(toward[0]-x0, toward[1]-y0) || 1, ux = (toward[0]-x0)/L, uy = (toward[1]-y0)/L;
    for(let dy=-8; dy<=8; dy++) for(let dx=-8; dx<=8; dx++){ const x = x0+dx, y = y0+dy; if(x<0 || y<0 || x>=gw || y>=gh) continue;
      if(dx*ux + dy*uy < -back || y < minY) continue;
      const i = y*gw+x; if(O[i] >= 0.3 || Bs[i] >= 0.5) continue;
      const d = Math.hypot(dx, dy) + 0.6*Math.abs(dx*uy - dy*ux); if(d < bd){ bd = d; best = [x, y]; } }
    return best || [x0, y0]; };
  const g0 = [cl(G[0][0]-0.5, gw), cl(G[0][1]-0.5, gh)], g1 = [cl(G[G.length-1][0]-0.5, gw), cl(G[G.length-1][1]-0.5, gh)];
  const [sx, sy] = freeNear(g0[0], g0[1], g1, 99, Math.ceil(sBot*s)), [tx, ty] = freeNear(g1[0], g1[1], g0, 0, -1);
  /* A* su 8 vicini */
  const dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const heap = []; const push = (i, f) => { heap.push([f, i]); let k = heap.length-1; while(k){ const p = (k-1)>>1; if(heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if(heap.length){ heap[0] = last; let k = 0; for(;;){ const l = 2*k+1, r = l+1; let m = k; if(l < heap.length && heap[l][0] < heap[m][0]) m = l; if(r < heap.length && heap[r][0] < heap[m][0]) m = r; if(m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const s0 = sy*gw+sx, t0 = ty*gw+tx; dist[s0] = 0; push(s0, 0);
  const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  while(heap.length){
    const [, i] = pop(); if(done[i]) continue; done[i] = 1; if(i === t0) break;
    const x = i % gw, y = (i - x)/gw;
    for(const [dx, dy, l] of NB){
      const xx = x+dx, yy = y+dy; if(xx<0 || yy<0 || xx>=gw || yy>=gh) continue;
      const j = yy*gw+xx; if(done[j]) continue;
      const nd = dist[i] + l*(cost[i] + cost[j])/2;
      if(nd < dist[j]){ dist[j] = nd; prev[j] = i; push(j, nd + Math.hypot(tx-xx, ty-yy)); }
    }
  }
  if(prev[t0] < 0 && t0 !== s0) return null;
  const path = []; for(let i = t0; i >= 0; i = prev[i]){ path.push([i % gw + 0.5, Math.floor(i / gw) + 0.5]); if(i === s0) break; }
  path.reverse();
  const at = q => O[cl(q[1]-0.5, gh)*gw + cl(q[0]-0.5, gw)];
  const atB = q => Bs[cl(q[1]-0.5, gh)*gw + cl(q[0]-0.5, gw)];
  const P = path; if(P.length < 2) return null;
  /* ammorbidisco: ogni punto si avvicina alla media dei vicini, ma solo se non finisce su una presa */
  const Q = P.map(q => q.slice());
  for(let it=0; it<120; it++){
    for(let k=1;k<Q.length-1;k++){
      const u = Math.max(0, k-2), v = Math.min(Q.length-1, k+2);
      const mx = (Q[k-1][0] + Q[k+1][0] + Q[u][0] + Q[v][0])/4, my = (Q[k-1][1] + Q[k+1][1] + Q[u][1] + Q[v][1])/4;
      const c2 = [Q[k][0] + (mx - Q[k][0])*0.5, Q[k][1] + (my - Q[k][1])*0.5];
      const o2 = at(c2), b2 = atB(c2); if((o2 < 0.35 || o2 <= at(Q[k])) && (b2 < 0.7 || b2 <= atB(Q[k]) + 0.1)) Q[k] = c2;
    }
  }
  const out = rdpPts(Q, 0.5);
  return out.map(q => [q[0]/s, q[1]/s]);
}
/* boulder: linea indicativa (disegnata a mano dal tracciatore, oppure automatica). Non copre le prese del blocco. */
function lineSVG(pts, W, col, c, k){
  if(!pts || pts.length < 4) return '';
  const p = []; for(let i=0;i<pts.length;i+=2) p.push([pts[i], pts[i+1]]);
  let d = 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1);
  for(let i=0;i<p.length-1;i++){
    const p0 = p[Math.max(0, i-1)], p1 = p[i], p2 = p[i+1], p3 = p[Math.min(p.length-1, i+2)];
    d += 'C' + (p1[0] + (p2[0]-p0[0])/6).toFixed(1) + ',' + (p1[1] + (p2[1]-p0[1])/6).toFixed(1) + ' ' + (p2[0] - (p3[0]-p1[0])/6).toFixed(1) + ',' + (p2[1] - (p3[1]-p1[1])/6).toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
  }
  const lw = Math.max(2, W*0.008*(k || 1));
  let mask = '', mattr = '';
  if(c){
    const id = 'lm' + String(c.id).replace(/[^\w-]/g, '');
    const holes = c.holds.map(h => h.poly ? `<path d="${polyPath(h.poly)}" fill="#000" stroke="#000" stroke-width="${lw*2.2}" stroke-linejoin="round"/>` : `<circle cx="${h.x}" cy="${h.y}" r="${h.r*W*1.2}" fill="#000"/>`).join('');
    mask = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100000" height="100000"><rect x="0" y="0" width="100000" height="100000" fill="#fff"/>${holes}</mask></defs>`;
    mattr = ` mask="url(#${id})"`;
  }
  const light = lum(col) > 0.85;
  return mask + `<g${mattr}><path d="${d}" fill="none" stroke="${haloOf(col)}" stroke-opacity="${light ? .85 : .45}" stroke-width="${lw*(light ? 2.3 : 1.9)}" stroke-linecap="round" stroke-linejoin="round"/>`+
         `<path d="${d}" fill="none" stroke="${col}" stroke-opacity=".95" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
/* dal tratto del dito a pochi punti puliti: si tengono quelli distanti almeno 2,5% della foto e poi si semplifica */
function cleanLine(raw, W){
  const out = []; const minD = W*0.025;
  raw.forEach(q => { const l = out[out.length-1]; if(!l || Math.hypot(q[0]-l[0], q[1]-l[1]) >= minD) out.push(q); });
  const last = raw[raw.length-1]; if(out.length && last !== out[out.length-1]) out.push(last);
  const simp = rdpPts(out, W*0.006);
  return simp.flatMap(q => [Math.round(q[0]), Math.round(q[1])]);
}
/* livello 2: tutte le linee del settore, ognuna col numero del blocco in cima */
function bPts(c, w){ return c.line || autoLine(c, w); }
/* sulla foto del settore: ✓ verde sui boulder fatti, ☆ gialla sui progetti, in alto a destra del cartellino */
function myMark(c, x, y, m){
  if(!myOn()) return ''; const t = ui.ticks.get(c.id); if(!t) return '';
  if(t.status === 'fatto') return `<circle cx="${x}" cy="${y}" r="${m}" fill="#23b45a" stroke="#fff" stroke-width="${m*0.22}"/><path d="M${x-m*0.48},${y+m*0.02}l${m*0.34},${m*0.34}l${m*0.62},${-m*0.66}" fill="none" stroke="#fff" stroke-width="${m*0.3}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const p = []; for(let i = 0; i < 10; i++){ const a = -Math.PI/2 + i*Math.PI/5, rr = i % 2 ? m*0.3 : m*0.7; p.push((x + rr*Math.cos(a)).toFixed(1) + ',' + (y + rr*Math.sin(a)).toFixed(1)); }
  return `<circle cx="${x}" cy="${y}" r="${m}" fill="#141414" stroke="#f2c200" stroke-width="${m*0.18}"/><polygon points="${p.join(' ')}" fill="#f2c200"/>`;
}
/* circuito in progetto: anello giallo sulla presa più alta raggiunta, con bandierina */
function highSVG(c, W){
  if(!myOn()) return ''; const t = ui.ticks.get(c.id); if(!t || t.status !== 'progetto' || !t.high) return '';
  const h = moveHolds(c)[t.high - 1]; if(!h) return '';
  const bb = holdBox(h, W), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, r = Math.max((bb.x1 - bb.x0), (bb.y1 - bb.y0)) / 2 + W*0.014, lw = Math.max(3, W*0.0038);
  const fx = cx + r*0.7, fy = cy - r*0.7, fh = W*0.04;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="${lw*2.4}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f2c200" stroke-width="${lw}"/>`+
    `<path d="M${fx},${fy}V${fy - fh}" stroke="#000" stroke-opacity=".6" stroke-width="${lw*1.8}" stroke-linecap="round"/><path d="M${fx},${fy}V${fy - fh}" stroke="#fff" stroke-width="${lw*0.8}" stroke-linecap="round"/>`+
    `<path d="M${fx},${fy - fh}l${fh*0.7},${fh*0.22}l${-fh*0.7},${fh*0.22}z" fill="#f2c200" stroke="#000" stroke-opacity=".5" stroke-width="${lw*0.4}"/>`;
}
function overviewSVG(w){
  const W = w.w, list = sortedVisible(w).slice().reverse();
  let s = '', tags = '';
  list.forEach(c => {
    const pts = bPts(c, w), col = colOf(c);
    if(pts && pts.length >= 4) s += lineSVG(pts, W, col, c, 1.1);
    const at = pts && pts.length >= 4 ? [pts[pts.length-2], pts[pts.length-1]] : c.holds.length ? [c.holds[0].x, c.holds[0].y] : null;
    if(!at) return;
    const r = W*0.028;
    tags += `<g><circle cx="${at[0]}" cy="${at[1]}" r="${r}" fill="${col}" stroke="${haloOf(col)}" stroke-opacity=".7" stroke-width="${r*0.16}"/>`+
      `<text x="${at[0]}" y="${at[1]}" dy=".35em" text-anchor="middle" font-family="Barlow Semi Condensed,Barlow,sans-serif" font-weight="700" font-size="${r*1.25}" fill="${inkOn(col)}">${c.num || '?'}</text>${myMark(c, at[0] + r*0.78, at[1] - r*0.78, r*0.5)}</g>`;
  });
  return s + tags;
}

/* ---------- boulder: prese dello stesso colore della partenza ----------
   Il colore si legge dalle prese di partenza; nella foto si cercano le zone di quella tinta e ben sature
   (così il crema non passa per giallo), si scartano quelle già usate da altri boulder e si propongono:
   il tracciatore tocca quelle del suo blocco, o le aggiunge tutte. */
function rgbHsv(r, g, b){
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if(d){ if(mx === r) h = ((g - b)/d) % 6; else if(mx === g) h = (b - r)/d + 2; else h = (r - g)/d + 4; h *= 60; if(h < 0) h += 360; }
  return [h, mx ? d/mx*255 : 0, mx];
}
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
async function colorCands(w, c){
  const starts = c.holds.filter(h => isStart(h) && h.poly);
  if(!starts.length) return { err: 'Segna prima la presa di partenza (col suo contorno): il colore lo leggo da lì.' };
  const im = await loadImg(w.img), f = Math.min(1, 1400/Math.max(w.w, w.h));
  const W = Math.max(1, Math.round(w.w*f)), H = Math.max(1, Math.round(w.h*f));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data, N = W*H;
  const hue = new Float32Array(N), sat = new Uint8Array(N), val = new Uint8Array(N);
  for(let i = 0; i < N; i++){ const t = rgbHsv(d[i*4], d[i*4+1], d[i*4+2]); hue[i] = t[0]; sat[i] = t[1]; val[i] = t[2]; }
  /* colore di riferimento: i pixel colorati dentro le partenze (media circolare della tinta, mediana della saturazione) */
  let sx = 0, sy = 0; const ss = [];
  for(const h of starts){
    const bb = holdBox(h, w.w);
    for(let y = Math.max(0, Math.floor(bb.y0*f)); y <= Math.min(H-1, Math.ceil(bb.y1*f)); y++) for(let x = Math.max(0, Math.floor(bb.x0*f)); x <= Math.min(W-1, Math.ceil(bb.x1*f)); x++){
      if(!inPoly(h.poly, (x + 0.5)/f, (y + 0.5)/f)) continue;
      const i = y*W + x; if(sat[i] < 70 || val[i] < 50) continue;
      sx += Math.cos(hue[i]*Math.PI/180); sy += Math.sin(hue[i]*Math.PI/180); ss.push(sat[i]);
    }
  }
  if(ss.length < 12) return { err: 'Il colore della partenza è poco acceso (bianco, grigio o nero): per queste prese la ricerca non è affidabile, segnale a mano.' };
  let refH = Math.atan2(sy, sx)*180/Math.PI; if(refH < 0) refH += 360;
  ss.sort((a, b) => a - b); const refS = ss[ss.length >> 1];
  if(refS < 100) return { err: 'Il colore della partenza è poco acceso: per queste prese la ricerca non è affidabile, segnale a mano.' };
  /* zone già occupate: prese di questo blocco e degli altri boulder in parete */
  const used = []; w.circuits.forEach(x => { if(x === c || !isOff(x)) x.holds.forEach(h => { if(h.poly) used.push(h.poly); }); });
  const m = new Uint8Array(N);
  for(let i = 0; i < N; i++) if(hueDist(hue[i], refH) <= 10 && sat[i] >= 110 && val[i] >= 60) m[i] = 1;
  /* pulizia: via i puntini isolati, chiusi i piccoli buchi */
  const morph = (src, r, keep) => { const out = new Uint8Array(N), tmp = new Uint8Array(N);
    for(let y = 0; y < H; y++){ let run = 0; const row = y*W; const cnt = new Int32Array(W + 1); for(let x = 0; x < W; x++) cnt[x+1] = cnt[x] + src[row + x];
      for(let x = 0; x < W; x++){ const a = Math.max(0, x - r), b = Math.min(W, x + r + 1), n = cnt[b] - cnt[a]; tmp[row + x] = keep ? (n === b - a ? 1 : 0) : (n > 0 ? 1 : 0); } }
    for(let x = 0; x < W; x++){ const cnt = new Int32Array(H + 1); for(let y = 0; y < H; y++) cnt[y+1] = cnt[y] + tmp[y*W + x];
      for(let y = 0; y < H; y++){ const a = Math.max(0, y - r), b = Math.min(H, y + r + 1), n = cnt[b] - cnt[a]; out[y*W + x] = keep ? (n === b - a ? 1 : 0) : (n > 0 ? 1 : 0); } }
    return out; };
  let mm = morph(morph(m, 1, true), 1, false);          /* apertura */
  mm = morph(morph(mm, 3, false), 3, true);             /* chiusura */
  const lab = new Int32Array(N), comps = [], minA = Math.max(30, 150*f*f*(1932*1932)/(w.w*w.w)), maxA = N*0.05;
  let nl = 0;
  for(let i0 = 0; i0 < N; i0++){
    if(!mm[i0] || lab[i0]) continue;
    nl++; const st = [i0]; lab[i0] = nl; const px = [];
    while(st.length){ const p = st.pop(); px.push(p); const x = p % W, y = (p - x)/W;
      if(x > 0 && mm[p-1] && !lab[p-1]){ lab[p-1] = nl; st.push(p-1); } if(x < W-1 && mm[p+1] && !lab[p+1]){ lab[p+1] = nl; st.push(p+1); }
      if(y > 0 && mm[p-W] && !lab[p-W]){ lab[p-W] = nl; st.push(p-W); } if(y < H-1 && mm[p+W] && !lab[p+W]){ lab[p+W] = nl; st.push(p+W); } }
    if(px.length < minA || px.length > maxA) continue;
    const sv = px.map(p => sat[p]).sort((a, b) => a - b);
    if(sv[sv.length >> 1] < Math.max(140, 0.65*refS)) continue;   /* tinta giusta ma spenta: crema, sabbia, prese sporche */
    let cx = 0, cy = 0; px.forEach(p => { cx += p % W; cy += Math.floor(p/W); }); cx /= px.length; cy /= px.length;
    let best = px[0], bd = 1e18; px.forEach(p => { const dd = (p % W - cx)**2 + (Math.floor(p/W) - cy)**2; if(dd < bd){ bd = dd; best = p; } });
    const X = (best % W + 0.5)/f, Y = (Math.floor(best/W) + 0.5)/f;
    if(used.some(p => inPoly(p, X, Y))) continue;
    comps.push({ X, Y, a: px.length/(f*f), px, W, f });
  }
  return { comps, refH, refS };
}
/* contorno di una zona di colore: involucro convesso dei suoi pixel (se il riconoscimento intelligente non c'è) */
function compHull(cp){
  const pts = cp.px.map(p => [(p % cp.W + 0.5)/cp.f, (Math.floor(p/cp.W) + 0.5)/cp.f]);
  return hullPts(pts).flatMap(q => [Math.round(q[0]), Math.round(q[1])]);
}
async function findColor(w, c){
  if(!w || !c || ui.cand) return;
  const done = busy('Cerco le prese di questo colore…');
  try{
    await nextPaint();
    const r = await colorCands(w, c);
    if(r.err){ toast(r.err, 7000); return; }
    const list = [];
    const useSam = samMaybe() && await samInit();
    for(const cp of r.comps){
      let poly = null, so = null;
      if(useSam){ try{ const s2 = await samSegment(w, cp.X, cp.Y, 1, false, false, true); if(s2 && inPoly(s2.poly, cp.X, cp.Y) && s2.area < cp.a*4 && s2.area > cp.a*0.3){ poly = s2.poly; so = s2.so; } }catch(e){} }
      if(!poly) poly = compHull(cp);
      if(poly.length < 6) continue;
      /* niente doppioni: due zone della stessa presa danno lo stesso contorno */
      if(list.some(q => inPoly(q.poly, cp.X, cp.Y))) continue;
      list.push({ x: cp.X, y: cp.Y, poly, so });
    }
    if(!list.length){ toast('Non ho trovato altre prese di questo colore.'); return; }
    ui.cand = { cid: c.id, list };   /* le istruzioni sono già nel suggerimento sopra i tasti */
  } finally { done(); render(); }
}
/* aggiunge una presa proposta al blocco; il contorno si rifinisce ad alta risoluzione in sottofondo */
function addCand(w, c, k){
  const q = ui.cand.list[k]; if(!q) return;
  ui.cand.list.splice(k, 1); if(!ui.cand.list.length) ui.cand = null;
  let A = 0, cx = 0, cy = 0; const p = q.poly;
  for(let i = 0, n = p.length/2; i < n; i++){ const j = (i+1) % n, cc = p[2*i]*p[2*j+1] - p[2*j]*p[2*i+1]; A += cc; cx += (p[2*i] + p[2*j])*cc; cy += (p[2*i+1] + p[2*j+1])*cc; }
  const h = { x: Math.abs(A) > 1 ? cx/(3*A) : q.x, y: Math.abs(A) > 1 ? cy/(3*A) : q.y, sx: q.x, sy: q.y, r: clamp(Math.sqrt(Math.abs(A)/2/Math.PI)/w.w, 0.012, 0.06), role: 'hold', ts: 1, poly: p.slice() };
  c.holds.push(h);
  if(sam.state === 'ready'){
    candRefine = candRefine.then(async () => {
      const op0 = []; for(let i = 0; i < h.poly.length; i += 2) op0.push([h.poly[i], h.poly[i+1]]);
      const op = await refineContour(w, op0, q.so || null, q.x, q.y);
      if(op !== op0 && op.length >= 3 && c.holds.includes(h)){ h.poly = []; op.forEach(t => h.poly.push(Math.round(t[0]), Math.round(t[1]))); touch(); render(); }
    }).catch(() => {});
  }
}
let candRefine = Promise.resolve();

/* ---------- volumi del blocco: prese d'altro colore montate sopra ----------
   Dentro un volume (o una presa grande) del blocco si trova il colore dominante; le zone di colore ben diverso
   sono prese di altri blocchi e si oscurano come il resto della foto. Calcolo una volta per presa, in sottofondo. */
const fmCache = new Map();
function foreignMask(w, c, h){
  if(!h.poly || polyArea(h.poly) < w.w*w.h*0.004) return null;
  const key = w.id + '|' + samKey(w) + '|' + h.poly.length + ':' + h.poly.slice(0, 8).join(',') + '|' + c.holds.length;
  const v = fmCache.get(key);
  if(v) return v.url ? v : null;
  fmCache.set(key, { pending: true });
  computeForeign(w, c, h).then(r => { fmCache.set(key, r || { none: true }); if(r) render(); }).catch(() => fmCache.set(key, { none: true }));
  return null;
}
async function computeForeign(w, c, h){
  const bb = holdBox(h, w.w), im = await loadImg(w.img);
  const bw = bb.x1 - bb.x0, bh = bb.y1 - bb.y0, k = Math.min(1, 420/Math.max(bw, bh));
  const W = Math.max(8, Math.round(bw*k)), H = Math.max(8, Math.round(bh*k));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.filter = 'blur(1px)'; g.drawImage(im, bb.x0, bb.y0, bw, bh, 0, 0, W, H); g.filter = 'none';
  const d = g.getImageData(0, 0, W, H).data, N = W*H;
  /* dentro il volume, lontano dal bordo (ombre e spigoli) e fuori dalle altre prese del blocco */
  const P = h.poly.map((v, i) => i % 2 ? (v - bb.y0)*k : (v - bb.x0)*k);
  const inside = new Uint8Array(N), m2 = document.createElement('canvas'); m2.width = W; m2.height = H;
  const g2 = m2.getContext('2d', { willReadFrequently: true });
  g2.fillStyle = '#fff'; g2.beginPath(); for(let i = 0; i < P.length; i += 2) i ? g2.lineTo(P[i], P[i+1]) : g2.moveTo(P[i], P[i+1]); g2.closePath(); g2.fill();
  g2.strokeStyle = '#000'; g2.lineWidth = Math.max(4, Math.min(W, H)*0.04); g2.stroke();
  g2.fillStyle = '#000';
  c.holds.forEach(q => { if(q === h || !q.poly) return; const Q = q.poly.map((v, i) => i % 2 ? (v - bb.y0)*k : (v - bb.x0)*k); g2.beginPath(); for(let i = 0; i < Q.length; i += 2) i ? g2.lineTo(Q[i], Q[i+1]) : g2.moveTo(Q[i], Q[i+1]); g2.closePath(); g2.fill(); });
  const md = g2.getImageData(0, 0, W, H).data; for(let i = 0; i < N; i++) inside[i] = md[i*4] > 127 ? 1 : 0;
  /* colore in Lab approssimato (a, b danno la tinta) */
  const L = new Float32Array(N), A = new Float32Array(N), B = new Float32Array(N), lin = u => { u /= 255; return u <= 0.04045 ? u/12.92 : Math.pow((u + 0.055)/1.055, 2.4); };
  for(let i = 0; i < N; i++){
    const r = lin(d[i*4]), gg = lin(d[i*4+1]), b = lin(d[i*4+2]);
    const X = (0.4124*r + 0.3576*gg + 0.1805*b)/0.9505, Y = 0.2126*r + 0.7152*gg + 0.0722*b, Z = (0.0193*r + 0.1192*gg + 0.9505*b)/1.089;
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787*t + 16/116, fy = f(Y);
    L[i] = 116*fy - 16; A[i] = 500*(f(X) - fy); B[i] = 200*(fy - f(Z));
  }
  const med = arr => { const v = []; for(let i = 0; i < N; i++) if(inside[i]) v.push(arr[i]); v.sort((p, q) => p - q); return v.length ? v[v.length >> 1] : 0; };
  let cnt = 0; for(let i = 0; i < N; i++) cnt += inside[i]; if(cnt < 200) return null;
  const mL = med(L), mA = med(A), mB = med(B);
  /* diverso dal volume soprattutto per tinta (la luce e la magnesite cambiano la chiarezza, non il colore) */
  const fg = new Uint8Array(N);
  for(let i = 0; i < N; i++){ if(!inside[i]) continue; const dd = Math.hypot((L[i] - mL)*0.45, A[i] - mA, B[i] - mB); if(dd > 24) fg[i] = 1; }
  /* via i puntini (viti, sporco): restano solo le zone grandi abbastanza da essere prese */
  const lab = new Int32Array(N), keep = new Uint8Array(N), minA = Math.max(25, cnt*0.002);
  let nl = 0, any = false;
  for(let i0 = 0; i0 < N; i0++){
    if(!fg[i0] || lab[i0]) continue;
    nl++; const st = [i0], px = []; lab[i0] = nl;
    while(st.length){ const p = st.pop(); px.push(p); const x = p % W, y = (p - x)/W;
      if(x > 0 && fg[p-1] && !lab[p-1]){ lab[p-1] = nl; st.push(p-1); } if(x < W-1 && fg[p+1] && !lab[p+1]){ lab[p+1] = nl; st.push(p+1); }
      if(y > 0 && fg[p-W] && !lab[p-W]){ lab[p-W] = nl; st.push(p-W); } if(y < H-1 && fg[p+W] && !lab[p+W]){ lab[p+W] = nl; st.push(p+W); } }
    if(px.length >= minA && px.length < cnt*0.5){ px.forEach(p => keep[p] = 1); any = true; }
  }
  if(!any) return null;
  /* immagine: nero semitrasparente sulle prese estranee, bordi un po' allargati e sfumati */
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const go = out.getContext('2d'), img = go.createImageData(W, H);
  for(let i = 0; i < N; i++) if(keep[i]){ img.data[i*4+3] = 255; }
  go.putImageData(img, 0, 0);
  const o2 = document.createElement('canvas'); o2.width = W; o2.height = H;
  const g3 = o2.getContext('2d'); g3.filter = 'blur(1.5px)'; for(let t = 0; t < 2; t++) g3.drawImage(out, 0, 0); g3.filter = 'none';
  g3.globalCompositeOperation = 'source-in'; g3.fillStyle = 'rgba(0,0,0,0.62)'; g3.fillRect(0, 0, W, H);
  return { url: o2.toDataURL('image/png'), x: bb.x0, y: bb.y0, w: bw, h: bh };
}
function traceBoulder(w, id){
  ui.cand = null; w.activeCircuit = id; ui.secOver = false; ui.sel = null; ui.move = false; ui.bdraw = false; ui.draft = []; ui.bline = false; ui.zoom = 1;
  ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit());
  try{ history.pushState({ sec: 1, ed: 1 }, ''); }catch(e){}
  save(); render();
}
function overviewHit(w, x, y, tol){
  let best = null, bd = tol;
  sortedVisible(w).forEach(c => {
    const p = bPts(c, w); if(!p || p.length < 4) return;
    let d = Math.hypot(x - p[p.length-2], y - p[p.length-1]) - w.w*0.028;
    for(let i=0;i<p.length-2;i+=2) d = Math.min(d, segDist(x, y, p[i], p[i+1], p[i+2], p[i+3]));
    if(d < bd){ bd = d; best = c; }
  });
  return best;
}
/* schermata iniziale: lo schermo diviso in due, Boulder sopra e Circuiti sotto */
function homeScreen(){
  const tile = sec => {
    const ws = S.walls.filter(w => secOf(w) === sec && wallShown(w)), bo = sec === 'boulder';
    const n = ws.reduce((t, w) => t + (bo ? w.circuits.filter(c => !isOff(c)).length : w.circuits.length), 0);
    const img = ws[0] ? `<img src="${esc(ws[0].img)}" alt="">` : '';
    const nc = !bo ? ws.reduce((t, w) => t + w.circuits.filter(c => cLabel(c) === 'Nuovo').length, 0) : 0;
    const nn = bo && !EDIT ? ws.filter(w => secLabel(w) === 'Nuovo').length : 0, ns = bo && EDIT ? ws.filter(w => secLabel(w) === 'Scaduto').length : 0;
    const sub = ws.length ? `${ws.length} ${bo ? (ws.length === 1 ? 'settore' : 'settori') : (ws.length === 1 ? 'muro' : 'muri')} · ${n} ${bo ? 'boulder' : (n === 1 ? 'circuito' : 'circuiti')}${nn ? ` · <span class="hnew">${nn === 1 ? '1 settore nuovo' : nn + ' settori nuovi'}</span>` : ''}${ns ? ` · <span class="hnew">${ns === 1 ? '1 scaduto' : ns + ' scaduti'}</span>` : ''}${nc ? ` · <span class="hnew">${nc} ${nc === 1 ? 'nuovo' : 'nuovi'}</span>` : ''}` : (bo ? 'nessun settore ancora' : 'nessun muro ancora');
    const mp = myOn() ? myProg(ws) : null;
    return `<button class="htile" data-act="pickhome" data-v="${sec}">${img}<span class="hlab"><b>${bo ? 'Boulder' : 'Circuiti'}</b><small>${sub}</small>${mp ? progLine(mp, 'big') : ''}</span>${mp ? progBar(mp) : ''}</button>`;
  };
  let mine = '';
  if(acctOn() && !EDIT){ const T = ACC() && ui.ticks ? [...ui.ticks.values()] : [], nd = T.filter(t => t.status === 'fatto').length, np = T.filter(t => t.status === 'progetto').length;
    const nb = ACC() ? earnedBadges().size : 0;
    const sub = !ACC() ? 'segna i percorsi fatti e i progetti, guadagna i badge' : nd || np ? [nd ? nd + (nd === 1 ? ' fatto' : ' fatti') : '', np ? np + (np === 1 ? ' progetto' : ' progetti') : '', nb + ' badge di ' + BADGES.length].filter(Boolean).join(' · ') : 'apri un percorso e tocca ✓ Fatto';
    mine = `<button class="hmine" data-act="mine">${CUP_SVG}<span><b>Le mie salite</b><small>${sub}</small></span>${hasNewB() ? '<i class="mbd"></i>' : ''}<svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`; }
  return `<div class="home">${tile('boulder')}${tile('circ')}${mine}</div>`;
}
function sectorGrid(){
  const bo = BO(), mgr = EDIT && isMgr(), arch = archWalls();
  const nC = bo ? 0 : secWalls().reduce((t, w) => t + w.circuits.length, 0);
  return (nC > 1 ? `<button class="sqbar" data-act="csearch"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 12l4.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Cerca un circuito</span><small>${nC} in palestra</small></button>` : '') +
    `<div class="sgrid">` + gridWalls().map(w => {
    const on = w.circuits.filter(c => !isOff(c));
    let info, staff = '';
    if(bo){
      const dots = DIFFS.map(d => { const n = on.filter(c => c.diff === d[0]).length; return n ? `<span class="sdot"><i style="background:${d[2]}"></i>${n}</span>` : ''; }).join('');
      const nn = on.filter(isNewB).length;
      const sl = secLabel(w);
      info = (dots || '<small>nessun boulder</small>') + (sl ? `<span class="snew ${sl === 'Recente' ? 'rec' : sl === 'Scaduto' ? 'exp' : ''}">${sl}</span>` : nn ? `<span class="snew">${nn} novità</span>` : '');
      if(EDIT){
        const last = on.map(c => c.dateSet || '').sort().pop();
        const t = todayISO(), lim = new Date(Date.now() + 7*864e5).toISOString().slice(0,10);
        const due = on.filter(c => c.dateRemoved && c.dateRemoved >= t && c.dateRemoved <= lim).length;
        staff = `<span class="sinfo">${last ? 'ultimo montaggio ' + fmtDate(last) : 'nessun montaggio'}${due ? `<br><b>${due} da smontare entro 7 giorni</b>` : ''}</span>`;
      }
    } else {
      const gs = w.circuits.map(c => c.grade).filter(g => gradeIdx(g) < 999).sort((x, y) => gradeIdx(x) - gradeIdx(y));
      const n = w.circuits.length;
      const cn = w.circuits.filter(c => cLabel(c) === 'Nuovo').length;
      info = `<small>${n ? n + (n === 1 ? ' circuito' : ' circuiti') : 'nessun circuito'}${gs.length ? ' · ' + esc(gs[0]) + (gs.length > 1 && gs[gs.length-1] !== gs[0] ? '–' + esc(gs[gs.length-1]) : '') : ''}</small>${cn ? `<span class="snew">${cn} ${cn === 1 ? 'nuovo' : 'nuovi'}</span>` : ''}`;
      if(EDIT && !w.locked) staff = `<span class="sinfo"><b>prese da preparare</b> · lo vedi solo tu</span>`;
    }
    return `<button class="scard" data-act="opensec" data-id="${w.id}"><span class="sph"><img src="${esc(w.img)}" alt="" loading="lazy">${mgr ? `<span class="sedit" role="button" data-act="wman" data-id="${w.id}" aria-label="Gestisci ${bo ? 'il settore' : 'il muro'}">Modifica</span>` : ''}</span>`+
      `<span class="sname">${esc(w.name)}</span><span class="sdots">${info}</span>${myOn() ? (() => { const p = myProg([w]); return progLine(p) + progBar(p); })() : ''}${staff}</button>`;
  }).join('') + (mgr ? `<div class="scard sadd"><span class="sname">+ ${bo ? 'Nuovo settore' : 'Nuovo muro'}</span><span class="sinfo">Carica la foto ${bo ? 'del settore' : 'del muro'}</span><div class="sbtns">${PICK_BTNS}</div></div>` : '') + `</div>`+
    (mgr && arch.length ? `<button class="archrow" data-act="archlist">Archiviati (${arch.length})</button>` : '');
}
function overlay(w, o){
  if(o.wall){
    let s = ''; const t = Math.max(2, w.w*0.0028);
    const sus = catSuspects(w);
    /* contorni sottili anche ingrandendo: lo spessore non supera circa un pixel di schermo */
    const stg = $('#stage'), spx = stg && stg.clientWidth ? w.w / stg.clientWidth : 1e9, tw = Math.min(Math.max(1, w.w*0.0013), spx*0.9);
    (w.holds || []).forEach((h,i) => {
      const d = polyPath(h.poly), sel = i === ui.csel, col = sel ? '#ffd400' : sus.has(i) ? '#ff7a00' : '#ffffff';
      s += `<path d="${d}" fill="${col}" fill-opacity="${sel ? .32 : .10}" stroke="#000" stroke-opacity=".6" stroke-width="${tw*2.6}" stroke-linejoin="round"/>`+
           `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sel ? tw*2 : tw}" stroke-linejoin="round"/>`;
    });
    return s + draftSVG(w);
  }
  if(isSec(w) && o.over) return overviewSVG(w);
  const act = w.circuits.find(c => c.id === w.activeCircuit) || w.circuits[0];
  const bo = isSec(w);
  if(bo) o = Object.assign({}, o, { numbers: false, lines: false, boulder: true });
  let s = '';
  const mk = bo ? wallMarks(w) : null;
  if(o.dim && act && act.holds.length){
    /* foto oscurata tranne le prese del blocco: una maschera (e non un tracciato pari/dispari),
       così una presa montata su un volume del blocco resta chiara anche lei */
    let d = '';
    const cands = o.edit && bo && ui.cand && ui.cand.cid === act.id ? ui.cand.list : [];
    cands.forEach(q => { d += polyPath(q.poly); });
    act.holds.forEach(h => {
      if(h.poly) d += polyPath(h.poly);
      else { const r = h.r*w.w; d += `M${h.x-r},${h.y}a${r},${r} 0 1,0 ${2*r},0a${r},${r} 0 1,0 ${-2*r},0Z`; }
    });
    const mid = 'dm' + String(act.id).replace(/[^\w-]/g, '') + (o.edit ? 'e' : 'v'), op = o.edit ? .5 : .62;
    s += `<defs><mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w.w}" height="${w.h}"><rect x="0" y="0" width="${w.w}" height="${w.h}" fill="#fff"/><path d="${d}" fill="#000"/></mask></defs>`+
         `<rect x="0" y="0" width="${w.w}" height="${w.h}" fill="#000" fill-opacity="${op}" mask="url(#${mid})"/>`;
    /* boulder: sui volumi e sulle prese grandi del blocco si oscurano anche le prese d'altro colore montate sopra */
    if(bo) act.holds.forEach(h => { const fm = foreignMask(w, act, h); if(fm) s += `<image href="${fm.url}" xlink:href="${fm.url}" x="${fm.x}" y="${fm.y}" width="${fm.w}" height="${fm.h}" preserveAspectRatio="none" opacity="${(op/0.62).toFixed(2)}"/>`; });
  }
  /* gli altri circuiti sopra all'oscuramento, in trasparenza: se no sparirebbero nel buio */
  if(o.others) visibleCircuits(w).forEach(c => { if(c !== act) s += circuitSVG(c, w.w, o.dim ? 0.45 : 0.28, {numbers:false, lines:false, boulder:bo, H: w.h, mk}); });
  if(act && bo) s += lineSVG(act.line || autoLine(act, w), w.w, colOf(act), act);
  if(bo && ui.bline && ui.lineDraft.length > 1) s += lineSVG(ui.lineDraft.flat(), w.w, '#ff3b7a');   /* la bozza è fatta di coppie [x, y]: lineSVG vuole i numeri in fila */
  if(act && !bo && !o.edit) s += highSVG(act, w.w);   /* sotto ai numeri, che restano leggibili */
  if(act) s += circuitSVG(act, w.w, 1, Object.assign({}, o, { H: w.h, obst: w.holds || [], busy: busyMap(w), mk }));
  if(o.edit && bo && act && ui.cand && ui.cand.cid === act.id){
    const t = Math.max(2, w.w*0.0026);
    ui.cand.list.forEach(q => { const dd = polyPath(q.poly);
      s += `<path d="${dd}" fill="${colOf(act)}" fill-opacity=".12" stroke="#000" stroke-opacity=".55" stroke-width="${t*2.4}" stroke-linejoin="round"/><path d="${dd}" fill="none" stroke="#fff" stroke-width="${t}" stroke-dasharray="${t*3} ${t*2.2}" stroke-linejoin="round"/>`; });
  }
  if(o.edit) s += draftSVG(w);
  if(o.edit && act && ui.sel != null && act.holds[ui.sel]){
    const bb = holdBox(act.holds[ui.sel], w.w), pad = w.w*0.012, t = Math.max(2, w.w*0.003);
    const rect = `x="${bb.x0-pad}" y="${bb.y0-pad}" width="${bb.x1-bb.x0+pad*2}" height="${bb.y1-bb.y0+pad*2}" rx="${pad}" fill="none"`;
    s += `<rect ${rect} stroke="#000" stroke-opacity=".6" stroke-width="${t*2.6}"/><rect ${rect} stroke="#fff" stroke-width="${t}" stroke-dasharray="${t*3} ${t*2}"/>`;
  }
  return s;
}

/* ---------- render ---------- */
function fit(){
  $('#app').classList.toggle('swipeok', newC() && !(ui.zoom > 1.02));
  const w = curWall(); if(!w) return;
  const b = $('#box'), st = $('#stage');
  const k = Math.min(b.clientWidth / w.w, b.clientHeight / w.h) * ui.zoom;
  const nw = w.w*k, nh = w.h*k;
  const changed = Math.abs(st.clientWidth - nw) > 1 || Math.abs(st.clientHeight - nh) > 1;
  st.style.width = nw + 'px';
  st.style.height = nh + 'px';
  /* se il riquadro cambia misura (es. cambiano i tasti sotto) restiamo sullo stesso punto della foto */
  if(changed && ui.zoom > 1.001 && ui.view){
    b.scrollLeft = ui.view.u*nw + st.offsetLeft - b.clientWidth/2;
    b.scrollTop = ui.view.v*nh + st.offsetTop - b.clientHeight/2;
  }
}
/* il vero <input type=file> sta SOPRA il bottone (trasparente): il tocco arriva direttamente all'input,
   senza passare da <label for>, che alcune viste integrate (es. l'app Claude) ignorano */
const PICK_BTNS = `<span class="btn primary big pick">Scegli dalla galleria<input type="file" accept="image/*" data-pick="1" aria-label="Scegli dalla galleria"></span>
  <span class="btn big pick">Scatta una foto<input type="file" accept="image/*" capture="environment" data-pick="1" aria-label="Scatta una foto"></span>`;
function renderTop(){
  const w = curWall();
  document.querySelectorAll('#secbar button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === ui.section)));
  $('#wallName').textContent = ui.home ? 'Monkey Roads' : bGrid() ? (BO() ? 'Settori' : 'Muri') : w ? w.name : (BO() ? 'Nessun settore' : 'Nessun muro');
  $('#wallBtn').setAttribute('aria-label', BO() ? 'Scegli un settore' : 'Scegli un muro');
  const multi = secWalls().length > 1;
  $('#wallBtn').disabled = !EDIT && !multi && !SB;
  /* il nome è solo un titolo: si cambia muro/settore dalla griglia, si gestisce con "Modifica" sulla scheda */
  $('#wallBtn').disabled = true;
  $('#chev').toggleAttribute('hidden', $('#wallBtn').disabled);
  /* indietro: dal muro/settore alla griglia, dalla griglia alla schermata iniziale */
  const inPlace = ui.bLevel === 'sector' && !bGrid() && !!w;
  $('#backBtn').hidden = ui.home;   /* anche a schermo intero: si torna alla foto del settore o del muro */
  $('#backBtn').setAttribute('aria-label', ui.full ? 'Torna alla foto' : inPlace ? (BO() ? 'Torna ai settori' : 'Torna ai muri') : 'Torna alla schermata iniziale');
  /* lo staff lavora sempre in modalità tracciatura; l'anteprima mostra l'app esattamente come la vede un cliente */
  /* occhio = guarda come un cliente; chiave inglese = torna a lavorare */
  const pb = $('#prevBtn'), inPrev = ui.viewAs === 'cliente';
  pb.hidden = !REAL_EDIT || ui.viewAs === 'tracciatore';
  pb.innerHTML = inPrev ? WRENCH_SVG : EYE_SVG;
  pb.setAttribute('aria-label', inPrev ? 'Torna a tracciare' : 'Anteprima: vedi l\'app come un cliente');
  pb.title = inPrev ? 'Torna a tracciare' : 'Anteprima cliente';
  pb.classList.toggle('on', inPrev);
  $('#instBtn').hidden = REAL_EDIT || !canInstall();
  /* Le mie salite sempre a un tocco, da ogni schermata */
  const mb = $('#mineBtn'), mOn = acctOn() && !EDIT; mb.hidden = !mOn;
  if(mOn){ const nd = ACC() && ui.ticks ? [...ui.ticks.values()].filter(t => t.status === 'fatto').length : 0;
    mb.innerHTML = CUP_SVG + (hasNewB() ? '<i class="mbd"></i>' : ''); }
}
const CUP_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 20L9 8.5l3.5 6 2.5-3.5L21.5 20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 8.5V3.5l4 1.6-4 1.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';   /* montagna con bandierina in vetta */
/* le salite del cliente sui percorsi in parete adesso: per tenerle sempre sotto gli occhi mentre si naviga */
const myOn = () => acctOn() && !EDIT && !!ACC() && !!ui.ticks;
function myProg(ws){ let tot = 0, done = 0, proj = 0;
  ws.forEach(w => w.circuits.forEach(c => { if(isSec(w) && (!c.diff || isOff(c))) return; tot++; const t = ui.ticks.get(c.id); if(t) t.status === 'fatto' ? done++ : proj++; }));
  return { tot, done, proj }; }
const progLine = (p, cls) => p.done || p.proj ? `<span class="myp ${cls || ''}"><b>✓ ${p.done}/${p.tot}</b>${p.proj ? `<i>☆ ${p.proj}</i>` : ''}</span>` : '';
const progBar = p => p.done ? `<span class="mybar"><i style="width:${Math.round(100 * p.done / Math.max(1, p.tot))}%"></i></span>` : '';
const EYE_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>';
const WRENCH_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4.5 4.5 0 0 1 5.9-1.1l-3 3 .3 2.2 2.2.3 3-3a4.5 4.5 0 0 1-6 5.9L8.5 22.2a2.1 2.1 0 0 1-3-3l8.6-8.6a4.5 4.5 0 0 1 .6-4.3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
function renderViewbar(){
  const el = $('#viewbar'); if(!el) return;
  if(REAL_EDIT && ui.viewAs === 'cliente' && ui.prevNew){ el.hidden = false; el.innerHTML = `<span>Anteprima con <b>Le mie salite</b> e gli account: i clienti non li vedono ancora</span><button class="btn" data-act="viewas" data-v="${ME.role}">Esci</button>`; return; }
  if(!REAL_EDIT || !ui.viewAs || ui.viewAs === 'cliente'){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span>Stai vedendo come <b>${ui.viewAs}</b>${ui.viewAs === 'cliente' && dirtyReal() ? ' (con le tue modifiche non pubblicate)' : ''}</span><button class="btn" data-act="viewas" data-v="${ME.role}">Torna ${ME.role}</button>`;
}
const dirtyReal = () => REAL_EDIT && S.rev > PUBREV;
function renderPub(){
  const d = dirty();
  $('#pubbar').hidden = !d;
  const b = $('#pubBtn');
  b.disabled = ui.publishing;
  b.textContent = ui.publishing ? 'Pubblico…' : 'Pubblica';
}
/* oscuramento del resto della foto: in Traccia solo se chiesto col tasto, a schermo intero sempre, altrimenti come da preferenza */
function dimOn(editing){ return editing ? !!ui.editDim : (!!ui.full || S.prefs.dim || newC()); }
function renderStage(){
  const w = curWall(), st = $('#stage'), em = $('#empty'), z = $('#zoom');
  if(ui.home){ st.hidden = true; z.hidden = true; em.hidden = false; em.innerHTML = homeScreen(); return; }
  if(!w){
    st.hidden = true; z.hidden = true; em.hidden = false;
    if(!ui.ready) em.innerHTML = `<p>Carico…</p>`;
    else if(BO() && EDIT && isMgr()) em.innerHTML = `<h1>Segna i boulder sulla foto del settore</h1><p>Carica la foto di un settore: poi tocca le prese di ogni boulder per contornarle, con partenza e arrivo.</p><div class="row">${PICK_BTNS}</div>`;
    else if(BO()) em.innerHTML = `<h1>Nessun settore pubblicato</h1><p>I boulder compariranno qui quando il gestore carica i settori.</p>`;
    else if(EDIT && isMgr()) em.innerHTML = `<h1>Traccia i circuiti sulla foto del muro</h1><p>Carica una foto, tocca le prese per segnarle e dai un colore a ogni circuito.</p><div class="row">${PICK_BTNS}</div>`;
    else em.innerHTML = `<h1>Nessun muro pubblicato</h1><p>I circuiti compariranno qui quando il gestore li pubblica.</p>`;
    if(ui.ready && EDIT && isMgr() && archWalls().length) em.innerHTML += `<button class="btn" data-act="archlist">Archiviati (${archWalls().length})</button>`;
    return;
  }
  if(bGrid()){ st.hidden = true; z.hidden = true; em.hidden = false; em.innerHTML = sectorGrid(); return; }
  st.hidden = false; em.hidden = true; em.innerHTML = ''; z.hidden = false;
  st.classList.toggle('edit', EDIT && S.mode !== 'view');
  st.classList.toggle('linedraw', !!ui.bline || drawMode());
  const im = $('#photo');
  if(im.dataset.id !== w.id){ im.src = w.img; im.dataset.id = w.id; }
  const sv = $('#ov');
  sv.setAttribute('viewBox', `0 0 ${w.w} ${w.h}`);
  const editing = EDIT && S.mode === 'edit';
  sv.innerHTML = overlay(w, { over: bOver(), numbers: editing || S.prefs.numbers, lines: S.prefs.lines, others: EDIT ? S.prefs.others : S.prefs.othersV, edit: editing, dim: dimOn(editing), wall: EDIT && S.mode === 'wall' });
  fit();
}
/* il cliente vede solo i boulder in parete: gli smontati servono allo staff */
const bShowEff = () => EDIT ? ui.bShow : 'on';
function visibleCircuits(w){
  const show = bShowEff();
  if(isSec(w)) return w.circuits.filter(c => (show === 'all' || (show === 'off') === isOff(c)) && (!ui.bColor.length || !c.diff || ui.bColor.includes(c.diff)) && (!ui.bNew || isNewB(c)));
  return w.circuits.filter(c => cMatch(c) && (!ui.cNew || cLabel(c)));
}
const gradeBand = g => { const i = GRADES.indexOf(g || ''); if(i <= 0) return '#5b6068'; if(i <= GRADES.indexOf('5c')) return '#7bd389'; if(i <= GRADES.indexOf('6b+')) return '#ffd166'; if(i <= GRADES.indexOf('7a+')) return '#ff9a3d'; return '#ef476f'; };
const gradeBadge = g => `<span class="gb" style="background:${gradeBand(g)}">${esc(g || '–')}</span>`;
const gradeIdx = g => { const i = GRADES.indexOf(g || ''); return i <= 0 ? 999 : i; };
/* "prese rosse", "prese gialle"…: colore delle prese di un boulder, al plurale femminile */
function holdColText(c){
  const PL = { Giallo:'gialle', Arancio:'arancioni', Rosso:'rosse', Rosa:'rosa', Viola:'viola', Blu:'blu', Azzurro:'azzurre', Verde:'verdi', Bianco:'bianche', Nero:'nere' };
  const hc = c && c.holdColor && PALETTE.find(p => p[1] === c.holdColor);
  return hc ? 'prese ' + (PL[hc[0]] || hc[0].toLowerCase()) : '';
}
function bMeta(c){
  const t = (c.tags || []).slice(0, 3).join(', ');
  return [holdColText(c), c.setter || '', isOff(c) ? 'smontato ' + fmtDate(c.dateRemoved) : c.dateSet ? fmtDate(c.dateSet) : '', t].filter(Boolean).map(esc).join(' · ');
}
/* movimenti: ogni passaggio dopo la partenza (sulla stessa presa si può passare più volte) */
const moveHolds = c => (c.holds || []).filter(h => h.role === 'hold' || h.role === 'top');
const movesOf = c => moveHolds(c).length;
const movesText = c => { const n = movesOf(c), f = (c.holds || []).filter(isFoot).length; return (n === 1 ? '1 movimento' : n + ' movimenti') + (f ? ' · ' + (f === 1 ? '1 piede obbligato' : f + ' piedi obbligati') : ''); };
function circMeta(c){
  if(curWall() && isSec(curWall())) return bMeta(c);
  return [c.angle != null ? c.angle + '°' : '', c.style || '', c.feet ? 'piedi ' + c.feet : '', movesText(c)].filter(Boolean).map(esc).join(' · ');
}
/* filtri dei boulder: stato (in parete / smontati / tutti), grado, colore delle prese */
function bFilters(w){
  const ds = DIFFS.filter(d => w.circuits.some(x => x.diff === d[0] && (EDIT || !isOff(x))));
  const st = (v, l) => `<button class="fchip ${ui.bShow === v ? 'on' : ''}" data-act="bshow" data-v="${v}">${l}</button>`;
  const nNew = w.circuits.filter(isNewB).length;
  const nw = nNew ? `<button class="fchip ${ui.bNew ? 'on' : ''}" data-act="bnew">Novità · ${nNew}</button>` : '';
  return (EDIT ? `<div class="fchips">${st('on','In parete')}${st('off','Smontati')}${st('all','Tutti')}${nw}</div>` : nw ? `<div class="fchips">${nw}</div>` : '')+
    (ds.length > 1 ? `<div class="fchips">${ds.map(d => `<button class="fdot ${ui.bColor.includes(d[0]) ? 'on' : ''}" data-act="bcolor" data-v="${d[0]}" aria-label="${d[1]}" aria-pressed="${ui.bColor.includes(d[0])}" style="background:${d[2]}"></button>`).join('')}</div>`+
      (ui.bColor.length ? `<div class="sqhead" style="margin:0 0 4px"><small>${sortedVisible(w).length} di ${w.circuits.filter(x => EDIT ? (bShowEff() === 'all' || (bShowEff() === 'off') === isOff(x)) : !isOff(x)).length} boulder: solo ${ui.bColor.map(v => (DIFFS.find(d => d[0] === v) || [, v])[1].toLowerCase()).join(', ')}</small><button class="linklike" data-act="bcolorall">Tutti i colori</button></div>` : '') : '');
}
function bRows(w, cls){
  const act = bOver() ? null : curCircuit(), vis = sortedVisible(w);
  if(!vis.length) return `<p class="hint" style="padding:6px 2px">${w.circuits.length ? 'Nessun boulder con questi filtri.' : 'Ancora nessun boulder su questo settore.'}</p>`;
  return `<div class="list" style="gap:${cls === 'crow' ? 6 : 0}px;margin:0">` + vis.map(x => `<button class="${cls} ${act && x.id === act.id ? 'active' : ''} ${isOff(x) ? 'off' : ''}" data-act="pickc" data-id="${x.id}"><i class="dot" style="background:${x.color}"></i><span class="ctext" style="flex:1"><b>${tickMark(x)}${bTitleHtml(x)}</b><small>${[x.style ? esc(x.style) : '', bMeta(x)].filter(Boolean).join(' · ')}</small></span></button>`).join('') + `</div>`;
}
/* riga rapida sopra l'elenco: inclinazioni a portata di dito, tutto il resto in "Filtri" */
function circFilters(w){
  const all = sqAll(); if(all.length < 2) return '';
  const angles = [...new Set(all.map(x => x.c.angle).filter(x => x != null))].sort((a, b) => a - b), q = ui.sq;
  const other = (q.min || q.max ? 1 : 0) + (q.sty ? 1 : 0) + (q.feet ? 1 : 0);
  const chip = (v, l) => `<button class="fchip ${q.ang === String(v) ? 'on' : ''}" data-act="sqang" data-v="${v}">${l}</button>`;
  const n = visibleCircuits(w).length, tot = w.circuits.length, nNew = w.circuits.filter(cLabel).length;
  return `<div class="fchips">`+
    (nNew ? `<button class="fchip ${ui.cNew ? 'on' : ''}" data-act="cnew">Novità · ${nNew}</button>` : '')+
    `<button class="fchip fbtn ${other ? 'on' : ''}" data-act="cfilt"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Filtri${other ? ' · ' + other : ''}</button>`+
    (angles.length > 1 ? chip('', 'Tutte') + angles.map(a => chip(a, a + '°')).join('') : '')+
    `</div>`+
    (sqCount() ? `<div class="sqhead" style="margin:0 0 4px"><small>${n} di ${tot} circuiti su questo muro</small><button class="linklike" data-act="sqreset">Azzera filtri</button></div>` : '');
}
function circRows(w, cls){
  const act = curCircuit(), vis = sortedVisible(w);
  if(!vis.length) return `<p class="hint" style="padding:6px 2px">${w.circuits.length ? 'Nessun circuito con questi filtri.' : 'Ancora nessun circuito su questo muro.'}</p>`;
  return `<div class="list" style="gap:${cls === 'crow' ? 6 : 0}px;margin:0">` + vis.map(x => `<button class="${cls} ${act && x.id === act.id ? 'active' : ''}" data-act="pickc" data-id="${x.id}"><i class="dot" style="background:${colOf(x)}"></i><span class="ctext" style="flex:1"><b>${tickMark(x)}${cTitleHtml(x)}</b><small>${circMeta(x)}</small></span>${gradeBadge(x.grade)}</button>`).join('') + `</div>`;
}
function renderChips(){
  const w = curWall(), el = $('#chips');
  if(!w || (EDIT && S.mode === 'wall')){ el.innerHTML = ''; return; }
  const act = curCircuit(), n = visibleCircuits(w).length, tot = w.circuits.length;
  if(isSec(w) && (!EDIT || S.mode === 'view' || bOver())){
    const staff = EDIT && S.mode !== 'view';
    el.innerHTML = (staff ? `<button class="btn primary" data-act="addc" style="width:100%;margin-bottom:10px">+ Nuovo boulder</button>` : '') +
      (tot ? bFilters(w) : '') + bRows(w, 'lrow') +
      (n ? `<p class="hint" style="text-align:center;margin:8px 0 0;font-size:13px">${staff ? 'Tocca una linea sulla foto, o un boulder qui, per tracciarlo.' : 'Tocca una linea sulla foto, o un boulder qui, per aprirlo.'}</p>` : '');
    return;
  }
  if(!EDIT || S.mode === 'view'){
    el.innerHTML = circFilters(w) + circRows(w, 'lrow');   /* sulla foto c'è già "Tocca per schermo intero" */
    return;
  }
  const filtered = !isSec(w) && sqCount() ? ` · filtrati ${n}/${tot}` : '';
  if(!act){
    el.innerHTML = `<div class="curbar"><span class="cinfo"><b>${isSec(w) ? 'Nessun boulder su questo settore' : 'Nessun circuito su questo muro'}</b></span>${EDIT ? `<button class="btn primary" data-act="addc">${isSec(w) ? '+ Nuovo boulder' : '+ Nuovo circuito'}</button>` : ''}</div>`;
    return;
  }
  el.innerHTML = `<div class="curbar">`+
    `<button class="cinfo" data-act="clist" aria-label="Elenco circuiti"><i class="dot" style="background:${colOf(act)}"></i>`+
    `<span class="ctext"><b>${isSec(w) ? bTitleHtml(act) : cTitleHtml(act)}</b><small>${circMeta(act)}</small></span>${isSec(w) ? '' : gradeBadge(act.grade)}</button>`+
    (EDIT && S.mode === 'edit' ? `<button class="btn" data-act="cedit">Modifica</button>` : '')+
    `<button class="btn primary" data-act="clist">${isSec(w) ? `Boulder (${tot})` : `Circuiti (${tot})${filtered}`}</button></div>`;
}
function samStatus(w){
  const e = sam.emb[w.id];
  if(sam.state === 'failed') return sam.noWasm ? 'Riconoscimento intelligente non disponibile su questo telefono: uso il metodo semplice.' : 'Non sono riuscito a scaricare il riconoscimento intelligente (rete debole?): per ora uso il metodo semplice, riprovo al prossimo tocco.';
  if(sam.state === 'loading') return 'Scarico il riconoscimento intelligente (circa 33 MB, solo la prima volta)…';
  if(sam.state === 'ready' && e && !e.e) return 'Studio la foto del muro (qualche secondo)…';
  if(sam.state === 'ready' && e && e.e && sam.pre && sam.pre.key === samKey(w) && sam.pre.done < sam.pre.total) return `Riconoscimento intelligente pronto: tocca una presa (sto studiando i dettagli della foto, ${sam.pre.done}/${sam.pre.total}).`;
  if(sam.state === 'ready' && e && e.e) return 'Riconoscimento intelligente pronto: tocca una presa.';
  return 'Riconoscimento intelligente: si attiva al primo uso.';
}
function renderTools(){
  renderBusy();
  const w = curWall(), c = curCircuit(), el = $('#tools');
  if(!w){ el.innerHTML = ''; return; }
  if(EDIT && S.mode === 'wall'){
    const n = (w.holds || []).length;
    if(scanHere()){
      const s = ui.scan, pct = Math.round(100 * s.i / s.total);
      const txt = `${s.prep ? 'Preparo il riconoscimento intelligente…' : s.refine ? `Rifinisco i contorni ad alta risoluzione: ${pct}% (${s.i} di ${s.total} prese). Puoi fermarlo quando vuoi: le prese restano, solo meno precise.` : `Rilevamento automatico in corso${s.round ? ` (giro ${s.round})` : ''}: ${pct}% — ${s.found} nuove prese trovate finora. Può volerci qualche minuto: puoi fermarlo quando vuoi.`}`;
      /* si aggiorna solo il testo: il tasto Ferma resta lo stesso e il tocco non si perde */
      const hp = el.querySelector('.scanhint');
      if(hp && el.querySelector('[data-act=stopauto]')) hp.textContent = txt;
      else el.innerHTML = `<p class="hint scanhint">${esc(txt)}</p><button class="btn primary" data-act="stopauto">Ferma</button>`;
      
      return;
    }
    if(w.locked){
      el.innerHTML = `<p class="hint">Muro bloccato: ${n} prese. Per modificarlo, sbloccalo.</p>`+
        `<button class="btn" data-act="unlock">Sblocca muro</button>`+
        `<button class="btn primary" data-act="tracing">Torna ai circuiti</button>`;
      return;
    }
    const cs = ui.csel != null && (w.holds || [])[ui.csel];
    const drawing = ui.tool === 'draw', erasing = ui.tool === 'erase';
    const nsus = catSuspects(w).size;
    const tb = (v,l) => `<button data-act="tool" data-v="${v}" aria-pressed="${ui.tool === v}">${l}</button>`;
    let hint;
    if(drawing) hint = (ui.redraw != null ? 'Ridisegna il contorno: ' : '') + 'passa il dito lungo il bordo della presa (staccandolo vicino all\'inizio si chiude da solo), oppure tocca i punti e poi Chiudi. Con due dita sposti e ingrandisci.';
    else if(erasing) hint = 'Gomma: tocca un contorno per eliminarlo. Puoi ripristinare l\'ultimo eliminato.';
    else if(ui.tool === 'panel') hint = 'Tocca uno o più punti di pannello vuoto, uno per ogni zona con colore/luce diversi. "Fine campionamento" quando hai finito.';
    else hint = `${n} prese nel muro. Tocca un contorno per selezionarlo (tocca ancora nello stesso punto per passare a quello sotto). Quelli arancioni sembrano sospetti.`;
    const samples = w.panelSamples || [];
    const swatches = samples.map(s => `<span style="display:inline-block;width:1em;height:1em;border-radius:50%;background:rgb(${s.rgb.join(',')});border:1px solid #888;margin:0 3px -2px 0"></span>`).join('');
    const panelLine = samples.length
      ? `${swatches}${samples.length} campion${samples.length>1?'i':'e'} — <button class="linklike" data-act="panelReset">azzera</button>`
      : 'automatico (nessun campione)';
    let h = `<p class="hint">${hint}</p><div class="seg">${tb('detect','Rileva')}${tb('draw','Disegna')}${tb('erase','Gomma')}${tb('panel','Colore pannello')}</div>`+
      (ui.tool === 'panel' ? `<button class="btn primary" data-act="panelDone">Fine campionamento</button>` : '') +
      `<p class="hint">Riferimento colore pannello: ${panelLine}</p>`+
      `<p class="hint">${samStatus(w)}</p>`+
      (ui.scan ? `<button class="btn" disabled>Rilevamento in corso su un altro muro</button>` : `<button class="btn" data-act="autoall">Rileva tutte le prese</button>`)+
      (ui.cleared && ui.cleared.id === w.id ? `<button class="btn" data-act="unclrall">Annulla cancellazione (${ui.cleared.holds.length})</button>` :
        `<button class="btn danger" data-act="clrall" ${n ? '' : 'disabled'}>${ui.confirm === 'clrall' ? `Tocca ancora: cancello ${n} prese` : 'Cancella tutte le prese'}</button>`);
    if(drawing){
      h += `<button class="btn primary" data-act="closeDraw" ${ui.draft.length >= 3 ? '' : 'disabled'}>Chiudi</button>`+
           `<button class="btn" data-act="undoPt" ${ui.draft.length ? '' : 'disabled'}>Annulla punto</button>`+
           `<button class="btn" data-act="cancelDraw" ${ui.draft.length || ui.redraw != null ? '' : 'disabled'}>Annulla disegno</button>`;
    } else if(erasing){
      h += `<button class="btn" data-act="undel" ${ui.trash.length ? '' : 'disabled'}>Ripristina (${ui.trash.length})</button>`+
           `<button class="btn" data-act="susnext" ${nsus ? '' : 'disabled'}>Sospette (${nsus})</button>`;
    } else {
      if(cs && catSuspects(w).has(ui.csel)) h += `<div class="susbar"><span>Presa sospetta: il contorno è giusto?</span><button class="btn primary" data-act="susok">Va bene</button><button class="btn danger" data-act="susdel">Elimina</button></div>`;
      h += `<div class="seg"><button data-act="size" data-d="-1" aria-label="Contorno più piccolo" ${cs ? '' : 'disabled'}>Contorno &minus;</button>`+
           `<button data-act="size" data-d="1" aria-label="Contorno più grande" ${cs ? '' : 'disabled'}>Contorno +</button></div>`+
           `<button class="btn" data-act="redraw" ${cs ? '' : 'disabled'}>Ridisegna</button>`+
           `<button class="btn" data-act="del" ${cs ? '' : 'disabled'}>Elimina</button>`+
           `<button class="btn" data-act="susnext" ${nsus ? '' : 'disabled'}>Sospette (${nsus})</button>`+
           `<button class="btn" data-act="undel" ${ui.trash.length ? '' : 'disabled'}>Ripristina (${ui.trash.length})</button>`;
    }
    h += `<button class="btn primary" data-act="lock" ${drawing && ui.draft.length ? 'disabled' : ''}>Blocca muro e traccia</button>`;
    el.innerHTML = h;
    return;
  }
  if(EDIT && S.mode !== 'view' && bOver()){ el.innerHTML = ''; return; }   /* foto d'insieme dello staff: si sceglie il boulder dall'elenco */
  if(!EDIT || S.mode === 'view'){
    const p = S.prefs;
    /* circuiti: numeri (accesi di base), linee (spente) e altri circuiti del muro in trasparenza (spenti). Si ricordano su questo telefono */
    const tg = (k, l) => `<button class="btn ${p[k] ? 'on' : ''}" data-act="pref" data-k="${k}" aria-pressed="${!!p[k]}">${l}</button>`;
    el.innerHTML = c && !isSec(w) ? `<div class="mini">${tg('numbers', 'Numeri')}${tg('lines', 'Linee')}${w.circuits.length > 1 ? tg('othersV', 'Altri circuiti') : ''}</div>` : '';
    return;
  }
  const h = c && ui.sel != null ? c.holds[ui.sel] : null;
  const role = h ? h.role : ui.nextRole;
  const rb = (v,l) => `<button data-act="role" data-v="${v}" aria-pressed="${role === v}">${l}</button>`;
  const hand = h ? (h.hand || '') : ui.nextHand;
  const dot = col => `<span style="display:inline-block;width:.7em;height:.7em;border-radius:50%;background:${col};border:1px solid #888;margin-right:6px;vertical-align:-1px"></span>`;
  const hb = (v,l) => `<button data-act="hand" data-v="${v}" aria-pressed="${hand === v}">${l}</button>`;
  const sec = isSec(w), lbl = h && !h.poly ? 'Anello' : 'Contorno';
  if(sec && ui.bline){
    el.innerHTML = `<p class="hint">Passa il dito sulla foto dalla partenza all'arrivo, lungo la direzione del blocco. Puoi rifarla quante volte vuoi.</p>`+
      `<div class="trow"><button class="btn primary" data-act="lineok">Fatto</button>`+
      (c && c.line ? `<button class="btn danger" data-act="linedel">Togli la linea</button>` : '')+
      `<button class="btn" data-act="lineesc">Annulla</button></div>`;
    return;
  }
  if(sec && ui.bdraw){
    el.innerHTML = `<p class="hint">${h ? 'Ridisegna il contorno' : 'Disegna il contorno della presa'}: passa il dito lungo il bordo (staccandolo vicino all'inizio si chiude da solo), oppure tocca i punti e poi Chiudi. Con due dita sposti e ingrandisci.</p>`+
      (h ? '' : `<div class="trow"><div class="seg">${rb('start','Punto di partenza')}${rb('hold','Presa')}${rb('top','Arrivo')}</div></div>`)+
      `<div class="trow"><button class="btn primary" data-act="bclose" ${ui.draft.length >= 3 ? '' : 'disabled'}>Chiudi</button>`+
      `<button class="btn" data-act="bundo" ${ui.draft.length ? '' : 'disabled'}>Annulla punto</button>`+
      `<button class="btn" data-act="bcancel">Esci</button></div>`;
    return;
  }
  const roles = `<div class="seg" role="group" aria-label="Tipo di presa">${rb('start', sec ? 'Punto di partenza' : 'Partenza')}${rb('hold','Presa')}${rb('top','Arrivo')}${sec ? '' : rb('foot','Piede')}</div>`;
  const hands = sec || role === 'foot' ? '' : `<div class="seg" role="group" aria-label="Mano">${hb('L',dot(S.prefs.handL)+'Sinistra')}${hb('R',dot(S.prefs.handR)+'Destra')}</div>`;
  const dimBtn = `<button class="btn ${ui.editDim ? 'on' : ''}" data-act="editdim" aria-pressed="${!!ui.editDim}">Oscura</button>`;
  if(h){
    /* presa selezionata: tutto ciò che la riguarda, e "Fatto" per tornare a segnare */
    el.innerHTML = `<p class="hint">${ui.move ? 'Tocca il punto dove spostarla.' : 'Presa selezionata: cambia tipo' + (sec ? '' : ' o mano') + ', contorno o posizione.'}</p>`+
      `<div class="trow">${roles}${hands}</div>`+
      `<div class="trow"><div class="seg"><button data-act="size" data-d="-1" aria-label="${lbl} più piccolo">${lbl} &minus;</button><button data-act="size" data-d="1" aria-label="${lbl} più grande">${lbl} +</button></div>`+
      `<button class="btn ${ui.move ? 'on' : ''}" data-act="move">Sposta</button>`+
      (sec ? `<button class="btn" data-act="bdraw">Ridisegna</button>` : `<button class="btn" data-act="dup" title="${dupLabel(c, ui.sel) === 'Accoppia' ? 'Aggiunge un passaggio sulla stessa presa con l\'altra mano' : 'Aggiunge un nuovo passaggio su questa presa, come prossimo movimento'}">${dupLabel(c, ui.sel)}</button>`)+
      (sec && isStart(h) && (h.marks || []).length ? `<button class="btn" data-act="clrmarks">Togli i segni (${h.marks.length})</button>` : '')+
      `<button class="btn danger" data-act="del">Elimina</button>`+
      `<button class="btn primary" data-act="desel">Fatto</button></div>`;
    return;
  }
  /* nessuna selezione: si scelgono tipo (e mano) della prossima presa e si tocca la foto */
  const first = !c || !c.holds.length;
  let hint = first ? 'Tocca la presa di partenza' : 'Tocca la prossima presa';
  hint += sec ? ': ne rilevo il contorno.' : '.';
  if(sec && ui.nextRole === 'start') hint = `<!--s-->Punto di partenza: tocca la presa vicino al bordo, dove va il segno. Da 1 a 4 segni (mani e piedi), anche tutti sulla stessa presa${c ? ` · segnati ${startMarks(c)}/4` : ''}. Poi passa a Presa.`;
  if(!first && !hint.startsWith('<!--s-->')) hint += ' Tocca una presa già segnata per modificarla.';
  const candOn = sec && c && ui.cand && ui.cand.cid === c.id;
  if(!sec && ui.nextRole === 'foot' && !h) hint = 'Piede obbligato: tocca le prese da usare solo con i piedi. Restano tratteggiate in giallo con l\'impronta, senza numero. Poi torna su Presa.';
  if(candOn) hint = `${ui.cand.list.length} prese proposte (tratteggiate): tocca quelle del blocco per aggiungerle, oppure aggiungile tutte e togli poi quelle che non c'entrano.`;
  if(sec && !candOn) hint += ` <span style="opacity:.75">${samStatus(w)}</span>`;
  el.innerHTML = `<p class="hint">${hint}</p>`+
    `<div class="trow">${roles}${hands}</div>`+
    `<div class="trow">`+
    (candOn ? `<button class="btn primary" data-act="candall">Aggiungi tutte (${ui.cand.list.length})</button><button class="btn" data-act="candno">Chiudi proposte</button>` :
      sec && c && c.holds.some(h => isStart(h) && h.poly) ? `<button class="btn" data-act="candfind">Trova prese di questo colore</button>` : '')+
    (sec ? `<button class="btn" data-act="bdraw" ${c ? '' : 'disabled'}>Disegna a mano</button>` : '')+
    (sec ? `<button class="btn" data-act="bline" ${c ? '' : 'disabled'}>${c && c.line ? 'Rifai linea' : 'Linea'}</button>` : '')+
    (first ? '' : `<button class="btn" data-act="undo">Annulla ultima</button>`)+
    dimBtn+(sec ? '' : `<button class="btn ${S.prefs.others ? 'on' : ''}" data-act="pref" data-k="others" aria-pressed="${!!S.prefs.others}">Altri circuiti</button>`)+`</div>`;
}
/* regole delle modalità (Muro = preparazione delle prese, Traccia, Guarda):
   - i settori boulder non hanno la fase Muro;
   - un muro non ancora bloccato si prepara in Muro (il tracciatore, che non prepara muri, lo guarda soltanto) */
function normalizeMode(w){
  if(!EDIT || !w) return;
  /* niente più "Guarda" per lo staff: si torna sempre a tracciare, tranne il tracciatore su un muro non ancora pronto */
  if(isSec(w)){ if(S.mode === 'wall' || S.mode === 'view') S.mode = 'edit'; return; }
  if(S.mode === 'view' && w.locked) S.mode = 'edit';
  if(!isMgr()){ if(S.mode === 'wall' || (!w.locked && S.mode === 'edit')) S.mode = 'view'; }
  else if(!w.locked && S.mode === 'edit') S.mode = 'wall';
}
/* il riconoscimento intelligente si prepara solo dove servirà un tocco: Muro (non bloccato) e boulder aperto da tracciare, non su griglia o foto d'insieme */
function needsSam(w){ return EDIT && w && !ui.home && !bGrid() && !bOver() && ((!w.locked && S.mode === 'wall') || (isSec(w) && S.mode === 'edit')); }
function render(){
  const w = curWall();
  normalizeMode(w);
  if(needsSam(w) && samMaybe() && !(sam.emb[w.id] && sam.emb[w.id].key === samKey(w))) samWarm(w);
  else if(needsSam(w) && sam.state === 'ready' && sam.emb[w.id] && sam.emb[w.id].e && !(sam.pre && sam.pre.key === samKey(w))) preStudy(w);
  const viewing = !EDIT || S.mode === 'view';
  if(viewing && w && isSec(w)){ const v = sortedVisible(w); if(v.length && !v.some(x => x.id === w.activeCircuit)) w.activeCircuit = v[0].id; }
  if(ui.full && (!viewing || !curCircuit())) ui.full = false;
  $('#app').classList.toggle('full', !!ui.full);
  $('#app').classList.toggle('grid', bGrid() || ui.home);
  $('#app').classList.toggle('home', !!ui.home);
  $('#app').classList.toggle('over', bOver());
  $('#app').classList.toggle('ccomp', cCompact());
  /* colonna laterale sugli schermi larghi (decide il CSS): solo dentro un settore o un muro */
  $('#app').classList.toggle('side', !ui.home && !bGrid() && !!curWall());
  /* scorrimento col dito: finché la foto non è ingrandita, il gesto orizzontale lo gestisce l'app e non il browser */
  $('#app').classList.toggle('swipeok', newC() && !(ui.zoom > 1.02));
  renderTop(); renderViewbar(); renderPub(); renderStage(); renderChips(); renderTools(); renderFull(); }
/* ordine degli elenchi: circuiti per grado e nome, boulder per difficoltà e numero */
const circCmp = (x, y) => gradeIdx(x.grade) - gradeIdx(y.grade) || String(x.name).localeCompare(String(y.name));
const bouldCmp = (x, y) => diffIdx(x) - diffIdx(y) || (x.num || 0) - (y.num || 0) || (isOff(x) ? 1 : 0) - (isOff(y) ? 1 : 0);
function sortedVisible(w){ return visibleCircuits(w).slice().sort(isSec(w) ? bouldCmp : circCmp); }
function renderFull(){
  const el = $('#fcard'), w = curWall(), c = curCircuit();
  if(!ui.full || !w || !c){ el.hidden = true; el.innerHTML = ''; return; }
  const list = sortedVisible(w), i = list.findIndex(x => x.id === c.id);
  el.hidden = false;
  el.innerHTML = `<div class="row" style="flex-wrap:nowrap;align-items:center;gap:12px">`+
    `<i class="dot" style="background:${colOf(c)};width:16px;height:16px"></i>`+
    `<span class="ctext" style="flex:1"><b>${tickMark(c)}${isSec(w) ? bTitleHtml(c) : cTitleHtml(c)}${isSec(w) && c.style ? ` · ${esc(c.style)}` : ''}</b><small>${isSec(w) ? esc([c.setter ? 'di ' + c.setter : '', c.dateSet ? 'montato ' + fmtDate(c.dateSet) : '', c.dateRemoved ? (isOff(c) ? 'smontato ' : 'smonta ') + fmtDate(c.dateRemoved) : ''].filter(Boolean).join(' · ')) : circMeta(c)}</small></span>${isSec(w) ? '' : gradeBadge(c.grade)}</div>`+
    (isSec(w) && (c.tags || []).length ? `<div class="tags" style="margin:10px 0 0">${c.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : '')+
    (isSec(w) && c.notes ? `<p class="bnotes">${esc(c.notes)}</p>` : '')+
    tickPanel(w, c)+
    (newC() ? `<div class="row fnavrow" style="margin-top:10px;flex-wrap:nowrap">`+
      `<button class="btn farrow" data-act="fnav" data-d="-1" ${i > 0 ? '' : 'disabled'} aria-label="Precedente">‹</button>`+
      /* al centro: il percorso aperto e la striscia dei percorsi (un pallino ciascuno, si tocca per andarci) */
      `<div class="fstrip"><small class="fwhere">${esc(isSec(w) ? bTitle(c) : c.name)}${list.length > 1 && i >= 0 ? ` · ${i + 1} di ${list.length}` : ''}</small>`+
      `<div class="fdots">${list.map(x => { const t = acctOn() ? tickOf(x) : null; return `<button class="fd ${x.id === c.id ? 'on' : ''} ${t && t.status === 'fatto' ? 'done' : ''}" data-act="fgo" data-id="${x.id}" aria-label="${esc(isSec(w) ? bTitle(x) : x.name)}" style="--c:${colOf(x)};color:${inkOn(colOf(x))}">${t && t.status === 'fatto' ? '✓' : ''}</button>`; }).join('')}</div></div>`+
      `<button class="btn farrow" data-act="fnav" data-d="1" ${i >= 0 && i < list.length - 1 ? '' : 'disabled'} aria-label="Successivo">›</button></div>` :
    `<div class="row" style="margin-top:10px;flex-wrap:nowrap">`+
    `<button class="btn" data-act="fnav" data-d="-1" ${i > 0 ? '' : 'disabled'} aria-label="Precedente">‹</button>`+
    `<button class="btn primary" data-act="fexit" style="flex:1">${isSec(w) ? 'Elenco boulder' : 'Elenco circuiti'}</button>`+
    `<button class="btn" data-act="fnav" data-d="1" ${i >= 0 && i < list.length - 1 ? '' : 'disabled'} aria-label="Successivo">›</button></div>`);
}
function setFull(on){
  if(on && !ui.full){ ui.full = true; try{ history.pushState({ full: 1 }, ''); }catch(e){} }
  else if(!on && ui.full){ ui.full = false; }
  ui.zoom = 1; render();
  if(ui.full) focusCircuit();
}
/* a schermo intero si ingrandisce sul blocco: tutte le sue prese dentro lo schermo, con un po' di margine */
function focusCircuit(){
  const w = curWall(), c = curCircuit(); if(!w || !c || !c.holds.length) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    c.holds.forEach(h => { const b = holdBox(h, w.w); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); });
    const pad = Math.max(w.w, w.h)*0.06; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const box = $('#box'), k0 = Math.min(box.clientWidth / w.w, box.clientHeight / w.h);
    ui.zoom = clamp(Math.min(box.clientWidth / ((x1 - x0)*k0), box.clientHeight / ((y1 - y0)*k0)), 1, 5);
    fit();
    const st = $('#stage'), k = st.clientWidth / w.w;
    box.scrollLeft = st.offsetLeft + (x0 + x1)/2*k - box.clientWidth/2;
    box.scrollTop = st.offsetTop + (y0 + y1)/2*k - box.clientHeight/2;
  }));
}
window.addEventListener('popstate', () => {
  const st = history.state || {};
  if(ui.full){ ui.full = false; ui.zoom = 1; render(); }
  else if(EDIT && BO() && ui.bLevel === 'sector' && !ui.secOver && st.sec && !st.ed){ ui.secOver = true; ui.sel = null; ui.zoom = 1; render(); }
  else if(ui.bLevel === 'sector' && !st.sec){ ui.bLevel = 'sectors'; ui.zoom = 1; render(); }
  else if(!ui.home && !st.grid && !st.sec){ ui.home = true; ui.zoom = 1; render(); }
});

/* ---------- pannelli ---------- */
/* ordine della griglia: per i clienti i settori nuovi o recenti in cima */
function gridWalls(){
  const l = secWalls();
  return newC() && BO() ? l.slice().sort((x, y) => { const rx = secLabel(x) ? 1 : 0, ry = secLabel(y) ? 1 : 0; return ry - rx || (rx ? String(secRenew(y)).localeCompare(String(secRenew(x))) : 0); }) : l;
}
/* scorrimento col dito (clienti): a schermo intero passa al blocco vicino, sulla foto del settore al settore vicino */
function swipeGo(d){
  const w = curWall(); if(!w || ui.home || bGrid() || ui.sheet) return;
  if(ui.full){
    const list = sortedVisible(w), i = list.findIndex(x => x.id === w.activeCircuit), n = list[i + d];
    if(n){ w.activeCircuit = n.id; ui.sel = null; save(); render(); focusCircuit(); } return;
  }
  const l = gridWalls(), i = l.findIndex(x => x.id === w.id), n = l[i + d]; if(!n) return;
  S.active = n.id; ui.lastSec[ui.section] = n.id; saveBUI(); ui.zoom = 1; ui.sel = null; ui.secOver = true;
  ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit()); save(); render(); $('#box').scrollTop = 0;
  toast(n.name, 1200);
}
(function swipe(){
  /* due strade, per i telefoni che si comportano in modo diverso: eventi "pointer" e, in riserva, eventi "touch".
     Il primo dei due che riconosce il gesto lo esegue; l'altro viene ignorato per mezzo secondo. */
  let g = null, lastGo = 0;
  const dbg = () => {};
  const why = () => {};
  const start = (x, y, src, always) => { if(!newC()) return; g = { x, y, lx: x, ly: y, t: Date.now(), src, always }; dbg('dito giù (' + src + ')'); };
  const moveTo = (x, y) => { if(g){ g.lx = x; g.ly = y; } };
  const finish = (x, y, how) => {
    if(!g || !newC()) { g = null; return; }
    const G = g; g = null;
    const dx = (x == null ? G.lx : x) - G.x, dy = (y == null ? G.ly : y) - G.y, ms = Date.now() - G.t;
    if(Date.now() - lastGo < 500) return;
    if(ms > 900) return why('troppo lento (' + how + ')', dx, dy, ms);
    if(Math.abs(dx) < 45) return why('troppo corto (' + how + ')', dx, dy, ms);
    if(Math.abs(dx) < 1.3 * Math.abs(dy)) return why('troppo in diagonale (' + how + ')', dx, dy, ms);
    if(!G.always && ui.zoom > 1.02) return why('foto ingrandita', dx, dy, ms);
    if(ui.home || bGrid() || ui.sheet) return why('non sei in un settore', dx, dy, ms);
    lastGo = Date.now(); ui.pinchAt = Date.now(); dbg('scorrimento ok (' + G.src + ', ' + how + ')');
    swipeGo(dx < 0 ? 1 : -1);
  };
  const bind = (el, always) => {
    if(!el) return;
    el.addEventListener('pointerdown', e => { if(e.pointerType === 'mouse' || !e.isPrimary) return; start(e.clientX, e.clientY, 'pointer', always); }, { passive: true });
    el.addEventListener('pointermove', e => { if(e.isPrimary) moveTo(e.clientX, e.clientY); }, { passive: true });
    el.addEventListener('pointerup', e => { if(e.isPrimary && g && g.src === 'pointer') finish(e.clientX, e.clientY, 'su'); }, { passive: true });
    el.addEventListener('pointercancel', e => { if(e.isPrimary && g && g.src === 'pointer') finish(null, null, 'interrotto'); }, { passive: true });
    el.addEventListener('touchstart', e => { if(e.touches.length !== 1){ g = null; return; } if(!g) start(e.touches[0].clientX, e.touches[0].clientY, 'touch', always); }, { passive: true });
    /* non passivo: se il gesto è chiaramente orizzontale, si impedisce al browser di prenderselo */
    el.addEventListener('touchmove', e => { if(!g) return; if(e.touches.length !== 1){ g = null; return; } const t = e.touches[0]; moveTo(t.clientX, t.clientY);
      const dx = t.clientX - g.x, dy = t.clientY - g.y; if(newC() && Math.abs(dx) > 12 && Math.abs(dx) > 1.3 * Math.abs(dy) && (always || !(ui.zoom > 1.02)) && e.cancelable) e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', e => { if(g){ const t = e.changedTouches[0]; finish(t ? t.clientX : null, t ? t.clientY : null, 'fine tocco'); } }, { passive: true });
    el.addEventListener('touchcancel', () => { if(g) finish(null, null, 'tocco interrotto'); }, { passive: true });
  };
  bind(document.getElementById('box'), false); bind(document.getElementById('fcard'), true);
})();
/* ---------- account cliente e "Le mie salite" ---------- */
/* chi entra senza essere nello staff è un cliente, a meno che non abbia usato l'accesso staff su questo telefono:
   così il link di conferma aperto in un altro browser (succede spesso dall'app della posta) non dà l'avviso dello staff */
const loginIntent = () => { try{ return localStorage.getItem('login-intent') || 'cliente'; }catch(e){ return 'cliente'; } };
const setIntent = v => { try{ localStorage.setItem('login-intent', v); }catch(e){} };
const welcomeSeen = () => { try{ return localStorage.getItem('mr-welcome') === '1'; }catch(e){ return false; } };
async function loadTicks(){
  const { data, error } = await SB.from('ticks').select('item_id,wall_id,status,vote,rating,grade,done_at,moves,from_project,high,high_ups,high_at,updated_at');
  ui.ticks = new Map(); ui.ticksErr = !!error;
  (data || []).forEach(t => ui.ticks.set(t.item_id, t));
  render(); if(ui.sheet) renderSheet();
}
async function loadTickSum(){
  try{ let { data, error } = await SB.rpc('tick_stats'); if(error) ({ data, error } = await SB.rpc('tick_summary')); if(!error && Array.isArray(data)){ ui.tsum = new Map(data.map(r => [r.item_id, r])); render(); } }catch(e){}
}
const tickOf = c => (c && ui.ticks && ui.ticks.get(c.id)) || null;
async function saveTick(w, c, next, restore){
  const prev = tickOf(c), before = acctOn() ? earnedBadges() : null;
  if(next) ui.ticks.set(c.id, next); else ui.ticks.delete(c.id);
  render();
  if(next && !restore){ next.grade = isSec(w) ? (c.diff || null) : (c.grade || null); next.done_at = next.status === 'fatto' ? ((prev && prev.status === 'fatto' && prev.done_at) || new Date().toISOString()) : null;
    /* per i badge: movimenti del circuito (Chilometraggio) e se era un progetto */
    next.moves = next.status === 'fatto' ? (isSec(w) ? (c.holds || []).length : movesOf(c)) || null : null;
    next.from_project = next.status === 'fatto' && !!prev && (prev.status === 'progetto' || !!prev.from_project); }
  const r = next ? await SB.from('ticks').upsert({ item_id: c.id, wall_id: w.id, status: next.status, vote: next.vote || null, rating: next.rating || null, grade: next.grade, done_at: next.done_at, moves: next.moves, from_project: next.from_project, high: next.high || null, high_ups: next.high_ups || 0, high_at: next.high_at || null, updated_at: new Date().toISOString() })
                 : await SB.from('ticks').delete().eq('item_id', c.id);
  if(r && r.error){ if(prev) ui.ticks.set(c.id, prev); else ui.ticks.delete(c.id); render(); toast('Non riesco a salvare: ' + (r.error.message || 'riprova tra poco.')); return; }
  if(before && !restore){ const now = earnedBadges(), got = [...now].filter(id => !before.has(id)); if(got.length){ const b = BADGES.find(x => x.id === got[got.length - 1]); badgeCelebrate(b); setNewB(newB().concat(got)); } }
}
function tick(status){
  const w = curWall(), c = curCircuit(); if(!w || !c) return;
  if(!ACC()){ ui.acctMode = 'new'; ui.acctWhy = true; openSheet('acct'); return; }
  if(!ui.ticks) ui.ticks = new Map();
  const t = tickOf(c);
  /* togliere un Fatto (o un Progetto con il record) fa perdere data, voto e gradimento: si può annullare */
  const loses = t && (t.status === 'fatto' ? (t.status === status || status === 'progetto') : t.status === status && !!t.high);
  if(loses){ const old = Object.assign({}, t), nm = blockTitle(w, c);
    setTimeout(() => toast((old.status === 'fatto' ? 'Tolto il Fatto da ' : 'Tolto il Progetto da ') + nm, 6000, () => saveTick(w, c, old, true)), 50); }
  if(t && t.status === status) saveTick(w, c, null);
  else saveTick(w, c, { item_id: c.id, wall_id: w.id, status, vote: status === 'fatto' && t ? t.vote : null, rating: status === 'fatto' && t ? t.rating || null : null, high: t ? t.high || null : null, high_ups: t ? t.high_ups || 0 : 0, high_at: t ? t.high_at || null : null, updated_at: new Date().toISOString() });
}
function rate(n){
  const w = curWall(), c = curCircuit(), t = tickOf(c); if(!w || !c || !t || t.status !== 'fatto') return;
  n = Math.max(1, Math.min(10, +n || 0));
  saveTick(w, c, Object.assign({}, t, { rating: t.rating === n ? null : n, updated_at: new Date().toISOString() }));
}
function vote(v){
  const w = curWall(), c = curCircuit(), t = tickOf(c); if(!w || !c || !t || t.status !== 'fatto') return;
  saveTick(w, c, Object.assign({}, t, { vote: t.vote === v ? null : v, updated_at: new Date().toISOString() }));
}
/* circuiti in progetto: fin dove sei arrivato (movimento N di M). Si salva dopo una pausa, così le frecce si possono toccare di fila */
let hiTimer = null;
function setHigh(d){
  const w = curWall(), c = curCircuit(), t = tickOf(c); if(!w || !c || !t || t.status !== 'progetto' || isSec(w)) return;
  const M = movesOf(c); if(!M) return;
  const old = t.high || 0, n = Math.max(0, Math.min(M, old + d)); if(n === old) return;
  ui.hiBase = ui.hiBase != null ? ui.hiBase : old;   /* record di partenza di questa serie di tocchi */
  Object.assign(t, { high: n || null, updated_at: new Date().toISOString() });
  render(); if(ui.sheet) renderSheet();
  clearTimeout(hiTimer); hiTimer = setTimeout(() => { const base = ui.hiBase || 0; ui.hiBase = null; const cur = tickOf(c); if(!cur || cur.status !== 'progetto') return;
    const up = (cur.high || 0) > base && base > 0;   /* un passo avanti su un record già segnato */
    const next = Object.assign({}, cur, (cur.high || 0) > base ? { high_at: new Date().toISOString(), high_ups: (cur.high_ups || 0) + (up ? 1 : 0) } : {});
    saveTick(w, c, next); if(up) toast('Nuovo record: movimento ' + cur.high + ' di ' + movesOf(c) + '!'); }, 900);
}
const tickMark = c => { if(!newC() || !acctOn()) return ''; const t = tickOf(c); return t ? (t.status === 'fatto' ? '<span class="tk done" aria-label="fatto">✓</span>' : '<span class="tk proj" aria-label="progetto">☆</span>') : ''; };
function tickPanel(w, c){
  if(EDIT){
    const sm = ui.tsum && ui.tsum.get(c.id); if(!sm) return '';
    const v = (+sm.facile || 0) + (+sm.giusto || 0) + (+sm.duro || 0);
    const pc = k => Math.round((+sm[k] || 0) / v * 100) + '%';
    const nv = +sm.voti || 0;
    return `<p class="tsum">Clienti: <b>${sm.fatti}</b> ${+sm.fatti === 1 ? 'salita' : 'salite'}${nv ? ` · piaciuto <b>${String(sm.media).replace('.', ',')}</b>/10 <small>(${nv} ${nv === 1 ? 'voto' : 'voti'})</small>` : ''}${v ? ` · grado: facile ${pc('facile')} · giusto ${pc('giusto')} · duro ${pc('duro')} <small>(${v} ${v === 1 ? 'parere' : 'pareri'})</small>` : ''}</p>`;
  }
  if(!newC() || !acctOn()) return '';
  const t = tickOf(c), st = t ? t.status : '';
  return `<div class="tickrow"><button class="tbtn ${st === 'fatto' ? 'on' : ''}" data-act="tick" data-v="fatto" aria-pressed="${st === 'fatto'}">✓ Fatto</button>`+
    `<button class="tbtn ${st === 'progetto' ? 'on proj' : ''}" data-act="tick" data-v="progetto" aria-pressed="${st === 'progetto'}">☆ Progetto</button></div>`+
    (st === 'progetto' && !isSec(w) && movesOf(c) ? (() => { const M = movesOf(c), h = t.high || 0;
      return `<div class="voterow"><small>Fin dove sei arrivato?${t.high_at ? ` <span class="muted">record del ${fmtDate(t.high_at.slice(0, 10))}</span>` : ''}</small><div class="hirow"><button class="btn" data-act="hi" data-v="-1" aria-label="Un movimento in meno" ${h ? '' : 'disabled'}>‹</button><span class="hival"><b>${h ? 'movimento ' + h : 'non segnato'}</b><small>di ${M}</small></span><button class="btn" data-act="hi" data-v="1" aria-label="Un movimento in più" ${h < M ? '' : 'disabled'}>›</button></div><span class="mybar hib"><i style="width:${Math.round(100 * h / M)}%"></i></span></div>`; })() : '')+
    (st === 'fatto' ? `<div class="voterow"><small>Il grado ti è sembrato</small><div class="seg">${[['facile','Facile'],['giusto','Giusto'],['duro','Duro']].map(o => `<button data-act="vote" data-v="${o[0]}" aria-pressed="${t.vote === o[0]}">${o[1]}</button>`).join('')}</div></div>`+
      `<div class="voterow"><small>Quanto ti è piaciuto?${t.rating ? ` <b>${t.rating}/10</b>` : ''}</small><div class="rate">${Array.from({ length: 10 }, (_, k) => k + 1).map(n => `<button data-act="rate" data-v="${n}" aria-pressed="${t.rating === n}" class="${t.rating && n <= t.rating ? 'on' : ''}">${n}</button>`).join('')}</div></div>` : '');
}
/* elementi di "Le mie salite": blocchi ancora esistenti (anche smontati) con la loro salita */
function mineItems(){
  if(!ui.ticks) return [];
  const out = [];
  ui.ticks.forEach(t => { const w = S.walls.find(x => x.id === t.wall_id), c = w && w.circuits.find(x => x.id === t.item_id); if(w && c) out.push({ t, w, c, gone: !!w.archived || (isSec(w) && isOff(c)) }); });
  return out;
}
/* ---------- badge: calcolati dalle salite del cliente, nessun dato in più ---------- */
const B_FAM = { cost: ['Costanza', '#ff7a1a'], var: ['Varietà', '#22c3e6'], col: ['Colori', '#e5312b'], prog: ['Progressi', '#4dd4ac'], gym: ['Per la palestra', '#23b45a'], km: ['Chilometraggio', '#8a4dff'], tec: ['Tecnica', '#ffd400'], ora: ['Orari', '#5b8cff'], sed: ['Sedute', '#ff5fa2'] };
function badgeStats(){
  const T = ui.ticks ? [...ui.ticks.values()] : [], done = T.filter(t => t.status === 'fatto');
  const find = t => { const w = S.walls.find(x => x.id === t.wall_id), c = w && w.circuits.find(x => x.id === t.item_id); return { w, c }; };
  const D = done.map(t => { const { w, c } = find(t); const g = t.grade || (c ? (w && isSec(w) ? c.diff : c.grade) : null);
    const isB = w ? isSec(w) : DIFFS.some(d => d[0] === g);
    const mv = t.moves || (c ? (isB ? (c.holds || []).length : movesOf(c)) : 0);
    return { t, w, c, g, isB, mv, at: t.done_at ? new Date(t.done_at) : t.updated_at ? new Date(t.updated_at) : null }; });
  const dayKey = d => d ? d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() : '';
  const days = {}; D.forEach(x => { const k = dayKey(x.at); if(k) days[k] = (days[k] || 0) + 1; });
  const weekKey = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return Math.round(x.getTime() / 6048e5); };
  const weeks = [...new Set(D.filter(x => x.at).map(x => weekKey(x.at)))].sort((a, b) => a - b);
  let run = 0, best = 0, prev = null; weeks.forEach(w => { run = prev !== null && w === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = w; });
  const secs = S.walls.filter(w => isSec(w) && !w.archived);
  const secDone = new Set(D.filter(x => x.isB && x.w).map(x => x.w.id));
  const cleanSec = secs.filter(w => { const on = w.circuits.filter(c => c.diff && !isOff(c)); return on.length >= 3 && on.every(c => { const t = ui.ticks && ui.ticks.get(c.id); return t && t.status === 'fatto'; }); }).length;
  const bestSec = secs.reduce((m, w) => { const on = w.circuits.filter(c => c.diff && !isOff(c)); if(on.length < 3) return m; const k = on.filter(c => { const t = ui.ticks && ui.ticks.get(c.id); return t && t.status === 'fatto'; }).length; return Math.max(m, on.length - k === 0 ? 0 : -(on.length - k)) ; }, -999);
  return { n: D.length, nB: D.filter(x => x.isB).length, nC: D.filter(x => !x.isB).length, moves: D.filter(x => !x.isB).reduce((t, x) => t + (x.mv || 0), 0),
    colors: new Set(D.filter(x => x.isB).map(x => x.g)), secDone: secDone.size, secTot: secs.length, cleanSec, missToClean: bestSec === -999 ? null : -bestSec,
    weeks: best, proj: D.some(x => x.t.from_project), hiUps: T.reduce((n, t) => n + (t.high_ups || 0), 0), nFeet: D.filter(x => !x.isB && x.c && x.c.holds.some(isFoot)).length, rated: T.filter(t => t.status === 'fatto' && t.rating && t.vote).length,
    early: D.filter(x => x.at && x.at.getHours() < 9).length, late: D.filter(x => x.at && x.at.getHours() >= 22).length,
    dayColors: (() => { const m = {}; D.filter(x => x.isB && x.at && ['bianco','blu','verde','giallo','rosso'].includes(x.g)).forEach(x => { const k = dayKey(x.at); (m[k] = m[k] || new Set()).add(x.g); }); return Math.max(0, ...Object.values(m).map(v => v.size)); })(),
    colorN: D.filter(x => x.isB).reduce((m, x) => { m[x.g] = (m[x.g] || 0) + 1; return m; }, {}),
    nRate: T.filter(t => t.status === 'fatto' && t.rating).length, nVote: T.filter(t => t.status === 'fatto' && t.vote).length, bestDay: Math.max(0, ...Object.values(days)) };
}
const BADGES = [
  { id: 'primo', f: 'cost', name: 'Primo passo', desc: 'Il primo percorso fatto', ok: s => s.n >= 1, left: s => 'segna il tuo primo percorso' },
  ...[10, 50, 100, 250].map(k => ({ id: 's' + k, f: 'cost', name: k + ' salite', desc: k + ' percorsi fatti, boulder e circuiti', ok: s => s.n >= k, left: s => 'ancora ' + (k - s.n), big: String(k) })),
  { id: 'w4', f: 'cost', name: 'Abitudine', desc: 'Salite in 4 settimane di fila', ok: s => s.weeks >= 4, left: s => s.weeks + ' di 4 settimane', big: '4' },
  { id: 'w12', f: 'cost', name: 'Habitué', desc: 'Salite in 12 settimane di fila', ok: s => s.weeks >= 12, left: s => s.weeks + ' di 12 settimane', big: '12' },
  { id: 'arco', f: 'var', name: 'Arcobaleno', desc: 'Almeno un boulder per colore, dal bianco al rosso', ok: s => ['bianco','blu','verde','giallo','rosso'].every(c => s.colors.has(c)), left: s => 'mancano: ' + ['bianco','blu','verde','giallo','rosso'].filter(c => !s.colors.has(c)).join(', ') },
  { id: 'arcoday', f: 'var', name: 'Arcobaleno in giornata', desc: 'Un boulder per colore, dal bianco al rosso, nello stesso giorno', ok: s => s.dayColors >= 5, left: s => 'record: ' + s.dayColors + ' colori in un giorno' },
  { id: 'arco2', f: 'var', name: 'Doppio arcobaleno', desc: 'Almeno due boulder per colore, dal bianco al rosso', ok: s => ['bianco','blu','verde','giallo','rosso'].every(c => (s.colorN[c] || 0) >= 2), left: s => 'mancano: ' + ['bianco','blu','verde','giallo','rosso'].filter(c => (s.colorN[c] || 0) < 2).join(', ') },
  { id: 'giro', f: 'var', name: 'Giramondo', desc: 'Almeno un boulder in ogni settore', ok: s => s.secTot > 0 && s.secDone >= s.secTot, left: s => s.secDone + ' di ' + s.secTot + ' settori' },
  { id: 'pulito', f: 'var', name: 'Settore pulito', desc: 'Tutti i boulder in parete di un settore', ok: s => s.cleanSec >= 1, left: s => s.missToClean != null ? 'te ne mancano ' + s.missToClean + ' nel settore più vicino' : 'chiudi tutti i boulder di un settore' },
  { id: 'doppia', f: 'var', name: 'Doppia anima', desc: 'Almeno 10 boulder e 10 circuiti', ok: s => s.nB >= 10 && s.nC >= 10, left: s => Math.min(s.nB, 10) + '/10 boulder · ' + Math.min(s.nC, 10) + '/10 circuiti' },
  ...[['blu','Primo blu'],['verde','Primo verde'],['giallo','Primo giallo'],['rosso','Primo rosso'],['nero','Primo nero']].map(([c, n]) => ({ id: 'c_' + c, f: 'col', name: n, desc: 'Il primo boulder ' + c + ' chiuso', ok: s => s.colors.has(c), left: s => 'chiudi un boulder ' + c, dot: (DIFFS.find(d => d[0] === c) || [])[2] })),
  ...[5, 20].map(k => ({ id: 'hi' + k, f: 'prog', name: k === 5 ? 'Un passo più in là' : 'Testardo', desc: k + ' volte hai migliorato il tuo punto più alto su un circuito in progetto', ok: s => s.hiUps >= k, left: s => s.hiUps + ' di ' + k, big: String(k) })),
  { id: 'proj', f: 'prog', name: 'Progetto chiuso', desc: 'Un percorso passato da Progetto a Fatto', ok: s => s.proj, left: s => 'segna un progetto, poi chiudilo' },
  /* per la palestra: più riscontri sui percorsi. Gradimento (1-10) e parere sul grado contano a parte */
  ...[[1, 'Mi piace!'], [10, 'Occhio critico'], [50, 'Critico di fiducia'], [100, 'Voce della palestra']].map(([k, n]) => ({ id: 'g' + k, f: 'gym', name: n, desc: k === 1 ? 'Il primo voto di gradimento a un percorso' : k + ' percorsi votati da 1 a 10', ok: s => s.nRate >= k, left: s => k === 1 ? 'dai un voto da 1 a 10 a un percorso fatto' : s.nRate + ' di ' + k, big: k > 1 ? String(k) : null })),
  ...[[1, 'Primo parere'], [10, 'Metro alla mano'], [50, 'Giudice di parete'], [100, 'Bilancia d\'oro']].map(([k, n]) => ({ id: 'p' + k, f: 'gym', name: n, desc: k === 1 ? 'Il primo parere sul grado (facile, giusto, duro)' : k + ' pareri sul grado dei percorsi', ok: s => s.nVote >= k, left: s => k === 1 ? 'di\' se il grado ti è sembrato facile, giusto o duro' : s.nVote + ' di ' + k, big: k > 1 ? String(k) : null })),
  ...[100, 250, 500, 1000, 2500, 5000].map(k => ({ id: 'm' + k, f: 'km', name: k.toLocaleString('it-IT') + ' movimenti', desc: k.toLocaleString('it-IT') + ' movimenti sui circuiti fatti', ok: s => s.moves >= k, left: s => s.moves.toLocaleString('it-IT') + ' di ' + k.toLocaleString('it-IT'), big: k >= 1000 ? String(k / 1000).replace('.', ',') + 'k' : String(k) })),
  /* circuiti con piedi obbligati chiusi */
  ...[[1, 'Piede fino'], [10, 'Piedi di velluto'], [25, 'Ballerino'], [50, 'Piede di scimmia']].map(([k, n]) => ({ id: 'ft' + k, f: 'tec', name: n, desc: k === 1 ? 'Il primo circuito con piedi obbligati' : k + ' circuiti con piedi obbligati', ok: s => s.nFeet >= k, left: s => k === 1 ? 'chiudi un circuito con piedi obbligati' : s.nFeet + ' di ' + k, big: k > 1 ? String(k) : null })),
  ...[[1, 'Mattiniero'], [10, 'Allodola'], [30, 'Primo raggio']].map(([k, n]) => ({ id: k === 1 ? 'early' : 'early' + k, f: 'ora', name: n, desc: (k === 1 ? 'Un percorso fatto' : k + ' percorsi fatti') + ' prima delle 9', ok: s => s.early >= k, left: s => k === 1 ? 'prima delle 9 del mattino' : s.early + ' di ' + k, big: k > 1 ? String(k) : null })),
  ...[[1, 'Nottambulo'], [10, 'Gufo'], [30, 'Luna piena']].map(([k, n]) => ({ id: k === 1 ? 'late' : 'late' + k, f: 'ora', name: n, desc: (k === 1 ? 'Un percorso fatto' : k + ' percorsi fatti') + ' dopo le 22', ok: s => s.late >= k, left: s => k === 1 ? 'dopo le 22' : s.late + ' di ' + k, big: k > 1 ? String(k) : null })),
  ...[5, 10, 20].map(k => ({ id: 'd' + k, f: 'sed', name: k === 5 ? 'Bella sessione' : k === 10 ? 'Seduta piena' : 'Maratona', desc: k + ' percorsi fatti nello stesso giorno', ok: s => s.bestDay >= k, left: s => 'record: ' + s.bestDay + ' in un giorno', big: String(k) }))
];
function earnedBadges(){ const st = badgeStats(); return new Set(BADGES.filter(b => b.ok(st)).map(b => b.id)); }
/* aspetto dei badge: toppa esagonale "ricamata" nel colore del gruppo, dentro il metallo (bronzo, argento, oro) secondo la difficoltà.
   Quelli da prendere sono grigi, con il bordo che si riempie man mano che ci si avvicina */
const B_ICO = {
  post6: '<path d="M-1.1-12.5h2.2v20.5h-2.2z"/><path d="M1.1 -11.5h7.0l2 1.6-2 1.6h-7.0z"/><path d="M-1.1 -7.2h-6.0l-2 1.6 2 1.6h6.0z"/><path d="M1.1 -2.9h8.0l2 1.6-2 1.6h-8.0z"/><path d="M-1.1 1.4h-5.5l-2 1.6 2 1.6h5.5z"/><path d="M1.1 5.7h7.0l2 1.6-2 1.6h-7.0z"/><circle cy="-13" r="1.8"/><path d="M-6 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  post5: '<path d="M-1.1-12.5h2.2v20.5h-2.2z"/><path d="M1.1 -11.5h7.0l2 1.6-2 1.6h-7.0z"/><path d="M-1.1 -7.2h-6.0l-2 1.6 2 1.6h6.0z"/><path d="M1.1 -2.9h8.0l2 1.6-2 1.6h-8.0z"/><path d="M-1.1 1.4h-5.5l-2 1.6 2 1.6h5.5z"/><path d="M1.1 5.7h7.0l2 1.6-2 1.6h-7.0z"/><path d="M-6 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  post4: '<path d="M-1.1-12.5h2.2v20.5h-2.2z"/><path d="M1.1 -11.5h7.0l2 1.6-2 1.6h-7.0z"/><path d="M-1.1 -7.2h-6.0l-2 1.6 2 1.6h6.0z"/><path d="M1.1 -2.9h8.0l2 1.6-2 1.6h-8.0z"/><path d="M-1.1 1.4h-5.5l-2 1.6 2 1.6h5.5z"/><path d="M-6 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  post3: '<path d="M-1.1-12.5h2.2v20.5h-2.2z"/><path d="M1.1 -11.5h7.0l2 1.6-2 1.6h-7.0z"/><path d="M-1.1 -7.2h-6.0l-2 1.6 2 1.6h6.0z"/><path d="M1.1 -2.9h8.0l2 1.6-2 1.6h-8.0z"/>',
  post2: '<path d="M-1.1-12.5h2.2v20.5h-2.2z"/><path d="M1.1 -11.5h7.0l2 1.6-2 1.6h-7.0z"/><path d="M-1.1 -7.2h-6.0l-2 1.6 2 1.6h6.0z"/>',
  post1: '<path d="M-1.1-12.5h2.2v20.5h-2.2z"/><path d="M1.1 -11.5h7.0l2 1.6-2 1.6h-7.0z"/>',
  monkeyprint: '<path d=\"M-6 0c0-3 2-4.5 6-4.5S6.5-3 6.5 0v5c0 4-3 6.5-6.5 6.5S-6 9-6 5z\"/><g stroke=\"currentColor\" stroke-width=\"3.1\" stroke-linecap=\"round\"><path d=\"M-4.6-4.5l-1.2-6.3M-1.5-5l-.3-7M1.6-5l.6-6.8M4.6-4.2l1.6-5.6M-6 3.5l-5-3.5\"/></g>',
  ibexprint: '<path d=\"M-1.2-10c-4 .6-5.6 6-5 12 .2 2.4 1.6 3.6 3.6 3.6S-1 4-1 2z\"/><path d=\"M1.2-10c4 .6 5.6 6 5 12-.2 2.4-1.6 3.6-3.6 3.6S1 4 1 2z\"/><path d=\"M-6.5 3.5h13\" stroke=\"var(--bg)\" stroke-width=\"1.4\"/>',
  elephant: '<circle cy=\"1.5\" r=\"9.5\"/><g fill=\"var(--bg)\"><ellipse cx=\"-6\" cy=\"-5\" rx=\"1.9\" ry=\"1.5\" transform=\"rotate(-35 -6 -5)\"/><ellipse cx=\"-2.1\" cy=\"-7.2\" rx=\"1.9\" ry=\"1.5\" transform=\"rotate(-12 -2 -7)\"/><ellipse cx=\"2.1\" cy=\"-7.2\" rx=\"1.9\" ry=\"1.5\" transform=\"rotate(12 2 -7)\"/><ellipse cx=\"6\" cy=\"-5\" rx=\"1.9\" ry=\"1.5\" transform=\"rotate(35 6 -5)\"/></g><g fill=\"none\" stroke=\"var(--bg)\" stroke-width=\".9\" opacity=\".7\"><path d=\"M-5 2q2 2 4 0t4 0M-4 6q2 1.6 4 0t4 0\"/></g>',
  peak: '<path d="M-11 9L-3-5l4 6 3-4 7 12z"/><path d="M-3-5v-6l5 2-5 2"/>',
  fire: '<path d="M0-11c3 5 8 7 8 13a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 1 5 3 5-1-4 0-7 1-10z"/>',
  rainbow: '<g fill="none" stroke-width="3"><path d="M-11 6a11 11 0 0 1 22 0" stroke="#e5312b"/><path d="M-7.5 6a7.5 7.5 0 0 1 15 0" stroke="#f2c200"/><path d="M-4 6a4 4 0 0 1 8 0" stroke="#1e6bff"/></g>',
  pin: '<path d="M0 11S-8 2-8-3a8 8 0 0 1 16 0c0 5-8 14-8 14z"/><circle cy="-3" r="3" fill="var(--bg)"/>',
  check: '<path d="M-10 0l6 6L10-8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  two: '<circle cx="-4.5" r="6"/><circle cx="4.5" r="6" fill="none" stroke="currentColor" stroke-width="2.6"/>',
  up: '<path d="M0-11l9 10h-5v10h-8V-1h-5z"/>',
  star: '<path d="M0-11l3.2 6.6 7.2 1-5.2 5 1.3 7.2L0 5.4l-6.5 3.4 1.3-7.2-5.2-5 7.2-1z"/>',
  eye: '<path d="M-11 0s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle r="4" fill="var(--bg)"/><circle r="2"/>',
  hold: '<path d="M-9 4c-3-6 0-13 7-14 7-1 12 4 11 10-1 7-8 11-13 9-2-1-4-2-5-5z"/><circle cx="1" cy="-1" r="2.6" fill="var(--bg)"/>',
  foot: '<path d="M-2 10c-4 0-5-3.4-4.5-7.3.6-3.7 1.7-7.5 5-7.5s4.8 3 4.6 6.5C2.8 5.9 1.4 10-2 10z"/><circle cx="-3.6" cy="-8.6" r="1.8"/><circle cx="-.3" cy="-9.6" r="1.6"/><circle cx="2.6" cy="-8.5" r="1.4"/><circle cx="4.8" cy="-6.1" r="1.3"/>',
  sun: '<circle r="5"/><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M0-11v3M0 8v3M-11 0h3M8 0h3M-7.8-7.8l2 2M5.8 5.8l2 2M-7.8 7.8l2-2M5.8-5.8l2-2"/></g>',
  moon: '<path d="M3-10a10 10 0 1 0 7 15A8 8 0 0 1 3-10z"/>',
  bolt: '<path d="M2-12L-8 2h7l-3 10L8-3H1z"/>',
  peak1: '<path d=\"M-9 9L0-5l9 14z\"/><path d=\"M0-5v-6.5l4.5 1.7L0-8.2\" fill=\"currentColor\"/>',
  peak2: '<path d=\"M-12 9L-4-3l3 4 4-7 9 15z\"/><path d=\"M3-6l-1.8 3 .9-.4.9.8.9-.8 1 .4z\" fill=\"#fff\"/>',
  peak3: '<path d=\"M-13 9l6-9 2.5 3L1-8l4 6 2.5-3L13 9z\"/><path d=\"M1-8l-2.4 3.9 1.2-.5 1.2 1 1.2-1 1.3.5z\" fill=\"#fff\"/>',
  peak4: '<path d=\"M-13 9l6-9 2.5 3L1-9l4 6 2.5-3L13 9z\"/><path d=\"M1-9l-2.8 4.5 1.4-.6 1.4 1.1 1.4-1.1 1.4.6z\" fill=\"#fff\"/><path d=\"M-7 0l-1.6 2.5.8-.3.8.6.8-.6.9.3zM7.5-3l-1.5 2.3.8-.3.7.6.8-.6.8.3z\" fill=\"#fff\"/>',
  peak5: '<circle cx=\"-9\" cy=\"-8\" r=\"2.6\"/><path d=\"M-13 10l6-9 2.5 3L1-8l4 6 2.5-3L13 10z\"/><path d=\"M1-8l-2.8 4.5 1.4-.6 1.4 1.1 1.4-1.1 1.4.6z\" fill=\"#fff\"/><path d=\"M-7 1l-1.6 2.5.8-.3.8.6.8-.6.9.3zM7.5-2l-1.5 2.3.8-.3.7.6.8-.6.8.3z\" fill=\"#fff\"/><path d=\"M1-8v-5.5l4 1.5-4 1.5\" fill=\"currentColor\"/>',
  fire1: '<path d=\"M0-12c2 4 1 6 4 8 0-2 1-3 2-4 2 3 4 6 4 10a10 10 0 0 1-20 0c0-4 2-7 4-9 0 2 1 4 2 4 0-4 1-7 4-9z\"/><path d=\"M0 0c1.5 2.5 4 3.5 4 6.5a4 4 0 0 1-8 0c0-1.6.8-2.8 1.8-3.6 0 1 .5 1.6 1 1.6 0-1.8.3-3.2 1.2-4.5z\" fill=\"#fff\" fill-opacity=\".85\"/>',
  fire2: '<path d=\"M0-13c2 4 .5 6 3.5 8.5.3-2.5 1.5-4 3-5 1 3 4.5 6 4.5 10.5a11 11 0 0 1-22 0c0-3.5 1.5-6 3.5-8-.2 2 .5 3.5 1.8 4.2-.3-2.6.6-5 2-6.6 0 1.6.4 2.6 1.2 3.1C-2.5-9-1.5-11 0-13z\"/><path d=\"M.5-3c1.8 3 5 4 5 7.8a5.5 5.5 0 0 1-11 0c0-2 1-3.6 2.4-4.6 0 1.2.6 2 1.3 2.2-.2-2.2.8-4 2.3-5.4z\" fill=\"#fff\" fill-opacity=\".85\"/><path d=\"M.3 3.5c.8 1.4 2.2 2 2.2 3.6a2.3 2.3 0 0 1-4.6 0c0-1 .6-1.8 1.4-2.3 0 .6.3.9.6 1 0-.9.1-1.6.4-2.3z\" fill=\"currentColor\"/>',
  rainbow2: '<g fill=\"none\" stroke-width=\"2.4\"><path d=\"M-12 5a12 12 0 0 1 24 0\" stroke=\"#e5312b\"/><path d=\"M-9 5a9 9 0 0 1 18 0\" stroke=\"#f2c200\"/><path d=\"M-6 5a6 6 0 0 1 12 0\" stroke=\"#1e6bff\"/></g><g fill=\"none\" stroke-width=\"1.5\" opacity=\".55\"><path d=\"M-12 12a12 12 0 0 1 24 0\" stroke=\"#1e6bff\" transform=\"translate(0 -12) scale(1.18) translate(0 1)\"/></g>',
  rainday: '<circle cx=\"7\" cy=\"-7\" r=\"3.4\"/><g stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\"><path d=\"M7-13v1.6M12.8-7h-1.6M11.2-11.2l-1.1 1.1M2.8-11.2l1.1 1.1\"/></g><g fill=\"none\" stroke-width=\"2.8\"><path d=\"M-12 8a10 10 0 0 1 20 0\" stroke=\"#e5312b\"/><path d=\"M-8.8 8a6.8 6.8 0 0 1 13.6 0\" stroke=\"#f2c200\"/><path d=\"M-5.6 8a3.6 3.6 0 0 1 7.2 0\" stroke=\"#1e6bff\"/></g>',
  globe: '<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"><circle cy=\"-3\" r=\"7.6\"/><ellipse cy=\"-3\" rx=\"3.2\" ry=\"7.6\"/><path d=\"M-7.6-3h15.2M-6.6-7h13.2M-6.6 1h13.2\"/><path d=\"M-6.5-12.2A10.3 10.3 0 0 0 5.8 5.2\" stroke-width=\"2.2\"/></g><path d=\"M0 5.5v4\" stroke=\"currentColor\" stroke-width=\"2.4\"/><path d=\"M-6 12.5c0-2.2 2.6-3.2 6-3.2s6 1 6 3.2z\"/>',
  hearts: '<g transform=\"translate(-6 2) scale(.55)\"><path d=\"M0 10S-10 3-10-3.5A5.2 5.2 0 0 1 0-6.4 5.2 5.2 0 0 1 10-3.5C10 3 0 10 0 10z\"/></g><g transform=\"translate(6 2) scale(.55)\"><path d=\"M0 10S-10 3-10-3.5A5.2 5.2 0 0 1 0-6.4 5.2 5.2 0 0 1 10-3.5C10 3 0 10 0 10z\"/></g><g transform=\"translate(0 -3) scale(.8)\"><path d=\"M0 10S-10 3-10-3.5A5.2 5.2 0 0 1 0-6.4 5.2 5.2 0 0 1 10-3.5C10 3 0 10 0 10z\" stroke=\"var(--bg)\" stroke-width=\"1.6\"/></g>',
  wig: '<path d=\"M-7.5 4c-.5-9 3-13 7.5-13s8 4 7.5 13z\"/><ellipse cy=\"1.5\" rx=\"4\" ry=\"5.2\" fill=\"var(--bg)\"/><g><circle cx=\"-8.6\" cy=\"1\" r=\"2.3\"/><circle cx=\"-9\" cy=\"5.4\" r=\"2.3\"/><circle cx=\"-8.6\" cy=\"9.8\" r=\"2.3\"/><circle cx=\"8.6\" cy=\"1\" r=\"2.3\"/><circle cx=\"9\" cy=\"5.4\" r=\"2.3\"/><circle cx=\"8.6\" cy=\"9.8\" r=\"2.3\"/></g><path d=\"M-6-6.5q6-3 12 0\" fill=\"none\" stroke=\"var(--bg)\" stroke-width=\"1\"/>',
  road: '<path d=\"M-7.5 11.5V-10.5h15v22z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linejoin=\"round\"/><path d=\"M-7.5-4.5h15\" stroke=\"currentColor\" stroke-width=\"1.6\"/><text y=\"6\" text-anchor=\"middle\" font-family=\"Barlow Semi Condensed, Arial\" font-weight=\"700\" font-size=\"8\" fill=\"currentColor\">km</text>',
  goat: '<path d=\"M-1-10.5c-4.2 1.2-6.5 7-5.8 13.5L-1 4.5z\" transform=\"rotate(-20 -1 4)\"/><path d=\"M1-10.5c4.2 1.2 6.5 7 5.8 13.5L1 4.5z\" transform=\"rotate(20 1 4)\"/>',
  monkey: '<circle cx=\"-9.2\" cy=\"-1\" r=\"3.6\"/><circle cx=\"9.2\" cy=\"-1\" r=\"3.6\"/><circle cx=\"-9.2\" cy=\"-1\" r=\"1.6\" fill=\"var(--bg)\"/><circle cx=\"9.2\" cy=\"-1\" r=\"1.6\" fill=\"var(--bg)\"/><circle r=\"9.2\"/><path d=\"M0-3.2c1.6-2 6-2.2 6 1.6 0 1.2-.5 2-1.2 2.6 1.5.8 2.4 2.4 2.4 4.2 0 3.4-3.2 5.2-7.2 5.2s-7.2-1.8-7.2-5.2c0-1.8.9-3.4 2.4-4.2-.7-.6-1.2-1.4-1.2-2.6 0-3.8 4.4-3.6 6-1.6z\" fill=\"var(--bg)\"/><circle cx=\"-2.6\" cy=\"-1.6\" r=\"1.3\"/><circle cx=\"2.6\" cy=\"-1.6\" r=\"1.3\"/><circle cx=\"-1.1\" cy=\"3.2\" r=\".7\"/><circle cx=\"1.1\" cy=\"3.2\" r=\".7\"/><path d=\"M-2.6 6.2q2.6 1.6 5.2 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\"/>',
  sun1: '<circle r=\"3.6\"/><g stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M0-12v5.5M0 6.5V12M-12 0h5.5M6.5 0H12M-8.5-8.5l3.9 3.9M4.6 4.6l3.9 3.9M-8.5 8.5l3.9-3.9M4.6-4.6l3.9-3.9\"/></g>',
  sun2: '<circle r=\"5.4\"/><g stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M0-11.5v3.5M0 8v3.5M-11.5 0H-8M8 0h3.5M-8.1-8.1l2.5 2.5M5.6 5.6l2.5 2.5M-8.1 8.1l2.5-2.5M5.6-5.6l2.5-2.5\"/></g>',
  sun3: '<circle r=\"7.6\"/><g stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"><path d=\"M0-12v1.6M0 10.4V12M-12 0h1.6M10.4 0H12M-8.5-8.5l1.1 1.1M7.4 7.4l1.1 1.1M-8.5 8.5l1.1-1.1M7.4-7.4l1.1-1.1\"/></g>',
  moon1: '<path d="M4-10.5a10.5 10.5 0 1 0 6.4 17A9.2 9.2 0 0 1 4-10.5z"/>',
  moon2: '<path d=\"M0-10.5a10.5 10.5 0 0 1 0 21V5.5l-2.6-.4 1.8-1.7L-3.6 1.3 0 .3z\"/><circle cx=\"3.2\" cy=\"-3.6\" r=\"1.1\" fill=\"var(--bg)\"/><path d=\"M1.2 7.2q1.6.9 3 .2\" fill=\"none\" stroke=\"var(--bg)\" stroke-width=\"1\"/>',
  moon3: '<circle r=\"10.5\"/><circle cx=\"-3.6\" cy=\"-3.4\" r=\"2.6\" fill=\"var(--bg)\" fill-opacity=\".55\"/><circle cx=\"4\" cy=\"2.2\" r=\"3.1\" fill=\"var(--bg)\" fill-opacity=\".55\"/><circle cx=\"-2.4\" cy=\"5.6\" r=\"1.6\" fill=\"var(--bg)\" fill-opacity=\".55\"/><circle cx=\"4.4\" cy=\"-5.6\" r=\"1.2\" fill=\"var(--bg)\" fill-opacity=\".55\"/>',
  bolt2: '<g transform="translate(-4.5 0) scale(.78)"><path d="M2-12L-8 2h7l-3 10L8-3H1z"/></g><g transform="translate(4.5 0) scale(.78)"><path d="M2-12L-8 2h7l-3 10L8-3H1z"/></g>',
  bolt3: '<g transform="translate(-8 2) scale(.55)"><path d="M2-12L-8 2h7l-3 10L8-3H1z"/></g><g transform="translate(8 2) scale(.55)"><path d="M2-12L-8 2h7l-3 10L8-3H1z"/></g><path d="M2-12L-8 2h7l-3 10L8-3H1z"/>',
  broom: '<path d="M7-11L-1 2" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M-4 0l6 4-3 8c-3 0-8-2-10-5z"/><path d="M-6.5 6l-2 3M-3.5 7.5l-1.6 3.4M-.6 8.6l-1 3" stroke="var(--bg)" stroke-width="1.2"/><path d="M8 4l1.2 2.4L12 7l-2.8.6L8 10l-1.2-2.4L4 7l2.8-.6z"/>',
  tao: '<circle r="10.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M0-10a10 10 0 0 1 0 20a5 5 0 0 1 0-10a5 5 0 0 0 0-10z"/><circle cy="-5" r="1.7"/><circle cy="5" r="1.7" fill="var(--bg)"/>',
  heart: '<path d="M0 10S-10 3-10-3.5A5.2 5.2 0 0 1 0-6.4 5.2 5.2 0 0 1 10-3.5C10 3 0 10 0 10z"/>',
  scale: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M0-10v19M-6 9h12M-9-6h18M-9-6l-3 7M-9-6l3 7M9-6l-3 7M9-6l3 7"/></g><circle cy="-10" r="1.8"/><path d="M-12.5 1a3.5 2.5 0 0 0 7 0zM5.5 1a3.5 2.5 0 0 0 7 0z"/>',
  boar: '<path d="M-1.2-9.5c-3.4 1-5.6 6.5-5 11.4.3 2.2 2.8 2.8 4.1.9 1.1-1.7 1.4-6.6.9-12.3z"/><path d="M1.2-9.5c3.4 1 5.6 6.5 5 11.4-.3 2.2-2.8 2.8-4.1.9-1.1-1.7-1.4-6.6-.9-12.3z"/><ellipse cx="-6.8" cy="8.6" rx="1.6" ry="2.3"/><ellipse cx="6.8" cy="8.6" rx="1.6" ry="2.3"/>',
  bear: '<path d="M-8.5 7.5c-1-5.4 3.2-8.5 8.5-8.5s9.5 3.1 8.5 8.5c-.5 3.2-4.3 3.5-8.5 3s-8 0-8.5-3z"/><circle cx="-9.4" cy="-3.6" r="2.1"/><circle cx="-5" cy="-7.6" r="2.2"/><circle cx="0" cy="-9" r="2.3"/><circle cx="5" cy="-7.6" r="2.2"/><circle cx="9.4" cy="-3.6" r="2.1"/>',
};
const B_METAL = { b: ['#e0a466', '#8a5524'], s: ['#eef1f4', '#8c949e'], g: ['#ffe27a', '#c08a00'] };
/* per ogni badge: metallo, disegno e quanto manca (da 0 a 1) */
const B_LOOK = (() => {
  /* ser: una serie di badge; ico può essere un elenco (un disegno per gradino); grow = il disegno cresce a ogni gradino */
  const L = {}, ser = (ids, ico, pr, grow) => { const n = ids.length, T = n === 1 ? ['s'] : n === 2 ? ['b', 'g'] : n === 3 ? ['b', 's', 'g'] : n === 4 ? ['b', 's', 'g', 'g'] : n === 5 ? ['b', 'b', 's', 'g', 'g'] : ['b', 'b', 's', 's', 'g', 'g'];
    ids.forEach((id, k) => { L[id] = { t: T[k], i: Array.isArray(ico) ? ico[k] : ico, pr: pr ? (st => pr(st, id)) : null, sc: grow ? 0.78 + 0.5 * k / Math.max(1, n - 1) : 1 }; }); };
  const num = id => +id.replace(/\D/g, '') || 1;
  ser(['primo', 's10', 's50', 's100', 's250'], ['peak1', 'peak2', 'peak3', 'peak4', 'peak5'], (st, id) => st.n / num(id));
  ['primo', 's10', 's50', 's100', 's250'].forEach(id => { L[id].sc = 1.18; });
  ser(['w4', 'w12'], ['fire1', 'fire2'], (st, id) => st.weeks / num(id)); L.w4.t = 's';
  L.arco = { t: 'b', i: 'rainbow', pr: st => ['bianco','blu','verde','giallo','rosso'].filter(c => st.colors.has(c)).length / 5 };
  L.arcoday = { t: 's', i: 'rainday', pr: st => st.dayColors / 5 };
  L.arco2 = { t: 'g', i: 'rainbow2', pr: st => ['bianco','blu','verde','giallo','rosso'].reduce((t, c) => t + Math.min(2, st.colorN[c] || 0), 0) / 10 };
  L.giro = { t: 's', i: 'globe', pr: st => st.secTot ? st.secDone / st.secTot : 0 };
  L.pulito = { t: 'g', i: 'broom', pr: null };
  L.doppia = { t: 's', i: 'tao', pr: st => (Math.min(st.nB, 10) + Math.min(st.nC, 10)) / 20 };
  ['blu', 'verde', 'giallo', 'rosso', 'nero'].forEach((c, k) => { L['c_' + c] = { t: ['b', 'b', 's', 'g', 'g'][k], i: null, pr: null }; });
  L.proj = { t: 'b', i: 'star', pr: null };
  ser(['hi5', 'hi20'], 'up', (st, id) => st.hiUps / num(id)); L.hi5.t = 's';
  ser(['g1', 'g10', 'g50', 'g100'], ['heart', 'heart', 'heart', 'hearts'], (st, id) => st.nRate / num(id), true); L.g100.sc = 1.15;
  ser(['p1', 'p10', 'p50', 'p100'], ['scale', 'scale', 'scale', 'wig'], (st, id) => st.nVote / num(id), true); L.p100.sc = 1.1;
  ser(['m100', 'm250', 'm500', 'm1000', 'm2500', 'm5000'], 'stone', (st, id) => st.moves / num(id), true);
  ser(['early', 'early10', 'early30'], ['sun1', 'sun2', 'sun3'], (st, id) => st.early / num(id));
  ser(['late', 'late10', 'late30'], ['moon1', 'moon2', 'moon3'], (st, id) => st.late / num(id));
  ser(['d5', 'd10', 'd20'], ['bolt', 'bolt2', 'bolt3'], (st, id) => st.bestDay / num(id));
  ser(['ft1', 'ft10', 'ft25', 'ft50'], ['elephant', 'bear', 'ibexprint', 'monkeyprint'], (st, id) => st.nFeet / num(id));
  ['ft1', 'ft10', 'ft25', 'ft50'].forEach(id => { L[id].sc = 1.2; });   /* le impronte un po' più grandi, si leggono meglio */
  return L;
})();
let medalN = 0;
function medalSVG(b, ok, st, size){
  const lk = B_LOOK[b.id] || { t: 's', i: 'star' }, fam = B_FAM[b.f][1], id = 'md' + (medalN++);
  const [m1, m2] = B_METAL[lk.t], hex = r => { const p = []; for(let k = 0; k < 6; k++){ const a = Math.PI / 180 * (60*k - 90); p.push((r*Math.cos(a)).toFixed(1) + ',' + (r*Math.sin(a)).toFixed(1)); } return p.join(' '); };
  const pr = !ok && lk.pr && st ? Math.max(0, Math.min(1, lk.pr(st) || 0)) : 0;
  const ink = ok ? '#1a1a1a' : '#62676e', bg = ok ? m1 : '#3b3f45';
  /* pietra miliare: colonnino squadrato sul suo basamento, con il numero inciso sopra (niente numero sotto) */
  const stone = lk.i === 'stone' ? `<g transform="translate(0 -2) scale(${(1.1 + 0.35 * ((lk.sc || 1) - 0.78) / 0.5).toFixed(2)})" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round">`+
    `<defs><clipPath id="${id}c"><path d="M-11 13V-13h22v26z"/></clipPath></defs>`+
    `<path d="M-22 10L16-28l5.5 5.5L-16.5 15.5z" fill="${ink}" stroke="none" clip-path="url(#${id}c)"/>`+   /* la banda trasversale, come sui cartelli stradali */
    `<path d="M-11 13V-13l2.6-3.6h16.8L11-13v26z"/><path d="M-11-13h22"/><path d="M-15 13h30v8H-15z"/>`+
    `<text y="10" text-anchor="middle" font-family="Barlow Semi Condensed, Arial" font-weight="700" font-size="${!b.big ? 12 : b.big.length > 3 ? 9 : b.big.length > 2 ? 10.5 : 12}" fill="${ink}" stroke="${bg}" stroke-width="2.4" paint-order="stroke">${b.big || ''}</text></g>` : null;
  const glyph = stone ? stone : b.dot ? `<circle r="9" fill="${ok ? b.dot : '#55595f'}" stroke="${ok ? '#000' : '#666'}" stroke-opacity=".5" stroke-width="1.5"/>` :
    `<g transform="scale(${(1.45 * (lk.sc || 1)).toFixed(2)})" fill="${ink}" color="${ink}" style="--bg:${bg}">${ok ? B_ICO[lk.i] || B_ICO.star : (B_ICO[lk.i] || B_ICO.star).replace(/stroke="#[0-9a-f]{6}"/g, 'stroke="#62676e"').replace(/fill="#fff"/g, 'fill="#4f545b"').replace(/fill="#[0-9a-f]{6}"/g, 'fill="#62676e"')}</g>`;
  return `<svg viewBox="-60 -62 120 124" width="${size || 76}" height="${Math.round((size || 76) * 1.03)}" aria-hidden="true">`+
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ok ? m1 : '#4a4e55'}"/><stop offset="1" stop-color="${ok ? m2 : '#2e3136'}"/></linearGradient></defs>`+
    `<polygon points="${hex(56)}" fill="#1d1f23" stroke="${ok ? fam : '#34383e'}" stroke-width="7" stroke-linejoin="round"/>`+
    (pr > 0 ? `<polygon points="${hex(56)}" fill="none" stroke="${fam}" stroke-width="7" stroke-linejoin="round" pathLength="100" stroke-dasharray="${(pr*100).toFixed(1)} 100" transform="rotate(0)"/>` : '')+
    `<polygon points="${hex(48)}" fill="none" stroke="${ok ? '#fff' : '#555'}" stroke-opacity=".6" stroke-width="1.8" stroke-dasharray="4 3"/>`+
    `<polygon points="${hex(41)}" fill="url(#${id})"/>`+
    (ok ? `<path d="M-26-20 L-6-32" stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/>` : '')+
    `<g transform="translate(0 ${b.big && !stone ? -7 : 0})">${glyph}</g>`+
    (b.big && !stone ? `<text y="29" text-anchor="middle" font-family="Barlow Semi Condensed, Arial" font-weight="700" font-size="${b.big.length > 3 ? 14 : 17}" fill="${ink}">${b.big}</text>` : '')+
    `</svg>`;
}
/* sblocco: la medaglia compare grande al centro, poi si chiude da sola (o con un tocco) */
/* badge nuovi non ancora visti: pallino rosso sulla montagna, sulla scheda Badge e sul badge stesso. Restano anche riaprendo l'app */
const newB = () => { try{ return JSON.parse(localStorage.getItem('mr-badge-new') || '[]'); }catch(e){ return []; } };
const setNewB = l => { try{ localStorage.setItem('mr-badge-new', JSON.stringify([...new Set(l)])); }catch(e){} };
const hasNewB = () => acctOn() && newB().length > 0;
function badgeCelebrate(b){
  let el = document.getElementById('bcele'); if(el) el.remove();
  el = document.createElement('div'); el.id = 'bcele'; el.className = 'bcele';
  el.innerHTML = `<div class="bcin">${medalSVG(b, true, null, 168)}<small>Nuovo badge</small><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 3200);
}
/* in cima a Le mie salite: i badge in breve, si tocca per vederli tutti */
function badgeStrip(){
  const st = badgeStats(), got = BADGES.filter(b => b.ok(st)), rank = { g: 3, s: 2, b: 1 };
  const show = got.slice().sort((a, b) => (rank[(B_LOOK[b.id] || {}).t] || 0) - (rank[(B_LOOK[a.id] || {}).t] || 0)).slice(0, 4);
  return `<button class="bstrip" data-act="badges">${hasNewB() ? '<i class="mbd"></i>' : ''}<span class="bsm">${show.length ? show.map(b => medalSVG(b, true, st, 40)).join('') : medalSVG(BADGES[0], false, st, 40)}</span>`+
    `<span class="bst"><b>Badge · ${got.length} di ${BADGES.length}</b><small>${hasNewB() ? 'ne hai uno nuovo!' : got.length ? 'tocca per vederli tutti' : 'il primo arriva con la prima salita'}</small></span><svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
}
function badgesHtml(){
  const st = badgeStats(), got = BADGES.filter(b => b.ok(st)).length;
  return `<p class="dlab" style="margin-top:4px">Badge ottenuti: ${got} di ${BADGES.length} · ${st.moves.toLocaleString('it-IT')} movimenti sui circuiti</p>`+
    Object.keys(B_FAM).map(f => `<p class="dlab">${B_FAM[f][0]}</p><div class="bgrid">${BADGES.filter(b => b.f === f).map(b => { const ok = b.ok(st);
      return `<div class="badge ${ok ? 'ok' : ''} ${ok && (ui.nbShown || []).includes(b.id) ? 'isnew' : ''}" title="${esc(b.desc)}">${ok && (ui.nbShown || []).includes(b.id) ? '<i class="nbd">nuovo</i>' : ''}${medalSVG(b, ok, st)}<b>${esc(b.name)}</b><small>${esc(ok ? b.desc : b.left(st))}</small></div>`; }).join('')}</div>`).join('');
}
function mineHtml(){
  const a = ACC();
  if(!a) return `<h2>Le mie salite</h2><p>Segna i boulder e i circuiti che hai fatto e quelli che vuoi provare, e tieni d'occhio i tuoi progressi.</p>`+
    `<p class="note">Serve un account gratuito: ti chiediamo solo email e password.</p>`+
    `<div class="row"><button class="btn primary" data-act="acctmode" data-v="new">Crea account</button><button class="btn" data-act="acctmode" data-v="in">Ho già un account</button><button class="btn" data-act="close">Chiudi</button></div>`;
  if(!ui.ticks) return `<h2>Le mie salite</h2><p>Carico…</p>`;
  if(ui.ticksErr) return `<h2>Le mie salite</h2><p>Le salite non sono ancora disponibili. Riprova più tardi.</p><div class="row"><button class="btn" data-act="close">Chiudi</button></div>`;
  /* due sezioni, come nell'app: Boulder e Circuiti */
  const tab = ui.mineTab === 'boulder' || ui.mineTab === 'circ' ? ui.mineTab : (ui.section === 'boulder' ? 'boulder' : 'circ'), bo = tab === 'boulder';
  const tabs = (nB0, nC0) => `<div class="seg" role="group" aria-label="Sezione" style="margin:0 0 12px"><button data-act="minetab" data-v="boulder" aria-pressed="${tab === 'boulder'}">Boulder${nB0 ? ' · ' + nB0 : ''}</button><button data-act="minetab" data-v="circ" aria-pressed="${tab === 'circ'}">Circuiti${nC0 ? ' · ' + nC0 : ''}</button></div>`;
  const all = mineItems(), items = all.filter(x => isSec(x.w) === bo);
  const done = items.filter(x => x.t.status === 'fatto'), proj = items.filter(x => x.t.status === 'progetto' && !x.gone);
  const nB = all.filter(x => isSec(x.w) && x.t.status === 'fatto').length, nC = all.filter(x => !isSec(x.w) && x.t.status === 'fatto').length;
  const row = x => `<button class="lrow" data-act="minego" data-w="${x.w.id}" data-id="${x.c.id}"><i class="dot" style="background:${colOf(x.c)}"></i><span class="ctext" style="flex:1"><b>${esc(blockTitle(x.w, x.c))}</b><small>${esc([x.w.name, x.gone ? (isSec(x.w) ? 'smontato' : 'muro archiviato') : '', x.t.rating ? 'voto ' + x.t.rating + '/10' : '', x.t.vote ? 'per te ' + x.t.vote : '', fmtDate((x.t.updated_at || '').slice(0, 10))].filter(Boolean).join(' · '))}</small></span>${isSec(x.w) ? '' : gradeBadge(x.c.grade)}</button>`;
  const recent = done.slice().sort((x, y) => String(y.t.updated_at).localeCompare(String(x.t.updated_at))).slice(0, 15);
  let prog = '';
  if(bo){
    const onB = S.walls.filter(w => isSec(w) && !w.archived).flatMap(w => w.circuits.filter(c => c.diff && !isOff(c))), ids = new Set(done.map(x => x.c.id));
    prog = DIFFS.map(d => { const tot = onB.filter(c => c.diff === d[0]).length; if(!tot) return ''; const k = onB.filter(c => c.diff === d[0] && ids.has(c.id)).length;
      return `<div class="pbar"><i class="dot" style="background:${d[2]}"></i><span class="pname">${d[1]}</span><span class="ptrack"><span style="width:${Math.round(k / tot * 100)}%;background:${d[2]}"></span></span><b>${k}/${tot}</b></div>`; }).join('');
    if(prog) prog = `<p class="dlab">In parete adesso: fatti per colore</p>` + prog;
  } else {
    const live = done.filter(x => !x.gone), grades = [...new Set(live.map(x => x.c.grade).filter(Boolean))].sort((x, y) => gradeIdx(x) - gradeIdx(y));
    if(grades.length) prog = `<p class="dlab">Sui muri adesso: fatti per grado</p><div class="sdots" style="padding:0">${grades.map(g => `<span class="sdot">${gradeBadge(g)} ${live.filter(x => x.c.grade === g).length}</span>`).join('')}</div>`;
  }
  const what = bo ? 'un boulder' : 'un circuito';
  /* da sempre: tutte le salite segnate, anche di blocchi smontati o muri archiviati (il grado è salvato con la salita) */
  const isB = g => DIFFS.some(d => d[0] === g);
  const allDone = [...ui.ticks.values()].filter(t => t.status === 'fatto').map(t => {
    const x = all.find(q => q.t === t); const g = t.grade || (x ? (isSec(x.w) ? x.c.diff : x.c.grade) : null);
    const kindB = x ? isSec(x.w) : isB(g); return { g, kindB, at: t.done_at || t.updated_at || '' };
  }).filter(d => d.kindB === bo && d.g);
  let ever = '';
  if(allDone.length){
    const cnt = bo ? DIFFS.filter(d => allDone.some(x => x.g === d[0])).map(d => `<span class="sdot"><i style="background:${d[2]}"></i>${allDone.filter(x => x.g === d[0]).length}</span>`).join('')
                   : [...new Set(allDone.map(x => x.g))].sort((x, y) => gradeIdx(x) - gradeIdx(y)).map(g => `<span class="sdot">${gradeBadge(g)} ${allDone.filter(x => x.g === g).length}</span>`).join('');
    const top = bo ? DIFFS.filter(d => allDone.some(x => x.g === d[0])).pop() : null;
    const topC = !bo ? allDone.map(x => x.g).sort((x, y) => gradeIdx(y) - gradeIdx(x))[0] : null;
    /* ultimi 6 mesi, una barra per mese divisa per colore (boulder) o unica (circuiti) */
    const now = new Date(), months = Array.from({ length: 6 }, (_, k) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + k, 1); return { key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), lab: d.toLocaleDateString('it-IT', { month: 'short' }) }; });
    const per = months.map(m => allDone.filter(x => String(x.at).slice(0, 7) === m.key)), mx = Math.max(1, ...per.map(l => l.length));
    const bars = months.map((m, k) => { const l = per[k];
      const segs = bo ? DIFFS.map(d => { const n = l.filter(x => x.g === d[0]).length; return n ? `<i style="height:${n / mx * 100}%;background:${d[2]}"></i>` : ''; }).reverse().join('') : (l.length ? `<i style="height:${l.length / mx * 100}%;background:#ff7a1a"></i>` : '');
      return `<div class="mbar"><b>${l.length || ''}</b><span class="mcol">${segs}</span><small>${m.lab}</small></div>`; }).join('');
    ever = `<p class="dlab">Da sempre, anche ${bo ? 'gli smontati' : 'i muri archiviati'}</p>`+
      `<div class="dsum" style="grid-template-columns:repeat(2,1fr)"><div><b>${allDone.length}</b><small>${bo ? 'boulder fatti in tutto' : 'circuiti fatti in tutto'}</small></div>`+
      `<div><b>${bo ? (top ? `<span class="sdot" style="font-size:22px"><i style="background:${top[2]};width:16px;height:16px"></i>${top[1]}</span>` : '–') : (topC ? esc(topC) : '–')}</b><small>${bo ? 'il colore più duro' : 'il grado più duro'}</small></div></div>`+
      `<div class="sdots" style="padding:0;margin:8px 0 0">${cnt}</div>`+
      `<p class="dlab" style="margin-top:14px">Mese per mese</p><div class="mchart">${bars}</div>`;
  }
  return `<h2>Le mie salite</h2>`+
    badgeStrip() + tabs(nB, nC)+
    `<div class="dsum" style="grid-template-columns:repeat(2,1fr)"><div><b>${done.filter(x => !x.gone).length}</b><small>${bo ? 'fatti tra quelli in parete' : 'fatti tra quelli sui muri'}</small></div><div><b>${proj.length}</b><small>progetti</small></div></div>`+
    prog + ever+
    `<p class="dlab">Progetti</p>` + (proj.length ? `<div class="list" style="gap:0">${proj.map(x => { const M = !isSec(x.w) ? movesOf(x.c) : 0, h = x.t.high || 0;
      return M && h ? row(x).replace('</small></span>', `</small><span class="hiline"><span class="mybar hib"><i style="width:${Math.round(100 * h / M)}%"></i></span><b>${h}/${M}</b></span></span>`) : row(x); }).join('')}</div>` : `<p class="hint">Apri ${what} e tocca ☆ Progetto per ritrovarlo qui.</p>`)+
    `<p class="dlab">Fatti di recente</p>` + (recent.length ? `<div class="list" style="gap:0">${recent.map(row).join('')}</div>` : `<p class="hint">Apri ${what} e tocca ✓ Fatto quando lo chiudi.</p>`)+
    `<div class="row"><button class="btn" data-act="close">Chiudi</button></div>`;
}
function acctHtml(){
  const m = ui.acctMode || 'in';
  if(m === 'sent') return `<h2>Controlla la tua email</h2><p>Ti abbiamo mandato un'email a <b>${esc(ui.acctEmail || '')}</b>. Tocca il link per confermare l'account, poi torna qui ed entra con email e password.</p>`+
    `<div class="row"><button class="btn primary" data-act="acctmode" data-v="in">Entra</button><button class="btn" data-act="close">Chiudi</button></div>`;
  if(m === 'reset') return `<h2>Password dimenticata</h2><p>Scrivi la tua email: ti mandiamo un link per sceglierne una nuova.</p>`+
    `<label class="field">Email<input id="aemail" type="email" autocomplete="email" inputmode="email" value="${esc(ui.acctEmail || '')}"></label>`+
    `<div class="row"><button class="btn primary" data-act="acctreset">Mandami il link</button><button class="btn" data-act="acctmode" data-v="in">Indietro</button></div>`;
  const nw = m === 'new';
  return `<h2>${nw ? 'Crea il tuo account' : 'Entra'}</h2>`+
    (ui.acctWhy ? `<p>Per segnare le tue salite serve un account: è gratis e ti chiediamo solo email e password.</p>` : '')+
    `<label class="field">Email<input id="aemail" type="email" autocomplete="email" inputmode="email" value="${esc(ui.acctEmail || '')}"></label>`+
    `<label class="field">Password${nw ? ' (almeno 8 caratteri)' : ''}<input id="apass" type="password" autocomplete="${nw ? 'new-password' : 'current-password'}"></label>`+
    `<div class="row"><button class="btn primary" data-act="acctgo">${nw ? 'Crea account' : 'Entra'}</button>`+
    `<button class="btn" data-act="acctmode" data-v="${nw ? 'in' : 'new'}">${nw ? 'Ho già un account' : 'Crea un account'}</button></div>`+
    (nw ? '' : `<p class="note"><button class="linklike" data-act="acctmode" data-v="reset">Password dimenticata?</button></p>`)+
    `<p class="note">Salviamo solo la tua email e le tue salite. I pareri sul grado arrivano ai tracciatori in forma anonima. Puoi cancellare l'account quando vuoi dal menu.</p>`;
}
async function acctGo(){
  const em = document.getElementById('aemail'), pw = document.getElementById('apass');
  const email = ((em && em.value) || '').trim(), password = (pw && pw.value) || '', nw = ui.acctMode === 'new';
  ui.acctEmail = email;
  if(!/^\S+@\S+\.\S+$/.test(email)){ toast('Scrivi un\'email valida.'); return; }
  if(password.length < (nw ? 8 : 1)){ toast(nw ? 'La password deve avere almeno 8 caratteri.' : 'Scrivi la password.'); return; }
  setIntent('cliente');
  if(nw){
    const { data, error } = await SB.auth.signUp({ email, password, options: { emailRedirectTo: appBase() } });
    if(error){ toast(/registered|exists/i.test(error.message || '') ? 'Hai già un account con questa email: entra.' : 'Registrazione non riuscita: ' + error.message); if(/registered|exists/i.test(error.message || '')){ ui.acctMode = 'in'; renderSheet(); } return; }
    if(data && data.session){ rememberPlace(); location.reload(); return; }
    ui.acctMode = 'sent'; renderSheet(); return;
  }
  const { error } = await SB.auth.signInWithPassword({ email, password });
  if(error){ toast(/confirm/i.test(error.message || '') ? 'Prima conferma l\'account dal link che ti abbiamo mandato per email.' : /invalid/i.test(error.message || '') ? 'Email o password non corrette.' : 'Accesso non riuscito: ' + error.message); return; }
  rememberPlace(); location.reload();
}
async function acctReset(){
  const em = document.getElementById('aemail'), email = ((em && em.value) || '').trim(); ui.acctEmail = email;
  if(!/^\S+@\S+\.\S+$/.test(email)){ toast('Scrivi un\'email valida.'); return; }
  setIntent('cliente');
  const { error } = await SB.auth.resetPasswordForEmail(email, { redirectTo: appBase() });
  if(error){ toast('Invio non riuscito: ' + error.message); return; }
  toast('Fatto: controlla l\'email e tocca il link per scegliere la nuova password.', 7000); ui.acctMode = 'in'; renderSheet();
}
async function delAccount(){
  if(ui.confirm !== 'delacct'){ ui.confirm = 'delacct'; renderSheet(); return; }
  ui.confirm = null;
  const { error } = await SB.rpc('delete_my_account');
  if(error){ toast('Non riesco a cancellare l\'account: ' + error.message); return; }
  await SB.auth.signOut().catch(() => {}); setIntent('staff'); toast('Account cancellato, insieme alle tue salite.'); setTimeout(() => location.reload(), 1200);
}
const WELCOME = [
  ['Benvenuto in Monkey Roads', 'Tutti i boulder e i circuiti di Monkey Island Roma, sempre aggiornati. Dalla pagina iniziale scegli <b>Boulder</b> o <b>Circuiti</b>.'],
  ['Trova il tuo percorso', 'Apri un settore e tocca un percorso: vedi partenza, prese e top. Con uno swipe navighi tra le nostre pareti!'],
  ['Le tue salite', 'Con un account gratuito segni i percorsi <b>fatti</b> e i <b>progetti</b>, vedi i tuoi progressi e ci aiuti a rendere le nostre proposte più belle e mirate.']
];
const welcomeSlides = () => acctOn() ? WELCOME : WELCOME.slice(0, 2);
function welcomeHtml(){
  const WS = welcomeSlides(), i = Math.max(0, Math.min(WS.length - 1, ui.wIdx || 0)), last = i === WS.length - 1;
  return `<div class="wel"><p class="welstep">${WS.map((x, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</p><h2>${WS[i][0]}</h2><p>${WS[i][1]}</p></div>`+
    `<div class="row"><button class="btn primary" data-act="wnext">${last ? 'Inizia' : 'Avanti'}</button>${last ? (ACC() || !acctOn() ? '' : `<button class="btn" data-act="acctmode" data-v="new">Crea account</button>`) : `<button class="btn" data-act="wskip">Salta</button>`}</div>`;
}
/* ---------- QR code da attaccare ai muri ---------- */
const appBase = () => location.origin + location.pathname.replace(/index\.html$/, '');
const wallLink = w => appBase() + (w ? '#m=' + encodeURIComponent(w.id) : '');
let qrLib = null;
function loadQR(){ return qrLib || (qrLib = new Promise((res, rej) => { if(window.qrcode) return res(); const sc = document.createElement('script'); sc.src = 'vendor/qrcode.js'; sc.onload = () => res(); sc.onerror = () => { qrLib = null; rej(new Error('qr')); }; document.head.appendChild(sc); })); }
function qrSvg(text, px){
  if(!window.qrcode) return '';
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2, sz = n + m * 2; let d = '';
  for(let r = 0; r < n; r++) for(let c = 0; c < n; c++) if(q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg class="qrsvg" viewBox="0 0 ${sz} ${sz}" width="${px}" height="${px}" shape-rendering="crispEdges" aria-hidden="true"><rect width="${sz}" height="${sz}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
const qrItems = () => [{ id: '', name: 'Pagina iniziale', sub: 'tutta l\'app: boulder e circuiti' }]
  .concat(S.walls.filter(w => isSec(w) && !w.archived).map(w => ({ id: w.id, name: w.name, sub: 'boulder di questo settore', w })))
  .concat(S.walls.filter(w => !isSec(w) && !w.archived).map(w => ({ id: w.id, name: w.name, sub: 'circuiti di questo muro', w })));
function qrHtml(){
  if(!window.qrcode){ loadQR().then(() => { if(ui.sheet === 'qr') renderSheet(); }, () => toast('Non riesco a caricare il generatore di QR: controlla la connessione.')); return `<h2>QR code</h2><p>Carico…</p>`; }
  const items = qrItems();
  return `<h2>QR code</h2><p class="note" style="margin:0 0 12px">Stampali e attaccali vicino a ogni settore o muro: inquadrandoli con la fotocamera del telefono si apre l'app direttamente lì. Il QR resta valido anche quando cambi i boulder: si rifà solo se crei un settore nuovo.</p>`+
    `<div class="row" style="margin:0 0 10px"><button class="btn primary" data-act="qrprint" data-id="*">Stampa tutti (${items.length})</button></div>`+
    `<div class="list">${items.map(it => `<div class="wrow qrrow">${qrSvg(wallLink(it.w), 64)}<span style="flex:1;min-width:0"><b>${esc(it.name)}</b><br><small>${esc(it.sub)}</small></span>`+
      `<span class="fbbtns"><button class="btn" data-act="qrprint" data-id="${esc(it.id)}">Stampa</button><button class="btn" data-act="qrcopy" data-id="${esc(it.id)}">Copia link</button></span></div>`).join('')}</div>`+
    `<div class="row"><button class="btn" data-act="close">Chiudi</button></div>`;
}
async function qrPrint(id){
  try{ await loadQR(); }catch(e){ toast('Non riesco a caricare il generatore di QR.'); return; }
  const items = qrItems().filter(it => id === '*' || it.id === id); if(!items.length) return;
  ui.sheet = null; renderSheet();
  const card = it => `<div class="pqr"><header><span>Monkey Island Roma</span><span>Monkey Roads</span></header>`+
    `<h1>${esc(it.name)}</h1><p class="pqsub">${it.w ? (isSec(it.w) ? 'Inquadra per vedere i boulder di questo settore' : 'Inquadra per vedere i circuiti di questo muro') : 'Inquadra per aprire boulder e circuiti della palestra'}</p>`+
    qrSvg(wallLink(it.w), 300)+`<p class="pqurl">${esc(wallLink(it.w))}</p></div>`;
  let html = '';
  for(let i = 0; i < items.length; i += 2) html += `<section class="ppage pqpage">${card(items[i])}${items[i + 1] ? card(items[i + 1]) : ''}</section>`;
  $('#print').innerHTML = html;
  setTimeout(() => { try{ window.print(); }catch(e){ toast('Stampa non disponibile su questo dispositivo.'); } }, 80);
}
/* aperta da un QR: si va dritti a quel settore o muro */
function openFromLink(){
  const m = /[#&]m=([^&]+)/.exec(location.hash); if(!m) return false;
  const id = decodeURIComponent(m[1]); try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  const w = S.walls.find(x => x.id === id && !x.archived);
  if(!w){ toast('Questo settore non c\'è più: ecco la pagina iniziale.'); return false; }
  ui.sheet = null; renderSheet();
  ui.section = secOf(w); ui.home = false; ui.full = false; S.active = w.id; ui.lastSec[ui.section] = w.id; saveBUI();
  if(EDIT) S.mode = 'edit';
  ui.bLevel = 'sector'; ui.secOver = true; ui.zoom = 1; ui.sel = null; ui.move = false; ui.draft = []; ui.bdraw = false; ui.bline = false;
  ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit()); save();
  try{ history.pushState({ grid: 1 }, ''); history.pushState({ sec: 1 }, ''); }catch(e){} render(); $('#box').scrollTop = 0;
  return true;
}
window.addEventListener('hashchange', () => { if(ui.ready && /[#&]m=/.test(location.hash)) openFromLink(); });
/* ---------- pannello settori (gestore): età, gradi, chi traccia ---------- */

function dashHtml(){
  const secs = S.walls.filter(w => isSec(w) && !w.archived);
  const t = todayISO(), lim = new Date(Date.now() + 7*864e5).toISOString().slice(0,10);
  const all = [], rows = secs.map(w => {
    const on = w.circuits.filter(c => !isOff(c)); on.forEach(c => all.push(c));
    const ren = secRenew(w), age = daysOld(ren);
    const later = on.filter(c => c.diff && c.dateSet && c.dateSet > ren).length;
    const due = on.filter(c => c.dateRemoved && c.dateRemoved >= t && c.dateRemoved <= lim).length;
    return { w, on, ren, age, later, due, miss: DIFFS.filter(d => !on.some(c => c.diff === d[0])), noGrade: on.filter(c => !c.diff).length };
  }).sort((a, b) => (b.age ?? -1) - (a.age ?? -1));

  const bar = list => { const n = list.length || 1; return `<div class="dbar">${DIFFS.map(d => { const k = list.filter(c => c.diff === d[0]).length; return k ? `<i style="flex:${k};background:${d[2]}" title="${d[1]}: ${k}"></i>` : ''; }).join('')}</div>`+
    `<div class="sdots" style="padding:0;margin-top:6px">${DIFFS.map(d => { const k = list.filter(c => c.diff === d[0]).length; return `<span class="sdot${k ? '' : ' zero'}"><i style="background:${d[2]}"></i>${k}</span>`; }).join('')}</div>`; };
  const tag = a => a === null ? '' : a >= AGE_EXPIRED ? `<small class="dtag old">scaduto</small>` : a < AGE_NEW ? `<small class="dtag ok">nuovo</small>` : a < AGE_RECENT ? `<small class="dtag ok">recente</small>` : '';
  const oldest = rows.length && rows[0].age !== null ? rows[0].age : null;
  /* chi traccia: boulder montati negli ultimi 30 giorni (anche quelli già smontati) */
  const since = new Date(Date.now() - 30*864e5).toISOString().slice(0,10), by = {};
  secs.forEach(w => w.circuits.forEach(c => { if(c.dateSet && c.dateSet >= since){ const k = (c.setter || '').trim() || 'senza nome'; by[k] = (by[k] || 0) + 1; } }));
  const setters = Object.entries(by).sort((a, b) => b[1] - a[1]);
  return `<h2>Pannello settori</h2>`+
    `<div class="dsum"><div><b>${all.length}</b><small>boulder in parete</small></div><div><b>${secs.length}</b><small>settori</small></div><div><b>${oldest === null ? '–' : oldest + ' gg'}</b><small>il settore più vecchio</small></div></div>`+
    `<p class="dlab">Gradi in palestra</p>${bar(all)}`+
    `<p class="dlab">Settori, dal più vecchio</p><div class="list">${rows.map(r => `<button class="wrow drow" data-act="dashsec" data-id="${r.w.id}"><span style="flex:1;min-width:0;text-align:left">`+
      `<b>${esc(r.w.name)}</b> ${tag(r.age)}<br>`+
      `<small>${r.ren ? `rinnovato il ${fmtDate(r.ren)} (${r.age} gg fa) · ${r.on.length} boulder${r.later ? ` · ${r.later} aggiunti dopo` : ''}` : r.on.length ? `${r.on.length} boulder senza data` : 'nessun boulder in parete'}${r.due ? ` · <b>${r.due} da smontare entro 7 giorni</b>` : ''}</small>`+
      (r.on.length > r.noGrade ? bar(r.on) : '')+
      (r.on.length > r.noGrade && r.miss.length ? `<small class="dmiss">Mancano: ${r.miss.map(d => d[1].toLowerCase()).join(', ')}</small>` : '')+
      (r.noGrade ? `<small class="dmiss">${r.noGrade} senza grado</small>` : '')+
      `</span></button>`).join('')}</div>`+
    `<p class="dlab">Chi ha tracciato (ultimi 30 giorni)</p>`+
    (setters.length ? `<div class="list">${setters.map(([k, n]) => `<div class="wrow"><span style="flex:1">${esc(k)}</span><b>${n}</b></div>`).join('')}</div>` : `<p class="hint">Nessun boulder montato negli ultimi 30 giorni.</p>`)+
    `<p class="note">Il rinnovo di un settore è la data del suo boulder in parete più vecchio. Nuovo nella 1ª settimana, recente nella 2ª, scaduto dalla 9ª (questa etichetta la vede solo lo staff). Tocca un settore per aprirlo.</p>`+
    `<div class="row"><button class="btn" data-act="close">Chiudi</button></div>`;
}
function openSheet(name){ ui.sheet = name; ui.confirm = null; renderSheet(); }
/* ricerca su tutti i circuiti della palestra */
function sqAll(){ return secWalls().filter(w => !isSec(w)).flatMap(w => w.circuits.map(c => ({ w, c }))); }
function sqSheet(mode){
  const all = sqAll(), q = ui.sq;
  const angles = [...new Set(all.map(x => x.c.angle).filter(x => x != null))].sort((a, b) => a - b);
  const grades = GRADES.filter(g => g && all.some(x => x.c.grade === g));
  const styles = STYLES.filter(st => st && all.some(x => x.c.style === st));
  const chip = (act, v, l, on) => `<button class="fchip ${on ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`;
  const gsel = (id, val, l) => `<select id="${id}" class="fsel" aria-label="${l}"><option value="">${l}</option>${grades.map(g => `<option value="${g}" ${val === g ? 'selected' : ''}>${g}</option>`).join('')}</select>`;
  const res = all.filter(({ c }) => cMatch(c))
    .sort((a, b) => gradeIdx(a.c.grade) - gradeIdx(b.c.grade) || a.c.name.localeCompare(b.c.name));
  const any = sqCount() > 0;
  const filters = 
    (angles.length > 1 ? `<p class="sqlab">Inclinazione</p><div class="fchips">${chip('sqang', '', 'Tutte', q.ang === '')}${angles.map(a => chip('sqang', a, a + '°', q.ang === String(a))).join('')}</div>` : '')+
    (grades.length > 1 ? `<p class="sqlab">Grado</p><div class="fchips sqgr">${gsel('sqmin', q.min, 'da')}<span>–</span>${gsel('sqmax', q.max, 'a')}</div>` : '')+
    (styles.length > 1 ? `<p class="sqlab">Stile</p><div class="fchips">${chip('sqsty', '', 'Tutti', !q.sty)}${styles.map(st => chip('sqsty', st, esc(st), q.sty === st)).join('')}</div>` : '')+
    (all.some(x => x.c.feet) ? `<p class="sqlab">Piedi</p><div class="fchips">${chip('sqfeet', '', 'Tutti', !q.feet)}${chip('sqfeet', 'liberi', 'Liberi', q.feet === 'liberi')}${chip('sqfeet', 'obbligati', 'Obbligati', q.feet === 'obbligati')}</div>` : '');
  if(mode === 'wall'){
    const w = curWall(), n = w ? visibleCircuits(w).length : 0;
    return `<h2>Filtri</h2><p class="hint" style="margin:0">Valgono su tutti i muri e nella ricerca.</p>` + filters +
      (any ? `<div class="sqhead"><span></span><button class="linklike" data-act="sqreset">Azzera filtri</button></div>` : '') +
      `<button class="btn primary" data-act="close" style="width:100%;margin-top:14px">Mostra ${n} ${n === 1 ? 'circuito' : 'circuiti'}</button>`;
  }
  return `<h2>Cerca un circuito</h2>` + filters +
    `<div class="sqhead"><b>${res.length} ${res.length === 1 ? 'circuito' : 'circuiti'}</b>${any ? `<button class="linklike" data-act="sqreset">Azzera filtri</button>` : ''}</div>`+
    (res.length ? `<div class="list" style="gap:0;margin:0">` + res.map(({ w, c }) => `<button class="lrow" data-act="sqgo" data-w="${w.id}" data-id="${c.id}"><i class="dot" style="background:${colOf(c)}"></i><span class="ctext" style="flex:1"><b>${esc(c.name)}</b><small>${[esc(w.name), c.angle != null ? c.angle + '°' : '', esc(c.style || ''), c.feet ? 'piedi ' + c.feet : ''].filter(Boolean).join(' · ')}</small></span>${gradeBadge(c.grade)}</button>`).join('') + `</div>`
      : `<p class="hint">Nessun circuito con questi filtri.</p>`)+
    `<button class="btn" data-act="close" style="width:100%;margin-top:12px">Chiudi</button>`;
}
function renderSheet(){
  const el = $('#sheet'), card = $('#card');
  if(!ui.sheet){ el.hidden = true; card.innerHTML = ''; return; }
  const w = curWall(), c = curCircuit();
  let h = '';
  if(ui.sheet === 'csearch') h = sqSheet();
  else if(ui.sheet === 'cfilt') h = sqSheet('wall');
  else if(ui.sheet === 'circ' && c && EDIT && isSec(w)){
    const gradeOpt = v => `<option value="${v}" ${(c.grade || '') === v ? 'selected' : ''}>${v || '—'}</option>`;
    const styleOpt = v => `<option value="${v}" ${(c.style || '') === v ? 'selected' : ''}>${v || '—'}</option>`;
    const tags = c.tags || [];
    h = `<h2>${esc(bTitle(c))}</h2>`+
      `<p class="field" style="margin-bottom:4px">Difficoltà</p>`+
      `<div class="sw" role="group" aria-label="Difficoltà">` +
      DIFFS.map(d => `<button data-act="bdiff" data-v="${d[0]}" aria-label="${d[1]}" aria-pressed="${c.diff === d[0]}" class="${c.diff === d[0] ? 'sel' : ''}" style="background:${d[2]}"></button>`).join('') +
      `</div>`+
      (diffOf(c) ? '' : `<p class="note" style="margin:-8px 0 12px">Scegli la difficoltà: il nome (es. "Giallo 2") si assegna da solo.</p>`)+
      `<p class="field" style="margin-bottom:4px">Colore delle prese</p>`+
      `<div class="sw" role="group" aria-label="Colore delle prese">` +
      PALETTE.map(p => `<button data-act="hcolor" data-c="${p[1]}" aria-label="${p[0]}" class="${p[1] === c.holdColor ? 'sel' : ''}" style="background:${p[1]}"></button>`).join('') +
      `</div>`+
      `<div class="f2"><label class="field">Soprannome (facoltativo)<span style="display:flex;gap:6px;margin-top:4px"><input id="cname" value="${esc(c.name || '')}" maxlength="40" style="margin-top:0;flex:1;min-width:0"><button type="button" class="btn" data-act="cgen" aria-label="Proponi un soprannome" title="Proponi un soprannome" style="flex:none;font-size:18px;padding:6px 10px">🎲</button></span></label>`+
      `<label class="field">Stile<select id="cstyle">${STYLES.map(styleOpt).join('')}</select></label></div>`+
      `<label class="field">Tracciatore<input id="bsetter" value="${esc(c.setter || '')}" maxlength="40" autocomplete="off" list="bsetlist"></label>`+
      `<datalist id="bsetlist">${(ui.staffNames || []).map(n => `<option value="${esc(n)}">`).join('')}</datalist>`+
      `<div class="f2"><label class="field">Montato il<input id="bdset" type="date" value="${esc(c.dateSet || '')}"></label>`+
      `<label class="field">Smontato il<input id="bdrem" type="date" value="${esc(c.dateRemoved || '')}"></label></div>`+
      `<p class="field" style="margin-bottom:0">Move, stile e particolarità</p>`+
      `<div class="tags">${BTAGS.map(t => `<button class="tag ${tags.includes(t) ? 'on' : ''}" data-act="btag" data-v="${esc(t)}" aria-pressed="${tags.includes(t)}">${esc(t)}</button>`).join('')}</div>`+
      `<label class="field">Note<textarea id="bnotes" maxlength="600" placeholder="Es. partenza con mani sulla tacca bassa, spigolo escluso…">${esc(c.notes || '')}</textarea></label>`+
      `<div class="row"><button class="btn danger" data-act="delc">${ui.confirm === 'delc' ? 'Tocca ancora per eliminare' : 'Elimina boulder'}</button>`+
      `<button class="btn primary" data-act="close">Fatto</button></div>`+
      `<p class="note">Con una data di smontaggio passata il boulder finisce tra gli "Smontati": resta consultabile ma non compare più tra quelli in parete.</p>`;
  } else if(ui.sheet === 'clist' && w && isSec(w)){
    h = `<h2>Boulder · ${esc(w.name)}</h2>` + bFilters(w) + bRows(w, 'crow') +
      `<div class="row" style="margin-top:14px">${EDIT ? `<button class="btn primary" data-act="addc">+ Nuovo boulder</button>` : ''}<button class="btn" data-act="close">Chiudi</button></div>`;
  } else if(ui.sheet === 'circ' && c && EDIT){
    const gradeOpt = v => `<option value="${v}" ${(c.grade || '') === v ? 'selected' : ''}>${v || '—'}</option>`;
    const styleOpt = v => `<option value="${v}" ${(c.style || '') === v ? 'selected' : ''}>${v || '—'}</option>`;
    h = `<h2>Circuito</h2>`+
      `<label class="field">Nome<span style="display:flex;gap:8px;margin-top:4px"><input id="cname" value="${esc(c.name)}" maxlength="40" style="margin-top:0;flex:1"><button type="button" class="btn" data-act="cgen" aria-label="Proponi un nome" title="Proponi un nome" style="flex:none;font-size:20px;padding:6px 12px">🎲</button></span></label>`+
      `<label class="field">Montato il<input id="cdset" type="date" value="${esc(c.dateSet || '')}"></label>`+
      `<label class="field">Grado<select id="cgrade">${GRADES.map(gradeOpt).join('')}</select></label>`+
      `<label class="field">Stile<select id="cstyle">${STYLES.map(styleOpt).join('')}</select></label>`+
      `<p class="field" style="margin-bottom:4px">Piedi</p><div class="seg" role="group" aria-label="Piedi" style="margin:0 0 12px">`+
        [['','—'],['liberi','Liberi'],['obbligati','Obbligati']].map(o => `<button data-act="cfeet" data-v="${o[0]}" aria-pressed="${(c.feet || '') === o[0]}">${o[1]}</button>`).join('')+`</div>`+
      `<label class="field">Inclinazione (gradi dalla verticale)<select id="cangle"><option value="" ${c.angle == null ? 'selected' : ''}>—</option>${ANGLES.map(a => `<option value="${a}" ${c.angle === a ? 'selected' : ''}>${a}°</option>`).join('')}</select></label>`+
      `<div class="row"><button class="btn danger" data-act="delc">${ui.confirm === 'delc' ? 'Tocca ancora per eliminare' : 'Elimina circuito'}</button>`+
      `<button class="btn primary" data-act="close">Fatto</button></div>`;
  } else if(ui.sheet === 'clist' && w){
    h = `<h2>Circuiti · ${esc(w.name)}</h2>` + circFilters(w) + circRows(w, 'crow') +
      `<div class="row" style="margin-top:14px">${EDIT && w.locked ? `<button class="btn primary" data-act="addc">+ Nuovo circuito</button>` : ''}<button class="btn" data-act="close">Chiudi</button></div>`;
  } else if(ui.sheet === 'wman' && w){
    /* gestione del muro/settore: tutto qui, solo per il gestore */
    const bo = isSec(w), what = bo ? 'settore' : 'muro';
    const row = (act, label, sub, cls) => `<button class="wrow ${cls || ''}" data-act="${act}"><span>${label}</span><small>${sub || ''}</small></button>`;
    h = `<h2>${esc(w.name)}</h2>`+
      (ui.renaming ? `<label class="field">Nome del ${what}<input id="wname" value="${esc(w.name)}" maxlength="40"></label><div class="row"><button class="btn primary" data-act="wrensave">Salva</button><button class="btn" data-act="close">Annulla</button></div>` :
      `<div class="list">`+
        row('wren', 'Rinomina', '')+
        (bo ? '' : row('wallmode', 'Gestisci prese del muro', w.locked ? 'contorni delle prese, rilevamento automatico' : 'da preparare prima di tracciare'))+
        row('warch', ui.confirm === 'warch' ? 'Tocca ancora per archiviare' : 'Archivia ' + what, 'i clienti non lo vedono più; lo ripristini da Archiviati', ui.confirm === 'warch' ? 'warn' : '')+
      `</div><div class="row"><button class="btn primary" data-act="close">Chiudi</button></div>`);
  } else if(ui.sheet === 'arch'){
    const bo = BO(), list = archWalls();
    h = `<h2>${bo ? 'Settori archiviati' : 'Muri archiviati'}</h2>`+
      (list.length ? `<div class="list">` + list.map(x => `<div class="wrow"><span>${esc(x.name)}<br><small>${bo ? x.circuits.length + ' boulder' : x.circuits.length + ' circuiti'}</small></span>`+
        `<span class="row" style="margin:0;flex-wrap:nowrap"><button class="btn" data-act="wrestore" data-id="${x.id}">Ripristina</button><button class="btn danger" data-act="wdel" data-id="${x.id}">${ui.confirm === 'wdel:' + x.id ? 'Tocca ancora' : 'Elimina'}</button></span></div>`).join('') + `</div>` :
        `<p class="note">Nessun ${bo ? 'settore' : 'muro'} archiviato.</p>`)+
      `<p class="note">Eliminare cancella per sempre ${bo ? 'il settore e i suoi boulder' : 'il muro, le sue prese e i suoi circuiti'} (dopo aver pubblicato).</p>`+
      `<div class="row"><button class="btn primary" data-act="close">Chiudi</button></div>`;
  } else if(ui.sheet === 'menu' && newC()){
    const row = (act, label, sub, dis) => `<button class="wrow" data-act="${act}" ${dis ? 'disabled' : ''}><span>${label}</span><small>${sub || ''}</small></button>`;
    const nd = ui.ticks ? [...ui.ticks.values()].filter(t => t.status === 'fatto').length : 0;
    const inside = !ui.home && !bGrid(), cw = inside ? w : null, cc = cw ? c : null, cn = cw ? sortedVisible(cw).length : 0;
    h = `<h2>Menu</h2><div class="list">`+
      (acctOn() ? row('mine', 'Le mie salite', ACC() ? (nd ? nd + (nd === 1 ? ' percorso fatto' : ' percorsi fatti') : 'segna i percorsi fatti e i progetti') : 'segna i percorsi fatti e i progetti') : '')+
      (SB ? row('fbnew', 'Segnala un problema', 'o un suggerimento: arriva alla palestra') : '')+
      (canInstall() ? row('install', "Installa l'app", 'sulla schermata Home') : '')+
      row('welcome', 'Come funziona', 'rivedi la presentazione')+
      (REAL_EDIT && ui.viewAs === 'cliente' && ui.prevNew ? row('prevtoday', 'Anteprima senza account', 'l\'app come la vede oggi un cliente') : '')+
      /* stampa e condividi solo quando c'è qualcosa da stampare: niente voci spente */
      (cn ? `</div><h3 class="mhead">Stampa e condividi</h3><div class="list">`+
        (cc ? row('printone', 'Stampa ' + (isSec(cw) ? 'questo boulder' : 'questo circuito'), esc(blockTitle(cw, cc))) : '')+
        row('printall', isSec(cw) ? 'Stampa i boulder del settore' : 'Stampa i circuiti del muro', cn + (cn === 1 ? ' pagina' : ' pagine'))+
        (cc ? row('img', 'Condividi immagine', 'da salvare o mandare') : '') : '')+
      (acctOn() || CL ? `</div><h3 class="mhead">Account</h3><div class="list">`+
      (CL ? row('logout', 'Esci', esc(CL.email)) + row('delacct', ui.confirm === 'delacct' ? 'Tocca ancora: cancello account e salite' : 'Cancella il mio account', 'e tutte le tue salite', false) :
        REAL_EDIT ? `<p class="note" style="margin:0">In anteprima le salite si salvano sul tuo account dello staff.</p>` : row('acct', 'Entra o crea un account', 'gratis: serve per le tue salite')) : '')+
      `</div>`+
      (REAL_EDIT ? `<div class="row"><button class="btn" data-act="viewas" data-v="${ME.role}">Esci dall'anteprima</button><button class="btn primary" data-act="close">Chiudi</button></div>` :
        `<div class="row"><button class="btn primary" data-act="close">Chiudi</button></div><p class="note" style="text-align:center"><button class="linklike" data-act="login">Accesso staff</button></p>`)+
      `<p class="note" style="text-align:center;margin:6px 0 0;opacity:.6">versione ${esc(APP_V)}</p>`;
  } else if(ui.sheet === 'menu'){
    /* stampa solo dentro un settore o un muro: dalla schermata iniziale non si stampa un percorso che non si vede */
    const inside = !ui.home && !bGrid() && !!w, bo = w ? isSec(w) : BO(), n = inside ? sortedVisible(w).length : 0, cc = inside ? c : null, one = bo ? 'questo boulder' : 'questo circuito';
    const row = (act, label, sub, dis) => `<button class="wrow" data-act="${act}" ${dis ? 'disabled' : ''}><span>${label}</span><small>${sub || ''}</small></button>`;
    const gest = REAL_EDIT && ME.role === 'gestore' && ui.viewAs !== 'tracciatore', mgr = EDIT && isMgr();
    /* in alto quello che serve al gestore, raccolto sotto "Gestione"; poi stampa, app e account */
    const G = (mgr && S.walls.some(isSec) ? row('dash', 'Pannello settori', 'età dei boulder, gradi presenti e mancanti, chi traccia') : '')+
      (SB && gest ? row('fblist', 'Segnalazioni ricevute', 'problemi segnalati ed errori dell\'app') : '')+
      (mgr && S.walls.some(w => !w.archived) ? row('qr', 'QR code', 'da attaccare ai muri: chi li inquadra apre quel settore') : '')+
      (SB && gest ? row('staff', 'Staff', 'chi può tracciare e pubblicare') : '')+
      (SB && gest ? row('hist', 'Versioni precedenti', 'le ultime pubblicazioni, da ripristinare') : '')+
      (REAL_EDIT && ME.role === 'gestore' ? (ui.viewAs === 'tracciatore' ? row('viewas" data-v="gestore', 'Torna gestore', 'stai vedendo l\'app come un tracciatore') : row('viewas" data-v="tracciatore', 'Vedi come tracciatore', 'per controllare cosa può fare lo staff')) : '');
    h = `<h2>Altro</h2>`+
      (G ? `<h3 class="mhead">Gestione</h3><div class="list">${G}</div>` : '')+
      (n ? `<h3 class="mhead">Stampa e condividi</h3><div class="list">`+
      (cc ? row('printone', 'Stampa ' + one, esc(blockTitle(w, cc))) : '')+
      row('printall', bo ? 'Stampa i boulder del settore' : 'Stampa i circuiti del muro', n + (n === 1 ? ' pagina' : ' pagine') + ' · filtri compresi')+
      (cc ? row('img', 'Condividi immagine', 'da salvare o mandare') : '')+
      `</div><p class="note" style="margin:0 0 12px">Dalla finestra di stampa puoi anche scegliere "Salva come PDF".</p>` : '')+
      `<h3 class="mhead">App</h3><div class="list">`+
      (canInstall() ? row('install', "Installa l'app", 'sulla schermata Home') : '')+
      (SB ? row('fbnew', 'Segnala un problema', 'o un suggerimento: arriva al gestore') : '')+
      `</div><h3 class="mhead">Account</h3><div class="list">`+
      (SB && !REAL_EDIT ? row('login', 'Accesso staff', ui.authEmail ? 'sei entrato come ' + esc(ui.authEmail) + ', che non è nello staff' : 'per gestore e tracciatori') : '')+
      (SB && !REAL_EDIT && ui.authEmail ? row('logout', 'Esci', esc(ui.authEmail)) : '')+
      (SB && (REAL_EDIT || ui.authEmail) ? row('setpass', 'Imposta password', 'per entrare senza aspettare l\'email') : '')+
      (SB && REAL_EDIT ? row('logout', 'Esci', ME ? esc(ME.email) + ' · ' + (ME.role === 'gestore' ? 'gestore' : 'tracciatore') : '') : '')+
      `</div>`+
      `<div class="row"><button class="btn primary" data-act="close">Chiudi</button></div>`+
      `<p class="note" style="text-align:center;margin:6px 0 0;opacity:.6">versione ${esc(APP_V)}</p>`;
  } else if(ui.sheet === 'install'){
    h = `<h2>Installa l'app</h2>`+
      (isIOS() ? `<p>Su iPhone:</p><ol style="margin:0 0 14px;padding-left:20px;line-height:1.6"><li>tocca <b>Condividi</b> (il quadrato con la freccia in su), in basso in Safari</li><li>scorri e scegli <b>Aggiungi alla schermata Home</b></li><li>tocca <b>Aggiungi</b></li></ol><p class="note" style="margin:0 0 12px">Funziona da Safari: se hai aperto il link da un'altra app, aprilo prima in Safari.</p>`
               : `<p>Apri il menu del browser (⋮ in alto a destra) e scegli <b>Installa app</b>. Se c'è solo <b>Aggiungi a schermata Home</b>, scegli quello e poi <b>Installa</b> (non "Crea scorciatoia"): così l'app si apre senza il logo di Chrome.</p>`)+
      `<div class="row"><button class="btn primary" data-act="close">Ok</button></div>`;
  } else if(ui.sheet === 'login'){
    h = `<h2>Accesso staff</h2>`+
      (ui.loginSent ? `<p>Ti ho mandato un'email a <b>${esc(ui.loginEmail || '')}</b>. Se contiene un <b>codice</b>, scrivilo qui sotto: è il modo più sicuro, perché il link a volte si apre in un altro browser e l'accesso resta lì.</p>`+
        `<label class="field">Codice dell'email<input id="lcode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" style="letter-spacing:4px;font-size:20px"></label>` :
      `<label class="field">La tua email<input id="lemail" type="email" autocomplete="email" inputmode="email" value="${esc(ui.loginEmail || '')}"></label>`+
      `<label class="field">Password<input id="lpass" type="password" autocomplete="current-password"></label>`)+
      `<div class="row">${ui.loginSent ? `<button class="btn primary" data-act="codelogin">Entra con il codice</button><button class="btn" data-act="loginback">Indietro</button>` : `<button class="btn primary" data-act="passlogin">Entra</button><button class="btn" data-act="sendlink">Non ho la password: mandami un link</button>`}<button class="btn" data-act="close">Chiudi</button></div>`;
  } else if(ui.sheet === 'staff'){
    const list = ui.staff;
    h = `<h2>Staff</h2><p class="note" style="margin:0 0 12px">Chi è in questo elenco può creare e modificare muri e circuiti e pubblicarli. Solo il gestore gestisce l'elenco.</p>`+
      (list === null ? `<p>Carico…</p>` : list === 'err' ? `<p>Non riesco a leggere l'elenco. Hai eseguito l'ultimo aggiornamento del database?</p>` :
       `<div class="list">${list.map(p => `<div class="wrow"><span style="flex:1;min-width:0"><input class="sname" data-email="${esc(p.email)}" value="${esc(p.name || '')}" placeholder="Nome e cognome" maxlength="40"><small>${esc(p.email)} · ${p.role === 'gestore' ? 'gestore' : 'tracciatore'}</small></span>${ME && p.email.toLowerCase() === ME.email.toLowerCase() ? '<small>tu</small>' : `<button class="btn danger" data-act="staffdel" data-email="${esc(p.email)}">${ui.confirm === 'staffdel:' + p.email ? 'Conferma' : 'Togli'}</button>`}</div>`).join('')}</div>`)+
      `<p class="note" style="margin:8px 0 0">Il nome compare come tracciatore sui boulder nuovi di quella persona.</p>`+
      `<label class="field">Aggiungi tracciatore: email<input id="semail" type="email" inputmode="email" autocomplete="off"></label>`+
      `<label class="field">Nome e cognome<input id="sname" maxlength="40" autocomplete="off"></label>`+
      `<div class="row"><button class="btn primary" data-act="staffadd">Aggiungi</button><button class="btn" data-act="close">Chiudi</button></div>`+
      `<p class="note">Poi manda il link dell'app alla persona: menu ⋮ → <b>Accesso staff</b> → <b>Non ho la password: mandami un link</b>; una volta dentro, menu ⋮ → <b>Imposta password</b>.</p>`;
  } else if(ui.sheet === 'fbnew'){
    const w2 = curWall(), c2 = curCircuit();
    const where = ui.home ? 'schermata iniziale' : [w2 ? w2.name : '', c2 && w2 && !bGrid() ? blockTitle(w2, c2) : ''].filter(Boolean).join(' · ');
    h = `<h2>Segnala un problema</h2><p class="note" style="margin:0 0 10px">Scrivi cosa non va o cosa miglioreresti. Insieme al messaggio arrivano da sole anche la schermata in cui sei${where ? ` (<b>${esc(where)}</b>)` : ''}, il tipo di telefono e la versione dell'app.</p>`+
      `<label class="field">Messaggio<textarea id="fbtext" rows="5" maxlength="2000" placeholder="Es.: il contorno di questa presa è sbagliato, non trovo il tasto per…" style="width:100%;resize:vertical">${esc(ui.fbDraft || '')}</textarea></label>`+
      `<div class="row"><button class="btn primary" data-act="fbsend">Invia</button><button class="btn" data-act="close">Annulla</button></div>`;
  } else if(ui.sheet === 'mine'){
    h = mineHtml();
  } else if(ui.sheet === 'badges'){
    const nb = newB(); if(nb.length){ ui.nbShown = nb; setNewB([]); setTimeout(() => { render(); const e = document.querySelector('#card .badge.isnew'); if(e) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 350); }
    h = `<div class="shead"><button class="backbtn" data-act="mine" aria-label="Torna a Le mie salite"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 3L5 9l6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span><small>Le mie salite</small><h2>I miei badge</h2></span></div>` + badgesHtml() + `<div class="row"><button class="btn" data-act="mine">Le mie salite</button><button class="btn primary" data-act="close">Chiudi</button></div>`;
  } else if(ui.sheet === 'acct'){
    h = acctHtml();
  } else if(ui.sheet === 'welcome'){
    h = welcomeHtml();
  } else if(ui.sheet === 'qr'){
    h = qrHtml();
  } else if(ui.sheet === 'dash'){
    h = dashHtml();
  } else if(ui.sheet === 'fblist'){
    const list = ui.fb, when = t => { const d = new Date(t); return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); };
    const shown = Array.isArray(list) ? list.filter(f => ui.fbAll || !f.done) : [];
    h = `<h2>Segnalazioni ricevute</h2>`+
      (list === null ? `<p>Carico…</p>` : list === 'err' ? `<p>Non riesco a leggere le segnalazioni. Hai eseguito in Supabase l'aggiornamento "segnalazioni ed errori"?</p>` :
       `<div class="row" style="margin:0 0 8px"><button class="btn ${ui.fbAll ? '' : 'on'}" data-act="fball" data-v="0">Da vedere (${list.filter(f => !f.done).length})</button><button class="btn ${ui.fbAll ? 'on' : ''}" data-act="fball" data-v="1">Tutte (${list.length})</button></div>`+
       (shown.length ? `<div class="list">${shown.map(f => { const x = f.ctx || {};
         return `<div class="wrow fbrow ${f.done ? 'fbdone' : ''}"><span style="flex:1;min-width:0"><small class="fbkind ${f.kind === 'errore' ? 'err' : ''}">${f.kind === 'errore' ? 'Errore dell\'app' : 'Segnalazione'}</small> <small>${when(f.created_at)}${f.email ? ' · ' + esc(String(f.email).split('@')[0]) : ''}</small><br>`+
           `<span class="fbmsg">${esc(f.message || '')}</span><br><small>${esc([x.where, x.ruolo, x.tel, x.v ? 'v' + x.v : ''].filter(Boolean).join(' · '))}</small></span>`+
           `<span class="fbbtns"><button class="btn" data-act="fbcopy" data-id="${f.id}">Copia</button><button class="btn" data-act="fbdone" data-id="${f.id}">${f.done ? 'Riapri' : 'Fatto'}</button></span></div>`; }).join('')}</div>` : `<p class="hint">Nessuna segnalazione da vedere.</p>`))+
      `<div class="row"><button class="btn" data-act="close">Chiudi</button></div>`;
  } else if(ui.sheet === 'hist'){
    const list = ui.hist, sel = ui.histSel, info = ui.histInfo;
    const when = t => { const d = new Date(t); return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ' alle ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); };
    const who = e => e ? esc(String(e).split('@')[0]) : 'qualcuno';
    const sum = x => `${x.walls} ${x.walls === 1 ? 'muro' : 'muri'} · ${x.circ} ${x.circ === 1 ? 'circuito' : 'circuiti'} · ${x.sectors} ${x.sectors === 1 ? 'settore' : 'settori'} · ${x.boulders} boulder`;
    h = `<h2>Versioni precedenti</h2><p class="note" style="margin:0 0 12px">A ogni Pubblica la versione di prima viene messa da parte. Tocca una versione per vedere cosa conteneva e, se serve, ripristinarla. Anche il ripristino si può annullare: la versione attuale finisce qui.</p>`+
      (list === null ? `<p>Carico…</p>` : list === 'err' ? `<p>Non riesco a leggere le versioni. Hai eseguito in Supabase l'aggiornamento "storico delle pubblicazioni"?</p>` :
       !list.length ? `<p class="hint">Ancora nessuna versione salvata: compariranno qui dalla prossima pubblicazione.</p>` :
       `<div class="list">${list.map(v => `<button class="wrow ${v.id === sel ? 'warn' : ''}" data-act="hsel" data-id="${v.id}"><span>${v.rev > 1e12 ? 'Pubblicata il ' + when(v.rev) : 'Versione precedente'}<br><small>sostituita il ${when(v.saved_at)} da ${who(v.saved_by)}</small></span></button>`+
         (v.id === sel ? `<div class="hinfo">${info === null ? 'Leggo la versione…' : info === 'err' ? 'Non riesco a leggere questa versione.' :
           `<p style="margin:0 0 4px"><b>Conteneva:</b> ${sum(info)}</p><p style="margin:0 0 10px;color:var(--muted)"><b>Adesso:</b> ${sum(histSum(S.walls))}</p>`+
           (dirty() ? `<p class="note" style="margin:0 0 10px">Le modifiche non pubblicate su questo telefono andranno perse.</p>` : '')+
           `<button class="btn ${ui.confirm === 'hrest' ? 'danger' : 'primary'}" data-act="hrest" style="width:100%">${ui.confirm === 'hrest' ? 'Tocca ancora per ripristinare' : 'Ripristina questa versione'}</button>`}</div>` : '')).join('')}</div>`)+
      `<div class="row"><button class="btn" data-act="close">Chiudi</button></div>`;
  } else if(ui.sheet === 'setpass'){
    h = `<h2>Imposta una password</h2><p class="note" style="margin:0 0 12px">Così la prossima volta entri con email e password, senza aspettare l'email.</p>`+
      `<label class="field">Nuova password (almeno 8 caratteri)<input id="npass" type="password" autocomplete="new-password"></label>`+
      `<div class="row"><button class="btn primary" data-act="savepass">Salva password</button><button class="btn" data-act="close">Annulla</button></div>`;
  } else if(ui.sheet === 'img'){
    h = `<h2>Immagine del circuito</h2>`+
      (ui.imgUrl === 'err' ? `<p>Non sono riuscito a creare l'immagine. Riprova.</p>` :
       ui.imgUrl ? `<img class="out" src="${ui.imgUrl}" alt="Circuito sul muro"><p class="note" style="margin:0 0 12px">Tieni premuto sull'immagine per salvarla o condividerla.</p>` :
       `<p>Preparo l'immagine…</p>`)+
      `<div class="row"><button class="btn primary" data-act="close">Chiudi</button></div>`;
  } else if(ui.sheet === 'crop' && ui.crop){
    const cr = ui.crop;
    const ptsAttr = cr.pts.map(p => (p.x*100)+','+(p.y*100)).join(' ');
    const shape = cr.pts.length < 2 ? '' :
      cr.closed
        ? `<polygon points="${ptsAttr}" fill="#ffd400" fill-opacity=".25" stroke="#ffd400" stroke-width=".6" vector-effect="non-scaling-stroke"/>`
        : `<polyline points="${ptsAttr}" fill="none" stroke="#ffd400" stroke-width=".6" vector-effect="non-scaling-stroke"/>`;
    const dots = cr.pts.map(p => `<circle cx="${p.x*100}" cy="${p.y*100}" r="1.2" fill="#ffd400" stroke="#000" stroke-width=".3"/>`).join('');
    const step = cr.closed ? `Forma chiusa con ${cr.pts.length} punti. Puoi confermare o rifare.` :
      cr.pts.length === 0 ? (BO() ? 'Puoi usare tutta la foto del settore, oppure toccare i punti attorno alla zona da tenere e poi "Chiudi forma".' : 'Tocca i punti lungo il vero bordo del pannello (anche se è storto/in prospettiva), poi "Chiudi forma".') :
      `Punti toccati: ${cr.pts.length}. Continua lungo il bordo, poi "Chiudi forma" (minimo 3 punti).`;
    h = `<h2>${BO() ? 'Foto del settore' : 'Ritaglia il pannello'}</h2><p class="hint">${step}</p>`+
      /* la foto si può ingrandire (tasti + e −) e spostare col dito, per mettere i punti con precisione */
      `<div style="position:relative">`+
      `<div id="cropbox" style="overflow:auto;max-height:62vh;border-radius:8px;touch-action:pan-x pan-y;overscroll-behavior:contain">`+
      `<div style="position:relative;line-height:0;width:${100*(cr.z || 1)}%">`+
      `<img data-act="cropTap" src="${cr.img}" style="width:100%;height:auto;display:block" draggable="false">`+
      `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">${shape}${dots.replace(/r="1.2"/g, `r="${(1.2/(cr.z || 1)).toFixed(2)}"`).replace(/stroke-width=".3"/g, `stroke-width="${(0.3/(cr.z || 1)).toFixed(2)}"`)}</svg>`+
      `</div></div>`+
      `<div class="zoom" style="position:absolute;right:8px;bottom:8px"><button data-act="cropZoom" data-d="1" aria-label="Ingrandisci">+</button><button data-act="cropZoom" data-d="-1" aria-label="Riduci" ${(cr.z || 1) > 1 ? '' : 'disabled'}>&minus;</button></div>`+
      `</div>`+
      `<div class="row" style="margin-top:10px">`+
      `<button class="btn" data-act="cropUndo" ${cr.pts.length && !cr.closed ? '' : 'disabled'}>Annulla ultimo punto</button>`+
      `<button class="btn" data-act="cropReset">Rifai</button>`+
      `<button class="btn" data-act="cropClose" ${cr.pts.length >= 3 && !cr.closed ? '' : 'disabled'}>Chiudi forma</button>`+
      `<button class="btn" data-act="cropCancel">Annulla</button>`+
      `<button class="btn primary" data-act="cropDone" ${cr.closed ? '' : 'disabled'}>Usa questo ritaglio</button>`+
      (cr.pts.length ? '' : `<button class="btn primary" data-act="cropAll">Usa tutta la foto</button>`)+
      `</div>`;
  } else { ui.sheet = null; el.hidden = true; return; }
  const cb0 = $('#cropbox'), keep = cb0 ? [cb0.scrollLeft, cb0.scrollTop] : null;
  card.innerHTML = h;
  const cb1 = $('#cropbox');
  if(cb1 && keep){ cb1.scrollLeft = keep[0]; cb1.scrollTop = keep[1]; }
  el.hidden = false;
}
/* foto del muro/settore con disegnato un blocco (per condividere e stampare) */
async function composeBlock(w, c, o){
  const keep = w.activeCircuit; w.activeCircuit = c.id;
  try{
    const photo = await loadImg(w.img);
    const inner = overlay(w, Object.assign({ numbers: S.prefs.numbers, lines: S.prefs.lines, others: EDIT, edit: false, dim: S.prefs.dim }, o || {}));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w.w}" height="${w.h}" viewBox="0 0 ${w.w} ${w.h}">${inner}</svg>`;
    const ov = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    const cv = document.createElement('canvas'); cv.width = w.w; cv.height = w.h;
    const g = cv.getContext('2d'); g.drawImage(photo, 0, 0, w.w, w.h); g.drawImage(ov, 0, 0, w.w, w.h);
    return cv;
  } finally { w.activeCircuit = keep; }
}
const blockTitle = (w, c) => isSec(w) ? bTitle(c) + (c.name ? ' · ' + c.name : '') : c.name;
async function makeImage(){
  const w = curWall(), c = curCircuit(); if(!w || !c) return;
  ui.imgUrl = null; openSheet('img');
  const done = busy('Creo l\'immagine…');
  try{
    await nextPaint();
    const pic = await composeBlock(w, c);
    const capH = Math.round(w.w*0.09);
    const cv = document.createElement('canvas'); cv.width = w.w; cv.height = w.h + capH;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(pic, 0, 0);
    g.beginPath(); g.arc(capH*0.5, w.h + capH/2, capH*0.2, 0, Math.PI*2);
    g.fillStyle = colOf(c); g.fill(); g.lineWidth = Math.max(2, capH*0.03); g.strokeStyle = '#111111'; g.stroke();
    g.fillStyle = '#111111'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(capH*0.4)}px "Barlow Semi Condensed", Arial, sans-serif`;
    g.fillText(isSec(w) ? `${w.name}: ${blockTitle(w, c)}${c.setter ? ' · ' + c.setter : ''}` : `${w.name}: ${c.name}${c.grade ? ' · ' + c.grade : ''}`, capH*0.9, w.h + capH/2);
    ui.imgUrl = cv.toDataURL('image/jpeg', 0.92);
  }catch(e){ ui.imgUrl = 'err'; }
  finally{ done(); }
  if(ui.sheet === 'img') renderSheet();
}
/* stampa: una pagina per blocco, con foto, nome, grado/difficoltà e dati; dal dialogo di stampa si può anche salvare in PDF */
async function printBlocks(all){
  const w = curWall(), c = curCircuit(); if(!w || !c) return;
  const list = all ? sortedVisible(w) : [c];
  ui.sheet = null; renderSheet();
  const done = busy(list.length > 1 ? `Preparo ${list.length} pagine…` : 'Preparo la stampa…');
  try{
    await nextPaint();
    const today = new Date().toLocaleDateString('it-IT');
    let html = '';
    for(const b of list){
      const pic = await composeBlock(w, b, { numbers: !isSec(w), others: false, dim: true });
      const meta = isSec(w)
        ? [b.style, b.setter ? 'tracciato da ' + b.setter : '', b.dateSet ? 'montato il ' + fmtDate(b.dateSet) : '', holdColText(b)].filter(Boolean)
        : [b.grade ? 'grado ' + b.grade : '', b.style, b.feet ? 'piedi ' + b.feet : '', b.angle != null ? b.angle + '°' : '', movesText(b)].filter(Boolean);
      html += `<section class="ppage"><header><span>Monkey Island Roma</span><span>${esc(w.name)}</span></header>`+
        `<h1><i style="background:${colOf(b)}"></i>${esc(blockTitle(w, b))}${!isSec(w) && b.grade ? `<b>${esc(b.grade)}</b>` : ''}</h1>`+
        `<p class="pmeta">${meta.map(esc).join(' · ')}</p>`+
        (isSec(w) && (b.tags || []).length ? `<p class="pmeta">${b.tags.map(esc).join(' · ')}</p>` : '')+
        (isSec(w) && b.notes ? `<p class="pnotes">${esc(b.notes)}</p>` : '')+
        `<img src="${pic.toDataURL('image/jpeg', 0.88)}" alt="">`+
        `<footer>Monkey Roads · stampato il ${today}</footer></section>`;
    }
    const el = $('#print'); el.innerHTML = html;
    await Promise.all([...el.querySelectorAll('img')].map(i => i.decode ? i.decode().catch(() => {}) : null));
  }catch(e){ done(); toast('Non riesco a preparare la stampa.'); return; }
  done();
  setTimeout(() => { try{ window.print(); }catch(e){ toast('Stampa non disponibile su questo dispositivo.'); } }, 50);
}
window.addEventListener('afterprint', () => { const el = $('#print'); if(el) el.innerHTML = ''; });

/* ---------- pubblicazione ---------- */
/* ---------- segnalazioni e registro degli errori ---------- */
const APP_V = (() => { try{ return new URL(document.getElementById('app-js').src).searchParams.get('v') || ''; }catch(e){ return ''; } })();
function fbCtx(){
  const w = curWall(), c = curCircuit();
  const ua = navigator.userAgent, tel = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'altro';
  const br = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : '';
  return {
    where: ui.home ? 'schermata iniziale' : [ui.section === 'boulder' ? 'Boulder' : 'Circuiti', w ? w.name : '', c && w && !bGrid() ? blockTitle(w, c) : ''].filter(Boolean).join(' · '),
    ruolo: ME ? ME.role : (EDIT ? 'staff' : 'cliente'), modo: S.mode, tel: tel + (br ? ' · ' + br : ''), schermo: innerWidth + 'x' + innerHeight,
    v: APP_V, sam: sam.state, ua: ua.slice(0, 200)
  };
}
async function fbSend(kind, message, extra){
  if(!SB) return false;
  const email = (ME && ME.email) || ui.authEmail || null;
  const { error } = await SB.from('feedback').insert({ kind, message: String(message).slice(0, 2000), ctx: Object.assign(fbCtx(), extra || {}), email });
  return !error;
}
/* errori dell'app: si registrano da soli (al massimo 5 per sessione, senza doppioni) */
const errSeen = new Set();
function logErr(msg, stack){
  try{
    msg = String(msg || 'errore').slice(0, 300);
    if(errSeen.has(msg) || errSeen.size >= 5 || /ResizeObserver|Script error/i.test(msg)) return;
    errSeen.add(msg);
    fbSend('errore', msg, { stack: String(stack || '').slice(0, 1500) }).catch(() => {});
  }catch(e){}
}
window.addEventListener('error', e => logErr(e.message, e.error && e.error.stack));
window.addEventListener('unhandledrejection', e => { const r = e.reason; logErr(r && r.message ? r.message : String(r), r && r.stack); });
async function loadFb(){
  ui.fb = null; renderSheet();
  const { data, error } = await SB.from('feedback').select('id,created_at,kind,message,ctx,email,done').order('id', { ascending: false }).limit(200);
  ui.fb = error ? 'err' : (data || []);
  if(ui.sheet === 'fblist') renderSheet();
}
/* ---------- versioni precedenti (storico delle pubblicazioni, solo gestore) ---------- */
function histSum(walls){
  const ws = (walls || []).filter(w => !w.archived), sec = ws.filter(isSec), circ = ws.filter(w => !isSec(w));
  return { walls: circ.length, circ: circ.reduce((t, w) => t + (w.circuits || []).length, 0), sectors: sec.length, boulders: sec.reduce((t, w) => t + (w.circuits || []).filter(c => !isOff(c)).length, 0) };
}
async function loadHist(){
  ui.hist = null; ui.histSel = null; ui.histInfo = null; renderSheet();
  const { data, error } = await SB.from('app_state_history').select('id,saved_at,saved_by,rev').order('id', { ascending: false }).limit(60);
  ui.hist = error ? 'err' : (data || []);
  if(ui.sheet === 'hist') renderSheet();
}
async function histSelect(id){
  if(ui.histSel === id){ ui.histSel = null; ui.confirm = null; renderSheet(); return; }
  ui.histSel = id; ui.histInfo = null; ui.histData = null; ui.confirm = null; renderSheet();
  const { data, error } = await SB.from('app_state_history').select('data').eq('id', id).maybeSingle();
  if(ui.histSel !== id) return;
  if(error || !data || !data.data || !Array.isArray(data.data.walls)){ ui.histInfo = 'err'; }
  else { ui.histData = data.data; ui.histInfo = histSum(data.data.walls); }
  if(ui.sheet === 'hist') renderSheet();
}
async function histRestore(){
  if(!ui.histData || ui.publishing) return;
  if(ui.confirm !== 'hrest'){ ui.confirm = 'hrest'; renderSheet(); return; }
  ui.confirm = null; ui.publishing = true;
  busy('Ripristino…');
  try{
    const { data: cur } = await SB.from('app_state').select('rev').eq('id', 1).maybeSingle();
    const rev = Math.max(Date.now(), ((cur && cur.rev) || 0) + 1);
    const d = Object.assign({}, ui.histData, { rev });
    const { error } = await SB.from('app_state').upsert({ id: 1, data: d, rev, updated_at: new Date().toISOString() });
    if(error) throw error;
    rememberPlace(); location.reload();
  }catch(e){
    busyStack.length = 0; renderBusy(); ui.publishing = false;
    toast('Ripristino non riuscito: ' + ((e && e.message) || 'riprova.'));
  }
}
async function loadStaff(){
  ui.staff = null; renderSheet();
  const { data, error } = await SB.from('editors').select('email,role,name').order('email');
  ui.staff = error ? 'err' : (data || []);
  if(ui.sheet === 'staff') renderSheet();
}
async function staffAdd(){
  const inp = document.getElementById('semail'), email = ((inp && inp.value) || '').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email)){ toast('Scrivi un\'email valida.'); return; }
  const ni = document.getElementById('sname'), name = ((ni && ni.value) || '').trim().slice(0, 40);
  const { error } = await SB.from('editors').insert({ email, role: 'tracciatore', ...(name ? { name } : {}) });
  if(error){ toast(/duplicate/i.test(error.message || '') ? 'È già nello staff.' : 'Non riuscito: ' + error.message); return; }
  toast((name || email) + ' aggiunto allo staff.'); if(name) ui.staffNames = [...new Set([...(ui.staffNames || []), name])].sort(); loadStaff();
}
async function staffName(email, name){
  name = (name || '').trim().slice(0, 40);
  const { error } = await SB.from('editors').update({ name: name || null }).eq('email', email);
  if(error){ toast('Nome non salvato: ' + error.message); return; }
  const p = Array.isArray(ui.staff) && ui.staff.find(x => x.email === email); if(p) p.name = name;
  if(ME && ME.email.toLowerCase() === email.toLowerCase()) ME.name = name || undefined;
  ui.staffNames = (Array.isArray(ui.staff) ? ui.staff : []).map(x => (x.name || '').trim()).filter(Boolean).sort();
  toast('Nome salvato: i nuovi boulder di questa persona useranno "' + (name || email.split('@')[0]) + '".');
}
async function staffDel(email){
  if(ui.confirm !== 'staffdel:' + email){ ui.confirm = 'staffdel:' + email; renderSheet(); return; }
  ui.confirm = null;
  const { error } = await SB.from('editors').delete().eq('email', email);
  if(error){ toast('Non riuscito: ' + error.message); return; }
  toast(email + ' tolto dallo staff.'); loadStaff();
}
async function passLogin(){
  const em = document.getElementById('lemail'), pw = document.getElementById('lpass');
  const email = ((em && em.value) || '').trim(), password = (pw && pw.value) || '';
  ui.loginEmail = email;
  if(!SB || !/^\S+@\S+\.\S+$/.test(email) || !password){ toast('Scrivi email e password.'); return; }
  setIntent('staff');
  const { error } = await SB.auth.signInWithPassword({ email, password });
  if(error){ toast(/invalid/i.test(error.message || '') ? 'Email o password non corrette. Se non hai ancora una password, usa il link.' : 'Accesso non riuscito: ' + error.message); return; }
  rememberPlace(); location.reload();
}
async function savePassword(){
  const pw = document.getElementById('npass'), password = (pw && pw.value) || '';
  if(password.length < 8){ toast('La password deve avere almeno 8 caratteri.'); return; }
  const { error } = await SB.auth.updateUser({ password });
  if(error){ toast('Non riuscito: ' + error.message); return; }
  ui.sheet = null; renderSheet(); toast('Password salvata: da ora puoi entrare con email e password.');
}
async function sendLoginLink(){
  const inp = document.getElementById('lemail');
  const email = ((inp && inp.value) || ui.loginEmail || '').trim();
  ui.loginEmail = email;
  if(!SB || !/^\S+@\S+\.\S+$/.test(email)){ toast('Scrivi un\'email valida.'); return; }
  setIntent('staff');
  const { error } = await SB.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if(error){ toast('Invio non riuscito: ' + (error.message || 'riprova tra poco.')); return; }
  ui.loginSent = true; renderSheet();
}
/* accesso con il codice dell'email: la sessione nasce dentro l'app che si sta usando (il link invece si apre spesso nel browser di Gmail) */
async function codeLogin(){
  const inp = document.getElementById('lcode'), token = ((inp && inp.value) || '').replace(/\D/g, ''), email = (ui.loginEmail || '').trim();
  if(!SB || token.length < 6 || !email){ toast('Scrivi il codice che trovi nell\'email.'); return; }
  let { error } = await SB.auth.verifyOtp({ email, token, type: 'email' });
  if(error){ const r = await SB.auth.verifyOtp({ email, token, type: 'signup' }); error = r.error; }
  if(error){ toast(/expired|invalid/i.test(error.message || '') ? 'Codice non valido o scaduto. Controlla di aver usato l\'ultima email ricevuta.' : 'Accesso non riuscito: ' + error.message); return; }
  rememberPlace(); location.reload();
}
/* carica le foto nuove nell'archivio e salva lo stato nel database; poi ricarica la pagina pubblicata */

/* ---------- unione con le pubblicazioni degli altri ----------
   base = versione online da cui è partita la mia bozza; local = la mia bozza; remote = versione online adesso.
   Per ogni muro e ogni circuito: se l'ho cambiato io vince la mia versione, altrimenti quella online. */
const J = x => JSON.stringify(x === undefined ? null : x);
function mergeList(base, local, remote, mergeItem){
  const B = new Map((base || []).map(x => [x.id, x])), L = new Map((local || []).map(x => [x.id, x])), R = new Map((remote || []).map(x => [x.id, x]));
  const ids = [...(remote || []).map(x => x.id), ...(local || []).map(x => x.id).filter(id => !R.has(id))];
  const out = [];
  for(const id of ids){
    const b = B.get(id), l = L.get(id), r = R.get(id);
    if(!l){ if(b) continue; out.push(r); continue; }              /* tolto da me: resta tolto; nuovo di altri: entra */
    if(!r){ if(b && J(l) === J(b)) continue; out.push(l); continue; } /* tolto da altri e non toccato da me: resta tolto */
    if(!b){ out.push(l); continue; }
    if(J(l) === J(b)){ out.push(r); continue; }
    if(J(r) === J(b)){ out.push(l); continue; }
    out.push(mergeItem ? mergeItem(b, l, r) : l);
  }
  return out;
}
function mergeWall(b, l, r){
  const m = {};
  const keys = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]);
  keys.delete('circuits');
  for(const k of keys){
    const v = J(l[k]) === J(b[k]) ? r[k] : l[k];
    if(v !== undefined) m[k] = v;
  }
  m.circuits = mergeList(b.circuits, l.circuits, r.circuits, null);
  if(l.activeCircuit && m.circuits.some(c => c.id === l.activeCircuit)) m.activeCircuit = l.activeCircuit;
  return m;
}
function mergeWalls(base, local, remote){ return mergeList(base, local, remote, mergeWall); }
async function publishRemote(){
  /* prima di scrivere: l'accesso deve essere ancora valido (sui telefoni, con l'app in pausa a lungo, può scadere)
     e l'email deve risultare nello staff anche per il database */
  let { data: { session } } = await SB.auth.getSession();
  if(session && session.expires_at && session.expires_at*1000 < Date.now() + 60000){ try{ const r = await SB.auth.refreshSession(); session = r.data.session; }catch(e){} }
  if(!session) throw new Error('il tuo accesso è scaduto. Le modifiche restano salvate su questo telefono: dal menu ⋮ → Accesso staff rientra con la tua email, poi premi di nuovo Pubblica.');
  const { data: okEd } = await SB.rpc('is_editor');
  if(!okEd) throw new Error(`l'account ${(session.user && session.user.email) || ''} non risulta nello staff per il database. Le modifiche restano salvate su questo telefono: chiedi al gestore di controllare l'email nella lista Staff.`);
  const snap = JSON.parse(JSON.stringify(snapshot()));
  if(!isMgr() && BASE){
    /* il tracciatore porta solo i circuiti: muri, foto e prese restano quelli della versione di partenza */
    snap.walls = BASE.map(bw => {
      const lw = snap.walls.find(x => x.id === bw.id);
      return lw ? Object.assign(JSON.parse(JSON.stringify(bw)), { circuits: lw.circuits, activeCircuit: lw.activeCircuit }) : JSON.parse(JSON.stringify(bw));
    });
  }
  const { data: row, error: rerr } = await SB.from('app_state').select('data,rev').eq('id', 1).maybeSingle();
  if(rerr) throw rerr;
  if(row && row.data && Array.isArray(row.data.walls) && (row.rev || 0) > PUBREV){
    snap.walls = mergeWalls(BASE || [], snap.walls, row.data.walls);
    if(!snap.walls.some(w => w.id === snap.active) && snap.walls.length) snap.active = snap.walls[0].id;
  }
  snap.rev = Math.max(Date.now(), ((row && row.rev) || 0) + 1);
  for(const w of snap.walls){
    if(typeof w.img === 'string' && w.img.startsWith('data:')){
      const blob = await (await fetch(w.img)).blob();
      const path = w.id + '-' + Date.now() + '.jpg';
      const up = await SB.storage.from('walls').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if(up.error) throw up.error;
      w.img = SB.storage.from('walls').getPublicUrl(path).data.publicUrl;
    }
  }
  const { error } = await SB.from('app_state').upsert({ id: 1, data: snap, rev: snap.rev, updated_at: new Date().toISOString() });
  if(error) throw error;
  rememberPlace(); location.reload();
}
/* passa al volo a vedere l'app come gestore, tracciatore o cliente (solo per lo staff; non cambia i permessi veri) */
function setViewAs(v){
  if(!REAL_EDIT || !ME) return;
  if(ME.role !== 'gestore' && v === 'gestore') return;
  const inSector = BO() && !bGrid() && !!curWall();   /* entrando o uscendo dall'anteprima si resta sullo stesso settore */
  ui.viewAs = v === ME.role ? null : v;
  if(v !== 'cliente') ui.prevNew = false;
  EDIT = v !== 'cliente';
  if(inSector) ui.bLevel = 'sector';
  S.mode = EDIT ? 'edit' : 'view';
  ui.sel = null; ui.csel = null; ui.move = false; ui.full = false; ui.draft = []; ui.bdraw = false; ui.sheet = null;
  renderSheet(); render();
  if(ui.viewAs && !ui.prevNew) toast(v === 'cliente' ? 'Anteprima: l\'app come la vede un cliente. Tocca la chiave inglese per tornare a lavorare.' : 'Vedi l\'app come un tracciatore.');
}
async function publish(){
  if(!EDIT || !SB || ui.publishing || !dirty()) return;
  if(ui.scan){ toast('Prima aspetta la fine del rilevamento automatico, o fermalo: pubblicando l\'app si ricarica e lo interrompe.'); return; }
  ui.publishing = true; renderPub();
  try{
    await saveNow();
    busy('Pubblico…'); await nextPaint();
    await publishRemote();   /* dopo il successo la pagina si ricarica sulla nuova versione */
  }catch(e){
    busyStack.length = 0; renderBusy();
    ui.publishing = false;
    const m = (e && e.message) || 'riprova.';
    toast('Pubblicazione non riuscita: ' + (/row-level security|permission denied/i.test(m) ? 'il database non ti riconosce come staff. Le modifiche restano su questo telefono: chiudi e riapri l\'app e riprova; se succede ancora, avvisa il gestore.' : m), 9000);
    renderPub();
  }
}

/* ---------- interazione ---------- */
$('#box').addEventListener('click', () => { if(cCompact() && curCircuit() && Date.now() - ui.pinchAt > 350) setFull(true); });
$('#stage').addEventListener('click', async e => {
  const w = curWall(), c = curCircuit();
  if(w && bOver() && Date.now() - ui.pinchAt > 350){
    const r = e.currentTarget.getBoundingClientRect(), k = w.w / r.width;
    const hit = overviewHit(w, (e.clientX - r.left)*k, (e.clientY - r.top)*k, Math.min(22*k, w.w*0.06));
    if(hit){ if(EDIT && S.mode !== 'view') traceBoulder(w, hit.id); else { w.activeCircuit = hit.id; save(); setFull(true); } }
    return;
  }
  if(!EDIT || !w || S.mode === 'view' || ui.busy || scanHere() || ui.bline || Date.now() - ui.pinchAt < 350) return;
  if(S.mode !== 'wall' && !c) return;
  const r = e.currentTarget.getBoundingClientRect();
  const k = w.w / r.width;
  const x = clamp((e.clientX - r.left)*k, 0, w.w), y = clamp((e.clientY - r.top)*k, 0, w.h);
  const ctol = Math.min(9*k, 30);
  if(S.mode === 'wall'){
    if(w.locked){ toast('Muro bloccato: premi "Sblocca muro" per modificarlo.'); return; }
    if(ui.tool === 'draw'){
      if(ui.draft.length >= 3 && Math.hypot(x - ui.draft[0][0], y - ui.draft[0][1]) <= Math.min(10*k, 28)){ finishDraw(w); return; }
      ui.draft.push([Math.round(x), Math.round(y)]); render(); return;
    }
    if(ui.tool === 'panel'){
      const rgb = await samplePanelColor(w, Math.round(x), Math.round(y));
      (w.panelSamples = w.panelSamples || []).push({ x: Math.round(x), y: Math.round(y), rgb });
      delete segCache[w.id];
      touch(); render();
      toast(`Campione aggiunto (${w.panelSamples.length}). Tocca altre zone o premi "Fine".`);
      return;
    }
    const lst = catList(w, x, y, ctol);
    if(ui.tool === 'erase'){
      if(lst.length){ delCat(w, lst[0]); }
      else toast('Nessun contorno qui.');
      return;
    }
    if(lst.length){
      const at = lst.indexOf(ui.csel);
      if(at < 0) ui.csel = lst[0];
      else if(lst.length === 1) ui.csel = null;
      else ui.csel = lst[(at + 1) % lst.length];
      render(); return;
    }
    if(ui.tool === 'erase') return;
    ui.busy = true;
    if(!Object.prototype.hasOwnProperty.call(segCache, w.id)) toast('Preparo il muro…');
    const res = await detect(w, x, y, 1);
    let ch;
    if(res) ch = { id: uid(), poly: res.poly.map(v => Math.round(v)), x: res.cx, y: res.cy, sx: x, sy: y, det: 1 };
    else { ch = { id: uid(), poly: circlePoly(x, y, S.prefs.r*w.w), x, y, sx: x, sy: y }; toast('Presa non riconosciuta: ho messo un cerchio. Regolalo, oppure usa Disegna.'); }
    (w.holds = w.holds || []).push(ch); ui.csel = w.holds.length - 1; ui.busy = false; touch(); render(); return;
  }
  if(isSec(w) && ui.bdraw){
    if(ui.draft.length >= 3 && Math.hypot(x - ui.draft[0][0], y - ui.draft[0][1]) <= Math.min(10*k, 28)){ finishBDraw(w, c); return; }
    ui.draft.push([Math.round(x), Math.round(y)]); render(); return;
  }
  if(ui.move && ui.sel != null && c.holds[ui.sel]){
    ui.busy = true;
    const h = c.holds[ui.sel];
    applySeg(h, await detect(w, x, y, h.ts || 1), x, y, w);
    ui.move = false; ui.busy = false; touch(); render(); return;
  }
  if(isSec(w) && ui.cand && ui.cand.cid === c.id && ui.sel == null){
    const k = ui.cand.list.findIndex(q => inPoly(q.poly, x, y));
    if(k >= 0){ addCand(w, c, k); ui.nextRole = 'hold'; touch(); render(); return; }
  }
  const hit = hitIndex(c, w.w, x, y, ctol);
  if(hit >= 0 && isSec(w) && ui.nextRole === 'start' && ui.sel == null){ addMark(c, c.holds[hit], x, y); return; }
  if(hit >= 0){ ui.sel = ui.sel === hit ? null : hit; ui.move = false; render(); return; }
  if(isSec(w) && ui.nextRole === 'start' && startMarks(c) >= 4){ toast('Ci sono già 4 punti di partenza. Togline uno (seleziona la presa → Togli i segni) o passa a Presa.'); return; }
  if(isSec(w)){
    ui.busy = true;
    const res = await detect(w, x, y, 1);
    const nh = { x, y, sx: x, sy: y, r: S.prefs.r, role: ui.nextRole, ts: 1 };
    applySeg(nh, res, x, y, w);
    if(!res) toast('Contorno non riconosciuto: ho messo un cerchio. Regolalo con Contorno +/−.');
    c.holds.push(nh);
    ui.markUndo = null;
    if(nh.role === 'start'){ nh.marks = [[Math.round(x), Math.round(y)]]; ui.markUndo = null; ui.busy = false; ui.sel = null; touch(); render(); return; }
    ui.nextRole = 'hold';
    if(ui.nextHand === 'L') ui.nextHand = 'R'; else if(ui.nextHand === 'R') ui.nextHand = 'L';
    ui.sel = null; ui.busy = false; touch(); render(); return;
  }
  const ci2 = catHit(w, x, y, ctol);
  if(ci2 >= 0){
    const ch = w.holds[ci2];
    const ft = ui.nextRole === 'foot';
    c.holds.push({ x: ch.x, y: ch.y, sx: ch.sx || ch.x, sy: ch.sy || ch.y, r: S.prefs.r, role: ui.nextRole, ts: 1, poly: ch.poly.slice(), cid: ch.id, ...(ui.nextHand && !ft ? { hand: ui.nextHand } : {}) });
    if(!ft){ ui.nextRole = 'hold';   /* i piedi si segnano di fila: si resta su Piede finché non si cambia */
      if(ui.nextHand === 'L') ui.nextHand = 'R'; else if(ui.nextHand === 'R') ui.nextHand = 'L'; }
    ui.sel = null; touch(); render(); return;
  }
  toast('Qui non c\'è una presa del muro. Per aggiungerla: menu ⋮ → Prese del muro.');
});

/* azioni che può fare chiunque; tutte le altre richiedono di essere dello staff */
const PUBLIC_ACTS = ['badges','hi','prevtoday','fgo','bcolorall','rate','minetab','tick','vote','mine','acct','acctmode','acctgo','acctreset','delacct','welcome','wnext','wskip','minego','bnew','cnew','fbnew','fbsend','csearch','cfilt','sqang','sqsty','sqfeet','sqreset','sqgo','pickhome','preview','opensec','bback','viewas','menu','printone','printall','logout','wall','pickw','pref','zoom','clist','pickc','fang','bshow','bcolor','fexit','fnav','sec','img','close','install','login','sendlink','passlogin','codelogin','loginback','setpass','savepass'];
/* azioni riservate al gestore (preparazione dei muri e dei settori) */
const MGR_ACTS = ['qr','qrprint','qrcopy','dash','dashsec','fblist','fbcopy','fball','fbdone','susok','susdel','hist','hsel','hrest','wman','wren','wrensave','warch','archlist','wrestore','wdel','wallmode','clrall','unclrall','cropZoom','lock','unlock','autoall','stopauto','delw','cropAll','cropTap','cropUndo','cropClose','cropReset','cropDone','panelReset','panelDone','tool','closeDraw','undoPt','cancelDraw','redraw','undel','susnext','staff','staffadd','staffdel'];
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if(!b || b.disabled) return;
  const a = b.dataset.act, w = curWall(), c = curCircuit();
  if(!EDIT && !PUBLIC_ACTS.includes(a)) return;
  if(!isMgr() && MGR_ACTS.includes(a)) return;
  switch(a){
    case 'mode': if(EDIT && !scanHere() && !(b.dataset.v === 'wall' && !isMgr())){ S.mode = b.dataset.v; ui.sel = null; ui.csel = null; ui.move = false; ui.draft = []; ui.bdraw = false; ui.bline = false; $('#stage').classList.remove('linedraw'); ui.redraw = null; ui.tool = 'detect'; render(); } break;
    case 'tool': ui.tool = b.dataset.v; ui.draft = []; ui.redraw = null; render(); break;
    case 'clrall':
      if(!w || !(w.holds || []).length) break;
      if(ui.confirm !== 'clrall'){ ui.confirm = 'clrall'; renderTools(); setTimeout(() => { if(ui.confirm === 'clrall'){ ui.confirm = null; renderTools(); } }, 4000); break; }
      ui.confirm = null; ui.cleared = { id: w.id, holds: w.holds }; w.holds = []; ui.csel = null; ui.trash = [];
      touch(); render(); toast('Prese cancellate. I circuiti già tracciati restano com\'erano. Ora puoi usare "Rileva tutte le prese".'); break;
    case 'unclrall':
      if(w && ui.cleared && ui.cleared.id === w.id){ w.holds = ui.cleared.holds.concat(w.holds || []); ui.cleared = null; touch(); render(); toast('Prese ripristinate.'); } break;
    case 'undel': if(w && ui.trash.length){ const ch = ui.trash.pop(); (w.holds = w.holds || []).push(ch); ui.csel = w.holds.length - 1; touch(); render(); } break;
    case 'susok': case 'susdel': {
      if(!w || ui.csel == null || !w.holds[ui.csel]) break;
      const cur = w.holds[ui.csel], cy = cur.y, cx = cur.x;
      if(a === 'susok'){ cur.ok = 1; ui.csel = null; touch(); } else delCat(w, ui.csel);
      /* si passa subito alla sospetta successiva (in ordine di lettura) */
      const sus = [...catSuspects(w)].sort((p, q) => (w.holds[p].y - w.holds[q].y) || (w.holds[p].x - w.holds[q].x));
      const nx = sus.find(i => w.holds[i].y > cy || (w.holds[i].y === cy && w.holds[i].x > cx));
      ui.csel = sus.length ? (nx != null ? nx : sus[0]) : null;
      render(); if(ui.csel != null) focusCat(w, w.holds[ui.csel]); else toast('Nessuna presa sospetta rimasta.');
      break;
    }
    case 'susnext': {
      if(!w) break;
      const sus = [...catSuspects(w)].sort((a,b) => (w.holds[a].y - w.holds[b].y) || (w.holds[a].x - w.holds[b].x));
      if(!sus.length) break;
      const at = sus.indexOf(ui.csel);
      ui.csel = sus[(at + 1) % sus.length];
      render(); focusCat(w, w.holds[ui.csel]); break;
    }
    case 'candfind': if(w && c && isSec(w)) findColor(w, c); break;
    case 'candall': if(w && c && ui.cand && ui.cand.cid === c.id){ const n = ui.cand.list.length; while(ui.cand && ui.cand.list.length) addCand(w, c, 0); ui.nextRole = 'hold'; touch(); render(); toast(`${n} prese aggiunte. Togli quelle che non sono del blocco (toccala → Elimina) e segna il Top.`); } break;
    case 'candno': ui.cand = null; render(); break;
    case 'closeDraw': if(w) finishDraw(w); break;
    case 'undoPt': ui.draft.pop(); render(); break;
    case 'cancelDraw': ui.draft = []; ui.redraw = null; render(); break;
    case 'redraw': if(w && ui.csel != null && (w.holds || [])[ui.csel]){ ui.redraw = ui.csel; ui.tool = 'draw'; ui.draft = []; render(); } break;
    case 'lock': if(w){ w.locked = true; ui.draft = []; ui.redraw = null; ui.tool = 'detect'; ui.csel = null; S.mode = 'edit'; ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit()); touch(); render(); } break;
    case 'unlock': if(w){ w.locked = false; touch(); render(); } break;
    case 'panelReset': if(w){ delete w.panelSamples; delete segCache[w.id]; touch(); render(); } break;
    case 'panelDone': ui.tool = 'detect'; render(); break;
    case 'cropTap': {
      const cr = ui.crop; if(!cr || cr.closed) break;
      const r = b.getBoundingClientRect();
      const pt = { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
      cr.pts.push(pt);
      renderSheet(); break;
    }
    case 'cropZoom': {
      const cr = ui.crop; if(!cr) break;
      const box = $('#cropbox'), z0 = cr.z || 1, z1 = clamp(z0 * (+b.dataset.d > 0 ? 1.6 : 1/1.6), 1, 6);
      if(Math.abs(z1 - z0) < 1e-3) break;
      /* si ingrandisce attorno al centro di quello che si sta guardando */
      const cx = box ? (box.scrollLeft + box.clientWidth/2) / box.scrollWidth : 0.5, cy = box ? (box.scrollTop + box.clientHeight/2) / box.scrollHeight : 0.5;
      cr.z = z1; renderSheet();
      const nb = $('#cropbox');
      if(nb) requestAnimationFrame(() => { nb.scrollLeft = cx*nb.scrollWidth - nb.clientWidth/2; nb.scrollTop = cy*nb.scrollHeight - nb.clientHeight/2; });
      break;
    }
    case 'cropUndo': if(ui.crop && !ui.crop.closed) { ui.crop.pts.pop(); renderSheet(); } break;
    case 'cropClose': if(ui.crop && ui.crop.pts.length >= 3) { ui.crop.closed = true; renderSheet(); } break;
    case 'cropReset': if(ui.crop){ ui.crop.pts = []; ui.crop.closed = false; renderSheet(); } break;
    case 'cropCancel': ui.crop = null; ui.sheet = null; renderSheet(); break;
    case 'login': ui.loginSent = false; openSheet('login'); break;
    case 'sendlink': sendLoginLink(); break;
    case 'passlogin': passLogin(); break;
    case 'codelogin': codeLogin(); break;
    case 'loginback': ui.loginSent = false; renderSheet(); break;
    case 'fbnew': openSheet('fbnew'); setTimeout(() => { const t = document.getElementById('fbtext'); if(t) t.focus(); }, 50); break;
    case 'fbsend': {
      const t = document.getElementById('fbtext'), msg = ((t && t.value) || '').trim();
      if(msg.length < 3){ toast('Scrivi due parole su cosa non va.'); break; }
      b.disabled = true;
      fbSend('segnalazione', msg).then(ok => { if(ok){ ui.fbDraft = ''; ui.sheet = null; renderSheet(); toast('Grazie! Segnalazione inviata.'); } else { b.disabled = false; toast('Non riesco a inviarla adesso: riprova tra poco.'); } });
      break;
    }
    case 'fblist': if(SB && ME && ME.role === 'gestore'){ ui.fbAll = false; ui.fb = null; openSheet('fblist'); loadFb(); } break;
    case 'fbcopy': if(Array.isArray(ui.fb)){
      /* testo completo (messaggio, contesto, dettaglio tecnico) da incollare a Claude per farla sistemare */
      const f = ui.fb.find(x => String(x.id) === b.dataset.id); if(!f) break;
      const x = Object.assign({}, f.ctx || {}), st = x.stack; delete x.stack;
      const txt = `${f.kind === 'errore' ? 'Errore dell\'app' : 'Segnalazione'} #${f.id} del ${new Date(f.created_at).toLocaleString('it-IT')}${f.email ? ' da ' + f.email : ''}\n\n${f.message}\n\nContesto: ${Object.entries(x).map(([k, v]) => k + ': ' + v).join(' · ')}${st ? '\n\nDettaglio tecnico:\n' + st : ''}`;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Copiata: incollala a Claude'), () => { window.prompt('Copia il testo:', txt); });
      break; }
    case 'dash': openSheet('dash'); break;
    case 'tick': tick(b.dataset.v); break;
    case 'vote': vote(b.dataset.v); break;
    case 'hi': setHigh(+b.dataset.v || 0); break;
    case 'rate': rate(b.dataset.v); break;
    case 'mine': ui.confirm = null; ui.nbShown = null; ui.mineTab = null; openSheet(hasNewB() ? 'badges' : 'mine'); break;   /* con un badge nuovo si va dritti ai badge */
    case 'minetab': ui.mineTab = b.dataset.v === 'boulder' ? 'boulder' : 'circ'; renderSheet(); break;
    case 'badges': ui.nbShown = null; openSheet('badges'); break;
    case 'acct': ui.acctMode = 'in'; ui.acctWhy = false; openSheet('acct'); break;
    case 'acctmode': ui.acctMode = b.dataset.v; if(ui.sheet !== 'acct') openSheet('acct'); else renderSheet(); break;
    case 'acctgo': acctGo(); break;
    case 'acctreset': acctReset(); break;
    case 'delacct': if(CL) delAccount(); break;
    case 'welcome': ui.wIdx = 0; openSheet('welcome'); break;
    case 'wnext': if((ui.wIdx || 0) >= welcomeSlides().length - 1){ try{ localStorage.setItem('mr-welcome', '1'); }catch(e){} ui.sheet = null; renderSheet(); } else { ui.wIdx = (ui.wIdx || 0) + 1; renderSheet(); } break;
    case 'wskip': try{ localStorage.setItem('mr-welcome', '1'); }catch(e){} ui.sheet = null; renderSheet(); break;
    case 'minego': {
      const w2 = S.walls.find(x => x.id === b.dataset.w), c2 = w2 && w2.circuits.find(x => x.id === b.dataset.id); if(!w2 || !c2) break;
      if(w2.archived){ toast('Questo muro è stato archiviato.'); break; }
      ui.sheet = null; renderSheet();
      ui.section = secOf(w2); ui.home = false; S.active = w2.id; ui.lastSec[ui.section] = w2.id; saveBUI();
      ui.bLevel = 'sector'; ui.secOver = true; ui.zoom = 1; w2.activeCircuit = c2.id;
      if(isSec(w2) && isOff(c2)){ ui.bShow = 'all'; }
      save(); try{ history.pushState({ grid: 1 }, ''); history.pushState({ sec: 1 }, ''); }catch(e){} setFull(true); break; }
    case 'qr': openSheet('qr'); break;
    case 'qrprint': qrPrint(b.dataset.id); break;
    case 'qrcopy': { const it = qrItems().find(x => x.id === b.dataset.id); if(!it) break; const u = wallLink(it.w);
      (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('Link copiato'), () => window.prompt('Copia il link:', u)); break; }
    case 'dashsec': {
      const w2 = S.walls.find(x => x.id === b.dataset.id); if(!w2) break;
      ui.sheet = null; renderSheet();
      ui.section = 'boulder'; ui.home = false; ui.full = false;
      if(EDIT) S.mode = 'edit'; S.active = w2.id; ui.lastSec.boulder = w2.id; saveBUI();
      ui.bLevel = 'sector'; ui.secOver = true; ui.zoom = 1; ui.sel = null; ui.move = false; ui.draft = []; ui.bdraw = false; ui.bline = false;
      ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit()); save();
      try{ history.pushState({ grid: 1 }, ''); history.pushState({ sec: 1 }, ''); }catch(e){} render(); $('#box').scrollTop = 0; break; }
    case 'fball': ui.fbAll = b.dataset.v === '1'; renderSheet(); break;
    case 'fbdone': if(SB && ME && ME.role === 'gestore' && Array.isArray(ui.fb)){
      const f = ui.fb.find(x => String(x.id) === b.dataset.id); if(!f) break;
      const nd = !f.done; SB.from('feedback').update({ done: nd }).eq('id', f.id).then(({ error }) => { if(error) toast('Non riuscito: ' + error.message); else { f.done = nd; renderSheet(); } });
      break; }
    case 'hist': if(SB && ME && ME.role === 'gestore'){ ui.confirm = null; ui.hist = null; ui.histSel = null; openSheet('hist'); loadHist(); } break;
    case 'hsel': if(SB && ME && ME.role === 'gestore') histSelect(+b.dataset.id); break;
    case 'hrest': if(SB && ME && ME.role === 'gestore') histRestore(); break;
    case 'staff': if(SB && ME && ME.role === 'gestore'){ ui.staff = null; ui.confirm = null; openSheet('staff'); loadStaff(); } break;
    case 'staffadd': staffAdd(); break;
    case 'staffdel': staffDel(b.dataset.email); break;
    case 'setpass': openSheet('setpass'); break;
    case 'savepass': savePassword(); break;
    case 'logout': if(SB){ SB.auth.signOut().finally(() => location.reload()); } break;
    case 'cropDone': finishCrop(); break;
    case 'cropAll': finishCrop(true); break;
    case 'sec': {
      const v = b.dataset.v === 'boulder' ? 'boulder' : 'circ';
      if(v === ui.section) break;
      const prev = curWall(); if(prev) ui.lastSec[ui.section] = prev.id;
      ui.section = v; ui.bLevel = 'sectors'; ui.home = false;
      const l = secWalls(), keep = l.find(x => x.id === ui.lastSec[v]) || l[0];
      if(keep) S.active = keep.id;
      ui.full = false; ui.sel = null; ui.csel = null; ui.move = false; ui.zoom = 1; ui.draft = []; ui.bdraw = false; ui.redraw = null; ui.tool = 'detect';
      if(EDIT && S.mode === 'wall' && v === 'boulder') S.mode = 'edit';
      ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit()); saveBUI(); render(); break;
    }
    case 'bnew': ui.bNew = !ui.bNew; afterFilter(); break;
    case 'bcolorall': ui.bColor = []; saveBUI(); afterFilter(); break;
    case 'cnew': ui.cNew = !ui.cNew; afterFilter(); break;
    case 'bshow': case 'bcolor':
      if(a === 'bshow') ui.bShow = b.dataset.v;
      else { const v = b.dataset.v; ui.bColor = ui.bColor.includes(v) ? ui.bColor.filter(x => x !== v) : ui.bColor.concat(v); if(ui.bColor.length === DIFFS.filter(d => w && w.circuits.some(x => x.diff === d[0])).length) ui.bColor = []; }
      saveBUI(); afterFilter(); break;
    case 'cgen': {
      if(!c || !w || !window.genCircuitName) break;
      c.name = window.genCircuitName(c.style || '', w.circuits.filter(x => x !== c).map(x => x.name));
      const inp = document.getElementById('cname'); if(inp) inp.value = c.name;
      touch(); renderChips(); break;
    }
    case 'editdim': ui.editDim = !ui.editDim; render(); break;
    case 'desel': ui.sel = null; ui.move = false; render(); break;
    case 'cfeet': if(c){ if(b.dataset.v) c.feet = b.dataset.v; else delete c.feet; touch(); renderChips(); renderSheet(); } break;
    case 'bline': if(c){ ui.bline = true; ui.lineDraft = []; ui.lineBackup = c.line ? c.line.slice() : null; ui.sel = null; ui.move = false; $('#stage').classList.add('linedraw'); render(); } break;
    case 'lineok': ui.bline = false; ui.lineDraft = []; $('#stage').classList.remove('linedraw'); render(); break;
    case 'lineesc': if(c){ if(ui.lineBackup) c.line = ui.lineBackup; else delete c.line; touch(); } ui.bline = false; ui.lineDraft = []; $('#stage').classList.remove('linedraw'); render(); break;
    case 'linedel': if(c){ delete c.line; touch(); } ui.bline = false; ui.lineDraft = []; $('#stage').classList.remove('linedraw'); render(); break;
    case 'bdraw': if(c){ ui.bdraw = true; ui.draft = []; ui.move = false; render(); } break;
    case 'bclose': if(w && c) finishBDraw(w, c); break;
    case 'bundo': ui.draft.pop(); render(); break;
    case 'bcancel': ui.bdraw = false; ui.draft = []; render(); break;
    case 'bdiff': {
      if(!c || !w || !isSec(w)) break;
      if(/^Boulder \d+$/.test(c.name || '')) c.name = '';
      c.diff = b.dataset.v; c.color = diffOf(c)[2]; assignNum(w, c);
      /* il boulder non deve sparire dall'elenco perché il suo colore è fuori dal filtro */
      if(ui.bColor.length && !ui.bColor.includes(c.diff)){ ui.bColor = ui.bColor.concat(c.diff); saveBUI(); }
      touch(); render(); renderSheet(); break;
    }
    case 'hcolor': {
      if(!c) break;
      if(c.holdColor === b.dataset.c) delete c.holdColor; else c.holdColor = b.dataset.c;
      touch(); renderChips(); renderSheet(); break;
    }
    case 'btag': {
      if(!c) break;
      const t = b.dataset.v, l = c.tags || [];
      c.tags = l.includes(t) ? l.filter(x => x !== t) : l.concat(t);
      if(!c.tags.length) delete c.tags;
      touch(); renderSheet(); renderChips(); break;
    }
    case 'autoall': if(w) autoDetectAll(w); break;
    case 'stopauto': if(ui.scan) ui.scan.stop = true; break;
    case 'tracing': if(w && w.locked){ S.mode = 'edit'; render(); } break;
    case 'wall': openSheet('wall'); break;
    case 'wman': S.active = b.dataset.id; ui.lastSec[ui.section] = b.dataset.id; saveBUI(); ui.renaming = false; openSheet('wman'); break;
    case 'wren': ui.renaming = true; renderSheet(); setTimeout(() => { const i = $('#wname'); if(i){ i.focus(); i.select(); } }, 50); break;
    case 'wrensave': { const i = $('#wname'); if(w && i){ w.name = i.value.trim() || (isSec(w) ? 'Settore' : 'Muro'); touch(); } ui.renaming = false; ui.sheet = null; renderSheet(); render(); break; }
    case 'warch':
      if(!w) break;
      if(ui.confirm !== 'warch'){ ui.confirm = 'warch'; renderSheet(); break; }
      w.archived = true; ui.confirm = null; ui.sheet = null; ui.bLevel = 'sectors';
      { const l = secWalls(); S.active = l[0] ? l[0].id : null; }
      touch(); renderSheet(); render(); toast((isSec(w) ? 'Settore' : 'Muro') + ' archiviato. Ricordati di pubblicare.'); break;
    case 'archlist': ui.confirm = null; openSheet('arch'); break;
    case 'wrestore': { const x = S.walls.find(q => q.id === b.dataset.id); if(x){ delete x.archived; if(!archWalls().length) ui.sheet = null; touch(); renderSheet(); render(); toast('Ripristinato: ' + x.name + '. Ricordati di pubblicare.'); } break; }
    case 'wdel': {
      const id = b.dataset.id, x = S.walls.find(q => q.id === id); if(!x || !x.archived) break;
      if(ui.confirm !== 'wdel:' + id){ ui.confirm = 'wdel:' + id; renderSheet(); break; }
      S.walls = S.walls.filter(q => q.id !== id); ui.confirm = null; if(!archWalls().length) ui.sheet = null; touch(); renderSheet(); render(); toast('Eliminato. Ricordati di pubblicare.'); break;
    }
    case 'opensec': if(EDIT) S.mode = 'edit'; S.active = b.dataset.id; ui.lastSec[ui.section] = b.dataset.id; saveBUI(); ui.bLevel = 'sector'; ui.secOver = true; ui.zoom = 1; ui.sel = null; ui.move = false; ui.draft = []; ui.bdraw = false; ui.bline = false; ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit()); save(); try{ history.pushState({ sec: 1 }, ''); }catch(e){} render(); $('#box').scrollTop = 0; break;
    case 'bback':
      if(ui.full){ try{ history.back(); }catch(e){} ui.full = false; ui.zoom = 1; render(); break; }
      if(EDIT && BO() && ui.bLevel === 'sector' && !bGrid() && curWall() && !ui.secOver && S.mode !== 'view'){ if(history.state && history.state.ed){ try{ history.back(); }catch(e){} } ui.secOver = true; ui.sel = null; ui.zoom = 1; }
      else if(ui.bLevel === 'sector' && !bGrid() && curWall()){ if(history.state && history.state.sec){ try{ history.back(); }catch(e){} } ui.bLevel = 'sectors'; }
      else { if(history.state && history.state.grid){ try{ history.back(); }catch(e){} } ui.home = true; ui.bLevel = 'sectors'; }
      ui.zoom = 1; render(); break;
    case 'pickhome': {
      const v = b.dataset.v === 'boulder' ? 'boulder' : 'circ';
      const prev = curWall(); if(prev && !ui.home) ui.lastSec[ui.section] = prev.id;
      ui.section = v; ui.home = false; ui.bLevel = 'sectors'; ui.full = false; ui.sel = null; ui.zoom = 1;
      const l = secWalls(), keep = l.find(x => x.id === ui.lastSec[v]) || l[0]; if(keep) S.active = keep.id;
      if(EDIT) S.mode = 'edit';
      saveBUI(); try{ history.pushState({ grid: 1 }, ''); }catch(e){} render(); break;
    }
    case 'img': makeImage(); break;
    case 'menu': openSheet('menu'); break;
    case 'viewas': setViewAs(b.dataset.v); break;
    case 'preview': if(ui.viewAs === 'cliente') setViewAs(ME.role); else { ui.prevNew = true; setViewAs('cliente'); } break;
    case 'prevtoday': ui.prevNew = false; setViewAs('cliente'); break;
    case 'wallmode': if(EDIT && isMgr() && w && !isSec(w)){ S.mode = 'wall'; ui.bLevel = 'sector'; ui.sel = null; ui.csel = null; ui.move = false; ui.draft = []; ui.redraw = null; ui.tool = 'detect'; ui.sheet = null; renderSheet(); render(); } break;
    case 'printone': printBlocks(false); break;
    case 'printall': printBlocks(true); break;
    case 'publish': publish(); break;
    case 'pref': S.prefs[b.dataset.k] = !S.prefs[b.dataset.k]; saveViewPrefs(); render(); break;
    case 'zoom': { const bx = $('#box').getBoundingClientRect(); applyZoom(ui.zoom * Math.pow(1.4, +b.dataset.d), bx.left + bx.width/2, bx.top + bx.height/2); break; }
    case 'clist': ui.confirm = null; openSheet('clist'); break;
    case 'cedit': if(c && EDIT) openSheet('circ'); break;
    case 'pickc': {
      if(!w) break;
      if(bOver() && EDIT && S.mode !== 'view'){ ui.sheet = null; renderSheet(); traceBoulder(w, b.dataset.id); break; }
      const again = w.activeCircuit === b.dataset.id && b.classList.contains('lrow');
      w.activeCircuit = b.dataset.id; ui.sel = null; ui.move = false; ui.bdraw = false; ui.draft = []; ui.bline = false; $('#stage').classList.remove('linedraw'); ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit());
      ui.sheet = null; save(); renderSheet();
      if((again || bOver()) && (!EDIT || S.mode === 'view')) setFull(true); else render();
      break;
    }
    case 'fgo': if(w && ui.full){ const n = w.circuits.find(x => x.id === b.dataset.id); if(n){ w.activeCircuit = n.id; ui.sel = null; save(); render(); focusCircuit(); const d = document.querySelector('.fdots .fd.on'); if(d && d.scrollIntoView) d.scrollIntoView({ inline: 'center', block: 'nearest' }); } } break;
    case 'fexit': if(ui.full){ try{ history.back(); }catch(e){} ui.full = false; ui.zoom = 1; render(); } break;
    case 'fnav': {
      if(!w) break;
      const list = sortedVisible(w), i = list.findIndex(x => x.id === w.activeCircuit), n = list[i + (+b.dataset.d)];
      if(n){ w.activeCircuit = n.id; ui.sel = null; save(); render(); if(ui.full) focusCircuit(); }
      break;
    }
    case 'addc': {
      if(!w) break;
      const n = newCircuit(w); w.circuits.push(n); w.activeCircuit = n.id;
      if(isSec(w) && ui.secOver){ ui.secOver = false; try{ history.pushState({ sec: 1, ed: 1 }, ''); }catch(e){} }
      ui.sel = null; ui.move = false; ui.bdraw = false; ui.draft = []; ui.nextRole = 'start'; ui.nextHand = 'L'; S.mode = 'edit'; touch(); render(); openSheet('circ'); break;
    }
    case 'hand': {
      const h = c && ui.sel != null ? c.holds[ui.sel] : null, v = b.dataset.v;
      if(!v) break;
      if(h){ h.hand = v; touch(); } else ui.nextHand = v;
      render(); break;
    }
    case 'dup': {
      const h = c && ui.sel != null ? c.holds[ui.sel] : null;
      if(h){
        /* accoppio (presa appena segnata): l'altra mano; passaggio successivo più avanti: la mano che tocca adesso */
        const consec = ui.sel === c.holds.length - 1;
        const nh = consec ? (h.hand === 'L' ? 'R' : h.hand === 'R' ? 'L' : (ui.nextHand || 'L')) : (ui.nextHand || (h.hand === 'L' ? 'R' : 'L'));
        const copy = Object.assign({}, h, { role: 'hold' });
        if(h.poly) copy.poly = h.poly.slice();
        if(nh) copy.hand = nh; else delete copy.hand;
        c.holds.push(copy); ui.sel = c.holds.length - 1; ui.move = false;
        if(nh === 'L') ui.nextHand = 'R'; else if(nh === 'R') ui.nextHand = 'L';
        touch(); render();
      }
      break;
    }
    case 'role': {
      const h = c && ui.sel != null ? c.holds[ui.sel] : null;
      if(h){ h.role = b.dataset.v; if(h.role !== 'start') delete h.marks; if(h.role === 'foot') delete h.hand; else if(!h.hand && w && !isSec(w) && h.role === 'hold') h.hand = ui.nextHand || 'L'; touch(); } else ui.nextRole = b.dataset.v;
      render(); break;
    }
    case 'size': {
      if(S.mode === 'wall'){
        const ch = w && ui.csel != null ? (w.holds || [])[ui.csel] : null;
        if(!ch || ui.busy) break;
        ui.busy = true;
        resizeCat(w, ch, b.dataset.d === '1').then(ok => { if(ok) touch(); else toast('Non riesco a cambiare il contorno di questa presa.'); ui.busy = false; render(); });
        break;
      }
      const h = c && ui.sel != null ? c.holds[ui.sel] : null;
      if(!h || ui.busy) break;
      const up = b.dataset.d === '1';
      if(h.poly && h.drawn){
        const f = up ? 1.12 : 1/1.12;
        h.poly = h.poly.map((v, i) => Math.round(i % 2 === 0 ? h.x + (v - h.x)*f : h.y + (v - h.y)*f));
        touch(); render(); break;
      }
      if(h.poly){
        ui.busy = true;
        const ts = clamp((h.ts || 1) * (up ? 1.35 : 1/1.35), 0.4, 3);
        detect(w, h.sx, h.sy, ts).then(res => {
          if(res){ applySeg(h, res, h.sx, h.sy, w); h.ts = ts; touch(); }
          else toast('Non riesco a cambiare il contorno di questa presa.');
          ui.busy = false; render();
        });
      } else { h.r = clamp(h.r*(up ? 1.15 : 1/1.15), 0.012, 0.09); touch(); render(); }
      break;
    }
    case 'move': ui.move = !ui.move; render(); break;
    case 'del':
      if(S.mode === 'wall'){ if(w && ui.csel != null && (w.holds || [])[ui.csel]) delCat(w, ui.csel); break; }
      if(c && ui.sel != null){ c.holds.splice(ui.sel, 1); ui.sel = null; ui.move = false; ui.nextHand = handFor(c); if(!c.holds.length) ui.nextRole = 'start'; touch(); render(); } break;
    case 'clrmarks': { const h = c && ui.sel != null ? c.holds[ui.sel] : null; if(h){ delete h.marks; ui.markUndo = null; touch(); render(); } break; }
    case 'undo': if(c && ui.markUndo && c.holds.includes(ui.markUndo.h)){
        const { h, prev } = ui.markUndo; ui.markUndo = null;
        if(prev){ h.role = prev.role; if(prev.marks) h.marks = prev.marks; else delete h.marks; } else if((h.marks || []).length) h.marks.pop();
        touch(); render(); break;
      }
      if(c && c.holds.length){ c.holds.pop(); ui.sel = null; ui.move = false; ui.nextHand = handFor(c); if(!c.holds.length) ui.nextRole = 'start'; touch(); render(); } break;
    case 'delc':
      if(!w || !c) break;
      if(ui.confirm !== 'delc'){ ui.confirm = 'delc'; renderSheet(); break; }
      w.circuits = w.circuits.filter(x => x.id !== c.id);
      if(!w.circuits.length && !isSec(w)) w.circuits.push(newCircuit(w));
      w.activeCircuit = w.circuits.length ? w.circuits[0].id : null; ui.sel = null; ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit());
      ui.sheet = null; ui.confirm = null; touch(); render(); renderSheet(); break;
    case 'pickw': if(EDIT) S.mode = 'edit'; S.active = b.dataset.id; ui.lastSec[ui.section] = b.dataset.id; saveBUI(); ui.full = false; ui.sel = null; ui.zoom = 1; ui.move = false; ui.sheet = null; save(); render(); renderSheet(); break;
    case 'delw':
      if(!w || !isMgr()) break;
      if(ui.confirm !== 'delw'){ ui.confirm = 'delw'; renderSheet(); break; }
      S.walls = S.walls.filter(x => x.id !== w.id);
      { const l = secWalls(); S.active = l[0] ? l[0].id : (S.walls[0] ? S.walls[0].id : null); }
      if(BO()) ui.bLevel = 'sectors';
      ui.sel = null; ui.sheet = null; ui.confirm = null; touch(); render(); renderSheet(); toast(BO() ? 'Settore eliminato. Ricordati di pubblicare.' : 'Muro eliminato. Ricordati di pubblicare.'); break;
    case 'close': ui.sheet = null; ui.confirm = null; renderSheet(); break;
    case 'csearch': openSheet('csearch'); break;
    case 'sqang': ui.sq.ang = b.dataset.v; saveCF(); afterFilter(); renderSheet(); break;
    case 'sqsty': ui.sq.sty = b.dataset.v; saveCF(); afterFilter(); renderSheet(); break;
    case 'sqfeet': ui.sq.feet = b.dataset.v; saveCF(); afterFilter(); renderSheet(); break;
    case 'sqreset': ui.sq = { ang: '', min: '', max: '', sty: '', feet: '' }; saveCF(); afterFilter(); renderSheet(); break;
    case 'cfilt': openSheet('cfilt'); break;
    case 'sqgo': {
      const tw = S.walls.find(x => x.id === b.dataset.w); if(!tw) break;
      S.active = tw.id; tw.activeCircuit = b.dataset.id; ui.lastSec.circ = tw.id; saveBUI();
      ui.bLevel = 'sector'; ui.zoom = 1; ui.sel = null; ui.sheet = null; renderSheet();
      try{ history.pushState({ sec: 1 }, ''); }catch(e){} render(); break;
    }
    case 'install': ui.sheet = null; renderSheet(); doInstall(); break;
  }
});

document.addEventListener('input', e => {
  const c = curCircuit(), w = curWall();
  if(e.target.id === 'lemail'){ ui.loginEmail = e.target.value.trim(); return; }
  if(e.target.id === 'fbtext'){ ui.fbDraft = e.target.value; return; }
  if(e.target.id === 'sqmin' || e.target.id === 'sqmax'){ ui.sq[e.target.id === 'sqmin' ? 'min' : 'max'] = e.target.value; saveCF(); afterFilter(); renderSheet(); return; }
  if(!EDIT) return;
  if(e.target.id === 'bsetter' && c){ const v = e.target.value.trim(); if(v) c.setter = v; else delete c.setter; try{ localStorage.setItem('boulder-setter', v); }catch(err){} renderChips(); touch(); }
  if(e.target.id === 'cdset' && c){ if(e.target.value) c.dateSet = e.target.value; else delete c.dateSet; touch(); }
  if(e.target.id === 'bdset' && c){ if(e.target.value) c.dateSet = e.target.value; else delete c.dateSet; renderChips(); touch(); }
  if(e.target.id === 'bdrem' && c){
    if(e.target.value) c.dateRemoved = e.target.value; else delete c.dateRemoved;
    /* se torna in parete e il suo numero nel frattempo è stato preso, ne riceve uno libero */
    if(!isOff(c) && diffOf(c) && w.circuits.some(x => x !== c && x.diff === c.diff && x.num === c.num && !isOff(x))) assignNum(w, c);
    renderChips(); touch();
  }
  if(e.target.id === 'bnotes' && c){ const v = e.target.value; if(v.trim()) c.notes = v; else delete c.notes; touch(); }
  if(e.target.id === 'cname' && c){ if(isSec(w)) c.name = e.target.value.trim(); else c.name = e.target.value || 'Circuito'; renderChips(); touch(); }
  if(e.target.id === 'wname' && w){ w.name = e.target.value || (isSec(w) ? 'Settore' : 'Muro'); renderTop(); touch(); }
  if(e.target.id === 'cgrade' && c){ if(e.target.value) c.grade = e.target.value; else delete c.grade; renderChips(); touch(); }
  if(e.target.id === 'cstyle' && c){ if(e.target.value) c.style = e.target.value; else delete c.style; touch(); }
  if(e.target.id === 'cangle' && c){ if(e.target.value !== '') c.angle = +e.target.value; else delete c.angle; renderChips(); touch(); }
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && ui.sheet){ ui.sheet = null; ui.confirm = null; renderSheet(); return; }
});
$('#sheet').addEventListener('click', e => { if(e.target.id === 'sheet'){ ui.sheet = null; ui.confirm = null; renderSheet(); } });

async function onFile(e){
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if(!f || !EDIT || !isMgr()) return;
  try{
    const p = await readPhoto(f);
    ui.crop = { w: p.w, h: p.h, img: p.img, pts: [], closed: false };
    openSheet('crop');
  }catch(err){ toast('Non riesco a leggere questa foto. Prova con un altro file.'); }
}
async function finishCrop(all){
  const cr = ui.crop; if(!cr) return;
  if(all){ cr.pts = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]; cr.closed = true; }
  if(!cr.closed || cr.pts.length < 3) return;
  const done = busy('Preparo il muro…'); await nextPaint();
  try{ await finishCrop0(cr); } finally { done(); }
}
async function finishCrop0(cr){
  const xs = cr.pts.map(p => p.x*cr.w), ys = cr.pts.map(p => p.y*cr.h);
  const x0 = Math.round(Math.min(...xs)), x1 = Math.round(Math.max(...xs));
  const y0 = Math.round(Math.min(...ys)), y1 = Math.round(Math.max(...ys));
  const cw = Math.max(20, x1 - x0), ch = Math.max(20, y1 - y0);
  const im = await loadImg(cr.img);
  const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch;
  const tg = tmp.getContext('2d');
  tg.drawImage(im, x0, y0, cw, ch, 0, 0, cw, ch);
  tg.globalCompositeOperation = 'destination-in';
  tg.beginPath();
  cr.pts.forEach((p,i) => { const px = p.x*cr.w - x0, py = p.y*cr.h - y0; if(i === 0) tg.moveTo(px,py); else tg.lineTo(px,py); });
  tg.closePath(); tg.fill();
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  g.fillStyle = '#c9c9c2'; g.fillRect(0, 0, cw, ch);
  g.drawImage(tmp, 0, 0);
  const img = c.toDataURL('image/jpeg', 0.86);
  const bo = BO(), pre = bo ? 'Settore ' : 'Muro ';
  let wn = secWalls().length + 1; while(S.walls.some(x => x.name === pre + wn)) wn++;
  const w = { id: uid(), name: pre + wn, w: cw, h: ch, img, circuits: [], activeCircuit: null };
  if(bo){ w.kind = 'sector'; w.locked = true; w.holds = []; }
  const circ = newCircuit(w); w.circuits.push(circ); w.activeCircuit = circ.id;
  S.walls.push(w); S.active = w.id; S.mode = 'edit'; ui.bLevel = 'sector'; ui.secOver = false;
  ui.sel = null; ui.move = false; ui.zoom = 1; ui.nextRole = 'start'; ui.crop = null; ui.sheet = null;
  touch(); render(); renderSheet();
}
document.addEventListener('change', e => { if(e.target && e.target.matches && e.target.matches('input[data-pick]')) onFile(e); });
document.addEventListener('change', e => { const t = e.target; if(t && t.classList && t.classList.contains('sname') && SB && ME && ME.role === 'gestore' && t.value.trim() !== ((Array.isArray(ui.staff) && (ui.staff.find(x => x.email === t.dataset.email) || {}).name) || '')) staffName(t.dataset.email, t.value); });
/* zoom a due dita (e ctrl+rotella su computer), centrato sul punto tra le dita */
function applyZoom(nz, fx, fy){
  const w = curWall(); if(!w) return;
  nz = clamp(nz, 1, 14); if(Math.abs(nz - ui.zoom) < 0.001) return;
  const box = $('#box'), st = $('#stage'), r = box.getBoundingClientRect();
  const px = fx - r.left, py = fy - r.top;
  const u = st.clientWidth ? (box.scrollLeft + px - st.offsetLeft)/st.clientWidth : 0.5;
  const v = st.clientHeight ? (box.scrollTop + py - st.offsetTop)/st.clientHeight : 0.5;
  ui.zoom = nz; fit();
  $('#app').classList.toggle('swipeok', newC() && !(ui.zoom > 1.02));
  box.scrollLeft = u*st.clientWidth + st.offsetLeft - px;
  box.scrollTop = v*st.clientHeight + st.offsetTop - py;
  const wallMode = EDIT && S.mode === 'wall';
  if((ui.draft.length || wallMode) && !ui.draftRaf) ui.draftRaf = requestAnimationFrame(() => { ui.draftRaf = 0;
    if(EDIT && S.mode === 'wall') renderStage(); else { const g = document.getElementById('draftg'); if(g) g.innerHTML = draftInner(w); } });
}
(function(){
  const box = $('#box');
  const dist = (a,b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  let pinch = null;
  box.addEventListener('touchstart', e => {
    if(e.touches.length === 2){
      const a = e.touches[0], b = e.touches[1];
      pinch = { d: dist(a,b) || 1, z: ui.zoom, mx: (a.clientX + b.clientX)/2, my: (a.clientY + b.clientY)/2 }; ui.pinchAt = Date.now();
    }
  }, { passive: true });
  box.addEventListener('touchmove', e => {
    if(pinch && e.touches.length === 2){
      e.preventDefault();
      const a = e.touches[0], b = e.touches[1];
      const mx = (a.clientX + b.clientX)/2, my = (a.clientY + b.clientY)/2;
      applyZoom(pinch.z * dist(a,b) / pinch.d, mx, my);
      /* mentre si disegna un dito disegna: la foto si sposta con due dita */
      if($('#stage').classList.contains('linedraw')){ box.scrollLeft -= mx - pinch.mx; box.scrollTop -= my - pinch.my; }
      pinch.mx = mx; pinch.my = my;
      ui.pinchAt = Date.now();
    }
  }, { passive: false });
  const end = e => { if(e.touches.length < 2){ if(pinch) ui.pinchAt = Date.now(); pinch = null; } };
  box.addEventListener('touchend', end, { passive: true });
  box.addEventListener('touchcancel', end, { passive: true });
  box.addEventListener('wheel', e => {
    if(e.ctrlKey){ e.preventDefault(); applyZoom(ui.zoom * Math.exp(-e.deltaY*0.01), e.clientX, e.clientY); }
  }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
})();
/* disegno della linea del boulder: si segue il dito sulla foto */
(function(){
  const st = $('#stage');
  const pt = e => { const w = curWall(), r = st.getBoundingClientRect(), k = w.w / r.width; return [clamp((e.clientX - r.left)*k, 0, w.w), clamp((e.clientY - r.top)*k, 0, w.h)]; };
  let drawing = false;
  st.addEventListener('pointerdown', e => { if(!ui.bline || !EDIT) return; drawing = true; ui.lineDraft = [pt(e)]; try{ st.setPointerCapture(e.pointerId); }catch(err){} e.preventDefault(); });
  st.addEventListener('pointermove', e => { if(!drawing) return; ui.lineDraft.push(pt(e)); renderStage(); e.preventDefault(); });
  const end = () => {
    if(!drawing) return; drawing = false;
    const w = curWall(), c = curCircuit();
    if(c && w && ui.lineDraft.length > 3){ c.line = cleanLine(ui.lineDraft, w.w); touch(); }
    ui.lineDraft = []; ui.pinchAt = Date.now(); render();
  };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
})();
/* contorno a mano libera: un dito che scorre disegna; un tocco semplice mette un punto (gestito dal click); due dita spostano */
(function(){
  const st = $('#stage');
  const pt = e => { const w = curWall(), r = st.getBoundingClientRect(), k = w.w / r.width; return [clamp(Math.round((e.clientX - r.left)*k), 0, w.w), clamp(Math.round((e.clientY - r.top)*k), 0, w.h)]; };
  let fh = null;   /* { id, x0, y0, base, pts, on } */
  const live = () => { const w = curWall(), g = document.getElementById('draftg'); if(w && g) g.innerHTML = draftInner(w); else renderStage(); };
  st.addEventListener('pointerdown', e => {
    if(ui.bline || !drawMode() || ui.busy) return;
    if(fh){ ui.draft = ui.draft.slice(0, fh.base); fh = null; live(); return; }   /* secondo dito: si annulla il tratto */
    fh = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: ui.draft.length, on: false, last: null };
  });
  st.addEventListener('pointermove', e => {
    if(!fh || e.pointerId !== fh.id) return;
    if(!fh.on){ if(Math.hypot(e.clientX - fh.x0, e.clientY - fh.y0) < 8) return; fh.on = true; try{ st.setPointerCapture(e.pointerId); }catch(err){} const w = curWall(), r = st.getBoundingClientRect(), k = w.w / r.width; ui.draft.push([Math.round((fh.x0 - r.left)*k), Math.round((fh.y0 - r.top)*k)]); fh.last = [fh.x0, fh.y0]; }
    if(Math.hypot(e.clientX - fh.last[0], e.clientY - fh.last[1]) < 3) return;
    fh.last = [e.clientX, e.clientY]; ui.draft.push(pt(e)); live(); e.preventDefault();
  });
  const end = e => {
    if(!fh || (e && e.pointerId !== fh.id)) return;
    const f = fh; fh = null;
    if(!f.on) return;   /* era un tocco: ci pensa il click */
    ui.pinchAt = Date.now();   /* niente punto in più dal click che segue */
    const w = curWall(); if(!w) return;
    const r = st.getBoundingClientRect(), px = w.w / r.width;
    /* il tratto si semplifica (scarto di circa un pixel e mezzo di schermo): niente seghettature del dito */
    const stroke = rdpPts(ui.draft.slice(f.base), px*1.5);
    ui.draft = ui.draft.slice(0, f.base).concat(stroke.map(q => [Math.round(q[0]), Math.round(q[1])]));
    const a = ui.draft[0], z = ui.draft[ui.draft.length-1];
    if(ui.draft.length >= 4 && Math.hypot(a[0]-z[0], a[1]-z[1]) <= px*22){
      ui.draft.pop();
      if(S.mode === 'wall') finishDraw(w); else { const c = curCircuit(); if(c) finishBDraw(w, c); }
      return;
    }
    render();
  };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
})();
$('#box').addEventListener('scroll', () => {
  const b = $('#box'), st = $('#stage');
  if(st.clientWidth > 0 && st.clientHeight > 0)
    ui.view = { u: (b.scrollLeft + b.clientWidth/2 - st.offsetLeft)/st.clientWidth, v: (b.scrollTop + b.clientHeight/2 - st.offsetTop)/st.clientHeight };
}, { passive: true });
if(window.ResizeObserver) new ResizeObserver(fit).observe($('#box')); else window.addEventListener('resize', fit);

/* ---------- avvio: prima si mostra la versione pubblicata, poi si abilita la modifica a chi può ---------- */
applyViewPrefs();
if(!curWall() && S.walls.length) S.active = S.walls[0].id;
render();
(async function initCaps(){
  try{
    const CFG = window.CIRCUITI_CFG || {};
    if(CFG.url && CFG.anonKey && window.supabase){
      SB = window.supabase.createClient(CFG.url, CFG.anonKey);
      renderTop();
      /* prima la copia salvata sul telefono (apertura immediata, anche offline), poi quella del database */
      try{
        const pub = await loadPub();
        if(pub && pub.data && Array.isArray(pub.data.walls) && (pub.rev || 0) >= S.rev && !S.walls.length){
          S.walls = pub.data.walls; S.active = pub.data.active || S.active; S.rev = pub.rev;
          S.prefs = Object.assign(S.prefs, pub.data.prefs || {}); applyViewPrefs();
          PUBREV = S.rev; PUBWALLS = S.walls;
          if(!curWall() && S.walls.length) S.active = S.walls[0].id;
          ui.fromCache = true; render();
        }
      }catch(e){}
      /* la versione pubblicata sul database vince su quella scritta nella pagina */
      try{
        const { data: row } = await SB.from('app_state').select('data,rev').eq('id', 1).maybeSingle();
        if(row && row.data && Array.isArray(row.data.walls)){ savePub(row.data, row.rev || 0); prunePhotos(row.data.walls); }
        if(row && row.data && Array.isArray(row.data.walls) && (row.rev || 0) >= S.rev && !(ui.fromCache && (row.rev || 0) === S.rev)){
          /* aperta dalla copia salvata: chi sta già guardando un settore ci resta */
          const keep = ui.fromCache && row.data.walls.some(w => w.id === S.active) ? S.active : null;
          S.walls = row.data.walls; S.active = keep || row.data.active || S.active; S.rev = row.rev;
          S.prefs = Object.assign(S.prefs, row.data.prefs || {}); applyViewPrefs();
          PUBREV = S.rev; PUBWALLS = S.walls;
          if(!curWall() && S.walls.length) S.active = S.walls[0].id;
          render();
        }
      }catch(e){}
      BASE = JSON.parse(JSON.stringify(S.walls));
      const { data: { session } } = await SB.auth.getSession();
      if(session){
        const { data: ok } = await SB.rpc('is_editor');
        if(ok){
          EDIT = true; REAL_EDIT = true;
          let role = 'tracciatore';
          try{ const r = await SB.rpc('my_role'); if(r && r.data) role = r.data; }catch(e){}
          ME = { email: (session.user && session.user.email) || '', role, uid: session.user && session.user.id };
          try{ const { data: st } = await SB.from('editors').select('email,name');
            if(Array.isArray(st)){ const me = st.find(x => (x.email || '').toLowerCase() === ME.email.toLowerCase()); if(me && me.name) ME.name = me.name;
              ui.staffNames = st.map(x => (x.name || '').trim()).filter(Boolean).sort(); } }catch(e){}
        }
        else if(loginIntent() === 'cliente'){
          CL = { id: session.user.id, email: session.user.email || '' };
        } else {
          /* accesso riuscito ma l'email non è nella lista Staff: si dice quale email, così il gestore può controllarla */
          ui.authEmail = (session.user && session.user.email) || '';
          toast(`Sei entrato come ${ui.authEmail}, ma questa email non è nello staff. Chiedi al gestore di aggiungere esattamente questo indirizzo (menu ⋮ → Staff), poi riapri l'app.`, 9000);
        }
      }
    }
  }catch(e){ EDIT = false; }
  if(EDIT){ await loadDraft(); S.mode = 'edit'; if(!curWall() && S.walls.length) S.active = S.walls[0].id; }
  if(SB && (CL || REAL_EDIT)) loadTicks().catch(() => {});
  if(SB && REAL_EDIT) loadTickSum();
  if(SB) try{ SB.auth.onAuthStateChange((ev, ses) => { if(ev === 'PASSWORD_RECOVERY' && ses){ if(!REAL_EDIT && !CL){ CL = { id: ses.user.id, email: ses.user.email || '' }; try{ localStorage.setItem('login-intent', 'cliente'); }catch(e){} } openSheet('setpass'); } }); }catch(e){}
  ui.ready = true;
  ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit());
  render();
  const fromLink = openFromLink();
  if(newC() && !fromLink && !welcomeSeen()){ ui.wIdx = 0; openSheet('welcome'); }
  /* aperta dalla notifica di una nuova segnalazione: il gestore va dritto all'elenco */
  if(/segnalazioni/.test(location.hash)){ history.replaceState(null, '', location.pathname + location.search);
    if(SB && ME && ME.role === 'gestore'){ ui.fbAll = false; ui.fb = null; openSheet('fblist'); loadFb(); } }
})();
})();

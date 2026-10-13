
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
    <div class="seg" id="modes" hidden>
      <button data-act="mode" data-v="edit">Traccia</button>
      <button data-act="mode" data-v="view">Guarda</button>
      <button data-act="mode" data-v="wall">Muro</button>
    </div>
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
const bTitleHtml = c => esc(bTitle(c)) + (c.name && diffOf(c) ? ` <span style="font-weight:600;color:var(--muted)">· ${esc(c.name)}</span>` : '');
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
const VIEW_KEYS = ['numbers', 'lines', 'others', 'dim'];
function applyViewPrefs(){
  let v = {};
  try{ v = JSON.parse(localStorage.getItem('view-prefs') || '{}') || {}; }catch(e){}
  Object.assign(S.prefs, { numbers: true, lines: false, others: true, dim: true }, v);
}
function saveViewPrefs(){ const v = {}; VIEW_KEYS.forEach(k => v[k] = !!S.prefs[k]); try{ localStorage.setItem('view-prefs', JSON.stringify(v)); }catch(e){} }   /* muri come sono pubblicati adesso */
let EDIT = false, SB = null, BASE = null, ME = null;
/* REAL_EDIT: l'account è dello staff. EDIT: in questo momento si modifica (falso se il gestore guarda "come cliente").
   ui.viewAs permette allo staff di vedere l'app come la vede un ruolo con meno permessi. */
let REAL_EDIT = false;
const isMgr = () => !ME || (ME.role === 'gestore' && ui.viewAs !== 'tracciatore' && ui.viewAs !== 'cliente');
const ui = { bline:false, lineDraft:[], view:null, pinchAt:0, trash:[], tool:'detect', draft:[], redraw:null, csel:null, busy:false, sel:null, move:false, nextRole:'start', zoom:1, sheet:null, confirm:null, imgUrl:null, ready:false, publishing:false, saveWarned:false, scan:null, nextHand:'L', crop:null };
try{ const f = JSON.parse(localStorage.getItem('circ-filters') || '{}'); ui.fAngle = f.a || ''; ui.fGrade = f.g || ''; ui.fFeet = f.f || ''; }catch(e){}
ui.section = 'circ'; ui.bLevel = 'sectors'; ui.bShow = 'on'; ui.bColor = ''; ui.lastSec = {};
try{ const f = JSON.parse(localStorage.getItem('boulder-ui') || '{}'); if(f.sec === 'boulder') ui.section = 'boulder'; ui.bShow = f.show || 'on'; ui.bColor = f.c || ''; ui.lastSec = f.last || {}; }catch(e){}
if(!DIFFS.some(d => d[0] === ui.bColor)) ui.bColor = '';
function saveBUI(){ try{ localStorage.setItem('boulder-ui', JSON.stringify({ sec: ui.section, show: ui.bShow, c: ui.bColor, last: ui.lastSec })); }catch(e){} }
function saveCF(){ try{ localStorage.setItem('circ-filters', JSON.stringify({ a: ui.fAngle || '', g: ui.fGrade || '', f: ui.fFeet || '' })); }catch(e){} }
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
const secWalls = () => S.walls.filter(w => secOf(w) === ui.section);
const curWall = () => { const l = secWalls(); return l.find(w => w.id === S.active) || l[0] || null; };
const BO = () => ui.section === 'boulder';
/* boulder, per chi guarda: tre livelli. 1) griglia dei settori, 2) settore con tutte le linee, 3) blocco a schermo intero */
const bView = () => BO() && (!EDIT || S.mode === 'view');
const bLv = () => BO() && !ui.full && !(EDIT && S.mode === 'wall');
const bGrid = () => bLv() && ui.bLevel === 'sectors' && (secWalls().length > 1 || (EDIT && isMgr() && secWalls().length > 0));
const bOver = () => bView() && !ui.full && !bGrid();
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
function renderBusy(){
  const el = document.getElementById('busy'); if(!el) return;
  const top = busyStack[busyStack.length - 1];
  const label = top ? top.label : (ui.scan ? (ui.scan.prep ? 'Preparo il riconoscimento…' : `Rilevamento automatico: ${Math.round(100 * ui.scan.i / Math.max(1, ui.scan.total))}%`) : '');
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
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4500);
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
    let setter = ''; try{ setter = localStorage.getItem('boulder-setter') || ''; }catch(e){}
    if(!setter && ME && ME.email) setter = ME.email.split('@')[0];
    return { id: uid(), name: '', color: NODIFF, holds: [], dateSet: todayISO(), ...(setter ? { setter } : {}) };
  }
  const used = w.circuits.map(c => c.color);
  const p = PALETTE.find(p => !used.includes(p[1])) || PALETTE[0];
  let n = w.circuits.length + 1; while(w.circuits.some(c => c.name === 'Circuito ' + n)) n++;
  const name = window.genCircuitName ? window.genCircuitName('', w.circuits.map(c => c.name)) : 'Circuito ' + n;
  return { id: uid(), name, color: p[1], holds: [] };
}
function roleFor(c){ return c && c.holds.length ? 'hold' : 'start'; }
/* mano della prossima presa: l'opposta dell'ultima segnata (si parte con la sinistra) */
function handFor(c){ const l = c && c.holds.length ? c.holds[c.holds.length-1].hand : null; return l === 'L' ? 'R' : 'L'; }

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
function loadScript(src){ return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = rej; document.head.appendChild(el); }); }
async function samInit(){
  if(sam.state === 'ready') return true;
  if(sam.state === 'failed') return false;
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
    }catch(e){ console.warn('SAM non disponibile', e); sam.state = 'failed'; return false; }
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
  if(!w || sam.state === 'failed') return;
  samInit().then(ok => { if(ok) samEmbed(w).catch(() => {}); });
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
  const r = straightCore(pts, nPix);
  if(r) return r;
  /* volumi con prese montate sul bordo: si prova sull'involucro convesso, se la forma è quasi convessa */
  const h = hullPts(pts);
  if(h.length < 3) return null;
  let HA = 0; h.forEach((q, i) => { const n2 = h[(i+1) % h.length]; HA += q[0]*n2[1] - n2[0]*q[1]; }); HA = Math.abs(HA)/2;
  if(!HA || nPix/HA < 0.72) return null;
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
    if(Math.abs(Math.abs(A2/2)/nPix - 1) < 0.07) return r;
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
async function samSegment(w, x, y, ts, strict){
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
  const ok = cands.filter(c => c.a > 6 && c.q > (strict ? 0.8 : 0.5));
  if(!ok.length) return null;
  ok.sort((a, b) => a.a - b.a);
  let base = ok.findIndex(c => c.k === 1); if(base < 0) base = 0;
  const step = Math.round(Math.log(ts || 1)/Math.log(1.35));
  const pi = Math.max(0, Math.min(ok.length-1, base + step));
  let pick = ok[pi];
  const trace = c => { const m = new Uint8Array(N), off = c.k*N; for(let i=0; i<N; i++) m[i] = md[off+i] > 0 ? 1 : 0; return maskToPoly(m, E.rw, E.rh, x*E.s, y*E.s); };
  let tr = trace(pick);
  if(!tr || tr.pts.length < 3) return null;
  if(strict && !tr.inside) return null;
  let st = straightPoly(tr.pts, tr.n);
  /* volume con due facce di luce diversa: la maschera scelta ne prende solo un pezzo frastagliato.
     Se una maschera più grande (fino a 5 volte) contiene il tocco ed è un poligono netto, si usa quella. */
  if(!st && !strict && (!ts || ts === 1)){
    for(let j = pi + 1; j < ok.length; j++){
      if(ok[j].a > pick.a*5) break;
      const t2 = trace(ok[j]); if(!t2 || !t2.inside) continue;
      const s2 = straightPoly(t2.pts, t2.n);
      if(s2){ tr = t2; st = s2; pick = ok[j]; break; }
    }
  }
  const simp = st || rdpPts(tr.pts, 0.9);
  if(simp.length < 3) return null;
  const k = 1/E.s, flat = [];
  simp.forEach(p => { flat.push(Math.round((p[0] + 0.5)*k), Math.round((p[1] + 0.5)*k)); });
  let A = 0, cx = 0, cy = 0;
  for(let i=0; i<simp.length; i++){ const a = simp[i], b = simp[(i+1) % simp.length], c = a[0]*b[1] - b[0]*a[1]; A += c; cx += (a[0]+b[0])*c; cy += (a[1]+b[1])*c; }
  if(Math.abs(A) < 1) return null;
  A /= 2; cx = (cx/(6*A) + 0.5)*k; cy = (cy/(6*A) + 0.5)*k;
  const area = Math.abs(A)*k*k;
  const solid = Math.abs(A) / (hullAreaFlat(simp.flat()) || 1);
  if(strict && solid < 0.6) return null;
  return { poly: flat, cx, cy, area, solid, score: pick.q, sam: true };
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
  if(sam.state !== 'failed'){
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
async function samAutoScan(w){
  const holds = (w.holds = w.holds || []);
  const maxArea = w.w * w.h * 0.008;
  ui.scan = { i: 0, total: 1, found: 0, stop: false, prep: true }; renderTools();
  try{ await samEmbed(w); }catch(e){ ui.scan = null; toast('Non riesco a preparare il riconoscimento su questa foto.'); render(); return; }
  const C = await samCandidates(w);
  const inAny = (x, y) => { for(let k = 0; k < holds.length; k++){ const p = holds[k].poly; if(p && inPoly(p, x, y)) return true; } return false; };
  let done = 0;
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
        try{ res = await samSegment(w, X, Y, 1, true); }catch(e){ res = null; }
        if(res && res.area > 90 && res.area < maxArea){
          const poly = res.poly;
          holds.push({ id: uid(), poly, x: res.cx, y: res.cy, sx: X, sy: Y, det: 1 }); ui.scan.found++; ok = true;
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
  const stopped = ui.scan.stop, found = ui.scan.found;
  ui.scan = null; touch(); render();
  toast(stopped ? `Fermato: ${found} nuove prese aggiunte.` : `Fatto: ${found} nuove prese trovate. Controlla e aggiungi a mano quelle mancanti.`);
}
async function autoDetectAll(w){
  if(!w || ui.scan || w.locked) return;
  const useSam = sam.state !== 'failed' && await samInit();
  if(useSam) return samAutoScan(w);
  const step = useSam ? Math.max(14, Math.round(Math.max(w.w, w.h) / 64)) : Math.max(14, Math.round(Math.max(w.w, w.h) / 85));
  const cols = Math.max(1, Math.floor(w.w / step)), rows = Math.max(1, Math.floor(w.h / step));
  const total = cols * rows;
  const holds = (w.holds = w.holds || []);
  const maxArea = w.w * w.h * 0.008;
  ui.scan = { i: 0, total: total * (useSam ? 1 : 2), found: 0, stop: false };
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
  ui.scan = null;
  touch(); render();
  toast(stopped ? `Fermato: ${found} nuove prese aggiunte.` : `Fatto: ${found} nuove prese trovate.`);
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
  cat.forEach((h,i) => {
    if(manual(h)) return;
    const f = ar[i]/W2, bw = bb[i][2]-bb[i][0], bh = bb[i][3]-bb[i][1];
    if(f < 1.2e-4 || f > 4.5e-3) out.add(i);
    else if(Math.max(bw,bh)/Math.max(1,Math.min(bw,bh)) > 3.6) out.add(i);
    else if(ar[i]/(hullAreaFlat(h.poly) || 1) < 0.62) out.add(i);
  });
  for(let i=0;i<cat.length;i++) for(let j=i+1;j<cat.length;j++){
    if(manual(cat[i]) || manual(cat[j])) continue;
    if(bb[i][2] < bb[j][0] || bb[j][2] < bb[i][0] || bb[i][3] < bb[j][1] || bb[j][3] < bb[i][1]) continue;
    if(inPoly(cat[i].poly, cat[j].x, cat[j].y) || inPoly(cat[j].poly, cat[i].x, cat[i].y)){ if(ar[i] >= ar[j]) out.add(i); if(ar[j] >= ar[i]) out.add(j); }
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
    const s = 140 / Math.max(w.w, w.h), bw = Math.max(8, Math.round(w.w*s)), bh = Math.max(8, Math.round(w.h*s));
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
function busyAt(m, x, y, r){
  if(!m) return 0;
  let t = 0, n = 0;
  for(let k=0;k<13;k++){
    const a = k*2.4, q = k === 0 ? 0 : Math.sqrt(k/12)*r*0.9;
    const px = Math.round((x + Math.cos(a)*q)*m.s), py = Math.round((y + Math.sin(a)*q)*m.s);
    if(px < 0 || py < 0 || px >= m.bw || py >= m.bh) continue;
    t += m.d[py*m.bw + px]; n++;
  }
  return n ? t/n : 0;
}
/* etichette: una o più bolle, ognuna tangente al contorno della presa.
   Si calcola per 72 direzioni il punto in cui una bolla tocca appena la presa; le bolle di una presa con più passaggi
   si mettono in fila lungo il contorno (fuse tra loro), scegliendo partenza e verso che coprono meno linee, prese ed etichette. */
function bubbleCost(x, y, br, gap, env){
  let cost = 0;
  if(x - br < 0 || y - br < 0 || x + br > env.W || y + br > env.H) cost += 6;
  const lim = br + gap;
  for(const q of env.shapes){
    if(q.bb.x0 - lim > x || q.bb.x1 + lim < x || q.bb.y0 - lim > y || q.bb.y1 + lim < y) continue;
    const d = polyDist(x, y, q.p); if(d < lim) cost += 3*(1 - d/lim) + (d === 0 ? 2 : 0);
  }
  for(const sg of env.segs){ const d = segDist(x, y, sg[0], sg[1], sg[2], sg[3]); if(d < lim) cost += 2.5*(1 - d/lim); }
  for(const b of env.badges){ const d = Math.hypot(x - b[0], y - b[1]); if(d < br*2.2) cost += 5*(1 - d/(br*2.2)); }
  return cost + 3*busyAt(env.busy, x, y, br);
}
function placeBubbles(h, W, br, gap, env, n){
  const own = holdPts(h, W), bb = holdBox(h, W), cx = (bb.x0+bb.x1)/2, cy = (bb.y0+bb.y1)/2, N = 72;
  const T = [];
  for(let k=0;k<N;k++){
    const a = -Math.PI/4 + k/N*Math.PI*2, dx = Math.cos(a), dy = Math.sin(a);
    const t0 = rayExit(own, cx, cy, dx, dy);
    let t = t0 + gap, x = cx + dx*t, y = cy + dy*t;
    /* si parte appoggiati al bordo e ci si allontana a piccoli passi finché la bolla è fuori: così resta tangente */
    for(let g=0; g<80 && polyDist(x, y, own) < br + gap; g++){ t += br*0.12; x = cx + dx*t; y = cy + dy*t; }
    /* poi la bolla rientra un po' dentro il contorno della presa (circa un terzo del raggio) */
    t -= br*0.32 + gap; x = cx + dx*t; y = cy + dy*t;
    T.push({ x, y, k, c: bubbleCost(x, y, br, gap, env) + (t - t0)/br*0.15 + Math.min(k, N-k)*0.007 });
  }
  if(n <= 1){ let best = T[0]; for(const p of T) if(p.c < best.c) best = p; return [best]; }
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
    /* le bolle si accavallano tra loro: si conta il costo di ognuna, non le loro sovrapposizioni reciproche */
    const cost = chain.reduce((t, p) => t + p.c, 0);
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
function circuitSVG(c, W, alpha, o){
  const segs = [], labels = [];
  const sw = Math.max(2, W*0.0028), hw = sw*0.5;
  const col = colOf(c), ha = haloOf(col);
  let s = `<g opacity="${alpha}">`;
  if(o.lines && c.holds.length > 1){
    const lw = Math.max(3, W*0.0032), P = q => q[0].toFixed(1)+','+q[1].toFixed(1);
    const st = c.holds.filter(h => h.role === 'start'), rest = c.holds.filter(h => h.role !== 'start');
    const paths = [];
    if(st.length >= 2 && rest.length){
      /* partenze a Y: ogni partenza raggiunge un punto d'incontro, da lì un solo tratto verso la prima presa */
      const mx = st.reduce((t,h) => t + h.x, 0)/st.length, my = st.reduce((t,h) => t + h.y, 0)/st.length, f = rest[0];
      const J = [mx + (f.x - mx)*0.45, my + (f.y - my)*0.45];
      st.forEach(h => paths.push([[h.x, h.y], J]));
      paths.push([J].concat(rest.map(h => [h.x, h.y])));
    } else paths.push(c.holds.map(h => [h.x, h.y]));
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
  if(starts.length > 1 && !o.boulder && !(o.lines && c.holds.some(h => h.role !== 'start'))){
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
    let col = !o.boulder && h.hand === 'L' ? S.prefs.handL : !o.boulder && h.hand === 'R' ? S.prefs.handR : base, ha = haloOf(col);
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
    /* contorni dei passaggi successivi: rientrano di una distanza fissa (poco più di due spessori di linea),
       così restano vicini al primo anche sulle prese grandi e sui volumi */
    const lvN = lv ? lv.n : gi, inset = lvN > 0 ? lvN*sw*2.6 : 0;
    const sc = (pl) => inset ? insetPoly(pl, inset) : pl;
    const rIn = rr0 => Math.max(rr0*0.5, rr0 - inset);
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
           `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    } else {
      const rr = rIn(h.r*W), rsw = Math.max(2, rr*0.10), rhw = rsw*0.55;
      s += `<circle cx="${h.x}" cy="${h.y}" r="${rr}" fill="none" stroke="${ha}" stroke-opacity=".55" stroke-width="${rsw+rhw*2}"/>`+
           `<circle cx="${h.x}" cy="${h.y}" r="${rr}" fill="none" stroke="${col}" stroke-width="${rsw}"/>`;
    }
    if(o.boulder && isStart(h)){
      markSegs(h, W, sCen, sw*2.2).forEach(q => { segs.push(q);
        s += `<line x1="${q[0].toFixed(1)}" y1="${q[1].toFixed(1)}" x2="${q[2].toFixed(1)}" y2="${q[3].toFixed(1)}" stroke="${ha}" stroke-opacity=".6" stroke-width="${sw*3.4}" stroke-linecap="round"/>`+
             `<line x1="${q[0].toFixed(1)}" y1="${q[1].toFixed(1)}" x2="${q[2].toFixed(1)}" y2="${q[3].toFixed(1)}" stroke="${col}" stroke-width="${sw*1.9}" stroke-linecap="round"/>`; });
      return;
    }
    let label = h.role === 'start' ? (starts.length > 1 && !o.boulder ? 'S' + (starts.indexOf(i)+1) : 'S') : h.role === 'top' ? 'T' : '';
    if(!label && o.numbers && h.role === 'hold'){
      if(gi < g.length - 1) return; /* il numero si mette una sola volta, sull'ultimo passaggio del gruppo */
      label = g.map(j => seqOf[j]).join(',');
    }
    if(label){
      if(lv && lv.lastSplit){ col = base; ha = haloOf(base); }
      /* presa con più passaggi: etichetta a capsula, un numero per passaggio nel colore della sua mano */
      const segs = g && g.length > 1 && o.numbers && h.role === 'hold' ? g.map(j => ({ n: seqOf[j], col: handCol(c.holds[j]) })) : null;
      labels.push({ h: lv ? c.holds[g[0]] : h, label, col, ha, segs });
    }
  });
  if(labels.length){
    const br = Math.max(W*0.018, 12), gap = Math.max(1.5, br*0.12);
    const shapes = [];
    const seen = new Set();
    c.holds.forEach(h => { const k = h.cid != null ? 'c'+h.cid : h.x+'_'+h.y; if(seen.has(k)) return; seen.add(k); const p = holdPts(h, W); shapes.push({ p, bb: holdBox(h, W), cid: h.cid, h }); });
    (o.obst || []).forEach(q => { if(q.poly && !c.holds.some(h => h.cid === q.id)) shapes.push({ p: q.poly, bb: holdBox(q, W) }); });
    const env = { W, H: o.H || 1e9, segs, badges: [], shapes: [], busy: o.busy || null };
    labels.forEach((L, li) => {
      env.shapes = shapes.filter(q => q.h !== L.h && !(q.cid != null && q.cid === L.h.cid));
      /* più passaggi: bolle fuse, una per passaggio, ognuna nel colore della sua mano e tangente alla presa */
      const ps = placeBubbles(L.h, W, br, gap, env, L.segs ? L.segs.length : 1);
      ps.forEach(p => env.badges.push([p.x, p.y]));
      const pos = ps[0];
      if(L.segs){
        const hw = br*0.22;
        s += ps.map(p => `<circle cx="${p.x}" cy="${p.y}" r="${br + hw/2}" fill="#ffffff" fill-opacity=".8"/>`).join('')+
             L.segs.map((g2, k) => `<circle cx="${ps[k].x}" cy="${ps[k].y}" r="${br - hw/2}" fill="${g2.col}"/>`).join('')+
             L.segs.map((g2, k) => { const nx = ps[k+1] ? ps[k].x - (ps[k+1].x - ps[k].x)*0.12 : ps[k].x, ny = ps[k+1] ? ps[k].y - (ps[k+1].y - ps[k].y)*0.12 : ps[k].y;
               return `<text x="${nx}" y="${ny}" dy=".35em" text-anchor="middle" font-family="Barlow Semi Condensed, Arial, sans-serif" font-weight="700" font-size="${br*(String(g2.n).length > 1 ? 0.95 : 1.15)}" fill="${inkOn(g2.col)}">${g2.n}</text>`; }).join('');
        return;
      }
      const bx = pos.x.toFixed(1), by = pos.y.toFixed(1);
      s += `<circle cx="${bx}" cy="${by}" r="${br}" fill="${L.col}" stroke="${L.ha}" stroke-opacity=".7" stroke-width="${br*0.22}"/>`+
           `<text x="${bx}" y="${by}" dy=".35em" text-anchor="middle" font-family="Barlow Semi Condensed, Arial, sans-serif" font-weight="700" font-size="${br*(L.label.length>1?(L.label.length>3?0.62:0.8):1.25)}" fill="${inkOn(L.col)}">${L.label}</text>`;
    });
  }
  return s + '</g>';
}
function draftSVG(w){
  if(!ui.draft.length) return '';
  const t = Math.max(2, w.w*0.0028), pts = ui.draft.map(q => q[0] + ',' + q[1]).join(' ');
  let s = `<polyline points="${pts}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="${t*3}" stroke-linejoin="round" stroke-linecap="round"/>`+
          `<polyline points="${pts}" fill="none" stroke="#ff3b7a" stroke-width="${t*1.4}" stroke-linejoin="round" stroke-linecap="round"/>`;
  ui.draft.forEach((q,i) => { s += `<circle cx="${q[0]}" cy="${q[1]}" r="${i === 0 ? t*2.4 : t*1.3}" fill="${i === 0 ? '#ff3b7a' : '#fff'}" stroke="#000" stroke-width="${t*0.55}"/>`; });
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
   - 2 o 3 tacche sulla stessa presa: escono a ventaglio e convergono verso un punto da quel lato;
   - 4 tacche sulla stessa presa: tutte parallele.
   La tacca parte appena fuori dal contorno, senza coprire la presa. */
function markSegs(h, W, C, off){
  const pts = holdPts(h, W), bb = holdBox(h, W), cx = (bb.x0+bb.x1)/2, cy = (bb.y0+bb.y1)/2;
  const n = Math.max(1, Math.min(4, (h.marks || []).length));
  const L = Math.max(W*0.03, 14);
  /* direzione: verso il centro delle partenze; se la presa è l'unica, dove ha toccato il tracciatore (o in basso) */
  let ux = 0, uy = 0;
  if(C && Math.hypot(C[0]-cx, C[1]-cy) > Math.max(bb.x1-bb.x0, bb.y1-bb.y0)*0.25){ ux = C[0]-cx; uy = C[1]-cy; }
  else (h.marks || []).forEach(m => { const dx = m[0]-cx, dy = m[1]-cy, l = Math.hypot(dx, dy); if(l > 1){ ux += dx/l; uy += dy/l; } });
  let ul = Math.hypot(ux, uy); if(ul < 1e-6){ ux = 0; uy = 1; ul = 1; }
  ux /= ul; uy /= ul;
  const vx = -uy, vy = ux;
  const exitAlong = (sx, sy, dx, dy) => { const t = rayExit(pts, sx, sy, dx, dy); return [sx + dx*t, sy + dy*t]; };
  if(n === 4){
    let lo = 1e9, hi = -1e9; for(let i=0;i<pts.length;i+=2){ const o = (pts[i]-cx)*vx + (pts[i+1]-cy)*vy; lo = Math.min(lo, o); hi = Math.max(hi, o); }
    const gapv = Math.min((hi - lo)*0.8/3, L*0.5), mid = (lo + hi)/2;
    return [-1.5, -0.5, 0.5, 1.5].map(k => {
      const sx = cx + vx*(mid + k*gapv), sy = cy + vy*(mid + k*gapv), e = exitAlong(sx, sy, ux, uy);
      return [e[0] + ux*off, e[1] + uy*off, e[0] + ux*(off + L), e[1] + uy*(off + L)];
    });
  }
  const e0 = exitAlong(cx, cy, ux, uy);
  if(n === 1) return [[e0[0] + ux*off, e0[1] + uy*off, e0[0] + ux*(off + L), e0[1] + uy*(off + L)]];
  /* 2-3 tacche: punto di convergenza davanti alla presa, tacche che partono dal contorno a ventaglio */
  const P = [e0[0] + ux*L*1.9, e0[1] + uy*L*1.9], th = 0.55, angs = n === 2 ? [-th, th] : [-th, 0, th];
  return angs.map(a => {
    const dx = ux*Math.cos(a) - uy*Math.sin(a), dy = uy*Math.cos(a) + ux*Math.sin(a), e = exitAlong(cx, cy, dx, dy);
    let px = P[0]-e[0], py = P[1]-e[1]; const pl = Math.hypot(px, py) || 1; px /= pl; py /= pl;
    const len = Math.min(L, pl - off - L*0.25);
    return [e[0] + px*off, e[1] + py*off, e[0] + px*(off + len), e[1] + py*(off + len)];
  });
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
  const key = JSON.stringify([guide.map(q => q.map(Math.round)), w.circuits.map(x => x.holds.length + ':' + (x.holds[0] ? Math.round(x.holds[0].x) : 0)), !!bm]);
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
      `<text x="${at[0]}" y="${at[1]}" dy=".35em" text-anchor="middle" font-family="Barlow Semi Condensed,Barlow,sans-serif" font-weight="700" font-size="${r*1.25}" fill="${inkOn(col)}">${c.num || '?'}</text></g>`;
  });
  return s + tags;
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
function sectorGrid(){
  return `<div class="sgrid">` + secWalls().map(w => {
    const on = w.circuits.filter(c => !isOff(c));
    const dots = DIFFS.map(d => { const n = on.filter(c => c.diff === d[0]).length; return n ? `<span class="sdot"><i style="background:${d[2]}"></i>${n}</span>` : ''; }).join('');
    let staff = '';
    if(EDIT){
      const last = on.map(c => c.dateSet || '').sort().pop();
      const t = todayISO(), lim = new Date(Date.now() + 7*864e5).toISOString().slice(0,10);
      const due = on.filter(c => c.dateRemoved && c.dateRemoved >= t && c.dateRemoved <= lim).length;
      staff = `<span class="sinfo">${last ? 'ultimo montaggio ' + fmtDate(last) : 'nessun montaggio'}${due ? `<br><b>${due} da smontare entro 7 giorni</b>` : ''}</span>`;
    }
    return `<button class="scard" data-act="opensec" data-id="${w.id}"><span class="sph"><img src="${esc(w.img)}" alt="" loading="lazy"></span>`+
      `<span class="sname">${esc(w.name)}</span><span class="sdots">${dots || '<small>nessun boulder</small>'}</span>${staff}</button>`;
  }).join('') + (EDIT && isMgr() ? `<div class="scard sadd"><span class="sname">+ Nuovo settore</span><span class="sinfo">Carica la foto del settore</span><div class="sbtns">${PICK_BTNS}</div></div>` : '') + `</div>`;
}
function overlay(w, o){
  if(o.wall){
    let s = ''; const t = Math.max(2, w.w*0.0028);
    const sus = catSuspects(w);
    (w.holds || []).forEach((h,i) => {
      const d = polyPath(h.poly), sel = i === ui.csel, col = sel ? '#ffd400' : sus.has(i) ? '#ff7a00' : '#ffffff', tw = Math.max(1, w.w*0.0013);
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
  if(o.others) visibleCircuits(w).forEach(c => { if(c !== act) s += circuitSVG(c, w.w, 0.28, {numbers:false, lines:false, boulder:bo, H: w.h}); });
  if(o.dim && act && act.holds.length){
    let d = `M0,0H${w.w}V${w.h}H0Z`;
    act.holds.forEach(h => {
      if(h.poly) d += polyPath(h.poly);
      else { const r = h.r*w.w; d += `M${h.x-r},${h.y}a${r},${r} 0 1,0 ${2*r},0a${r},${r} 0 1,0 ${-2*r},0Z`; }
    });
    s += `<path d="${d}" fill="#000" fill-opacity="${o.edit ? .5 : .62}" fill-rule="evenodd"/>`;
  }
  if(act && bo) s += lineSVG(act.line || autoLine(act, w), w.w, colOf(act), act);
  if(bo && ui.bline && ui.lineDraft.length > 1) s += lineSVG(ui.lineDraft, w.w, '#ff3b7a');
  if(act) s += circuitSVG(act, w.w, 1, Object.assign({}, o, { H: w.h, obst: w.holds || [], busy: busyMap(w) }));
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
  $('#wallName').textContent = bGrid() ? 'Settori' : w ? w.name : (BO() ? 'Nessun settore' : 'Nessun muro');
  $('#wallBtn').setAttribute('aria-label', BO() ? 'Scegli un settore' : 'Scegli un muro');
  const multi = secWalls().length > 1;
  $('#wallBtn').disabled = !EDIT && !multi && !SB;
  if((bView() && !EDIT) || bGrid()) $('#wallBtn').disabled = true;
  $('#chev').toggleAttribute('hidden', $('#wallBtn').disabled);
  $('#backBtn').hidden = !(bLv() && !bGrid() && (multi || (EDIT && isMgr())));
  $('#modes').hidden = !EDIT;
  $('#instBtn').hidden = EDIT || !canInstall();
  document.querySelectorAll('#modes button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.v === S.mode));
    b.disabled = !w || (b.dataset.v === 'edit' && !w.locked);
    b.hidden = b.dataset.v === 'wall' && (!isMgr() || BO());
  });
}
function renderViewbar(){
  const el = $('#viewbar'); if(!el) return;
  if(!REAL_EDIT || !ui.viewAs){ el.hidden = true; return; }
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
function dimOn(editing){ return editing ? !!ui.editDim : (!!ui.full || S.prefs.dim); }
function renderStage(){
  const w = curWall(), st = $('#stage'), em = $('#empty'), z = $('#zoom');
  if(!w){
    st.hidden = true; z.hidden = true; em.hidden = false;
    if(!ui.ready) em.innerHTML = `<p>Carico…</p>`;
    else if(BO() && EDIT && isMgr()) em.innerHTML = `<h1>Segna i boulder sulla foto del settore</h1><p>Carica la foto di un settore: poi tocca le prese di ogni boulder per contornarle, con partenza e arrivo.</p><div class="row">${PICK_BTNS}</div>`;
    else if(BO()) em.innerHTML = `<h1>Nessun settore pubblicato</h1><p>I boulder compariranno qui quando il gestore carica i settori.</p>`;
    else if(EDIT && isMgr()) em.innerHTML = `<h1>Traccia i circuiti sulla foto del muro</h1><p>Carica una foto, tocca le prese per segnarle e dai un colore a ogni circuito.</p><div class="row">${PICK_BTNS}</div>`;
    else em.innerHTML = `<h1>Nessun muro pubblicato</h1><p>I circuiti compariranno qui quando il gestore li pubblica.</p>`;
    return;
  }
  if(bGrid()){ st.hidden = true; z.hidden = true; em.hidden = false; em.innerHTML = sectorGrid(); return; }
  st.hidden = false; em.hidden = true; z.hidden = false;
  st.classList.toggle('edit', EDIT && S.mode !== 'view');
  const im = $('#photo');
  if(im.dataset.id !== w.id){ im.src = w.img; im.dataset.id = w.id; }
  const sv = $('#ov');
  sv.setAttribute('viewBox', `0 0 ${w.w} ${w.h}`);
  const editing = EDIT && S.mode === 'edit';
  sv.innerHTML = overlay(w, { over: bOver(), numbers: editing || S.prefs.numbers, lines: S.prefs.lines, others: S.prefs.others, edit: editing, dim: dimOn(editing), wall: EDIT && S.mode === 'wall' });
  fit();
}
function visibleCircuits(w){
  if(isSec(w)) return w.circuits.filter(c => (ui.bShow === 'all' || (ui.bShow === 'off') === isOff(c)) && (!ui.bColor || c.diff === ui.bColor));
  return w.circuits.filter(c => (!ui.fAngle || String(c.angle) === String(ui.fAngle)) && (!ui.fGrade || c.grade === ui.fGrade) && (!ui.fFeet || c.feet === ui.fFeet));
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
function circMeta(c){
  if(curWall() && isSec(curWall())) return bMeta(c);
  return [c.angle != null ? c.angle + '°' : '', c.style || '', c.feet ? 'piedi ' + c.feet : '', c.holds.length + (c.holds.length === 1 ? ' presa' : ' prese')].filter(Boolean).map(esc).join(' · ');
}
/* filtri dei boulder: stato (in parete / smontati / tutti), grado, colore delle prese */
function bFilters(w){
  const ds = DIFFS.filter(d => w.circuits.some(x => x.diff === d[0]));
  const st = (v, l) => `<button class="fchip ${ui.bShow === v ? 'on' : ''}" data-act="bshow" data-v="${v}">${l}</button>`;
  return `<div class="fchips">${st('on','In parete')}${st('off','Smontati')}${st('all','Tutti')}</div>`+
    (ds.length > 1 ? `<div class="fchips">${ds.map(d => `<button class="fdot ${ui.bColor === d[0] ? 'on' : ''}" data-act="bcolor" data-v="${d[0]}" aria-label="${d[1]}" aria-pressed="${ui.bColor === d[0]}" style="background:${d[2]}"></button>`).join('')}</div>` : '');
}
function bRows(w, cls){
  const act = bOver() ? null : curCircuit(), vis = sortedVisible(w);
  if(!vis.length) return `<p class="hint" style="padding:6px 2px">${w.circuits.length ? 'Nessun boulder con questi filtri.' : 'Ancora nessun boulder su questo settore.'}</p>`;
  return `<div class="list" style="gap:${cls === 'crow' ? 6 : 0}px;margin:0">` + vis.map(x => `<button class="${cls} ${act && x.id === act.id ? 'active' : ''} ${isOff(x) ? 'off' : ''}" data-act="pickc" data-id="${x.id}"><i class="dot" style="background:${x.color}"></i><span class="ctext" style="flex:1"><b>${bTitleHtml(x)}</b><small>${[x.style ? esc(x.style) : '', bMeta(x)].filter(Boolean).join(' · ')}</small></span></button>`).join('') + `</div>`;
}
function circFilters(w){
  if(!w.circuits.length) return '';
  const angles = [...new Set(w.circuits.map(x => x.angle).filter(x => x != null))].sort((x, y) => x - y);
  const grades = GRADES.filter(g => g && w.circuits.some(x => x.grade === g));
  const fa = v => `<button class="fchip ${String(ui.fAngle || '') === String(v) ? 'on' : ''}" data-act="fang" data-v="${v}">${v === '' ? 'Tutti' : v + '°'}</button>`;
  const inner = (angles.length ? fa('') + angles.map(fa).join('') : '')+
    (grades.length ? `<select id="fgrade" class="fsel" aria-label="Grado"><option value="">Tutti i gradi</option>${grades.map(g => `<option value="${g}" ${ui.fGrade === g ? 'selected' : ''}>${g}</option>`).join('')}</select>` : '')+feetSel(w);
  return inner ? `<div class="fchips">${inner}</div>` : '';
}
function circRows(w, cls){
  const act = curCircuit(), vis = sortedVisible(w);
  if(!vis.length) return `<p class="hint" style="padding:6px 2px">${w.circuits.length ? 'Nessun circuito con questi filtri.' : 'Ancora nessun circuito su questo muro.'}</p>`;
  return `<div class="list" style="gap:${cls === 'crow' ? 6 : 0}px;margin:0">` + vis.map(x => `<button class="${cls} ${act && x.id === act.id ? 'active' : ''}" data-act="pickc" data-id="${x.id}"><i class="dot" style="background:${colOf(x)}"></i><span class="ctext" style="flex:1"><b>${esc(x.name)}</b><small>${circMeta(x)}</small></span>${gradeBadge(x.grade)}</button>`).join('') + `</div>`;
}
function feetSel(w){
  if(!w.circuits.some(x => x.feet)) return '';
  return `<select id="ffeet" class="fsel" aria-label="Piedi"><option value="">Tutti i piedi</option>${[['liberi','Piedi liberi'],['obbligati','Piedi obbligati']].map(o => `<option value="${o[0]}" ${ui.fFeet === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
}
function renderChips(){
  const w = curWall(), el = $('#chips');
  if(!w || (EDIT && S.mode === 'wall')){ el.innerHTML = ''; return; }
  const act = curCircuit(), n = visibleCircuits(w).length, tot = w.circuits.length;
  if(isSec(w) && (!EDIT || S.mode === 'view')){
    el.innerHTML = (tot ? bFilters(w) : '') + bRows(w, 'lrow') +
      (n ? `<p class="hint" style="text-align:center;margin:8px 0 0;font-size:13px">Tocca una linea sulla foto, o un boulder qui, per aprirlo.</p>` : '');
    return;
  }
  if(!EDIT || S.mode === 'view'){
    el.innerHTML = circFilters(w) + circRows(w, 'lrow') +
      (n ? `<p class="hint" style="text-align:center;margin:8px 0 0;font-size:13px">Tocca un circuito per vederlo sul muro, tocca di nuovo per aprirlo a schermo intero.</p>` : '');
    return;
  }
  const filtered = !isSec(w) && (ui.fAngle || ui.fGrade || ui.fFeet) ? ` · filtrati ${n}/${tot}` : '';
  if(!act){
    el.innerHTML = `<div class="curbar"><span class="cinfo"><b>${isSec(w) ? 'Nessun boulder su questo settore' : 'Nessun circuito su questo muro'}</b></span>${EDIT ? `<button class="btn primary" data-act="addc">${isSec(w) ? '+ Nuovo boulder' : '+ Nuovo circuito'}</button>` : ''}</div>`;
    return;
  }
  el.innerHTML = `<div class="curbar">`+
    `<button class="cinfo" data-act="clist" aria-label="Elenco circuiti"><i class="dot" style="background:${colOf(act)}"></i>`+
    `<span class="ctext"><b>${isSec(w) ? bTitleHtml(act) : esc(act.name)}</b><small>${circMeta(act)}</small></span>${isSec(w) ? '' : gradeBadge(act.grade)}</button>`+
    (EDIT && S.mode === 'edit' ? `<button class="btn" data-act="cedit">Modifica</button>` : '')+
    `<button class="btn primary" data-act="clist">${isSec(w) ? `Boulder (${tot})` : `Circuiti (${tot})${filtered}`}</button></div>`;
}
function samStatus(w){
  const e = sam.emb[w.id];
  if(sam.state === 'failed') return 'Riconoscimento intelligente non disponibile su questo telefono: uso il metodo semplice.';
  if(sam.state === 'loading') return 'Scarico il riconoscimento intelligente (circa 33 MB, solo la prima volta)…';
  if(sam.state === 'ready' && e && !e.e) return 'Studio la foto del muro (qualche secondo)…';
  if(sam.state === 'ready' && e && e.e) return 'Riconoscimento intelligente pronto: tocca una presa.';
  return 'Riconoscimento intelligente: si attiva al primo uso.';
}
function renderTools(){
  renderBusy();
  const w = curWall(), c = curCircuit(), el = $('#tools');
  if(!w){ el.innerHTML = ''; return; }
  if(EDIT && S.mode === 'wall'){
    const n = (w.holds || []).length;
    if(ui.scan){
      const s = ui.scan, pct = Math.round(100 * s.i / s.total);
      el.innerHTML = `<p class="hint">${s.prep ? 'Preparo il riconoscimento intelligente…' : `Rilevamento automatico in corso${s.round ? ` (giro ${s.round})` : ''}: ${pct}% — ${s.found} nuove prese trovate finora. Può volerci qualche minuto: puoi fermarlo quando vuoi.`}</p>`+
        `<button class="btn primary" data-act="stopauto">Ferma</button>`;
      return;
    }
    if(w.locked){
      el.innerHTML = `<p class="hint">Muro bloccato: ${n} prese. Per modificarlo, sbloccalo.</p>`+
        `<button class="btn" data-act="unlock">Sblocca muro</button>`+
        `<button class="btn primary" data-act="tracing">Vai a Traccia</button>`;
      return;
    }
    const cs = ui.csel != null && (w.holds || [])[ui.csel];
    const drawing = ui.tool === 'draw', erasing = ui.tool === 'erase';
    const nsus = catSuspects(w).size;
    const tb = (v,l) => `<button data-act="tool" data-v="${v}" aria-pressed="${ui.tool === v}">${l}</button>`;
    let hint;
    if(drawing) hint = ui.redraw != null ? 'Ridisegna il contorno: tocca i punti attorno alla presa, poi Chiudi.' : 'Tocca i punti attorno alla presa (anche zoomando), poi Chiudi.';
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
      `<button class="btn" data-act="autoall">Rileva tutte le prese</button>`;
    if(drawing){
      h += `<button class="btn primary" data-act="closeDraw" ${ui.draft.length >= 3 ? '' : 'disabled'}>Chiudi</button>`+
           `<button class="btn" data-act="undoPt" ${ui.draft.length ? '' : 'disabled'}>Annulla punto</button>`+
           `<button class="btn" data-act="cancelDraw" ${ui.draft.length || ui.redraw != null ? '' : 'disabled'}>Annulla disegno</button>`;
    } else if(erasing){
      h += `<button class="btn" data-act="undel" ${ui.trash.length ? '' : 'disabled'}>Ripristina (${ui.trash.length})</button>`+
           `<button class="btn" data-act="susnext" ${nsus ? '' : 'disabled'}>Sospette (${nsus})</button>`;
    } else {
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
  if(!EDIT || S.mode === 'view'){
    const p = S.prefs;
    el.innerHTML = c ? `<div class="mini">`+
      (isSec(w) ? '' : `<button class="btn ${p.numbers ? 'on' : ''}" data-act="pref" data-k="numbers">Numeri</button>`+
      `<button class="btn ${p.lines ? 'on' : ''}" data-act="pref" data-k="lines">Linee</button>`)+
      `<button class="btn ${p.others ? 'on' : ''}" data-act="pref" data-k="others">${isSec(w) ? 'Altri boulder' : 'Altri circuiti'}</button>`+
      `<button class="btn ${p.dim ? 'on' : ''}" data-act="pref" data-k="dim">${isSec(w) ? 'Oscura settore' : 'Oscura muro'}</button>`+
      `</div>` : '';
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
    el.innerHTML = `<p class="hint">${h ? 'Ridisegna il contorno' : 'Disegna il contorno della presa'}: tocca i punti tutto intorno (puoi ingrandire), poi Chiudi o tocca di nuovo il primo punto.</p>`+
      (h ? '' : `<div class="trow"><div class="seg">${rb('start','Punto di partenza')}${rb('hold','Presa')}${rb('top','Arrivo')}</div></div>`)+
      `<div class="trow"><button class="btn primary" data-act="bclose" ${ui.draft.length >= 3 ? '' : 'disabled'}>Chiudi</button>`+
      `<button class="btn" data-act="bundo" ${ui.draft.length ? '' : 'disabled'}>Annulla punto</button>`+
      `<button class="btn" data-act="bcancel">Esci</button></div>`;
    return;
  }
  const roles = `<div class="seg" role="group" aria-label="Tipo di presa">${rb('start', sec ? 'Punto di partenza' : 'Partenza')}${rb('hold','Presa')}${rb('top','Arrivo')}</div>`;
  const hands = sec ? '' : `<div class="seg" role="group" aria-label="Mano">${hb('L',dot(S.prefs.handL)+'Sinistra')}${hb('R',dot(S.prefs.handR)+'Destra')}</div>`;
  const dimBtn = `<button class="btn ${ui.editDim ? 'on' : ''}" data-act="editdim" aria-pressed="${!!ui.editDim}">Oscura</button>`;
  if(h){
    /* presa selezionata: tutto ciò che la riguarda, e "Fatto" per tornare a segnare */
    el.innerHTML = `<p class="hint">${ui.move ? 'Tocca il punto dove spostarla.' : 'Presa selezionata: cambia tipo' + (sec ? '' : ' o mano') + ', contorno o posizione.'}</p>`+
      `<div class="trow">${roles}${hands}</div>`+
      `<div class="trow"><div class="seg"><button data-act="size" data-d="-1" aria-label="${lbl} più piccolo">${lbl} &minus;</button><button data-act="size" data-d="1" aria-label="${lbl} più grande">${lbl} +</button></div>`+
      `<button class="btn ${ui.move ? 'on' : ''}" data-act="move">Sposta</button>`+
      (sec ? `<button class="btn" data-act="bdraw">Ridisegna</button>` : `<button class="btn" data-act="dup" title="Aggiunge un passaggio sulla stessa presa con l'altra mano">Accoppia</button>`)+
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
  if(sec) hint += ` <span style="opacity:.75">${samStatus(w)}</span>`;
  el.innerHTML = `<p class="hint">${hint}</p>`+
    `<div class="trow">${roles}${hands}</div>`+
    `<div class="trow">`+
    (sec ? `<button class="btn" data-act="bdraw" ${c ? '' : 'disabled'}>Disegna a mano</button>` : '')+
    (sec ? `<button class="btn" data-act="bline" ${c ? '' : 'disabled'}>${c && c.line ? 'Rifai linea' : 'Linea'}</button>` : '')+
    (first ? '' : `<button class="btn" data-act="undo">Annulla ultima</button>`)+
    dimBtn+`</div>`;
}
/* regole delle modalità (Muro = preparazione delle prese, Traccia, Guarda):
   - i settori boulder non hanno la fase Muro;
   - un muro non ancora bloccato si prepara in Muro (il tracciatore, che non prepara muri, lo guarda soltanto) */
function normalizeMode(w){
  if(!EDIT || !w) return;
  if(isSec(w)){ if(S.mode === 'wall') S.mode = 'edit'; return; }
  if(!isMgr()){ if(S.mode === 'wall' || (!w.locked && S.mode === 'edit')) S.mode = 'view'; }
  else if(!w.locked && S.mode === 'edit') S.mode = 'wall';
}
/* il riconoscimento intelligente si prepara in anticipo dove servirà un tocco: Muro (non bloccato) e Traccia dei settori */
function needsSam(w){ return EDIT && w && ((!w.locked && S.mode === 'wall') || (isSec(w) && S.mode === 'edit')); }
function render(){
  const w = curWall();
  normalizeMode(w);
  if(needsSam(w) && sam.state !== 'failed' && !(sam.emb[w.id] && sam.emb[w.id].key === samKey(w))) samWarm(w);
  const viewing = !EDIT || S.mode === 'view';
  if(viewing && w && isSec(w)){ const v = sortedVisible(w); if(v.length && !v.some(x => x.id === w.activeCircuit)) w.activeCircuit = v[0].id; }
  if(ui.full && (!viewing || !curCircuit())) ui.full = false;
  $('#app').classList.toggle('full', !!ui.full);
  $('#app').classList.toggle('grid', bGrid());
  $('#app').classList.toggle('over', bOver());
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
    `<span class="ctext" style="flex:1"><b>${isSec(w) ? bTitleHtml(c) : esc(c.name)}${isSec(w) && c.style ? ` · ${esc(c.style)}` : ''}</b><small>${isSec(w) ? esc([c.setter ? 'di ' + c.setter : '', c.dateSet ? 'montato ' + fmtDate(c.dateSet) : '', c.dateRemoved ? (isOff(c) ? 'smontato ' : 'smonta ') + fmtDate(c.dateRemoved) : ''].filter(Boolean).join(' · ')) : circMeta(c)}</small></span>${isSec(w) ? '' : gradeBadge(c.grade)}</div>`+
    (isSec(w) && (c.tags || []).length ? `<div class="tags" style="margin:10px 0 0">${c.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : '')+
    (isSec(w) && c.notes ? `<p class="bnotes">${esc(c.notes)}</p>` : '')+
    `<div class="row" style="margin-top:10px;flex-wrap:nowrap">`+
    `<button class="btn" data-act="fnav" data-d="-1" ${i > 0 ? '' : 'disabled'} aria-label="Precedente">‹</button>`+
    `<button class="btn primary" data-act="fexit" style="flex:1">${isSec(w) ? 'Elenco boulder' : 'Elenco circuiti'}</button>`+
    `<button class="btn" data-act="fnav" data-d="1" ${i >= 0 && i < list.length - 1 ? '' : 'disabled'} aria-label="Successivo">›</button></div>`;
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
window.addEventListener('popstate', () => { if(ui.full){ ui.full = false; ui.zoom = 1; render(); } else if(bLv() && ui.bLevel === 'sector' && !(history.state && history.state.sec)){ ui.bLevel = 'sectors'; ui.zoom = 1; render(); } });

/* ---------- pannelli ---------- */
function openSheet(name){ ui.sheet = name; ui.confirm = null; renderSheet(); }
function renderSheet(){
  const el = $('#sheet'), card = $('#card');
  if(!ui.sheet){ el.hidden = true; card.innerHTML = ''; return; }
  const w = curWall(), c = curCircuit();
  let h = '';
  if(ui.sheet === 'circ' && c && EDIT && isSec(w)){
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
      `<label class="field">Tracciatore<input id="bsetter" value="${esc(c.setter || '')}" maxlength="40" autocomplete="off"></label>`+
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
  } else if(ui.sheet === 'wall'){
    const bo = BO();
    h = bo && EDIT ? `<h2>${w ? esc(w.name) : 'Settore'}</h2>` : `<h2>${bo ? 'Settori' : 'Muri'}</h2><div class="list">`+
      secWalls().map(x => `<button class="wrow ${w && x.id === w.id ? 'active' : ''}" data-act="pickw" data-id="${x.id}"><span>${esc(x.name)}</span><small>${bo ? x.circuits.filter(c => !isOff(c)).length + ' boulder' : x.circuits.length + ' circuiti'}</small></button>`).join('') +
      (secWalls().length ? '' : `<p class="note" style="margin:0">${bo ? 'Nessun settore ancora.' : 'Nessun muro ancora.'}</p>`) +
      `</div>`;
    if(EDIT){
      h += (w && isMgr() ? `<label class="field">${bo ? 'Nome del settore' : 'Nome del muro'}<input id="wname" value="${esc(w.name)}" maxlength="40"></label>` : '') +
        (w && !isMgr() && !w.locked ? `<p class="note" style="margin:0 0 12px">Questo muro è ancora in preparazione: potrai tracciarci quando il gestore lo blocca.</p>` : '') +
        (isMgr() && !bo ? `<div class="row">${PICK_BTNS}</div>` : '')+
        `<div class="row" style="margin-top:10px">` +
        (w && isMgr() ? `<button class="btn danger" data-act="delw">${ui.confirm === 'delw' ? 'Tocca ancora per eliminare' : bo ? 'Elimina settore' : 'Elimina muro'}</button>` : '') +
        `<button class="btn primary" data-act="close">Fatto</button></div>`+
        `<p class="note">Le modifiche restano su questo dispositivo finché non premi Pubblica. Se nel frattempo un altro tracciatore ha pubblicato, i suoi circuiti vengono tenuti e si aggiungono i tuoi.</p>`+
        (ME ? `<p class="note">Sei dentro come <b>${esc(ME.email)}</b> (${ME.role === 'gestore' ? 'gestore' : 'tracciatore'}).</p>` : '')+
        (SB ? `<div class="row" style="margin-top:10px">${ME && ME.role === 'gestore' ? `<button class="btn" data-act="staff">Staff</button>` : ''}<button class="btn" data-act="setpass">Imposta password</button><button class="btn" data-act="logout">Esci</button></div>` : '');
    } else {
      h += `<div class="row">${canInstall() ? `<button class="btn" data-act="install">Installa l'app</button>` : ''}${SB && !REAL_EDIT ? `<button class="btn" data-act="login">Accedi (staff)</button>` : ''}<button class="btn primary" data-act="close">Chiudi</button></div>`;
    }
  } else if(ui.sheet === 'menu'){
    const bo = w ? isSec(w) : BO(), n = w ? sortedVisible(w).length : 0, one = bo ? 'questo boulder' : 'questo circuito';
    const row = (act, label, sub, dis) => `<button class="wrow" data-act="${act}" ${dis ? 'disabled' : ''}><span>${label}</span><small>${sub || ''}</small></button>`;
    h = `<h2>Altro</h2><div class="list">`+
      row('printone', 'Stampa ' + one, c ? esc(blockTitle(w, c)) : '', !c)+
      row('printall', bo ? 'Stampa i boulder del settore' : 'Stampa i circuiti del muro', n ? n + (n === 1 ? ' pagina' : ' pagine') + ' · filtri compresi' : '', !n)+
      row('img', 'Condividi immagine', 'da salvare o mandare', !c)+
      (canInstall() ? row('install', "Installa l'app", 'sulla schermata Home') : '')+
      (REAL_EDIT ? `<div class="wrow" style="flex-direction:column;align-items:stretch;gap:8px"><span>Vedi l'app come</span><div class="seg" role="group" aria-label="Vedi come">`+
        (ME.role === 'gestore' ? [['gestore','Gestore'],['tracciatore','Tracciatore'],['cliente','Cliente']] : [['tracciatore','Tracciatore'],['cliente','Cliente']])
          .map(o => `<button data-act="viewas" data-v="${o[0]}" aria-pressed="${(ui.viewAs || ME.role) === o[0]}">${o[1]}</button>`).join('')+`</div></div>` : '')+
      (SB && !REAL_EDIT ? row('login', 'Accesso staff', '') : '')+
      (SB && REAL_EDIT ? row('logout', 'Esci', ME ? esc(ME.email) : '') : '')+
      `</div><p class="note" style="margin:0 0 12px">Dalla finestra di stampa puoi anche scegliere "Salva come PDF".</p>`+
      `<div class="row"><button class="btn primary" data-act="close">Chiudi</button></div>`;
  } else if(ui.sheet === 'install'){
    h = `<h2>Installa l'app</h2>`+
      (isIOS() ? `<p>Su iPhone:</p><ol style="margin:0 0 14px;padding-left:20px;line-height:1.6"><li>tocca <b>Condividi</b> (il quadrato con la freccia in su), in basso in Safari</li><li>scorri e scegli <b>Aggiungi alla schermata Home</b></li><li>tocca <b>Aggiungi</b></li></ol><p class="note" style="margin:0 0 12px">Funziona da Safari: se hai aperto il link da un'altra app, aprilo prima in Safari.</p>`
               : `<p>Apri il menu del browser (⋮ in alto a destra) e scegli <b>Installa app</b> oppure <b>Aggiungi a schermata Home</b>.</p>`)+
      `<div class="row"><button class="btn primary" data-act="close">Ok</button></div>`;
  } else if(ui.sheet === 'login'){
    h = `<h2>Accesso staff</h2>`+
      (ui.loginSent ? `<p>Ti ho mandato un'email con un link. Aprila da questo telefono e tocca il link: tornerai qui già dentro.</p>` :
      `<label class="field">La tua email<input id="lemail" type="email" autocomplete="email" inputmode="email" value="${esc(ui.loginEmail || '')}"></label>`+
      `<label class="field">Password<input id="lpass" type="password" autocomplete="current-password"></label>`)+
      `<div class="row">${ui.loginSent ? '' : `<button class="btn primary" data-act="passlogin">Entra</button><button class="btn" data-act="sendlink">Non ho la password: mandami un link</button>`}<button class="btn" data-act="close">Chiudi</button></div>`;
  } else if(ui.sheet === 'staff'){
    const list = ui.staff;
    h = `<h2>Staff</h2><p class="note" style="margin:0 0 12px">Chi è in questo elenco può creare e modificare muri e circuiti e pubblicarli. Solo il gestore gestisce l'elenco.</p>`+
      (list === null ? `<p>Carico…</p>` : list === 'err' ? `<p>Non riesco a leggere l'elenco. Hai eseguito l'ultimo aggiornamento del database?</p>` :
       `<div class="list">${list.map(p => `<div class="wrow"><span>${esc(p.email)}<br><small>${p.role === 'gestore' ? 'gestore' : 'tracciatore'}</small></span>${ME && p.email.toLowerCase() === ME.email.toLowerCase() ? '<small>tu</small>' : `<button class="btn danger" data-act="staffdel" data-email="${esc(p.email)}">${ui.confirm === 'staffdel:' + p.email ? 'Conferma' : 'Togli'}</button>`}</div>`).join('')}</div>`)+
      `<label class="field">Aggiungi tracciatore (email)<input id="semail" type="email" inputmode="email" autocomplete="off"></label>`+
      `<div class="row"><button class="btn primary" data-act="staffadd">Aggiungi</button><button class="btn" data-act="close">Chiudi</button></div>`+
      `<p class="note">Poi manda il link dell'app alla persona: tocca il nome del muro → <b>Accedi (staff)</b> → <b>Non ho la password: mandami un link</b>; una volta dentro, <b>Imposta password</b>.</p>`;
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
      `<div style="position:relative;overflow:hidden;line-height:0;border-radius:8px">`+
      `<img data-act="cropTap" src="${cr.img}" style="width:100%;height:auto;display:block;touch-action:none">`+
      `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">${shape}${dots}</svg>`+
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
  card.innerHTML = h;
  el.hidden = false;
}
/* foto del muro/settore con disegnato un blocco (per condividere e stampare) */
async function composeBlock(w, c, o){
  const keep = w.activeCircuit; w.activeCircuit = c.id;
  try{
    const photo = await loadImg(w.img);
    const inner = overlay(w, Object.assign({ numbers: S.prefs.numbers, lines: S.prefs.lines, others: S.prefs.others, edit: false, dim: S.prefs.dim }, o || {}));
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
        : [b.grade ? 'grado ' + b.grade : '', b.style, b.feet ? 'piedi ' + b.feet : '', b.angle != null ? b.angle + '°' : '', b.holds.length + ' prese'].filter(Boolean);
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
async function loadStaff(){
  ui.staff = null; renderSheet();
  const { data, error } = await SB.from('editors').select('email,role').order('email');
  ui.staff = error ? 'err' : (data || []);
  if(ui.sheet === 'staff') renderSheet();
}
async function staffAdd(){
  const inp = document.getElementById('semail'), email = ((inp && inp.value) || '').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email)){ toast('Scrivi un\'email valida.'); return; }
  const { error } = await SB.from('editors').insert({ email, role: 'tracciatore' });
  if(error){ toast(/duplicate/i.test(error.message || '') ? 'È già nello staff.' : 'Non riuscito: ' + error.message); return; }
  toast(email + ' aggiunto allo staff.'); loadStaff();
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
  const { error } = await SB.auth.signInWithPassword({ email, password });
  if(error){ toast(/invalid/i.test(error.message || '') ? 'Email o password non corrette. Se non hai ancora una password, usa il link.' : 'Accesso non riuscito: ' + error.message); return; }
  location.reload();
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
  const { error } = await SB.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if(error){ toast('Invio non riuscito: ' + (error.message || 'riprova tra poco.')); return; }
  ui.loginSent = true; renderSheet();
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
  location.reload();
}
/* passa al volo a vedere l'app come gestore, tracciatore o cliente (solo per lo staff; non cambia i permessi veri) */
function setViewAs(v){
  if(!REAL_EDIT || !ME) return;
  if(ME.role !== 'gestore' && v === 'gestore') return;
  ui.viewAs = v === ME.role ? null : v;
  EDIT = v !== 'cliente';
  S.mode = EDIT ? 'edit' : 'view';
  ui.sel = null; ui.csel = null; ui.move = false; ui.full = false; ui.draft = []; ui.bdraw = false; ui.sheet = null;
  renderSheet(); render();
  if(ui.viewAs) toast(v === 'cliente' ? 'Vedi l\'app come un cliente.' : 'Vedi l\'app come un tracciatore.');
}
async function publish(){
  if(!EDIT || !SB || ui.publishing || !dirty()) return;
  ui.publishing = true; renderPub();
  try{
    await saveNow();
    busy('Pubblico…'); await nextPaint();
    await publishRemote();   /* dopo il successo la pagina si ricarica sulla nuova versione */
  }catch(e){
    busyStack.length = 0; renderBusy();
    ui.publishing = false;
    toast('Pubblicazione non riuscita: ' + ((e && e.message) || 'riprova.'));
    renderPub();
  }
}

/* ---------- interazione ---------- */
$('#stage').addEventListener('click', async e => {
  const w = curWall(), c = curCircuit();
  if(w && bOver() && Date.now() - ui.pinchAt > 350){
    const r = e.currentTarget.getBoundingClientRect(), k = w.w / r.width;
    const hit = overviewHit(w, (e.clientX - r.left)*k, (e.clientY - r.top)*k, Math.min(22*k, w.w*0.06));
    if(hit){ w.activeCircuit = hit.id; save(); setFull(true); }
    return;
  }
  if(!EDIT || !w || S.mode === 'view' || ui.busy || ui.scan || ui.bline || Date.now() - ui.pinchAt < 350) return;
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
    c.holds.push({ x: ch.x, y: ch.y, sx: ch.sx || ch.x, sy: ch.sy || ch.y, r: S.prefs.r, role: ui.nextRole, ts: 1, poly: ch.poly.slice(), cid: ch.id, ...(ui.nextHand ? { hand: ui.nextHand } : {}) });
    ui.nextRole = 'hold';
    if(ui.nextHand === 'L') ui.nextHand = 'R'; else if(ui.nextHand === 'R') ui.nextHand = 'L';
    ui.sel = null; touch(); render(); return;
  }
  toast('Qui non c\'è una presa del muro. Per aggiungerla sblocca il muro nel tab Muro.');
});

/* azioni che può fare chiunque; tutte le altre richiedono di essere dello staff */
const PUBLIC_ACTS = ['opensec','bback','viewas','menu','printone','printall','logout','wall','pickw','pref','zoom','clist','pickc','fang','bshow','bcolor','fexit','fnav','sec','img','close','install','login','sendlink','passlogin'];
/* azioni riservate al gestore (preparazione dei muri e dei settori) */
const MGR_ACTS = ['lock','unlock','autoall','stopauto','delw','cropAll','cropTap','cropUndo','cropClose','cropReset','cropDone','panelReset','panelDone','tool','closeDraw','undoPt','cancelDraw','redraw','undel','susnext','staff','staffadd','staffdel'];
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if(!b || b.disabled) return;
  const a = b.dataset.act, w = curWall(), c = curCircuit();
  if(!EDIT && !PUBLIC_ACTS.includes(a)) return;
  if(!isMgr() && MGR_ACTS.includes(a)) return;
  switch(a){
    case 'mode': if(EDIT && !ui.scan && !(b.dataset.v === 'wall' && !isMgr())){ S.mode = b.dataset.v; ui.sel = null; ui.csel = null; ui.move = false; ui.draft = []; ui.bdraw = false; ui.bline = false; $('#stage').classList.remove('linedraw'); ui.redraw = null; ui.tool = 'detect'; render(); } break;
    case 'tool': ui.tool = b.dataset.v; ui.draft = []; ui.redraw = null; render(); break;
    case 'undel': if(w && ui.trash.length){ const ch = ui.trash.pop(); (w.holds = w.holds || []).push(ch); ui.csel = w.holds.length - 1; touch(); render(); } break;
    case 'susnext': {
      if(!w) break;
      const sus = [...catSuspects(w)].sort((a,b) => (w.holds[a].y - w.holds[b].y) || (w.holds[a].x - w.holds[b].x));
      if(!sus.length) break;
      const at = sus.indexOf(ui.csel);
      ui.csel = sus[(at + 1) % sus.length];
      render(); focusCat(w, w.holds[ui.csel]); break;
    }
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
    case 'cropUndo': if(ui.crop && !ui.crop.closed) { ui.crop.pts.pop(); renderSheet(); } break;
    case 'cropClose': if(ui.crop && ui.crop.pts.length >= 3) { ui.crop.closed = true; renderSheet(); } break;
    case 'cropReset': if(ui.crop){ ui.crop.pts = []; ui.crop.closed = false; renderSheet(); } break;
    case 'cropCancel': ui.crop = null; ui.sheet = null; renderSheet(); break;
    case 'login': ui.loginSent = false; openSheet('login'); break;
    case 'sendlink': sendLoginLink(); break;
    case 'passlogin': passLogin(); break;
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
      if(v === ui.section || ui.scan) break;
      const prev = curWall(); if(prev) ui.lastSec[ui.section] = prev.id;
      ui.section = v; ui.bLevel = 'sectors';
      const l = secWalls(), keep = l.find(x => x.id === ui.lastSec[v]) || l[0];
      if(keep) S.active = keep.id;
      ui.full = false; ui.sel = null; ui.csel = null; ui.move = false; ui.zoom = 1; ui.draft = []; ui.bdraw = false; ui.redraw = null; ui.tool = 'detect';
      if(EDIT && S.mode === 'wall' && v === 'boulder') S.mode = 'edit';
      ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit()); saveBUI(); render(); break;
    }
    case 'bshow': case 'bcolor':
      if(a === 'bshow') ui.bShow = b.dataset.v; else ui.bColor = ui.bColor === b.dataset.v ? '' : b.dataset.v;
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
    case 'opensec': S.active = b.dataset.id; ui.lastSec[ui.section] = b.dataset.id; saveBUI(); ui.bLevel = 'sector'; ui.zoom = 1; ui.sel = null; ui.move = false; ui.draft = []; ui.bdraw = false; ui.bline = false; ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit()); save(); try{ history.pushState({ sec: 1 }, ''); }catch(e){} render(); $('#box').scrollTop = 0; break;
    case 'bback': if(history.state && history.state.sec){ try{ history.back(); }catch(e){} } ui.bLevel = 'sectors'; ui.zoom = 1; render(); break;
    case 'img': makeImage(); break;
    case 'menu': openSheet('menu'); break;
    case 'viewas': setViewAs(b.dataset.v); break;
    case 'printone': printBlocks(false); break;
    case 'printall': printBlocks(true); break;
    case 'publish': publish(); break;
    case 'pref': S.prefs[b.dataset.k] = !S.prefs[b.dataset.k]; saveViewPrefs(); render(); break;
    case 'zoom': { const bx = $('#box').getBoundingClientRect(); applyZoom(ui.zoom * Math.pow(1.4, +b.dataset.d), bx.left + bx.width/2, bx.top + bx.height/2); break; }
    case 'clist': ui.confirm = null; openSheet('clist'); break;
    case 'fang': ui.fAngle = b.dataset.v; saveCF(); afterFilter(); break;
    case 'cedit': if(c && EDIT) openSheet('circ'); break;
    case 'pickc': {
      if(!w) break;
      const again = w.activeCircuit === b.dataset.id && b.classList.contains('lrow');
      w.activeCircuit = b.dataset.id; ui.sel = null; ui.move = false; ui.bdraw = false; ui.draft = []; ui.bline = false; $('#stage').classList.remove('linedraw'); ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit());
      ui.sheet = null; save(); renderSheet();
      if((again || bOver()) && (!EDIT || S.mode === 'view')) setFull(true); else render();
      break;
    }
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
        const nh = h.hand === 'L' ? 'R' : h.hand === 'R' ? 'L' : (ui.nextHand || 'L');
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
      if(h){ h.role = b.dataset.v; if(h.role !== 'start') delete h.marks; touch(); } else ui.nextRole = b.dataset.v;
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
    case 'pickw': if(ui.scan) break; S.active = b.dataset.id; ui.lastSec[ui.section] = b.dataset.id; saveBUI(); ui.full = false; ui.sel = null; ui.zoom = 1; ui.move = false; ui.sheet = null; save(); render(); renderSheet(); break;
    case 'delw':
      if(!w || !isMgr()) break;
      if(ui.confirm !== 'delw'){ ui.confirm = 'delw'; renderSheet(); break; }
      S.walls = S.walls.filter(x => x.id !== w.id);
      { const l = secWalls(); S.active = l[0] ? l[0].id : (S.walls[0] ? S.walls[0].id : null); }
      ui.sel = null; ui.sheet = null; ui.confirm = null; touch(); render(); renderSheet(); break;
    case 'close': ui.sheet = null; ui.confirm = null; renderSheet(); break;
    case 'install': ui.sheet = null; renderSheet(); doInstall(); break;
  }
});

document.addEventListener('input', e => {
  const c = curCircuit(), w = curWall();
  if(e.target.id === 'lemail'){ ui.loginEmail = e.target.value.trim(); return; }
  if(e.target.id === 'fgrade' || e.target.id === 'ffeet'){
    if(e.target.id === 'ffeet') ui.fFeet = e.target.value; else ui.fGrade = e.target.value;
    saveCF(); afterFilter(); return;
  }
  if(!EDIT) return;
  if(e.target.id === 'bsetter' && c){ const v = e.target.value.trim(); if(v) c.setter = v; else delete c.setter; try{ localStorage.setItem('boulder-setter', v); }catch(err){} renderChips(); touch(); }
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
  S.walls.push(w); S.active = w.id; S.mode = 'edit'; if(bo) ui.bLevel = 'sector';
  ui.sel = null; ui.move = false; ui.zoom = 1; ui.nextRole = 'start'; ui.crop = null; ui.sheet = null;
  touch(); render(); renderSheet();
}
document.addEventListener('change', e => { if(e.target && e.target.matches && e.target.matches('input[data-pick]')) onFile(e); });
/* zoom a due dita (e ctrl+rotella su computer), centrato sul punto tra le dita */
function applyZoom(nz, fx, fy){
  const w = curWall(); if(!w) return;
  nz = clamp(nz, 1, 14); if(Math.abs(nz - ui.zoom) < 0.001) return;
  const box = $('#box'), st = $('#stage'), r = box.getBoundingClientRect();
  const px = fx - r.left, py = fy - r.top;
  const u = st.clientWidth ? (box.scrollLeft + px - st.offsetLeft)/st.clientWidth : 0.5;
  const v = st.clientHeight ? (box.scrollTop + py - st.offsetTop)/st.clientHeight : 0.5;
  ui.zoom = nz; fit();
  box.scrollLeft = u*st.clientWidth + st.offsetLeft - px;
  box.scrollTop = v*st.clientHeight + st.offsetTop - py;
}
(function(){
  const box = $('#box');
  const dist = (a,b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  let pinch = null;
  box.addEventListener('touchstart', e => {
    if(e.touches.length === 2){
      const a = e.touches[0], b = e.touches[1];
      pinch = { d: dist(a,b) || 1, z: ui.zoom }; ui.pinchAt = Date.now();
    }
  }, { passive: true });
  box.addEventListener('touchmove', e => {
    if(pinch && e.touches.length === 2){
      e.preventDefault();
      const a = e.touches[0], b = e.touches[1];
      applyZoom(pinch.z * dist(a,b) / pinch.d, (a.clientX + b.clientX)/2, (a.clientY + b.clientY)/2);
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
      /* la versione pubblicata sul database vince su quella scritta nella pagina */
      try{
        const { data: row } = await SB.from('app_state').select('data,rev').eq('id', 1).maybeSingle();
        if(row && row.data && Array.isArray(row.data.walls) && (row.rev || 0) >= S.rev){
          S.walls = row.data.walls; S.active = row.data.active || S.active; S.rev = row.rev;
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
          ME = { email: (session.user && session.user.email) || '', role };
        }
        else toast('Questo account non ha i permessi di modifica.');
      }
    }
  }catch(e){ EDIT = false; }
  if(EDIT){ await loadDraft(); S.mode = 'edit'; if(!curWall() && S.walls.length) S.active = S.walls[0].id; }
  ui.ready = true;
  ui.nextRole = roleFor(curCircuit()); ui.nextHand = handFor(curCircuit());
  render();
})();
})();

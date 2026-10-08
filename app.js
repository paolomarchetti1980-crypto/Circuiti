
(function(){
'use strict';

/* ---- Documento: la pagina rigenera se stessa a partire dallo stato (mai dal DOM) ---- */
const HEAD = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Circuiti sul muro</title><link href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">';
const BODY = `
<div id="app">
  <header class="top">
    <button class="wallbtn" id="wallBtn" data-act="wall" aria-label="Scegli un muro">
      <span id="wallName">Nessun muro</span>
      <svg id="chev" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="seg" id="modes" hidden>
      <button data-act="mode" data-v="edit">Traccia</button>
      <button data-act="mode" data-v="view">Guarda</button>
      <button data-act="mode" data-v="wall">Muro</button>
    </div>
  </header>
  <div class="pubbar" id="pubbar" hidden>
    <span>Modifiche non pubblicate</span>
    <button class="btn primary" id="pubBtn" data-act="publish">Pubblica</button>
  </div>
  <div class="stagewrap">
    <div id="box">
      <div id="empty" class="empty" hidden></div>
      <div id="stage" hidden>
        <img id="photo" alt="Foto del muro" draggable="false">
        <svg id="ov" xmlns="http://www.w3.org/2000/svg" aria-label="Circuiti tracciati sul muro"></svg>
      </div>
    </div>
    <div class="zoom" id="zoom" hidden>
      <button data-act="zoom" data-d="1" aria-label="Ingrandisci">+</button>
      <button data-act="zoom" data-d="-1" aria-label="Riduci">&minus;</button>
    </div>
  </div>
  <footer class="dock">
    <div class="chips" id="chips"></div>
    <div class="tools" id="tools"></div>
  </footer>
</div>
<div class="sheet" id="sheet" hidden><div class="card" id="card"></div></div>
<div class="toast" id="toast" hidden></div>
<input type="file" id="file" accept="image/*" class="vhfile" tabindex="-1">
<input type="file" id="cam" accept="image/*" capture="environment" class="vhfile" tabindex="-1">
<div class="camwrap" id="camWrap" hidden>
  <video id="camVideo" playsinline autoplay muted></video>
  <div class="camBar">
    <button class="btn big" data-act="camCancel">Annulla</button>
    <button class="btn primary big" data-act="camShot">Scatta</button>
  </div>
</div>
`;
document.getElementById('root').innerHTML = BODY;

const $ = s => document.querySelector(s);
const PALETTE = [['Giallo','#f2c200'],['Arancio','#ff7a1a'],['Rosso','#e5312b'],['Rosa','#ff5fa2'],['Viola','#8a4dff'],
                 ['Blu','#1e6bff'],['Azzurro','#22c3e6'],['Verde','#23b45a'],['Bianco','#ffffff'],['Nero','#111111']];
const GRADES = ['','3','4','5a','5b','5c','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c'];
const STYLES = ['','Equilibrio','Dinamico','Forza','Tecnico','Resistenza','Coordinazione','Tacche','Svasi','Volumi'];
const ANGLES = Array.from({length:41}, (_,i) => i);

let seed = {};
try{ seed = JSON.parse(document.getElementById('seed').textContent) || {}; }catch(e){}
const S = {
  walls: Array.isArray(seed.walls) ? seed.walls : [],
  active: seed.active || null,
  rev: seed.rev || 0,
  mode: 'view',
  prefs: Object.assign({ numbers:false, lines:false, others:true, dim:true, handL:'#e5312b', handR:'#111111', r:0.03 }, seed.prefs || {})
};
let PUBREV = S.rev;
let SEEDWALLS = S.walls;
let EDIT = false, ART = null, SB = null;
const ui = { view:null, pinchAt:0, trash:[], tool:'detect', draft:[], redraw:null, csel:null, busy:false, warnedRing:false, sel:null, move:false, nextRole:'start', zoom:1, sheet:null, confirm:null, imgUrl:null, ready:false, publishing:false, saveWarned:false, scan:null, nextHand:'', crop:null };

const uid = () => Math.random().toString(36).slice(2,9);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lum = h => { const n = parseInt(h.slice(1),16); return (0.2126*(n>>16&255)+0.7152*(n>>8&255)+0.0722*(n&255))/255; };
const haloOf = c => lum(c) < 0.3 ? '#ffffff' : '#000000';
const inkOn = c => lum(c) > 0.6 ? '#111111' : '#ffffff';
const curWall = () => S.walls.find(w => w.id === S.active) || S.walls[0] || null;
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
function buildDoc(){
  const data = JSON.stringify(snapshot()).replace(/</g, '\\u003c');
  return '<!DOCTYPE html>\n<html lang="it"><head>' + HEAD +
    '<style id="css">' + document.getElementById('css').textContent + '</style></head><body><div id="root"></div>' +
    '<script type="application/json" id="seed">' + data + '</' + 'script>' +
    '<script id="app-js">' + document.getElementById('app-js').textContent + '</' + 'script></body></html>';
}

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
      S.prefs = Object.assign(S.prefs, d.prefs || {});
    }
  }catch(e){}
  /* il catalogo pubblicato più di recente vince sempre, anche se la bozza locale è più "nuova" di orario */
  S.walls.forEach(w => upgradeCatalog(w, SEEDWALLS.find(x => x.id === w.id)));
  /* muri già pubblicati che la bozza locale non conosce ancora (es. aggiunti da un'altra sessione) */
  SEEDWALLS.forEach(sw => { if(!S.walls.some(w => w.id === sw.id)) S.walls.push(sw); });
}
async function saveNow(){
  if(!EDIT) return;
  try{
    const db = await openDB();
    await new Promise((res,rej) => {
      const tx = db.transaction('kv','readwrite');
      tx.objectStore('kv').put(snapshot(), 'draft');
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }catch(e){
    if(!ui.saveWarned){ ui.saveWarned = true; toast('Bozza locale non disponibile: pubblica per non perdere le modifiche.'); }
  }
}
let saveTimer;
function save(){ if(!EDIT) return; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
function touch(){ S.rev = Math.max(Date.now(), S.rev + 1); save(); }

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
const loadImg = src => new Promise((res,rej) => { const i = new Image(); if(!/^data:/.test(src)) i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
function newCircuit(w){
  const used = w.circuits.map(c => c.color);
  const p = PALETTE.find(p => !used.includes(p[1])) || PALETTE[0];
  return { id: uid(), name: p[0], color: p[1], holds: [] };
}
function roleFor(c){ return c && c.holds.length ? 'hold' : 'start'; }

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
  const sg = await Promise.race([getSeg(w), new Promise(r => setTimeout(() => r(null), 6000))]); if(!sg) return null;
  try{ return sg.segment(x, y, ts || 1, strict); }catch(e){ return null; }
}
async function autoDetectAll(w){
  if(!w || ui.scan || w.locked) return;
  const step = Math.max(14, Math.round(Math.max(w.w, w.h) / 85));
  const cols = Math.max(1, Math.floor(w.w / step)), rows = Math.max(1, Math.floor(w.h / step));
  const total = cols * rows;
  const holds = (w.holds = w.holds || []);
  const maxArea = w.w * w.h * 0.008;
  ui.scan = { i: 0, total: total * 2, found: 0, stop: false };
  renderTools();
  let idx = 0;
  /* due passate: 1) tentativo unico, il piu' severo possibile; 2) solo sui buchi rimasti, piu' permissiva (rischia qualche fusione in cambio di piu' prese) */
  for(const level of [2, 1]){
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
        if(idx % 30 === 0){ renderTools(); await new Promise(r => setTimeout(r, 0)); }
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
  cat.forEach((h,i) => {
    const f = ar[i]/W2, bw = bb[i][2]-bb[i][0], bh = bb[i][3]-bb[i][1];
    if(f < 1.2e-4 || f > 4.5e-3) out.add(i);
    else if(Math.max(bw,bh)/Math.max(1,Math.min(bw,bh)) > 3.6) out.add(i);
    else if(ar[i]/(hullAreaFlat(h.poly) || 1) < 0.62) out.add(i);
  });
  for(let i=0;i<cat.length;i++) for(let j=i+1;j<cat.length;j++){
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
function circuitSVG(c, W, alpha, o){
  const sw = Math.max(2, W*0.0028), hw = sw*0.5;
  const col = c.color, ha = haloOf(col);
  let s = `<g opacity="${alpha}">`;
  if(o.lines && c.holds.length > 1){
    const p = c.holds.map(h => h.x.toFixed(1)+','+h.y.toFixed(1)).join(' ');
    const lw = Math.max(3, W*0.0032);
    s += `<polyline points="${p}" fill="none" stroke="${ha}" stroke-opacity=".5" stroke-width="${lw*2.6}" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<polyline points="${p}" fill="none" stroke="${col}" stroke-width="${lw}" stroke-dasharray="${lw*3} ${lw*2.2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const base = c.color;
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
  if(starts.length > 1){
    const p = starts.map(i => c.holds[i].x.toFixed(1)+','+c.holds[i].y.toFixed(1)).join(' ');
    const lw = Math.max(3, W*0.0032);
    s += `<polyline points="${p}" fill="none" stroke="${ha}" stroke-opacity=".6" stroke-width="${lw*2.2}" stroke-linecap="round"/>`+
         `<polyline points="${p}" fill="none" stroke="${base}" stroke-width="${lw*0.85}" stroke-dasharray="${lw*1.4} ${lw*1.4}" stroke-linecap="round"/>`;
  }
  c.holds.forEach((h,i) => {
    const col = h.hand === 'L' ? S.prefs.handL : h.hand === 'R' ? S.prefs.handR : base, ha = haloOf(col);
    const key = h.cid != null ? ('c'+h.cid) : ('p'+Math.round(h.x)+'_'+Math.round(h.y));
    const g = h.role === 'hold' ? grp[key] : null, gi = g ? g.indexOf(i) : 0;
    const scale = gi > 0 ? Math.max(0.58, 1 - gi*0.22) : 1;
    if(h.poly){
      const poly = scale < 1 ? h.poly.map((v,k) => k % 2 === 0 ? h.x + (v-h.x)*scale : h.y + (v-h.y)*scale) : h.poly;
      const d = polyPath(poly);
      s += `<path d="${d}" fill="${col}" fill-opacity=".26" stroke="${ha}" stroke-opacity=".55" stroke-width="${sw+hw*2}" stroke-linejoin="round"/>`+
           `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    } else {
      const rr = h.r*W*scale, rsw = Math.max(2, rr*0.10), rhw = rsw*0.55;
      s += `<circle cx="${h.x}" cy="${h.y}" r="${rr}" fill="none" stroke="${ha}" stroke-opacity=".55" stroke-width="${rsw+rhw*2}"/>`+
           `<circle cx="${h.x}" cy="${h.y}" r="${rr}" fill="none" stroke="${col}" stroke-width="${rsw}"/>`;
    }
    let label = h.role === 'start' ? (starts.length > 1 ? 'S' + (starts.indexOf(i)+1) : 'S') : h.role === 'top' ? 'T' : '';
    if(!label && o.numbers && h.role === 'hold'){
      if(gi < g.length - 1) return; /* il numero si mette una sola volta, sull'ultimo passaggio del gruppo */
      label = g.map(j => seqOf[j]).join(',');
    }
    if(label){
      const bb = holdBox(h, W), br = Math.max(W*0.018, 12), bx = bb.x1, by = bb.y0;
      s += `<circle cx="${bx}" cy="${by}" r="${br}" fill="${col}" stroke="${ha}" stroke-opacity=".7" stroke-width="${br*0.22}"/>`+
           `<text x="${bx}" y="${by}" dy=".35em" text-anchor="middle" font-family="Barlow Semi Condensed, Arial, sans-serif" font-weight="700" font-size="${br*(label.length>1?0.8:1.25)}" fill="${inkOn(col)}">${label}</text>`;
    }
  });
  return s + '</g>';
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
    if(ui.draft.length){
      const pts = ui.draft.map(q => q[0] + ',' + q[1]).join(' ');
      s += `<polyline points="${pts}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="${t*3}" stroke-linejoin="round" stroke-linecap="round"/>`+
           `<polyline points="${pts}" fill="none" stroke="#ff3b7a" stroke-width="${t*1.4}" stroke-linejoin="round" stroke-linecap="round"/>`;
      ui.draft.forEach((q,i) => { s += `<circle cx="${q[0]}" cy="${q[1]}" r="${i === 0 ? t*2.4 : t*1.3}" fill="${i === 0 ? '#ff3b7a' : '#fff'}" stroke="#000" stroke-width="${t*0.55}"/>`; });
    }
    return s;
  }
  const act = w.circuits.find(c => c.id === w.activeCircuit) || w.circuits[0];
  let s = '';
  if(o.others) w.circuits.forEach(c => { if(c !== act) s += circuitSVG(c, w.w, 0.28, {numbers:false, lines:false}); });
  if(o.dim && act && act.holds.length){
    let d = `M0,0H${w.w}V${w.h}H0Z`;
    act.holds.forEach(h => {
      if(h.poly) d += polyPath(h.poly);
      else { const r = h.r*w.w; d += `M${h.x-r},${h.y}a${r},${r} 0 1,0 ${2*r},0a${r},${r} 0 1,0 ${-2*r},0Z`; }
    });
    s += `<path d="${d}" fill="#000" fill-opacity=".58" fill-rule="evenodd"/>`;
  }
  if(act) s += circuitSVG(act, w.w, 1, o);
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
  $('#wallName').textContent = w ? w.name : 'Nessun muro';
  const multi = S.walls.length > 1;
  $('#wallBtn').disabled = !EDIT && !multi && !SB;
  $('#chev').hidden = !EDIT && !multi && !SB;
  $('#modes').hidden = !EDIT;
  document.querySelectorAll('#modes button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.v === S.mode));
    b.disabled = !w || (b.dataset.v === 'edit' && !w.locked);
  });
}
function renderPub(){
  const d = dirty();
  $('#pubbar').hidden = !d;
  const b = $('#pubBtn');
  b.disabled = ui.publishing;
  b.textContent = ui.publishing ? 'Pubblico…' : 'Pubblica';
}
function renderStage(){
  const w = curWall(), st = $('#stage'), em = $('#empty'), z = $('#zoom');
  if(!w){
    st.hidden = true; z.hidden = true; em.hidden = false;
    if(!ui.ready) em.innerHTML = `<p>Carico…</p>`;
    else if(EDIT) em.innerHTML = `<h1>Traccia i circuiti sulla foto del muro</h1><p>Carica una foto, tocca le prese per segnarle e dai un colore a ogni circuito.</p><div class="row">${PICK_BTNS}</div>`;
    else em.innerHTML = `<h1>Nessun muro pubblicato</h1><p>I circuiti compariranno qui quando il gestore li pubblica.</p>`;
    return;
  }
  st.hidden = false; em.hidden = true; z.hidden = false;
  st.classList.toggle('edit', EDIT && S.mode !== 'view');
  const im = $('#photo');
  if(im.dataset.id !== w.id){ im.src = w.img; im.dataset.id = w.id; }
  const sv = $('#ov');
  sv.setAttribute('viewBox', `0 0 ${w.w} ${w.h}`);
  const editing = EDIT && S.mode === 'edit';
  sv.innerHTML = overlay(w, { numbers: editing || S.prefs.numbers, lines: S.prefs.lines, others: S.prefs.others, edit: editing, dim: !editing && S.prefs.dim, wall: EDIT && S.mode === 'wall' });
  fit();
}
function renderChips(){
  const w = curWall(), el = $('#chips');
  if(!w || (EDIT && S.mode === 'wall')){ el.innerHTML = ''; return; }
  const act = curCircuit();
  el.innerHTML = w.circuits.map(c =>
    `<button class="chip ${act && c.id === act.id ? 'active' : ''}" data-act="circ" data-id="${c.id}">`+
    `<i class="dot" style="background:${c.color}"></i><span class="nm">${esc(c.name)}${c.grade ? ' · '+esc(c.grade) : ''}</span><span class="n">${c.holds.length}</span></button>`
  ).join('') + (EDIT ? `<button class="chip add" data-act="addc">+ Circuito</button>` : '');
}
function renderTools(){
  const w = curWall(), c = curCircuit(), el = $('#tools');
  if(!w){ el.innerHTML = ''; return; }
  if(EDIT && S.mode === 'wall'){
    const n = (w.holds || []).length;
    if(ui.scan){
      const s = ui.scan, pct = Math.round(100 * s.i / s.total);
      el.innerHTML = `<p class="hint">Rilevamento automatico in corso: ${pct}% — ${s.found} nuove prese trovate finora. Può volerci qualche minuto su una foto densa.</p>`+
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
      `<button class="btn" data-act="autoall">Rileva tutte le prese (salta quelle bianche/chiarissime)</button>`;
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
    el.innerHTML =
      `<button class="btn ${p.numbers ? 'on' : ''}" data-act="pref" data-k="numbers">Numeri</button>`+
      `<button class="btn ${p.lines ? 'on' : ''}" data-act="pref" data-k="lines">Linee</button>`+
      `<button class="btn ${p.others ? 'on' : ''}" data-act="pref" data-k="others">Altri circuiti</button>`+
      `<button class="btn ${p.dim ? 'on' : ''}" data-act="pref" data-k="dim">Oscura muro</button>`+
      `<button class="btn primary" data-act="img">Crea immagine</button>`+
      `<p class="hint">S: partenza. T: arrivo.</p>`;
    return;
  }
  const h = c && ui.sel != null ? c.holds[ui.sel] : null;
  const role = h ? h.role : ui.nextRole;
  const rb = (v,l) => `<button data-act="role" data-v="${v}" aria-pressed="${role === v}">${l}</button>`;
  const hand = h ? (h.hand || '') : ui.nextHand;
  const dot = col => `<span style="display:inline-block;width:.7em;height:.7em;border-radius:50%;background:${col};border:1px solid #888;margin-right:6px;vertical-align:-1px"></span>`;
  const hb = (v,l) => `<button data-act="hand" data-v="${v}" aria-pressed="${hand === v}">${l}</button>`;
  let hint = 'Tocca una presa per accenderla. Tocca una presa accesa per selezionarla.';
  if(ui.move && h) hint = 'Tocca la presa dove spostarla.';
  else if(h) hint = 'Presa selezionata: cambia tipo o contorno, sposta o elimina.';
  else if(c && !c.holds.length) hint = 'Tocca la prima presa di partenza per accenderla.';
  const lbl = h && !h.poly ? 'Anello' : 'Contorno';
  el.innerHTML =
    `<p class="hint">${hint}</p>`+
    `<div class="seg">${rb('start','Partenza')}${rb('hold','Presa')}${rb('top','Arrivo')}</div>`+
    `<div class="seg" role="group" aria-label="Mano">${hb('','Libera')}${hb('L',dot(S.prefs.handL)+'Sinistra')}${hb('R',dot(S.prefs.handR)+'Destra')}</div>`+
    `<div class="seg"><button data-act="size" data-d="-1" aria-label="${lbl} più piccolo" ${h ? '' : 'disabled'}>${lbl} &minus;</button>`+
    `<button data-act="size" data-d="1" aria-label="${lbl} più grande" ${h ? '' : 'disabled'}>${lbl} +</button></div>`+
    `<button class="btn ${ui.move ? 'on' : ''}" data-act="move" ${h ? '' : 'disabled'}>Sposta</button>`+
    `<button class="btn" data-act="dup" ${h ? '' : 'disabled'}>Ripeti qui (2ª mano)</button>`+
    `<button class="btn" data-act="del" ${h ? '' : 'disabled'}>Elimina</button>`+
    `<button class="btn" data-act="undo" ${c && c.holds.length ? '' : 'disabled'}>Annulla</button>`;
}
function render(){
  { const w0 = curWall(); if(EDIT && w0 && !w0.locked && S.mode === 'edit') S.mode = 'wall'; }
  renderTop(); renderPub(); renderStage(); renderChips(); renderTools(); }

/* ---------- pannelli ---------- */
function openSheet(name){ ui.sheet = name; ui.confirm = null; renderSheet(); }
function renderSheet(){
  const el = $('#sheet'), card = $('#card');
  if(!ui.sheet){ el.hidden = true; card.innerHTML = ''; return; }
  const w = curWall(), c = curCircuit();
  let h = '';
  if(ui.sheet === 'circ' && c && EDIT){
    const gradeOpt = v => `<option value="${v}" ${(c.grade || '') === v ? 'selected' : ''}>${v || '—'}</option>`;
    const styleOpt = v => `<option value="${v}" ${(c.style || '') === v ? 'selected' : ''}>${v || '—'}</option>`;
    h = `<h2>Circuito</h2>`+
      `<label class="field">Nome<input id="cname" value="${esc(c.name)}" maxlength="40"></label>`+
      `<div class="sw" role="group" aria-label="Colore">` +
      PALETTE.map(p => `<button data-act="color" data-c="${p[1]}" aria-label="${p[0]}" class="${p[1] === c.color ? 'sel' : ''}" style="background:${p[1]}"></button>`).join('') +
      `</div>`+
      `<label class="field">Grado<select id="cgrade">${GRADES.map(gradeOpt).join('')}</select></label>`+
      `<label class="field">Stile<select id="cstyle">${STYLES.map(styleOpt).join('')}</select></label>`+
      `<div class="row"><button class="btn danger" data-act="delc">${ui.confirm === 'delc' ? 'Tocca ancora per eliminare' : 'Elimina circuito'}</button>`+
      `<button class="btn primary" data-act="close">Fatto</button></div>`;
  } else if(ui.sheet === 'wall'){
    h = `<h2>Muri</h2><div class="list">`+
      S.walls.map(x => `<button class="wrow ${w && x.id === w.id ? 'active' : ''}" data-act="pickw" data-id="${x.id}"><span>${esc(x.name)}${x.angle != null ? ' · '+x.angle+'°' : ''}</span><small>${x.circuits.length} circuiti</small></button>`).join('') +
      `</div>`;
    if(EDIT){
      const angleOpt = v => `<option value="${v}" ${w && w.angle === v ? 'selected' : ''}>${v}°</option>`;
      h += (w ? `<label class="field">Nome del muro<input id="wname" value="${esc(w.name)}" maxlength="40"></label>` : '') +
        (w ? `<label class="field">Inclinazione dalla verticale<select id="wangle"><option value="" ${w.angle == null ? 'selected' : ''}>—</option>${ANGLES.map(angleOpt).join('')}</select></label>` : '') +
        `<div class="row">${PICK_BTNS}</div>`+
        `<div class="row" style="margin-top:10px">` +
        (w ? `<button class="btn danger" data-act="delw">${ui.confirm === 'delw' ? 'Tocca ancora per eliminare' : 'Elimina muro'}</button>` : '') +
        `<button class="btn primary" data-act="close">Fatto</button></div>`+
        `<p class="note">Le modifiche restano su questo dispositivo finché non premi Pubblica. Dopo la pubblicazione, chi apre il link vede i circuiti aggiornati, in sola lettura.</p>`+
        (SB ? `<div class="row" style="margin-top:10px"><button class="btn" data-act="logout">Esci</button></div>` : '');
    } else {
      h += `<div class="row">${SB ? `<button class="btn" data-act="login">Accedi come gestore</button>` : ''}<button class="btn primary" data-act="close">Chiudi</button></div>`;
    }
  } else if(ui.sheet === 'login'){
    h = `<h2>Accesso gestore</h2>`+
      (ui.loginSent ? `<p>Ti ho mandato un'email con un link. Aprila da questo telefono e tocca il link: tornerai qui già dentro.</p>` :
      `<label class="field">La tua email<input id="lemail" type="email" autocomplete="email" inputmode="email" value="${esc(ui.loginEmail || '')}"></label>`+
      `<p class="note" style="margin:0 0 12px">Ricevi un link per entrare, senza password.</p>`)+
      `<div class="row">${ui.loginSent ? '' : `<button class="btn primary" data-act="sendlink">Mandami il link</button>`}<button class="btn" data-act="close">Chiudi</button></div>`;
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
      cr.pts.length === 0 ? 'Tocca i punti lungo il vero bordo del pannello (anche se è storto/in prospettiva), poi "Chiudi forma".' :
      `Punti toccati: ${cr.pts.length}. Continua lungo il bordo, poi "Chiudi forma" (minimo 3 punti).`;
    h = `<h2>Ritaglia il pannello</h2><p class="hint">${step}</p>`+
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
      `</div>`;
  } else { ui.sheet = null; el.hidden = true; return; }
  card.innerHTML = h;
  el.hidden = false;
}
async function makeImage(){
  const w = curWall(), c = curCircuit(); if(!w || !c) return;
  ui.imgUrl = null; openSheet('img');
  try{
    const photo = await loadImg(w.img);
    const inner = overlay(w, { numbers: S.prefs.numbers, lines: S.prefs.lines, others: S.prefs.others, edit: false, dim: S.prefs.dim });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w.w}" height="${w.h}" viewBox="0 0 ${w.w} ${w.h}">${inner}</svg>`;
    const ov = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    const capH = Math.round(w.w*0.09);
    const cv = document.createElement('canvas'); cv.width = w.w; cv.height = w.h + capH;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(photo, 0, 0, w.w, w.h); g.drawImage(ov, 0, 0, w.w, w.h);
    g.beginPath(); g.arc(capH*0.5, w.h + capH/2, capH*0.2, 0, Math.PI*2);
    g.fillStyle = c.color; g.fill(); g.lineWidth = Math.max(2, capH*0.03); g.strokeStyle = '#111111'; g.stroke();
    g.fillStyle = '#111111'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(capH*0.4)}px "Barlow Semi Condensed", Arial, sans-serif`;
    g.fillText(`${w.name}: ${c.name}, ${c.holds.length} prese`, capH*0.9, w.h + capH/2);
    ui.imgUrl = cv.toDataURL('image/jpeg', 0.92);
  }catch(e){ ui.imgUrl = 'err'; }
  if(ui.sheet === 'img') renderSheet();
}

/* ---------- pubblicazione ---------- */
async function sendLoginLink(){
  const email = (ui.loginEmail || '').trim();
  if(!SB || !/^\S+@\S+\.\S+$/.test(email)){ toast('Scrivi un\'email valida.'); return; }
  const { error } = await SB.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if(error){ toast('Invio non riuscito: ' + (error.message || 'riprova tra poco.')); return; }
  ui.loginSent = true; renderSheet();
}
/* carica le foto nuove nell'archivio e salva lo stato nel database; poi ricarica la pagina pubblicata */
async function publishRemote(){
  const snap = JSON.parse(JSON.stringify(snapshot()));
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
async function publish(){
  if(!EDIT || !ART || ui.publishing || !dirty()) return;
  ui.publishing = true; renderPub();
  try{
    await saveNow();
    await ART.publish();   /* dopo il successo la vista si ricarica sulla nuova versione */
  }catch(e){
    ui.publishing = false;
    const code = e && e.code;
    if(code === 'conflict'){ /* la vista si ricarica da sola sulla versione vincente */ }
    else if(['not_writer','not_granted','not_declared','consent_required','capability_disabled','capability_removed'].includes(code)){
      EDIT = false; S.mode = 'view'; toast('Per te la pagina è in sola lettura: non posso pubblicare.'); render();
    }
    else if(code === 'too_large') toast('Troppo pesante da pubblicare: elimina un muro o usa foto più piccole.');
    else if(code === 'rate_limited') toast('Troppe pubblicazioni ravvicinate: aspetta qualche secondo.');
    else toast('Pubblicazione non riuscita. Riprova.');
    renderPub();
  }
}

/* ---------- interazione ---------- */
$('#stage').addEventListener('click', async e => {
  const w = curWall(), c = curCircuit();
  if(!EDIT || !w || S.mode === 'view' || ui.busy || ui.scan || Date.now() - ui.pinchAt < 350) return;
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
  if(ui.move && ui.sel != null && c.holds[ui.sel]){
    ui.busy = true;
    const h = c.holds[ui.sel];
    applySeg(h, await detect(w, x, y, h.ts || 1), x, y, w);
    ui.move = false; ui.busy = false; touch(); render(); return;
  }
  const hit = hitIndex(c, w.w, x, y, ctol);
  if(hit >= 0){ ui.sel = ui.sel === hit ? null : hit; ui.move = false; render(); return; }
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

const EDIT_ONLY = ['tool','closeDraw','undoPt','cancelDraw','redraw','lock','unlock','tracing','addc','role','size','move','del','undo','color','delc','addw','delw','publish','autoall','stopauto','hand','dup','cropTap','cropUndo','cropClose','cropReset','cropCancel','cropDone','panelReset','panelDone','camlive','camCancel','camShot'];
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if(!b || b.disabled) return;
  const a = b.dataset.act, w = curWall(), c = curCircuit();
  if(EDIT_ONLY.includes(a) && !EDIT) return;
  switch(a){
    case 'mode': if(EDIT && !ui.scan){ S.mode = b.dataset.v; ui.sel = null; ui.csel = null; ui.move = false; ui.draft = []; ui.redraw = null; ui.tool = 'detect'; render(); } break;
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
    case 'lock': if(w){ w.locked = true; ui.draft = []; ui.redraw = null; ui.tool = 'detect'; ui.csel = null; S.mode = 'edit'; ui.nextRole = roleFor(curCircuit()); touch(); render(); } break;
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
    case 'camlive': openCamera(); break;
    case 'login': ui.loginSent = false; openSheet('login'); break;
    case 'sendlink': sendLoginLink(); break;
    case 'logout': if(SB){ SB.auth.signOut().finally(() => location.reload()); } break;
    case 'camCancel': closeCamera(); break;
    case 'camShot': shootCamera(); break;
    case 'cropDone': finishCrop(); break;
    case 'autoall': if(w) autoDetectAll(w); break;
    case 'stopauto': if(ui.scan) ui.scan.stop = true; break;
    case 'tracing': if(w && w.locked){ S.mode = 'edit'; render(); } break;
    case 'wall': openSheet('wall'); break;
    case 'img': makeImage(); break;
    case 'publish': publish(); break;
    case 'pref': S.prefs[b.dataset.k] = !S.prefs[b.dataset.k]; save(); render(); break;
    case 'zoom': { const bx = $('#box').getBoundingClientRect(); applyZoom(ui.zoom * Math.pow(1.4, +b.dataset.d), bx.left + bx.width/2, bx.top + bx.height/2); break; }
    case 'circ':
      if(!w) break;
      if(c && b.dataset.id === c.id){ if(EDIT) openSheet('circ'); break; }
      w.activeCircuit = b.dataset.id; ui.sel = null; ui.move = false; ui.nextRole = roleFor(curCircuit()); save(); render(); break;
    case 'addc': {
      if(!w) break;
      const n = newCircuit(w); w.circuits.push(n); w.activeCircuit = n.id;
      ui.sel = null; ui.move = false; ui.nextRole = 'start'; S.mode = 'edit'; touch(); render(); openSheet('circ'); break;
    }
    case 'hand': {
      const h = c && ui.sel != null ? c.holds[ui.sel] : null, v = b.dataset.v;
      if(h){ if(v) h.hand = v; else delete h.hand; touch(); } else ui.nextHand = v;
      render(); break;
    }
    case 'dup': {
      const h = c && ui.sel != null ? c.holds[ui.sel] : null;
      if(h){
        const nh = h.hand === 'L' ? 'R' : h.hand === 'R' ? 'L' : ui.nextHand;
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
      if(h){ h.role = b.dataset.v; touch(); } else ui.nextRole = b.dataset.v;
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
      if(c && ui.sel != null){ c.holds.splice(ui.sel, 1); ui.sel = null; ui.move = false; if(!c.holds.length) ui.nextRole = 'start'; touch(); render(); } break;
    case 'undo': if(c && c.holds.length){ c.holds.pop(); ui.sel = null; ui.move = false; if(!c.holds.length) ui.nextRole = 'start'; touch(); render(); } break;
    case 'color': if(c){ c.color = b.dataset.c; touch(); render(); renderSheet(); } break;
    case 'delc':
      if(!w || !c) break;
      if(ui.confirm !== 'delc'){ ui.confirm = 'delc'; renderSheet(); break; }
      w.circuits = w.circuits.filter(x => x.id !== c.id);
      if(!w.circuits.length) w.circuits.push(newCircuit(w));
      w.activeCircuit = w.circuits[0].id; ui.sel = null; ui.nextRole = roleFor(curCircuit());
      ui.sheet = null; ui.confirm = null; touch(); render(); renderSheet(); break;
    case 'pickw': if(ui.scan) break; S.active = b.dataset.id; ui.sel = null; ui.zoom = 1; ui.move = false; ui.sheet = null; save(); render(); renderSheet(); break;
    case 'delw':
      if(!w) break;
      if(ui.confirm !== 'delw'){ ui.confirm = 'delw'; renderSheet(); break; }
      S.walls = S.walls.filter(x => x.id !== w.id);
      S.active = S.walls[0] ? S.walls[0].id : null;
      ui.sel = null; ui.sheet = null; ui.confirm = null; touch(); render(); renderSheet(); break;
    case 'close': ui.sheet = null; ui.confirm = null; renderSheet(); break;
  }
});

document.addEventListener('input', e => {
  const c = curCircuit(), w = curWall();
  if(!EDIT) return;
  if(e.target.id === 'lemail'){ ui.loginEmail = e.target.value.trim(); }
  if(e.target.id === 'cname' && c){ c.name = e.target.value || 'Circuito'; renderChips(); touch(); }
  if(e.target.id === 'wname' && w){ w.name = e.target.value || 'Muro'; renderTop(); touch(); }
  if(e.target.id === 'cgrade' && c){ if(e.target.value) c.grade = e.target.value; else delete c.grade; renderChips(); touch(); }
  if(e.target.id === 'cstyle' && c){ if(e.target.value) c.style = e.target.value; else delete c.style; touch(); }
  if(e.target.id === 'wangle' && w){ if(e.target.value !== '') w.angle = +e.target.value; else delete w.angle; touch(); }
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && ui.sheet){ ui.sheet = null; ui.confirm = null; renderSheet(); return; }
  const l = e.target.closest && e.target.closest('label[for]');
  if(l && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); const i = document.getElementById(l.htmlFor); if(i) i.click(); }
});
$('#sheet').addEventListener('click', e => { if(e.target.id === 'sheet'){ ui.sheet = null; ui.confirm = null; renderSheet(); } });

let camStream = null;
async function openCamera(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    toast('Questo browser non offre accesso diretto alla fotocamera. Prova ad aprire il link nel browser del telefono.');
    return;
  }
  try{
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  }catch(err){
    toast('Fotocamera non disponibile qui (' + (err && err.name || 'errore') + '). Prova ad aprire il link nel browser del telefono (Safari/Chrome) invece che dentro l\'app.');
    return;
  }
  const v = $('#camVideo'); v.srcObject = camStream;
  $('#camWrap').hidden = false;
}
function closeCamera(){
  if(camStream){ camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  $('#camWrap').hidden = true;
}
function shootCamera(){
  const v = $('#camVideo');
  const vw = v.videoWidth, vh = v.videoHeight;
  if(!vw || !vh) return;
  const k = Math.min(1, 2000 / Math.max(vw, vh));
  const w = Math.round(vw*k), h = Math.round(vh*k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(v, 0, 0, w, h);
  const img = c.toDataURL('image/jpeg', 0.86);
  closeCamera();
  ui.crop = { w, h, img, pts: [], closed: false };
  openSheet('crop');
}
async function onFile(e){
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if(!f || !EDIT) return;
  try{
    const p = await readPhoto(f);
    ui.crop = { w: p.w, h: p.h, img: p.img, pts: [], closed: false };
    openSheet('crop');
  }catch(err){ toast('Non riesco a leggere questa foto. Prova con un altro file.'); }
}
async function finishCrop(){
  const cr = ui.crop; if(!cr || !cr.closed || cr.pts.length < 3) return;
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
  let wn = S.walls.length + 1; while(S.walls.some(x => x.name === 'Muro ' + wn)) wn++;
  const w = { id: uid(), name: 'Muro ' + wn, w: cw, h: ch, img, circuits: [], activeCircuit: null };
  const circ = newCircuit(w); w.circuits.push(circ); w.activeCircuit = circ.id;
  S.walls.push(w); S.active = w.id; S.mode = 'edit';
  ui.sel = null; ui.move = false; ui.zoom = 1; ui.nextRole = 'start'; ui.crop = null; ui.sheet = null;
  touch(); render(); renderSheet();
}
document.addEventListener('change', e => { if(e.target && e.target.matches && e.target.matches('input[data-pick]')) onFile(e); });
/* incolla una foto copiata dalla galleria: non serve il selettore di file, che alcune app bloccano */
function pastedImage(e){
  const dt = e.clipboardData; if(!dt) return null;
  for(const it of Array.from(dt.items || [])){ if(it.kind === 'file' && /^image\//.test(it.type)){ const f = it.getAsFile(); if(f) return f; } }
  for(const f of Array.from(dt.files || [])){ if(/^image\//.test(f.type)) return f; }
  return null;
}
document.addEventListener('beforeinput', e => { if(e.target && e.target.closest && e.target.closest('[data-paste]') && e.inputType !== 'insertFromPaste') e.preventDefault(); });
document.addEventListener('paste', async e => {
  const t = e.target, inZone = t && t.closest && t.closest('[data-paste]');
  const f = pastedImage(e);
  if(!f){ if(inZone){ e.preventDefault(); toast('Negli appunti non c\'è una foto. Copia prima l\'immagine dalla Galleria.'); } return; }
  if(!inZone && t && t.closest && t.closest('input,textarea')) return;
  e.preventDefault();
  if(!EDIT) return;
  try{
    const p = await readPhoto(f);
    ui.crop = { w: p.w, h: p.h, img: p.img, pts: [], closed: false };
    openSheet('crop');
  }catch(err){ toast('Non riesco a leggere questa foto. Prova con un\'altra.'); }
});
$('#file').addEventListener('change', onFile);
$('#cam').addEventListener('change', onFile);

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
$('#box').addEventListener('scroll', () => {
  const b = $('#box'), st = $('#stage');
  if(st.clientWidth > 0 && st.clientHeight > 0)
    ui.view = { u: (b.scrollLeft + b.clientWidth/2 - st.offsetLeft)/st.clientWidth, v: (b.scrollTop + b.clientHeight/2 - st.offsetTop)/st.clientHeight };
}, { passive: true });
if(window.ResizeObserver) new ResizeObserver(fit).observe($('#box')); else window.addEventListener('resize', fit);

/* ---------- avvio: prima si mostra la versione pubblicata, poi si abilita la modifica a chi può ---------- */
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
          S.prefs = Object.assign(S.prefs, row.data.prefs || {});
          PUBREV = S.rev; SEEDWALLS = S.walls;
          if(!curWall() && S.walls.length) S.active = S.walls[0].id;
          render();
        }
      }catch(e){}
      const { data: { session } } = await SB.auth.getSession();
      if(session){
        const { data: ok } = await SB.rpc('is_editor');
        if(ok){ ART = { publish: publishRemote }; EDIT = true; }
        else toast('Questo account non ha i permessi di modifica.');
      }
    }
  }catch(e){ EDIT = false; }
  if(EDIT){ await loadDraft(); S.mode = 'edit'; if(!curWall() && S.walls.length) S.active = S.walls[0].id; }
  ui.ready = true;
  ui.nextRole = roleFor(curCircuit());
  render();
})();
})();

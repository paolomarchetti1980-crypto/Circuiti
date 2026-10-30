import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');   /* playwright installato a livello di sistema */
import fs from 'fs';
const FIX = JSON.parse(fs.readFileSync('fixture.json','utf8'));
const OUT = []; const log = (k, v) => { OUT.push([k, v]); };
const MOCK = `(() => {
  const ls = localStorage;
  const db = () => JSON.parse(ls.getItem('__db'));
  const role = () => ls.getItem('__role') || null;
  window.__ups = 0;
  const q = (table) => {
    if(table === 'app_state') return {
      select(){ return { eq(){ return { maybeSingle: async () => { const d = db(); return { data: d ? { data: d.data, rev: d.rev } : null }; } }; } }; },
      upsert: async (x) => { ls.setItem('__db', JSON.stringify({ data: x.data, rev: x.rev })); ls.setItem('__ups', String(+(ls.getItem('__ups')||0)+1)); return {}; }
    };
    if(table === 'editors') return {
      select(){ return { order: async () => ({ data: JSON.parse(ls.getItem('__ed') || '[{"email":"p@x.it","role":"gestore"}]') }) }; },
      insert: async (x) => { const l = JSON.parse(ls.getItem('__ed') || '[{"email":"p@x.it","role":"gestore"}]'); l.push(x); ls.setItem('__ed', JSON.stringify(l)); return {}; },
      delete(){ return { eq: async (k, v) => { const l = JSON.parse(ls.getItem('__ed') || '[]').filter(e => e.email !== v); ls.setItem('__ed', JSON.stringify(l)); return {}; } }; }
    };
  };
  window.supabase = { createClient(){ return {
    from: q,
    storage: { from(){ return { upload: async () => ({}), getPublicUrl: (p) => ({ data: { publicUrl: 'img/muro1.jpg?u=' + p } }) }; } },
    auth: { getSession: async () => ({ data: { session: role() ? { user: { email: role() === 'gestore' ? 'p@x.it' : 't@x.it' } } : null } }), signOut: async () => { ls.removeItem('__role'); }, signInWithPassword: async () => ({}), signInWithOtp: async () => ({}), updateUser: async () => ({}) },
    rpc: async (n) => n === 'my_role' ? { data: role() } : { data: !!role() }
  }; } };
})();`;
const b = await chromium.launch();
let LASTDB = null;
async function session(roleName, fn, dbo){
  const ctx = await b.newContext({...devices['Pixel 7'], serviceWorkers:'block', locale:'it-IT'});
  const pg = await ctx.newPage();
  pg.on('pageerror', e => log('PAGEERROR', e.message));
  await pg.route('**/onnxruntime-web@1.19.2/**', r => r.abort());
  await pg.route('**/supabase-js@*/**', r => r.fulfill({ contentType: 'text/javascript', body: MOCK }));
  await pg.addInitScript(([fix, roleName, dbo]) => {
    try{ localStorage.setItem('mr-welcome','1'); }catch(e){}
    if(!sessionStorage.getItem('__init')){ sessionStorage.setItem('__init','1');
      if(!localStorage.getItem('__db')) localStorage.setItem('__db', dbo ? JSON.stringify(dbo) : JSON.stringify({ data: fix, rev: 5 }));
      if(roleName) localStorage.setItem('__role', roleName); else localStorage.removeItem('__role');
    }
  }, [FIX, roleName, dbo || null]);
  await pg.goto(process.env.URL || 'http://localhost:8765/'); await pg.waitForTimeout(1500); { const sec = await pg.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('boulder-ui')||'{}').sec; }catch(e){ return null; } }); if(await pg.locator('.htile').count()){ await pg.tap('.htile[data-v='+(sec==='boulder'?'boulder':'circ')+']'); await pg.waitForTimeout(400); } } await pg.waitForTimeout(1800);
  try{ await fn(pg, ctx); }catch(e){ log('FAIL '+(roleName||'cliente'), e.message.split('\n')[0]); await pg.screenshot({path:'fail_'+(roleName||'cliente')+'.png'}); }
  await ctx.close();
}
const txt = async (pg, sel) => (await pg.locator(sel).allTextContents()).map(s => s.replace(/\s+/g,' ').trim());
const P = async (pg, fx, fy) => { const bb = await pg.locator('#stage').boundingBox(); await pg.mouse.click(bb.x+bb.width*fx, bb.y+bb.height*fy); await pg.waitForTimeout(400); };
const draft = (pg) => pg.evaluate(async()=>{ await new Promise(r=>setTimeout(r,500)); const db=await new Promise(r=>{const q=indexedDB.open('circuiti-muro',1);q.onsuccess=()=>r(q.result);q.onupgradeneeded=()=>q.result.createObjectStore('kv');}); return await new Promise(r=>{try{const q=db.transaction('kv').objectStore('kv').get('draft'); q.onsuccess=()=>r(q.result||null);}catch(e){r(null);}}); });

// ---------- A: cliente ----------
await session(null, async (pg) => {
  log('A.title', await pg.title());
  log('A.wall', await pg.textContent('#wallName'));
  log('A.sec', await txt(pg, '#secbar button[aria-pressed="true"]'));
  log('A.modesHidden', await pg.locator('#modes').isHidden());
  log('A.rows', await txt(pg, '.lrow'));
  log('A.walls', await txt(pg, '.scard .sname'));
  await pg.tap('.scard[data-act=opensec] >> nth=1', {timeout:5000}); await pg.waitForTimeout(400);
  log('A.wall2', await pg.textContent('#wallName'));
  log('A.rows2', await txt(pg, '.lrow'));
  log('A.dots2', await pg.evaluate(()=>[...document.querySelectorAll('.lrow .dot')].map(d=>d.style.background)));
  await pg.tap('.lrow >> nth=1', {timeout:5000}); await pg.waitForTimeout(300);
  await pg.tap('.lrow.active', {timeout:5000}); await pg.waitForTimeout(500);
  log('A.full', await pg.evaluate(()=>document.getElementById('app').classList.contains('full')));
  log('A.fcard', (await pg.textContent('#fcard')).replace(/\s+/g,' ').trim());
  await pg.tap('[data-act="fnav"][data-d="-1"]', {timeout:5000}); await pg.waitForTimeout(300);
  log('A.fcardPrev', (await pg.textContent('#fcard')).replace(/\s+/g,' ').trim());
  await pg.goBack(); await pg.waitForTimeout(300);
  log('A.prefs', await txt(pg, '.mini .btn'));
  await pg.tap('[data-act="pref"][data-k="lines"]', {timeout:5000}); await pg.waitForTimeout(300);
  log('A.ovLabels', await pg.evaluate(()=>[...document.querySelectorAll('#ov text')].map(t=>t.textContent)));
  await pg.tap('[data-act="sec"][data-v="boulder"]', {timeout:5000}); await pg.waitForTimeout(300);
  log('A.boulderEmpty', (await pg.textContent('#empty')).replace(/\s+/g,' ').trim());
  await pg.tap('#menuBtn', {timeout:5000}); await pg.waitForTimeout(200);
  log('A.boulderSheet', await txt(pg, '#card button'));
});

// ---------- B: gestore ----------
await session('gestore', async (pg) => {
  log('B.modes', await txt(pg, '#prevBtn:not([hidden])'));
  log('B.mode', await txt(pg, '#modes button[aria-pressed="true"]'));
  log('B.wall', await pg.textContent('#wallName'));
if(!(await pg.locator('.scard[data-act=opensec]:visible').count()) && !(await pg.locator('#backBtn').isHidden())){ await pg.tap('#backBtn'); await pg.waitForTimeout(300); } await pg.tap('.scard[data-act=opensec] >> nth=1', {timeout:5000}); await pg.waitForTimeout(400);
  log('B.wall3', await pg.textContent('#wallName'));
  log('B.mode3', await txt(pg, '#modes button[aria-pressed="true"]'));
  await (async()=>{ if(await pg.locator('#prevBtn.on').count()) await pg.tap('#prevBtn.on'); })(); await pg.waitForTimeout(300);
  // nuovo circuito su muro corrente
  await pg.tap('[data-act="clist"] >> nth=-1', {timeout:5000}); await pg.waitForTimeout(200);
  await pg.tap('#card [data-act="addc"]', {timeout:5000}); await pg.waitForTimeout(300);
  log('B.newName', (await pg.inputValue('#cname')).length > 3);
  await pg.selectOption('#cgrade', '6b'); await pg.selectOption('#cstyle', 'Tacche');
  await pg.tap('[data-act="cfeet"][data-v="obbligati"]', {timeout:5000}); await pg.selectOption('#cangle', '25');
  await pg.tap('[data-act="cgen"]', {timeout:5000}); const nm = await pg.inputValue('#cname'); log('B.genOk', nm.length > 3);
  await pg.fill('#cname', 'Test Circuito');
  await pg.tap('[data-act="close"]', {timeout:5000}); await pg.waitForTimeout(200);
  log('B.curbar', (await pg.textContent('#chips')).replace(/\s+/g,' ').trim());
  log('B.hands', await txt(pg, '[data-act="hand"]'));
  for(const [x,y] of [[0.3,0.85],[0.35,0.7],[0.45,0.55],[0.5,0.4],[0.55,0.25]]) await P(pg, x, y);
  let d = await draft(pg);
  const w0 = d.walls.find(w => w.id === d.active); const c0 = w0.circuits.find(c => c.name === 'Test Circuito');
  log('B.holds', c0 ? c0.holds.map(h => h.role + ':' + h.hand + ':' + (h.poly ? 'p' : 'c')) : null);
  log('B.fields', c0 ? [c0.grade, c0.style, c0.feet, c0.angle] : null);
  // seleziona presa e cambia ruolo in arrivo
  const last = c0.holds[c0.holds.length-1];
  const bb = await pg.locator('#stage').boundingBox();
  await pg.mouse.click(bb.x + last.x/w0.w*bb.width, bb.y + last.y/w0.h*bb.height); await pg.waitForTimeout(300);
  await pg.tap('[data-act="role"][data-v="top"]', {timeout:5000}); await pg.waitForTimeout(200);
  await pg.tap('[data-act="dup"]', {timeout:5000}); await pg.waitForTimeout(200);
  d = await draft(pg); const c1 = d.walls.find(w => w.id === d.active).circuits.find(c => c.name === 'Test Circuito');
  log('B.afterDup', c1.holds.map(h => h.role + ':' + h.hand));
  await pg.screenshot({path:'tr_sel.png'});
  await pg.tap('[data-act="desel"]', {timeout:5000}).catch(()=>{}); await pg.waitForTimeout(200);
  await pg.screenshot({path:'tr_add.png'});
  await pg.tap('[data-act="undo"]', {timeout:5000}); await pg.waitForTimeout(200);
  log('B.pub', await pg.locator('#pubbar').isVisible());
  // modalità Muro
  if(!(await pg.locator('.scard[data-act=opensec]:visible').count()) && !(await pg.locator('#backBtn').isHidden())){ await pg.tap('#backBtn'); await pg.waitForTimeout(300); } await pg.tap('.sedit >> nth=1', {timeout:5000}); await pg.waitForTimeout(200); await pg.tap('#card [data-act="wallmode"]', {timeout:5000}); await pg.waitForTimeout(300);
  log('B.wallTools', (await txt(pg, '#tools button')).slice(0, 4));
  await pg.tap('[data-act="tracing"]').catch(()=>{}); await (async()=>{ if(await pg.locator('#prevBtn.on').count()) await pg.tap('#prevBtn.on'); })(); await pg.waitForTimeout(200);
  log('B.editDimBtn', await pg.locator('[data-act="editdim"]').count());
  // boulder: nuovo settore
  await pg.tap('[data-act="sec"][data-v="boulder"]', {timeout:5000}); await pg.waitForTimeout(300);
  await pg.setInputFiles('#empty input[data-pick]:not([capture])', '/home/claude/circuiti/img/muro1.jpg'); await pg.waitForTimeout(800);
  await pg.tap('[data-act="cropAll"]', {timeout:5000}); await pg.waitForTimeout(1200);
  log('B.sector', await pg.textContent('#wallName'));
  log('B.secModes', await txt(pg, '#modes button:not([hidden])'));
  await pg.tap('[data-act="cedit"]', {timeout:5000}); await pg.waitForTimeout(200);
  await pg.tap('[data-act="bdiff"][data-v="verde"]', {timeout:5000}); await pg.tap('[data-act="hcolor"][data-c="#8a4dff"]', {timeout:5000}); await pg.tap('[data-act="btag"][data-v="Tallone"]', {timeout:5000});
  await pg.selectOption('#bsetsel', '__altro'); await pg.waitForTimeout(300); await pg.fill('#bsetter', 'Marco'); await pg.fill('#bnotes', 'nota');
  log('B.bTitle', await pg.textContent('#card h2'));
  await pg.tap('[data-act="close"]', {timeout:5000}); await pg.waitForTimeout(200);
  await P(pg, 0.4, 0.8); await pg.waitForTimeout(2500); await P(pg, 0.5, 0.5); await pg.waitForTimeout(2500);
  await pg.tap('[data-act="bdraw"]', {timeout:5000}); for(const [x,y] of [[0.6,0.3],[0.66,0.3],[0.66,0.36]]) await P(pg, x, y);
  await pg.tap('[data-act="bclose"]', {timeout:5000}); await pg.waitForTimeout(300);
  d = await draft(pg); const sec = d.walls.find(w => w.kind === 'sector');
  log('B.boulder', sec ? sec.circuits.map(c => ({ diff: c.diff, num: c.num, color: c.color, hc: c.holdColor, tags: c.tags, setter: c.setter, n: c.holds.length, drawn: c.holds.filter(h=>h.drawn).length })) : null);
  // pubblica
  await pg.tap('#pubBtn', {timeout:5000}); await pg.waitForTimeout(3000);
  const pub = await pg.evaluate(() => JSON.parse(localStorage.getItem('__db')));
  LASTDB = pub; fs.writeFileSync('lastdb.json', JSON.stringify(pub));
  log('B.published', { walls: pub.data.walls.length, sectors: pub.data.walls.filter(w=>w.kind==='sector').length, testCirc: pub.data.walls.some(w=>w.circuits.some(c=>c.name==='Test Circuito')), sectorImg: (pub.data.walls.find(w=>w.kind==='sector')||{}).img });
  log('B.afterReloadSec', await txt(pg, '#secbar button[aria-pressed="true"]'));
  // staff
  if(!(await pg.locator('.scard[data-act=opensec]:visible').count()) && !(await pg.locator('#backBtn').isHidden())){ await pg.tap('#backBtn'); await pg.waitForTimeout(300); }
  await pg.tap('.sedit >> nth=0', {timeout:5000}); await pg.waitForTimeout(300);
  log('B.wallSheetBtns', await txt(pg, '#card .wrow span'));
});

// ---------- C: tracciatore ----------
await session('tracciatore', async (pg) => {
  log('C.modes', await txt(pg, '#modes button:not([hidden])'));
  log('C.pickBtns', await pg.locator('#empty input[data-pick]').count());
  await pg.tap('[data-act="sec"][data-v="boulder"]', {timeout:5000}); await pg.waitForTimeout(300);
  log('C.boulderWall', await pg.textContent('#wallName'));
  if(await pg.locator('.scard[data-act=opensec]:visible').count()){ await pg.tap('.scard[data-act=opensec] >> nth=0'); await pg.waitForTimeout(300); }
  log('C.boulderModes', await txt(pg, '#modes button:not([hidden])'));
  await (async()=>{ if(await pg.locator('#prevBtn.on').count()) await pg.tap('#prevBtn.on'); })(); await pg.waitForTimeout(200);
  log('C.overNew', await pg.locator('#chips [data-act="addc"]').count());
  await pg.tap('#chips [data-act="addc"]', {timeout:5000}); await pg.waitForTimeout(200);
  await pg.tap('[data-act="bdiff"][data-v="giallo"]', {timeout:5000}); log('C.bTitle', await pg.textContent('#card h2'));
  await pg.tap('[data-act="close"]', {timeout:5000});
  await pg.tap('#pubBtn', {timeout:5000}); await pg.waitForTimeout(3000);
  const pub = await pg.evaluate(() => JSON.parse(localStorage.getItem('__db')));
  const sec = pub.data.walls.find(w=>w.kind==='sector');
  log('C.published', { walls: pub.data.walls.length, boulders: sec ? sec.circuits.map(c => c.diff + (c.num||'')) : null });
}, LASTDB);
// ---------- D: filtri, elenchi, extra (gestore sul DB pubblicato da B) ----------
await session('gestore', async (pg) => {
  // circuiti: dai al muro 3 dati vari
  await pg.tap('[data-act="sec"][data-v="circ"]', {timeout:5000}).catch(()=>{}); await pg.waitForTimeout(300);
if(!(await pg.locator('.scard[data-act=opensec]:visible').count()) && !(await pg.locator('#backBtn').isHidden())){ await pg.tap('#backBtn'); await pg.waitForTimeout(300); } await pg.tap('.scard[data-act=opensec] >> nth=1', {timeout:5000}); await pg.waitForTimeout(300);
  await (async()=>{ if(await pg.locator('#prevBtn.on').count()) await pg.tap('#prevBtn.on'); })(); await pg.waitForTimeout(200);
  await pg.tap('[data-act="clist"] >> nth=-1', {timeout:5000}); await pg.waitForTimeout(200);
  log('D.clistRows', await txt(pg, '#card .crow'));
  log('D.clistFilters', await txt(pg, '#card .fchip, #card select option'));
  await pg.tap('#card .crow >> nth=0', {timeout:5000}); await pg.waitForTimeout(200);
  log('D.active', (await pg.textContent('.curbar .cinfo')).replace(/\s+/g,' ').trim());
  await pg.tap('[data-act="editdim"]', {timeout:5000}); await pg.waitForTimeout(200);
  log('D.dimOn', await pg.locator('#ov rect[mask]').count());
  await pg.tap('[data-act="cedit"]', {timeout:5000}); await pg.waitForTimeout(200);
  await pg.tap('[data-act="cgen"]', {timeout:5000}); log('D.genChanged', (await pg.inputValue('#cname')) !== 'Test Circuito');
  await pg.tap('[data-act="close"]', {timeout:5000});
  await pg.tap('#prevBtn', {timeout:5000}); await pg.waitForTimeout(300);
  log('D.viewFilters', await txt(pg, '#chips .fchip, #chips select option'));
  const angleChips = await pg.locator('#chips .fchip[data-act=sqang]').count();
  if(angleChips > 1){ await pg.tap('#chips .fchip[data-act=sqang] >> nth=1', {timeout:5000}); await pg.waitForTimeout(200); log('D.afterAngle', await txt(pg, '.lrow b')); await pg.tap('#chips .fchip[data-act=sqang] >> nth=0', {timeout:5000}); }
  if(await pg.locator('#ffeet').count()){ await pg.selectOption('#ffeet','obbligati'); await pg.waitForTimeout(200); log('D.afterFeet', await txt(pg, '.lrow b')); await pg.selectOption('#ffeet',''); }
  await pg.selectOption('#fgrade','6b').catch(()=>{}); await pg.waitForTimeout(200); log('D.afterGrade', await txt(pg, '.lrow b')); await pg.selectOption('#fgrade','').catch(()=>{});
  await pg.tap('#menuBtn', {timeout:5000}); await pg.waitForTimeout(200); await pg.tap('#card [data-act="img"]', {timeout:5000}); await pg.waitForTimeout(2500);
  log('D.img', await pg.locator('#card img.out').count());
  await pg.tap('[data-act="close"]', {timeout:5000});
  // boulder filtri
  await pg.tap('[data-act="sec"][data-v="boulder"]', {timeout:5000}); await pg.waitForTimeout(300);
  if(await pg.locator('.scard[data-act=opensec]').count()){ await pg.tap('.scard[data-act=opensec] >> nth=0'); await pg.waitForTimeout(300); }
  log('D.bRows', await txt(pg, '.lrow b'));
  await (async()=>{ if(await pg.locator('#prevBtn.on').count()) await pg.tap('#prevBtn.on'); })(); await pg.waitForTimeout(200);
  await pg.tap('#chips .lrow >> nth=0', {timeout:5000}); await pg.waitForTimeout(300);
  await pg.tap('[data-act="cedit"]', {timeout:5000}); await pg.fill('#bdrem', '2026-01-01'); await pg.tap('[data-act="close"]', {timeout:5000});
  await pg.tap('#prevBtn', {timeout:5000}); await pg.waitForTimeout(300);
  log('D.bOn', await txt(pg, '.lrow b'));
  log('D.clientShowChips', await pg.locator('[data-act="bshow"]').count());
  const dots = await pg.locator('[data-act="bcolor"]').count(); log('D.bDots', dots);
  if(dots){ await pg.tap('[data-act="bcolor"] >> nth=0', {timeout:5000}); await pg.waitForTimeout(200); log('D.bDot0', await txt(pg, '.lrow b')); }
  if(await pg.locator('#prevBtn.on').count()){ await pg.tap('#prevBtn.on'); await pg.waitForTimeout(300); }
  await pg.tap('#menuBtn', {timeout:5000}); await pg.waitForTimeout(200);
  await pg.tap('#card [data-act="staff"]', {timeout:5000}); await pg.waitForTimeout(400);
  log('D.staff', await txt(pg, '#card .wrow'));
  await pg.fill('#semail','nuovo@x.it'); await pg.tap('[data-act="staffadd"]', {timeout:5000}); await pg.waitForTimeout(400);
  log('D.staff2', await txt(pg, '#card .wrow'));
}, LASTDB);
await b.close();
fs.writeFileSync(process.argv[2] || 'suite_out.json', JSON.stringify(OUT, null, 1));
console.log(OUT.map(([k,v]) => k + ' = ' + JSON.stringify(v)).join('\n'));

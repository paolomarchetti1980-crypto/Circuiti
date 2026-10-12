/* generatore di nomi per i circuiti: animali, ambienti, caratteri; spunto dallo stile se impostato */
(function(){
'use strict';
const M = 'm', F = 'f';
const ANIMALI = [['scimmia',F],['gorilla',M],['babbuino',M],['macaco',M],['orango',M],['gibbone',M],['lemure',M],['bradipo',M],['tucano',M],['pappagallo',M],['camaleonte',M],['geco',M],['iguana',F],['pantera',F],['giaguaro',M],['tigre',F],['cobra',M],['pitone',M],['rana',F],['formica',F],['ragno',M],['scorpione',M],['falco',M],['aquila',F],['gufo',M],['volpe',F],['lince',F],['stambecco',M],['camoscio',M],['capra',F],['marmotta',F],['scoiattolo',M],['lucertola',F],['granchio',M],['polpo',M],['medusa',F],['squalo',M],['tartaruga',F],['coccodrillo',M],['rinoceronte',M],['giraffa',F],['zebra',F],['leone',M],['koala',M],['puma',M],['fenicottero',M],['pipistrello',M],['cinghiale',M],['istrice',M],['lontra',F],['orso',M],['lupo',M],['cammello',M],['struzzo',M],['vespa',F],['cicala',F],['libellula',F],['scarabeo',M]];
const AMBIENTI = [['liana',F],['giungla',F],['isola',F],['laguna',F],['scogliera',F],['vulcano',M],['cascata',F],['palma',F],['mangrovia',F],['savana',F],['canyon',M],['grotta',F],['foresta',F],['palude',F],['baia',F],['duna',F],['atollo',M],['sentiero',M],['radura',F],['torrente',M],['ghiacciaio',M],['falesia',F],['cresta',F],['banana',F],['cocco',M],['tempesta',F],['monsone',M],['tramonto',M],['eclissi',F],['uragano',M],['oasi',F],['miraggio',M],['arcipelago',M],['bambù',M],['corallo',M],['marea',F],['valanga',F],['nebbia',F],['luna',F],['meteora',F]];
/* aggettivi di carattere e d'aspetto: [maschile, femminile] */
const AGG = [['ribelle','ribelle'],['gentile','gentile'],['curioso','curiosa'],['furbo','furba'],['pigro','pigra'],['timido','timida'],['sfacciato','sfacciata'],['testardo','testarda'],['nervoso','nervosa'],['distratto','distratta'],['elegante','elegante'],['goffo','goffa'],['astuto','astuta'],['felice','felice'],['malinconico','malinconica'],['coraggioso','coraggiosa'],['permaloso','permalosa'],['saggio','saggia'],['matto','matta'],['scatenato','scatenata'],['sornione','sorniona'],['tranquillo','tranquilla'],['selvaggio','selvaggia'],['misterioso','misteriosa'],['volante','volante'],['storto','storta'],['sospeso','sospesa'],['ruvido','ruvida'],['segreto','segreta'],['notturno','notturna'],['dispettoso','dispettosa'],['impaziente','impaziente'],['birichino','birichina'],['solitario','solitaria'],['ballerino','ballerina'],['acrobata','acrobata'],['lunatico','lunatica'],['gigante','gigante'],['minuscolo','minuscola'],['rovente','rovente'],['gelido','gelida'],['affamato','affamata'],['assonnato','assonnata'],['geloso','gelosa'],['spavaldo','spavalda'],['zuccone','zuccona'],['brontolone','brontolona'],['vanitoso','vanitosa'],['ostinato','ostinata'],['silenzioso','silenziosa'],['capriccioso','capricciosa'],['tenace','tenace'],['leggendario','leggendaria'],['perduto','perduta'],['innamorato','innamorata']];
/* parole legate allo stile del circuito */
const STILE = {
  'Dinamico': [['salto',M],['lancio',M],['volo',M],['balzo',M],['tuffo',M]],
  'Equilibrio': [['funambolo',M],['piuma',F],['bilico',M],['danza',F],['altalena',F]],
  'Forza': [['morsa',F],['artiglio',M],['ruggito',M],['stretta',F],['zampata',F]],
  'Tecnico': [['enigma',M],['rebus',M],['trucco',M],['labirinto',M],['segreto',M]],
  'Resistenza': [['maratona',F],['traversata',F],['viaggio',M],['fuga',F],['migrazione',F]],
  'Coordinazione': [['giravolta',F],['valzer',M],['intreccio',M],['capriola',F],['tango',M]],
  'Tacche': [['unghia',F],['lama',F],['rasoio',M],['graffio',M],['spina',F]],
  'Svasi': [['carezza',F],['scivolo',M],['sapone',M],['velluto',M],['saponetta',F]],
  'Volumi': [['montagna',F],['onda',F],['collina',F],['cupola',F],['piramide',F]]
};
const pick = a => a[Math.floor(Math.random()*a.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const vowel = w => /^[aeiouàèéìòù]/i.test(w);
const lo = w => /^(s[^aeiou]|z|gn|ps|x|y|pn)/i.test(w);
const art = (w, g) => g === F ? (vowel(w) ? "L'" : 'La ') : vowel(w) ? "L'" : lo(w) ? 'Lo ' : 'Il ';
const di = (w, g) => g === F ? (vowel(w) ? "dell'" : 'della ') : vowel(w) ? "dell'" : lo(w) ? 'dello ' : 'del ';
const adj = (g) => { const a = pick(AGG); return g === F ? a[1] : a[0]; };
function one(style){
  const sw = STILE[style];
  const r = Math.random();
  if(sw && r < 0.55){
    const [x, gx] = pick(sw), [y, gy] = pick(ANIMALI.concat(AMBIENTI));
    return art(x, gx) + cap(x) + ' ' + di(y, gy) + cap(y);
  }
  if(r < 0.5){ const [n, g] = pick(ANIMALI.concat(AMBIENTI)); return cap(n) + ' ' + cap(adj(g)); }
  if(r < 0.75){ const [x, gx] = pick(AMBIENTI), [y, gy] = pick(ANIMALI); return art(x, gx) + cap(x) + ' ' + di(y, gy) + cap(y); }
  const [n, g] = pick(ANIMALI); return art(n, g) + cap(n) + ' ' + cap(adj(g));
}
window.genCircuitName = function(style, used){
  const u = new Set((used || []).map(s => String(s).toLowerCase()));
  for(let i=0; i<40; i++){ const n = one(style); if(!u.has(n.toLowerCase())) return n; }
  return one(style);
};
})();

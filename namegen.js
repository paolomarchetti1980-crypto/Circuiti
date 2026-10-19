/* generatore di nomi per i circuiti: animali, ambienti, caratteri, personaggi dei fumetti, personaggi storici, esclamazioni;
   spunto dallo stile se impostato */
(function(){
'use strict';
const M = 'm', F = 'f';
const ANIMALI = [['scimmia',F],['gorilla',M],['babbuino',M],['macaco',M],['orango',M],['gibbone',M],['lemure',M],['bradipo',M],['tucano',M],['pappagallo',M],['camaleonte',M],['geco',M],['iguana',F],['pantera',F],['giaguaro',M],['tigre',F],['cobra',M],['pitone',M],['rana',F],['formica',F],['ragno',M],['scorpione',M],['falco',M],['aquila',F],['gufo',M],['volpe',F],['lince',F],['stambecco',M],['camoscio',M],['capra',F],['marmotta',F],['scoiattolo',M],['lucertola',F],['granchio',M],['polpo',M],['medusa',F],['squalo',M],['tartaruga',F],['coccodrillo',M],['rinoceronte',M],['giraffa',F],['zebra',F],['leone',M],['koala',M],['puma',M],['fenicottero',M],['pipistrello',M],['cinghiale',M],['istrice',M],['lontra',F],['orso',M],['lupo',M],['cammello',M],['struzzo',M],['vespa',F],['cicala',F],['libellula',F],['scarabeo',M]];
const AMBIENTI = [['liana',F],['giungla',F],['isola',F],['laguna',F],['scogliera',F],['vulcano',M],['cascata',F],['palma',F],['mangrovia',F],['savana',F],['canyon',M],['grotta',F],['foresta',F],['palude',F],['baia',F],['duna',F],['atollo',M],['sentiero',M],['radura',F],['torrente',M],['ghiacciaio',M],['falesia',F],['cresta',F],['banana',F],['cocco',M],['tempesta',F],['monsone',M],['tramonto',M],['eclissi',F],['uragano',M],['oasi',F],['miraggio',M],['arcipelago',M],['bambù',M],['corallo',M],['marea',F],['valanga',F],['nebbia',F],['luna',F],['meteora',F]];
/* aggettivi di carattere e d'aspetto: [maschile, femminile] */
const AGG = [['ribelle','ribelle'],['gentile','gentile'],['curioso','curiosa'],['furbo','furba'],['pigro','pigra'],['timido','timida'],['sfacciato','sfacciata'],['testardo','testarda'],['nervoso','nervosa'],['distratto','distratta'],['elegante','elegante'],['goffo','goffa'],['astuto','astuta'],['felice','felice'],['malinconico','malinconica'],['coraggioso','coraggiosa'],['permaloso','permalosa'],['saggio','saggia'],['matto','matta'],['scatenato','scatenata'],['sornione','sorniona'],['tranquillo','tranquilla'],['selvaggio','selvaggia'],['misterioso','misteriosa'],['volante','volante'],['storto','storta'],['sospeso','sospesa'],['ruvido','ruvida'],['segreto','segreta'],['notturno','notturna'],['dispettoso','dispettosa'],['impaziente','impaziente'],['birichino','birichina'],['solitario','solitaria'],['ballerino','ballerina'],['acrobata','acrobata'],['lunatico','lunatica'],['gigante','gigante'],['minuscolo','minuscola'],['rovente','rovente'],['gelido','gelida'],['affamato','affamata'],['assonnato','assonnata'],['geloso','gelosa'],['spavaldo','spavalda'],['zuccone','zuccona'],['brontolone','brontolona'],['vanitoso','vanitosa'],['ostinato','ostinata'],['silenzioso','silenziosa'],['capriccioso','capricciosa'],['tenace','tenace'],['leggendario','leggendaria'],['perduto','perduta'],['ubriaco','ubriaca'],['innamorato','innamorata']];
/* personaggi dei fumetti e personaggi storici: [nome, genere] */
const FUMETTI = [['Topolino',M],['Paperino',M],['Paperone',M],['Gastone',M],['Pippo',M],['Gambadilegno',M],['Archimede',M],['Nonna Papera',F],['Paperinik',M],['Diabolik',M],['Eva Kant',F],['Tex',M],['Zagor',M],['Dylan Dog',M],['Martin Mystère',M],['Nathan Never',M],['Corto Maltese',M],['Lupo Alberto',M],['Cattivik',M],['Mafalda',F],['Asterix',M],['Obelix',M],['Tintin',M],['Braccio di Ferro',M],['Olivia',F],['Charlie Brown',M],['Snoopy',M],['Linus',M],['Lucy',F],['Calvin',M],['Hobbes',M],['Valentina',F],['Sturmtruppen',F],['Alan Ford',M],['Groucho',M],['Satanik',F],['Rat-Man',M],['Pimpa',F],['Tiramolla',M],['Nonna Abelarda',F],['Geppo',M],['Dick Fulmine',M],['Paperoga',M],['Ciccio',M],['Brigitta',F],['Clarabella',F],['Orazio',M],['Minni',F],['Superman',M],['Batman',M],['Wonder Woman',F],['Spider-Man',M],['Hulk',M],['Catwoman',F],['Tarzan',M],['Mandrake',M],['Flash Gordon',M]];
const STORICI = [['Napoleone',M],['Garibaldi',M],['Giulio Cesare',M],['Cleopatra',F],['Nerone',M],['Annibale',M],['Spartaco',M],['Leonardo',M],['Michelangelo',M],['Galileo',M],['Cristoforo Colombo',M],['Marco Polo',M],['Dante',M],['Beatrice',F],['Giovanna d\'Arco',F],['Lucrezia Borgia',F],['Caterina de\' Medici',F],['Lorenzo il Magnifico',M],['Machiavelli',M],['Casanova',M],['Cagliostro',M],['Robin Hood',M],['Re Artù',M],['Carlo Magno',M],['Attila',M],['Gengis Khan',M],['Alessandro Magno',M],['Socrate',M],['Archimede di Siracusa',M],['Pitagora',M],['Ulisse',M],['Ercole',M],['Achille',M],['Mozart',M],['Beethoven',M],['Einstein',M],['Darwin',M],['Marie Curie',F],['Frida Kahlo',F],['Amelia Earhart',F],['Mata Hari',F],['Caravaggio',M],['Verdi',M],['Rossini',M],['Paganini',M],['Montessori',F],['Rita Levi-Montalcini',F],['Messner',M],['Bonatti',M],['Mallory',M],['Tenzing',M],['Bonaparte',M]];
/* esclamazioni: da sole, o con una parola d'arrampicata */
const ESCL = ['Mamma mia!','Mannaggia!','Accipicchia!','Caspita!','Perbacco!','Santo cielo!','Ammazza!','Daje!','Evvai!','Uffa!','Boh!','Mizzica!','Orca!','Ma dai!','Che fatica!','Aiuto!','Che spettacolo!','Porca miseria!','Cribbio!','Ostrega!','Belin!','Maremma!','Eccheccavolo!','Olè!','Ahia!','Ops!','Toh!','Vai così!','Non mollare!','Forza e coraggio!','Ce la fai!','Allez!','Chi l\'ha visto?','Ci vediamo in cima!','Tieni duro!','Che botta!','Puff!','Zac!','Bum!','Gulp!','Sigh!','Argh!','Smack!','Yuppi!','Urrà!'];
const PAROLE = [['tacca',F],['svaso',M],['volume',M],['ribaltamento',M],['tallonaggio',M],['strapiombo',M],['dulfer',M],['bidito',M],['monodito',M],['lancio',M],['incrocio',M],['dinamico',M],['spigolo',M],['diedro',M],['tetto',M],['placca',F],['fessura',F],['pinza',F],['rovescio',M],['magnesite',F],['caduta',F],['sosta',F],['uscita',F],['partenza',F],['catena',F]];
/* cose che possono capitare ai personaggi: "La Vendetta di Diabolik", "Lo Sbadiglio di Napoleone" */
const VICENDE = [['vendetta',F],['segreto',M],['sbadiglio',M],['ritorno',M],['sogno',M],['salto',M],['scivolone',M],['volo',M],['tesoro',M],['scherzo',M],['merenda',F],['siesta',F],['fuga',F],['sfida',F],['rivincita',F],['gita',F],['paura',F],['furia',F],['pazienza',F],['tentazione',F],['promessa',F],['scommessa',F],['corsa',F],['nostalgia',F],['impresa',F],['ultima mossa',F],['grande giorno',M],['primo tiro',M],['passo falso',M],['colpo di genio',M]];
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
const person = () => pick(Math.random() < 0.5 ? FUMETTI : STORICI);
function one(style){
  const sw = STILE[style];
  const r = Math.random();
  /* spunto dallo stile (se c'è), anche coi personaggi */
  if(sw && r < 0.35){
    const [x, gx] = pick(sw);
    if(Math.random() < 0.4){ const [p] = person(); return art(x, gx) + cap(x) + ' di ' + p; }
    const [y, gy] = pick(ANIMALI.concat(AMBIENTI)); return art(x, gx) + cap(x) + ' ' + di(y, gy) + cap(y);
  }
  const k = Math.random();
  if(k < 0.18){ const [n, g] = pick(ANIMALI.concat(AMBIENTI)); return cap(n) + ' ' + cap(adj(g)); }
  if(k < 0.30){ const [x, gx] = pick(AMBIENTI), [y, gy] = pick(ANIMALI); return art(x, gx) + cap(x) + ' ' + di(y, gy) + cap(y); }
  if(k < 0.38){ const [n, g] = pick(ANIMALI); return art(n, g) + cap(n) + ' ' + cap(adj(g)); }
  /* personaggi dei fumetti e storici */
  if(k < 0.52){ const [v, gv] = pick(VICENDE), [p] = person(); return art(v, gv) + v.split(' ').map(cap).join(' ') + ' di ' + p; }
  if(k < 0.64){ const [p, g] = person(); return p + ' ' + cap(adj(g)); }
  if(k < 0.72){ const [p] = person(), [y, gy] = pick(ANIMALI); return p + ' e ' + (gy === F ? (vowel(y) ? "l'" : 'la ') : vowel(y) ? "l'" : lo(y) ? 'lo ' : 'il ') + cap(y); }
  if(k < 0.78){ const [p] = person(), [w, gw] = pick(PAROLE); return p + ' ' + (gw === F ? (vowel(w) ? "sull'" : 'sulla ') : vowel(w) ? "sull'" : lo(w) ? 'sullo ' : 'sul ') + cap(w); }
  /* esclamazioni */
  if(k < 0.90) return pick(ESCL);
  const [w, gw] = pick(PAROLE);
  if(Math.random() < 0.5){ const e = pick(['Mannaggia','Accidenti','Addio','Gloria']); return e + ' ' + (gw === F ? (vowel(w) ? "all'" : 'alla ') : vowel(w) ? "all'" : lo(w) ? 'allo ' : 'al ') + cap(w) + '!'; }
  const e = pick(['Evviva','Viva','Abbasso']); return e + ' ' + art(w, gw).toLowerCase() + cap(w) + '!';
}
window.genCircuitName = function(style, used){
  const u = new Set((used || []).map(s => String(s).toLowerCase()));
  for(let i=0; i<40; i++){ const n = one(style); if(!u.has(n.toLowerCase())) return n; }
  return one(style);
};
})();

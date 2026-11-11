// Revisione indipendente: rifà a mano 20 operazioni della verifica (research/08) senza usare le classi del motore.
// Legge le operazioni dalla cache di 08 (data/backtest/verifica/<firma>/), le candele con leggiStorico e il funding,
// e ricalcola segnale, entrata, unità, percorso minuto per minuto, uscita, motivo, rendimento lordo e netto.
// Dal motore si usa solo rendimentoNetto per riportare il "netto del motore" (il netto mio è calcolato qui a parte).
//
// Uso (dalla cartella del progetto): node --max-old-space-size=8192 research/revisione/rifai-operazioni.js [seme=2026]
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { leggiStorico, leggiFunding } from '../lib/storico.js';
import { leggiColonne } from '../lib/backtest.js';
import { rendimentoNetto } from '../motore/costi.js';

const M = 60000, G = 86400000, Q = 15 * M;
const SEME = Number(process.argv[2]) || 2026;
const SLITT = 0.0008, COMM = 0.0006;          // scenario principale di 08: 0,08% per lato, taker 0,06%
const regola = JSON.parse(readFileSync('data/backtest/regola/regola.json', 'utf8')).regola;
const K = regola.k, FINESTRE = [].concat(regola.N), CFG = regola.config;
const NOMI = { 1: 'stop loss', 2: 'protezione', 3: 'stop che segue', 4: 'durata massima', 5: 'fine dati', 6: 'freno' };

// generatore con seme (diverso da quello del motore, scritto qui)
function lcg(seed) { let x = BigInt(seed); return () => { x = (x * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return Number(x >> 11n) / 2 ** 53; }; }

// ---------- fermi della borsa, dagli stessi rapporti usati da 08 ----------
const fermi = [];
for (const f of ['rapporto-buchi.json', 'rapporto-buchi-prima-2023.json', 'rapporto-buchi-monete-51-100.json'])
  fermi.push(...JSON.parse(readFileSync(join('data', 'binance', f), 'utf8')).fermiBorsa);

// ---------- operazioni del motore ----------
const dirCache = join('data', 'backtest', 'verifica', readdirSync(join('data', 'backtest', 'verifica')).find(d => !d.endsWith('.json')));
const tutte = [];
for (const f of readdirSync(dirCache)) {
  const c = leggiColonne(join(dirCache, f));
  const chiave = f.replace('.bin', '');
  for (let k = 0; k < c.lato.length; k++) tutte.push({ chiave, gruppo: chiave[0], simbolo: chiave.slice(2), k, lato: c.lato[k], motivo: c.motivo[k], entrata: c.entrata[k], uscita: c.uscita[k], prezzo: c.prezzo[k], rapporto: c.rapporto[k], funding: c.funding[k], peggiore: c.peggiore[k], forza: c.forza[k], finestra: c.finestra[k], tutteDellaMoneta: c });
}
// campione: celle (gruppo, lato, motivo), a giro una per cella, a caso dentro la cella; al massimo 2 per moneta
const rnd = lcg(SEME);
const celle = new Map();
for (const o of tutte) { const key = `${o.gruppo}|${o.lato}|${o.motivo}`; (celle.get(key) || celle.set(key, []).get(key)).push(o); }
const chiaviCelle = [...celle.keys()].sort();
const scelte = [], perMoneta = new Map();
for (let giro = 0; scelte.length < 20 && giro < 50; giro++) for (const key of chiaviCelle) {
  if (scelte.length >= 20) break;
  const l = celle.get(key).filter(o => !scelte.includes(o) && (perMoneta.get(o.simbolo) || 0) < 2);
  if (!l.length) continue;
  const o = l[Math.floor(rnd() * l.length)];
  scelte.push(o); perMoneta.set(o.simbolo, (perMoneta.get(o.simbolo) || 0) + 1);
}

// ---------- ricalcolo indipendente ----------
function carica(o) {
  const da = o.gruppo === 'A' ? Date.UTC(2019, 8, 1) : Date.UTC(2023, 0, 1), a = o.gruppo === 'A' ? Date.UTC(2023, 0, 1) : Infinity;
  const s = leggiStorico(o.simbolo, { da, a });
  for (const [t, len] of fermi) for (let j = 0; j < len; j++) { const i = (t - s.t0) / M + j; if (i >= 0 && i < s.n) s.open[i] = s.high[i] = s.low[i] = s.close[i] = NaN; }
  return s;
}

// scarto quadratico (radice della media dei quadrati) dei rendimenti a N minuti nei 14 giorni UTC prima del giorno di t
function sigma(s, t, N) {
  const giorno = Math.floor(t / G) * G, ini = giorno - CFG.giorniVolatilita * G;
  let somma = 0, n = 0;
  for (let tt = ini; tt < giorno; tt += M) {
    const i = (tt - s.t0) / M; if (i < N || i >= s.n) continue;
    const x = s.close[i], y = s.close[i - N]; if (x !== x || y !== y) continue;
    const r = x / y - 1; somma += r * r; n++;
  }
  return n >= CFG.giorniVolatilita * 1440 * 0.8 ? Math.sqrt(somma / n) : NaN;
}
// segnale alla chiusura del minuto i: { dir, N, forza } o null
function segnale(s, i, cacheSig) {
  const t = s.t0 + i * M, c = s.close[i]; if (c !== c) return null;
  let trovato = null;
  for (const N of FINESTRE) {
    if (i - N < 0) continue;
    const b = s.close[i - N]; if (b !== b) continue;
    const key = `${Math.floor(t / G)}|${N}`;
    if (!cacheSig.has(key)) cacheSig.set(key, sigma(s, t, N));
    const sg = cacheSig.get(key); if (!(sg > 0)) continue;
    const r = c / b - 1;
    if (Math.abs(r) < K * sg) continue;
    if (trovato && Math.sign(r) !== trovato.dir) return null; // direzioni opposte
    if (!trovato) trovato = { dir: Math.sign(r), N, forza: Math.abs(r) / sg };
  }
  return trovato;
}
// ATR di Wilder (14) sulle candele da 15 minuti chiuse prima di tE, in prezzo
function atr15(s, tE) {
  const qIni = Math.floor(s.t0 / Q) * Q, qFine = Math.floor(tE / Q) * Q; // candele [qIni, qFine) chiuse
  let a = NaN, cPrima = NaN, cont = 0;
  for (let q = qIni; q < qFine; q += Q) {
    let h = -Infinity, l = Infinity, c = NaN;
    for (let tt = q; tt < q + Q; tt += M) { const i = (tt - s.t0) / M; if (i < 0 || i >= s.n || s.close[i] !== s.close[i]) continue; h = Math.max(h, s.high[i]); l = Math.min(l, s.low[i]); c = s.close[i]; }
    if (c !== c) continue;
    const tr = cPrima !== cPrima ? h - l : Math.max(h - l, Math.abs(h - cPrima), Math.abs(l - cPrima));
    cont++;
    a = cont <= 14 ? (cont === 1 ? tr : a + (tr - a) / cont) : (a * 13 + tr) / 14;
    cPrima = c;
  }
  return cont >= 14 ? a : NaN;
}
// percorso a prezzi: livello d'uscita in prezzo, aggiornato con il miglior prezzo raggiunto
function simula(s, iE, lato, u) {
  const P = s.open[iE], R = CFG.regole;
  const stopLoss = P * (1 - lato * R.stop * u);
  let migliore = P, livello = stopLoss, tipo = 1, peggiore = P;
  const meglio = (x, y) => lato * (x - y) > 0;  // x migliore di y per la posizione
  const aggiorna = () => {
    const gMax = lato * (migliore / P - 1);
    if (gMax < R.attivaDa * u) return;
    let lv = stopLoss, tp = 1;
    const seg = P * (1 + lato * (gMax - R.segue * u));            if (meglio(seg, lv)) { lv = seg; tp = 3; }
    const pro = P * (1 + lato * gMax * (1 - R.restituisci));     if (meglio(pro, lv)) { lv = pro; tp = 2; }
    if (meglio(lv, livello)) { livello = lv; tipo = tp; }
  };
  const fine = iE + CFG.durataMassima;
  for (let k = iE; k < s.n; k++) {
    const o = s.open[k], h = s.high[k], l = s.low[k], c = s.close[k];
    if (o !== o) continue;                                         // minuto senza prezzo: lo salto
    const t = s.t0 + k * M;
    if (k >= fine) return { uscita: o, t, motivo: 4, peggiore };   // durata massima: all'apertura
    // apertura: se è già oltre il livello si esce lì
    if (!meglio(o, livello)) { peggiore = meglio(peggiore, o) ? o : peggiore; return { uscita: o, t, motivo: tipo, peggiore }; }
    if (meglio(o, migliore)) { migliore = o; aggiorna(); }
    if (!meglio(peggiore, o)) {} else peggiore = o;
    const percorso = Math.abs(h - o) < Math.abs(l - o) ? [o, h, l, c] : [o, l, h, c];
    for (let j = 1; j < 4; j++) {
      const da = percorso[j - 1], aP = percorso[j];
      if (!meglio(da, aP)) {                                       // tratto favorevole (o piatto)
        if (meglio(aP, migliore)) { migliore = aP; aggiorna(); }
      } else {                                                     // tratto sfavorevole
        if (!meglio(aP, livello)) { if (meglio(peggiore, livello)) peggiore = livello; return { uscita: livello, t, motivo: tipo, peggiore }; }
        if (meglio(peggiore, aP)) peggiore = aP;
      }
    }
  }
  let k = s.n - 1; while (k > 0 && s.close[k] !== s.close[k]) k--;
  return { uscita: s.close[k], t: s.t0 + k * M, motivo: 5, peggiore };
}
function funding(simbolo, lato, da, a) {
  const f = leggiFunding(simbolo) || [];
  return lato * f.filter(([t]) => t > da && t <= a).reduce((x, [, r]) => x + r, 0);
}
function nettoMio(lato, P, X, fund) {
  const fillE = lato === 1 ? P * (1 + SLITT) : P * (1 - SLITT);
  const fillU = lato === 1 ? X * (1 - SLITT) : X * (1 + SLITT);
  const valE = 1, valU = fillU / fillE;                 // nozionale in uscita rispetto a quello d'entrata
  const pnl = lato === 1 ? valU - valE : valE - valU;   // long: vendo a valU; short: ricompro a valU
  return pnl - COMM * valE - COMM * valU - fund;
}

const righe = [];
const perChiave = Object.groupBy(scelte, o => o.chiave);
for (const [chiave, ops] of Object.entries(perChiave)) {
  const s = carica(ops[0]);
  const cacheSig = new Map();
  for (const o of ops) {
    const iE = (o.entrata - s.t0) / M, iS = iE - 1;
    const sg = segnale(s, iS, cacheSig);
    // nessun segnale prima, dalla fine della pausa precedente al minuto del segnale (il motore deve prendere il primo)
    const c = o.tutteDellaMoneta;
    const prec = [...c.entrata].filter(e => e < o.entrata).sort((x, y) => y - x)[0];
    const libera = prec !== undefined ? (prec - s.t0) / M + CFG.durataMassima + 1 : FINESTRE.reduce((x, y) => Math.max(x, y)) + 241;
    let primoMancato = null;
    for (let i = Math.max(libera, iS - 3 * 1440); i < iS; i++) { const x = segnale(s, i, cacheSig); if (x && s.open[i + 1] === s.open[i + 1]) { primoMancato = s.t0 + i * M; break; } }
    const P = s.open[iE];
    const atr = atr15(s, o.entrata), u = atr / P;
    const lato = sg ? sg.dir : 0;
    const sim = simula(s, iE, lato || o.lato, u);
    const fund = funding(o.simbolo, o.lato, o.entrata, sim.t);
    const lordoMio = (lato || o.lato) * (sim.uscita / P - 1);
    const lordoMot = o.lato * (o.rapporto - 1);
    const piccola = true; // tutte le monete di A e B tranne poche: allo 0,08% base e piccole coincidono
    righe.push({
      chiave, entrata: new Date(o.entrata).toISOString().slice(0, 16).replace('T', ' '),
      latoMot: o.lato, latoMio: lato, finMot: o.finestra, finMio: sg?.N, forzaMot: o.forza, forzaMio: sg?.forza,
      prezzoMot: o.prezzo, prezzoMio: P, unitaMio: u,
      uscitaMot: new Date(o.uscita).toISOString().slice(0, 16).replace('T', ' '), uscitaMio: new Date(sim.t).toISOString().slice(0, 16).replace('T', ' '),
      motivoMot: NOMI[o.motivo], motivoMio: NOMI[sim.motivo],
      prezzoUscMot: o.prezzo * o.rapporto, prezzoUscMio: sim.uscita,
      lordoMot, lordoMio, fundMot: o.funding, fundMio: fund,
      nettoMot: rendimentoNetto(o.lato, o.rapporto, SLITT, o.funding), nettoMio: nettoMio(lato || o.lato, P, sim.uscita, fund),
      peggioreMot: o.peggiore, peggioreMio: lato ? Math.max(0, -(lato * (sim.peggiore / P - 1))) : NaN,
      primoMancato: primoMancato ? new Date(primoMancato).toISOString().slice(0, 16) : null,
      distanzaPrec: prec !== undefined ? (o.entrata - prec) / M : null,
    });
  }
}
righe.sort((a, b) => a.chiave.localeCompare(b.chiave) || a.entrata.localeCompare(b.entrata));
mkdirSync(join('data', 'revisione'), { recursive: true });
writeFileSync(join('data', 'revisione', 'operazioni-rifatte.json'), JSON.stringify(righe, null, 1));

// stampa
const p = x => (x * 100).toFixed(4) + '%';
let maxDiff = 0, diverse = 0;
for (const r of righe) {
  const d = Math.abs(r.nettoMot - r.nettoMio);
  maxDiff = Math.max(maxDiff, d);
  const ok = r.latoMot === r.latoMio && r.finMot === r.finMio && r.prezzoMot === r.prezzoMio && r.uscitaMot === r.uscitaMio && r.motivoMot === r.motivoMio && d < 1e-6 && !r.primoMancato;
  if (!ok) diverse++;
  console.log(`${ok ? 'OK ' : 'DIF'} ${r.chiave} ${r.entrata} lato ${r.latoMot}/${r.latoMio} fin ${r.finMot}/${r.finMio} forza ${r.forzaMot.toFixed(2)}/${r.forzaMio?.toFixed(2)} P ${r.prezzoMot}/${r.prezzoMio} u ${p(r.unitaMio)} usc ${r.uscitaMot}/${r.uscitaMio} ${r.motivoMot}/${r.motivoMio} X ${r.prezzoUscMot.toPrecision(8)}/${r.prezzoUscMio.toPrecision(8)} lordo ${p(r.lordoMot)}/${p(r.lordoMio)} fund ${p(r.fundMot)}/${p(r.fundMio)} netto ${p(r.nettoMot)}/${p(r.nettoMio)} pegg ${p(r.peggioreMot)}/${p(r.peggioreMio)} mancato ${r.primoMancato} dist ${r.distanzaPrec}`);
}
console.log(`\n${righe.length} operazioni, ${diverse} con differenze, differenza massima sul netto ${p(maxDiff)}`);

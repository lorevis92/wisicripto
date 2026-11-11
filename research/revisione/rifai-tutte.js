// Revisione indipendente: rigenera TUTTE le operazioni della verifica (research/08) con codice scritto qui,
// senza le classi del motore, e le confronta con la cache di 08. Poi misura quanto pesa l'ordine dei punti
// dentro la candela da 1 minuto (regola "estremo più vicino prima" contro "estremo sfavorevole prima").
// Riporta solo differenze tra le due versioni, non il risultato della strategia.
//
// Uso (dalla cartella del progetto): node --max-old-space-size=8192 research/revisione/rifai-tutte.js
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { leggiStorico, leggiFunding } from '../lib/storico.js';
import { leggiColonne } from '../lib/backtest.js';

const M = 60000, G = 86400000, Q = 15 * M;
const regola = JSON.parse(readFileSync('data/backtest/regola/regola.json', 'utf8')).regola;
const K = regola.k, FINESTRE = [].concat(regola.N), CFG = regola.config, R = CFG.regole;
const fermi = [];
for (const f of ['rapporto-buchi.json', 'rapporto-buchi-prima-2023.json', 'rapporto-buchi-monete-51-100.json'])
  fermi.push(...JSON.parse(readFileSync(join('data', 'binance', f), 'utf8')).fermiBorsa);
const dirCache = join('data', 'backtest', 'verifica', readdirSync(join('data', 'backtest', 'verifica')).find(d => !d.endsWith('.json')));

function carica(gruppo, simbolo) {
  const da = gruppo === 'A' ? Date.UTC(2019, 8, 1) : Date.UTC(2023, 0, 1), a = gruppo === 'A' ? Date.UTC(2023, 0, 1) : Infinity;
  const s = leggiStorico(simbolo, { da, a });
  for (const [t, len] of fermi) for (let j = 0; j < len; j++) { const i = (t - s.t0) / M + j; if (i >= 0 && i < s.n) s.open[i] = s.high[i] = s.low[i] = s.close[i] = NaN; }
  return s;
}
// sigma per giorno e finestra: radice della media dei quadrati dei rendimenti a N minuti dei 14 giorni precedenti
function sigmaGiorni(s, N) {
  const gIni = Math.floor(s.t0 / G), gFine = Math.floor((s.t0 + (s.n - 1) * M) / G);
  const sq = new Map(), cn = new Map();
  for (let i = N; i < s.n; i++) {
    const x = s.close[i], y = s.close[i - N]; if (x !== x || y !== y) continue;
    const g = Math.floor((s.t0 + i * M) / G), r = x / y - 1;
    sq.set(g, (sq.get(g) || 0) + r * r); cn.set(g, (cn.get(g) || 0) + 1);
  }
  const out = new Map();
  for (let g = gIni; g <= gFine; g++) {
    let a = 0, b = 0;
    for (let j = g - CFG.giorniVolatilita; j < g; j++) { a += sq.get(j) || 0; b += cn.get(j) || 0; }
    out.set(g, b >= CFG.giorniVolatilita * 1440 * 0.8 ? Math.sqrt(a / b) : NaN);
  }
  return out;
}
// ATR di Wilder 14 sulle candele da 15 minuti; atrPrima[q] = ATR dopo la candela q-1 (chiusa prima dell'inizio di q)
function atrQuarti(s) {
  const q0 = Math.floor(s.t0 / Q) * Q, nq = Math.ceil((s.t0 + s.n * M - q0) / Q);
  const fine = new Float64Array(nq).fill(NaN);
  let a = NaN, cP = NaN, cont = 0;
  for (let q = 0; q < nq; q++) {
    let h = -Infinity, l = Infinity, c = NaN;
    for (let j = 0; j < 15; j++) { const i = (q0 + q * Q + j * M - s.t0) / M; if (i < 0 || i >= s.n || s.close[i] !== s.close[i]) continue; h = Math.max(h, s.high[i]); l = Math.min(l, s.low[i]); c = s.close[i]; }
    if (c === c) {
      const tr = cP !== cP ? h - l : Math.max(h - l, Math.abs(h - cP), Math.abs(l - cP));
      cont++; a = cont <= 14 ? (cont === 1 ? tr : a + (tr - a) / cont) : (a * 13 + tr) / 14; cP = c;
    }
    fine[q] = cont >= 14 ? a : NaN;
  }
  return t => { const q = Math.floor((t - q0) / Q) - 1; return q >= 0 && q < nq ? fine[q] : NaN; };
}
// percorso: 'vicino' = estremo più vicino all'apertura prima (regola del motore); 'sfavorevole' = estremo contrario prima;
// 'favorevole' = estremo a favore prima
function simula(s, iE, lato, u, modo) {
  const P = s.open[iE], sl = P * (1 - lato * R.stop * u);
  let best = P, lv = sl, tipo = 1, peggiore = 0;
  const g = x => lato * (x / P - 1);
  const aggiorna = () => {
    const gm = g(best); if (gm < R.attivaDa * u) return;
    let l = sl, t = 1;
    const a = P * (1 + lato * (gm - R.segue * u)); if (g(a) > g(l)) { l = a; t = 3; }
    const b = P * (1 + lato * gm * (1 - R.restituisci)); if (g(b) > g(l)) { l = b; t = 2; }
    if (g(l) > g(lv)) { lv = l; tipo = t; }
  };
  const fine = iE + CFG.durataMassima;
  for (let k = iE; k < s.n; k++) {
    const o = s.open[k], h = s.high[k], l = s.low[k], c = s.close[k];
    if (o !== o) continue;
    const t = s.t0 + k * M;
    if (k >= fine) return { X: o, t, motivo: 4, peggiore: Math.max(peggiore, -g(o)), minuti: k - iE };
    if (g(o) <= g(lv)) return { X: o, t, motivo: tipo, peggiore: Math.max(peggiore, -g(o)), minuti: k - iE };
    peggiore = Math.max(peggiore, -g(o));
    if (g(o) > g(best)) { best = o; aggiorna(); }
    let primoAlto;
    if (modo === 'vicino') primoAlto = Math.abs(h - o) < Math.abs(l - o);
    else if (modo === 'sfavorevole') primoAlto = lato === -1;
    else primoAlto = lato === 1;
    const pts = primoAlto ? [o, h, l, c] : [o, l, h, c];
    for (let j = 1; j < 4; j++) {
      const a = pts[j - 1], b = pts[j];
      if (g(b) >= g(a)) { if (g(b) > g(best)) { best = b; aggiorna(); } }
      else if (g(b) <= g(lv)) return { X: lv, t, motivo: tipo, peggiore: Math.max(peggiore, -g(lv)), minuti: k - iE };
      else peggiore = Math.max(peggiore, -g(b));
    }
  }
  let k = s.n - 1; while (k > 0 && s.close[k] !== s.close[k]) k--;
  return { X: s.close[k], t: s.t0 + k * M, motivo: 5, peggiore, minuti: k - iE };
}

const stat = { motore: 0, mie: 0, uguali: 0, soloMotore: 0, soloMie: 0, diverse: [], vicinoSfav: { n: 0, cambiate: 0, diff: 0 }, vicinoFav: { diff: 0, cambiate: 0 },
  uscitaNelMinutoEntrata: 0, conBuchi: 0, conFermi: 0, oltreLiquidazione3: 0, oltreLiquidazione5: 0, stopOltreLiq3: 0, uscitaConSalto: 0, sbilancioSalto: 0 };
const fermiSet = new Set(); for (const [t, len] of fermi) for (let j = 0; j < len; j++) fermiSet.add(t + j * M);
const dettagli = [];
for (const f of readdirSync(dirCache).sort()) {
  const chiave = f.replace('.bin', ''), gruppo = chiave[0], simbolo = chiave.slice(2);
  const c = leggiColonne(join(dirCache, f));
  const s = carica(gruppo, simbolo);
  if (!s || s.n < 30 * 1440) { stat.motore += c.lato.length; stat.soloMotore += c.lato.length; continue; }
  const sig = Object.fromEntries(FINESTRE.map(N => [N, sigmaGiorni(s, N)]));
  const atr = atrQuarti(s);
  const fund = (leggiFunding(simbolo) || []).filter(([t]) => t >= s.t0 && t < (gruppo === 'A' ? Date.UTC(2023, 0, 1) : Infinity));
  const Nmax = Math.max(...FINESTRE);
  const mie = [];
  let libera = 0;
  for (let i = Nmax + 241; i < s.n - 1; i++) {
    if (i < libera) continue;
    const a = s.close[i]; if (a !== a) continue;
    const gg = Math.floor((s.t0 + i * M) / G);
    let dir = 0, Nsc = 0, opposte = false;
    for (const N of FINESTRE) {
      const b = s.close[i - N]; if (b !== b) continue;
      const sg = sig[N].get(gg); if (!(sg > 0)) continue;
      const r = a / b - 1; if (Math.abs(r) < K * sg) continue;
      if (dir && Math.sign(r) !== dir) { opposte = true; break; }
      if (!dir) { dir = Math.sign(r); Nsc = N; }
    }
    if (!dir || opposte) continue;
    const iE = i + 1;
    libera = Math.max(i + CFG.pausa, iE + CFG.durataMassima + 1);
    if (s.open[iE] !== s.open[iE]) continue;
    const tE = s.t0 + iE * M, P = s.open[iE], u = atr(tE) / P;
    if (!(u > 0)) continue;
    const lato = regola.direzione === 'segui' ? dir : -dir;
    const v = simula(s, iE, lato, u, 'vicino');
    const tieni = gruppo === 'A' ? tE >= Date.UTC(2020, 0, 1) && v.t < Date.UTC(2023, 0, 1) - M : true;
    if (!tieni) continue;
    const sf = simula(s, iE, lato, u, 'sfavorevole'), fa = simula(s, iE, lato, u, 'favorevole');
    let fp = 0; for (const [t, r] of fund) if (t > tE && t <= v.t) fp += r;
    let buchi = 0, inFermo = 0;
    for (let k = iE; k <= iE + v.minuti; k++) { if (s.open[k] !== s.open[k]) buchi++; if (fermiSet.has(s.t0 + k * M)) inFermo++; }
    mie.push({ tE, lato, N: Nsc, P, u, v, sf, fa, funding: lato * fp, buchi, inFermo });
  }
  // confronto con il motore
  const perT = new Map(mie.map(x => [x.tE, x]));
  stat.motore += c.lato.length; stat.mie += mie.length;
  const visti = new Set();
  for (let k = 0; k < c.lato.length; k++) {
    const x = perT.get(c.entrata[k]);
    if (!x) { stat.soloMotore++; stat.diverse.push(`${chiave} ${new Date(c.entrata[k]).toISOString()} solo nel motore`); continue; }
    visti.add(x.tE);
    const ok = x.lato === c.lato[k] && x.N === c.finestra[k] && x.P === c.prezzo[k] && x.v.t === c.uscita[k] && x.v.motivo === c.motivo[k]
      && Math.abs(x.v.X / x.P - c.rapporto[k]) < 1e-12 && Math.abs(x.funding - c.funding[k]) < 1e-6 && Math.abs(x.v.peggiore - c.peggiore[k]) < 1e-5;
    if (ok) stat.uguali++; else stat.diverse.push(`${chiave} ${new Date(x.tE).toISOString()} lato ${x.lato}/${c.lato[k]} N ${x.N}/${c.finestra[k]} usc ${x.v.t}/${c.uscita[k]} mot ${x.v.motivo}/${c.motivo[k]} rap ${x.v.X / x.P}/${c.rapporto[k]} fund ${x.funding}/${c.funding[k]} pegg ${x.v.peggiore}/${c.peggiore[k]}`);
  }
  for (const x of mie) if (!visti.has(x.tE)) { stat.soloMie++; stat.diverse.push(`${chiave} ${new Date(x.tE).toISOString()} solo nel mio`); }
  // sensibilità all'ordine dentro la candela
  for (const x of mie) {
    const lv = x.lato * (x.v.X / x.P - 1), ls = x.lato * (x.sf.X / x.P - 1), lf = x.lato * (x.fa.X / x.P - 1);
    stat.vicinoSfav.n++; stat.vicinoSfav.diff += ls - lv; if (Math.abs(ls - lv) > 1e-12) stat.vicinoSfav.cambiate++;
    stat.vicinoFav.diff += lf - lv; if (Math.abs(lf - lv) > 1e-12) stat.vicinoFav.cambiate++;
    if (x.v.minuti === 0) stat.uscitaNelMinutoEntrata++;
    if (x.buchi) stat.conBuchi++;
    if (x.inFermo) stat.conFermi++;
    if (x.v.peggiore >= 0.9 / 3) stat.oltreLiquidazione3++;
    if (x.v.peggiore >= 0.9 / 5) stat.oltreLiquidazione5++;
    if (R.stop * x.u >= 0.9 / 3) stat.stopOltreLiq3++;
    // uscita con salto (apertura già oltre il livello): il prezzo d'uscita è l'apertura, peggiore del livello
    if (x.v.motivo !== 4 && x.v.motivo !== 5 && x.v.X === s.open[(x.v.t - s.t0) / M] && x.v.minuti > 0) stat.uscitaConSalto++;
  }
  console.log(`${chiave}: motore ${c.lato.length}, mie ${mie.length}`);
}
const n = stat.vicinoSfav.n;
const riass = {
  operazioniMotore: stat.motore, operazioniMie: stat.mie, uguali: stat.uguali, soloMotore: stat.soloMotore, soloMie: stat.soloMie,
  esempiDiverse: stat.diverse.slice(0, 30),
  percorso: {
    operazioni: n,
    cambianoConSfavorevolePrima: stat.vicinoSfav.cambiate, differenzaMediaLordoSfavorevoleMenoMotore: stat.vicinoSfav.diff / n,
    cambianoConFavorevolePrima: stat.vicinoFav.cambiate, differenzaMediaLordoFavorevoleMenoMotore: stat.vicinoFav.diff / n,
  },
  uscitaNelMinutoEntrata: stat.uscitaNelMinutoEntrata, conMinutiMancanti: stat.conBuchi, conFermiDellaBorsa: stat.conFermi,
  peggioreOltre30: stat.oltreLiquidazione3, peggioreOltre18: stat.oltreLiquidazione5, stopOltreLiquidazioneLeva3: stat.stopOltreLiq3, usciteConSalto: stat.uscitaConSalto,
};
mkdirSync(join('data', 'revisione'), { recursive: true });
writeFileSync(join('data', 'revisione', 'rifai-tutte.json'), JSON.stringify(riass, null, 1));
console.log(JSON.stringify(riass, null, 1));

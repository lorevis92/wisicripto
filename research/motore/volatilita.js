// Volatilità recente di una moneta, calcolata solo su giorni già chiusi.
// Misura: media dell'escursione giornaliera vera (true range) in percentuale, sugli ultimi `giorni` giorni UTC.

const MIN = 60000, GIORNO = 86400000;

/**
 * @param {object} s storico da leggiStorico (griglia a 1 minuto con t0, n, high, low, close)
 * @param {number} [giorni=14]
 * @returns {(t:number)=>number} funzione: istante → volatilità (frazione) nota in quel momento, NaN se non c'è abbastanza storia
 */
export function volatilitaGiornaliera(s, giorni = 14) {
  const g0 = Math.floor(s.t0 / GIORNO) * GIORNO;
  const nGiorni = Math.ceil((s.t0 + s.n * MIN - g0) / GIORNO);
  const tr = new Float64Array(nGiorni).fill(NaN);
  let chiusuraPrima = NaN;
  for (let d = 0; d < nGiorni; d++) {
    let h = -Infinity, l = Infinity, c = NaN, minuti = 0;
    const i0 = Math.max(0, (g0 + d * GIORNO - s.t0) / MIN), i1 = Math.min(s.n, (g0 + (d + 1) * GIORNO - s.t0) / MIN);
    for (let i = i0; i < i1; i++) {
      if (Number.isNaN(s.close[i])) continue;
      if (s.high[i] > h) h = s.high[i];
      if (s.low[i] < l) l = s.low[i];
      c = s.close[i]; minuti++;
    }
    if (minuti < 1000) { if (!Number.isNaN(c)) chiusuraPrima = c; continue; } // giorno incompleto: non lo uso
    const base = Number.isNaN(chiusuraPrima) ? (h + l) / 2 : chiusuraPrima;
    tr[d] = (Math.max(h, base) - Math.min(l, base)) / base;
    chiusuraPrima = c;
  }
  // media mobile sui `giorni` giorni precedenti (il giorno in corso è escluso)
  const media = new Float64Array(nGiorni).fill(NaN);
  for (let d = giorni; d < nGiorni; d++) {
    let somma = 0, k = 0;
    for (let j = d - giorni; j < d; j++) if (!Number.isNaN(tr[j])) { somma += tr[j]; k++; }
    if (k >= giorni * 0.8) media[d] = somma / k;
  }
  return t => {
    const d = Math.floor((t - g0) / GIORNO);
    return d >= 0 && d < nGiorni ? media[d] : NaN;
  };
}

// ---------------------------------------------------------------------------------------------
// "Unità" di volatilità come in Wisi Trade (shared/engine.js, prepFromBars):
//   unità = il maggiore tra ATR (Wilder, 14) sulle candele da 15 minuti e il range medio della prima candela
//   da 15 minuti dopo l'apertura della sessione negli ultimi 10 giorni. È in prezzo; il motore la usa in frazione.
// Sulle crypto le candele da 15 minuti sono di tutte le 24 ore (in Wisi Trade solo l'orario di borsa).
// ---------------------------------------------------------------------------------------------
const Q = 15 * MIN;

/**
 * Prepara le candele da 15 minuti e l'ATR di Wilder.
 * @returns {{ atrPrima:(t:number)=>number, range15:(t:number)=>number }}
 *   atrPrima(t): ATR dopo l'ultima candela da 15 minuti chiusa prima di t (in prezzo, NaN se non c'è abbastanza storia)
 *   range15(t): massimo − minimo della candela da 15 minuti che comincia a t (NaN se mancano dati)
 */
export function candele15(s) {
  const q0 = Math.floor(s.t0 / Q) * Q;
  const nq = Math.ceil((s.t0 + s.n * MIN - q0) / Q);
  const h = new Float64Array(nq).fill(NaN), l = new Float64Array(nq).fill(NaN), c = new Float64Array(nq).fill(NaN);
  for (let i = 0; i < s.n; i++) {
    if (Number.isNaN(s.close[i])) continue;
    const k = Math.floor((s.t0 + i * MIN - q0) / Q);
    if (Number.isNaN(h[k]) || s.high[i] > h[k]) h[k] = s.high[i];
    if (Number.isNaN(l[k]) || s.low[i] < l[k]) l[k] = s.low[i];
    c[k] = s.close[i];
  }
  const atr = new Float64Array(nq).fill(NaN);
  let a = NaN, prevC = NaN, contate = 0;
  for (let k = 0; k < nq; k++) {
    if (Number.isNaN(c[k])) { atr[k] = a; continue; }
    const tr = Number.isNaN(prevC) ? h[k] - l[k] : Math.max(h[k] - l[k], Math.abs(h[k] - prevC), Math.abs(l[k] - prevC));
    a = contate < 14 ? (Number.isNaN(a) ? tr : a + (tr - a) / (contate + 1)) : (a * 13 + tr) / 14;
    contate++; prevC = c[k];
    atr[k] = contate >= 14 ? a : NaN;
  }
  return {
    atrPrima: t => { const k = Math.floor((t - q0) / Q) - 1; return k >= 0 && k < nq ? atr[k] : NaN; },
    range15: t => { const k = (t - q0) / Q; return Number.isInteger(k) && k >= 0 && k < nq ? h[k] - l[k] : NaN; },
  };
}

// Tiene il range della prima candela da 15 minuti delle ultime 10 aperture di una sessione e calcola l'unità.
export class UnitaSessione {
  constructor(c15, giorni = 10, minimo = 5) { this.c15 = c15; this.giorni = giorni; this.minimo = minimo; this.storia = new Map(); }
  // unità (in prezzo) nota all'apertura `t` della sessione `id`: usa solo aperture precedenti
  unita(id, t) {
    const lista = this.storia.get(id) || [];
    const atr = this.c15.atrPrima(t);
    const atrApertura = lista.length >= this.minimo ? lista.reduce((x, y) => x + y, 0) / lista.length : NaN;
    if (Number.isNaN(atr)) return NaN;
    return Number.isNaN(atrApertura) ? atr : Math.max(atr, atrApertura);
  }
  // da chiamare dopo l'apertura, quando la sua prima candela da 15 minuti è chiusa (qui: subito, ma è usata solo dalle aperture successive)
  registra(id, t) {
    const r = this.c15.range15(t);
    if (Number.isNaN(r)) return;
    const lista = this.storia.get(id) || [];
    lista.push(r); if (lista.length > this.giorni) lista.shift();
    this.storia.set(id, lista);
  }
}

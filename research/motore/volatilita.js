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

// Misure di un risultato: rendimento, profit factor, peggior calo, giorno peggiore, numero di operazioni,
// guadagno medio per operazione al netto dei costi.

/**
 * @param {ReturnType<import('./portafoglio.js').simulaPortafoglio>} r
 * @param {number} capitale capitale iniziale
 */
export function metrichePortafoglio(r, capitale) {
  let vinte = 0, perse = 0, sommaNetto = 0, positive = 0;
  for (const p of r.prese) {
    if (p.pnl > 0) { vinte += p.pnl; positive++; } else perse -= p.pnl;
    sommaNetto += p.netto;
  }
  let picco = capitale, calo = 0;
  for (const [, c] of r.curva) { if (c > picco) picco = c; calo = Math.max(calo, (picco - c) / picco); }
  let giornoPeggiore = 0, giornoPeggioreData = null, giorniFrenati = 0;
  for (const [g, x] of r.giorni) {
    const v = x.pnl / x.inizio;
    if (v < giornoPeggiore) { giornoPeggiore = v; giornoPeggioreData = g; }
    if (x.bloccato) giorniFrenati++;
  }
  const n = r.prese.length;
  return {
    rendimento: r.capitaleFinale / capitale - 1,
    profitFactor: perse > 0 ? vinte / perse : (vinte > 0 ? Infinity : NaN),
    caloMassimo: calo,
    giornoPeggiore, giornoPeggioreData,
    operazioni: n,
    vincenti: n ? positive / n : NaN,
    medioNetto: n ? sommaNetto / n : NaN, // frazione del nozionale
    giorniFrenati, rovina: r.rovina,
  };
}

// Media di più risultati (es. 10 ordini casuali): media campo per campo dei numeri
export function mediaMetriche(lista) {
  const out = {};
  for (const k of Object.keys(lista[0])) {
    const v = lista.map(x => x[k]);
    out[k] = typeof v[0] === 'number' ? v.reduce((s, x) => s + x, 0) / v.length : v[0];
  }
  out.rovina = lista.some(x => x.rovina);
  return out;
}

// Misure sulle singole operazioni (senza portafoglio): utile per confrontare gruppi
export function metricheOperazioni(netti) {
  let v = 0, p = 0, s = 0, pos = 0;
  for (const x of netti) { s += x; if (x > 0) { v += x; pos++; } else p -= x; }
  const n = netti.length;
  return { operazioni: n, medioNetto: n ? s / n : NaN, profitFactor: p > 0 ? v / p : NaN, vincenti: n ? pos / n : NaN, somma: s };
}

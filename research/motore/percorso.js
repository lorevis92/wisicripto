// Percorso del prezzo dentro una candela da 1 minuto.
// Con le sole candele non sappiamo cosa sia successo prima. Regola usata (la stessa di Wisi Trade, shared/opening.js
// pathOf, "come su TradingView"): se l'apertura è più vicina al massimo il prezzo fa apertura → massimo → minimo → chiusura,
// altrimenti apertura → minimo → massimo → chiusura.
// Nella Fase 1 (Prova e Reale) lo stesso motore riceverà i prezzi veri al posto di questi 4 punti.

export function puntiCandela(o, h, l, c) {
  return puntiCandelaIn(new Float64Array(4), o, h, l, c);
}

// Come puntiCandela ma scrive in un array già esistente (nei backtest evita milioni di allocazioni)
// `modo` (per le prove di sensibilità): 'vicino' = regola di Wisi Trade; 'sfavorevole' / 'favorevole' = l'estremo
// contrario / a favore della posizione di lato `lato` sempre per primo.
export function puntiCandelaIn(out, o, h, l, c, lato = 0, modo = 'vicino') {
  out[0] = o; out[3] = c;
  const altoPrima = modo === 'sfavorevole' ? lato === -1 : modo === 'favorevole' ? lato === 1 : Math.abs(h - o) < Math.abs(l - o);
  if (altoPrima) { out[1] = h; out[2] = l; } else { out[1] = l; out[2] = h; }
  return out;
}

// Percorso del prezzo dentro una candela da 1 minuto.
// Con le sole candele non sappiamo cosa sia successo prima: usiamo la regola classica
//   candela in salita (chiusura > apertura): apertura → minimo → massimo → chiusura
//   candela in discesa o piatta:             apertura → massimo → minimo → chiusura
// cioè si suppone che prima ci sia stato il movimento contrario alla chiusura. Per chi segue
// la rottura è la scelta prudente: lo stop viene toccato prima del guadagno.
// Nella Fase 1 (Prova e Reale) lo stesso motore riceverà i prezzi veri al posto di questi 4 punti.

export function puntiCandela(o, h, l, c) {
  return puntiCandelaIn(new Float64Array(4), o, h, l, c);
}

// Come puntiCandela ma scrive in un array già esistente (nei backtest evita milioni di allocazioni)
export function puntiCandelaIn(out, o, h, l, c) {
  out[0] = o; out[3] = c;
  if (c > o) { out[1] = l; out[2] = h; } else { out[1] = h; out[2] = l; }
  return out;
}

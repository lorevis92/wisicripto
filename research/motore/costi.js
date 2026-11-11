// Costi di un'operazione: commissione e slittamento per lato, funding.

export const COMMISSIONE = 0.0006; // Bitunix, circa 0,06% per lato (taker)

/**
 * Rendimento netto sul valore della posizione (nozionale), costi compresi.
 * @param {1|-1} lato
 * @param {number} rapporto prezzo d'uscita / prezzo d'entrata, prima dello slittamento
 * @param {number} slittamento per lato, in frazione
 * @param {number} funding costo del funding in frazione del nozionale (positivo = pagato)
 * @param {number} [commissione]
 */
export function rendimentoNetto(lato, rapporto, slittamento, funding, commissione = COMMISSIONE) {
  if (lato === 1) {
    const r = rapporto * (1 - slittamento) / (1 + slittamento); // compro più caro, vendo più basso
    return r - 1 - commissione * (1 + r) - funding;
  }
  const r = rapporto * (1 + slittamento) / (1 - slittamento); // vendo più basso, ricompro più caro
  return 1 - r - commissione * (1 + r) - funding;
}

/**
 * Funding pagato da una posizione aperta tra `entrata` (escluso) e `uscita` (incluso), in frazione del nozionale.
 * Il tasso positivo lo pagano i long agli short. `pagamenti` è ordinato: [[tempo_ms, tasso], ...].
 * Si usa il nozionale d'entrata (approssimazione: per durate di ore la differenza è trascurabile).
 */
export function fundingPagato(pagamenti, lato, entrata, uscita) {
  let lo = 0, hi = pagamenti.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (pagamenti[m][0] <= entrata) lo = m + 1; else hi = m; }
  let s = 0;
  for (let i = lo; i < pagamenti.length && pagamenti[i][0] <= uscita; i++) s += pagamenti[i][1];
  return lato * s;
}

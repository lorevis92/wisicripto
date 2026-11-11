// Costi di un'operazione: commissione e slittamento per lato, funding.
// Commissioni Bitunix futures VIP 0 (verificate su bitunix.com/service/handling-fee, novembre 2026):
// maker 0,02% (ordine limite che resta nel book), taker 0,06% (ordine a mercato o che si esegue subito).

export const COMMISSIONE = 0.0006;        // taker
export const COMMISSIONE_MAKER = 0.0002;  // maker

/**
 * Rendimento netto sul valore della posizione (nozionale), costi compresi. Per lato si può dare
 * commissione e slittamento diversi (es. entrata a ordine limite: maker e senza slittamento; uscita a mercato).
 * @param {1|-1} lato
 * @param {number} rapporto prezzo d'uscita / prezzo d'entrata, prima dello slittamento
 * @param {object} c { slittEntrata, slittUscita, commEntrata, commUscita, funding } (frazioni; funding positivo = pagato)
 */
export function nettoOperazione(lato, rapporto, { slittEntrata, slittUscita, commEntrata = COMMISSIONE, commUscita = COMMISSIONE, funding = 0 }) {
  // valore d'uscita in proporzione al valore d'entrata eseguito
  const r = lato === 1
    ? rapporto * (1 - slittUscita) / (1 + slittEntrata)     // compro più caro, vendo più basso
    : rapporto * (1 + slittUscita) / (1 - slittEntrata);    // vendo più basso, ricompro più caro
  return lato * (r - 1) - commEntrata - commUscita * r - funding;
}

// Caso più comune: stesso slittamento e commissione taker sui due lati
export function rendimentoNetto(lato, rapporto, slittamento, funding, commissione = COMMISSIONE) {
  return nettoOperazione(lato, rapporto, { slittEntrata: slittamento, slittUscita: slittamento, commEntrata: commissione, commUscita: commissione, funding });
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

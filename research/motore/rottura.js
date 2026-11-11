// Ingresso a rottura dall'apertura di sessione.
// All'apertura il riferimento è il prezzo d'apertura. Durante la finestra d'entrata, se il prezzo si allontana
// dal riferimento di `soglia`, si entra nella direzione del movimento.
// L'entrata è considerata eseguita solo se il prezzo supera il livello di almeno `margine` (es. 0,15%):
// le punte di Binance non sempre arrivano su Bitunix (docs/bitunix-vs-binance.md). Il prezzo d'entrata è il livello
// (ordine stop), oppure l'apertura del minuto se il prezzo ci è già saltato oltre.

export class RilevatoreRottura {
  /**
   * @param {object} p
   * @param {number} p.riferimento prezzo d'apertura della sessione
   * @param {number} p.soglia distanza dal riferimento, in frazione
   * @param {number} p.margine superamento richiesto oltre il livello, in frazione
   * @param {boolean} [p.long=true] @param {boolean} [p.short=true]
   */
  constructor({ riferimento, soglia, margine, long = true, short = true }) {
    this.su = riferimento * (1 + soglia); this.giu = riferimento * (1 - soglia);
    this.confermaSu = this.su * (1 + margine); this.confermaGiu = this.giu * (1 - margine);
    this.long = long; this.short = short;
  }

  // Esamina i punti di un minuto. Restituisce null oppure { lato, prezzo, indice, puntoConferma }:
  // `indice` è il punto d'arrivo del tratto in cui avviene la conferma, `puntoConferma` il prezzo dove avviene.
  minuto(punti) {
    const o = punti[0];
    if (this.long && o >= this.confermaSu) return { lato: 1, prezzo: o, indice: 0, puntoConferma: o };
    if (this.short && o <= this.confermaGiu) return { lato: -1, prezzo: o, indice: 0, puntoConferma: o };
    for (let k = 1; k < punti.length; k++) {
      const a = punti[k - 1], b = punti[k];
      if (this.long && b > a && b >= this.confermaSu && a < this.confermaSu) {
        return { lato: 1, prezzo: Math.max(this.su, o), indice: k - 1, puntoConferma: this.confermaSu };
      }
      if (this.short && b < a && b <= this.confermaGiu && a > this.confermaGiu) {
        return { lato: -1, prezzo: Math.min(this.giu, o), indice: k - 1, puntoConferma: this.confermaGiu };
      }
    }
    return null;
  }
}

// Una posizione aperta e le sue regole d'uscita (come in Wisi Trade):
//   - stop iniziale a distanza R dal prezzo d'entrata
//   - protezione del guadagno: quando il guadagno arriva a `protezione.attivaA`·R, lo stop sale a +`protezione.blocca`
//   - stop che segue: quando il guadagno arriva a `segue.attivaA`·R, lo stop segue il miglior prezzo a distanza `segue.distanza`·R
//   - durata massima: gestita da chi usa la posizione (chiusura all'apertura di un minuto dato)
//
// Tutto è espresso come "guadagno" g = lato·(prezzo/entrata − 1): così long e short usano lo stesso codice.
// Il prezzo si muove a tratti lineari (vedi percorso.js); su un tratto favorevole lo stop può solo salire,
// su un tratto sfavorevole lo stop resta fermo e si controlla se viene toccato.

export const MOTIVI = { stop: 1, protezione: 2, segue: 3, tempo: 4, fineDati: 5 };
export const NOMI_MOTIVI = Object.fromEntries(Object.entries(MOTIVI).map(([k, v]) => [v, k]));

export class Posizione {
  /**
   * @param {object} p
   * @param {1|-1} p.lato 1 = long, -1 = short
   * @param {number} p.entrata prezzo d'entrata (prima dello slittamento)
   * @param {number} p.tempo ms UTC del minuto d'entrata
   * @param {number} p.R distanza dello stop iniziale, in frazione (0.01 = 1%)
   * @param {object} p.regole { protezione: { attivaA, blocca }, segue: { attivaA, distanza } } (attivaA e distanza in multipli di R, blocca in frazione)
   */
  constructor({ lato, entrata, tempo, R, regole }) {
    this.lato = lato; this.entrata = entrata; this.tempoEntrata = tempo; this.R = R; this.regole = regole;
    this.gStop = -R; this.tipoStop = MOTIVI.stop;
    this.gMigliore = 0; this.gPeggiore = 0;
    this.chiusa = false; this.uscita = null; this.tempoUscita = null; this.motivo = null;
  }

  guadagno(prezzo) { return this.lato * (prezzo / this.entrata - 1); }
  prezzo(g) { return this.entrata * (1 + this.lato * g); }

  #aggiornaStop() {
    const { protezione, segue } = this.regole;
    if (protezione && this.gMigliore >= protezione.attivaA * this.R && protezione.blocca > this.gStop) {
      this.gStop = protezione.blocca; this.tipoStop = MOTIVI.protezione;
    }
    if (segue && this.gMigliore >= segue.attivaA * this.R) {
      const g = this.gMigliore - segue.distanza * this.R;
      if (g > this.gStop) { this.gStop = g; this.tipoStop = MOTIVI.segue; }
    }
  }

  #chiudi(prezzo, tempo, motivo) {
    this.chiusa = true; this.uscita = prezzo; this.tempoUscita = tempo; this.motivo = motivo;
  }

  // Il prezzo salta a `p` (apertura di un minuto): se è già oltre lo stop si esce lì, al prezzo peggiore.
  salto(p, tempo) {
    if (this.chiusa) return;
    const g = this.guadagno(p);
    if (g <= this.gStop) { this.gPeggiore = Math.min(this.gPeggiore, g); this.#chiudi(p, tempo, this.tipoStop); return; }
    this.gPeggiore = Math.min(this.gPeggiore, g);
    if (g > this.gMigliore) { this.gMigliore = g; this.#aggiornaStop(); }
  }

  // Il prezzo va in linea retta da `da` ad `a` dentro il minuto `tempo`.
  tratto(da, a, tempo) {
    if (this.chiusa) return;
    const gA = this.guadagno(a);
    if (gA >= this.guadagno(da)) {
      if (gA > this.gMigliore) { this.gMigliore = gA; this.#aggiornaStop(); }
    } else if (gA <= this.gStop) {
      this.gPeggiore = Math.min(this.gPeggiore, this.gStop);
      this.#chiudi(this.prezzo(this.gStop), tempo, this.tipoStop);
    } else {
      this.gPeggiore = Math.min(this.gPeggiore, gA);
    }
  }

  // Elabora i punti di un minuto a partire dal punto `i` (con prezzo di partenza `partenza`, se si entra a metà tratto).
  minuto(punti, tempo, i = 0, partenza = null) {
    if (i === 0 && partenza === null) { this.salto(punti[0], tempo); partenza = punti[0]; }
    let p = partenza;
    for (let k = i + 1; k < punti.length && !this.chiusa; k++) { this.tratto(p, punti[k], tempo); p = punti[k]; }
  }

  // Uscita decisa altrove (durata massima, fine dati): si esegue al prezzo dato (di solito l'apertura del minuto).
  chiudiA(prezzo, tempo, motivo) {
    if (!this.chiusa) this.#chiudi(prezzo, tempo, motivo);
  }
}

// Una posizione aperta e le sue regole d'uscita, con le stesse definizioni di Wisi Trade (shared/opening.js, exitLevel e walk).
//
// Tutto è misurato in "unità" di volatilità della moneta (u, in frazione del prezzo d'entrata; vedi volatilita.js):
//   - stop loss a `stop` unità dall'entrata (Attuale: 1,5);
//   - finché il guadagno massimo è sotto `attivaDa` unità (0,5) resta lo stop loss;
//   - poi il livello d'uscita è il migliore tra:
//       stop loss,
//       stop che segue: miglior prezzo meno `segue` unità (Attuale: 1),
//       protezione del guadagno: si esce se si restituisce la quota `restituisci` del guadagno massimo (Attuale: 40%);
//   - durata massima: gestita da chi usa la posizione (chiusura all'apertura di un minuto dato).
//
// Si lavora con il "guadagno" g = lato·(prezzo/entrata − 1): long e short usano lo stesso codice.
// Il prezzo si muove a tratti lineari (percorso.js): su un tratto favorevole il livello può solo salire,
// su un tratto sfavorevole il livello resta fermo e si controlla se viene toccato. È lo stesso risultato di
// Wisi Trade, che controlla il livello a ogni punto del percorso e poi aggiorna il miglior prezzo.

export const MOTIVI = { stop: 1, protezione: 2, segue: 3, tempo: 4, fineDati: 5, freno: 6 };
export const NOMI_MOTIVI = { 1: 'stop loss', 2: 'protezione del guadagno', 3: 'stop che segue', 4: 'durata massima', 5: 'fine dati', 6: 'freno' };

// Regole della configurazione "Attuale" di Wisi Trade
export const REGOLE_ATTUALE = { stop: 1.5, attivaDa: 0.5, segue: 1, restituisci: 0.4 };

export class Posizione {
  /**
   * @param {object} p
   * @param {1|-1} p.lato 1 = long, -1 = short
   * @param {number} p.entrata prezzo d'entrata
   * @param {number} p.tempo ms UTC del minuto d'entrata
   * @param {number} p.unita unità di volatilità, in frazione del prezzo (0.01 = 1%)
   * @param {object} p.regole { stop, attivaDa, segue, restituisci } (in unità; restituisci in frazione del guadagno)
   */
  constructor({ lato, entrata, tempo, unita, regole }) {
    this.lato = lato; this.entrata = entrata; this.tempoEntrata = tempo; this.u = unita; this.regole = regole;
    this.gStopLoss = -regole.stop * unita;
    this.gStop = this.gStopLoss; this.tipoStop = MOTIVI.stop;
    this.gMigliore = 0; this.gPeggiore = 0;
    this.chiusa = false; this.uscita = null; this.tempoUscita = null; this.motivo = null;
  }

  guadagno(prezzo) { return this.lato * (prezzo / this.entrata - 1); }
  prezzo(g) { return this.entrata * (1 + this.lato * g); }

  #aggiornaStop() {
    const { attivaDa, segue, restituisci } = this.regole, u = this.u, g = this.gMigliore;
    if (g < attivaDa * u) return;
    let livello = this.gStopLoss, tipo = MOTIVI.stop;
    if (segue > 0) { const x = g - segue * u; if (x > livello) { livello = x; tipo = MOTIVI.segue; } }
    if (restituisci > 0) { const x = g * (1 - restituisci); if (x > livello) { livello = x; tipo = MOTIVI.protezione; } }
    if (livello > this.gStop) { this.gStop = livello; this.tipoStop = tipo; }
  }

  #chiudi(prezzo, tempo, motivo) {
    this.chiusa = true; this.uscita = prezzo; this.tempoUscita = tempo; this.motivo = motivo;
  }

  // Il prezzo salta a `p` (apertura di un minuto): se è già oltre il livello d'uscita si esce lì, al prezzo peggiore.
  salto(p, tempo) {
    if (this.chiusa) return;
    const g = this.guadagno(p);
    this.gPeggiore = Math.min(this.gPeggiore, g);
    if (g <= this.gStop) { this.#chiudi(p, tempo, this.tipoStop); return; }
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
    if (!this.chiusa) { this.gPeggiore = Math.min(this.gPeggiore, this.guadagno(prezzo)); this.#chiudi(prezzo, tempo, motivo); }
  }
}

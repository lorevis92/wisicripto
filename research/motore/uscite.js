// Uscite di una posizione già aperta, sui prezzi veri dentro il minuto (aggTrades), con regole diverse da confrontare.
//
// Due tipi di livello:
//   - sulla borsa (istantanei, toccati a ogni prezzo): stop loss a `stop` unità e, se c'è, obiettivo a `obiettivo` unità.
//     Si esce al livello; se il minuto apre già oltre il livello, all'apertura.
//   - dell'app (stop che segue, protezione del guadagno, durata): con controllo = 'prezzo' si controllano a ogni prezzo
//     (come il motore del backtest, Posizione); con controllo = 'chiusura' l'app guarda solo la chiusura di ogni minuto,
//     come Wisi Trade nel Reale: il miglior prezzo è la migliore chiusura, l'uscita decisa a fine minuto si esegue
//     all'apertura del minuto dopo.
// Le definizioni dei livelli dell'app sono quelle di Wisi Trade (posizione.js): da `attivaDa` unità di guadagno massimo,
// livello = il migliore tra stop loss, miglior guadagno − `segue` unità, e (1 − `restituisci`) × miglior guadagno.
// `segue` = 0 o `restituisci` = 0 spengono quel livello. `durata`: uscita all'apertura del minuto entrata + durata.
//
// Misure per l'analisi: guadagno massimo e peggiore fino all'uscita (sui prezzi veri) e dopo quanti minuti.

import { puntiCandelaIn } from './percorso.js';

const MIN = 60000;
export const MOTIVI_USCITA = { stop: 1, protezione: 2, segue: 3, tempo: 4, fineDati: 5, obiettivo: 7 };
export const NOMI_USCITA = { 1: 'stop loss', 2: 'protezione del guadagno', 3: 'stop che segue', 4: 'tempo', 5: 'fine dati', 7: 'obiettivo' };

/**
 * @param {object} p
 * @param {object} p.s storico (O, H, L, C, t0, n)
 * @param {number} p.iE indice del minuto d'entrata (entrata all'apertura)
 * @param {1|-1} p.lato
 * @param {number} p.u unità (frazione del prezzo d'entrata)
 * @param {Map<number, number[]>|null} p.percorsi prezzi veri per minuto (tempo → prezzi in ordine)
 * @param {object} p.r { stop, obiettivo, attivaDa, segue, restituisci, durata, controllo }
 */
export function simulaUscita({ s, iE, lato, u, percorsi, r }) {
  const { open: O, high: H, low: L, close: C, t0, n } = s;
  const P = O[iE];
  const G = p => lato * (p / P - 1);
  const prezzoDi = g => P * (1 + lato * g);
  const gStop = -r.stop * u, gObiettivo = r.obiettivo > 0 ? r.obiettivo * u : Infinity;
  let migliore = 0, livelloApp = gStop, tipoApp = MOTIVI_USCITA.stop; // livello dell'app (con 'prezzo' è istantaneo)
  const istantaneo = r.controllo === 'prezzo';
  let mfe = 0, mae = 0, tMfe = 0, tMae = 0, veri = 0, stimati = 0, inAttesa = null;
  const punti = new Float64Array(4);
  const aggiorna = g => {
    if (g <= migliore) return;
    migliore = g;
    if (migliore < r.attivaDa * u) return;
    let liv = gStop, tipo = MOTIVI_USCITA.stop;
    if (r.segue > 0 && migliore - r.segue * u > liv) { liv = migliore - r.segue * u; tipo = MOTIVI_USCITA.segue; }
    if (r.restituisci > 0 && migliore * (1 - r.restituisci) > liv) { liv = migliore * (1 - r.restituisci); tipo = MOTIVI_USCITA.protezione; }
    if (liv > livelloApp) { livelloApp = liv; tipoApp = tipo; }
  };
  const esci = (prezzo, k, motivo) => ({ uscita: prezzo, rapporto: prezzo / P, tUscita: t0 + k * MIN, motivo, mfe, mae, tMfe, tMae, minuti: k - iE, veri, stimati, migliore });
  const segna = (g, k) => {
    if (g > mfe) { mfe = g; tMfe = k - iE; }
    if (g < mae) { mae = g; tMae = k - iE; }
  };
  for (let k = iE; k < n; k++) {
    if (Number.isNaN(O[k])) continue;
    if (k >= iE + r.durata) { segna(G(O[k]), k); return esci(O[k], k, MOTIVI_USCITA.tempo); }
    if (inAttesa) { segna(G(O[k]), k); return esci(O[k], k, inAttesa); }
    const t = t0 + k * MIN;
    const vero = percorsi && percorsi.get(t);
    let pts;
    if (vero) { veri++; pts = [O[k], ...vero]; } else { stimati++; pts = Array.from(puntiCandelaIn(punti, O[k], H[k], L[k], C[k])); }
    // livello sotto cui si esce subito: stop loss sulla borsa, più quello dell'app se controllata a ogni prezzo
    const sotto = () => (istantaneo ? Math.max(gStop, livelloApp) : gStop);
    const tipoSotto = () => (istantaneo && livelloApp > gStop ? tipoApp : MOTIVI_USCITA.stop);
    // apertura del minuto (salto)
    const g0 = G(pts[0]);
    segna(g0, k);
    if (g0 <= sotto()) return esci(pts[0], k, tipoSotto());
    if (g0 >= gObiettivo) return esci(pts[0], k, MOTIVI_USCITA.obiettivo);
    if (istantaneo) aggiorna(g0);
    for (let j = 1; j < pts.length; j++) {
      const gA = G(pts[j - 1]), gB = G(pts[j]);
      if (gB >= gA) {
        if (gB >= gObiettivo) { segna(gObiettivo, k); return esci(prezzoDi(gObiettivo), k, MOTIVI_USCITA.obiettivo); }
        segna(gB, k);
        if (istantaneo) aggiorna(gB);
      } else {
        const liv = sotto();
        if (gB <= liv) { segna(liv, k); return esci(prezzoDi(liv), k, tipoSotto()); }
        segna(gB, k);
      }
    }
    // chiusura del minuto: l'app decide, si esegue all'apertura del minuto dopo
    if (!istantaneo) {
      const gC = G(C[k]);
      aggiorna(gC);
      if (gC <= livelloApp && livelloApp > gStop) inAttesa = tipoApp;
    }
  }
  let k = n - 1; while (k > iE && Number.isNaN(C[k])) k--;
  return esci(C[k], k, MOTIVI_USCITA.fineDati);
}

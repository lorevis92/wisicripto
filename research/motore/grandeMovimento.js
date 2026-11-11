// Strategia "grande movimento": segnali e operazioni di una moneta, minuto per minuto, solo con dati passati.
//
// Segnale alla chiusura del minuto i: il rendimento degli ultimi N minuti supera k volte il movimento normale a N minuti
// (scarto quadratico dei rendimenti a N minuti dei `giorniVolatilita` giorni precedenti, aggiornato una volta al giorno).
// N può essere un numero o un elenco (es. [15, 60]: basta che uno dei due superi la soglia; se due finestre danno
// direzioni opposte nello stesso minuto, nessun segnale).
// Entrata a mercato all'apertura del minuto dopo. Uscite come Wisi Trade (Posizione, unità = ATR a 15 minuti).
// Dopo un segnale la moneta non ne apre un altro per `pausa` minuti e comunque non prima che la posizione sia chiusa.
// Conferme facoltative: trend1h, trend4h, btc, rottura24h, tiene (vedi research/06-grande-movimento.js).

import { puntiCandelaIn } from './percorso.js';
import { Posizione, MOTIVI } from './posizione.js';
import { fundingPagato } from './costi.js';
import { candele15 } from './volatilita.js';

const MIN = 60000, GIORNO = 86400000;

// Movimento normale a N minuti, aggiornato una volta al giorno con i giorni precedenti (il giorno in corso è escluso)
export function movimentoNormale(C, t0, n, N, giorni) {
  const g0 = Math.floor(t0 / GIORNO) * GIORNO, nG = Math.ceil((t0 + n * MIN - g0) / GIORNO);
  const somma = new Float64Array(nG), conta = new Float64Array(nG);
  for (let i = N; i < n; i++) {
    const a = C[i], b = C[i - N];
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    const d = Math.floor((t0 + i * MIN - g0) / GIORNO), r = a / b - 1;
    somma[d] += r * r; conta[d]++;
  }
  const sigma = new Float64Array(nG).fill(NaN);
  for (let d = giorni; d < nG; d++) {
    let s = 0, c = 0;
    for (let j = d - giorni; j < d; j++) { s += somma[j]; c += conta[j]; }
    if (c >= giorni * 1440 * 0.8) sigma[d] = Math.sqrt(s / c);
  }
  return i => sigma[Math.floor((t0 + i * MIN - g0) / GIORNO)];
}

/**
 * @param {object} p
 * @param {object} p.s storico della moneta (griglia a 1 minuto, fermi già senza prezzo)
 * @param {object|null} [p.btc] storico di BTC (solo per la conferma "btc"; null per BTC stesso)
 * @param {Array} p.funding pagamenti di funding [[t, tasso], ...]
 * @param {Array} p.varianti [{ id, N (numero o elenco), k, direzione: 'segui'|'contro', conferma }]
 * @param {object} p.config { giorniVolatilita, pausa, durataMassima, regole, tieneMinuti, tieneQuota, btcMultiplo }
 * @returns {object} colonne come array: variante, lato, motivo, entrata, uscita, prezzo, rapporto, funding, peggiore, unita, forza, finestra
 */
export function operazioniGrandeMovimento({ s, btc = null, funding, varianti, config }) {
  const { open: O, high: H, low: L, close: C, t0, n } = s;
  const c15 = candele15(s);
  const tutteN = [...new Set(varianti.flatMap(v => [].concat(v.N)))];
  const sig = Object.fromEntries(tutteN.map(N => [N, movimentoNormale(C, t0, n, N, config.giorniVolatilita)]));
  let rifBtc = null;
  if (btc && varianti.some(v => v.conferma === 'btc')) {
    const sh = (t0 - btc.t0) / MIN;
    rifBtc = { C: i => btc.close[i + sh], sig: Object.fromEntries(tutteN.map(N => { const f = movimentoNormale(btc.close, btc.t0, btc.n, N, config.giorniVolatilita); return [N, i => f(i + sh)]; })) };
  }
  let max24 = null, min24 = null;
  if (varianti.some(v => v.conferma === 'rottura24h')) {
    max24 = new Float64Array(n).fill(NaN); min24 = new Float64Array(n).fill(NaN); // max/min di [i-1440, i)
    const dqM = [], dqm = [];
    for (let i = 0; i < n; i++) {
      while (dqM.length && dqM[0] < i - 1440) dqM.shift();
      while (dqm.length && dqm[0] < i - 1440) dqm.shift();
      if (i >= 1440) { if (dqM.length) max24[i] = H[dqM[0]]; if (dqm.length) min24[i] = L[dqm[0]]; }
      if (!Number.isNaN(H[i])) { while (dqM.length && H[dqM[dqM.length - 1]] <= H[i]) dqM.pop(); dqM.push(i); }
      if (!Number.isNaN(L[i])) { while (dqm.length && L[dqm[dqm.length - 1]] >= L[i]) dqm.pop(); dqm.push(i); }
    }
  }
  const conferma = (tipo, i, N, dir) => {
    switch (tipo) {
      case 'nessuna': case 'tiene': return true; // "tiene" si controlla dopo
      case 'trend1h': case 'trend4h': {
        const L0 = tipo === 'trend1h' ? 60 : 240, a = C[i - N], b = C[i - N - L0];
        return !Number.isNaN(a) && !Number.isNaN(b) && Math.sign(a - b) === dir;
      }
      case 'btc': {
        if (!rifBtc) return false;
        const a = rifBtc.C(i), b = rifBtc.C(i - N), sg = rifBtc.sig[N](i);
        if (Number.isNaN(a) || Number.isNaN(b) || !(sg > 0)) return false;
        const r = a / b - 1;
        return Math.sign(r) === dir && Math.abs(r) >= config.btcMultiplo * sg;
      }
      case 'rottura24h': { const j = i - N; return j >= 0 && (dir > 0 ? C[i] > max24[j] : C[i] < min24[j]); }
      default: throw new Error(`conferma sconosciuta: ${tipo}`);
    }
  };

  const out = { variante: [], lato: [], motivo: [], entrata: [], uscita: [], prezzo: [], rapporto: [], funding: [], peggiore: [], unita: [], forza: [], finestra: [] };
  const punti = new Float64Array(4);
  for (const v of varianti) {
    const finestre = [].concat(v.N), Nmax = Math.max(...finestre);
    let liberaDa = 0;
    for (let i = Nmax + 241; i < n - 1; i++) {
      if (i < liberaDa) continue;
      const a = C[i];
      if (Number.isNaN(a)) continue;
      // quale finestra scatta
      let dirMov = 0, Nsc = 0, forza = 0, b = NaN, conflitto = false;
      for (const N of finestre) {
        const bb = C[i - N]; if (Number.isNaN(bb)) continue;
        const r = a / bb - 1, sg = sig[N](i);
        if (!(sg > 0) || Math.abs(r) < v.k * sg) continue;
        if (dirMov && Math.sign(r) !== dirMov) { conflitto = true; break; }
        if (!dirMov) { dirMov = Math.sign(r); Nsc = N; forza = Math.abs(r) / sg; b = bb; }
      }
      if (!dirMov || conflitto) continue;
      if (!conferma(v.conferma, i, Nsc, dirMov)) continue;
      let iE = i + 1;
      if (v.conferma === 'tiene') {
        const j = i + config.tieneMinuti;
        if (j >= n - 1 || Number.isNaN(C[j]) || (C[j] - b) / (a - b) < config.tieneQuota) continue;
        iE = j + 1;
      }
      liberaDa = Math.max(i + config.pausa, iE + config.durataMassima + 1); // niente sovrapposizioni sulla stessa moneta
      if (Number.isNaN(O[iE])) continue;
      const lato = v.direzione === 'segui' ? dirMov : -dirMov;
      const tE = t0 + iE * MIN, prezzo = O[iE];
      const u = c15.atrPrima(tE) / prezzo;
      if (!(u > 0)) continue;
      const pos = new Posizione({ lato, entrata: prezzo, tempo: tE, unita: u, regole: config.regole });
      pos.minuto(puntiCandelaIn(punti, O[iE], H[iE], L[iE], C[iE]), tE);
      const iFine = iE + config.durataMassima;
      for (let k = iE + 1; k < n && !pos.chiusa; k++) {
        if (Number.isNaN(O[k])) continue;
        const t = t0 + k * MIN;
        if (k >= iFine) { pos.chiudiA(O[k], t, MOTIVI.tempo); break; }
        pos.minuto(puntiCandelaIn(punti, O[k], H[k], L[k], C[k]), t);
      }
      if (!pos.chiusa) { let k = n - 1; while (k > 0 && Number.isNaN(C[k])) k--; pos.chiudiA(C[k], t0 + k * MIN, MOTIVI.fineDati); }
      out.variante.push(v.id); out.lato.push(lato); out.motivo.push(pos.motivo);
      out.entrata.push(tE); out.uscita.push(pos.tempoUscita); out.prezzo.push(prezzo); out.rapporto.push(pos.uscita / prezzo);
      out.funding.push(fundingPagato(funding, lato, tE, pos.tempoUscita)); out.peggiore.push(-pos.gPeggiore); out.unita.push(u);
      out.forza.push(forza); out.finestra.push(Nsc);
    }
  }
  return out;
}

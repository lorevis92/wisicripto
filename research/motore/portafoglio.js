// Gestione del capitale: posti limitati, margine per posizione, leva, freno giornaliero,
// dimensione fissa o interesse composto, ordine casuale per i segnali simultanei.
//
// Ingresso: elenco di operazioni già simulate una per una (entrata, uscita, lato, rendimento netto).
// Ogni operazione apre una posizione con margine = quota·capitale e nozionale = margine·leva.
// Margine ISOLATO: la perdita massima di una posizione è il suo margine (liquidazione).

import { rendimentoNetto } from './costi.js';

const GIORNO = 86400000;

// Generatore casuale con seme (per ripetere gli stessi "ordini casuali")
export function casuale(seme) {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @typedef {object} Operazione
 * @property {number} entrata ms UTC del minuto d'entrata
 * @property {number} uscita ms UTC del minuto d'uscita
 * @property {1|-1} lato
 * @property {number} rapporto prezzo uscita / prezzo entrata (prima dello slittamento)
 * @property {number} funding frazione del nozionale pagata (positivo = costo)
 * @property {number} peggiore massimo movimento contrario (frazione, positivo)
 * @property {number} simbolo indice della moneta
 * @property {boolean} piccola moneta con slittamento minimo più alto
 */

/**
 * @param {Operazione[]} ops ordinate per entrata
 * @param {object} o
 * @param {number} [o.capitale=10000]
 * @param {number} [o.posti=10]
 * @param {number} [o.quota=0.1] margine per posizione, in frazione del capitale
 * @param {number} [o.leva=3]
 * @param {number} [o.freno=0.08] perdita giornaliera (realizzata) che blocca nuove entrate fino al giorno dopo
 * @param {boolean} [o.composto=false] true = margine sul capitale attuale; false = sul capitale iniziale
 * @param {number} o.slittamento slittamento per lato
 * @param {number} [o.slittamentoPiccole] minimo per le monete piccole
 * @param {number} [o.seme=1] seme dell'ordine casuale per gli ingressi nello stesso minuto
 * @returns {{ prese: object[], capitaleFinale: number, curva: number[][], giorni: Map<number, object>, rovina: boolean }}
 */
export function simulaPortafoglio(ops, o) {
  const { capitale = 10000, posti = 10, quota = 0.1, leva = 3, freno = 0.08, composto = false, slittamento, seme = 1 } = o;
  const slittPiccole = Math.max(slittamento, o.slittamentoPiccole ?? slittamento);
  const rnd = casuale(seme);
  let cap = capitale;
  const aperte = []; // { op, nozionale, netto }
  const prese = [];
  const curva = [[ops.length ? ops[0].entrata : 0, cap]];
  const giorni = new Map(); // giorno → { inizio, pnl, bloccato }
  let rovina = false;

  const giorno = t => {
    const g = Math.floor(t / GIORNO) * GIORNO;
    let x = giorni.get(g);
    if (!x) { x = { inizio: cap, pnl: 0, bloccato: false }; giorni.set(g, x); }
    return x;
  };
  const chiudiFinoA = t => {
    // uscite prima delle entrate: chiudo tutto ciò che esce entro il minuto t, in ordine di uscita
    for (;;) {
      let k = -1;
      for (let i = 0; i < aperte.length; i++) if (aperte[i].op.uscita <= t && (k < 0 || aperte[i].op.uscita < aperte[k].op.uscita)) k = i;
      if (k < 0) break;
      const p = aperte.splice(k, 1)[0];
      const pnl = p.nozionale * p.netto;
      const g = giorno(p.op.uscita);
      cap += pnl; g.pnl += pnl;
      if (g.pnl <= -freno * g.inizio) g.bloccato = true;
      curva.push([p.op.uscita, cap]);
      prese.push({ ...p.op, nozionale: p.nozionale, netto: p.netto, pnl });
      if (cap <= 0) rovina = true;
    }
  };

  let i = 0;
  while (i < ops.length && !rovina) {
    const t = ops[i].entrata;
    let j = i; while (j < ops.length && ops[j].entrata === t) j++;
    chiudiFinoA(t);
    const g = giorno(t);
    // segnali dello stesso minuto in ordine casuale
    const gruppo = ops.slice(i, j);
    for (let k = gruppo.length - 1; k > 0; k--) { const r = Math.floor(rnd() * (k + 1)); [gruppo[k], gruppo[r]] = [gruppo[r], gruppo[k]]; }
    for (const op of gruppo) {
      if (aperte.length >= posti || g.bloccato || cap <= 0) break;
      if (aperte.some(a => a.op.simbolo === op.simbolo)) continue;
      const margine = quota * (composto ? cap : capitale);
      const nozionale = margine * leva;
      const s = op.piccola ? slittPiccole : slittamento;
      let netto = rendimentoNetto(op.lato, op.rapporto, s, op.funding);
      if (op.peggiore >= 0.9 / leva) netto = -1 / leva; // liquidazione: si perde il margine
      netto = Math.max(netto, -1 / leva);
      aperte.push({ op, nozionale, netto });
    }
    i = j;
  }
  chiudiFinoA(Infinity);
  prese.sort((a, b) => a.uscita - b.uscita);
  return { prese, capitaleFinale: cap, curva, giorni, rovina };
}

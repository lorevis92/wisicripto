// Gestione del capitale: posti limitati, margine per posizione, leva, freno giornaliero,
// dimensione fissa o interesse composto, ordine casuale per i segnali simultanei.
//
// Ingresso: elenco di operazioni già simulate una per una (entrata, uscita, lato, prezzo, rapporto d'uscita).
// Ogni operazione apre una posizione con margine = quota·capitale e nozionale = margine·leva.
// Margine ISOLATO: la perdita massima di una posizione è il suo margine (liquidazione).
//
// Freno giornaliero come in Wisi Trade (shared/engine.js, lossCheck e "freno di mercato"): a ogni minuto, dopo le uscite,
// perdita del giorno = operazioni chiuse oggi + posizioni aperte valutate alla chiusura del minuto. Se arriva a
// `freno` × capitale d'inizio giornata, si chiude tutto all'apertura del minuto dopo (con slittamento) e non si apre
// più nulla fino al giorno UTC successivo.

import { nettoOperazione, COMMISSIONE, COMMISSIONE_MAKER } from './costi.js';
import { MOTIVI } from './posizione.js';

const MIN = 60000, GIORNO = 86400000;

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
 * @property {number} simbolo indice della moneta
 * @property {boolean} piccola moneta con slittamento minimo più alto
 * @property {1|-1} lato
 * @property {number} entrata ms UTC del minuto d'entrata
 * @property {number} uscita ms UTC del minuto d'uscita
 * @property {number} prezzo prezzo d'entrata (prima dello slittamento)
 * @property {number} rapporto prezzo uscita / prezzo entrata (prima dello slittamento)
 * @property {number} funding frazione del nozionale pagata fino all'uscita (positivo = costo)
 * @property {number} peggiore massimo movimento contrario (frazione, positivo)
 * @property {boolean} [limite] entrata con ordine limite: commissione maker e nessuno slittamento in entrata
 */

/**
 * @param {Operazione[]} ops ordinate per entrata
 * @param {object} o
 * @param {number} [o.capitale=10000] @param {number} [o.posti=10] @param {number} [o.quota=0.1] @param {number} [o.leva=3]
 * @param {number} [o.freno=0.08] 0 = spento
 * @param {boolean} [o.composto=false] true = margine sul capitale attuale; false = sul capitale iniziale
 * @param {number} o.slittamento per lato @param {number} [o.slittamentoPiccole] minimo per le monete piccole
 * @param {number} [o.seme=1] ordine casuale degli ingressi nello stesso minuto
 * @param {{apertura:(s:number,t:number)=>number, chiusura:(s:number,t:number)=>number}} [o.prezzi] prezzi per il freno
 * @param {(s:number, lato:number, da:number, a:number)=>number} [o.funding] funding pagato, per le chiusure del freno
 */
export function simulaPortafoglio(ops, o) {
  const { capitale = 10000, posti = 10, quota = 0.1, leva = 3, freno = 0.08, composto = false, slittamento, seme = 1, prezzi = null, funding = null } = o;
  const slittPiccole = Math.max(slittamento, o.slittamentoPiccole ?? slittamento);
  const rnd = casuale(seme);
  let cap = capitale;
  const aperte = []; // { op, nozionale, costi, fill }
  const prese = [];
  const curva = [[ops.length ? ops[0].entrata : 0, cap]];
  const giorni = new Map(); // giorno → { inizio, pnl, bloccato }
  let rovina = false;
  const scartati = { posti: 0, freno: 0, stessaMoneta: 0, capitale: 0 };

  const giorno = g => {
    let x = giorni.get(g);
    if (!x) { x = { inizio: cap, pnl: 0, bloccato: false }; giorni.set(g, x); }
    return x;
  };
  const giornoDi = t => Math.floor(t / GIORNO) * GIORNO;
  // un'uscita all'apertura esatta delle 00:00 (durata massima) appartiene al giorno prima
  const giornoUscita = t => Math.floor((t - 1) / GIORNO) * GIORNO;

  const chiudi = (k, t, prezzoUscita = null, motivo = null) => {
    const p = aperte.splice(k, 1)[0];
    const op = p.op;
    let netto;
    if (prezzoUscita === null) {
      netto = nettoOperazione(op.lato, op.rapporto, { ...p.costi, funding: op.funding });
      if (op.peggiore >= 0.9 / leva) netto = -1 / leva; // liquidazione: si perde il margine
    } else {
      const f = funding ? funding(op.simbolo, op.lato, op.entrata, t) : op.funding;
      netto = nettoOperazione(op.lato, prezzoUscita / op.prezzo, { ...p.costi, funding: f });
    }
    netto = Math.max(netto, -1 / leva);
    const pnl = p.nozionale * netto;
    cap += pnl;
    giorno(giornoUscita(t)).pnl += pnl;
    curva.push([t, cap]);
    prese.push({ ...op, uscita: t, motivo: motivo ?? op.motivo, nozionale: p.nozionale, netto, pnl });
    if (cap <= 0) rovina = true;
  };

  // perdita aperta più pessimista possibile (dal peggior movimento contrario di ogni operazione): serve a saltare i minuti
  // in cui il freno non può comunque scattare
  const peggioreAperto = () => aperte.reduce((s, p) => s - p.nozionale * (p.op.peggiore + p.costi.slittEntrata + 1e-4), 0);
  const apertoA = m => {
    let s = 0;
    for (const p of aperte) {
      const c = prezzi.chiusura(p.op.simbolo, m);
      if (!Number.isNaN(c)) s += p.nozionale * p.op.lato * (c / p.fill - 1);
    }
    return s;
  };
  const frenoPossibile = m => {
    if (!(freno > 0)) return false;
    const g = giorno(giornoDi(m));
    if (g.bloccato) return false;
    return g.pnl + peggioreAperto() <= -freno * g.inizio;
  };
  const controllaFreno = m => {
    if (!frenoPossibile(m)) return;
    const g = giorno(giornoDi(m));
    const aperto = aperte.length && prezzi ? apertoA(m) : 0;
    if (g.pnl + aperto > -freno * g.inizio) return;
    g.bloccato = true;
    // si chiude tutto all'apertura del minuto dopo
    while (aperte.length) {
      const p = aperte[0];
      let t = m + MIN, px = prezzi ? prezzi.apertura(p.op.simbolo, t) : NaN;
      for (let k = 0; k < 60 && Number.isNaN(px); k++) { t += MIN; px = prezzi.apertura(p.op.simbolo, t); }
      if (Number.isNaN(px)) px = p.op.prezzo * p.op.rapporto;
      chiudi(0, t, px, MOTIVI.freno);
    }
  };
  const usciteFinoA = m => {
    for (;;) {
      let k = -1;
      for (let i = 0; i < aperte.length; i++) if (aperte[i].op.uscita <= m && (k < 0 || aperte[i].op.uscita < aperte[k].op.uscita)) k = i;
      if (k < 0) break;
      chiudi(k, aperte[k].op.uscita);
    }
  };

  // Fa avanzare il tempo fino al minuto `fine` compreso (uscite e freno), senza le entrate di quel minuto
  let ora = ops.length ? ops[0].entrata : 0;
  const avanza = fine => {
    while (ora <= fine && !rovina) {
      if (!aperte.length) { if (Number.isFinite(fine)) ora = Math.max(ora, fine); break; }
      if (!frenoPossibile(ora)) {
        let prossima = Math.min(fine, giornoDi(ora) + GIORNO);
        for (const p of aperte) prossima = Math.min(prossima, p.op.uscita);
        if (prossima > ora) { ora = prossima; continue; }
      }
      usciteFinoA(ora);
      controllaFreno(ora);
      if (ora === fine) break;
      ora += MIN;
    }
  };

  let i = 0;
  while (i < ops.length && !rovina) {
    const t = ops[i].entrata;
    let j = i; while (j < ops.length && ops[j].entrata === t) j++;
    avanza(t);
    const g = giorno(giornoDi(t));
    // segnali dello stesso minuto in ordine casuale
    const gruppo = ops.slice(i, j);
    for (let k = gruppo.length - 1; k > 0; k--) { const r = Math.floor(rnd() * (k + 1)); [gruppo[k], gruppo[r]] = [gruppo[r], gruppo[k]]; }
    for (const op of gruppo) {
      if (rovina) break;
      if (g.bloccato) { scartati.freno++; continue; }
      if (cap <= 0) { scartati.capitale++; continue; }
      if (aperte.length >= posti) { scartati.posti++; continue; }
      if (aperte.some(a => a.op.simbolo === op.simbolo)) { scartati.stessaMoneta++; continue; }
      const margine = quota * (composto ? cap : capitale);
      const s = op.piccola ? slittPiccole : slittamento;
      const costi = op.limite
        ? { slittEntrata: 0, slittUscita: s, commEntrata: COMMISSIONE_MAKER, commUscita: COMMISSIONE }
        : { slittEntrata: s, slittUscita: s, commEntrata: COMMISSIONE, commUscita: COMMISSIONE };
      aperte.push({ op, nozionale: margine * leva, costi, fill: op.prezzo * (1 + op.lato * costi.slittEntrata) });
    }
    i = j;
  }
  avanza(Infinity);
  // eventuali posizioni rimaste (solo in caso di rovina): chiuse alla loro uscita
  while (aperte.length) chiudi(0, aperte[0].op.uscita);
  prese.sort((a, b) => a.uscita - b.uscita);
  return { prese, capitaleFinale: cap, curva, giorni, rovina, scartati };
}

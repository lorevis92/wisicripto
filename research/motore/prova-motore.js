// Controlli del motore su casi costruiti a mano: node research/motore/prova-motore.js
import assert from 'node:assert/strict';
import { aperturaSessione, SESSIONI, calendarioSessioni } from './sessioni.js';
import { Posizione, MOTIVI, REGOLE_ATTUALE } from './posizione.js';
import { RilevatoreRottura } from './rottura.js';
import { puntiCandela } from './percorso.js';
import { rendimentoNetto, nettoOperazione, fundingPagato, COMMISSIONE_MAKER } from './costi.js';
import { simulaPortafoglio } from './portafoglio.js';
import { simulaUscita, MOTIVI_USCITA } from './uscite.js';

const vicino = (a, b) => Math.abs(a - b) < 1e-9;
const iso = t => new Date(t).toISOString().slice(11, 16);
const [asia, europa, usa] = SESSIONI;
// Ora legale: Londra 07:00 UTC d'estate, 08:00 d'inverno; New York 13:30 / 14:30
assert.equal(iso(aperturaSessione(europa, Date.UTC(2024, 6, 1))), '07:00');
assert.equal(iso(aperturaSessione(europa, Date.UTC(2024, 0, 15))), '08:00');
assert.equal(iso(aperturaSessione(usa, Date.UTC(2024, 6, 1))), '13:30');
assert.equal(iso(aperturaSessione(usa, Date.UTC(2024, 0, 15))), '14:30');
// Settimane in cui USA e Europa cambiano ora in giorni diversi (marzo 2024: USA il 10, Europa il 31)
assert.equal(iso(aperturaSessione(usa, Date.UTC(2024, 2, 11))), '13:30');
assert.equal(iso(aperturaSessione(europa, Date.UTC(2024, 2, 11))), '08:00');
assert.equal(iso(aperturaSessione(europa, Date.UTC(2024, 3, 1))), '07:00');
assert.equal(iso(aperturaSessione(asia, Date.UTC(2024, 3, 1))), '00:00');
const cal = calendarioSessioni(Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 3));
assert.equal(cal.length, 6);
assert.equal(cal[2].prossima, Date.UTC(2024, 0, 2));

// Percorso come Wisi Trade: apertura più vicina al massimo → O,H,L,C, altrimenti O,L,H,C
assert.deepEqual([...puntiCandela(100, 100.5, 97, 97.5)], [100, 100.5, 97, 97.5]);
assert.deepEqual([...puntiCandela(100, 103, 99.5, 102)], [100, 99.5, 103, 102]);

const R = REGOLE_ATTUALE; // stop 1,5 unità, attiva da 0,5, segue 1, restituisci 40%
// Long a 100, unità 1%: stop loss a 98,5. Guadagno massimo 0,2% (< 0,5 unità): resta lo stop loss
let p = new Posizione({ lato: 1, entrata: 100, tempo: 0, unita: 0.01, regole: R });
p.minuto(puntiCandela(100, 100.2, 97, 97.5), 60000);
assert.equal(p.motivo, MOTIVI.stop); assert.ok(vicino(p.uscita, 98.5));
// Sale a 102 (+2 unità): livello = max(stop, 102−1, 100+60%·2) = 101,2 (protezione); poi scende: esce a 101,2
p = new Posizione({ lato: 1, entrata: 100, tempo: 0, unita: 0.01, regole: R });
p.minuto(puntiCandela(100, 102, 99.9, 101.9), 60000);
assert.ok(!p.chiusa);
p.minuto(puntiCandela(101.9, 101.9, 99, 99.5), 120000);
assert.equal(p.motivo, MOTIVI.protezione); assert.ok(vicino(p.uscita, 101.2));
// Sale a 105 (+5 unità): stop che segue a 104 batte la protezione (103); scende a 101: esce a 104
p = new Posizione({ lato: 1, entrata: 100, tempo: 0, unita: 0.01, regole: R });
p.minuto(puntiCandela(100, 105, 100, 104.9), 60000);
p.minuto(puntiCandela(104.9, 104.9, 101, 101.5), 120000);
assert.equal(p.motivo, MOTIVI.segue); assert.ok(vicino(p.uscita, 104));
// Short a 100, apertura del minuto già oltre lo stop (salto a 103): esce a 103
p = new Posizione({ lato: -1, entrata: 100, tempo: 0, unita: 0.01, regole: R });
p.minuto(puntiCandela(103, 104, 102.5, 103.5), 60000);
assert.equal(p.motivo, MOTIVI.stop); assert.equal(p.uscita, 103);
// Short: scende a 97 (+3 unità): stop che segue a 98 (+2 unità) meglio della protezione a 98,2; risale a 99: esce a 98
p = new Posizione({ lato: -1, entrata: 100, tempo: 0, unita: 0.01, regole: R });
p.minuto(puntiCandela(100, 100.1, 97, 97.2), 60000);
p.minuto(puntiCandela(97.2, 99, 97.1, 98.9), 120000);
assert.equal(p.motivo, MOTIVI.segue); assert.ok(vicino(p.uscita, 98));
// Short: scende a 98,5 (+1,5 unità): protezione a 99,1 meglio dello stop che segue a 99,5; risale: esce a 99,1
p = new Posizione({ lato: -1, entrata: 100, tempo: 0, unita: 0.01, regole: R });
p.minuto(puntiCandela(100, 100.1, 98.5, 98.7), 60000);
p.minuto(puntiCandela(98.7, 99.6, 98.6, 99.5), 120000);
assert.equal(p.motivo, MOTIVI.protezione); assert.ok(vicino(p.uscita, 99.1));

// Rottura: riferimento 100, soglia 1%, margine 0,15%: serve 101,1515 per confermare, entrata a 101
let r = new RilevatoreRottura({ riferimento: 100, soglia: 0.01, margine: 0.0015 });
assert.equal(r.minuto(puntiCandela(100, 101.1, 99.5, 101)), null); // tocca 101,1 ma non conferma
let e = r.minuto(puntiCandela(100.5, 101.3, 100.4, 101.2));
assert.equal(e.lato, 1); assert.equal(e.prezzo, 101);
e = r.minuto(puntiCandela(101.05, 101.3, 100.9, 101.2)); // apre sopra il livello ma sotto la conferma
assert.equal(e.prezzo, 101.05);
e = r.minuto(puntiCandela(98.7, 99, 98.6, 98.8)); // apre già sotto la conferma short
assert.equal(e.lato, -1); assert.equal(e.prezzo, 98.7);
// Entrata e uscita nello stesso minuto: 100→99→101,5→99,5, long confermato salendo, unità 0,5%:
// a 101,5 il guadagno è ~1 unità → protezione al 60% del guadagno (101,3); poi scende: esce a 101,3
r = new RilevatoreRottura({ riferimento: 100, soglia: 0.01, margine: 0.0015 });
e = r.minuto(puntiCandela(100, 101.5, 99, 99.5));
assert.equal(e.lato, 1);
p = new Posizione({ lato: e.lato, entrata: e.prezzo, tempo: 0, unita: 0.005, regole: R });
p.minuto(puntiCandela(100, 101.5, 99, 99.5), 0, e.indice, e.puntoConferma);
assert.equal(p.motivo, MOTIVI.protezione); assert.ok(vicino(p.uscita, 101.3));

// Costi: long +1% lordo, slittamento 0,05%, commissione 0,06% → circa +0,78%
const n = rendimentoNetto(1, 1.01, 0.0005, 0);
assert.ok(n > 0.0077 && n < 0.0079);
assert.ok(rendimentoNetto(-1, 0.99, 0.0005, 0) > 0.0077);
// Entrata a ordine limite (maker, senza slittamento): costa meno
const nl = nettoOperazione(1, 1.01, { slittEntrata: 0, slittUscita: 0.0005, commEntrata: COMMISSIONE_MAKER });
assert.ok(vicino(nl, 1.01 * 0.9995 - 1 - 0.0002 - 0.0006 * 1.01 * 0.9995));
// Funding: pagamenti a 8h e 16h, posizione long tra 7h e 16h → paga entrambi; short li incassa
const f = [[8 * 3600000, 0.0001], [16 * 3600000, 0.0002], [24 * 3600000, 0.0003]];
assert.ok(vicino(fundingPagato(f, 1, 7 * 3600000, 16 * 3600000), 0.0003));
assert.ok(vicino(fundingPagato(f, -1, 8 * 3600000, 20 * 3600000), -0.0002));

// Freno con perdita aperta: long a 100 (nozionale 3.000) che al minuto 5 vale 71 (−870 aperti, oltre l'8% di 10.000):
// si chiude all'apertura del minuto 6 e la seconda operazione dello stesso giorno non entra
const M = 60000, T0 = Date.UTC(2024, 0, 1, 1);
const prezzi = { chiusura: (s, t) => ((t - T0) / M >= 5 ? 71 : 100), apertura: (s, t) => ((t - T0) / M >= 6 ? 71.5 : 100) };
const ops = [
  { simbolo: 0, lato: 1, entrata: T0, uscita: T0 + 100 * M, prezzo: 100, rapporto: 1.05, funding: 0, peggiore: 0.29, motivo: MOTIVI.tempo },
  { simbolo: 1, lato: 1, entrata: T0 + 30 * M, uscita: T0 + 60 * M, prezzo: 50, rapporto: 1.1, funding: 0, peggiore: 0, motivo: MOTIVI.tempo },
];
const ris = simulaPortafoglio(ops, { leva: 3, slittamento: 0, prezzi });
assert.equal(ris.prese.length, 1);
assert.equal(ris.prese[0].motivo, MOTIVI.freno); assert.equal(ris.prese[0].uscita, T0 + 6 * M);
assert.ok(vicino(ris.prese[0].netto, nettoOperazione(1, 0.715, { slittEntrata: 0, slittUscita: 0 })));
// Senza freno la stessa prima operazione arriva alla sua uscita e la seconda entra
assert.equal(simulaPortafoglio(ops, { leva: 3, slittamento: 0, prezzi, freno: 0 }).prese.length, 2);
// Uscite sui prezzi veri: con controllo a ogni prezzo devono coincidere con Posizione sugli stessi prezzi
{
  let seme = 3; const rnd = () => ((seme = (seme * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let prova = 0; prova < 300; prova++) {
    const n = 300, s = { open: new Float64Array(n), high: new Float64Array(n), low: new Float64Array(n), close: new Float64Array(n), t0: 0, n };
    const percorsi = new Map();
    let px = 100;
    for (let i = 0; i < n; i++) {
      s.open[i] = px;
      const tick = Array.from({ length: 1 + Math.floor(rnd() * 8) }, () => (px *= 1 + (rnd() - 0.5) * 0.006));
      s.high[i] = Math.max(s.open[i], ...tick); s.low[i] = Math.min(s.open[i], ...tick); s.close[i] = tick.at(-1);
      if (rnd() < 0.8) percorsi.set(i * M, tick); // gli altri minuti con la candela
    }
    const lato = rnd() < 0.5 ? 1 : -1, u = 0.004, iE = 1;
    const pos = new Posizione({ lato, entrata: s.open[iE], tempo: iE * M, unita: u, regole: REGOLE_ATTUALE });
    for (let k = iE; k < n && !pos.chiusa; k++) {
      if (k >= iE + 240) { pos.chiudiA(s.open[k], k * M, MOTIVI.tempo); break; }
      const vero = percorsi.get(k * M);
      if (vero) { pos.salto(s.open[k], k * M); pos.minuto(vero, k * M, -1, s.open[k]); } else pos.minuto(puntiCandela(s.open[k], s.high[k], s.low[k], s.close[k]), k * M);
    }
    const x = simulaUscita({ s, iE, lato, u, percorsi, r: { stop: 1.5, obiettivo: 0, attivaDa: 0.5, segue: 1, restituisci: 0.4, durata: 240, controllo: 'prezzo' } });
    if (pos.chiusa) { assert.ok(vicino(x.uscita, pos.uscita)); assert.equal(x.tUscita, pos.tempoUscita); assert.equal(x.motivo, pos.motivo); }
  }
  // Obiettivo sulla borsa: long a 100, unità 1%, obiettivo 2 u → esce a 102 appena toccato
  const s = { open: Float64Array.from([100, 100, 101]), high: Float64Array.from([100, 102.5, 101]), low: Float64Array.from([100, 99.5, 101]), close: Float64Array.from([100, 101, 101]), t0: 0, n: 3 };
  const x = simulaUscita({ s, iE: 0, lato: 1, u: 0.01, percorsi: new Map([[M, [99.5, 102.5, 101]]]), r: { stop: 1.5, obiettivo: 2, attivaDa: 0.5, segue: 0, restituisci: 0, durata: 240, controllo: 'chiusura' } });
  assert.equal(x.motivo, MOTIVI_USCITA.obiettivo); assert.ok(vicino(x.uscita, 102)); assert.equal(x.tUscita, M);
  // Controllo alla chiusura: la protezione decisa a fine minuto si esegue all'apertura del minuto dopo
  const s2 = { open: Float64Array.from([100, 100, 103, 101.5, 101]), high: Float64Array.from([100, 103.2, 103, 101.6, 101]), low: Float64Array.from([100, 100, 101.3, 101.4, 101]), close: Float64Array.from([100, 103, 101.4, 101.5, 101]), t0: 0, n: 5 };
  const y = simulaUscita({ s: s2, iE: 0, lato: 1, u: 0.01, percorsi: null, r: { stop: 1.5, obiettivo: 0, attivaDa: 0.5, segue: 0, restituisci: 0.4, durata: 240, controllo: 'chiusura' } });
  // migliore chiusura +3% → livello +1,8%; chiusura del minuto 2 a +1,4% → esce all'apertura del minuto 3 (101,5)
  assert.equal(y.motivo, MOTIVI_USCITA.protezione); assert.equal(y.tUscita, 3 * M); assert.ok(vicino(y.uscita, 101.5));
}
console.log('Motore: tutti i controlli passati.');

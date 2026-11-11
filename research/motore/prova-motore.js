// Controlli del motore su casi costruiti a mano: node research/motore/prova-motore.js
import assert from 'node:assert/strict';
import { aperturaSessione, SESSIONI, calendarioSessioni } from './sessioni.js';
import { Posizione, MOTIVI } from './posizione.js';
import { RilevatoreRottura } from './rottura.js';
import { puntiCandela } from './percorso.js';
import { rendimentoNetto, fundingPagato } from './costi.js';

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

const regole = { protezione: { attivaA: 1, blocca: 0.003 }, segue: { attivaA: 1.5, distanza: 1 } };
// Long a 100, stop 2%: scende a 97 → esce a 98
let p = new Posizione({ lato: 1, entrata: 100, tempo: 0, R: 0.02, regole });
p.minuto(puntiCandela(100, 100.5, 97, 97.5), 60000);
assert.ok(p.chiusa); assert.equal(p.motivo, MOTIVI.stop); assert.ok(Math.abs(p.uscita - 98) < 1e-9);
// Long: sale a 102.5 (+1,25R → protezione), poi scende: esce a +0,3%
p = new Posizione({ lato: 1, entrata: 100, tempo: 0, R: 0.02, regole });
p.minuto(puntiCandela(100, 102.5, 99.9, 102.4), 60000);
assert.ok(!p.chiusa);
p.minuto(puntiCandela(102.4, 102.4, 99, 99.5), 120000);
assert.equal(p.motivo, MOTIVI.protezione); assert.ok(Math.abs(p.uscita - 100.3) < 1e-9);
// Long: sale a 105 (+2,5R → segue a 105·... stop a +3%), poi scende a 101: esce a 103
p = new Posizione({ lato: 1, entrata: 100, tempo: 0, R: 0.02, regole });
p.minuto(puntiCandela(100, 105, 100, 104.9), 60000);
p.minuto(puntiCandela(104.9, 104.9, 101, 101.5), 120000);
assert.equal(p.motivo, MOTIVI.segue); assert.ok(Math.abs(p.uscita - 103) < 1e-9);
// Short a 100, apertura del minuto già oltre lo stop (salto a 103): esce a 103
p = new Posizione({ lato: -1, entrata: 100, tempo: 0, R: 0.02, regole });
p.minuto(puntiCandela(103, 104, 102.5, 103.5), 60000);
assert.equal(p.motivo, MOTIVI.stop); assert.equal(p.uscita, 103);
// Candela in discesa: prima il massimo poi il minimo. Long a 100 con stop 99: sale a 101 (+1R, protezione) poi scende: esce a +0,3%
p = new Posizione({ lato: 1, entrata: 100, tempo: 0, R: 0.01, regole });
p.minuto(puntiCandela(100, 101, 98.5, 99.2), 60000);
assert.equal(p.motivo, MOTIVI.protezione); assert.ok(Math.abs(p.uscita - 100.3) < 1e-9);
// Stessa candela ma senza arrivare a +1R: tocca lo stop
p = new Posizione({ lato: 1, entrata: 100, tempo: 0, R: 0.01, regole });
p.minuto(puntiCandela(100, 100.8, 98.5, 99.2), 60000);
assert.equal(p.motivo, MOTIVI.stop); assert.ok(Math.abs(p.uscita - 99) < 1e-9);

// Rottura: riferimento 100, soglia 1%, margine 0,15%: serve 101,1515 per confermare, entrata a 101
let r = new RilevatoreRottura({ riferimento: 100, soglia: 0.01, margine: 0.0015 });
assert.equal(r.minuto(puntiCandela(100, 101.1, 99.5, 101)), null); // tocca 101,1 ma non conferma
let e = r.minuto(puntiCandela(100.5, 101.3, 100.4, 101.2));
assert.equal(e.lato, 1); assert.equal(e.prezzo, 101);
e = r.minuto(puntiCandela(101.05, 101.3, 100.9, 101.2)); // apre sopra il livello ma sotto la conferma
assert.equal(e.prezzo, 101.05);
e = r.minuto(puntiCandela(98.7, 99, 98.6, 98.8)); // apre già sotto la conferma short
assert.equal(e.lato, -1); assert.equal(e.prezzo, 98.7);
// Entrata e stop nello stesso minuto: candela in discesa 100→101.5→99→99.5, long confermato salendo, poi stop a 99,99 (R 1%)
r = new RilevatoreRottura({ riferimento: 100, soglia: 0.01, margine: 0.0015 });
e = r.minuto(puntiCandela(100, 101.5, 99, 99.5));
p = new Posizione({ lato: e.lato, entrata: e.prezzo, tempo: 0, R: 0.01, regole });
p.minuto(puntiCandela(100, 101.5, 99, 99.5), 0, e.indice, e.puntoConferma);
assert.ok(p.chiusa); assert.ok(Math.abs(p.uscita - 99.99) < 1e-9);

// Costi: long +1% lordo, slittamento 0,05%, commissione 0,06% → circa +0,78%
const n = rendimentoNetto(1, 1.01, 0.0005, 0);
assert.ok(Math.abs(n - (1.01 * 0.9995 / 1.0005 - 1 - 0.0006 * (1 + 1.01 * 0.9995 / 1.0005))) < 1e-12);
assert.ok(n > 0.0077 && n < 0.0079);
assert.ok(rendimentoNetto(-1, 0.99, 0.0005, 0) > 0.0077);
// Funding: pagamenti a 8h e 16h, posizione long tra 7h e 16h → paga entrambi; short li incassa
const f = [[8 * 3600000, 0.0001], [16 * 3600000, 0.0002], [24 * 3600000, 0.0003]];
assert.ok(Math.abs(fundingPagato(f, 1, 7 * 3600000, 16 * 3600000) - 0.0003) < 1e-12);
assert.ok(Math.abs(fundingPagato(f, -1, 8 * 3600000, 20 * 3600000) + 0.0002) < 1e-12);
console.log('Motore: tutti i controlli passati.');

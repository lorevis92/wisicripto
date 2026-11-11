// Revisione: prova sintetica del freno giornaliero di research/motore/portafoglio.js.
// Due posizioni long; il prezzo di chiusura del minuto 10 porta la perdita aperta oltre l'8% del capitale:
// il freno deve chiudere tutto all'APERTURA del minuto 11 (con slittamento) e bloccare le entrate fino al giorno dopo.
// Uso: node research/revisione/prova-freno.js
import { simulaPortafoglio } from '../motore/portafoglio.js';

const M = 60000, T0 = Date.UTC(2024, 0, 10, 12, 0);
// prezzi: apertura e chiusura per minuto. Fino al minuto 9 a 100, al minuto 10 chiude a 60 (−40%), il minuto 11 apre a 70
const apertura = (s, t) => { const m = (t - T0) / M; return m <= 10 ? 100 : m === 11 ? 70 : 80; };
const chiusura = (s, t) => { const m = (t - T0) / M; return m < 10 ? 100 : m === 10 ? 60 : 80; };
const op = (simbolo, entrata, uscitaMin) => ({ simbolo, piccola: false, lato: 1, motivo: 4, entrata, uscita: T0 + uscitaMin * M, prezzo: 100, rapporto: 0.8, funding: 0, peggiore: 0.4 });
const ops = [op(0, T0, 200), op(1, T0, 200), op(2, T0 + 11 * M, 100), op(3, T0 + 3 * 3600000, 300)];
const r = simulaPortafoglio(ops, { capitale: 10000, posti: 10, quota: 0.1, leva: 3, freno: 0.08, composto: false, slittamento: 0.001, seme: 1, prezzi: { apertura, chiusura }, funding: () => 0 });
for (const p of r.prese) console.log(`moneta ${p.simbolo}: uscita al minuto ${(p.uscita - T0) / M}, motivo ${p.motivo}, netto ${(p.netto * 100).toFixed(3)}%`);
console.log('scartati', r.scartati);
// atteso: monete 0 e 1 chiuse al minuto 11 (motivo 6) a 70 con slittamento: netto ≈ 70·0,999/(100·1,001) − 1 − 0,0006 − 0,0006·0,699 ≈ −30,2%,
// limitato a −33,3% (margine); moneta 2 (minuto 11) e 3 (stesso giorno) scartate per il freno.
const atteso = Math.max(70 * 0.999 / (100 * 1.001) - 1 - 0.0006 - 0.0006 * (70 * 0.999 / (100 * 1.001)), -1 / 3);
const ok = r.prese.length === 2 && r.prese.every(p => p.motivo === 6 && p.uscita === T0 + 11 * M && Math.abs(p.netto - atteso) < 1e-12) && r.scartati.freno === 2;
console.log(ok ? 'FRENO OK' : 'FRENO DIVERSO DALL\'ATTESO');

// Controlli del motore delle strategie lente (research/motore/classifica.js) su casi costruiti a mano.
// Uso: node research/motore/prova-classifica.js
import { simulaPortafoglio } from './classifica.js';

let errori = 0;
const vicino = (a, b, nome, tol = 1e-6) => { if (!(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)))) { errori++; console.log(`ERRORE ${nome}: ${a} invece di ${b}`); } };
const serie = (n, f) => Float64Array.from({ length: n }, (_, h) => f(h));
const moneta = (open, close, extra = {}) => ({ open, close, primo: 0, ultimo: open.length - 1, attiva: true, bitunix: true, ...extra });
const S0 = { base: 0.0008, sottili: 0.0015 }, C = 0.0006;

// 1. Long: prezzo 100 all'apertura dell'ora 0, 110 dall'ora 5. Peso +1 su 10.000, chiusura all'ora 10.
{
  const px = serie(20, h => (h < 5 ? 100 : 110));
  const monete = new Map([['X', moneta(px, px)]]);
  const r = simulaPortafoglio({ monete, funding: new Map(), piani: [{ h: 0, pesi: new Map([['X', 1]]) }], da: 0, a: 10, opz: { slitt: S0 } });
  const op = r.ops[0];
  vicino(op.lordo, 1000, 'long: lordo');
  vicino(op.costi, 10000 * (C + 0.0008) + 11000 * (C + 0.0008), 'long: costi');
  vicino(r.finale, 10000 + 1000 - op.costi, 'long: capitale finale');
  vicino(r.curva[7], 10000 + 1000 - 10000 * (C + 0.0008), 'long: valutazione oraria');
}
// 2. Short con funding: prezzo da 100 a 90, un pagamento di funding +0,01% all'ora 3 (lo short incassa).
{
  const px = serie(20, h => (h < 5 ? 100 : 90));
  const monete = new Map([['X', moneta(px, px)]]);
  const funding = new Map([['X', [[0, 0.01], [3, 0.0001]]]]); // quello all'ora 0 (apertura) non conta
  const r = simulaPortafoglio({ monete, funding, piani: [{ h: 0, pesi: new Map([['X', -1]]) }], da: 0, a: 10, opz: { slitt: S0 } });
  const op = r.ops[0];
  vicino(op.lordo, 1000, 'short: lordo');
  vicino(op.funding, -1, 'short: funding incassato');
  vicino(op.netto, 1000 - op.costi + 1, 'short: netto');
}
// 3. Moneta tolta: l'ultima candela è all'ora 6 (prezzo 50). Si chiude all'ora 7 a 50, con slittamento sottile.
{
  const px = serie(7, h => (h < 3 ? 100 : 50));
  const monete = new Map([['X', moneta(px, px, { attiva: false })]]);
  const r = simulaPortafoglio({ monete, funding: new Map(), piani: [{ h: 0, pesi: new Map([['X', 1]]), sottili: new Set(['X']) }], da: 0, a: 15, opz: { slitt: S0 } });
  const op = r.ops[0];
  vicino(op.uscita, 7, 'tolta: ora di uscita');
  vicino(op.lordo, -5000, 'tolta: lordo');
  vicino(op.costi, 10000 * (C + 0.0015) + 5000 * (C + 0.0015), 'tolta: costi');
}
// 4. Ribilanciamento: peso 1 → 0,5 all'ora 5 (prezzo invariato): si vende metà, l'operazione continua.
//    Con soloCambi e lo stesso peso non si scambia niente.
{
  const px = serie(20, () => 100);
  const monete = new Map([['X', moneta(px, px)]]);
  const r = simulaPortafoglio({ monete, funding: new Map(), piani: [{ h: 0, pesi: new Map([['X', 1]]) }, { h: 5, pesi: new Map([['X', 0.5]]) }], da: 0, a: 10, opz: { slitt: S0 } });
  vicino(r.ops.length, 1, 'ribilancia: una sola operazione');
  vicino(r.ops[0].scambiato, 10000 + 5000 + 5000, 'ribilancia: valore scambiato');
  const r2 = simulaPortafoglio({ monete, funding: new Map(), piani: [{ h: 0, pesi: new Map([['X', 1]]) }, { h: 5, pesi: new Map([['X', 1]]) }], da: 0, a: 10, opz: { slitt: S0, soloCambi: true } });
  vicino(r2.ops[0].scambiato, 20000, 'soloCambi: nessuno scambio a metà');
}
// 5. Cambio di lato: long poi short sulla stessa moneta = due operazioni.
{
  const px = serie(20, h => 100 + h);
  const monete = new Map([['X', moneta(px, px)]]);
  const r = simulaPortafoglio({ monete, funding: new Map(), piani: [{ h: 0, pesi: new Map([['X', 1]]) }, { h: 5, pesi: new Map([['X', -1]]) }], da: 0, a: 10, opz: { slitt: S0 } });
  vicino(r.ops.length, 2, 'cambio lato: due operazioni');
  vicino(r.ops[0].lordo, 100 * (105 - 100), 'cambio lato: lordo del long');
  vicino(r.ops[1].lordo, -(10000 / 105) * (110 - 105), 'cambio lato: lordo dello short');
}
// 6. Interesse composto: la seconda base usa il capitale del momento.
{
  const px = serie(20, h => (h < 3 ? 100 : 200));
  const monete = new Map([['X', moneta(px, px)]]);
  const piani = [{ h: 0, pesi: new Map([['X', 1]]) }, { h: 5, pesi: new Map() }, { h: 6, pesi: new Map([['X', 1]]) }];
  const S = { base: 0, sottili: 0 };
  const fisso = simulaPortafoglio({ monete, funding: new Map(), piani, da: 0, a: 10, opz: { slitt: S } });
  const comp = simulaPortafoglio({ monete, funding: new Map(), piani, da: 0, a: 10, opz: { slitt: S, composto: true } });
  vicino(fisso.ops[1].nozionale, 10000, 'fissa: seconda posizione da 10.000');
  vicino(comp.ops[1].nozionale, fisso.ops[0].netto + 10000, 'composto: seconda posizione dal capitale');
}
// 7. Rovina: short con prezzo che quadruplica.
{
  const px = serie(20, h => (h < 3 ? 100 : 400));
  const monete = new Map([['X', moneta(px, px)]]);
  const r = simulaPortafoglio({ monete, funding: new Map(), piani: [{ h: 0, pesi: new Map([['X', -1]]) }], da: 0, a: 10, opz: { slitt: S0 } });
  if (!r.rovina) { errori++; console.log('ERRORE rovina non segnata'); }
}
console.log(errori ? `${errori} errori` : 'Motore delle strategie lente: tutti i controlli passati.');
process.exit(errori ? 1 : 0);

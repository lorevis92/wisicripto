// Revisione indipendente del portafoglio (research/motore/portafoglio.js) sulle operazioni della verifica (cache di 08).
// 1) Con posti illimitati e freno spento l'ordine casuale non conta: confronto il capitale finale del motore con un mio
//    conto scritto qui (commissioni, slittamento, funding, leva, liquidazione). Stampo solo la differenza.
// 2) Con 10 posti (freno spento, ordine per simbolo) conto quante entrate trovano posto solo perché nello stesso minuto
//    si è chiusa una posizione con uno stop scattato DENTRO quel minuto (cioè dopo l'apertura, quando si entra davvero),
//    e quante volte con dimensione fissa il margine delle posizioni aperte supera il capitale.
// Uso: node --max-old-space-size=8192 research/revisione/controlla-portafoglio.js
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { leggiColonne } from '../lib/backtest.js';
import { simulaPortafoglio } from '../motore/portafoglio.js';

const dirCache = join('data', 'backtest', 'verifica', readdirSync(join('data', 'backtest', 'verifica')).find(d => !d.endsWith('.json')));
const universo = JSON.parse(readFileSync('data/universo.json', 'utf8')).candidati.map(c => c.simbolo);
const ops = [];
readdirSync(dirCache).sort().forEach((f, si) => {
  const c = leggiColonne(join(dirCache, f)), sim = f.slice(2, -4);
  for (let k = 0; k < c.lato.length; k++) ops.push({ simbolo: si, piccola: universo.indexOf(sim) >= 14, lato: c.lato[k], motivo: c.motivo[k], entrata: c.entrata[k], uscita: c.uscita[k], prezzo: c.prezzo[k], rapporto: c.rapporto[k], funding: c.funding[k], peggiore: c.peggiore[k] });
});
ops.sort((a, b) => a.entrata - b.entrata || a.simbolo - b.simbolo);

const S = 0.0008, C = 0.0006;
function mio({ leva, posti, composto }) {
  let cap = 10000; const aperte = []; let dentroMinuto = 0, margineOltre = 0;
  const chiudi = p => {
    const o = p.o; const fe = o.prezzo * (1 + o.lato * S), fu = o.prezzo * o.rapporto * (1 - o.lato * S);
    const q = p.noz / fe;                                  // quantità di monete
    let pnl = o.lato * q * (fu - fe) - C * p.noz - C * q * fu - o.funding * p.noz;
    if (o.peggiore >= 0.9 / leva) pnl = -p.noz / leva;     // liquidazione
    pnl = Math.max(pnl, -p.noz / leva);
    cap += pnl;
  };
  for (const o of ops) {
    // chiudo quelle uscite prima (o nello stesso minuto) dell'entrata, in ordine di uscita; non quelle aperte in questo stesso minuto
    aperte.sort((a, b) => a.o.uscita - b.o.uscita);
    let liberateNelMinuto = 0;
    while (aperte.length && aperte[0].o.uscita <= o.entrata && aperte[0].o.entrata < o.entrata) { const p = aperte.shift(); if (p.o.uscita === o.entrata && p.o.motivo !== 4) liberateNelMinuto++; chiudi(p); }
    if (cap <= 0) break;
    if (aperte.length >= posti) continue;
    if (aperte.some(p => p.o.simbolo === o.simbolo)) continue;
    if (aperte.length + liberateNelMinuto >= posti && liberateNelMinuto > 0) dentroMinuto++;
    const margine = 0.1 * (composto ? cap : 10000);
    if (aperte.reduce((s, p) => s + p.noz / leva, 0) + margine > cap) margineOltre++;
    aperte.push({ o, noz: margine * leva });
  }
  aperte.sort((a, b) => a.o.uscita - b.o.uscita);
  for (const p of aperte) chiudi(p);
  return { cap, dentroMinuto, margineOltre };
}
for (const leva of [3, 5]) for (const composto of [false, true]) {
  const m = mio({ leva, posti: 1e9, composto });
  const r = simulaPortafoglio(ops, { capitale: 10000, posti: 1e9, quota: 0.1, leva, freno: 0, composto, slittamento: S, slittamentoPiccole: S, seme: 1 });
  console.log(`posti illimitati, leva ${leva}, ${composto ? 'composto' : 'fissa'}: differenza relativa capitale finale motore/mio = ${(r.capitaleFinale / m.cap - 1).toExponential(2)}`);
}
const d = mio({ leva: 3, posti: 10, composto: false });
console.log(`10 posti, leva 3, fissa: entrate possibili solo grazie a uno stop scattato dentro lo stesso minuto = ${d.dentroMinuto} su ${ops.length}; entrate con margine totale oltre il capitale = ${d.margineOltre}`);

// --- diagnosi della differenza con interesse composto: confronto il nozionale operazione per operazione
if (process.argv.includes('--diagnosi')) {
  const r = simulaPortafoglio(ops, { capitale: 10000, posti: 1e9, quota: 0.1, leva: 3, freno: 0, composto: true, slittamento: S, slittamentoPiccole: S, seme: 1 });
  const nozMotore = new Map(r.prese.map(p => [`${p.simbolo}|${p.entrata}`, p.nozionale]));
  let cap = 10000; const aperte = []; let n = 0;
  for (const o of ops) {
    aperte.sort((a, b) => a.o.uscita - b.o.uscita);
    while (aperte.length && aperte[0].o.uscita <= o.entrata && aperte[0].o.entrata < o.entrata) { const p = aperte.shift(); const x = p.o; const fe = x.prezzo * (1 + x.lato * S), fu = x.prezzo * x.rapporto * (1 - x.lato * S); let pnl = p.noz * (x.lato * (fu / fe - 1) - C - C * fu / fe - x.funding); if (x.peggiore >= 0.3) pnl = -p.noz / 3; cap += Math.max(pnl, -p.noz / 3); }
    const noz = 0.1 * cap * 3, nm = nozMotore.get(`${o.simbolo}|${o.entrata}`);
    if (Math.abs(nm / noz - 1) > 1e-9 && n++ < 5) console.log('prima differenza', new Date(o.entrata).toISOString(), o.simbolo, nm / noz - 1, 'aperte in quel momento', aperte.length, 'uscite stesso minuto di altre entrate?', ops.filter(y => y.entrata === o.entrata).length);
    aperte.push({ o, noz });
  }
}

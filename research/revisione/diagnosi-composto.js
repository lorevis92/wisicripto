// Diagnosi: perché con interesse composto il capitale del motore differisce dal conto indipendente
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { leggiColonne } from '../lib/backtest.js';
import { simulaPortafoglio } from '../motore/portafoglio.js';
const dirCache = join('data', 'backtest', 'verifica', readdirSync(join('data', 'backtest', 'verifica')).find(d => !d.endsWith('.json')));
const ops = [];
readdirSync(dirCache).sort().forEach((f, si) => { const c = leggiColonne(join(dirCache, f)); for (let k = 0; k < c.lato.length; k++) ops.push({ simbolo: si, piccola: true, lato: c.lato[k], motivo: c.motivo[k], entrata: c.entrata[k], uscita: c.uscita[k], prezzo: c.prezzo[k], rapporto: c.rapporto[k], funding: c.funding[k], peggiore: c.peggiore[k] }); });
ops.sort((a, b) => a.entrata - b.entrata || a.simbolo - b.simbolo);
const r = simulaPortafoglio(ops, { capitale: 10000, posti: 1e9, quota: 0.1, leva: 3, freno: 0, composto: true, slittamento: 0.0008, slittamentoPiccole: 0.0008, seme: 1 });
const t1 = Date.parse('2020-02-15T00:00:00Z'), t2 = Date.parse('2020-02-15T17:00:00Z');
for (const p of r.prese.filter(p => p.entrata >= t1 - 86400000 && p.entrata <= t2)) console.log(new Date(p.entrata).toISOString(), new Date(p.uscita).toISOString(), p.simbolo, 'noz', p.nozionale.toFixed(4), 'pnl', p.pnl.toFixed(4), 'netto', p.netto);
console.log('curva', r.curva.filter(([t]) => t >= t1 - 86400000 && t <= t2).map(([t, c]) => `${new Date(t).toISOString().slice(5, 16)} ${c.toFixed(4)}`).join(' | '));

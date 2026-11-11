// Quanto può essere grande una posizione della regola "grande movimento" prima che lo slittamento diventi un problema.
//   1. Per ogni operazione della verifica (research/08): valore della posizione rispetto al volume del minuto d'entrata
//      su Binance, e rispetto a una stima del volume Bitunix dello stesso minuto (volume Binance × rapporto Bitunix/Binance
//      dei 30 giorni misurati in docs/universo.md).
//   2. Slittamento sopportabile: lo slittamento per lato a cui il portafoglio A + B smette di guadagnare.
//   3. Dimensione massima per moneta: con un book "lineare" (profondità Bitunix entro lo 0,1% misurata in docs/universo.md)
//      un ordine a mercato di valore Q paga in media metà spread + 0,05% · Q / profondità. Si cerca la Q per cui
//      lo slittamento arriva allo 0,08% (quello usato nei test) e allo 0,12% (la prova pesante), con il book calmo
//      e con il book dimezzato (i primi minuti di un'esplosione).
//
// Usa le operazioni già simulate da research/08 (cache in data/backtest/verifica/). Uso: node research/09-dimensione-posizione.js
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { leggiStorico } from './lib/storico.js';
import {
  MIN, caricaPrezzi, caricaFunding, eseguiPortafoglio, leggiColonne, mediana, pct, num, intero, scriviConConclusione,
} from './lib/backtest.js';

const DIR = join('data', 'backtest', 'verifica');
const ris = JSON.parse(readFileSync(join(DIR, 'risultati.json'), 'utf8'));
// la cache più recente delle operazioni (sottocartella con i file A_*.bin / B_*.bin)
const cache = readdirSync(DIR).map(d => join(DIR, d)).filter(d => statSync(d).isDirectory()).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const universo = JSON.parse(readFileSync('data/universo.json', 'utf8')).candidati;
const info = Object.fromEntries(universo.map((c, i) => [c.simbolo, { ...c, rango: i }]));
const SLITT_BASE = { nome: '0,08%', base: 0.0008, piccole: 0.0008 };
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const usdt = x => Number.isNaN(x) ? '–' : x >= 1e6 ? `${num(x / 1e6, 1)} mln` : `${intero(x)}`;

const voci = [...ris.listaA.map(s => ({ chiave: `A_${s}`, simbolo: s, gruppo: 'A' })), ...ris.listaB.map(s => ({ chiave: `B_${s}`, simbolo: s, gruppo: 'B' }))];
const ops = [];
for (const [si, v] of voci.entries()) {
  const f = join(cache, `${v.chiave}.bin`);
  if (!existsSync(f)) continue;
  const c = leggiColonne(f);
  if (!c.entrata.length) continue;
  // volume in USDT del minuto d'entrata e mediana dei 60 minuti prima del segnale, su Binance
  const s = leggiStorico(v.simbolo, { da: c.entrata[0] - 120 * MIN, a: c.entrata.at(-1) + MIN });
  for (let k = 0; k < c.entrata.length; k++) {
    if (c.modo && c.modo[k] !== 0) continue; // solo il risultato principale (prezzi veri dove servono)
    const i = (c.entrata[k] - s.t0) / MIN;
    const prima = []; for (let j = i - 61; j < i - 1; j++) if (j >= 0 && s.quoteVolume[j] > 0) prima.push(s.quoteVolume[j]);
    ops.push({
      simbolo: si, nome: v.simbolo, gruppo: v.gruppo, piccola: info[v.simbolo].rango >= 14, lato: c.lato[k], motivo: c.motivo[k],
      entrata: c.entrata[k], uscita: c.uscita[k], prezzo: c.prezzo[k], rapporto: c.rapporto[k], funding: c.funding[k], peggiore: c.peggiore[k],
      volEntrata: s.quoteVolume[i], volPrima: mediana(prima),
    });
  }
}
ops.sort((a, b) => a.entrata - b.entrata || a.simbolo - b.simbolo);
console.log(`${ops.length} operazioni da ${cache}`);
const contesto = { prezzi: caricaPrezzi(voci.map(v => v.simbolo), { da: Date.UTC(2019, 8, 1), fermi: ris.fermi || [] }), funding: caricaFunding(voci.map(v => v.simbolo)) };

// ---------- 1. Partecipazione al volume del minuto d'entrata ----------
const quotaBitunix = nome => info[nome].volMedioBitunix / info[nome].volMedioBinance;
function partecipazione(lista, nozionale) {
  const pB = lista.map(o => nozionale(o) / o.volEntrata).filter(Number.isFinite);
  const pX = lista.map(o => nozionale(o) / (o.volEntrata * quotaBitunix(o.nome))).filter(Number.isFinite);
  return {
    n: lista.length, volMed: mediana(lista.map(o => o.volEntrata)), volPrimaMed: mediana(lista.map(o => o.volPrima)),
    multiplo: mediana(lista.map(o => o.volEntrata / o.volPrima).filter(Number.isFinite)),
    binMed: mediana(pB), binP90: quantile(pB, 0.9), bitMed: mediana(pX), bitP90: quantile(pX, 0.9),
    oltre1: pX.filter(x => x > 0.01).length / pX.length, oltre5: pX.filter(x => x > 0.05).length / pX.length,
  };
}
// valore reale delle posizioni prese dal portafoglio base (dimensione fissa, leva 3x: 10% di 10.000 × 3 = 3.000 USDT)
const prese = eseguiPortafoglio(ops, { leva: 3, slitt: SLITT_BASE, composto: false, ordini: 1, tieni: true, contesto }).r.prese;
const presiComposto = eseguiPortafoglio(ops, { leva: 3, slitt: SLITT_BASE, composto: true, ordini: 1, tieni: true, contesto }).r.prese;
const vol = new Map(ops.map(o => [`${o.nome}|${o.entrata}`, o]));
const conVol = p => ({ ...vol.get(`${p.nome}|${p.entrata}`), nozionale: p.nozionale });
const base = prese.map(conVol), composto = presiComposto.map(conVol);
const part = {
  'A (2020–2022)': partecipazione(base.filter(o => o.gruppo === 'A'), o => o.nozionale),
  'B (monete 51–100)': partecipazione(base.filter(o => o.gruppo === 'B'), o => o.nozionale),
  'A + B': partecipazione(base, o => o.nozionale),
};
const perAnnoComposto = Object.entries(Object.groupBy(composto, o => new Date(o.entrata).getUTCFullYear())).map(([anno, l]) => ({
  anno, noz: mediana(l.map(o => o.nozionale)), ...partecipazione(l, o => o.nozionale),
}));
// dimensioni di prova: quota di operazioni in cui la posizione supera l'1% e il 5% del volume Bitunix stimato del minuto
const PROVE = [1000, 3000, 5000, 10000, 25000, 50000, 100000];
const provaDim = PROVE.map(q => ({ q, ...partecipazione(ops, () => q) }));

// ---------- 2. Slittamento sopportabile ----------
console.log('Slittamento sopportabile...');
const griglia = [];
for (let x = 0.0005; x <= 0.0060001; x += 0.0005) {
  const m = eseguiPortafoglio(ops, { leva: 3, slitt: { base: x, piccole: x }, composto: false, ordini: 3, contesto }).m;
  griglia.push({ x, m });
}
const pareggio = (() => { for (let k = 1; k < griglia.length; k++) if (griglia[k].m.rendimento <= 0) { const a = griglia[k - 1], b = griglia[k]; return a.x + (b.x - a.x) * a.m.rendimento / (a.m.rendimento - b.m.rendimento); } return NaN; })();

// ---------- 3. Dimensione massima per moneta dal book Bitunix ----------
const qMax = (c, budget, fattore) => Math.max(0, (budget - c.spreadBps / 2 / 10000) / 0.0005 * c.profondita01 * fattore);
const nomi = [...new Set(ops.map(o => o.nome))];
const perMoneta = nomi.map(nome => {
  const c = info[nome], l = ops.filter(o => o.nome === nome);
  const volMinBit = mediana(l.map(o => o.volEntrata)) * quotaBitunix(nome);
  return {
    nome, gruppo: l[0].gruppo, n: l.length, prof: c.profondita01, spread: c.spreadBps, volGiornoBit: c.volMedioBitunix, volMinBit,
    ordineMax: c.ordineMercatoMax * c.prezzo,
    q08: qMax(c, 0.0008, 1), q08m: qMax(c, 0.0008, 0.5), q12: qMax(c, 0.0012, 1), q12m: qMax(c, 0.0012, 0.5),
  };
}).sort((a, b) => a.q08m - b.q08m);
// dimensione unica per tutto il portafoglio: quota di operazioni ancora entro lo 0,08% / 0,12% con il book dimezzato
const entro = (q, budget) => ops.filter(o => q <= qMax(info[o.nome], budget, 0.5)).length / ops.length;
const unica = PROVE.map(q => ({ q, e08: entro(q, 0.0008), e12: entro(q, 0.0012) }));

// ---------- Documento ----------
const r1 = (nome, p) => `| ${nome} | ${intero(p.n)} | ${usdt(p.volPrimaMed)} | ${usdt(p.volMed)} | ${num(p.multiplo, 1)}× | ${pct(p.binMed, 2)} | ${pct(p.binP90, 2)} | ${pct(p.bitMed, 1)} | ${pct(p.bitP90, 1)} | ${pct(p.oltre1, 0)} |`;
const testo = `# Dimensione delle posizioni e slittamento

Strategia "grande movimento", regola fissata (docs/regola-fissata.md), operazioni della verifica su dati mai usati (docs/verifica-dati-nuovi.md).
Script: \`research/09-dimensione-posizione.js\`. Operazioni: ${intero(ops.length)}.

**Come si legge.**
- Il test usa 10.000 USDT di capitale, 10% di margine per posizione e leva 3x: ogni posizione vale **3.000 USDT** (5.000 con leva 5x).
- Il volume del minuto d'entrata viene dai dati Binance.
- Bitunix, dove si opera davvero, ha molto meno volume: la stima Bitunix moltiplica il volume Binance del minuto per il rapporto Bitunix/Binance dei 30 giorni misurati in docs/universo.md.
- È una stima: quel rapporto è di oggi e cambia nel tempo.

## 1. Quanto pesa la posizione sul volume del minuto d'entrata

Dimensione fissa, leva 3x (3.000 USDT per posizione), solo le operazioni prese dal portafoglio.

Gruppo | Operazioni | Volume Binance al minuto, mediana dell'ora prima | Volume Binance del minuto d'entrata (mediana) | Entrata / ora prima | Posizione / volume Binance (mediana) | (90° percentile) | Posizione / volume Bitunix stimato (mediana) | (90° percentile) | Operazioni oltre l'1% del volume Bitunix
---|---:|---:|---:|---:|---:|---:|---:|---:|---:
${Object.entries(part).map(([k, p]) => r1(k, p)).join('\n')}

Il minuto d'entrata ha di solito molto più volume del normale: la posizione entra nel momento in cui il mercato è più attivo.

**Con altre dimensioni** (tutte le operazioni, stessa posizione per tutte):

Valore della posizione (USDT) | Posizione / volume Bitunix stimato (mediana) | (90° percentile) | Operazioni oltre l'1% | Operazioni oltre il 5%
---:|---:|---:|---:|---:
${provaDim.map(p => `${intero(p.q)} | ${pct(p.bitMed, 1)} | ${pct(p.bitP90, 1)} | ${pct(p.oltre1, 0)} | ${pct(p.oltre5, 0)}`).join('\n')}

**Interesse composto** (leva 3x): la posizione segue il capitale. Se il capitale cresce, la posizione supera presto quello che il mercato può assorbire.

Anno | Valore mediano della posizione | Posizione / volume Bitunix stimato (mediana) | Operazioni oltre l'1%
---|---:|---:|---:
${perAnnoComposto.map(p => `${p.anno} | ${usdt(p.noz)} | ${pct(p.bitMed, 1)} | ${pct(p.oltre1, 0)}`).join('\n')}

## 2. Quanto slittamento sopporta la regola

Portafoglio A + B, dimensione fissa, leva 3x, slittamento uguale per tutte le monete, per lato (entrata e uscita). Media di 3 ordini casuali.

Slittamento per lato | Rendimento | Profit factor | Peggior calo
---:|---:|---:|---:
${griglia.map(g => `${pct(g.x, 2)} | ${pct(g.m.rendimento)} | ${num(g.m.profitFactor)} | ${pct(g.m.caloMassimo)}`).join('\n')}

**Pareggio: circa ${pct(pareggio, 2)} per lato.** Oltre quel valore la regola perde.

## 3. Dimensione massima per posizione, moneta per moneta

**Il modello.**
- Un ordine a mercato di valore Q consuma il book. Se il book è distribuito in modo uniforme, il prezzo medio peggiora di metà spread più 0,05% × Q / profondità.
- La profondità è quella misurata su Bitunix entro lo 0,1% dal prezzo, sul lato più sottile, in un momento tranquillo (docs/universo.md).
- "Book dimezzato" è l'ipotesi prudente per i primi minuti di un'esplosione, quando il book si svuota.
- La tabella dà il valore massimo della posizione per restare allo 0,08% (il valore usato nei test) o allo 0,12% (la prova pesante).
- La colonna "Ordine a mercato massimo" è il limite di Bitunix per un singolo ordine a mercato.

Moneta | Gruppo | Operazioni | Volume Bitunix al giorno | Profondità 0,1% | Spread | Max per 0,08% (book calmo) | Max per 0,08% (book dimezzato) | Max per 0,12% (book dimezzato) | Ordine a mercato massimo
---|---|---:|---:|---:|---:|---:|---:|---:|---:
${perMoneta.map(m => `${m.nome} | ${m.gruppo} | ${m.n} | ${usdt(m.volGiornoBit)} | ${usdt(m.prof)} | ${num(m.spread, 1)} bps | ${usdt(m.q08)} | ${usdt(m.q08m)} | ${usdt(m.q12m)} | ${usdt(m.ordineMax)}`).join('\n')}

**Una dimensione unica per tutte le posizioni** (book dimezzato): quota di operazioni in cui lo slittamento resta entro la soglia.

Valore della posizione (USDT) | Entro 0,08% | Entro 0,12%
---:|---:|---:
${unica.map(u => `${intero(u.q)} | ${pct(u.e08, 0)} | ${pct(u.e12, 0)}`).join('\n')}

<!-- conclusione -->
`;
scriviConConclusione(join('docs', 'dimensione-posizione.md'), testo);
console.log(`Pareggio slittamento: ${pct(pareggio, 3)}`);
console.table(unica);

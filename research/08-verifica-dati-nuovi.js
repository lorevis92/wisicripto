// Verifica della regola fissata (docs/regola-fissata.md) su dati mai usati, una sola volta, senza cambiarla.
//   A: le stesse 50 monete (solo quelle che esistevano, solo altcoin come dice la regola) dal 2020-01-01 al 2022-12-31
//   B: le monete dalla 51ª alla 100ª di docs/universo.md, dal 2023-01-01 a oggi
//   A + B insieme come un unico portafoglio
// Più l'analisi del rischio: anno per anno, peggior calo, giorni peggiori, posizioni dalla stessa parte,
// e da dove veniva il calo del 40% della versione base nel 30% (docs/grande-movimento.md).
//
// Uso: node --max-old-space-size=12288 research/08-verifica-dati-nuovi.js
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leggiFunding } from './lib/storico.js';
import { fineSettimana } from './motore/sessioni.js';
import { operazioniGrandeMovimento } from './motore/grandeMovimento.js';
import { metricheOperazioni } from './motore/metriche.js';
import { rendimentoNetto, nettoOperazione } from './motore/costi.js';
import { NOMI_MOTIVI } from './motore/posizione.js';
import {
  MIN, GIORNO, INIZIO, datiComuni, storicoConFermi, operazioniInParallelo, servizioWorker, comeColonne, caricaPrezzi, caricaFunding,
  eseguiPortafoglio, LEVE, leggiColonne, firma, pct, num, intero, data, rend, calo, rigaMetriche, INTESTAZIONE_METRICHE,
} from './lib/backtest.js';

const REGOLA = JSON.parse(readFileSync(join('data', 'backtest', 'regola', 'regola.json'), 'utf8')).regola;
const VARIANTI = [{ id: 0, N: REGOLA.N, k: REGOLA.k, direzione: REGOLA.direzione, conferma: REGOLA.conferma }];
const SCHEMA = { variante: Uint8Array, lato: Int8Array, motivo: Uint8Array, entrata: Float64Array, uscita: Float64Array, prezzo: Float64Array, rapporto: Float64Array, funding: Float32Array, peggiore: Float32Array, forza: Float32Array, finestra: Uint8Array };
const PERIODO_A = { da: Date.UTC(2019, 8, 1), a: Date.UTC(2023, 0, 1), conta: Date.UTC(2020, 0, 1) }; // dal 2019-09 solo per il riscaldamento
const SLITT = [
  { nome: '0,05%', base: 0.0005, piccole: 0.0008 },
  { nome: '0,08%', base: 0.0008, piccole: 0.0008 },
  { nome: '0,12%', base: 0.0012, piccole: 0.0012 },
];
const vuote = () => comeColonne(SCHEMA, Object.fromEntries(Object.keys(SCHEMA).map(k => [k, []])));

// ---------- Worker: operazioni della regola fissata per una moneta ("A_SIMBOLO" o "B_SIMBOLO") ----------
if (!isMainThread) servizioWorker(parentPort, chiave => {
  const [gruppo, simbolo] = [chiave.slice(0, 1), chiave.slice(2)];
  const { fermi } = workerData;
  const da = gruppo === 'A' ? PERIODO_A.da : INIZIO, a = gruppo === 'A' ? PERIODO_A.a : Infinity;
  const s = storicoConFermi(simbolo, fermi, { da, a });
  if (!s || s.n < 30 * 1440) return vuote();
  const funding = (leggiFunding(simbolo) || []).filter(x => x[0] >= da && x[0] < a);
  const o = operazioniGrandeMovimento({ s, funding, varianti: VARIANTI, config: REGOLA.config });
  const tieni = o.uscita.map((u, i) => (gruppo === 'A' ? o.entrata[i] >= PERIODO_A.conta && u < PERIODO_A.a - MIN : true));
  for (const k of Object.keys(o)) o[k] = o[k].filter((_, i) => tieni[i]);
  return comeColonne(SCHEMA, o);
});

// ---------- Analisi del calo più profondo ----------
function analizzaCalo(r, capitale) {
  let picco = capitale, tPicco = r.curva[0][0], peggio = { calo: 0 };
  for (const [t, c] of r.curva) {
    if (c > picco) { picco = c; tPicco = t; }
    const x = (picco - c) / picco;
    if (x > peggio.calo) peggio = { calo: x, tPicco, tFondo: t, capPicco: picco, capFondo: c };
  }
  if (!peggio.tFondo) return null;
  const dentro = r.prese.filter(p => p.uscita > peggio.tPicco && p.uscita <= peggio.tFondo).sort((a, b) => a.uscita - b.uscita);
  let serie = 0, serieMax = 0;
  for (const p of dentro) { if (p.pnl <= 0) { serie++; serieMax = Math.max(serieMax, serie); } else serie = 0; }
  const caduta = peggio.capPicco - peggio.capFondo;
  const perGiorno = new Map();
  for (const p of dentro) { const g = Math.floor((p.uscita - 1) / GIORNO) * GIORNO; const x = perGiorno.get(g) || { pnl: 0, n: 0, long: 0, short: 0 }; x.pnl += p.pnl; x.n++; if (p.lato === 1) x.long++; else x.short++; perGiorno.set(g, x); }
  const giorni = [...perGiorno].map(([g, x]) => ({ g, ...x, maxStessoLato: maxStessoLatoNelGiorno(r.prese, g) })).sort((a, b) => a.pnl - b.pnl);
  const negativi = giorni.filter(x => x.pnl < 0);
  return {
    ...peggio, operazioni: dentro.length, perdenti: dentro.filter(p => p.pnl <= 0).length, serieMax, caduta,
    giorniNelCalo: Math.round((peggio.tFondo - peggio.tPicco) / GIORNO), giorniConOperazioni: giorni.length,
    quotaGiornoPeggiore: negativi.length ? -negativi[0].pnl / caduta : 0,
    quota3GiorniPeggiori: -negativi.slice(0, 3).reduce((s, x) => s + x.pnl, 0) / caduta,
    giorniPeggiori: giorni.slice(0, 5),
  };
}
// Massimo di posizioni aperte insieme dallo stesso lato durante un giorno UTC
function maxStessoLatoNelGiorno(prese, g) {
  const ev = prese.filter(p => p.entrata < g + GIORNO && p.uscita > g).flatMap(p => [[Math.max(p.entrata, g), 1, p.lato], [p.uscita, -1, p.lato]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let nL = 0, nS = 0, m = { n: 0, lato: 0 };
  for (const [, d, lato] of ev) { if (lato === 1) nL += d; else nS += d; if (nL > m.n) m = { n: nL, lato: 1 }; if (nS > m.n) m = { n: nS, lato: -1 }; }
  return m;
}

async function main() {
  const principali = datiComuni(); // monete 1–50 e fermi già noti
  const rA = JSON.parse(readFileSync('data/binance/rapporto-buchi-prima-2023.json', 'utf8'));
  const rB = JSON.parse(readFileSync('data/binance/rapporto-buchi-monete-51-100.json', 'utf8'));
  const fermi = [...principali.fermi, ...rA.fermiBorsa, ...rB.fermiBorsa];
  const fineB = rB.finoA;
  // regola: solo altcoin → in A si escludono BTC ed ETH; le 51–100 sono tutte altcoin
  const universo = JSON.parse(readFileSync('data/universo.json', 'utf8')).candidati.map(c => c.simbolo);
  const escluse = REGOLA.monete === 'altcoin' ? new Set(['BTCUSDT', 'ETHUSDT']) : new Set();
  const listaA = rA.simboli.filter(s => !escluse.has(s) && rA.rapporto[s]);
  const listaB = rB.simboli.filter(s => !escluse.has(s) && rB.rapporto[s]);
  const voci = [...listaA.map(s => ({ chiave: `A_${s}`, simbolo: s, gruppo: 'A' })), ...listaB.map(s => ({ chiave: `B_${s}`, simbolo: s, gruppo: 'B' }))];
  console.log(`A: ${listaA.length} monete 2020–2022 · B: ${listaB.length} monete dal 2023 al ${data(fineB - 1)}`);
  const colonne = await operazioniInParallelo({
    script: fileURLToPath(import.meta.url), cartella: join('data', 'backtest', 'verifica'), firmaConfig: firma({ REGOLA, PERIODO_A, v: 1 }),
    simboli: voci.map(v => v.chiave), datiWorker: { fermi }, rifai: false,
  });
  console.log('Carico i prezzi per il freno...');
  const contesto = { prezzi: caricaPrezzi(voci.map(v => v.simbolo), { da: PERIODO_A.da }), funding: caricaFunding(voci.map(v => v.simbolo)) };
  const ops = [];
  voci.forEach((v, si) => {
    const c = colonne[v.chiave], rango = universo.indexOf(v.simbolo);
    for (let k = 0; k < c.variante.length; k++) ops.push({
      simbolo: si, nome: v.simbolo, gruppo: v.gruppo, piccola: rango >= 14, lato: c.lato[k], motivo: c.motivo[k], entrata: c.entrata[k], uscita: c.uscita[k],
      prezzo: c.prezzo[k], rapporto: c.rapporto[k], funding: c.funding[k], peggiore: c.peggiore[k], forza: c.forza[k], finestra: c.finestra[k],
    });
  });
  ops.sort((a, b) => a.entrata - b.entrata || a.simbolo - b.simbolo);
  const insiemi = { A: ops.filter(o => o.gruppo === 'A'), B: ops.filter(o => o.gruppo === 'B'), 'A + B': ops };
  const lordo = o => o.lato * (o.rapporto - 1);
  const misOp = (lista, s = SLITT[1]) => ({ ...metricheOperazioni(lista.map(o => rendimentoNetto(o.lato, o.rapporto, o.piccola ? Math.max(s.base, s.piccole) : s.base, o.funding))), lordo: lista.length ? lista.reduce((x, o) => x + lordo(o), 0) / lista.length : NaN });
  const base = { leva: 3, slitt: SLITT[1], composto: false, contesto };

  console.log('Portafogli...');
  const risultati = {};
  for (const [nome, lista] of Object.entries(insiemi)) {
    const configurazioni = [];
    for (const slitt of SLITT) for (const leva of LEVE) for (const composto of [false, true]) configurazioni.push({ slitt: slitt.nome, leva, composto, m: eseguiPortafoglio(lista, { leva, slitt, composto, contesto }).m });
    risultati[nome] = { operazioni: { s05: misOp(lista, SLITT[0]), s08: misOp(lista, SLITT[1]), s12: misOp(lista, SLITT[2]) }, configurazioni };
  }
  // Criteri decisi prima (docs/regola-fissata.md)
  const trova = (nome, slitt) => risultati[nome].configurazioni.find(c => c.slitt === slitt && c.leva === 3 && !c.composto).m;
  const AB = trova('A + B', '0,08%');
  const criteri = [
    { testo: 'A + B: rendimento positivo e profit factor almeno 1,10', ok: AB.rendimento > 0 && AB.profitFactor >= 1.1, valore: `${rend(AB)}, PF ${num(AB.profitFactor)}` },
    { testo: 'A + B: lordo medio per operazione almeno 0,30%', ok: risultati['A + B'].operazioni.s08.lordo >= 0.003, valore: pct(risultati['A + B'].operazioni.s08.lordo, 3) },
    { testo: 'in utile sia su A sia su B da soli', ok: trova('A', '0,08%').rendimento > 0 && trova('B', '0,08%').rendimento > 0, valore: `A ${rend(trova('A', '0,08%'))}, B ${rend(trova('B', '0,08%'))}` },
    { testo: 'con slittamento 0,12% non in perdita', ok: trova('A + B', '0,12%').rendimento >= 0, valore: rend(trova('A + B', '0,12%')) },
  ];
  const verdetto = criteri[0].ok && criteri[1].ok ? (criteri[2].ok && criteri[3].ok ? 'regge' : 'regge in parte') : 'non regge';

  // Anno per anno (ogni anno riparte da 10.000 USDT)
  const anni = [];
  for (let y = 2020; y <= new Date(fineB).getUTCFullYear(); y++) {
    const da = Date.UTC(y, 0, 1), a = Math.min(Date.UTC(y + 1, 0, 1), fineB), l = ops.filter(o => o.entrata >= da && o.entrata < a);
    anni.push({ anno: y, gruppo: y <= 2022 ? 'A' : 'B', parziale: a < Date.UTC(y + 1, 0, 1), m: eseguiPortafoglio(l, base).m, op: misOp(l) });
  }
  // Scomposizioni
  const ora = o => new Date(o.entrata).getUTCHours();
  const gruppi = [
    ['A (2020–2022)', o => o.gruppo === 'A'], ['B (monete 51–100)', o => o.gruppo === 'B'],
    ['Long', o => o.lato === 1], ['Short', o => o.lato === -1],
    ['Giorni feriali', o => !fineSettimana(o.entrata)], ['Weekend', o => fineSettimana(o.entrata)],
    ['Finestra 15 min', o => o.finestra === 15], ['Finestra 60 min', o => o.finestra === 60],
    ...[0, 4, 8, 12, 16, 20].map(h => [`Ore ${String(h).padStart(2, '0')}–${String(h + 4).padStart(2, '0')} UTC`, o => ora(o) >= h && ora(o) < h + 4]),
  ].map(([nome, f]) => ({ nome, m: misOp(ops.filter(f)) }));
  const monete = Object.entries(Object.groupBy(ops, o => o.nome)).map(([nome, l]) => ({ nome, n: l.length, ...misOp(l) })).sort((a, b) => b.somma - a.somma);
  const motivi = {}; for (const o of ops) motivi[o.motivo] = (motivi[o.motivo] || 0) + 1;

  // Rischio: calo più profondo del portafoglio A + B, e quello del 40% della versione base nel 30%
  const { r } = eseguiPortafoglio(ops, { ...base, ordini: 1, tieni: true });
  const caloAB = analizzaCalo(r, 10000);
  const caloA = analizzaCalo(eseguiPortafoglio(insiemi.A, { ...base, ordini: 1, tieni: true }).r, 10000);
  const caloB = analizzaCalo(eseguiPortafoglio(insiemi.B, { ...base, ordini: 1, tieni: true }).r, 10000);
  console.log('Calo del 40% della versione base (dati già visti)...');
  const calo40 = analizzaCalo40(principali);

  mkdirSync(join('data', 'backtest', 'verifica'), { recursive: true });
  const out = { creato: new Date().toISOString(), regola: REGOLA, listaA, listaB, fineB, risultati, criteri, verdetto, anni, gruppi, monete, motivi, caloAB, caloA, caloB, calo40, scartati: r.scartati };
  writeFileSync(join('data', 'backtest', 'verifica', 'risultati.json'), JSON.stringify(out, (k, x) => (x === Infinity ? 'inf' : x), 1));
  scriviDoc(out);
  console.log(`Verdetto: ${verdetto}`);
}

// Ricostruisce dalla cache di research/06 la versione base "segui, 60 min, 8×, tutte le monete" nel 30% e ne analizza il calo
function analizzaCalo40({ simboli, taglio, fineDati }) {
  const cartella = join('data', 'backtest', 'grande-movimento');
  const dir = readdirSync(cartella).map(d => join(cartella, d)).find(d => existsSync(join(d, 'BTCUSDT.bin')));
  if (!dir) return null;
  const ris = JSON.parse(readFileSync(join(cartella, 'risultati.json'), 'utf8'));
  const v = ris.tabella.find(x => x.v.direzione === 'segui' && x.v.N === 60 && x.v.k === 8 && x.v.conferma === 'nessuna').v;
  const ops = [];
  simboli.forEach((s, si) => {
    const c = leggiColonne(join(dir, `${s}.bin`));
    for (let k = 0; k < c.variante.length; k++) if (c.variante[k] === v.id && c.entrata[k] >= taglio) ops.push({ simbolo: si, piccola: si >= 14, lato: c.lato[k], motivo: c.motivo[k], entrata: c.entrata[k], uscita: c.uscita[k], prezzo: c.prezzo[k], rapporto: c.rapporto[k], funding: c.funding[k], peggiore: c.peggiore[k] });
  });
  ops.sort((a, b) => a.entrata - b.entrata || a.simbolo - b.simbolo);
  const contesto = { prezzi: caricaPrezzi(simboli, { da: taglio - 30 * GIORNO }), funding: caricaFunding(simboli) };
  const { r, m } = eseguiPortafoglio(ops, { leva: 3, slitt: SLITT[1], composto: false, ordini: 1, tieni: true, contesto });
  return { variante: v, misure: m, ...analizzaCalo(r, 10000) };
}

// ---------- Documento ----------
function scriviDoc(out) {
  const { risultati, criteri, verdetto, anni, gruppi, monete, motivi, caloAB, caloA, caloB, calo40, listaA, listaB, fineB } = out;
  const righe = [], p = s => righe.push(s);
  const AB = risultati['A + B'].configurazioni.find(c => c.slitt === '0,08%' && c.leva === 3 && !c.composto).m;
  p('# Verifica della regola su dati mai usati');
  p('');
  p(`Aggiornato il ${out.creato.slice(0, 10)}. Regola: \`docs/regola-fissata.md\` (fissata prima di questo test e non cambiata). Script: \`research/08-verifica-dati-nuovi.js\`. Risultati completi: \`data/backtest/verifica/risultati.json\`.`);
  p('');
  p('<!-- conclusione -->');
  p('');
  p('## Cosa è stato verificato');
  p(`- **Regola**: solo altcoin; segnale quando il rendimento degli ultimi 15 o 60 minuti supera **${out.regola.k} volte** il movimento normale; si segue il movimento; entrata a mercato al minuto dopo; uscite Wisi Trade (stop 1,5 unità, poi stop che segue 1 unità e protezione 40%), durata massima e pausa 4 ore.`);
  p(`- **A**: ${listaA.length} delle 50 monete che esistevano prima del 2023 (BTC ed ETH escluse dalla regola), operazioni dal 2020-01-01 al 2022-12-31. Dati da settembre 2019 solo per calcolare il movimento normale e l'unità.`);
  p(`- **B**: le ${listaB.length} monete dalla 51ª alla 100ª di \`docs/universo.md\`, dal 2023-01-01 al ${data(fineB - 1)}.`);
  p('- **A + B**: un unico portafoglio con tutte queste operazioni (A dal 2020 al 2022, B dal 2023).');
  p('- **Metodo**: come negli altri test. 10.000 USDT, 10 posizioni, margine 10%, leva 3x e 5x, freno 8% su perdita chiusa + aperta, dimensione fissa e composto, media di 10 ordini casuali. Commissione 0,06% per lato, slittamento 0,05% / 0,08% / 0,12% per lato (minimo 0,08% dalla 15ª moneta, quindi quasi tutte), funding reale.');
  p('');
  p('## I criteri decisi prima');
  p(`Dimensione fissa, leva 3x, slittamento 0,08%. **Verdetto: ${verdetto}.**`);
  p('');
  p('| Criterio | Risultato | Soddisfatto |');
  p('|---|---|---|');
  for (const c of criteri) p(`| ${c.testo} | ${c.valore} | ${c.ok ? 'sì' : '**no**'} |`);
  p('');
  p('## Risultati');
  p('Singole operazioni (senza limiti di posti), slittamento 0,08%:');
  p('');
  p('| Dati | Operazioni | Lordo medio | Netto medio (0,05%) | Netto medio (0,08%) | Netto medio (0,12%) | PF (0,08%) | Vincenti |');
  p('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const [nome, x] of Object.entries(risultati)) p(`| ${nome} | ${intero(x.operazioni.s08.operazioni)} | ${pct(x.operazioni.s08.lordo, 3)} | ${pct(x.operazioni.s05.medioNetto, 3)} | ${pct(x.operazioni.s08.medioNetto, 3)} | ${pct(x.operazioni.s12.medioNetto, 3)} | ${num(x.operazioni.s08.profitFactor)} | ${pct(x.operazioni.s08.vincenti, 0)} |`);
  p('');
  p('Portafoglio:');
  p('');
  p(`| Dati | Slittamento | Leva | Dimensione | ${INTESTAZIONE_METRICHE} |`);
  p('|---|---|---:|---|---:|---:|---:|---:|---:|---:|');
  for (const [nome, x] of Object.entries(risultati)) for (const c of x.configurazioni) p(`| ${nome} | ${c.slitt} | ${c.leva}x | ${c.composto ? 'composto' : 'fissa'} | ${rigaMetriche(c.m)} |`);
  p('');
  p('## Anno per anno');
  p('Dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT.');
  p('');
  p(`| Anno | Dati | ${INTESTAZIONE_METRICHE} | Lordo medio |`);
  p('|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const a of anni) p(`| ${a.anno}${a.parziale ? ' (parziale)' : ''} | ${a.gruppo} | ${rigaMetriche(a.m)} | ${pct(a.op.lordo, 3)} |`);
  p('');
  p('## Scomposizione (singole operazioni, slittamento 0,08%)');
  p('| Gruppo | Operazioni | Lordo medio | Netto medio | PF | Vincenti |');
  p('|---|---:|---:|---:|---:|---:|');
  for (const g of gruppi) p(`| ${g.nome} | ${intero(g.m.operazioni)} | ${pct(g.m.lordo, 3)} | ${pct(g.m.medioNetto, 3)} | ${num(g.m.profitFactor)} | ${pct(g.m.vincenti, 0)} |`);
  const totM = Object.values(motivi).reduce((s, v) => s + v, 0);
  p('');
  p(`Uscite: ${Object.entries(motivi).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${NOMI_MOTIVI[k]} ${pct(v / totM, 0)}`).join(', ')}.`);
  p('');
  const somma = monete.reduce((s, x) => s + x.somma, 0);
  p(`**Concentrazione**: le 5 monete migliori fanno ${pct(monete.slice(0, 5).reduce((s, x) => s + x.somma, 0) / somma, 0)} del risultato netto delle singole operazioni (${monete.slice(0, 5).map(x => `${x.nome} ${intero(x.n)} oper., netto medio ${pct(x.medioNetto, 2)}`).join('; ')}). Le 5 peggiori: ${monete.slice(-5).reverse().map(x => `${x.nome} ${pct(x.medioNetto, 2)}`).join(', ')}.`);
  p('');
  p('## Rischio: da dove vengono i cali');
  const descr = (titolo, c) => {
    if (!c) return;
    p(`### ${titolo}`);
    p(`- Calo del **${pct(c.calo)}** dal ${data(c.tPicco)} al ${data(c.tFondo)} (${intero(c.giorniNelCalo)} giorni, ${intero(c.giorniConOperazioni)} con operazioni chiuse), da ${intero(c.capPicco)} a ${intero(c.capFondo)} USDT.`);
    p(`- ${intero(c.operazioni)} operazioni chiuse nel calo, ${intero(c.perdenti)} in perdita; la serie più lunga di perdite di fila è di **${intero(c.serieMax)}**.`);
    p(`- Il giorno peggiore pesa il **${pct(c.quotaGiornoPeggiore, 0)}** della discesa, i 3 giorni peggiori il **${pct(c.quota3GiorniPeggiori, 0)}**.`);
    p('');
    p('| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |');
    p('|---|---:|---:|---|---:|');
    for (const g of c.giorniPeggiori) p(`| ${data(g.g)} | ${intero(g.pnl)} USDT | ${g.n} | ${g.long} / ${g.short} | ${g.maxStessoLato.n} ${g.maxStessoLato.lato === 1 ? 'long' : g.maxStessoLato.lato === -1 ? 'short' : ''} |`);
    p('');
  };
  if (calo40) descr(`Il calo del ${pct(calo40.calo, 0)} già visto: versione base "segui, 60 minuti, oltre 8×, tutte le monete" nel 30% (dati già usati)`, calo40);
  descr('Regola fissata su A + B (portafoglio, dimensione fissa, leva 3x, slittamento 0,08%)', caloAB);
  descr('Regola fissata solo su A (2020–2022)', caloA);
  descr('Regola fissata solo su B (monete 51–100)', caloB);
  p(`Segnali scartati nel portafoglio A + B: posti pieni ${intero(out.scartati.posti)}, freno ${intero(out.scartati.freno)}.`);
  p('');
  p('## Limiti');
  p('- **Le monete sono scelte con la liquidità di oggi**, anche quelle dei dati nuovi: per A sono le monete che esistono ancora e sono tra le più liquide nel 2026; per B quelle che sono arrivate tra le prime 100. Le monete crollate o tolte dalla quotazione non ci sono. Questo favorisce i risultati, soprattutto i long.');
  p('- Su A le monete sono poche (le più vecchie e grandi), su B sono quasi tutte piccole e recenti: i due gruppi sono diversi dal 70% usato per fissare la regola, ed è proprio questo che serve a verificarla.');
  p('- L\'entrata avviene nei primi minuti di un movimento violento: su Bitunix lo slittamento può essere più alto anche dello 0,12%.');
  let testo = righe.join('\n') + '\n';
  const file = 'docs/verifica-dati-nuovi.md';
  if (existsSync(file)) { const m = readFileSync(file, 'utf8').match(/<!-- conclusione:inizio -->[\s\S]*?<!-- conclusione:fine -->/); if (m) testo = testo.replace('<!-- conclusione -->', () => m[0]); }
  testo = testo.replace('<!-- conclusione -->', `<!-- conclusione:inizio -->\n## Conclusione\nVerdetto secondo i criteri fissati prima: **${verdetto}** (con dimensione fissa, leva 3x e slittamento 0,08%, A + B: ${rend(AB)}, profit factor ${num(AB.profitFactor)}).\n<!-- conclusione:fine -->`);
  writeFileSync(file, testo);
}

if (isMainThread) main().catch(e => { console.error(e); process.exit(1); });

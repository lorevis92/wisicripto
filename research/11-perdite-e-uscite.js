// Strategia "grande movimento": dove si perde e se uscite diverse la salvano, sempre con i prezzi veri dentro il minuto.
//
// Stesse entrate della regola fissata (docs/regola-fissata.md), stesse monete della verifica (A: 22 altcoin 2020–2022,
// B: monete 51–100 dal 2023). Prezzi veri di Binance (aggTrades, research/10-prezzi-veri.js --tutte) in ogni minuto
// dall'entrata alla durata massima; le candele servono solo per i 60 minuti dopo l'uscita e per il freno del portafoglio.
//
// Divisione nuova, fissata prima di guardare i risultati:
//   scelta: operazioni con entrata fino al 31/12/2023 (A 2020–2022 + B 2023)
//   verifica: dal 01/01/2024 a oggi (B), una sola volta, con l'uscita scelta senza cambiarla.
//
// Uso:
//   node --max-old-space-size=12288 research/11-perdite-e-uscite.js --fase=scelta    → docs/regola-fissata-2.md (poi commit)
//   node --max-old-space-size=12288 research/11-perdite-e-uscite.js --fase=verifica  → docs/perdite-e-uscite.md
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leggiFunding } from './lib/storico.js';
import { operazioniGrandeMovimento } from './motore/grandeMovimento.js';
import { simulaUscita, NOMI_USCITA } from './motore/uscite.js';
import { fundingPagato, rendimentoNetto } from './motore/costi.js';
import { metricheOperazioni } from './motore/metriche.js';
import {
  MIN, GIORNO, INIZIO, datiComuni, storicoConFermi, operazioniInParallelo, servizioWorker, comeColonne, caricaPrezzi, caricaFunding,
  eseguiPortafoglio, firma, mediana, pct, num, intero, data, rend, calo, rigaMetriche, INTESTAZIONE_METRICHE, scriviConConclusione,
} from './lib/backtest.js';

const REGOLA = JSON.parse(readFileSync(join('data', 'backtest', 'regola', 'regola.json'), 'utf8')).regola;
const VARIANTI_ENTRATA = [{ id: 0, N: REGOLA.N, k: REGOLA.k, direzione: REGOLA.direzione, conferma: REGOLA.conferma }];
const PERIODO_A = { da: Date.UTC(2019, 8, 1), a: Date.UTC(2023, 0, 1), conta: Date.UTC(2020, 0, 1) };
const TAGLIO = Date.UTC(2024, 0, 1);
const FASE = (process.argv.find(a => a.startsWith('--fase=')) || '--fase=verifica').split('=')[1];
const DIR = join('data', 'backtest', 'uscite');
const FILE_REGOLA2 = join(DIR, 'regola-2.json');

// ---------- Le uscite da confrontare (decise prima di vedere i risultati) ----------
// Lo stop loss (1,5 unità) è sempre sulla borsa e istantaneo. Durata massima 4 ore salvo le uscite a tempo.
const B = { stop: 1.5, obiettivo: 0, attivaDa: 0.5, segue: 1, restituisci: 0.4, durata: 240, controllo: 'chiusura' };
export const USCITE = [
  { id: 0, nome: 'Attuale, uscite controllate a ogni prezzo', r: { ...B, controllo: 'prezzo' } },
  { id: 1, nome: 'Attuale, uscite controllate alla chiusura del minuto', r: { ...B } },
  { id: 2, nome: 'Protezione più larga: da 1 unità, si restituisce fino al 60%', r: { ...B, attivaDa: 1, restituisci: 0.6 } },
  { id: 3, nome: 'Senza protezione, stop che segue a 1 unità', r: { ...B, restituisci: 0 } },
  { id: 4, nome: 'Senza protezione, stop che segue a 2 unità', r: { ...B, restituisci: 0, segue: 2 } },
  { id: 5, nome: 'Senza protezione, stop che segue a 3 unità', r: { ...B, restituisci: 0, segue: 3 } },
  { id: 6, nome: 'Solo stop loss, uscita dopo 30 minuti', r: { ...B, restituisci: 0, segue: 0, durata: 30 } },
  { id: 7, nome: 'Solo stop loss, uscita dopo 60 minuti', r: { ...B, restituisci: 0, segue: 0, durata: 60 } },
  { id: 8, nome: 'Solo stop loss, uscita dopo 120 minuti', r: { ...B, restituisci: 0, segue: 0, durata: 120 } },
  { id: 9, nome: 'Solo stop loss, uscita dopo 240 minuti', r: { ...B, restituisci: 0, segue: 0, durata: 240 } },
  { id: 10, nome: 'Obiettivo fisso a 1 unità (più stop loss, massimo 4 ore)', r: { ...B, restituisci: 0, segue: 0, obiettivo: 1 } },
  { id: 11, nome: 'Obiettivo fisso a 2 unità (più stop loss, massimo 4 ore)', r: { ...B, restituisci: 0, segue: 0, obiettivo: 2 } },
  { id: 12, nome: 'Obiettivo fisso a 3 unità (più stop loss, massimo 4 ore)', r: { ...B, restituisci: 0, segue: 0, obiettivo: 3 } },
];
// Criteri di scelta (sul periodo fino al 31/12/2023, singole operazioni, slittamento 0,08%):
//   - ammesse solo le uscite con netto medio positivo sia su A (2020–2022) sia su B 2023, con almeno 300 operazioni in tutto;
//   - tra le ammesse vince il netto medio più alto sull'intero periodo di scelta;
//   - se nessuna è ammessa non si sceglie niente e la strategia non passa.
// Criteri della verifica (dal 2024, uscita scelta, dimensione fissa, leva 3x, slittamento 0,08%):
//   1. portafoglio in utile con profit factor almeno 1,10;  2. lordo medio almeno 0,30%;
//   3. con slittamento 0,12% netto medio non negativo;      4. in utile sia nel 2024 sia dal 2025 in poi.
const SLITT = [{ nome: '0,08%', base: 0.0008, piccole: 0.0008 }, { nome: '0,12%', base: 0.0012, piccole: 0.0012 }];
const ORIZZONTI = [1, 5, 15, 30, 60, 120, 240];
const SCHEMA = {
  uscitaId: Uint8Array, lato: Int8Array, motivo: Uint8Array, entrata: Float64Array, uscita: Float64Array, prezzo: Float64Array, rapporto: Float64Array,
  funding: Float32Array, unita: Float32Array, forza: Float32Array, finestra: Uint8Array, mfe: Float32Array, tMfe: Uint16Array, mae: Float32Array, tMae: Uint16Array,
  veri: Uint16Array, stimati: Uint16Array, dopo60: Float32Array, maxDopo60: Float32Array, uguale: Int8Array,
  ...Object.fromEntries(ORIZZONTI.map(h => [`t${h}`, Float32Array])),
};

// ---------- Worker ----------
if (!isMainThread) servizioWorker(parentPort, chiave => {
  const [gruppo, simbolo] = [chiave.slice(0, 1), chiave.slice(2)];
  const da = gruppo === 'A' ? PERIODO_A.da : INIZIO, a = gruppo === 'A' ? PERIODO_A.a : Infinity;
  const vuote = () => comeColonne(SCHEMA, Object.fromEntries(Object.keys(SCHEMA).map(k => [k, []])));
  const s = storicoConFermi(simbolo, workerData.fermi, { da, a });
  if (!s || s.n < 30 * 1440) return vuote();
  const funding = (leggiFunding(simbolo) || []).filter(x => x[0] >= da && x[0] < a);
  const fileVeri = join('data', 'aggtrades', `${simbolo}.json`);
  const percorsi = existsSync(fileVeri) ? new Map(Object.entries(JSON.parse(readFileSync(fileVeri, 'utf8')).percorsi).map(([t, v]) => [Number(t), v])) : new Map();
  // entrate della regola fissata (e uscita attuale del motore, per controllo)
  const rif = operazioniGrandeMovimento({ s, funding, varianti: VARIANTI_ENTRATA, config: REGOLA.config, percorsi });
  const out = Object.fromEntries(Object.keys(SCHEMA).map(k => [k, []]));
  const { open: O, high: H, low: L, close: C, t0, n } = s;
  for (let q = 0; q < rif.entrata.length; q++) {
    const tE = rif.entrata[q];
    if (gruppo === 'A' && (tE < PERIODO_A.conta || rif.uscita[q] >= PERIODO_A.a - MIN)) continue;
    const iE = (tE - t0) / MIN, lato = rif.lato[q], u = rif.unita[q], P = O[iE];
    const G = p => lato * (p / P - 1);
    const lungo = ORIZZONTI.map(h => { let k = Math.min(n - 1, iE + h); while (k > iE && Number.isNaN(C[k])) k--; return G(C[k]); });
    for (const v of USCITE) {
      const x = simulaUscita({ s, iE, lato, u, percorsi, r: v.r });
      // 60 minuti dopo l'uscita, sulle candele: dove va il prezzo rispetto al prezzo d'uscita, nella direzione dell'operazione
      const kx = Math.round((x.tUscita - t0) / MIN);
      const Gx = p => lato * (p / x.uscita - 1);
      let k60 = Math.min(n - 1, kx + 60); while (k60 > kx && Number.isNaN(C[k60])) k60--;
      let maxD = 0;
      for (let k = kx + 1; k <= Math.min(n - 1, kx + 60); k++) if (!Number.isNaN(H[k])) maxD = Math.max(maxD, Gx(lato === 1 ? H[k] : L[k]));
      out.uscitaId.push(v.id); out.lato.push(lato); out.motivo.push(x.motivo); out.entrata.push(tE); out.uscita.push(x.tUscita);
      out.prezzo.push(P); out.rapporto.push(x.rapporto); out.funding.push(fundingPagato(funding, lato, tE, x.tUscita)); out.unita.push(u);
      out.forza.push(rif.forza[q]); out.finestra.push(rif.finestra[q]); out.mfe.push(x.mfe); out.tMfe.push(x.tMfe); out.mae.push(-x.mae); out.tMae.push(x.tMae);
      out.veri.push(x.veri); out.stimati.push(x.stimati); out.dopo60.push(k60 > kx ? Gx(C[k60]) : NaN); out.maxDopo60.push(maxD);
      out.uguale.push(v.id === 0 ? (Math.abs(x.rapporto - rif.rapporto[q]) < 1e-12 && x.tUscita === rif.uscita[q] ? 1 : 0) : -1);
      ORIZZONTI.forEach((h, j) => out[`t${h}`].push(lungo[j]));
    }
  }
  return comeColonne(SCHEMA, out);
});

// ---------- Misure ----------
const lordo = o => o.lato * (o.rapporto - 1);
const netto = (o, s = SLITT[0]) => rendimentoNetto(o.lato, o.rapporto, s.base, o.funding);
function misura(lista) {
  const m08 = metricheOperazioni(lista.map(o => netto(o, SLITT[0]))), m12 = metricheOperazioni(lista.map(o => netto(o, SLITT[1])));
  return { n: lista.length, lordo: lista.length ? lista.reduce((x, o) => x + lordo(o), 0) / lista.length : NaN, netto08: m08.medioNetto, netto12: m12.medioNetto, pf08: m08.profitFactor, vincenti: m08.vincenti };
}

async function main() {
  const principali = datiComuni();
  const rA = JSON.parse(readFileSync('data/binance/rapporto-buchi-prima-2023.json', 'utf8'));
  const rB = JSON.parse(readFileSync('data/binance/rapporto-buchi-monete-51-100.json', 'utf8'));
  const fermi = [...principali.fermi, ...rA.fermiBorsa, ...rB.fermiBorsa];
  const escluse = new Set(['BTCUSDT', 'ETHUSDT']);
  const listaA = rA.simboli.filter(s => !escluse.has(s) && rA.rapporto[s]), listaB = rB.simboli.filter(s => !escluse.has(s) && rB.rapporto[s]);
  const voci = [...listaA.map(s => ({ chiave: `A_${s}`, simbolo: s, gruppo: 'A' })), ...listaB.map(s => ({ chiave: `B_${s}`, simbolo: s, gruppo: 'B' }))];
  const controlloVeri = JSON.parse(readFileSync('data/aggtrades/controllo.json', 'utf8'));
  const colonne = await operazioniInParallelo({
    script: fileURLToPath(import.meta.url), cartella: DIR, firmaConfig: firma({ REGOLA, USCITE, ORIZZONTI, veri: controlloVeri.creato, v: 1 }),
    simboli: voci.map(v => v.chiave), datiWorker: { fermi }, rifai: false,
  });
  const universo = JSON.parse(readFileSync('data/universo.json', 'utf8')).candidati.map(c => c.simbolo);
  const tutte = [];
  voci.forEach((v, si) => {
    const c = colonne[v.chiave], rango = universo.indexOf(v.simbolo);
    for (let k = 0; k < c.uscitaId.length; k++) {
      const o = { simbolo: si, nome: v.simbolo, gruppo: v.gruppo, rango, piccola: rango >= 14 };
      for (const key of Object.keys(SCHEMA)) o[key] = c[key][k];
      o.peggiore = o.mae;
      tutte.push(o);
    }
  });
  tutte.sort((a, b) => a.entrata - b.entrata || a.simbolo - b.simbolo);
  const perUscita = USCITE.map(v => tutte.filter(o => o.uscitaId === v.id));
  const scelta = l => l.filter(o => o.entrata < TAGLIO), verifica = l => l.filter(o => o.entrata >= TAGLIO);
  mkdirSync(DIR, { recursive: true });

  if (FASE === 'scelta') {
    // ---------- Fase 1: scelta dell'uscita, solo con operazioni fino al 31/12/2023 ----------
    const righe = USCITE.map(v => {
      const l = scelta(perUscita[v.id]);
      const mA = misura(l.filter(o => o.gruppo === 'A')), mB = misura(l.filter(o => o.gruppo === 'B')), mT = misura(l);
      return { v, mA, mB, mT, ammessa: mA.netto08 > 0 && mB.netto08 > 0 && mT.n >= 300 };
    });
    const ammesse = righe.filter(r => r.ammessa).sort((a, b) => b.mT.netto08 - a.mT.netto08);
    const vincitrice = ammesse[0] || null;
    const ctrl = perUscita[0].filter(o => o.entrata < TAGLIO);
    writeFileSync(FILE_REGOLA2, JSON.stringify({ creato: new Date().toISOString(), taglio: TAGLIO, uscita: vincitrice ? vincitrice.v : null, righe: righe.map(r => ({ id: r.v.id, ammessa: r.ammessa, A: r.mA, B: r.mB, tutto: r.mT })) }, null, 1));
    const testo = [], p = s => testo.push(s);
    p('# Regola fissata 2: l\'uscita del grande movimento');
    p('');
    p(`Fissata il ${new Date().toISOString().slice(0, 10)} **prima** della verifica, usando solo le operazioni con entrata fino al 31/12/2023. Script: \`research/11-perdite-e-uscite.js --fase=scelta\`.`);
    p('');
    p('## Cosa resta uguale');
    p('- **Entrate**: quelle della regola fissata (`docs/regola-fissata.md`): solo altcoin, ultimi 15 o 60 minuti oltre 12 volte il movimento normale, si segue il movimento, entrata a mercato al minuto dopo, pausa 4 ore.');
    p('- **Monete**: A = 22 altcoin dal 2020 al 2022, B = monete 51–100 dal 2023.');
    p('- **Prezzi veri** di Binance (aggTrades) in ogni minuto, dall\'entrata alla durata massima.');
    p('- **Stop loss** a 1,5 unità, sempre sulla borsa e istantaneo.');
    p('');
    p('## Divisione');
    p('- **Scelta**: entrate fino al 31/12/2023 (A 2020–2022 e B 2023).');
    p('- **Verifica**: dal 01/01/2024 a oggi (B), una sola volta, senza cambiare la regola.');
    p('');
    p('## Le uscite confrontate');
    p('"Chiusura del minuto" vuol dire che l\'app guarda il prezzo solo alla chiusura di ogni minuto, come Wisi Trade nel Reale. Un\'uscita decisa lì si esegue all\'apertura del minuto dopo. L\'unità è la volatilità della moneta (ATR a 15 minuti).');
    p('');
    for (const v of USCITE) p(`${v.id}. ${v.nome}`);
    p('');
    p('## Criteri decisi prima');
    p('- Sono ammesse solo le uscite con netto medio positivo (slittamento 0,08%) sia su A sia su B 2023, con almeno 300 operazioni in tutto.');
    p('- Tra le ammesse vince il netto medio più alto sull\'intero periodo di scelta.');
    p('- Se nessuna è ammessa, non si sceglie niente e la strategia non passa.');
    p('- **Criteri della verifica** (dal 2024, dimensione fissa, leva 3x, slittamento 0,08%):');
    p('  1. portafoglio in utile con profit factor almeno 1,10;');
    p('  2. lordo medio almeno 0,30% per operazione;');
    p('  3. con slittamento 0,12% netto medio non negativo;');
    p('  4. in utile sia nel 2024 sia dal 2025 in poi.');
    p('');
    p('## Risultati sul periodo di scelta');
    p('Singole operazioni. Netto con commissione 0,06% per lato, slittamento per lato e funding reale.');
    p('');
    p('| Uscita | Operazioni | Lordo medio | Netto (0,08%) | Netto (0,12%) | PF (0,08%) | Netto A | Netto B 2023 | Ammessa |');
    p('|---|---:|---:|---:|---:|---:|---:|---:|---|');
    for (const r of righe) p(`| ${r.v.id}. ${r.v.nome} | ${intero(r.mT.n)} | ${pct(r.mT.lordo, 3)} | ${pct(r.mT.netto08, 3)} | ${pct(r.mT.netto12, 3)} | ${num(r.mT.pf08)} | ${pct(r.mA.netto08, 3)} | ${pct(r.mB.netto08, 3)} | ${r.ammessa ? 'sì' : 'no'} |`);
    p('');
    p(vincitrice ? `## Uscita scelta\n**${vincitrice.v.id}. ${vincitrice.v.nome}.** Regole: \`${JSON.stringify(vincitrice.v.r)}\`. Netto medio sul periodo di scelta ${pct(vincitrice.mT.netto08, 3)} (A ${pct(vincitrice.mA.netto08, 3)}, B 2023 ${pct(vincitrice.mB.netto08, 3)}).` : '## Uscita scelta\n**Nessuna.** Nessuna uscita ha il netto medio positivo sia su A sia su B 2023: secondo i criteri decisi prima la strategia non passa. La verifica dal 2024 si fa lo stesso, ma solo per informazione.');
    p('');
    p(`Controllo: l'uscita 0, rifatta con il nuovo simulatore delle uscite, coincide con il motore del backtest in ${intero(ctrl.filter(o => o.uguale === 1).length)} operazioni su ${intero(ctrl.length)}. Minuti con prezzi veri: ${pct(ctrl.reduce((x, o) => x + o.veri, 0) / ctrl.reduce((x, o) => x + o.veri + o.stimati, 0), 2)}; gli altri, senza scambi o non coincidenti con la candela, usano la candela.`);
    writeFileSync(join('docs', 'regola-fissata-2.md'), testo.join('\n') + '\n');
    console.log(vincitrice ? `Scelta: ${vincitrice.v.id} ${vincitrice.v.nome}` : 'Nessuna uscita ammessa');
    return;
  }

  // ---------- Fase 2: dove si perde (tutti i dati) e verifica dal 2024 ----------
  if (!existsSync(FILE_REGOLA2)) throw new Error('Prima: --fase=scelta');
  const regola2 = JSON.parse(readFileSync(FILE_REGOLA2, 'utf8'));
  const att = perUscita[0];
  // analisi delle perdite sulla regola attuale (uscita 0)
  const conto = (lista, f) => lista.length ? lista.filter(f).length / lista.length : NaN;
  const analisi = lista => {
    const vinc = lista.filter(o => netto(o) > 0), perd = lista.filter(o => netto(o) <= 0);
    const u = o => o.unita;
    return {
      ...misura(lista),
      mfeU: mediana(lista.map(o => o.mfe / u(o))), maeU: mediana(lista.map(o => o.mae / u(o))),
      mfe: mediana(lista.map(o => o.mfe)), mae: mediana(lista.map(o => o.mae)),
      tMfe: mediana(lista.map(o => o.tMfe)), tMae: mediana(lista.map(o => o.tMae)),
      mfeMezza: conto(lista, o => o.mfe >= 0.5 * u(o)), mfeUna: conto(lista, o => o.mfe >= 1 * u(o)),
      restituito: mediana(lista.filter(o => o.mfe > 0).map(o => (o.mfe - lordo(o)) / o.mfe)),
      dopo60: lista.length ? lista.reduce((x, o) => x + (Number.isNaN(o.dopo60) ? 0 : o.dopo60), 0) / lista.length : NaN,
      dopoMeglio: conto(lista, o => o.dopo60 > 0), maxDopo60: mediana(lista.map(o => o.maxDopo60)),
      stessoMinuto: conto(lista, o => o.uscita === o.entrata), durata: mediana(lista.map(o => (o.uscita - o.entrata) / MIN)),
      nV: vinc.length, nP: perd.length,
    };
  };
  const ora = o => new Date(o.entrata).getUTCHours();
  const gruppi = [
    ['Tutte', () => true], ['Vincenti', o => netto(o) > 0], ['Perdenti', o => netto(o) <= 0],
    ['Long', o => o.lato === 1], ['Short', o => o.lato === -1],
    ['Monete grandi (prime 20 per volume)', o => o.rango < 20], ['Monete medie (21ª–50ª)', o => o.rango >= 20 && o.rango < 50], ['Monete piccole (51ª–100ª)', o => o.rango >= 50],
    ...[0, 4, 8, 12, 16, 20].map(h => [`Ore ${String(h).padStart(2, '0')}–${String(h + 4).padStart(2, '0')} UTC`, o => ora(o) >= h && ora(o) < h + 4]),
    ...Object.entries(NOMI_USCITA).map(([k, nome]) => [`Uscita: ${nome}`, o => o.motivo === Number(k)]),
  ].map(([nome, f]) => ({ nome, a: analisi(att.filter(f)) })).filter(g => g.a.n > 0);
  // i perdenti: contro subito, o prima in guadagno?
  const perd = att.filter(o => netto(o) <= 0);
  const tipiPerdenti = {
    n: perd.length,
    controSubito: conto(perd, o => o.mfe < 0.5 * o.unita),
    primaInGuadagno: conto(perd, o => o.mfe >= 0.5 * o.unita),
    unaUnita: conto(perd, o => o.mfe >= 1 * o.unita),
    stessoMinuto: conto(perd, o => o.uscita === o.entrata),
    lordoPositivo: conto(perd, o => lordo(o) > 0), // in guadagno lordo ma in perdita per i costi
  };
  // percorso medio dopo l'entrata, senza nessuna uscita
  const percorso = [['Tutte', () => true], ['Long', o => o.lato === 1], ['Short', o => o.lato === -1], ['Monete piccole (51ª–100ª)', o => o.rango >= 50], ['Fino al 2023', o => o.entrata < TAGLIO], ['Dal 2024', o => o.entrata >= TAGLIO]]
    .map(([nome, f]) => { const l = att.filter(f); return { nome, n: l.length, t: ORIZZONTI.map(h => l.reduce((x, o) => x + o[`t${h}`], 0) / l.length) }; });

  // ---------- Verifica dal 2024 ----------
  const contesto = { prezzi: caricaPrezzi(voci.map(v => v.simbolo), { da: PERIODO_A.da, fermi }), funding: caricaFunding(voci.map(v => v.simbolo)) };
  const portafoglio = (lista, slitt = SLITT[0]) => eseguiPortafoglio(lista, { leva: 3, slitt, composto: false, contesto }).m;
  const tabVer = USCITE.map(v => ({ v, op: misura(verifica(perUscita[v.id])), m: portafoglio(verifica(perUscita[v.id])) }));
  let criteri = null, verdetto = 'non regge (nessuna uscita scelta)', anni = [];
  if (regola2.uscita) {
    const l = verifica(perUscita[regola2.uscita.id]);
    const m = portafoglio(l), op = misura(l);
    const m24 = portafoglio(l.filter(o => o.entrata < Date.UTC(2025, 0, 1))), m25 = portafoglio(l.filter(o => o.entrata >= Date.UTC(2025, 0, 1)));
    criteri = [
      { testo: 'portafoglio in utile con profit factor almeno 1,10', ok: m.rendimento > 0 && m.profitFactor >= 1.1, valore: `${rend(m)}, PF ${num(m.profitFactor)}` },
      { testo: 'lordo medio almeno 0,30%', ok: op.lordo >= 0.003, valore: pct(op.lordo, 3) },
      { testo: 'con slittamento 0,12% netto medio non negativo', ok: op.netto12 >= 0, valore: pct(op.netto12, 3) },
      { testo: 'in utile sia nel 2024 sia dal 2025', ok: m24.rendimento > 0 && m25.rendimento > 0, valore: `2024 ${rend(m24)}, dal 2025 ${rend(m25)}` },
    ];
    verdetto = criteri.every(c => c.ok) ? 'regge' : criteri[0].ok && criteri[1].ok ? 'regge in parte' : 'non regge';
    for (let y = 2024; y <= 2026; y++) { const ly = l.filter(o => new Date(o.entrata).getUTCFullYear() === y); anni.push({ y, m: portafoglio(ly), op: misura(ly) }); }
  }
  writeFileSync(join(DIR, 'risultati.json'), JSON.stringify({ creato: new Date().toISOString(), regola2: regola2.uscita, gruppi, tipiPerdenti, percorso, tabVer, criteri, verdetto, anni }, (k, x) => (x === Infinity ? 'inf' : x), 1));

  // ---------- Documento ----------
  const p = [], q = s => p.push(s);
  const U = x => `${num(x, 2)} u`;
  q('# Grande movimento: dove si perde e se uscite diverse la salvano');
  q('');
  q(`Aggiornato il ${new Date().toISOString().slice(0, 10)}. Script: \`research/11-perdite-e-uscite.js\`. Sempre con i **prezzi veri** di Binance (aggTrades) dentro ogni minuto delle operazioni. Le candele servono solo per i 60 minuti dopo l'uscita e per il freno del portafoglio.`);
  q('');
  q('<!-- conclusione -->');
  q('');
  q('## 1. Dove si perde (regola attuale, tutti i dati)');
  q(`Entrate e uscite della regola fissata, con le uscite controllate a ogni prezzo vero. A (2020–2022) + B (dal 2023): ${intero(att.length)} operazioni. "u" = unità di volatilità della moneta (ATR a 15 minuti), la misura con cui sono definiti stop e uscite: lo stop loss è a 1,5 u.`);
  q('');
  q('**Le perdenti**:');
  q(`- ${intero(tipiPerdenti.n)} operazioni in perdita al netto (slittamento 0,08%).`);
  q(`- Il **${pct(tipiPerdenti.controSubito, 0)}** non è mai arrivato a +0,5 u di guadagno: è andato contro subito.`);
  q(`- Il **${pct(tipiPerdenti.primaInGuadagno, 0)}** era arrivato almeno a +0,5 u, e il ${pct(tipiPerdenti.unaUnita, 0)} almeno a +1 u, prima di chiudere in perdita.`);
  q(`- Il ${pct(tipiPerdenti.lordoPositivo, 0)} è in guadagno al lordo e in perdita solo per i costi.`);
  q(`- Il ${pct(tipiPerdenti.stessoMinuto, 0)} esce nello stesso minuto in cui entra.`);
  q('');
  q('Per gruppo. Mediane, salvo i rendimenti medi:');
  q('- **Massimo a favore / contro**: il miglior guadagno e la peggior perdita toccati prima dell\'uscita.');
  q('- **Restituito**: la quota del guadagno massimo persa uscendo.');
  q('- **Dopo l\'uscita**: dove va il prezzo nei 60 minuti dopo, nella direzione dell\'operazione (positivo = si è usciti troppo presto).');
  q('');
  q('| Gruppo | Operazioni | Lordo medio | Netto (0,08%) | Massimo a favore | (minuti) | Massimo contro | (minuti) | Arrivate a +0,5 u | Arrivate a +1 u | Restituito | Uscita nel minuto d\'entrata | Dopo l\'uscita (+60 min, media) | Meglio dopo 60 min | Massimo a favore nei 60 min dopo |');
  q('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const g of gruppi) { const a = g.a; q(`| ${g.nome} | ${intero(a.n)} | ${pct(a.lordo, 3)} | ${pct(a.netto08, 3)} | ${U(a.mfeU)} (${pct(a.mfe, 2)}) | ${intero(a.tMfe)} | ${U(a.maeU)} (${pct(a.mae, 2)}) | ${intero(a.tMae)} | ${pct(a.mfeMezza, 0)} | ${pct(a.mfeUna, 0)} | ${pct(a.restituito, 0)} | ${pct(a.stessoMinuto, 0)} | ${pct(a.dopo60, 3)} | ${pct(a.dopoMeglio, 0)} | ${pct(a.maxDopo60, 2)} |`); }
  q('');
  q('**Percorso medio dopo l\'entrata, senza nessuna uscita.** È il guadagno lordo medio se si tenesse la posizione esattamente per quel tempo, alla chiusura del minuto: dice se dopo l\'entrata il prezzo continua o torna indietro.');
  q('');
  q(`| Gruppo | Operazioni | ${ORIZZONTI.map(h => `${h} min`).join(' | ')} |`);
  q(`|---|---:|${ORIZZONTI.map(() => '---:').join('|')}|`);
  for (const r of percorso) q(`| ${r.nome} | ${intero(r.n)} | ${r.t.map(x => pct(x, 3)).join(' | ')} |`);
  q('');
  q('## 2. Uscite diverse, con una divisione nuova');
  q('L\'uscita è stata scelta sulle operazioni fino al 31/12/2023 con criteri decisi prima. Le regole e la scelta sono in `docs/regola-fissata-2.md`, salvato con un commit prima della verifica. La verifica va dal 01/01/2024 a oggi (monete 51–100), una sola volta.');
  q('');
  q(regola2.uscita ? `**Uscita scelta: ${regola2.uscita.id}. ${regola2.uscita.nome}.**` : '**Nessuna uscita era stata ammessa sul periodo di scelta**: la tabella della verifica è solo informativa.');
  q('');
  if (criteri) {
    q(`**Verdetto della verifica: ${verdetto}.**`);
    q('');
    q('| Criterio (dal 2024, dimensione fissa, leva 3x, slittamento 0,08%) | Risultato | Soddisfatto |');
    q('|---|---|---|');
    for (const c of criteri) q(`| ${c.testo} | ${c.valore} | ${c.ok ? 'sì' : '**no**'} |`);
    q('');
    q(`| Anno | ${INTESTAZIONE_METRICHE} | Lordo medio |`);
    q('|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const a of anni) q(`| ${a.y}${a.y === 2026 ? ' (parziale)' : ''} | ${rigaMetriche(a.m)} | ${pct(a.op.lordo, 3)} |`);
    q('');
  }
  q('**Tutte le uscite sul periodo di verifica** (dal 2024), per confronto. Solo l\'uscita scelta conta per il verdetto; le altre sono state viste solo dopo la scelta.');
  q('');
  q(`| Uscita | Operazioni | Lordo medio | Netto (0,08%) | Netto (0,12%) | PF (0,08%) | Portafoglio: rendimento | Peggior calo |`);
  q('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of tabVer) q(`| ${r.v.id}. ${r.v.nome}${regola2.uscita && r.v.id === regola2.uscita.id ? ' **(scelta)**' : ''} | ${intero(r.op.n)} | ${pct(r.op.lordo, 3)} | ${pct(r.op.netto08, 3)} | ${pct(r.op.netto12, 3)} | ${num(r.op.pf08)} | ${rend(r.m)} | ${calo(r.m)} |`);
  q('');
  q('## Limiti');
  q('- I prezzi veri sono quelli di Binance, non di Bitunix: su Bitunix il book è più sottile e i percorsi dentro il minuto possono essere diversi.');
  q('- Le monete sono scelte con la liquidità di oggi (vedi `docs/verifica-dati-nuovi.md`).');
  q('- Le entrate sono quelle della regola fissata sul 70% del periodo 2023–2026 (con le candele): anche il periodo di verifica 2024–2026 era già stato guardato per scegliere le entrate, con altre monete.');
  scriviConConclusione(join('docs', 'perdite-e-uscite.md'), p.join('\n') + '\n');
  console.log(`Verdetto: ${verdetto}`);
}

if (isMainThread) main().catch(e => { console.error(e); process.exit(1); });

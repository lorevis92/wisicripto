// Fase 0 · strategia 2: "grande movimento" in qualsiasi momento, con conferme.
//
// Segnale: alla chiusura del minuto i, il rendimento degli ultimi N minuti (5, 15 o 60) è più grande di k volte il
// movimento normale a N minuti della moneta (scarto quadratico dei rendimenti a N minuti nei 14 giorni precedenti:
// solo dati passati). Entrata a mercato all'apertura del minuto dopo (taker + slittamento).
// Direzione: "segui" (nella direzione del movimento) o "contro" (al contrario).
// Dopo un segnale la moneta non ne apre un altro per 4 ore (= durata massima della posizione).
// Uscite come Wisi Trade: unità = ATR (Wilder 14) delle candele da 15 minuti; stop loss 1,5 unità; da +0,5 unità
// stop che segue a 1 unità e protezione del guadagno al 40%; durata massima 4 ore.
// Conferme, una alla volta sopra la versione base:
//   trend1h / trend4h: prima del movimento il prezzo saliva (scendeva) nell'ora / nelle 4 ore precedenti, nella stessa direzione del movimento;
//   btc: per le monete diverse da BTC, BTC negli stessi N minuti si è mosso nella stessa direzione di almeno 1 volta il suo movimento normale;
//   rottura24h: la chiusura supera il massimo (minimo) delle 24 ore prima del movimento;
//   tiene: 3 minuti dopo il segnale il prezzo conserva almeno metà del movimento (entrata 3 minuti più tardi).
//
// Uso: node --max-old-space-size=8192 research/06-grande-movimento.js [--rifai] [--monete=N]
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leggiFunding } from './lib/storico.js';
import { fineSettimana } from './motore/sessioni.js';
import { puntiCandelaIn } from './motore/percorso.js';
import { Posizione, MOTIVI, NOMI_MOTIVI, REGOLE_ATTUALE } from './motore/posizione.js';
import { fundingPagato, rendimentoNetto } from './motore/costi.js';
import { candele15 } from './motore/volatilita.js';
import { operazioniGrandeMovimento } from './motore/grandeMovimento.js';
import { metricheOperazioni } from './motore/metriche.js';
import { casuale } from './motore/portafoglio.js';
import {
  MIN, GIORNO, INIZIO, datiComuni, storicoConFermi, operazioniInParallelo, servizioWorker, comeColonne, caricaPrezzi, caricaFunding,
  eseguiPortafoglio, SLITTAMENTI, LEVE, ORDINI_CASUALI, spearman, mediana, firma,
  pct, num, intero, data, rend, calo, rigaMetriche, INTESTAZIONE_METRICHE, scriviConConclusione,
} from './lib/backtest.js';

const CONFIG = {
  finestre: [5, 15, 60],          // N minuti del movimento
  multipli: [4, 6, 8],            // k volte il movimento normale a N minuti
  direzioni: ['segui', 'contro'],
  conferme: ['nessuna', 'trend1h', 'trend4h', 'btc', 'rottura24h', 'tiene'],
  giorniVolatilita: 14,
  pausa: 240,                     // minuti senza nuovi segnali sulla stessa moneta
  durataMassima: 240,             // minuti
  regole: REGOLE_ATTUALE,         // stop 1,5 unità, da 0,5 unità segue 1 e protezione 40%
  tieneMinuti: 3, tieneQuota: 0.5,
  btcMultiplo: 1,
  monetePrincipali: 14,
  minimoOperazioniScelta: 100,
  obiettivoLordo: 0.005,          // almeno 0,5% medio lordo per operazione
  versione: 1,
};
const VARIANTI = [];
for (const conferma of CONFIG.conferme) for (const direzione of CONFIG.direzioni) for (const N of CONFIG.finestre) for (const k of CONFIG.multipli) {
  VARIANTI.push({ id: VARIANTI.length, N, k, direzione, conferma });
}
const NOMI_CONFERME = { nessuna: 'nessuna conferma', trend1h: 'trend a 1 ora', trend4h: 'trend a 4 ore', btc: 'BTC nella stessa direzione', rottura24h: 'rottura del massimo/minimo di 24 ore', tiene: 'il movimento tiene 3 minuti' };
const nomeVariante = v => `${v.direzione === 'segui' ? 'segui' : 'contro'} il movimento, ${v.N} min > ${v.k}× normale, ${NOMI_CONFERME[v.conferma]}`;
const SCHEMA = {
  variante: Uint8Array, lato: Int8Array, motivo: Uint8Array,
  entrata: Float64Array, uscita: Float64Array, prezzo: Float64Array, rapporto: Float64Array, funding: Float32Array, peggiore: Float32Array, unita: Float32Array, forza: Float32Array,
};

// ---------------------------------------------------------------------------------------------
// Parte 1: operazioni di una moneta (worker) — il calcolo è nel motore (research/motore/grandeMovimento.js)
// ---------------------------------------------------------------------------------------------
function simulaMoneta(simbolo, fermi) {
  const s = storicoConFermi(simbolo, fermi);
  const btc = simbolo !== 'BTCUSDT' ? storicoConFermi('BTCUSDT', fermi) : null;
  const o = operazioniGrandeMovimento({ s, btc, funding: leggiFunding(simbolo) || [], varianti: VARIANTI, config: CONFIG });
  return comeColonne(SCHEMA, o);
}

if (!isMainThread) servizioWorker(parentPort, simbolo => simulaMoneta(simbolo, workerData.fermi));

// ---------------------------------------------------------------------------------------------
// Parte 2: analisi
// ---------------------------------------------------------------------------------------------
const CARTELLA = join('data', 'backtest', 'grande-movimento');

async function main() {
  const rifai = process.argv.includes('--rifai');
  const { simboli, fineDati, taglio, fermi } = datiComuni();
  console.log(`Periodo ${data(INIZIO)} → ${data(fineDati)}, taglio 70/30 al ${data(taglio)}, ${VARIANTI.length} varianti`);
  const colonne = await operazioniInParallelo({
    script: fileURLToPath(import.meta.url), cartella: CARTELLA, firmaConfig: firma({ CONFIG, n: VARIANTI.length }),
    simboli, datiWorker: { fermi }, rifai,
  });
  console.log('Carico i prezzi per il freno...');
  const contesto = { prezzi: caricaPrezzi(simboli), funding: caricaFunding(simboli) };
  // operazioni per variante (oggetti)
  const perVariante = VARIANTI.map(() => []);
  simboli.forEach((sim, si) => {
    const c = colonne[sim];
    for (let k = 0; k < c.variante.length; k++) perVariante[c.variante[k]].push({
      simbolo: si, piccola: si >= CONFIG.monetePrincipali, lato: c.lato[k], motivo: c.motivo[k], entrata: c.entrata[k], uscita: c.uscita[k],
      prezzo: c.prezzo[k], rapporto: c.rapporto[k], funding: c.funding[k], peggiore: c.peggiore[k], forza: c.forza[k],
    });
  });
  for (const l of perVariante) l.sort((a, b) => a.entrata - b.entrata || a.simbolo - b.simbolo);
  const SL = SLITTAMENTI[1];
  const base = { leva: 3, slitt: SL, composto: false, contesto };
  const periodo = (ops, da, a) => ops.filter(o => o.entrata >= da && o.entrata < a);
  const lordo = o => o.lato * (o.rapporto - 1);
  const netto = o => rendimentoNetto(o.lato, o.rapporto, o.piccola ? 0.0008 : SL.base, o.funding);
  const misOp = ops => ({ ...metricheOperazioni(ops.map(netto)), lordo: ops.length ? ops.reduce((s, o) => s + lordo(o), 0) / ops.length : NaN });

  console.log('Operazioni e portafoglio di tutte le varianti...');
  const tabella = VARIANTI.map(v => {
    const a = periodo(perVariante[v.id], INIZIO, taglio), b = periodo(perVariante[v.id], taglio, fineDati);
    return { v, opScelta: misOp(a), opVerifica: misOp(b), scelta: eseguiPortafoglio(a, base).m, verifica: eseguiPortafoglio(b, base).m };
  });
  const scelta = tabella.filter(x => x.scelta.operazioni >= CONFIG.minimoOperazioniScelta && !x.scelta.rovina).sort((a, b) => b.scelta.rendimento - a.scelta.rendimento)[0];
  // migliore per direzione
  const migliore = f => tabella.filter(x => f(x) && x.scelta.operazioni >= CONFIG.minimoOperazioniScelta && !x.scelta.rovina).sort((a, b) => b.scelta.rendimento - a.scelta.rendimento)[0];
  const sceltaDir = { ...Object.fromEntries(CONFIG.direzioni.map(d => [d, migliore(x => x.v.direzione === d)])), base: migliore(x => x.v.conferma === 'nessuna') };

  // Cosa aggiunge ogni conferma rispetto alla base con gli stessi N, k e direzione
  const conferme = CONFIG.conferme.filter(c => c !== 'nessuna').map(c => {
    const coppie = VARIANTI.filter(v => v.conferma === c).map(v => {
      const b = tabella.find(x => x.v.conferma === 'nessuna' && x.v.N === v.N && x.v.k === v.k && x.v.direzione === v.direzione);
      return { v, con: tabella[v.id], base: b };
    });
    const per = dir => {
      const cc = coppie.filter(x => x.v.direzione === dir && x.base.opScelta.operazioni > 0 && x.con.opScelta.operazioni > 0 && x.con.opVerifica.operazioni > 0);
      return {
        casi: cc.length,
        quotaTenute: mediana(cc.map(x => (x.con.opScelta.operazioni + x.con.opVerifica.operazioni) / (x.base.opScelta.operazioni + x.base.opVerifica.operazioni))),
        deltaLordoScelta: mediana(cc.map(x => x.con.opScelta.lordo - x.base.opScelta.lordo)),
        deltaLordoVerifica: mediana(cc.map(x => x.con.opVerifica.lordo - x.base.opVerifica.lordo)),
        miglioraEntrambi: cc.filter(x => x.con.opScelta.lordo > x.base.opScelta.lordo && x.con.opVerifica.lordo > x.base.opVerifica.lordo).length,
      };
    };
    return { conferma: c, segui: per('segui'), contro: per('contro') };
  });

  // Dettaglio di una variante
  const dettaglio = v => {
    const ops = perVariante[v.id];
    const configurazioni = [];
    for (const slitt of SLITTAMENTI) for (const leva of LEVE) for (const composto of [false, true]) {
      configurazioni.push({ slitt: slitt.nome, leva, composto, scelta: eseguiPortafoglio(periodo(ops, INIZIO, taglio), { leva, slitt, composto, contesto }).m, verifica: eseguiPortafoglio(periodo(ops, taglio, fineDati), { leva, slitt, composto, contesto }).m });
    }
    const anni = [];
    for (let y = 2023; y <= new Date(fineDati).getUTCFullYear(); y++) anni.push({ anno: y, parziale: Date.UTC(y + 1, 0, 1) > fineDati, m: eseguiPortafoglio(periodo(ops, Date.UTC(y, 0, 1), Math.min(Date.UTC(y + 1, 0, 1), fineDati)), base).m });
    const ora = o => new Date(o.entrata).getUTCHours();
    const gruppi = [
      ['BTC ed ETH', o => o.simbolo <= 1], ['Le altre 48', o => o.simbolo > 1],
      ['Long', o => o.lato === 1], ['Short', o => o.lato === -1],
      ['Giorni feriali', o => !fineSettimana(o.entrata)], ['Weekend', o => fineSettimana(o.entrata)],
      ...[0, 4, 8, 12, 16, 20].map(h => [`Ore ${String(h).padStart(2, '0')}–${String(h + 4).padStart(2, '0')} UTC`, o => ora(o) >= h && ora(o) < h + 4]),
      ['Movimento fino a 1,5× la soglia', o => o.forza < v.k * 1.5], ['Movimento oltre 1,5× la soglia', o => o.forza >= v.k * 1.5],
    ];
    const scomp = gruppi.map(([nome, f]) => ({ nome, scelta: misOp(periodo(ops, INIZIO, taglio).filter(f)), verifica: misOp(periodo(ops, taglio, fineDati).filter(f)) }));
    const { r } = eseguiPortafoglio(periodo(ops, INIZIO, fineDati), { ...base, ordini: 1, tieni: true });
    const motivi = {};
    for (const p of r.prese) motivi[p.motivo] = (motivi[p.motivo] || 0) + 1;
    // correlazione: posizioni dello stesso lato aperte al momento di ogni entrata; giorni quasi tutti dalla stessa parte
    const segni = r.prese.flatMap(p => [[p.entrata, 1, p.lato], [p.uscita, -1, p.lato]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let nL = 0, nS = 0; const distribuzione = new Array(11).fill(0);
    for (const [, d, lato] of segni) { if (lato === 1) nL += d; else nS += d; if (d === 1) distribuzione[Math.min(10, lato === 1 ? nL : nS)]++; }
    const giorni = new Map();
    for (const p of r.prese) { const g = Math.floor(p.entrata / GIORNO); let e = giorni.get(g); if (!e) { e = { long: 0, short: 0, pnl: 0 }; giorni.set(g, e); } if (p.lato === 1) e.long++; else e.short++; e.pnl += p.pnl; }
    const ev = [...giorni.values()];
    const unico = e => e.long + e.short >= 5 && Math.max(e.long, e.short) / (e.long + e.short) >= 0.8;
    const uni = ev.filter(unico), altri = ev.filter(e => !unico(e));
    const correlazione = {
      giorni: ev.length, distribuzione,
      unilaterali: { n: uni.length, pnlMedio: uni.reduce((s, e) => s + e.pnl, 0) / Math.max(1, uni.length) / 10000, vinti: uni.filter(e => e.pnl > 0).length, peggiore: Math.min(0, ...uni.map(e => e.pnl)) / 10000 },
      altri: { n: altri.length, pnlMedio: altri.reduce((s, e) => s + e.pnl, 0) / Math.max(1, altri.length) / 10000, vinti: altri.filter(e => e.pnl > 0).length },
      scartati: r.scartati,
    };
    return { v, configurazioni, anni, scomp, motivi, correlazione };
  };
  console.log('Dettaglio delle varianti scelte...');
  const dettagli = {};
  if (scelta) dettagli.scelta = dettaglio(scelta.v);
  for (const d of [...CONFIG.direzioni, 'base']) if (sceltaDir[d] && sceltaDir[d].v.id !== scelta?.v.id) dettagli[d] = dettaglio(sceltaDir[d].v);

  // Riferimento: entrate a caso (momento e direzione) con le stesse uscite. Con candele da 1 minuto il motore esegue gli stop
  // esattamente sul livello: questo dà un piccolo lordo positivo anche a caso. È il "rumore di fondo" da togliere ai lordi.
  console.log('Riferimento con entrate a caso...');
  const riferimento = { 'BTC ed ETH': [], 'dalla 3ª alla 14ª': [], 'dalla 15ª in poi': [] };
  simboli.forEach((sim, si) => {
    const s = storicoConFermi(sim, fermi), c15 = candele15(s), rnd = casuale(1000 + si), pt = new Float64Array(4);
    const { open: O, high: H, low: L, close: C } = s;
    const gruppo = si <= 1 ? 'BTC ed ETH' : si < CONFIG.monetePrincipali ? 'dalla 3ª alla 14ª' : 'dalla 15ª in poi';
    for (let t = 0; t < 3000; t++) {
      const iE = 20160 + Math.floor(rnd() * (s.n - 20160 - CONFIG.durataMassima - 1));
      if (iE < 0 || Number.isNaN(O[iE])) continue;
      const u = c15.atrPrima(s.t0 + iE * MIN) / O[iE]; if (!(u > 0)) continue;
      const pos = new Posizione({ lato: rnd() < 0.5 ? 1 : -1, entrata: O[iE], tempo: 0, unita: u, regole: CONFIG.regole });
      pos.minuto(puntiCandelaIn(pt, O[iE], H[iE], L[iE], C[iE]), 0);
      let k = iE + 1;
      for (; k < iE + CONFIG.durataMassima && !pos.chiusa; k++) { if (Number.isNaN(O[k])) continue; pos.minuto(puntiCandelaIn(pt, O[k], H[k], L[k], C[k]), k); }
      if (!pos.chiusa) { while (Number.isNaN(O[k]) && k < s.n - 1) k++; pos.chiudiA(O[k], k, MOTIVI.tempo); }
      riferimento[gruppo].push(pos.lato * (pos.uscita / pos.entrata - 1));
    }
  });
  const rif = Object.fromEntries(Object.entries(riferimento).map(([g, l]) => {
    const m = l.reduce((a, b) => a + b, 0) / l.length, q = l.reduce((a, b) => a + b * b, 0) / l.length;
    return [g, { n: l.length, lordo: m, errore: Math.sqrt(q - m * m) / Math.sqrt(l.length) }];
  }));

  mkdirSync(CARTELLA, { recursive: true });
  const out = { riferimento: rif, creato: new Date().toISOString(), config: CONFIG, taglio, fineDati, varianti: VARIANTI.length, tabella, scelta, sceltaDir, conferme, dettagli };
  writeFileSync(join(CARTELLA, 'risultati.json'), JSON.stringify(out, (k, x) => (x === Infinity ? 'inf' : x), 1));
  scriviDoc(out);
  console.log('Fatto: docs/grande-movimento.md');
}

// ---------------------------------------------------------------------------------------------
// Parte 3: documento
// ---------------------------------------------------------------------------------------------
function scriviDoc(out) {
  const { tabella, scelta, sceltaDir, conferme, dettagli, taglio, fineDati, config } = out;
  const righe = [], p = s => righe.push(s);
  p('# Strategia 2: grande movimento con conferma');
  p('');
  p(`Aggiornato il ${out.creato.slice(0, 10)}. Script: \`research/06-grande-movimento.js\` (motore in \`research/motore/\`). Risultati completi: \`data/backtest/grande-movimento/risultati.json\`.`);
  p('');
  p('<!-- conclusione -->');
  p('');
  p('## Le regole');
  p(`- **Grande movimento**: alla chiusura di un minuto, il prezzo della moneta negli ultimi N minuti (5, 15 o 60) si è mosso più di **k volte** (4, 6 o 8) il suo movimento normale a N minuti. Il movimento normale è lo scarto quadratico dei rendimenti a N minuti dei ${config.giorniVolatilita} giorni precedenti (solo passato, aggiornato ogni giorno): ogni moneta ha la sua scala.`);
  p('- **Entrata** a mercato all\'apertura del minuto successivo (la decisione si prende sulla candela chiusa). Commissione taker 0,06% e slittamento.');
  p('- **Direzione**: "segui" = nella direzione del movimento; "contro" = al contrario (scommessa che rientri).');
  p(`- **Pausa**: dopo un segnale la stessa moneta non ne apre un altro per ${config.pausa / 60} ore.`);
  p(`- **Uscite come Wisi Trade**: unità = ATR (Wilder 14) delle candele da 15 minuti chiuse prima dell'entrata; stop loss 1,5 unità; da +0,5 unità stop che segue a 1 unità e protezione del guadagno (si esce restituendo il 40%); durata massima ${config.durataMassima / 60} ore.`);
  p('- **Conferme**, provate una alla volta sopra la versione base (stessi N, k, direzione):');
  p('  - **trend a 1 ora / 4 ore**: prima del movimento il prezzo andava già nella stessa direzione nell\'ora (4 ore) precedente;');
  p('  - **BTC nella stessa direzione** (solo per le altre monete; BTC non dà segnali con questa conferma): negli stessi N minuti BTC si è mosso nella stessa direzione di almeno 1 volta il suo movimento normale;');
  p('  - **rottura del massimo/minimo di 24 ore**: la chiusura supera il massimo (o va sotto il minimo) delle 24 ore prima del movimento;');
  p('  - **il movimento tiene**: 3 minuti dopo il segnale il prezzo conserva almeno metà del movimento; si entra 3 minuti più tardi.');
  p(`- **Griglia**: 3 N × 3 k × 2 direzioni × 6 (base + 5 conferme) = **${out.varianti} varianti**.`);
  p('');
  p('## Il metodo');
  p(`- Stessi dati, costi e capitale degli altri test: 50 crypto, candele da 1 minuto di Binance dal 2023-01-01 al ${data(fineDati - 1)}, fermi di Binance come minuti senza prezzo, percorso dentro il minuto come Wisi Trade.`);
  p('- Costi: commissione 0,06% per lato, slittamento 0,05% e 0,08% per lato (minimo 0,08% dalla 15ª moneta), funding reale.');
  p(`- Capitale: 10.000 USDT, 10 posizioni, margine 10%, leva 3x e 5x, freno 8% su perdita chiusa + aperta (come Wisi Trade), dimensione fissa e composto, media di ${ORDINI_CASUALI} ordini casuali per i segnali dello stesso minuto.`);
  p(`- 70/30: scelta fino al ${data(taglio - 1)}, verifica dal ${data(taglio)}. Criterio di scelta: miglior rendimento del portafoglio nel 70% (dimensione fissa, leva 3x, slittamento 0,08%), almeno ${config.minimoOperazioniScelta} operazioni.`);
  p(`- **Lordo** = movimento a favore per operazione prima dei costi; **netto** = dopo commissioni, slittamento (0,08%) e funding. Obiettivo: almeno **${pct(config.obiettivoLordo, 1)} lordo medio** per operazione, altrimenti i costi (circa 0,28% andata e ritorno) se lo mangiano.`);
  p('');
  p('## Riferimento: entrate a caso');
  p('Prima di leggere i lordi: con le stesse uscite ed entrate a caso (momento e direzione), il lordo medio dovrebbe essere zero. Con le candele da 1 minuto il motore esegue gli stop esattamente sul livello anche quando il prezzo vero lo salta, e questo dà un piccolo lordo positivo anche a caso (su prezzi sintetici senza nessun vantaggio: circa +0,04%). È il "rumore di fondo": un lordo vale qualcosa solo se è ben sopra questi valori.');
  p('');
  p('| Monete | Entrate a caso | Lordo medio | Errore standard |');
  p('|---|---:|---:|---:|');
  for (const [g, x] of Object.entries(out.riferimento)) p(`| ${g} | ${intero(x.n)} | ${pct(x.lordo, 3)} | ± ${pct(x.errore, 3)} |`);
  p('');
  p('## La versione base, senza conferme');
  p('Medie sulle singole operazioni (senza limiti di posti) e portafoglio (dimensione fissa, leva 3x, slittamento 0,08%).');
  p('');
  p('| Direzione | N | k | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Portafoglio 70% | Portafoglio 30% |');
  p('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const x of tabella.filter(x => x.v.conferma === 'nessuna')) {
    p(`| ${x.v.direzione} | ${x.v.N} min | ${x.v.k}× | ${intero(x.opScelta.operazioni)} | ${pct(x.opScelta.lordo, 3)} | ${pct(x.opScelta.medioNetto, 3)} | ${num(x.opScelta.profitFactor)} | ${intero(x.opVerifica.operazioni)} | ${pct(x.opVerifica.lordo, 3)} | ${pct(x.opVerifica.medioNetto, 3)} | ${num(x.opVerifica.profitFactor)} | ${rend(x.scelta)} | ${rend(x.verifica)} |`);
  }
  p('');
  p('## Cosa aggiunge ogni conferma');
  p('Confronto con la versione base con gli stessi N, k e direzione (9 combinazioni per direzione). "Lordo in più" è la mediana della differenza di lordo medio per operazione; "migliora in entrambi" conta le combinazioni in cui la conferma alza il lordo sia nel 70% sia nel 30%.');
  p('');
  p('| Conferma | Direzione | Operazioni tenute | Lordo in più 70% | Lordo in più 30% | Migliora in entrambi |');
  p('|---|---|---:|---:|---:|---:|');
  for (const c of conferme) for (const d of ['segui', 'contro']) {
    const x = c[d];
    p(`| ${NOMI_CONFERME[c.conferma]} | ${d} | ${pct(x.quotaTenute, 0)} | ${pct(x.deltaLordoScelta, 3)} | ${pct(x.deltaLordoVerifica, 3)} | ${x.miglioraEntrambi}/${x.casi} |`);
  }
  p('');
  p(`## Varianti con almeno ${pct(config.obiettivoLordo, 1)} lordo medio nel 70%`);
  const ok = tabella.filter(x => x.opScelta.operazioni >= config.minimoOperazioniScelta && x.opScelta.lordo >= config.obiettivoLordo).sort((a, b) => b.opScelta.lordo - a.opScelta.lordo);
  if (!ok.length) p('Nessuna, con almeno ' + config.minimoOperazioniScelta + ' operazioni.');
  else {
    p('| Variante | Oper. 70% | Lordo 70% | Netto 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Portafoglio 30% |');
    p('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const x of ok.slice(0, 25)) p(`| ${nomeVariante(x.v)} | ${intero(x.opScelta.operazioni)} | ${pct(x.opScelta.lordo, 3)} | ${pct(x.opScelta.medioNetto, 3)} | ${intero(x.opVerifica.operazioni)} | ${pct(x.opVerifica.lordo, 3)} | ${pct(x.opVerifica.medioNetto, 3)} | ${num(x.opVerifica.profitFactor)} | ${rend(x.verifica)} |`);
    if (ok.length > 25) p(`… e altre ${ok.length - 25}.`);
  }
  p('');
  p('## Quanto è solida: tutte le varianti');
  p('| Gruppo | In utile nel 70% | In utile nel 30% | Mediana 70% | Mediana 30% | Migliore 30% | Correlazione 70↔30 |');
  p('|---|---:|---:|---:|---:|---:|---:|');
  for (const [nome, f] of [['Tutte', () => true], ['Segui', x => x.v.direzione === 'segui'], ['Contro', x => x.v.direzione === 'contro'], ...[5, 15, 60].map(N => [`N = ${N} min`, x => x.v.N === N])]) {
    const t = tabella.filter(f), a = t.map(x => Math.max(-1, x.scelta.rendimento)), b = t.map(x => Math.max(-1, x.verifica.rendimento));
    p(`| ${nome} | ${a.filter(x => x > 0).length}/${t.length} | ${b.filter(x => x > 0).length}/${t.length} | ${pct(mediana(a))} | ${pct(mediana(b))} | ${pct(Math.max(...b))} | ${num(spearman(a, b))} |`);
  }
  p('');
  p('### Le 10 migliori nel 70% (portafoglio) e come sono andate nel 30%');
  p('| Variante | Rend. 70% | PF 70% | Oper. 70% | Lordo 70% | Rend. 30% | PF 30% | Oper. 30% | Lordo 30% |');
  p('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const x of tabella.filter(x => x.scelta.operazioni >= config.minimoOperazioniScelta).sort((a, b) => b.scelta.rendimento - a.scelta.rendimento).slice(0, 10)) {
    p(`| ${nomeVariante(x.v)} | ${rend(x.scelta)} | ${num(x.scelta.profitFactor)} | ${intero(x.scelta.operazioni)} | ${pct(x.opScelta.lordo, 3)} | ${rend(x.verifica)} | ${num(x.verifica.profitFactor)} | ${intero(x.verifica.operazioni)} | ${pct(x.opVerifica.lordo, 3)} |`);
  }
  p('');
  p('## Le varianti scelte sul 70% e la verifica sul 30%');
  p(`| Scelta | Variante | Periodo | ${INTESTAZIONE_METRICHE} |`);
  p('|---|---|---|---:|---:|---:|---:|---:|---:|');
  for (const [nome, x] of [['Migliore in assoluto', scelta], ['Migliore "segui"', sceltaDir.segui], ['Migliore "contro"', sceltaDir.contro], ['Migliore senza conferme', sceltaDir.base]]) {
    if (!x) { p(`| ${nome} | nessuna con abbastanza operazioni | | | | | | | |`); continue; }
    p(`| ${nome} | ${nomeVariante(x.v)} | 70% | ${rigaMetriche(x.scelta)} |`);
    p(`| | | **30%** | ${rigaMetriche(x.verifica)} |`);
  }
  p('');
  for (const [titolo, d] of [['Dettaglio della variante scelta', dettagli.scelta], ['Dettaglio della migliore "segui"', dettagli.segui], ['Dettaglio della migliore "contro"', dettagli.contro], ['Dettaglio della migliore senza conferme', dettagli.base]]) {
    if (!d) continue;
    p(`## ${titolo}`);
    p(`Variante: **${nomeVariante(d.v)}**.`);
    p('');
    p('### Capitale');
    p('| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |');
    p('|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const c of d.configurazioni) p(`| ${c.slitt} | ${c.leva}x | ${c.composto ? 'composto' : 'fissa'} | ${rend(c.scelta)} | ${rigaMetriche(c.verifica)} |`);
    p('');
    p('### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)');
    p(`| Anno | ${INTESTAZIONE_METRICHE} |`);
    p('|---|---:|---:|---:|---:|---:|---:|');
    for (const a of d.anni) p(`| ${a.anno}${a.parziale ? ' (fino al ' + data(fineDati - 1).slice(5) + ')' : ''} | ${rigaMetriche(a.m)} |`);
    p('');
    p('### Scomposizione sulle singole operazioni (senza limiti di posti)');
    p('| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |');
    p('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const s of d.scomp) p(`| ${s.nome} | ${intero(s.scelta.operazioni)} | ${pct(s.scelta.lordo, 3)} | ${pct(s.scelta.medioNetto, 3)} | ${num(s.scelta.profitFactor)} | ${intero(s.verifica.operazioni)} | ${pct(s.verifica.lordo, 3)} | ${pct(s.verifica.medioNetto, 3)} | ${num(s.verifica.profitFactor)} | ${pct(s.verifica.vincenti, 0)} |`);
    const totM = Object.values(d.motivi).reduce((s, v) => s + v, 0);
    p('');
    p(`Uscite (portafoglio, intero periodo): ${Object.entries(d.motivi).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${NOMI_MOTIVI[k]} ${pct(v / totM, 0)}`).join(', ')}.`);
    const c = d.correlazione, totD = c.distribuzione.reduce((s, v) => s + v, 0);
    p('');
    p('### Correlazione (intero periodo, portafoglio reale)');
    p(`- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): ${c.distribuzione.map((v, k) => [k, v]).filter(([k, v]) => k > 0 && v > 0).map(([k, v]) => `${k}: ${pct(v / totD, 0)}`).join(' · ')}.`);
    p(`- Giorni "a senso unico" (almeno 5 posizioni aperte nel giorno, almeno l'80% dallo stesso lato): **${intero(c.unilaterali.n)}** su ${intero(c.giorni)} giorni con operazioni, in utile ${intero(c.unilaterali.vinti)}, risultato medio ${pct(c.unilaterali.pnlMedio, 2)} del capitale, il peggiore ${pct(c.unilaterali.peggiore, 2)}. Gli altri giorni: risultato medio ${pct(c.altri.pnlMedio, 2)}, in utile ${intero(c.altri.vinti)} su ${intero(c.altri.n)}.`);
    p(`- Segnali scartati dal portafoglio: posti pieni ${intero(c.scartati.posti)}, freno ${intero(c.scartati.freno)}.`);
    p('');
  }
  p('## Limiti');
  p('- Le 50 monete sono le più liquide di oggi (le sparite non ci sono): i long del passato sono favoriti.');
  p('- L\'entrata è all\'apertura del minuto dopo il segnale: nei movimenti violenti lo slittamento vero su Bitunix può essere più alto di 0,08%, soprattutto sulle monete piccole (vedi `docs/bitunix-vs-binance.md`).');
  p(`- Con ${out.varianti} varianti la migliore nel 70% è in parte fortuna: contano di più la versione base, il confronto delle conferme e la tabella di tutte le varianti.`);
  scriviConConclusione('docs/grande-movimento.md', righe.join('\n') + '\n');
}

if (isMainThread) main().catch(e => { console.error(e); process.exit(1); });

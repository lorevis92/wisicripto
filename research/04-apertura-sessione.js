// Fase 0 · backtest "apertura di sessione" sulle 50 crypto dello storico, con le regole di Wisi Trade.
//
// 1) Per ogni moneta (in parallelo, un worker per moneta) simula una per una tutte le operazioni di tutte
//    le varianti della griglia, con il motore di research/motore/. Cache: data/backtest/apertura/.
// 2) Portafoglio (10 posti, margine 10%, leva 3x/5x, freno 8% su perdite chiuse + aperte) per variante e sessione,
//    regole scelte sul primo 70% e verificate sul 30%.
// 3) Scrive docs/apertura-sessione.md.
//
// Uso: node --max-old-space-size=8192 research/04-apertura-sessione.js [--rifai] [--monete=N]
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leggiFunding } from './lib/storico.js';
import { calendarioSessioni, SESSIONI, fineSettimana } from './motore/sessioni.js';
import { puntiCandelaIn } from './motore/percorso.js';
import { Posizione, MOTIVI, NOMI_MOTIVI, REGOLE_ATTUALE } from './motore/posizione.js';
import { RilevatoreRottura } from './motore/rottura.js';
import { fundingPagato, rendimentoNetto, COMMISSIONE } from './motore/costi.js';
import { volatilitaGiornaliera, candele15, UnitaSessione } from './motore/volatilita.js';
import { metricheOperazioni } from './motore/metriche.js';
import {
  MIN, INIZIO, datiComuni, storicoConFermi, operazioniInParallelo, servizioWorker, comeColonne, caricaPrezzi, caricaFunding,
  eseguiPortafoglio, SLITTAMENTI, LEVE, ORDINI_CASUALI, spearman, mediana, firma,
  pct, num, intero, data, rend, calo, rigaMetriche, INTESTAZIONE_METRICHE, scriviConConclusione,
} from './lib/backtest.js';

// ---------------------------------------------------------------------------------------------
// Configurazione del test
// ---------------------------------------------------------------------------------------------
const CONFIG = {
  margineEntrata: 0.0015,      // entrata eseguita solo se il prezzo supera il livello di 0,15%
  moltiplicatoreEntrata: 1.25, // come Wisi Trade: segnale al movimento m, entrata a 1,25 × m dall'apertura
  regole: { attivaDa: REGOLE_ATTUALE.attivaDa, segue: REGOLE_ATTUALE.segue, restituisci: REGOLE_ATTUALE.restituisci }, // lo stop è nella griglia
  griglia: {
    percentuale: [0.005, 0.01, 0.015, 0.02],   // movimento dall'apertura
    volatilita: [0.1, 0.2, 0.3, 0.4],           // movimento in multipli della volatilità giornaliera (14 giorni)
    finestre: [3, 15, 30],
    stop: [1, 1.5, 2],                          // stop loss in unità (Wisi Trade)
  },
  giorniVolatilita: 14,
  monetePrincipali: 14, // dalla 15ª moneta in poi slittamento minimo 0,08% (docs/bitunix-vs-binance.md)
  minimoOperazioniScelta: 100,
  versione: 2,
};
const ATTUALE = { tipo: 'percentuale', movimento: 0.01, finestra: 30, stop: 1.5 };

const VARIANTI = [];
for (const tipo of ['percentuale', 'volatilita']) for (const movimento of CONFIG.griglia[tipo]) for (const finestra of CONFIG.griglia.finestre) for (const stop of CONFIG.griglia.stop) {
  VARIANTI.push({ id: VARIANTI.length, tipo, movimento, finestra, stop });
}
const ID_ATTUALE = VARIANTI.find(v => v.tipo === ATTUALE.tipo && v.movimento === ATTUALE.movimento && v.finestra === ATTUALE.finestra && v.stop === ATTUALE.stop).id;
const it = x => x.toLocaleString('it-IT');
const nomeVariante = v => (v.id === ID_ATTUALE ? '**Attuale**: ' : '') + (v.tipo === 'percentuale'
  ? `movimento ${it(v.movimento * 100)}% (entrata ${it(v.movimento * 125)}%), finestra ${v.finestra} min, stop ${it(v.stop)} unità`
  : `movimento ${it(v.movimento)}×vol (entrata ${it(v.movimento * 1.25)}×vol), finestra ${v.finestra} min, stop ${it(v.stop)} unità`);

const SCHEMA = {
  variante: Uint16Array, sessione: Uint8Array, lato: Int8Array, offset: Uint8Array, motivo: Uint8Array,
  entrata: Float64Array, uscita: Float64Array, prezzo: Float64Array, rapporto: Float64Array, funding: Float32Array, peggiore: Float32Array, unita: Float32Array,
};

// ---------------------------------------------------------------------------------------------
// Parte 1: operazioni di una moneta (gira nei worker)
// ---------------------------------------------------------------------------------------------
function simulaMoneta(simbolo, fermi) {
  const s = storicoConFermi(simbolo, fermi);
  const vol = volatilitaGiornaliera(s, CONFIG.giorniVolatilita);
  const unitaS = new UnitaSessione(candele15(s));
  const funding = leggiFunding(simbolo) || [];
  const calendario = calendarioSessioni(s.t0, s.t0 + s.n * MIN);
  const idSessione = Object.fromEntries(SESSIONI.map((x, i) => [x.id, i]));
  const out = Object.fromEntries(Object.keys(SCHEMA).map(k => [k, []]));
  const punti = new Float64Array(4);
  const { open: O, high: H, low: L, close: C } = s;
  const ingressi = [];
  for (const tipo of ['percentuale', 'volatilita']) for (const movimento of CONFIG.griglia[tipo]) for (const finestra of CONFIG.griglia.finestre) {
    ingressi.push({ tipo, movimento, finestra, varianti: VARIANTI.filter(v => v.tipo === tipo && v.movimento === movimento && v.finestra === finestra) });
  }

  for (const ev of calendario) {
    const i0 = (ev.t - s.t0) / MIN, iProssima = Math.min(s.n, (ev.prossima - s.t0) / MIN);
    const unitaPrezzo = unitaS.unita(ev.sessione, ev.t);
    unitaS.registra(ev.sessione, ev.t); // usata solo dalle aperture successive
    if (i0 < 0 || Number.isNaN(O[i0]) || Number.isNaN(unitaPrezzo)) continue;
    const riferimento = O[i0];
    const v = vol(ev.t);
    for (const ing of ingressi) {
      const m = ing.tipo === 'percentuale' ? ing.movimento : ing.movimento * v;
      if (!(m > 0)) continue;
      const ril = new RilevatoreRottura({ riferimento, soglia: CONFIG.moltiplicatoreEntrata * m, margine: CONFIG.margineEntrata });
      let e = null, iE = -1;
      for (let i = i0; i < Math.min(i0 + ing.finestra, iProssima); i++) {
        if (Number.isNaN(O[i])) continue;
        e = ril.minuto(puntiCandelaIn(punti, O[i], H[i], L[i], C[i]));
        if (e) { iE = i; break; }
      }
      if (!e) continue;
      const u = unitaPrezzo / e.prezzo;
      for (const variante of ing.varianti) {
        const tE = s.t0 + iE * MIN;
        const pos = new Posizione({ lato: e.lato, entrata: e.prezzo, tempo: tE, unita: u, regole: { ...CONFIG.regole, stop: variante.stop } });
        pos.minuto(puntiCandelaIn(punti, O[iE], H[iE], L[iE], C[iE]), tE, e.indice, e.puntoConferma);
        for (let i = iE + 1; i < s.n && !pos.chiusa; i++) {
          if (Number.isNaN(O[i])) continue;
          const t = s.t0 + i * MIN;
          if (i >= iProssima) { pos.chiudiA(O[i], t, MOTIVI.tempo); break; } // durata massima: apertura della sessione dopo
          pos.minuto(puntiCandelaIn(punti, O[i], H[i], L[i], C[i]), t);
        }
        if (!pos.chiusa) { let k = s.n - 1; while (k > 0 && Number.isNaN(C[k])) k--; pos.chiudiA(C[k], s.t0 + k * MIN, MOTIVI.fineDati); }
        out.variante.push(variante.id); out.sessione.push(idSessione[ev.sessione]); out.lato.push(e.lato);
        out.offset.push(iE - i0); out.motivo.push(pos.motivo);
        out.entrata.push(tE); out.uscita.push(pos.tempoUscita); out.prezzo.push(e.prezzo); out.rapporto.push(pos.uscita / pos.entrata);
        out.funding.push(fundingPagato(funding, e.lato, tE, pos.tempoUscita));
        out.peggiore.push(-pos.gPeggiore); out.unita.push(u);
      }
    }
  }
  return comeColonne(SCHEMA, out);
}

if (!isMainThread) servizioWorker(parentPort, simbolo => simulaMoneta(simbolo, workerData.fermi));

// ---------------------------------------------------------------------------------------------
// Parte 2: portafoglio, scelta sul 70%, verifica sul 30%
// ---------------------------------------------------------------------------------------------
const CARTELLA = join('data', 'backtest', 'apertura');
const GRUPPI = [
  { id: 'asia', nome: '00:00 UTC', sessioni: [0] },
  { id: 'europa', nome: 'Europa 08:00 Londra', sessioni: [1] },
  { id: 'usa', nome: 'USA 9:30 New York', sessioni: [2] },
  { id: 'tutte', nome: 'Tutte e tre insieme', sessioni: [0, 1, 2] },
];

// Indice delle operazioni per variante; gli oggetti si costruiscono solo quando servono (memoria)
function indicizza(colonne, simboli) {
  const indici = VARIANTI.map(() => []);
  simboli.forEach((s, si) => { const c = colonne[s]; for (let k = 0; k < c.variante.length; k++) indici[c.variante[k]].push(si * 2 ** 22 + k); });
  return id => indici[id].map(x => {
    const si = Math.floor(x / 2 ** 22), k = x % 2 ** 22, c = colonne[simboli[si]];
    return {
      simbolo: si, piccola: si >= CONFIG.monetePrincipali, sessione: c.sessione[k], lato: c.lato[k], offset: c.offset[k], motivo: c.motivo[k],
      entrata: c.entrata[k], uscita: c.uscita[k], prezzo: c.prezzo[k], rapporto: c.rapporto[k], funding: c.funding[k], peggiore: c.peggiore[k], unita: c.unita[k],
    };
  }).sort((a, b) => a.entrata - b.entrata || a.simbolo - b.simbolo);
}

async function main() {
  const rifai = process.argv.includes('--rifai');
  const { simboli, fineDati, taglio, fermi } = datiComuni();
  console.log(`Periodo ${data(INIZIO)} → ${data(fineDati)}, taglio 70/30 al ${data(taglio)}`);
  const colonne = await operazioniInParallelo({
    script: fileURLToPath(import.meta.url), cartella: CARTELLA, firmaConfig: firma({ CONFIG, n: VARIANTI.length }),
    simboli, datiWorker: { fermi }, rifai,
  });
  console.log('Carico i prezzi per il freno...');
  const contesto = { prezzi: caricaPrezzi(simboli), funding: caricaFunding(simboli) };
  const operazioniDi = indicizza(colonne, simboli);
  const filtra = (ops, g, da, a) => ops.filter(o => g.sessioni.includes(o.sessione) && o.entrata >= da && o.entrata < a);
  const SLITT_ALTO = SLITTAMENTI[1];
  const base = { leva: 3, slitt: SLITT_ALTO, composto: false, contesto };

  // Prima dei costi: media lorda di tutte le operazioni, per sessione, versione e gruppo di monete
  const lordo = {};
  simboli.forEach((sim, si) => {
    const c = colonne[sim];
    const gm = si <= 1 ? 'BTC ed ETH' : si < CONFIG.monetePrincipali ? 'dalla 3ª alla 14ª' : 'dalla 15ª in poi';
    for (let k = 0; k < c.variante.length; k++) {
      const chiave = [SESSIONI[c.sessione[k]].id, VARIANTI[c.variante[k]].tipo, gm, c.entrata[k] < taglio ? 'scelta' : 'verifica'].join('|');
      const a = lordo[chiave] ||= { n: 0, lordo: 0, netto05: 0, netto08: 0 };
      a.n++; a.lordo += c.lato[k] * (c.rapporto[k] - 1);
      a.netto05 += rendimentoNetto(c.lato[k], c.rapporto[k], si >= CONFIG.monetePrincipali ? 0.0008 : 0.0005, c.funding[k]);
      a.netto08 += rendimentoNetto(c.lato[k], c.rapporto[k], 0.0008, c.funding[k]);
    }
  });

  console.log('Portafoglio di tutte le varianti (70% e 30%)...');
  const tabella = Object.fromEntries(GRUPPI.map(g => [g.id, []]));
  for (const v of VARIANTI) {
    const ops = operazioniDi(v.id);
    for (const g of GRUPPI) {
      tabella[g.id].push({ v, scelta: eseguiPortafoglio(filtra(ops, g, INIZIO, taglio), base).m, verifica: eseguiPortafoglio(filtra(ops, g, taglio, fineDati), base).m });
    }
    if ((v.id + 1) % 12 === 0) console.log(`  ${v.id + 1}/${VARIANTI.length} varianti`);
  }
  const scelte = {};
  for (const g of GRUPPI) {
    const valide = tabella[g.id].filter(x => x.scelta.operazioni >= CONFIG.minimoOperazioniScelta && !x.scelta.rovina).sort((a, b) => b.scelta.rendimento - a.scelta.rendimento);
    scelte[g.id] = valide[0];
  }

  console.log('Dettaglio delle varianti scelte e della configurazione Attuale...');
  const dettagli = {};
  const dettaglio = (g, v) => {
    const ops = operazioniDi(v.id);
    const configurazioni = [];
    for (const slitt of SLITTAMENTI) for (const leva of LEVE) for (const composto of [false, true]) {
      configurazioni.push({
        slitt: slitt.nome, leva, composto,
        scelta: eseguiPortafoglio(filtra(ops, g, INIZIO, taglio), { leva, slitt, composto, contesto }).m,
        verifica: eseguiPortafoglio(filtra(ops, g, taglio, fineDati), { leva, slitt, composto, contesto }).m,
      });
    }
    const anni = [];
    for (let y = 2023; y <= new Date(fineDati).getUTCFullYear(); y++) {
      const da = Date.UTC(y, 0, 1), a = Math.min(Date.UTC(y + 1, 0, 1), fineDati);
      anni.push({ anno: y, parziale: a < Date.UTC(y + 1, 0, 1), m: eseguiPortafoglio(filtra(ops, g, da, a), base).m });
    }
    const netto = o => rendimentoNetto(o.lato, o.rapporto, SLITT_ALTO.base, o.funding);
    const lordoOp = o => o.lato * (o.rapporto - 1);
    const gruppiScomp = [
      ...(g.sessioni.length > 1 ? SESSIONI.map((s, i) => [`Sessione ${s.nome}`, o => o.sessione === i]) : []),
      ['Long', o => o.lato === 1], ['Short', o => o.lato === -1],
      ['Giorni feriali', o => !fineSettimana(o.entrata - o.offset * MIN)], ['Weekend', o => fineSettimana(o.entrata - o.offset * MIN)],
      ['BTC ed ETH', o => o.simbolo <= 1], ['Le altre 48', o => o.simbolo > 1],
      ['Entrata nei primi 3 minuti', o => o.offset < 3], ['Entrata dal 4° minuto in poi', o => o.offset >= 3],
    ];
    const scomp = gruppiScomp.map(([nome, f]) => {
      const a = filtra(ops, g, INIZIO, taglio).filter(f), b = filtra(ops, g, taglio, fineDati).filter(f);
      return { nome, scelta: { ...metricheOperazioni(a.map(netto)), lordo: a.reduce((s, o) => s + lordoOp(o), 0) / a.length }, verifica: { ...metricheOperazioni(b.map(netto)), lordo: b.reduce((s, o) => s + lordoOp(o), 0) / b.length } };
    });
    const { r } = eseguiPortafoglio(filtra(ops, g, INIZIO, fineDati), { ...base, ordini: 1, tieni: true });
    const motivi = {};
    for (const p of r.prese) motivi[p.motivo] = (motivi[p.motivo] || 0) + 1;
    const eventi = new Map();
    for (const p of r.prese) {
      const k = p.entrata - p.offset * MIN;
      let e = eventi.get(k); if (!e) { e = { long: 0, short: 0, pnl: 0 }; eventi.set(k, e); }
      if (p.lato === 1) e.long++; else e.short++;
      e.pnl += p.pnl;
    }
    const segni = r.prese.flatMap(p => [[p.entrata, 1, p.lato], [p.uscita, -1, p.lato]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let nL = 0, nS = 0; const distribuzione = new Array(11).fill(0);
    for (const [, d, lato] of segni) { if (lato === 1) nL += d; else nS += d; if (d === 1) distribuzione[Math.min(10, lato === 1 ? nL : nS)]++; }
    const ev = [...eventi.values()], cap = 10000;
    const unico = e => e.long + e.short >= 5 && Math.max(e.long, e.short) / (e.long + e.short) >= 0.8;
    const uni = ev.filter(unico), altri = ev.filter(e => !unico(e));
    const correlazione = {
      eventi: ev.length,
      mediaPosizioniPerEvento: ev.reduce((s, e) => s + e.long + e.short, 0) / ev.length,
      quotaStessoLatoMedia: ev.reduce((s, e) => s + Math.max(e.long, e.short) / (e.long + e.short), 0) / ev.length,
      distribuzione,
      unilaterali: { n: uni.length, pnlMedio: uni.reduce((s, e) => s + e.pnl, 0) / Math.max(1, uni.length) / cap, vinti: uni.filter(e => e.pnl > 0).length, peggiore: Math.min(0, ...uni.map(e => e.pnl)) / cap },
      altri: { n: altri.length, pnlMedio: altri.reduce((s, e) => s + e.pnl, 0) / Math.max(1, altri.length) / cap, vinti: altri.filter(e => e.pnl > 0).length },
    };
    return { v, configurazioni, anni, scomp, motivi, correlazione };
  };
  for (const g of GRUPPI) {
    if (scelte[g.id]) dettagli[g.id] = dettaglio(g, scelte[g.id].v);
    dettagli[g.id + '|attuale'] = scelte[g.id]?.v.id === ID_ATTUALE ? dettagli[g.id] : dettaglio(g, VARIANTI[ID_ATTUALE]);
  }

  const v1 = existsSync(join(CARTELLA, 'risultati-v1.json')) ? JSON.parse(readFileSync(join(CARTELLA, 'risultati-v1.json'), 'utf8')) : null;
  const out = { creato: new Date().toISOString(), config: CONFIG, simboli, taglio, fineDati, varianti: VARIANTI.length, tabella, scelte, dettagli, lordo };
  writeFileSync(join(CARTELLA, 'risultati.json'), JSON.stringify(out, (k, x) => (x === Infinity ? 'inf' : x), 1));
  scriviDoc(out, v1);
  console.log('Fatto: docs/apertura-sessione.md');
}

// ---------------------------------------------------------------------------------------------
// Parte 3: documento
// ---------------------------------------------------------------------------------------------
function scriviDoc(out, v1) {
  const { tabella, scelte, dettagli, taglio, fineDati } = out;
  const righe = [];
  const p = s => righe.push(s);
  const tipoNome = t => (t === 'percentuale' ? 'percentuale' : 'volatilità');
  p(`# Backtest "apertura di sessione"`);
  p('');
  p(`Aggiornato il ${out.creato.slice(0, 10)} (seconda versione: uscite, unità, percorso nel minuto e freno come in Wisi Trade). Script: \`research/04-apertura-sessione.js\`, motore in \`research/motore/\`. Risultati completi: \`data/backtest/apertura/risultati.json\`.`);
  p('');
  p('<!-- conclusione -->');
  p('');
  p('## Le regole');
  p(`- **Sessioni**: 00:00 UTC (chiusura della candela giornaliera e Asia), 08:00 Londra (Europa), 9:30 New York (USA), con l'ora legale gestita dal fuso orario vero. Tutti i giorni, weekend compresi.`);
  p(`- **Entrata, come Wisi Trade**: riferimento = apertura del primo minuto della sessione. Con un "movimento" m, si entra quando il prezzo arriva a **1,25 × m** dall'apertura, nella direzione del movimento, entro la finestra d'entrata (3, 15 o 30 minuti). Una sola entrata per moneta e sessione. In più (limite di Bitunix): l'entrata conta solo se il prezzo supera il livello di almeno **0,15%**.`);
  p(`- **Unità di volatilità, come Wisi Trade**: il maggiore tra l'ATR (Wilder, 14) delle candele da 15 minuti e il range medio della prima candela da 15 minuti della stessa sessione negli ultimi 10 giorni. Sulle crypto le candele da 15 minuti sono di tutte le 24 ore.`);
  p(`- **Uscite, come Wisi Trade**: stop loss a 1 / 1,5 / 2 unità; finché il guadagno massimo è sotto 0,5 unità resta lo stop loss; poi l'uscita è la migliore tra lo stop loss, lo **stop che segue** (miglior prezzo meno 1 unità) e la **protezione del guadagno** (si esce se si restituisce il 40% del guadagno massimo). In più, durata massima: apertura della sessione successiva.`);
  p(`- **Configurazione Attuale di Wisi Trade**: movimento 1% (entrata a 1,25%), finestra 30 minuti, stop loss 1,5 unità, stop che segue 1, protezione 40%. È nella griglia ed è riportata a parte: non è scelta sui dati, quindi è il confronto più onesto.`);
  p(`- **Non portate dalle azioni**: il controllo dello "spazio" fino ai livelli di ieri, la conferma di volume e VWAP a 15 minuti e l'uscita sulla resistenza. Usano l'orario di borsa e livelli giornalieri che sulle crypto vanno ripensati.`);
  p(`- **Griglia**: 2 versioni del movimento (percentuale 0,5/1/1,5/2%; volatilità 0,1/0,2/0,3/0,4 × la volatilità giornaliera a 14 giorni) × 3 finestre × 3 stop = **${out.varianti} varianti** per sessione.`);
  p('');
  p('## Il metodo');
  p(`- **Dati**: candele da 1 minuto di Binance delle 50 crypto di \`docs/universo.md\`, dal 2023-01-01 al ${data(fineDati - 1)}. Nessun dato futuro.`);
  p(`- **Dentro il minuto** (come Wisi Trade): se l'apertura è più vicina al massimo, apertura→massimo→minimo→chiusura, altrimenti apertura→minimo→massimo→chiusura. Se il minuto apre già oltre lo stop, si esce all'apertura. I fermi di Binance sono minuti senza prezzo.`);
  p(`- **Costi**: commissione ${pct(COMMISSIONE, 2)} per lato; slittamento 0,05% e 0,08% per lato (minimo 0,08% dalla 15ª moneta in poi); funding reale di Binance.`);
  p(`- **Capitale**: 10.000 USDT, 10 posizioni, margine 10%, leva 3x e 5x, margine isolato. **Freno giornaliero all'8%, come Wisi Trade**: a ogni minuto si somma la perdita delle operazioni chiuse oggi e quella delle posizioni aperte alla chiusura del minuto; se arriva all'8% del capitale d'inizio giornata si chiude tutto all'apertura del minuto dopo e niente nuove entrate fino al giorno UTC successivo. Dimensione fissa (10% del capitale iniziale) e interesse composto (10% del capitale del momento).`);
  p(`- **Segnali simultanei**: ordine casuale, media di ${ORDINI_CASUALI} ordini. Le uscite di un minuto vengono prima delle entrate dello stesso minuto.`);
  p(`- **70/30**: scelta dal 2023-01-01 al ${data(taglio - 1)}, verifica dal ${data(taglio)} al ${data(fineDati - 1)}. Criterio: miglior rendimento nel 70% con dimensione fissa, leva 3x, slittamento 0,08%, almeno ${CONFIG.minimoOperazioniScelta} operazioni.`);
  p(`- **Misure**: rendimento sul capitale iniziale; profit factor = guadagni / perdite; peggior calo del capitale; giorno peggiore in % del capitale; medio netto = guadagno medio per operazione in % del valore della posizione, costi compresi. "Rovina" = capitale a zero, la simulazione si ferma lì.`);
  p('');

  if (v1) {
    p('## Cosa cambia rispetto alla prima versione');
    p('Prima versione: uscite inventate (protezione a +1R, stop che segue da +1,5R), stop in % o in multipli della volatilità giornaliera, freno solo sulle perdite chiuse, percorso nel minuto secondo la chiusura. Stessa configurazione di riferimento (dimensione fissa, leva 3x, slittamento 0,08%).');
    p('');
    p('| Sessione | Prima: migliore nel 70% → 30% | Adesso: migliore nel 70% → 30% | Prima: varianti in utile nel 30% | Adesso: varianti in utile nel 30% | Prima: mediana 30% | Adesso: mediana 30% |');
    p('|---|---:|---:|---:|---:|---:|---:|');
    for (const g of GRUPPI) {
      const a = v1.scelte[g.id], b = scelte[g.id];
      const t1 = v1.tabella[g.id].map(x => Math.max(-1, x.verifica.rendimento)), t2 = tabella[g.id].map(x => Math.max(-1, x.verifica.rendimento));
      p(`| ${g.nome} | ${a ? `${pct(a.scelta.rendimento)} → ${rend(a.verifica)}` : '–'} | ${b ? `${pct(b.scelta.rendimento)} → ${rend(b.verifica)}` : '–'} | ${t1.filter(x => x > 0).length}/${t1.length} | ${t2.filter(x => x > 0).length}/${t2.length} | ${pct(mediana(t1))} | ${pct(mediana(t2))} |`);
    }
    p('');
  }

  p('## La configurazione Attuale di Wisi Trade sulle crypto');
  p('Movimento 1%, entrata 1,25%, finestra 30 minuti, stop loss 1,5 unità, stop che segue 1, protezione 40%. Dimensione fissa, leva 3x, slittamento 0,08%.');
  p('');
  p(`| Sessione | Periodo | ${INTESTAZIONE_METRICHE} |`);
  p('|---|---|---:|---:|---:|---:|---:|---:|');
  for (const g of GRUPPI) {
    const x = tabella[g.id][ID_ATTUALE];
    p(`| ${g.nome} | 70% | ${rigaMetriche(x.scelta)} |`);
    p(`| | **30%** | ${rigaMetriche(x.verifica)} |`);
  }
  p('');

  p("## Prima dei costi: c'è un vantaggio?");
  p(`Media di tutte le operazioni di tutte le ${out.varianti / 2} varianti di ogni versione (senza limiti di posti né capitale), in % del valore della posizione. Costo di un'operazione andata e ritorno: 0,22% con slittamento 0,05%, 0,28% con 0,08%.`);
  p('');
  p('| Sessione | Versione | Monete | Oper. 70% | Lordo 70% | Lordo 30% | Netto 30% (slitt. 0,05%*) | Netto 30% (slitt. 0,08%) |');
  p('|---|---|---|---:|---:|---:|---:|---:|');
  for (const ses of SESSIONI) for (const tipo of ['percentuale', 'volatilita']) for (const gm of ['BTC ed ETH', 'dalla 3ª alla 14ª', 'dalla 15ª in poi']) {
    const a = out.lordo[[ses.id, tipo, gm, 'scelta'].join('|')], b = out.lordo[[ses.id, tipo, gm, 'verifica'].join('|')];
    if (!a || !b) continue;
    p(`| ${ses.nome.split(' (')[0]} | ${tipoNome(tipo)} | ${gm} | ${intero(a.n)} | ${pct(a.lordo / a.n, 3)} | ${pct(b.lordo / b.n, 3)} | ${pct(b.netto05 / b.n, 3)} | ${pct(b.netto08 / b.n, 3)} |`);
  }
  p('');
  p('\\* dalla 15ª moneta in poi lo slittamento è comunque 0,08%.');
  p('');

  p('## Le varianti scelte sul 70% e la verifica sul 30%');
  p('Dimensione fissa, leva 3x, slittamento 0,08%.');
  p('');
  p(`| Sessione | Variante scelta | Periodo | ${INTESTAZIONE_METRICHE} |`);
  p('|---|---|---|---:|---:|---:|---:|---:|---:|');
  for (const g of GRUPPI) {
    const x = scelte[g.id];
    if (!x) { p(`| ${g.nome} | nessuna variante con abbastanza operazioni | | | | | | | |`); continue; }
    p(`| ${g.nome} | ${tipoNome(x.v.tipo)}: ${nomeVariante(x.v)} | 70% scelta | ${rigaMetriche(x.scelta)} |`);
    p(`| | | **30% verifica** | ${rigaMetriche(x.verifica)} |`);
  }
  p('');
  p('## Quanto è solida la scelta: tutte le varianti');
  p(`Per ogni sessione e versione: quante delle ${out.varianti / 2} varianti guadagnano nel 70% e nel 30%, rendimento mediano, migliore nel 30% e correlazione di rango tra i due periodi (1 = stesso ordine, 0 = nessun legame).`);
  p('');
  p('| Sessione | Versione | In utile nel 70% | In utile nel 30% | Mediana 70% | Mediana 30% | Migliore 30% | Correlazione 70↔30 |');
  p('|---|---|---:|---:|---:|---:|---:|---:|');
  for (const g of GRUPPI) for (const tipo of ['percentuale', 'volatilita']) {
    const t = tabella[g.id].filter(x => x.v.tipo === tipo);
    const a = t.map(x => Math.max(-1, x.scelta.rendimento)), b = t.map(x => Math.max(-1, x.verifica.rendimento));
    p(`| ${g.nome} | ${tipoNome(tipo)} | ${a.filter(x => x > 0).length}/${t.length} | ${b.filter(x => x > 0).length}/${t.length} | ${pct(mediana(a))} | ${pct(mediana(b))} | ${pct(Math.max(...b))} | ${num(spearman(a, b))} |`);
  }
  p('');
  p('### Le 5 migliori nel 70%, per sessione, e come sono andate nel 30%');
  for (const g of GRUPPI) {
    p(''); p(`**${g.nome}**`); p('');
    p('| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% |');
    p('|---|---:|---:|---:|---:|---:|---:|');
    for (const x of tabella[g.id].filter(x => x.scelta.operazioni >= CONFIG.minimoOperazioniScelta).sort((a, b) => b.scelta.rendimento - a.scelta.rendimento).slice(0, 5)) {
      p(`| ${tipoNome(x.v.tipo)}: ${nomeVariante(x.v)} | ${rend(x.scelta)} | ${num(x.scelta.profitFactor)} | ${intero(x.scelta.operazioni)} | ${rend(x.verifica)} | ${num(x.verifica.profitFactor)} | ${intero(x.verifica.operazioni)} |`);
    }
  }
  p('');

  const sezione = (titolo, d) => {
    p(`## ${titolo}`);
    p(`Variante: **${tipoNome(d.v.tipo)}, ${nomeVariante(d.v)}**.`);
    p('');
    p('### Capitale: leva, slittamento, dimensione fissa e interesse composto');
    p('| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |');
    p('|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const c of d.configurazioni) p(`| ${c.slitt} | ${c.leva}x | ${c.composto ? 'composto' : 'fissa'} | ${rend(c.scelta)} | ${rend(c.verifica)} | ${num(c.verifica.profitFactor)} | ${calo(c.verifica)} | ${pct(Math.max(-1, c.verifica.giornoPeggiore))} | ${intero(c.verifica.operazioni)} | ${pct(c.verifica.medioNetto, 3)} |`);
    p('');
    p('### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)');
    p(`| Anno | ${INTESTAZIONE_METRICHE} |`);
    p('|---|---:|---:|---:|---:|---:|---:|');
    for (const a of d.anni) p(`| ${a.anno}${a.parziale ? ' (fino al ' + data(fineDati - 1).slice(5) + ')' : ''} | ${rigaMetriche(a.m)} |`);
    p('');
    p('### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)');
    p('| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |');
    p('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const s of d.scomp) p(`| ${s.nome} | ${intero(s.scelta.operazioni)} | ${pct(s.scelta.lordo, 3)} | ${pct(s.scelta.medioNetto, 3)} | ${num(s.scelta.profitFactor)} | ${intero(s.verifica.operazioni)} | ${pct(s.verifica.lordo, 3)} | ${pct(s.verifica.medioNetto, 3)} | ${num(s.verifica.profitFactor)} | ${pct(s.verifica.vincenti, 0)} |`);
    const totM = Object.values(d.motivi).reduce((s, v) => s + v, 0);
    p('');
    p(`Uscite (portafoglio, intero periodo): ${Object.entries(d.motivi).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${NOMI_MOTIVI[k]} ${pct(v / totM, 0)}`).join(', ')}.`);
    p('');
    p('### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)');
    const c = d.correlazione, totD = c.distribuzione.reduce((s, v) => s + v, 0);
    p(`- ${intero(c.eventi)} aperture di sessione con almeno una posizione, in media ${num(c.mediaPosizioniPerEvento, 1)} posizioni per apertura. In media il **${pct(c.quotaStessoLatoMedia, 0)}** delle posizioni di un'apertura sono dalla stessa parte.`);
    p(`- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): ${c.distribuzione.map((v, k) => [k, v]).filter(([k, v]) => k > 0 && v > 0).map(([k, v]) => `${k}: ${pct(v / totD, 0)}`).join(' · ')}.`);
    p(`- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **${intero(c.unilaterali.n)}**, in utile ${intero(c.unilaterali.vinti)}, risultato medio ${pct(c.unilaterali.pnlMedio, 2)} del capitale, la peggiore ${pct(c.unilaterali.peggiore, 2)}. Le altre: ${intero(c.altri.n)}, in utile ${intero(c.altri.vinti)}, risultato medio ${pct(c.altri.pnlMedio, 2)}.`);
    p('');
  };
  for (const g of GRUPPI) {
    if (dettagli[g.id]) sezione(`Dettaglio: ${g.nome} · variante scelta`, dettagli[g.id]);
    if (dettagli[g.id + '|attuale'] && dettagli[g.id + '|attuale'] !== dettagli[g.id]) sezione(`Dettaglio: ${g.nome} · configurazione Attuale`, dettagli[g.id + '|attuale']);
  }

  p('## Limiti di questo test');
  p('- Le 50 monete sono le più liquide **oggi**: quelle sparite o crollate non ci sono. Questo migliora i risultati del passato, soprattutto per i long.');
  p('- Le monete quotate da poco compaiono solo nel 30% finale.');
  p('- Il percorso dentro il minuto è una supposizione; le punte di Binance non sempre ci sono su Bitunix (per questo il margine dello 0,15% sulle entrate).');
  p('- Lo stop si calcola dal prezzo del livello, non da quello eseguito con lo slittamento (in Wisi Trade dal prezzo eseguito): differenza di 0,05–0,08%, trascurabile rispetto a uno stop di 1–2 unità.');
  p(`- Con ${out.varianti} varianti × 4 gruppi la migliore nel 70% è in parte fortuna: contano più la tabella "tutte le varianti" e la configurazione Attuale.`);
  scriviConConclusione('docs/apertura-sessione.md', righe.join('\n') + '\n');
}

if (isMainThread) main().catch(e => { console.error(e); process.exit(1); });

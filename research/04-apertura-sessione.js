// Fase 0 · passo 4: backtest "apertura di sessione" sulle 50 crypto dello storico.
//
// 1) Per ogni moneta (in parallelo, un worker per moneta) simula una per una tutte le operazioni di tutte
//    le varianti della griglia, con il motore di research/motore/. Risultato in cache: data/backtest/apertura/.
// 2) Gestione del capitale (10 posti, margine 10%, leva 3x/5x, freno 8%) per ogni variante e sessione,
//    regole scelte sul primo 70% e verificate sul 30%.
// 3) Scrive docs/apertura-sessione.md.
//
// Uso: node research/04-apertura-sessione.js [--rifai]   (--rifai ignora la cache delle operazioni)
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { leggiStorico, leggiFunding } from './lib/storico.js';
import { calendarioSessioni, SESSIONI, fineSettimana } from './motore/sessioni.js';
import { puntiCandelaIn } from './motore/percorso.js';
import { Posizione, MOTIVI } from './motore/posizione.js';
import { RilevatoreRottura } from './motore/rottura.js';
import { fundingPagato, rendimentoNetto, COMMISSIONE } from './motore/costi.js';
import { volatilitaGiornaliera } from './motore/volatilita.js';
import { simulaPortafoglio } from './motore/portafoglio.js';
import { metrichePortafoglio, mediaMetriche, metricheOperazioni } from './motore/metriche.js';

const MIN = 60000, GIORNO = 86400000;
const INIZIO = Date.UTC(2023, 0, 1);

// ---------------------------------------------------------------------------------------------
// Configurazione del test
// ---------------------------------------------------------------------------------------------
const CONFIG = {
  margineEntrata: 0.0015,          // entrata eseguita solo se il prezzo supera il livello di 0,15%
  regole: {                         // uscite, uguali per tutte le varianti
    protezione: { attivaA: 1, blocca: 0.003 },   // a +1R lo stop sale a +0,3% (copre i costi)
    segue: { attivaA: 1.5, distanza: 1 },         // da +1,5R lo stop segue il massimo a 1R di distanza
  },
  griglia: {
    percentuale: { soglie: [0.005, 0.01, 0.015, 0.02], stop: [0.01, 0.02, 0.03] },
    volatilita: { soglie: [0.1, 0.2, 0.3, 0.4], stop: [0.25, 0.5, 0.75] }, // multipli della volatilità giornaliera (14 giorni)
    finestre: [3, 15, 30],
  },
  giorniVolatilita: 14,
  quotaVerifica: 0.3,
  capitale: { capitale: 10000, posti: 10, quota: 0.1, freno: 0.08 },
  leve: [3, 5],
  slittamenti: [{ nome: '0,05%', base: 0.0005, piccole: 0.0008 }, { nome: '0,08%', base: 0.0008, piccole: 0.0008 }],
  ordiniCasuali: 10,
  monetePrincipali: 14, // le prime 14 per liquidità; dalla 15ª in poi slittamento minimo 0,08% (docs/bitunix-vs-binance.md)
  minimoOperazioniScelta: 100,
};

const VARIANTI = [];
for (const tipo of ['percentuale', 'volatilita']) {
  const g = CONFIG.griglia[tipo];
  for (const soglia of g.soglie) for (const finestra of CONFIG.griglia.finestre) for (const stop of g.stop) {
    VARIANTI.push({ id: VARIANTI.length, tipo, soglia, finestra, stop });
  }
}
const nomeVariante = v => v.tipo === 'percentuale'
  ? `soglia ${(v.soglia * 100).toLocaleString('it-IT')}%, finestra ${v.finestra} min, stop ${(v.stop * 100).toLocaleString('it-IT')}%`
  : `soglia ${v.soglia.toLocaleString('it-IT')}×vol, finestra ${v.finestra} min, stop ${v.stop.toLocaleString('it-IT')}×vol`;

const COLONNE = {
  variante: Uint16Array, sessione: Uint8Array, lato: Int8Array, offset: Uint8Array, motivo: Uint8Array,
  entrata: Float64Array, uscita: Float64Array, rapporto: Float64Array, funding: Float32Array, peggiore: Float32Array, R: Float32Array, soglia: Float32Array,
};

// ---------------------------------------------------------------------------------------------
// Parte 1: operazioni di una moneta (gira nei worker)
// ---------------------------------------------------------------------------------------------
function simulaMoneta(simbolo, fermi) {
  const s = leggiStorico(simbolo, { da: INIZIO });
  // Fermi di Binance: minuti senza prezzo
  for (const [t, len] of fermi) for (let k = 0; k < len; k++) {
    const i = (t - s.t0) / MIN + k;
    if (i >= 0 && i < s.n) s.open[i] = s.high[i] = s.low[i] = s.close[i] = NaN;
  }
  const vol = volatilitaGiornaliera(s, CONFIG.giorniVolatilita);
  const funding = leggiFunding(simbolo) || [];
  const fine = s.t0 + s.n * MIN;
  const calendario = calendarioSessioni(s.t0, fine);
  const idSessione = Object.fromEntries(SESSIONI.map((x, i) => [x.id, i]));
  const out = Object.fromEntries(Object.keys(COLONNE).map(k => [k, []]));
  const punti = new Float64Array(4);
  const { open: O, high: H, low: L, close: C } = s;
  const ingressi = [];
  for (const tipo of ['percentuale', 'volatilita']) for (const soglia of CONFIG.griglia[tipo].soglie) for (const finestra of CONFIG.griglia.finestre) {
    ingressi.push({ tipo, soglia, finestra, varianti: VARIANTI.filter(v => v.tipo === tipo && v.soglia === soglia && v.finestra === finestra) });
  }

  for (const ev of calendario) {
    const i0 = (ev.t - s.t0) / MIN, iProssima = Math.min(s.n, (ev.prossima - s.t0) / MIN);
    if (i0 < 0 || Number.isNaN(O[i0])) continue;
    const riferimento = O[i0];
    const v = vol(ev.t);
    for (const ing of ingressi) {
      const soglia = ing.tipo === 'percentuale' ? ing.soglia : ing.soglia * v;
      if (!(soglia > 0)) continue;
      const ril = new RilevatoreRottura({ riferimento, soglia, margine: CONFIG.margineEntrata });
      let e = null, iE = -1;
      for (let i = i0; i < Math.min(i0 + ing.finestra, iProssima); i++) {
        if (Number.isNaN(O[i])) continue;
        puntiCandelaIn(punti, O[i], H[i], L[i], C[i]);
        e = ril.minuto(punti);
        if (e) { iE = i; break; }
      }
      if (!e) continue;
      for (const variante of ing.varianti) {
        const R = variante.tipo === 'percentuale' ? variante.stop : variante.stop * v;
        const tE = s.t0 + iE * MIN;
        const pos = new Posizione({ lato: e.lato, entrata: e.prezzo, tempo: tE, R, regole: CONFIG.regole });
        puntiCandelaIn(punti, O[iE], H[iE], L[iE], C[iE]);
        pos.minuto(punti, tE, e.indice, e.puntoConferma);
        let i = iE + 1;
        for (; i < s.n && !pos.chiusa; i++) {
          if (Number.isNaN(O[i])) continue;
          const t = s.t0 + i * MIN;
          if (i >= iProssima) { pos.chiudiA(O[i], t, MOTIVI.tempo); break; } // durata massima: apertura della sessione dopo
          puntiCandelaIn(punti, O[i], H[i], L[i], C[i]);
          pos.minuto(punti, t);
        }
        if (!pos.chiusa) { // fine dei dati
          let k = s.n - 1; while (k > 0 && Number.isNaN(C[k])) k--;
          pos.chiudiA(C[k], s.t0 + k * MIN, MOTIVI.fineDati);
        }
        out.variante.push(variante.id); out.sessione.push(idSessione[ev.sessione]); out.lato.push(e.lato);
        out.offset.push(iE - i0); out.motivo.push(pos.motivo);
        out.entrata.push(tE); out.uscita.push(pos.tempoUscita); out.rapporto.push(pos.uscita / pos.entrata);
        out.funding.push(fundingPagato(funding, e.lato, tE, pos.tempoUscita));
        out.peggiore.push(-pos.gPeggiore); out.R.push(R); out.soglia.push(soglia);
      }
    }
  }
  return Object.fromEntries(Object.entries(COLONNE).map(([k, T]) => [k, T.from(out[k])]));
}

if (!isMainThread) {
  const { simboli, fermi } = workerData;
  parentPort.on('message', simbolo => {
    if (simbolo === null) { process.exit(0); }
    const r = simulaMoneta(simbolo, fermi);
    parentPort.postMessage({ simbolo, colonne: r }, Object.values(r).map(a => a.buffer));
  });
  parentPort.postMessage({ pronto: true, simboli: simboli.length });
}

// ---------------------------------------------------------------------------------------------
// Cache delle operazioni
// ---------------------------------------------------------------------------------------------
const CARTELLA = join('data', 'backtest', 'apertura');
const firmaConfig = () => createHash('sha1').update(JSON.stringify({ c: CONFIG.griglia, m: CONFIG.margineEntrata, r: CONFIG.regole, g: CONFIG.giorniVolatilita, v: 3 })).digest('hex').slice(0, 10);

function salvaColonne(file, col) {
  const meta = Object.fromEntries(Object.entries(col).map(([k, a]) => [k, a.length]));
  const testa = Buffer.from(JSON.stringify(meta));
  const len = Buffer.alloc(4); len.writeUInt32LE(testa.length);
  writeFileSync(file, Buffer.concat([len, testa, ...Object.values(col).map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength))]));
}
function leggiColonne(file) {
  const buf = readFileSync(file);
  const lt = buf.readUInt32LE(0);
  const meta = JSON.parse(buf.subarray(4, 4 + lt).toString());
  let off = 4 + lt;
  const out = {};
  for (const [k, n] of Object.entries(meta)) {
    const T = COLONNE[k], bytes = n * T.BYTES_PER_ELEMENT;
    const ab = new ArrayBuffer(bytes); new Uint8Array(ab).set(buf.subarray(off, off + bytes));
    out[k] = new T(ab); off += bytes;
  }
  return out;
}

async function generaOperazioni(simboli, fermi, rifai) {
  const firma = firmaConfig();
  const dir = join(CARTELLA, firma);
  mkdirSync(dir, { recursive: true });
  const risultati = {};
  const daFare = [];
  for (const s of simboli) {
    const f = join(dir, `${s}.bin`);
    if (!rifai && existsSync(f)) risultati[s] = leggiColonne(f); else daFare.push(s);
  }
  if (daFare.length) {
    const nWorker = Math.min(daFare.length, Math.max(1, cpus().length - 1));
    console.log(`Simulo le operazioni di ${daFare.length} monete con ${nWorker} worker (${VARIANTI.length} varianti)...`);
    const t = Date.now();
    let fatti = 0, prossimo = 0;
    await new Promise((ok, ko) => {
      let attivi = nWorker;
      for (let w = 0; w < nWorker; w++) {
        const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { simboli: daFare, fermi }, resourceLimits: { maxOldGenerationSizeMb: 4096 } });
        const dai = () => worker.postMessage(prossimo < daFare.length ? daFare[prossimo++] : null);
        worker.on('message', m => {
          if (m.pronto) return dai();
          salvaColonne(join(dir, `${m.simbolo}.bin`), m.colonne);
          risultati[m.simbolo] = m.colonne;
          console.log(`  ${++fatti}/${daFare.length} ${m.simbolo}: ${m.colonne.variante.length} operazioni (${Math.round((Date.now() - t) / 1000)} s)`);
          dai();
        });
        worker.on('error', ko);
        worker.on('exit', () => { if (--attivi === 0) ok(); });
      }
    });
  }
  return risultati;
}

// ---------------------------------------------------------------------------------------------
// Parte 2: portafoglio, scelta sul 70%, verifica sul 30%
// ---------------------------------------------------------------------------------------------
const GRUPPI = [
  { id: 'asia', nome: '00:00 UTC', sessioni: [0] },
  { id: 'europa', nome: 'Europa 08:00 Londra', sessioni: [1] },
  { id: 'usa', nome: 'USA 9:30 New York', sessioni: [2] },
  { id: 'tutte', nome: 'Tutte e tre insieme', sessioni: [0, 1, 2] },
];

// Indice delle operazioni per variante; gli oggetti si costruiscono solo quando servono (memoria)
function indicizza(colonnePerSimbolo, simboli) {
  const indici = VARIANTI.map(() => []);
  simboli.forEach((s, si) => {
    const c = colonnePerSimbolo[s];
    for (let k = 0; k < c.variante.length; k++) indici[c.variante[k]].push(si * 2 ** 22 + k);
  });
  return id => {
    const ops = indici[id].map(x => {
      const si = Math.floor(x / 2 ** 22), k = x % 2 ** 22, c = colonnePerSimbolo[simboli[si]];
      return {
        simbolo: si, piccola: si >= CONFIG.monetePrincipali, sessione: c.sessione[k], lato: c.lato[k], offset: c.offset[k], motivo: c.motivo[k],
        entrata: c.entrata[k], uscita: c.uscita[k], rapporto: c.rapporto[k], funding: c.funding[k], peggiore: c.peggiore[k], R: c.R[k],
      };
    });
    return ops.sort((a, b) => a.entrata - b.entrata || a.simbolo - b.simbolo);
  };
}

function eseguiPortafoglio(ops, { leva, slitt, composto, ordini = CONFIG.ordiniCasuali, tieni = false }) {
  const misure = [];
  let primo = null;
  for (let seme = 1; seme <= ordini; seme++) {
    const r = simulaPortafoglio(ops, { ...CONFIG.capitale, leva, composto, slittamento: slitt.base, slittamentoPiccole: slitt.piccole, seme });
    misure.push(metrichePortafoglio(r, CONFIG.capitale.capitale));
    if (tieni && seme === 1) primo = r;
  }
  return { m: mediaMetriche(misure), r: primo };
}

// Correlazione di Spearman tra due serie
function spearman(a, b) {
  const rango = x => { const idx = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(x.length); idx.forEach(([, i], k) => { r[i] = k; }); return r; };
  const ra = rango(a), rb = rango(b), n = a.length;
  const ma = (n - 1) / 2;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (ra[i] - ma) * (rb[i] - ma); saa += (ra[i] - ma) ** 2; sbb += (rb[i] - ma) ** 2; }
  return sab / Math.sqrt(saa * sbb);
}

async function main() {
  const rifai = process.argv.includes('--rifai');
  const universo = JSON.parse(readFileSync('data/universo.json', 'utf8'));
  const buchi = JSON.parse(readFileSync('data/binance/rapporto-buchi.json', 'utf8'));
  const quante = Number((process.argv.find(a => a.startsWith('--monete=')) || '').split('=')[1]) || buchi.simboli.length;
  const simboli = buchi.simboli.slice(0, quante); // --monete=N per prove veloci
  const fineDati = buchi.finoA;
  const taglio = Math.floor((INIZIO + (fineDati - INIZIO) * (1 - CONFIG.quotaVerifica)) / GIORNO) * GIORNO;
  console.log(`Periodo ${new Date(INIZIO).toISOString().slice(0, 10)} → ${new Date(fineDati).toISOString().slice(0, 10)}, taglio 70/30 al ${new Date(taglio).toISOString().slice(0, 10)}`);

  const colonne = await generaOperazioni(simboli, buchi.fermiBorsa, rifai);
  console.log('Preparo le operazioni per variante...');
  const operazioniDi = indicizza(colonne, simboli);
  const filtra = (ops, g, da, a) => ops.filter(o => g.sessioni.includes(o.sessione) && o.entrata >= da && o.entrata < a);

  const SLITT_ALTO = CONFIG.slittamenti[1];

  // Prima dei costi: rendimento medio lordo di tutte le operazioni di tutte le varianti, per sessione, versione e gruppo di monete
  const lordo = {};
  simboli.forEach((sim, si) => {
    const c = colonne[sim];
    const gruppoMonete = si <= 1 ? 'BTC ed ETH' : si < CONFIG.monetePrincipali ? 'dalla 3ª alla 14ª' : 'dalla 15ª in poi';
    for (let k = 0; k < c.variante.length; k++) {
      const tipo = VARIANTI[c.variante[k]].tipo;
      const periodo = c.entrata[k] < taglio ? 'scelta' : 'verifica';
      const chiave = [SESSIONI[c.sessione[k]].id, tipo, gruppoMonete, periodo].join('|');
      const a = lordo[chiave] ||= { n: 0, lordo: 0, netto05: 0, netto08: 0 };
      const sl = si >= CONFIG.monetePrincipali ? 0.0008 : 0.0005;
      a.n++; a.lordo += c.lato[k] * (c.rapporto[k] - 1);
      a.netto05 += rendimentoNetto(c.lato[k], c.rapporto[k], sl, c.funding[k]);
      a.netto08 += rendimentoNetto(c.lato[k], c.rapporto[k], 0.0008, c.funding[k]);
    }
  });
  const base = { leva: 3, slitt: SLITT_ALTO, composto: false };

  // Tutte le varianti, per ogni gruppo, nel 70% e nel 30% (configurazione di riferimento: dimensione fissa, leva 3x, slittamento 0,08%)
  console.log('Portafoglio di tutte le varianti (70% e 30%)...');
  const tabella = Object.fromEntries(GRUPPI.map(g => [g.id, []]));
  for (const v of VARIANTI) {
    const ops = operazioniDi(v.id);
    for (const g of GRUPPI) {
      const scelta = eseguiPortafoglio(filtra(ops, g, INIZIO, taglio), base).m;
      const verifica = eseguiPortafoglio(filtra(ops, g, taglio, fineDati), base).m;
      tabella[g.id].push({ v, scelta, verifica });
    }
    if ((v.id + 1) % 12 === 0) console.log(`  ${v.id + 1}/${VARIANTI.length} varianti`);
  }

  // Scelta: la variante con il miglior rendimento nel 70% (con almeno 100 operazioni), per gruppo
  const scelte = {};
  for (const g of GRUPPI) {
    const valide = tabella[g.id].filter(x => x.scelta.operazioni >= CONFIG.minimoOperazioniScelta && !x.scelta.rovina);
    valide.sort((a, b) => b.scelta.rendimento - a.scelta.rendimento);
    scelte[g.id] = valide[0];
  }

  // Per le varianti scelte: tutte le configurazioni di capitale nel 30%, anno per anno, scomposizioni, correlazione
  console.log('Dettaglio delle varianti scelte...');
  const dettagli = {};
  for (const g of GRUPPI) {
    const x = scelte[g.id];
    if (!x) continue;
    const ops = operazioniDi(x.v.id);
    const configurazioni = [];
    for (const slitt of CONFIG.slittamenti) for (const leva of CONFIG.leve) for (const composto of [false, true]) {
      configurazioni.push({
        slitt: slitt.nome, leva, composto,
        scelta: eseguiPortafoglio(filtra(ops, g, INIZIO, taglio), { leva, slitt, composto }).m,
        verifica: eseguiPortafoglio(filtra(ops, g, taglio, fineDati), { leva, slitt, composto }).m,
      });
    }
    const anni = [];
    for (let y = 2023; y <= new Date(fineDati).getUTCFullYear(); y++) {
      const da = Date.UTC(y, 0, 1), a = Math.min(Date.UTC(y + 1, 0, 1), fineDati);
      anni.push({ anno: y, parziale: a < Date.UTC(y + 1, 0, 1), m: eseguiPortafoglio(filtra(ops, g, da, a), base).m });
    }
    // Scomposizioni sulle singole operazioni (slittamento 0,08%), nel 70% e nel 30%
    const netto = o => rendimentoNetto(o.lato, o.rapporto, SLITT_ALTO.base, o.funding);
    const gruppiScomp = [
      ...(g.sessioni.length > 1 ? SESSIONI.map((s, i) => [`Sessione ${s.nome}`, o => o.sessione === i]) : []),
      ['Long', o => o.lato === 1], ['Short', o => o.lato === -1],
      ['Giorni feriali', o => !fineSettimana(o.entrata - o.offset * MIN)], ['Weekend', o => fineSettimana(o.entrata - o.offset * MIN)],
      ['BTC ed ETH', o => o.simbolo <= 1], ['Le altre 48', o => o.simbolo > 1],
      ['Entrata nei primi 3 minuti', o => o.offset < 3], ['Entrata dal 4° minuto in poi', o => o.offset >= 3],
    ];
    const scomp = gruppiScomp.map(([nome, f]) => ({
      nome,
      scelta: metricheOperazioni(filtra(ops, g, INIZIO, taglio).filter(f).map(netto)),
      verifica: metricheOperazioni(filtra(ops, g, taglio, fineDati).filter(f).map(netto)),
    }));
    // Motivi d'uscita
    const motivi = {};
    for (const o of filtra(ops, g, INIZIO, fineDati)) motivi[o.motivo] = (motivi[o.motivo] || 0) + 1;
    // Correlazione: posizioni dello stesso lato aperte insieme, sul portafoglio reale (primo ordine casuale, intero periodo)
    const { r } = eseguiPortafoglio(filtra(ops, g, INIZIO, fineDati), { ...base, ordini: 1, tieni: true });
    const eventi = new Map();
    for (const p of r.prese) {
      const k = p.entrata - p.offset * MIN;
      let e = eventi.get(k); if (!e) { e = { long: 0, short: 0, pnl: 0 }; eventi.set(k, e); }
      if (p.lato === 1) e.long++; else e.short++;
      e.pnl += p.pnl;
    }
    // Massimo di posizioni dello stesso lato aperte contemporaneamente
    const segni = r.prese.flatMap(p => [[p.entrata, 1, p.lato], [p.uscita, -1, p.lato]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let nL = 0, nS = 0; const distribuzione = new Array(11).fill(0);
    for (const [, d, lato] of segni) {
      if (lato === 1) nL += d; else nS += d;
      if (d === 1) distribuzione[Math.min(10, lato === 1 ? nL : nS)]++;
    }
    const ev = [...eventi.values()];
    const cap = CONFIG.capitale.capitale;
    const unilaterali = ev.filter(e => e.long + e.short >= 5 && Math.max(e.long, e.short) / (e.long + e.short) >= 0.8);
    const altri = ev.filter(e => !(e.long + e.short >= 5 && Math.max(e.long, e.short) / (e.long + e.short) >= 0.8));
    const correlazione = {
      eventi: ev.length,
      mediaPosizioniPerEvento: ev.reduce((s, e) => s + e.long + e.short, 0) / ev.length,
      quotaStessoLatoMedia: ev.reduce((s, e) => s + Math.max(e.long, e.short) / (e.long + e.short), 0) / ev.length,
      distribuzione, // indice = quante posizioni dello stesso lato erano aperte al momento di ogni entrata
      unilaterali: { n: unilaterali.length, pnlMedio: unilaterali.reduce((s, e) => s + e.pnl, 0) / Math.max(1, unilaterali.length) / cap, vinti: unilaterali.filter(e => e.pnl > 0).length, peggiore: Math.min(0, ...unilaterali.map(e => e.pnl)) / cap },
      altri: { n: altri.length, pnlMedio: altri.reduce((s, e) => s + e.pnl, 0) / Math.max(1, altri.length) / cap, vinti: altri.filter(e => e.pnl > 0).length },
    };
    dettagli[g.id] = { configurazioni, anni, scomp, motivi, correlazione };
  }

  const out = { creato: new Date().toISOString(), config: CONFIG, simboli, taglio, fineDati, varianti: VARIANTI.length, tabella, scelte, dettagli, lordo };
  writeFileSync(join(CARTELLA, 'risultati.json'), JSON.stringify(out, (k, v) => (v === Infinity ? 'inf' : v), 1));
  scriviDoc(out);
  console.log('Fatto: docs/apertura-sessione.md');
}

// ---------------------------------------------------------------------------------------------
// Parte 3: documento
// ---------------------------------------------------------------------------------------------
const pct = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x)) ? '–' : `${(x * 100).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' })}%`;
const num = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x)) ? '–' : (x === Infinity ? '∞' : x.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' }));
const intero = x => Math.round(x).toLocaleString('it-IT', { useGrouping: 'always' });
const data = ms => new Date(ms).toISOString().slice(0, 10);
const rend = m => m.rovina ? `${pct(Math.max(-1, m.rendimento))} (rovina)` : pct(m.rendimento);
const calo = m => m.caloMassimo >= 1 ? '100% (rovina)' : pct(m.caloMassimo);
const giornoP = m => m.giornoPeggiore <= -1 ? 'oltre -100% (rovina)' : pct(m.giornoPeggiore);
const rigaMetriche = m => `${rend(m)} | ${num(m.profitFactor)} | ${calo(m)} | ${giornoP(m)} | ${intero(m.operazioni)} | ${pct(m.medioNetto, 3)}`;

export function scriviDoc(out) {
  const { tabella, scelte, dettagli, taglio, fineDati, config } = out;
  const righe = [];
  const p = s => righe.push(s);
  p(`# Backtest "apertura di sessione"`);
  p('');
  p(`Aggiornato il ${out.creato.slice(0, 10)}. Script: \`research/04-apertura-sessione.js\`, motore in \`research/motore/\`. Risultati completi: \`data/backtest/apertura/risultati.json\`.`);
  p('');
  p('<!-- conclusione -->');
  p('');
  p('## Le regole');
  p(`- **Sessioni**: 00:00 UTC (chiusura della candela giornaliera e Asia), 08:00 Londra (Europa), 9:30 New York (USA). L'ora legale è gestita con il fuso orario vero: Londra apre alle 07:00 UTC d'estate e alle 08:00 d'inverno, New York alle 13:30 o 14:30 UTC. Tutti i giorni, weekend compresi (le crypto non chiudono).`);
  p(`- **Riferimento**: il prezzo d'apertura del primo minuto della sessione.`);
  p(`- **Entrata**: se durante la finestra d'entrata (3, 15 o 30 minuti) il prezzo si allontana dal riferimento della soglia, si entra nella direzione del movimento (sopra = long, sotto = short). Una sola entrata per moneta e per sessione. L'entrata conta solo se il prezzo supera il livello di almeno **0,15%**; il prezzo d'entrata è il livello (o l'apertura del minuto, se il prezzo ci è saltato oltre).`);
  p(`- **Uscite** (uguali per tutte le varianti; R = distanza dello stop iniziale):`);
  p(`  - stop iniziale a 1R;`);
  p(`  - protezione del guadagno: quando il guadagno arriva a +1R, lo stop sale a +0,3% (copre i costi);`);
  p(`  - stop che segue: da +1,5R lo stop segue il miglior prezzo a 1R di distanza;`);
  p(`  - durata massima: si chiude all'apertura della sessione successiva (00 → Europa, Europa → USA, USA → 00 del giorno dopo), al prezzo d'apertura di quel minuto con slittamento.`);
  p(`- **Due versioni di soglia e stop**: percentuale fissa (soglie 0,5/1/1,5/2%, stop 1/2/3%) e multiplo della volatilità della moneta (soglie 0,1/0,2/0,3/0,4 × vol, stop 0,25/0,5/0,75 × vol). La volatilità è la media dell'escursione giornaliera degli ultimi 14 giorni già chiusi (per BTC di solito 2–3%, per le monete piccole 6–12%).`);
  p(`- **Griglia**: 2 versioni × 4 soglie × 3 finestre × 3 stop = **${out.varianti} varianti** per ogni sessione.`);
  p('');
  p('## Il metodo');
  p(`- **Dati**: candele da 1 minuto di Binance delle 50 crypto di \`docs/universo.md\`, dal 2023-01-01 al ${data(fineDati - 1)} (o dalla quotazione). Nessun dato futuro: la volatilità usa solo giorni chiusi, l'entrata solo prezzi già visti.`);
  p(`- **Dentro il minuto**: candela in salita apertura→minimo→massimo→chiusura, in discesa apertura→massimo→minimo→chiusura (lo stop viene toccato prima del guadagno). Se il minuto apre già oltre lo stop, si esce all'apertura.`);
  p(`- **Fermi di Binance** (vedi \`docs/storico.md\`): minuti senza prezzo, niente entrate né uscite in quei minuti.`);
  p(`- **Costi**: commissione ${pct(COMMISSIONE, 2)} per lato; slittamento ${CONFIG.slittamenti.map(s => s.nome).join(' e ')} per lato, con minimo 0,08% sulle monete dalla 15ª in poi; funding reale di Binance pagato o incassato a ogni orario di pagamento in cui la posizione è aperta.`);
  p(`- **Capitale**: 10.000 USDT, 10 posizioni al massimo, margine 10% per posizione, leva 3x e 5x (quindi ogni posizione vale 3.000 o 5.000 USDT con dimensione fissa), margine isolato (perdita massima = il margine). **Freno giornaliero**: se le perdite chiuse del giorno UTC arrivano all'8% del capitale d'inizio giornata, niente nuove entrate fino al giorno dopo. Con **dimensione fissa** il margine è sempre il 10% del capitale iniziale; con **interesse composto** il 10% del capitale del momento.`);
  p(`- **Segnali simultanei**: quando nello stesso minuto ci sono più segnali che posti liberi, l'ordine è casuale; ogni risultato di portafoglio è la **media di ${config.ordiniCasuali} ordini casuali**. Le uscite di un minuto liberano i posti prima delle entrate dello stesso minuto.`);
  p(`- **70/30**: regole scelte sul periodo dal 2023-01-01 al ${data(taglio - 1)} (70%), verificate dal ${data(taglio)} al ${data(fineDati - 1)} (30%) senza cambiarle. Criterio di scelta: il miglior rendimento nel 70% con dimensione fissa, leva 3x, slittamento 0,08%, almeno ${CONFIG.minimoOperazioniScelta} operazioni.`);
  p(`- **Come leggere le misure**: rendimento sul capitale iniziale; profit factor = guadagni / perdite (sopra 1 si guadagna); peggior calo = massima discesa del capitale dal suo massimo (sulle operazioni chiuse); giorno peggiore = peggior giorno UTC in % del capitale; medio netto = guadagno medio per operazione in % del valore della posizione, costi compresi.`);
  p('');

  p("## Prima dei costi: c'è un vantaggio?");
  p(`Media di tutte le operazioni di tutte le ${out.varianti / 2} varianti di ogni versione (senza limiti di posti né capitale), in % del valore della posizione. "Lordo" è il movimento a favore prima di commissioni, slittamento e funding. Costo di un'operazione andata e ritorno: 0,22% con slittamento 0,05%, 0,28% con 0,08%.`);
  p('');
  p('| Sessione | Versione | Monete | Oper. 70% | Lordo 70% | Lordo 30% | Netto 30% (slitt. 0,05%*) | Netto 30% (slitt. 0,08%) |');
  p('|---|---|---|---:|---:|---:|---:|---:|');
  for (const ses of SESSIONI) for (const tipo of ['percentuale', 'volatilita']) for (const gm of ['BTC ed ETH', 'dalla 3ª alla 14ª', 'dalla 15ª in poi']) {
    const a = out.lordo[[ses.id, tipo, gm, 'scelta'].join('|')], b = out.lordo[[ses.id, tipo, gm, 'verifica'].join('|')];
    if (!a || !b) continue;
    p(`| ${ses.nome.split(' (')[0]} | ${tipo === 'percentuale' ? 'percentuale' : 'volatilità'} | ${gm} | ${intero(a.n)} | ${pct(a.lordo / a.n, 3)} | ${pct(b.lordo / b.n, 3)} | ${pct(b.netto05 / b.n, 3)} | ${pct(b.netto08 / b.n, 3)} |`);
  }
  p('');
  p('\* dalla 15ª moneta in poi lo slittamento è comunque 0,08%.');
  p('');
  p('## Le varianti scelte sul 70% e la verifica sul 30%');
  p('Configurazione di riferimento: dimensione fissa, leva 3x, slittamento 0,08%. "Rovina" = il capitale è arrivato a zero e la simulazione si è fermata lì: le misure contano solo le operazioni fino a quel momento.');
  p('');
  p('| Sessione | Variante scelta | Periodo | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |');
  p('|---|---|---|---:|---:|---:|---:|---:|---:|');
  for (const g of GRUPPI) {
    const x = scelte[g.id];
    if (!x) { p(`| ${g.nome} | nessuna variante con abbastanza operazioni | | | | | | | |`); continue; }
    p(`| ${g.nome} | ${x.v.tipo === 'percentuale' ? 'percentuale' : 'volatilità'}: ${nomeVariante(x.v)} | 70% scelta | ${rigaMetriche(x.scelta)} |`);
    p(`| | | **30% verifica** | **${rend(x.verifica)}** | **${num(x.verifica.profitFactor)}** | ${calo(x.verifica)} | ${giornoP(x.verifica)} | ${intero(x.verifica.operazioni)} | ${pct(x.verifica.medioNetto, 3)} |`);
  }
  p('');

  p('## Quanto è solida la scelta: tutte le varianti');
  p(`Se una regola funziona davvero, le varianti buone nel 70% dovrebbero restare buone nel 30%, e le varianti vicine dovrebbero dare risultati simili. Per ogni sessione e versione: quante delle ${out.varianti / 2} varianti guadagnano nel 70% e nel 30%, il rendimento mediano, e la correlazione di rango tra i risultati nei due periodi (1 = stesso ordine, 0 = nessun legame).`);
  p('');
  p('| Sessione | Versione | In utile nel 70% | In utile nel 30% | Mediana 70% | Mediana 30% | Migliore 30% | Correlazione 70↔30 |');
  p('|---|---|---:|---:|---:|---:|---:|---:|');
  const mediana = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
  for (const g of GRUPPI) for (const tipo of ['percentuale', 'volatilita']) {
    const t = tabella[g.id].filter(x => x.v.tipo === tipo);
    const a = t.map(x => Math.max(-1, x.scelta.rendimento)), b = t.map(x => Math.max(-1, x.verifica.rendimento));
    p(`| ${g.nome} | ${tipo === 'percentuale' ? 'percentuale' : 'volatilità'} | ${a.filter(x => x > 0).length}/${t.length} | ${b.filter(x => x > 0).length}/${t.length} | ${pct(mediana(a))} | ${pct(mediana(b))} | ${pct(Math.max(...b))} | ${num(spearman(a, b))} |`);
  }
  p('');
  p('### Le 5 migliori nel 70%, per sessione, e come sono andate nel 30%');
  for (const g of GRUPPI) {
    p('');
    p(`**${g.nome}**`);
    p('');
    p('| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% |');
    p('|---|---:|---:|---:|---:|---:|---:|');
    const t = [...tabella[g.id]].filter(x => x.scelta.operazioni >= CONFIG.minimoOperazioniScelta).sort((a, b) => b.scelta.rendimento - a.scelta.rendimento).slice(0, 5);
    for (const x of t) p(`| ${x.v.tipo === 'percentuale' ? '%' : 'vol'}: ${nomeVariante(x.v)} | ${rend(x.scelta)} | ${num(x.scelta.profitFactor)} | ${intero(x.scelta.operazioni)} | ${rend(x.verifica)} | ${num(x.verifica.profitFactor)} | ${intero(x.verifica.operazioni)} |`);
  }
  p('');

  for (const g of GRUPPI) {
    const d = dettagli[g.id], x = scelte[g.id];
    if (!d) continue;
    p(`## Dettaglio: ${g.nome}`);
    p(`Variante: **${x.v.tipo === 'percentuale' ? 'percentuale' : 'volatilità'}, ${nomeVariante(x.v)}**.`);
    p('');
    p('### Capitale: leva, slittamento, dimensione fissa e interesse composto');
    p('| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |');
    p('|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const c of d.configurazioni) p(`| ${c.slitt} | ${c.leva}x | ${c.composto ? 'composto' : 'fissa'} | ${rend(c.scelta)} | ${rend(c.verifica)} | ${num(c.verifica.profitFactor)} | ${calo(c.verifica)} | ${giornoP(c.verifica)} | ${intero(c.verifica.operazioni)} | ${pct(c.verifica.medioNetto, 3)} |`);
    p('');
    p('### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)');
    p('| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |');
    p('|---|---:|---:|---:|---:|---:|---:|');
    for (const a of d.anni) p(`| ${a.anno}${a.parziale ? ' (fino al ' + data(fineDati - 1).slice(5) + ')' : ''} | ${rigaMetriche(a.m)} |`);
    p('');
    p('### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)');
    p('| Gruppo | Oper. 70% | Medio netto 70% | PF 70% | Oper. 30% | Medio netto 30% | PF 30% | Vincenti 30% |');
    p('|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const s of d.scomp) p(`| ${s.nome} | ${intero(s.scelta.operazioni)} | ${pct(s.scelta.medioNetto, 3)} | ${num(s.scelta.profitFactor)} | ${intero(s.verifica.operazioni)} | ${pct(s.verifica.medioNetto, 3)} | ${num(s.verifica.profitFactor)} | ${pct(s.verifica.vincenti, 0)} |`);
    const totM = Object.values(d.motivi).reduce((s, v) => s + v, 0);
    const nomiM = { 1: 'stop iniziale', 2: 'protezione del guadagno', 3: 'stop che segue', 4: 'durata massima', 5: 'fine dati' };
    p('');
    p(`Uscite: ${Object.entries(d.motivi).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${nomiM[k]} ${pct(v / totM, 0)}`).join(', ')}.`);
    p('');
    p('### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)');
    const c = d.correlazione;
    const totD = c.distribuzione.reduce((s, v) => s + v, 0);
    p(`- ${intero(c.eventi)} aperture di sessione con almeno una posizione, in media ${num(c.mediaPosizioniPerEvento, 1)} posizioni per apertura. In media il **${pct(c.quotaStessoLatoMedia, 0)}** delle posizioni di un'apertura sono dalla stessa parte.`);
    p(`- Al momento di ogni entrata, posizioni dello stesso lato già aperte (compresa la nuova): ${c.distribuzione.map((v, k) => [k, v]).filter(([k, v]) => k > 0 && v > 0).map(([k, v]) => `${k}: ${pct(v / totD, 0)}`).join(' · ')}.`);
    p(`- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **${intero(c.unilaterali.n)}**, in utile ${intero(c.unilaterali.vinti)}, risultato medio ${pct(c.unilaterali.pnlMedio, 2)} del capitale, la peggiore ${pct(c.unilaterali.peggiore, 2)}. Le altre: ${intero(c.altri.n)}, in utile ${intero(c.altri.vinti)}, risultato medio ${pct(c.altri.pnlMedio, 2)}.`);
    p('');
  }

  p('## Limiti di questo test');
  p('- Le 50 monete sono le più liquide **oggi**: quelle che nel frattempo sono sparite o crollate non ci sono. Questo tende a migliorare i risultati del passato (soprattutto per i long).');
  p('- Le monete quotate da poco (es. BTWUSDT, XAUTUSDT, JCTUSDT, IRYSUSDT) compaiono solo nel 30% finale.');
  p('- Il percorso dentro il minuto è una supposizione; le punte di Binance non sempre ci sono su Bitunix (per questo il margine dello 0,15% sulle entrate).');
  p('- Il freno giornaliero guarda solo le perdite chiuse, non quelle ancora aperte.');
  p(`- Con ${out.varianti} varianti × 4 gruppi, la migliore nel 70% è in parte fortuna: per questo conta più la tabella "tutte le varianti" del singolo numero migliore.`);
  const file = 'docs/apertura-sessione.md';
  let testo = righe.join('\n') + '\n';
  // Mantengo la conclusione scritta a mano, se c'è già
  if (existsSync(file)) {
    const vecchio = readFileSync(file, 'utf8');
    const m = vecchio.match(/<!-- conclusione:inizio -->[\s\S]*?<!-- conclusione:fine -->/);
    if (m) testo = testo.replace('<!-- conclusione -->', () => m[0]);
  }
  testo = testo.replace('<!-- conclusione -->', '<!-- conclusione:inizio -->\n## Conclusione\n(da scrivere)\n<!-- conclusione:fine -->');
  writeFileSync(file, testo);
}

if (isMainThread) {
  main().catch(e => { console.error(e); process.exit(1); });
}

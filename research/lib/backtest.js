// Parti comuni dei backtest: cache delle operazioni a colonne, worker in parallelo, prezzi per il freno,
// portafoglio con ordini casuali, periodi 70/30, formattazione dei numeri per i documenti.
import { Worker } from 'node:worker_threads';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { leggiStorico, leggiFunding } from './storico.js';
import { fundingPagato } from '../motore/costi.js';
import { simulaPortafoglio } from '../motore/portafoglio.js';
import { metrichePortafoglio, mediaMetriche } from '../motore/metriche.js';

export const MIN = 60000, GIORNO = 86400000;
export const INIZIO = Date.UTC(2023, 0, 1);

// ---------- Dati comuni ----------
export function datiComuni() {
  const buchi = JSON.parse(readFileSync('data/binance/rapporto-buchi.json', 'utf8'));
  const quante = Number((process.argv.find(a => a.startsWith('--monete=')) || '').split('=')[1]) || buchi.simboli.length;
  const simboli = buchi.simboli.slice(0, quante); // --monete=N per prove veloci
  const fineDati = buchi.finoA;
  const taglio = Math.floor((INIZIO + (fineDati - INIZIO) * 0.7) / GIORNO) * GIORNO;
  return { simboli, fineDati, taglio, fermi: buchi.fermiBorsa };
}

// Storico di una moneta con i minuti dei fermi di Binance senza prezzo
export function storicoConFermi(simbolo, fermi) {
  const s = leggiStorico(simbolo, { da: INIZIO });
  for (const [t, len] of fermi) for (let k = 0; k < len; k++) {
    const i = (t - s.t0) / MIN + k;
    if (i >= 0 && i < s.n) s.open[i] = s.high[i] = s.low[i] = s.close[i] = NaN;
  }
  return s;
}

// ---------- Cache a colonne ----------
const TIPI = { Uint8Array, Int8Array, Uint16Array, Int32Array, Float32Array, Float64Array };
export function salvaColonne(file, col) {
  const meta = Object.fromEntries(Object.entries(col).map(([k, a]) => [k, [a.constructor.name, a.length]]));
  const testa = Buffer.from(JSON.stringify(meta));
  const len = Buffer.alloc(4); len.writeUInt32LE(testa.length);
  writeFileSync(file, Buffer.concat([len, testa, ...Object.values(col).map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength))]));
}
export function leggiColonne(file) {
  const buf = readFileSync(file);
  const lt = buf.readUInt32LE(0);
  const meta = JSON.parse(buf.subarray(4, 4 + lt).toString());
  let off = 4 + lt;
  const out = {};
  for (const [k, [tipo, n]] of Object.entries(meta)) {
    const T = TIPI[tipo], bytes = n * T.BYTES_PER_ELEMENT;
    const ab = new ArrayBuffer(bytes); new Uint8Array(ab).set(buf.subarray(off, off + bytes));
    out[k] = new T(ab); off += bytes;
  }
  return out;
}
export const firma = oggetto => createHash('sha1').update(JSON.stringify(oggetto)).digest('hex').slice(0, 10);

/**
 * Simula le operazioni di ogni moneta in worker paralleli, con cache su disco.
 * Il file `script` deve, nel worker, rispondere ai messaggi { simbolo } con { simbolo, colonne }.
 */
export async function operazioniInParallelo({ script, cartella, firmaConfig, simboli, datiWorker, rifai }) {
  const dir = join(cartella, firmaConfig);
  mkdirSync(dir, { recursive: true });
  const risultati = {};
  const daFare = [];
  for (const s of simboli) {
    const f = join(dir, `${s}.bin`);
    if (!rifai && existsSync(f)) risultati[s] = leggiColonne(f); else daFare.push(s);
  }
  if (!daFare.length) return risultati;
  const nWorker = Math.min(daFare.length, Math.max(1, cpus().length - 1));
  console.log(`Simulo le operazioni di ${daFare.length} monete con ${nWorker} worker...`);
  const t = Date.now();
  let fatti = 0, prossimo = 0;
  await new Promise((ok, ko) => {
    let attivi = nWorker;
    for (let w = 0; w < nWorker; w++) {
      const worker = new Worker(script, { workerData: datiWorker, resourceLimits: { maxOldGenerationSizeMb: 4096 } });
      const dai = () => worker.postMessage(prossimo < daFare.length ? daFare[prossimo++] : null);
      worker.on('message', m => {
        if (m.pronto) return dai();
        salvaColonne(join(dir, `${m.simbolo}.bin`), m.colonne);
        risultati[m.simbolo] = m.colonne;
        const n = Object.values(m.colonne)[0].length;
        console.log(`  ${++fatti}/${daFare.length} ${m.simbolo}: ${n} operazioni (${Math.round((Date.now() - t) / 1000)} s)`);
        dai();
      });
      worker.on('error', ko);
      worker.on('exit', () => { if (--attivi === 0) ok(); });
    }
  });
  return risultati;
}

// Lato worker: risponde ai messaggi chiamando `simula(simbolo)` → colonne (oggetto di TypedArray)
export function servizioWorker(parentPort, simula) {
  parentPort.on('message', simbolo => {
    if (simbolo === null) process.exit(0);
    const colonne = simula(simbolo);
    parentPort.postMessage({ simbolo, colonne }, Object.values(colonne).map(a => a.buffer));
  });
  parentPort.postMessage({ pronto: true });
}

// Da array JS a colonne tipizzate secondo lo schema { nome: TypedArray }
export const comeColonne = (schema, dati) => Object.fromEntries(Object.entries(schema).map(([k, T]) => [k, T.from(dati[k])]));

// ---------- Prezzi e funding per il portafoglio (freno con perdita aperta) ----------
export function caricaPrezzi(simboli) {
  const serie = simboli.map(sim => {
    const s = leggiStorico(sim, { da: INIZIO });
    return { t0: s.t0, n: s.n, o: Float32Array.from(s.open), c: Float32Array.from(s.close) };
  });
  const prendi = (arr, si, t) => { const x = serie[si]; const i = (t - x.t0) / MIN; return i >= 0 && i < x.n ? x[arr][i] : NaN; };
  return { apertura: (si, t) => prendi('o', si, t), chiusura: (si, t) => prendi('c', si, t) };
}
export function caricaFunding(simboli) {
  const tutti = simboli.map(s => leggiFunding(s) || []);
  return (si, lato, da, a) => fundingPagato(tutti[si], lato, da, a);
}

// ---------- Portafoglio: media di N ordini casuali ----------
export const CAPITALE = { capitale: 10000, posti: 10, quota: 0.1, freno: 0.08 };
export const SLITTAMENTI = [{ nome: '0,05%', base: 0.0005, piccole: 0.0008 }, { nome: '0,08%', base: 0.0008, piccole: 0.0008 }];
export const LEVE = [3, 5];
export const ORDINI_CASUALI = 10;

export function eseguiPortafoglio(ops, { leva = 3, slitt = SLITTAMENTI[1], composto = false, ordini = ORDINI_CASUALI, tieni = false, contesto = {}, capitale = CAPITALE }) {
  const misure = [];
  let primo = null;
  for (let seme = 1; seme <= ordini; seme++) {
    const r = simulaPortafoglio(ops, { ...capitale, leva, composto, slittamento: slitt.base, slittamentoPiccole: slitt.piccole, seme, prezzi: contesto.prezzi, funding: contesto.funding });
    misure.push(metrichePortafoglio(r, capitale.capitale));
    if (tieni && seme === 1) primo = r;
  }
  return { m: mediaMetriche(misure), r: primo };
}

// Correlazione di Spearman tra due serie
export function spearman(a, b) {
  const rango = x => { const idx = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(x.length); idx.forEach(([, i], k) => { r[i] = k; }); return r; };
  const ra = rango(a), rb = rango(b), n = a.length;
  const ma = (n - 1) / 2;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (ra[i] - ma) * (rb[i] - ma); saa += (ra[i] - ma) ** 2; sbb += (rb[i] - ma) ** 2; }
  return sab / Math.sqrt(saa * sbb);
}
export const mediana = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };

// ---------- Formattazione ----------
export const pct = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x)) ? '–' : `${(x * 100).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' })}%`;
export const num = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x)) ? '–' : (x === Infinity || x === 'inf' ? '∞' : x.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' }));
export const intero = x => (x === null || x === undefined || Number.isNaN(x)) ? '–' : Math.round(x).toLocaleString('it-IT', { useGrouping: 'always' });
export const data = ms => new Date(ms).toISOString().slice(0, 10);
export const rend = m => m.rovina ? `${pct(Math.max(-1, m.rendimento))} (rovina)` : pct(m.rendimento);
export const calo = m => m.caloMassimo >= 1 ? '100% (rovina)' : pct(m.caloMassimo);
export const giornoP = m => m.giornoPeggiore <= -1 ? 'oltre -100% (rovina)' : pct(m.giornoPeggiore);
export const rigaMetriche = m => `${rend(m)} | ${num(m.profitFactor)} | ${calo(m)} | ${giornoP(m)} | ${intero(m.operazioni)} | ${pct(m.medioNetto, 3)}`;
export const INTESTAZIONE_METRICHE = 'Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto';

// Mantiene la parte scritta a mano tra <!-- conclusione:inizio --> e <!-- conclusione:fine -->
export function scriviConConclusione(file, testo) {
  if (existsSync(file)) {
    const m = readFileSync(file, 'utf8').match(/<!-- conclusione:inizio -->[\s\S]*?<!-- conclusione:fine -->/);
    if (m) testo = testo.replace('<!-- conclusione -->', () => m[0]);
  }
  testo = testo.replace('<!-- conclusione -->', '<!-- conclusione:inizio -->\n## Conclusione\n(da scrivere)\n<!-- conclusione:fine -->');
  writeFileSync(file, testo);
}

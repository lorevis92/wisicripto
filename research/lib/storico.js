// Formato binario dello storico a 1 minuto, pensato per essere riletto in fretta nei backtest.
//
// Un file per simbolo e per mese: data/binance/klines/<SIMBOLO>/<AAAA-MM>.bin
// La griglia è fissa: la riga i è il minuto (inizio mese UTC + i·60 s). Il numero di righe n
// si ricava dalla dimensione del file (n = byte / BYTE_PER_MINUTO); il mese in corso è più corto.
// Colonne una dopo l'altra (non righe):
//   open, high, low, close            Float64 × n
//   volume (moneta), quoteVolume (USDT), trades, takerBuyQuote (USDT)   Float32 × n
// Un minuto mancante ha tutte le colonne a NaN.
//
// Il funding è in data/binance/funding/<SIMBOLO>.json: [[tempo_ms, tasso], ...] (tasso in frazione, 0.0001 = 0,01%).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const CARTELLA = join('data', 'binance');
export const COL64 = ['open', 'high', 'low', 'close'];
export const COL32 = ['volume', 'quoteVolume', 'trades', 'takerBuyQuote'];
export const BYTE_PER_MINUTO = COL64.length * 8 + COL32.length * 4;
const MIN = 60000;

export const meseChiave = (anno, mese) => `${anno}-${String(mese).padStart(2, '0')}`;
export const inizioMese = (anno, mese) => Date.UTC(anno, mese - 1, 1);
export const minutiNelMese = (anno, mese) => (Date.UTC(anno, mese, 1) - Date.UTC(anno, mese - 1, 1)) / MIN;
export const fileMese = (simbolo, chiave) => join(CARTELLA, 'klines', simbolo, `${chiave}.bin`);

export function nuovaGriglia(n) {
  const g = { n };
  for (const c of COL64) g[c] = new Float64Array(n).fill(NaN);
  for (const c of COL32) g[c] = new Float32Array(n).fill(NaN);
  return g;
}

export function scriviMese(simbolo, chiave, g) {
  mkdirSync(join(CARTELLA, 'klines', simbolo), { recursive: true });
  const parti = [...COL64, ...COL32].map(c => Buffer.from(g[c].buffer, g[c].byteOffset, g[c].byteLength));
  writeFileSync(fileMese(simbolo, chiave), Buffer.concat(parti));
}

export function leggiMese(simbolo, chiave) {
  const f = fileMese(simbolo, chiave);
  if (!existsSync(f)) return null;
  const buf = readFileSync(f);
  const n = buf.length / BYTE_PER_MINUTO;
  // Copio in un ArrayBuffer allineato
  const ab = new ArrayBuffer(buf.length);
  new Uint8Array(ab).set(buf);
  const g = { n };
  let off = 0;
  for (const c of COL64) { g[c] = new Float64Array(ab, off, n); off += n * 8; }
  for (const c of COL32) { g[c] = new Float32Array(ab, off, n); off += n * 4; }
  return g;
}

export function mesiDisponibili(simbolo) {
  const dir = join(CARTELLA, 'klines', simbolo);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.bin')).map(f => f.slice(0, 7)).sort();
}

// Legge lo storico di un simbolo tra due istanti (ms UTC, `a` escluso) in un'unica griglia continua.
// Restituisce { t0, n, open, high, low, close, volume, quoteVolume, trades, takerBuyQuote };
// il minuto i comincia a t0 + i·60000.
export function leggiStorico(simbolo, { da = 0, a = Infinity } = {}) {
  const mesi = mesiDisponibili(simbolo);
  if (!mesi.length) return null;
  const blocchi = [];
  for (const k of mesi) {
    const [y, m] = k.split('-').map(Number);
    const t = inizioMese(y, m);
    if (t >= a || Date.UTC(y, m, 1) <= da) continue;
    blocchi.push({ t, g: leggiMese(simbolo, k) });
  }
  if (!blocchi.length) return null;
  const fineDati = blocchi.at(-1).t + blocchi.at(-1).g.n * MIN;
  const t0 = Math.max(Math.ceil(da / MIN) * MIN, blocchi[0].t);
  const t1 = Math.min(a, fineDati);
  const n = Math.max(0, (t1 - t0) / MIN);
  const out = nuovaGriglia(n);
  out.t0 = t0;
  for (const { t, g } of blocchi) {
    const s = Math.max(0, (t0 - t) / MIN), e = Math.min(g.n, (t1 - t) / MIN);
    if (e <= s) continue;
    const dest = (t + s * MIN - t0) / MIN;
    for (const c of [...COL64, ...COL32]) out[c].set(g[c].subarray(s, e), dest);
  }
  return out;
}

export function leggiFunding(simbolo) {
  const f = join(CARTELLA, 'funding', `${simbolo}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

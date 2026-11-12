// Dati per le strategie lente: candele da 1 ora e funding di tutti i perpetual USDT-M di Binance, comprese le monete tolte.
// Formato: data/lente/ore/<SIMBOLO>.bin = Float64Array [t0, n, open×n, high×n, low×n, close×n, quoteVolume×n]
// (t0 = inizio della prima ora in ms, ore consecutive, NaN dove manca la candela).
// data/lente/funding/<SIMBOLO>.json = [[tempo_ms, tasso], ...]; data/lente/simboli.json = elenco con stato e date.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const ORA = 3600000, GIORNO = 86400000, SETTIMANA = 7 * GIORNO;
export const CARTELLA_LENTE = join('data', 'lente');
const fileOre = s => join(CARTELLA_LENTE, 'ore', `${s}.bin`);
const fileFunding = s => join(CARTELLA_LENTE, 'funding', `${s}.json`);
export const CAMPI = ['open', 'high', 'low', 'close', 'quoteVolume'];

export function scriviOre(simbolo, { t0, n, ...col }) {
  mkdirSync(join(CARTELLA_LENTE, 'ore'), { recursive: true });
  const buf = new Float64Array(2 + CAMPI.length * n);
  buf[0] = t0; buf[1] = n;
  CAMPI.forEach((c, k) => buf.set(col[c], 2 + k * n));
  writeFileSync(fileOre(simbolo), Buffer.from(buf.buffer));
}

export function leggiOre(simbolo) {
  if (!existsSync(fileOre(simbolo))) return null;
  const b = readFileSync(fileOre(simbolo));
  const f = new Float64Array(b.buffer, b.byteOffset, b.byteLength / 8);
  const t0 = f[0], n = f[1];
  const out = { t0, n };
  CAMPI.forEach((c, k) => { out[c] = f.subarray(2 + k * n, 2 + (k + 1) * n); });
  return out;
}

export function scriviFunding(simbolo, righe) {
  mkdirSync(join(CARTELLA_LENTE, 'funding'), { recursive: true });
  writeFileSync(fileFunding(simbolo), JSON.stringify(righe));
}
export const leggiFunding = s => (existsSync(fileFunding(s)) ? JSON.parse(readFileSync(fileFunding(s), 'utf8')) : []);
export const leggiSimboli = () => JSON.parse(readFileSync(join(CARTELLA_LENTE, 'simboli.json'), 'utf8'));

// Candele giornaliere (UTC) dalle orarie: apertura della prima ora, chiusura dell'ultima, volume sommato.
// Un giorno vale solo se ha almeno 20 ore su 24.
export function giornaliere(o) {
  const g0 = Math.ceil(o.t0 / GIORNO) * GIORNO;
  const nG = Math.floor((o.t0 + o.n * ORA - g0) / GIORNO);
  const out = { t0: g0, n: Math.max(0, nG) };
  for (const c of CAMPI) out[c] = new Float64Array(out.n).fill(NaN);
  for (let d = 0; d < out.n; d++) {
    const i0 = (g0 + d * GIORNO - o.t0) / ORA;
    let ore = 0, op = NaN, hi = -Infinity, lo = Infinity, cl = NaN, v = 0;
    for (let i = i0; i < i0 + 24; i++) {
      if (Number.isNaN(o.close[i])) continue;
      if (Number.isNaN(op)) op = o.open[i];
      hi = Math.max(hi, o.high[i]); lo = Math.min(lo, o.low[i]); cl = o.close[i]; v += o.quoteVolume[i]; ore++;
    }
    if (ore < 20) continue;
    out.open[d] = op; out.high[d] = hi; out.low[d] = lo; out.close[d] = cl; out.quoteVolume[d] = v;
  }
  return out;
}

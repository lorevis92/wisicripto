// Strategie lente · passo 1: candele da 1 ora e funding di TUTTI i perpetual USDT-M di Binance dal 2020,
// comprese le monete tolte (senza quelle i risultati sarebbero gonfiati: si vedrebbero solo le sopravvissute).
//   - Elenco dei simboli dall'archivio di data.binance.vision (che tiene anche i contratti chiusi) + exchangeInfo di Binance
//     per lo stato di oggi. Esclusi: contratti su azioni e materie prime (TRADIFI), indici, USDC e oro tokenizzato.
//   - Candele da 1 ora: file mensili dell'archivio; per il mese in corso file giornalieri (o l'API per le monete attive).
//   - Funding: file mensili dell'archivio; per il mese in corso l'API di Binance.
//   - Le candele giornaliere si ricavano dalle orarie (research/lib/lente.js). Controllo: su un campione di monete
//     si confrontano con i file giornalieri ufficiali di Binance.
// Uscita: data/lente/ (vedi research/lib/lente.js). Si può rilanciare: i simboli già completi vengono saltati.
//
// Uso: node --max-old-space-size=8192 research/12-scarica-lente.js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getBuffer, getJson, creaLimitatore, inParallelo } from './lib/http.js';
import { estraiPrimoFile } from './lib/zip.js';
import { ORA, GIORNO, CARTELLA_LENTE, CAMPI, scriviOre, leggiOre, scriviFunding, leggiFunding, giornaliere } from './lib/lente.js';

const S3 = 'https://s3-ap-northeast-1.amazonaws.com/data.binance.vision?delimiter=/&prefix=';
const VISION = 'https://data.binance.vision/';
const FAPI = 'https://fapi.binance.com/fapi/v1';
const DA = Date.UTC(2020, 0, 1);
const OGGI = Math.floor(Date.now() / GIORNO) * GIORNO; // fino a ieri compreso
const MESE_CORRENTE = Date.UTC(new Date(OGGI).getUTCFullYear(), new Date(OGGI).getUTCMonth(), 1);
const limS3 = creaLimitatore(20), limBinance = creaLimitatore(3);
const ESCLUSI = new Set(['USDCUSDT', 'PAXGUSDT', 'XAUTUSDT', 'DEFIUSDT', 'BTCDOMUSDT', 'ALLUSDT', 'BLUEBIRDUSDT', 'FOOTBALLUSDT']);

async function elenca(prefix, { chiavi = false } = {}) {
  const out = [];
  let marker = '';
  for (;;) {
    await limS3();
    const res = await fetch(S3 + prefix + (marker ? '&marker=' + encodeURIComponent(marker) : ''), { signal: AbortSignal.timeout(60000) });
    const x = await res.text();
    if (chiavi) out.push(...[...x.matchAll(/<Key>([^<]*)<\/Key>/g)].map(m => m[1]));
    else out.push(...[...x.matchAll(/<Prefix>([^<]*)<\/Prefix>/g)].map(m => m[1]).filter(p => p !== prefix).map(p => p.slice(prefix.length, -1)));
    if (!/<IsTruncated>true/.test(x)) break;
    marker = (x.match(/<NextMarker>([^<]*)/) || [])[1] || [...x.matchAll(/<Key>([^<]*)<\/Key>/g)].at(-1)[1];
  }
  return out;
}

const csvDi = async url => { const z = await getBuffer(url, { limitatore: limS3 }); return z ? estraiPrimoFile(z).toString('utf8') : null; };
const righeCsv = csv => csv.split('\n').filter(r => r && r.charCodeAt(0) <= 57).map(r => r.split(','));
const ms = t => (t > 1e14 ? Math.floor(t / 1000) : t);

async function scaricaSimbolo(simbolo, attiva) {
  // --- candele da 1 ora ---
  const mensili = (await elenca(`data/futures/um/monthly/klines/${simbolo}/1h/`, { chiavi: true })).filter(k => k.endsWith('.zip'));
  const giornalieri = (await elenca(`data/futures/um/daily/klines/${simbolo}/1h/${simbolo}-1h-${new Date(MESE_CORRENTE).toISOString().slice(0, 7)}`, { chiavi: true })).filter(k => k.endsWith('.zip'));
  const mesiDa = mensili.filter(k => Date.parse(k.match(/(\d{4}-\d{2})\.zip$/)[1] + '-01T00:00:00Z') >= DA);
  const candele = new Map();
  let doppie = 0;
  const aggiungi = csv => { for (const c of righeCsv(csv)) { const t = ms(Number(c[0])); if (candele.has(t)) doppie++; candele.set(t, [+c[1], +c[2], +c[3], +c[4], +c[7]]); } };
  await inParallelo(mesiDa, 4, async k => { const csv = await csvDi(VISION + k); if (csv) aggiungi(csv); });
  await inParallelo(giornalieri, 4, async k => { const csv = await csvDi(VISION + k); if (csv) aggiungi(csv); });
  if (attiva) { // ore dall'ultimo file a oggi, dall'API
    let da = candele.size ? Math.max(...candele.keys()) + ORA : MESE_CORRENTE;
    while (da < OGGI) {
      const r = await getJson(`${FAPI}/klines?symbol=${simbolo}&interval=1h&startTime=${da}&endTime=${OGGI - 1}&limit=1500`, { limitatore: limBinance });
      if (!r || !r.length) break;
      for (const c of r) candele.set(c[0], [+c[1], +c[2], +c[3], +c[4], +c[7]]);
      da = r.at(-1)[0] + ORA;
    }
  }
  const tempi = [...candele.keys()].filter(t => t >= DA && t < OGGI).sort((a, b) => a - b);
  if (!tempi.length) return { simbolo, ore: 0 };
  const t0 = tempi[0], n = (tempi.at(-1) - t0) / ORA + 1;
  const col = Object.fromEntries(CAMPI.map(c => [c, new Float64Array(n).fill(NaN)]));
  let fuori = 0;
  for (const t of tempi) {
    const i = (t - t0) / ORA;
    if (!Number.isInteger(i)) { fuori++; continue; }
    CAMPI.forEach((c, k) => { col[c][i] = candele.get(t)[k]; });
  }
  scriviOre(simbolo, { t0, n, ...col });
  // --- funding ---
  const fMensili = (await elenca(`data/futures/um/monthly/fundingRate/${simbolo}/`, { chiavi: true })).filter(k => k.endsWith('.zip'));
  const funding = new Map();
  await inParallelo(fMensili, 4, async k => {
    const csv = await csvDi(VISION + k);
    if (csv) for (const c of righeCsv(csv)) funding.set(Math.round(ms(Number(c[0])) / 60000) * 60000, Number(c.at(-1)));
  });
  if (attiva) {
    let da = funding.size ? Math.max(...funding.keys()) + 1 : MESE_CORRENTE;
    for (;;) {
      const r = await getJson(`${FAPI}/fundingRate?symbol=${simbolo}&startTime=${da}&limit=1000`, { limitatore: limBinance });
      if (!r || !r.length) break;
      for (const x of r) funding.set(Math.round(x.fundingTime / 60000) * 60000, Number(x.fundingRate));
      if (r.length < 1000) break;
      da = r.at(-1).fundingTime + 1;
    }
  }
  const righeF = [...funding].filter(([t]) => t >= DA && t < OGGI).sort((a, b) => a[0] - b[0]);
  scriviFunding(simbolo, righeF);
  const mancanti = col.close.reduce((s, x) => s + (Number.isNaN(x) ? 1 : 0), 0);
  return { simbolo, ore: n, mancanti, doppie, fuori, primo: t0, ultimo: tempi.at(-1), funding: righeF.length };
}

async function main() {
  mkdirSync(CARTELLA_LENTE, { recursive: true });
  console.log('Elenco dei simboli...');
  const archivio = await elenca('data/futures/um/monthly/klines/');
  const ei = await getJson(`${FAPI}/exchangeInfo`);
  const info = Object.fromEntries(ei.symbols.map(s => [s.symbol, s]));
  const bitunix = new Set(JSON.parse(readFileSync('data/universo.json', 'utf8')).candidati.map(c => c.simbolo));
  const scartati = [];
  const simboli = archivio.filter(s => s.endsWith('USDT')).filter(s => {
    const x = info[s];
    const motivo = ESCLUSI.has(s) ? 'escluso (stablecoin, oro o indice)'
      : x && x.contractType !== 'PERPETUAL' ? `contratto ${x.contractType}`
        : x && x.underlyingType !== 'COIN' ? `sottostante ${x.underlyingType}` : null;
    if (motivo) scartati.push({ simbolo: s, motivo });
    return !motivo;
  });
  const fileElenco = join(CARTELLA_LENTE, 'simboli.json');
  const prima = existsSync(fileElenco) ? JSON.parse(readFileSync(fileElenco, 'utf8')) : { simboli: [] };
  const fatti = new Map(prima.simboli.filter(s => s.completo === OGGI).map(s => [s.simbolo, s]));
  const elenco = [];
  let k = 0;
  const t0 = Date.now();
  await inParallelo(simboli, 6, async s => {
    const attiva = info[s]?.status === 'TRADING';
    let r = fatti.get(s);
    if (!r || !leggiOre(s)) r = { ...(await scaricaSimbolo(s, attiva)), completo: OGGI };
    elenco.push({ ...r, simbolo: s, attiva, stato: info[s]?.status || 'non più elencata', bitunix: bitunix.has(s) });
    if (++k % 25 === 0) {
      console.log(`  ${k}/${simboli.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
      writeFileSync(fileElenco, JSON.stringify({ creato: new Date().toISOString(), simboli: elenco, scartati }, null, 1));
    }
  });
  elenco.sort((a, b) => a.simbolo.localeCompare(b.simbolo));
  // Controllo: candele giornaliere ricavate contro i file giornalieri ufficiali, su un campione di monete attive e tolte
  const campione = [...elenco.filter(s => s.attiva && s.ore).slice(0, 6), ...elenco.filter(s => !s.attiva && s.ore).slice(0, 6)];
  const controllo = [];
  for (const s of campione) {
    const o = leggiOre(s.simbolo), g = giornaliere(o);
    const mese = new Date(o.t0 + Math.floor(o.n / 2) * ORA).toISOString().slice(0, 7);
    const csv = await csvDi(`${VISION}data/futures/um/monthly/klines/${s.simbolo}/1d/${s.simbolo}-1d-${mese}.zip`);
    if (!csv) continue;
    let giorni = 0, diversi = 0;
    for (const c of righeCsv(csv)) {
      const d = (ms(Number(c[0])) - g.t0) / GIORNO;
      if (d < 0 || d >= g.n || Number.isNaN(g.close[d])) continue;
      giorni++;
      const err = Math.max(...[1, 2, 3, 4].map(j => Math.abs(+c[j] / [g.open, g.high, g.low, g.close][j - 1][d] - 1)));
      if (err > 1e-9) diversi++;
    }
    controllo.push({ simbolo: s.simbolo, attiva: s.attiva, mese, giorni, diversi });
  }
  writeFileSync(fileElenco, JSON.stringify({ creato: new Date().toISOString(), fino: OGGI, simboli: elenco, scartati, controllo }, null, 1));
  const attive = elenco.filter(s => s.attiva).length;
  console.log(`${elenco.length} simboli (${attive} attivi, ${elenco.length - attive} tolti), ${scartati.length} scartati`);
  console.log('Controllo giornaliere:', JSON.stringify(controllo));
}

main();

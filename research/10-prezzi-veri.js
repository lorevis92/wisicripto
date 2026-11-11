// Prezzi veri dentro il minuto per le operazioni della verifica il cui esito dipende dall'ordine massimo/minimo
// (revisione, docs/revisione.md, problema 1).
//   1. Per ogni moneta di A e B simula la regola fissata con l'estremo sfavorevole sempre per primo, con quello favorevole
//      sempre per primo e con la regola di Wisi Trade ("vicino"). Le operazioni con esito diverso sono "ambigue".
//   2. Per ogni operazione ambigua scarica gli aggTrades di Binance (data.binance.vision, file giornalieri) dei giorni che
//      la contengono e salva, per ogni minuto dall'entrata alla durata massima, la sequenza dei prezzi veri
//      (solo i punti di svolta: tra due svolte il prezzo va in una sola direzione, il risultato è lo stesso).
//   3. Controlla che massimo e minimo dei prezzi veri coincidano con quelli delle candele.
// Uscita: data/aggtrades/<SIMBOLO>.json { "tempo del minuto": [prezzi...] }, letta da research/08.
//
// Con --tutte: prezzi veri per tutte le operazioni, non solo per quelle ambigue (serve a research/11).
//
// Uso: node --max-old-space-size=12288 research/10-prezzi-veri.js [--tutte]
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInflateRaw } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { leggiFunding, leggiStorico } from './lib/storico.js';
import { getBuffer, inParallelo } from './lib/http.js';
import { operazioniGrandeMovimento } from './motore/grandeMovimento.js';
import { MIN, GIORNO, INIZIO, datiComuni, storicoConFermi, operazioniInParallelo, servizioWorker, comeColonne, firma, data } from './lib/backtest.js';

const REGOLA = JSON.parse(readFileSync(join('data', 'backtest', 'regola', 'regola.json'), 'utf8')).regola;
const VARIANTI = [{ id: 0, N: REGOLA.N, k: REGOLA.k, direzione: REGOLA.direzione, conferma: REGOLA.conferma }];
const PERIODO_A = { da: Date.UTC(2019, 8, 1), a: Date.UTC(2023, 0, 1), conta: Date.UTC(2020, 0, 1) };
const VISION = 'https://data.binance.vision/data/futures/um/daily/aggTrades';
const USCITA = join('data', 'aggtrades');
const TUTTE = process.argv.includes('--tutte');

// ---------- Worker: entrate delle operazioni ambigue di una moneta ----------
if (!isMainThread) servizioWorker(parentPort, chiave => {
  const [gruppo, simbolo] = [chiave.slice(0, 1), chiave.slice(2)];
  const da = gruppo === 'A' ? PERIODO_A.da : INIZIO, a = gruppo === 'A' ? PERIODO_A.a : Infinity;
  const s = storicoConFermi(simbolo, workerData.fermi, { da, a });
  const vuoto = { entrata: Float64Array.from([]), ambigua: Uint8Array.from([]) };
  if (!s || s.n < 30 * 1440) return vuoto;
  const funding = (leggiFunding(simbolo) || []).filter(x => x[0] >= da && x[0] < a);
  const modi = ['vicino', 'sfavorevole', 'favorevole'].map(ordine =>
    operazioniGrandeMovimento({ s, funding, varianti: VARIANTI, config: { ...REGOLA.config, ordine } }));
  const [v, sf, fa] = modi;
  const chiaveOp = (o, i) => `${o.uscita[i]}|${o.rapporto[i]}|${o.motivo[i]}`;
  const ambigue = [];
  const flag = [];
  for (let i = 0; i < v.entrata.length; i++) {
    // le entrate non dipendono dall'ordine dentro la candela: stesso indice = stessa operazione
    if (sf.entrata[i] !== v.entrata[i] || fa.entrata[i] !== v.entrata[i]) throw new Error(`${simbolo}: entrate diverse tra i modi`);
    ambigue.push(v.entrata[i]);
    flag.push(chiaveOp(v, i) !== chiaveOp(sf, i) || chiaveOp(v, i) !== chiaveOp(fa, i) ? 1 : 0);
  }
  return comeColonne({ entrata: Float64Array, ambigua: Uint8Array }, { entrata: ambigue, ambigua: flag });
});

// Punti di svolta di una sequenza di prezzi
function svolte(prezzi) {
  const out = [prezzi[0]];
  let dir = 0;
  for (let k = 1; k < prezzi.length; k++) {
    const p = prezzi[k], ultimo = out[out.length - 1];
    if (p === ultimo) continue;
    const d = Math.sign(p - ultimo);
    if (d === dir) out[out.length - 1] = p; else { out.push(p); dir = d; }
  }
  return out;
}

// Dati compressi del primo file di uno zip (come lib/zip.js, ma da decomprimere in streaming)
function datiZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  const cd = buf.readUInt32LE(eocd + 16);
  const metodo = buf.readUInt16LE(cd + 10), dim = buf.readUInt32LE(cd + 20), off = buf.readUInt32LE(cd + 42);
  const inizio = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
  if (metodo !== 8) throw new Error(`zip: metodo ${metodo}`);
  return buf.subarray(inizio, inizio + dim);
}

// Legge gli aggTrades di un giorno e tiene i prezzi dei minuti richiesti
async function prezziDelGiorno(simbolo, giorno, minuti) {
  const nome = `${simbolo}-aggTrades-${data(giorno)}`;
  const buf = await getBuffer(`${VISION}/${simbolo}/${nome}.zip`, { attesa: 900000 }); // file fino a centinaia di MB
  if (!buf) return null;
  const righe = createInterface({ input: Readable.from([datiZip(buf)]).pipe(createInflateRaw()), crlfDelay: Infinity });
  const per = new Map([...minuti].map(m => [m, []]));
  for await (const r of righe) {
    const c = r.split(',');
    const t = Number(c[5]);
    if (!Number.isFinite(t)) continue; // intestazione
    const lista = per.get(Math.floor(t / MIN) * MIN);
    if (lista) lista.push(Number(c[1])); // gli aggTrades sono già in ordine di esecuzione
  }
  return per;
}

async function main() {
  const principali = datiComuni();
  const rA = JSON.parse(readFileSync('data/binance/rapporto-buchi-prima-2023.json', 'utf8'));
  const rB = JSON.parse(readFileSync('data/binance/rapporto-buchi-monete-51-100.json', 'utf8'));
  const fermi = [...principali.fermi, ...rA.fermiBorsa, ...rB.fermiBorsa];
  const escluse = new Set(['BTCUSDT', 'ETHUSDT']);
  const voci = [...rA.simboli.filter(s => !escluse.has(s) && rA.rapporto[s]).map(s => `A_${s}`), ...rB.simboli.filter(s => !escluse.has(s) && rB.rapporto[s]).map(s => `B_${s}`)];
  const amb = await operazioniInParallelo({
    script: fileURLToPath(import.meta.url), cartella: join('data', 'backtest', 'ambigue'), firmaConfig: firma({ REGOLA, PERIODO_A, v: 3 }),
    simboli: voci, datiWorker: { fermi }, rifai: false,
  });
  mkdirSync(USCITA, { recursive: true });
  // giorni da scaricare per moneta
  const lavori = [];
  let nAmb = 0, nTot = 0;
  for (const chiave of voci) {
    const simbolo = chiave.slice(2), c = amb[chiave];
    const tutte = [...c.entrata], ambigue = tutte.filter((_, i) => c.ambigua[i]);
    const entrate = TUTTE ? tutte : ambigue;
    nAmb += ambigue.length; nTot += entrate.length;
    const file = join(USCITA, `${simbolo}.json`);
    const gia = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { percorsi: {}, giorni: [], conta: { minuti: 0, diversi: 0, mancanti: 0 }, giorniMancanti: [], visti: [] };
    const finestra = e => Array.from({ length: REGOLA.config.durataMassima + 2 }, (_, k) => e + k * MIN);
    // file della prima versione: i minuti già visti sono quelli delle operazioni ambigue nei giorni già scaricati
    if (!gia.visti) gia.visti = ambigue.flatMap(finestra).filter(m => gia.giorni.includes(Math.floor(m / GIORNO) * GIORNO));
    const visti = new Set(gia.visti);
    gia.visti = visti; // Set durante il lavoro, salvato come elenco
    const perGiorno = new Map();
    for (const e of entrate) for (const m of finestra(e)) {
      const g = Math.floor(m / GIORNO) * GIORNO;
      if (visti.has(m)) continue;
      if (!perGiorno.has(g)) perGiorno.set(g, new Set());
      perGiorno.get(g).add(m);
    }
    if (perGiorno.size) lavori.push({ simbolo, file, gia, perGiorno });
  }
  const totGiorni = lavori.reduce((s, l) => s + l.perGiorno.size, 0);
  console.log(`${nAmb} operazioni ambigue, ${nTot} da coprire con i prezzi veri · ${totGiorni} giorni di aggTrades da scaricare`);
  let fatti = 0;
  const t0 = Date.now();
  await inParallelo(lavori, 4, async ({ simbolo, file, gia, perGiorno }) => {
    const giorni = [...perGiorno.keys()].sort((a, b) => a - b);
    const s = leggiStorico(simbolo, { da: giorni[0], a: giorni.at(-1) + GIORNO });
    for (const g of giorni) {
      const per = await prezziDelGiorno(simbolo, g, perGiorno.get(g));
      if (!per) { gia.giorniMancanti.push(data(g)); } else {
        for (const [m, prezzi] of per) {
          gia.visti.add(m);
          if (!prezzi.length) { gia.conta.mancanti++; continue; }
          const i = (m - s.t0) / MIN;
          let max = -Infinity, min = Infinity; // ciclo: un minuto può avere centinaia di migliaia di scambi
          for (const p of prezzi) { if (p > max) max = p; if (p < min) min = p; }
          gia.conta.minuti++;
          // il percorso vale solo se coincide con la candela (stessa fonte: gli scambi di Binance)
          if (Math.abs(max - s.high[i]) > 1e-9 * max || Math.abs(min - s.low[i]) > 1e-9 * min) { gia.conta.diversi++; continue; }
          gia.percorsi[m] = svolte(prezzi);
        }
        if (!gia.giorni.includes(g)) gia.giorni.push(g);
        writeFileSync(file, JSON.stringify({ ...gia, visti: [...gia.visti] })); // si riprende da qui se si interrompe
      }
      fatti++;
      if (fatti % 20 === 0) console.log(`  ${fatti}/${totGiorni} giorni (${Math.round((Date.now() - t0) / 1000)} s)`);
    }
    writeFileSync(file, JSON.stringify({ ...gia, visti: [...gia.visti] }));
  });
  const controllo = { minuti: 0, diversi: 0, mancanti: 0, giorniMancanti: [] };
  for (const chiave of voci) {
    const file = join(USCITA, `${chiave.slice(2)}.json`);
    if (!existsSync(file)) continue;
    const x = JSON.parse(readFileSync(file, 'utf8'));
    for (const k of ['minuti', 'diversi', 'mancanti']) controllo[k] += x.conta[k];
    controllo.giorniMancanti.push(...x.giorniMancanti.map(g => `${chiave.slice(2)} ${g}`));
  }
  writeFileSync(join(USCITA, 'controllo.json'), JSON.stringify({ creato: new Date().toISOString(), operazioniAmbigue: nAmb, operazioniCoperte: nTot, ...controllo }, null, 1));
  console.log(`Minuti con prezzi veri: ${controllo.minuti}, diversi dalla candela: ${controllo.diversi}, senza scambi: ${controllo.mancanti}, giorni non trovati: ${controllo.giorniMancanti.length}`);
}

if (isMainThread) main();

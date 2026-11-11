// Fase 0 · passo 1: universo delle crypto operabili.
// Legge le coppie di Bitunix e Binance, tiene i perpetual crypto in USDT presenti su entrambi
// e operabili via API, misura volume medio giornaliero e spread, scrive data/universo.json e docs/universo.md.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { getJson, creaLimitatore, inParallelo } from './lib/http.js';

const BITUNIX = 'https://fapi.bitunix.com/api/v1/futures/market';
const BINANCE = 'https://fapi.binance.com/fapi/v1';
const limBitunix = creaLimitatore(8);   // Bitunix ~10 req/s: restiamo a 8
const limBinance = creaLimitatore(5);   // Binance: abbondantemente sotto il limite di peso
const GIORNI = 30;

// Contratti solo su Bitunix che sono azioni/ETF/indici (controllati a mano: nessun campo "categoria" nell'API).
const NON_CRYPTO_SOLO_BITUNIX = new Set([
  'GAMESTOPUSDT', 'SHLDUSDT', 'CATERPILLARUSDT', 'PENGSTOCKUSDT', 'CSOPHLS2LUSDT', 'CSOPSX2LUSDT',
  'LGEUSDT', 'XIAOMIUSDT', 'PEPUSDT', 'FUTUUSDT', 'SHEINUSDT', 'QBTSUSDT', 'MDTUSUSDT', 'INFQUSDT',
]);

const num = x => (x === null || x === undefined || x === '' ? null : Number(x));

async function main() {
  // Con --solo-doc riscrive docs/universo.md dai dati già salvati, senza scaricare nulla
  if (process.argv.includes('--solo-doc')) return scriviDoc(JSON.parse(readFileSync('data/universo.json', 'utf8')));
  console.log('Leggo coppie e prezzi...');
  const [bxPairs, bxTick, bnInfo, bnTick] = await Promise.all([
    getJson(`${BITUNIX}/trading_pairs`, { limitatore: limBitunix }),
    getJson(`${BITUNIX}/tickers`, { limitatore: limBitunix }),
    getJson(`${BINANCE}/exchangeInfo`, { limitatore: limBinance }),
    getJson(`${BINANCE}/ticker/24hr`, { limitatore: limBinance }),
  ]);
  const tickBx = new Map(bxTick.data.map(t => [t.symbol, t]));
  const tickBn = new Map(bnTick.map(t => [t.symbol, t]));
  const bnPerSimbolo = new Map(bnInfo.symbols.map(s => [s.symbol, s]));
  const bnCrypto = s => s && s.contractType === 'PERPETUAL' && s.quoteAsset === 'USDT' && s.underlyingType === 'COIN';

  const usdt = bxPairs.data.filter(p => p.quote === 'USDT');
  const conteggi = {
    totaleBitunix: bxPairs.data.length,
    usdt: usdt.length,
    nonCrypto: 0, nonCryptoApi: 0,
    crypto: 0, cryptoApi: 0, cryptoNoApi: 0, cryptoPreview: 0,
    cryptoApiAncheBinance: 0, cryptoApiSoloBitunix: 0, scartatiPrezzoDiverso: [], binanceNonAttivo: [],
  };
  const candidati = [];
  for (const p of usdt) {
    const bn = bnPerSimbolo.get(p.symbol);
    const nonCrypto = (bn && !bnCrypto(bn)) || NON_CRYPTO_SOLO_BITUNIX.has(p.symbol);
    if (nonCrypto) { conteggi.nonCrypto++; if (p.isApiSupported) conteggi.nonCryptoApi++; continue; }
    if (p.symbolStatus !== 'OPEN') { conteggi.cryptoPreview++; continue; }
    conteggi.crypto++;
    if (!p.isApiSupported) { conteggi.cryptoNoApi++; continue; }
    conteggi.cryptoApi++;
    if (!bnCrypto(bn)) { conteggi.cryptoApiSoloBitunix++; continue; }
    if (bn.status !== 'TRADING') { conteggi.binanceNonAttivo.push(p.symbol); continue; }
    // Stesso nome ma moneta diversa? Controllo che i prezzi coincidano entro il 3%.
    const pBx = num(tickBx.get(p.symbol)?.lastPrice), pBn = num(tickBn.get(p.symbol)?.lastPrice);
    if (!pBx || !pBn || Math.abs(pBx / pBn - 1) > 0.03) { conteggi.scartatiPrezzoDiverso.push(`${p.symbol} (${pBx} vs ${pBn})`); continue; }
    conteggi.cryptoApiAncheBinance++;
    const tick = bn.filters.find(f => f.filterType === 'PRICE_FILTER')?.tickSize;
    candidati.push({
      simbolo: p.symbol, base: p.base, prezzo: pBx,
      levaMax: p.maxLeverage, quantitaMin: num(p.minTradeVolume),
      precisioneQuantita: p.basePrecision, precisionePrezzo: p.quotePrecision,
      ordineMercatoMax: num(p.maxMarketOrderVolume),
      quotazioneBitunix: num(p.launchTime), quotazioneBinance: bn.onboardDate,
      tickBinance: num(tick),
    });
  }
  console.log(`Candidati: ${candidati.length}. Scarico ${GIORNI} giorni di volumi...`);

  const giornoUtc = Math.floor(Date.now() / 86400000) * 86400000; // inizio del giorno in corso (escluso)
  await inParallelo(candidati, 4, async c => {
    const [kBx, kBn] = await Promise.all([
      getJson(`${BITUNIX}/kline?symbol=${c.simbolo}&interval=1d&limit=${GIORNI + 2}`, { limitatore: limBitunix }),
      getJson(`${BINANCE}/klines?symbol=${c.simbolo}&interval=1d&limit=${GIORNI + 2}`, { limitatore: limBinance }),
    ]);
    const bx = (kBx?.data || []).filter(k => +k.time < giornoUtc).sort((a, b) => b.time - a.time).slice(0, GIORNI);
    const bn = (kBn || []).filter(k => k[0] < giornoUtc).sort((a, b) => b[0] - a[0]).slice(0, GIORNI);
    c.giorniBitunix = bx.length; c.giorniBinance = bn.length;
    c.volMedioBitunix = bx.length ? bx.reduce((s, k) => s + Number(k.quoteVol), 0) / bx.length : 0;
    c.volMedioBinance = bn.length ? bn.reduce((s, k) => s + Number(k[7]), 0) / bn.length : 0;
  });
  candidati.sort((a, b) => b.volMedioBitunix - a.volMedioBitunix);

  // Spread: 3 fotografie del book a 2 minuti di distanza, sui primi 100.
  const primi = candidati.slice(0, 100);
  const FOTO = 3;
  for (let f = 0; f < FOTO; f++) {
    if (f > 0) { console.log('Attendo 2 minuti per la prossima fotografia del book...'); await new Promise(r => setTimeout(r, 120000)); }
    console.log(`Fotografia del book ${f + 1}/${FOTO}...`);
    await inParallelo(primi, 4, async c => {
      const d = await getJson(`${BITUNIX}/depth?symbol=${c.simbolo}&limit=50`, { limitatore: limBitunix });
      const asks = d?.data?.asks || [], bids = d?.data?.bids || [];
      if (!asks.length || !bids.length) return;
      const ask = +asks[0][0], bid = +bids[0][0], mid = (ask + bid) / 2;
      // USDT disponibili entro lo 0,1% dal prezzo medio, per lato (il più piccolo dei due)
      const entro = (righe, ok) => righe.filter(r => ok(+r[0])).reduce((s, r) => s + r[0] * r[1], 0);
      const prof = Math.min(entro(asks, p => p <= mid * 1.001), entro(bids, p => p >= mid * 0.999));
      (c._spread ||= []).push((ask - bid) / mid * 10000);
      (c._prof ||= []).push(prof);
    });
  }
  const mediana = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  for (const c of primi) {
    if (c._spread) { c.spreadBps = mediana(c._spread); c.profondita01 = mediana(c._prof); }
    delete c._spread; delete c._prof;
  }

  // Funding attuale Bitunix vs Binance sui primi 50 (una sola fotografia)
  const bnPremium = await getJson(`${BINANCE}/premiumIndex`, { limitatore: limBinance });
  const fundBn = new Map(bnPremium.map(x => [x.symbol, Number(x.lastFundingRate) * 100]));
  await inParallelo(candidati.slice(0, 50), 4, async c => {
    const d = await getJson(`${BITUNIX}/funding_rate?symbol=${c.simbolo}`, { limitatore: limBitunix });
    c.fundingBitunixAttuale = num(d?.data?.fundingRate); // in percento
    c.intervalloFundingBitunix = d?.data?.fundingInterval;
    c.fundingBinanceAttuale = fundBn.get(c.simbolo) ?? null; // in percento
  });

  mkdirSync('data', { recursive: true });
  const out = { creato: new Date().toISOString(), giorniVolume: GIORNI, conteggi, candidati };
  writeFileSync('data/universo.json', JSON.stringify(out, null, 1));
  scriviDoc(out);
  console.log('Fatto: data/universo.json e docs/universo.md');
}

const mln = x => (x / 1e6).toLocaleString('it-IT', { maximumFractionDigits: x >= 1e8 ? 0 : 1, useGrouping: 'always' });
const fmt = (x, d = 2) => x === null || x === undefined || Number.isNaN(x) ? '–' : x.toLocaleString('it-IT', { maximumFractionDigits: d, useGrouping: 'always' });
const giorno = ms => new Date(ms).toISOString().slice(0, 10);

function scriviDoc({ creato, conteggi: k, candidati, giorniVolume }) {
  const top = candidati.slice(0, 50);
  const volTop = top.reduce((s, c) => s + c.volMedioBitunix, 0);
  const volTutti = candidati.reduce((s, c) => s + c.volMedioBitunix, 0);
  const righe = top.map((c, i) => `| ${i + 1} | ${c.simbolo} | ${mln(c.volMedioBitunix)} | ${mln(c.volMedioBinance)} | ${fmt(c.volMedioBitunix / c.volMedioBinance * 100, 0)}% | ${c.levaMax}x | ${c.quantitaMin} | ${c.precisioneQuantita} / ${c.precisionePrezzo} | ${fmt(c.spreadBps, c.spreadBps < 0.5 ? 2 : 1)} | ${c.profondita01 != null ? fmt(c.profondita01 / 1000, 0) : '–'} | ${giorno(c.quotazioneBinance)} |`);
  const altri = candidati.slice(50, 100).map((c, i) => `${i + 51}. ${c.simbolo} — ${mln(c.volMedioBitunix)} mln/giorno, spread ${fmt(c.spreadBps, c.spreadBps < 0.5 ? 2 : 1)} pb`);
  const extra = [];
  if (k.binanceNonAttivo.length) extra.push(`${k.binanceNonAttivo.length} su Binance è in chiusura o già chiuso (${k.binanceNonAttivo.join(', ')})`);
  if (k.scartatiPrezzoDiverso.length) extra.push(`${k.scartatiPrezzoDiverso.length} hanno lo stesso nome ma prezzo diverso, quindi non sono la stessa moneta (${k.scartatiPrezzoDiverso.join(', ')})`);
  const md = `# Universo delle crypto operabili

Aggiornato il ${creato.slice(0, 10)}. Script: \`research/01-universo.js\`. Dati completi: \`data/universo.json\` (non su GitHub).

## In breve
- Bitunix ha **${k.totaleBitunix} contratti**, di cui **${k.usdt} in USDT**.
- Di questi, **${k.nonCrypto} non sono crypto** (azioni, ETF, materie prime, indici): esclusi. ${k.nonCryptoApi} di loro sarebbero comunque operabili via API.
- Restano **${k.crypto} perpetual crypto in USDT attivi** (più ${k.cryptoPreview} ancora in anteprima, non negoziabili):
  - **${k.cryptoApi} operabili via API** (\`isApiSupported = true\`)
  - **${k.cryptoNoApi} non operabili via API**
- Dei ${k.cryptoApi} operabili via API, **${k.cryptoApiAncheBinance} esistono anche su Binance** (perpetual USDT-M attivo, stesso prezzo). ${k.cryptoApiSoloBitunix} sono solo su Bitunix${extra.length ? '; ' + extra.join('; ') : ''}.
- I primi 50 fanno il **${fmt(volTop / volTutti * 100, 0)}%** del volume Bitunix dei ${candidati.length} contratti utilizzabili: la liquidità è molto concentrata.

## Come leggere la tabella
- **Volume**: media giornaliera in milioni di USDT sugli ultimi ${giorniVolume} giorni completi (candele giornaliere).
- **Bitunix/Binance**: quanto è grande il volume di Bitunix rispetto a quello di Binance.
- **Q.min**: quantità minima d'ordine in unità della moneta. **Precisione**: decimali di quantità / prezzo.
- **Spread**: differenza tra miglior acquisto e miglior vendita su Bitunix, in punti base (1 pb = 0,01%), mediana di 3 fotografie del book a 2 minuti di distanza. È una stima istantanea, non una media storica.
- **Prof. 0,1%**: migliaia di USDT disponibili nel book entro lo 0,1% dal prezzo medio (il lato più sottile). Indica quanto si può comprare o vendere a mercato senza spostare il prezzo di più dello 0,1%. È una fotografia: prenderla come ordine di grandezza.
- **Su Binance dal**: data di quotazione su Binance, quindi inizio dello storico disponibile.

## Le prime 50 per liquidità su Bitunix

| # | Simbolo | Vol. Bitunix (mln) | Vol. Binance (mln) | Bitunix/Binance | Leva max | Q.min | Precisione | Spread (pb) | Prof. 0,1% (mila USDT) | Su Binance dal |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|---|
${righe.join('\n')}

## Dalla 51ª alla 100ª
${altri.join('\n')}

## Note
- Bitunix non dà una "categoria" per i contratti: le azioni e gli ETF sono riconosciuti incrociando con Binance (che li marca come TradFi) e, per quelli solo su Bitunix, controllandoli a mano.
- Con spread di un tick (BTC, ETH, ecc.) il costo vero è commissione più slittamento; sulle monete più piccole anche lo spread pesa.
- Il funding di Bitunix e quello di Binance non sono identici. Nei backtest si userà lo storico di Binance: vedi \`docs/bitunix-vs-binance.md\`.
`;
  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/universo.md', md);
}

main().catch(e => { console.error(e); process.exit(1); });

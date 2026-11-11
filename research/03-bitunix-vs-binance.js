// Fase 0 · passo 3: confronto minuto per minuto Bitunix contro Binance.
// Scarica le candele da 1 minuto delle ultime 3 settimane da entrambe le borse (stesse 50 crypto
// di data/universo.json), confronta prezzi e movimenti, confronta il funding degli ultimi 90 giorni.
// Scrive la parte con i numeri di docs/bitunix-vs-binance.md (tra i segnaposto <!-- dati:... -->).
//
// Uso: node research/03-bitunix-vs-binance.js [giorni=21] [quanti=50]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getJson, creaLimitatore, inParallelo } from './lib/http.js';

const BITUNIX = 'https://fapi.bitunix.com/api/v1/futures/market';
const BINANCE = 'https://fapi.binance.com/fapi/v1';
const limBitunix = creaLimitatore(8);
const limBinance = creaLimitatore(2); // klines da 1500 pesano 10: resto lontano dal limite di 2400 al minuto
const GIORNI = Number(process.argv[2] || 21);
const QUANTI = Number(process.argv[3] || 50);
const MIN = 60000;
const CARTELLA = join('data', 'confronto');

const FINE = Math.floor(Date.now() / MIN) * MIN - MIN; // ultimo minuto sicuramente chiuso (escluso)
const INIZIO = FINE - GIORNI * 1440 * MIN;
const N = (FINE - INIZIO) / MIN;

// Griglia: per ogni minuto o, h, l, c, volume in USDT (NaN se manca)
const griglia = () => ({ o: new Float64Array(N).fill(NaN), h: new Float64Array(N).fill(NaN), l: new Float64Array(N).fill(NaN), c: new Float64Array(N).fill(NaN), v: new Float64Array(N).fill(NaN) });

async function candeleBitunix(simbolo) {
  const g = griglia();
  let fine = FINE; // su Bitunix endTime è escluso: la candela con time = endTime non viene restituita
  while (fine > INIZIO) {
    const r = await getJson(`${BITUNIX}/kline?symbol=${simbolo}&interval=1m&limit=200&endTime=${fine}`, { limitatore: limBitunix });
    const d = r?.data || [];
    if (!d.length) break;
    let piuVecchio = Infinity;
    for (const k of d) {
      const t = Number(k.time); piuVecchio = Math.min(piuVecchio, t);
      const i = (t - INIZIO) / MIN;
      if (i < 0 || i >= N) continue;
      g.o[i] = +k.open; g.h[i] = +k.high; g.l[i] = +k.low; g.c[i] = +k.close; g.v[i] = +k.quoteVol;
    }
    if (piuVecchio >= fine) break; // nessun progresso
    fine = piuVecchio;
  }
  return g;
}

async function candeleBinance(simbolo) {
  const g = griglia();
  for (let t = INIZIO; t < FINE; t += 1500 * MIN) {
    const r = await getJson(`${BINANCE}/klines?symbol=${simbolo}&interval=1m&startTime=${t}&endTime=${Math.min(FINE, t + 1500 * MIN) - 1}&limit=1500`, { limitatore: limBinance });
    for (const k of r || []) {
      const i = (k[0] - INIZIO) / MIN;
      if (i < 0 || i >= N) continue;
      g.o[i] = +k[1]; g.h[i] = +k[2]; g.l[i] = +k[3]; g.c[i] = +k[4]; g.v[i] = +k[7];
    }
  }
  return g;
}

async function fundingBitunix(simbolo, da) {
  const out = [];
  let fine = Date.now();
  for (let p = 0; p < 10; p++) {
    const r = await getJson(`${BITUNIX}/get_funding_rate_history?symbol=${simbolo}&limit=200&endTime=${fine}`, { limitatore: limBitunix });
    const d = r?.data || [];
    if (!d.length) break;
    for (const x of d) out.push([Number(x.fundingTime), Number(x.fundingRate)]);
    const vecchio = Math.min(...d.map(x => Number(x.fundingTime)));
    if (vecchio <= da || vecchio >= fine) break;
    fine = vecchio - 1;
  }
  return out.filter(x => x[0] >= da).sort((a, b) => a[0] - b[0]);
}

async function fundingBinance(simbolo, da) {
  const r = await getJson(`${BINANCE}/fundingRate?symbol=${simbolo}&startTime=${da}&limit=1000`, { limitatore: limBinance });
  return (r || []).map(x => [Math.round(x.fundingTime / MIN) * MIN, Number(x.fundingRate)]);
}

const quantile = (arr, q) => { if (!arr.length) return NaN; const s = Float64Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const media = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
function correlazione(x, y) {
  const mx = media(x), my = media(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxy / Math.sqrt(sxx * syy);
}

function confronta(bx, bn) {
  const r = { minuti: N, soloBinance: 0, soloBitunix: 0, nessuno: 0, comuni: 0 };
  const dc = [], dcSegno = [], dOpen = [], dHigh = [], dLow = [], rBx = [], rBn = [], rBxPrima = [], rBnPrima = [];
  let volBx = 0, volBn = 0;
  // Movimenti dell'1% da chiusura a chiusura e "tocchi" dell'1% dentro il minuto
  const mosse = { bnSu1: 0, bnSu1VistoBx: 0, bnSu1VistoBxMeta: 0, bxSu1: 0, bxSu1VistoBn: 0, bxSu1VistoBnMeta: 0, tocchiBn: 0, tocchiBnAncheBx: 0, tocchiBx: 0, tocchiBxAncheBn: 0, codeBx: 0, codeBn: 0 };
  for (let i = 0; i < N; i++) {
    const okX = !Number.isNaN(bx.c[i]), okN = !Number.isNaN(bn.c[i]);
    if (okX && okN) r.comuni++; else if (okX) r.soloBitunix++; else if (okN) r.soloBinance++; else r.nessuno++;
    if (!okX || !okN) continue;
    volBx += bx.v[i]; volBn += bn.v[i];
    const d = (bx.c[i] / bn.c[i] - 1) * 1e4;
    dc.push(Math.abs(d)); dcSegno.push(d);
    dOpen.push(Math.abs(bx.o[i] / bn.o[i] - 1) * 1e4);
    dHigh.push(Math.abs(bx.h[i] / bn.h[i] - 1) * 1e4);
    dLow.push(Math.abs(bx.l[i] / bn.l[i] - 1) * 1e4);
    // Code anomale: il massimo o il minimo di una borsa va oltre quello dell'altra di più dello 0,3%
    if (bx.h[i] > bn.h[i] * 1.003 || bx.l[i] < bn.l[i] * 0.997) mosse.codeBx++;
    if (bn.h[i] > bx.h[i] * 1.003 || bn.l[i] < bx.l[i] * 0.997) mosse.codeBn++;
    if (i === 0 || Number.isNaN(bx.c[i - 1]) || Number.isNaN(bn.c[i - 1])) continue;
    const ax = bx.c[i] / bx.c[i - 1] - 1, an = bn.c[i] / bn.c[i - 1] - 1;
    rBx.push(ax); rBn.push(an);
    if (i >= 2 && !Number.isNaN(bx.c[i - 2]) && !Number.isNaN(bn.c[i - 2])) {
      rBxPrima.push(bx.c[i - 1] / bx.c[i - 2] - 1); rBnPrima.push(bn.c[i - 1] / bn.c[i - 2] - 1);
    }
    if (Math.abs(an) >= 0.01) {
      mosse.bnSu1++;
      if (Math.sign(ax) === Math.sign(an) && Math.abs(ax) >= 0.01) mosse.bnSu1VistoBx++;
      if (Math.sign(ax) === Math.sign(an) && Math.abs(ax) >= 0.005) mosse.bnSu1VistoBxMeta++;
    }
    if (Math.abs(ax) >= 0.01) {
      mosse.bxSu1++;
      if (Math.sign(ax) === Math.sign(an) && Math.abs(an) >= 0.01) mosse.bxSu1VistoBn++;
      if (Math.sign(ax) === Math.sign(an) && Math.abs(an) >= 0.005) mosse.bxSu1VistoBnMeta++;
    }
    // Tocco: dentro il minuto il prezzo arriva a ±1% dalla chiusura precedente (come uno stop o un ingresso a rottura)
    for (const lato of [1, -1]) {
      const tn = lato > 0 ? bn.h[i] >= bn.c[i - 1] * 1.01 : bn.l[i] <= bn.c[i - 1] * 0.99;
      const tx = lato > 0 ? bx.h[i] >= bx.c[i - 1] * 1.01 : bx.l[i] <= bx.c[i - 1] * 0.99;
      if (tn) { mosse.tocchiBn++; if (tx) mosse.tocchiBnAncheBx++; }
      if (tx) { mosse.tocchiBx++; if (tn) mosse.tocchiBxAncheBn++; }
    }
  }
  Object.assign(r, {
    diffChiusuraMediaPb: media(dc), diffChiusuraMedianaPb: quantile(dc, 0.5), diffChiusuraP99Pb: quantile(dc, 0.99), diffChiusuraMaxPb: dc.length ? Math.max(...dc) : NaN,
    scartoMedioConSegnoPb: media(dcSegno), diffAperturaMediaPb: media(dOpen), diffMassimoMediaPb: media(dHigh), diffMinimoMediaPb: media(dLow),
    correlazioneRendimenti: correlazione(rBx, rBn),
    // Bitunix in ritardo? correlazione del rendimento Bitunix del minuto con quello Binance del minuto prima
    corrBitunixDopoBinance: rBxPrima.length ? correlazione(rBx.slice(-rBnPrima.length), rBnPrima) : NaN,
    corrBinanceDopoBitunix: rBnPrima.length ? correlazione(rBn.slice(-rBxPrima.length), rBxPrima) : NaN,
    volatilitaBx: Math.sqrt(media(rBx.map(x => x * x))), volatilitaBn: Math.sqrt(media(rBn.map(x => x * x))),
    rapportoVolume: volBx / volBn, mosse,
  });
  return r;
}

function confrontaFunding(fx, fn) {
  const mappa = new Map(fn.map(([t, v]) => [Math.round(t / 3600000), v]));
  const coppie = [];
  for (const [t, v] of fx) { const w = mappa.get(Math.round(t / 3600000)); if (w !== undefined) coppie.push([v, w]); }
  return {
    pagamentiBitunix: fx.length, pagamentiBinance: fn.length, coppie: coppie.length,
    sommaBitunix: fx.reduce((s, x) => s + x[1], 0), sommaBinance: fn.reduce((s, x) => s + x[1], 0),
    diffMediaAssoluta: media(coppie.map(([a, b]) => Math.abs(a - b))),
    stessoSegno: coppie.length ? coppie.filter(([a, b]) => Math.sign(a) === Math.sign(b) || (Math.abs(a) < 2e-5 && Math.abs(b) < 2e-5)).length / coppie.length : NaN,
  };
}

async function main() {
  const universo = JSON.parse(readFileSync('data/universo.json', 'utf8'));
  const lista = universo.candidati.slice(0, QUANTI).map(c => c.simbolo);
  mkdirSync(CARTELLA, { recursive: true });
  console.log(`Confronto ${lista.length} simboli, ${GIORNI} giorni: ${new Date(INIZIO).toISOString()} → ${new Date(FINE).toISOString()}`);
  const daFunding = Date.now() - 90 * 86400000;
  const risultati = {};
  let fatti = 0;
  await inParallelo(lista, 4, async s => {
    const [bx, bn, fx, fn] = await Promise.all([candeleBitunix(s), candeleBinance(s), fundingBitunix(s, daFunding), fundingBinance(s, daFunding)]);
    // Salvo i dati grezzi per eventuali altre analisi
    const comp = g => Object.fromEntries(Object.entries(g).map(([k, a]) => [k, Array.from(a, x => Number.isNaN(x) ? null : x)]));
    writeFileSync(join(CARTELLA, `${s}.json`), JSON.stringify({ inizio: INIZIO, minuti: N, bitunix: comp(bx), binance: comp(bn), fundingBitunix: fx, fundingBinance: fn }));
    risultati[s] = { ...confronta(bx, bn), funding: confrontaFunding(fx, fn) };
    console.log(`  ${++fatti}/${lista.length} ${s}: diff media ${risultati[s].diffChiusuraMediaPb.toFixed(2)} pb, comuni ${risultati[s].comuni}/${N}`);
  });
  const out = { creato: new Date().toISOString(), inizio: INIZIO, fine: FINE, giorni: GIORNI, simboli: lista, risultati };
  writeFileSync(join(CARTELLA, 'risultati.json'), JSON.stringify(out, null, 1));
  scriviDoc(out);
  console.log('Fatto: data/confronto/ e docs/bitunix-vs-binance.md');
}

const f = (x, d = 1) => x === null || x === undefined || Number.isNaN(x) ? '–' : x.toLocaleString('it-IT', { maximumFractionDigits: d, minimumFractionDigits: d, useGrouping: 'always' });
const pc = (a, b) => (b ? f(a / b * 100, 0) + '%' : '–');

function scriviDoc({ creato, inizio, fine, giorni, simboli, risultati }) {
  const R = simboli.map(s => [s, risultati[s]]);
  const tot = k => R.reduce((s, [, r]) => s + r.mosse[k], 0);
  const sommaComuni = R.reduce((s, [, r]) => s + r.comuni, 0);
  const mediaPesata = k => R.reduce((s, [, r]) => s + r[k] * r.comuni, 0) / sommaComuni;
  const righe = R.map(([s, r]) => `| ${s} | ${pc(r.comuni, r.minuti)} | ${f(r.diffChiusuraMediaPb)} | ${f(r.diffChiusuraMedianaPb)} | ${f(r.diffChiusuraP99Pb)} | ${f(r.diffChiusuraMaxPb, 0)} | ${f(r.scartoMedioConSegnoPb)} | ${f(r.correlazioneRendimenti, 3)} | ${r.mosse.bnSu1} | ${r.mosse.bnSu1 ? pc(r.mosse.bnSu1VistoBx, r.mosse.bnSu1) : '–'} | ${r.mosse.tocchiBn ? pc(r.mosse.tocchiBnAncheBx, r.mosse.tocchiBn) : '–'} | ${r.mosse.tocchiBx ? pc(r.mosse.tocchiBxAncheBn, r.mosse.tocchiBx) : '–'} | ${f(r.mosse.codeBx / r.comuni * 1e4, 1)} |`);
  const righeF = R.map(([s, r]) => `| ${s} | ${r.funding.coppie} | ${f(r.funding.sommaBitunix * 100, 3)}% | ${f(r.funding.sommaBinance * 100, 3)}% | ${f(r.funding.diffMediaAssoluta * 100, 4)}% | ${pc(r.funding.stessoSegno * r.funding.coppie, r.funding.coppie)} |`);
  const dati = `<!-- dati:inizio -->
_Numeri generati da \`research/03-bitunix-vs-binance.js\` il ${creato.slice(0, 10)}. Periodo: ${giorni} giorni, dal ${new Date(inizio).toISOString().slice(0, 16).replace('T', ' ')} al ${new Date(fine).toISOString().slice(0, 16).replace('T', ' ')} UTC, ${simboli.length} crypto._

### Totale delle ${simboli.length} crypto
- Minuti presenti su entrambe: **${pc(sommaComuni, R.reduce((s, [, r]) => s + r.minuti, 0))}** (solo su Binance: ${R.reduce((s, [, r]) => s + r.soloBinance, 0)}, solo su Bitunix: ${R.reduce((s, [, r]) => s + r.soloBitunix, 0)}).
- Differenza media delle chiusure: **${f(mediaPesata('diffChiusuraMediaPb'), 2)} pb** (punti base: 1 pb = 0,01%). Apertura ${f(mediaPesata('diffAperturaMediaPb'), 2)} pb, massimo ${f(mediaPesata('diffMassimoMediaPb'), 2)} pb, minimo ${f(mediaPesata('diffMinimoMediaPb'), 2)} pb.
- Correlazione media dei rendimenti a 1 minuto: **${f(mediaPesata('correlazioneRendimenti'), 3)}**. Bitunix rispetto a Binance del minuto prima: ${f(mediaPesata('corrBitunixDopoBinance'), 3)}; Binance rispetto a Bitunix del minuto prima: ${f(mediaPesata('corrBinanceDopoBitunix'), 3)}.
- Movimenti dell'1% da chiusura a chiusura su Binance: **${tot('bnSu1')}**. Visti anche su Bitunix nello stesso minuto, stessa direzione, almeno 1%: **${pc(tot('bnSu1VistoBx'), tot('bnSu1'))}**; almeno 0,5%: ${pc(tot('bnSu1VistoBxMeta'), tot('bnSu1'))}.
- Al contrario, movimenti dell'1% su Bitunix: ${tot('bxSu1')}; visti su Binance (≥1%): ${pc(tot('bxSu1VistoBn'), tot('bxSu1'))}; (≥0,5%): ${pc(tot('bxSu1VistoBnMeta'), tot('bxSu1'))}.
- "Tocchi" dell'1% dentro il minuto (il massimo o il minimo arriva a ±1% dalla chiusura precedente, come uno stop o un ingresso a rottura): su Binance ${tot('tocchiBn')}, toccati anche su Bitunix **${pc(tot('tocchiBnAncheBx'), tot('tocchiBn'))}**; su Bitunix ${tot('tocchiBx')}, toccati anche su Binance ${pc(tot('tocchiBxAncheBn'), tot('tocchiBx'))}.
- Minuti con una "coda" solo su Bitunix (massimo o minimo oltre quello di Binance di più dello 0,3%): ${tot('codeBx')} su ${f(sommaComuni, 0)} (${f(tot('codeBx') / sommaComuni * 1e4, 2)} ogni 10.000 minuti). Solo su Binance: ${tot('codeBn')}.

### Per crypto
Colonne: **Copertura** = minuti presenti su entrambe; **Diff.** = differenza assoluta delle chiusure in pb (media, mediana, 99° percentile, massima); **Scarto** = media con segno (positivo = Bitunix più caro); **Corr.** = correlazione dei rendimenti a 1 minuto; **Mosse 1%** = movimenti ≥1% su Binance e quota vista anche su Bitunix (≥1%, stessa direzione); **Tocchi** = tocchi dell'1% su Binance visti anche su Bitunix, e viceversa; **Code Bx** = code solo-Bitunix oltre 0,3% ogni 10.000 minuti.

| Simbolo | Copertura | Diff. media | Mediana | 99° perc. | Max | Scarto | Corr. | Mosse 1% Bn | Viste su Bx | Tocchi Bn→Bx | Tocchi Bx→Bn | Code Bx |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${righe.join('\n')}

### Funding degli ultimi 90 giorni
Somma dei tassi pagati (positivo = i long pagano gli short), differenza media per pagamento e quota di pagamenti con lo stesso segno.

| Simbolo | Pagamenti confrontati | Somma Bitunix | Somma Binance | Diff. media | Stesso segno |
|---|---:|---:|---:|---:|---:|
${righeF.join('\n')}
<!-- dati:fine -->`;
  const file = 'docs/bitunix-vs-binance.md';
  let doc = existsSync(file) ? readFileSync(file, 'utf8') : `# Bitunix contro Binance\n\n## Conclusione\n(da scrivere)\n\n## I numeri\n<!-- dati:inizio -->\n<!-- dati:fine -->\n`;
  doc = doc.replace(/<!-- dati:inizio -->[\s\S]*<!-- dati:fine -->/, dati);
  writeFileSync(file, doc);
}

main().catch(e => { console.error(e); process.exit(1); });

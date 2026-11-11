// Fase 0 · passo 2: storico Binance per le prime 50 crypto di data/universo.json.
// Candele da 1 minuto dei perpetual USDT-M da data.binance.vision (dal 1/1/2023 o dalla quotazione)
// più lo storico del funding. Salva nel formato di research/lib/storico.js e annota buchi e candele mancanti.
//
// Uso: node research/02-scarica-storico.js [quanti=50]
// Si può rilanciare: i mesi completi già scaricati e verificati vengono saltati.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { getBuffer, getJson, creaLimitatore, inParallelo } from './lib/http.js';
import { estraiPrimoFile } from './lib/zip.js';
import {
  CARTELLA, nuovaGriglia, scriviMese, fileMese, meseChiave, inizioMese, minutiNelMese, leggiStorico,
} from './lib/storico.js';

const VISION = 'https://data.binance.vision/data/futures/um';
const BINANCE = 'https://fapi.binance.com/fapi/v1';
const INIZIO = Date.UTC(2023, 0, 1);
const MIN = 60000, GIORNO = 86400000;
const limVision = creaLimitatore(20);
const limBinance = creaLimitatore(3); // klines da 1500 pesano 10: 3/s = 1800 di peso al minuto, sotto il limite di 2400
const QUANTI = Number(process.argv[2] || 50);

const OGGI = Math.floor(Date.now() / GIORNO) * GIORNO; // mezzanotte UTC di oggi: si scarica fino a ieri compreso
const MANIFESTO = join(CARTELLA, 'manifesto.json');
const manifesto = existsSync(MANIFESTO) ? JSON.parse(readFileSync(MANIFESTO, 'utf8')) : {};
const salvaManifesto = () => writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 1));

// Scarica uno zip e lo verifica con il suo .CHECKSUM (sha256). null se il file non esiste.
async function scaricaZipVerificato(url) {
  const zip = await getBuffer(url, { limitatore: limVision });
  if (!zip) return null;
  const chk = await getBuffer(url + '.CHECKSUM', { limitatore: limVision });
  if (chk) {
    const atteso = chk.toString().trim().split(/\s+/)[0];
    const reale = createHash('sha256').update(zip).digest('hex');
    if (atteso !== reale) throw new Error(`checksum diverso per ${url}`);
  }
  return estraiPrimoFile(zip).toString('utf8');
}

// Riempie la griglia con le righe del CSV delle candele. Restituisce statistiche.
function caricaCsvCandele(csv, g, t0) {
  const st = { righe: 0, fuoriGriglia: 0, doppie: 0 };
  const visto = new Uint8Array(g.n);
  for (const riga of csv.split('\n')) {
    if (!riga || riga.charCodeAt(0) > 57) continue; // vuota o intestazione
    const c = riga.split(',');
    let t = Number(c[0]);
    if (t > 1e14) t = Math.floor(t / 1000); // per sicurezza, se fossero microsecondi
    const i = (t - t0) / MIN;
    if (!Number.isInteger(i) || i < 0 || i >= g.n) { st.fuoriGriglia++; continue; }
    if (visto[i]) st.doppie++;
    visto[i] = 1; st.righe++;
    g.open[i] = +c[1]; g.high[i] = +c[2]; g.low[i] = +c[3]; g.close[i] = +c[4];
    g.volume[i] = +c[5]; g.quoteVolume[i] = +c[7]; g.trades[i] = +c[8]; g.takerBuyQuote[i] = +c[10];
  }
  return st;
}

function mesiDa(t) {
  const mesi = [];
  const d = new Date(t);
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  while (inizioMese(y, m) < OGGI) { mesi.push([y, m]); if (++m > 12) { m = 1; y++; } }
  return mesi;
}

async function scaricaMeseCandele(simbolo, y, m) {
  const chiave = meseChiave(y, m);
  const t0 = inizioMese(y, m);
  const fineMese = Date.UTC(y, m, 1);
  const completo = fineMese <= OGGI;
  const voce = manifesto[simbolo]?.mesi?.[chiave];
  if (completo && voce?.completo && existsSync(fileMese(simbolo, chiave))) return voce;

  const n = completo ? minutiNelMese(y, m) : (OGGI - t0) / MIN;
  const g = nuovaGriglia(n);
  const st = { righe: 0, fuoriGriglia: 0, doppie: 0, fonte: 'mensile', giorniMancanti: [] };
  const csv = completo ? await scaricaZipVerificato(`${VISION}/monthly/klines/${simbolo}/1m/${simbolo}-1m-${chiave}.zip`) : null;
  if (csv) {
    Object.assign(st, caricaCsvCandele(csv, g, t0));
  } else {
    // Mese in corso (o mensile non ancora pubblicato): file giornalieri
    st.fonte = 'giornaliero';
    for (let t = t0; t < Math.min(fineMese, OGGI); t += GIORNO) {
      const giorno = new Date(t).toISOString().slice(0, 10);
      const c = await scaricaZipVerificato(`${VISION}/daily/klines/${simbolo}/1m/${simbolo}-1m-${giorno}.zip`);
      if (!c) { st.giorniMancanti.push(giorno); continue; }
      const s = caricaCsvCandele(c, g, t0);
      st.righe += s.righe; st.fuoriGriglia += s.fuoriGriglia; st.doppie += s.doppie;
    }
  }
  // Recupero dei buchi: a volte il file mensile non contiene giorni interi che esistono nei file giornalieri,
  // e i singoli minuti mancanti a volte ci sono nell'API. Si recupera solo dopo la quotazione.
  const quot = manifesto[simbolo].quotazioneBinance || 0;
  const iMin = Math.max(0, Math.ceil((quot - t0) / MIN));
  const mancantiPerGiorno = new Map();
  for (let i = iMin; i < n; i++) if (Number.isNaN(g.close[i])) { const d = Math.floor(i / 1440); mancantiPerGiorno.set(d, (mancantiPerGiorno.get(d) || 0) + 1); }
  if (st.fonte === 'mensile') {
    for (const [d, k] of mancantiPerGiorno) {
      if (k < 60) continue;
      const giorno = new Date(t0 + d * GIORNO).toISOString().slice(0, 10);
      const c = await scaricaZipVerificato(`${VISION}/daily/klines/${simbolo}/1m/${simbolo}-1m-${giorno}.zip`);
      if (!c) continue;
      const prima = st.righe;
      // Carico solo i minuti mancanti, senza toccare quelli già presenti
      const tmp = nuovaGriglia(n);
      caricaCsvCandele(c, tmp, t0);
      for (let i = d * 1440; i < Math.min(n, (d + 1) * 1440); i++) if (Number.isNaN(g.close[i]) && !Number.isNaN(tmp.close[i])) {
        for (const col of ['open', 'high', 'low', 'close', 'volume', 'quoteVolume', 'trades', 'takerBuyQuote']) g[col][i] = tmp[col][i];
        st.righe++;
      }
      if (st.righe > prima) (st.giorniRecuperati ||= []).push(giorno);
    }
  }
  // Minuti ancora mancanti: tentativo con l'API (al massimo 30 richieste per mese)
  const intervalli = [];
  for (let i = iMin, ini = -1; i <= n; i++) {
    const manca = i < n && Number.isNaN(g.close[i]);
    if (manca && ini < 0) ini = i;
    if (!manca && ini >= 0) { intervalli.push([ini, i]); ini = -1; }
  }
  let richieste = 0;
  for (const [a, b] of intervalli) {
    for (let s = a; s < b && richieste < 30; s += 1500) {
      richieste++;
      const r = await getJson(`${BINANCE}/klines?symbol=${simbolo}&interval=1m&startTime=${t0 + s * MIN}&endTime=${t0 + (Math.min(b, s + 1500) - 1) * MIN}&limit=1500`, { limitatore: limBinance });
      for (const k of r || []) {
        const i = (k[0] - t0) / MIN;
        if (i < 0 || i >= n || !Number.isNaN(g.close[i])) continue;
        g.open[i] = +k[1]; g.high[i] = +k[2]; g.low[i] = +k[3]; g.close[i] = +k[4];
        g.volume[i] = +k[5]; g.quoteVolume[i] = +k[7]; g.trades[i] = +k[8]; g.takerBuyQuote[i] = +k[10];
        st.righe++; st.recuperatiApi = (st.recuperatiApi || 0) + 1;
      }
    }
  }
  if (st.righe > 0) scriviMese(simbolo, chiave, g);
  const ris = { ...st, minuti: n, completo: completo && st.giorniMancanti.length === 0 && st.righe > 0 };
  if (!st.giorniMancanti.length) delete ris.giorniMancanti;
  return ris;
}

async function scaricaFunding(simbolo, mesi) {
  const righe = [];
  const mesiMancanti = [];
  const completi = mesi.filter(([y, m]) => Date.UTC(y, m, 1) <= OGGI); // il mese in corso viene dall'API
  const csvMesi = await inParallelo(completi, 6, ([y, m]) =>
    scaricaZipVerificato(`${VISION}/monthly/fundingRate/${simbolo}/${simbolo}-fundingRate-${meseChiave(y, m)}.zip`));
  for (let j = 0; j < completi.length; j++) {
    const csv = csvMesi[j];
    if (!csv) { mesiMancanti.push(meseChiave(...completi[j])); continue; }
    for (const r of csv.split('\n')) {
      if (!r || r.charCodeAt(0) > 57) continue;
      const c = r.split(',');
      righe.push([Number(c[0]), Number(c[2]), Number(c[1])]);
    }
  }
  // Parte recente (e mesi mancanti) dall'API pubblica di Binance
  let da = righe.length ? righe.at(-1)[0] + 1 : inizioMese(...mesi[0]);
  for (let pagine = 0; pagine < 50; pagine++) {
    const r = await getJson(`${BINANCE}/fundingRate?symbol=${simbolo}&startTime=${da}&limit=1000`, { limitatore: limBinance });
    if (!r?.length) break;
    for (const x of r) righe.push([x.fundingTime, Number(x.fundingRate), null]);
    da = r.at(-1).fundingTime + 1;
    if (r.length < 1000) break;
  }
  righe.sort((a, b) => a[0] - b[0]);
  const unici = righe.filter((r, i) => i === 0 || r[0] - righe[i - 1][0] > 60000);
  mkdirSync(join(CARTELLA, 'funding'), { recursive: true });
  // Arrotondo l'orario al minuto (Binance registra qualche millisecondo dopo l'ora esatta)
  writeFileSync(join(CARTELLA, 'funding', `${simbolo}.json`), JSON.stringify(unici.map(r => [Math.round(r[0] / MIN) * MIN, r[1]])));
  const intervalli = {};
  for (let i = 1; i < unici.length; i++) {
    const h = Math.round((unici[i][0] - unici[i - 1][0]) / 3600000);
    intervalli[h] = (intervalli[h] || 0) + 1;
  }
  return { pagamenti: unici.length, primo: unici[0]?.[0], ultimo: unici.at(-1)?.[0], intervalliOre: intervalli, mesiMancantiSuVision: mesiMancanti };
}

// Analizza i buchi rileggendo i file binari
function analizzaBuchi(simbolo) {
  const s = leggiStorico(simbolo, { da: INIZIO });
  if (!s) return null;
  let primo = -1, ultimo = -1;
  for (let i = 0; i < s.n; i++) if (!Number.isNaN(s.close[i])) { if (primo < 0) primo = i; ultimo = i; }
  const buchi = [], fermi = [];
  let mancanti = 0, inizioBuco = -1, zeroVolume = 0, inizioFermo = -1;
  for (let i = primo; i <= ultimo + 1; i++) {
    const manca = i <= ultimo && Number.isNaN(s.close[i]);
    // Minuto "fermo": manca oppure c'è ma senza scambi (Binance scrive candele piatte durante la manutenzione)
    const fermo = manca || (i <= ultimo && s.volume[i] === 0);
    if (i <= ultimo && !manca && s.volume[i] === 0) zeroVolume++;
    if (manca) { mancanti++; if (inizioBuco < 0) inizioBuco = i; }
    else if (inizioBuco >= 0) { buchi.push([s.t0 + inizioBuco * MIN, i - inizioBuco]); inizioBuco = -1; }
    if (fermo) { if (inizioFermo < 0) inizioFermo = i; }
    else if (inizioFermo >= 0) { fermi.push([s.t0 + inizioFermo * MIN, i - inizioFermo]); inizioFermo = -1; }
  }
  const attesi = ultimo - primo + 1;
  return {
    primoMinuto: s.t0 + primo * MIN, ultimoMinuto: s.t0 + ultimo * MIN,
    minutiAttesi: attesi, minutiMancanti: mancanti, quotaMancante: mancanti / attesi,
    minutiSenzaScambi: zeroVolume, numeroBuchi: buchi.length,
    buchiLunghi: buchi.filter(b => b[1] >= 10).sort((a, b) => b[1] - a[1]).slice(0, 15),
    // Buchi in comune tra molti simboli = fermi di Binance; li conto dopo
    tuttiBuchi: buchi, tuttiFermi: fermi,
  };
}

async function main() {
  const universo = JSON.parse(readFileSync('data/universo.json', 'utf8'));
  const lista = universo.candidati.slice(0, QUANTI);
  mkdirSync(CARTELLA, { recursive: true });
  console.log(`Scarico ${lista.length} simboli fino al ${new Date(OGGI - 1).toISOString().slice(0, 10)} compreso.`);

  // Lavori: un (simbolo, mese) per volta, 8 in parallelo
  const lavori = [];
  for (const c of lista) {
    const da = Math.max(INIZIO, Math.floor((c.quotazioneBinance || 0) / GIORNO) * GIORNO);
    manifesto[c.simbolo] ||= { mesi: {} };
    manifesto[c.simbolo].quotazioneBinance = c.quotazioneBinance;
    manifesto[c.simbolo].mesiRichiesti = mesiDa(da).map(([y, m]) => meseChiave(y, m));
    for (const [y, m] of mesiDa(da)) lavori.push([c.simbolo, y, m]);
  }
  let fatti = 0;
  const t = Date.now();
  await inParallelo(lavori, 8, async ([simbolo, y, m]) => {
    const r = await scaricaMeseCandele(simbolo, y, m);
    manifesto[simbolo].mesi[meseChiave(y, m)] = r;
    if (++fatti % 50 === 0 || fatti === lavori.length) {
      salvaManifesto();
      console.log(`  candele: ${fatti}/${lavori.length} mesi (${Math.round((Date.now() - t) / 1000)} s)`);
    }
  });
  salvaManifesto();

  console.log('Funding...');
  await inParallelo(lista, 4, async c => {
    const da = Math.max(INIZIO, Math.floor((c.quotazioneBinance || 0) / GIORNO) * GIORNO);
    manifesto[c.simbolo].funding = await scaricaFunding(c.simbolo, mesiDa(da));
  });
  salvaManifesto();

  console.log('Controllo buchi...');
  const rapporto = {};
  for (const c of lista) rapporto[c.simbolo] = analizzaBuchi(c.simbolo);
  // Fermi condivisi: un minuto mancante o senza scambi in almeno metà dei simboli già quotati è un fermo della borsa
  const contaPerMinuto = new Map();
  for (const r of Object.values(rapporto)) if (r) for (const [t0, len] of r.tuttiFermi) for (let k = 0; k < len; k++) {
    const tt = t0 + k * MIN; contaPerMinuto.set(tt, (contaPerMinuto.get(tt) || 0) + 1);
  }
  const quotati = tt => Object.values(rapporto).filter(r => r && r.primoMinuto <= tt).length;
  const condivisi = [];
  let ini = null, prev = null;
  const minutiCondivisi = [...contaPerMinuto].filter(([tt, n]) => n >= Math.max(3, quotati(tt) / 2)).map(([tt]) => tt).sort((a, b) => a - b);
  for (const tt of minutiCondivisi) {
    if (prev !== null && tt - prev === MIN) { prev = tt; continue; }
    if (ini !== null) condivisi.push([ini, (prev - ini) / MIN + 1]);
    ini = prev = tt;
  }
  if (ini !== null) condivisi.push([ini, (prev - ini) / MIN + 1]);
  const setCondivisi = new Set(minutiCondivisi);
  for (const r of Object.values(rapporto)) if (r) {
    r.minutiMancantiPropri = r.tuttiBuchi.reduce((s, [t0, len]) => {
      let k = 0; for (let j = 0; j < len; j++) if (!setCondivisi.has(t0 + j * MIN)) k++; return s + k;
    }, 0);
    delete r.tuttiBuchi; delete r.tuttiFermi;
  }
  const out = { creato: new Date().toISOString(), finoA: OGGI, simboli: lista.map(c => c.simbolo), fermiBorsa: condivisi, rapporto };
  writeFileSync(join(CARTELLA, 'rapporto-buchi.json'), JSON.stringify(out, null, 1));
  scriviDoc(out);
  console.log('Fatto: data/binance/ e docs/storico.md');
}

const fmt = (x, d = 0) => x.toLocaleString('it-IT', { maximumFractionDigits: d, useGrouping: 'always' });
const quando = ms => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const durata = min => min >= 1440 ? `${fmt(min / 1440, 1)} giorni` : min >= 60 ? `${fmt(min / 60, 1)} ore` : `${min} min`;

function scriviDoc({ creato, finoA, simboli, fermiBorsa, rapporto }) {
  let totAttesi = 0, totMancanti = 0, totFile = 0, totZero = 0, problemi = [];
  const recuperiGiorni = new Map(); let recuperiApi = 0; const apiPerSimbolo = [];
  const righe = simboli.map(s => {
    const r = rapporto[s], man = manifesto[s];
    if (!r) { problemi.push(`${s}: nessun dato scaricato`); return `| ${s} | – | – | – | – | – | – | – |`; }
    totAttesi += r.minutiAttesi; totMancanti += r.minutiMancanti; totZero += r.minutiSenzaScambi;
    const mesi = Object.values(man.mesi);
    for (const x of mesi) for (const g of x.giorniRecuperati || []) recuperiGiorni.set(g, (recuperiGiorni.get(g) || 0) + 1);
    const api = mesi.reduce((a, x) => a + (x.recuperatiApi || 0), 0);
    if (api) { recuperiApi += api; apiPerSimbolo.push(`${s} (${fmt(api)})`); }
    totFile += mesi.filter(x => x.righe > 0).length;
    const doppie = mesi.reduce((a, x) => a + (x.doppie || 0), 0), fuori = mesi.reduce((a, x) => a + (x.fuoriGriglia || 0), 0);
    if (doppie || fuori) problemi.push(`${s}: ${doppie} candele doppie, ${fuori} fuori orario (ignorate)`);
    const vuoti = Object.entries(man.mesi).filter(([, x]) => !x.righe).map(([k]) => k);
    if (vuoti.length) problemi.push(`${s}: mesi senza dati su data.binance.vision: ${vuoti.join(', ')}`);
    const lungo = r.buchiLunghi[0];
    const f = man.funding;
    return `| ${s} | ${quando(r.primoMinuto).slice(0, 10)} | ${fmt(r.minutiAttesi)} | ${fmt(r.minutiMancanti)} (${fmt(r.quotaMancante * 100, 3)}%) | ${fmt(r.minutiMancantiPropri)} | ${fmt(r.minutiSenzaScambi)} | ${lungo ? `${durata(lungo[1])} dal ${quando(lungo[0])}` : '–'} | ${f ? `${fmt(f.pagamenti)} (ogni ${Object.entries(f.intervalliOre).sort((a, b) => b[1] - a[1]).map(([h]) => h + 'h').slice(0, 3).join('/')})` : '–'} |`;
  });
  const fermi = fermiBorsa.filter(([, l]) => l >= 2).sort((a, b) => a[0] - b[0]).map(([t, l]) => `- ${quando(t)} UTC · ${durata(l)}`);
  const md = `# Storico Binance a 1 minuto

Aggiornato il ${creato.slice(0, 10)}. Script: \`research/02-scarica-storico.js\`. Lettura: \`research/lib/storico.js\`.

## Cosa c'è
- **${simboli.length} crypto** (le prime 50 di \`docs/universo.md\`), candele da 1 minuto dei perpetual USDT-M di Binance dal **1 gennaio 2023** (o dalla quotazione, se più recente) fino al **${new Date(finoA - 1).toISOString().slice(0, 10)}** compreso.
- Fonte: \`data.binance.vision\` (file mensili; per il mese in corso file giornalieri), ogni file verificato con il suo checksum SHA-256.
- Funding: file mensili di \`data.binance.vision\` più l'API pubblica di Binance per le settimane più recenti.
- In totale ${fmt(totFile)} file mensili, ${fmt(totAttesi)} minuti attesi, **${fmt(totMancanti)} mancanti (${fmt(totMancanti / totAttesi * 100, 3)}%)** dopo il recupero descritto sotto. ${fmt(totZero)} minuti hanno la candela ma zero scambi (${fmt(totZero / totAttesi * 100, 2)}%).

### Recuperi
- I file mensili di Binance a volte non contengono un giorno intero che invece esiste nei file giornalieri: in quel caso il giorno è stato preso dal file giornaliero. ${recuperiGiorni.size ? 'Giorni recuperati così: ' + [...recuperiGiorni].map(([g, n]) => `${g} (${n} simboli)`).join(', ') + '.' : 'Non è servito.'}
- I minuti ancora mancanti sono stati chiesti all'API pubblica di Binance: ${recuperiApi ? `${fmt(recuperiApi)} minuti recuperati, per ${apiPerSimbolo.join(', ')}. Di solito è l'ultimo giorno, il cui file giornaliero non è ancora pubblicato.` : 'non è servito.'}

## Formato (in \`data/binance/\`, escluso da git)
- \`klines/<SIMBOLO>/<AAAA-MM>.bin\`: un file per mese, a colonne. Griglia fissa: la riga *i* è il minuto *inizio mese + i*. Prezzi (open, high, low, close) in Float64; volume, volume in USDT, numero di scambi e acquisti aggressivi in USDT in Float32. Un minuto mancante è NaN.
- \`funding/<SIMBOLO>.json\`: elenco \`[orario_ms, tasso]\` (tasso in frazione: 0.0001 = 0,01%).
- \`manifesto.json\`: cosa è stato scaricato, da dove, righe e problemi per ogni mese. \`rapporto-buchi.json\`: tutti i buchi.
- Per leggere: \`leggiStorico('BTCUSDT', { da, a })\` restituisce un'unica griglia continua con tutte le colonne. Rilanciare lo script aggiorna solo il mese in corso.

## Buchi e candele mancanti
Un minuto "mancante" è un minuto senza candela tra la prima e l'ultima candela del simbolo. "Propri" sono i minuti mancanti solo per quel simbolo, cioè non dovuti a un fermo generale di Binance. "Senza scambi" sono minuti con la candela ma volume zero: sulle monete grandi sono quasi tutti fermi di Binance, sulle piccole anche minuti in cui nessuno ha scambiato.

| Simbolo | Dal | Minuti attesi | Mancanti | Propri | Senza scambi | Buco più lungo | Funding (pagamenti) |
|---|---|---:|---:|---:|---:|---|---|
${righe.join('\n')}

### Fermi generali di Binance
Minuti mancanti o senza scambi per almeno metà dei simboli già quotati, da 2 minuti in su. Binance in questi momenti era in manutenzione o bloccata: prezzo fermo, nessuno scambio.
${fermi.length ? fermi.join('\n') : '- Nessuno.'}

### Altre anomalie
${problemi.length ? problemi.map(p => `- ${p}`).join('\n') : '- Nessuna: nessuna candela doppia o fuori orario.'}

## Cosa significa per i backtest
- I minuti mancanti sono pochissimi: nei backtest un minuto mancante si tratta come "nessun prezzo visto" (nessuna entrata, uscite rimandate al primo minuto disponibile, al suo prezzo d'apertura con slittamento).
- Durante i fermi generali di Binance le candele sono piatte e senza volume, ma Bitunix potrebbe essersi mosso: niente entrate in quei minuti, e i trade aperti in quei momenti vanno segnalati nei risultati.
- Alcune monete hanno lo storico breve perché quotate da poco: per la regola 70/30 conviene usare il periodo comune, o pesarle meno.
- Il funding cambia intervallo (8h, 4h, a volte 1h) quando il mercato è teso: va applicato all'orario reale di ogni pagamento, non a orari fissi.
`;
  writeFileSync('docs/storico.md', md);
}

main().catch(e => { console.error(e); salvaManifesto(); process.exit(1); });

// Strategie lente: classifica settimanale (A), con funding (B), con filtro BTC (C), rincorsa di BTC (D).
// Regole fissate prima di qualunque risultato in docs/regola-fissata-classifica.md.
//   --fase=scelta   : tutte le varianti sul periodo 2020–2023, criteri di ammissione, una vincitrice per famiglia
//                     → data/lente/scelta.json e sezione "Scelta" in fondo a docs/regola-fissata-classifica.md
//   --fase=verifica : le vincitrici (e, solo per informazione, tutte le varianti) dal 01/01/2024 → docs/strategie-lente.md
// Dati: research/12-scarica-lente.js. Motore: research/motore/classifica.js.
//
// Uso: node --max-old-space-size=12288 research/13-strategie-lente.js --fase=scelta|verifica
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { ORA, GIORNO, CARTELLA_LENTE, leggiOre, leggiFunding, leggiSimboli } from './lib/lente.js';
import { simulaPortafoglio } from './motore/classifica.js';
import { pct, num, intero, data, scriviConConclusione } from './lib/backtest.js';

const FASE = (process.argv.find(a => a.startsWith('--fase=')) || '').split('=')[1];
const T0 = Date.UTC(2020, 0, 1);
const TAGLIO = Date.UTC(2024, 0, 1);
const SLITT = { normale: { nome: 'normale (0,08%)', base: 0.0008, sottili: 0.0008 }, alto: { nome: 'alto (0,12%, sottili 0,15%)', base: 0.0012, sottili: 0.0015 } };
const CAPITALE = 10000;
const FILE_SCELTA = join(CARTELLA_LENTE, 'scelta.json');
const h = ms => Math.round((ms - T0) / ORA);

// ---------------- Varianti (docs/regola-fissata-classifica.md) ----------------
const GAMBE = { ls: 'long e short', l: 'solo long', s: 'solo short' };
const VARIANTI = [];
for (const U of [50, 100]) {
  for (const L of [1, 2, 4]) for (const g of ['ls', 'l', 's']) VARIANTI.push({ id: `A-${L}s-${g}-${U}`, fam: 'A', U, L, g, nome: `A · ultime ${L} settimane · ${GAMBE[g]} · prime ${U}` });
  for (const L of [1, 2, 4]) for (const g of ['ls', 'l', 's']) VARIANTI.push({ id: `B1-${L}s-${g}-${U}`, fam: 'B', tipo: 'B1', U, L, g, base: `A-${L}s-${g}-${U}`, nome: `B1 · ultime ${L} settimane senza affollati · ${GAMBE[g]} · prime ${U}` });
  for (const g of ['ls', 'l', 's']) VARIANTI.push({ id: `B2-${g}-${U}`, fam: 'B', tipo: 'B2', U, g, base: `A-1s-${g}-${U}`, nome: `B2 · contro il funding della settimana · ${GAMBE[g]} · prime ${U}` });
  for (const L of [1, 2, 4]) for (const M of [50, 100]) for (const sotto of ['short', 'fuori']) VARIANTI.push({ id: `C-${L}s-m${M}-${sotto}-${U}`, fam: 'C', U, L, M, sotto, base: `A-${L}s-l-${U}`, nome: `C · ultime ${L} settimane · BTC sopra la media ${M}: long, sotto: ${sotto === 'short' ? 'short' : 'fuori'} · prime ${U}` });
  for (const k of [2, 3]) for (const H of [1, 3]) {
    VARIANTI.push({ id: `D-k${k}-${H}g-${U}`, fam: 'D', U, k, H, ritardo: true, base: `D0-k${k}-${H}g-${U}`, nome: `D · BTC oltre ${k} volte la volatilità · monete rimaste indietro · ${H} ${H === 1 ? 'giorno' : 'giorni'} · prime ${U}` });
    VARIANTI.push({ id: `D0-k${k}-${H}g-${U}`, fam: 'D0', U, k, H, ritardo: false, nome: `D base · BTC oltre ${k} volte la volatilità · tutte le monete · ${H} ${H === 1 ? 'giorno' : 'giorni'} · prime ${U}` });
  }
}
const perId = Object.fromEntries(VARIANTI.map(v => [v.id, v]));

// ---------------- Dati sulla griglia oraria ----------------
function caricaDati() {
  const el = leggiSimboli();
  const N = h(el.fino);
  const monete = new Map(), funding = new Map();
  for (const s of el.simboli) {
    if (!s.ore) continue;
    const o = leggiOre(s.simbolo);
    const open = new Float64Array(N).fill(NaN), close = new Float64Array(N).fill(NaN), vol = new Float32Array(N);
    const off = h(o.t0);
    let primo = -1, ultimo = -1;
    // dopo la chiusura l'archivio di Binance continua con candele piatte a volume zero: la moneta finisce
    // all'ultima ora con scambi veri (e comincia alla prima)
    let iPrimo = 0, iUltimo = o.n - 1;
    while (iPrimo < o.n && !(o.quoteVolume[iPrimo] > 0)) iPrimo++;
    while (iUltimo >= 0 && !(o.quoteVolume[iUltimo] > 0)) iUltimo--;
    for (let i = iPrimo; i <= iUltimo; i++) {
      const g = off + i;
      if (g < 0 || g >= N || Number.isNaN(o.close[i])) continue;
      open[g] = o.open[i]; close[g] = o.close[i]; vol[g] = o.quoteVolume[i];
      if (primo < 0) primo = g;
      ultimo = g;
    }
    if (primo < 0) continue;
    monete.set(s.simbolo, { open, close, vol, primo, ultimo, attiva: s.attiva, bitunix: s.bitunix });
    funding.set(s.simbolo, leggiFunding(s.simbolo).map(([t, r]) => [(t - T0) / ORA, r]));
  }
  return { monete, funding, N, fino: el.fino, elenco: el };
}

// ultima chiusura valida all'ora `i` o prima (al massimo 48 ore prima)
const chiusura = (m, i) => { for (let j = i; j >= Math.max(0, i - 48); j--) if (!Number.isNaN(m.close[j])) return m.close[j]; return NaN; };

function costruisci(D) {
  const { monete, funding, N } = D;
  const lunedi = []; for (let t = h(Date.UTC(2020, 0, 6)); t < N; t += 168) lunedi.push(t);
  const giorni = []; for (let t = 24; t < N; t += 24) giorni.push(t);
  const btc = monete.get('BTCUSDT');
  const cacheU = new Map();
  // universo del lunedì t: prime U altcoin per volume dei 30 giorni prima, quotate da almeno 30 giorni, con prezzo nelle ultime 24 ore
  const cacheC = new Map();
  const universo = (t, U, soloBitunix) => {
    const k = `${t}|${U}|${soloBitunix}`;
    if (cacheU.has(k)) return cacheU.get(k);
    const kc = `${t}|${soloBitunix}`;
    let c = cacheC.get(kc);
    if (!c) { c = classificaVolume(t, soloBitunix); cacheC.set(kc, c); }
    const lista = c.slice(0, U).map(x => x[0]);
    const r = { lista, sottili: new Set(lista.slice(50)) };
    cacheU.set(k, r);
    return r;
  };
  const classificaVolume = (t, soloBitunix) => {
    const c = [];
    for (const [s, m] of monete) {
      if (s === 'BTCUSDT' || s === 'ETHUSDT' || (soloBitunix && !m.bitunix)) continue;
      if (m.primo > t - 720 || m.ultimo < t - 24) continue;
      let v = 0; for (let i = t - 720; i < t; i++) v += m.vol[i];
      c.push([s, v]);
    }
    c.sort((a, b) => b[1] - a[1]);
    return c;
  };
  const cacheF = new Map();
  const fundingMedio = (s, t) => {
    const k = `${s}|${t}`;
    if (cacheF.has(k)) return cacheF.get(k);
    const f = funding.get(s) || [];
    let lo = 0, hi = f.length; while (lo < hi) { const m = (lo + hi) >> 1; if (f[m][0] < t - 168) lo = m + 1; else hi = m; }
    let x = 0, n = 0;
    for (let i = lo; i < f.length && f[i][0] < t; i++) { x += f[i][1]; n++; }
    const r = n ? x / 21 : NaN;
    cacheF.set(k, r);
    return r;
  };
  const rendimento = (s, t, ore) => { const m = monete.get(s); return chiusura(m, t - 1) / chiusura(m, t - 1 - ore) - 1; };
  const pesiGambe = (lunghi, corti, g) => {
    const p = new Map();
    const wl = g === 'ls' ? 0.5 : 1, ws = g === 'ls' ? 0.5 : 1;
    if (g !== 's') for (const s of lunghi) p.set(s, wl / lunghi.length);
    if (g !== 'l') for (const s of corti) p.set(s, -ws / corti.length);
    return p;
  };
  const smaBtc = (t, M) => { let x = 0; for (let j = 0; j < M; j++) x += chiusura(btc, t - 1 - 24 * j); return x / M; };
  // piani di una variante
  function piani(v, soloBitunix, inizio = 0) {
    const out = [];
    if (v.fam === 'D' || v.fam === 'D0') {
      const coorti = [];
      let ultimoLunedi = null;
      for (const t of giorni) {
        if (t >= lunedi[0] && lunedi.includes(t)) ultimoLunedi = t;
        // segnale sulla giornata appena chiusa
        const r = chiusura(btc, t - 1) / chiusura(btc, t - 25) - 1;
        const passati = []; for (let j = 1; j <= 30; j++) passati.push(chiusura(btc, t - 1 - 24 * j) / chiusura(btc, t - 25 - 24 * j) - 1);
        const mu = passati.reduce((a, b) => a + b, 0) / passati.length;
        const sigma = Math.sqrt(passati.reduce((a, b) => a + (b - mu) ** 2, 0) / (passati.length - 1));
        let cambia = false;
        if (ultimoLunedi !== null && t >= inizio && Number.isFinite(r) && Number.isFinite(sigma) && Math.abs(r) > v.k * sigma) {
          const dir = Math.sign(r);
          const U = universo(ultimoLunedi, v.U, soloBitunix);
          const scelte = U.lista.filter(s => { const a = rendimento(s, t, 24); return Number.isFinite(a) && (!v.ritardo || dir * a < 0.5 * Math.abs(r)); });
          if (scelte.length) { coorti.push({ da: t, a: t + 24 * v.H, scelte, dir, sottili: U.sottili }); cambia = true; }
        }
        if (coorti.some(c => c.a === t)) cambia = true;
        if (!cambia) continue;
        const attive = coorti.filter(c => c.da <= t && t < c.a);
        const pesi = new Map(), sottili = new Set();
        for (const c of attive) for (const s of c.scelte) { pesi.set(s, (pesi.get(s) || 0) + c.dir / (v.H * c.scelte.length)); if (c.sottili.has(s)) sottili.add(s); }
        for (const [s, w] of pesi) if (Math.abs(w) < 1e-12) pesi.delete(s);
        out.push({ h: t, pesi, sottili });
      }
      return out;
    }
    for (const t of lunedi) {
      const U = universo(t, v.U, soloBitunix);
      if (U.lista.length < 10) { out.push({ h: t, pesi: new Map(), sottili: U.sottili }); continue; }
      let ordinate;
      if (v.tipo === 'B2') ordinate = U.lista.map(s => [s, -fundingMedio(s, t)]).filter(x => Number.isFinite(x[1])); // funding basso = in cima (long)
      else ordinate = U.lista.map(s => [s, rendimento(s, t, 168 * v.L)]).filter(x => Number.isFinite(x[1]));
      ordinate.sort((a, b) => b[1] - a[1]);
      const k = Math.floor(0.2 * ordinate.length);
      let lunghi = ordinate.slice(0, k).map(x => x[0]), corti = ordinate.slice(ordinate.length - k).map(x => x[0]);
      let g = v.g;
      if (v.tipo === 'B1') {
        lunghi = lunghi.filter(s => !(fundingMedio(s, t) > 0.0003));
        corti = corti.filter(s => !(fundingMedio(s, t) < -0.0003));
      }
      if (v.fam === 'C') {
        const sopra = chiusura(btc, t - 1) > smaBtc(t, v.M);
        g = sopra ? 'l' : (v.sotto === 'short' ? 's' : null);
      }
      out.push({ h: t, pesi: g ? pesiGambe(lunghi, corti, g) : new Map(), sottili: U.sottili });
    }
    return out;
  }
  return { piani, universo, lunedi };
}

// ---------------- Misure ----------------
function misure(r, { composto }) {
  const { ops, curva, capitale, da, a } = r;
  const eq = i => (i < 0 ? capitale : curva[Math.min(i, curva.length - 1)]);
  const anni = (a - da) / (24 * 365.25);
  const rendimento = r.finale / capitale - 1;
  let picco = capitale, calo = 0;
  for (const x of curva) { if (x > picco) picco = x; if (picco > 0) calo = Math.max(calo, (picco - x) / picco); }
  // anno per anno (UTC)
  const perAnno = {};
  for (let y = new Date(T0 + da * ORA).getUTCFullYear(); y <= new Date(T0 + (a - 1) * ORA).getUTCFullYear(); y++) {
    const i0 = Math.max(da, h(Date.UTC(y, 0, 1))) - da, i1 = Math.min(a, h(Date.UTC(y + 1, 0, 1))) - da;
    const e0 = eq(i0 - 1), e1 = eq(i1 - 1);
    perAnno[y] = composto ? e1 / e0 - 1 : (e1 - e0) / capitale;
  }
  // settimana peggiore (da lunedì a lunedì)
  let settPeggiore = 0;
  const lun0 = h(Date.UTC(2020, 0, 6));
  let i = da + ((lun0 - da) % 168 + 168) % 168;
  for (; i + 168 <= a; i += 168) { const e0 = eq(i - da - 1), e1 = eq(i + 168 - da - 1); if (e0 > 0) settPeggiore = Math.min(settPeggiore, e1 / e0 - 1); }
  const somma = (lista, f) => lista.reduce((x, o) => x + f(o), 0);
  const vinc = somma(ops.filter(o => o.netto > 0), o => o.netto), perd = -somma(ops.filter(o => o.netto <= 0), o => o.netto);
  const gruppo = lista => ({ n: lista.length, netto: somma(lista, o => o.netto) / capitale, lordo: somma(lista, o => o.lordo) / capitale, medio: lista.length ? somma(lista, o => o.netto / o.nozionale) / lista.length : NaN });
  return {
    rendimento, rovina: r.rovina, medioAnnuo: composto ? (r.rovina ? -1 : (1 + rendimento) ** (1 / anni) - 1) : rendimento / anni,
    calo, perAnno, settPeggiore, pf: perd > 0 ? vinc / perd : NaN, operazioni: ops.length,
    lordo: somma(ops, o => o.lordo) / capitale, costi: somma(ops, o => o.costi) / capitale, funding: somma(ops, o => o.funding) / capitale,
    medioNetto: ops.length ? somma(ops, o => o.netto / o.nozionale) / ops.length : NaN,
    long: gruppo(ops.filter(o => o.lato === 1)), short: gruppo(ops.filter(o => o.lato === -1)),
    attive: gruppo(ops.filter(o => o.attiva)), tolte: gruppo(ops.filter(o => !o.attiva)),
    suBitunix: gruppo(ops.filter(o => o.bitunix)), nonBitunix: gruppo(ops.filter(o => !o.bitunix)),
    durata: ops.length ? somma(ops, o => o.uscita - o.entrata) / ops.length / 24 : NaN,
    monete: new Set(ops.map(o => o.simbolo)).size,
  };
}

function esegui(D, C, v, { da, a, slitt = SLITT.normale, esposizione = 1, composto = false, soloBitunix = false, tieniOps = false }) {
  const piani = C.piani(v, soloBitunix, da).filter(p => p.h >= da && p.h < a);
  const r = simulaPortafoglio({ monete: D.monete, funding: D.funding, piani, da, a, opz: { esposizione, composto, slitt, capitale: CAPITALE, soloCambi: v.fam === 'D' || v.fam === 'D0' } });
  const m = misure(r, { composto });
  if (tieniOps) m.ops = r.ops;
  return m;
}

// ---------------- Testo ----------------
const anniDi = m => Object.keys(m.perAnno);
const rendTesto = m => (m.rovina ? `${pct(Math.max(-1, m.rendimento))} (rovina)` : pct(m.rendimento));
const riga = (nome, m) => `| ${nome} | ${rendTesto(m)} | ${pct(m.medioAnnuo)} | ${num(m.pf)} | ${pct(m.calo)} | ${pct(m.settPeggiore)} | ${intero(m.operazioni)} | ${pct(m.medioNetto, 2)} | ${anniDi(m).map(y => pct(m.perAnno[y], 0)).join(' / ')} |`;
const INTEST = '| Variante | Rendimento | Medio annuo | PF | Peggior calo | Settimana peggiore | Operazioni | Netto medio per operazione | Anno per anno |\n|---|---:|---:|---:|---:|---:|---:|---:|---|';

function ammissione(mN, mA) {
  const anni = Object.values(mN.perAnno);
  return {
    c1: mN.rendimento > 0 && mN.pf >= 1.10, c2: mA.rendimento > 0, c3: anni.filter(x => x > 0).length >= 3, c4: mN.calo <= 0.5,
    get ok() { return this.c1 && this.c2 && this.c3 && this.c4; },
  };
}

async function main() {
  console.log('Carico i dati...');
  const D = caricaDati();
  const C = costruisci(D);
  const hTaglio = h(TAGLIO);
  const sel = { da: 0, a: hTaglio }, ver = { da: hTaglio, a: D.N };

  if (FASE === 'scelta') {
    const righe = [];
    for (const v of VARIANTI) {
      const mN = esegui(D, C, v, sel), mA = esegui(D, C, v, { ...sel, slitt: SLITT.alto });
      const am = ammissione(mN, mA);
      righe.push({ v, mN, mA, am: { c1: am.c1, c2: am.c2, c3: am.c3, c4: am.c4, ok: am.ok }, punteggio: mN.calo > 0 ? mN.medioAnnuo / mN.calo : NaN });
      process.stdout.write('.');
    }
    console.log('');
    const vincitrici = {};
    for (const fam of ['A', 'B', 'C', 'D']) {
      const amm = righe.filter(r => r.v.fam === fam && r.am.ok).sort((x, y) => y.punteggio - x.punteggio);
      vincitrici[fam] = amm[0] ? amm[0].v.id : null;
    }
    writeFileSync(FILE_SCELTA, JSON.stringify({ creato: new Date().toISOString(), vincitrici, righe: righe.map(r => ({ id: r.v.id, am: r.am, punteggio: r.punteggio, normale: { ...r.mN }, alto: { ...r.mA } })) }, null, 1));
    // sezione in fondo alle regole fissate
    const testo = [], p = x => testo.push(x);
    p('');
    p(`## Scelta sul periodo 2020–2023 (fatta il ${new Date().toISOString().slice(0, 10)}, prima della verifica)`);
    p('Script: `research/13-strategie-lente.js --fase=scelta`. Dimensione fissa, esposizione 1x, slittamento normale. "Alto" = rendimento con lo slittamento alto. Criteri: 1 = rendimento positivo e PF almeno 1,10; 2 = positivo con slittamento alto; 3 = in utile in almeno 3 anni su 4; 4 = peggior calo al massimo 50%.');
    p('');
    p('| Variante | Rendimento | Medio annuo | PF | Peggior calo | Settimana peggiore | Operazioni | Netto medio per operazione | Anno per anno | Alto | Criteri | Ammessa |');
    p('|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---|---|');
    for (const r of righe) p(`${riga(r.v.nome, r.mN)} ${rendTesto(r.mA)} | ${['c1', 'c2', 'c3', 'c4'].map((c, i) => (r.am[c] ? '' : `no ${i + 1}`)).filter(Boolean).join(', ') || 'tutti'} | ${r.am.ok ? '**sì**' : 'no'} |`);
    p('');
    p('**Vincitrici** (rapporto più alto tra rendimento medio annuo e peggior calo, tra le ammesse):');
    for (const fam of ['A', 'B', 'C', 'D']) {
      const id = vincitrici[fam];
      const r = id && righe.find(x => x.v.id === id);
      p(`- **${fam}**: ${r ? `${r.v.nome} (\`${id}\`): medio annuo ${pct(r.mN.medioAnnuo)}, peggior calo ${pct(r.mN.calo)}, rapporto ${num(r.punteggio)}.` : 'nessuna variante ammessa: la famiglia non passa.'}`);
    }
    appendFileSync(join('docs', 'regola-fissata-classifica.md'), testo.join('\n') + '\n');
    console.log('Vincitrici:', JSON.stringify(vincitrici));
    return;
  }

  if (FASE !== 'verifica') throw new Error('Uso: --fase=scelta oppure --fase=verifica');
  if (!existsSync(FILE_SCELTA)) throw new Error('Prima: --fase=scelta');
  const scelta = JSON.parse(readFileSync(FILE_SCELTA, 'utf8'));
  const testo = [], p = x => testo.push(x);
  p('# Strategie lente: classifica settimanale e rincorsa di BTC');
  p('');
  p(`Aggiornato il ${new Date().toISOString().slice(0, 10)}. Regole e scelta fissate prima: \`docs/regola-fissata-classifica.md\`. Script: \`research/13-strategie-lente.js\`. Dati: \`research/12-scarica-lente.js\`.`);
  p('');
  p('<!-- conclusione:inizio -->\n## Conclusione\n(da scrivere)\n<!-- conclusione:fine -->');
  p('');
  // dati
  const el = D.elenco;
  const att = el.simboli.filter(s => s.attiva && s.ore).length, tol = el.simboli.filter(s => !s.attiva && s.ore).length;
  p('## Dati');
  p(`- **${intero(att + tol)} perpetual crypto USDT-M** di Binance dal 2020: ${intero(att)} ancora attivi e **${intero(tol)} tolti**. Gli scartati (azioni, materie prime, indici, USDC, oro) sono ${intero(el.scartati.length)}.`);
  p(`- Candele da 1 ora fino al ${data(D.fino - GIORNO)} compreso; le giornaliere sono ricavate dalle orarie.`);
  p(`  - Controllo su ${el.controllo.length} monete, attive e tolte: ${intero(el.controllo.reduce((x, c) => x + c.giorni, 0))} giorni confrontati con i file giornalieri ufficiali, ${intero(el.controllo.reduce((x, c) => x + c.diversi, 0))} diversi.`);
  p(`- Funding reale di ogni moneta. Operabili oggi su Bitunix: ${intero(el.simboli.filter(s => s.bitunix && s.ore).length)} delle monete della lista.`);
  p('');
  // vincitrici e verifica
  const famiglie = ['A', 'B', 'C', 'D'];
  const esiti = {};
  p('## Verifica dal 2024 delle regole scelte');
  p('Una regola per famiglia, scelta sul 2020–2023 con criteri decisi prima. Qui è provata una sola volta, dal 01/01/2024 a ieri.');
  p('');
  for (const fam of famiglie) {
    const id = scelta.vincitrici[fam];
    if (!id) { p(`### ${fam}: nessuna regola ammessa nel periodo di scelta`); p(''); esiti[fam] = { regge: false, nessuna: true }; continue; }
    const v = perId[id];
    const mN = esegui(D, C, v, { ...ver, tieniOps: true }), mA = esegui(D, C, v, { ...ver, slitt: SLITT.alto });
    const mB = esegui(D, C, v, { ...ver, soloBitunix: true });
    const anni = Object.values(mN.perAnno);
    const crit = [
      ['rendimento positivo e PF almeno 1,10', mN.rendimento > 0 && mN.pf >= 1.10, `${rendTesto(mN)}, PF ${num(mN.pf)}`],
      ['positivo con slittamento alto', mA.rendimento > 0, rendTesto(mA)],
      ['in utile in almeno 2 anni su 3', anni.filter(x => x > 0).length >= 2, anniDi(mN).map(y => `${y}: ${pct(mN.perAnno[y], 1)}`).join(', ')],
      ['peggior calo al massimo 40%', mN.calo <= 0.4, pct(mN.calo)],
      ['solo monete operabili su Bitunix: positivo', mB.rendimento > 0, rendTesto(mB)],
    ];
    const regge = crit.every(c => c[1]);
    esiti[fam] = { regge, v, mN, mA, mB };
    p(`### ${fam}: ${v.nome} — **${regge ? 'regge' : 'non regge'}**`);
    p('| Criterio | Risultato | Soddisfatto |\n|---|---|---|');
    for (const [t, ok, val] of crit) p(`| ${t} | ${val} | ${ok ? 'sì' : '**no**'} |`);
    p('');
    const base = v.base && perId[v.base];
    p(INTEST);
    p(riga('Regola scelta', mN));
    if (base) p(riga(`Versione base: ${base.nome}`, esegui(D, C, base, ver)));
    p(riga('Solo monete operabili su Bitunix', mB));
    p(riga('Slittamento alto', mA));
    p(riga('Esposizione 2x', esegui(D, C, v, { ...ver, esposizione: 2 })));
    p(riga('Interesse composto, 1x', esegui(D, C, v, { ...ver, composto: true })));
    p(riga('Interesse composto, 2x', esegui(D, C, v, { ...ver, composto: true, esposizione: 2 })));
    p('');
    const g = (nome, x) => `| ${nome} | ${intero(x.n)} | ${pct(x.lordo, 1)} | ${pct(x.netto, 1)} | ${pct(x.medio, 2)} |`;
    p('Da dove viene il risultato (somme in % del capitale iniziale; dimensione fissa, 1x, slittamento normale):');
    p('');
    p('| Parte | Operazioni | Lordo | Netto | Netto medio per operazione |\n|---|---:|---:|---:|---:|');
    for (const [nome, x] of [['Gamba long', mN.long], ['Gamba short', mN.short], ['Monete ancora attive', mN.attive], ['Monete tolte da Binance', mN.tolte], ['Monete operabili su Bitunix', mN.suBitunix], ['Monete non su Bitunix', mN.nonBitunix]]) p(g(nome, x));
    p('');
    p(`Costi: lordo ${pct(mN.lordo, 1)} del capitale, commissioni e slittamento ${pct(mN.costi, 1)}, funding ${pct(mN.funding, 1)} (positivo = pagato). I costi valgono ${mN.lordo > 0 ? pct((mN.costi + mN.funding) / mN.lordo, 0) + ' del lordo' : 'più del lordo, che è negativo o nullo'}. Durata media di un'operazione ${num(mN.durata, 1)} giorni; monete diverse toccate: ${intero(mN.monete)}.`);
    p('');
    writeFileSync(join(CARTELLA_LENTE, `operazioni-${fam}.json`), JSON.stringify(mN.ops.map(o => ({ ...o, entrata: data(T0 + o.entrata * ORA), uscita: data(T0 + o.uscita * ORA) }))));
  }
  // tutte le varianti, per informazione
  p('## Tutte le varianti (solo per informazione)');
  p('Le altre varianti sono state guardate sulla verifica solo dopo la scelta: non contano per il verdetto. Dimensione fissa, esposizione 1x, slittamento normale.');
  p('');
  p('| Variante | Scelta 2020–2023: rendimento | PF | Verifica dal 2024: rendimento | PF | Peggior calo | Anno per anno |\n|---|---:|---:|---:|---:|---:|---|');
  for (const v of VARIANTI) {
    const s = scelta.righe.find(x => x.id === v.id).normale;
    const m = esegui(D, C, v, ver);
    p(`| ${v.nome}${Object.values(scelta.vincitrici).includes(v.id) ? ' **(scelta)**' : ''} | ${rendTesto(s)} | ${num(s.pf)} | ${rendTesto(m)} | ${num(m.pf)} | ${pct(m.calo)} | ${anniDi(m).map(y => pct(m.perAnno[y], 0)).join(' / ')} |`);
  }
  p('');
  // Bitunix: quante monete si potrebbero fare davvero
  const universo = JSON.parse(readFileSync('data/universo.json', 'utf8')).candidati;
  const perSimbolo = Object.fromEntries(universo.map(c => [c.simbolo, c]));
  const ultimo = C.lunedi.at(-1);
  p('## Su quante monete di Bitunix si potrebbe fare');
  p(`Universo dell'ultimo lunedì (${data(T0 + ultimo * ORA)}), con i dati di Bitunix di \`docs/universo.md\`:`);
  p('');
  p('| Universo | Monete | Operabili su Bitunix | con almeno 1 mln USDT al giorno su Bitunix | con almeno 20.000 USDT nel book entro lo 0,1% |\n|---|---:|---:|---:|---:|');
  for (const U of [50, 100]) {
    const l = C.universo(ultimo, U, false).lista;
    const b = l.filter(s => perSimbolo[s]);
    p(`| Prime ${U} | ${l.length} | ${b.length} | ${b.filter(s => perSimbolo[s].volMedioBitunix >= 1e6).length} | ${b.filter(s => perSimbolo[s].profondita01 >= 20000).length} |`);
  }
  p('');
  p('Con 10.000 USDT di capitale ed esposizione 1x, ogni posizione vale 250–1.000 USDT secondo la strategia: molto meno della profondità del book di quasi tutte queste monete.');
  p('');
  p('## Limiti');
  p('- I prezzi sono quelli di Binance. Su Bitunix il book è più sottile, e il funding può essere diverso da quello di Binance.');
  p('- Per sapere se una moneta è operabile su Bitunix si usa la lista di oggi. Le monete tolte da Binance di solito non ci sono più nemmeno su Bitunix.');
  p('- Si provano più famiglie. Anche con la divisione fissata prima, una regola su quattro può passare per caso.');
  scriviConConclusione(join('docs', 'strategie-lente.md'), testo.join('\n') + '\n');
  console.log('Esiti:', JSON.stringify(Object.fromEntries(Object.entries(esiti).map(([k, x]) => [k, x.regge]))));
}

main();

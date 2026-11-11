// Fissa la regola "grande movimento" usando SOLO il primo 70% (2023-01-01 → taglio). I dati dopo il taglio non vengono letti.
//
// Criteri decisi prima di guardare i numeri (scritti anche in docs/regola-fissata.md):
//   base: segui il movimento, oltre 8× il normale, finestre 15 e 60 minuti insieme (basta una), nessuna conferma,
//         uscite Wisi Trade, pausa e durata massima 4 ore. La finestra combinata è una scelta di progetto, non di dati.
//   1) "solo altcoin" (senza BTC ed ETH) entra se, con 8×, migliora sia il rendimento del portafoglio sia il lordo medio
//      per operazione in ENTRAMBE le metà del 70%.
//   2) 10× o 12× sostituisce 8× se, con la scelta del punto 1, migliora entrambe le misure in entrambe le metà e ha almeno
//      300 operazioni nel 70%; se si qualificano entrambe, quella con il rendimento più alto sul 70% intero.
//   Misure: portafoglio con dimensione fissa, leva 3x, slittamento 0,08%, 10 ordini casuali; lordo sulle singole operazioni.
//
// Uso: node --max-old-space-size=8192 research/07-fissa-regola.js
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leggiFunding } from './lib/storico.js';
import { REGOLE_ATTUALE } from './motore/posizione.js';
import { operazioniGrandeMovimento } from './motore/grandeMovimento.js';
import { metricheOperazioni } from './motore/metriche.js';
import { rendimentoNetto } from './motore/costi.js';
import {
  GIORNO, INIZIO, datiComuni, storicoConFermi, operazioniInParallelo, servizioWorker, comeColonne, caricaPrezzi, caricaFunding,
  eseguiPortafoglio, SLITTAMENTI, firma, pct, num, intero, data, rend,
} from './lib/backtest.js';

export const CONFIG_GM = { giorniVolatilita: 14, pausa: 240, durataMassima: 240, regole: REGOLE_ATTUALE, tieneMinuti: 3, tieneQuota: 0.5, btcMultiplo: 1 };
const VARIANTI = [];
for (const N of [[15, 60], 15, 60]) for (const k of [8, 10, 12]) VARIANTI.push({ id: VARIANTI.length, N, k, direzione: 'segui', conferma: 'nessuna' });
const SCHEMA = { variante: Uint8Array, lato: Int8Array, motivo: Uint8Array, entrata: Float64Array, uscita: Float64Array, prezzo: Float64Array, rapporto: Float64Array, funding: Float32Array, peggiore: Float32Array, forza: Float32Array };

if (!isMainThread) servizioWorker(parentPort, simbolo => {
  const s = storicoConFermi(simbolo, workerData.fermi, { a: workerData.taglio }); // niente dati dopo il taglio
  if (!s || s.n < 30 * 1440) return comeColonne(SCHEMA, Object.fromEntries(Object.keys(SCHEMA).map(k => [k, []]))); // quotata dopo il taglio
  const funding = (leggiFunding(simbolo) || []).filter(x => x[0] < workerData.taglio);
  const o = operazioniGrandeMovimento({ s, funding, varianti: VARIANTI, config: CONFIG_GM });
  // un'operazione aperta prima del taglio che finirebbe dopo è chiusa a fine dati: la scarto, per non usare nulla oltre il taglio
  const tieni = o.uscita.map(u => u < workerData.taglio - 60000);
  for (const k of Object.keys(o)) o[k] = o[k].filter((_, i) => tieni[i]);
  return comeColonne(SCHEMA, o);
});

async function main() {
  const { simboli, taglio, fermi } = datiComuni();
  const meta = Math.floor((INIZIO + (taglio - INIZIO) / 2) / GIORNO) * GIORNO;
  console.log(`Solo il 70%: ${data(INIZIO)} → ${data(taglio - 1)} (metà al ${data(meta)})`);
  const colonne = await operazioniInParallelo({
    script: fileURLToPath(import.meta.url), cartella: join('data', 'backtest', 'regola'), firmaConfig: firma({ CONFIG_GM, VARIANTI, taglio }),
    simboli, datiWorker: { fermi, taglio }, rifai: false,
  });
  const contesto = { prezzi: caricaPrezzi(simboli, { a: taglio }), funding: caricaFunding(simboli) };
  const perVariante = VARIANTI.map(() => []);
  simboli.forEach((sim, si) => {
    const c = colonne[sim];
    for (let k = 0; k < c.variante.length; k++) perVariante[c.variante[k]].push({ simbolo: si, piccola: si >= 14, lato: c.lato[k], motivo: c.motivo[k], entrata: c.entrata[k], uscita: c.uscita[k], prezzo: c.prezzo[k], rapporto: c.rapporto[k], funding: c.funding[k], peggiore: c.peggiore[k] });
  });
  for (const l of perVariante) l.sort((a, b) => a.entrata - b.entrata || a.simbolo - b.simbolo);
  const base = { leva: 3, slitt: SLITTAMENTI[1], composto: false, contesto };
  const misura = (ops, da, a) => {
    const x = ops.filter(o => o.entrata >= da && o.entrata < a);
    const lordo = x.length ? x.reduce((s, o) => s + o.lato * (o.rapporto - 1), 0) / x.length : NaN;
    const op = metricheOperazioni(x.map(o => rendimentoNetto(o.lato, o.rapporto, o.piccola ? 0.0008 : 0.0008, o.funding)));
    const pf = eseguiPortafoglio(x, base).m;
    return { operazioni: x.length, lordo, netto: op.medioNetto, pfOp: op.profitFactor, rendimento: pf.rendimento, profitFactor: pf.profitFactor, calo: pf.caloMassimo, rovina: pf.rovina };
  };
  const righe = [];
  for (const v of VARIANTI) for (const monete of ['tutte', 'altcoin']) {
    const ops = perVariante[v.id].filter(o => monete === 'tutte' || o.simbolo > 1);
    righe.push({ N: v.N, k: v.k, monete, intero: misura(ops, INIZIO, taglio), prima: misura(ops, INIZIO, meta), seconda: misura(ops, meta, taglio) });
  }
  // Applicazione dei criteri (solo finestra combinata)
  const trova = (k, monete) => righe.find(r => Array.isArray(r.N) && r.k === k && r.monete === monete);
  const meglio = (a, b) => ['prima', 'seconda'].every(h => a[h].rendimento > b[h].rendimento && a[h].lordo > b[h].lordo);
  const decisioni = [];
  const altcoin = meglio(trova(8, 'altcoin'), trova(8, 'tutte'));
  decisioni.push(`Solo altcoin con 8×: ${altcoin ? 'migliora in entrambe le metà → entra nella regola' : 'non migliora in entrambe le metà → resta fuori (tutte le 50 monete)'}.`);
  const monete = altcoin ? 'altcoin' : 'tutte';
  const qualificate = [10, 12].filter(k => meglio(trova(k, monete), trova(8, monete)) && trova(k, monete).intero.operazioni >= 300);
  for (const k of [10, 12]) decisioni.push(`${k}× contro 8× (${monete === 'altcoin' ? 'solo altcoin' : 'tutte le monete'}): ${qualificate.includes(k) ? 'migliora in entrambe le metà con almeno 300 operazioni' : 'non soddisfa il criterio'}.`);
  const k = qualificate.length ? qualificate.sort((a, b) => trova(b, monete).intero.rendimento - trova(a, monete).intero.rendimento)[0] : 8;
  decisioni.push(`Soglia scelta: **${k}×**.`);
  const regola = { N: [15, 60], k, monete, direzione: 'segui', conferma: 'nessuna', config: CONFIG_GM };
  mkdirSync(join('data', 'backtest', 'regola'), { recursive: true });
  writeFileSync(join('data', 'backtest', 'regola', 'regola.json'), JSON.stringify({ creato: new Date().toISOString(), taglio, meta, regola, decisioni, righe }, null, 1));
  scriviDoc({ taglio, meta, righe, decisioni, regola });
  console.log(decisioni.join('\n'));
}

function scriviDoc({ taglio, meta, righe, decisioni, regola }) {
  const r = [], p = s => r.push(s);
  const nomeN = N => (Array.isArray(N) ? '15 e 60 insieme' : `${N}`);
  p('# Regola fissata: grande movimento');
  p('');
  p(`Scritta il ${new Date().toISOString().slice(0, 10)}, **prima** di qualunque test su dati nuovi. Script: \`research/07-fissa-regola.js\` (legge solo i dati fino al ${data(taglio - 1)}). Dati: \`data/backtest/regola/regola.json\`.`);
  p('');
  p('## La regola (non si cambia più)');
  p(`- **Monete**: ${regola.monete === 'altcoin' ? 'solo altcoin (tutte tranne BTC ed ETH)' : 'tutte, comprese BTC ed ETH'}.`);
  p(`- **Segnale**: alla chiusura di un minuto, il rendimento degli ultimi **15 minuti oppure degli ultimi 60 minuti** supera **${regola.k} volte** il movimento normale della moneta su quella finestra. Movimento normale = scarto quadratico dei rendimenti a 15 (o 60) minuti dei 14 giorni precedenti, aggiornato una volta al giorno. Se le due finestre scattano insieme in direzioni opposte, nessun segnale.`);
  p('- **Direzione**: si segue il movimento (salita → long, discesa → short). Nessuna conferma.');
  p('- **Entrata**: a mercato all\'apertura del minuto successivo.');
  p('- **Uscite (Wisi Trade, configurazione Attuale)**: unità = ATR (Wilder 14) delle candele da 15 minuti chiuse prima dell\'entrata; stop loss a 1,5 unità; da +0,5 unità di guadagno l\'uscita è la migliore tra lo stop loss, lo stop che segue a 1 unità dal miglior prezzo e la protezione del guadagno (si esce restituendo il 40% del guadagno massimo). Durata massima 4 ore, poi chiusura all\'apertura del minuto.');
  p('- **Pausa**: dopo un segnale la moneta non ne apre un altro per 4 ore e comunque non prima che la posizione sia chiusa.');
  p('- **Capitale**: 10.000 USDT, 10 posizioni al massimo, margine 10% (dimensione fissa o interesse composto), leva 3x (e 5x come variante), margine isolato, freno 8% sulla perdita del giorno chiusa + aperta (chiude tutto, niente entrate fino al giorno UTC dopo). Segnali nello stesso minuto in ordine casuale (media di 10 ordini).');
  p('- **Costi**: commissione 0,06% per lato, slittamento 0,05% / 0,08% / 0,12% per lato (minimo 0,08% sulle monete dalla 15ª in poi), funding reale di Binance.');
  p('');
  p('## Come è stata scelta (solo sul primo 70%)');
  p(`Criteri decisi prima di guardare i numeri. Base: segui, oltre 8×, finestre 15 e 60 minuti insieme (scelta di progetto: non si sceglie la finestra sui dati), nessuna conferma. Il 70% (dal 2023-01-01 al ${data(taglio - 1)}) è diviso in due metà (dal ${data(meta)}).`);
  p('1. **Solo altcoin** entra se, con 8×, migliora sia il rendimento del portafoglio sia il lordo medio per operazione **in entrambe le metà**.');
  p('2. **10× o 12×** sostituisce 8× se migliora entrambe le misure in entrambe le metà e ha almeno 300 operazioni; se si qualificano entrambe, quella con il rendimento più alto.');
  p('');
  p('**Decisioni:**');
  for (const d of decisioni) p(`- ${d}`);
  p('');
  p('Portafoglio: dimensione fissa, leva 3x, slittamento 0,08%. Lordo e netto sulle singole operazioni.');
  p('');
  p('| Finestra (min) | Soglia | Monete | Oper. 70% | Lordo 70% | Netto 70% | Portafoglio 70% | PF | Peggior calo | Lordo 1ª metà | Portafoglio 1ª metà | Lordo 2ª metà | Portafoglio 2ª metà |');
  p('|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const x of righe) p(`| ${nomeN(x.N)}${Array.isArray(x.N) ? '' : ' (solo informazione)'} | ${x.k}× | ${x.monete === 'altcoin' ? 'solo altcoin' : 'tutte'} | ${intero(x.intero.operazioni)} | ${pct(x.intero.lordo, 3)} | ${pct(x.intero.netto, 3)} | ${rend({ rendimento: x.intero.rendimento, rovina: x.intero.rovina })} | ${num(x.intero.profitFactor)} | ${pct(x.intero.calo)} | ${pct(x.prima.lordo, 3)} | ${rend({ rendimento: x.prima.rendimento, rovina: x.prima.rovina })} | ${pct(x.seconda.lordo, 3)} | ${rend({ rendimento: x.seconda.rendimento, rovina: x.seconda.rovina })} |`);
  p('');
  p('## Come sarà verificata (deciso adesso)');
  p('Su dati mai usati, una sola volta, senza cambiare la regola:');
  p('- **A**: le stesse 50 monete dal primo giorno disponibile al 31/12/2022 (quelle che esistevano);');
  p('- **B**: le monete dalla 51ª alla 100ª di `docs/universo.md`, dal 2023 a oggi;');
  p('- **A + B insieme**, come un unico portafoglio.');
  p('');
  p('**La regola regge** se su A + B, con dimensione fissa, leva 3x e slittamento 0,08%:');
  p('1. il rendimento è positivo e il profit factor almeno 1,10;');
  p('2. il lordo medio per operazione è almeno 0,30% (sopra il costo di circa 0,28% andata e ritorno);');
  p('3. è in utile sia su A sia su B presi da soli;');
  p('4. con slittamento 0,12% non è in perdita.');
  p('');
  p('**Regge in parte** se valgono 1 e 2 ma non 3 o 4. Altrimenti **non regge**.');
  p('');
  p('Da ricordare: anche le monete dei dati nuovi sono scelte con la liquidità di oggi (chi è sparito non c\'è), e questo favorisce il passato.');
  writeFileSync('docs/regola-fissata.md', r.join('\n') + '\n');
}

if (isMainThread) main().catch(e => { console.error(e); process.exit(1); });

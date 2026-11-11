// Fase 0 · test mirato: apertura USA solo su BTC ed ETH, entrata con ordine limite (commissione maker).
//
// Come funziona l'entrata:
//   - segnale: entro la finestra d'entrata il prezzo tocca il livello 1,25 × movimento dall'apertura delle 9:30 di New York;
//   - in quel momento si mette un ordine limite su quel livello (acquisto per il long, vendita per lo short). Un ordine
//     limite che resta nel book paga la commissione maker (0,02%) e non ha slittamento;
//   - l'ordine si considera eseguito solo se il prezzo ripassa oltre il livello di almeno 0,05% (per il long: scende
//     fino a livello × 0,9995) entro `validita` minuti dal segnale. Altrimenti il segnale è perso;
//   - uscite come Wisi Trade (unità, stop loss, stop che segue, protezione 40%), a mercato (taker + slittamento),
//     durata massima fino alle 00:00 UTC.
// Per confrontare i segnali eseguiti con quelli persi, ogni segnale è simulato anche come se si fosse entrati subito al tocco
// ("ipotetico"), e c'è la versione a mercato con conferma dello 0,15% (come in docs/apertura-sessione.md).
//
// Uso: node --max-old-space-size=8192 research/05-btc-eth-limite.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { leggiFunding } from './lib/storico.js';
import { calendarioSessioni, fineSettimana } from './motore/sessioni.js';
import { puntiCandelaIn } from './motore/percorso.js';
import { Posizione, MOTIVI, REGOLE_ATTUALE } from './motore/posizione.js';
import { RilevatoreRottura } from './motore/rottura.js';
import { fundingPagato, nettoOperazione, COMMISSIONE, COMMISSIONE_MAKER } from './motore/costi.js';
import { volatilitaGiornaliera, candele15, UnitaSessione } from './motore/volatilita.js';
import { metricheOperazioni } from './motore/metriche.js';
import {
  MIN, INIZIO, datiComuni, storicoConFermi, caricaPrezzi, caricaFunding, eseguiPortafoglio, SLITTAMENTI, LEVE, spearman, mediana,
  pct, num, intero, data, rend, rigaMetriche, INTESTAZIONE_METRICHE, scriviConConclusione,
} from './lib/backtest.js';

const SIMBOLI = ['BTCUSDT', 'ETHUSDT'];
const CONFIG = {
  margineLimite: 0.0005,     // l'ordine limite è eseguito solo se il prezzo passa oltre il livello di almeno 0,05%
  margineMercato: 0.0015,    // versione a mercato: conferma dello 0,15% (come apertura di sessione)
  moltiplicatoreEntrata: 1.25,
  regole: { attivaDa: REGOLE_ATTUALE.attivaDa, segue: REGOLE_ATTUALE.segue, restituisci: REGOLE_ATTUALE.restituisci },
  griglia: {
    percentuale: [0.0025, 0.005, 0.0075, 0.01],
    volatilita: [0.1, 0.2, 0.3],
    finestre: [3, 15, 30],
    stop: [1, 1.5, 2],
    validita: [5, 15, 30],     // minuti in cui l'ordine limite resta valido dopo il segnale
  },
  minimoOperazioniScelta: 50,
};
const VARIANTI = [];
for (const tipo of ['percentuale', 'volatilita']) for (const movimento of CONFIG.griglia[tipo]) for (const finestra of CONFIG.griglia.finestre)
  for (const stop of CONFIG.griglia.stop) for (const validita of CONFIG.griglia.validita) VARIANTI.push({ id: VARIANTI.length, tipo, movimento, finestra, stop, validita });
const it = x => x.toLocaleString('it-IT');
const nomeVariante = v => (v.tipo === 'percentuale' ? `movimento ${it(v.movimento * 100)}% (livello ${it(v.movimento * 125)}%)` : `movimento ${it(v.movimento)}×vol (livello ${it(v.movimento * 1.25)}×vol)`)
  + `, finestra ${v.finestra} min, stop ${it(v.stop)} unità, ordine valido ${v.validita} min`;
const ID_ATTUALE = VARIANTI.find(v => v.tipo === 'percentuale' && v.movimento === 0.01 && v.finestra === 30 && v.stop === 1.5 && v.validita === 15).id;

// Simula una posizione da un punto dentro il minuto `iE` fino all'uscita
function seguiPosizione(s, iE, indice, partenza, lato, entrata, u, stop, iFine, funding) {
  const { open: O, high: H, low: L, close: C } = s;
  const punti = new Float64Array(4);
  const tE = s.t0 + iE * MIN;
  const pos = new Posizione({ lato, entrata, tempo: tE, unita: u, regole: { ...CONFIG.regole, stop } });
  pos.minuto(puntiCandelaIn(punti, O[iE], H[iE], L[iE], C[iE]), tE, indice, partenza);
  for (let i = iE + 1; i < s.n && !pos.chiusa; i++) {
    if (Number.isNaN(O[i])) continue;
    const t = s.t0 + i * MIN;
    if (i >= iFine) { pos.chiudiA(O[i], t, MOTIVI.tempo); break; }
    pos.minuto(puntiCandelaIn(punti, O[i], H[i], L[i], C[i]), t);
  }
  if (!pos.chiusa) { let k = s.n - 1; while (k > 0 && Number.isNaN(C[k])) k--; pos.chiudiA(C[k], s.t0 + k * MIN, MOTIVI.fineDati); }
  return { entrata: tE, uscita: pos.tempoUscita, prezzo: entrata, rapporto: pos.uscita / entrata, funding: fundingPagato(funding, lato, tE, pos.tempoUscita), peggiore: -pos.gPeggiore, motivo: pos.motivo };
}

// Primo tocco del livello (senza margine) nella finestra: { lato, i, indice, punto }
function primoTocco(s, i0, iMax, su, giu) {
  const { open: O, high: H, low: L, close: C } = s;
  const p = new Float64Array(4);
  for (let i = i0; i < iMax; i++) {
    if (Number.isNaN(O[i])) continue;
    puntiCandelaIn(p, O[i], H[i], L[i], C[i]);
    if (p[0] >= su) return { lato: 1, i, indice: 0, punto: p[0] };
    if (p[0] <= giu) return { lato: -1, i, indice: 0, punto: p[0] };
    for (let k = 1; k < 4; k++) {
      if (p[k] > p[k - 1] && p[k] >= su && p[k - 1] < su) return { lato: 1, i, indice: k - 1, punto: su };
      if (p[k] < p[k - 1] && p[k] <= giu && p[k - 1] > giu) return { lato: -1, i, indice: k - 1, punto: giu };
    }
  }
  return null;
}

// Esecuzione dell'ordine limite: dopo il tocco, il prezzo deve passare oltre il livello di `margine` contro la direzione
function esecuzioneLimite(s, tocco, livello, margine, iScadenza) {
  const { open: O, high: H, low: L, close: C } = s;
  const p = new Float64Array(4);
  const soglia = tocco.lato === 1 ? livello * (1 - margine) : livello * (1 + margine);
  const passa = x => (tocco.lato === 1 ? x <= soglia : x >= soglia);
  for (let i = tocco.i; i < iScadenza; i++) {
    if (Number.isNaN(O[i])) continue;
    puntiCandelaIn(p, O[i], H[i], L[i], C[i]);
    let k0 = 0, prima = p[0];
    if (i === tocco.i) { k0 = tocco.indice; prima = tocco.punto; }
    else if (passa(p[0])) return { i, indice: 0, punto: p[0] };
    for (let k = k0 + 1; k < 4; k++) {
      if (!passa(prima) && passa(p[k])) return { i, indice: k - 1, punto: soglia };
      prima = p[k];
    }
  }
  return null;
}

async function main() {
  const { fineDati, taglio, fermi } = datiComuni();
  const contesto = { prezzi: caricaPrezzi(SIMBOLI), funding: caricaFunding(SIMBOLI) };
  const segnali = []; // un record per (variante, segnale)
  SIMBOLI.forEach((simbolo, si) => {
    const s = storicoConFermi(simbolo, fermi);
    const vol = volatilitaGiornaliera(s, 14);
    const unitaS = new UnitaSessione(candele15(s));
    const funding = leggiFunding(simbolo) || [];
    for (const ev of calendarioSessioni(s.t0, s.t0 + s.n * MIN)) {
      const unitaPrezzo = unitaS.unita(ev.sessione, ev.t);
      unitaS.registra(ev.sessione, ev.t);
      if (ev.sessione !== 'usa') continue;
      const i0 = (ev.t - s.t0) / MIN, iFine = Math.min(s.n, (ev.prossima - s.t0) / MIN);
      if (i0 < 0 || Number.isNaN(s.open[i0]) || Number.isNaN(unitaPrezzo)) continue;
      const ref = s.open[i0], v = vol(ev.t);
      for (const tipo of ['percentuale', 'volatilita']) for (const movimento of CONFIG.griglia[tipo]) for (const finestra of CONFIG.griglia.finestre) {
        const m = tipo === 'percentuale' ? movimento : movimento * v;
        if (!(m > 0)) continue;
        const su = ref * (1 + CONFIG.moltiplicatoreEntrata * m), giu = ref * (1 - CONFIG.moltiplicatoreEntrata * m);
        const iMax = Math.min(i0 + finestra, iFine);
        const tocco = primoTocco(s, i0, iMax, su, giu);
        // versione a mercato con conferma 0,15% (indipendente dal tocco)
        const ril = new RilevatoreRottura({ riferimento: ref, soglia: CONFIG.moltiplicatoreEntrata * m, margine: CONFIG.margineMercato });
        let em = null, iEm = -1;
        const p = new Float64Array(4);
        for (let i = i0; i < iMax; i++) { if (Number.isNaN(s.open[i])) continue; em = ril.minuto(puntiCandelaIn(p, s.open[i], s.high[i], s.low[i], s.close[i])); if (em) { iEm = i; break; } }
        if (!tocco && !em) continue;
        for (const variante of VARIANTI.filter(x => x.tipo === tipo && x.movimento === movimento && x.finestra === finestra)) {
          const rec = { variante: variante.id, simbolo: si, piccola: false, giorno: ev.t, lato: tocco?.lato ?? em.lato };
          if (tocco) {
            const livello = tocco.lato === 1 ? su : giu;
            const u = unitaPrezzo / livello;
            rec.ipotetico = seguiPosizione(s, tocco.i, tocco.indice, tocco.punto, tocco.lato, livello, u, variante.stop, iFine, funding);
            const ex = esecuzioneLimite(s, tocco, livello, CONFIG.margineLimite, Math.min(tocco.i + variante.validita + 1, iFine));
            if (ex) rec.limite = { ...seguiPosizione(s, ex.i, ex.indice, ex.punto, tocco.lato, livello, u, variante.stop, iFine, funding), ritardo: ex.i - tocco.i };
          }
          if (em) rec.mercato = seguiPosizione(s, iEm, em.indice, em.puntoConferma, em.lato, em.prezzo, unitaPrezzo / em.prezzo, variante.stop, iFine, funding);
          segnali.push(rec);
        }
      }
    }
  });
  console.log(`${segnali.length} segnali (tutte le varianti)`);

  const SL = SLITTAMENTI[1];
  const nettoLimite = o => nettoOperazione(o.lato, o.rapporto, { slittEntrata: 0, slittUscita: SL.base, commEntrata: COMMISSIONE_MAKER, commUscita: COMMISSIONE, funding: o.funding });
  const nettoMercato = o => nettoOperazione(o.lato, o.rapporto, { slittEntrata: SL.base, slittUscita: SL.base, funding: o.funding });
  const lordo = o => o.lato * (o.rapporto - 1);
  const opsDi = (id, tipo, da, a) => segnali.filter(r => r.variante === id && r[tipo] && r[tipo].entrata >= da && r[tipo].entrata < a)
    .map(r => ({ ...r[tipo], simbolo: r.simbolo, piccola: false, lato: r.lato, limite: tipo === 'limite', giorno: r.giorno }))
    .sort((x, y) => x.entrata - y.entrata || x.simbolo - y.simbolo);
  const base = { leva: 3, slitt: SL, contesto };

  // Portafoglio di tutte le varianti, ordine limite e a mercato
  const tabella = VARIANTI.map(v => ({
    v,
    limite: { scelta: eseguiPortafoglio(opsDi(v.id, 'limite', INIZIO, taglio), base).m, verifica: eseguiPortafoglio(opsDi(v.id, 'limite', taglio, fineDati), base).m },
    mercato: { scelta: eseguiPortafoglio(opsDi(v.id, 'mercato', INIZIO, taglio), base).m, verifica: eseguiPortafoglio(opsDi(v.id, 'mercato', taglio, fineDati), base).m },
  }));
  const scelta = tabella.filter(x => x.limite.scelta.operazioni >= CONFIG.minimoOperazioniScelta && !x.limite.scelta.rovina).sort((a, b) => b.limite.scelta.rendimento - a.limite.scelta.rendimento)[0];

  // Esecuzione: segnali, eseguiti, e confronto eseguiti / persi (sull'operazione ipotetica entrata al tocco)
  const esecuzione = (filtro, da, a) => {
    const rr = segnali.filter(r => r.ipotetico && filtro(r) && r.ipotetico.entrata >= da && r.ipotetico.entrata < a);
    const es = rr.filter(r => r.limite), pe = rr.filter(r => !r.limite);
    const media = (lista, f) => lista.length ? lista.reduce((s, x) => s + f(x), 0) / lista.length : NaN;
    return {
      segnali: rr.length, eseguiti: es.length,
      ipoteticoEseguiti: media(es, r => lordo({ ...r.ipotetico, lato: r.lato })),
      ipoteticoPersi: media(pe, r => lordo({ ...r.ipotetico, lato: r.lato })),
      lordoLimite: media(es, r => lordo({ ...r.limite, lato: r.lato })),
      nettoLimite: media(es, r => nettoLimite({ ...r.limite, lato: r.lato })),
      vincentiPersi: pe.length ? pe.filter(r => lordo({ ...r.ipotetico, lato: r.lato }) > 0).length / pe.length : NaN,
      vincentiEseguiti: es.length ? es.filter(r => lordo({ ...r.limite, lato: r.lato }) > 0).length / es.length : NaN,
      ritardoMedio: media(es, r => r.limite.ritardo),
    };
  };
  const perGruppo = [];
  for (const tipo of ['percentuale', 'volatilita']) for (const movimento of CONFIG.griglia[tipo]) for (const validita of CONFIG.griglia.validita) {
    const f = r => { const v = VARIANTI[r.variante]; return v.tipo === tipo && v.movimento === movimento && v.validita === validita && v.stop === 1.5 && v.finestra === 30; };
    perGruppo.push({ tipo, movimento, validita, scelta: esecuzione(f, INIZIO, taglio), verifica: esecuzione(f, taglio, fineDati) });
  }

  // Dettaglio della variante scelta e della "Attuale"
  const dettaglio = v => {
    const configurazioni = [];
    for (const slitt of SLITTAMENTI) for (const leva of LEVE) for (const composto of [false, true]) {
      configurazioni.push({ slitt: slitt.nome, leva, composto,
        scelta: eseguiPortafoglio(opsDi(v.id, 'limite', INIZIO, taglio), { leva, slitt, composto, contesto }).m,
        verifica: eseguiPortafoglio(opsDi(v.id, 'limite', taglio, fineDati), { leva, slitt, composto, contesto }).m });
    }
    const anni = [];
    for (let y = 2023; y <= new Date(fineDati).getUTCFullYear(); y++) anni.push({ anno: y, m: eseguiPortafoglio(opsDi(v.id, 'limite', Date.UTC(y, 0, 1), Math.min(Date.UTC(y + 1, 0, 1), fineDati)), base).m });
    const gruppi = [['Long', o => o.lato === 1], ['Short', o => o.lato === -1], ['BTC', o => o.simbolo === 0], ['ETH', o => o.simbolo === 1],
      ['Giorni feriali', o => !fineSettimana(o.giorno)], ['Weekend', o => fineSettimana(o.giorno)]];
    const scomp = gruppi.map(([nome, f]) => {
      const a = opsDi(v.id, 'limite', INIZIO, taglio).filter(f), b = opsDi(v.id, 'limite', taglio, fineDati).filter(f);
      const mm = l => ({ ...metricheOperazioni(l.map(nettoLimite)), lordo: l.length ? l.reduce((s, o) => s + lordo(o), 0) / l.length : NaN });
      return { nome, scelta: mm(a), verifica: mm(b) };
    });
    const esec = { scelta: esecuzione(r => r.variante === v.id, INIZIO, taglio), verifica: esecuzione(r => r.variante === v.id, taglio, fineDati) };
    return { v, configurazioni, anni, scomp, esec };
  };
  const dettagli = { scelta: scelta ? dettaglio(scelta.v) : null, attuale: dettaglio(VARIANTI[ID_ATTUALE]) };

  mkdirSync(join('data', 'backtest', 'btc-eth-limite'), { recursive: true });
  const out = { creato: new Date().toISOString(), taglio, fineDati, config: CONFIG, varianti: VARIANTI.length, tabella, scelta, perGruppo, dettagli };
  writeFileSync(join('data', 'backtest', 'btc-eth-limite', 'risultati.json'), JSON.stringify(out, (k, x) => (x === Infinity ? 'inf' : x), 1));
  scriviDoc(out);
  console.log('Fatto: docs/btc-eth-limite.md');
}

function scriviDoc(out) {
  const { tabella, scelta, perGruppo, dettagli, taglio, fineDati } = out;
  const righe = [], p = s => righe.push(s);
  p('# Apertura USA su BTC ed ETH con entrata a ordine limite');
  p('');
  p(`Aggiornato il ${out.creato.slice(0, 10)}. Script: \`research/05-btc-eth-limite.js\` (motore in \`research/motore/\`). Risultati completi: \`data/backtest/btc-eth-limite/risultati.json\`.`);
  p('');
  p('<!-- conclusione -->');
  p('');
  p('## Perché questo test');
  p("Nel backtest dell'apertura di sessione l'unico vantaggio stabile era l'apertura USA su BTC ed ETH: circa +0,2% lordo per operazione, non abbastanza per pagare commissione e slittamento a mercato (0,28% andata e ritorno). Con un ordine limite all'entrata il costo d'entrata scende da 0,06% + 0,08% di slittamento a 0,02% (maker): andata e ritorno 0,16% invece di 0,28%.");
  p('');
  p('## Le regole');
  p(`- **Commissioni Bitunix** (VIP 0, verificate su bitunix.com/service/handling-fee): maker ${pct(COMMISSIONE_MAKER, 2)}, taker ${pct(COMMISSIONE, 2)}. Entrata maker senza slittamento; uscita a mercato: taker più slittamento 0,05% o 0,08%.`);
  p('- **Segnale**: alle 9:30 di New York il riferimento è il prezzo d\'apertura; se entro la finestra (3, 15 o 30 minuti) il prezzo tocca il livello 1,25 × movimento, scatta il segnale nella direzione del movimento.');
  p(`- **Ordine limite**: messo sul livello al momento del segnale. Un acquisto sopra il prezzo di mercato verrebbe eseguito subito come taker; per restare nel book (maker) deve aspettare che il prezzo torni sul livello. È considerato **eseguito solo se il prezzo ripassa oltre il livello di almeno 0,05%** (long: scende fino a livello − 0,05%) entro ${CONFIG_TEXT(out.config)} minuti dal segnale; altrimenti il segnale è **perso**.`);
  p('- **Uscite** come Wisi Trade: stop loss 1 / 1,5 / 2 unità, poi stop che segue a 1 unità e protezione del guadagno al 40%; durata massima fino alle 00:00 UTC.');
  p('- **Confronti**: per ogni segnale si simula anche l\'operazione "ipotetica" entrata subito al tocco del livello, per vedere se i segnali persi erano migliori o peggiori di quelli eseguiti; e la versione a mercato con conferma dello 0,15% (taker, come nell\'apertura di sessione).');
  p(`- **Metodo**: come negli altri test (capitale 10.000 USDT, 10 posizioni, margine 10%, leva 3x/5x, freno 8% su perdite chiuse + aperte, 10 ordini casuali, 70/30 con taglio al ${data(taglio)}). Griglia: ${out.varianti} varianti (movimento in % o in multipli della volatilità, finestra, stop, validità dell'ordine). Criterio di scelta: miglior rendimento nel 70% con almeno ${out.config.minimoOperazioniScelta} operazioni, dimensione fissa, leva 3x, slittamento 0,08%.`);
  p('');
  p('## Quanti segnali vanno persi, e quali');
  p('Finestra 30 minuti, stop 1,5 unità. "Ipotetico" = risultato lordo medio se si fosse entrati subito al tocco del livello. Se gli eseguiti hanno un ipotetico peggiore dei persi, l\'ordine limite viene eseguito proprio quando la rottura fallisce (selezione sfavorevole).');
  p('');
  p('| Movimento | Validità | Periodo | Segnali | Eseguiti | Ipotetico degli eseguiti | Ipotetico dei persi | Persi che sarebbero andati in utile | Lordo eseguiti (limite) | Netto eseguiti (limite) |');
  p('|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const g of perGruppo) for (const [nome, e] of [['70%', g.scelta], ['30%', g.verifica]]) {
    p(`| ${g.tipo === 'percentuale' ? it(g.movimento * 100) + '%' : it(g.movimento) + '×vol'} | ${g.validita} min | ${nome} | ${intero(e.segnali)} | ${intero(e.eseguiti)} (${pct(e.eseguiti / e.segnali, 0)}) | ${pct(e.ipoteticoEseguiti, 3)} | ${pct(e.ipoteticoPersi, 3)} | ${pct(e.vincentiPersi, 0)} | ${pct(e.lordoLimite, 3)} | ${pct(e.nettoLimite, 3)} |`);
  }
  p('');
  p('## Ordine limite contro ordine a mercato: tutte le varianti');
  const righeT = [['limite', 'Ordine limite (maker)'], ['mercato', 'A mercato con conferma 0,15% (taker)']];
  p('| Entrata | In utile nel 70% | In utile nel 30% | Mediana 70% | Mediana 30% | Migliore 30% | Correlazione 70↔30 |');
  p('|---|---:|---:|---:|---:|---:|---:|');
  for (const [k, nome] of righeT) {
    const a = tabella.map(x => Math.max(-1, x[k].scelta.rendimento)), b = tabella.map(x => Math.max(-1, x[k].verifica.rendimento));
    p(`| ${nome} | ${a.filter(x => x > 0).length}/${a.length} | ${b.filter(x => x > 0).length}/${b.length} | ${pct(mediana(a))} | ${pct(mediana(b))} | ${pct(Math.max(...b))} | ${num(spearman(a, b))} |`);
  }
  p('');
  p('### Le 8 migliori nel 70% (ordine limite) e come sono andate nel 30%');
  p('| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% | A mercato: rend. 30% |');
  p('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const x of tabella.filter(x => x.limite.scelta.operazioni >= out.config.minimoOperazioniScelta).sort((a, b) => b.limite.scelta.rendimento - a.limite.scelta.rendimento).slice(0, 8)) {
    p(`| ${nomeVariante(x.v)} | ${rend(x.limite.scelta)} | ${num(x.limite.scelta.profitFactor)} | ${intero(x.limite.scelta.operazioni)} | ${rend(x.limite.verifica)} | ${num(x.limite.verifica.profitFactor)} | ${intero(x.limite.verifica.operazioni)} | ${rend(x.mercato.verifica)} |`);
  }
  p('');
  const sezione = (titolo, d) => {
    if (!d) return;
    p(`## ${titolo}`);
    p(`Variante: **${nomeVariante(d.v)}**.`);
    p('');
    p('| Slittamento in uscita | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |');
    p('|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const c of d.configurazioni) p(`| ${c.slitt} | ${c.leva}x | ${c.composto ? 'composto' : 'fissa'} | ${rend(c.scelta)} | ${rigaMetriche(c.verifica)} |`);
    p('');
    p(`Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%): ${d.anni.map(a => `${a.anno} ${rend(a.m)} (${intero(a.m.operazioni)} oper., PF ${num(a.m.profitFactor)})`).join(' · ')}.`);
    p('');
    const e = d.esec;
    p(`Esecuzione: nel 70% ${intero(e.scelta.eseguiti)} eseguiti su ${intero(e.scelta.segnali)} segnali (${pct(e.scelta.eseguiti / e.scelta.segnali, 0)}), nel 30% ${intero(e.verifica.eseguiti)} su ${intero(e.verifica.segnali)} (${pct(e.verifica.eseguiti / e.verifica.segnali, 0)}). Ipotetico lordo degli eseguiti ${pct(e.verifica.ipoteticoEseguiti, 3)} contro ${pct(e.verifica.ipoteticoPersi, 3)} dei persi (30%). Esecuzione in media ${num(e.verifica.ritardoMedio, 1)} minuti dopo il segnale.`);
    p('');
    p('| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% |');
    p('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const s of d.scomp) p(`| ${s.nome} | ${intero(s.scelta.operazioni)} | ${pct(s.scelta.lordo, 3)} | ${pct(s.scelta.medioNetto, 3)} | ${num(s.scelta.profitFactor)} | ${intero(s.verifica.operazioni)} | ${pct(s.verifica.lordo, 3)} | ${pct(s.verifica.medioNetto, 3)} | ${num(s.verifica.profitFactor)} |`);
    p('');
  };
  sezione('La variante scelta sul 70%', dettagli.scelta);
  if (dettagli.scelta?.v.id !== dettagli.attuale.v.id) sezione('Le regole Attuali di Wisi Trade (movimento 1%, finestra 30 min, stop 1,5) con ordine valido 15 minuti', dettagli.attuale);
  p('## Limiti');
  p('- Solo 2 monete: pochi segnali al giorno, quindi molte meno operazioni che negli altri test; i numeri oscillano di più.');
  p('- L\'esecuzione dell\'ordine limite è stimata dalle candele da 1 minuto di Binance; su Bitunix la coda degli ordini e la profondità del book decidono se e quando si viene eseguiti. Il margine dello 0,05% serve a non contare come eseguiti i semplici tocchi.');
  p('- Le commissioni maker e taker sono quelle VIP 0 di oggi; possono cambiare.');
  scriviConConclusione('docs/btc-eth-limite.md', righe.join('\n') + '\n');
}
const CONFIG_TEXT = c => c.griglia.validita.join(', ');

main().catch(e => { console.error(e); process.exit(1); });

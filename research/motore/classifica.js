// Motore delle strategie lente: portafoglio con pesi decisi a date fisse, valutato ogni ora.
// Regole in docs/regola-fissata-classifica.md.
//   - Griglia oraria comune: ora h = T0 + h·1h. Ogni moneta ha open/close sulla griglia (NaN dove manca).
//   - Un "piano" all'ora h dice i pesi obiettivo (con segno, in frazione della base) e quali monete sono sottili.
//     Si esegue all'apertura dell'ora h: si scambia solo la differenza tra posizione attuale e obiettivo
//     (con `soloCambi` le monete con lo stesso peso del piano prima non si toccano).
//   - Base = esposizione × capitale iniziale (dimensione fissa) o × capitale del momento (interesse composto).
//   - Costi sul valore scambiato: commissione + slittamento (eseguito peggio del prezzo). Funding: all'orario reale del
//     pagamento, sul valore della posizione a quel momento (tasso positivo: i long pagano).
//   - Moneta senza più candele mentre è in portafoglio: si chiude all'ultimo prezzo noto. Ore senza candela: ultimo prezzo noto.
//   - Contabilità: cassa + Σ quantità × prezzo. Capitale ≤ 0: rovina, si chiude tutto e ci si ferma.
import { COMMISSIONE } from './costi.js';

export const ORA = 3600000;

/**
 * @param {object} p
 * @param {Map<string, {open: Float64Array, close: Float64Array, primo: number, ultimo: number, attiva: boolean, bitunix: boolean}>} p.monete griglia comune
 * @param {Map<string, number[][]>} p.funding pagamenti [ [ora_griglia_frazionaria, tasso], ... ] in ordine
 * @param {{h: number, pesi: Map<string, number>, sottili?: Set<string>}[]} p.piani in ordine di h
 * @param {number} p.da ora d'inizio (inclusa) · @param {number} p.a ora di fine: alla sua apertura si chiude tutto
 * @param {object} p.opz { esposizione, composto, slitt: {base, sottili}, capitale, soloCambi }
 */
export function simulaPortafoglio({ monete, funding, piani, da, a, opz }) {
  const { esposizione = 1, composto = false, slitt, capitale = 10000, soloCambi = false } = opz;
  let cassa = capitale, rovina = false;
  const pos = new Map(); // simbolo → { q (con segno), op, ultimoPrezzo }
  const ops = [];
  const curva = new Float64Array(a - da).fill(NaN);
  const puntF = new Map(); // indice del prossimo pagamento di funding per moneta
  const prezzo = (s, h, campo) => {
    const m = monete.get(s);
    const x = m[campo][h];
    if (x !== undefined && !Number.isNaN(x)) return x;
    const p = pos.get(s);
    return p ? p.ultimoPrezzo : NaN;
  };
  const slittDi = (s, sottili) => (sottili && sottili.has(s) ? slitt.sottili : slitt.base);
  const sottiliCorrenti = { set: null };
  const scambia = (s, nuovaQ, px, h, sl) => {
    let p = pos.get(s);
    const q0 = p ? p.q : 0;
    const dq = nuovaQ - q0;
    if (dq === 0) return;
    // se si cambia lato, prima si chiude l'operazione aperta
    if (p && q0 !== 0 && nuovaQ !== 0 && Math.sign(nuovaQ) !== Math.sign(q0)) { scambia(s, 0, px, h, sl); p = pos.get(s); return scambia(s, nuovaQ, px, h, sl); }
    const valore = Math.abs(dq) * px;
    const costo = valore * (COMMISSIONE + sl);
    cassa -= dq * px + costo;
    if (!p) {
      const m = monete.get(s);
      p = { q: 0, ultimoPrezzo: px, op: { simbolo: s, lato: Math.sign(nuovaQ), entrata: h, uscita: -1, flusso: 0, costi: 0, funding: 0, nozionale: valore, scambiato: 0, attiva: m.attiva, bitunix: m.bitunix } };
      pos.set(s, p);
      // primo pagamento di funding dopo l'apertura (quello all'orario esatto dell'apertura non tocca la nuova posizione)
      const f = funding.get(s);
      if (f) { let lo = 0, hi = f.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (f[mid][0] <= h) lo = mid + 1; else hi = mid; } puntF.set(s, lo); }
    }
    p.op.flusso -= dq * px; p.op.costi += costo; p.op.scambiato += valore;
    p.q = nuovaQ;
    if (nuovaQ === 0) {
      p.op.uscita = h;
      p.op.lordo = p.op.flusso; // a posizione chiusa il flusso è il guadagno sul prezzo
      p.op.netto = p.op.lordo - p.op.costi - p.op.funding;
      ops.push(p.op);
      pos.delete(s);
      puntF.delete(s);
    }
  };
  const valoreAperto = (h, campo) => { let v = 0; for (const [s, p] of pos) v += p.q * prezzo(s, h, campo); return v; };
  let iPiano = piani.findIndex(x => x.h >= da);
  if (iPiano < 0) iPiano = piani.length;
  let pesiPrima = new Map();
  for (let h = da; h < a; h++) {
    // 1. funding con orario dentro quest'ora, sulle posizioni tenute in quel momento
    for (const [s, p] of pos) {
      const f = funding.get(s);
      if (!f) continue;
      let i = puntF.get(s);
      while (i < f.length && f[i][0] < h + 1) {
        const pagato = f[i][1] * p.q * prezzo(s, h, 'open');
        cassa -= pagato; p.op.funding += pagato; i++;
      }
      puntF.set(s, i);
    }
    // 2. monete senza più candele: chiusura all'ultimo prezzo noto
    for (const [s, p] of [...pos]) if (h > monete.get(s).ultimo) scambia(s, 0, p.ultimoPrezzo, h, slittDi(s, sottiliCorrenti.set));
    // 3. piano di quest'ora: all'apertura
    if (iPiano < piani.length && piani[iPiano].h === h) {
      const pn = piani[iPiano++];
      sottiliCorrenti.set = pn.sottili || null;
      const capitaleOra = cassa + valoreAperto(h, 'open');
      const base = esposizione * (composto ? Math.max(0, capitaleOra) : capitale);
      const tutte = new Set([...pos.keys(), ...pn.pesi.keys()]);
      // prima le riduzioni, poi gli aumenti (l'ordine non cambia i conti, solo la leggibilità)
      for (const s of tutte) {
        const w = pn.pesi.get(s) || 0;
        if (soloCambi && pos.has(s) && w !== 0 && pesiPrima.get(s) === w) continue;
        const px = prezzo(s, h, 'open');
        if (Number.isNaN(px)) continue; // moneta senza prezzo: non si apre
        const q = w === 0 ? 0 : (w * base) / px;
        scambia(s, q, px, h, slittDi(s, pn.sottili));
      }
      pesiPrima = pn.pesi;
    }
    // 4. valutazione a fine ora
    for (const [s, p] of pos) { const c = monete.get(s).close[h]; if (!Number.isNaN(c)) p.ultimoPrezzo = c; }
    const cap = cassa + valoreAperto(h, 'close');
    curva[h - da] = cap;
    if (cap <= 0) {
      rovina = true;
      for (const [s, p] of [...pos]) scambia(s, 0, p.ultimoPrezzo, h, slittDi(s, sottiliCorrenti.set));
      curva.fill(cassa, h - da);
      break;
    }
  }
  if (!rovina) for (const [s] of [...pos]) { const px = prezzo(s, a, 'open'); scambia(s, 0, Number.isNaN(px) ? pos.get(s).ultimoPrezzo : px, a, slittDi(s, sottiliCorrenti.set)); }
  return { ops, curva, finale: cassa, rovina, capitale, da, a };
}

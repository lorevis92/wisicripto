// Orari di apertura delle sessioni, con l'ora legale gestita dal fuso orario vero (Intl).
// Il motore lavora sempre in millisecondi UTC.

export const SESSIONI = [
  { id: 'asia', nome: '00:00 UTC (Asia, chiusura giornaliera)', fuso: 'UTC', ora: 0, minuto: 0 },
  { id: 'europa', nome: '08:00 Londra (Europa)', fuso: 'Europe/London', ora: 8, minuto: 0 },
  { id: 'usa', nome: '9:30 New York (USA)', fuso: 'America/New_York', ora: 9, minuto: 30 },
];

const MIN = 60000, GIORNO = 86400000;
const formattatori = new Map();

// Scarto in minuti tra l'ora locale del fuso e UTC in un istante (es. Londra d'estate: +60)
export function scartoFuso(fuso, ms) {
  if (fuso === 'UTC') return 0;
  let f = formattatori.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    formattatori.set(fuso, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const locale = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((locale - Math.floor(ms / MIN) * MIN) / MIN);
}

// Istante UTC dell'apertura di una sessione nel giorno di calendario `giornoUtc` (mezzanotte UTC di quella data)
export function aperturaSessione(sessione, giornoUtc) {
  const comeSeUtc = giornoUtc + (sessione.ora * 60 + sessione.minuto) * MIN;
  let t = comeSeUtc - scartoFuso(sessione.fuso, comeSeUtc) * MIN;
  const s2 = scartoFuso(sessione.fuso, t); // ricontrollo vicino al cambio d'ora
  t = comeSeUtc - s2 * MIN;
  return t;
}

// Tutte le aperture tra `da` e `a` (ms UTC), in ordine di tempo.
// Ogni voce: { t, sessione (id), giorno (mezzanotte UTC), prossima (t dell'apertura successiva di qualunque sessione) }
export function calendarioSessioni(da, a, sessioni = SESSIONI) {
  const out = [];
  for (let g = Math.floor(da / GIORNO) * GIORNO - GIORNO; g <= a + GIORNO; g += GIORNO) {
    for (const s of sessioni) {
      const t = aperturaSessione(s, g);
      out.push({ t, sessione: s.id, giorno: Math.floor(t / GIORNO) * GIORNO });
    }
  }
  out.sort((x, y) => x.t - y.t);
  for (let i = 0; i < out.length - 1; i++) out[i].prossima = out[i + 1].t;
  return out.filter(x => x.t >= da && x.t < a && x.prossima !== undefined);
}

export const giornoSettimana = ms => new Date(ms).getUTCDay(); // 0 = domenica
export const fineSettimana = ms => { const d = giornoSettimana(ms); return d === 0 || d === 6; };

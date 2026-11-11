// Richieste HTTP con limite di velocità e tentativi ripetuti.
// Il throttle usa performance.now() (monotono), non Date.now().
import { performance } from 'node:perf_hooks';

export function creaLimitatore(richiesteAlSecondo) {
  const intervallo = 1000 / richiesteAlSecondo;
  let prossimo = 0;
  return async function attendiTurno() {
    const ora = performance.now();
    const turno = Math.max(ora, prossimo);
    prossimo = turno + intervallo;
    const attesa = turno - ora;
    if (attesa > 0) await new Promise(r => setTimeout(r, attesa));
  };
}

const pausa = ms => new Promise(r => setTimeout(r, ms));

// Scarica JSON con tentativi. Restituisce null se la risorsa non esiste (404).
export async function getJson(url, { limitatore, tentativi = 5 } = {}) {
  for (let t = 1; t <= tentativi; t++) {
    if (limitatore) await limitatore();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status === 418 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
      return await res.json();
    } catch (e) {
      if (t === tentativi) throw new Error(`${url}: ${e.message}`);
      await pausa(1000 * t * t);
    }
  }
}

// Scarica un file binario. null se 404.
export async function getBuffer(url, { limitatore, tentativi = 5 } = {}) {
  for (let t = 1; t <= tentativi; t++) {
    if (limitatore) await limitatore();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (t === tentativi) throw new Error(`${url}: ${e.message}`);
      await pausa(1000 * t * t);
    }
  }
}

// Esegue fn su ogni elemento con al massimo `n` lavori in parallelo.
export async function inParallelo(elementi, n, fn) {
  const risultati = new Array(elementi.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < elementi.length) {
      const k = i++;
      risultati[k] = await fn(elementi[k], k);
    }
  }));
  return risultati;
}

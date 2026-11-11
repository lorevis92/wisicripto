# Wisi Cripto

Strategia di trading automatica sui perpetual crypto di Bitunix. Part of the WiSiVERSE ecosystem.

**Fase attuale: 0 · ricerca.** Nessuna app ancora: script in `research/`, risultati in `docs/`.

## Cartelle
- `research/` — script Node.js per scaricare i dati e fare i backtest
- `docs/` — risultati della ricerca, in italiano semplice
- `data/` — dati scaricati (esclusa da git)

## Comandi (Fase 0)
- `npm run universo` — crypto operabili su Bitunix e presenti su Binance → `docs/universo.md`
- `npm run storico` — scarica lo storico a 1 minuto e il funding delle prime 50 in `data/binance/` → `docs/storico.md`
- `npm run confronto` — confronto minuto per minuto Bitunix/Binance delle ultime 3 settimane → `docs/bitunix-vs-binance.md`
- `npm run apertura` — backtest "apertura di sessione" (motore in `research/motore/`) → `docs/apertura-sessione.md`
- `npm run btc-eth-limite` — apertura USA su BTC ed ETH con entrata a ordine limite → `docs/btc-eth-limite.md`
- `npm run grande-movimento` — strategia 2, grande movimento con conferme → `docs/grande-movimento.md`
- `npm run fissa-regola` — fissa la regola del grande movimento usando solo il primo 70% → `docs/regola-fissata.md`
- `npm run verifica` — verifica la regola fissata su dati mai usati (2020–2022 e monete 51–100) → `docs/verifica-dati-nuovi.md`
- `npm run prova-motore` — controlli del motore su casi costruiti a mano

Nessuna dipendenza esterna: basta Node.js 20 o più recente.

## Piano
1. **Fase 0 · ricerca** — universo delle crypto operabili, storico, backtest "apertura di sessione", poi "grande movimento con conferma".
2. **Fase 1 · app** — Simulazione e Prova (React + Vite, Vercel, Supabase).
3. **Fase 2 · Reale** — poco capitale, margine isolato, stop dentro l'ordine.

Non è consulenza finanziaria. Il trading con leva può far perdere più del capitale investito.

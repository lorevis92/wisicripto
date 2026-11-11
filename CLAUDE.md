# Wisi Cripto — istruzioni per Claude Code

## Cos'è
Strategia di trading automatica sui perpetual crypto di Bitunix (USDT). Fa parte dell'ecosistema WiSiVERSE di Lorenzo.
Progetto completamente separato da Wisi Trade (repository lorevis92/Wisitrade), che è attivo e non va mai toccato.

## Fase attuale: Fase 0 · ricerca, senza app
- Script Node.js in `research/`, risultati in `docs/` in italiano semplice.
- Dati pesanti in `data/`, esclusa da git.
- Si passa alla Fase 1 (app con Simulazione e Prova) solo se una strategia regge sul 30% di verifica.

## Strategie da ricercare, in ordine
1. **Apertura di sessione**: rottura del movimento dall'apertura delle sessioni (Asia 00:00 UTC, Europa 07:00–08:00 UTC, USA 9:30 New York). È "Apertura USA" di Wisi Trade portata sulle crypto.
2. **Grande movimento di prezzo in qualsiasi momento**, con strumenti di conferma. Da definire dopo il primo test.

## Metodo dei test (obbligatorio)
- Mai dati futuri: ogni decisione usa solo candele già chiuse o il prezzo già visto.
- Uscite elaborate prima delle entrate nello stesso minuto. Un'uscita decisa a fine minuto si esegue all'apertura del minuto dopo, con slittamento.
- Percorso dentro la candela da 1 minuto: apertura→massimo→minimo→chiusura o apertura→minimo→massimo→chiusura, per capire cosa si tocca prima.
- Costi sempre dentro: commissione Bitunix circa 0,06% per lato, slittamento provato a 0,05% e 0,08% per lato, funding reale.
- Regole scelte sul primo 70% del periodo, verificate sul restante 30% senza cambiarle.
- Segnali simultanei con posti insufficienti: riportare sempre la media di 10 ordini casuali.
- Riportare sia dimensione fissa sia interesse composto.
- Attenzione alla correlazione con BTC: molte posizioni crypto sono una scommessa sola.

## Dati
- Storico: candele da 1 minuto dei perpetual USDT-M di Binance da data.binance.vision, più lo storico del funding.
- Bitunix (base https://fapi.bitunix.com): candele `GET /api/v1/futures/market/kline` (limit massimo 200, si scorre indietro), prezzi `GET /api/v1/futures/market/tickers`, coppie `GET /api/v1/futures/market/trading_pairs` con il campo `isApiSupported` (non tutti i contratti sono operabili via API).
- Limite di velocità Bitunix circa 10 richieste/s: restare intorno a 8/s con un throttle basato su `performance.now()`, non `Date.now()`.

## Per le fasi successive (non ora)
- Stack: React + Vite, Vercel, Supabase progetto "wisinvaders" con tabelle prefisso `wisi_cripto_` (mai toccare `wt_` o altre).
- Conto futures Bitunix condiviso con Wisi Trade e trading manuale: margine sempre ISOLATED, l'app gestisce solo le sue posizioni, stop dentro l'ordine d'apertura con verifica.
- Chiavi solo nelle variabili d'ambiente di Vercel, mai nel codice.

## Regole di lavoro
- Testi, documenti e commenti in italiano.
- A fine lavoro: commit e push su GitHub senza chiedere conferma.

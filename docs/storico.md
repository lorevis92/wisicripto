# Storico Binance a 1 minuto

Aggiornato il 2026-11-11. Script: `research/02-scarica-storico.js`. Lettura: `research/lib/storico.js`.

## Cosa c'è
- **50 crypto** (le prime 50 di `docs/universo.md`), candele da 1 minuto dei perpetual USDT-M di Binance dal **1 gennaio 2023** (o dalla quotazione, se più recente) fino al **2026-11-10** compreso.
- Fonte: `data.binance.vision` (file mensili; per il mese in corso file giornalieri), ogni file verificato con il suo checksum SHA-256.
- Funding: file mensili di `data.binance.vision` più l'API pubblica di Binance per le settimane più recenti.
- In totale 1.745 file mensili, 74.527.182 minuti attesi, **0 mancanti (0%)** dopo il recupero descritto sotto. 119.112 minuti hanno la candela ma zero scambi (0,16%).

### Recuperi
- I file mensili di Binance a volte non contengono un giorno intero che invece esiste nei file giornalieri: in quel caso il giorno è stato preso dal file giornaliero. Giorni recuperati così: 2026-10-28 (50 simboli).
- I minuti ancora mancanti sono stati chiesti all'API pubblica di Binance: 5.760 minuti recuperati, per XRPUSDT (1.440), XAUTUSDT (1.440), XLMUSDT (1.440), WUSDT (1.440). Di solito è l'ultimo giorno, il cui file giornaliero non è ancora pubblicato.

## Formato (in `data/binance/`, escluso da git)
- `klines/<SIMBOLO>/<AAAA-MM>.bin`: un file per mese, a colonne. Griglia fissa: la riga *i* è il minuto *inizio mese + i*. Prezzi (open, high, low, close) in Float64; volume, volume in USDT, numero di scambi e acquisti aggressivi in USDT in Float32. Un minuto mancante è NaN.
- `funding/<SIMBOLO>.json`: elenco `[orario_ms, tasso]` (tasso in frazione: 0.0001 = 0,01%).
- `manifesto.json`: cosa è stato scaricato, da dove, righe e problemi per ogni mese. `rapporto-buchi.json`: tutti i buchi.
- Per leggere: `leggiStorico('BTCUSDT', { da, a })` restituisce un'unica griglia continua con tutte le colonne. Rilanciare lo script aggiorna solo il mese in corso.

## Buchi e candele mancanti
Un minuto "mancante" è un minuto senza candela tra la prima e l'ultima candela del simbolo. "Propri" sono i minuti mancanti solo per quel simbolo, cioè non dovuti a un fermo generale di Binance. "Senza scambi" sono minuti con la candela ma volume zero: sulle monete grandi sono quasi tutti fermi di Binance, sulle piccole anche minuti in cui nessuno ha scambiato.

| Simbolo | Dal | Minuti attesi | Mancanti | Propri | Senza scambi | Buco più lungo | Funding (pagamenti) |
|---|---|---:|---:|---:|---:|---|---|
| BTCUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 244 | – | 4.232 (ogni 8h) |
| ETHUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 149 | – | 4.232 (ogni 8h) |
| SOLUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 150 | – | 4.232 (ogni 8h) |
| XRPUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 149 | – | 4.232 (ogni 8h) |
| ZECUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 4.128 | – | 4.232 (ogni 8h) |
| NEARUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 448 | – | 4.232 (ogni 8h) |
| HYPEUSDT | 2025-05-30 | 762.570 | 0 (0%) | 0 | 19 | – | 3.179 (ogni 4h/8h) |
| DOGEUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 151 | – | 4.232 (ogni 8h) |
| 1000PEPEUSDT | 2023-05-05 | 1.850.850 | 0 (0%) | 0 | 150 | – | 3.858 (ogni 8h) |
| SUIUSDT | 2023-05-03 | 1.853.760 | 0 (0%) | 0 | 155 | – | 3.864 (ogni 8h) |
| BNBUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 150 | – | 4.232 (ogni 8h) |
| LINKUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 152 | – | 4.232 (ogni 8h) |
| ENAUSDT | 2024-04-02 | 1.371.570 | 0 (0%) | 0 | 128 | – | 5.716 (ogni 4h/8h) |
| UNIUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 589 | – | 4.232 (ogni 8h) |
| QUSDT | 2025-09-02 | 625.950 | 0 (0%) | 0 | 3.112 | – | 2.673 (ogni 4h/1h/8h) |
| TAOUSDT | 2024-04-11 | 1.358.490 | 0 (0%) | 0 | 129 | – | 5.662 (ogni 4h/8h) |
| ADAUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 149 | – | 4.232 (ogni 8h) |
| WLDUSDT | 2023-07-24 | 1.735.920 | 0 (0%) | 0 | 150 | – | 3.618 (ogni 8h) |
| JCTUSDT | 2025-11-10 | 526.410 | 0 (0%) | 0 | 2.447 | – | 2.197 (ogni 4h) |
| XAUTUSDT | 2026-03-26 | 330.360 | 0 (0%) | 0 | 20 | – | 1.378 (ogni 4h/8h) |
| AVAXUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 157 | – | 4.232 (ogni 8h) |
| STRKUSDT | 2024-02-20 | 1.431.780 | 0 (0%) | 0 | 1.172 | – | 5.968 (ogni 4h/8h) |
| AKEUSDT | 2025-09-26 | 591.090 | 0 (0%) | 0 | 1.485 | – | 2.492 (ogni 4h/1h/8h) |
| ONDOUSDT | 2024-01-20 | 1.476.660 | 0 (0%) | 0 | 132 | – | 6.154 (ogni 4h/8h) |
| BCHUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 172 | – | 4.232 (ogni 8h) |
| AAVEUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 486 | – | 4.232 (ogni 8h) |
| FILUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 221 | – | 4.232 (ogni 8h) |
| AINUSDT | 2025-07-10 | 703.515 | 0 (0%) | 0 | 5.205 | – | 2.933 (ogni 4h/8h) |
| IRYSUSDT | 2025-11-26 | 503.040 | 0 (0%) | 0 | 9.386 | – | 2.264 (ogni 4h/1h) |
| BTWUSDT | 2026-06-04 | 229.545 | 0 (0%) | 0 | 2 | – | 958 (ogni 4h/8h) |
| INJUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 978 | – | 4.232 (ogni 8h) |
| HBARUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 776 | – | 4.232 (ogni 8h) |
| TRUMPUSDT | 2025-01-18 | 952.500 | 0 (0%) | 0 | 34 | – | 3.970 (ogni 4h/8h) |
| ARBUSDT | 2023-03-23 | 1.912.859 | 0 (0%) | 0 | 153 | – | 3.988 (ogni 8h) |
| LTCUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 152 | – | 4.232 (ogni 8h) |
| TIAUSDT | 2023-10-31 | 1.593.000 | 0 (0%) | 0 | 136 | – | 6.639 (ogni 4h/8h) |
| EVAAUSDT | 2025-10-03 | 581.128 | 0 (0%) | 0 | 1.809 | – | 2.423 (ogni 4h/8h) |
| XMRUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 894 | – | 4.232 (ogni 8h) |
| QNTUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 8.889 | – | 4.232 (ogni 8h) |
| ONEUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 20.085 | – | 4.612 (ogni 8h/1h/4h) |
| DOTUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 165 | – | 4.232 (ogni 8h) |
| XPLUSDT | 2025-08-22 | 641.670 | 0 (0%) | 0 | 21 | – | 2.675 (ogni 4h/8h) |
| GTCUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 15.259 | – | 4.348 (ogni 8h/4h/1h) |
| ICNTUSDT | 2025-07-03 | 713.460 | 0 (0%) | 0 | 8.048 | – | 2.975 (ogni 4h/8h) |
| ARIAUSDT | 2025-09-03 | 624.300 | 0 (0%) | 0 | 4.148 | – | 2.718 (ogni 4h/1h/3h) |
| IDOLUSDT | 2025-07-04 | 712.245 | 0 (0%) | 0 | 9.815 | – | 2.969 (ogni 4h/8h) |
| XLMUSDT | 2023-01-01 | 2.030.400 | 0 (0%) | 0 | 442 | – | 4.232 (ogni 8h) |
| APRUSDT | 2025-10-23 | 552.330 | 0 (0%) | 0 | 1.591 | – | 2.304 (ogni 4h/8h) |
| DOODUSDT | 2025-05-09 | 792.630 | 0 (0%) | 0 | 10.791 | – | 4.520 (ogni 4h/1h/3h) |
| WUSDT | 2024-04-03 | 1.369.950 | 0 (0%) | 0 | 3.739 | – | 5.710 (ogni 4h/8h) |

### Fermi generali di Binance
Minuti mancanti o senza scambi per almeno metà dei simboli già quotati, da 2 minuti in su. Binance in questi momenti era in manutenzione o bloccata: prezzo fermo, nessuno scambio.
- 2023-09-12 08:34 UTC · 19 min
- 2023-11-14 11:39 UTC · 3 min
- 2024-10-28 16:21 UTC · 14 min
- 2024-10-28 20:00 UTC · 1,2 ore
- 2025-01-14 13:32 UTC · 2 min
- 2025-01-29 01:23 UTC · 13 min
- 2025-01-29 02:41 UTC · 4 min
- 2025-08-29 06:18 UTC · 19 min

### Altre anomalie
- Nessuna: nessuna candela doppia o fuori orario.

## Cosa significa per i backtest
- I minuti mancanti sono pochissimi: nei backtest un minuto mancante si tratta come "nessun prezzo visto" (nessuna entrata, uscite rimandate al primo minuto disponibile, al suo prezzo d'apertura con slittamento).
- Durante i fermi generali di Binance le candele sono piatte e senza volume, ma Bitunix potrebbe essersi mosso: niente entrate in quei minuti, e i trade aperti in quei momenti vanno segnalati nei risultati.
- Alcune monete hanno lo storico breve perché quotate da poco: per la regola 70/30 conviene usare il periodo comune, o pesarle meno.
- Il funding cambia intervallo (8h, 4h, a volte 1h) quando il mercato è teso: va applicato all'orario reale di ogni pagamento, non a orari fissi.

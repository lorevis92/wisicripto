# Universo delle crypto operabili

Aggiornato il 2026-11-11. Script: `research/01-universo.js`. Dati completi: `data/universo.json` (non su GitHub).

## In breve
- Bitunix ha **794 contratti**, di cui **754 in USDT**.
- Di questi, **236 non sono crypto** (azioni, ETF, materie prime, indici): esclusi. 47 di loro sarebbero comunque operabili via API.
- Restano **517 perpetual crypto in USDT attivi** (più 1 ancora in anteprima, non negoziabili):
  - **517 operabili via API** (`isApiSupported = true`)
  - **0 non operabili via API**
- Dei 517 operabili via API, **492 esistono anche su Binance** (perpetual USDT-M attivo, stesso prezzo). 24 sono solo su Bitunix; 1 su Binance è in chiusura o già chiuso (RAYUSDT).
- I primi 50 fanno il **95%** del volume Bitunix dei 492 contratti utilizzabili: la liquidità è molto concentrata.

## Come leggere la tabella
- **Volume**: media giornaliera in milioni di USDT sugli ultimi 30 giorni completi (candele giornaliere).
- **Bitunix/Binance**: quanto è grande il volume di Bitunix rispetto a quello di Binance.
- **Q.min**: quantità minima d'ordine in unità della moneta. **Precisione**: decimali di quantità / prezzo.
- **Spread**: differenza tra miglior acquisto e miglior vendita su Bitunix, in punti base (1 pb = 0,01%), mediana di 3 fotografie del book a 2 minuti di distanza. È una stima istantanea, non una media storica.
- **Prof. 0,1%**: migliaia di USDT disponibili nel book entro lo 0,1% dal prezzo medio (il lato più sottile). Indica quanto si può comprare o vendere a mercato senza spostare il prezzo di più dello 0,1%. È una fotografia: prenderla come ordine di grandezza.
- **Su Binance dal**: data di quotazione su Binance, quindi inizio dello storico disponibile.

## Le prime 50 per liquidità su Bitunix

| # | Simbolo | Vol. Bitunix (mln) | Vol. Binance (mln) | Bitunix/Binance | Leva max | Q.min | Precisione | Spread (pb) | Prof. 0,1% (mila USDT) | Su Binance dal |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|---|
| 1 | BTCUSDT | 2.121 | 10.992 | 19% | 200x | 0.0001 | 4 / 1 | 0,01 | 6.824 | 2019-09-08 |
| 2 | ETHUSDT | 1.195 | 7.816 | 15% | 200x | 0.003 | 3 / 2 | 0,05 | 4.918 | 2019-11-27 |
| 3 | SOLUSDT | 279 | 1.509 | 18% | 100x | 0.1 | 2 / 2 | 1,2 | 4.738 | 2020-09-14 |
| 4 | XRPUSDT | 110 | 659 | 17% | 100x | 2 | 1 / 4 | 0,9 | 1.048 | 2020-01-06 |
| 5 | ZECUSDT | 77,7 | 1.810 | 4% | 75x | 0.006 | 3 / 2 | 0,1 | 243 | 2020-02-05 |
| 6 | NEARUSDT | 39,3 | 598 | 7% | 50x | 10 | 0 / 3 | 2,7 | 112 | 2020-10-15 |
| 7 | HYPEUSDT | 38,6 | 664 | 6% | 75x | 0.1 | 2 / 3 | 0,14 | 396 | 2025-05-30 |
| 8 | DOGEUSDT | 28,7 | 309 | 9% | 75x | 53 | 0 / 5 | 1,5 | 1.125 | 2020-07-10 |
| 9 | 1000PEPEUSDT | 24,9 | 372 | 7% | 75x | 790 | 0 / 7 | 0,19 | 301 | 2023-05-05 |
| 10 | SUIUSDT | 21,8 | 194 | 11% | 75x | 10 | 1 / 4 | 1,2 | 1.120 | 2023-05-03 |
| 11 | BNBUSDT | 21,6 | 354 | 6% | 75x | 0.01 | 2 / 2 | 0,15 | 2.095 | 2020-02-10 |
| 12 | LINKUSDT | 20 | 121 | 17% | 75x | 0.1 | 2 / 3 | 1 | 1.068 | 2020-01-17 |
| 13 | ENAUSDT | 15,1 | 258 | 6% | 75x | 10 | 0 / 5 | 0,7 | 76 | 2024-04-02 |
| 14 | UNIUSDT | 12,1 | 200 | 6% | 75x | 2 | 0 / 3 | 1,5 | 18 | 2020-09-18 |
| 15 | QUSDT | 12 | 246 | 5% | 10x | 10 | 0 / 5 | 12,4 | 6 | 2025-09-02 |
| 16 | TAOUSDT | 11 | 98,4 | 11% | 75x | 0.02 | 3 / 2 | 0,45 | 86 | 2024-04-11 |
| 17 | ADAUSDT | 10,7 | 132 | 8% | 75x | 15 | 0 / 4 | 5,7 | 284 | 2020-01-31 |
| 18 | WLDUSDT | 10,7 | 218 | 5% | 75x | 6 | 0 / 4 | 3,2 | 30 | 2023-07-24 |
| 19 | JCTUSDT | 10,6 | 252 | 4% | 40x | 800 | 0 / 6 | 1,6 | 6 | 2025-11-10 |
| 20 | XAUTUSDT | 9,4 | 39,5 | 24% | 75x | 0.01 | 3 / 2 | 0,02 | 862 | 2026-03-26 |
| 21 | AVAXUSDT | 8,9 | 120 | 7% | 75x | 1 | 0 / 3 | 1,2 | 1.397 | 2020-09-23 |
| 22 | STRKUSDT | 7,8 | 110 | 7% | 50x | 8 | 1 / 5 | 2,7 | 92 | 2024-02-20 |
| 23 | AKEUSDT | 7,7 | 132 | 6% | 50x | 1 | 0 / 6 | 3,9 | 4 | 2025-09-26 |
| 24 | ONDOUSDT | 7,5 | 75,9 | 10% | 75x | 20 | 1 / 4 | 2,7 | 91 | 2024-01-20 |
| 25 | BCHUSDT | 6,7 | 80,4 | 8% | 75x | 0.1 | 3 / 2 | 1,3 | 231 | 2019-12-19 |
| 26 | AAVEUSDT | 6,4 | 96,2 | 7% | 75x | 0.1 | 1 / 2 | 0,8 | 33 | 2020-10-16 |
| 27 | FILUSDT | 6,4 | 110 | 6% | 75x | 2 | 1 / 4 | 1,3 | 142 | 2020-10-16 |
| 28 | AINUSDT | 6,3 | 111 | 6% | 50x | 10 | 0 / 5 | 0,9 | 2 | 2025-07-10 |
| 29 | IRYSUSDT | 5,9 | 161 | 4% | 20x | 10 | 0 / 5 | 5,7 | 8 | 2025-11-26 |
| 30 | BTWUSDT | 5,8 | 157 | 4% | 10x | 5 | 0 / 4 | 7,1 | 5 | 2026-06-04 |
| 31 | INJUSDT | 5,4 | 99,4 | 5% | 25x | 0.8 | 1 / 3 | 1,2 | 42 | 2022-08-16 |
| 32 | HBARUSDT | 5,3 | 37,2 | 14% | 75x | 100 | 0 / 5 | 1,5 | 156 | 2021-03-17 |
| 33 | TRUMPUSDT | 5 | 89,7 | 6% | 75x | 0.2 | 2 / 3 | 8,9 | 74 | 2025-01-18 |
| 34 | ARBUSDT | 4,7 | 83,9 | 6% | 50x | 9 | 1 / 5 | 0,6 | 37 | 2023-03-23 |
| 35 | LTCUSDT | 4,7 | 65,2 | 7% | 75x | 0.053 | 3 / 2 | 2 | 272 | 2020-01-09 |
| 36 | TIAUSDT | 4,5 | 84,4 | 5% | 50x | 1 | 0 / 4 | 20,8 | 0 | 2023-10-31 |
| 37 | EVAAUSDT | 4,4 | 53 | 8% | 50x | 1.5 | 1 / 4 | 0,9 | 5 | 2025-10-03 |
| 38 | XMRUSDT | 4,3 | 70,9 | 6% | 50x | 0.082 | 3 / 2 | 0,18 | 62 | 2020-02-03 |
| 39 | QNTUSDT | 4,2 | 87,3 | 5% | 20x | 0.1 | 1 / 2 | 0,6 | 5 | 2022-10-18 |
| 40 | ONEUSDT | 4,2 | 49,3 | 9% | 25x | 370 | 0 / 7 | 0,6 | 23 | 2021-03-17 |
| 41 | DOTUSDT | 4 | 51,4 | 8% | 75x | 0.8 | 1 / 4 | 1,2 | 105 | 2020-08-22 |
| 42 | XPLUSDT | 3,8 | 39,4 | 10% | 75x | 10 | 0 / 5 | 1,9 | 21 | 2025-08-22 |
| 43 | GTCUSDT | 3,4 | 69 | 5% | 20x | 5 | 1 / 5 | 8,2 | 2 | 2021-03-15 |
| 44 | ICNTUSDT | 3,2 | 52,4 | 6% | 50x | 12 | 0 / 4 | 3,5 | 6 | 2025-07-03 |
| 45 | ARIAUSDT | 3 | 45,8 | 7% | 50x | 50 | 0 / 5 | 21 | 0 | 2025-09-03 |
| 46 | IDOLUSDT | 2,9 | 91 | 3% | 20x | 360 | 0 / 6 | 6,1 | 4 | 2025-07-04 |
| 47 | XLMUSDT | 2,9 | 41,9 | 7% | 75x | 80 | 0 / 5 | 0,7 | 56 | 2020-01-20 |
| 48 | APRUSDT | 2,8 | 74,5 | 4% | 25x | 1 | 0 / 5 | 8,4 | 8 | 2025-10-23 |
| 49 | DOODUSDT | 2,7 | 77,9 | 3% | 50x | 1250 | 0 / 6 | 6,2 | 16 | 2025-05-09 |
| 50 | WUSDT | 2,7 | 44,5 | 6% | 50x | 10 | 1 / 6 | 0,9 | 22 | 2024-04-03 |

## Dalla 51ª alla 100ª
51. BATUSDT — 2,6 mln/giorno, spread 0,8 pb
52. BEAMXUSDT — 2,6 mln/giorno, spread 2,3 pb
53. TRXUSDT — 2,6 mln/giorno, spread 0,31 pb
54. ZROUSDT — 2,5 mln/giorno, spread 0,6 pb
55. ESPORTSUSDT — 2,5 mln/giorno, spread 1,1 pb
56. INITUSDT — 2,5 mln/giorno, spread 3,9 pb
57. FETUSDT — 2,5 mln/giorno, spread 6,8 pb
58. PENGUUSDT — 2,5 mln/giorno, spread 1,6 pb
59. FARTCOINUSDT — 2,5 mln/giorno, spread 8,7 pb
60. BRUSDT — 2,4 mln/giorno, spread 6,4 pb
61. BIRBUSDT — 2,4 mln/giorno, spread 9,1 pb
62. PAXGUSDT — 2,4 mln/giorno, spread 0,02 pb
63. CAPUSDT — 2,1 mln/giorno, spread 1 pb
64. BMTUSDT — 2,1 mln/giorno, spread 4,5 pb
65. APTUSDT — 2 mln/giorno, spread 1,7 pb
66. IOSTUSDT — 2 mln/giorno, spread 1,5 pb
67. SANDUSDT — 1,9 mln/giorno, spread 7,1 pb
68. UAIUSDT — 1,9 mln/giorno, spread 13,3 pb
69. MAGMAUSDT — 1,9 mln/giorno, spread 6 pb
70. ZEREBROUSDT — 1,8 mln/giorno, spread 10,5 pb
71. RSRUSDT — 1,8 mln/giorno, spread 6,4 pb
72. CRVUSDT — 1,8 mln/giorno, spread 20,1 pb
73. MAGICUSDT — 1,8 mln/giorno, spread 1,2 pb
74. ASTERUSDT — 1,8 mln/giorno, spread 1,6 pb
75. GRASSUSDT — 1,8 mln/giorno, spread 2,2 pb
76. HOTUSDT — 1,7 mln/giorno, spread 2,4 pb
77. RENDERUSDT — 1,7 mln/giorno, spread 6,3 pb
78. OPUSDT — 1,6 mln/giorno, spread 1 pb
79. ORDERUSDT — 1,6 mln/giorno, spread 6,6 pb
80. ERAUSDT — 1,6 mln/giorno, spread 9,9 pb
81. ATOMUSDT — 1,6 mln/giorno, spread 7,1 pb
82. CTUSDT — 1,6 mln/giorno, spread 1,9 pb
83. ICPUSDT — 1,6 mln/giorno, spread 3,9 pb
84. 1000SHIBUSDT — 1,6 mln/giorno, spread 2,3 pb
85. SUSDT — 1,5 mln/giorno, spread 2,7 pb
86. STXUSDT — 1,5 mln/giorno, spread 3,1 pb
87. ALGOUSDT — 1,5 mln/giorno, spread 1,1 pb
88. PYTHUSDT — 1,5 mln/giorno, spread 1,5 pb
89. CLANKERUSDT — 1,4 mln/giorno, spread 7,5 pb
90. SIRENUSDT — 1,4 mln/giorno, spread 3,7 pb
91. USELESSUSDT — 1,4 mln/giorno, spread 0,7 pb
92. PONSUSDT — 1,4 mln/giorno, spread 6,5 pb
93. AEROUSDT — 1,4 mln/giorno, spread 1,8 pb
94. LSKUSDT — 1,4 mln/giorno, spread 5,5 pb
95. KASUSDT — 1,3 mln/giorno, spread 3,4 pb
96. WALUSDT — 1,3 mln/giorno, spread 3,6 pb
97. USUSDT — 1,3 mln/giorno, spread 2,6 pb
98. CYBERUSDT — 1,3 mln/giorno, spread 3,7 pb
99. ELSAUSDT — 1,2 mln/giorno, spread 1,5 pb
100. JUPUSDT — 1,2 mln/giorno, spread 3,9 pb

## Note
- Bitunix non dà una "categoria" per i contratti: le azioni e gli ETF sono riconosciuti incrociando con Binance (che li marca come TradFi) e, per quelli solo su Bitunix, controllandoli a mano.
- Con spread di un tick (BTC, ETH, ecc.) il costo vero è commissione più slittamento; sulle monete più piccole anche lo spread pesa.
- Il funding di Bitunix e quello di Binance non sono identici. Nei backtest si userà lo storico di Binance: vedi `docs/bitunix-vs-binance.md`.

# Dimensione delle posizioni e slittamento

Strategia "grande movimento", regola fissata (docs/regola-fissata.md), operazioni della verifica su dati mai usati (docs/verifica-dati-nuovi.md).
Script: `research/09-dimensione-posizione.js`. Operazioni: 2.989.

**Come si legge.**
- Il test usa 10.000 USDT di capitale, 10% di margine per posizione e leva 3x: ogni posizione vale **3.000 USDT** (5.000 con leva 5x).
- Il volume del minuto d'entrata viene dai dati Binance.
- Bitunix, dove si opera davvero, ha molto meno volume: la stima Bitunix moltiplica il volume Binance del minuto per il rapporto Bitunix/Binance dei 30 giorni misurati in docs/universo.md.
- È una stima: quel rapporto è di oggi e cambia nel tempo.

## 1. Quanto pesa la posizione sul volume del minuto d'entrata

Dimensione fissa, leva 3x (3.000 USDT per posizione), solo le operazioni prese dal portafoglio.

Gruppo | Operazioni | Volume Binance al minuto, mediana dell'ora prima | Volume Binance del minuto d'entrata (mediana) | Entrata / ora prima | Posizione / volume Binance (mediana) | (90° percentile) | Posizione / volume Bitunix stimato (mediana) | (90° percentile) | Operazioni oltre l'1% del volume Bitunix
---|---:|---:|---:|---:|---:|---:|---:|---:|---:
| A (2020–2022) | 626 | 210.908 | 2,2 mln | 9,8× | 0,14% | 1,61% | 1,8% | 23,0% | 60% |
| B (monete 51–100) | 0 | – | – | –× | – | – | – | – | – |
| A + B | 626 | 210.908 | 2,2 mln | 9,8× | 0,14% | 1,61% | 1,8% | 23,0% | 60% |

Il minuto d'entrata ha di solito molto più volume del normale: la posizione entra nel momento in cui il mercato è più attivo.

**Con altre dimensioni** (tutte le operazioni, stessa posizione per tutte):

Valore della posizione (USDT) | Posizione / volume Bitunix stimato (mediana) | (90° percentile) | Operazioni oltre l'1% | Operazioni oltre il 5%
---:|---:|---:|---:|---:
1.000 | 1,7% | 18,6% | 63% | 28%
3.000 | 5,2% | 55,9% | 84% | 51%
5.000 | 8,6% | 93,2% | 90% | 63%
10.000 | 17,2% | 186,4% | 94% | 78%
25.000 | 43,0% | 466,1% | 98% | 90%
50.000 | 86,0% | 932,2% | 100% | 94%
100.000 | 172,0% | 1.864,4% | 100% | 98%

**Interesse composto** (leva 3x): la posizione segue il capitale. Se il capitale cresce, la posizione supera presto quello che il mercato può assorbire.

Anno | Valore mediano della posizione | Posizione / volume Bitunix stimato (mediana) | Operazioni oltre l'1%
---|---:|---:|---:
2020 | 2.873 | 5,8% | 85%
2021 | 1.821 | 0,4% | 31%
2022 | 1.304 | 0,8% | 44%
2023 | 879 | 1,2% | 56%
2024 | 628 | 0,9% | 43%
2025 | 510 | 1,5% | 59%
2026 | 254 | 1,5% | 57%

## 2. Quanto slittamento sopporta la regola

Portafoglio A + B, dimensione fissa, leva 3x, slittamento uguale per tutte le monete, per lato (entrata e uscita). Media di 3 ordini casuali.

Slittamento per lato | Rendimento | Profit factor | Peggior calo
---:|---:|---:|---:
0,05% | -100,1% | 0,58 | 100,1%
0,10% | -100,7% | 0,47 | 100,6%
0,15% | -103,3% | 0,42 | 103,0%
0,20% | -100,2% | 0,39 | 100,2%
0,25% | -100,4% | 0,37 | 100,4%
0,30% | -100,2% | 0,34 | 100,2%
0,35% | -103,2% | 0,32 | 103,1%
0,40% | -101,6% | 0,29 | 101,6%
0,45% | -100,3% | 0,20 | 100,3%
0,50% | -100,4% | 0,18 | 100,4%
0,55% | -102,6% | 0,17 | 102,6%
0,60% | -100,0% | 0,16 | 100,0%

**Nessun pareggio: la regola perde già con lo slittamento più basso provato (0,05% per lato).**

## 3. Dimensione massima per posizione, moneta per moneta

**Il modello.**
- Un ordine a mercato di valore Q consuma il book. Se il book è distribuito in modo uniforme, il prezzo medio peggiora di metà spread più 0,05% × Q / profondità.
- La profondità è quella misurata su Bitunix entro lo 0,1% dal prezzo, sul lato più sottile, in un momento tranquillo (docs/universo.md).
- "Book dimezzato" è l'ipotesi prudente per i primi minuti di un'esplosione, quando il book si svuota.
- La tabella dà il valore massimo della posizione per restare allo 0,08% (il valore usato nei test) o allo 0,12% (la prova pesante).
- La colonna "Ordine a mercato massimo" è il limite di Bitunix per un singolo ordine a mercato.

Moneta | Gruppo | Operazioni | Volume Bitunix al giorno | Profondità 0,1% | Spread | Max per 0,08% (book calmo) | Max per 0,08% (book dimezzato) | Max per 0,12% (book dimezzato) | Ordine a mercato massimo
---|---|---:|---:|---:|---:|---:|---:|---:|---:
CRVUSDT | B | 49 | 1,8 mln | 0 | 20,1 bps | 0 | 0 | 0 | 74.160
UAIUSDT | B | 40 | 1,9 mln | 939 | 13,3 bps | 255 | 128 | 503 | 30.104
ZEREBROUSDT | B | 54 | 1,8 mln | 1.056 | 10,5 bps | 585 | 293 | 715 | 477
GTCUSDT | A | 35 | 3,4 mln | 1.563 | 8,2 bps | 1.220 | 610 | 1.235 | 23.678
USUSDT | B | 32 | 1,3 mln | 1.305 | 2,6 bps | 1.755 | 877 | 1.400 | 19.595
BIRBUSDT | B | 23 | 2,4 mln | 3.424 | 9,1 bps | 2.367 | 1.184 | 2.553 | 23.262
AEROUSDT | B | 17 | 1,4 mln | 1.994 | 1,8 bps | 2.828 | 1.414 | 2.212 | 21.908
ERAUSDT | B | 32 | 1,6 mln | 5.104 | 9,9 bps | 3.123 | 1.561 | 3.603 | 8.281
CLANKERUSDT | B | 20 | 1,4 mln | 4.890 | 7,5 bps | 4.174 | 2.087 | 4.043 | 6.695
ESPORTSUSDT | B | 51 | 2,5 mln | 2.959 | 1,1 bps | 4.404 | 2.202 | 3.386 | 8.950
ORDERUSDT | B | 30 | 1,6 mln | 4.956 | 6,6 bps | 4.655 | 2.328 | 4.310 | 18.150
CTUSDT | B | 1 | 1,6 mln | 3.883 | 1,9 bps | 5.462 | 2.731 | 4.284 | 6.829
BRUSDT | B | 53 | 2,4 mln | 6.259 | 6,4 bps | 6.002 | 3.001 | 5.505 | 233.600
MAGMAUSDT | B | 22 | 1,9 mln | 6.225 | 6,0 bps | 6.195 | 3.097 | 5.587 | 74.343
QNTUSDT | A | 3 | 4,2 mln | 4.618 | 0,6 bps | 7.131 | 3.566 | 5.413 | 178.790
ELSAUSDT | B | 16 | 1,2 mln | 5.832 | 1,5 bps | 8.442 | 4.221 | 6.554 | 23.037
PONSUSDT | B | 1 | 1,4 mln | 8.966 | 6,5 bps | 8.510 | 4.255 | 7.841 | 15.280
SIRENUSDT | B | 62 | 1,4 mln | 7.003 | 3,7 bps | 8.584 | 4.292 | 7.093 | 26.640
INITUSDT | B | 26 | 2,5 mln | 7.384 | 3,9 bps | 8.914 | 4.457 | 7.411 | 6.052
FETUSDT | B | 48 | 2,5 mln | 10.030 | 6,8 bps | 9.250 | 4.625 | 8.637 | 36.750
LSKUSDT | B | 69 | 1,4 mln | 8.871 | 5,5 bps | 9.346 | 4.673 | 8.222 | 3.304
ATOMUSDT | B | 47 | 1,6 mln | 10.601 | 7,1 bps | 9.477 | 4.739 | 8.979 | 28.300
PENGUUSDT | B | 13 | 2,5 mln | 9.361 | 1,6 bps | 13.479 | 6.739 | 10.484 | 31.135
USELESSUSDT | B | 5 | 1,4 mln | 10.024 | 0,7 bps | 15.320 | 7.660 | 11.670 | 111.448
BATUSDT | B | 75 | 2,6 mln | 10.171 | 0,8 bps | 15.439 | 7.719 | 11.788 | 72.996
BMTUSDT | B | 48 | 2,1 mln | 13.623 | 4,5 bps | 15.713 | 7.857 | 13.306 | 17.912
CYBERUSDT | B | 69 | 1,3 mln | 14.569 | 3,7 bps | 17.859 | 8.929 | 14.757 | 2.665
KASUSDT | B | 35 | 1,3 mln | 15.133 | 3,4 bps | 19.139 | 9.569 | 15.622 | 89.430
IOSTUSDT | B | 96 | 2,0 mln | 13.451 | 1,5 bps | 19.494 | 9.747 | 15.127 | 19.770
SANDUSDT | B | 73 | 1,9 mln | 22.266 | 7,1 bps | 19.859 | 9.929 | 18.836 | 21.165
WALUSDT | B | 26 | 1,3 mln | 19.198 | 3,6 bps | 23.820 | 11.910 | 19.589 | 556
UNIUSDT | A | 35 | 12,1 mln | 17.507 | 1,5 bps | 25.299 | 12.650 | 19.652 | 160.900
RSRUSDT | B | 66 | 1,8 mln | 29.288 | 6,4 bps | 28.140 | 14.070 | 25.785 | 38.900
FARTCOINUSDT | B | 21 | 2,5 mln | 39.677 | 8,7 bps | 29.146 | 14.573 | 30.444 | 57.600
CAPUSDT | B | 14 | 2,1 mln | 19.932 | 1,0 bps | 29.887 | 14.944 | 22.916 | 298.740
GRASSUSDT | B | 21 | 1,8 mln | 23.643 | 2,2 bps | 32.695 | 16.347 | 25.805 | 4.585
STXUSDT | B | 47 | 1,5 mln | 26.384 | 3,1 bps | 33.937 | 16.969 | 27.522 | 31.740
ONEUSDT | A | 23 | 4,2 mln | 22.601 | 0,6 bps | 34.749 | 17.375 | 26.415 | 24.203
MAGICUSDT | B | 83 | 1,8 mln | 24.518 | 1,2 bps | 36.321 | 18.160 | 27.968 | 4.209
ALGOUSDT | B | 52 | 1,5 mln | 24.752 | 1,1 bps | 36.873 | 18.437 | 28.337 | 45.200
SUSDT | B | 22 | 1,5 mln | 37.535 | 2,7 bps | 49.981 | 24.990 | 40.004 | 1.855
AAVEUSDT | A | 26 | 6,4 mln | 32.938 | 0,8 bps | 50.040 | 25.020 | 38.195 | 154.550
INJUSDT | A | 7 | 5,4 mln | 41.526 | 1,2 bps | 61.396 | 30.698 | 47.309 | 205.850
ICPUSDT | B | 51 | 1,6 mln | 53.941 | 3,9 bps | 65.214 | 32.607 | 54.183 | 25.470
JUPUSDT | B | 26 | 1,2 mln | 54.199 | 3,9 bps | 65.658 | 32.829 | 54.509 | 12.815
ZROUSDT | B | 20 | 2,5 mln | 44.466 | 0,6 bps | 68.302 | 34.151 | 51.938 | 93.744
OPUSDT | B | 56 | 1,6 mln | 55.530 | 1,0 bps | 83.271 | 41.635 | 63.847 | 9.927
XLMUSDT | A | 54 | 2,9 mln | 55.998 | 0,7 bps | 85.758 | 42.879 | 65.278 | 145.370
RENDERUSDT | B | 16 | 1,7 mln | 92.044 | 6,3 bps | 89.472 | 44.736 | 81.554 | 318.200
BEAMXUSDT | B | 36 | 2,6 mln | 67.766 | 2,3 bps | 92.791 | 46.396 | 73.502 | 108.250
XMRUSDT | A | 44 | 4,3 mln | 62.355 | 0,2 bps | 98.674 | 49.337 | 74.279 | 1,1 mln
PYTHUSDT | B | 36 | 1,5 mln | 76.884 | 1,5 bps | 111.756 | 55.878 | 86.632 | 4.771
NEARUSDT | A | 33 | 39,3 mln | 111.612 | 2,7 bps | 147.954 | 73.977 | 118.622 | 87.288
HOTUSDT | B | 101 | 1,7 mln | 111.589 | 2,4 bps | 151.709 | 75.854 | 120.490 | 41.470
DOTUSDT | A | 33 | 4,0 mln | 105.284 | 1,2 bps | 155.914 | 77.957 | 120.071 | 41.905
1000SHIBUSDT | B | 76 | 1,6 mln | 119.748 | 2,3 bps | 164.647 | 82.324 | 130.223 | 221.800
FILUSDT | A | 62 | 6,4 mln | 142.160 | 1,3 bps | 208.850 | 104.425 | 161.289 | 5.715
HBARUSDT | A | 26 | 5,3 mln | 156.415 | 1,5 bps | 226.455 | 113.228 | 175.794 | 65.560
APTUSDT | B | 54 | 2,0 mln | 172.444 | 1,7 bps | 245.776 | 122.888 | 191.866 | 11.418
ASTERUSDT | B | 26 | 1,8 mln | 195.544 | 1,6 bps | 282.457 | 141.229 | 219.446 | 128.460
ADAUSDT | A | 60 | 10,7 mln | 283.764 | 5,7 bps | 292.102 | 146.051 | 259.557 | 175.100
BCHUSDT | A | 58 | 6,7 mln | 231.438 | 1,3 bps | 340.118 | 170.059 | 262.634 | 195.313
TRXUSDT | B | 75 | 2,6 mln | 217.193 | 0,3 bps | 340.669 | 170.334 | 257.212 | 1,6 mln
LTCUSDT | A | 57 | 4,7 mln | 271.901 | 2,0 bps | 381.491 | 190.746 | 299.506 | 253.700
ZECUSDT | A | 50 | 77,7 mln | 243.243 | 0,1 bps | 386.752 | 193.376 | 290.673 | 499.345
XRPUSDT | A | 76 | 109,8 mln | 1,0 mln | 0,9 bps | 1,6 mln | 789.030 | 1,2 mln | 2,1 mln
LINKUSDT | A | 46 | 20,0 mln | 1,1 mln | 1,0 bps | 1,6 mln | 802.650 | 1,2 mln | 310.710
DOGEUSDT | A | 80 | 28,7 mln | 1,1 mln | 1,5 bps | 1,6 mln | 817.619 | 1,3 mln | 2,0 mln
PAXGUSDT | B | 21 | 2,4 mln | 1,1 mln | 0,0 bps | 1,7 mln | 869.171 | 1,3 mln | 121.453
AVAXUSDT | A | 33 | 8,9 mln | 1,4 mln | 1,2 bps | 2,1 mln | 1,0 mln | 1,6 mln | 43.130
BNBUSDT | A | 49 | 21,6 mln | 2,1 mln | 0,1 bps | 3,3 mln | 1,7 mln | 2,5 mln | 1,4 mln
SOLUSDT | A | 46 | 279,1 mln | 4,7 mln | 1,2 bps | 7,0 mln | 3,5 mln | 5,4 mln | 832.500

**Una dimensione unica per tutte le posizioni** (book dimezzato): quota di operazioni in cui lo slittamento resta entro la soglia.

Valore della posizione (USDT) | Entro 0,08% | Entro 0,12%
---:|---:|---:
1.000 | 93% | 95%
3.000 | 87% | 92%
5.000 | 76% | 87%
10.000 | 62% | 76%
25.000 | 48% | 59%
50.000 | 37% | 47%
100.000 | 27% | 36%

<!-- conclusione:inizio -->
## Conclusione
**Il minuto d'entrata è attivo, ma Bitunix è sottile.**
- Nel minuto d'entrata il volume su Binance è in mediana 16 volte quello dell'ora prima.
- Una posizione da 3.000 USDT vale in mediana lo 0,3% del volume Binance di quel minuto.
- Su Bitunix, che ha molto meno volume, la stessa posizione vale circa il 5% del minuto (8% sulle monete 51–100), e nell'84% delle operazioni supera l'1%.

**Dimensione massima per posizione.**
- Con il book di Bitunix dimezzato (l'ipotesi prudente per i minuti di esplosione) una dimensione unica di **1.000 USDT** resta entro lo 0,08% di slittamento nel 93% delle operazioni.
- A **3.000 USDT** (la dimensione dei test) si resta entro lo 0,08% nell'87% delle operazioni; a 5.000 nel 76%; a 10.000 solo nel 62%.
- Per le monete grandi di A (XRP, LINK, DOGE, SOL, BNB, AVAX) il limite è sopra le centinaia di migliaia di USDT.
- Per le più sottili di B (CRV, UAI, ZEREBRO, GTC, US, BIRB, AERO) è sotto i 1.500 USDT.
- Per alcune monete anche l'ordine a mercato massimo di Bitunix è piccolo (ZEREBRO 477 USDT, WAL 556 USDT), quindi servirebbero più ordini.
- In pratica: **circa 1.000–3.000 USDT per posizione**, con un limite per moneta ricavato dal book. Oltre i 5.000 lo slittamento diventa un problema su una parte grande delle operazioni.

**Ma per questa regola il problema viene prima.** Con i prezzi veri dentro il minuto (`docs/verifica-dati-nuovi.md`) la regola è in perdita già prima dei costi: lordo medio −0,03% per operazione, con i prezzi veri in tutte le operazioni. Nessuno slittamento la rende positiva, nemmeno con posizioni piccolissime. Queste misure restano utili per le prossime strategie: dicono quanto si può mettere per posizione su ogni moneta.

**Limiti della misura.**
- Il volume Bitunix è stimato col rapporto Bitunix/Binance di oggi; per il 2020–2022 è solo indicativo.
- Il book è una fotografia di un momento tranquillo, e il modello "book uniforme" è una semplificazione.
- La Prova su Bitunix deve misurare lo slittamento vero.
<!-- conclusione:fine -->

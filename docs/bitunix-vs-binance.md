# Bitunix contro Binance

La domanda: possiamo usare lo storico di Binance (anni di dati, gratis, completo) per simulare cosa sarebbe successo su Bitunix?
Abbiamo confrontato minuto per minuto le ultime 3 settimane delle 50 crypto più liquide su Bitunix, e il funding degli ultimi 90 giorni.

## Conclusione
**Sì, lo storico di Binance va bene per simulare Bitunix**, perché Bitunix segue il prezzo di Binance quasi alla perfezione. Ci sono però cinque limiti da rispettare nei backtest.

**Perché va bene**
- Bitunix ha tutti i minuti che ha Binance (copertura 100%).
- La chiusura di ogni minuto differisce in media di **1,8 punti base** (0,018%). Su BTC ed ETH la differenza è 0,1–0,2 pb, sulle prime 14 resta sotto 1,5 pb. È molto meno dello slittamento che mettiamo comunque nei test (5–8 pb per lato).
- I rendimenti minuto per minuto sono quasi identici (correlazione 0,98; 0,997 su BTC) e nessuna delle due borse "anticipa" l'altra di un minuto: i movimenti avvengono nello stesso minuto.
- Un movimento dell'1% su Binance si vede su Bitunix nello stesso minuto e nella stessa direzione nel **94%** dei casi con almeno l'1%, e nel **100%** con almeno lo 0,5%. Un segnale "grande movimento" calcolato su Binance sarebbe scattato anche su Bitunix.
- La volatilità a 1 minuto è la stessa (rapporto 1,00 quasi ovunque).

**I limiti**
1. **Le punte estreme di Binance non sempre arrivano su Bitunix.** Quando su Binance il massimo o il minimo del minuto tocca un +/-1%, su Bitunix lo stesso livello è toccato nell'**87%** dei casi; al contrario è il 96%. Binance ha più "code" (7.224 minuti con una coda oltre lo 0,3% assente su Bitunix, contro 645 nel verso opposto). Quindi:
   - un ingresso a rottura o un obiettivo che nel backtest viene preso solo con la punta della candela potrebbe non essere eseguito su Bitunix → **ingressi e obiettivi vanno considerati presi solo se il prezzo supera il livello di un margine** (per esempio 0,1–0,2%), non se lo sfiora;
   - uno stop toccato solo con la punta su Binance potrebbe non scattare su Bitunix: per gli stop il backtest su Binance è prudente, va bene così.
2. **Monete piccole e nuove: differenze più grandi.** Su QUSDT, JCTUSDT, AKEUSDT, AINUSDT, IRYSUSDT, ARIAUSDT, DOODUSDT e simili la differenza media è 3–7 pb e il 99° percentile arriva a 15–25 pb, con punte di centinaia di pb. Il book di Bitunix su queste ha poche migliaia di USDT entro lo 0,1% (vedi `universo.md`). Per loro lo slittamento di 0,08% per lato è il minimo, non il caso pessimistico, e la dimensione della posizione deve restare piccola.
3. **Volume e liquidità di Bitunix sono 5–20 volte più bassi di Binance.** I prezzi sono gli stessi, ma il volume no: filtri basati sul volume vanno calcolati sul volume di Binance (che è quello storico) sapendo che su Bitunix ce n'è una frazione. Non si può usare il volume di Binance per stimare quanto si riesce a eseguire su Bitunix.
4. **Il funding è simile ma non uguale.** Sulle monete che pagano tassi forti (positivi o negativi) Bitunix e Binance vanno quasi a pari, con lo stesso segno nel 100% dei pagamenti. Sulle grandi con tassi bassi (BTC, XRP, 1000PEPE, ADA, WLD, XLM) Bitunix ha un funding suo: in 90 giorni la somma è diversa fino a 2–2,5 punti percentuali (per esempio 1000PEPE: 3,6% su Bitunix contro 1,0% su Binance). Per strategie che durano minuti o ore conta pochissimo; per posizioni tenute più giorni va aggiunto un margine. Bitunix ha lo storico del proprio funding (`get_funding_rate_history`): per le monete scelte si potrà usare quello per la parte recente.
5. **Il periodo è corto.** Tre settimane senza un crollo estremo del mercato. In un crollo di tipo "tutto -10% in 5 minuti" Bitunix potrebbe comportarsi diversamente (ritardi, stop eseguiti peggio, punte proprie). Il confronto va rifatto periodicamente (`npm run confronto`) e, in Fase 1, la modalità Prova servirà proprio a misurare le esecuzioni vere.

**In pratica, per i backtest**
- Usare le candele di Binance come se fossero di Bitunix.
- Ingressi a rottura e obiettivi: considerati presi solo se il livello viene superato di almeno 0,1% (monete grandi) o 0,2% (monete piccole).
- Slittamento: 0,05% e 0,08% per lato sulle prime 14 (fino a UNIUSDT); sulle altre almeno 0,08%, e provare anche 0,15%.
- Funding: quello di Binance, sapendo che può scostarsi fino a ~0,01% per pagamento.
- Dimensione: limitata dalla profondità del book di Bitunix, non dal volume di Binance.

## I numeri
<!-- dati:inizio -->
_Numeri generati da `research/03-bitunix-vs-binance.js` il 2026-11-11. Periodo: 21 giorni, dal 2026-10-21 08:18 al 2026-11-11 08:18 UTC, 50 crypto._

### Totale delle 50 crypto
- Minuti presenti su entrambe: **100%** (solo su Binance: 0, solo su Bitunix: 0).
- Differenza media delle chiusure: **1,84 pb** (punti base: 1 pb = 0,01%). Apertura 1,94 pb, massimo 1,41 pb, minimo 2,09 pb.
- Correlazione media dei rendimenti a 1 minuto: **0,982**. Bitunix rispetto a Binance del minuto prima: -0,015; Binance rispetto a Bitunix del minuto prima: -0,026.
- Movimenti dell'1% da chiusura a chiusura su Binance: **22721**. Visti anche su Bitunix nello stesso minuto, stessa direzione, almeno 1%: **94%**; almeno 0,5%: 100%.
- Al contrario, movimenti dell'1% su Bitunix: 22720; visti su Binance (≥1%): 94%; (≥0,5%): 100%.
- "Tocchi" dell'1% dentro il minuto (il massimo o il minimo arriva a ±1% dalla chiusura precedente, come uno stop o un ingresso a rottura): su Binance 49061, toccati anche su Bitunix **87%**; su Bitunix 44138, toccati anche su Binance 96%.
- Minuti con una "coda" solo su Bitunix (massimo o minimo oltre quello di Binance di più dello 0,3%): 645 su 1.512.000 (4,27 ogni 10.000 minuti). Solo su Binance: 7224.

### Per crypto
Colonne: **Copertura** = minuti presenti su entrambe; **Diff.** = differenza assoluta delle chiusure in pb (media, mediana, 99° percentile, massima); **Scarto** = media con segno (positivo = Bitunix più caro); **Corr.** = correlazione dei rendimenti a 1 minuto; **Mosse 1%** = movimenti ≥1% su Binance e quota vista anche su Bitunix (≥1%, stessa direzione); **Tocchi** = tocchi dell'1% su Binance visti anche su Bitunix, e viceversa; **Code Bx** = code solo-Bitunix oltre 0,3% ogni 10.000 minuti.

| Simbolo | Copertura | Diff. media | Mediana | 99° perc. | Max | Scarto | Corr. | Mosse 1% Bn | Viste su Bx | Tocchi Bn→Bx | Tocchi Bx→Bn | Code Bx |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BTCUSDT | 100% | 0,1 | 0,0 | 1,3 | 6 | 0,0 | 0,997 | 1 | 100% | 100% | 100% | 0,0 |
| ETHUSDT | 100% | 0,2 | 0,0 | 1,8 | 19 | 0,0 | 0,996 | 6 | 100% | 100% | 92% | 0,0 |
| SOLUSDT | 100% | 0,6 | 0,9 | 2,3 | 13 | 0,2 | 0,990 | 6 | 83% | 82% | 100% | 0,0 |
| XRPUSDT | 100% | 0,5 | 0,7 | 2,4 | 19 | 0,1 | 0,991 | 4 | 100% | 89% | 100% | 0,0 |
| ZECUSDT | 100% | 0,7 | 0,5 | 4,2 | 91 | 0,0 | 0,994 | 38 | 92% | 78% | 96% | 1,0 |
| NEARUSDT | 100% | 1,4 | 2,0 | 5,6 | 55 | 0,4 | 0,982 | 28 | 89% | 82% | 98% | 0,3 |
| HYPEUSDT | 100% | 0,5 | 0,1 | 3,1 | 16 | 0,0 | 0,994 | 15 | 100% | 82% | 100% | 0,0 |
| DOGEUSDT | 100% | 0,7 | 1,2 | 2,9 | 10 | 0,4 | 0,984 | 5 | 100% | 83% | 100% | 0,3 |
| 1000PEPEUSDT | 100% | 0,8 | 0,4 | 4,8 | 32 | 0,1 | 0,995 | 82 | 99% | 85% | 99% | 0,0 |
| SUIUSDT | 100% | 0,9 | 1,1 | 3,5 | 16 | 0,3 | 0,987 | 10 | 90% | 95% | 100% | 0,0 |
| BNBUSDT | 100% | 0,3 | 0,1 | 1,9 | 14 | 0,0 | 0,993 | 6 | 100% | 79% | 100% | 0,0 |
| LINKUSDT | 100% | 0,8 | 0,9 | 3,5 | 14 | 0,2 | 0,987 | 7 | 86% | 94% | 100% | 0,0 |
| ENAUSDT | 100% | 1,1 | 0,6 | 5,0 | 20 | 0,2 | 0,992 | 49 | 94% | 87% | 98% | 0,7 |
| UNIUSDT | 100% | 1,1 | 1,4 | 4,5 | 25 | 0,3 | 0,986 | 21 | 95% | 77% | 100% | 0,0 |
| QUSDT | 100% | 3,7 | 3,4 | 18,2 | 203 | 0,7 | 0,993 | 1843 | 94% | 85% | 97% | 26,1 |
| TAOUSDT | 100% | 0,7 | 0,4 | 3,6 | 27 | 0,2 | 0,989 | 7 | 100% | 83% | 100% | 1,0 |
| ADAUSDT | 100% | 2,6 | 0,0 | 10,0 | 17 | 1,3 | 0,885 | 8 | 100% | 83% | 100% | 0,0 |
| WLDUSDT | 100% | 1,4 | 1,7 | 6,2 | 56 | 0,4 | 0,980 | 30 | 90% | 88% | 99% | 4,0 |
| JCTUSDT | 100% | 4,4 | 3,0 | 25,7 | 131 | 1,0 | 0,995 | 4403 | 95% | 90% | 98% | 15,2 |
| XAUTUSDT | 100% | 0,1 | 0,0 | 1,6 | 5 | 0,0 | 0,982 | 0 | – | – | – | 0,0 |
| AVAXUSDT | 100% | 0,9 | 1,1 | 3,6 | 18 | 0,3 | 0,986 | 13 | 100% | 86% | 100% | 0,0 |
| STRKUSDT | 100% | 1,6 | 1,9 | 7,2 | 30 | 0,6 | 0,981 | 55 | 96% | 85% | 96% | 0,0 |
| AKEUSDT | 100% | 5,8 | 5,3 | 22,2 | 280 | 0,9 | 0,991 | 2726 | 94% | 89% | 93% | 98,9 |
| ONDOUSDT | 100% | 1,6 | 2,3 | 5,6 | 24 | 0,5 | 0,967 | 11 | 100% | 90% | 100% | 0,7 |
| BCHUSDT | 100% | 0,7 | 0,4 | 3,5 | 23 | 0,2 | 0,989 | 9 | 100% | 71% | 95% | 0,0 |
| AAVEUSDT | 100% | 0,9 | 0,8 | 4,5 | 37 | 0,2 | 0,986 | 11 | 91% | 74% | 100% | 0,0 |
| FILUSDT | 100% | 0,9 | 1,1 | 4,4 | 15 | 0,3 | 0,987 | 14 | 93% | 84% | 100% | 0,0 |
| AINUSDT | 100% | 3,6 | 2,5 | 22,1 | 292 | 0,5 | 0,992 | 2107 | 94% | 86% | 98% | 7,9 |
| IRYSUSDT | 100% | 4,1 | 4,3 | 21,6 | 402 | 1,3 | 0,993 | 1904 | 94% | 90% | 97% | 7,3 |
| BTWUSDT | 100% | 2,5 | 1,7 | 14,5 | 159 | 0,7 | 0,994 | 1082 | 93% | 83% | 97% | 5,3 |
| INJUSDT | 100% | 1,2 | 1,2 | 5,4 | 89 | 0,3 | 0,985 | 16 | 100% | 75% | 97% | 0,7 |
| HBARUSDT | 100% | 1,0 | 1,3 | 4,5 | 14 | 0,3 | 0,973 | 9 | 100% | 94% | 100% | 0,0 |
| TRUMPUSDT | 100% | 3,1 | 0,0 | 11,7 | 27 | 1,2 | 0,913 | 46 | 91% | 84% | 97% | 0,0 |
| ARBUSDT | 100% | 0,9 | 0,6 | 4,3 | 32 | 0,1 | 0,991 | 14 | 93% | 80% | 100% | 0,0 |
| LTCUSDT | 100% | 0,9 | 0,0 | 3,7 | 18 | 0,3 | 0,976 | 4 | 100% | 78% | 78% | 0,0 |
| TIAUSDT | 100% | 2,6 | 1,9 | 12,4 | 38 | 0,7 | 0,940 | 20 | 95% | 80% | 94% | 0,7 |
| EVAAUSDT | 100% | 3,0 | 1,9 | 15,8 | 359 | 0,5 | 0,990 | 1273 | 93% | 88% | 98% | 4,0 |
| XMRUSDT | 100% | 0,7 | 0,2 | 5,3 | 40 | 0,1 | 0,984 | 23 | 96% | 84% | 77% | 6,3 |
| QNTUSDT | 100% | 1,6 | 1,0 | 7,3 | 30 | 0,2 | 0,978 | 28 | 96% | 85% | 95% | 7,3 |
| ONEUSDT | 100% | 2,4 | 1,7 | 12,3 | 91 | 0,3 | 0,987 | 577 | 95% | 87% | 98% | 0,0 |
| DOTUSDT | 100% | 1,0 | 1,0 | 4,3 | 23 | 0,3 | 0,984 | 13 | 100% | 76% | 100% | 0,0 |
| XPLUSDT | 100% | 1,2 | 1,3 | 5,7 | 35 | 0,4 | 0,988 | 50 | 92% | 83% | 98% | 0,0 |
| GTCUSDT | 100% | 2,3 | 1,6 | 12,1 | 87 | 0,4 | 0,987 | 380 | 92% | 82% | 97% | 2,0 |
| ICNTUSDT | 100% | 4,2 | 4,5 | 19,0 | 92 | 1,5 | 0,968 | 497 | 89% | 76% | 98% | 2,0 |
| ARIAUSDT | 100% | 6,8 | 6,7 | 18,5 | 70 | 0,2 | 0,971 | 1085 | 89% | 86% | 90% | 7,9 |
| IDOLUSDT | 100% | 3,9 | 2,6 | 18,8 | 159 | 0,6 | 0,991 | 1923 | 94% | 87% | 97% | 3,3 |
| XLMUSDT | 100% | 0,7 | 0,6 | 3,2 | 17 | 0,1 | 0,986 | 4 | 75% | 73% | 100% | 0,0 |
| APRUSDT | 100% | 3,9 | 3,0 | 16,8 | 260 | 1,4 | 0,989 | 1342 | 94% | 85% | 98% | 3,0 |
| DOODUSDT | 100% | 3,9 | 4,8 | 18,9 | 111 | 1,5 | 0,984 | 888 | 93% | 86% | 96% | 7,3 |
| WUSDT | 100% | 1,5 | 0,9 | 7,7 | 38 | 0,3 | 0,974 | 28 | 96% | 91% | 97% | 0,3 |

### Funding degli ultimi 90 giorni
Somma dei tassi pagati (positivo = i long pagano gli short), differenza media per pagamento e quota di pagamenti con lo stesso segno.

| Simbolo | Pagamenti confrontati | Somma Bitunix | Somma Binance | Diff. media | Stesso segno |
|---|---:|---:|---:|---:|---:|
| BTCUSDT | 270 | 0,561% | 1,530% | 0,0039% | 74% |
| ETHUSDT | 270 | 1,163% | 1,138% | 0,0007% | 97% |
| SOLUSDT | 270 | 1,291% | 1,039% | 0,0030% | 79% |
| XRPUSDT | 270 | 3,116% | 1,241% | 0,0069% | 79% |
| ZECUSDT | 144 | 0,941% | 1,467% | 0,0002% | 100% |
| NEARUSDT | 270 | 1,618% | 1,601% | 0,0005% | 99% |
| HYPEUSDT | 540 | 2,000% | 1,803% | 0,0006% | 96% |
| DOGEUSDT | 270 | 1,728% | 1,597% | 0,0006% | 94% |
| 1000PEPEUSDT | 270 | 3,562% | 0,995% | 0,0128% | 70% |
| SUIUSDT | 270 | 1,981% | 1,386% | 0,0023% | 86% |
| BNBUSDT | 270 | 0,914% | 0,928% | 0,0011% | 94% |
| LINKUSDT | 270 | 1,354% | 1,510% | 0,0019% | 87% |
| ENAUSDT | 540 | 2,112% | 1,763% | 0,0011% | 90% |
| UNIUSDT | 270 | 1,733% | 1,675% | 0,0011% | 93% |
| QUSDT | 603 | 0,586% | -2,650% | 0,0062% | 100% |
| TAOUSDT | 540 | 2,352% | 1,884% | 0,0011% | 91% |
| ADAUSDT | 270 | 2,422% | 1,226% | 0,0083% | 70% |
| WLDUSDT | 270 | 2,369% | 0,166% | 0,0089% | 69% |
| JCTUSDT | 540 | 11,930% | 12,017% | 0,0015% | 100% |
| XAUTUSDT | 540 | 1,692% | 1,575% | 0,0004% | 97% |
| AVAXUSDT | 270 | 1,231% | 1,195% | 0,0005% | 99% |
| STRKUSDT | 540 | 2,007% | 2,028% | 0,0002% | 100% |
| AKEUSDT | 567 | -9,280% | -14,706% | 0,0117% | 100% |
| ONDOUSDT | 540 | 2,044% | 1,596% | 0,0010% | 92% |
| BCHUSDT | 270 | 0,829% | 0,838% | 0,0004% | 100% |
| AAVEUSDT | 270 | 1,268% | 1,277% | 0,0004% | 100% |
| FILUSDT | 270 | 1,143% | 1,134% | 0,0005% | 100% |
| AINUSDT | 540 | 16,030% | 17,164% | 0,0047% | 100% |
| IRYSUSDT | 636 | -1,418% | -1,510% | 0,0048% | 100% |
| BTWUSDT | 540 | -15,273% | -14,476% | 0,0032% | 100% |
| INJUSDT | 270 | 0,594% | 0,606% | 0,0005% | 100% |
| HBARUSDT | 270 | 1,528% | 1,444% | 0,0006% | 97% |
| TRUMPUSDT | 540 | -0,729% | -0,890% | 0,0008% | 100% |
| ARBUSDT | 270 | 0,498% | 0,508% | 0,0009% | 100% |
| LTCUSDT | 270 | 1,495% | 1,507% | 0,0004% | 99% |
| TIAUSDT | 540 | 0,997% | 0,986% | 0,0004% | 100% |
| EVAAUSDT | 540 | 7,380% | 7,526% | 0,0011% | 100% |
| XMRUSDT | 129 | 1,955% | 6,147% | 0,0003% | 100% |
| QNTUSDT | 270 | -0,482% | -1,463% | 0,0045% | 100% |
| ONEUSDT | 650 | -49,482% | -57,497% | 0,0146% | 100% |
| DOTUSDT | 270 | 0,962% | 1,004% | 0,0006% | 100% |
| XPLUSDT | 540 | 2,329% | 1,951% | 0,0009% | 99% |
| GTCUSDT | 386 | -34,306% | -34,515% | 0,0038% | 100% |
| ICNTUSDT | 540 | 1,484% | 1,491% | 0,0002% | 100% |
| ARIAUSDT | 540 | 9,524% | 9,617% | 0,0009% | 100% |
| IDOLUSDT | 540 | 6,824% | 6,859% | 0,0006% | 100% |
| XLMUSDT | 270 | 2,102% | 1,149% | 0,0040% | 79% |
| APRUSDT | 540 | 5,684% | 5,733% | 0,0005% | 100% |
| DOODUSDT | 564 | -8,488% | -10,410% | 0,0045% | 100% |
| WUSDT | 540 | -0,421% | -0,409% | 0,0005% | 100% |
<!-- dati:fine -->

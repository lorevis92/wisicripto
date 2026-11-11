# Verifica della regola su dati mai usati

Aggiornato il 2026-11-11. Regola: `docs/regola-fissata.md` (fissata prima di questo test e non cambiata). Script: `research/08-verifica-dati-nuovi.js`. Risultati completi: `data/backtest/verifica/risultati.json`.

<!-- conclusione:inizio -->
## Conclusione
**No: dopo la revisione la regola non regge.** Il primo verdetto ("regge", +397%) dipendeva da un'ipotesi sulle candele che si è rivelata troppo favorevole. La regola non è stata cambiata: è cambiato solo il modo di simulare cosa succede dentro il minuto.

**Cosa è successo.**
- Una revisione indipendente (`docs/revisione.md`) ha confermato che il codice fa quello che dichiara: 20 operazioni rifatte a mano e tutte le 2.989 rigenerate con codice separato coincidono.
- Ha però trovato che quasi metà delle operazioni entra ed esce nello stesso minuto. In quei casi il risultato dipende da cosa il prezzo tocca prima dentro la candela, e con le sole candele non si può sapere.
- Ho scaricato i prezzi veri di ogni scambio da Binance (aggTrades) per **tutte** le 2.989 operazioni, dall'entrata alla durata massima: 722.726 minuti, 99,9% coincidenti con le candele.
  - Prima versione: i prezzi veri solo per le 1.247 operazioni in cui le candele davano esiti diversi. Lordo 0,32%, rendimento −14%.
  - Con i prezzi veri ovunque il quadro peggiora ancora: anche nelle operazioni "non ambigue" i piccoli ritorni dentro il minuto fanno scattare la protezione prima.
- Un controllo indipendente su 40 operazioni torna, e il simulatore delle uscite di `research/11` coincide con il motore in tutte le operazioni.

**Il risultato con i prezzi veri** (dimensione fissa, leva 3x, slittamento 0,08%):

| | Lordo medio | Netto medio per operazione | Rendimento | Profit factor |
|---|---:|---:|---:|---:|
| Prima (solo candele) | 0,80% | 0,47% | +397% | 1,54 |
| **Con i prezzi veri** | **−0,03%** | **−0,31%** | **rovina** | **0,50** |
| A da solo (2020–2022) | −0,07% | −0,34% | rovina | 0,50 |
| B da solo (monete 51–100) | −0,02% | −0,30% | rovina | 0,43 |

- Nessuno dei quattro criteri decisi prima è soddisfatto.
- Il lordo medio è già negativo **prima dei costi**: nessuno slittamento, anche il più basso, rende la regola positiva.
- Anno per anno sono tutti in perdita, dal 2020 al 2026.

**Perché i prezzi veri cambiano così tanto.**
- La candela ha 4 punti: apertura, massimo, minimo, chiusura. Dentro un minuto di esplosione il prezzo invece sale a scatti, con tanti piccoli ritorni.
- La protezione del guadagno di Wisi Trade si attiva da +0,5 unità e chiude se si restituisce il 40% del guadagno massimo. È strettissima all'inizio: a +0,6 unità basta un ritorno di 0,24 unità.
- Con le candele il prezzo "salta" subito al massimo e la protezione si piazza in alto. Con i prezzi veri scatta su uno dei primi ritorni, con un guadagno piccolo.
- In Prova e in Reale il motore riceverebbe proprio i prezzi veri, quindi il risultato giusto è questo.
- **Ma la protezione non è la causa vera.** In `docs/perdite-e-uscite.md` ci sono 13 uscite diverse, scelte sul periodo fino al 2023 e verificate dal 2024. Nessuna salva la regola. Dopo l'entrata il prezzo in media torna indietro: entriamo quando il movimento è già finito.

**Cosa vuol dire per il progetto.**
- Questa regola **non va portata in Fase 1**, e la strategia "grande movimento" in questa forma va abbandonata (`docs/perdite-e-uscite.md`).
- Anche i risultati di `docs/grande-movimento.md` e `docs/regola-fissata.md` usavano le candele, quindi sono gonfiati allo stesso modo.
- Ogni test futuro con uscite strette deve usare i prezzi veri (gli aggTrades), non le 4 punte della candela.
<!-- conclusione:fine -->

## Dopo la revisione indipendente
Una revisione fatta da chi non aveva scritto il codice (`docs/revisione.md`) non ha trovato errori di programmazione. Ha però trovato ipotesi che rendono il risultato migliore del vero. Qui sono corrette o misurate; **la regola è la stessa**.

- **Ordine dentro la candela.** In molte operazioni l'esito dipende da cosa viene toccato prima, il massimo o il minimo del minuto. Ora si usano i prezzi veri degli scambi di Binance (aggTrades), minuto per minuto dall'entrata alla durata massima, per 2.981 operazioni su 2.989 segnali (il portafoglio ne prende 617 prima di fermarsi o finire), 722.726 minuti di prezzi veri, 622 minuti scartati perché non coincidevano con la candela. Tutti i risultati di questo documento usano i prezzi veri.
- **Portafoglio.** Il peggior calo e il giorno peggiore ora contano anche le perdite aperte, minuto per minuto. Il freno controlla anche le posizioni aperte nello stesso minuto. I fermi di Binance non sono più usati come prezzi validi.

**Ordine dentro la candela** (A + B, dimensione fissa, leva 3x, slittamento 0,08%):

| Percorso dentro il minuto | Lordo medio | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|---:|
| prezzi veri | -0,031% | -100,0% (rovina) | 0,50 | 100% (rovina) | oltre -100% (rovina) | 617 | -0,541% |
| solo candele (regola Wisi Trade) | 0,801% | 396,5% | 1,54 | 14,1% | -6,0% | 2.824 | 0,468% |
| estremo sfavorevole sempre per primo | 0,568% | 205,8% | 1,24 | 18,5% | -6,6% | 2.824 | 0,243% |

**Slittamento per moneta dal book Bitunix** (A + B, dimensione fissa).
- Formula: metà spread + 0,05% × posizione / profondità entro lo 0,1%.
- La profondità è dimezzata per i minuti di esplosione; il minimo è 0,08%.
- Dettagli in `docs/dimensione-posizione.md`.

| Leva (posizione) | Slittamento medio | Mediano | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 3x (3.000 USDT) | 0,17% | 0,08% | -100,0% (rovina) | 0,49 | 100% (rovina) | oltre -100% (rovina) | 602 | -0,556% |
| 5x (5.000 USDT) | 0,19% | 0,08% | -100,0% (rovina) | 0,57 | 100% (rovina) | oltre -100% (rovina) | 422 | -0,474% |

**Scelta delle monete di B.** Le monete 51–100 sono state scelte con il volume dei 30 giorni prima del 2026-11-11, che sono dentro il periodo di prova. Molte sono state quotate di recente.

| Parte di B | Monete | Lordo medio | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B, tutto | 50 | -0,016% | -100,0% (rovina) | 0,43 | 100% (rovina) | oltre -100% (rovina) | 810 | -0,413% |
| B senza gli ultimi 30 giorni (dal 2026-10-12, usati per scegliere le monete) | 49 | -0,051% | -100,0% (rovina) | 0,43 | 100% (rovina) | oltre -100% (rovina) | 810 | -0,413% |
| B, monete quotate su Binance prima del 2025 | 28 | 0,000% | -100,0% (rovina) | 0,42 | 100% (rovina) | oltre -100% (rovina) | 858 | -0,403% |
| B, monete quotate dal 2025 | 22 | -0,053% | -68,8% | 0,65 | 74,6% | -25,2% | 618 | -0,371% |

A + B senza gli ultimi 30 giorni di B: rendimento -100,0% (rovina), profit factor 0,50, peggior calo 100% (rovina).

**Funding**: in media 0,0010% del valore della posizione per operazione (positivo = costo). Pesa poco, perché le posizioni durano al massimo 4 ore. È quello di Binance, non di Bitunix.

**Quanto sono nuovi i dati.** L'elenco delle varianti tra cui la regola è stata scelta è stato deciso dopo aver già visto il 30% del periodo 2023–2026. B copre gli stessi mesi con altre monete, e le crypto si muovono insieme. I dati davvero indipendenti sono A (2020–2022) e quello che verrà dopo l'11/11/2026.

## Cosa è stato verificato
- **Regola**: solo altcoin; segnale quando il rendimento degli ultimi 15 o 60 minuti supera **12 volte** il movimento normale; si segue il movimento; entrata a mercato al minuto dopo; uscite Wisi Trade (stop 1,5 unità, poi stop che segue 1 unità e protezione 40%), durata massima e pausa 4 ore.
- **A**: 22 delle 50 monete che esistevano prima del 2023 (BTC ed ETH escluse dalla regola), operazioni dal 2020-01-01 al 2022-12-31. Dati da settembre 2019 solo per calcolare il movimento normale e l'unità.
- **B**: le 50 monete dalla 51ª alla 100ª di `docs/universo.md`, dal 2023-01-01 al 2026-11-10.
- **A + B**: un unico portafoglio con tutte queste operazioni (A dal 2020 al 2022, B dal 2023).
- **Metodo**: come negli altri test. 10.000 USDT, 10 posizioni, margine 10%, leva 3x e 5x, freno 8% su perdita chiusa + aperta, dimensione fissa e composto, media di 10 ordini casuali. Commissione 0,06% per lato, slittamento 0,05% / 0,08% / 0,12% per lato (minimo 0,08% dalla 15ª moneta, quindi quasi tutte), funding reale.

## I criteri decisi prima
Dimensione fissa, leva 3x, slittamento 0,08%. **Verdetto: non regge.**

| Criterio | Risultato | Soddisfatto |
|---|---|---|
| A + B: rendimento positivo e profit factor almeno 1,10 | -100,0% (rovina), PF 0,50 | **no** |
| A + B: lordo medio per operazione almeno 0,30% | -0,031% | **no** |
| in utile sia su A sia su B da soli | A -100,0% (rovina), B -100,0% (rovina) | **no** |
| con slittamento 0,12% non in perdita | -100,0% (rovina) | **no** |

## Risultati
Singole operazioni (senza limiti di posti), slittamento 0,08%:

| Dati | Operazioni | Lordo medio | Netto medio (0,05%) | Netto medio (0,08%) | Netto medio (0,12%) | PF (0,08%) | Vincenti |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 936 | -0,065% | -0,317% | -0,344% | -0,424% | 0,62 | 59% |
| B | 2.053 | -0,016% | -0,298% | -0,298% | -0,378% | 0,63 | 60% |
| A + B | 2.989 | -0,031% | -0,304% | -0,312% | -0,392% | 0,63 | 60% |

Portafoglio:

| Dati | Slittamento | Leva | Dimensione | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| A | 0,05% | 3x | fissa | -100,0% (rovina) | 0,57 | 100% (rovina) | oltre -100% (rovina) | 791 | -0,423% |
| A | 0,05% | 3x | composto | -63,6% | 0,61 | 67,2% | -10,4% | 917 | -0,350% |
| A | 0,05% | 5x | fissa | -100,0% (rovina) | 0,57 | 100% (rovina) | oltre -100% (rovina) | 435 | -0,465% |
| A | 0,05% | 5x | composto | -83,2% | 0,61 | 85,8% | -11,4% | 917 | -0,364% |
| A | 0,08% | 3x | fissa | -100,0% (rovina) | 0,50 | 100% (rovina) | oltre -100% (rovina) | 617 | -0,541% |
| A | 0,08% | 3x | composto | -66,1% | 0,59 | 69,4% | -10,5% | 917 | -0,377% |
| A | 0,08% | 5x | fissa | -100,0% (rovina) | 0,57 | 100% (rovina) | oltre -100% (rovina) | 433 | -0,465% |
| A | 0,08% | 5x | composto | -85,9% | 0,59 | 88,1% | -11,5% | 917 | -0,402% |
| A | 0,12% | 3x | fissa | -100,0% (rovina) | 0,45 | 100% (rovina) | oltre -100% (rovina) | 540 | -0,627% |
| A | 0,12% | 3x | composto | -72,9% | 0,53 | 75,3% | -10,7% | 917 | -0,457% |
| A | 0,12% | 5x | fissa | -100,0% (rovina) | 0,54 | 100% (rovina) | oltre -100% (rovina) | 396 | -0,507% |
| A | 0,12% | 5x | composto | -90,3% | 0,53 | 91,6% | -11,8% | 917 | -0,483% |
| B | 0,05% | 3x | fissa | -100,0% (rovina) | 0,43 | 100% (rovina) | oltre -100% (rovina) | 810 | -0,413% |
| B | 0,05% | 3x | composto | -85,9% | 0,58 | 87,5% | -15,8% | 1.892 | -0,331% |
| B | 0,05% | 5x | fissa | -100,0% (rovina) | 0,27 | 100% (rovina) | oltre -100% (rovina) | 410 | -0,504% |
| B | 0,05% | 5x | composto | -97,3% | 0,49 | 97,8% | -27,0% | 1.878 | -0,359% |
| B | 0,08% | 3x | fissa | -100,0% (rovina) | 0,43 | 100% (rovina) | oltre -100% (rovina) | 810 | -0,413% |
| B | 0,08% | 3x | composto | -85,9% | 0,58 | 87,5% | -15,8% | 1.892 | -0,331% |
| B | 0,08% | 5x | fissa | -100,0% (rovina) | 0,27 | 100% (rovina) | oltre -100% (rovina) | 410 | -0,504% |
| B | 0,08% | 5x | composto | -97,3% | 0,49 | 97,8% | -27,0% | 1.878 | -0,359% |
| B | 0,12% | 3x | fissa | -100,0% (rovina) | 0,34 | 100% (rovina) | oltre -100% (rovina) | 702 | -0,477% |
| B | 0,12% | 3x | composto | -91,0% | 0,49 | 91,8% | -16,1% | 1.892 | -0,411% |
| B | 0,12% | 5x | fissa | -100,0% (rovina) | 0,22 | 100% (rovina) | oltre -100% (rovina) | 369 | -0,550% |
| B | 0,12% | 5x | composto | -98,8% | 0,38 | 99,0% | -27,5% | 1.867 | -0,450% |
| A + B | 0,05% | 3x | fissa | -100,0% (rovina) | 0,57 | 100% (rovina) | oltre -100% (rovina) | 791 | -0,423% |
| A + B | 0,05% | 3x | composto | -94,6% | 0,61 | 95,4% | -15,8% | 2.810 | -0,331% |
| A + B | 0,05% | 5x | fissa | -100,0% (rovina) | 0,57 | 100% (rovina) | oltre -100% (rovina) | 435 | -0,465% |
| A + B | 0,05% | 5x | composto | -99,5% | 0,60 | 99,6% | -27,0% | 2.795 | -0,356% |
| A + B | 0,08% | 3x | fissa | -100,0% (rovina) | 0,50 | 100% (rovina) | oltre -100% (rovina) | 617 | -0,541% |
| A + B | 0,08% | 3x | composto | -95,0% | 0,59 | 95,7% | -15,8% | 2.810 | -0,340% |
| A + B | 0,08% | 5x | fissa | -100,0% (rovina) | 0,57 | 100% (rovina) | oltre -100% (rovina) | 433 | -0,465% |
| A + B | 0,08% | 5x | composto | -99,6% | 0,58 | 99,7% | -27,0% | 2.795 | -0,369% |
| A + B | 0,12% | 3x | fissa | -100,0% (rovina) | 0,45 | 100% (rovina) | oltre -100% (rovina) | 540 | -0,627% |
| A + B | 0,12% | 3x | composto | -97,5% | 0,52 | 97,8% | -16,1% | 2.810 | -0,422% |
| A + B | 0,12% | 5x | fissa | -100,0% (rovina) | 0,54 | 100% (rovina) | oltre -100% (rovina) | 396 | -0,507% |
| A + B | 0,12% | 5x | composto | -99,9% | 0,52 | 99,9% | -27,5% | 2.785 | -0,456% |

## Anno per anno
Dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT.

| Anno | Dati | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto | Lordo medio |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2020 | A | -24,4% | 0,61 | 35,0% | -5,3% | 230 | -0,354% | -0,074% |
| 2021 | A | -52,2% | 0,53 | 56,6% | -11,2% | 336 | -0,518% | -0,157% |
| 2022 | A | -25,7% | 0,67 | 34,0% | -8,3% | 351 | -0,244% | 0,030% |
| 2023 | B | -38,1% | 0,36 | 46,0% | -10,9% | 361 | -0,352% | -0,036% |
| 2024 | B | -20,5% | 0,75 | 40,0% | -9,8% | 386 | -0,177% | 0,118% |
| 2025 | B | -28,7% | 0,68 | 38,4% | -9,7% | 376 | -0,255% | 0,035% |
| 2026 (parziale) | B | -94,3% | 0,54 | 96,2% | -34,2% | 672 | -0,468% | -0,102% |

## Scomposizione (singole operazioni, slittamento 0,08%)
| Gruppo | Operazioni | Lordo medio | Netto medio | PF | Vincenti |
|---|---:|---:|---:|---:|---:|
| A (2020–2022) | 936 | -0,065% | -0,344% | 0,62 | 59% |
| B (monete 51–100) | 2.053 | -0,016% | -0,298% | 0,63 | 60% |
| Long | 1.216 | 0,049% | -0,229% | 0,70 | 63% |
| Short | 1.773 | -0,086% | -0,369% | 0,58 | 58% |
| Giorni feriali | 2.353 | -0,079% | -0,359% | 0,58 | 59% |
| Weekend | 636 | 0,145% | -0,138% | 0,82 | 64% |
| Finestra 15 min | 2.881 | -0,059% | -0,339% | 0,59 | 59% |
| Finestra 60 min | 108 | 0,702% | 0,412% | 1,46 | 80% |
| Ore 00–04 UTC | 556 | -0,052% | -0,332% | 0,63 | 61% |
| Ore 04–08 UTC | 422 | -0,375% | -0,655% | 0,37 | 58% |
| Ore 08–12 UTC | 423 | -0,204% | -0,486% | 0,48 | 58% |
| Ore 12–16 UTC | 606 | 0,152% | -0,128% | 0,82 | 59% |
| Ore 16–20 UTC | 536 | -0,024% | -0,308% | 0,63 | 60% |
| Ore 20–24 UTC | 446 | 0,228% | -0,054% | 0,92 | 65% |

Uscite: protezione del guadagno 69%, stop loss 29%, stop che segue 3%, durata massima 0%.

**Concentrazione**: le 5 monete migliori fanno -4% del risultato netto delle singole operazioni (UAIUSDT 40 oper., netto medio 0,30%; ICPUSDT 51 oper., netto medio 0,19%; UNIUSDT 35 oper., netto medio 0,22%; ALGOUSDT 52 oper., netto medio 0,09%; ORDERUSDT 30 oper., netto medio 0,15%). Le 5 peggiori: LSKUSDT -0,92%, SOLUSDT -1,16%, LTCUSDT -0,70%, DOGEUSDT -0,49%, SIRENUSDT -0,60%.

## Rischio: da dove vengono i cali
### Il calo del 45% già visto: versione base "segui, 60 minuti, oltre 8×, tutte le monete" nel 30% (dati già usati)
- Calo del **45,0%** dal 2026-03-10 al 2026-07-27 (139 giorni, 101 con operazioni chiuse), da 16.702 a 9.192 USDT.
- 326 operazioni chiuse nel calo, 129 in perdita; la serie più lunga di perdite di fila è di **7**.
- Il giorno peggiore pesa il **11%** della discesa, i 3 giorni peggiori il **26%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2026-04-14 | -860 USDT | 5 | 3 / 2 | 1 long |
| 2026-06-04 | -592 USDT | 22 | 2 / 20 | 7 short |
| 2026-05-07 | -521 USDT | 3 | 2 / 1 | 1 long |
| 2026-06-13 | -496 USDT | 2 | 1 / 1 | 1 long |
| 2026-04-16 | -454 USDT | 4 | 3 / 1 | 1 long |

### Regola fissata su A + B (portafoglio, dimensione fissa, leva 3x, slittamento 0,08%)
- Calo del **100,1%** dal 2020-03-13 al 2022-04-30 (779 giorni, 180 con operazioni chiuse), da 11.050 a -10 USDT.
- 584 operazioni chiuse nel calo, 256 in perdita; la serie più lunga di perdite di fila è di **12**.
- Il giorno peggiore pesa il **6%** della discesa, i 3 giorni peggiori il **18%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2021-05-19 | -681 USDT | 10 | 0 / 10 | 6 short |
| 2021-11-10 | -666 USDT | 13 | 0 / 13 | 8 short |
| 2021-01-29 | -661 USDT | 4 | 4 / 0 | 1 long |
| 2021-11-16 | -629 USDT | 14 | 0 / 14 | 9 short |
| 2021-02-10 | -461 USDT | 7 | 1 / 6 | 1 short |

### Regola fissata solo su A (2020–2022)
- Calo del **100,1%** dal 2020-03-13 al 2022-04-30 (779 giorni, 180 con operazioni chiuse), da 11.050 a -10 USDT.
- 584 operazioni chiuse nel calo, 256 in perdita; la serie più lunga di perdite di fila è di **12**.
- Il giorno peggiore pesa il **6%** della discesa, i 3 giorni peggiori il **18%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2021-05-19 | -681 USDT | 10 | 0 / 10 | 6 short |
| 2021-11-10 | -666 USDT | 13 | 0 / 13 | 8 short |
| 2021-01-29 | -661 USDT | 4 | 4 / 0 | 1 long |
| 2021-11-16 | -629 USDT | 14 | 0 / 14 | 9 short |
| 2021-02-10 | -461 USDT | 7 | 1 / 6 | 1 short |

### Regola fissata solo su B (monete 51–100)
- Calo del **101,2%** dal 2023-06-10 al 2025-06-18 (739 giorni, 218 con operazioni chiuse), da 10.626 a -126 USDT.
- 700 operazioni chiuse nel calo, 347 in perdita; la serie più lunga di perdite di fila è di **18**.
- Il giorno peggiore pesa il **8%** della discesa, i 3 giorni peggiori il **19%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2024-12-09 | -826 USDT | 18 | 0 / 18 | 7 short |
| 2024-07-05 | -691 USDT | 14 | 0 / 14 | 7 short |
| 2024-08-05 | -523 USDT | 39 | 9 / 30 | 9 short |
| 2024-03-03 | -513 USDT | 10 | 1 / 9 | 1 long |
| 2023-06-30 | -490 USDT | 15 | 0 / 15 | 1 short |

Segnali scartati nel portafoglio A + B: posti pieni 1, freno 23.

## Limiti
- **Prezzi veri solo dove servono**: per le operazioni il cui esito non cambia tra i due ordini estremi si usano le candele. Gli aggTrades sono di Binance, non di Bitunix.
- **Le monete sono scelte con la liquidità di oggi**, anche quelle dei dati nuovi: per A sono le monete che esistono ancora e sono tra le più liquide nel 2026; per B quelle che sono arrivate tra le prime 100. Le monete crollate o tolte dalla quotazione non ci sono. Questo favorisce i risultati, soprattutto i long.
- Su A le monete sono poche (le più vecchie e grandi), su B sono quasi tutte piccole e recenti: i due gruppi sono diversi dal 70% usato per fissare la regola, ed è proprio questo che serve a verificarla.
- L'entrata avviene nei primi minuti di un movimento violento: su Bitunix lo slittamento può essere più alto anche dello 0,12%.

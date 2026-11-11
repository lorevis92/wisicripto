# Verifica della regola su dati mai usati

Aggiornato il 2026-11-11. Regola: `docs/regola-fissata.md` (fissata prima di questo test e non cambiata). Script: `research/08-verifica-dati-nuovi.js`. Risultati completi: `data/backtest/verifica/risultati.json`.

<!-- conclusione:inizio -->
## Conclusione
**Sì: la regola regge su dati mai visti.** Soddisfa tutti e quattro i criteri decisi prima del test, senza nessuna modifica. È il primo risultato della Fase 0 che passa una verifica onesta. Va però preso con una forte cautela: le monete sono state scelte con la liquidità di oggi (vedi sotto).

Con dimensione fissa, leva 3x e slittamento 0,08% per lato:

| Dati mai usati | Operazioni | Lordo medio per operazione | Rendimento | Profit factor | Peggior calo |
|---|---:|---:|---:|---:|---:|
| A: 2020–2022, 22 altcoin | 936 | 0,63% | +100% | 1,39 | 14% |
| B: monete 51–100, dal 2023 | 2.053 | 0,88% | +294% | 1,61 | 9% |
| **A + B** | **2.989** | **0,80%** | **+397%** | **1,54** | **14%** |

- **Regge anche con costi peggiori.** Con lo slittamento allo 0,12% A + B fa ancora +329% (profit factor 1,43) e il netto medio resta +0,44% per operazione.
- **Tutti gli anni sono in utile**, dal 2020 al 2026. Il 2022 è debole (profit factor 1,17, lordo 0,38%) e il 2026 si indebolisce (profit factor 1,25, peggior calo 26%).
- **Il vantaggio è diffuso:** 61 monete su 72 sono in utile, e le 5 migliori fanno un quarto del risultato.
- **Come nel 70%:** gli short rendono più dei long (1,0% contro 0,45% lordo), il weekend e la sera (20–24 UTC) sono i momenti migliori, le 08–12 UTC il peggiore.
- **Quasi tutti i segnali vengono dalla finestra da 15 minuti** (2.881 su 2.989): quella da 60 minuti aggiunge poco.

**Rischio e il calo del 40%.** Il calo del 40,6% della versione base nel 30% (aprile–luglio 2026) **non viene da un solo evento**:
- è una discesa lenta di 91 giorni, con 228 operazioni chiuse e non più di 7 perdite di fila;
- il giorno peggiore pesa solo il 13% della discesa, i 3 peggiori il 30%;
- solo in un giorno (4 giugno 2026) c'erano molte posizioni dalla stessa parte: 7 short aperti insieme.

È la fase in cui il vantaggio della versione a 8× si era ridotto a quasi niente. Con la regola fissata il calo più profondo sui dati nuovi è del **14%** (settembre–dicembre 2020). Anche questo è fatto di tante piccole perdite e non di un crollo: il giorno peggiore pesa il 16%, la serie più lunga di perdite è di 7. Il giorno peggiore in assoluto è -4,7% del capitale e il freno non è mai scattato. Le posizioni aperte insieme dalla stessa parte nei giorni peggiori sono poche (1–4).

**I limiti che pesano davvero:**
1. **Monete scelte oggi.** Le 22 altcoin di A sono quelle che nel 2026 esistono ancora e sono tra le più liquide; le 50 di B sono quelle che sono arrivate tra le prime 100. Le monete crollate a zero o tolte dalla quotazione non ci sono. Qui l'effetto probabilmente è più piccolo del solito, perché la regola guadagna più con gli short che con i long. Però i numeri vanno considerati un **massimo**, non una previsione.
2. **Esecuzione.** Si entra nei primi minuti di un'esplosione. Le monete 51–100 hanno su Bitunix 1–2,6 milioni di USDT di volume al giorno e circa 15.000 USDT di book entro lo 0,1% in un momento tranquillo. Una posizione da 3.000–5.000 USDT è al limite. In quei minuti lo slittamento vero può superare lo 0,12%, e Bitunix può non avere il contratto operabile via API per tutte le monete.
3. **I rendimenti composti** (fino a migliaia di %) non sono realistici: con il capitale che cresce la posizione supera presto la liquidità di queste monete. Contano la dimensione fissa e il guadagno per operazione.

**Prossimo passo consigliato:** passare alla **Fase 1** con questa regola, in modalità **Simulazione** e poi **Prova** su Bitunix con capitale finto. Lì si misurano due cose che i dati storici non possono dire: lo slittamento vero in entrata nei movimenti violenti e quante monete sono davvero operabili via API. Per decidere se andare sul Reale, conviene fissare già adesso i numeri minimi della Prova: per esempio almeno 100 operazioni, slittamento medio misurato sotto lo 0,15% per lato e lordo medio sopra lo 0,5%.
<!-- conclusione:fine -->

## Cosa è stato verificato
- **Regola**: solo altcoin; segnale quando il rendimento degli ultimi 15 o 60 minuti supera **12 volte** il movimento normale; si segue il movimento; entrata a mercato al minuto dopo; uscite Wisi Trade (stop 1,5 unità, poi stop che segue 1 unità e protezione 40%), durata massima e pausa 4 ore.
- **A**: 22 delle 50 monete che esistevano prima del 2023 (BTC ed ETH escluse dalla regola), operazioni dal 2020-01-01 al 2022-12-31. Dati da settembre 2019 solo per calcolare il movimento normale e l'unità.
- **B**: le 50 monete dalla 51ª alla 100ª di `docs/universo.md`, dal 2023-01-01 al 2026-11-10.
- **A + B**: un unico portafoglio con tutte queste operazioni (A dal 2020 al 2022, B dal 2023).
- **Metodo**: come negli altri test. 10.000 USDT, 10 posizioni, margine 10%, leva 3x e 5x, freno 8% su perdita chiusa + aperta, dimensione fissa e composto, media di 10 ordini casuali. Commissione 0,06% per lato, slittamento 0,05% / 0,08% / 0,12% per lato (minimo 0,08% dalla 15ª moneta, quindi quasi tutte), funding reale.

## I criteri decisi prima
Dimensione fissa, leva 3x, slittamento 0,08%. **Verdetto: regge.**

| Criterio | Risultato | Soddisfatto |
|---|---|---|
| A + B: rendimento positivo e profit factor almeno 1,10 | 396,5%, PF 1,54 | sì |
| A + B: lordo medio per operazione almeno 0,30% | 0,801% | sì |
| in utile sia su A sia su B da soli | A 100,2%, B 293,9% | sì |
| con slittamento 0,12% non in perdita | 329,1% | sì |

## Risultati
Singole operazioni (senza limiti di posti), slittamento 0,08%:

| Dati | Operazioni | Lordo medio | Netto medio (0,05%) | Netto medio (0,08%) | Netto medio (0,12%) | PF (0,08%) | Vincenti |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 936 | 0,629% | 0,378% | 0,351% | 0,272% | 1,38 | 66% |
| B | 2.053 | 0,879% | 0,598% | 0,598% | 0,519% | 1,72 | 66% |
| A + B | 2.989 | 0,801% | 0,529% | 0,521% | 0,441% | 1,61 | 66% |

Portafoglio:

| Dati | Slittamento | Leva | Dimensione | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| A | 0,05% | 3x | fissa | 107,6% | 1,42 | 13,4% | -4,6% | 927 | 0,387% |
| A | 0,05% | 3x | composto | 108,4% | 1,26 | 19,8% | -9,0% | 917 | 0,301% |
| A | 0,05% | 5x | fissa | 183,2% | 1,44 | 18,3% | -4,6% | 927 | 0,395% |
| A | 0,05% | 5x | composto | 208,1% | 1,21 | 35,3% | -10,4% | 917 | 0,297% |
| A | 0,08% | 3x | fissa | 100,2% | 1,39 | 14,0% | -4,7% | 927 | 0,360% |
| A | 0,08% | 3x | composto | 93,8% | 1,23 | 20,1% | -9,1% | 917 | 0,275% |
| A | 0,08% | 5x | fissa | 130,4% | 1,31 | 19,2% | -8,1% | 923 | 0,282% |
| A | 0,08% | 5x | composto | 173,0% | 1,19 | 37,0% | -10,6% | 917 | 0,271% |
| A | 0,12% | 3x | fissa | 78,0% | 1,30 | 15,6% | -5,0% | 927 | 0,281% |
| A | 0,12% | 3x | composto | 55,8% | 1,15 | 23,5% | -9,4% | 917 | 0,195% |
| A | 0,12% | 5x | fissa | 94,3% | 1,22 | 21,5% | -8,9% | 917 | 0,206% |
| A | 0,12% | 5x | composto | 89,9% | 1,11 | 42,1% | -11,0% | 917 | 0,191% |
| B | 0,05% | 3x | fissa | 293,9% | 1,61 | 9,4% | -4,0% | 1.897 | 0,516% |
| B | 0,05% | 3x | composto | 1.257,1% | 1,36 | 29,9% | -9,2% | 1.891 | 0,508% |
| B | 0,05% | 5x | fissa | 499,7% | 1,63 | 11,6% | -5,9% | 1.897 | 0,527% |
| B | 0,05% | 5x | composto | 6.433,0% | 1,35 | 39,3% | -12,4% | 1.881 | 0,519% |
| B | 0,08% | 3x | fissa | 293,9% | 1,61 | 9,4% | -4,0% | 1.897 | 0,516% |
| B | 0,08% | 3x | composto | 1.257,1% | 1,36 | 29,9% | -9,2% | 1.891 | 0,508% |
| B | 0,08% | 5x | fissa | 499,7% | 1,63 | 11,6% | -5,9% | 1.897 | 0,527% |
| B | 0,08% | 5x | composto | 6.433,0% | 1,35 | 39,3% | -12,4% | 1.881 | 0,519% |
| B | 0,12% | 3x | fissa | 248,5% | 1,50 | 11,9% | -4,4% | 1.897 | 0,437% |
| B | 0,12% | 3x | composto | 769,4% | 1,29 | 34,4% | -9,2% | 1.891 | 0,428% |
| B | 0,12% | 5x | fissa | 424,3% | 1,52 | 13,0% | -6,6% | 1.897 | 0,447% |
| B | 0,12% | 5x | composto | 3.019,4% | 1,28 | 44,8% | -13,1% | 1.881 | 0,440% |
| A + B | 0,05% | 3x | fissa | 403,9% | 1,55 | 13,4% | -4,6% | 2.824 | 0,477% |
| A + B | 0,05% | 3x | composto | 2.774,7% | 1,35 | 30,0% | -9,2% | 2.808 | 0,443% |
| A + B | 0,05% | 5x | fissa | 687,0% | 1,57 | 18,3% | -4,6% | 2.824 | 0,487% |
| A + B | 0,05% | 5x | composto | 20.782,6% | 1,35 | 39,3% | -11,6% | 2.798 | 0,449% |
| A + B | 0,08% | 3x | fissa | 396,5% | 1,54 | 14,0% | -4,7% | 2.824 | 0,468% |
| A + B | 0,08% | 3x | composto | 2.573,2% | 1,35 | 30,0% | -9,2% | 2.808 | 0,434% |
| A + B | 0,08% | 5x | fissa | 634,2% | 1,52 | 19,2% | -8,1% | 2.820 | 0,450% |
| A + B | 0,08% | 5x | composto | 18.409,2% | 1,35 | 39,3% | -11,6% | 2.798 | 0,441% |
| A + B | 0,12% | 3x | fissa | 329,1% | 1,43 | 15,6% | -5,0% | 2.824 | 0,388% |
| A + B | 0,12% | 3x | composto | 1.277,9% | 1,28 | 34,3% | -9,4% | 2.808 | 0,355% |
| A + B | 0,12% | 5x | fissa | 522,7% | 1,42 | 21,5% | -8,9% | 2.814 | 0,372% |
| A + B | 0,12% | 5x | composto | 6.049,6% | 1,27 | 44,9% | -12,1% | 2.798 | 0,361% |

## Anno per anno
Dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT.

| Anno | Dati | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto | Lordo medio |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2020 | A | 41,2% | 1,66 | 14,0% | -2,4% | 230 | 0,597% | 0,875% |
| 2021 | A | 22,3% | 1,19 | 18,9% | -8,2% | 336 | 0,221% | 0,719% |
| 2022 | A | 12,9% | 1,17 | 16,4% | -6,8% | 351 | 0,123% | 0,384% |
| 2023 | B | 56,2% | 1,88 | 8,1% | -4,0% | 361 | 0,519% | 0,978% |
| 2024 | B | 101,2% | 2,23 | 5,5% | -3,8% | 387 | 0,872% | 1,162% |
| 2025 | B | 71,2% | 1,77 | 7,8% | -2,7% | 376 | 0,631% | 0,861% |
| 2026 (parziale) | B | 60,6% | 1,25 | 25,8% | -8,3% | 771 | 0,262% | 0,695% |

## Scomposizione (singole operazioni, slittamento 0,08%)
| Gruppo | Operazioni | Lordo medio | Netto medio | PF | Vincenti |
|---|---:|---:|---:|---:|---:|
| A (2020–2022) | 936 | 0,629% | 0,351% | 1,38 | 66% |
| B (monete 51–100) | 2.053 | 0,879% | 0,598% | 1,72 | 66% |
| Long | 1.216 | 0,454% | 0,175% | 1,22 | 68% |
| Short | 1.773 | 1,039% | 0,758% | 1,83 | 64% |
| Giorni feriali | 2.353 | 0,684% | 0,405% | 1,46 | 65% |
| Weekend | 636 | 1,232% | 0,951% | 2,18 | 68% |
| Finestra 15 min | 2.881 | 0,792% | 0,513% | 1,60 | 65% |
| Finestra 60 min | 108 | 1,029% | 0,738% | 1,85 | 83% |
| Ore 00–04 UTC | 556 | 0,719% | 0,440% | 1,46 | 65% |
| Ore 04–08 UTC | 422 | 0,880% | 0,602% | 1,57 | 63% |
| Ore 08–12 UTC | 423 | 0,322% | 0,040% | 1,04 | 64% |
| Ore 12–16 UTC | 606 | 0,793% | 0,514% | 1,72 | 66% |
| Ore 16–20 UTC | 536 | 0,697% | 0,414% | 1,49 | 65% |
| Ore 20–24 UTC | 446 | 1,418% | 1,137% | 2,66 | 72% |

Uscite: protezione del guadagno 51%, stop loss 30%, stop che segue 18%, durata massima 0%.

**Concentrazione**: le 5 monete migliori fanno 25% del risultato netto delle singole operazioni (ICPUSDT 51 oper., netto medio 1,85%; ESPORTSUSDT 51 oper., netto medio 1,58%; ALGOUSDT 52 oper., netto medio 1,47%; ZECUSDT 50 oper., netto medio 1,49%; FILUSDT 62 oper., netto medio 0,98%). Le 5 peggiori: SOLUSDT -1,08%, CAPUSDT -2,14%, LSKUSDT -0,43%, AVAXUSDT -0,41%, LTCUSDT -0,21%.

## Rischio: da dove vengono i cali
### Il calo del 41% già visto: versione base "segui, 60 minuti, oltre 8×, tutte le monete" nel 30% (dati già usati)
- Calo del **40,6%** dal 2026-04-09 al 2026-07-09 (91 giorni, 67 con operazioni chiuse), da 15.943 a 9.470 USDT.
- 228 operazioni chiuse nel calo, 101 in perdita; la serie più lunga di perdite di fila è di **7**.
- Il giorno peggiore pesa il **13%** della discesa, i 3 giorni peggiori il **30%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2026-04-14 | -860 USDT | 5 | 3 / 2 | 1 long |
| 2026-06-04 | -592 USDT | 22 | 2 / 20 | 7 short |
| 2026-05-07 | -521 USDT | 3 | 2 / 1 | 1 long |
| 2026-06-13 | -496 USDT | 2 | 1 / 1 | 1 long |
| 2026-04-16 | -454 USDT | 4 | 3 / 1 | 1 long |

### Regola fissata su A + B (portafoglio, dimensione fissa, leva 3x, slittamento 0,08%)
- Calo del **14,0%** dal 2020-09-03 al 2020-12-22 (110 giorni, 29 con operazioni chiuse), da 14.854 a 12.773 USDT.
- 76 operazioni chiuse nel calo, 40 in perdita; la serie più lunga di perdite di fila è di **7**.
- Il giorno peggiore pesa il **16%** della discesa, i 3 giorni peggiori il **44%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2020-11-24 | -333 USDT | 14 | 6 / 8 | 2 short |
| 2020-11-26 | -313 USDT | 6 | 0 / 6 | 3 short |
| 2020-11-07 | -264 USDT | 3 | 2 / 1 | 1 long |
| 2020-11-18 | -257 USDT | 8 | 0 / 8 | 4 short |
| 2020-12-01 | -200 USDT | 2 | 0 / 2 | 1 short |

### Regola fissata solo su A (2020–2022)
- Calo del **14,0%** dal 2020-09-03 al 2020-12-22 (110 giorni, 29 con operazioni chiuse), da 14.854 a 12.773 USDT.
- 76 operazioni chiuse nel calo, 40 in perdita; la serie più lunga di perdite di fila è di **7**.
- Il giorno peggiore pesa il **16%** della discesa, i 3 giorni peggiori il **44%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2020-11-24 | -333 USDT | 14 | 6 / 8 | 2 short |
| 2020-11-26 | -313 USDT | 6 | 0 / 6 | 3 short |
| 2020-11-07 | -264 USDT | 3 | 2 / 1 | 1 long |
| 2020-11-18 | -257 USDT | 8 | 0 / 8 | 4 short |
| 2020-12-01 | -200 USDT | 2 | 0 / 2 | 1 short |

### Regola fissata solo su B (monete 51–100)
- Calo del **9,5%** dal 2026-03-24 al 2026-06-23 (92 giorni, 63 con operazioni chiuse), da 36.349 a 32.899 USDT.
- 150 operazioni chiuse nel calo, 56 in perdita; la serie più lunga di perdite di fila è di **7**.
- Il giorno peggiore pesa il **25%** della discesa, i 3 giorni peggiori il **69%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2026-06-13 | -878 USDT | 2 | 1 / 1 | 1 short |
| 2026-06-04 | -831 USDT | 15 | 2 / 13 | 2 short |
| 2026-04-17 | -685 USDT | 3 | 2 / 1 | 0  |
| 2026-04-10 | -288 USDT | 3 | 2 / 1 | 1 short |
| 2026-05-14 | -257 USDT | 3 | 2 / 1 | 1 short |

Segnali scartati nel portafoglio A + B: posti pieni 165, freno 0.

## Limiti
- **Le monete sono scelte con la liquidità di oggi**, anche quelle dei dati nuovi: per A sono le monete che esistono ancora e sono tra le più liquide nel 2026; per B quelle che sono arrivate tra le prime 100. Le monete crollate o tolte dalla quotazione non ci sono. Questo favorisce i risultati, soprattutto i long.
- Su A le monete sono poche (le più vecchie e grandi), su B sono quasi tutte piccole e recenti: i due gruppi sono diversi dal 70% usato per fissare la regola, ed è proprio questo che serve a verificarla.
- L'entrata avviene nei primi minuti di un movimento violento: su Bitunix lo slittamento può essere più alto anche dello 0,12%.

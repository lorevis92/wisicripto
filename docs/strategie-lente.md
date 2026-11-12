# Strategie lente: classifica settimanale e rincorsa di BTC

Aggiornato il 2026-11-12. Regole e scelta fissate prima: `docs/regola-fissata-classifica.md`. Script: `research/13-strategie-lente.js`. Dati: `research/12-scarica-lente.js`.

<!-- conclusione:inizio -->
## Conclusione
**No: con i criteri decisi prima nessuna strategia lenta regge sulla verifica dal 2024.** Le quattro regole scelte sul 2020–2023 sono state provate una sola volta:

| Famiglia | Regola scelta | Verifica dal 2024 | Perché non passa |
|---|---|---|---|
| A · classifica | ultime 4 settimane, long e short, prime 50 | +198%, PF 1,27 | peggior calo 43,6%, oltre il limite del 40% |
| B · funding | contro il funding della settimana, long e short, prime 100 | +16%, PF 1,02 | PF sotto 1,10; solo su monete Bitunix −9,5%; 2026 −61% |
| C · filtro BTC | ultime 4 settimane, long sopra la media 100 di BTC, fuori sotto | rovina | perde in tutti e tre gli anni |
| D · rincorsa | BTC oltre 3 volte la volatilità, monete rimaste indietro, 3 giorni | −21%, PF 0,65 | perde, e fa peggio della sua versione base |

**La A è andata vicina, ma il suo risultato non è affidabile.** Mancava un solo criterio, e di poco. Guardando dentro il risultato però si vede che non è una regola su cui costruire:
- **Viene da poche monete.** Le 10 monete migliori (PIPPIN, MYX, RIVER, BEAT, LAB e altre piccole) fanno +258% del capitale, più di tutto il risultato (+198%). Tutte le altre insieme perdono il 60%.
- **Più di metà viene dal funding.** Durante le loro salite queste monete hanno avuto per settimane un funding fino a −2% ogni 4 ore, che i long incassavano: +109% del capitale. Su Bitunix il funding può essere diverso, e questi casi non si ripetono a comando.
- **Senza funding resta +89%, quasi tutto dalla gamba short.** Dal 2024 le altcoin sono scese, e vendere quelle già in calo ha reso. La gamba long ha perso.
- **Nel 2020–2023 era il contrario.** Vincevano i long, e gli short andavano in rovina. La "classifica" non ha un vantaggio stabile: vince la gamba che va nella direzione del mercato delle altcoin di quel periodo.
- **Il rischio è alto.** Con l'interesse composto a 2x arriva alla rovina anche nella verifica.

**Le altre cose che emergono.**
- **Il filtro BTC (C) era il migliore sul 2020–2023**, con un PF fino a 2,5, e il peggiore dal 2024. È l'esempio più chiaro di una regola adattata a un periodo: nel 2020–2021 tutto saliva insieme a BTC.
- **Andare contro il funding (B2)** non regge fuori dal periodo di scelta. Escludere i long affollati (B1) non aggiunge niente di stabile rispetto ad A.
- **La rincorsa di BTC (D)** non funziona. Le monete rimaste indietro non recuperano, e la versione su tutte le monete fa meglio della selezione.
- **I costi pesano poco**: commissioni e slittamento sono il 12–21% del capitale in quasi tre anni, e lo slittamento alto cambia poco. Il problema non sono i costi ma l'assenza di un vantaggio stabile.
- **Le monete tolte da Binance contano**: 163 su 679, più di 130 tolte dal 2024. Senza di loro l'universo sarebbe stato diverso. Nelle regole provate non cambiano il verdetto.

**Su quante monete di Bitunix si potrebbe fare.** In pratica su quasi tutte quelle che servono:
- delle prime 50 altcoin di oggi per volume, 47 sono operabili su Bitunix, e tutte scambiano più di 1 milione di USDT al giorno;
- delle prime 100, 95 sono operabili su Bitunix.

Con 10.000 USDT le posizioni sono da 250–1.000 USDT, molto sotto la profondità del book. **Il limite non è Bitunix: è che nessuna regola regge.**

**Cosa vuol dire per il progetto.**
- Nessuna strategia lenta va in Fase 1.
- Una A con un limite di calo più largo passerebbe, ma cambiare il criterio dopo aver visto la verifica è proprio quello che la divisione serve a evitare.
- Se si vuole riprovare la A, andrebbe fissata così com'è e seguita in Simulazione sui dati dopo il 12/11/2026, sapendo che il risultato del 2024–2026 dipende da poche monete e dal funding.
<!-- conclusione:fine -->

## Dati
- **679 perpetual crypto USDT-M** di Binance dal 2020: 516 ancora attivi e **163 tolti**. Gli scartati (azioni, materie prime, indici, USDC, oro) sono 244.
- Candele da 1 ora fino al 2026-11-11 compreso; le giornaliere sono ricavate dalle orarie.
  - Controllo su 12 monete, attive e tolte: 360 giorni confrontati con i file giornalieri ufficiali, 0 diversi.
- Funding reale di ogni moneta. Operabili oggi su Bitunix: 490 delle monete della lista.

## Verifica dal 2024 delle regole scelte
Una regola per famiglia, scelta sul 2020–2023 con criteri decisi prima. Qui è provata una sola volta, dal 01/01/2024 a ieri.

### A: A · ultime 4 settimane · long e short · prime 50 — **non regge**
| Criterio | Risultato | Soddisfatto |
|---|---|---|
| rendimento positivo e PF almeno 1,10 | 198,4%, PF 1,27 | sì |
| positivo con slittamento alto | 192,4% | sì |
| in utile in almeno 2 anni su 3 | 2024: 16,4%, 2025: 73,2%, 2026: 108,9% | sì |
| peggior calo al massimo 40% | 43,6% | **no** |
| solo monete operabili su Bitunix: positivo | 244,1% | sì |

| Variante | Rendimento | Medio annuo | PF | Peggior calo | Settimana peggiore | Operazioni | Netto medio per operazione | Anno per anno |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Regola scelta | 198,4% | 69,3% | 1,27 | 43,6% | -16,2% | 1.373 | 2,89% | 16% / 73% / 109% |
| Solo monete operabili su Bitunix | 244,1% | 85,3% | 1,34 | 34,9% | -12,9% | 1.382 | 3,53% | 15% / 127% / 102% |
| Slittamento alto | 192,4% | 67,2% | 1,26 | 44,4% | -16,5% | 1.373 | 2,80% | 14% / 71% / 107% |
| Esposizione 2x | 396,8% | 138,6% | 1,27 | 57,7% | -21,7% | 1.373 | 2,89% | 33% / 146% / 218% |
| Interesse composto, 1x | 397,9% | 75,2% | 1,22 | 83,9% | -32,2% | 1.373 | 2,94% | 13% / 71% / 157% |
| Interesse composto, 2x | -100,0% (rovina) | -100,0% | 0,94 | 103,0% | -103,3% | 881 | 0,96% | 19% / -112% / 0% |

Da dove viene il risultato (somme in % del capitale iniziale; dimensione fissa, 1x, slittamento normale):

| Parte | Operazioni | Lordo | Netto | Netto medio per operazione |
|---|---:|---:|---:|---:|
| Gamba long | 624 | -70,1% | 49,3% | 1,58% |
| Gamba short | 749 | 180,6% | 149,1% | 3,98% |
| Monete ancora attive | 1.255 | 79,4% | 160,9% | 2,56% |
| Monete tolte da Binance | 118 | 31,0% | 37,5% | 6,35% |
| Monete operabili su Bitunix | 1.201 | 68,0% | 150,6% | 2,51% |
| Monete non su Bitunix | 172 | 42,5% | 47,8% | 5,56% |

Costi: lordo 110,5% del capitale, commissioni e slittamento 21,0%, funding -108,9% (positivo = pagato). I costi valgono -80% del lordo. Durata media di un'operazione 15,2 giorni; monete diverse toccate: 399.

### B: B2 · contro il funding della settimana · long e short · prime 100 — **non regge**
| Criterio | Risultato | Soddisfatto |
|---|---|---|
| rendimento positivo e PF almeno 1,10 | 16,1%, PF 1,02 | **no** |
| positivo con slittamento alto | 8,1% | sì |
| in utile in almeno 2 anni su 3 | 2024: 1,2%, 2025: 76,2%, 2026: -61,1% | sì |
| peggior calo al massimo 40% | 39,8% | sì |
| solo monete operabili su Bitunix: positivo | -9,5% | **no** |

| Variante | Rendimento | Medio annuo | PF | Peggior calo | Settimana peggiore | Operazioni | Netto medio per operazione | Anno per anno |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Regola scelta | 16,1% | 5,6% | 1,02 | 39,8% | -21,3% | 2.634 | 0,25% | 1% / 76% / -61% |
| Versione base: A · ultime 1 settimane · long e short · prime 100 | 165,9% | 57,9% | 1,18 | 22,5% | -7,9% | 4.657 | 1,42% | 11% / 133% / 23% |
| Solo monete operabili su Bitunix | -9,5% | -3,3% | 0,99 | 49,0% | -18,1% | 2.614 | -0,14% | 4% / 56% / -70% |
| Slittamento alto | 8,1% | 2,8% | 1,01 | 42,2% | -21,4% | 2.634 | 0,13% | -2% / 73% / -63% |
| Esposizione 2x | 32,2% | 11,2% | 1,02 | 53,7% | -42,4% | 2.634 | 0,25% | 2% / 152% / -122% |
| Interesse composto, 1x | -7,7% | -2,8% | 0,99 | 56,9% | -21,3% | 2.634 | 0,26% | -3% / 89% / -50% |
| Interesse composto, 2x | -47,8% | -20,3% | 0,98 | 84,3% | -42,7% | 2.634 | 0,26% | -15% / 185% / -78% |

Da dove viene il risultato (somme in % del capitale iniziale; dimensione fissa, 1x, slittamento normale):

| Parte | Operazioni | Lordo | Netto | Netto medio per operazione |
|---|---:|---:|---:|---:|
| Gamba long | 1.260 | -141,6% | -2,5% | -0,08% |
| Gamba short | 1.374 | 23,8% | 18,6% | 0,55% |
| Monete ancora attive | 2.286 | -125,3% | -1,7% | -0,03% |
| Monete tolte da Binance | 348 | 7,6% | 17,9% | 2,05% |
| Monete operabili su Bitunix | 2.204 | -129,6% | -8,9% | -0,16% |
| Monete non su Bitunix | 430 | 11,8% | 25,0% | 2,32% |

Costi: lordo -117,8% del capitale, commissioni e slittamento 20,4%, funding -154,2% (positivo = pagato). I costi valgono più del lordo, che è negativo o nullo. Durata media di un'operazione 15,9 giorni; monete diverse toccate: 550.

### C: C · ultime 4 settimane · BTC sopra la media 100: long, sotto: fuori · prime 50 — **non regge**
| Criterio | Risultato | Soddisfatto |
|---|---|---|
| rendimento positivo e PF almeno 1,10 | -100,0% (rovina), PF 0,81 | **no** |
| positivo con slittamento alto | -100,0% (rovina) | **no** |
| in utile in almeno 2 anni su 3 | 2024: -26,5%, 2025: -47,1%, 2026: -27,9% | **no** |
| peggior calo al massimo 40% | 101,0% | **no** |
| solo monete operabili su Bitunix: positivo | 42,1% | sì |

| Variante | Rendimento | Medio annuo | PF | Peggior calo | Settimana peggiore | Operazioni | Netto medio per operazione | Anno per anno |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Regola scelta | -100,0% (rovina) | -35,4% | 0,81 | 101,0% | -115,9% | 391 | -2,60% | -27% / -47% / -28% |
| Versione base: A · ultime 4 settimane · solo long · prime 50 | 98,6% | 34,4% | 1,11 | 81,5% | -40,9% | 624 | 1,58% | 9% / 7% / 83% |
| Solo monete operabili su Bitunix | 42,1% | 14,7% | 1,08 | 96,5% | -67,4% | 393 | 1,07% | -13% / 91% / -36% |
| Slittamento alto | -100,0% (rovina) | -35,3% | 0,81 | 100,8% | -118,3% | 391 | -2,59% | -28% / -48% / -25% |
| Esposizione 2x | -100,0% (rovina) | -35,0% | 0,67 | 100,2% | -101,4% | 130 | -3,86% | -100% / 0% / 0% |
| Interesse composto, 1x | -84,0% | -47,3% | 0,72 | 90,8% | -22,3% | 393 | -2,74% | -44% / -51% / -42% |
| Interesse composto, 2x | -99,4% | -83,4% | 0,66 | 99,8% | -44,7% | 393 | -2,64% | -84% / -85% / -76% |

Da dove viene il risultato (somme in % del capitale iniziale; dimensione fissa, 1x, slittamento normale):

| Parte | Operazioni | Lordo | Netto | Netto medio per operazione |
|---|---:|---:|---:|---:|
| Gamba long | 391 | -125,8% | -101,5% | -2,60% |
| Gamba short | 0 | 0,0% | 0,0% | – |
| Monete ancora attive | 349 | -147,2% | -129,9% | -3,72% |
| Monete tolte da Binance | 42 | 21,4% | 28,4% | 6,76% |
| Monete operabili su Bitunix | 336 | -134,0% | -115,2% | -3,43% |
| Monete non su Bitunix | 55 | 8,1% | 13,7% | 2,49% |

Costi: lordo -125,8% del capitale, commissioni e slittamento 11,7%, funding -36,0% (positivo = pagato). I costi valgono più del lordo, che è negativo o nullo. Durata media di un'operazione 14,9 giorni; monete diverse toccate: 220.

### D: D · BTC oltre 3 volte la volatilità · monete rimaste indietro · 3 giorni · prime 100 — **non regge**
| Criterio | Risultato | Soddisfatto |
|---|---|---|
| rendimento positivo e PF almeno 1,10 | -21,3%, PF 0,65 | **no** |
| positivo con slittamento alto | -22,2% | **no** |
| in utile in almeno 2 anni su 3 | 2024: 1,9%, 2025: -22,6%, 2026: -0,5% | **no** |
| peggior calo al massimo 40% | 30,3% | sì |
| solo monete operabili su Bitunix: positivo | -17,9% | **no** |

| Variante | Rendimento | Medio annuo | PF | Peggior calo | Settimana peggiore | Operazioni | Netto medio per operazione | Anno per anno |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Regola scelta | -21,3% | -7,4% | 0,65 | 30,3% | -9,5% | 656 | 0,78% | 2% / -23% / -1% |
| Versione base: D base · BTC oltre 3 volte la volatilità · tutte le monete · 3 giorni · prime 100 | -4,1% | -1,4% | 0,91 | 20,0% | -4,6% | 2.599 | -0,48% | 5% / -14% / 6% |
| Solo monete operabili su Bitunix | -17,9% | -6,3% | 0,70 | 26,0% | -8,6% | 646 | 0,68% | 0% / -17% / -1% |
| Slittamento alto | -22,2% | -7,8% | 0,64 | 30,8% | -9,6% | 656 | 0,67% | 2% / -23% / -1% |
| Esposizione 2x | -42,5% | -14,8% | 0,65 | 56,2% | -22,1% | 656 | 0,78% | 4% / -45% / -1% |
| Interesse composto, 1x | -20,1% | -7,5% | 0,64 | 28,7% | -8,3% | 656 | 0,77% | 2% / -21% / -1% |
| Interesse composto, 2x | -37,6% | -15,2% | 0,62 | 50,0% | -16,7% | 656 | 0,77% | 3% / -38% / -2% |

Da dove viene il risultato (somme in % del capitale iniziale; dimensione fissa, 1x, slittamento normale):

| Parte | Operazioni | Lordo | Netto | Netto medio per operazione |
|---|---:|---:|---:|---:|
| Gamba long | 415 | 0,9% | -0,4% | 2,34% |
| Gamba short | 241 | -16,3% | -20,9% | -1,92% |
| Monete ancora attive | 586 | -14,8% | -20,4% | 0,80% |
| Monete tolte da Binance | 70 | -0,5% | -0,9% | 0,59% |
| Monete operabili su Bitunix | 568 | -15,5% | -20,9% | 0,79% |
| Monete non su Bitunix | 88 | 0,1% | -0,3% | 0,69% |

Costi: lordo -15,4% del capitale, commissioni e slittamento 2,7%, funding 3,1% (positivo = pagato). I costi valgono più del lordo, che è negativo o nullo. Durata media di un'operazione 3,2 giorni; monete diverse toccate: 309.

## Tutte le varianti (solo per informazione)
Le altre varianti sono state guardate sulla verifica solo dopo la scelta: non contano per il verdetto. Dimensione fissa, esposizione 1x, slittamento normale.

| Variante | Scelta 2020–2023: rendimento | PF | Verifica dal 2024: rendimento | PF | Peggior calo | Anno per anno |
|---|---:|---:|---:|---:|---:|---|
| A · ultime 1 settimane · long e short · prime 50 | 110,3% | 1,10 | 208,6% | 1,22 | 47,6% | -5% / 126% / 88% |
| A · ultime 1 settimane · solo long · prime 50 | 402,8% | 1,39 | 136,8% | 1,12 | 84,3% | 22% / 56% / 59% |
| A · ultime 1 settimane · solo short · prime 50 | -100,0% (rovina) | 0,61 | 280,4% | 1,35 | 83,9% | -32% / 195% / 117% |
| A · ultime 2 settimane · long e short · prime 50 | 56,2% | 1,06 | 199,3% | 1,24 | 44,5% | -20% / 100% / 120% |
| A · ultime 2 settimane · solo long · prime 50 | 359,5% | 1,40 | -100,0% (rovina) | 0,56 | 100,1% | -100% / 0% / 0% |
| A · ultime 2 settimane · solo short · prime 50 | -100,0% (rovina) | 0,59 | 332,3% | 1,51 | 75,9% | -15% / 182% / 166% |
| A · ultime 4 settimane · long e short · prime 50 **(scelta)** | 92,2% | 1,11 | 198,4% | 1,27 | 43,6% | 16% / 73% / 109% |
| A · ultime 4 settimane · solo long · prime 50 | 443,1% | 1,64 | 98,6% | 1,11 | 81,5% | 9% / 7% / 83% |
| A · ultime 4 settimane · solo short · prime 50 | -100,0% (rovina) | 0,24 | 298,2% | 1,53 | 56,1% | 23% / 140% / 135% |
| B1 · ultime 1 settimane senza affollati · long e short · prime 50 | 115,0% | 1,11 | 170,2% | 1,18 | 59,2% | -12% / 84% / 98% |
| B1 · ultime 1 settimane senza affollati · solo long · prime 50 | 447,4% | 1,47 | 124,5% | 1,12 | 82,4% | 33% / 16% / 76% |
| B1 · ultime 1 settimane senza affollati · solo short · prime 50 | -100,0% (rovina) | 0,59 | -100,0% (rovina) | 0,69 | 100,4% | -101% / 0% / 0% |
| B1 · ultime 2 settimane senza affollati · long e short · prime 50 | 105,2% | 1,11 | 126,2% | 1,15 | 56,6% | -37% / 68% / 95% |
| B1 · ultime 2 settimane senza affollati · solo long · prime 50 | 475,2% | 1,54 | -100,0% (rovina) | 0,54 | 100,9% | -101% / 0% / 0% |
| B1 · ultime 2 settimane senza affollati · solo short · prime 50 | -100,0% (rovina) | 0,60 | 263,5% | 1,36 | 82,5% | -28% / 120% / 171% |
| B1 · ultime 4 settimane senza affollati · long e short · prime 50 | 165,2% | 1,20 | 99,7% | 1,13 | 70,1% | -2% / 46% / 56% |
| B1 · ultime 4 settimane senza affollati · solo long · prime 50 | 607,9% | 1,84 | -100,0% (rovina) | 0,72 | 100,5% | -14% / -86% / 0% |
| B1 · ultime 4 settimane senza affollati · solo short · prime 50 | -100,0% (rovina) | 0,20 | 243,0% | 1,40 | 83,0% | 10% / 114% / 119% |
| B2 · contro il funding della settimana · long e short · prime 50 | 104,9% | 1,12 | -37,0% | 0,96 | 75,1% | -12% / -3% / -22% |
| B2 · contro il funding della settimana · solo long · prime 50 | 361,6% | 1,53 | -92,0% | 0,89 | 94,5% | 16% / -55% / -52% |
| B2 · contro il funding della settimana · solo short · prime 50 | -100,0% (rovina) | 0,59 | -100,0% (rovina) | 0,22 | 101,5% | -102% / 0% / 0% |
| C · ultime 1 settimane · BTC sopra la media 50: long, sotto: short · prime 50 | 538,6% | 1,57 | -100,0% (rovina) | 0,62 | 100,4% | -101% / 0% / 0% |
| C · ultime 1 settimane · BTC sopra la media 50: long, sotto: fuori · prime 50 | 478,5% | 2,03 | -23,0% | 0,97 | 84,4% | -3% / -50% / 30% |
| C · ultime 1 settimane · BTC sopra la media 100: long, sotto: short · prime 50 | 359,2% | 1,35 | -100,0% (rovina) | 0,63 | 100,6% | -101% / 0% / 0% |
| C · ultime 1 settimane · BTC sopra la media 100: long, sotto: fuori · prime 50 | 410,0% | 1,75 | -100,0% (rovina) | 0,84 | 100,3% | -12% / -36% / -53% |
| C · ultime 2 settimane · BTC sopra la media 50: long, sotto: short · prime 50 | 470,6% | 1,56 | -100,0% (rovina) | 0,60 | 100,4% | -101% / 0% / 0% |
| C · ultime 2 settimane · BTC sopra la media 50: long, sotto: fuori · prime 50 | 460,2% | 2,17 | -100,0% (rovina) | 0,51 | 102,3% | -104% / 0% / 0% |
| C · ultime 2 settimane · BTC sopra la media 100: long, sotto: short · prime 50 | 274,6% | 1,29 | -100,0% (rovina) | 0,60 | 100,3% | -100% / 0% / 0% |
| C · ultime 2 settimane · BTC sopra la media 100: long, sotto: fuori · prime 50 | 360,5% | 1,75 | -100,0% (rovina) | 0,56 | 100,6% | -101% / 0% / 0% |
| C · ultime 4 settimane · BTC sopra la media 50: long, sotto: short · prime 50 | 433,0% | 1,60 | -100,0% (rovina) | 0,56 | 100,2% | -100% / 0% / 0% |
| C · ultime 4 settimane · BTC sopra la media 50: long, sotto: fuori · prime 50 | 431,3% | 2,32 | -58,5% | 0,91 | 84,2% | -10% / -58% / 10% |
| C · ultime 4 settimane · BTC sopra la media 100: long, sotto: short · prime 50 | 267,6% | 1,33 | -100,0% (rovina) | 0,58 | 100,4% | -101% / 0% / 0% |
| C · ultime 4 settimane · BTC sopra la media 100: long, sotto: fuori · prime 50 **(scelta)** | 403,9% | 2,12 | -100,0% (rovina) | 0,81 | 101,0% | -27% / -47% / -28% |
| D · BTC oltre 2 volte la volatilità · monete rimaste indietro · 1 giorno · prime 50 | -62,5% | 0,77 | -100,0% (rovina) | 0,46 | 105,1% | -55% / -50% / 0% |
| D base · BTC oltre 2 volte la volatilità · tutte le monete · 1 giorno · prime 50 | -47,5% | 0,83 | -72,8% | 0,70 | 79,0% | -40% / -22% / -10% |
| D · BTC oltre 2 volte la volatilità · monete rimaste indietro · 3 giorni · prime 50 | 6,7% | 1,05 | -10,3% | 0,93 | 44,5% | -9% / -20% / 19% |
| D base · BTC oltre 2 volte la volatilità · tutte le monete · 3 giorni · prime 50 | 11,2% | 1,09 | -11,8% | 0,90 | 40,6% | -7% / -24% / 19% |
| D · BTC oltre 3 volte la volatilità · monete rimaste indietro · 1 giorno · prime 50 | 14,7% | 1,16 | -100,0% (rovina) | 0,17 | 101,4% | -32% / -58% / -11% |
| D base · BTC oltre 3 volte la volatilità · tutte le monete · 1 giorno · prime 50 | -27,6% | 0,76 | -74,4% | 0,39 | 76,7% | -26% / -30% / -19% |
| D · BTC oltre 3 volte la volatilità · monete rimaste indietro · 3 giorni · prime 50 | 16,3% | 1,49 | -6,0% | 0,88 | 31,2% | -2% / -17% / 13% |
| D base · BTC oltre 3 volte la volatilità · tutte le monete · 3 giorni · prime 50 | 20,4% | 1,52 | -4,4% | 0,91 | 20,0% | 3% / -14% / 6% |
| A · ultime 1 settimane · long e short · prime 100 | 45,8% | 1,04 | 165,9% | 1,18 | 22,5% | 11% / 133% / 23% |
| A · ultime 1 settimane · solo long · prime 100 | 334,3% | 1,33 | 137,9% | 1,13 | 61,4% | 59% / 100% / -21% |
| A · ultime 1 settimane · solo short · prime 100 | -100,0% (rovina) | 0,60 | 193,8% | 1,24 | 82,4% | -38% / 165% / 66% |
| A · ultime 2 settimane · long e short · prime 100 | 43,2% | 1,05 | 123,0% | 1,15 | 32,8% | 0% / 96% / 27% |
| A · ultime 2 settimane · solo long · prime 100 | 345,9% | 1,40 | 59,9% | 1,06 | 76,9% | 30% / 30% / 0% |
| A · ultime 2 settimane · solo short · prime 100 | -100,0% (rovina) | 0,60 | 186,2% | 1,27 | 81,6% | -29% / 162% / 53% |
| A · ultime 4 settimane · long e short · prime 100 | 54,1% | 1,07 | 93,4% | 1,12 | 27,8% | -12% / 47% / 58% |
| A · ultime 4 settimane · solo long · prime 100 | 378,0% | 1,58 | 29,8% | 1,03 | 81,1% | 14% / -31% / 47% |
| A · ultime 4 settimane · solo short · prime 100 | -100,0% (rovina) | 0,24 | 157,1% | 1,24 | 85,6% | -39% / 126% / 70% |
| B1 · ultime 1 settimane senza affollati · long e short · prime 100 | 38,1% | 1,04 | 163,6% | 1,18 | 34,2% | 2% / 127% / 35% |
| B1 · ultime 1 settimane senza affollati · solo long · prime 100 | 337,3% | 1,35 | 180,4% | 1,18 | 60,5% | 61% / 118% / 2% |
| B1 · ultime 1 settimane senza affollati · solo short · prime 100 | -100,0% (rovina) | 0,58 | 146,7% | 1,17 | 95,6% | -57% / 136% / 68% |
| B1 · ultime 2 settimane senza affollati · long e short · prime 100 | 57,6% | 1,06 | 119,9% | 1,14 | 32,8% | 10% / 97% / 12% |
| B1 · ultime 2 settimane senza affollati · solo long · prime 100 | 367,7% | 1,43 | 89,0% | 1,10 | 63,3% | 60% / 55% / -26% |
| B1 · ultime 2 settimane senza affollati · solo short · prime 100 | -100,0% (rovina) | 0,59 | 150,8% | 1,20 | 87,8% | -39% / 140% / 51% |
| B1 · ultime 4 settimane senza affollati · long e short · prime 100 | 85,9% | 1,11 | 97,0% | 1,12 | 29,3% | 12% / 40% / 45% |
| B1 · ultime 4 settimane senza affollati · solo long · prime 100 | 443,8% | 1,65 | 70,3% | 1,08 | 57,0% | 71% / -30% / 29% |
| B1 · ultime 4 settimane senza affollati · solo short · prime 100 | -100,0% (rovina) | 0,20 | 123,8% | 1,17 | 92,3% | -48% / 111% / 61% |
| B2 · contro il funding della settimana · long e short · prime 100 **(scelta)** | 107,2% | 1,13 | 16,1% | 1,02 | 39,8% | 1% / 76% / -61% |
| B2 · contro il funding della settimana · solo long · prime 100 | 365,4% | 1,55 | -5,0% | 0,99 | 75,0% | 14% / 24% / -43% |
| B2 · contro il funding della settimana · solo short · prime 100 | -100,0% (rovina) | 0,59 | 37,2% | 1,04 | 79,6% | -11% / 128% / -79% |
| C · ultime 1 settimane · BTC sopra la media 50: long, sotto: short · prime 100 | 471,8% | 1,50 | -100,0% (rovina) | 0,62 | 101,0% | -102% / 0% / 0% |
| C · ultime 1 settimane · BTC sopra la media 50: long, sotto: fuori · prime 100 | 440,3% | 1,97 | 46,3% | 1,07 | 75,3% | 14% / 25% / 7% |
| C · ultime 1 settimane · BTC sopra la media 100: long, sotto: short · prime 100 | 272,4% | 1,26 | 66,5% | 1,07 | 96,7% | -24% / 98% / -8% |
| C · ultime 1 settimane · BTC sopra la media 100: long, sotto: fuori · prime 100 | 359,4% | 1,65 | 9,9% | 1,02 | 67,3% | 24% / 39% / -53% |
| C · ultime 2 settimane · BTC sopra la media 50: long, sotto: short · prime 100 | 475,9% | 1,60 | -100,0% (rovina) | 0,60 | 101,2% | -102% / 0% / 0% |
| C · ultime 2 settimane · BTC sopra la media 50: long, sotto: fuori · prime 100 | 432,9% | 2,12 | 24,0% | 1,04 | 91,7% | -27% / 35% / 16% |
| C · ultime 2 settimane · BTC sopra la media 100: long, sotto: short · prime 100 | 285,4% | 1,32 | -100,0% (rovina) | 0,63 | 100,1% | -100% / 0% / 0% |
| C · ultime 2 settimane · BTC sopra la media 100: long, sotto: fuori · prime 100 | 360,7% | 1,78 | 33,2% | 1,06 | 81,8% | -11% / 62% / -17% |
| C · ultime 4 settimane · BTC sopra la media 50: long, sotto: short · prime 100 | 466,1% | 1,70 | -100,0% (rovina) | 0,57 | 100,6% | -101% / 0% / 0% |
| C · ultime 4 settimane · BTC sopra la media 50: long, sotto: fuori · prime 100 | 442,8% | 2,50 | -83,4% | 0,86 | 94,0% | -24% / -59% / -0% |
| C · ultime 4 settimane · BTC sopra la media 100: long, sotto: short · prime 100 | 268,4% | 1,35 | -100,0% (rovina) | 0,60 | 100,1% | -100% / 0% / 0% |
| C · ultime 4 settimane · BTC sopra la media 100: long, sotto: fuori · prime 100 | 400,5% | 2,19 | -27,9% | 0,95 | 81,4% | -14% / -41% / 27% |
| D · BTC oltre 2 volte la volatilità · monete rimaste indietro · 1 giorno · prime 100 | -58,7% | 0,79 | -100,0% (rovina) | 0,65 | 100,8% | -36% / -37% / -28% |
| D base · BTC oltre 2 volte la volatilità · tutte le monete · 1 giorno · prime 100 | -45,4% | 0,83 | -67,4% | 0,71 | 76,6% | -34% / -25% / -9% |
| D · BTC oltre 2 volte la volatilità · monete rimaste indietro · 3 giorni · prime 100 | 9,0% | 1,08 | -29,4% | 0,80 | 48,4% | -5% / -32% / 8% |
| D base · BTC oltre 2 volte la volatilità · tutte le monete · 3 giorni · prime 100 | 9,1% | 1,07 | -10,6% | 0,90 | 39,1% | -4% / -25% / 18% |
| D · BTC oltre 3 volte la volatilità · monete rimaste indietro · 1 giorno · prime 100 | 0,1% | 1,00 | -82,7% | 0,37 | 83,1% | -24% / -30% / -29% |
| D base · BTC oltre 3 volte la volatilità · tutte le monete · 1 giorno · prime 100 | -30,5% | 0,74 | -66,5% | 0,42 | 68,4% | -22% / -25% / -19% |
| D · BTC oltre 3 volte la volatilità · monete rimaste indietro · 3 giorni · prime 100 **(scelta)** | 16,4% | 1,49 | -21,3% | 0,65 | 30,3% | 2% / -23% / -1% |
| D base · BTC oltre 3 volte la volatilità · tutte le monete · 3 giorni · prime 100 | 19,8% | 1,52 | -4,1% | 0,91 | 20,0% | 5% / -14% / 6% |

## Su quante monete di Bitunix si potrebbe fare
Universo dell'ultimo lunedì (2026-11-09), con i dati di Bitunix di `docs/universo.md`:

| Universo | Monete | Operabili su Bitunix | con almeno 1 mln USDT al giorno su Bitunix | con almeno 20.000 USDT nel book entro lo 0,1% |
|---|---:|---:|---:|---:|
| Prime 50 | 50 | 47 | 47 | 29 |
| Prime 100 | 100 | 95 | 91 | 45 |

Con 10.000 USDT di capitale ed esposizione 1x, ogni posizione vale 250–1.000 USDT secondo la strategia: molto meno della profondità del book di quasi tutte queste monete.

## Limiti
- I prezzi sono quelli di Binance. Su Bitunix il book è più sottile, e il funding può essere diverso da quello di Binance.
- Per sapere se una moneta è operabile su Bitunix si usa la lista di oggi. Le monete tolte da Binance di solito non ci sono più nemmeno su Bitunix.
- All'inizio del 2020 l'universo aveva poco più di 10 altcoin: le gambe avevano 2–3 monete, e il crollo di marzo 2020 pesa molto sul peggior calo del periodo di scelta.
- Si provano più famiglie. Anche con la divisione fissata prima, una regola su quattro può passare per caso.

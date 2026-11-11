# Verifica della regola su dati mai usati

Aggiornato il 2026-11-11. Regola: `docs/regola-fissata.md` (fissata prima di questo test e non cambiata). Script: `research/08-verifica-dati-nuovi.js`. Risultati completi: `data/backtest/verifica/risultati.json`.

<!-- conclusione:inizio -->
## Conclusione
**No: dopo la revisione la regola non regge.** Il primo verdetto ("regge", +397%) dipendeva da un'ipotesi sulle candele che si è rivelata troppo favorevole. La regola non è stata cambiata: è cambiato solo il modo di simulare cosa succede dentro il minuto.

**Cosa è successo.**
- Una revisione indipendente (`docs/revisione.md`) ha confermato che il codice fa quello che dichiara: 20 operazioni rifatte a mano e tutte le 2.989 rigenerate con codice separato coincidono.
- Ha però trovato che quasi metà delle operazioni entra ed esce nello stesso minuto. In quei casi il risultato dipende da cosa il prezzo tocca prima dentro la candela, e con le sole candele non si può sapere.
- Per le 1.247 operazioni in cui questo cambia l'esito ho scaricato i prezzi veri di ogni scambio da Binance (aggTrades: 1.339 giorni, 301.493 minuti, 99,9% coincidenti con le candele). Ho rifatto le operazioni su quei prezzi; un controllo indipendente su 40 di esse torna.

**Il risultato con i prezzi veri** (dimensione fissa, leva 3x, slittamento 0,08%):

| | Lordo medio | Rendimento | Profit factor | Peggior calo |
|---|---:|---:|---:|---:|
| Prima (solo candele) | 0,80% | +397% | 1,54 | 14% |
| **Con i prezzi veri** | **0,32%** | **-14%** | **0,98** | **54%** |
| A da solo (2020–2022) | 0,16% | -41% | 0,84 | 52% |
| B da solo (monete 51–100) | 0,40% | +39% | 1,08 | 35% |

- Dei quattro criteri decisi prima ne passa uno solo, il lordo medio sopra lo 0,30%, e di poco.
- Con lo slittamento allo 0,12% si arriva alla rovina.
- Il pareggio è a circa **0,08% per lato**, cioè proprio lo slittamento ipotizzato (`docs/dimensione-posizione.md`).
- Con lo slittamento stimato dal book di Bitunix (in media 0,17% per lato con posizioni da 3.000 USDT) si perde tutto.

**Perché i prezzi veri cambiano così tanto.**
- La candela ha 4 punti: apertura, massimo, minimo, chiusura. Dentro un minuto di esplosione il prezzo invece sale a scatti, con tanti piccoli ritorni.
- La protezione del guadagno di Wisi Trade si attiva da +0,5 unità e chiude se si restituisce il 40% del guadagno massimo. È strettissima all'inizio: a +0,6 unità basta un ritorno di 0,24 unità.
- Con le candele il prezzo "salta" subito al massimo e la protezione si piazza in alto. Con i prezzi veri scatta su uno dei primi ritorni, con un guadagno piccolo.
- Il risultato: le operazioni chiuse nel minuto d'entrata salgono da 1.460 a 1.830, e sulle operazioni ambigue il lordo medio scende dal 2,17% all'1,02%.
- Questo effetto non si vede nemmeno nell'ipotesi pessimista "estremo sfavorevole per primo" (lordo 0,57%), perché anche lì il percorso ha solo 4 punti.
- In Prova e in Reale il motore riceverebbe proprio i prezzi veri, quindi il risultato giusto è questo.

**Le altre cautele, misurate:**
- Senza gli ultimi 30 giorni di B, quelli usati per scegliere le monete, B scende da +39% a +24%.
- Sempre in B, le monete quotate dal 2025 sono in pareggio (-2%); quelle più vecchie fanno +45%.
- Anno per anno: 2020–2022 tutti in perdita; 2023–2025 in utile; 2026 -35%.
- Il funding pesa pochissimo (0,001% per operazione).

**Cosa vuol dire per il progetto.**
- Questa regola **non va portata in Fase 1**.
- Anche i risultati di `docs/grande-movimento.md` e `docs/regola-fissata.md` usavano le candele, quindi sono gonfiati allo stesso modo. La scelta della regola sul 70% è stata fatta su numeri troppo buoni.
- Resta un segnale debole ma coerente: B, weekend, sera, finestra a 60 minuti e short vanno meglio. Quindi il problema sembra più nelle uscite che nel segnale.
- Provare altre uscite (per esempio senza la protezione stretta all'inizio) sarebbe però una regola nuova, scelta dopo aver visto questi dati. Andrebbe verificata su dati davvero nuovi, cioè quelli dopo l'11/11/2026, oppure fissata prima su un periodo e verificata su un altro, sempre con i prezzi veri.
- Ogni test futuro con uscite strette deve usare i prezzi veri (gli aggTrades), non le 4 punte della candela.
<!-- conclusione:fine -->

## Dopo la revisione indipendente
Una revisione fatta da chi non aveva scritto il codice (`docs/revisione.md`) non ha trovato errori di programmazione. Ha però trovato ipotesi che rendono il risultato migliore del vero. Qui sono corrette o misurate; **la regola è la stessa**.

- **Ordine dentro la candela.** In molte operazioni l'esito dipende da cosa viene toccato prima, il massimo o il minimo del minuto. Per queste operazioni ora si usano i prezzi veri degli scambi di Binance (aggTrades), minuto per minuto dall'entrata alla durata massima: 1.244 operazioni su 2.811 prese dal portafoglio (2.989 segnali), 301.493 minuti di prezzi veri, 300 minuti scartati perché non coincidevano con la candela. Tutti i risultati di questo documento usano i prezzi veri.
- **Portafoglio.** Il peggior calo e il giorno peggiore ora contano anche le perdite aperte, minuto per minuto. Il freno controlla anche le posizioni aperte nello stesso minuto. I fermi di Binance non sono più usati come prezzi validi.

**Ordine dentro la candela** (A + B, dimensione fissa, leva 3x, slittamento 0,08%):

| Percorso dentro il minuto | Lordo medio | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|---:|
| prezzi veri | 0,322% | -13,8% | 0,98 | 54,2% | -13,9% | 2.811 | -0,016% |
| solo candele (regola Wisi Trade) | 0,801% | 396,5% | 1,54 | 14,1% | -6,0% | 2.824 | 0,468% |
| estremo sfavorevole sempre per primo | 0,568% | 205,8% | 1,24 | 18,5% | -6,6% | 2.824 | 0,243% |

**Slittamento per moneta dal book Bitunix** (A + B, dimensione fissa).
- Formula: metà spread + 0,05% × posizione / profondità entro lo 0,1%.
- La profondità è dimezzata per i minuti di esplosione; il minimo è 0,08%.
- Dettagli in `docs/dimensione-posizione.md`.

| Leva (posizione) | Slittamento medio | Mediano | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 3x (3.000 USDT) | 0,17% | 0,08% | -100,0% (rovina) | 0,72 | 100% (rovina) | oltre -100% (rovina) | 1.207 | -0,281% |
| 5x (5.000 USDT) | 0,19% | 0,08% | -100,0% (rovina) | 0,75 | 100% (rovina) | oltre -100% (rovina) | 860 | -0,239% |

**Scelta delle monete di B.** Le monete 51–100 sono state scelte con il volume dei 30 giorni prima del 2026-11-11, che sono dentro il periodo di prova. Molte sono state quotate di recente.

| Parte di B | Monete | Lordo medio | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B, tutto | 50 | 0,396% | 39,0% | 1,08 | 34,8% | -9,6% | 1.899 | 0,068% |
| B senza gli ultimi 30 giorni (dal 2026-10-12, usati per scegliere le monete) | 49 | 0,375% | 23,6% | 1,05 | 34,8% | -9,6% | 1.763 | 0,045% |
| B, monete quotate su Binance prima del 2025 | 28 | 0,426% | 45,3% | 1,17 | 22,6% | -8,4% | 1.310 | 0,115% |
| B, monete quotate dal 2025 | 22 | 0,327% | -2,3% | 0,99 | 38,0% | -11,1% | 624 | -0,012% |

A + B senza gli ultimi 30 giorni di B: rendimento -23,3%, profit factor 0,97, peggior calo 54,2%.

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
| A + B: rendimento positivo e profit factor almeno 1,10 | -13,8%, PF 0,98 | **no** |
| A + B: lordo medio per operazione almeno 0,30% | 0,322% | sì |
| in utile sia su A sia su B da soli | A -40,6%, B 39,0% | **no** |
| con slittamento 0,12% non in perdita | -94,2% (rovina) | **no** |

## Risultati
Singole operazioni (senza limiti di posti), slittamento 0,08%:

| Dati | Operazioni | Lordo medio | Netto medio (0,05%) | Netto medio (0,08%) | Netto medio (0,12%) | PF (0,08%) | Vincenti |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 936 | 0,161% | -0,091% | -0,117% | -0,197% | 0,87 | 62% |
| B | 2.053 | 0,396% | 0,114% | 0,114% | 0,034% | 1,14 | 64% |
| A + B | 2.989 | 0,322% | 0,050% | 0,042% | -0,038% | 1,05 | 64% |

Portafoglio:

| Dati | Slittamento | Leva | Dimensione | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| A | 0,05% | 3x | fissa | -33,6% | 0,87 | 46,6% | -12,0% | 917 | -0,122% |
| A | 0,05% | 3x | composto | -32,2% | 0,86 | 45,2% | -10,4% | 917 | -0,122% |
| A | 0,05% | 5x | fissa | -64,0% | 0,84 | 76,1% | -18,7% | 886 | -0,144% |
| A | 0,05% | 5x | composto | -50,9% | 0,85 | 65,3% | -11,4% | 917 | -0,127% |
| A | 0,08% | 3x | fissa | -40,6% | 0,84 | 51,9% | -12,6% | 917 | -0,148% |
| A | 0,08% | 3x | composto | -37,0% | 0,83 | 48,5% | -10,5% | 917 | -0,149% |
| A | 0,08% | 5x | fissa | -84,1% | 0,79 | 91,0% | -32,6% | 880 | -0,191% |
| A | 0,08% | 5x | composto | -58,6% | 0,82 | 70,2% | -11,5% | 917 | -0,164% |
| A | 0,12% | 3x | fissa | -61,1% | 0,76 | 67,8% | -11,3% | 915 | -0,222% |
| A | 0,12% | 3x | composto | -49,5% | 0,76 | 57,1% | -10,7% | 917 | -0,229% |
| A | 0,12% | 5x | fissa | -100,0% (rovina) | 0,68 | 100% (rovina) | oltre -100% (rovina) | 568 | -0,356% |
| A | 0,12% | 5x | composto | -72,8% | 0,75 | 79,1% | -11,8% | 917 | -0,254% |
| B | 0,05% | 3x | fissa | 39,0% | 1,08 | 34,8% | -9,6% | 1.899 | 0,068% |
| B | 0,05% | 3x | composto | 22,6% | 1,03 | 50,0% | -15,7% | 1.893 | 0,058% |
| B | 0,05% | 5x | fissa | 61,9% | 1,08 | 41,7% | -13,6% | 1.897 | 0,065% |
| B | 0,05% | 5x | composto | 4,9% | 1,00 | 70,3% | -26,8% | 1.883 | 0,045% |
| B | 0,08% | 3x | fissa | 39,0% | 1,08 | 34,8% | -9,6% | 1.899 | 0,068% |
| B | 0,08% | 3x | composto | 22,6% | 1,03 | 50,0% | -15,7% | 1.893 | 0,058% |
| B | 0,08% | 5x | fissa | 61,9% | 1,08 | 41,7% | -13,6% | 1.897 | 0,065% |
| B | 0,08% | 5x | composto | 4,9% | 1,00 | 70,3% | -26,8% | 1.883 | 0,045% |
| B | 0,12% | 3x | fissa | -15,0% | 0,97 | 52,3% | -13,3% | 1.895 | -0,026% |
| B | 0,12% | 3x | composto | -21,9% | 0,96 | 57,2% | -16,0% | 1.893 | -0,021% |
| B | 0,12% | 5x | fissa | -11,1% | 0,99 | 62,1% | -20,9% | 1.884 | -0,012% |
| B | 0,12% | 5x | composto | -51,8% | 0,94 | 77,5% | -27,4% | 1.883 | -0,039% |
| A + B | 0,05% | 3x | fissa | -5,3% | 0,99 | 48,4% | -12,7% | 2.812 | -0,006% |
| A + B | 0,05% | 3x | composto | -18,6% | 0,97 | 51,0% | -15,7% | 2.810 | -0,003% |
| A + B | 0,05% | 5x | fissa | -64,3% (rovina) | 0,92 | 88,8% | -86,7% | 2.264 | -0,069% |
| A + B | 0,05% | 5x | composto | -50,1% | 0,95 | 71,6% | -26,8% | 2.800 | -0,014% |
| A + B | 0,08% | 3x | fissa | -13,8% | 0,98 | 54,2% | -13,9% | 2.811 | -0,016% |
| A + B | 0,08% | 3x | composto | -24,3% | 0,96 | 51,4% | -15,7% | 2.810 | -0,012% |
| A + B | 0,08% | 5x | fissa | -100,0% (rovina) | 0,79 | 100% (rovina) | oltre -100% (rovina) | 1.117 | -0,185% |
| A + B | 0,08% | 5x | composto | -58,0% | 0,93 | 74,7% | -26,8% | 2.800 | -0,026% |
| A + B | 0,12% | 3x | fissa | -94,2% (rovina) | 0,86 | 97,7% | oltre -100% (rovina) | 2.545 | -0,127% |
| A + B | 0,12% | 3x | composto | -61,2% | 0,88 | 69,4% | -16,0% | 2.810 | -0,091% |
| A + B | 0,12% | 5x | fissa | -100,0% (rovina) | 0,68 | 100% (rovina) | oltre -100% (rovina) | 568 | -0,356% |
| A + B | 0,12% | 5x | composto | -87,1% | 0,83 | 91,3% | -27,4% | 2.800 | -0,110% |

## Anno per anno
Dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT.

| Anno | Dati | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto | Lordo medio |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2020 | A | -1,6% | 0,97 | 20,0% | -3,8% | 230 | -0,024% | 0,256% |
| 2021 | A | -28,9% | 0,74 | 36,7% | -12,3% | 336 | -0,287% | 0,085% |
| 2022 | A | -9,7% | 0,88 | 25,0% | -8,0% | 351 | -0,092% | 0,174% |
| 2023 | B | 15,9% | 1,27 | 20,9% | -8,1% | 361 | 0,147% | 0,524% |
| 2024 | B | 36,6% | 1,47 | 24,2% | -9,7% | 387 | 0,315% | 0,617% |
| 2025 | B | 14,7% | 1,16 | 22,1% | -6,8% | 376 | 0,130% | 0,387% |
| 2026 (parziale) | B | -34,7% | 0,85 | 55,5% | -17,3% | 763 | -0,151% | 0,224% |

## Scomposizione (singole operazioni, slittamento 0,08%)
| Gruppo | Operazioni | Lordo medio | Netto medio | PF | Vincenti |
|---|---:|---:|---:|---:|---:|
| A (2020–2022) | 936 | 0,161% | -0,117% | 0,87 | 62% |
| B (monete 51–100) | 2.053 | 0,396% | 0,114% | 1,14 | 64% |
| Long | 1.216 | 0,235% | -0,043% | 0,94 | 65% |
| Short | 1.773 | 0,382% | 0,100% | 1,11 | 62% |
| Giorni feriali | 2.353 | 0,265% | -0,015% | 0,98 | 63% |
| Weekend | 636 | 0,535% | 0,252% | 1,33 | 66% |
| Finestra 15 min | 2.881 | 0,302% | 0,021% | 1,03 | 63% |
| Finestra 60 min | 108 | 0,871% | 0,580% | 1,65 | 80% |
| Ore 00–04 UTC | 556 | 0,393% | 0,114% | 1,13 | 64% |
| Ore 04–08 UTC | 422 | 0,094% | -0,185% | 0,82 | 60% |
| Ore 08–12 UTC | 423 | 0,096% | -0,186% | 0,80 | 61% |
| Ore 12–16 UTC | 606 | 0,351% | 0,072% | 1,10 | 64% |
| Ore 16–20 UTC | 536 | 0,420% | 0,137% | 1,17 | 63% |
| Ore 20–24 UTC | 446 | 0,508% | 0,226% | 1,34 | 68% |

Uscite: protezione del guadagno 60%, stop loss 29%, stop che segue 11%, durata massima 0%.

**Concentrazione**: le 5 monete migliori fanno 159% del risultato netto delle singole operazioni (ICPUSDT 51 oper., netto medio 1,36%; ZEREBROUSDT 54 oper., netto medio 0,73%; ALGOUSDT 52 oper., netto medio 0,59%; UAIUSDT 40 oper., netto medio 0,76%; APTUSDT 54 oper., netto medio 0,51%). Le 5 peggiori: SOLUSDT -1,10%, LSKUSDT -0,64%, CAPUSDT -2,45%, DOGEUSDT -0,41%, USUSDT -0,77%.

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
- Calo del **55,8%** dal 2020-09-03 al 2023-10-29 (1.151 giorni, 309 con operazioni chiuse), da 11.818 a 5.226 USDT.
- 1.088 operazioni chiuse nel calo, 451 in perdita; la serie più lunga di perdite di fila è di **13**.
- Il giorno peggiore pesa il **16%** della discesa, i 3 giorni peggiori il **40%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2021-05-19 | -1.049 USDT | 10 | 0 / 10 | 5 short |
| 2022-06-15 | -914 USDT | 10 | 10 / 0 | 7 long |
| 2021-01-29 | -688 USDT | 4 | 4 / 0 | 1 long |
| 2022-11-10 | -551 USDT | 4 | 3 / 1 | 1 long |
| 2023-10-24 | -544 USDT | 13 | 1 / 12 | 10 short |

### Regola fissata solo su A (2020–2022)
- Calo del **51,5%** dal 2020-09-03 al 2022-12-16 (833 giorni, 213 con operazioni chiuse), da 11.818 a 5.737 USDT.
- 761 operazioni chiuse nel calo, 284 in perdita; la serie più lunga di perdite di fila è di **13**.
- Il giorno peggiore pesa il **17%** della discesa, i 3 giorni peggiori il **44%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2021-05-19 | -1.049 USDT | 10 | 0 / 10 | 5 short |
| 2022-06-15 | -914 USDT | 10 | 10 / 0 | 7 long |
| 2021-01-29 | -688 USDT | 4 | 4 / 0 | 1 long |
| 2022-11-10 | -551 USDT | 4 | 3 / 1 | 1 long |
| 2021-02-10 | -439 USDT | 7 | 1 / 6 | 1 short |

### Regola fissata solo su B (monete 51–100)
- Calo del **35,5%** dal 2026-01-19 al 2026-10-10 (264 giorni, 205 con operazioni chiuse), da 18.624 a 12.007 USDT.
- 597 operazioni chiuse nel calo, 233 in perdita; la serie più lunga di perdite di fila è di **10**.
- Il giorno peggiore pesa il **17%** della discesa, i 3 giorni peggiori il **43%**.

| Giorno peggiore nel calo | Risultato | Operazioni chiuse | Long / short | Massimo aperte insieme dallo stesso lato |
|---|---:|---:|---|---:|
| 2026-02-06 | -1.094 USDT | 20 | 1 / 19 | 10 short |
| 2026-09-13 | -884 USDT | 4 | 3 / 1 | 1 long |
| 2026-06-13 | -878 USDT | 2 | 1 / 1 | 1 short |
| 2026-06-04 | -848 USDT | 15 | 2 / 13 | 1 short |
| 2026-01-31 | -718 USDT | 16 | 1 / 15 | 1 long |

Segnali scartati nel portafoglio A + B: posti pieni 163, freno 15.

## Limiti
- **Prezzi veri solo dove servono**: per le operazioni il cui esito non cambia tra i due ordini estremi si usano le candele. Gli aggTrades sono di Binance, non di Bitunix.
- **Le monete sono scelte con la liquidità di oggi**, anche quelle dei dati nuovi: per A sono le monete che esistono ancora e sono tra le più liquide nel 2026; per B quelle che sono arrivate tra le prime 100. Le monete crollate o tolte dalla quotazione non ci sono. Questo favorisce i risultati, soprattutto i long.
- Su A le monete sono poche (le più vecchie e grandi), su B sono quasi tutte piccole e recenti: i due gruppi sono diversi dal 70% usato per fissare la regola, ed è proprio questo che serve a verificarla.
- L'entrata avviene nei primi minuti di un movimento violento: su Bitunix lo slittamento può essere più alto anche dello 0,12%.

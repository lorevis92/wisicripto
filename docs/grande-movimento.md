# Strategia 2: grande movimento con conferma

Aggiornato il 2026-11-11. Script: `research/06-grande-movimento.js` (motore in `research/motore/`). Risultati completi: `data/backtest/grande-movimento/risultati.json`.

<!-- conclusione:inizio -->
## Conclusione
**No, non regge abbastanza per passare alla Fase 1.** C'è però un vantaggio vero, il più chiaro trovato finora: **seguire i movimenti molto grandi delle altcoin**. È sotto l'obiettivo dello 0,5% lordo e negli ultimi due anni si è indebolito.

**La regola scelta sul 70% non regge.** "Segui, 60 minuti oltre 8 volte il normale, con BTC nella stessa direzione" faceva +97% nel 70% e fa solo **+7%** nel 30%, con profit factor 1,03 e peggior calo 37%.

**La versione base è più solida.** Senza conferme, "segui il movimento, oltre 8 volte il normale" è in utile in entrambi i periodi (dimensione fissa, leva 3x, slittamento 0,08%):

| Variante | Portafoglio 70% | Portafoglio 30% | Lordo per operazione 70% | Lordo per operazione 30% | Netto per operazione 30% | Profit factor 30% |
|---|---:|---:|---:|---:|---:|---:|
| 60 minuti | +83% | **+42%** | 0,57% | 0,46% | +0,18% | 1,18 |
| 15 minuti | +49% | **+99%** | 0,38% | 0,40% | +0,12% | 1,16 |

Delle 10 varianti migliori nel 70%, 9 restano in utile nel 30%. Perché non basta:
- **L'obiettivo dello 0,5% lordo nel 30% non si raggiunge**: i costi si mangiano più di metà del lordo.
- **Il vantaggio cala anno dopo anno.** Per la versione a 60 minuti: 2023 +45%, 2024 +58%, 2025 +13%, 2026 +4%.
- **Il peggior calo nel 30% arriva al 40%**: troppo per il guadagno che dà.
- **Tutto il resto è in perdita.** Con soglie più basse (4× e 6×) si fanno troppe operazioni con poco lordo e il capitale va a zero. "Contro il movimento" non funziona in modo stabile.

**Cosa aggiungono le conferme (rispetto alla base, stessi N, k e direzione):**
- **Rottura del massimo/minimo di 24 ore**: l'unica che aiuta in modo costante, ma poco: +0,04/+0,06% di lordo, migliora in 7–8 combinazioni su 9 in entrambi i periodi, tiene circa 2 operazioni su 3.
- **Trend a 1 ora / 4 ore, BTC nella stessa direzione**: in pratica niente, a volte peggio.
- **Il movimento tiene 3 minuti**: peggiora sempre (-0,06/-0,10% di lordo). Aspettare la conferma fa entrare tardi: il guadagno è nei primi minuti.

**Dove sta il vantaggio** (versione base a 60 minuti, singole operazioni):
- **Solo nelle altcoin**: su BTC ed ETH è in perdita in entrambi i periodi.
- **Short meglio dei long**: i crolli continuano più delle salite.
- **Di notte (20:00–08:00 UTC) molto meglio che di giorno**: tra le 08 e le 16 UTC nel 30% è in perdita.
- **Più il movimento è grande, meglio è**: i movimenti oltre 1,5 volte la soglia rendono circa +2% lordo, ma sono pochi (circa 100 per periodo).

**Correlazione.** Nei giorni "a senso unico" (108 su 679) il risultato medio è +1,5% del capitale e il peggiore -6,6%. Negli altri giorni è circa zero. Il freno non scatta quasi mai; il limite dei 10 posti scarta circa 240 segnali.

**Controllo del motore.** Con entrate a caso e le stesse uscite il lordo è +0,01–0,02%: il motore non crea vantaggi che non ci sono. I +0,4–0,6% delle varianti migliori sono veri, non un effetto delle candele.

**Prossimo passo consigliato.** Il vantaggio cresce con la grandezza del movimento, ma 8× è il massimo della griglia. Il passo naturale è provare soglie più alte (10–12×) solo sulle altcoin, con la rottura delle 24 ore, solo short o con orari notturni. Va fatto sapendo che il 30% attuale è già stato guardato: la verifica onesta di quelle regole sarebbero i mesi futuri, cioè la modalità **Prova** della Fase 1 con capitale finto.
<!-- conclusione:fine -->

## Le regole
- **Grande movimento**: alla chiusura di un minuto, il prezzo della moneta negli ultimi N minuti (5, 15 o 60) si è mosso più di **k volte** (4, 6 o 8) il suo movimento normale a N minuti. Il movimento normale è lo scarto quadratico dei rendimenti a N minuti dei 14 giorni precedenti (solo passato, aggiornato ogni giorno): ogni moneta ha la sua scala.
- **Entrata** a mercato all'apertura del minuto successivo (la decisione si prende sulla candela chiusa). Commissione taker 0,06% e slittamento.
- **Direzione**: "segui" = nella direzione del movimento; "contro" = al contrario (scommessa che rientri).
- **Pausa**: dopo un segnale la stessa moneta non ne apre un altro per 4 ore.
- **Uscite come Wisi Trade**: unità = ATR (Wilder 14) delle candele da 15 minuti chiuse prima dell'entrata; stop loss 1,5 unità; da +0,5 unità stop che segue a 1 unità e protezione del guadagno (si esce restituendo il 40%); durata massima 4 ore.
- **Conferme**, provate una alla volta sopra la versione base (stessi N, k, direzione):
  - **trend a 1 ora / 4 ore**: prima del movimento il prezzo andava già nella stessa direzione nell'ora (4 ore) precedente;
  - **BTC nella stessa direzione** (solo per le altre monete; BTC non dà segnali con questa conferma): negli stessi N minuti BTC si è mosso nella stessa direzione di almeno 1 volta il suo movimento normale;
  - **rottura del massimo/minimo di 24 ore**: la chiusura supera il massimo (o va sotto il minimo) delle 24 ore prima del movimento;
  - **il movimento tiene**: 3 minuti dopo il segnale il prezzo conserva almeno metà del movimento; si entra 3 minuti più tardi.
- **Griglia**: 3 N × 3 k × 2 direzioni × 6 (base + 5 conferme) = **108 varianti**.

## Il metodo
- Stessi dati, costi e capitale degli altri test: 50 crypto, candele da 1 minuto di Binance dal 2023-01-01 al 2026-11-10, fermi di Binance come minuti senza prezzo, percorso dentro il minuto come Wisi Trade.
- Costi: commissione 0,06% per lato, slittamento 0,05% e 0,08% per lato (minimo 0,08% dalla 15ª moneta), funding reale.
- Capitale: 10.000 USDT, 10 posizioni, margine 10%, leva 3x e 5x, freno 8% su perdita chiusa + aperta (come Wisi Trade), dimensione fissa e composto, media di 10 ordini casuali per i segnali dello stesso minuto.
- 70/30: scelta fino al 2025-09-13, verifica dal 2025-09-14. Criterio di scelta: miglior rendimento del portafoglio nel 70% (dimensione fissa, leva 3x, slittamento 0,08%), almeno 100 operazioni.
- **Lordo** = movimento a favore per operazione prima dei costi; **netto** = dopo commissioni, slittamento (0,08%) e funding. Obiettivo: almeno **0,5% lordo medio** per operazione, altrimenti i costi (circa 0,28% andata e ritorno) se lo mangiano.

## Riferimento: entrate a caso
Prima di leggere i lordi: con le stesse uscite ed entrate a caso (momento e direzione), il lordo medio dovrebbe essere zero. Con le candele da 1 minuto il motore esegue gli stop esattamente sul livello anche quando il prezzo vero lo salta, e questo dà un piccolo lordo positivo anche a caso (su prezzi sintetici senza nessun vantaggio: circa +0,04%). È il "rumore di fondo": un lordo vale qualcosa solo se è ben sopra questi valori.

| Monete | Entrate a caso | Lordo medio | Errore standard |
|---|---:|---:|---:|
| BTC ed ETH | 6.000 | 0,009% | ± 0,005% |
| dalla 3ª alla 14ª | 35.920 | 0,012% | ± 0,004% |
| dalla 15ª in poi | 107.395 | 0,020% | ± 0,004% |

## La versione base, senza conferme
Medie sulle singole operazioni (senza limiti di posti) e portafoglio (dimensione fissa, leva 3x, slittamento 0,08%).

| Direzione | N | k | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Portafoglio 70% | Portafoglio 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| segui | 5 min | 4× | 37.005 | 0,092% | -0,188% | 0,54 | 27.372 | 0,095% | -0,185% | 0,63 | -100,0% (rovina) | -100,0% (rovina) |
| segui | 5 min | 6× | 14.227 | 0,158% | -0,122% | 0,74 | 11.140 | 0,209% | -0,071% | 0,87 | -100,0% (rovina) | -100,0% (rovina) |
| segui | 5 min | 8× | 7.032 | 0,229% | -0,050% | 0,91 | 5.483 | 0,345% | 0,065% | 1,10 | -100,0% (rovina) | 57,3% |
| segui | 15 min | 4× | 25.093 | 0,094% | -0,186% | 0,58 | 17.527 | 0,126% | -0,153% | 0,71 | -100,0% (rovina) | -100,0% (rovina) |
| segui | 15 min | 6× | 8.752 | 0,210% | -0,070% | 0,86 | 6.475 | 0,224% | -0,056% | 0,91 | -100,0% (rovina) | -100,0% (rovina) |
| segui | 15 min | 8× | 3.946 | 0,383% | 0,103% | 1,19 | 3.113 | 0,398% | 0,118% | 1,16 | 48,6% | 98,8% |
| segui | 60 min | 4× | 12.614 | 0,097% | -0,183% | 0,65 | 8.756 | 0,167% | -0,113% | 0,81 | -100,0% (rovina) | -100,0% (rovina) |
| segui | 60 min | 6× | 3.882 | 0,345% | 0,065% | 1,11 | 2.971 | 0,218% | -0,062% | 0,92 | 6,6% | -44,8% |
| segui | 60 min | 8× | 1.755 | 0,565% | 0,285% | 1,42 | 1.269 | 0,463% | 0,183% | 1,18 | 83,3% | 42,0% |
| contro | 5 min | 4× | 37.005 | 0,046% | -0,234% | 0,43 | 27.372 | 0,085% | -0,195% | 0,58 | -100,0% (rovina) | -100,0% (rovina) |
| contro | 5 min | 6× | 14.227 | 0,119% | -0,161% | 0,61 | 11.140 | 0,135% | -0,145% | 0,73 | -100,0% (rovina) | -100,0% (rovina) |
| contro | 5 min | 8× | 7.032 | 0,213% | -0,067% | 0,83 | 5.483 | 0,236% | -0,043% | 0,93 | -96,5% (rovina) | -77,4% |
| contro | 15 min | 4× | 25.093 | 0,094% | -0,186% | 0,54 | 17.527 | 0,092% | -0,188% | 0,63 | -100,0% (rovina) | -100,0% (rovina) |
| contro | 15 min | 6× | 8.752 | 0,177% | -0,103% | 0,75 | 6.475 | 0,201% | -0,078% | 0,87 | -100,0% (rovina) | -100,0% (rovina) |
| contro | 15 min | 8× | 3.946 | 0,239% | -0,041% | 0,91 | 3.113 | 0,286% | 0,006% | 1,01 | -54,6% | -12,0% |
| contro | 60 min | 4× | 12.614 | 0,144% | -0,136% | 0,68 | 8.756 | 0,113% | -0,167% | 0,72 | -100,0% (rovina) | -100,0% (rovina) |
| contro | 60 min | 6× | 3.882 | 0,123% | -0,157% | 0,72 | 2.971 | 0,320% | 0,041% | 1,06 | -85,0% | 19,7% |
| contro | 60 min | 8× | 1.755 | 0,260% | -0,020% | 0,97 | 1.269 | 0,697% | 0,417% | 1,56 | 1,8% | 125,7% |

## Cosa aggiunge ogni conferma
Confronto con la versione base con gli stessi N, k e direzione (9 combinazioni per direzione). "Lordo in più" è la mediana della differenza di lordo medio per operazione; "migliora in entrambi" conta le combinazioni in cui la conferma alza il lordo sia nel 70% sia nel 30%.

| Conferma | Direzione | Operazioni tenute | Lordo in più 70% | Lordo in più 30% | Migliora in entrambi |
|---|---|---:|---:|---:|---:|
| trend a 1 ora | segui | 79% | 0,008% | -0,004% | 1/9 |
| trend a 1 ora | contro | 79% | 0,008% | 0,009% | 4/9 |
| trend a 4 ore | segui | 75% | -0,012% | -0,012% | 0/9 |
| trend a 4 ore | contro | 75% | 0,032% | 0,021% | 6/9 |
| BTC nella stessa direzione | segui | 75% | 0,018% | -0,001% | 4/9 |
| BTC nella stessa direzione | contro | 75% | -0,001% | -0,047% | 0/9 |
| rottura del massimo/minimo di 24 ore | segui | 67% | 0,040% | 0,063% | 7/9 |
| rottura del massimo/minimo di 24 ore | contro | 67% | 0,046% | 0,032% | 8/9 |
| il movimento tiene 3 minuti | segui | 99% | -0,101% | -0,106% | 0/9 |
| il movimento tiene 3 minuti | contro | 99% | -0,060% | -0,075% | 0/9 |

## Varianti con almeno 0,5% lordo medio nel 70%
| Variante | Oper. 70% | Lordo 70% | Netto 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Portafoglio 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| segui il movimento, 60 min > 8× normale, BTC nella stessa direzione | 1.418 | 0,668% | 0,390% | 800 | 0,343% | 0,058% | 1,05 | 7,4% |
| segui il movimento, 60 min > 8× normale, trend a 1 ora | 1.443 | 0,626% | 0,347% | 949 | 0,322% | 0,041% | 1,04 | 3,4% |
| segui il movimento, 60 min > 8× normale, rottura del massimo/minimo di 24 ore | 1.547 | 0,605% | 0,326% | 1.051 | 0,394% | 0,114% | 1,13 | 10,5% |
| segui il movimento, 60 min > 8× normale, nessuna conferma | 1.755 | 0,565% | 0,285% | 1.269 | 0,463% | 0,183% | 1,18 | 42,0% |
| segui il movimento, 60 min > 8× normale, trend a 4 ore | 1.379 | 0,525% | 0,244% | 947 | 0,108% | -0,174% | 0,85 | -52,0% |

## Quanto è solida: tutte le varianti
| Gruppo | In utile nel 70% | In utile nel 30% | Mediana 70% | Mediana 30% | Migliore 30% | Correlazione 70↔30 |
|---|---:|---:|---:|---:|---:|---:|
| Tutte | 17/108 | 26/108 | -100,0% | -100,0% | 125,7% | 0,88 |
| Segui | 14/54 | 15/54 | -100,0% | -100,0% | 98,8% | 0,83 |
| Contro | 3/54 | 11/54 | -100,0% | -100,0% | 125,7% | 0,95 |
| N = 5 min | 1/36 | 6/36 | -100,0% | -100,0% | 63,4% | 0,84 |
| N = 15 min | 5/36 | 8/36 | -100,0% | -100,0% | 98,8% | 0,93 |
| N = 60 min | 11/36 | 12/36 | -78,4% | -45,4% | 125,7% | 0,81 |

### Le 10 migliori nel 70% (portafoglio) e come sono andate nel 30%
| Variante | Rend. 70% | PF 70% | Oper. 70% | Lordo 70% | Rend. 30% | PF 30% | Oper. 30% | Lordo 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| segui il movimento, 60 min > 8× normale, BTC nella stessa direzione | 97,1% | 1,38 | 1.270 | 0,668% | 7,4% | 1,03 | 710 | 0,343% |
| segui il movimento, 60 min > 8× normale, rottura del massimo/minimo di 24 ore | 86,2% | 1,30 | 1.415 | 0,605% | 10,5% | 1,04 | 987 | 0,394% |
| segui il movimento, 60 min > 8× normale, nessuna conferma | 83,3% | 1,26 | 1.602 | 0,565% | 42,0% | 1,11 | 1.184 | 0,463% |
| segui il movimento, 15 min > 8× normale, BTC nella stessa direzione | 81,6% | 1,17 | 2.807 | 0,440% | 49,9% | 1,13 | 1.912 | 0,388% |
| segui il movimento, 15 min > 8× normale, rottura del massimo/minimo di 24 ore | 73,7% | 1,16 | 2.817 | 0,411% | 59,6% | 1,15 | 2.090 | 0,374% |
| segui il movimento, 60 min > 8× normale, trend a 1 ora | 69,0% | 1,24 | 1.327 | 0,626% | 3,4% | 1,01 | 926 | 0,322% |
| segui il movimento, 60 min > 8× normale, trend a 4 ore | 53,5% | 1,19 | 1.296 | 0,525% | -52,0% | 0,83 | 899 | 0,108% |
| segui il movimento, 15 min > 8× normale, nessuna conferma | 48,6% | 1,08 | 3.578 | 0,383% | 98,8% | 1,16 | 2.874 | 0,398% |
| segui il movimento, 60 min > 6× normale, rottura del massimo/minimo di 24 ore | 23,7% | 1,05 | 3.044 | 0,357% | 33,2% | 1,08 | 2.303 | 0,336% |
| segui il movimento, 15 min > 8× normale, trend a 4 ore | 21,0% | 1,04 | 2.901 | 0,342% | 41,5% | 1,09 | 2.149 | 0,328% |

## Le varianti scelte sul 70% e la verifica sul 30%
| Scelta | Variante | Periodo | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Migliore in assoluto | segui il movimento, 60 min > 8× normale, BTC nella stessa direzione | 70% | 97,1% | 1,38 | 13,4% | -7,0% | 1.270 | 0,255% |
| | | **30%** | 7,4% | 1,03 | 36,7% | -8,6% | 710 | 0,035% |
| Migliore "segui" | segui il movimento, 60 min > 8× normale, BTC nella stessa direzione | 70% | 97,1% | 1,38 | 13,4% | -7,0% | 1.270 | 0,255% |
| | | **30%** | 7,4% | 1,03 | 36,7% | -8,6% | 710 | 0,035% |
| Migliore "contro" | contro il movimento, 60 min > 8× normale, il movimento tiene 3 minuti | 70% | 9,6% | 1,04 | 24,1% | -8,7% | 1.527 | 0,021% |
| | | **30%** | 4,4% | 1,01 | 26,4% | -12,3% | 1.133 | 0,013% |
| Migliore senza conferme | segui il movimento, 60 min > 8× normale, nessuna conferma | 70% | 83,3% | 1,26 | 15,2% | -7,0% | 1.602 | 0,173% |
| | | **30%** | 42,0% | 1,11 | 40,7% | -6,3% | 1.184 | 0,118% |

## Dettaglio della variante scelta
Variante: **segui il movimento, 60 min > 8× normale, BTC nella stessa direzione**.

### Capitale
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 106,7% | 11,3% | 1,05 | 35,2% | -8,5% | 710 | 0,053% |
| 0,05% | 3x | composto | 153,1% | 6,2% | 1,02 | 39,9% | -9,0% | 710 | 0,069% |
| 0,05% | 5x | fissa | 178,8% | 38,3% | 1,11 | 38,1% | -8,1% | 710 | 0,108% |
| 0,05% | 5x | composto | 305,1% | 21,0% | 1,04 | 50,8% | -10,0% | 707 | 0,115% |
| 0,08% | 3x | fissa | 97,1% | 7,4% | 1,03 | 36,7% | -8,6% | 710 | 0,035% |
| 0,08% | 3x | composto | 130,2% | 2,0% | 1,01 | 40,9% | -9,0% | 710 | 0,050% |
| 0,08% | 5x | fissa | 163,0% | 31,6% | 1,09 | 40,1% | -8,3% | 710 | 0,089% |
| 0,08% | 5x | composto | 247,0% | 13,3% | 1,03 | 52,2% | -10,0% | 707 | 0,096% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | 41,1% | 1,56 | 11,7% | -7,0% | 468 | 0,293% |
| 2024 | 61,4% | 1,51 | 16,5% | -4,0% | 534 | 0,383% |
| 2025 | 13,1% | 1,13 | 19,4% | -4,4% | 418 | 0,105% |
| 2026 (fino al 11-10) | -9,9% | 0,94 | 40,2% | -9,3% | 560 | -0,059% |

### Scomposizione sulle singole operazioni (senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BTC ed ETH | 75 | 0,048% | -0,233% | 0,57 | 32 | 0,142% | -0,139% | 0,66 | 44% |
| Le altre 48 | 1.343 | 0,703% | 0,424% | 1,63 | 768 | 0,352% | 0,066% | 1,06 | 62% |
| Long | 525 | 0,156% | -0,124% | 0,79 | 358 | 0,143% | -0,137% | 0,82 | 63% |
| Short | 893 | 0,970% | 0,692% | 1,97 | 442 | 0,505% | 0,216% | 1,17 | 60% |
| Giorni feriali | 1.287 | 0,684% | 0,405% | 1,62 | 700 | 0,261% | -0,026% | 0,98 | 61% |
| Weekend | 131 | 0,515% | 0,236% | 1,28 | 100 | 0,920% | 0,642% | 1,58 | 61% |
| Ore 00–04 UTC | 262 | 1,260% | 0,983% | 2,82 | 159 | 0,881% | 0,603% | 1,61 | 68% |
| Ore 04–08 UTC | 137 | 0,061% | -0,218% | 0,82 | 103 | 0,871% | 0,594% | 1,57 | 52% |
| Ore 08–12 UTC | 87 | 0,446% | 0,166% | 1,34 | 56 | -1,042% | -1,360% | 0,35 | 66% |
| Ore 12–16 UTC | 357 | 0,386% | 0,106% | 1,19 | 203 | 0,011% | -0,273% | 0,64 | 56% |
| Ore 16–20 UTC | 355 | 0,475% | 0,196% | 1,26 | 114 | -0,257% | -0,556% | 0,63 | 65% |
| Ore 20–24 UTC | 220 | 1,198% | 0,920% | 2,59 | 165 | 0,789% | 0,510% | 1,61 | 63% |
| Movimento fino a 1,5× la soglia | 1.310 | 0,589% | 0,310% | 1,47 | 721 | 0,364% | 0,081% | 1,09 | 61% |
| Movimento oltre 1,5× la soglia | 108 | 1,625% | 1,348% | 2,88 | 79 | 0,152% | -0,153% | 0,93 | 65% |

Uscite (portafoglio, intero periodo): protezione del guadagno 55%, stop loss 30%, stop che segue 14%, durata massima 1%, freno 0%.

### Correlazione (intero periodo, portafoglio reale)
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 50% · 2: 11% · 3: 6% · 4: 4% · 5: 3% · 6: 2% · 7: 2% · 8: 2% · 9: 1% · 10: 1%.
- Giorni "a senso unico" (almeno 5 posizioni aperte nel giorno, almeno l'80% dallo stesso lato): **83** su 448 giorni con operazioni, in utile 37, risultato medio 1,67% del capitale, il peggiore -5,06%. Gli altri giorni: risultato medio -0,08%, in utile 204 su 365.
- Segnali scartati dal portafoglio: posti pieni 236, freno 2.

## Dettaglio della migliore "contro"
Variante: **contro il movimento, 60 min > 8× normale, il movimento tiene 3 minuti**.

### Capitale
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 19,5% | 9,0% | 1,03 | 25,0% | -12,0% | 1.133 | 0,027% |
| 0,05% | 3x | composto | 17,3% | 2,1% | 1,01 | 24,6% | -11,4% | 1.133 | 0,027% |
| 0,05% | 5x | fissa | 28,3% | 9,4% | 1,02 | 35,1% | -19,5% | 1.121 | 0,017% |
| 0,05% | 5x | composto | 3,3% | 2,6% | 1,00 | 35,5% | -18,2% | 1.110 | 0,036% |
| 0,08% | 3x | fissa | 9,6% | 4,4% | 1,01 | 26,4% | -12,3% | 1.133 | 0,013% |
| 0,08% | 3x | composto | 4,4% | -2,5% | 0,99 | 25,4% | -11,5% | 1.133 | 0,013% |
| 0,08% | 5x | fissa | 4,1% | 2,9% | 1,01 | 36,8% | -20,2% | 1.120 | 0,005% |
| 0,08% | 5x | composto | -13,1% | -4,7% | 0,99 | 36,4% | -18,4% | 1.110 | 0,022% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | -4,0% | 0,95 | 24,1% | -8,3% | 599 | -0,022% |
| 2024 | 26,8% | 1,26 | 14,6% | -7,7% | 620 | 0,144% |
| 2025 | -17,9% | 0,83 | 26,6% | -11,1% | 496 | -0,120% |
| 2026 (fino al 11-10) | 8,3% | 1,03 | 22,8% | -11,5% | 944 | 0,029% |

### Scomposizione sulle singole operazioni (senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BTC ed ETH | 132 | -0,079% | -0,360% | 0,31 | 54 | -0,051% | -0,331% | 0,21 | 37% |
| Le altre 48 | 1.616 | 0,315% | 0,035% | 1,06 | 1.203 | 0,412% | 0,133% | 1,15 | 71% |
| Long | 964 | 0,484% | 0,205% | 1,39 | 562 | 0,472% | 0,194% | 1,20 | 70% |
| Short | 784 | 0,040% | -0,240% | 0,63 | 695 | 0,327% | 0,047% | 1,06 | 69% |
| Giorni feriali | 1.526 | 0,307% | 0,028% | 1,05 | 1.010 | 0,349% | 0,070% | 1,08 | 68% |
| Weekend | 222 | 0,131% | -0,149% | 0,76 | 247 | 0,567% | 0,288% | 1,32 | 74% |
| Ore 00–04 UTC | 314 | -0,028% | -0,308% | 0,59 | 232 | 0,196% | -0,085% | 0,92 | 69% |
| Ore 04–08 UTC | 186 | 0,251% | -0,022% | 0,96 | 197 | 0,543% | 0,264% | 1,36 | 73% |
| Ore 08–12 UTC | 143 | 0,295% | 0,015% | 1,04 | 144 | 0,620% | 0,342% | 1,44 | 73% |
| Ore 12–16 UTC | 418 | -0,130% | -0,410% | 0,50 | 277 | 0,319% | 0,037% | 1,06 | 67% |
| Ore 16–20 UTC | 394 | 0,381% | 0,101% | 1,21 | 180 | 0,057% | -0,212% | 0,82 | 69% |
| Ore 20–24 UTC | 293 | 1,100% | 0,818% | 3,08 | 227 | 0,669% | 0,388% | 1,40 | 68% |
| Movimento fino a 1,5× la soglia | 1.642 | 0,236% | -0,043% | 0,93 | 1.191 | 0,302% | 0,024% | 1,03 | 69% |
| Movimento oltre 1,5× la soglia | 106 | 1,042% | 0,760% | 2,72 | 66 | 2,010% | 1,722% | 3,79 | 82% |

Uscite (portafoglio, intero periodo): protezione del guadagno 71%, stop loss 22%, stop che segue 5%, durata massima 1%, freno 0%.

### Correlazione (intero periodo, portafoglio reale)
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 55% · 2: 9% · 3: 6% · 4: 4% · 5: 3% · 6: 3% · 7: 2% · 8: 2% · 9: 2% · 10: 1%.
- Giorni "a senso unico" (almeno 5 posizioni aperte nel giorno, almeno l'80% dallo stesso lato): **106** su 677 giorni con operazioni, in utile 59, risultato medio 0,32% del capitale, il peggiore -12,33%. Gli altri giorni: risultato medio -0,03%, in utile 348 su 571.
- Segnali scartati dal portafoglio: posti pieni 288, freno 56.

## Dettaglio della migliore senza conferme
Variante: **segui il movimento, 60 min > 8× normale, nessuna conferma**.

### Capitale
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 95,4% | 46,9% | 1,13 | 39,7% | -6,1% | 1.184 | 0,132% |
| 0,05% | 3x | composto | 123,3% | 35,3% | 1,07 | 48,2% | -8,7% | 1.181 | 0,121% |
| 0,05% | 5x | fissa | 159,9% | 64,3% | 1,10 | 55,0% | -9,1% | 1.178 | 0,109% |
| 0,05% | 5x | composto | 233,3% | 37,7% | 1,04 | 68,8% | -11,1% | 1.170 | 0,112% |
| 0,08% | 3x | fissa | 83,3% | 42,0% | 1,11 | 40,7% | -6,3% | 1.184 | 0,118% |
| 0,08% | 3x | composto | 98,5% | 28,8% | 1,06 | 48,7% | -8,7% | 1.181 | 0,107% |
| 0,08% | 5x | fissa | 140,3% | 56,6% | 1,09 | 56,5% | -9,4% | 1.178 | 0,096% |
| 0,08% | 5x | composto | 174,7% | 27,2% | 1,03 | 69,3% | -11,1% | 1.170 | 0,098% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | 45,0% | 1,44 | 12,6% | -7,0% | 613 | 0,245% |
| 2024 | 57,6% | 1,40 | 17,8% | -3,1% | 647 | 0,297% |
| 2025 | 13,1% | 1,10 | 30,7% | -4,7% | 551 | 0,079% |
| 2026 (fino al 11-10) | 4,1% | 1,01 | 50,0% | -8,5% | 971 | 0,014% |

### Scomposizione sulle singole operazioni (senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BTC ed ETH | 132 | 0,202% | -0,078% | 0,82 | 55 | 0,090% | -0,190% | 0,55 | 42% |
| Le altre 48 | 1.623 | 0,594% | 0,315% | 1,46 | 1.214 | 0,480% | 0,200% | 1,19 | 65% |
| Long | 787 | 0,221% | -0,060% | 0,89 | 698 | 0,432% | 0,152% | 1,18 | 66% |
| Short | 968 | 0,845% | 0,566% | 1,75 | 571 | 0,501% | 0,220% | 1,18 | 60% |
| Giorni feriali | 1.532 | 0,613% | 0,333% | 1,52 | 1.015 | 0,350% | 0,070% | 1,07 | 62% |
| Weekend | 223 | 0,236% | -0,043% | 0,95 | 254 | 0,914% | 0,634% | 1,65 | 69% |
| Ore 00–04 UTC | 317 | 1,151% | 0,873% | 2,65 | 230 | 0,813% | 0,534% | 1,55 | 68% |
| Ore 04–08 UTC | 191 | -0,066% | -0,349% | 0,70 | 198 | 1,011% | 0,732% | 1,75 | 61% |
| Ore 08–12 UTC | 139 | 0,111% | -0,170% | 0,74 | 144 | -0,024% | -0,304% | 0,80 | 67% |
| Ore 12–16 UTC | 437 | 0,373% | 0,093% | 1,16 | 280 | -0,126% | -0,406% | 0,55 | 55% |
| Ore 16–20 UTC | 404 | 0,468% | 0,189% | 1,27 | 185 | 0,309% | 0,028% | 1,03 | 69% |
| Ore 20–24 UTC | 267 | 1,017% | 0,739% | 2,24 | 232 | 0,786% | 0,503% | 1,55 | 66% |
| Movimento fino a 1,5× la soglia | 1.647 | 0,490% | 0,210% | 1,31 | 1.202 | 0,371% | 0,090% | 1,09 | 63% |
| Movimento oltre 1,5× la soglia | 108 | 1,712% | 1,436% | 3,12 | 67 | 2,117% | 1,846% | 3,98 | 67% |

Uscite (portafoglio, intero periodo): protezione del guadagno 57%, stop loss 30%, stop che segue 12%, durata massima 1%.

### Correlazione (intero periodo, portafoglio reale)
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 54% · 2: 7% · 3: 4% · 4: 3% · 5: 2% · 6: 2% · 7: 1% · 8: 1% · 9: 1% · 10: 1%.
- Giorni "a senso unico" (almeno 5 posizioni aperte nel giorno, almeno l'80% dallo stesso lato): **108** su 679 giorni con operazioni, in utile 55, risultato medio 1,49% del capitale, il peggiore -6,62%. Gli altri giorni: risultato medio -0,06%, in utile 306 su 571.
- Segnali scartati dal portafoglio: posti pieni 237, freno 0.

## Limiti
- Le 50 monete sono le più liquide di oggi (le sparite non ci sono): i long del passato sono favoriti.
- L'entrata è all'apertura del minuto dopo il segnale: nei movimenti violenti lo slittamento vero su Bitunix può essere più alto di 0,08%, soprattutto sulle monete piccole (vedi `docs/bitunix-vs-binance.md`).
- Con 108 varianti la migliore nel 70% è in parte fortuna: contano di più la versione base, il confronto delle conferme e la tabella di tutte le varianti.

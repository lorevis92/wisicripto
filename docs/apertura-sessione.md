# Backtest "apertura di sessione"

Aggiornato il 2026-11-11 (seconda versione: uscite, unità, percorso nel minuto e freno come in Wisi Trade). Script: `research/04-apertura-sessione.js`, motore in `research/motore/`. Risultati completi: `data/backtest/apertura/risultati.json`.

<!-- conclusione:inizio -->
## Conclusione
**Con le regole vere di Wisi Trade cambia molto, ma non abbastanza: nessuna regola scelta sul 70% regge in modo convincente sul 30%.** Non la porterei in Fase 1.

**Cosa cambia rispetto alla prima versione.** Il cambiamento viene quasi tutto dalle uscite di Wisi Trade. La protezione del guadagno scatta già da +0,5 unità e incassa il 60% del guadagno massimo. Le operazioni vincenti passano al 60–85% e il lordo medio per operazione sale.
- Le varianti in utile nel 30% passano da 4–15 su 72 a **10–39 su 72**.
- Nessuna variante scelta va più in rovina.
- Il freno su perdita chiusa più aperta scatta pochissimo (0–2 giorni nel 30%) e non sposta i risultati.

**La configurazione Attuale (movimento 1%, entrata 1,25%, 30 minuti, stop 1,5) sulle crypto perde ovunque.** Fa migliaia di operazioni con circa +0,1–0,2% lordo, meno dei costi, e con dimensione fissa va in rovina a 00:00 UTC, USA e "tutte e tre".

**Le varianti scelte sul 70%:**
- **USA, movimento 1,5% (entrata 1,875%), 15 minuti, stop 2 unità**: +27% nel 70%, **+35% nel 30%** su 1.217 operazioni, peggior calo 15%. È l'unica scelta che guadagna in entrambi i periodi, ma:
  - il profit factor è solo 1,11 e il guadagno netto 0,10% per operazione: basta poco più di costo per azzerarlo;
  - nel 2023 e nel 2024 era piatta, guadagna solo dal 2025;
  - la gemella con stop 1,5 unità fa -0,8% nel 30%;
  - solo 10 delle 72 varianti USA sono in utile nel 30%.
- **00:00 UTC**: +6% → +4% (profit factor 1,05). **Europa**: +36% → -1%. **Tutte e tre**: +32% → +6%. Nessuna è convincente.

**L'unico segnale interessante: l'Europa con la soglia a volatilità.** Delle 36 varianti, 24 guadagnano nel 70% e **27 nel 30%**, con mediana +13,5% nel 30%. È l'unico gruppo positivo in modo diffuso nei due periodi. Però:
- la variante migliore nel 70% è piatta nel 30%, quindi non c'è una regola precisa da scegliere;
- nel 2026 le varianti vanno peggio;
- il guadagno netto per operazione resta piccolo.

È un indizio da tenere, non una strategia.

**Altre cose imparate:**
- **Le aperture in cui molte monete rompono insieme sono le migliori.** Le aperture "a senso unico" rendono in media +1,5% del capitale. Le operazioni lasciate fuori per i 10 posti pieni rendono in media +1,8%, contro lo 0,02% di quelle prese. Con queste regole il limite dei posti taglia proprio i giorni migliori.
- **BTC ed ETH da sole fanno pochissime operazioni con queste soglie, e nel 30% sono in perdita.** I weekend sono quasi sempre peggio dei giorni feriali.
- **Il 98% delle posizioni di un'apertura sono dalla stessa parte**: resta una scommessa sola sulla direzione del mercato.
- **Controllo del motore**: con entrate a caso e le stesse uscite il lordo medio è +0,01/+0,02% (vedi `docs/grande-movimento.md`), quindi i lordi di questo test non sono un effetto delle candele.
<!-- conclusione:fine -->

## Le regole
- **Sessioni**: 00:00 UTC (chiusura della candela giornaliera e Asia), 08:00 Londra (Europa), 9:30 New York (USA), con l'ora legale gestita dal fuso orario vero. Tutti i giorni, weekend compresi.
- **Entrata, come Wisi Trade**: riferimento = apertura del primo minuto della sessione. Con un "movimento" m, si entra quando il prezzo arriva a **1,25 × m** dall'apertura, nella direzione del movimento, entro la finestra d'entrata (3, 15 o 30 minuti). Una sola entrata per moneta e sessione. In più (limite di Bitunix): l'entrata conta solo se il prezzo supera il livello di almeno **0,15%**.
- **Unità di volatilità, come Wisi Trade**: il maggiore tra l'ATR (Wilder, 14) delle candele da 15 minuti e il range medio della prima candela da 15 minuti della stessa sessione negli ultimi 10 giorni. Sulle crypto le candele da 15 minuti sono di tutte le 24 ore.
- **Uscite, come Wisi Trade**: stop loss a 1 / 1,5 / 2 unità; finché il guadagno massimo è sotto 0,5 unità resta lo stop loss; poi l'uscita è la migliore tra lo stop loss, lo **stop che segue** (miglior prezzo meno 1 unità) e la **protezione del guadagno** (si esce se si restituisce il 40% del guadagno massimo). In più, durata massima: apertura della sessione successiva.
- **Configurazione Attuale di Wisi Trade**: movimento 1% (entrata a 1,25%), finestra 30 minuti, stop loss 1,5 unità, stop che segue 1, protezione 40%. È nella griglia ed è riportata a parte: non è scelta sui dati, quindi è il confronto più onesto.
- **Non portate dalle azioni**: il controllo dello "spazio" fino ai livelli di ieri, la conferma di volume e VWAP a 15 minuti e l'uscita sulla resistenza. Usano l'orario di borsa e livelli giornalieri che sulle crypto vanno ripensati.
- **Griglia**: 2 versioni del movimento (percentuale 0,5/1/1,5/2%; volatilità 0,1/0,2/0,3/0,4 × la volatilità giornaliera a 14 giorni) × 3 finestre × 3 stop = **72 varianti** per sessione.

## Il metodo
- **Dati**: candele da 1 minuto di Binance delle 50 crypto di `docs/universo.md`, dal 2023-01-01 al 2026-11-10. Nessun dato futuro.
- **Dentro il minuto** (come Wisi Trade): se l'apertura è più vicina al massimo, apertura→massimo→minimo→chiusura, altrimenti apertura→minimo→massimo→chiusura. Se il minuto apre già oltre lo stop, si esce all'apertura. I fermi di Binance sono minuti senza prezzo.
- **Costi**: commissione 0,06% per lato; slittamento 0,05% e 0,08% per lato (minimo 0,08% dalla 15ª moneta in poi); funding reale di Binance.
- **Capitale**: 10.000 USDT, 10 posizioni, margine 10%, leva 3x e 5x, margine isolato. **Freno giornaliero all'8%, come Wisi Trade**: a ogni minuto si somma la perdita delle operazioni chiuse oggi e quella delle posizioni aperte alla chiusura del minuto; se arriva all'8% del capitale d'inizio giornata si chiude tutto all'apertura del minuto dopo e niente nuove entrate fino al giorno UTC successivo. Dimensione fissa (10% del capitale iniziale) e interesse composto (10% del capitale del momento).
- **Segnali simultanei**: ordine casuale, media di 10 ordini. Le uscite di un minuto vengono prima delle entrate dello stesso minuto.
- **70/30**: scelta dal 2023-01-01 al 2025-09-13, verifica dal 2025-09-14 al 2026-11-10. Criterio: miglior rendimento nel 70% con dimensione fissa, leva 3x, slittamento 0,08%, almeno 100 operazioni.
- **Misure**: rendimento sul capitale iniziale; profit factor = guadagni / perdite; peggior calo del capitale; giorno peggiore in % del capitale; medio netto = guadagno medio per operazione in % del valore della posizione, costi compresi. "Rovina" = capitale a zero, la simulazione si ferma lì.

## Cosa cambia rispetto alla prima versione
Prima versione: uscite inventate (protezione a +1R, stop che segue da +1,5R), stop in % o in multipli della volatilità giornaliera, freno solo sulle perdite chiuse, percorso nel minuto secondo la chiusura. Stessa configurazione di riferimento (dimensione fissa, leva 3x, slittamento 0,08%).

| Sessione | Prima: migliore nel 70% → 30% | Adesso: migliore nel 70% → 30% | Prima: varianti in utile nel 30% | Adesso: varianti in utile nel 30% | Prima: mediana 30% | Adesso: mediana 30% |
|---|---:|---:|---:|---:|---:|---:|
| 00:00 UTC | 28,0% → -91,5% (rovina) | 6,4% → 3,8% | 7/72 | 39/72 | -75,5% | 2,9% |
| Europa 08:00 Londra | 4,8% → 22,1% | 35,8% → -0,9% | 15/72 | 31/72 | -44,8% | -10,7% |
| USA 9:30 New York | 91,5% → -34,3% | 27,4% → 35,1% | 5/72 | 10/72 | -86,0% | -26,2% |
| Tutte e tre insieme | 64,1% → -100,0% (rovina) | 32,3% → 6,1% | 4/72 | 34/72 | -100,0% | -24,8% |

## La configurazione Attuale di Wisi Trade sulle crypto
Movimento 1%, entrata 1,25%, finestra 30 minuti, stop loss 1,5 unità, stop che segue 1, protezione 40%. Dimensione fissa, leva 3x, slittamento 0,08%.

| Sessione | Periodo | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---|---:|---:|---:|---:|---:|---:|
| 00:00 UTC | 70% | -100,0% (rovina) | 0,59 | 100% (rovina) | oltre -100% (rovina) | 1.620 | -0,206% |
| | **30%** | -51,3% | 0,93 | 61,6% | -9,5% | 3.227 | -0,053% |
| Europa 08:00 Londra | 70% | -57,9% | 0,85 | 66,2% | -10,4% | 3.116 | -0,062% |
| | **30%** | -84,0% | 0,87 | 91,6% | -16,0% | 2.760 | -0,101% |
| USA 9:30 New York | 70% | -100,0% (rovina) | 0,72 | 100% (rovina) | oltre -100% (rovina) | 2.816 | -0,118% |
| | **30%** | -100,0% (rovina) | 0,61 | 100% (rovina) | oltre -100% (rovina) | 1.062 | -0,315% |
| Tutte e tre insieme | 70% | -100,0% (rovina) | 0,72 | 100% (rovina) | oltre -100% (rovina) | 2.755 | -0,121% |
| | **30%** | -100,0% (rovina) | 0,74 | 100% (rovina) | oltre -100% (rovina) | 1.625 | -0,206% |

## Prima dei costi: c'è un vantaggio?
Media di tutte le operazioni di tutte le 36 varianti di ogni versione (senza limiti di posti né capitale), in % del valore della posizione. Costo di un'operazione andata e ritorno: 0,22% con slittamento 0,05%, 0,28% con 0,08%.

| Sessione | Versione | Monete | Oper. 70% | Lordo 70% | Lordo 30% | Netto 30% (slitt. 0,05%*) | Netto 30% (slitt. 0,08%) |
|---|---|---|---:|---:|---:|---:|---:|
| 00:00 UTC | percentuale | BTC ed ETH | 1.221 | 0,239% | 0,165% | -0,055% | -0,115% |
| 00:00 UTC | percentuale | dalla 3ª alla 14ª | 35.571 | 0,112% | 0,280% | 0,061% | 0,001% |
| 00:00 UTC | percentuale | dalla 15ª in poi | 71.841 | 0,126% | 0,287% | 0,006% | 0,006% |
| 00:00 UTC | volatilità | BTC ed ETH | 1.386 | 0,149% | 0,211% | -0,009% | -0,069% |
| 00:00 UTC | volatilità | dalla 3ª alla 14ª | 13.086 | 0,163% | 0,422% | 0,202% | 0,142% |
| 00:00 UTC | volatilità | dalla 15ª in poi | 25.881 | 0,167% | 0,357% | 0,077% | 0,077% |
| 08:00 Londra | percentuale | BTC ed ETH | 996 | 0,294% | 0,075% | -0,145% | -0,205% |
| 08:00 Londra | percentuale | dalla 3ª alla 14ª | 25.728 | 0,178% | 0,098% | -0,122% | -0,182% |
| 08:00 Londra | percentuale | dalla 15ª in poi | 53.478 | 0,201% | 0,202% | -0,079% | -0,079% |
| 08:00 Londra | volatilità | BTC ed ETH | 1.068 | 0,274% | 0,091% | -0,129% | -0,189% |
| 08:00 Londra | volatilità | dalla 3ª alla 14ª | 9.246 | 0,258% | 0,115% | -0,105% | -0,165% |
| 08:00 Londra | volatilità | dalla 15ª in poi | 18.228 | 0,282% | 0,335% | 0,054% | 0,054% |
| 9:30 New York | percentuale | BTC ed ETH | 4.305 | 0,199% | 0,124% | -0,096% | -0,156% |
| 9:30 New York | percentuale | dalla 3ª alla 14ª | 50.586 | 0,230% | 0,102% | -0,118% | -0,178% |
| 9:30 New York | percentuale | dalla 15ª in poi | 95.868 | 0,231% | 0,143% | -0,137% | -0,137% |
| 9:30 New York | volatilità | BTC ed ETH | 4.878 | 0,201% | 0,165% | -0,055% | -0,115% |
| 9:30 New York | volatilità | dalla 3ª alla 14ª | 23.103 | 0,267% | 0,099% | -0,121% | -0,181% |
| 9:30 New York | volatilità | dalla 15ª in poi | 42.195 | 0,256% | 0,090% | -0,191% | -0,191% |

\* dalla 15ª moneta in poi lo slittamento è comunque 0,08%.

## Le varianti scelte sul 70% e la verifica sul 30%
Dimensione fissa, leva 3x, slittamento 0,08%.

| Sessione | Variante scelta | Periodo | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---|---|---:|---:|---:|---:|---:|---:|
| 00:00 UTC | volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 30 min, stop 1 unità | 70% scelta | 6,4% | 1,14 | 9,1% | -5,8% | 454 | 0,047% |
| | | **30% verifica** | 3,8% | 1,05 | 21,3% | -3,6% | 339 | 0,037% |
| Europa 08:00 Londra | volatilità: movimento 0,2×vol (entrata 0,25×vol), finestra 15 min, stop 2 unità | 70% scelta | 35,8% | 3,31 | 3,6% | -1,6% | 274 | 0,434% |
| | | **30% verifica** | -0,9% | 0,99 | 15,8% | -7,2% | 248 | -0,012% |
| USA 9:30 New York | percentuale: movimento 1,5% (entrata 1,875%), finestra 15 min, stop 2 unità | 70% scelta | 27,4% | 1,17 | 21,4% | -5,6% | 1.086 | 0,084% |
| | | **30% verifica** | 35,1% | 1,11 | 15,1% | -8,6% | 1.217 | 0,096% |
| Tutte e tre insieme | volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 15 min, stop 1,5 unità | 70% scelta | 32,3% | 1,58 | 7,8% | -5,9% | 527 | 0,204% |
| | | **30% verifica** | 6,1% | 1,05 | 21,4% | -5,6% | 488 | 0,042% |

## Quanto è solida la scelta: tutte le varianti
Per ogni sessione e versione: quante delle 36 varianti guadagnano nel 70% e nel 30%, rendimento mediano, migliore nel 30% e correlazione di rango tra i due periodi (1 = stesso ordine, 0 = nessun legame).

| Sessione | Versione | In utile nel 70% | In utile nel 30% | Mediana 70% | Mediana 30% | Migliore 30% | Correlazione 70↔30 |
|---|---|---:|---:|---:|---:|---:|---:|
| 00:00 UTC | percentuale | 1/36 | 20/36 | -50,6% | 11,6% | 72,7% | 0,67 |
| 00:00 UTC | volatilità | 10/36 | 19/36 | -2,7% | 1,4% | 31,4% | 0,78 |
| Europa 08:00 Londra | percentuale | 7/36 | 4/36 | -17,3% | -40,6% | 21,6% | 0,52 |
| Europa 08:00 Londra | volatilità | 24/36 | 27/36 | 5,9% | 13,5% | 32,9% | 0,46 |
| USA 9:30 New York | percentuale | 11/36 | 10/36 | -45,9% | -31,1% | 35,1% | 0,82 |
| USA 9:30 New York | volatilità | 19/36 | 0/36 | 1,6% | -23,1% | -1,0% | 0,70 |
| Tutte e tre insieme | percentuale | 3/36 | 13/36 | -97,7% | -69,7% | 67,2% | 0,89 |
| Tutte e tre insieme | volatilità | 24/36 | 21/36 | 6,4% | 8,5% | 40,5% | 0,58 |

### Le 5 migliori nel 70%, per sessione, e come sono andate nel 30%

**00:00 UTC**

| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% |
|---|---:|---:|---:|---:|---:|---:|
| volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 30 min, stop 1 unità | 6,4% | 1,14 | 454 | 3,8% | 1,05 | 339 |
| volatilità: movimento 0,4×vol (entrata 0,5×vol), finestra 30 min, stop 1 unità | 3,7% | 1,18 | 210 | 29,0% | 2,00 | 187 |
| volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 15 min, stop 1 unità | 3,4% | 1,19 | 166 | 15,4% | 1,36 | 192 |
| volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 15 min, stop 1,5 unità | 2,5% | 1,12 | 166 | 14,5% | 1,30 | 192 |
| volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 30 min, stop 1,5 unità | 2,5% | 1,05 | 454 | -0,6% | 0,99 | 339 |

**Europa 08:00 Londra**

| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% |
|---|---:|---:|---:|---:|---:|---:|
| volatilità: movimento 0,2×vol (entrata 0,25×vol), finestra 15 min, stop 2 unità | 35,8% | 3,31 | 274 | -0,9% | 0,99 | 248 |
| volatilità: movimento 0,2×vol (entrata 0,25×vol), finestra 15 min, stop 1 unità | 33,2% | 3,04 | 275 | 14,6% | 1,25 | 248 |
| volatilità: movimento 0,2×vol (entrata 0,25×vol), finestra 15 min, stop 1,5 unità | 31,3% | 2,70 | 274 | 11,1% | 1,16 | 248 |
| volatilità: movimento 0,4×vol (entrata 0,5×vol), finestra 30 min, stop 2 unità | 18,6% | 3,10 | 111 | 31,4% | 2,29 | 105 |
| volatilità: movimento 0,4×vol (entrata 0,5×vol), finestra 30 min, stop 1 unità | 18,4% | 3,16 | 111 | 28,6% | 2,18 | 105 |

**USA 9:30 New York**

| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% |
|---|---:|---:|---:|---:|---:|---:|
| percentuale: movimento 1,5% (entrata 1,875%), finestra 15 min, stop 2 unità | 27,4% | 1,17 | 1.086 | 35,1% | 1,11 | 1.217 |
| percentuale: movimento 1,5% (entrata 1,875%), finestra 15 min, stop 1,5 unità | 19,0% | 1,12 | 1.086 | -0,8% | 1,00 | 1.217 |
| volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 15 min, stop 1,5 unità | 17,8% | 1,68 | 283 | -22,7% | 0,57 | 209 |
| percentuale: movimento 1,5% (entrata 1,875%), finestra 3 min, stop 2 unità | 16,5% | 1,90 | 101 | 13,6% | 1,15 | 217 |
| volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 15 min, stop 1 unità | 15,4% | 1,57 | 285 | -23,4% | 0,52 | 209 |

**Tutte e tre insieme**

| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% |
|---|---:|---:|---:|---:|---:|---:|
| volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 15 min, stop 1,5 unità | 32,3% | 1,58 | 527 | 6,1% | 1,05 | 488 |
| volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 15 min, stop 1 unità | 31,1% | 1,60 | 529 | 11,3% | 1,10 | 488 |
| volatilità: movimento 0,2×vol (entrata 0,25×vol), finestra 15 min, stop 2 unità | 27,1% | 1,16 | 1.519 | -58,9% | 0,83 | 1.453 |
| volatilità: movimento 0,3×vol (entrata 0,375×vol), finestra 15 min, stop 2 unità | 26,1% | 1,41 | 527 | 7,1% | 1,05 | 488 |
| volatilità: movimento 0,2×vol (entrata 0,25×vol), finestra 15 min, stop 1 unità | 24,4% | 1,16 | 1.521 | -67,7% | 0,78 | 1.458 |

## Dettaglio: 00:00 UTC · variante scelta
Variante: **volatilità, movimento 0,3×vol (entrata 0,375×vol), finestra 30 min, stop 1 unità**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 9,5% | 5,0% | 1,07 | 20,8% | -3,6% | 339 | 0,050% |
| 0,05% | 3x | composto | 9,4% | 3,3% | 1,04 | 23,4% | -4,3% | 339 | 0,050% |
| 0,05% | 5x | fissa | 16,8% | 3,4% | 1,03 | 31,5% | -8,4% | 339 | 0,020% |
| 0,05% | 5x | composto | 17,5% | -1,3% | 0,99 | 36,2% | -8,5% | 339 | 0,022% |
| 0,08% | 3x | fissa | 6,4% | 3,8% | 1,05 | 21,3% | -3,6% | 339 | 0,037% |
| 0,08% | 3x | composto | 6,1% | 2,1% | 1,03 | 23,8% | -4,3% | 339 | 0,037% |
| 0,08% | 5x | fissa | 11,8% | 1,3% | 1,01 | 32,4% | -8,5% | 339 | 0,007% |
| 0,08% | 5x | composto | 11,6% | -3,4% | 0,97 | 36,7% | -8,5% | 339 | 0,009% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | -4,1% | 0,73 | 6,4% | -1,0% | 140 | -0,096% |
| 2024 | 4,3% | 1,24 | 4,2% | -3,7% | 163 | 0,088% |
| 2025 | 6,4% | 1,29 | 5,8% | -5,8% | 213 | 0,100% |
| 2026 (fino al 11-10) | 6,1% | 1,10 | 20,9% | -3,5% | 278 | 0,074% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Long | 257 | 0,393% | 0,113% | 1,37 | 177 | -0,033% | -0,313% | 0,64 | 53% |
| Short | 261 | 0,274% | -0,005% | 0,98 | 227 | 0,981% | 0,701% | 2,76 | 79% |
| Giorni feriali | 425 | 0,366% | 0,086% | 1,29 | 329 | 0,697% | 0,417% | 1,83 | 72% |
| Weekend | 93 | 0,183% | -0,097% | 0,76 | 75 | -0,166% | -0,445% | 0,57 | 51% |
| BTC ed ETH | 19 | 0,227% | -0,053% | 0,71 | 16 | 0,210% | -0,070% | 0,65 | 50% |
| Le altre 48 | 499 | 0,337% | 0,057% | 1,18 | 388 | 0,551% | 0,271% | 1,44 | 69% |
| Entrata nei primi 3 minuti | 9 | 0,653% | 0,372% | 1,75 | 75 | 1,039% | 0,762% | 2,04 | 76% |
| Entrata dal 4° minuto in poi | 509 | 0,328% | 0,048% | 1,15 | 329 | 0,423% | 0,142% | 1,25 | 66% |

Uscite (portafoglio, intero periodo): protezione del guadagno 72%, stop loss 22%, stop che segue 6%, durata massima 0%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 366 aperture di sessione con almeno una posizione, in media 2,2 posizioni per apertura. In media il **98%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 52% · 2: 10% · 3: 5% · 4: 3% · 5: 2% · 6: 2% · 7: 2% · 8: 2% · 9: 2% · 10: 2%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **25**, in utile 13, risultato medio 1,19% del capitale, la peggiore -5,97%. Le altre: 341, in utile 204, risultato medio -0,04%.

## Dettaglio: 00:00 UTC · configurazione Attuale
Variante: **percentuale, **Attuale**: movimento 1% (entrata 1,25%), finestra 30 min, stop 1,5 unità**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | -100,0% (rovina) | -44,1% | 0,94 | 55,1% | -9,7% | 3.233 | -0,046% |
| 0,05% | 3x | composto | -87,7% | -46,7% | 0,91 | 50,1% | -8,8% | 3.235 | -0,055% |
| 0,05% | 5x | fissa | -100,0% (rovina) | -81,9% (rovina) | 0,92 | 90,8% | -40,5% | 3.023 | -0,055% |
| 0,05% | 5x | composto | -97,7% | -65,1% | 0,89 | 71,3% | -10,0% | 3.234 | -0,049% |
| 0,08% | 3x | fissa | -100,0% (rovina) | -51,3% | 0,93 | 61,6% | -9,5% | 3.227 | -0,053% |
| 0,08% | 3x | composto | -90,6% | -50,8% | 0,89 | 53,7% | -8,8% | 3.235 | -0,063% |
| 0,08% | 5x | fissa | -100,0% (rovina) | -91,8% (rovina) | 0,90 | 97,2% | -68,9% | 2.881 | -0,064% |
| 0,08% | 5x | composto | -98,5% | -69,1% | 0,88 | 74,4% | -10,0% | 3.234 | -0,057% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | -56,9% | 0,64 | 59,0% | -9,1% | 1.058 | -0,179% |
| 2024 | -99,7% (rovina) | 0,65 | 99,7% | -66,4% | 1.883 | -0,177% |
| 2025 | -88,7% | 0,77 | 92,9% | -15,6% | 2.154 | -0,137% |
| 2026 (fino al 11-10) | -23,0% | 0,95 | 38,3% | -9,1% | 2.343 | -0,033% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Long | 2.550 | 0,121% | -0,159% | 0,67 | 1.937 | 0,271% | -0,008% | 0,99 | 74% |
| Short | 2.379 | 0,110% | -0,170% | 0,69 | 1.684 | 0,213% | -0,070% | 0,91 | 74% |
| Giorni feriali | 3.802 | 0,134% | -0,146% | 0,71 | 2.683 | 0,254% | -0,026% | 0,96 | 75% |
| Weekend | 1.127 | 0,054% | -0,226% | 0,61 | 938 | 0,216% | -0,067% | 0,92 | 74% |
| BTC ed ETH | 55 | 0,318% | 0,038% | 1,19 | 23 | 0,063% | -0,217% | 0,42 | 57% |
| Le altre 48 | 4.874 | 0,114% | -0,166% | 0,68 | 3.598 | 0,245% | -0,035% | 0,95 | 75% |
| Entrata nei primi 3 minuti | 433 | 0,186% | -0,094% | 0,87 | 566 | 0,484% | 0,201% | 1,18 | 78% |
| Entrata dal 4° minuto in poi | 4.496 | 0,109% | -0,171% | 0,66 | 3.055 | 0,200% | -0,081% | 0,87 | 74% |

Uscite (portafoglio, intero periodo): protezione del guadagno 73%, stop loss 18%, freno 7%, stop che segue 1%, durata massima 1%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 395 aperture di sessione con almeno una posizione, in media 4,1 posizioni per apertura. In media il **87%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 44% · 2: 21% · 3: 12% · 4: 7% · 5: 4% · 6: 3% · 7: 2% · 8: 1% · 9: 1% · 10: 1%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **77**, in utile 38, risultato medio -0,19% del capitale, la peggiore -6,65%. Le altre: 318, in utile 158, risultato medio -0,27%.

## Dettaglio: Europa 08:00 Londra · variante scelta
Variante: **volatilità, movimento 0,2×vol (entrata 0,25×vol), finestra 15 min, stop 2 unità**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 37,7% | -0,2% | 1,00 | 15,6% | -7,1% | 248 | -0,003% |
| 0,05% | 3x | composto | 44,4% | -2,3% | 0,97 | 17,2% | -7,8% | 248 | -0,003% |
| 0,05% | 5x | fissa | 62,8% | 2,6% | 1,02 | 21,5% | -8,6% | 248 | 0,021% |
| 0,05% | 5x | composto | 82,6% | -1,2% | 0,99 | 24,9% | -9,9% | 248 | 0,032% |
| 0,08% | 3x | fissa | 35,8% | -0,9% | 0,99 | 15,8% | -7,2% | 248 | -0,012% |
| 0,08% | 3x | composto | 41,7% | -3,0% | 0,97 | 17,4% | -7,8% | 248 | -0,012% |
| 0,08% | 5x | fissa | 59,6% | 1,6% | 1,01 | 21,7% | -8,7% | 248 | 0,013% |
| 0,08% | 5x | composto | 77,0% | -2,4% | 0,98 | 25,1% | -9,9% | 248 | 0,023% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | 12,0% | 6,35 | 1,4% | -0,8% | 67 | 0,599% |
| 2024 | 10,7% | 2,38 | 4,1% | -1,8% | 113 | 0,313% |
| 2025 | 20,1% | 2,54 | 3,6% | -2,0% | 130 | 0,515% |
| 2026 (fino al 11-10) | -8,1% | 0,89 | 16,8% | -7,7% | 212 | -0,127% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Long | 161 | 0,778% | 0,506% | 3,31 | 133 | 0,432% | 0,148% | 1,15 | 70% |
| Short | 138 | 0,747% | 0,469% | 4,71 | 138 | -0,151% | -0,440% | 0,66 | 59% |
| Giorni feriali | 258 | 0,807% | 0,527% | 4,32 | 183 | 0,291% | 0,003% | 1,00 | 66% |
| Weekend | 41 | 0,495% | 0,247% | 1,86 | 88 | -0,189% | -0,473% | 0,66 | 63% |
| BTC ed ETH | 14 | 0,616% | 0,337% | 11,86 | 5 | -0,265% | -0,546% | 0,07 | 20% |
| Le altre 48 | 285 | 0,771% | 0,496% | 3,70 | 266 | 0,143% | -0,144% | 0,88 | 65% |
| Entrata nei primi 3 minuti | 18 | 0,241% | -0,038% | 0,93 | 45 | 1,721% | 1,446% | 2,82 | 78% |
| Entrata dal 4° minuto in poi | 281 | 0,797% | 0,522% | 4,48 | 226 | -0,181% | -0,469% | 0,62 | 62% |

Uscite (portafoglio, intero periodo): protezione del guadagno 80%, stop loss 13%, stop che segue 7%, durata massima 1%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 306 aperture di sessione con almeno una posizione, in media 1,7 posizioni per apertura. In media il **97%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 58% · 2: 9% · 3: 3% · 4: 3% · 5: 3% · 6: 2% · 7: 2% · 8: 1% · 9: 1% · 10: 1%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **16**, in utile 12, risultato medio 1,51% del capitale, la peggiore -6,37%. Le altre: 290, in utile 203, risultato medio 0,03%.

## Dettaglio: Europa 08:00 Londra · configurazione Attuale
Variante: **percentuale, **Attuale**: movimento 1% (entrata 1,25%), finestra 30 min, stop 1,5 unità**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | -39,5% | -83,1% | 0,87 | 90,9% | -15,8% | 2.768 | -0,100% |
| 0,05% | 3x | composto | -34,7% | -53,7% | 0,88 | 65,2% | -8,5% | 2.837 | -0,079% |
| 0,05% | 5x | fissa | -76,6% | -95,0% (rovina) | 0,89 | 98,7% | -100,0% | 2.505 | -0,077% |
| 0,05% | 5x | composto | -54,7% | -77,0% | 0,85 | 85,6% | -12,4% | 2.833 | -0,085% |
| 0,08% | 3x | fissa | -57,9% | -84,0% | 0,87 | 91,6% | -16,0% | 2.760 | -0,101% |
| 0,08% | 3x | composto | -45,7% | -56,5% | 0,87 | 67,0% | -8,6% | 2.837 | -0,086% |
| 0,08% | 5x | fissa | -99,7% (rovina) | -98,5% (rovina) | 0,85 | 100% (rovina) | -100,0% | 2.016 | -0,104% |
| 0,08% | 5x | composto | -66,7% | -79,0% | 0,85 | 86,6% | -12,5% | 2.833 | -0,091% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | -1,6% | 0,98 | 13,6% | -3,3% | 643 | -0,008% |
| 2024 | -32,5% | 0,82 | 46,2% | -9,2% | 1.424 | -0,076% |
| 2025 | -47,0% | 0,85 | 47,6% | -7,6% | 1.838 | -0,085% |
| 2026 (fino al 11-10) | -68,1% | 0,86 | 82,2% | -13,3% | 2.027 | -0,112% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Long | 1.891 | 0,301% | 0,021% | 1,06 | 1.646 | 0,208% | -0,073% | 0,91 | 73% |
| Short | 1.817 | 0,200% | -0,079% | 0,80 | 1.439 | 0,169% | -0,114% | 0,84 | 75% |
| Giorni feriali | 2.951 | 0,266% | -0,014% | 0,96 | 2.229 | 0,170% | -0,111% | 0,86 | 74% |
| Weekend | 757 | 0,196% | -0,083% | 0,80 | 856 | 0,241% | -0,041% | 0,95 | 73% |
| BTC ed ETH | 45 | 0,273% | -0,007% | 0,96 | 10 | -0,218% | -0,499% | 0,12 | 30% |
| Le altre 48 | 3.663 | 0,252% | -0,028% | 0,93 | 3.075 | 0,191% | -0,090% | 0,88 | 74% |
| Entrata nei primi 3 minuti | 152 | 0,329% | 0,048% | 1,07 | 439 | 0,035% | -0,255% | 0,84 | 73% |
| Entrata dal 4° minuto in poi | 3.556 | 0,249% | -0,031% | 0,92 | 2.646 | 0,216% | -0,065% | 0,90 | 74% |

Uscite (portafoglio, intero periodo): protezione del guadagno 78%, stop loss 16%, freno 3%, stop che segue 2%, durata massima 1%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 900 aperture di sessione con almeno una posizione, in media 4,6 posizioni per apertura. In media il **88%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 35% · 2: 19% · 3: 11% · 4: 8% · 5: 6% · 6: 5% · 7: 4% · 8: 4% · 9: 3% · 10: 3%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **213**, in utile 111, risultato medio 0,06% del capitale, la peggiore -6,04%. Le altre: 687, in utile 382, risultato medio -0,16%.

## Dettaglio: USA 9:30 New York · variante scelta
Variante: **percentuale, movimento 1,5% (entrata 1,875%), finestra 15 min, stop 2 unità**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 34,6% | 38,4% | 1,12 | 14,7% | -8,4% | 1.217 | 0,105% |
| 0,05% | 3x | composto | 36,4% | 42,0% | 1,11 | 18,0% | -8,3% | 1.217 | 0,114% |
| 0,05% | 5x | fissa | 25,2% | 43,1% | 1,08 | 23,4% | -9,7% | 1.217 | 0,071% |
| 0,05% | 5x | composto | 28,8% | 31,3% | 1,05 | 30,9% | -9,7% | 1.217 | 0,074% |
| 0,08% | 3x | fissa | 27,4% | 35,1% | 1,11 | 15,1% | -8,6% | 1.217 | 0,096% |
| 0,08% | 3x | composto | 26,9% | 37,6% | 1,10 | 18,1% | -8,3% | 1.217 | 0,105% |
| 0,08% | 5x | fissa | 2,0% | 37,5% | 1,07 | 25,5% | -10,1% | 1.217 | 0,062% |
| 0,08% | 5x | composto | 14,2% | 24,4% | 1,04 | 31,5% | -9,7% | 1.217 | 0,066% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | -4,3% | 0,86 | 6,9% | -4,6% | 211 | -0,069% |
| 2024 | -0,5% | 0,99 | 16,9% | -4,8% | 496 | -0,003% |
| 2025 | 48,6% | 1,37 | 9,8% | -6,2% | 733 | 0,221% |
| 2026 (fino al 11-10) | 22,3% | 1,09 | 16,9% | -8,3% | 862 | 0,086% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Long | 606 | 0,693% | 0,411% | 2,02 | 805 | 0,444% | 0,170% | 1,23 | 84% |
| Short | 750 | 0,239% | -0,040% | 0,92 | 586 | 0,317% | 0,036% | 1,04 | 80% |
| Giorni feriali | 1.186 | 0,452% | 0,172% | 1,37 | 1.153 | 0,436% | 0,156% | 1,22 | 84% |
| Weekend | 170 | 0,371% | 0,092% | 1,18 | 238 | 0,167% | -0,094% | 0,93 | 76% |
| BTC ed ETH | 22 | 0,785% | 0,505% | 52,88 | 9 | -0,035% | -0,319% | 0,33 | 78% |
| Le altre 48 | 1.334 | 0,436% | 0,156% | 1,33 | 1.382 | 0,393% | 0,116% | 1,14 | 82% |
| Entrata nei primi 3 minuti | 140 | 1,448% | 1,166% | 3,66 | 239 | 0,451% | 0,182% | 1,14 | 79% |
| Entrata dal 4° minuto in poi | 1.216 | 0,326% | 0,046% | 1,10 | 1.152 | 0,378% | 0,099% | 1,14 | 83% |

Uscite (portafoglio, intero periodo): protezione del guadagno 82%, stop loss 15%, stop che segue 2%, durata massima 2%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 747 aperture di sessione con almeno una posizione, in media 3,1 posizioni per apertura. In media il **91%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 44% · 2: 17% · 3: 9% · 4: 6% · 5: 5% · 6: 4% · 7: 3% · 8: 3% · 9: 3% · 10: 3%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **114**, in utile 62, risultato medio -0,12% del capitale, la peggiore -11,59%. Le altre: 633, in utile 468, risultato medio 0,10%.

## Dettaglio: USA 9:30 New York · configurazione Attuale
Variante: **percentuale, **Attuale**: movimento 1% (entrata 1,25%), finestra 30 min, stop 1,5 unità**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | -100,0% (rovina) | -100,0% (rovina) | 0,62 | 100% (rovina) | -100,0% | 1.107 | -0,303% |
| 0,05% | 3x | composto | -50,9% | -85,1% | 0,72 | 87,7% | -8,8% | 4.188 | -0,140% |
| 0,05% | 5x | fissa | -100,0% (rovina) | -100,0% (rovina) | 0,65 | 100% (rovina) | -100,0% | 773 | -0,260% |
| 0,05% | 5x | composto | -84,8% | -96,5% | 0,66 | 97,3% | -11,5% | 4.157 | -0,143% |
| 0,08% | 3x | fissa | -100,0% (rovina) | -100,0% (rovina) | 0,61 | 100% (rovina) | -100,0% | 1.062 | -0,315% |
| 0,08% | 3x | composto | -66,1% | -87,2% | 0,70 | 89,3% | -8,7% | 4.188 | -0,152% |
| 0,08% | 5x | fissa | -100,0% (rovina) | -100,0% (rovina) | 0,64 | 100% (rovina) | -100,0% | 744 | -0,270% |
| 0,08% | 5x | composto | -91,8% | -97,3% | 0,64 | 97,9% | -11,6% | 4.154 | -0,155% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | -38,4% | 0,72 | 38,9% | -5,3% | 1.102 | -0,116% |
| 2024 | -100,0% (rovina) | 0,69 | 100% (rovina) | oltre -100% (rovina) | 2.347 | -0,142% |
| 2025 | -89,0% | 0,83 | 92,4% | -14,4% | 3.073 | -0,097% |
| 2026 (fino al 11-10) | -100,0% (rovina) | 0,82 | 100% (rovina) | oltre -100% (rovina) | 2.883 | -0,116% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Long | 3.044 | 0,288% | 0,006% | 1,02 | 3.001 | 0,233% | -0,046% | 0,92 | 76% |
| Short | 4.579 | 0,244% | -0,035% | 0,91 | 2.709 | 0,010% | -0,271% | 0,66 | 71% |
| Giorni feriali | 6.555 | 0,282% | 0,002% | 1,01 | 4.805 | 0,159% | -0,121% | 0,81 | 74% |
| Weekend | 1.068 | 0,132% | -0,148% | 0,72 | 905 | -0,043% | -0,322% | 0,67 | 70% |
| BTC ed ETH | 210 | 0,119% | -0,162% | 0,56 | 99 | -0,020% | -0,300% | 0,35 | 61% |
| Le altre 48 | 7.413 | 0,265% | -0,015% | 0,96 | 5.611 | 0,130% | -0,150% | 0,78 | 74% |
| Entrata nei primi 3 minuti | 372 | 0,373% | 0,092% | 1,15 | 635 | 0,274% | -0,003% | 1,00 | 77% |
| Entrata dal 4° minuto in poi | 7.251 | 0,256% | -0,024% | 0,94 | 5.075 | 0,109% | -0,171% | 0,73 | 73% |

Uscite (portafoglio, intero periodo): protezione del guadagno 76%, stop loss 16%, freno 6%, stop che segue 2%, durata massima 0%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 528 aperture di sessione con almeno una posizione, in media 5,3 posizioni per apertura. In media il **92%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 28% · 2: 15% · 3: 12% · 4: 9% · 5: 7% · 6: 6% · 7: 5% · 8: 5% · 9: 4% · 10: 4%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **179**, in utile 84, risultato medio -0,14% del capitale, la peggiore -4,45%. Le altre: 349, in utile 202, risultato medio -0,21%.

## Dettaglio: Tutte e tre insieme · variante scelta
Variante: **volatilità, movimento 0,3×vol (entrata 0,375×vol), finestra 15 min, stop 1,5 unità**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 35,9% | 8,0% | 1,06 | 20,8% | -5,6% | 488 | 0,055% |
| 0,05% | 3x | composto | 40,5% | 4,7% | 1,03 | 25,2% | -6,4% | 488 | 0,055% |
| 0,05% | 5x | fissa | 59,9% | 7,0% | 1,03 | 30,9% | -8,4% | 488 | 0,029% |
| 0,05% | 5x | composto | 73,8% | -0,0% | 1,00 | 38,1% | -9,0% | 486 | 0,039% |
| 0,08% | 3x | fissa | 32,3% | 6,1% | 1,05 | 21,4% | -5,6% | 488 | 0,042% |
| 0,08% | 3x | composto | 35,5% | 2,7% | 1,02 | 25,6% | -6,4% | 488 | 0,042% |
| 0,08% | 5x | fissa | 54,1% | 3,8% | 1,02 | 31,9% | -8,5% | 488 | 0,015% |
| 0,08% | 5x | composto | 63,7% | -3,1% | 0,99 | 38,7% | -9,0% | 486 | 0,026% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | 1,1% | 1,06 | 6,0% | -2,0% | 178 | 0,020% |
| 2024 | 17,8% | 2,11 | 3,2% | -3,2% | 175 | 0,339% |
| 2025 | 4,0% | 1,09 | 9,3% | -7,0% | 276 | 0,048% |
| 2026 (fino al 11-10) | 16,0% | 1,15 | 19,9% | -5,2% | 386 | 0,138% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Sessione 00:00 UTC (Asia, chiusura giornaliera) | 182 | 0,350% | 0,070% | 1,18 | 239 | 0,844% | 0,564% | 1,83 | 77% |
| Sessione 08:00 Londra (Europa) | 90 | 0,902% | 0,621% | 3,13 | 87 | 0,903% | 0,622% | 1,63 | 72% |
| Sessione 9:30 New York (USA) | 351 | 0,570% | 0,289% | 2,00 | 214 | -0,097% | -0,378% | 0,55 | 64% |
| Long | 293 | 0,795% | 0,513% | 2,81 | 236 | 0,358% | 0,077% | 1,09 | 68% |
| Short | 330 | 0,339% | 0,060% | 1,17 | 304 | 0,576% | 0,296% | 1,39 | 74% |
| Giorni feriali | 556 | 0,545% | 0,264% | 1,79 | 447 | 0,570% | 0,290% | 1,40 | 72% |
| Weekend | 67 | 0,628% | 0,348% | 2,79 | 93 | 0,048% | -0,234% | 0,80 | 66% |
| BTC ed ETH | 31 | 0,525% | 0,245% | 4,16 | 31 | -0,097% | -0,376% | 0,15 | 23% |
| Le altre 48 | 592 | 0,555% | 0,274% | 1,83 | 509 | 0,516% | 0,235% | 1,29 | 74% |
| Entrata nei primi 3 minuti | 48 | 1,691% | 1,409% | 5,30 | 103 | 0,967% | 0,688% | 1,69 | 77% |
| Entrata dal 4° minuto in poi | 575 | 0,459% | 0,178% | 1,56 | 437 | 0,366% | 0,085% | 1,11 | 70% |

Uscite (portafoglio, intero periodo): protezione del guadagno 76%, stop loss 18%, stop che segue 6%, durata massima 1%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 498 aperture di sessione con almeno una posizione, in media 2,0 posizioni per apertura. In media il **98%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 49% · 2: 9% · 3: 5% · 4: 4% · 5: 3% · 6: 3% · 7: 2% · 8: 2% · 9: 2% · 10: 1%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **31**, in utile 23, risultato medio 1,55% del capitale, la peggiore -7,09%. Le altre: 467, in utile 314, risultato medio -0,03%.

## Dettaglio: Tutte e tre insieme · configurazione Attuale
Variante: **percentuale, **Attuale**: movimento 1% (entrata 1,25%), finestra 30 min, stop 1,5 unità**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | -100,0% (rovina) | -100,0% (rovina) | 0,76 | 100% (rovina) | -100,0% | 1.811 | -0,186% |
| 0,05% | 3x | composto | -96,6% | -96,5% | 0,80 | 97,3% | -9,0% | 10.037 | -0,100% |
| 0,05% | 5x | fissa | -100,0% (rovina) | -100,0% (rovina) | 0,79 | 100% (rovina) | -100,0% | 1.278 | -0,157% |
| 0,05% | 5x | composto | -99,8% | -99,7% | 0,77 | 99,7% | -11,2% | 9.458 | -0,103% |
| 0,08% | 3x | fissa | -100,0% (rovina) | -100,0% (rovina) | 0,74 | 100% (rovina) | -100,0% | 1.625 | -0,206% |
| 0,08% | 3x | composto | -98,5% | -97,3% | 0,78 | 97,9% | -8,9% | 10.034 | -0,109% |
| 0,08% | 5x | fissa | -100,0% (rovina) | -100,0% (rovina) | 0,78 | 100% (rovina) | -100,0% | 1.226 | -0,164% |
| 0,08% | 5x | composto | -99,9% | -99,8% | 0,76 | 99,8% | -11,2% | 9.443 | -0,112% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | -90,5% | 0,74 | 91,2% | -13,5% | 2.645 | -0,114% |
| 2024 | -100,0% (rovina) | 0,63 | 100% (rovina) | oltre -100% (rovina) | 1.792 | -0,186% |
| 2025 | -100,0% (rovina) | 0,86 | 100% (rovina) | oltre -100% (rovina) | 4.897 | -0,068% |
| 2026 (fino al 11-10) | -100,0% (rovina) | 0,80 | 100% (rovina) | oltre -100% (rovina) | 2.847 | -0,118% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Sessione 00:00 UTC (Asia, chiusura giornaliera) | 4.929 | 0,116% | -0,164% | 0,68 | 3.621 | 0,244% | -0,037% | 0,95 | 74% |
| Sessione 08:00 Londra (Europa) | 3.708 | 0,252% | -0,028% | 0,93 | 3.085 | 0,190% | -0,092% | 0,88 | 74% |
| Sessione 9:30 New York (USA) | 7.623 | 0,261% | -0,019% | 0,95 | 5.710 | 0,127% | -0,152% | 0,78 | 74% |
| Long | 7.485 | 0,234% | -0,046% | 0,89 | 6.584 | 0,238% | -0,041% | 0,94 | 75% |
| Short | 8.775 | 0,199% | -0,081% | 0,82 | 5.832 | 0,108% | -0,174% | 0,77 | 73% |
| Giorni feriali | 13.308 | 0,237% | -0,043% | 0,90 | 9.717 | 0,188% | -0,092% | 0,86 | 74% |
| Weekend | 2.952 | 0,119% | -0,161% | 0,69 | 2.699 | 0,137% | -0,144% | 0,83 | 72% |
| BTC ed ETH | 310 | 0,176% | -0,104% | 0,67 | 132 | -0,020% | -0,301% | 0,33 | 58% |
| Le altre 48 | 15.950 | 0,216% | -0,064% | 0,85 | 12.284 | 0,179% | -0,101% | 0,86 | 74% |
| Entrata nei primi 3 minuti | 957 | 0,282% | 0,001% | 1,00 | 1.640 | 0,283% | -0,000% | 1,00 | 76% |
| Entrata dal 4° minuto in poi | 15.303 | 0,211% | -0,069% | 0,84 | 10.776 | 0,161% | -0,119% | 0,81 | 74% |

Uscite (portafoglio, intero periodo): protezione del guadagno 75%, stop loss 18%, freno 4%, stop che segue 2%, durata massima 0%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 788 aperture di sessione con almeno una posizione, in media 3,5 posizioni per apertura. In media il **91%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato aperte (compresa la nuova): 1: 43% · 2: 18% · 3: 10% · 4: 7% · 5: 5% · 6: 4% · 7: 3% · 8: 2% · 9: 2% · 10: 1%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **143**, in utile 69, risultato medio -0,06% del capitale, la peggiore -5,29%. Le altre: 645, in utile 389, risultato medio -0,14%.

## Limiti di questo test
- Le 50 monete sono le più liquide **oggi**: quelle sparite o crollate non ci sono. Questo migliora i risultati del passato, soprattutto per i long.
- Le monete quotate da poco compaiono solo nel 30% finale.
- Il percorso dentro il minuto è una supposizione; le punte di Binance non sempre ci sono su Bitunix (per questo il margine dello 0,15% sulle entrate).
- Lo stop si calcola dal prezzo del livello, non da quello eseguito con lo slittamento (in Wisi Trade dal prezzo eseguito): differenza di 0,05–0,08%, trascurabile rispetto a uno stop di 1–2 unità.
- Con 72 varianti × 4 gruppi la migliore nel 70% è in parte fortuna: contano più la tabella "tutte le varianti" e la configurazione Attuale.

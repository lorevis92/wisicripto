# Apertura USA su BTC ed ETH con entrata a ordine limite

Aggiornato il 2026-11-11. Script: `research/05-btc-eth-limite.js` (motore in `research/motore/`). Risultati completi: `data/backtest/btc-eth-limite/risultati.json`.

<!-- conclusione:inizio -->
## Conclusione
**No: l'entrata a ordine limite peggiora le cose.** Nessuna variante guadagna né nel 70% né nel 30% con un numero sufficiente di operazioni (la migliore nel 70% perde il 4,4%, e nel 30% il 5,8%). La versione a mercato con conferma dello 0,15% va meglio, anche se resta comunque in leggera perdita.

**Perché.** Su un ingresso in rottura l'ordine limite non può stare davanti al prezzo: aspetta che il prezzo torni indietro sul livello. Così viene eseguito **proprio quando la rottura fallisce**:
- l'ordine viene eseguito in quasi tutti i casi (78–95% dei segnali, in media 1–2 minuti dopo);
- i segnali eseguiti, entrando subito al tocco, avrebbero reso in media circa **0%** lordo (da -0,14% a +0,08%);
- i segnali **persi** (5–20%) sono quelli in cui il prezzo è scappato senza tornare indietro: entrando al tocco avrebbero reso **+0,3% / +0,9%** lordo, e il **92–100%** sarebbe andato in utile.

Il risparmio sui costi è reale (0,12% per operazione), ma è molto più piccolo di quello che si perde lasciando andare i movimenti migliori: è una selezione sfavorevole quasi perfetta.

**Cosa resta.** Nell'apertura USA su BTC ed ETH il vantaggio sta tutto nei movimenti che partono e non tornano indietro: per prenderli bisogna entrare a mercato (o con un ordine stop), cioè pagare il taker. Con i costi di oggi questa strada non porta a una strategia. Ha senso riprovarla solo se le commissioni taker scendessero molto (livelli VIP alti, sconti), o come piccolo filtro dentro altre strategie.
<!-- conclusione:fine -->

## Perché questo test
Nel backtest dell'apertura di sessione l'unico vantaggio stabile era l'apertura USA su BTC ed ETH: circa +0,2% lordo per operazione, non abbastanza per pagare commissione e slittamento a mercato (0,28% andata e ritorno). Con un ordine limite all'entrata il costo d'entrata scende da 0,06% + 0,08% di slittamento a 0,02% (maker): andata e ritorno 0,16% invece di 0,28%.

## Le regole
- **Commissioni Bitunix** (VIP 0, verificate su bitunix.com/service/handling-fee): maker 0,02%, taker 0,06%. Entrata maker senza slittamento; uscita a mercato: taker più slittamento 0,05% o 0,08%.
- **Segnale**: alle 9:30 di New York il riferimento è il prezzo d'apertura; se entro la finestra (3, 15 o 30 minuti) il prezzo tocca il livello 1,25 × movimento, scatta il segnale nella direzione del movimento.
- **Ordine limite**: messo sul livello al momento del segnale. Un acquisto sopra il prezzo di mercato verrebbe eseguito subito come taker; per restare nel book (maker) deve aspettare che il prezzo torni sul livello. È considerato **eseguito solo se il prezzo ripassa oltre il livello di almeno 0,05%** (long: scende fino a livello − 0,05%) entro 5, 15, 30 minuti dal segnale; altrimenti il segnale è **perso**.
- **Uscite** come Wisi Trade: stop loss 1 / 1,5 / 2 unità, poi stop che segue a 1 unità e protezione del guadagno al 40%; durata massima fino alle 00:00 UTC.
- **Confronti**: per ogni segnale si simula anche l'operazione "ipotetica" entrata subito al tocco del livello, per vedere se i segnali persi erano migliori o peggiori di quelli eseguiti; e la versione a mercato con conferma dello 0,15% (taker, come nell'apertura di sessione).
- **Metodo**: come negli altri test (capitale 10.000 USDT, 10 posizioni, margine 10%, leva 3x/5x, freno 8% su perdite chiuse + aperte, 10 ordini casuali, 70/30 con taglio al 2025-09-14). Griglia: 189 varianti (movimento in % o in multipli della volatilità, finestra, stop, validità dell'ordine). Criterio di scelta: miglior rendimento nel 70% con almeno 50 operazioni, dimensione fissa, leva 3x, slittamento 0,08%.

## Quanti segnali vanno persi, e quali
Finestra 30 minuti, stop 1,5 unità. "Ipotetico" = risultato lordo medio se si fosse entrati subito al tocco del livello. Se gli eseguiti hanno un ipotetico peggiore dei persi, l'ordine limite viene eseguito proprio quando la rottura fallisce (selezione sfavorevole).

| Movimento | Validità | Periodo | Segnali | Eseguiti | Ipotetico degli eseguiti | Ipotetico dei persi | Persi che sarebbero andati in utile | Lordo eseguiti (limite) | Netto eseguiti (limite) |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,25% | 5 min | 70% | 1.482 | 1.172 (79%) | -0,085% | 0,281% | 93% | -0,104% | -0,264% |
| 0,25% | 5 min | 30% | 651 | 510 (78%) | -0,076% | 0,313% | 95% | -0,089% | -0,250% |
| 0,25% | 15 min | 70% | 1.482 | 1.293 (87%) | -0,067% | 0,394% | 99% | -0,101% | -0,261% |
| 0,25% | 15 min | 30% | 651 | 579 (89%) | -0,036% | 0,361% | 99% | -0,070% | -0,230% |
| 0,25% | 30 min | 70% | 1.482 | 1.344 (91%) | -0,053% | 0,420% | 99% | -0,101% | -0,261% |
| 0,25% | 30 min | 30% | 651 | 601 (92%) | -0,023% | 0,378% | 98% | -0,062% | -0,222% |
| 0,5% | 5 min | 70% | 831 | 688 (83%) | -0,027% | 0,374% | 98% | -0,057% | -0,217% |
| 0,5% | 5 min | 30% | 415 | 361 (87%) | -0,136% | 0,524% | 98% | -0,149% | -0,309% |
| 0,5% | 15 min | 70% | 831 | 741 (89%) | -0,008% | 0,452% | 100% | -0,050% | -0,210% |
| 0,5% | 15 min | 30% | 415 | 381 (92%) | -0,112% | 0,640% | 100% | -0,140% | -0,300% |
| 0,5% | 30 min | 70% | 831 | 766 (92%) | 0,004% | 0,489% | 100% | -0,052% | -0,211% |
| 0,5% | 30 min | 30% | 415 | 389 (94%) | -0,100% | 0,686% | 100% | -0,137% | -0,297% |
| 0,75% | 5 min | 70% | 454 | 397 (87%) | 0,058% | 0,432% | 96% | 0,016% | -0,144% |
| 0,75% | 5 min | 30% | 225 | 198 (88%) | -0,020% | 0,526% | 100% | -0,038% | -0,198% |
| 0,75% | 15 min | 70% | 454 | 417 (92%) | 0,067% | 0,541% | 100% | 0,005% | -0,155% |
| 0,75% | 15 min | 30% | 225 | 209 (93%) | 0,002% | 0,615% | 100% | -0,038% | -0,198% |
| 0,75% | 30 min | 70% | 454 | 429 (94%) | 0,076% | 0,601% | 100% | -0,009% | -0,169% |
| 0,75% | 30 min | 30% | 225 | 214 (95%) | 0,017% | 0,600% | 100% | -0,044% | -0,205% |
| 1% | 5 min | 70% | 268 | 239 (89%) | -0,112% | 0,650% | 100% | -0,154% | -0,314% |
| 1% | 5 min | 30% | 127 | 115 (91%) | -0,107% | 0,610% | 92% | -0,158% | -0,319% |
| 1% | 15 min | 70% | 268 | 247 (92%) | -0,093% | 0,718% | 100% | -0,145% | -0,306% |
| 1% | 15 min | 30% | 127 | 117 (92%) | -0,118% | 0,887% | 100% | -0,169% | -0,329% |
| 1% | 30 min | 70% | 268 | 252 (94%) | -0,083% | 0,812% | 100% | -0,154% | -0,314% |
| 1% | 30 min | 30% | 127 | 119 (94%) | -0,105% | 0,941% | 100% | -0,181% | -0,342% |
| 0,1×vol | 5 min | 70% | 1.023 | 855 (84%) | -0,032% | 0,347% | 98% | -0,043% | -0,203% |
| 0,1×vol | 5 min | 30% | 525 | 444 (85%) | -0,082% | 0,338% | 98% | -0,115% | -0,275% |
| 0,1×vol | 15 min | 70% | 1.023 | 925 (90%) | -0,009% | 0,399% | 100% | -0,033% | -0,193% |
| 0,1×vol | 15 min | 30% | 525 | 476 (91%) | -0,058% | 0,382% | 100% | -0,116% | -0,276% |
| 0,1×vol | 30 min | 70% | 1.023 | 952 (93%) | -0,000% | 0,441% | 100% | -0,035% | -0,195% |
| 0,1×vol | 30 min | 30% | 525 | 493 (94%) | -0,045% | 0,406% | 100% | -0,112% | -0,272% |
| 0,2×vol | 5 min | 70% | 325 | 276 (85%) | -0,028% | 0,377% | 96% | -0,099% | -0,259% |
| 0,2×vol | 5 min | 30% | 208 | 180 (87%) | -0,024% | 0,433% | 100% | -0,071% | -0,231% |
| 0,2×vol | 15 min | 70% | 325 | 299 (92%) | -0,010% | 0,537% | 100% | -0,103% | -0,263% |
| 0,2×vol | 15 min | 30% | 208 | 186 (89%) | -0,011% | 0,446% | 100% | -0,091% | -0,251% |
| 0,2×vol | 30 min | 70% | 325 | 306 (94%) | -0,001% | 0,597% | 100% | -0,105% | -0,265% |
| 0,2×vol | 30 min | 30% | 208 | 190 (91%) | -0,004% | 0,481% | 100% | -0,085% | -0,245% |
| 0,3×vol | 5 min | 70% | 113 | 97 (86%) | 0,041% | 0,597% | 100% | -0,030% | -0,190% |
| 0,3×vol | 5 min | 30% | 76 | 66 (87%) | -0,131% | 0,630% | 100% | -0,145% | -0,305% |
| 0,3×vol | 15 min | 70% | 113 | 102 (90%) | 0,051% | 0,756% | 100% | -0,016% | -0,176% |
| 0,3×vol | 15 min | 30% | 76 | 68 (89%) | -0,120% | 0,726% | 100% | -0,133% | -0,293% |
| 0,3×vol | 30 min | 70% | 113 | 104 (92%) | 0,065% | 0,751% | 100% | -0,020% | -0,180% |
| 0,3×vol | 30 min | 30% | 76 | 68 (89%) | -0,120% | 0,726% | 100% | -0,133% | -0,293% |

## Ordine limite contro ordine a mercato: tutte le varianti
| Entrata | In utile nel 70% | In utile nel 30% | Mediana 70% | Mediana 30% | Migliore 30% | Correlazione 70↔30 |
|---|---:|---:|---:|---:|---:|---:|
| Ordine limite (maker) | 6/189 | 6/189 | -10,0% | -7,7% | 0,5% | 0,92 |
| A mercato con conferma 0,15% (taker) | 45/189 | 15/189 | -2,6% | -3,7% | 1,7% | 0,77 |

### Le 8 migliori nel 70% (ordine limite) e come sono andate nel 30%
| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% | A mercato: rend. 30% |
|---|---:|---:|---:|---:|---:|---:|---:|
| movimento 1% (livello 1,25%), finestra 15 min, stop 2 unità, ordine valido 15 min | -4,4% | 0,69 | 106 | -5,8% | 0,39 | 59 | -2,8% |
| movimento 1% (livello 1,25%), finestra 15 min, stop 2 unità, ordine valido 30 min | -4,4% | 0,69 | 106 | -6,7% | 0,36 | 60 | -2,8% |
| movimento 0,3×vol (livello 0,375×vol), finestra 30 min, stop 2 unità, ordine valido 15 min | -4,4% | 0,55 | 102 | -5,1% | 0,37 | 68 | -3,4% |
| movimento 0,3×vol (livello 0,375×vol), finestra 30 min, stop 2 unità, ordine valido 5 min | -4,5% | 0,54 | 97 | -5,2% | 0,37 | 66 | -3,4% |
| movimento 1% (livello 1,25%), finestra 15 min, stop 2 unità, ordine valido 5 min | -4,6% | 0,68 | 104 | -5,5% | 0,40 | 58 | -2,8% |
| movimento 0,3×vol (livello 0,375×vol), finestra 30 min, stop 2 unità, ordine valido 30 min | -4,7% | 0,54 | 104 | -5,1% | 0,37 | 68 | -3,4% |
| movimento 1% (livello 1,25%), finestra 15 min, stop 1 unità, ordine valido 15 min | -5,2% | 0,61 | 106 | -7,4% | 0,27 | 59 | -4,3% |
| movimento 1% (livello 1,25%), finestra 15 min, stop 1 unità, ordine valido 30 min | -5,2% | 0,61 | 106 | -7,8% | 0,26 | 60 | -4,3% |

## La variante scelta sul 70%
Variante: **movimento 1% (livello 1,25%), finestra 15 min, stop 2 unità, ordine valido 15 min**.

| Slittamento in uscita | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | -3,4% | -5,3% | 0,44 | 5,9% | -1,1% | 59 | -0,298% |
| 0,05% | 3x | composto | -3,4% | -5,2% | 0,43 | 5,7% | -1,1% | 59 | -0,298% |
| 0,05% | 5x | fissa | -5,7% | -8,8% | 0,44 | 9,8% | -1,9% | 59 | -0,298% |
| 0,05% | 5x | composto | -5,7% | -8,5% | 0,43 | 9,4% | -1,9% | 59 | -0,298% |
| 0,08% | 3x | fissa | -4,4% | -5,8% | 0,39 | 6,3% | -1,2% | 59 | -0,328% |
| 0,08% | 3x | composto | -4,4% | -5,7% | 0,39 | 6,2% | -1,1% | 59 | -0,328% |
| 0,08% | 5x | fissa | -7,3% | -9,7% | 0,39 | 10,6% | -2,0% | 59 | -0,328% |
| 0,08% | 5x | composto | -7,2% | -9,3% | 0,38 | 10,1% | -1,9% | 59 | -0,328% |

Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%): 2023 -3,5% (18 oper., PF 0,06) · 2024 0,9% (41 oper., PF 1,30) · 2025 -4,5% (62 oper., PF 0,59) · 2026 -3,1% (44 oper., PF 0,48).

Esecuzione: nel 70% 106 eseguiti su 111 segnali (95%), nel 30% 59 su 60 (98%). Ipotetico lordo degli eseguiti -0,099% contro 0,982% dei persi (30%). Esecuzione in media 1,4 minuti dopo il segnale.

| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Long | 33 | 0,364% | 0,203% | 1,59 | 32 | -0,008% | -0,168% | 0,59 |
| Short | 73 | -0,132% | -0,292% | 0,41 | 27 | -0,356% | -0,519% | 0,25 |
| BTC | 38 | 0,024% | -0,136% | 0,61 | 16 | -0,029% | -0,189% | 0,49 |
| ETH | 68 | 0,022% | -0,139% | 0,72 | 43 | -0,218% | -0,380% | 0,37 |
| Giorni feriali | 98 | 0,100% | -0,060% | 0,85 | 57 | -0,188% | -0,349% | 0,37 |
| Weekend | 8 | -0,930% | -1,089% | 0,05 | 2 | 0,427% | 0,267% | – |

## Le regole Attuali di Wisi Trade (movimento 1%, finestra 30 min, stop 1,5) con ordine valido 15 minuti
Variante: **movimento 1% (livello 1,25%), finestra 30 min, stop 1,5 unità, ordine valido 15 min**.

| Slittamento in uscita | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | -20,4% | -10,5% | 0,40 | 10,7% | -1,1% | 117 | -0,299% |
| 0,05% | 3x | composto | -18,6% | -10,0% | 0,40 | 10,2% | -1,0% | 117 | -0,299% |
| 0,05% | 5x | fissa | -34,0% | -17,5% | 0,40 | 17,9% | -2,0% | 117 | -0,299% |
| 0,05% | 5x | composto | -29,1% | -16,2% | 0,40 | 16,5% | -1,7% | 117 | -0,299% |
| 0,08% | 3x | fissa | -22,6% | -11,6% | 0,36 | 11,7% | -1,1% | 117 | -0,329% |
| 0,08% | 3x | composto | -20,4% | -11,0% | 0,35 | 11,1% | -1,0% | 117 | -0,329% |
| 0,08% | 5x | fissa | -37,7% | -19,3% | 0,36 | 19,6% | -2,0% | 117 | -0,329% |
| 0,08% | 5x | composto | -31,7% | -17,7% | 0,35 | 17,9% | -1,7% | 117 | -0,329% |

Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%): 2023 -6,4% (39 oper., PF 0,08) · 2024 -7,9% (103 oper., PF 0,43) · 2025 -14,4% (145 oper., PF 0,43) · 2026 -5,6% (77 oper., PF 0,43).

Esecuzione: nel 70% 247 eseguiti su 268 segnali (92%), nel 30% 117 su 127 (92%). Ipotetico lordo degli eseguiti -0,118% contro 0,887% dei persi (30%). Esecuzione in media 1,3 minuti dopo il segnale.

| Gruppo | Oper. 70% | Lordo 70% | Netto 70% | PF 70% | Oper. 30% | Lordo 30% | Netto 30% | PF 30% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Long | 93 | -0,043% | -0,203% | 0,57 | 56 | -0,004% | -0,164% | 0,55 |
| Short | 154 | -0,208% | -0,367% | 0,31 | 61 | -0,320% | -0,481% | 0,25 |
| BTC | 85 | -0,072% | -0,232% | 0,42 | 33 | -0,058% | -0,218% | 0,40 |
| ETH | 162 | -0,184% | -0,344% | 0,40 | 84 | -0,212% | -0,373% | 0,35 |
| Giorni feriali | 228 | -0,101% | -0,261% | 0,45 | 112 | -0,127% | -0,288% | 0,39 |
| Weekend | 19 | -0,674% | -0,834% | 0,11 | 5 | -1,100% | -1,260% | 0,07 |

## Limiti
- Solo 2 monete: pochi segnali al giorno, quindi molte meno operazioni che negli altri test; i numeri oscillano di più.
- L'esecuzione dell'ordine limite è stimata dalle candele da 1 minuto di Binance; su Bitunix la coda degli ordini e la profondità del book decidono se e quando si viene eseguiti. Il margine dello 0,05% serve a non contare come eseguiti i semplici tocchi.
- Le commissioni maker e taker sono quelle VIP 0 di oggi; possono cambiare.

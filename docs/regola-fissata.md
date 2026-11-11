# Regola fissata: grande movimento

Scritta il 2026-11-11, **prima** di qualunque test su dati nuovi. Script: `research/07-fissa-regola.js` (legge solo i dati fino al 2025-09-13). Dati: `data/backtest/regola/regola.json`.

## La regola (non si cambia più)
- **Monete**: solo altcoin (tutte tranne BTC ed ETH).
- **Segnale**: alla chiusura di un minuto, il rendimento degli ultimi **15 minuti oppure degli ultimi 60 minuti** supera **12 volte** il movimento normale della moneta su quella finestra. Movimento normale = scarto quadratico dei rendimenti a 15 (o 60) minuti dei 14 giorni precedenti, aggiornato una volta al giorno. Se le due finestre scattano insieme in direzioni opposte, nessun segnale.
- **Direzione**: si segue il movimento (salita → long, discesa → short). Nessuna conferma.
- **Entrata**: a mercato all'apertura del minuto successivo.
- **Uscite (Wisi Trade, configurazione Attuale)**: unità = ATR (Wilder 14) delle candele da 15 minuti chiuse prima dell'entrata; stop loss a 1,5 unità; da +0,5 unità di guadagno l'uscita è la migliore tra lo stop loss, lo stop che segue a 1 unità dal miglior prezzo e la protezione del guadagno (si esce restituendo il 40% del guadagno massimo). Durata massima 4 ore, poi chiusura all'apertura del minuto.
- **Pausa**: dopo un segnale la moneta non ne apre un altro per 4 ore e comunque non prima che la posizione sia chiusa.
- **Capitale**: 10.000 USDT, 10 posizioni al massimo, margine 10% (dimensione fissa o interesse composto), leva 3x (e 5x come variante), margine isolato, freno 8% sulla perdita del giorno chiusa + aperta (chiude tutto, niente entrate fino al giorno UTC dopo). Segnali nello stesso minuto in ordine casuale (media di 10 ordini).
- **Costi**: commissione 0,06% per lato, slittamento 0,05% / 0,08% / 0,12% per lato (minimo 0,08% sulle monete dalla 15ª in poi), funding reale di Binance.

## Come è stata scelta (solo sul primo 70%)
Criteri decisi prima di guardare i numeri. Base: segui, oltre 8×, finestre 15 e 60 minuti insieme (scelta di progetto: non si sceglie la finestra sui dati), nessuna conferma. Il 70% (dal 2023-01-01 al 2025-09-13) è diviso in due metà (dal 2024-05-08).
1. **Solo altcoin** entra se, con 8×, migliora sia il rendimento del portafoglio sia il lordo medio per operazione **in entrambe le metà**.
2. **10× o 12×** sostituisce 8× se migliora entrambe le misure in entrambe le metà e ha almeno 300 operazioni; se si qualificano entrambe, quella con il rendimento più alto.

**Decisioni:**
- Solo altcoin con 8×: migliora in entrambe le metà → entra nella regola.
- 10× contro 8× (solo altcoin): migliora in entrambe le metà con almeno 300 operazioni.
- 12× contro 8× (solo altcoin): migliora in entrambe le metà con almeno 300 operazioni.
- Soglia scelta: **12×**.

Portafoglio: dimensione fissa, leva 3x, slittamento 0,08%. Lordo e netto sulle singole operazioni.

| Finestra (min) | Soglia | Monete | Oper. 70% | Lordo 70% | Netto 70% | Portafoglio 70% | PF | Peggior calo | Lordo 1ª metà | Portafoglio 1ª metà | Lordo 2ª metà | Portafoglio 2ª metà |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 15 e 60 insieme | 8× | tutte | 4.032 | 0,367% | 0,088% | 35,0% | 1,06 | 28,7% | 0,446% | 58,0% | 0,284% | -23,3% |
| 15 e 60 insieme | 8× | solo altcoin | 3.711 | 0,389% | 0,110% | 49,9% | 1,08 | 24,7% | 0,480% | 70,1% | 0,296% | -16,2% |
| 15 e 60 insieme | 10× | tutte | 2.259 | 0,590% | 0,310% | 122,6% | 1,34 | 11,5% | 0,684% | 108,1% | 0,476% | 14,1% |
| 15 e 60 insieme | 10× | solo altcoin | 2.091 | 0,617% | 0,338% | 128,1% | 1,37 | 11,5% | 0,719% | 111,5% | 0,494% | 17,9% |
| 15 e 60 insieme | 12× | tutte | 1.480 | 0,780% | 0,500% | 131,4% | 1,53 | 8,6% | 0,809% | 86,7% | 0,740% | 44,3% |
| 15 e 60 insieme | 12× | solo altcoin | 1.366 | 0,828% | 0,548% | 141,7% | 1,62 | 7,0% | 0,853% | 94,5% | 0,793% | 51,1% |
| 15 (solo informazione) | 8× | tutte | 3.946 | 0,383% | 0,103% | 48,6% | 1,08 | 27,5% | 0,460% | 64,4% | 0,300% | -11,3% |
| 15 (solo informazione) | 8× | solo altcoin | 3.629 | 0,406% | 0,126% | 65,8% | 1,12 | 24,1% | 0,495% | 76,7% | 0,313% | -5,1% |
| 15 (solo informazione) | 10× | tutte | 2.221 | 0,593% | 0,313% | 118,4% | 1,33 | 11,7% | 0,694% | 108,7% | 0,469% | 7,8% |
| 15 (solo informazione) | 10× | solo altcoin | 2.055 | 0,620% | 0,341% | 122,0% | 1,36 | 12,0% | 0,730% | 110,2% | 0,486% | 12,6% |
| 15 (solo informazione) | 12× | tutte | 1.461 | 0,797% | 0,517% | 134,9% | 1,57 | 8,6% | 0,831% | 89,4% | 0,749% | 45,7% |
| 15 (solo informazione) | 12× | solo altcoin | 1.348 | 0,847% | 0,567% | 146,2% | 1,67 | 6,8% | 0,877% | 97,9% | 0,804% | 50,5% |
| 60 (solo informazione) | 8× | tutte | 1.755 | 0,565% | 0,285% | 83,3% | 1,26 | 15,2% | 0,719% | 77,5% | 0,396% | 4,3% |
| 60 (solo informazione) | 8× | solo altcoin | 1.623 | 0,594% | 0,315% | 83,3% | 1,27 | 14,6% | 0,750% | 75,7% | 0,422% | 10,0% |
| 60 (solo informazione) | 10× | tutte | 1.014 | 0,710% | 0,431% | 82,8% | 1,40 | 18,6% | 1,045% | 95,1% | 0,257% | -14,5% |
| 60 (solo informazione) | 10× | solo altcoin | 943 | 0,722% | 0,443% | 75,3% | 1,37 | 21,5% | 1,071% | 93,7% | 0,239% | -11,4% |
| 60 (solo informazione) | 12× | tutte | 640 | 0,655% | 0,376% | 59,0% | 1,43 | 16,3% | 1,126% | 72,0% | -0,142% | -10,1% |
| 60 (solo informazione) | 12× | solo altcoin | 594 | 0,666% | 0,387% | 62,3% | 1,48 | 14,4% | 1,154% | 72,7% | -0,156% | -9,1% |

## Come sarà verificata (deciso adesso)
Su dati mai usati, una sola volta, senza cambiare la regola:
- **A**: le stesse 50 monete dal primo giorno disponibile al 31/12/2022 (quelle che esistevano);
- **B**: le monete dalla 51ª alla 100ª di `docs/universo.md`, dal 2023 a oggi;
- **A + B insieme**, come un unico portafoglio.

**La regola regge** se su A + B, con dimensione fissa, leva 3x e slittamento 0,08%:
1. il rendimento è positivo e il profit factor almeno 1,10;
2. il lordo medio per operazione è almeno 0,30% (sopra il costo di circa 0,28% andata e ritorno);
3. è in utile sia su A sia su B presi da soli;
4. con slittamento 0,12% non è in perdita.

**Regge in parte** se valgono 1 e 2 ma non 3 o 4. Altrimenti **non regge**.

Da ricordare: anche le monete dei dati nuovi sono scelte con la liquidità di oggi (chi è sparito non c'è), e questo favorisce il passato.

# Backtest "apertura di sessione"

Aggiornato il 2026-11-11. Script: `research/04-apertura-sessione.js`, motore in `research/motore/`. Risultati completi: `data/backtest/apertura/risultati.json`.

<!-- conclusione:inizio -->
## Conclusione
**No: nessuna variante regge sul 30% di verifica.** Con queste regole la strategia "apertura di sessione" sulle crypto non va portata in Fase 1.

**Perché.** Il movimento dall'apertura di sessione tende a continuare, ma troppo poco. In media un'operazione guadagna tra +0,05% e +0,3% prima dei costi. Un'operazione completa costa però 0,22–0,28% (commissioni e slittamento, entrata e uscita). Quasi tutte le combinazioni di sessione, versione e gruppo di monete restano in perdita dopo i costi (tabella "Prima dei costi"). Più operazioni fa una variante, più perde: la soglia percentuale fissa, che entra spesso sulle monete piccole, perde quasi tutto il capitale già nel 70%.

**Le varianti scelte sul 70%:**
- **00:00 UTC, USA e tutte e tre insieme**: nel 70% guadagnavano (+28%, +92%, +64%), nel 30% perdono (-92%, -34%, -100%). Con dimensione fissa il capitale va a zero in due casi su tre.
- **Europa (08:00 Londra)**: è l'unica in utile nel 30% (+22%, profit factor 1,37, 153 operazioni, peggior calo 12%). **Non la considero una regola che regge**, per quattro motivi:
  1. nel 70% guadagnava pochissimo (+4,8% in quasi 3 anni);
  2. nel 2024 era in perdita;
  3. la variante gemella con lo stop più largo perde il 17% nel 30%;
  4. delle 36 varianti a volatilità per l'Europa solo 13 sono in utile nel 30%, con mediana -7,8%.

  È più probabile che sia fortuna su poche operazioni.

**Cosa abbiamo imparato:**
- **L'unico indizio vero è l'apertura USA su BTC ed ETH.** Il lordo è +0,2–0,3% per operazione sia nel 70% sia nel 30%, l'unico gruppo stabile nei due periodi. Dopo i costi è però ancora in leggera perdita (-0,02%/-0,09% per operazione). Potrebbe diventare interessante solo con costi più bassi: entrate con ordini limite (commissione maker) o sconti sulle commissioni. Va verificato a parte, perché cambia le ipotesi di esecuzione.
- **Gli short vanno peggio dei long** in quasi tutte le scomposizioni, e i **weekend** peggio dei giorni feriali.
- **La versione a volatilità è nettamente migliore della percentuale fissa.** Con volatilità così diverse tra le monete, una soglia unica non ha senso.
- **Correlazione.** Le posizioni di una stessa apertura sono dalla stessa parte nel 93–99% dei casi: dieci posizioni sono in pratica una scommessa sola sulla direzione del mercato. Le aperture "a senso unico" con 5 o più posizioni hanno i risultati migliori in media ma anche i giorni peggiori (fino al -21% del capitale in un'apertura).
- **I risultati long del passato sono gonfiati**, perché le 50 monete sono le più liquide di oggi, cioè quelle che sono salite. L'apertura USA nel 70% guadagnava +6,6% medio per operazione long: non è credibile come vantaggio stabile.

**Prossimo passo consigliato.** Passare alla strategia 2 ("grande movimento in qualsiasi momento, con conferma"), riusando il motore. Con un movimento più grande per operazione i costi pesano meno, e da qui sappiamo che serve almeno lo 0,5% medio lordo per operazione per restare in utile. In parallelo, se interessa, un test mirato su "apertura USA solo BTC ed ETH con entrata a ordine limite".
<!-- conclusione:fine -->

## Le regole
- **Sessioni**: 00:00 UTC (chiusura della candela giornaliera e Asia), 08:00 Londra (Europa), 9:30 New York (USA). L'ora legale è gestita con il fuso orario vero: Londra apre alle 07:00 UTC d'estate e alle 08:00 d'inverno, New York alle 13:30 o 14:30 UTC. Tutti i giorni, weekend compresi (le crypto non chiudono).
- **Riferimento**: il prezzo d'apertura del primo minuto della sessione.
- **Entrata**: se durante la finestra d'entrata (3, 15 o 30 minuti) il prezzo si allontana dal riferimento della soglia, si entra nella direzione del movimento (sopra = long, sotto = short). Una sola entrata per moneta e per sessione. L'entrata conta solo se il prezzo supera il livello di almeno **0,15%**; il prezzo d'entrata è il livello (o l'apertura del minuto, se il prezzo ci è saltato oltre).
- **Uscite** (uguali per tutte le varianti; R = distanza dello stop iniziale):
  - stop iniziale a 1R;
  - protezione del guadagno: quando il guadagno arriva a +1R, lo stop sale a +0,3% (copre i costi);
  - stop che segue: da +1,5R lo stop segue il miglior prezzo a 1R di distanza;
  - durata massima: si chiude all'apertura della sessione successiva (00 → Europa, Europa → USA, USA → 00 del giorno dopo), al prezzo d'apertura di quel minuto con slittamento.
- **Due versioni di soglia e stop**: percentuale fissa (soglie 0,5/1/1,5/2%, stop 1/2/3%) e multiplo della volatilità della moneta (soglie 0,1/0,2/0,3/0,4 × vol, stop 0,25/0,5/0,75 × vol). La volatilità è la media dell'escursione giornaliera degli ultimi 14 giorni già chiusi (per BTC di solito 2–3%, per le monete piccole 6–12%).
- **Griglia**: 2 versioni × 4 soglie × 3 finestre × 3 stop = **72 varianti** per ogni sessione.

## Il metodo
- **Dati**: candele da 1 minuto di Binance delle 50 crypto di `docs/universo.md`, dal 2023-01-01 al 2026-11-10 (o dalla quotazione). Nessun dato futuro: la volatilità usa solo giorni chiusi, l'entrata solo prezzi già visti.
- **Dentro il minuto**: candela in salita apertura→minimo→massimo→chiusura, in discesa apertura→massimo→minimo→chiusura (lo stop viene toccato prima del guadagno). Se il minuto apre già oltre lo stop, si esce all'apertura.
- **Fermi di Binance** (vedi `docs/storico.md`): minuti senza prezzo, niente entrate né uscite in quei minuti.
- **Costi**: commissione 0,06% per lato; slittamento 0,05% e 0,08% per lato, con minimo 0,08% sulle monete dalla 15ª in poi; funding reale di Binance pagato o incassato a ogni orario di pagamento in cui la posizione è aperta.
- **Capitale**: 10.000 USDT, 10 posizioni al massimo, margine 10% per posizione, leva 3x e 5x (quindi ogni posizione vale 3.000 o 5.000 USDT con dimensione fissa), margine isolato (perdita massima = il margine). **Freno giornaliero**: se le perdite chiuse del giorno UTC arrivano all'8% del capitale d'inizio giornata, niente nuove entrate fino al giorno dopo. Con **dimensione fissa** il margine è sempre il 10% del capitale iniziale; con **interesse composto** il 10% del capitale del momento.
- **Segnali simultanei**: quando nello stesso minuto ci sono più segnali che posti liberi, l'ordine è casuale; ogni risultato di portafoglio è la **media di 10 ordini casuali**. Le uscite di un minuto liberano i posti prima delle entrate dello stesso minuto.
- **70/30**: regole scelte sul periodo dal 2023-01-01 al 2025-09-13 (70%), verificate dal 2025-09-14 al 2026-11-10 (30%) senza cambiarle. Criterio di scelta: il miglior rendimento nel 70% con dimensione fissa, leva 3x, slittamento 0,08%, almeno 100 operazioni.
- **Come leggere le misure**: rendimento sul capitale iniziale; profit factor = guadagni / perdite (sopra 1 si guadagna); peggior calo = massima discesa del capitale dal suo massimo (sulle operazioni chiuse); giorno peggiore = peggior giorno UTC in % del capitale; medio netto = guadagno medio per operazione in % del valore della posizione, costi compresi.

## Prima dei costi: c'è un vantaggio?
Media di tutte le operazioni di tutte le 36 varianti di ogni versione (senza limiti di posti né capitale), in % del valore della posizione. "Lordo" è il movimento a favore prima di commissioni, slittamento e funding. Costo di un'operazione andata e ritorno: 0,22% con slittamento 0,05%, 0,28% con 0,08%.

| Sessione | Versione | Monete | Oper. 70% | Lordo 70% | Lordo 30% | Netto 30% (slitt. 0,05%*) | Netto 30% (slitt. 0,08%) |
|---|---|---|---:|---:|---:|---:|---:|
| 00:00 UTC | percentuale | BTC ed ETH | 1.956 | 0,154% | -0,024% | -0,244% | -0,304% |
| 00:00 UTC | percentuale | dalla 3ª alla 14ª | 49.476 | 0,057% | 0,166% | -0,054% | -0,114% |
| 00:00 UTC | percentuale | dalla 15ª in poi | 99.783 | 0,073% | 0,155% | -0,125% | -0,125% |
| 00:00 UTC | volatilità | BTC ed ETH | 2.184 | -0,017% | -0,089% | -0,308% | -0,368% |
| 00:00 UTC | volatilità | dalla 3ª alla 14ª | 20.952 | 0,053% | 0,201% | -0,019% | -0,078% |
| 00:00 UTC | volatilità | dalla 15ª in poi | 41.373 | 0,169% | 0,007% | -0,274% | -0,274% |
| 08:00 Londra | percentuale | BTC ed ETH | 1.551 | 0,254% | -0,135% | -0,355% | -0,415% |
| 08:00 Londra | percentuale | dalla 3ª alla 14ª | 36.630 | 0,169% | 0,052% | -0,168% | -0,228% |
| 08:00 Londra | percentuale | dalla 15ª in poi | 76.017 | 0,169% | 0,109% | -0,171% | -0,171% |
| 08:00 Londra | volatilità | BTC ed ETH | 1.638 | 0,266% | -0,042% | -0,262% | -0,322% |
| 08:00 Londra | volatilità | dalla 3ª alla 14ª | 14.925 | 0,159% | 0,028% | -0,193% | -0,253% |
| 08:00 Londra | volatilità | dalla 15ª in poi | 29.844 | 0,083% | 0,119% | -0,167% | -0,167% |
| 9:30 New York | percentuale | BTC ed ETH | 6.129 | 0,225% | 0,186% | -0,034% | -0,094% |
| 9:30 New York | percentuale | dalla 3ª alla 14ª | 68.145 | 0,179% | 0,053% | -0,168% | -0,228% |
| 9:30 New York | percentuale | dalla 15ª in poi | 129.528 | 0,160% | 0,046% | -0,235% | -0,235% |
| 9:30 New York | volatilità | BTC ed ETH | 7.080 | 0,275% | 0,205% | -0,015% | -0,075% |
| 9:30 New York | volatilità | dalla 3ª alla 14ª | 34.365 | 0,321% | -0,013% | -0,234% | -0,294% |
| 9:30 New York | volatilità | dalla 15ª in poi | 63.006 | 0,311% | 0,034% | -0,249% | -0,249% |

* dalla 15ª moneta in poi lo slittamento è comunque 0,08%.

## Le varianti scelte sul 70% e la verifica sul 30%
Configurazione di riferimento: dimensione fissa, leva 3x, slittamento 0,08%. "Rovina" = il capitale è arrivato a zero e la simulazione si è fermata lì: le misure contano solo le operazioni fino a quel momento.

| Sessione | Variante scelta | Periodo | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---|---|---:|---:|---:|---:|---:|---:|
| 00:00 UTC | volatilità: soglia 0,1×vol, finestra 3 min, stop 0,75×vol | 70% scelta | 28,0% | 1,09 | 51,3% | -24,1% | 620 | 0,151% |
| | | **30% verifica** | **-91,5% (rovina)** | **0,74** | 100% (rovina) | oltre -100% (rovina) | 509 | -0,606% |
| Europa 08:00 Londra | volatilità: soglia 0,3×vol, finestra 15 min, stop 0,25×vol | 70% scelta | 4,8% | 1,12 | 11,7% | -2,2% | 157 | 0,101% |
| | | **30% verifica** | **22,1%** | **1,37** | 12,4% | -6,1% | 153 | 0,481% |
| USA 9:30 New York | volatilità: soglia 0,2×vol, finestra 3 min, stop 0,75×vol | 70% scelta | 91,5% | 2,46 | 13,5% | -6,3% | 127 | 2,411% |
| | | **30% verifica** | **-34,3%** | **0,75** | 49,1% | -12,1% | 188 | -0,609% |
| Tutte e tre insieme | volatilità: soglia 0,2×vol, finestra 3 min, stop 0,75×vol | 70% scelta | 64,1% | 1,46 | 32,5% | -19,1% | 252 | 0,848% |
| | | **30% verifica** | **-100,0% (rovina)** | **0,64** | 100% (rovina) | oltre -100% (rovina) | 369 | -0,908% |

## Quanto è solida la scelta: tutte le varianti
Se una regola funziona davvero, le varianti buone nel 70% dovrebbero restare buone nel 30%, e le varianti vicine dovrebbero dare risultati simili. Per ogni sessione e versione: quante delle 36 varianti guadagnano nel 70% e nel 30%, il rendimento mediano, e la correlazione di rango tra i risultati nei due periodi (1 = stesso ordine, 0 = nessun legame).

| Sessione | Versione | In utile nel 70% | In utile nel 30% | Mediana 70% | Mediana 30% | Migliore 30% | Correlazione 70↔30 |
|---|---|---:|---:|---:|---:|---:|---:|
| 00:00 UTC | percentuale | 0/36 | 6/36 | -99,2% | -89,1% | 42,0% | 0,79 |
| 00:00 UTC | volatilità | 7/36 | 1/36 | -5,6% | -66,2% | 9,9% | 0,67 |
| Europa 08:00 Londra | percentuale | 0/36 | 2/36 | -64,4% | -99,8% | 9,7% | 0,82 |
| Europa 08:00 Londra | volatilità | 5/36 | 13/36 | -10,2% | -7,8% | 31,8% | 0,52 |
| USA 9:30 New York | percentuale | 5/36 | 2/36 | -100,0% | -99,8% | 6,9% | 0,77 |
| USA 9:30 New York | volatilità | 16/36 | 3/36 | -11,9% | -45,3% | 17,5% | 0,64 |
| Tutte e tre insieme | percentuale | 2/36 | 2/36 | -100,0% | -100,0% | 50,1% | 0,84 |
| Tutte e tre insieme | volatilità | 14/36 | 2/36 | -90,8% | -100,0% | 17,0% | 0,69 |

### Le 5 migliori nel 70%, per sessione, e come sono andate nel 30%

**00:00 UTC**

| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% |
|---|---:|---:|---:|---:|---:|---:|
| vol: soglia 0,1×vol, finestra 3 min, stop 0,75×vol | 28,0% | 1,09 | 620 | -91,5% (rovina) | 0,74 | 509 |
| vol: soglia 0,1×vol, finestra 3 min, stop 0,5×vol | 27,0% | 1,10 | 620 | -53,3% | 0,84 | 543 |
| vol: soglia 0,1×vol, finestra 3 min, stop 0,25×vol | 24,8% | 1,13 | 620 | -41,7% | 0,80 | 545 |
| vol: soglia 0,4×vol, finestra 15 min, stop 0,75×vol | 14,8% | 1,34 | 116 | -44,9% | 0,66 | 135 |
| vol: soglia 0,4×vol, finestra 15 min, stop 0,25×vol | 4,5% | 1,12 | 118 | -7,5% | 0,88 | 142 |

**Europa 08:00 Londra**

| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% |
|---|---:|---:|---:|---:|---:|---:|
| vol: soglia 0,3×vol, finestra 15 min, stop 0,25×vol | 4,8% | 1,12 | 157 | 22,1% | 1,37 | 153 |
| vol: soglia 0,3×vol, finestra 15 min, stop 0,75×vol | 1,7% | 1,03 | 153 | -17,0% | 0,87 | 151 |
| vol: soglia 0,1×vol, finestra 3 min, stop 0,75×vol | 0,6% | 1,00 | 328 | -100,0% (rovina) | 0,52 | 284 |
| %: soglia 1%, finestra 3 min, stop 3% | -0,2% | 1,00 | 291 | -100,0% (rovina) | 0,58 | 472 |
| %: soglia 2%, finestra 15 min, stop 1% | -0,2% | 1,00 | 396 | -13,6% | 0,90 | 766 |

**USA 9:30 New York**

| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% |
|---|---:|---:|---:|---:|---:|---:|
| vol: soglia 0,2×vol, finestra 3 min, stop 0,75×vol | 91,5% | 2,46 | 127 | -34,3% | 0,75 | 188 |
| vol: soglia 0,3×vol, finestra 15 min, stop 0,75×vol | 60,0% | 1,28 | 412 | -1,4% | 0,99 | 383 |
| vol: soglia 0,2×vol, finestra 3 min, stop 0,5×vol | 50,5% | 1,76 | 127 | -22,2% | 0,80 | 188 |
| %: soglia 1,5%, finestra 3 min, stop 3% | 39,3% | 1,49 | 174 | -6,9% | 0,96 | 353 |
| vol: soglia 0,2×vol, finestra 15 min, stop 0,75×vol | 30,5% | 1,05 | 1.208 | -100,0% (rovina) | 0,76 | 803 |

**Tutte e tre insieme**

| Variante | Rend. 70% | PF 70% | Oper. 70% | Rend. 30% | PF 30% | Oper. 30% |
|---|---:|---:|---:|---:|---:|---:|
| vol: soglia 0,2×vol, finestra 3 min, stop 0,75×vol | 64,1% | 1,46 | 252 | -100,0% (rovina) | 0,64 | 369 |
| vol: soglia 0,3×vol, finestra 15 min, stop 0,75×vol | 54,6% | 1,14 | 817 | -100,0% (rovina) | 0,73 | 523 |
| vol: soglia 0,2×vol, finestra 3 min, stop 0,5×vol | 37,8% | 1,29 | 252 | -39,8% | 0,84 | 381 |
| %: soglia 2%, finestra 3 min, stop 3% | 37,0% | 1,32 | 233 | -42,0% | 0,86 | 612 |
| vol: soglia 0,4×vol, finestra 15 min, stop 0,75×vol | 28,8% | 1,16 | 372 | -78,1% (rovina) | 0,74 | 337 |

## Dettaglio: 00:00 UTC
Variante: **volatilità, soglia 0,1×vol, finestra 3 min, stop 0,75×vol**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 31,3% | -90,6% (rovina) | 0,74 | 100% (rovina) | oltre -100% (rovina) | 509 | -0,600% |
| 0,05% | 3x | composto | 9,5% | -56,7% | 0,77 | 68,4% | -15,5% | 542 | -0,401% |
| 0,05% | 5x | fissa | 51,5% | -100,0% (rovina) | 0,69 | 100% (rovina) | oltre -100% (rovina) | 365 | -0,620% |
| 0,05% | 5x | composto | -7,0% | -78,3% | 0,75 | 86,2% | -25,8% | 542 | -0,387% |
| 0,08% | 3x | fissa | 28,0% | -91,5% (rovina) | 0,74 | 100% (rovina) | oltre -100% (rovina) | 509 | -0,606% |
| 0,08% | 3x | composto | 6,0% | -57,1% | 0,77 | 68,7% | -15,5% | 542 | -0,407% |
| 0,08% | 5x | fissa | 46,1% | -100,0% (rovina) | 0,69 | 100% (rovina) | oltre -100% (rovina) | 365 | -0,626% |
| 0,08% | 5x | composto | -11,9% | -78,6% | 0,75 | 86,4% | -25,8% | 542 | -0,393% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | 7,3% | 1,10 | 22,4% | -7,9% | 184 | 0,132% |
| 2024 | -23,5% | 0,81 | 35,2% | -9,2% | 238 | -0,329% |
| 2025 | 27,5% | 1,15 | 27,5% | -20,5% | 315 | 0,291% |
| 2026 (fino al 11-10) | -54,4% | 0,82 | 91,7% | -54,7% | 426 | -0,426% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Medio netto 70% | PF 70% | Oper. 30% | Medio netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|
| Long | 285 | -0,154% | 0,91 | 325 | -0,142% | 0,93 | 46% |
| Short | 468 | 0,333% | 1,19 | 322 | -0,288% | 0,86 | 53% |
| Giorni feriali | 608 | 0,309% | 1,18 | 463 | -0,316% | 0,84 | 52% |
| Weekend | 145 | -0,526% | 0,72 | 184 | 0,040% | 1,02 | 41% |
| BTC ed ETH | 14 | -0,726% | 0,35 | 14 | -0,106% | 0,71 | 43% |
| Le altre 48 | 739 | 0,165% | 1,10 | 633 | -0,217% | 0,90 | 49% |
| Entrata nei primi 3 minuti | 753 | 0,148% | 1,09 | 647 | -0,215% | 0,90 | 49% |
| Entrata dal 4° minuto in poi | 0 | – | – | 0 | – | – | – |

Uscite: durata massima 76%, stop iniziale 13%, stop che segue 9%, protezione del guadagno 2%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 604 aperture di sessione con almeno una posizione, in media 1,9 posizioni per apertura. In media il **93%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato già aperte (compresa la nuova): 1: 60% · 2: 17% · 3: 7% · 4: 4% · 5: 3% · 6: 2% · 7: 2% · 8: 2% · 9: 2% · 10: 1%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **34**, in utile 18, risultato medio 1,12% del capitale, la peggiore -20,94%. Le altre: 570, in utile 260, risultato medio -0,15%.

## Dettaglio: Europa 08:00 Londra
Variante: **volatilità, soglia 0,3×vol, finestra 15 min, stop 0,25×vol**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 5,9% | 22,5% | 1,38 | 12,2% | -6,0% | 153 | 0,489% |
| 0,05% | 3x | composto | 5,2% | 22,9% | 1,33 | 14,0% | -7,1% | 153 | 0,489% |
| 0,05% | 5x | fissa | 9,8% | 37,4% | 1,38 | 18,3% | -9,0% | 153 | 0,489% |
| 0,05% | 5x | composto | 7,9% | 38,2% | 1,30 | 22,5% | -11,8% | 153 | 0,489% |
| 0,08% | 3x | fissa | 4,8% | 22,1% | 1,37 | 12,4% | -6,1% | 153 | 0,481% |
| 0,08% | 3x | composto | 4,0% | 22,4% | 1,32 | 14,2% | -7,2% | 153 | 0,481% |
| 0,08% | 5x | fissa | 7,9% | 36,8% | 1,37 | 18,5% | -9,1% | 153 | 0,481% |
| 0,08% | 5x | composto | 5,9% | 37,3% | 1,30 | 22,8% | -11,9% | 153 | 0,481% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | 0,9% | 1,10 | 6,2% | -1,2% | 46 | 0,069% |
| 2024 | -5,5% | 0,68 | 7,0% | -2,0% | 62 | -0,298% |
| 2025 | 18,2% | 2,15 | 4,6% | -1,5% | 68 | 0,893% |
| 2026 (fino al 11-10) | 13,3% | 1,24 | 13,4% | -6,5% | 134 | 0,331% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Medio netto 70% | PF 70% | Oper. 30% | Medio netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|
| Long | 98 | 0,399% | 1,50 | 78 | 0,580% | 1,45 | 51% |
| Short | 87 | -0,243% | 0,69 | 78 | 0,282% | 1,21 | 46% |
| Giorni feriali | 161 | 0,167% | 1,22 | 111 | 0,763% | 1,55 | 50% |
| Weekend | 24 | -0,377% | 0,65 | 45 | -0,389% | 0,67 | 47% |
| BTC ed ETH | 10 | 0,254% | 2,14 | 2 | -0,167% | 0,58 | 50% |
| Le altre 48 | 175 | 0,088% | 1,11 | 154 | 0,439% | 1,33 | 49% |
| Entrata nei primi 3 minuti | 11 | -0,662% | 0,45 | 31 | 2,169% | 3,10 | 68% |
| Entrata dal 4° minuto in poi | 174 | 0,145% | 1,19 | 125 | -0,000% | 1,00 | 44% |

Uscite: stop iniziale 40%, stop che segue 35%, protezione del guadagno 20%, durata massima 5%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 204 aperture di sessione con almeno una posizione, in media 1,5 posizioni per apertura. In media il **97%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato già aperte (compresa la nuova): 1: 69% · 2: 8% · 3: 5% · 4: 3% · 5: 3% · 6: 2% · 7: 2% · 8: 2% · 9: 2% · 10: 2%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **9**, in utile 4, risultato medio 0,23% del capitale, la peggiore -7,24%. Le altre: 195, in utile 94, risultato medio 0,13%.

## Dettaglio: USA 9:30 New York
Variante: **volatilità, soglia 0,2×vol, finestra 3 min, stop 0,75×vol**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 92,6% | -33,4% | 0,75 | 48,6% | -11,9% | 188 | -0,593% |
| 0,05% | 3x | composto | 110,2% | -32,6% | 0,75 | 46,7% | -9,1% | 188 | -0,593% |
| 0,05% | 5x | fissa | 154,3% | -58,3% | 0,74 | 75,9% | -27,3% | 188 | -0,620% |
| 0,05% | 5x | composto | 196,6% | -52,6% | 0,74 | 68,1% | -15,2% | 188 | -0,620% |
| 0,08% | 3x | fissa | 91,5% | -34,3% | 0,75 | 49,1% | -12,1% | 188 | -0,609% |
| 0,08% | 3x | composto | 108,2% | -33,2% | 0,74 | 47,1% | -9,2% | 188 | -0,609% |
| 0,08% | 5x | fissa | 152,5% | -59,8% | 0,74 | 76,8% | -28,1% | 188 | -0,636% |
| 0,08% | 5x | composto | 191,8% | -53,3% | 0,74 | 68,5% | -15,3% | 188 | -0,636% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | -5,4% | 0,75 | 13,5% | -6,3% | 37 | -0,494% |
| 2024 | 30,2% | 2,82 | 4,7% | -4,3% | 33 | 3,051% |
| 2025 | 84,6% | 3,23 | 9,7% | -3,8% | 97 | 2,909% |
| 2026 (fino al 11-10) | -53,1% | 0,56 | 56,6% | -16,0% | 148 | -1,196% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Medio netto 70% | PF 70% | Oper. 30% | Medio netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|
| Long | 137 | 6,612% | 7,74 | 137 | 0,743% | 1,55 | 63% |
| Short | 53 | -1,342% | 0,38 | 79 | -2,111% | 0,38 | 28% |
| Giorni feriali | 175 | 4,764% | 4,69 | 197 | -0,341% | 0,84 | 49% |
| Weekend | 15 | 0,076% | 1,05 | 19 | 0,120% | 1,05 | 63% |
| BTC ed ETH | 18 | 1,607% | 3,49 | 9 | 0,181% | 1,34 | 56% |
| Le altre 48 | 172 | 4,685% | 4,40 | 207 | -0,322% | 0,85 | 50% |
| Entrata nei primi 3 minuti | 190 | 4,394% | 4,36 | 216 | -0,301% | 0,86 | 50% |
| Entrata dal 4° minuto in poi | 0 | – | – | 0 | – | – | – |

Uscite: durata massima 57%, stop iniziale 25%, stop che segue 14%, protezione del guadagno 4%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 161 aperture di sessione con almeno una posizione, in media 2,0 posizioni per apertura. In media il **99%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato già aperte (compresa la nuova): 1: 53% · 2: 11% · 3: 6% · 4: 5% · 5: 5% · 6: 4% · 7: 4% · 8: 4% · 9: 4% · 10: 3%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **16**, in utile 7, risultato medio 4,99% del capitale, la peggiore -10,54%. Le altre: 145, in utile 64, risultato medio -0,20%.

## Dettaglio: Tutte e tre insieme
Variante: **volatilità, soglia 0,2×vol, finestra 3 min, stop 0,75×vol**.

### Capitale: leva, slittamento, dimensione fissa e interesse composto
| Slittamento | Leva | Dimensione | Rend. 70% | Rend. 30% | PF 30% | Peggior calo 30% | Giorno peggiore 30% | Oper. 30% | Medio netto 30% |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0,05% | 3x | fissa | 65,8% | -98,6% (rovina) | 0,64 | 99,8% | oltre -100% (rovina) | 370 | -0,889% |
| 0,05% | 3x | composto | 55,6% | -63,7% | 0,72 | 72,4% | -9,8% | 380 | -0,803% |
| 0,05% | 5x | fissa | 109,6% | -100,0% (rovina) | 0,70 | 100% (rovina) | oltre -100% (rovina) | 317 | -0,641% |
| 0,05% | 5x | composto | 71,5% | -82,9% | 0,75 | 89,1% | -16,3% | 378 | -0,798% |
| 0,08% | 3x | fissa | 64,1% | -100,0% (rovina) | 0,64 | 100% (rovina) | oltre -100% (rovina) | 369 | -0,908% |
| 0,08% | 3x | composto | 53,0% | -64,2% | 0,71 | 72,7% | -9,9% | 380 | -0,815% |
| 0,08% | 5x | fissa | 106,8% | -100,0% (rovina) | 0,70 | 100% (rovina) | oltre -100% (rovina) | 316 | -0,643% |
| 0,08% | 5x | composto | 66,8% | -83,3% | 0,75 | 89,2% | -16,3% | 378 | -0,810% |

### Anno per anno (dimensione fissa, leva 3x, slittamento 0,08%; ogni anno riparte da 10.000 USDT)
| Anno | Rendimento | Profit factor | Peggior calo | Giorno peggiore | Operazioni | Medio netto |
|---|---:|---:|---:|---:|---:|---:|
| 2023 | -9,1% | 0,76 | 20,1% | -5,7% | 70 | -0,433% |
| 2024 | 11,5% | 1,24 | 19,3% | -5,1% | 74 | 0,519% |
| 2025 | 81,6% | 1,97 | 20,1% | -20,1% | 176 | 1,545% |
| 2026 (fino al 11-10) | -100,0% (rovina) | 0,52 | 100% (rovina) | oltre -100% (rovina) | 278 | -1,221% |

### Scomposizione sulle singole operazioni (slittamento 0,08%, senza limiti di posti)
| Gruppo | Oper. 70% | Medio netto 70% | PF 70% | Oper. 30% | Medio netto 30% | PF 30% | Vincenti 30% |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sessione 00:00 UTC (Asia, chiusura giornaliera) | 90 | -0,814% | 0,64 | 174 | -0,478% | 0,77 | 49% |
| Sessione 08:00 Londra (Europa) | 37 | -0,876% | 0,51 | 72 | -0,435% | 0,84 | 46% |
| Sessione 9:30 New York (USA) | 190 | 4,394% | 4,36 | 216 | -0,301% | 0,86 | 50% |
| Long | 212 | 3,903% | 3,86 | 236 | -0,157% | 0,92 | 54% |
| Short | 105 | -0,936% | 0,57 | 226 | -0,629% | 0,75 | 44% |
| Giorni feriali | 279 | 2,599% | 2,57 | 375 | -0,221% | 0,90 | 52% |
| Weekend | 38 | 0,105% | 1,07 | 87 | -1,110% | 0,53 | 34% |
| BTC ed ETH | 22 | 1,187% | 2,79 | 16 | -0,053% | 0,91 | 50% |
| Le altre 48 | 295 | 2,383% | 2,39 | 446 | -0,400% | 0,82 | 49% |
| Entrata nei primi 3 minuti | 317 | 2,300% | 2,41 | 462 | -0,388% | 0,82 | 49% |
| Entrata dal 4° minuto in poi | 0 | – | – | 0 | – | – | – |

Uscite: durata massima 58%, stop iniziale 21%, stop che segue 15%, protezione del guadagno 6%.

### Correlazione: quante posizioni dalla stessa parte (intero periodo, portafoglio reale)
- 404 aperture di sessione con almeno una posizione, in media 1,6 posizioni per apertura. In media il **99%** delle posizioni di un'apertura sono dalla stessa parte.
- Al momento di ogni entrata, posizioni dello stesso lato già aperte (compresa la nuova): 1: 66% · 2: 10% · 3: 4% · 4: 3% · 5: 3% · 6: 3% · 7: 3% · 8: 3% · 9: 2% · 10: 2%.
- Aperture "a senso unico" (almeno 5 posizioni, almeno l'80% dallo stesso lato): **21**, in utile 10, risultato medio 3,14% del capitale, la peggiore -20,05%. Le altre: 383, in utile 161, risultato medio -0,25%.

## Limiti di questo test
- Le 50 monete sono le più liquide **oggi**: quelle che nel frattempo sono sparite o crollate non ci sono. Questo tende a migliorare i risultati del passato (soprattutto per i long).
- Le monete quotate da poco (es. BTWUSDT, XAUTUSDT, JCTUSDT, IRYSUSDT) compaiono solo nel 30% finale.
- Il percorso dentro il minuto è una supposizione; le punte di Binance non sempre ci sono su Bitunix (per questo il margine dello 0,15% sulle entrate).
- Il freno giornaliero guarda solo le perdite chiuse, non quelle ancora aperte.
- Con 72 varianti × 4 gruppi, la migliore nel 70% è in parte fortuna: per questo conta più la tabella "tutte le varianti" del singolo numero migliore.

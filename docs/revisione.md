# Revisione indipendente del backtest "grande movimento"

Scritta il 2026-11-11 da un revisore che non ha scritto il codice. Lo scopo è cercare errori che fanno sembrare il risultato migliore di quanto sarebbe nella realtà, **non** giudicare la strategia. Per restare imparziale non ho letto i documenti con i risultati (`grande-movimento.md`, `regola-fissata.md`, `verifica-dati-nuovi.md`, `apertura-sessione.md`) né i risultati aggregati dei backtest. I numeri riportati qui sotto sono solo conteggi e **differenze** tra due modi di fare lo stesso conto, mai il rendimento della strategia.

Script della revisione, in `research/revisione/` (nessuno modifica il motore, 07 o 08):
- `rifai-operazioni.js`: rifà a mano 20 operazioni scelte a caso (seme 2026) e stampa motore contro conto mio.
- `rifai-tutte.js`: rigenera da zero **tutte** le 2.989 operazioni di 08 con codice scritto da me e misura quanto pesa l'ordine dei punti dentro la candela.
- `controlla-portafoglio.js`: rifà il conto del capitale (commissioni, slittamento, funding, leva, liquidazione) e conta alcuni casi limite dei posti.
- `prova-freno.js`: prova sintetica del freno giornaliero.
- `diagnosi-composto.js`: diagnosi di una differenza che alla fine era un errore **mio**, non del motore (vedi sotto).

I risultati dei controlli sono salvati in `data/revisione/` (esclusa da git).

## In breve
- **Il codice fa quello che dice.** Le 2.989 operazioni di 08 rifatte con codice indipendente coincidono: 2.987 identiche al centesimo di punto base, 2 diverse per un pareggio di arrotondamento (prezzo esattamente sul livello), in cui il motore è il più prudente. Nessun uso di dati futuri nel segnale, nel movimento normale, nell'unità, nel funding o nel freno.
- **Costi, slittamento e funding hanno il segno giusto**; il portafoglio coincide con il mio conto fino a 1e-15.
- **La regola è stata fissata prima di scaricare i dati nuovi** e 08 la applica senza cambiarla.
- Ci sono però **tre punti che possono gonfiare il risultato** e che non sono errori di programmazione ma scelte di modello: l'ordine dei punti dentro la candela da 1 minuto (grave), la scelta delle monete con i volumi di oggi (medio-grave), lo slittamento uguale per tutte le monete anche nei minuti più violenti (medio). Più alcuni punti piccoli.

## Cosa ho controllato e come

### 1. Dati futuri
| Controllo | Esito | Come |
|---|---|---|
| Segnale solo su candele chiuse | **passa** | `grandeMovimento.js:92-105` usa `C[i]` e `C[i−N]` alla chiusura del minuto i. Rigenerato in modo indipendente per tutte le monete: stessi segnali. |
| Entrata all'apertura del minuto dopo | **passa** | `grandeMovimento.js:107,116`: `iE = i+1`, prezzo `O[iE]`. Lo slittamento è applicato dopo (`costi.js:15-21`). |
| Movimento normale solo su giorni passati | **passa** | `grandeMovimento.js:19-35`: il giorno d usa i giorni d−14…d−1. Ricalcolato a mano: stessa soglia. (Il motore chiede 14 giorni dall'inizio della griglia, il mio conto ne accettava 13: 15 segnali in più nel **mio** conto il 14 gennaio 2023/2025, il motore è il più prudente.) |
| Unità (ATR a 15 minuti) solo su dati passati | **passa** | `volatilita.js:78`: ATR dopo l'ultima candela da 15 minuti chiusa **prima** dell'entrata. Ricalcolato con un Wilder scritto da me: livelli di uscita identici. |
| Conferme | **non usate** | La regola fissata ha `conferma: 'nessuna'`. Ho comunque letto `trend`, `btc`, `rottura24h`, `tiene`: usano solo indici ≤ i (`rottura24h` usa massimo/minimo di [j−1440, j)). |
| Prezzi del freno | **passa** | `portafoglio.js:98-106`: chiusura del minuto m, chiusura di tutto all'apertura di m+1. `peggioreAperto` usa `op.peggiore` (dato dell'intera operazione) solo come limite superiore per saltare minuti in cui il freno non può scattare: non cambia le decisioni. Prova sintetica `prova-freno.js`: OK. |
| Funding | **passa** | `costi.js:33-39`: pagamenti con orario in (entrata, uscita]. Orari arrotondati al minuto (`02-scarica-storico.js:181`). Ricalcolato a mano su tutte le operazioni: uguale (differenza massima 1e-7, dovuta al Float32 della cache). |

### 2. Uscite
| Controllo | Esito | Come |
|---|---|---|
| Uscite prima delle entrate nello stesso minuto | **passa** | `portafoglio.js:158` (`avanza(t)` chiude le uscite ≤ t prima di aprire). Nella simulazione della singola moneta la nuova entrata non può sovrapporsi (`grandeMovimento.js:113`). |
| Percorso apertura→massimo→minimo→chiusura o apertura→minimo→massimo→chiusura | **passa, ma pesa molto** | `percorso.js:14`: prima l'estremo più vicino all'apertura. Vedi problema 1. |
| Stop oltrepassato con un salto | **passa** | `posizione.js:57-61`: se l'apertura del minuto è già oltre il livello si esce all'apertura (prezzo peggiore). Lo stesso vale dopo un minuto mancante (`grandeMovimento.js:123`). Nelle 2.989 operazioni: 21 uscite così, tutte al prezzo d'apertura. |
| Uscita decisa a fine minuto eseguita al minuto dopo | **passa** | Durata massima: `grandeMovimento.js:125` chiude all'apertura del minuto `iE+240`. Freno: apertura del minuto dopo (`portafoglio.js:122`). Gli stop sono ordini dentro il minuto, eseguiti al livello. |

### 3. Scelta delle monete e regola
- **Universo** (`01-universo.js:71-83`): monete crypto presenti su Bitunix e Binance, ordinate per **volume medio Bitunix degli ultimi 30 giorni prima dell'11/11/2026**. Le prime 50 sono il campione del 70/30; le 51–100 sono il gruppo **B** della verifica.
- **Gruppo A** (`08:84,91`): le monete delle prime 50 che esistevano già prima del 2023 (24, meno BTC ed ETH = 22), dal 2020 al 2022, con dati da settembre 2019 solo per il riscaldamento. Sono quindi le monete **sopravvissute e diventate liquide fino ad oggi**.
- **Gruppo B** (`08:85,92`): le 50 monete 51–100 di oggi, dal 2023. 22 su 50 sono quotate su Binance nel 2025–2026 (625 delle 2.053 operazioni di B); 138 operazioni di B cadono proprio nei 30 giorni usati per misurare il volume che le ha scelte, 341 negli ultimi 90 giorni. Vedi problema 2.
- **Regola fissata prima**: `regola.json` creato alle 10:51 (ora italiana) dell'11/11/2026, commit `a9e882b` alle 10:51; lo storico prima del 2023 è stato scaricato alle 11:08 e quello delle monete 51–100 alle 11:18. Il motore e le librerie non sono cambiati tra il commit di 07 e quello di 08 (`git diff a9e882b c59c9b3` tocca solo 02, 08 e documenti). 07 legge solo dati prima del taglio (`07:33,35,38,51`). 08 legge `regola.json` e usa N, k, direzione, conferma e config così come sono (`08:24-25,43`); "solo altcoin" toglie BTC ed ETH (`08:90`). **Passa.**
- Una nota di metodo (problema 4): l'insieme delle varianti tra cui 07 sceglie è stato deciso dopo che 06 aveva mostrato i risultati di tutte le varianti anche sul 30%.

### 4. Costi
| Controllo | Esito |
|---|---|
| Commissione per lato | **passa**: 0,06% sul valore d'entrata e 0,06% sul valore d'uscita (`costi.js:20`, `commUscita * r`). |
| Segno dello slittamento | **passa**: long compra a P·(1+s) e vende a X·(1−s); short vende a P·(1−s) e ricompra a X·(1+s) (`costi.js:17-19`, `portafoglio.js:174`). Peggiora sempre il prezzo. |
| Funding | **passa**: tasso positivo = costo per i long, guadagno per gli short (`costi.js:38`). Controllato su casi con funding negativo e positivo (tabella, righe 17-19). È il funding di Binance, non di Bitunix: approssimazione dichiarata. |
| Leva e margine | **passa**: nozionale = margine × leva; perdita limitata al margine (margine isolato, `portafoglio.js:87`); liquidazione se il movimento contrario arriva al 90% di 1/leva (`portafoglio.js:82`). Conto indipendente: capitale finale identico con leva 3 e 5, dimensione fissa e composto (differenza ≤ 1,5e-15). Con dimensione fissa e 10 posti il margine aperto non supera mai il capitale. |
| Freno giornaliero | **passa** (prova sintetica): perdita chiusa + aperta alla chiusura del minuto, chiusura di tutto all'apertura del minuto dopo con slittamento e funding, entrate bloccate fino al giorno UTC dopo. Un dettaglio sull'ordine con le entrate dello stesso minuto: problema 6. |

### 4b. Altro
- **Posti**: limite rispettato; segnali scartati se i posti sono pieni o se la moneta è già aperta (`portafoglio.js:167-168`). **Passa.**
- **Ordine casuale**: i segnali dello **stesso minuto** sono rimescolati con un generatore con seme, 10 semi, media delle misure (`portafoglio.js:162`, `backtest.js:226`). **Passa.**
- **Sovrapposizioni sulla stessa moneta**: impossibili nella singola moneta (pausa ≥ durata massima + 1) e rifiutate nel portafoglio. **Passa** (vedi però il problema 9 per i minuti mancanti).
- **Interesse composto**: margine = 10% del capitale dopo le chiusure fino a quel minuto; le operazioni aperte nello stesso minuto non usano il risultato delle altre aperte nello stesso minuto. **Passa.** (Il mio primo conto indipendente qui sbagliava: chiudeva un'operazione entrata e uscita nello stesso minuto prima di dimensionare un'altra entrata dello stesso minuto, cioè usava un dato futuro. Il motore era giusto; ho corretto il mio conto, vedi `diagnosi-composto.js`.)
- **Arrotondamenti**: prezzi e rapporti in Float64; funding, peggiore e prezzi del freno in Float32 (errore ~1e-7, trascurabile). **Passa.**
- **Minuti mancanti e fermi**: i fermi generali di Binance sono resi "senza prezzo" (`backtest.js:119-127`), niente entrate, uscite al primo minuto con prezzo. Nelle 2.989 operazioni di 08 nessuna attraversa un minuto mancante o un fermo, quindi qui non pesa. I minuti con candela ma zero scambi (frequenti sulle monete piccole) sono trattati come prezzo valido: sono candele piatte al prezzo precedente, non creano movimenti finti.

### 5. Le 20 operazioni rifatte a mano
Scelte con seme 2026 in celle (gruppo A/B, long/short, motivo d'uscita), al massimo 2 per moneta: 12 di A e 8 di B, 11 long e 9 short, tutti e 4 i motivi d'uscita presenti in 08 (in 08 non ci sono uscite "fine dati"; "freno" è un'uscita del portafoglio). Netto con slittamento 0,08% e commissione 0,06% per lato. Il "netto motore" è calcolato con `rendimentoNetto` del motore sui dati della cache; il "netto mio" con un conto scritto a parte. L'unità non è salvata nella cache di 08: la riporto dal mio conto; che sia giusta lo dimostrano gli stop e le uscite identiche.

Formato delle celle: **motore / mio**.

| # | Moneta | Entrata (UTC) | Lato | Finestra | Prezzo d'entrata | Unità (mio) | Uscita | Motivo | Lordo | Funding | Netto | Differenza netto |
|---|---|---|---|---|---|---:|---|---|---:|---:|---:|---:|
| 1 | A · ADAUSDT | 2021-02-22 14:19 | short / short | 15 / 15 | 0.8314 / 0.8314 | 3,85% | 02-22 14:20 / 02-22 14:20 | stop loss | -5,775% / -5,775% | 0,000% / 0,000% | -6,068% / -6,068% | 0 |
| 2 | A · AVAXUSDT | 2022-09-13 12:44 | short / short | 15 / 15 | 20.33 / 20.33 | 0,86% | 09-13 12:52 / 09-13 12:52 | protezione | 0,679% / 0,679% | 0,000% / 0,000% | 0,400% / 0,400% | 0 |
| 3 | A · DOGEUSDT | 2020-11-21 02:29 | long / long | 15 / 15 | 0.003174 / 0.003174 | 0,67% | 11-21 02:29 / 11-21 02:29 | stop loss | -0,998% / -0,998% | 0,000% / 0,000% | -1,275% / -1,275% | 0 |
| 4 | A · DOGEUSDT | 2022-01-11 11:30 | long / long | 15 / 15 | 0.15272 / 0.15272 | 0,89% | 01-11 11:31 / 01-11 11:31 | stop che segue | 2,196% / 2,196% | 0,000% / 0,000% | 1,912% / 1,912% | 0 |
| 5 | A · FILUSDT | 2021-02-09 22:05 | long / long | 15 / 15 | 42.078 / 42.078 | 2,51% | 02-09 22:06 / 02-09 22:06 | protezione | 2,103% / 2,103% | 0,000% / 0,000% | 1,819% / 1,819% | 0 |
| 6 | A · GTCUSDT | 2021-10-17 10:51 | long / long | 15 / 15 | 9.461 / 9.461 | 1,20% | 10-17 10:52 / 10-17 10:52 | stop loss | -1,806% / -1,806% | 0,000% / 0,000% | -2,082% / -2,082% | 0 |
| 7 | A · GTCUSDT | 2021-12-22 04:01 | long / long | 15 / 15 | 11.225 / 11.225 | 0,86% | 12-22 04:01 / 12-22 04:01 | stop che segue | 6,042% / 6,042% | 0,000% / 0,000% | 5,748% / 5,748% | 0 |
| 8 | A · NEARUSDT | 2021-05-13 00:04 | short / short | 15 / 15 | 4.5373 / 4.5373 | 3,25% | 05-13 00:09 / 05-13 00:09 | stop loss | -4,880% / -4,880% | 0,000% / 0,000% | -5,171% / -5,171% | 0 |
| 9 | A · XLMUSDT | 2020-11-21 13:35 | long / long | 15 / 15 | 0.10434 / 0.10434 | 1,67% | 11-21 13:37 / 11-21 13:37 | protezione | 0,742% / 0,742% | 0,000% / 0,000% | 0,460% / 0,460% | 0 |
| 10 | A · XRPUSDT | 2020-03-08 16:18 | short / short | 15 / 15 | 0.2061 / 0.2061 | 1,14% | 03-08 16:20 / 03-08 16:20 | stop che segue | 2,498% / 2,498% | 0,000% / 0,000% | 2,223% / 2,223% | 0 |
| 11 | A · XRPUSDT | 2020-09-02 11:11 | short / short | 15 / 15 | 0.275 / 0.275 | 0,88% | 09-02 11:11 / 09-02 11:11 | stop che segue | 3,153% / 3,153% | 0,000% / 0,000% | 2,880% / 2,880% | 0 |
| 12 | A · ZECUSDT | 2022-01-05 22:35 | short / short | 15 / 15 | 128.27 / 128.27 | 1,51% | 01-05 22:35 / 01-05 22:35 | protezione | 0,575% / 0,575% | 0,000% / 0,000% | 0,296% / 0,296% | 0 |
| 13 | B · APTUSDT | 2023-06-30 13:42 | short / short | 15 / 15 | 6.928 / 6.928 | 0,84% | 06-30 13:42 / 06-30 13:42 | stop loss | -1,264% / -1,264% | 0,000% / 0,000% | -1,547% / -1,547% | 0 |
| 14 | B · CTUSDT | 2026-10-19 07:41 | long / long | 15 / 15 | 0.38893 / 0.38893 | 0,73% | 10-19 07:41 / 10-19 07:41 | stop che segue | 2,883% / 2,883% | 0,000% / 0,000% | 2,597% / 2,597% | 0 |
| 15 | B · INITUSDT | 2026-04-25 12:48 | long / long | 15 / 15 | 0.10043 / 0.10043 | 1,14% | 04-25 12:48 / 04-25 12:48 | stop loss | -1,708% / -1,708% | 0,000% / 0,000% | -1,984% / -1,984% | 0 |
| 16 | B · LSKUSDT | 2024-04-13 20:08 | short / short | 15 / 15 | 1.2774 / 1.2774 | 2,34% | 04-13 20:10 / 04-13 20:10 | stop che segue | 3,692% / 3,692% | 0,000% / 0,000% | 3,420% / 3,420% | 0 |
| 17 | B · ORDERUSDT | 2026-10-24 11:59 | short / short | 60 / 60 | 0.0673 / 0.0673 | 14,30% | 10-24 12:03 / 10-24 12:03 | protezione | 5,501% / 5,501% | 1,057% / 1,057% | 4,176% / 4,176% | 0 |
| 18 | B · SIRENUSDT | 2026-03-22 21:02 | long / long | 60 / 60 | 2.37018 / 2.37018 | 19,87% | 03-23 01:02 / 03-23 01:02 | durata massima | -2,356% / -2,356% | -0,179% / -0,179% | -2,452% / -2,452% | 0 |
| 19 | B · SIRENUSDT | 2026-06-13 05:45 | short / short | 15 / 15 | 0.1269 / 0.1269 | 23,88% | 06-13 09:45 / 06-13 09:45 | durata massima | 0,473% / 0,473% | -0,109% / -0,109% | 0,302% / 0,302% | 0 |
| 20 | B · USUSDT | 2026-05-28 14:59 | long / long | 15 / 15 | 0.006527 / 0.006527 | 2,84% | 05-28 15:00 / 05-28 15:00 | protezione | 1,903% / 1,903% | 0,000% / 0,000% | 1,619% / 1,619% | 0 |

Differenza: 0 su tutte e 20 (sotto 0,00001 punti percentuali). Ho controllato anche che ognuna sia il **primo** segnale dopo la pausa precedente (nessun segnale saltato) e che il movimento peggiore coincida.

Controllo esteso (`rifai-tutte.js`): tutte le 2.989 operazioni di 08 rigenerate da zero. 2.987 identiche in tutto (lato, finestra, prezzo, minuto e motivo d'uscita, rapporto, funding, movimento peggiore). Le 2 diverse (XRPUSDT 2020-12-29 17:42 e SUSDT 2026-03-15 10:16) sono pareggi: la chiusura del minuto è **esattamente** sul livello di protezione; il mio conto esce lì, il motore per un arrotondamento non esce ed esce al minuto dopo all'apertura (per XRP a un prezzo peggiore). Nessun effetto a favore.

## Problemi trovati

### 1. L'ordine dei punti dentro la candela pesa quanto i costi — **grave** (può gonfiare)
- **Dove**: `research/motore/percorso.js:14` (scelta dell'ordine), usato in `research/motore/grandeMovimento.js:120,126`.
- **Cosa**: la regola "prima l'estremo più vicino all'apertura" è ammessa da CLAUDE.md, ma per questa strategia è decisiva: il **49%** delle operazioni (1.464 su 3.004 del mio conto) esce **nello stesso minuto d'entrata**, cioè dentro una sola candela in cui non si sa cosa è successo prima. Ho rifatto tutte le operazioni con due ordini fissi:
  - estremo **sfavorevole** prima: cambiano 479 operazioni (16%), lordo medio per operazione **−0,23 punti percentuali** rispetto al motore;
  - estremo **favorevole** prima: cambiano 578 operazioni, lordo medio **−0,12 punti**.
  La regola del motore dà un risultato migliore di **entrambi** gli ordini fissi. Non è una prova che sia sbagliata, ma 0,23 punti per operazione sono quasi quanto tutto il costo di andata e ritorno (circa 0,28%) e sono vicini alla soglia del criterio "lordo almeno 0,30%".
- **Direzione**: a favore del risultato, con un'incertezza fino a circa −0,2 punti per operazione.
- **Correzione**:
  1. Subito: aggiungere un'opzione d'ordine e riportare sempre anche il caso pessimista. In `percorso.js`:
     ```js
     export function puntiCandelaIn(out, o, h, l, c, lato = 0, modo = 'vicino') {
       out[0] = o; out[3] = c;
       const altoPrima = modo === 'sfavorevole' ? lato === -1 : modo === 'favorevole' ? lato === 1 : Math.abs(h - o) < Math.abs(l - o);
       if (altoPrima) { out[1] = h; out[2] = l; } else { out[1] = l; out[2] = h; }
       return out;
     }
     ```
     e in `grandeMovimento.js:120` e `:126` passare `lato, config.ordine ?? 'vicino'`; aggiungere `ordine` alla config (e alla firma della cache).
  2. Meglio: per i minuti ambigui (minuto d'entrata e minuti in cui nello stesso minuto si aggiorna il miglior prezzo e si tocca il livello) rifare il percorso con i singoli scambi di Binance (`data.binance.vision/data/futures/um/daily/aggTrades/<SIMBOLO>/`), che danno l'ordine vero.

### 2. Monete scelte con i volumi di oggi — **medio-grave** (di solito gonfia)
- **Dove**: `research/01-universo.js:71-83` (classifica per volume Bitunix dei 30 giorni prima dell'11/11/2026), `research/02-scarica-storico.js:221`, `research/08-verifica-dati-nuovi.js:89-92`; lo stesso vale per le 50 monete del 70/30 (`backtest.js:109-116`).
- **Cosa**:
  - A (2020–2022) contiene solo monete che esistono ancora e sono tra le 50 più scambiate nel 2026: mancano tutte quelle crollate o tolte (per esempio LUNA, FTT, SRM). Le monete sparite sono proprio quelle con i movimenti più violenti e con i salti oltre lo stop.
  - B è scelto con il volume di ottobre–novembre 2026, cioè **dentro** il periodo di prova: 138 operazioni di B (7%) cadono in quei 30 giorni, 341 (17%) negli ultimi 90. Una moneta con un grande movimento recente ha molto volume e quindi entra nella lista: per una strategia che cerca grandi movimenti è una selezione a favore. 22 monete su 50 sono quotate nel 2025–2026 e fanno 625 delle 2.053 operazioni di B.
- **Quanto pesa**: non si può misurare senza rifare l'universo; può essere rilevante soprattutto su B.
- **Direzione**: quasi sempre a favore (più movimenti "puliti", nessun crollo con fermo o delisting).
- **Correzione**: universo "nel tempo". Scaricare da `data.binance.vision` le candele anche dei perpetual USDT-M **non più quotati**; a inizio di ogni mese classificare tutte le monete per volume in USDT dei 30 giorni precedenti (la colonna `quoteVolume` è già nei file) e usare per quel mese solo le prime 50 / le 51–100 di **quel** momento. Come minimo: escludere da B le operazioni dopo l'11/10/2026 (finestra della classifica) e riportare B diviso tra monete quotate prima e dopo il 2025.

### 3. Slittamento uguale per tutte le monete anche nei minuti più violenti — **medio** (gonfia)
- **Dove**: `research/lib/backtest.js:219`, `research/08-verifica-dati-nuovi.js:28-32`, `research/motore/portafoglio.js:170-173`.
- **Cosa**: 0,05% / 0,08% / 0,12% per lato su tutte le monete. Ma l'entrata avviene subito dopo un movimento di 12 volte il normale, e gli stop scattano nei minuti peggiori. Già nelle prime 50 di `docs/universo.md` diverse monete hanno meno di 10 mila USDT nel book entro lo 0,1% e spread fino a 21 punti base; la posizione è di 3.000 USDT a leva 3 e 5.000 a leva 5. Le monete 51–100 sono ancora più sottili, e su Bitunix il volume è il 3–10% di Binance. In più l'ordine parte dopo il segnale, non all'istante della chiusura.
- **Direzione**: a favore.
- **Correzione**: slittamento per moneta = metà dello spread + impatto (nozionale / profondità entro lo 0,1% × 0,1%), con un moltiplicatore per i minuti di segnale e per le uscite a stop; in alternativa un minimo di 0,15–0,20% per lato per le monete oltre la 50ª. Il campo `piccola` (`08:105`) può diventare uno slittamento per moneta.

### 4. Dati "mai usati" solo in parte — **medio** (può gonfiare)
- **Dove**: `research/06-grande-movimento.js:109,141,153` (mostra il 30% per tutte le varianti), `research/07-fissa-regola.js:29` (insieme delle varianti), `research/08-verifica-dati-nuovi.js:39`.
- **Cosa**: 07 sceglie k e "solo altcoin" solo sul 70%, ed è corretto; ma la famiglia di varianti (segui, nessuna conferma, finestre 15/60, soglie 8–12, uscite e 4 ore) è stata scelta dopo aver visto in 06 i risultati sul 30%. Inoltre B copre il 2023–2026, cioè **gli stessi mesi** del 70% e del 30% già visti, solo con altre monete: le crypto si muovono insieme, quindi B non è indipendente nel tempo.
- **Direzione**: a favore (il periodo favorevole o sfavorevole è già noto).
- **Correzione**: scriverlo nei documenti; la prova davvero nuova è solo il periodo dopo l'11/11/2026 (Prova in Fase 1), oppure A (2020–2022) da solo, che è fuori sia nel tempo sia come selezione delle varianti.

### 5. Peggior calo e giorno peggiore senza le perdite aperte — **medio** (abbellisce il rischio, non il rendimento)
- **Dove**: `research/motore/portafoglio.js:91` (la curva si aggiorna solo alle chiusure), `research/motore/metriche.js:13-21`.
- **Cosa**: il calo massimo e il giorno peggiore usano solo le operazioni chiuse. Con 10 posizioni aperte insieme, spesso dalla stessa parte, il calo vero è più profondo.
- **Correzione**: in `avanza` (o una volta per minuto con posizioni aperte) aggiungere alla curva il capitale più la perdita aperta, `curva.push([ora, cap + apertoA(ora)])`, e calcolare il giorno peggiore come `pnl` chiuso + aperto alla fine del giorno.

### 6. Freno e entrate nello stesso minuto — **piccolo** (leggermente a favore)
- **Dove**: `research/motore/portafoglio.js:147-149` e `:158-175`.
- **Cosa**: il freno del minuto t (che usa la **chiusura** di t) viene controllato prima di aprire le entrate dell'**apertura** di t. Così (a) le posizioni appena aperte non entrano nel conto della perdita aperta di quel minuto; (b) se il freno scatta, le entrate di t vengono scartate, mentre nella realtà sarebbero state aperte e poi chiuse al minuto dopo pagando i costi.
- **Correzione**: in `avanza`, quando `ora === fine` fare solo le uscite e uscire **prima** del freno:
  ```js
  usciteFinoA(ora);
  if (ora === fine) break;      // il freno del minuto `fine` si controlla dopo le entrate
  controllaFreno(ora);
  ora += MIN;
  ```
  e nel ciclo principale, dopo `for (const op of gruppo) {...}`, chiamare `controllaFreno(t)`. Il controllo ripetuto alla chiamata successiva di `avanza` è innocuo.

### 7. Uno stop dentro il minuto libera un posto per l'entrata della stessa apertura — **nessun effetto pratico**
- **Dove**: `research/motore/portafoglio.js:131,158`.
- **Cosa**: è la regola di CLAUDE.md (uscite prima delle entrate), ma uno stop scattato a metà minuto avviene dopo l'apertura, quando si entra. Misurato con 10 posti: **1 entrata su 2.989**.
- **Correzione** (facoltativa): liberare il posto prima delle entrate solo per le uscite all'apertura (durata massima, salto, freno).

### 8. Prezzi del freno senza fermi e ripiego sul prezzo d'uscita finale — **piccolo, nessun effetto in 08**
- **Dove**: `research/lib/backtest.js:204-211` (usa `leggiStorico`, non `storicoConFermi`) e `research/motore/portafoglio.js:124` (`px = p.op.prezzo * p.op.rapporto` se non c'è un prezzo per 60 minuti: è il prezzo d'uscita futuro).
- **Cosa**: nessuna operazione di 08 attraversa un fermo o un minuto mancante, quindi oggi non pesa.
- **Correzione**: applicare i fermi anche in `caricaPrezzi`; nel ripiego usare l'ultima chiusura nota prima di m, non `prezzo * rapporto`.

### 9. Pausa calcolata sulla durata massima e non sull'uscita vera — **piccolo, nessun effetto in 08**
- **Dove**: `research/motore/grandeMovimento.js:113`.
- **Cosa**: `liberaDa` presume che la posizione sia chiusa entro `iE + durataMassima`; con minuti mancanti al minuto 240 la chiusura slitta e due operazioni della stessa moneta potrebbero sovrapporsi nell'elenco (il portafoglio le rifiuta solo se la prima è stata presa). In 08 nessuna operazione ha minuti mancanti.
- **Correzione**: dopo la simulazione, `liberaDa = Math.max(liberaDa, (pos.tempoUscita - t0) / MIN + 1)`.

### 10. Funding di Binance — **piccolo** (direzione incerta)
- **Dove**: `research/motore/costi.js:33`, dati da `02-scarica-storico.js:151-188`.
- **Cosa**: direzione e istanti corretti, ma è il funding di Binance; Bitunix ha tassi e a volte intervalli diversi. Le operazioni durano al massimo 4 ore, quindi pesa poco, salvo sulle monete piccole con funding orari molto alti (riga 17 della tabella: 1,06% in 4 minuti).
- **Correzione**: dove disponibile usare lo storico funding di Bitunix, o almeno riportare quanto pesa il funding sul netto.

### Controlli senza problemi (per completezza)
- Liquidazione: 2 operazioni superano il 30% contro (leva 3) e 5 il 18% (leva 5); il portafoglio le tratta come perdita dell'intero margine. 3 operazioni hanno lo stop oltre il livello di liquidazione a leva 3 (unità del 20–24%): gestite correttamente.
- La moneta "piccola" in 08 è decisa con la posizione in `universo.json`; tutte le monete di A e B ci sono, nessuna cade per errore tra le "grandi".
- 07 e 08 usano lo stesso motore, la stessa config e la stessa regola; la firma della cache di 08 contiene la regola.

## Conclusione
Il codice del motore, di 07 e di 08 fa quello che dichiara: ho rigenerato con codice indipendente tutte le operazioni della verifica e il portafoglio e i numeri coincidono; non ho trovato uso di dati futuri, errori di segno nei costi o nel funding, né errori di conto nella leva, nel margine o nel freno. La regola è stata fissata prima di vedere i dati nuovi e applicata senza modifiche.

Il risultato però dipende da **ipotesi** che lo possono gonfiare, e vanno sistemate prima di passare alla Fase 1:
1. **ordine dentro la candela** (grave): metà delle operazioni si decide dentro un solo minuto e l'ordine scelto vale circa 0,1–0,2 punti per operazione rispetto agli ordini fissi; serve rifare quei minuti con gli scambi veri o riportare il caso pessimista;
2. **monete scelte con i volumi di oggi** (medio-grave): A è fatta solo di sopravvissute, B è scelta con il volume dentro il suo stesso periodo;
3. **slittamento fisso** (medio) su monete sottili proprio nei minuti più violenti;
4. B **non è indipendente nel tempo** dai dati già visti (medio).

Finché questi punti non sono corretti, il risultato di 08 va letto come un limite superiore.

## Dopo la revisione: correzioni applicate
Aggiunto da chi ha scritto il codice, dopo aver letto questa revisione. La regola non è stata cambiata.

| Problema | Cosa è stato fatto |
|---|---|
| 1. Ordine dentro la candela | `research/10-prezzi-veri.js` trova le 1.247 operazioni il cui esito cambia tra estremo favorevole, sfavorevole e regola di Wisi Trade. Per queste scarica gli aggTrades di Binance (1.339 giorni) e salva i prezzi veri di ogni minuto dall'entrata alla durata massima (301.493 minuti; 300 non coincidono con la candela e restano sulla candela). Il motore li usa al posto dei 4 punti (`grandeMovimento.js`, parametro `percorsi`). `percorso.js` ha anche i modi `sfavorevole` e `favorevole` per le prove. Controllo indipendente su 40 operazioni: 39 uguali, 1 con un minuto senza prezzi veri. |
| 2. Monete scelte oggi | Misurato in `docs/verifica-dati-nuovi.md`: B senza gli ultimi 30 giorni, B diviso tra monete quotate prima e dal 2025. L'universo mese per mese non è stato costruito. |
| 3. Slittamento fisso | Aggiunto lo slittamento per moneta dal book Bitunix (portafoglio: campo `slittamento` per operazione) e la misura delle dimensioni in `docs/dimensione-posizione.md`. |
| 4. Dati nuovi solo in parte | Dichiarato in `docs/verifica-dati-nuovi.md`. |
| 5. Calo senza perdite aperte | Corretto in `portafoglio.js` e `metriche.js`: con i prezzi la curva contiene chiuso + aperto minuto per minuto, e il giorno peggiore conta il momento peggiore del giorno. |
| 6. Freno e entrate nello stesso minuto | Corretto: il freno del minuto t si controlla dopo le entrate all'apertura di t. |
| 7. Posto liberato da uno stop dentro il minuto | Lasciato (1 caso su 2.989, conforme a CLAUDE.md). |
| 8. Prezzi del freno | Corretto: `caricaPrezzi` toglie i fermi; il ripiego usa l'ultima chiusura nota. |
| 9. Pausa | Corretto: `liberaDa` tiene conto dell'uscita vera. |
| 10. Funding | Riportato quanto pesa (0,001% per operazione). |

**Effetto.**
- Con i prezzi veri il lordo medio di A + B scende dallo 0,80% allo 0,32%. Il portafoglio passa da +397% a -14% (dimensione fissa, leva 3x, slittamento 0,08%), e il verdetto diventa **non regge**.
- Aggiornamento: con i prezzi veri in **tutte** le 2.989 operazioni, non solo in quelle ambigue, il lordo medio scende a −0,03% e il portafoglio va in rovina (`docs/verifica-dati-nuovi.md`, `docs/perdite-e-uscite.md`).
- L'effetto è più forte anche del caso "estremo sfavorevole per primo" stimato qui sopra. Dentro un minuto di esplosione il prezzo fa molti piccoli ritorni, e la protezione del guadagno stretta (40% da +0,5 unità) ne coglie uno presto.
- Dettagli in `docs/verifica-dati-nuovi.md`.
- I documenti precedenti (`apertura-sessione.md`, `btc-eth-limite.md`, `grande-movimento.md`, `regola-fissata.md`) non sono stati rifatti con queste correzioni e usano ancora solo le candele.

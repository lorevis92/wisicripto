# Grande movimento: dove si perde e se uscite diverse la salvano

Aggiornato il 2026-11-11. Script: `research/11-perdite-e-uscite.js`. Sempre con i **prezzi veri** di Binance (aggTrades) dentro ogni minuto delle operazioni. Le candele servono solo per i 60 minuti dopo l'uscita e per il freno del portafoglio.

<!-- conclusione:inizio -->
## Conclusione
**La strategia "grande movimento" va abbandonata.** Con i prezzi veri e una verifica onesta non c'è nessuna versione che regge.
- Nessuna delle 13 uscite provate è in utile sul periodo di scelta, fino al 2023: il netto medio va da −0,23% a −1,25% per operazione.
- Secondo i criteri decisi prima, quindi, non si poteva scegliere niente.

**Entriamo troppo tardi, non usciamo troppo presto.**
- Il **72% delle perdenti va contro subito**: non arriva mai nemmeno a +0,5 unità di guadagno. Solo il 2% era arrivato a +1 unità e l'ha restituito.
- **Dopo l'entrata il prezzo in media torna indietro.** Tenendo la posizione senza nessuna uscita, il lordo medio è:

  | Dopo | 1 min | 15 min | 60 min | 240 min |
  |---|---:|---:|---:|---:|
  | Lordo medio | −0,18% | −0,65% | −0,92% | −1,26% |

- Il movimento grosso è già finito quando entriamo, all'apertura del minuto dopo il segnale.
- **Dopo l'uscita il prezzo continua ad andare contro**: −0,89% in media nei 60 minuti dopo. Uscire prima limita il danno, restare dentro lo aumenta.
- Per questo le uscite più larghe (stop che segue a 2–3 unità) o a tempo (30–240 minuti) sul periodo di scelta fanno peggio, non meglio.
- La protezione stretta non è la causa: spegnerla o allargarla non salva niente.

**Altre cose importanti dai dati.**
- **Gli short sono il problema principale.** Dopo un crollo il prezzo rimbalza: −2,6% lordo medio a 240 minuti per chi ha seguito il movimento. I long dopo una salita invece continuano un po' (+0,76% a 240 minuti), ma non abbastanza da coprire i costi con queste uscite (netto −0,23%).
- Il 61% delle operazioni si chiude nel minuto stesso dell'entrata: in un minuto di esplosione il prezzo oscilla più di quanto valga l'unità di volatilità usata per gli stop. Stop e uscite sono troppo piccoli rispetto al rumore di quei minuti.
- Ore e dimensione delle monete non cambiano il quadro: tutti i gruppi sono in perdita al netto. Va un po' meglio la sera UTC (20–24), che resta comunque negativa.
- I costi pesano molto. Circa 0,28% per operazione, tra commissioni e slittamento a 0,08%: anche dove il lordo è vicino a zero, il netto è nettamente negativo.

**Sulla verifica dal 2024.** Lì due uscite sono positive per operazione: lo stop che segue a 3 unità (+0,20%) e l'uscita dopo 30 minuti (+0,14%). Non contano, per tre motivi:
- sul periodo di scelta erano tra le peggiori (−0,39% e −0,73%);
- anche in portafoglio perdono (−70% e rovina);
- prenderle ora vorrebbe dire scegliere guardando la verifica, cioè esattamente l'errore che la divisione serve a evitare.

**Cosa resta.** Un'idea per il futuro, da trattare come regola nuova: il rimbalzo dopo i crolli suggerisce di provare il contrario del movimento, almeno sul lato short.
- È stata vista su questi stessi dati, quindi non può essere verificata qui.
- Andrebbe fissata prima e provata solo su dati successivi all'11/11/2026, con i prezzi veri.
- Per la Fase 1 non c'è oggi nessuna strategia pronta.
<!-- conclusione:fine -->

## 1. Dove si perde (regola attuale, tutti i dati)
Entrate e uscite della regola fissata, con le uscite controllate a ogni prezzo vero. A (2020–2022) + B (dal 2023): 2.989 operazioni. "u" = unità di volatilità della moneta (ATR a 15 minuti), la misura con cui sono definiti stop e uscite: lo stop loss è a 1,5 u.

**Le perdenti**:
- 1.192 operazioni in perdita al netto (slittamento 0,08%).
- Il **72%** non è mai arrivato a +0,5 u di guadagno: è andato contro subito.
- Il **28%** era arrivato almeno a +0,5 u, e il 2% almeno a +1 u, prima di chiudere in perdita.
- Il 28% è in guadagno al lordo e in perdita solo per i costi.
- Il 60% esce nello stesso minuto in cui entra.

Per gruppo. Mediane, salvo i rendimenti medi:
- **Massimo a favore / contro**: il miglior guadagno e la peggior perdita toccati prima dell'uscita.
- **Restituito**: la quota del guadagno massimo persa uscendo.
- **Dopo l'uscita**: dove va il prezzo nei 60 minuti dopo, nella direzione dell'operazione (positivo = si è usciti troppo presto).

| Gruppo | Operazioni | Lordo medio | Netto (0,08%) | Massimo a favore | (minuti) | Massimo contro | (minuti) | Arrivate a +0,5 u | Arrivate a +1 u | Restituito | Uscita nel minuto d'entrata | Dopo l'uscita (+60 min, media) | Meglio dopo 60 min | Massimo a favore nei 60 min dopo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Tutte | 2.989 | -0,031% | -0,312% | 0,59 u (0,75%) | 0 | 0,57 u (0,73%) | 0 | 71% | 16% | 40% | 61% | -0,890% | 35% | 2,50% |
| Vincenti | 1.797 | 1,156% | 0,874% | 0,71 u (1,24%) | 0 | 0,30 u (0,48%) | 0 | 100% | 25% | 40% | 62% | -1,061% | 35% | 3,12% |
| Perdenti | 1.192 | -1,820% | -2,101% | 0,28 u (0,27%) | 0 | 1,50 u (1,38%) | 0 | 28% | 2% | 574% | 60% | -0,632% | 36% | 1,65% |
| Long | 1.216 | 0,049% | -0,229% | 0,59 u (0,80%) | 0 | 0,62 u (0,80%) | 0 | 74% | 17% | 40% | 48% | 0,167% | 43% | 3,02% |
| Short | 1.773 | -0,086% | -0,369% | 0,58 u (0,72%) | 0 | 0,54 u (0,67%) | 0 | 69% | 15% | 40% | 70% | -1,615% | 31% | 2,00% |
| Monete grandi (prime 20 per volume) | 475 | -0,063% | -0,341% | 0,59 u (0,82%) | 0 | 0,59 u (0,95%) | 0 | 71% | 13% | 40% | 54% | -1,386% | 34% | 2,58% |
| Monete medie (21ª–50ª) | 461 | -0,066% | -0,346% | 0,56 u (0,74%) | 0 | 0,53 u (0,68%) | 0 | 69% | 13% | 40% | 59% | -1,141% | 36% | 2,62% |
| Monete piccole (51ª–100ª) | 2.053 | -0,016% | -0,298% | 0,59 u (0,75%) | 0 | 0,58 u (0,70%) | 0 | 72% | 17% | 40% | 63% | -0,719% | 36% | 2,42% |
| Ore 00–04 UTC | 556 | -0,052% | -0,332% | 0,58 u (0,77%) | 0 | 0,59 u (0,78%) | 0 | 71% | 19% | 40% | 64% | -1,445% | 30% | 2,26% |
| Ore 04–08 UTC | 422 | -0,375% | -0,655% | 0,58 u (0,70%) | 0 | 0,63 u (0,76%) | 0 | 67% | 12% | 40% | 66% | -0,691% | 38% | 2,45% |
| Ore 08–12 UTC | 423 | -0,204% | -0,486% | 0,58 u (0,70%) | 0 | 0,52 u (0,63%) | 0 | 71% | 15% | 40% | 58% | -0,804% | 34% | 2,40% |
| Ore 12–16 UTC | 606 | 0,152% | -0,128% | 0,61 u (0,69%) | 0 | 0,59 u (0,74%) | 0 | 73% | 18% | 40% | 57% | -1,125% | 37% | 2,71% |
| Ore 16–20 UTC | 536 | -0,024% | -0,308% | 0,58 u (0,75%) | 0 | 0,61 u (0,76%) | 0 | 69% | 15% | 40% | 59% | -1,208% | 37% | 2,05% |
| Ore 20–24 UTC | 446 | 0,228% | -0,054% | 0,59 u (0,87%) | 0 | 0,50 u (0,71%) | 0 | 76% | 17% | 40% | 65% | 0,235% | 37% | 3,31% |
| Uscita: stop loss | 856 | -2,586% | -2,867% | 0,18 u (0,20%) | 0 | 1,50 u (1,87%) | 1 | 0% | 0% | 817% | 49% | -0,821% | 34% | 1,69% |
| Uscita: protezione del guadagno | 2.050 | 0,892% | 0,611% | 0,67 u (0,99%) | 0 | 0,29 u (0,39%) | 0 | 100% | 20% | 40% | 67% | -0,880% | 36% | 2,85% |
| Uscita: stop che segue | 75 | 4,111% | 3,833% | 3,31 u (5,08%) | 1 | 0,34 u (0,32%) | 0 | 100% | 100% | 30% | 44% | -2,214% | 31% | 3,21% |
| Uscita: tempo | 8 | -2,110% | -2,353% | 0,45 u (1,28%) | 31 | 1,32 u (5,20%) | 40 | 13% | 0% | 278% | 0% | 1,798% | 50% | 1,30% |

**Percorso medio dopo l'entrata, senza nessuna uscita.** È il guadagno lordo medio se si tenesse la posizione esattamente per quel tempo, alla chiusura del minuto: dice se dopo l'entrata il prezzo continua o torna indietro.

| Gruppo | Operazioni | 1 min | 5 min | 15 min | 30 min | 60 min | 120 min | 240 min |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Tutte | 2.989 | -0,180% | -0,466% | -0,649% | -0,370% | -0,917% | -1,120% | -1,259% |
| Long | 1.216 | -0,068% | -0,069% | 0,001% | 0,132% | 0,160% | 0,383% | 0,756% |
| Short | 1.773 | -0,257% | -0,739% | -1,095% | -0,714% | -1,657% | -2,151% | -2,641% |
| Monete piccole (51ª–100ª) | 2.053 | -0,178% | -0,500% | -0,673% | -0,247% | -0,732% | -0,945% | -0,991% |
| Fino al 2023 | 1.323 | -0,190% | -0,370% | -0,723% | -0,748% | -1,327% | -1,540% | -1,858% |
| Dal 2024 | 1.666 | -0,173% | -0,543% | -0,590% | -0,069% | -0,592% | -0,787% | -0,783% |

## 2. Uscite diverse, con una divisione nuova
L'uscita è stata scelta sulle operazioni fino al 31/12/2023 con criteri decisi prima. Le regole e la scelta sono in `docs/regola-fissata-2.md`, salvato con un commit prima della verifica. La verifica va dal 01/01/2024 a oggi (monete 51–100), una sola volta.

**Nessuna uscita era stata ammessa sul periodo di scelta**: la tabella della verifica è solo informativa.

**Tutte le uscite sul periodo di verifica** (dal 2024), per confronto. Solo l'uscita scelta conta per il verdetto; le altre sono state viste solo dopo la scelta.

| Uscita | Operazioni | Lordo medio | Netto (0,08%) | Netto (0,12%) | PF (0,08%) | Portafoglio: rendimento | Peggior calo |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0. Attuale, uscite controllate a ogni prezzo | 1.666 | -0,011% | -0,294% | -0,374% | 0,66 | -100,0% (rovina) | 100% (rovina) |
| 1. Attuale, uscite controllate alla chiusura del minuto | 1.666 | -0,115% | -0,397% | -0,477% | 0,74 | -100,0% (rovina) | 100% (rovina) |
| 2. Protezione più larga: da 1 unità, si restituisce fino al 60% | 1.666 | -0,087% | -0,366% | -0,446% | 0,79 | -100,0% (rovina) | 100% (rovina) |
| 3. Senza protezione, stop che segue a 1 unità | 1.666 | -0,152% | -0,433% | -0,513% | 0,74 | -100,0% (rovina) | 100% (rovina) |
| 4. Senza protezione, stop che segue a 2 unità | 1.666 | -0,037% | -0,319% | -0,399% | 0,84 | -100,0% (rovina) | 100% (rovina) |
| 5. Senza protezione, stop che segue a 3 unità | 1.666 | 0,481% | 0,204% | 0,124% | 1,10 | -70,3% | 87,2% |
| 6. Solo stop loss, uscita dopo 30 minuti | 1.666 | 0,421% | 0,141% | 0,061% | 1,07 | -100,0% (rovina) | 100% (rovina) |
| 7. Solo stop loss, uscita dopo 60 minuti | 1.666 | -0,125% | -0,405% | -0,485% | 0,81 | -100,0% (rovina) | 100% (rovina) |
| 8. Solo stop loss, uscita dopo 120 minuti | 1.666 | -0,298% | -0,573% | -0,653% | 0,75 | -100,0% (rovina) | 100% (rovina) |
| 9. Solo stop loss, uscita dopo 240 minuti | 1.666 | -0,200% | -0,470% | -0,550% | 0,81 | -100,0% (rovina) | 100% (rovina) |
| 10. Obiettivo fisso a 1 unità (più stop loss, massimo 4 ore) | 1.666 | -0,068% | -0,347% | -0,427% | 0,74 | -100,0% (rovina) | 100% (rovina) |
| 11. Obiettivo fisso a 2 unità (più stop loss, massimo 4 ore) | 1.666 | -0,068% | -0,348% | -0,428% | 0,81 | -100,0% (rovina) | 100% (rovina) |
| 12. Obiettivo fisso a 3 unità (più stop loss, massimo 4 ore) | 1.666 | 0,053% | -0,228% | -0,308% | 0,89 | -100,0% (rovina) | 100% (rovina) |

## Limiti
- I prezzi veri sono quelli di Binance, non di Bitunix: su Bitunix il book è più sottile e i percorsi dentro il minuto possono essere diversi.
- Le monete sono scelte con la liquidità di oggi (vedi `docs/verifica-dati-nuovi.md`).
- Le entrate sono quelle della regola fissata sul 70% del periodo 2023–2026 (con le candele): anche il periodo di verifica 2024–2026 era già stato guardato per scegliere le entrate, con altre monete.

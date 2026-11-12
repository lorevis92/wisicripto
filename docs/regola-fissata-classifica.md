# Regole fissate: strategie lente (classifica settimanale e rincorsa di BTC)

Fissate il 2026-11-12, **prima di qualunque risultato**: quando è stato fatto il commit di questo file non era ancora stato simulato niente.
- Dati: `research/12-scarica-lente.js`.
- Test: `research/13-strategie-lente.js`.
- Risultati: `docs/strategie-lente.md`.

## Perché strategie lente
Con le operazioni di pochi minuti, costi e percorso dentro il minuto decidevano tutto (`docs/perdite-e-uscite.md`). Qui si tengono le posizioni giorni o settimane:
- i costi pesano poco rispetto ai movimenti;
- si lavora su candele da 1 ora e giornaliere, mai sotto.

## Dati
- **Monete**: tutti i perpetual crypto USDT-M di Binance dal 2020, **comprese quelle tolte**, dall'archivio data.binance.vision.
- **Esclusi**:
  - contratti su azioni e materie prime;
  - indici (DEFI, BTCDOM, ALL, BLUEBIRD, FOOTBALL);
  - USDC;
  - oro tokenizzato (PAXG, XAUT).
- **Candele da 1 ora**, file mensili più quelli giornalieri del mese in corso. Le giornaliere (UTC) si ricavano dalle orarie.
- **Funding reale** di ogni moneta, all'orario reale di ogni pagamento.
- **Operabile su Bitunix**: la moneta è nella lista di oggi di `docs/universo.md` (`data/universo.json`, contratti operabili via API e presenti su Binance). Viene segnato per ogni operazione.

## Universo di ogni settimana (senza dati futuri)
Ogni lunedì alle 00:00 UTC, usando solo le ore già chiuse:
- **candidate**: tutte le monete della lista, BTC ed ETH esclusi;
- **condizioni**:
  - quotate da almeno 30 giorni (prima candela almeno 30 giorni prima);
  - con un prezzo nelle ultime 24 ore;
- **classifica** per volume scambiato (in USDT) nei 30 giorni precedenti;
- **due universi**: le **prime 50** e le **prime 100**.

Le monete dalla 51ª alla 100ª di quella settimana sono le **"sottili"**.

## Le strategie
In tutte:
- la decisione si prende con l'ultima ora chiusa;
- l'esecuzione avviene **all'apertura dell'ora dopo**;
- dentro ogni gamba i pesi sono uguali.

Gamba long e gamba short:
- **Long e short**: metà dell'esposizione sulla gamba long, metà sulla short.
- **Solo long / solo short**: tutta l'esposizione su quella gamba.

Ogni lunedì le posizioni si riportano al peso giusto: si paga il costo solo sulla parte che cambia.

### A · Classifica settimanale
- **Classifica**: ogni lunedì le monete dell'universo si ordinano per rendimento delle ultime **1, 2 o 4 settimane**.
- **Posizioni**: long sul **20% migliore**, short sul **20% peggiore**. Sono 10 + 10 monete con le prime 50 e 20 + 20 con le prime 100.
- **Durata**: si tengono una settimana.
- **Varianti**: long e short, solo long, solo short.

In tutto 18 varianti: 3 periodi × 3 gambe × 2 universi.

### B · Classifica con funding
Funding medio = media dei pagamenti dei 7 giorni prima del lunedì, riportata a 8 ore (somma dei tassi ÷ 21).
- **B1, come A ma senza i trade affollati.**
  - Dal 20% migliore si tolgono le monete con funding medio sopra +0,03% ogni 8 ore: i long pagano molto, quindi troppi sono già long.
  - Dal 20% peggiore si tolgono quelle sotto −0,03%.
  - La gamba resta con meno monete, con la stessa esposizione.
  - 18 varianti, come A.
- **B2, classifica fatta solo sul funding medio, contro la folla.**
  - Long sul 20% con il funding più basso, short sul 20% con il funding più alto.
  - Varianti: long e short, solo long, solo short, per 2 universi: 6 varianti.
- **Versioni base**:
  - di B1: la A con lo stesso periodo, la stessa gamba e lo stesso universo;
  - di B2: la A a 1 settimana con la stessa gamba e lo stesso universo.

### C · Filtro BTC
- **Regola**: come A, decisa ogni lunedì guardando la chiusura giornaliera di BTC di domenica e la media delle ultime **50 o 100** chiusure giornaliere.
  - **BTC sopra la media**: gamba long di A (20% migliore), con tutta l'esposizione.
  - **BTC sotto la media**:
    - variante "**short**": gamba short di A (20% peggiore), con tutta l'esposizione;
    - variante "**fuori**": nessuna posizione.
- **Varianti**: 3 periodi × 2 medie × 2 comportamenti × 2 universi = 24.
- **Versione base**: la A solo long con lo stesso periodo e lo stesso universo.

### D · Rincorsa di BTC
- **Segnale**: ogni giorno alle 00:00 UTC si guarda il rendimento della giornata appena chiusa di BTC.
  - La volatilità normale è la deviazione standard dei rendimenti giornalieri di BTC dei 30 giorni prima.
  - C'è un segnale se BTC si è mosso più di **2 o 3 volte** la volatilità normale, in un senso o nell'altro.
- **Monete che non l'hanno ancora seguito**: le monete dell'universo della settimana che nella stessa giornata si sono mosse nella direzione di BTC per **meno della metà** del movimento di BTC, comprese quelle andate nell'altro senso.
- **Posizioni**:
  - si entra su queste monete nella direzione di BTC, all'apertura del giorno dopo il segnale;
  - si tiene **1 o 3 giorni**;
  - ogni giorno di segnale riceve 1/durata dell'esposizione, divisa in parti uguali tra le monete. Così l'esposizione totale non supera quella fissata.
- **Varianti**: 2 soglie × 2 durate × 2 universi = 8.
- **Versione base**: stesso segnale e stessa durata, ma su **tutte** le monete dell'universo. Mostra cosa aggiunge la scelta delle monete rimaste indietro.

## Costi e capitale
- **Commissione**: 0,06% per lato sul valore scambiato.
- **Slittamento per lato** sul valore scambiato:
  - **normale**: 0,08%;
  - **alto**: 0,12%, e 0,15% sulle monete sottili (51ª–100ª della settimana).
- **Funding reale**, pagato o incassato secondo il lato e il valore della posizione al momento del pagamento.
- **Esposizione totale**: pari al capitale (1x) oppure al doppio (2x).
- **Dimensione**:
  - **fissa**: sempre sul capitale iniziale di 10.000 USDT;
  - **interesse composto**: sul capitale del momento.
- Se il capitale arriva a zero è **rovina**, e la simulazione si ferma.
- **Moneta tolta da Binance mentre è in portafoglio**: si chiude all'ultimo prezzo disponibile, con slittamento.
- **Ore senza candela**: vale l'ultimo prezzo noto.

Le posizioni si valutano ogni ora.

## Divisione
- **Scelta**: dal 2020 al 31/12/2023. La simulazione chiude tutto il 01/01/2024 alle 00:00.
- **Verifica**: dal 01/01/2024, che è un lunedì, a ieri, **una sola volta**, senza cambiare niente. Si riparte senza posizioni.

## Criteri decisi prima
Tutto con dimensione fissa, esposizione 1x e slittamento normale, salvo dove è detto diverso.

**Ammissione nel periodo di scelta (2020–2023).** Una variante è ammessa se:
1. il rendimento è positivo e il profit factor (sulle operazioni, al netto) è almeno 1,10;
2. con lo slittamento alto il rendimento è ancora positivo;
3. è in utile in almeno 3 dei 4 anni 2020, 2021, 2022, 2023;
4. il peggior calo è al massimo il 50%.

**Una vincitrice per famiglia** (A, B, C, D):
- vince la variante ammessa con il **rapporto più alto tra rendimento medio annuo e peggior calo**;
- se nessuna variante della famiglia è ammessa, la famiglia non passa.

**Verifica (dal 2024).** La vincitrice di una famiglia **regge** se:
1. il rendimento è positivo e il profit factor è almeno 1,10;
2. con lo slittamento alto il rendimento è ancora positivo;
3. è in utile in almeno 2 dei 3 anni 2024, 2025, 2026 (parziale);
4. il peggior calo è al massimo il 40%;
5. rifatta solo con le monete operabili oggi su Bitunix (universo e classifica solo tra quelle), il rendimento è positivo.

Si verificano fino a 4 regole, una per famiglia. Più regole si provano, più è facile che una passi per caso: se ne passa una sola, va trattata con cautela.

## Cosa si riporta
- Risultato anno per anno, profit factor, peggior calo, settimana peggiore.
- Quanto pesano costi e funding sul lordo, numero di operazioni.
  - Un'operazione è una moneta tenuta di fila sulla stessa gamba, dall'entrata all'uscita.
- Interesse composto ed esposizione 2x.
- Separati:
  - gamba long e gamba short;
  - monete ancora attive e monete tolte;
  - solo monete operabili su Bitunix.
- Ogni variante accanto alla sua versione base.

## Scelta sul periodo 2020–2023 (fatta il 2026-11-12, prima della verifica)
Script: `research/13-strategie-lente.js --fase=scelta`. Dimensione fissa, esposizione 1x, slittamento normale. "Alto" = rendimento con lo slittamento alto. Criteri: 1 = rendimento positivo e PF almeno 1,10; 2 = positivo con slittamento alto; 3 = in utile in almeno 3 anni su 4; 4 = peggior calo al massimo 50%.

| Variante | Rendimento | Medio annuo | PF | Peggior calo | Settimana peggiore | Operazioni | Netto medio per operazione | Anno per anno | Alto | Criteri | Ammessa |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---|---|
| A · ultime 1 settimane · long e short · prime 50 | 110,3% | 27,6% | 1,10 | 21,2% | -8,8% | 2.872 | 0,77% | 46% / 86% / -7% / -14% | 97,4% | no 3 | no |
| A · ultime 1 settimane · solo long · prime 50 | 402,8% | 100,7% | 1,39 | 63,2% | -44,2% | 1.404 | 2,76% | 122% / 328% / -137% / 90% | 390,3% | no 4 | no |
| A · ultime 1 settimane · solo short · prime 50 | -100,0% (rovina) | -25,2% | 0,61 | 100,5% | -103,9% | 256 | -3,31% | -30% / -71% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| A · ultime 2 settimane · long e short · prime 50 | 56,2% | 14,0% | 1,06 | 36,3% | -14,3% | 2.154 | 0,44% | 57% / 40% / -35% / -6% | 46,3% | no 1, no 3 | no |
| A · ultime 2 settimane · solo long · prime 50 | 359,5% | 89,9% | 1,40 | 63,2% | -44,2% | 1.017 | 3,20% | 143% / 289% / -173% / 101% | 350,3% | no 4 | no |
| A · ultime 2 settimane · solo short · prime 50 | -100,0% (rovina) | -25,7% | 0,59 | 101,8% | -108,4% | 186 | -4,70% | -29% / -74% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| A · ultime 4 settimane · long e short · prime 50 | 92,2% | 23,1% | 1,11 | 26,8% | -19,6% | 1.563 | 1,10% | 49% / 62% / -33% / 13% | 84,7% | tutti | **sì** |
| A · ultime 4 settimane · solo long · prime 50 | 443,1% | 110,8% | 1,64 | 63,2% | -44,2% | 705 | 5,51% | 164% / 305% / -149% / 123% | 436,4% | no 4 | no |
| A · ultime 4 settimane · solo short · prime 50 | -100,0% (rovina) | -25,1% | 0,24 | 100,1% | -101,5% | 46 | -10,08% | -100% / 0% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| B1 · ultime 1 settimane senza affollati · long e short · prime 50 | 115,0% | 28,7% | 1,11 | 23,7% | -11,9% | 2.600 | 0,31% | 24% / 123% / -7% / -25% | 102,0% | no 3 | no |
| B1 · ultime 1 settimane senza affollati · solo long · prime 50 | 447,4% | 111,9% | 1,47 | 63,2% | -44,2% | 1.223 | 1,96% | 92% / 411% / -137% / 82% | 435,1% | no 4 | no |
| B1 · ultime 1 settimane senza affollati · solo short · prime 50 | -100,0% (rovina) | -25,2% | 0,59 | 100,7% | -107,6% | 221 | -3,61% | -43% / -58% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| B1 · ultime 2 settimane senza affollati · long e short · prime 50 | 105,2% | 26,3% | 1,11 | 31,5% | -11,2% | 2.011 | -0,10% | 45% / 109% / -36% / -13% | 94,8% | no 3 | no |
| B1 · ultime 2 settimane senza affollati · solo long · prime 50 | 475,2% | 118,8% | 1,54 | 63,2% | -44,2% | 917 | 2,04% | 121% / 426% / -173% / 101% | 465,3% | no 4 | no |
| B1 · ultime 2 settimane senza affollati · solo short · prime 50 | -100,0% (rovina) | -25,5% | 0,60 | 101,2% | -107,0% | 180 | -4,43% | -31% / -71% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| B1 · ultime 4 settimane senza affollati · long e short · prime 50 | 165,2% | 41,3% | 1,20 | 29,1% | -12,2% | 1.517 | 1,20% | 61% / 134% / -37% / 7% | 157,0% | tutti | **sì** |
| B1 · ultime 4 settimane senza affollati · solo long · prime 50 | 607,9% | 152,0% | 1,84 | 63,2% | -44,2% | 671 | 5,81% | 190% / 443% / -149% / 123% | 600,2% | no 4 | no |
| B1 · ultime 4 settimane senza affollati · solo short · prime 50 | -100,0% (rovina) | -25,3% | 0,20 | 100,7% | -110,3% | 46 | -9,84% | -101% / 0% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| B2 · contro il funding della settimana · long e short · prime 50 | 104,9% | 26,2% | 1,12 | 14,6% | -6,9% | 1.782 | 1,06% | 37% / 74% / -7% / 1% | 96,3% | tutti | **sì** |
| B2 · contro il funding della settimana · solo long · prime 50 | 361,6% | 90,4% | 1,53 | 66,3% | -42,1% | 772 | 4,09% | 131% / 289% / -146% / 88% | 353,9% | no 4 | no |
| B2 · contro il funding della settimana · solo short · prime 50 | -100,0% (rovina) | -25,2% | 0,59 | 100,4% | -116,6% | 177 | -4,14% | -58% / -43% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| C · ultime 1 settimane · BTC sopra la media 50: long, sotto: short · prime 50 | 538,6% | 134,6% | 1,57 | 37,1% | -13,4% | 1.476 | 3,48% | 110% / 313% / 85% / 31% | 525,3% | tutti | **sì** |
| C · ultime 1 settimane · BTC sopra la media 50: long, sotto: fuori · prime 50 | 478,5% | 119,6% | 2,03 | 36,7% | -11,3% | 745 | 6,08% | 119% / 318% / -25% / 66% | 471,8% | tutti | **sì** |
| C · ultime 1 settimane · BTC sopra la media 100: long, sotto: short · prime 50 | 359,2% | 89,8% | 1,35 | 54,5% | -14,5% | 1.453 | 2,29% | 108% / 275% / 35% / -59% | 346,2% | no 4 | no |
| C · ultime 1 settimane · BTC sopra la media 100: long, sotto: fuori · prime 50 | 410,0% | 102,5% | 1,75 | 36,0% | -12,3% | 789 | 4,80% | 128% / 324% / -51% / 10% | 402,9% | tutti | **sì** |
| C · ultime 2 settimane · BTC sopra la media 50: long, sotto: short · prime 50 | 470,6% | 117,7% | 1,56 | 38,8% | -13,9% | 1.163 | 3,78% | 108% / 257% / 72% / 33% | 460,0% | tutti | **sì** |
| C · ultime 2 settimane · BTC sopra la media 50: long, sotto: fuori · prime 50 | 460,2% | 115,0% | 2,17 | 34,3% | -12,8% | 571 | 7,48% | 120% / 294% / -19% / 65% | 455,0% | tutti | **sì** |
| C · ultime 2 settimane · BTC sopra la media 100: long, sotto: short · prime 50 | 274,6% | 68,7% | 1,29 | 51,0% | -12,5% | 1.130 | 2,07% | 121% / 209% / 16% / -72% | 264,4% | no 4 | no |
| C · ultime 2 settimane · BTC sopra la media 100: long, sotto: fuori · prime 50 | 360,5% | 90,1% | 1,75 | 31,5% | -11,9% | 600 | 5,33% | 134% / 264% / -52% / 14% | 355,0% | tutti | **sì** |
| C · ultime 4 settimane · BTC sopra la media 50: long, sotto: short · prime 50 | 433,0% | 108,3% | 1,60 | 54,5% | -21,2% | 912 | 4,62% | 72% / 259% / 54% / 49% | 424,4% | no 4 | no |
| C · ultime 4 settimane · BTC sopra la media 50: long, sotto: fuori · prime 50 | 431,3% | 107,8% | 2,32 | 32,1% | -14,5% | 435 | 9,05% | 117% / 259% / -16% / 72% | 427,2% | tutti | **sì** |
| C · ultime 4 settimane · BTC sopra la media 100: long, sotto: short · prime 50 | 267,6% | 66,9% | 1,33 | 69,9% | -21,2% | 858 | 2,71% | 105% / 220% / -7% / -51% | 259,5% | no 3, no 4 | no |
| C · ultime 4 settimane · BTC sopra la media 100: long, sotto: fuori · prime 50 | 403,9% | 101,0% | 2,12 | 26,8% | -12,3% | 431 | 7,95% | 155% / 258% / -43% / 33% | 399,8% | tutti | **sì** |
| D · BTC oltre 2 volte la volatilità · monete rimaste indietro · 1 giorno · prime 50 | -62,5% | -15,6% | 0,77 | 68,5% | -22,3% | 938 | 0,39% | -27% / 14% / -22% / -28% | -69,1% | no 1, no 2, no 3, no 4 | no |
| D base · BTC oltre 2 volte la volatilità · tutte le monete · 1 giorno · prime 50 | -47,5% | -11,9% | 0,83 | 55,3% | -37,9% | 4.025 | -0,21% | -29% / -0% / -15% / -3% | -54,6% | no 1, no 2, no 3, no 4 | no |
| D · BTC oltre 2 volte la volatilità · monete rimaste indietro · 3 giorni · prime 50 | 6,7% | 1,7% | 1,05 | 21,8% | -6,7% | 919 | 2,46% | -3% / 7% / 6% / -3% | 4,4% | no 1, no 3 | no |
| D base · BTC oltre 2 volte la volatilità · tutte le monete · 3 giorni · prime 50 | 11,2% | 2,8% | 1,09 | 20,9% | -10,4% | 3.931 | 0,85% | -8% / 7% / 6% / 7% | 8,6% | no 1 | no |
| D · BTC oltre 3 volte la volatilità · monete rimaste indietro · 1 giorno · prime 50 | 14,7% | 3,7% | 1,16 | 28,5% | -12,3% | 388 | 1,82% | 24% / -6% / 17% / -20% | 12,3% | no 3 | no |
| D base · BTC oltre 3 volte la volatilità · tutte le monete · 1 giorno · prime 50 | -27,6% | -6,9% | 0,76 | 41,8% | -22,7% | 1.494 | -0,25% | -17% / -12% / 11% / -9% | -30,3% | no 1, no 2, no 3 | no |
| D · BTC oltre 3 volte la volatilità · monete rimaste indietro · 3 giorni · prime 50 | 16,3% | 4,1% | 1,49 | 12,9% | -2,4% | 388 | 3,46% | 13% / 1% / 4% / -2% | 15,5% | tutti | **sì** |
| D base · BTC oltre 3 volte la volatilità · tutte le monete · 3 giorni · prime 50 | 20,4% | 5,1% | 1,52 | 12,7% | -5,2% | 1.494 | 2,45% | 2% / 9% / 9% / 1% | 19,4% | tutti | **sì** |
| A · ultime 1 settimane · long e short · prime 100 | 45,8% | 11,5% | 1,04 | 34,5% | -8,8% | 5.341 | 0,15% | 34% / 53% / -21% / -20% | 29,3% | no 1, no 3 | no |
| A · ultime 1 settimane · solo long · prime 100 | 334,3% | 83,6% | 1,33 | 63,2% | -44,2% | 2.586 | 1,72% | 98% / 307% / -141% / 71% | 318,5% | no 4 | no |
| A · ultime 1 settimane · solo short · prime 100 | -100,0% (rovina) | -25,1% | 0,60 | 100,1% | -102,9% | 271 | -4,23% | -30% / -70% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| A · ultime 2 settimane · long e short · prime 100 | 43,2% | 10,8% | 1,05 | 31,0% | -13,6% | 3.826 | 0,11% | 50% / 29% / -26% / -11% | 31,0% | no 1, no 3 | no |
| A · ultime 2 settimane · solo long · prime 100 | 345,9% | 86,5% | 1,40 | 63,2% | -44,2% | 1.795 | 2,34% | 133% / 297% / -154% / 71% | 334,7% | no 4 | no |
| A · ultime 2 settimane · solo short · prime 100 | -100,0% (rovina) | -25,3% | 0,60 | 100,7% | -104,5% | 210 | -5,44% | -32% / -69% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| A · ultime 4 settimane · long e short · prime 100 | 54,1% | 13,5% | 1,07 | 28,3% | -15,6% | 2.815 | 0,42% | 41% / 42% / -31% / 3% | 44,9% | no 1 | no |
| A · ultime 4 settimane · solo long · prime 100 | 378,0% | 94,5% | 1,58 | 63,2% | -44,2% | 1.262 | 3,59% | 157% / 287% / -158% / 92% | 370,0% | no 4 | no |
| A · ultime 4 settimane · solo short · prime 100 | -100,0% (rovina) | -25,1% | 0,24 | 100,1% | -101,5% | 46 | -10,08% | -100% / 0% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| B1 · ultime 1 settimane senza affollati · long e short · prime 100 | 38,1% | 9,5% | 1,04 | 41,0% | -11,9% | 4.937 | -0,17% | 11% / 67% / -19% / -20% | 21,5% | no 1, no 3 | no |
| B1 · ultime 1 settimane senza affollati · solo long · prime 100 | 337,3% | 84,3% | 1,35 | 63,2% | -44,2% | 2.313 | 1,03% | 65% / 341% / -141% / 73% | 321,6% | no 4 | no |
| B1 · ultime 1 settimane senza affollati · solo short · prime 100 | -100,0% (rovina) | -25,5% | 0,58 | 101,3% | -104,3% | 238 | -4,35% | -43% / -59% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| B1 · ultime 2 settimane senza affollati · long e short · prime 100 | 57,6% | 14,4% | 1,06 | 27,0% | -11,2% | 3.631 | 0,03% | 36% / 51% / -20% / -9% | 44,8% | no 1, no 3 | no |
| B1 · ultime 2 settimane senza affollati · solo long · prime 100 | 367,7% | 91,9% | 1,43 | 63,2% | -44,2% | 1.651 | 1,90% | 106% / 339% / -154% / 77% | 355,8% | no 4 | no |
| B1 · ultime 2 settimane senza affollati · solo short · prime 100 | -100,0% (rovina) | -26,5% | 0,59 | 103,9% | -133,9% | 204 | -5,48% | -34% / -72% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| B1 · ultime 4 settimane senza affollati · long e short · prime 100 | 85,9% | 21,5% | 1,11 | 29,1% | -12,2% | 2.765 | 0,28% | 51% / 62% / -31% / 4% | 75,8% | tutti | **sì** |
| B1 · ultime 4 settimane senza affollati · solo long · prime 100 | 443,8% | 111,0% | 1,65 | 63,2% | -44,2% | 1.222 | 3,12% | 180% / 326% / -158% / 97% | 434,7% | no 4 | no |
| B1 · ultime 4 settimane senza affollati · solo short · prime 100 | -100,0% (rovina) | -25,3% | 0,20 | 100,7% | -110,3% | 46 | -9,84% | -101% / 0% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| B2 · contro il funding della settimana · long e short · prime 100 | 107,2% | 26,8% | 1,13 | 14,6% | -6,9% | 3.292 | 1,00% | 30% / 61% / -3% / 19% | 96,1% | tutti | **sì** |
| B2 · contro il funding della settimana · solo long · prime 100 | 365,4% | 91,3% | 1,55 | 66,3% | -42,1% | 1.434 | 3,35% | 115% / 271% / -128% / 107% | 355,6% | no 4 | no |
| B2 · contro il funding della settimana · solo short · prime 100 | -100,0% (rovina) | -25,2% | 0,59 | 100,5% | -126,2% | 206 | -4,51% | -55% / -46% / 0% / 0% | -100,0% (rovina) | no 1, no 2, no 3, no 4 | no |
| C · ultime 1 settimane · BTC sopra la media 50: long, sotto: short · prime 100 | 471,8% | 118,0% | 1,50 | 37,1% | -13,4% | 2.767 | 2,62% | 87% / 306% / 50% / 29% | 454,8% | tutti | **sì** |
| C · ultime 1 settimane · BTC sopra la media 50: long, sotto: fuori · prime 100 | 440,3% | 110,1% | 1,97 | 36,0% | -11,3% | 1.327 | 4,89% | 96% / 321% / -34% / 58% | 432,0% | tutti | **sì** |
| C · ultime 1 settimane · BTC sopra la media 100: long, sotto: short · prime 100 | 272,4% | 68,1% | 1,26 | 54,5% | -14,5% | 2.716 | 1,22% | 85% / 250% / 11% / -73% | 255,7% | no 4 | no |
| C · ultime 1 settimane · BTC sopra la media 100: long, sotto: fuori · prime 100 | 359,4% | 89,9% | 1,65 | 35,4% | -12,3% | 1.381 | 3,45% | 105% / 307% / -51% / -1% | 350,6% | no 3 | no |
| C · ultime 2 settimane · BTC sopra la media 50: long, sotto: short · prime 100 | 475,9% | 119,0% | 1,60 | 38,8% | -13,9% | 2.087 | 3,46% | 98% / 291% / 63% / 24% | 462,7% | tutti | **sì** |
| C · ultime 2 settimane · BTC sopra la media 50: long, sotto: fuori · prime 100 | 432,9% | 108,2% | 2,12 | 33,9% | -12,8% | 990 | 6,26% | 109% / 303% / -30% / 51% | 426,7% | tutti | **sì** |
| C · ultime 2 settimane · BTC sopra la media 100: long, sotto: short · prime 100 | 285,4% | 71,4% | 1,32 | 51,0% | -12,5% | 2.008 | 1,61% | 111% / 241% / 16% / -82% | 272,9% | no 4 | no |
| C · ultime 2 settimane · BTC sopra la media 100: long, sotto: fuori · prime 100 | 360,7% | 90,2% | 1,78 | 31,1% | -11,9% | 1.001 | 4,55% | 124% / 288% / -48% / -3% | 354,3% | no 3 | no |
| C · ultime 4 settimane · BTC sopra la media 50: long, sotto: short · prime 100 | 466,1% | 116,5% | 1,70 | 54,5% | -21,2% | 1.650 | 4,64% | 66% / 303% / 61% / 37% | 455,5% | no 4 | no |
| C · ultime 4 settimane · BTC sopra la media 50: long, sotto: fuori · prime 100 | 442,8% | 110,7% | 2,50 | 31,9% | -14,5% | 755 | 8,57% | 110% / 293% / -21% / 60% | 438,1% | tutti | **sì** |
| C · ultime 4 settimane · BTC sopra la media 100: long, sotto: short · prime 100 | 268,4% | 67,1% | 1,35 | 69,9% | -21,2% | 1.536 | 2,08% | 99% / 233% / 2% / -66% | 258,6% | no 4 | no |
| C · ultime 4 settimane · BTC sopra la media 100: long, sotto: fuori · prime 100 | 400,5% | 100,1% | 2,19 | 26,8% | -12,3% | 728 | 6,93% | 149% / 281% / -44% / 15% | 395,9% | tutti | **sì** |
| D · BTC oltre 2 volte la volatilità · monete rimaste indietro · 1 giorno · prime 100 | -58,7% | -14,7% | 0,79 | 66,9% | -21,8% | 1.584 | 0,19% | -28% / 12% / -18% / -25% | -66,5% | no 1, no 2, no 3, no 4 | no |
| D base · BTC oltre 2 volte la volatilità · tutte le monete · 1 giorno · prime 100 | -45,4% | -11,4% | 0,83 | 52,6% | -35,4% | 7.437 | -0,25% | -30% / 3% / -14% / -5% | -53,7% | no 1, no 2, no 3, no 4 | no |
| D · BTC oltre 2 volte la volatilità · monete rimaste indietro · 3 giorni · prime 100 | 9,0% | 2,2% | 1,08 | 21,8% | -6,7% | 1.549 | 2,31% | -3% / 13% / 0% / -1% | 6,3% | no 1, no 3 | no |
| D base · BTC oltre 2 volte la volatilità · tutte le monete · 3 giorni · prime 100 | 9,1% | 2,3% | 1,07 | 20,9% | -10,3% | 7.245 | 0,63% | -8% / 6% / 7% / 5% | 6,0% | no 1 | no |
| D · BTC oltre 3 volte la volatilità · monete rimaste indietro · 1 giorno · prime 100 | 0,1% | 0,0% | 1,00 | 29,1% | -13,0% | 643 | 1,17% | 23% / -11% / 8% / -20% | -2,8% | no 1, no 2, no 3 | no |
| D base · BTC oltre 3 volte la volatilità · tutte le monete · 1 giorno · prime 100 | -30,5% | -7,6% | 0,74 | 41,8% | -22,7% | 2.764 | -0,47% | -17% / -14% / 11% / -11% | -33,6% | no 1, no 2, no 3 | no |
| D · BTC oltre 3 volte la volatilità · monete rimaste indietro · 3 giorni · prime 100 | 16,4% | 4,1% | 1,49 | 11,7% | -2,6% | 643 | 2,62% | 13% / 3% / 2% / -2% | 15,4% | tutti | **sì** |
| D base · BTC oltre 3 volte la volatilità · tutte le monete · 3 giorni · prime 100 | 19,8% | 5,0% | 1,52 | 12,7% | -5,2% | 2.764 | 2,14% | 2% / 8% / 10% / -0% | 18,7% | tutti | **sì** |

**Vincitrici** (rapporto più alto tra rendimento medio annuo e peggior calo, tra le ammesse):
- **A**: A · ultime 4 settimane · long e short · prime 50 (`A-4s-ls-50`): medio annuo 23,1%, peggior calo 26,8%, rapporto 0,86.
- **B**: B2 · contro il funding della settimana · long e short · prime 100 (`B2-ls-100`): medio annuo 26,8%, peggior calo 14,6%, rapporto 1,83.
- **C**: C · ultime 4 settimane · BTC sopra la media 100: long, sotto: fuori · prime 50 (`C-4s-m100-fuori-50`): medio annuo 101,0%, peggior calo 26,8%, rapporto 3,77.
- **D**: D · BTC oltre 3 volte la volatilità · monete rimaste indietro · 3 giorni · prime 100 (`D-k3-3g-100`): medio annuo 4,1%, peggior calo 11,7%, rapporto 0,35.

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

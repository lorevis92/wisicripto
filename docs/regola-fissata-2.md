# Regola fissata 2: l'uscita del grande movimento

Fissata il 2026-11-11 **prima** della verifica, usando solo le operazioni con entrata fino al 31/12/2023. Script: `research/11-perdite-e-uscite.js --fase=scelta`.

## Cosa resta uguale
- **Entrate**: quelle della regola fissata (`docs/regola-fissata.md`): solo altcoin, ultimi 15 o 60 minuti oltre 12 volte il movimento normale, si segue il movimento, entrata a mercato al minuto dopo, pausa 4 ore.
- **Monete**: A = 22 altcoin dal 2020 al 2022, B = monete 51–100 dal 2023.
- **Prezzi veri** di Binance (aggTrades) in ogni minuto, dall'entrata alla durata massima.
- **Stop loss** a 1,5 unità, sempre sulla borsa e istantaneo.

## Divisione
- **Scelta**: entrate fino al 31/12/2023 (A 2020–2022 e B 2023).
- **Verifica**: dal 01/01/2024 a oggi (B), una sola volta, senza cambiare la regola.

## Le uscite confrontate
"Chiusura del minuto" vuol dire che l'app guarda il prezzo solo alla chiusura di ogni minuto, come Wisi Trade nel Reale. Un'uscita decisa lì si esegue all'apertura del minuto dopo. L'unità è la volatilità della moneta (ATR a 15 minuti).

0. Attuale, uscite controllate a ogni prezzo
1. Attuale, uscite controllate alla chiusura del minuto
2. Protezione più larga: da 1 unità, si restituisce fino al 60%
3. Senza protezione, stop che segue a 1 unità
4. Senza protezione, stop che segue a 2 unità
5. Senza protezione, stop che segue a 3 unità
6. Solo stop loss, uscita dopo 30 minuti
7. Solo stop loss, uscita dopo 60 minuti
8. Solo stop loss, uscita dopo 120 minuti
9. Solo stop loss, uscita dopo 240 minuti
10. Obiettivo fisso a 1 unità (più stop loss, massimo 4 ore)
11. Obiettivo fisso a 2 unità (più stop loss, massimo 4 ore)
12. Obiettivo fisso a 3 unità (più stop loss, massimo 4 ore)

## Criteri decisi prima
- Sono ammesse solo le uscite con netto medio positivo (slittamento 0,08%) sia su A sia su B 2023, con almeno 300 operazioni in tutto.
- Tra le ammesse vince il netto medio più alto sull'intero periodo di scelta.
- Se nessuna è ammessa, non si sceglie niente e la strategia non passa.
- **Criteri della verifica** (dal 2024, dimensione fissa, leva 3x, slittamento 0,08%):
  1. portafoglio in utile con profit factor almeno 1,10;
  2. lordo medio almeno 0,30% per operazione;
  3. con slittamento 0,12% netto medio non negativo;
  4. in utile sia nel 2024 sia dal 2025 in poi.

## Risultati sul periodo di scelta
Singole operazioni. Netto con commissione 0,06% per lato, slittamento per lato e funding reale.

| Uscita | Operazioni | Lordo medio | Netto (0,08%) | Netto (0,12%) | PF (0,08%) | Netto A | Netto B 2023 | Ammessa |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 0. Attuale, uscite controllate a ogni prezzo | 1.323 | -0,056% | -0,336% | -0,416% | 0,58 | -0,344% | -0,316% | no |
| 1. Attuale, uscite controllate alla chiusura del minuto | 1.323 | 0,048% | -0,231% | -0,311% | 0,83 | -0,315% | -0,029% | no |
| 2. Protezione più larga: da 1 unità, si restituisce fino al 60% | 1.323 | 0,017% | -0,263% | -0,343% | 0,83 | -0,340% | -0,078% | no |
| 3. Senza protezione, stop che segue a 1 unità | 1.323 | -0,022% | -0,301% | -0,381% | 0,79 | -0,395% | -0,073% | no |
| 4. Senza protezione, stop che segue a 2 unità | 1.323 | -0,075% | -0,357% | -0,437% | 0,79 | -0,440% | -0,154% | no |
| 5. Senza protezione, stop che segue a 3 unità | 1.323 | -0,108% | -0,389% | -0,470% | 0,79 | -0,427% | -0,298% | no |
| 6. Solo stop loss, uscita dopo 30 minuti | 1.323 | -0,447% | -0,728% | -0,808% | 0,58 | -0,772% | -0,620% | no |
| 7. Solo stop loss, uscita dopo 60 minuti | 1.323 | -0,709% | -0,990% | -1,071% | 0,47 | -1,125% | -0,666% | no |
| 8. Solo stop loss, uscita dopo 120 minuti | 1.323 | -0,838% | -1,121% | -1,201% | 0,43 | -1,292% | -0,705% | no |
| 9. Solo stop loss, uscita dopo 240 minuti | 1.323 | -0,968% | -1,254% | -1,335% | 0,41 | -1,470% | -0,732% | no |
| 10. Obiettivo fisso a 1 unità (più stop loss, massimo 4 ore) | 1.323 | -0,135% | -0,415% | -0,495% | 0,65 | -0,422% | -0,398% | no |
| 11. Obiettivo fisso a 2 unità (più stop loss, massimo 4 ore) | 1.323 | -0,112% | -0,393% | -0,473% | 0,74 | -0,453% | -0,248% | no |
| 12. Obiettivo fisso a 3 unità (più stop loss, massimo 4 ore) | 1.323 | -0,142% | -0,423% | -0,503% | 0,76 | -0,476% | -0,294% | no |

## Uscita scelta
**Nessuna.** Nessuna uscita ha il netto medio positivo sia su A sia su B 2023: secondo i criteri decisi prima la strategia non passa. La verifica dal 2024 si fa lo stesso, ma solo per informazione.

Controllo: l'uscita 0, rifatta con il nuovo simulatore delle uscite, coincide con il motore del backtest in 1.323 operazioni su 1.323. Minuti con prezzi veri: 99,58%; gli altri, senza scambi o non coincidenti con la candela, usano la candela.

# Monkey Roads – documento di riferimento

*Aggiornato al 26 ottobre 2026. Da caricare tra i documenti del progetto "Monkey Roads" su Claude.*

Monkey Roads è la web app di **Monkey Island Roma**, la palestra di boulder di Paolo. Mostra i boulder e i circuiti della palestra sulla foto dei muri. Lo staff ci traccia i percorsi; i clienti li consultano e, con un account, segnano le proprie salite.

## Dove sta ogni cosa

| Cosa | Dove |
|---|---|
| App pubblicata | https://paolomarchetti1980-crypto.github.io/Circuiti/ |
| Codice | GitHub `paolomarchetti1980-crypto/Circuiti` (ramo `main`, pubblicazione automatica con GitHub Actions su GitHub Pages) |
| Dati e account | Supabase, progetto `jfoqqcqwossgokoaxlhw` (Francoforte, UE) |
| Email (conferma account, password dimenticata) | Brevo, via SMTP collegato a Supabase; testi in italiano |
| Segnalazioni dei clienti | Telegram, bot "Monkey Roads segnalazioni" (il token sta solo nel database) |
| Lista per il lancio | `LANCIO.md` nel codice |
| Note (messaggio per i tester, schermate da rivedere) | cartella `note/` nel codice |
| Informativa privacy (bozza) | artifact Docs "Informativa privacy – Monkey Roads (bozza)" |

### File del codice
- `app.js`: tutta l'app in un solo file.
- `index.html`: pagina e stili.
- `sw.js`: lavoro offline e copia dei dati sul telefono.
- `supabase.sql`: storia di tutte le modifiche al database.
- `namegen.js`: generatore di soprannomi.
- `vendor/`: libreria dei QR code.
- `fonts/`: caratteri Barlow, ospitati in casa.
- `test/`: prove automatiche (`suite.mjs` con i dati di prova `fixture.json`).

### Pubblicare una modifica
1. Alzare il numero di versione in `sw.js` (`CACHE = 'circuiti-vNNN'` e `app.js?v=NNN`) e in `index.html` (`app.js?v=NNN`). Senza questo i telefoni tengono la versione vecchia.
2. Prima di pubblicare, avviare un server locale sulla porta 8765 nella cartella del codice e lanciare `node suite.mjs` dentro `test/`.
3. Fare il commit come "Paolo Marchetti", poi il push su `main` e attendere la fine del lavoro di GitHub Actions.

## Regole di lavoro (decise da Paolo)
- **Supabase:** Claude può leggere e aggiungere (tabelle, colonne, funzioni). **Per modificare o cancellare dati esistenti deve chiedere il consenso.** I comandi distruttivi (per esempio cancellare utenti) li esegue Paolo dal SQL Editor.
- **Chiavi segrete:** mai chiedere, salvare o usare la chiave `service_role` o altre chiavi segrete. La chiave pubblica `anon` in `config.js` va bene. La chiave SMTP di Brevo non passa in chat. Il token di Telegram resta solo nel database, mai nel codice pubblico.
- **Modo di lavorare:** ragionare su ogni richiesta prima di eseguirla e dire se non si è d'accordo. Mostrare anteprime con dati veri (schermate). Niente avvertenze personali non richieste.
- **Stile delle risposte:** in italiano, chiare, senza gergo tecnico.

## La palestra (dati che l'app usa)
- **Boulder:** scala a 6 colori, dal più facile: bianco, blu, verde, giallo, rosso, nero. Ogni boulder si chiama col suo colore e numero, per esempio "Giallo 2", più un soprannome facoltativo.
- **Settori boulder:** sono 18. Se ne rinnovano 2 a settimana, interi.
- **Etichette per i clienti:** "Nuovo" nella 1ª settimana, "Recente" nella 2ª. A livello di settore per i boulder, del singolo circuito per i circuiti.
- **Etichetta per lo staff:** "Scaduto" dalla 9ª settimana.
- **Circuiti:** gradi francesi. I muri dei circuiti si smontano completamente una volta l'anno; l'archiviazione è manuale.
- **Staff:** due ruoli, **gestore** (tutto) e **tracciatore**. Lo staff entra da menu ⋮ → Accesso staff.

## Cosa fa l'app oggi

### Staff
- Carica la foto del muro: JPG, PNG, WebP, HEIC e anche i RAW delle fotocamere, come i NEF.
- **Risoluzione delle foto (dal 26/10):** il ritaglio si fa sulla foto originale, letta fino a 4096 px. Si salvano due versioni: 3000 px per lo staff e la rilevazione delle prese, 1600 px per i clienti. I muri caricati prima sono rimasti a 1100–1500 px.
- **Rilevazione (dal 27/10):** al tocco, se il riconoscimento non trova la presa (o prende solo il bullone) si usa il colore. Nel rilevamento automatico: le prese sopra i volumi vengono separate (solo colore deciso e forma compatta, così le chiazze di vernice si scartano) e c'è una seconda passata ingrandita per le prese piccole (contorni pieni, rilevamento circa un terzo più lento).
- Rileva le prese e prepara il muro ("Blocca muro e traccia"). Finché il muro non è pronto lo vede solo il gestore.
- **Tracciatura:** partenza (quadrato), prese con mano sinistra o destra, arrivo (rombo), **piedi obbligati** (tratteggio giallo con l'impronta). I numeri hanno tutti la stessa misura; mentre si traccia si possono vedere gli altri circuiti in trasparenza.
- **Boulder:** colore, soprannome, tracciatore, date di montaggio e smontaggio, caratteristiche a gruppi (Parete, Movimento, Prese, Richiede), note. Il vecchio menu "Stile" è stato tolto per i boulder e resta per i circuiti.
- **Menu Altro → Gestione:** Pannello settori (età, gradi presenti e mancanti, chi traccia), Segnalazioni ricevute, QR code, Staff, Versioni precedenti, Vedi come tracciatore.
- L'**occhio** in alto apre l'anteprima di come la vede un cliente, account compresi.
- Statistiche dei clienti per ogni percorso: salite, gradimento medio da 1 a 10, % di facile, giusto e duro. Sono anonime.

### Clienti
- Schermata iniziale con Boulder e Circuiti, settori a griglia, foto a schermo intero con frecce e "striscia dei pallini".
- **Tasti per i circuiti:** Numeri (acceso), Linee (spento), Altri circuiti (spento). Ogni telefono ricorda le sue scelte.
- **Stampa e Condividi immagine** dal menu, solo dentro un settore o un muro.
- **Segnala un problema:** la segnalazione arriva su Telegram.
- L'app funziona anche offline e si apre subito. All'apertura chiede solo il numero di versione e riscarica i dati solo se c'è stata una pubblicazione.

### Account clienti ("Le mie salite") – ancora spenti per il pubblico
- **Iscrizione:** email e password, con l'occhio per vederla in chiaro, più "Chi crea l'account?": "almeno 14 anni" oppure "un genitore per un figlio sotto i 14". Poi conferma via email.
- **Salite:** ✓ Fatto / ☆ Progetto, parere sul grado, gradimento da 1 a 10. Sui circuiti in progetto si segna **"fin dove sei arrivato"** (record e bandierina sulla foto).
- **Annulla** dopo aver tolto un Fatto o un Progetto con record.
- **Sempre sotto gli occhi:** pulsante con la montagna in alto, riquadro nella schermata iniziale, avanzamento "✓ 3/8 ☆ 1" su schermata iniziale e settori, ✓ e ☆ sui cartellini della foto.
- **Le mie salite:** riquadro dei badge in cima, schede Boulder e Circuiti, "In parete adesso", "Da sempre" con grafico mensile, progetti con la barra del record.
- **Badge:** sono 48, a toppa esagonale in bronzo, argento o oro, con un disegno per ognuno e il bordo che si riempie man mano. Animazione allo sblocco; pallino rosso finché non li vedi.
  - Gruppi: Costanza, Varietà, Colori, Progressi, Per la palestra, Chilometraggio (solo movimenti dei circuiti, pietra miliare), Tecnica (piedi obbligati: elefante, orso, stambecco, scimmia), Orari, Sedute.
  - L'orario di una salita è quello in cui si tocca Fatto.
- **Cancella il mio account:** dal menu, elimina account e salite.

### Come si accendono gli account
- In `app.js` ci sono `ACCT_LIVE = false` (account spenti per il pubblico) e `NEWC_LIVE = true` (la nuova interfaccia è già per tutti).
- **Link di prova:** `…/Circuiti/#prova-account-6bfacd47` accende gli account solo su quel browser; `#prova-account-off` li rispegne.
- Su iPhone l'app sulla schermata Home non condivide i dati con Safari: durante la prova i tester iPhone usano Safari.

## Database (Supabase)
- **Tabelle:**
  - `app_state`: tutti i muri e i percorsi in un unico documento, con lo storico in `app_state_history`.
  - `editors`: staff (email, ruolo, nome).
  - `feedback`: segnalazioni, con trigger verso Telegram.
  - `ticks`: le salite dei clienti. Colonne: stato, voto, gradimento, grado, data, movimenti, da progetto, punto più alto, miglioramenti.
- **Funzioni:** `is_editor`, `my_role`, `is_manager`, `tick_summary`, `tick_stats`, `delete_my_account`, `purge_inactive_clients`.
- **Pulizia automatica:** ogni domenica alle 3 vengono cancellati gli account clienti inattivi da 24 mesi; lo staff è escluso.
- **Limite email** di Supabase: 100 all'ora. Brevo gratuito: 300 al giorno.
- **Costi:** zero con i piani gratuiti. Il piano Pro di Supabase (circa 23 €/mese) servirebbe solo per avere i backup giornalieri.

## Decisioni prese
- **Privacy:** dati minimi, server in UE, pareri anonimi per lo staff; account inattivi cancellati dopo 24 mesi; sotto i 14 anni l'account lo crea un genitore con la sua email.
- **Prova completa da cliente:** fatta il 26/10, tutto a posto.
- **Prossimo passo:** prova di 2 settimane con 8–10 clienti fidati e un paio di tracciatori (messaggio pronto in `note/messaggio-tester.md`), poi presentazione alla dirigenza.

## Cosa manca (vedi `LANCIO.md`)
- **Dopo l'ok della dirigenza:** dati della palestra (ragione sociale, indirizzo, P. IVA, email privacy) nell'informativa; mittente e indirizzo della palestra su Brevo; dominio della palestra; verifica dell'informativa con il consulente.
- **Il giorno del lancio:** cancellare gli account e le salite di prova, mettere `ACCT_LIVE = true`, provare da un telefono che non è dello staff.
- **Dopo il lancio:** notifiche (progetto in smontaggio, settore rinnovato, nuovi circuiti), che il cliente sceglie; al massimo una al giorno, niente di notte.
- **Da rivedere (Paolo):** la scheda del boulder → Caratteristiche.

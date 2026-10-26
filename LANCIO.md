# Prima del lancio degli account clienti ("Le mie salite")

Oggi gli account clienti sono spenti (`ACCT_LIVE = false` in app.js): li vede solo lo staff da menu ⋮ → Anteprima con Le mie salite,
oppure chi apre il link segreto di prova. Prima di accenderli per tutti:

- [x] **Invio email (Brevo + Supabase SMTP)** collegato e provato (23/10: arriva in posta in arrivo, mittente Monkey Island Roma)
- [ ] Brevo: **mittente** con l'indirizzo della palestra (per le prove si usa la Gmail personale di Paolo)
- [ ] Brevo: **indirizzo dell'organizzazione** della palestra (per le prove c'è quello di casa)
- [ ] Brevo: collegare il **dominio della palestra** quando ci sarà un sito con email propria
- [x] Supabase → Authentication → Emails: testi in **italiano** per "Confirm signup", "Magic Link" e "Reset password"
- [x] Supabase → Authentication → Rate limits: email portate a 100 all'ora (26/10)
- [ ] **Informativa privacy**: decisioni prese (account inattivi cancellati dopo 24 mesi; sotto i 14 anni l'account lo crea un genitore). Mancano i dati della palestra tra [ ] e la verifica del consulente
- [x] Supabase: pulizia automatica degli account inattivi da 24 mesi attiva (ogni domenica alle 3)
- [x] Prova completa da cliente (26/10, dal telefono): registrazione, conferma, entra, Fatto/Progetto/voto, Annulla, esci, rientra, cancella account — tutto salvato e cancellato correttamente
- [ ] Pulizia: cancellare gli **account e le salite di prova** (compresi quelli fatti in anteprima con gli account dello staff)
- [ ] App: `ACCT_LIVE = true` in app.js, pubblicare, provare da un telefono non dello staff

- [ ] Badge: rivedere soglie e nomi dopo le prime settimane di uso (oggi nomi descrittivi, soglie provvisorie).

## Dopo il lancio

- [ ] **Notifiche** (prima novità dopo il lancio, da annunciare ai clienti):
  - progetto che sta per essere smontato (qualche giorno prima, solo a chi l'ha come progetto)
  - settore rinnovato
  - nuovi circuiti
  - il cliente sceglie quali ricevere; al massimo una al giorno (riepilogo), niente di notte
  - su iPhone solo con l'app sulla schermata Home; aggiungere l'iscrizione alle notifiche nell'informativa privacy

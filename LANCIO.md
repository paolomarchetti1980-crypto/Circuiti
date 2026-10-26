# Prima del lancio degli account clienti ("Le mie salite")

Oggi gli account clienti sono spenti (`ACCT_LIVE = false` in app.js): li vede solo lo staff da menu ⋮ → Anteprima con Le mie salite,
oppure chi apre il link segreto di prova. Prima di accenderli per tutti:

- [x] **Invio email (Brevo + Supabase SMTP)** collegato e provato (23/10: arriva in posta in arrivo, mittente Monkey Island Roma)
- [ ] Brevo: **mittente** con l'indirizzo della palestra (per le prove si usa la Gmail personale di Paolo)
- [ ] Brevo: **indirizzo dell'organizzazione** della palestra (per le prove c'è quello di casa)
- [ ] Brevo: collegare il **dominio della palestra** quando ci sarà un sito con email propria
- [x] Supabase → Authentication → Emails: testi in **italiano** per "Confirm signup", "Magic Link" e "Reset password"
- [ ] Supabase → Authentication → Rate limits: alzare il limite delle email all'ora se serve
- [ ] **Informativa privacy**: decisioni prese (account inattivi cancellati dopo 24 mesi; sotto i 14 anni l'account lo crea un genitore). Mancano i dati della palestra tra [ ] e la verifica del consulente
- [ ] Supabase: eseguire lo script "Account clienti inattivi" (in fondo a supabase.sql) per la pulizia automatica
- [x] Prova completa da cliente (26/10, dal telefono): registrazione, conferma, entra, Fatto/Progetto/voto, Annulla, esci, rientra, cancella account — tutto salvato e cancellato correttamente
- [ ] Pulizia: cancellare gli **account e le salite di prova** (compresi quelli fatti in anteprima con gli account dello staff)
- [ ] App: `ACCT_LIVE = true` in app.js, pubblicare, provare da un telefono non dello staff

- [ ] Badge: rivedere soglie e nomi dopo le prime settimane di uso (oggi nomi descrittivi, soglie provvisorie).

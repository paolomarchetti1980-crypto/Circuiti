# Prima del lancio degli account clienti ("Le mie salite")

Oggi gli account clienti sono spenti (`ACCT_LIVE = false` in app.js): li vede solo lo staff da menu ⋮ → Anteprima con Le mie salite,
oppure chi apre il link segreto di prova. Prima di accenderli per tutti:

- [ ] **Invio email (Brevo + Supabase SMTP)** collegato e provato
- [ ] Brevo: **mittente** con l'indirizzo della palestra (per le prove si usa la Gmail personale di Paolo)
- [ ] Brevo: **indirizzo dell'organizzazione** della palestra (per le prove c'è quello di casa)
- [ ] Brevo: collegare il **dominio della palestra** quando ci sarà un sito con email propria
- [ ] Supabase → Authentication → Emails: testi in **italiano** per "Confirm signup" e "Reset password"
- [ ] Supabase → Authentication → Rate limits: alzare il limite delle email all'ora se serve
- [ ] **Informativa privacy** per gli account clienti (email + salite; pareri anonimi per lo staff)
- [ ] Prova completa da cliente: registrazione, conferma, entra, Fatto/Progetto/voto, esci, cancella account
- [ ] Pulizia: cancellare gli **account e le salite di prova** (compresi quelli fatti in anteprima con gli account dello staff)
- [ ] App: `ACCT_LIVE = true` in app.js, pubblicare, provare da un telefono non dello staff

-- Database dell'app Circuiti: da incollare UNA volta in Supabase > SQL Editor > Run

create table if not exists public.app_state (
  id int primary key,
  data jsonb not null,
  rev bigint not null default 0,
  updated_at timestamptz default now()
);
create table if not exists public.editors (email text primary key);

alter table public.app_state enable row level security;
alter table public.editors enable row level security;

create or replace function public.is_editor() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.editors where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

drop policy if exists "lettura pubblica" on public.app_state;
drop policy if exists "gestori inseriscono" on public.app_state;
drop policy if exists "gestori aggiornano" on public.app_state;
create policy "lettura pubblica" on public.app_state for select using (true);
create policy "gestori inseriscono" on public.app_state for insert with check (public.is_editor());
create policy "gestori aggiornano" on public.app_state for update using (public.is_editor()) with check (public.is_editor());

insert into storage.buckets (id, name, public) values ('walls', 'walls', true) on conflict (id) do nothing;
drop policy if exists "foto lettura" on storage.objects;
drop policy if exists "foto caricamento" on storage.objects;
drop policy if exists "foto aggiornamento" on storage.objects;
create policy "foto lettura" on storage.objects for select using (bucket_id = 'walls');
create policy "foto caricamento" on storage.objects for insert with check (bucket_id = 'walls' and public.is_editor());
create policy "foto aggiornamento" on storage.objects for update using (bucket_id = 'walls' and public.is_editor());

-- gestori: chi può modificare (aggiungere altre email con la stessa riga)
insert into public.editors (email) values ('paolo.marchetti1980@gmail.com') on conflict do nothing;

-- ===== Aggiornamento: staff con ruoli (gestore / tracciatore) =====
alter table public.editors add column if not exists role text not null default 'tracciatore';
update public.editors set role = 'gestore' where lower(email) = lower('paolo.marchetti1980@gmail.com');
create or replace function public.my_role() returns text
language sql security definer stable set search_path = public as $$
  select role from public.editors where lower(email) = lower(auth.jwt() ->> 'email') limit 1;
$$;
create or replace function public.is_manager() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(public.my_role() = 'gestore', false);
$$;
drop policy if exists "staff legge" on public.editors;
drop policy if exists "gestore aggiunge" on public.editors;
drop policy if exists "gestore modifica" on public.editors;
drop policy if exists "gestore toglie" on public.editors;
create policy "staff legge" on public.editors for select using (public.is_editor());
create policy "gestore aggiunge" on public.editors for insert with check (public.is_manager());
create policy "gestore modifica" on public.editors for update using (public.is_manager()) with check (public.is_manager());
create policy "gestore toglie" on public.editors for delete using (public.is_manager() and lower(email) <> lower(auth.jwt() ->> 'email'));

-- ===== Aggiornamento: storico delle pubblicazioni (copia di sicurezza automatica) =====
-- A ogni Pubblica la versione precedente viene salvata qui; si tengono le ultime 60.
create table if not exists public.app_state_history (
  id bigserial primary key,
  saved_at timestamptz not null default now(),
  saved_by text,
  rev bigint,
  data jsonb not null
);
alter table public.app_state_history enable row level security;
drop policy if exists "gestore legge storico" on public.app_state_history;
create policy "gestore legge storico" on public.app_state_history for select using (public.is_manager());
create or replace function public.keep_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_state_history (saved_by, rev, data) values (auth.jwt() ->> 'email', old.rev, old.data);
  delete from public.app_state_history where id not in (select id from public.app_state_history order by id desc limit 60);
  return new;
end $$;
drop trigger if exists app_state_keep on public.app_state;
create trigger app_state_keep before update on public.app_state for each row execute function public.keep_history();

-- Controllo: regole di accesso attive (il risultato si può incollare a Claude)
select c.relname as tabella, c.relrowsecurity as protezione_attiva,
  (select string_agg(p.policyname || ' [' || p.cmd || ']', ', ' order by p.policyname) from pg_policies p where p.schemaname = n.nspname and p.tablename = c.relname) as regole
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in ('app_state', 'editors', 'app_state_history')) or (n.nspname = 'storage' and c.relname = 'objects')
order by 1;

-- ===== Aggiornamento: segnalazioni ed errori dell'app =====
-- Chiunque usi l'app può inviare una segnalazione (o l'app registra da sola un errore); solo il gestore le legge.
create table if not exists public.feedback (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  message text not null,
  ctx jsonb,
  email text,
  done boolean not null default false
);
alter table public.feedback enable row level security;
drop policy if exists "chiunque segnala" on public.feedback;
drop policy if exists "gestore legge segnalazioni" on public.feedback;
drop policy if exists "gestore aggiorna segnalazioni" on public.feedback;
create policy "chiunque segnala" on public.feedback for insert to anon, authenticated
  with check (kind in ('segnalazione', 'errore') and char_length(message) <= 2000 and done = false);
create policy "gestore legge segnalazioni" on public.feedback for select using (public.is_manager());
create policy "gestore aggiorna segnalazioni" on public.feedback for update using (public.is_manager()) with check (public.is_manager());

-- ===== Aggiornamento: notifica su Telegram a ogni nuova segnalazione =====
-- (prima era ntfy.sh, ma il suo server gratuito rifiuta i messaggi che partono da Supabase: limite giornaliero condiviso)
-- Sostituire le due righe INCOLLA_QUI con il token del bot (da @BotFather) e il numero della chat.
create extension if not exists pg_net;
create or replace function public.notify_feedback() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tg_token text := 'INCOLLA_QUI_IL_TOKEN';
  tg_chat  text := 'INCOLLA_QUI_IL_NUMERO';
begin
  begin
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || tg_token || '/sendMessage',
      body := jsonb_build_object(
        'chat_id', tg_chat,
        'text', case when new.kind = 'errore' then '⚠️ Errore dell''app' else '💬 Nuova segnalazione' end
                || E'\n\n' || left(new.message, 500)
                || coalesce(E'\n\n📍 ' || (new.ctx->>'where'), '')
                || coalesce(E'\n👤 ' || split_part(new.email, '@', 1), ''),
        'disable_web_page_preview', true,
        'reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
          jsonb_build_object('text', 'Apri le segnalazioni', 'url', 'https://paolomarchetti1980-crypto.github.io/Circuiti/#segnalazioni'))))
      )
    );
  exception when others then null; -- se la notifica non parte, la segnalazione resta comunque salvata
  end;
  return new;
end $$;
drop trigger if exists feedback_notify on public.feedback;
create trigger feedback_notify after insert on public.feedback for each row execute function public.notify_feedback();

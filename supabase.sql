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
insert into public.editors (email) values ('EMAIL_GESTORE') on conflict do nothing;

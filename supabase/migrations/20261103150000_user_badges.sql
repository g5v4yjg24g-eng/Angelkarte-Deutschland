-- Fangpunkt – Abzeichen (Wunsch Nutzer 2026-11-03): exklusives FOUNDER-Abzeichen für das Konto des Gründers.
-- Eigene Tabelle, unabhängig von Profil und Nutzername: vergeben wird über die unveränderliche Nutzer-ID.
-- Nutzer können Abzeichen nur lesen – anlegen, ändern oder löschen geht ausschließlich über Migrationen
-- (Datenbank-Eigentümer), nie aus der App. Rollen oder Admin-Rechte gibt es bisher nicht; sie bleiben unberührt.

create table public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge text not null check (badge in ('founder')),
  granted_at timestamptz not null default now(),
  primary key (user_id, badge)
);

-- FOUNDER gibt es genau einmal
create unique index user_badges_one_founder on public.user_badges (badge) where badge = 'founder';

alter table public.user_badges enable row level security;

-- Angemeldete dürfen Abzeichen lesen (später auch die anderer, z. B. bei Kommentaren); keine Schreib-Policy
create policy "Abzeichen lesen" on public.user_badges
  for select to authenticated using (true);

revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;

-- Vergabe NICHT hier (keine Nutzer-IDs oder E-Mails im Repo): einmalig im SQL-Editor von Supabase als
-- Datenbank-Eigentümer, z. B.
--   insert into public.user_badges (user_id, badge)
--   select id, 'founder' from auth.users where lower(email) = '<E-Mail des Gründers>' on conflict do nothing;

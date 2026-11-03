-- Fangpunkt – Beiträge auf dem Server, Etappe 2 (Wunsch Nutzer 2026-11-03; Entscheidung: Fotos in Originalgröße,
-- so wie auf dem Gerät gespeichert – EXIF ist dort schon entfernt). Nur Beiträge, die jemand teilt; das Fangbuch
-- bleibt auf dem Gerät. Sichtbar: 'friends' = Verfasser + Freunde, 'public' = alle Angemeldeten.

create table public.posts (
  id uuid primary key,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caption text check (caption is null or char_length(caption) <= 2200),
  visibility text not null default 'friends' check (visibility in ('friends', 'public')),
  photo_paths text[] not null check (cardinality(photo_paths) between 1 and 10),
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index posts_author_created on public.posts (author_id, created_at desc);

alter table public.posts enable row level security;

-- Darf das angemeldete Konto diesen Beitrag sehen?
create function public.can_see_post(author uuid, vis text) returns boolean
language sql stable security definer set search_path = '' as $$
  select author = auth.uid()
      or vis = 'public'
      or (vis = 'friends' and public.are_friends(author, auth.uid()));
$$;
revoke execute on function public.can_see_post(uuid, text) from public, anon;
grant execute on function public.can_see_post(uuid, text) to authenticated;

create policy "Beiträge lesen" on public.posts
  for select to authenticated using (public.can_see_post(author_id, visibility));
create policy "Eigene Beiträge anlegen" on public.posts
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "Eigene Beiträge ändern" on public.posts
  for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "Eigene Beiträge löschen" on public.posts
  for delete to authenticated using ((select auth.uid()) = author_id);

revoke all on public.posts from anon, authenticated;
grant select, insert, delete on public.posts to authenticated;
grant update (caption, visibility, updated_at) on public.posts to authenticated;

-- Fotos: privater Speicher, Pfad <Nutzer-ID>/<Beitrags-ID>/<Nr>.<Endung>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 15728640, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "Eigene Beitragsfotos hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Eigene Beitragsfotos ersetzen" on storage.objects
  for update to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Eigene Beitragsfotos löschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Sichtbare Beitragsfotos lesen" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.posts p
        where p.author_id::text = (storage.foldername(name))[1]
          and p.id::text = (storage.foldername(name))[2]
          and public.can_see_post(p.author_id, p.visibility)
      )
    )
  );

notify pgrst, 'reload schema';

-- Fangpunkt – Profilbild auf dem Server (Paket 2b, Freigabe Nutzer 2026-11-06): Freunde und andere Angemeldete
-- sehen das Profilbild im Feed, bei Kommentaren und in Listen. Nur hinzufügend – nichts wird gelöscht oder umgebaut.
-- Speicher „avatars“ (privat): Pfad <Nutzer-ID>/<Version>.jpg, nur JPEG bis 1 MB. Die App schneidet das Bild auf
-- 512 × 512 zu und kodiert es neu (ohne EXIF/GPS). Eine neue Version bekommt einen neuen Pfad (kein veralteter
-- Zwischenspeicher); das alte Bild bleibt, bis das neue eingetragen ist, und wird danach entfernt.

alter table public.profiles add column avatar_path text
  check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f]{32}\.jpg$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Eigenes Profilbild hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Eigenes Profilbild löschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Darf das angemeldete Konto dieses Profilbild sehen? Nur das aktuell eingetragene Bild; fremde nur ohne Blockierung
-- und ohne Sperre; Moderatoren immer. (security definer: fremde Profile sind sonst nicht lesbar)
create function public.can_see_avatar(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.avatar_path = object_name
      and (p.id = auth.uid()
           or public.is_moderator()
           or (not public.is_blocked_between(p.id, auth.uid()) and not public.is_banned(p.id)))
  );
$$;
revoke execute on function public.can_see_avatar(text) from public, anon;
grant execute on function public.can_see_avatar(text) to authenticated;

-- Lesen: eigener Ordner (auch vor dem Eintragen), sonst nur über can_see_avatar
create policy "Profilbilder lesen" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.can_see_avatar(name))
  );
create policy "Moderatoren löschen Profilbilder" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and public.is_moderator());

-- Eigenes Profilbild eintragen (null = entfernen). Die Datei muss im eigenen Ordner liegen und existieren.
-- Liefert den vorherigen Pfad, damit die App die alte Datei danach löscht. Fehler: 'no_profile', 'invalid_path'
create function public.set_my_avatar(path text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  old text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select avatar_path into old from public.profiles where id = me;
  if not found then raise exception 'no_profile'; end if;
  if path is not null and (
    split_part(path, '/', 1) <> me::text
    or path !~ '^[0-9a-f-]{36}/[0-9a-f]{32}\.jpg$'
    or not exists (select 1 from storage.objects o where o.bucket_id = 'avatars' and o.name = path)
  ) then
    raise exception 'invalid_path';
  end if;
  update public.profiles set avatar_path = path where id = me;
  return old;
end;
$$;

-- Pfade der Profilbilder mehrerer Konten (höchstens 200); Blockierte und Gesperrte bleiben leer
create function public.avatar_paths(users uuid[])
returns table (user_id uuid, avatar_path text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.avatar_path
  from public.profiles p
  where p.id = any (users[1:200])
    and p.avatar_path is not null
    and (p.id = auth.uid()
         or public.is_moderator()
         or (not public.is_blocked_between(p.id, auth.uid()) and not public.is_banned(p.id)));
$$;

-- Moderation: unpassendes Profilbild entfernen (Datei löscht die App mit dem gelieferten Pfad)
alter table public.moderation_log drop constraint moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action in ('delete_post', 'delete_comment', 'delete_spot', 'delete_avatar', 'warn', 'ban', 'unban', 'resolve'));

create function public.mod_clear_avatar(who uuid, report uuid, note text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  old text;
begin
  perform public.require_moderator();
  select avatar_path into old from public.profiles where id = who;
  update public.profiles set avatar_path = null where id = who;
  perform public.mod_log('delete_avatar', who, report, note);
  return old;
end;
$$;

revoke execute on function public.set_my_avatar(text) from public, anon;
revoke execute on function public.avatar_paths(uuid[]) from public, anon;
revoke execute on function public.mod_clear_avatar(uuid, uuid, text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
grant execute on function public.avatar_paths(uuid[]) to authenticated;
grant execute on function public.mod_clear_avatar(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

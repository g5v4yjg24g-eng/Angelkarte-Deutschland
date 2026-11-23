-- Fangpunkt – Cloud-Sicherung, Etappe 1 Server (BACKUP_PLAN.md, Entscheidungen Nutzer 2026-11-23: Entwurf D,
-- gemeinsame Tabelle, Sicherung zuerst, Sync später). Nur hinzufügend – nichts wird geändert oder gelöscht.
--
-- backup_items: eine Zeile je gesichertem Eintrag (Fang, Ort, Session, Termin, Köder, Papier, …). `kind` ist frei
-- (a–z und _), so braucht eine neue Entität keine Migration; die App prüft den Inhalt mit ihren Zod-Schemata.
-- `rev` vergibt der Server (wachsend, über alle Konten gemeinsam eine Folge): Die App merkt sich je Gerät die zuletzt
-- gesehene `rev` und holt mit backup_list(since) nur Neueres – die Grundlage für den späteren Mehrgeräte-Abgleich.
-- Gelöschte Einträge bleiben als Löschmarke (deleted) stehen, damit ein anderes Gerät sie auch entfernt.
-- Dateien (Fotos, Routen) liegen im privaten Speicher „backups“; ein Foto, das schon als Beitragsfoto im Speicher
-- „post-photos“ liegt, wird nur verwiesen (file_ref = 'post-photos') und zählt nicht zur Grenze – so liegt nichts
-- doppelt auf dem Server. Zugriff nur über die Funktionen unten, auch Moderatoren lesen nichts.

create sequence public.backup_rev_seq;
revoke all on sequence public.backup_rev_seq from public, anon, authenticated;

create table public.backup_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{1,30}$'),
  item_id text not null check (char_length(item_id) between 1 and 100),
  rev bigint not null,
  deleted boolean not null default false,
  data jsonb,
  file_ref text check (file_ref in ('backups', 'post-photos')),
  file_path text,
  file_bytes bigint not null default 0 check (file_bytes >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, item_id),
  check (not deleted or (data is null and file_ref is null and file_path is null)),
  check ((file_ref is null) = (file_path is null))
);
create index backup_items_rev on public.backup_items (user_id, rev);
alter table public.backup_items enable row level security;
revoke all on table public.backup_items from anon, authenticated;

-- gesperrte Konten schreiben nichts mehr (wie bei den anderen Tabellen)
create trigger zz_deny_banned before insert or update on public.backup_items
  for each row execute function public.deny_banned_writes();

-- Privater Speicher: nur der Eigentümer, Pfad <Nutzer-ID>/…; Fotos und Routen, jede Datei höchstens 15 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 15728640, array['image/jpeg', 'image/webp', 'image/png', 'application/json'])
on conflict (id) do nothing;
create policy "Eigene Sicherung hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Eigene Sicherung ersetzen" on storage.objects
  for update to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Eigene Sicherung lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Eigene Sicherung löschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Einträge schreiben (höchstens 200 je Aufruf). Jeder Eintrag: {kind, item_id, deleted?, data, file_ref?, file_path?}.
-- Dateien müssen vorher hochgeladen sein und im eigenen Ordner liegen. Liefert je Eintrag die neue rev.
-- Fehler: 'not signed in', 'bad_items', 'too_many_items', 'item_too_large', 'bad_file', 'file_missing', 'backup_quota'
create function public.backup_put(items jsonb)
returns table (kind text, item_id text, rev bigint)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  it jsonb;
  k text; id text; del boolean; d jsonb; fref text; fpath text; fbytes bigint; fsize bigint;
  newrev bigint;
  used bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  if items is null or jsonb_typeof(items) <> 'array' then raise exception 'bad_items'; end if;
  if jsonb_array_length(items) > 200 then raise exception 'too_many_items'; end if;
  for it in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(it) <> 'object' then raise exception 'bad_items'; end if;
    k := it ->> 'kind';
    id := it ->> 'item_id';
    del := coalesce((it ->> 'deleted')::boolean, false);
    d := it -> 'data';
    fref := it ->> 'file_ref';
    fpath := it ->> 'file_path';
    fbytes := 0;
    if k is null or k !~ '^[a-z_]{1,30}$' or id is null or char_length(id) not between 1 and 100 then
      raise exception 'bad_items';
    end if;
    if del then
      d := null; fref := null; fpath := null;
    else
      if d is null or jsonb_typeof(d) <> 'object' then raise exception 'bad_items'; end if;
      if octet_length(d::text) > 65536 then raise exception 'item_too_large'; end if;
      if fref is not null or fpath is not null then
        if fref is null or fpath is null or fref not in ('backups', 'post-photos')
           or split_part(fpath, '/', 1) <> me::text
           or fpath !~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]{1,200}$' or fpath like '%..%' then
          raise exception 'bad_file';
        end if;
        select coalesce((o.metadata ->> 'size')::bigint, 0) into fsize
        from storage.objects o where o.bucket_id = fref and o.name = fpath;
        if not found then raise exception 'file_missing'; end if;
        -- Verweise auf Beitragsfotos zählen nicht zur Grenze (die Datei liegt ohnehin dort)
        if fref = 'backups' then fbytes := fsize; end if;
      end if;
    end if;
    newrev := nextval('public.backup_rev_seq');
    insert into public.backup_items as b (user_id, kind, item_id, rev, deleted, data, file_ref, file_path, file_bytes)
    values (me, k, id, newrev, del, d, fref, fpath, fbytes)
    on conflict (user_id, kind, item_id) do update
      set rev = excluded.rev, deleted = excluded.deleted, data = excluded.data, file_ref = excluded.file_ref,
          file_path = excluded.file_path, file_bytes = excluded.file_bytes, updated_at = now();
    kind := k; item_id := id; rev := newrev;
    return next;
  end loop;
  -- Grenze je Nutzer: 500 MB (Dateien + Daten); bei Überschreitung wird der ganze Aufruf zurückgenommen
  select coalesce(sum(b.file_bytes), 0) + coalesce(sum(octet_length(b.data::text)), 0) into used
  from public.backup_items b where b.user_id = me and not b.deleted;
  if used > 524288000 then raise exception 'backup_quota'; end if;
end;
$$;

-- Einträge mit rev > since, älteste zuerst (höchstens 1000 je Aufruf)
create function public.backup_list(since bigint default 0, max_rows integer default 500)
returns table (kind text, item_id text, rev bigint, deleted boolean, data jsonb, file_ref text, file_path text, file_bytes bigint)
language sql stable security definer set search_path = '' as $$
  select b.kind, b.item_id, b.rev, b.deleted, b.data, b.file_ref, b.file_path, b.file_bytes
  from public.backup_items b
  where b.user_id = auth.uid() and b.rev > coalesce(since, 0)
  order by b.rev
  limit least(greatest(coalesce(max_rows, 500), 1), 1000);
$$;

-- Verbrauch für die Anzeige „x MB von 500 MB“
create function public.backup_usage()
returns table (item_count integer, file_bytes bigint, data_bytes bigint, limit_bytes bigint, last_rev bigint)
language sql stable security definer set search_path = '' as $$
  select count(*) filter (where not b.deleted)::integer,
         coalesce(sum(b.file_bytes) filter (where not b.deleted), 0)::bigint,
         coalesce(sum(octet_length(b.data::text)) filter (where not b.deleted), 0)::bigint,
         524288000::bigint,
         coalesce(max(b.rev), 0)::bigint
  from public.backup_items b where b.user_id = auth.uid();
$$;

-- Die ganze Sicherung löschen („Cloud-Sicherung löschen“). Liefert die Pfade im Speicher „backups“,
-- die die App danach über die Speicher-Schnittstelle entfernt (Dateien lassen sich nicht aus SQL löschen).
create function public.backup_delete_all()
returns setof text
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return query
    with gone as (delete from public.backup_items b where b.user_id = auth.uid() returning b.file_ref, b.file_path)
    select g.file_path from gone g where g.file_ref = 'backups';
end;
$$;

revoke execute on function public.backup_put(jsonb), public.backup_list(bigint, integer),
  public.backup_usage(), public.backup_delete_all() from public, anon;
grant execute on function public.backup_put(jsonb), public.backup_list(bigint, integer),
  public.backup_usage(), public.backup_delete_all() to authenticated;

notify pgrst, 'reload schema';

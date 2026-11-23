\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),('00000000-0000-0000-0000-0000000000b1','bert','Bert');
-- Dateien, wie sie die App vorher hochlädt: A: ein Foto und eine Route in „backups“ (je mit Größe), ein Beitragsfoto;
-- B: eine Datei in „backups“; A: eine riesige Datei für die Grenze
insert into storage.objects(bucket_id, name, metadata) values
  ('backups',    '00000000-0000-0000-0000-0000000000a1/photos/f1.jpg',   '{"size": 400000}'),
  ('backups',    '00000000-0000-0000-0000-0000000000a1/routes/s1.json',  '{"size": 100000}'),
  ('post-photos','00000000-0000-0000-0000-0000000000a1/10000000-0000-0000-0000-000000000001/1.jpg', '{"size": 350000}'),
  ('backups',    '00000000-0000-0000-0000-0000000000b1/photos/g1.jpg',   '{"size": 1000}'),
  ('backups',    '00000000-0000-0000-0000-0000000000a1/photos/gross.jpg','{"size": 600000000}');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to anon, authenticated;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', case when u = '' then '' else '00000000-0000-0000-0000-0000000000'||u end, false); $$;
grant execute on function public.as_user(text) to anon, authenticated;

-- 1. ohne Anmeldung und ohne Tabellenrechte
set role anon;
select as_user('') \g /dev/null
select 'Ohne Anmeldung', t($q$ select count(*)::text from public.backup_put('[]'::jsonb) $q$);
reset role;
set role authenticated;
select as_user('a1') \g /dev/null
select 'Tabelle direkt lesen', t($q$ select count(*)::text from public.backup_items $q$);
select 'Tabelle direkt schreiben', t($q$ insert into public.backup_items(user_id, kind, item_id, rev) values ('00000000-0000-0000-0000-0000000000a1','catch','x',1) returning 'ok' $q$);

-- 2. schreiben: Daten, Foto in „backups“, Verweis auf Beitragsfoto, Route
select 'Leere Liste', t($q$ select count(*)::text from public.backup_put('[]'::jsonb) $q$);
select 'Fang + Foto + Verweis + Route', t($q$ select string_agg(kind || ':' || item_id || ':' || (rev > 0)::text, ', ' order by rev) from public.backup_put($j$[
  {"kind":"catch","item_id":"c1","data":{"species":"hecht","lengthCm":82}},
  {"kind":"photo","item_id":"f1","data":{"mime":"image/jpeg"},"file_ref":"backups","file_path":"00000000-0000-0000-0000-0000000000a1/photos/f1.jpg"},
  {"kind":"photo","item_id":"p1","data":{"mime":"image/jpeg"},"file_ref":"post-photos","file_path":"00000000-0000-0000-0000-0000000000a1/10000000-0000-0000-0000-000000000001/1.jpg"},
  {"kind":"track","item_id":"s1","data":{"points":3},"file_ref":"backups","file_path":"00000000-0000-0000-0000-0000000000a1/routes/s1.json"}
]$j$::jsonb) $q$);
select 'rev wächst', t($q$ select (select count(distinct rev) from public.backup_list(0, 100))::text $q$);
select 'Verbrauch (Verweis zählt nicht)', t($q$ select item_count || ' Einträge, Dateien ' || file_bytes || ' B, limit ' || limit_bytes from public.backup_usage() $q$);

-- 3. Fehlerfälle
select 'Fremde Datei', t($q$ select count(*)::text from public.backup_put($j$[{"kind":"photo","item_id":"x","data":{},"file_ref":"backups","file_path":"00000000-0000-0000-0000-0000000000b1/photos/g1.jpg"}]$j$::jsonb) $q$);
select 'Datei fehlt', t($q$ select count(*)::text from public.backup_put($j$[{"kind":"photo","item_id":"x","data":{},"file_ref":"backups","file_path":"00000000-0000-0000-0000-0000000000a1/photos/nicht-da.jpg"}]$j$::jsonb) $q$);
select 'Pfad mit ..', t($q$ select count(*)::text from public.backup_put($j$[{"kind":"photo","item_id":"x","data":{},"file_ref":"backups","file_path":"00000000-0000-0000-0000-0000000000a1/../b1/g1.jpg"}]$j$::jsonb) $q$);
select 'Falscher Speicher', t($q$ select count(*)::text from public.backup_put($j$[{"kind":"photo","item_id":"x","data":{},"file_ref":"avatars","file_path":"00000000-0000-0000-0000-0000000000a1/photos/f1.jpg"}]$j$::jsonb) $q$);
select 'Art ungültig', t($q$ select count(*)::text from public.backup_put($j$[{"kind":"Catch!","item_id":"x","data":{}}]$j$::jsonb) $q$);
select 'Daten fehlen', t($q$ select count(*)::text from public.backup_put($j$[{"kind":"catch","item_id":"x"}]$j$::jsonb) $q$);
select 'Zu großer Eintrag', t($q$ select count(*)::text from public.backup_put(jsonb_build_array(jsonb_build_object('kind','catch','item_id','x','data',jsonb_build_object('text', repeat('a', 70000))))) $q$);
select 'Zu viele Einträge', t($q$ select count(*)::text from public.backup_put((select jsonb_agg(jsonb_build_object('kind','catch','item_id','z'||n,'data','{}'::jsonb)) from generate_series(1,201) n)) $q$);
select 'Grenze 500 MB', t($q$ select count(*)::text from public.backup_put($j$[{"kind":"photo","item_id":"gross","data":{},"file_ref":"backups","file_path":"00000000-0000-0000-0000-0000000000a1/photos/gross.jpg"}]$j$::jsonb) $q$);
select 'Nach Fehlern unverändert', t($q$ select count(*)::text from public.backup_list(0, 100) $q$);

-- 4. ändern, löschen (Löschmarke), nur Neueres holen
select 'Fang ändern', t($q$ select count(*)::text from public.backup_put($j$[{"kind":"catch","item_id":"c1","data":{"species":"hecht","lengthCm":90}}]$j$::jsonb) $q$);
select 'Änderung angekommen', t($q$ select data ->> 'lengthCm' from public.backup_list(0, 100) where item_id = 'c1' $q$);
select 'Zeilen insgesamt', t($q$ select count(*)::text from public.backup_list(0, 100) $q$);
select 'Löschmarke', t($q$ select count(*)::text from public.backup_put($j$[{"kind":"catch","item_id":"c1","deleted":true}]$j$::jsonb) $q$);
select 'Gelöscht ohne Daten', t($q$ select (deleted::text || ',' || (data is null)::text) from public.backup_list(0, 100) where item_id = 'c1' $q$);
select 'Seit letzter rev', t($q$ select count(*)::text from public.backup_list((select max(rev) from public.backup_list(0, 100)), 100) $q$);
select 'Seit vorletzter rev', t($q$ select count(*)::text from public.backup_list((select max(rev) - 1 from public.backup_list(0, 100)), 100) $q$);
select 'Verbrauch nach Löschen', t($q$ select item_count || ' Einträge, Dateien ' || file_bytes from public.backup_usage() $q$);
select 'Seitengröße', t($q$ select count(*)::text from public.backup_list(0, 2) $q$);

-- 5. ein anderes Konto sieht nichts
select as_user('b1') \g /dev/null
select 'B sieht nichts', t($q$ select count(*)::text from public.backup_list(0, 100) $q$);
select 'B Verbrauch', t($q$ select item_count || ',' || file_bytes from public.backup_usage() $q$);
select 'B löscht nur eigenes', t($q$ select count(*)::text from public.backup_delete_all() $q$);
select as_user('a1') \g /dev/null
select 'A unverändert', t($q$ select count(*)::text from public.backup_list(0, 100) $q$);

-- 6. gesperrtes Konto schreibt nichts mehr
reset role;
insert into public.bans(user_id, reason) values ('00000000-0000-0000-0000-0000000000b1', 'Test');
set role authenticated;
select as_user('b1') \g /dev/null
select 'Gesperrt', t($q$ select count(*)::text from public.backup_put($j$[{"kind":"catch","item_id":"c1","data":{}}]$j$::jsonb) $q$);

-- 7. alles löschen: liefert nur die Pfade in „backups“ (nicht die Verweise)
select as_user('a1') \g /dev/null
select 'Alles löschen', t($q$ select string_agg(p, ', ' order by p) from public.backup_delete_all() p $q$);
select 'Danach leer', t($q$ select count(*)::text from public.backup_list(0, 100) $q$);
reset role;
select 'Beitragsfoto bleibt im Speicher', count(*) from storage.objects where bucket_id = 'post-photos';

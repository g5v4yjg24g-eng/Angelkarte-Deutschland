\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000d1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl'),
  ('00000000-0000-0000-0000-0000000000d1','dora','Dora');
-- Anna und Bert folgen sich gegenseitig (Freunde); Carl ist fremd; Dora ist von Anna blockiert
insert into public.follows(follower, followee, status, accepted_at) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','accepted',now());
insert into public.blocks(blocker, blocked) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1');
insert into public.push_devices(token, user_id) values
  (repeat('b',64),'00000000-0000-0000-0000-0000000000b1'),(repeat('c',64),'00000000-0000-0000-0000-0000000000c1');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated, anon;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', case when u = '' then '' else '00000000-0000-0000-0000-0000000000'||u end, false); $$;
grant execute on function public.as_user(text) to authenticated, anon;
create function public.pushes(u text) returns text language sql security definer as $$
  select coalesce(string_agg(kind||':'||coalesce(excerpt,''), ',' order by created_at), '∅') from public.push_outbox
  where user_id = ('00000000-0000-0000-0000-0000000000'||u)::uuid $$;
grant execute on function public.pushes(text) to authenticated, anon;
set role authenticated;
select as_user('a1') \g /dev/null
-- 1. Einladung zum Termin
select 'Einladen (Bert Freund, Carl fremd, Dora blockiert)', t($q$ select public.invite_to_trip('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000c1'::uuid,'00000000-0000-0000-0000-0000000000d1'::uuid,'00000000-0000-0000-0000-0000000000a1'::uuid], 'Abendansitz', 'Sa 14.11.')::text $q$);
select 'Einladung nochmal (keine doppelte Mitteilung)', t($q$ select public.invite_to_trip('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000b1'::uuid], 'Abendansitz', 'Sa 14.11.')::text $q$);
select 'Mitteilung an Bert', pushes('b1');
select 'Nichts an Carl', pushes('c1');
-- 2. Start
select 'Start ohne einladbare Person', t($q$ select public.start_trip_session('Allein', null, array['00000000-0000-0000-0000-0000000000c1'::uuid,'00000000-0000-0000-0000-0000000000d1'::uuid])::text is null $q$);
select 'Start mit Bert', (set_config('t.g', public.start_trip_session('Abendansitz', 'De Wittsee', array['00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000c1'::uuid]::uuid[])::text, false) is not null)::text;
select 'Start-Mitteilung an Bert', pushes('b1');
select 'Keine Start-Mitteilung an Carl', pushes('c1');
select 'Anna hat keine offene Anfrage', t($q$ select count(*)::text from public.my_start_requests() $q$);
select as_user('b1') \g /dev/null
select 'Bert sieht die Anfrage', t($q$ select r.host_display_name||'/'||r.title||'/'||r.water_name from public.my_start_requests() r $q$);
select 'Bert sagt zu', t($q$ select public.respond_group_invite(current_setting('t.g')::uuid, true)::text $q$);
select 'Danach keine offene Anfrage', t($q$ select count(*)::text from public.my_start_requests() $q$);
select 'Teilnehmer', t($q$ select string_agg(display_name||':'||status, ',' order by is_host desc) from public.group_session_members_list(current_setting('t.g')::uuid) $q$);
select as_user('c1') \g /dev/null
select 'Carl (nicht eingeladen) sieht nichts', t($q$ select count(*)::text from public.my_start_requests() $q$);
-- Abbrechen: Ersteller beendet, die Anfrage verschwindet
select as_user('a1') \g /dev/null
select 'Zweiter Start', (set_config('t.g2', public.start_trip_session('Morgens', null, array['00000000-0000-0000-0000-0000000000b1'::uuid])::text, false) is not null)::text;
select as_user('b1') \g /dev/null
select 'Bert sieht zweite Anfrage', t($q$ select count(*)::text from public.my_start_requests() $q$);
select as_user('a1') \g /dev/null
select 'Ersteller bricht ab', t($q$ select public.end_group_session(current_setting('t.g2')::uuid)::text $q$);
select as_user('b1') \g /dev/null
select 'Anfrage weg', t($q$ select count(*)::text from public.my_start_requests() $q$);
select as_user('') \g /dev/null
select 'Ohne Anmeldung', t($q$ select public.invite_to_trip('00000000-0000-0000-0000-0000000000f1', '{}')::text $q$);

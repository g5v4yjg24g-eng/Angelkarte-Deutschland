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
-- Anna startet eine gemeinsame Session, Bert ist dabei, Carl nicht
select 'Session', (set_config('t.g', public.start_trip_session('Abendansitz', 'De Wittsee', array['00000000-0000-0000-0000-0000000000b1'::uuid])::text, false) is not null)::text;
select as_user('b1') \g /dev/null
select 'Bert sagt zu', t($q$ select public.respond_group_invite(current_setting('t.g')::uuid, true)::text $q$);
-- 1. Pause melden
select as_user('a1') \g /dev/null
select 'Anna meldet Pause', (set_config('t.p', public.signal_session(current_setting('t.g')::uuid, 'pause')::text, false) is not null)::text;
select 'Mitteilung an Bert', pushes('b1');
select 'Keine Mitteilung an Carl', pushes('c1');
select 'Keine Mitteilung an Anna', pushes('a1');
select as_user('b1') \g /dev/null
select 'Bert sieht die Pause', t($q$ select s.kind||'/'||s.by_display_name||'/'||s.session_title from public.my_session_signals() s $q$);
select as_user('c1') \g /dev/null
select 'Carl sieht nichts', t($q$ select count(*)::text from public.my_session_signals() $q$);
select 'Carl kann nicht antworten', t($q$ select public.answer_session_signal(current_setting('t.p')::uuid, true)::text $q$);
select 'Carl kann nichts melden', t($q$ select public.signal_session(current_setting('t.g')::uuid, 'pause')::text $q$);
-- 2. Weiter: nur die neueste Meldung je Person zählt
select as_user('a1') \g /dev/null
select 'Anna meldet Weiter', (set_config('t.r', public.signal_session(current_setting('t.g')::uuid, 'resume')::text, false) is not null)::text;
select as_user('b1') \g /dev/null
select 'Bert sieht nur Weiter', t($q$ select string_agg(s.kind, ',') from public.my_session_signals() s $q$);

select as_user('a1') \g /dev/null
select 'Anna antwortet auf eigene', t($q$ select public.answer_session_signal(current_setting('t.r')::uuid, true)::text $q$);
-- 3. Antwort
select as_user('b1') \g /dev/null
select 'Bert nimmt an', t($q$ select public.answer_session_signal(current_setting('t.r')::uuid, true)::text $q$);
select 'Bert antwortet nochmal (ändert nichts)', t($q$ select public.answer_session_signal(current_setting('t.r')::uuid, false)::text $q$);
select 'Antworten sind nicht direkt lesbar', t($q$ select accepted::text from public.session_signal_answers where signal_id = current_setting('t.r')::uuid $q$);
select 'Nichts mehr offen', t($q$ select count(*)::text from public.my_session_signals() $q$);
-- 4. Unbekannte Art
select as_user('a1') \g /dev/null
select 'Unbekannte Art', t($q$ select public.signal_session(current_setting('t.g')::uuid, 'sprengen')::text $q$);
-- 5. Begrenzung: 30 Meldungen je Stunde (2 sind schon gemeldet: Pause und Weiter)
select 'Viele Meldungen', t($q$ select count(*)::text from (select public.signal_session(current_setting('t.g')::uuid, 'pause') from generate_series(1, 28)) x $q$);
select 'Die 31. wird abgelehnt', t($q$ select public.signal_session(current_setting('t.g')::uuid, 'pause')::text $q$);
-- 6. Ende der gemeinsamen Session: Pause/Weiter nicht mehr, Ende schon (Bert meldet, Anna sieht es)
select public.end_group_session(current_setting('t.g')::uuid) \g /dev/null
select as_user('b1') \g /dev/null
select 'Pause nach dem Ende', t($q$ select public.signal_session(current_setting('t.g')::uuid, 'pause')::text $q$);
select 'Ende melden', (set_config('t.e', public.signal_session(current_setting('t.g')::uuid, 'end')::text, false) is not null)::text;
select as_user('a1') \g /dev/null
select 'Anna sieht Ende (Session beendet)', t($q$ select s.kind||'/'||s.by_display_name||'/'||s.session_ended::text from public.my_session_signals() s $q$);
select as_user('') \g /dev/null
select 'Ohne Anmeldung', t($q$ select public.signal_session(current_setting('t.g')::uuid, 'pause')::text $q$);

\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000d1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl'),
  ('00000000-0000-0000-0000-0000000000d1','dora','Dora');
-- Anna und Bert sind gegenseitige Follower; Carl ist fremd; Dora wird von Anna blockiert
insert into public.follows(follower, followee, status, accepted_at) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','accepted',now());
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated, anon;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', case when u = '' then '' else '00000000-0000-0000-0000-0000000000'||u end, false); $$;
grant execute on function public.as_user(text) to authenticated, anon;
create function public.stats(g uuid) returns text language sql as $$
  select coalesce(string_agg(substr(user_id::text, 35)||':'||caught||'/'||bites||'/'||coalesce(longest_cm::text,'-'), ',' order by user_id), '∅')
  from public.group_session_stats_list(g) $$;
grant execute on function public.stats(uuid) to authenticated, anon;
set role authenticated;
select as_user('a1') \g /dev/null
select 'Tabelle direkt lesen', t($q$ select count(*)::text from public.group_session_stats $q$);
select 'Session anlegen', (set_config('t.g', public.create_group_session('Angeltag', null)::text, false) is not null)::text;
select 'Bert einladen', t($q$ select public.invite_to_group_session(current_setting('t.g')::uuid, array['00000000-0000-0000-0000-0000000000b1'::uuid])::text $q$);
select 'Dora einladen', t($q$ select public.invite_to_group_session(current_setting('t.g')::uuid, array['00000000-0000-0000-0000-0000000000d1'::uuid])::text $q$);
select 'Anna lädt hoch', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":3,"bites":7,"entries":9,"longest_cm":62.5,"longest_species":"pike","active_ms":9000000,"distance_m":7400}')::text $q$);
select 'Nochmal (ersetzt)', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":4,"bites":7,"entries":9,"longest_cm":62.5,"longest_species":"pike","active_ms":9000000,"distance_m":null}')::text $q$);
select 'Ohne Fisch', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":0,"bites":0,"entries":0,"active_ms":0}')::text $q$);
select 'Unsinn', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":-1,"bites":0,"entries":0,"active_ms":0}')::text $q$);
select 'Art kaputt', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":1,"bites":1,"entries":1,"longest_species":"X Y","active_ms":0}')::text $q$);
select 'Kein Objekt', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '[1]')::text $q$);
select 'Nochmal gültig', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":4,"bites":7,"entries":9,"longest_cm":62.5,"longest_species":"pike","active_ms":9000000,"distance_m":7400}')::text $q$);
select 'Eingeladene (noch nicht dabei) laden nicht hoch', 'siehe unten';
select as_user('b1') \g /dev/null
select 'Bert eingeladen: hochladen', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":1,"bites":2,"entries":2,"active_ms":1000}')::text $q$);
select 'Bert eingeladen: lesen', stats(current_setting('t.g')::uuid);
select 'Bert sagt zu', t($q$ select public.respond_group_invite(current_setting('t.g')::uuid, true)::text $q$);
select 'Bert lädt hoch', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":1,"bites":2,"entries":2,"active_ms":1000}')::text $q$);
select 'Bert liest beide', stats(current_setting('t.g')::uuid);
select as_user('c1') \g /dev/null
select 'Fremder liest', stats(current_setting('t.g')::uuid);
select 'Fremder lädt hoch', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":1,"bites":2,"entries":2,"active_ms":1000}')::text $q$);
select as_user('d1') \g /dev/null
select 'Dora (nur eingeladen) liest', stats(current_setting('t.g')::uuid);
select 'Dora lädt hoch', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":1,"bites":2,"entries":2,"active_ms":1000}')::text $q$);
select 'Dora sagt zu', t($q$ select public.respond_group_invite(current_setting('t.g')::uuid, true)::text $q$);
select 'Dora lädt hoch (dabei)', t($q$ select public.set_my_group_stats(current_setting('t.g')::uuid, '{"caught":9,"bites":9,"entries":9,"active_ms":1000}')::text $q$);
select as_user('') \g /dev/null
select 'Ohne Anmeldung lesen', stats(current_setting('t.g')::uuid);

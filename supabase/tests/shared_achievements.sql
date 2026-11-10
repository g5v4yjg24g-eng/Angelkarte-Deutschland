\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000d1'),('00000000-0000-0000-0000-0000000000e1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl'),
  ('00000000-0000-0000-0000-0000000000d1','dora','Dora');
-- Anna und Bert sind Freunde, Carl ist fremd, Dora hat Anna blockiert
insert into public.friendships(requester, addressee, status, accepted_at) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','accepted', now());
insert into public.blocks(blocker, blocked) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated, anon;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', case when u = '' then '' else '00000000-0000-0000-0000-0000000000'||u end, false); $$;
grant execute on function public.as_user(text) to authenticated, anon;
create function public.ach(u text) returns text language sql as $$
  select string_agg(coalesce(key,'-')||case when visible then '' else '(verborgen)' end, ',' order by key)
  from public.user_achievements(('00000000-0000-0000-0000-0000000000'||u)::uuid) $$;
grant execute on function public.ach(text) to authenticated, anon;
set role authenticated;
select as_user('a1') \g /dev/null
select 'Tabelle direkt lesen', t($q$ select count(*)::text from public.user_achievements $q$);
select 'Tabelle direkt schreiben', t($q$ insert into public.user_achievements values ('00000000-0000-0000-0000-0000000000a1','first',now()) returning 'ok' $q$);
select 'Standard-Sichtbarkeit', t($q$ select public.my_achievements_visibility() $q$);
select 'Hochladen', t($q$ select public.set_my_achievements('{"first":"2026-11-01T10:00:00Z","catches:bronze":"2026-11-02T10:00:00Z","waters:gold":"2099-01-01T00:00:00Z","hacker:gold":"2026-11-01T00:00:00Z"}')::text $q$);
select 'Zukunft gekappt', t($q$ select (x.unlocked_at <= now())::text from public.user_achievements('00000000-0000-0000-0000-0000000000a1') x where x.key = 'waters:gold' $q$);
select 'Nochmal (nimmt nur dazu)', t($q$ select public.set_my_achievements('{"first":"2020-01-01T00:00:00Z","species:bronze":"2026-11-03T10:00:00Z"}')::text $q$);
select 'Datum bleibt', t($q$ select unlocked_at::date::text from public.user_achievements('00000000-0000-0000-0000-0000000000a1') where key = 'first' $q$);
select 'Kein Objekt', t($q$ select public.set_my_achievements('[1]')::text $q$);
select 'Kaputtes Datum', t($q$ select public.set_my_achievements('{"first":"gestern"}')::text $q$);
select 'Zu viele', t($q$ select public.set_my_achievements((select jsonb_object_agg('k'||n, '2026-01-01') from generate_series(1,23) n))::text $q$);
select 'Selbst', ach('a1');
select as_user('b1') \g /dev/null
select 'Freund (friends)', ach('a1');
select 'Bert ohne Erfolge', ach('b1');
select as_user('c1') \g /dev/null
select 'Fremder (friends)', ach('a1');
select 'Unbekanntes Konto', t($q$ select count(*)::text from public.user_achievements('00000000-0000-0000-0000-0000000000ff') $q$);
select as_user('a1') \g /dev/null
select 'Falsche Sichtbarkeit', t($q$ select public.set_my_achievements_visibility('alle')::text $q$);
select 'Auf public', t($q$ select public.set_my_achievements_visibility('public')::text $q$);
select as_user('c1') \g /dev/null
select 'Fremder (public)', ach('a1');
select as_user('d1') \g /dev/null
select 'Blockierende (public)', ach('a1');
select as_user('a1') \g /dev/null
select 'Auf private', t($q$ select public.set_my_achievements_visibility('private')::text $q$);
select 'Selbst (private)', ach('a1');
select as_user('b1') \g /dev/null
select 'Freund (private)', ach('a1');
-- Ohne Profil
select as_user('e1') \g /dev/null
select 'Ohne Profil Sichtbarkeit', t($q$ select public.set_my_achievements_visibility('public')::text $q$);
-- Gesperrt
reset role;
insert into public.bans(user_id, reason) values ('00000000-0000-0000-0000-0000000000a1','Test');
set role authenticated;
select as_user('a1') \g /dev/null
select 'Gesperrt hochladen', t($q$ select public.set_my_achievements('{"big:gold":"2026-11-01T00:00:00Z"}')::text $q$);
select as_user('b1') \g /dev/null
select 'Gesperrt sehen (Freund)', ach('a1');
-- Ohne Anmeldung
reset role;
set role anon;
select as_user('') \g /dev/null
select 'Anon lesen', t($q$ select count(*)::text from public.user_achievements('00000000-0000-0000-0000-0000000000a1') $q$);
select 'Anon schreiben', t($q$ select public.set_my_achievements('{}')::text $q$);

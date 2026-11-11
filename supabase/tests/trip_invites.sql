\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000d1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl'),
  ('00000000-0000-0000-0000-0000000000d1','dora','Dora');
-- Anna und Bert sind Freunde; Carl fremd; Dora von Anna blockiert
insert into public.follows(follower, followee, status, accepted_at) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','accepted',now());
insert into public.blocks(blocker, blocked) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1');
insert into public.push_devices(token, user_id) values (repeat('b',64),'00000000-0000-0000-0000-0000000000b1');
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
select 'Tabelle direkt lesen', t($q$ select count(*)::text from public.trip_invites $q$);
select 'Einladen (Bert Freund, Carl fremd, Dora blockiert, selbst)', t($q$ select public.invite_to_trip2('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000b1'::uuid,'00000000-0000-0000-0000-0000000000c1'::uuid,'00000000-0000-0000-0000-0000000000d1'::uuid,'00000000-0000-0000-0000-0000000000a1'::uuid], 'Abendansitz', 'De Wittsee', date '2099-05-17', '17:00', '21:00')::text $q$);
select 'Ohne Datum', t($q$ select public.invite_to_trip2('00000000-0000-0000-0000-0000000000f2', array['00000000-0000-0000-0000-0000000000b1'::uuid])::text $q$);
select 'Mitteilung an Bert (einmal)', pushes('b1');
select 'Nochmal einladen (Angaben aktualisieren)', t($q$ select public.invite_to_trip2('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000b1'::uuid], 'Abendansitz neu', 'De Wittsee', date '2099-05-17', '18:00', null)::text $q$);
select 'Mitteilung bleibt einmal', pushes('b1');
select 'Ersteller sieht Stand', t($q$ select string_agg(user_id::text||':'||status, ',') from public.trip_invite_statuses(array['00000000-0000-0000-0000-0000000000f1'::uuid]) $q$);
select as_user('b1') \g /dev/null
select 'Bert sieht Einladung', t($q$ select r.host_display_name||'/'||r.title||'/'||r.from_time||'/'||r.status from public.my_trip_invites() r $q$);
select 'Bert sieht Stände anderer nicht', t($q$ select count(*)::text from public.trip_invite_statuses(array['00000000-0000-0000-0000-0000000000f1'::uuid]) $q$);
select 'Bert sagt zu', t($q$ select public.respond_trip_invite('00000000-0000-0000-0000-0000000000f1', true)::text $q$);
select 'Zugesagt bleibt sichtbar', t($q$ select status from public.my_trip_invites() $q$);
select 'Unbekannte Einladung', t($q$ select public.respond_trip_invite('00000000-0000-0000-0000-0000000000f9', true)::text $q$);
select 'Bert überschreibt fremden Termin nicht', t($q$ select public.invite_to_trip2('00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000a1'::uuid], 'X', null, current_date, null, null)::text $q$);
select as_user('a1') \g /dev/null
select 'Ersteller sieht Zusage', t($q$ select status from public.trip_invite_statuses(array['00000000-0000-0000-0000-0000000000f1'::uuid]) $q$);
select 'Ersteller zieht zurück', t($q$ select public.cancel_trip_invites('00000000-0000-0000-0000-0000000000f1')::text $q$);
select as_user('b1') \g /dev/null
select 'Danach keine Einladung', t($q$ select count(*)::text from public.my_trip_invites() $q$);
select as_user('c1') \g /dev/null
select 'Fremder sieht nichts', t($q$ select count(*)::text from public.my_trip_invites() $q$);
select as_user('') \g /dev/null
select 'Ohne Anmeldung', t($q$ select public.respond_trip_invite('00000000-0000-0000-0000-0000000000f1', true)::text $q$);

\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000d1'),('00000000-0000-0000-0000-0000000000e1');
insert into public.profiles(id, username, display_name, created_at) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna', now() - interval '40 days'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000c1','hass.angler','Carl', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000d1','dora','Dora', now() - interval '1 day');
insert into public.moderators(user_id, role) values ('00000000-0000-0000-0000-0000000000a1','founder'),('00000000-0000-0000-0000-0000000000d1','moderator');
insert into public.reports(reporter, target_type, target_id, target_user, reason, status, created_at, handled_at) values
  ('00000000-0000-0000-0000-0000000000b1','user','x','00000000-0000-0000-0000-0000000000c1','spam','done', now() - interval '5 days', now() - interval '5 days' + interval '2 hours'),
  ('00000000-0000-0000-0000-0000000000b1','user','y','00000000-0000-0000-0000-0000000000c1','abuse','done', now() - interval '4 days', now() - interval '4 days' + interval '4 hours'),
  ('00000000-0000-0000-0000-0000000000d1','post','z','00000000-0000-0000-0000-0000000000c1','abuse','open', now() - interval '1 day', null),
  ('00000000-0000-0000-0000-0000000000d1','post','w','00000000-0000-0000-0000-0000000000b1','spam','open', now() - interval '60 days', null);
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000'||u, false); $$;
grant execute on function public.as_user(text) to authenticated;
set role authenticated;
select as_user('a1') \g /dev/null
-- Rollen
select 'Eigene Rolle', t($q$ select public.mod_my_role() $q$);
select 'Rollen', t($q$ select string_agg(username||':'||role, ',') from public.mod_roles() $q$);
select 'Founder darf E-Mail', t($q$ select public.mod_can_search_email()::text $q$);
-- Gesperrte Nutzernamen
select 'Sperren (contains, mit Punkten)', t($q$ select public.mod_add_blocked_username('H.a_ss','contains','Hass')::text $q$);
select 'Sperren (exact)', t($q$ select public.mod_add_blocked_username('kevin','exact',null)::text $q$);
select 'Doppelt', t($q$ select public.mod_add_blocked_username('hass','exact',null)::text $q$);
select 'Ungültig', t($q$ select public.mod_add_blocked_username('a','exact',null)::text $q$);
select 'Liste mit Treffern', t($q$ select string_agg(pattern||':'||kind||':'||matches||':'||coalesce(moderator_name,'-'), ',') from public.mod_blocked_usernames() $q$);
select 'Frei? hassangler2', t($q$ select public.username_available('hassangler2')::text $q$);
select 'Frei? kevin', t($q$ select public.username_available('kevin')::text $q$);
select 'Frei? kevin2', t($q$ select public.username_available('kevin2')::text $q$);
select as_user('e1') \g /dev/null
select 'E legt h_a.s.s an', t($q$ insert into public.profiles(id, username, display_name) values ('00000000-0000-0000-0000-0000000000e1','h_a.s.s','E') returning 'ok' $q$);
select 'E legt kevin an', t($q$ insert into public.profiles(id, username, display_name) values ('00000000-0000-0000-0000-0000000000e1','kevin','E') returning 'ok' $q$);
select 'E legt kevin2 an', t($q$ insert into public.profiles(id, username, display_name) values ('00000000-0000-0000-0000-0000000000e1','kevin2','E') returning 'ok' $q$);
select as_user('c1') \g /dev/null
select 'Bestehendes Konto ändert Anzeigename', t($q$ with u as (update public.profiles set display_name='Carl B' where id='00000000-0000-0000-0000-0000000000c1' returning 'ok') select * from u $q$);
select as_user('a1') \g /dev/null
select 'Entsperren', t($q$ select public.mod_remove_blocked_username('kevin')::text $q$);
select 'Entsperren unbekannt', t($q$ select public.mod_remove_blocked_username('kevin')::text $q$);
-- Protokoll
select 'Protokoll', t($q$ select string_agg(action||':'||coalesce(detail,'-')||':'||moderator_name, ' > ' order by created_at, action) from public.mod_log_list() $q$);
select 'Protokoll gefiltert', t($q$ select count(*)::text from public.mod_log_list('unblock_name') $q$);
select 'Protokoll ältere', t($q$ select count(*)::text from public.mod_log_list(null, now() - interval '1 day') $q$);
-- Statistik
select 'Statistik 30', t($q$ select concat_ws(' ', s->>'reports', s->>'reports_done', s->'by_reason'->>'abuse', s->'by_reason'->>'spam', s->'by_kind'->>'post', s->>'median_hours', s->>'new_users', s->'actions'->>'block_name', jsonb_array_length(s->'weeks') between 5 and 6) from (select public.mod_stats(30) s) x $q$);
select 'Statistik 90', t($q$ select (public.mod_stats(90)->>'reports') $q$);
select 'Statistik falsch', t($q$ select public.mod_stats(5)::text $q$);
-- Moderator ohne Founder
select as_user('d1') \g /dev/null
select 'D: Rolle', t($q$ select public.mod_my_role() $q$);
select 'D: E-Mail', t($q$ select public.mod_can_search_email()::text $q$);
select 'D: E-Mail-Suche', t($q$ select count(*)::text from public.mod_users('x@example.org') $q$);
select 'D: Namen sperren', t($q$ select public.mod_add_blocked_username('spam','contains',null)::text $q$);
-- Normales Konto
select as_user('b1') \g /dev/null
select 'B: Rolle', t($q$ select public.mod_my_role() $q$);
select 'B: Rollen', t($q$ select count(*)::text from public.mod_roles() $q$);
select 'B: Founder?', t($q$ select public.is_founder()::text $q$);
select 'B: macht sich zum Founder', t($q$ with u as (update public.moderators set role='founder' returning 'ok') select * from u $q$);
select 'B: Namensliste', t($q$ select count(*)::text from public.mod_blocked_usernames() $q$);
select 'B: Tabelle', t($q$ select count(*)::text from public.blocked_usernames $q$);
select 'B: Namen sperren', t($q$ select public.mod_add_blocked_username('anna','exact',null)::text $q$);
select 'B: Protokoll', t($q$ select count(*)::text from public.mod_log_list() $q$);
select 'B: Statistik', t($q$ select public.mod_stats(30)::text $q$);
select 'B: Prüffunktion', t($q$ select public.username_blocked('hass')::text $q$);
reset role;
select 'Zweiter Founder', t($q$ update public.moderators set role='founder' where user_id='00000000-0000-0000-0000-0000000000d1' returning 'ok' $q$);

\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000d1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl'),
  ('00000000-0000-0000-0000-0000000000d1','dora','Dora');
-- Anna und Bert sind Freunde; Dora von Anna blockiert. Anna hat KEIN Gerät (Mitteilungen gehen trotzdem in die Liste).
insert into public.follows(follower, followee, status, accepted_at) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','accepted',now());
insert into public.blocks(blocker, blocked) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1');
-- Annas öffentlicher Beitrag
insert into public.posts(id, author_id, caption, visibility, photo_paths, created_at)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','Hecht','public',
          array['00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-0000000000e1/0.jpg'], '2026-11-01T10:00:00Z');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated, anon;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', case when u = '' then '' else '00000000-0000-0000-0000-0000000000'||u end, false); $$;
grant execute on function public.as_user(text) to authenticated, anon;
set role authenticated;
select as_user('b1') \g /dev/null
select 'Tabelle direkt lesen', t($q$ select count(*)::text from public.notifications $q$);
reset role;
insert into public.post_likes(post_id, user_id) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000b1');
insert into public.post_comments(id, post_id, author_id, body)
  values (gen_random_uuid(),'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000b1','Toller Fisch!');
-- Dora (von Anna blockiert) kommentiert: keine Mitteilung
insert into public.post_comments(id, post_id, author_id, body)
  values (gen_random_uuid(),'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1','Hallo');
set role authenticated;
select as_user('a1') \g /dev/null
select 'Anna: Zahl ungelesen (Folgen, Gefällt mir, Kommentar; Dora blockiert)', t($q$ select public.unread_notification_count()::text $q$);
select 'Anna: Liste', t($q$ select string_agg(kind||':'||actor_username||':'||coalesce(excerpt,'')||':'||is_read||':'||coalesce(post_author_username,'-')||':'||coalesce(post_is_mine::text,'-'), ' | ' order by created_at) from public.my_notifications() $q$);
select 'Anna: Beitrag-Zeitpunkt für den Link', t($q$ select to_char(post_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI') from public.my_notifications() where kind = 'like' $q$);
select 'Anna öffnet: alle gelesen', t($q$ select public.mark_notifications_read()::text $q$);
select 'Danach ungelesen', t($q$ select public.unread_notification_count()::text $q$);
select 'Gelesene bleiben in der Liste', t($q$ select count(*)::text from public.my_notifications() where is_read $q$);
select as_user('b1') \g /dev/null
select 'Bert sieht nur seine eigenen (Folgen)', t($q$ select string_agg(kind||':'||actor_username, ',') from public.my_notifications() $q$);
select 'Bert: Zahl seiner ungelesenen', t($q$ select public.unread_notification_count()::text $q$);
reset role;
-- Gefällt mir erneut am selben Tag (neuer Eintrag): nur einmal je Person und Beitrag
delete from public.post_likes; insert into public.post_likes(post_id, user_id) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000b1');
select 'Like am selben Tag nur einmal', count(*) from public.notifications where kind = 'like';
-- Termin-Einladung und Session-Beginn kommen in die Liste, auch ohne Push-Gerät und mit abgeschalteter Art
select public.enqueue_push('00000000-0000-0000-0000-0000000000a1','trip_invite','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000f1','Abendansitz · 17.05.');
select public.enqueue_push('00000000-0000-0000-0000-0000000000a1','trip_start','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000f2','De Wittsee');
select public.enqueue_push('00000000-0000-0000-0000-0000000000a1','trip_invite','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000f1','Doppelt');
select public.enqueue_push('00000000-0000-0000-0000-0000000000a1','new_post','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000e1','Neuer Beitrag');
select public.enqueue_push('00000000-0000-0000-0000-0000000000a1','trip_invite','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f3','Blockiert');
select public.enqueue_push('00000000-0000-0000-0000-0000000000a1','like','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1',null);
set role authenticated;
select as_user('a1') \g /dev/null
select 'Einladung einmal, Start, kein Neuer Beitrag, kein Blockierter, nicht selbst', t($q$ select string_agg(kind||':'||coalesce(excerpt,''), ' | ' order by created_at, kind) from public.my_notifications() where not is_read $q$);
select 'Neue ungelesene', t($q$ select public.unread_notification_count()::text $q$);
select 'Seitenweise (max_rows 1)', t($q$ select count(*)::text from public.my_notifications(null, 1) $q$);
select 'Cursor vor dem ältesten: leer', t($q$ select count(*)::text from public.my_notifications((select min(created_at) from public.my_notifications()), 30) $q$);
-- Blockiert nachträglich: Doras frühere Mitteilungen verschwinden
reset role;
insert into public.notifications(user_id, kind, actor, ref) values ('00000000-0000-0000-0000-0000000000a1','like','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e1');
set role authenticated;
select as_user('a1') \g /dev/null
select 'Blockierte erscheinen nicht', t($q$ select count(*)::text from public.my_notifications() where actor_username = 'dora' $q$);
select as_user('') \g /dev/null
select 'Ohne Anmeldung: Zahl', t($q$ select public.unread_notification_count()::text $q$);
select 'Ohne Anmeldung: Markieren', t($q$ select public.mark_notifications_read()::text $q$);

-- ---- Löschen und Einladungen (Wunsch Nutzer 2026-11-11) ----
reset role;
create function public.nid(k text) returns uuid language sql security definer as $$ select id from public.notifications where kind = k and user_id = '00000000-0000-0000-0000-0000000000a1' limit 1 $$;
grant execute on function public.nid(text) to authenticated;
-- Termin-Einladung (Bert → Anna) und Session-Start (Bert → Anna) als offene Einladungen
insert into public.trip_invites(trip_id, host_id, user_id, title, water_name, trip_date, from_time, to_time)
  values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','Abendansitz','De Wittsee', date '2099-05-17','17:00','21:00');
insert into public.group_sessions(id, host_id, title) values ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000b1','De Wittsee');
insert into public.group_session_members(session_id, user_id, status) values
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000b1','joined'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a1','invited');
set role authenticated;
select as_user('a1') \g /dev/null
select 'Liste v2: Einladungen mit Angaben', t($q$ select string_agg(kind||':'||coalesce(invite_status,'-')||':'||coalesce(trip_title,'-')||':'||coalesce(trip_date::text,'-')||':'||coalesce(trip_from,'-')||':'||coalesce(session_title,'-'), ' | ' order by kind) from public.my_notifications2() where kind in ('trip_invite','trip_start') $q$);
select 'Liste v2: Beitrag wie vorher', t($q$ select count(*)::text from public.my_notifications2() where kind = 'like' and post_is_mine $q$);
select 'Alle löschen: offene bleiben', t($q$ select public.clear_notifications()::text $q$);
select 'Übrig nach Alle löschen', t($q$ select string_agg(kind, ',' order by kind) from public.my_notifications2() $q$);
select as_user('b1') \g /dev/null
select 'Bert löscht nicht Annas Mitteilung', t($q$ select public.delete_notification(public.nid('trip_start'))::text $q$);
select as_user('a1') \g /dev/null
select 'Anna hat sie noch', t($q$ select count(*)::text from public.my_notifications2() where kind = 'trip_start' $q$);
select 'Anna löscht die Session-Mitteilung', t($q$ select public.delete_notification(public.nid('trip_start'))::text $q$);
select 'Danach nur noch Termin-Einladung', t($q$ select string_agg(kind, ',') from public.my_notifications2() $q$);
-- Antwort: nach der Zusage ist die Termin-Einladung nicht mehr offen und lässt sich löschen
select 'Zusagen', t($q$ select public.respond_trip_invite('00000000-0000-0000-0000-0000000000f1', true)::text $q$);
select 'Stand nach Zusage', t($q$ select invite_status from public.my_notifications2() where kind = 'trip_invite' $q$);
select 'Alle löschen nach Antwort', t($q$ select public.clear_notifications()::text $q$);
select 'Liste leer', t($q$ select count(*)::text from public.my_notifications2() $q$);
select as_user('') \g /dev/null
select 'Ohne Anmeldung löschen', t($q$ select public.clear_notifications()::text $q$);
select 'Ohne Anmeldung eine löschen', t($q$ select public.delete_notification('00000000-0000-0000-0000-0000000000f9')::text $q$);

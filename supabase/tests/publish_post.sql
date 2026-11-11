\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000c1');
insert into public.profiles(id, username, display_name) values ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),('00000000-0000-0000-0000-0000000000b1','bert','Bert'),('00000000-0000-0000-0000-0000000000c1','carl','Carl');
-- befreundet = folgen sich gegenseitig (seit *_follows.sql)
insert into public.follows(follower, followee, status, accepted_at) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','accepted',now()),('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','accepted',now());
insert into public.push_devices(token, user_id) values (repeat('b',64),'00000000-0000-0000-0000-0000000000b1');
-- Fotos, wie sie die App vorher hochlädt (A: Beiträge 1–4, C: Beitrag 9)
insert into storage.objects(bucket_id, name) select 'post-photos', '00000000-0000-0000-0000-0000000000a1/10000000-0000-0000-0000-00000000000'||n||'/1.jpg' from generate_series(1,4) n;
insert into storage.objects(bucket_id, name) values ('post-photos','00000000-0000-0000-0000-0000000000c1/10000000-0000-0000-0000-000000000009/1.jpg');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000'||u, false); $$;
grant execute on function public.as_user(text) to authenticated;
set role authenticated;
select as_user('a1') \g /dev/null
-- 1. alter Weg (Upsert wie bisher) scheitert weiterhin – zur Erinnerung
select 'Upsert alt', t($q$ insert into public.posts(id, author_id, caption, visibility, photo_paths, created_at) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','x','friends','{a}',now()) on conflict (id) do update set author_id=excluded.author_id, photo_paths=excluded.photo_paths returning 'ok' $q$);
-- 2. publish_post: privat, Freunde, Alle (alt: Erstellung vor 30 Tagen bleibt)
select 'P1 privat', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000001','Nur ich','private','{00000000-0000-0000-0000-0000000000a1/10000000-0000-0000-0000-000000000001/1.jpg}', now() - interval '30 days') $q$);
select 'P2 Freunde', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000002','Freunde','friends','{00000000-0000-0000-0000-0000000000a1/10000000-0000-0000-0000-000000000002/1.jpg}', now() - interval '2 hours', 'hecht', 72.5) $q$);
select 'P3 Alle', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000003','Alle','public','{00000000-0000-0000-0000-0000000000a1/10000000-0000-0000-0000-000000000003/1.jpg}', now() + interval '3 days') $q$);
select 'Datum P1 erhalten', t($q$ select (created_at < now() - interval '29 days')::text from public.posts where id='10000000-0000-0000-0000-000000000001' $q$);
select 'Datum Zukunft gekappt', t($q$ select (created_at <= now())::text from public.posts where id='10000000-0000-0000-0000-000000000003' $q$);
-- 3. erneut aufrufen: kein Duplikat, nur Änderung
select 'P2 erneut', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000002','Freunde neu','friends','{00000000-0000-0000-0000-0000000000a1/10000000-0000-0000-0000-000000000002/1.jpg}', now()) $q$);
select 'Anzahl A', t($q$ select count(*)::text from public.posts where author_id='00000000-0000-0000-0000-0000000000a1' $q$);
select 'P2 Datum bleibt', t($q$ select (created_at < now() - interval '1 hour')::text || ' ' || caption from public.posts where id='10000000-0000-0000-0000-000000000002' $q$);
-- 4. Prüfungen
select 'Foto fehlt', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000005','x','friends','{00000000-0000-0000-0000-0000000000a1/10000000-0000-0000-0000-000000000005/1.jpg}', now()) $q$);
select 'Fremder Ordner', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000009','x','public','{00000000-0000-0000-0000-0000000000c1/10000000-0000-0000-0000-000000000009/1.jpg}', now()) $q$);
select 'Falsche Sichtbarkeit', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000004','x','geheim','{00000000-0000-0000-0000-0000000000a1/10000000-0000-0000-0000-000000000004/1.jpg}', now()) $q$);
select 'Thumb als Foto', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000004','x','friends','{00000000-0000-0000-0000-0000000000a1/10000000-0000-0000-0000-000000000004/1.thumb.jpg}', now()) $q$);
-- C versucht Beitrag von A zu übernehmen
select as_user('c1') \g /dev/null
insert into storage.objects(bucket_id, name) values ('post-photos','00000000-0000-0000-0000-0000000000c1/10000000-0000-0000-0000-000000000002/1.jpg');
select 'Übernahme durch C', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000002','gehackt','public','{00000000-0000-0000-0000-0000000000c1/10000000-0000-0000-0000-000000000002/1.jpg}', now()) $q$);
select 'C P9 Alle', t($q$ select public.publish_post('10000000-0000-0000-0000-000000000009','von C','public','{00000000-0000-0000-0000-0000000000c1/10000000-0000-0000-0000-000000000009/1.jpg}', now()) $q$);
-- 5. Sichtbarkeit
select as_user('a1') \g /dev/null
select 'A Feed', t($q$ select string_agg(caption, ',' order by caption) from public.feed() $q$);
select 'A Entdecken', t($q$ select string_agg(caption, ',' order by caption) from public.discover_feed() $q$);
select 'A eigene (user_posts)', t($q$ select string_agg(caption, ',' order by caption) from public.user_posts('00000000-0000-0000-0000-0000000000a1') $q$);
select 'A Foto privat lesbar', t($q$ select count(*)::text from storage.objects where name like '%000000000001/1.jpg' $q$);
select as_user('b1') \g /dev/null
select 'B Feed (Freund)', t($q$ select string_agg(caption, ',' order by caption) from public.feed() $q$);
select 'B Entdecken', t($q$ select string_agg(caption, ',' order by caption) from public.discover_feed() $q$);
select 'B Tabelle', t($q$ select string_agg(caption, ',' order by caption) from public.posts $q$);
select 'B Profil A', t($q$ select string_agg(caption, ',' order by caption) from public.user_posts('00000000-0000-0000-0000-0000000000a1') $q$);
select 'B Foto privat', t($q$ select count(*)::text from storage.objects where name like '%000000000001/1.jpg' $q$);
select 'B Foto Freunde', t($q$ select count(*)::text from storage.objects where name like '%a1/10000000-0000-0000-0000-000000000002/1.jpg' $q$);
select 'B liked privat', t($q$ select public.toggle_like('10000000-0000-0000-0000-000000000001')::text $q$);
select as_user('c1') \g /dev/null
select 'C Feed (fremd)', t($q$ select string_agg(caption, ',' order by caption) from public.feed() $q$);
select 'C Entdecken', t($q$ select string_agg(caption, ',' order by caption) from public.discover_feed() $q$);
select 'C Tabelle', t($q$ select string_agg(caption, ',' order by caption) from public.posts $q$);
select 'C Foto Freunde', t($q$ select count(*)::text from storage.objects where name like '%a1/10000000-0000-0000-0000-000000000002/1.jpg' $q$);
select 'C Foto Alle', t($q$ select count(*)::text from storage.objects where name like '%a1/10000000-0000-0000-0000-000000000003/1.jpg' $q$);
-- 6. Sichtbarkeit wechseln (App: update mit Spaltenrechten) und Freundschaft beenden
select as_user('a1') \g /dev/null
select 'A P3 → privat', t($q$ with u as (update public.posts set visibility='private', updated_at=now() where id='10000000-0000-0000-0000-000000000003' returning 1) select count(*)::text from u $q$);
select as_user('c1') \g /dev/null
select 'C Entdecken nach privat', t($q$ select string_agg(caption, ',' order by caption) from public.discover_feed() $q$);
select 'C Foto nach privat', t($q$ select count(*)::text from storage.objects where name like '%a1/10000000-0000-0000-0000-000000000003/1.jpg' $q$);
select as_user('a1') \g /dev/null
select 'A Freund entfernen', t($q$ select public.remove_friend('00000000-0000-0000-0000-0000000000b1')::text $q$);
select as_user('b1') \g /dev/null
select 'B Feed ohne Freundschaft', t($q$ select string_agg(caption, ',' order by caption) from public.feed() $q$);
select 'B Foto ohne Freundschaft', t($q$ select count(*)::text from storage.objects where name like '%a1/10000000-0000-0000-0000-000000000002/1.jpg' $q$);
reset role;
select 'Mitteilungen', coalesce(string_agg(kind||'→'||user_id::text, ','), 'keine') from public.push_outbox;

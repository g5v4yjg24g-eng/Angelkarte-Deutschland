\pset tuples_only on
\pset format unaligned
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000d1'),('00000000-0000-0000-0000-0000000000e1');
insert into public.profiles(id, username, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','anna','Anna'),
  ('00000000-0000-0000-0000-0000000000b1','bert','Bert'),
  ('00000000-0000-0000-0000-0000000000c1','carl','Carl'),
  ('00000000-0000-0000-0000-0000000000d1','dora','Dora'),
  ('00000000-0000-0000-0000-0000000000e1','eva','Eva');
-- Anna ist mit Bert und Eva befreundet; Carl fremd; Dora von Anna blockiert (aber befreundet)
insert into public.follows(follower, followee, status, accepted_at) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','accepted',now()),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','accepted',now());
insert into public.blocks(blocker, blocked) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1');
insert into public.push_devices(token, user_id) values (repeat('b',64),'00000000-0000-0000-0000-0000000000b1'),
  (repeat('a',64),'00000000-0000-0000-0000-0000000000a1');
create function public.t(q text) returns text language plpgsql as $$ declare r text; begin execute q into r; return coalesce(r,'∅'); exception when others then return 'FEHLER: '||sqlerrm; end $$;
grant execute on function public.t(text) to authenticated, anon;
create function public.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', case when u = '' then '' else '00000000-0000-0000-0000-0000000000'||u end, false); $$;
grant execute on function public.as_user(text) to authenticated, anon;
create function public.pushes(u text) returns text language sql security definer as $$
  select coalesce(string_agg(kind, ',' order by created_at), '∅') from public.push_outbox
  where user_id = ('00000000-0000-0000-0000-0000000000'||u)::uuid $$;
grant execute on function public.pushes(text) to authenticated, anon;
-- ID der (einzigen) Verbindung zwischen zwei Nutzern, nur für den Test
create function public.link_of(x text, y text) returns uuid language sql security definer as $$
  select id from public.spot_links
  where least(a_id, b_id) = least(('00000000-0000-0000-0000-0000000000'||x)::uuid, ('00000000-0000-0000-0000-0000000000'||y)::uuid)
    and greatest(a_id, b_id) = greatest(('00000000-0000-0000-0000-0000000000'||x)::uuid, ('00000000-0000-0000-0000-0000000000'||y)::uuid) $$;
grant execute on function public.link_of(text, text) to authenticated, anon;
set role authenticated;
select as_user('a1') \g /dev/null
select 'Tabelle direkt lesen', t($q$ select count(*)::text from public.spot_links $q$);
select 'Anna bietet Bert an', t($q$ select public.offer_spot_link('00000000-0000-0000-0000-0000000000b1') $q$);
select 'Nochmal anbieten', t($q$ select public.offer_spot_link('00000000-0000-0000-0000-0000000000b1') $q$);
select 'Fremde Carl', t($q$ select public.offer_spot_link('00000000-0000-0000-0000-0000000000c1') $q$);
select 'Blockierte Dora', t($q$ select public.offer_spot_link('00000000-0000-0000-0000-0000000000d1') $q$);
select 'Sich selbst', t($q$ select public.offer_spot_link('00000000-0000-0000-0000-0000000000a1') $q$);
select 'Teilen vor Annahme', t($q$ select public.share_spot('p1','00000000-0000-0000-0000-0000000000b1','spot','Buhne 3',null,51.3,6.2)::text $q$);
select 'Teilen ohne Empfänger', t($q$ select public.share_spot('p1',null,'spot','Buhne 3',null,51.3,6.2)::text $q$);
select 'Annas Liste', t($q$ select string_agg(direction||'/'||status||'/'||partner_username, ',') from public.my_spot_links() $q$);
select 'Mitteilung an Bert (einmal)', pushes('b1');
select as_user('b1') \g /dev/null
select 'Bert sieht Angebot', t($q$ select string_agg(direction||'/'||status||'/'||partner_username||'/'||spots_from_partner, ',') from public.my_spot_links() $q$);
select 'Bert: Mitteilung offen', t($q$ select invite_status from public.my_notifications2() where kind = 'spot_link' $q$);
select as_user('a1') \g /dev/null
select 'Anna antwortet auf eigenes Angebot', t($q$ select public.respond_spot_link(public.link_of('a1','b1'), true)::text $q$);
select as_user('b1') \g /dev/null
select 'Bert lehnt ab', t($q$ select public.respond_spot_link(public.link_of('a1','b1'), false)::text $q$);
select 'Bert: Mitteilung abgelehnt', t($q$ select invite_status from public.my_notifications2() where kind = 'spot_link' $q$);
select 'Abgelehnt erscheint nicht', t($q$ select count(*)::text from public.my_spot_links() $q$);
select as_user('a1') \g /dev/null
select 'Anna erneut anbieten (7 Tage Sperre)', t($q$ select public.offer_spot_link('00000000-0000-0000-0000-0000000000b1') $q$);
select as_user('b1') \g /dev/null
select 'Bert bietet Anna an (darf sofort)', t($q$ select public.offer_spot_link('00000000-0000-0000-0000-0000000000a1') $q$);
select as_user('a1') \g /dev/null
select 'Anna: Offen-Mitteilung', t($q$ select invite_status from public.my_notifications2() where kind = 'spot_link' $q$);
select 'Alle löschen behält offenes Angebot', t($q$ select public.clear_notifications()::text $q$);
select 'Angebot noch da', t($q$ select count(*)::text from public.my_notifications2() where kind = 'spot_link' $q$);
select 'Anna nimmt an', t($q$ select public.respond_spot_link(public.link_of('a1','b1'), true)::text $q$);
select 'Bert bekommt „angenommen“', pushes('b1');
select 'Annehmen zweimal', t($q$ select public.respond_spot_link(public.link_of('a1','b1'), true)::text $q$);
select 'Anna teilt Spot mit Bert', t($q$ select (public.share_spot('p1','00000000-0000-0000-0000-0000000000b1','spot','Buhne 3','Notiz',51.3,6.2) is not null)::text $q$);
select 'Teilen erneut aktualisiert', t($q$ select (public.share_spot('p1','00000000-0000-0000-0000-0000000000b1','spot','Buhne 4','Notiz',51.3,6.2) is not null)::text $q$);
select 'Anna teilt Spot mit Carl (keine Verbindung)', t($q$ select public.share_spot('p1','00000000-0000-0000-0000-0000000000c1','spot','x',null,51.3,6.2)::text $q$);
select 'Anna teilt zweiten Spot', t($q$ select (public.share_spot('p2','00000000-0000-0000-0000-0000000000b1','jetty','Steg',null,51.4,6.3) is not null)::text $q$);
select as_user('b1') \g /dev/null
select 'Bert teilt Spot mit Anna', t($q$ select (public.share_spot('q1','00000000-0000-0000-0000-0000000000a1','parking','Parkplatz',null,51.5,6.4) is not null)::text $q$);
select 'Bert sieht Annas Spots', t($q$ select string_agg(name, ',' order by name) from public.my_shared_spots() where direction = 'incoming' $q$);
select 'Zähler Bert', t($q$ select spots_from_partner||'/'||spots_to_partner||'/'||i_share from public.my_spot_links() $q$);
select 'Bert direkt in der Tabelle', t($q$ select count(*)::text from public.shared_spots $q$);
select as_user('c1') \g /dev/null
select 'Carl sieht nichts', t($q$ select count(*)::text from public.shared_spots $q$);
select as_user('a1') \g /dev/null
select 'Anna entfernt Ort überall', t($q$ select public.unshare_place('p1')::text $q$);
select 'Anna: noch ein Spot', t($q$ select spots_to_partner::text from public.my_spot_links() $q$);
select as_user('e1') \g /dev/null
select 'Eva bietet Anna an', t($q$ select public.offer_spot_link('00000000-0000-0000-0000-0000000000a1') $q$);
select as_user('a1') \g /dev/null
select 'Anna bietet Eva an (beide wollen = verbunden)', t($q$ select public.offer_spot_link('00000000-0000-0000-0000-0000000000e1') $q$);
select 'Anna beendet Verbindung mit Bert', t($q$ select public.end_spot_link(public.link_of('a1','b1'))::text $q$);
select 'Geteilte Spots weg', t($q$ select count(*)::text from public.shared_spots $q$);
select as_user('b1') \g /dev/null
select 'Bert sieht nichts mehr', t($q$ select count(*)::text from public.my_shared_spots() $q$);
select 'Beenden fremder Verbindung', t($q$ select public.end_spot_link(public.link_of('a1','b1'))::text $q$);
select as_user('') \g /dev/null
select 'Ohne Anmeldung', t($q$ select public.offer_spot_link('00000000-0000-0000-0000-0000000000a1') $q$);

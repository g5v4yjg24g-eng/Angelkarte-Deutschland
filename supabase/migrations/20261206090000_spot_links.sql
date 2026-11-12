-- Fangpunkt – Spots teilen mit Bestätigung (Wunsch Nutzer 2026-11-12; Entscheidungen: gegenseitig, Bestand als
-- angenommen übernehmen, Schalter je Ort). Statt jeden Ort einzeln an Freunde zu schicken, bietet man einer Person
-- das Teilen an; nimmt sie an, teilen beide alle ihre Spots miteinander (die Orte selbst lädt die App je Empfänger
-- hoch, wie bisher über share_spot). Beenden trennt beide Richtungen. Ablehnen sperrt neue Angebote an diese Person
-- für 7 Tage. Mitteilung wie bei Einladungen (Annehmen/Ablehnen). Nur Freunde (gegenseitiges Folgen).

create table public.spot_links (
  id uuid primary key default gen_random_uuid(),
  -- a bietet an, b entscheidet
  a_id uuid not null references auth.users (id) on delete cascade,
  b_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  -- Bestand: bisher teilte nur diese Person Spots; die andere teilt erst, wenn sie zustimmt (join_spot_link)
  legacy_oneway_owner uuid references auth.users (id) on delete set null,
  check (a_id <> b_id)
);
create unique index spot_links_pair on public.spot_links (least(a_id, b_id), greatest(a_id, b_id));
create index spot_links_b on public.spot_links (b_id, status);
alter table public.spot_links enable row level security;
revoke all on public.spot_links from anon, authenticated;
create trigger zz_deny_banned before insert or update on public.spot_links
  for each row execute function public.deny_banned_writes();

-- Mitteilungsarten
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'like', 'comment', 'spot', 'session_invite',
                  'new_post', 'comment_reply', 'session_joined', 'session_highlight', 'test', 'new_follower',
                  'trip_invite', 'trip_start', 'spot_link', 'spot_link_accepted'));
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'new_follower', 'like', 'comment', 'comment_reply', 'spot',
                  'session_invite', 'session_joined', 'session_highlight', 'trip_invite', 'trip_start',
                  'spot_link', 'spot_link_accepted'));

create or replace function public.record_notification(recipient uuid, what text, who uuid, target text, snippet text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if what not in ('friend_request', 'friend_accepted', 'new_follower', 'like', 'comment', 'comment_reply', 'spot',
                  'session_invite', 'session_joined', 'session_highlight', 'trip_invite', 'trip_start',
                  'spot_link', 'spot_link_accepted') then
    return;
  end if;
  if what = 'like' and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'like' and n.actor = who and n.ref is not distinct from target
      and n.created_at > now() - interval '1 day'
  ) then return; end if;
  if what = 'comment_reply' and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'comment_reply' and n.ref is not distinct from target
      and n.created_at > now() - interval '1 hour'
  ) then return; end if;
  if what = 'trip_invite' and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = 'trip_invite' and n.actor = who and n.ref is not distinct from target
  ) then return; end if;
  if what in ('spot_link', 'spot_link_accepted') and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind = what and n.actor = who and n.ref is not distinct from target
      and n.created_at > now() - interval '1 day'
  ) then return; end if;
  if what in ('friend_request', 'new_follower') and exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.kind in ('friend_request', 'new_follower') and n.actor = who
      and n.created_at > now() - interval '1 day'
  ) then return; end if;
  insert into public.notifications (user_id, kind, actor, ref, excerpt)
    values (recipient, what, who, target, left(btrim(snippet), 140));
  delete from public.notifications n
  where n.user_id = recipient
    and (n.created_at < now() - interval '90 days'
         or n.id in (select o.id from public.notifications o where o.user_id = recipient
                     order by o.created_at desc offset 200));
end;
$$;

create or replace function public.enqueue_push(recipient uuid, what text, who uuid, target text, snippet text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  prefs public.push_prefs;
  new_id uuid;
begin
  if recipient is null or who is null or recipient = who then return; end if;
  if public.is_banned(who) then return; end if;
  if public.is_blocked_between(recipient, who) then return; end if;
  perform public.record_notification(recipient, what, who, target, snippet);
  if not exists (select 1 from public.push_devices d where d.user_id = recipient) then return; end if;
  select * into prefs from public.push_prefs p where p.user_id = recipient;
  if prefs.user_id is not null then
    if what in ('friend_request', 'friend_accepted', 'new_follower') and not prefs.friends then return; end if;
    if what = 'like' and not prefs.likes then return; end if;
    if what in ('comment', 'comment_reply') and not prefs.comments then return; end if;
    if what in ('spot', 'spot_link', 'spot_link_accepted') and not prefs.spots then return; end if;
    if what in ('session_invite', 'session_joined', 'session_highlight', 'trip_invite', 'trip_start')
       and not prefs.sessions then return; end if;
    if what = 'new_post' and not prefs.posts then return; end if;
  end if;
  if what = 'like' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'like' and o.actor = who and o.ref = target
      and o.created_at > now() - interval '1 day'
  ) then return; end if;
  if what = 'comment_reply' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'comment_reply' and o.ref = target
      and o.created_at > now() - interval '1 hour'
  ) then return; end if;
  if what = 'trip_invite' and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = 'trip_invite' and o.actor = who and o.ref = target
  ) then return; end if;
  if what in ('spot_link', 'spot_link_accepted') and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind = what and o.actor = who and o.ref = target
      and o.created_at > now() - interval '1 day'
  ) then return; end if;
  if what in ('friend_request', 'new_follower') and exists (
    select 1 from public.push_outbox o
    where o.user_id = recipient and o.kind in ('friend_request', 'new_follower') and o.actor = who
      and o.created_at > now() - interval '1 day'
  ) then return; end if;
  insert into public.push_outbox (user_id, kind, actor, ref, excerpt)
    values (recipient, what, who, target, left(btrim(snippet), 140))
  returning id into new_id;
  perform net.http_post(
    url := public.push_function_url(),
    body := jsonb_build_object('id', new_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;


-- Automatisch hochgeladene Spots lösen keine Mitteilung je Spot mehr aus (sonst würde jeder neue Ort alle Partner
-- anpingen); die Mitteilung kommt beim Angebot und bei der Annahme.
drop trigger if exists shared_spots_push on public.shared_spots;

-- Verbindung angenommen?
create function public.spot_link_accepted(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.spot_links l
    where l.status = 'accepted' and least(l.a_id, l.b_id) = least(x, y) and greatest(l.a_id, l.b_id) = greatest(x, y));
$$;
revoke execute on function public.spot_link_accepted(uuid, uuid) from public, anon, authenticated;

-- Sichtbar: eigene Spots; fremde nur, wenn sie an mich gerichtet sind und die Verbindung angenommen ist und wir Freunde sind
create or replace function public.can_see_spot(owner uuid, recipient uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner = auth.uid()
      or (recipient = auth.uid() and public.are_friends(owner, auth.uid()) and public.spot_link_accepted(owner, auth.uid()));
$$;

-- Ort an eine Person hochladen (oder aktualisieren): nur mit angenommener Verbindung. „Alle Freunde“ gibt es nicht mehr.
-- Fehler: 'no_profile', 'not_friends', 'no_link'
create or replace function public.share_spot(
  place text, recipient uuid, kind text, spot_name text, spot_note text, spot_lat double precision, spot_lng double precision
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  result uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'no_profile'; end if;
  if recipient is null or not public.are_friends(me, recipient) then raise exception 'not_friends'; end if;
  if not public.spot_link_accepted(me, recipient) then raise exception 'no_link'; end if;
  if exists (select 1 from public.spot_links l
             where l.legacy_oneway_owner is not null and l.legacy_oneway_owner = recipient
               and least(l.a_id, l.b_id) = least(me, recipient) and greatest(l.a_id, l.b_id) = greatest(me, recipient)) then
    raise exception 'no_link';
  end if;
  insert into public.shared_spots as s (owner_id, place_id, recipient_id, place_type, name, note, lat, lng)
    values (me, place, recipient, kind, nullif(btrim(spot_name), ''), nullif(btrim(spot_note), ''), spot_lat, spot_lng)
  on conflict (owner_id, place_id, coalesce(recipient_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set place_type = excluded.place_type, name = excluded.name, note = excluded.note,
                lat = excluded.lat, lng = excluded.lng, updated_at = now()
  returning s.id into result;
  return result;
end;
$$;

-- Ort bei allen Partnern entfernen (Ort gelöscht oder Schalter aus)
create function public.unshare_place(place text) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.shared_spots where owner_id = auth.uid() and place_id = place;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Teilen anbieten. Liefert 'offered', 'pending' (schon angeboten), 'already' (schon verbunden) oder 'accepted'
-- (die Person hatte selbst angeboten). Fehler: 'no_profile', 'not_friends', 'declined_recently', 'too_many'
create function public.offer_spot_link(partner uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  l public.spot_links;
  link_id uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_banned(me) then raise exception 'banned'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'no_profile'; end if;
  if partner is null or partner = me or not public.are_friends(me, partner)
     or public.is_banned(partner) or public.is_blocked_between(me, partner) then
    raise exception 'not_friends';
  end if;
  select * into l from public.spot_links x
    where least(x.a_id, x.b_id) = least(me, partner) and greatest(x.a_id, x.b_id) = greatest(me, partner);
  if found then
    if l.status = 'accepted' then return 'already'; end if;
    if l.status = 'pending' then
      if l.a_id = partner then
        update public.spot_links set status = 'accepted', responded_at = now() where id = l.id;
        perform public.enqueue_push(partner, 'spot_link_accepted', me, l.id::text, null);
        return 'accepted';
      end if;
      return 'pending';
    end if;
    -- abgelehnt: wer abgelehnt hat, darf jederzeit selbst anbieten; sonst erst nach 7 Tagen
    if l.b_id = partner and l.responded_at > now() - interval '7 days' then raise exception 'declined_recently'; end if;
    update public.spot_links set a_id = me, b_id = partner, status = 'pending', responded_at = null,
      created_at = now(), legacy_oneway_owner = null where id = l.id;
    link_id := l.id;
  else
    if (select count(*) from public.spot_links x where x.a_id = me and x.created_at > now() - interval '24 hours') >= 30 then
      raise exception 'too_many';
    end if;
    insert into public.spot_links (a_id, b_id) values (me, partner) returning id into link_id;
  end if;
  perform public.enqueue_push(partner, 'spot_link', me, link_id::text, null);
  return 'offered';
end;
$$;

-- Angebot annehmen oder ablehnen (nur die angesprochene Person). Fehler: 'not_found'
create function public.respond_spot_link(link uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  offerer uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  update public.spot_links set status = case when accept then 'accepted' else 'declined' end, responded_at = now()
    where id = link and b_id = me and status = 'pending'
      and public.are_friends(a_id, me) and not public.is_banned(a_id) and not public.is_blocked_between(a_id, me)
    returning a_id into offerer;
  if not found then raise exception 'not_found'; end if;
  if accept then perform public.enqueue_push(offerer, 'spot_link_accepted', me, link::text, null); end if;
end;
$$;

-- Bestandsverbindung: auch die eigenen Spots teilen (die Person sah bisher nur Spots der anderen)
create function public.join_spot_link(link uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.spot_links set legacy_oneway_owner = null
    where id = link and auth.uid() in (a_id, b_id) and status = 'accepted';
  if not found then raise exception 'not_found'; end if;
end;
$$;

-- Teilen beenden (beide dürfen): Verbindung und alle geteilten Spots zwischen den beiden werden gelöscht
create function public.end_spot_link(link uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare x public.spot_links;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.spot_links where id = link and auth.uid() in (a_id, b_id) returning * into x;
  if x.id is null then raise exception 'not_found'; end if;
  delete from public.shared_spots
    where (owner_id = x.a_id and recipient_id = x.b_id) or (owner_id = x.b_id and recipient_id = x.a_id);
end;
$$;

-- Meine Verbindungen (offen und angenommen). direction: incoming = die Person bietet mir an, outgoing = ich biete an.
-- spots_from_partner = Spots, die ich von ihr sehe; spots_to_partner = Spots, die sie von mir sieht.
-- i_share = false, solange eine Bestandsverbindung auf meine Zustimmung wartet.
create function public.my_spot_links()
returns table (
  id uuid, partner_id uuid, partner_username text, partner_display_name text, partner_badges text[],
  direction text, status text, created_at timestamptz, spots_from_partner integer, spots_to_partner integer,
  i_share boolean
)
language sql stable security definer set search_path = '' as $$
  select l.id,
         p.id, p.username, p.display_name,
         coalesce((select array_agg(b.badge order by b.badge) from public.user_badges b where b.user_id = p.id), '{}'),
         case when l.b_id = auth.uid() then 'incoming' else 'outgoing' end,
         l.status,
         l.created_at,
         (select count(*)::integer from public.shared_spots s where s.owner_id = p.id and s.recipient_id = auth.uid()),
         (select count(*)::integer from public.shared_spots s where s.owner_id = auth.uid() and s.recipient_id = p.id),
         not (l.legacy_oneway_owner is not null and l.legacy_oneway_owner = p.id)
  from public.spot_links l
  join public.profiles p on p.id = case when l.a_id = auth.uid() then l.b_id else l.a_id end
  where auth.uid() in (l.a_id, l.b_id) and l.status in ('pending', 'accepted')
    and public.are_friends(l.a_id, l.b_id)
    and not public.is_banned(p.id) and not public.is_blocked_between(auth.uid(), p.id)
  order by (l.status = 'pending') desc, p.display_name;
$$;

-- „Offen“ für „Alle löschen“: auch Spot-Angebote an mich
create or replace function public.notification_is_open(uid uuid, kind text, actor uuid, ref text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when kind = 'trip_invite' then exists (
      select 1 from public.trip_invites i where i.trip_id::text = ref and i.user_id = uid and i.status = 'invited')
    when kind in ('session_invite', 'trip_start') then exists (
      select 1 from public.group_session_members m where m.session_id::text = ref and m.user_id = uid and m.status = 'invited')
    when kind = 'friend_request' then exists (
      select 1 from public.follows f where f.followee = uid and f.follower = actor and f.status = 'pending')
    when kind = 'spot_link' then exists (
      select 1 from public.spot_links l where l.id::text = ref and l.b_id = uid and l.status = 'pending')
    else false
  end;
$$;

create or replace function public.my_notifications2(before timestamptz default null, max_rows integer default 30)
returns table (
  id uuid, kind text, actor_id uuid, actor_username text, actor_display_name text, ref text, excerpt text,
  created_at timestamptz, is_read boolean,
  post_author_username text, post_created_at timestamptz, post_is_mine boolean,
  invite_status text, trip_title text, trip_water_name text, trip_date date, trip_from text, trip_to text, trip_tz text,
  session_title text
)
language sql stable security definer set search_path = '' as $$
  select n.id, n.kind, n.actor, a.username, a.display_name, n.ref, n.excerpt, n.created_at, n.read_at is not null,
         case when pv.id is not null then pa.username end,
         case when pv.id is not null then pv.created_at end,
         case when pv.id is not null then pv.author_id = auth.uid() end,
         case
           when n.kind = 'trip_invite' then ti.status
           when n.kind = 'spot_link' then
             case sl.status when 'pending' then 'invited' when 'accepted' then 'accepted' when 'declined' then 'declined' end
           when n.kind in ('session_invite', 'trip_start') then
             case gm.status when 'invited' then 'invited' when 'joined' then 'accepted' when 'declined' then 'declined'
                            when 'left' then 'accepted' end
         end,
         ti.title, ti.water_name, ti.trip_date, ti.from_time, ti.to_time, ti.tz,
         coalesce(gs.title, gs.water_name)
  from public.notifications n
  join public.profiles a on a.id = n.actor
  left join lateral (
    select p.id, p.author_id, p.created_at from public.posts p
    where n.kind in ('like', 'comment', 'comment_reply')
      and n.ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and p.id = n.ref::uuid
      and (p.author_id = auth.uid() or public.can_see_post_id(p.id))
  ) pv on true
  left join public.profiles pa on pa.id = pv.author_id
  left join public.trip_invites ti
    on n.kind = 'trip_invite' and ti.trip_id::text = n.ref and ti.user_id = auth.uid()
  left join public.group_session_members gm
    on n.kind in ('session_invite', 'trip_start') and gm.session_id::text = n.ref and gm.user_id = auth.uid()
  left join public.group_sessions gs on gs.id = gm.session_id
  left join public.spot_links sl
    on n.kind = 'spot_link' and sl.id::text = n.ref and sl.b_id = auth.uid()
  where n.user_id = auth.uid()
    and (before is null or n.created_at < before)
    and not public.is_banned(n.actor)
    and not public.is_blocked_between(auth.uid(), n.actor)
  order by n.created_at desc
  limit least(greatest(coalesce(max_rows, 30), 1), 50);
$$;


revoke execute on function public.share_spot(text, uuid, text, text, text, double precision, double precision) from public, anon;
revoke execute on function public.unshare_place(text) from public, anon;
revoke execute on function public.offer_spot_link(uuid) from public, anon;
revoke execute on function public.respond_spot_link(uuid, boolean) from public, anon;
revoke execute on function public.join_spot_link(uuid) from public, anon;
revoke execute on function public.end_spot_link(uuid) from public, anon;
revoke execute on function public.my_spot_links() from public, anon;
grant execute on function public.share_spot(text, uuid, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.unshare_place(text) to authenticated;
grant execute on function public.offer_spot_link(uuid) to authenticated;
grant execute on function public.respond_spot_link(uuid, boolean) to authenticated;
grant execute on function public.join_spot_link(uuid) to authenticated;
grant execute on function public.end_spot_link(uuid) to authenticated;
grant execute on function public.my_spot_links() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Bestand übernehmen (Entscheidung Nutzer 2026-11-12): bisherige Freigaben bleiben sichtbar. „An alle Freunde“ wird je
-- Freund eine Freigabe; zu jedem Paar entsteht eine angenommene Verbindung. Teilte bisher nur eine Seite, wartet die
-- andere auf ihre Zustimmung (legacy_oneway_owner), ihre Spots werden nicht einfach mit freigegeben.
insert into public.shared_spots (owner_id, place_id, recipient_id, place_type, name, note, lat, lng, created_at, updated_at)
  select s.owner_id, s.place_id, f.followee, s.place_type, s.name, s.note, s.lat, s.lng, s.created_at, s.updated_at
  from public.shared_spots s
  join public.follows f on f.follower = s.owner_id and f.status = 'accepted'
  where s.recipient_id is null and public.are_friends(s.owner_id, f.followee)
  on conflict (owner_id, place_id, coalesce(recipient_id, '00000000-0000-0000-0000-000000000000'::uuid)) do nothing;
delete from public.shared_spots where recipient_id is null;

insert into public.spot_links (a_id, b_id, status, responded_at, legacy_oneway_owner)
  select p.owner_id, p.recipient_id, 'accepted', now(),
         case when exists (select 1 from public.shared_spots r
                           where r.owner_id = p.recipient_id and r.recipient_id = p.owner_id) then null else p.owner_id end
  from (select distinct on (least(owner_id, recipient_id), greatest(owner_id, recipient_id)) owner_id, recipient_id
        from public.shared_spots
        order by least(owner_id, recipient_id), greatest(owner_id, recipient_id), updated_at) p
  on conflict do nothing;

notify pgrst, 'reload schema';

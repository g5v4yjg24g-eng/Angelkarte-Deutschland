-- Fangpunkt – Mitteilungen: löschen und Einladungen beantworten (Wunsch Nutzer 2026-11-11).
-- Nur erweiternd: my_notifications bleibt für die App-Version davor, neu my_notifications2 mit den Angaben zur Einladung.
-- „Offen“ = Einladung (Termin, Session, Session-Start) oder Folge-Anfrage, auf die ich noch nicht geantwortet habe.

-- Eine Mitteilung löschen (nur eigene; offene Einladungen lassen sich über die Mitteilung nicht beantworten, aber
-- weiter im Kalender bzw. bei den Sessions)
create function public.delete_notification(notification uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.notifications where id = notification and user_id = auth.uid();
end;
$$;

-- Offen? (für die Liste und für „Alle löschen“)
create function public.notification_is_open(uid uuid, kind text, actor uuid, ref text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when kind = 'trip_invite' then exists (
      select 1 from public.trip_invites i where i.trip_id::text = ref and i.user_id = uid and i.status = 'invited')
    when kind in ('session_invite', 'trip_start') then exists (
      select 1 from public.group_session_members m where m.session_id::text = ref and m.user_id = uid and m.status = 'invited')
    when kind = 'friend_request' then exists (
      select 1 from public.follows f where f.followee = uid and f.follower = actor and f.status = 'pending')
    else false
  end;
$$;
revoke execute on function public.notification_is_open(uuid, text, uuid, text) from public, anon, authenticated;

-- Alle löschen – außer offenen Einladungen und Folge-Anfragen. Liefert die Zahl der gelöschten.
create function public.clear_notifications() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.notifications x
  where x.user_id = auth.uid() and not public.notification_is_open(x.user_id, x.kind, x.actor, x.ref);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Liste wie my_notifications, dazu: Stand der Einladung (invited/accepted/declined) und bei Terminen Titel, Gewässername,
-- Tag und Zeit, bei Sessions der Titel. Keine Position, keine Notizen.
create function public.my_notifications2(before timestamptz default null, max_rows integer default 30)
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
  where n.user_id = auth.uid()
    and (before is null or n.created_at < before)
    and not public.is_banned(n.actor)
    and not public.is_blocked_between(auth.uid(), n.actor)
  order by n.created_at desc
  limit least(greatest(coalesce(max_rows, 30), 1), 50);
$$;

revoke execute on function public.delete_notification(uuid) from public, anon;
revoke execute on function public.clear_notifications() from public, anon;
revoke execute on function public.my_notifications2(timestamptz, integer) from public, anon;
grant execute on function public.delete_notification(uuid) to authenticated;
grant execute on function public.clear_notifications() to authenticated;
grant execute on function public.my_notifications2(timestamptz, integer) to authenticated;

notify pgrst, 'reload schema';

// Mitteilungen (Wunsch Nutzer 2026-11-11, wie bei Instagram): eigenes Fenster, das von rechts hereingleitet und sich
// per Wischen von links nach rechts (oder mit dem Pfeil) wieder schließt. Je Zeile Profilbild, Name und was passiert ist;
// Antippen führt zum Bild, zur Einladung oder zur Session.
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Sheet } from '../../design/components/Sheet';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { ChevronLeftIcon, FishOutlineIcon, TrashIcon } from '../../design/icons';
import {
  hasMoreNotifications,
  isInvite,
  isOpenInvite,
  notificationPath,
  shouldDismissRight,
  splitNew,
  timeAgo,
  withoutNotification,
  type AppNotification,
} from '../../domain/notifications';
import { groupErrorText } from '../sessions/group/groupText';
import { GroupSessionBusyError, joinGroupLocally } from '../../data/groupSessionService';
import { importInvite } from '../trips/importInvite';
import { useMemberAchievements } from '../sessions/group/useMemberAchievements';
import { InviteCard } from './InviteCard';
import { SwipeRow } from './SwipeRow';
import { swipeAxis } from '../../domain/swipe';
import { useProviders } from '../../ports/providersContext';
import { useNow } from '../../lib/useNow';
import { storedUserId } from '../badges/badgeStore';
import { Avatar } from '../profile/Avatar';
import { useAvatarUrls } from '../profile/avatarUrls';
import { clearUnread } from './unreadStore';
import styles from './Notifications.module.css';

const t = de.notifications;

function Row({ n, avatarUrl, now }: { n: AppNotification; avatarUrl?: string | undefined; now: number }) {
  const path = notificationPath(n);
  const body = (
    <>
      <span className={styles.avatar}>
        <Avatar url={avatarUrl} size={44} />
      </span>
      <span className={styles.text}>
        <strong className={styles.name}>{n.username}</strong> {t.kinds[n.kind](n.excerpt)}{' '}
        <span className={styles.time}>{timeAgo(n.createdAt, now)}</span>
      </span>
      {!n.read && <span className={styles.dot} role="img" aria-label={t.unreadMark} />}
    </>
  );
  return path ? (
    <Link to={path} className={styles.row}>
      {body}
    </Link>
  ) : (
    <div className={styles.row}>{body}</div>
  );
}

export function NotificationsPage() {
  const { account } = useProviders();
  const navigate = useNavigate();
  const signedIn = account.enabled && !!storedUserId();
  const now = useNow(60_000);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const avatars = useAvatarUrls(items.map((n) => n.actorId));
  const [tick, setTick] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const unlockedBy = useMemberAchievements(items.filter(isInvite).map((n) => n.actorId));

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    account
      .notifications()
      .then((rows) => {
        if (!alive) return;
        setItems(rows);
        setMore(hasMoreNotifications(rows.length));
        setStatus('ready');
        // Beim Öffnen gelesen: die Zeilen behalten ihren „Neu“-Stand von eben, der Fisch zeigt sofort nichts mehr
        clearUnread();
        account.markNotificationsRead().catch(() => undefined);
      })
      .catch(() => {
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [account, signedIn, tick]);

  const loadMore = useCallback(() => {
    const last = items[items.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    account
      .notifications(last.createdAt)
      .then((rows) => {
        setItems((cur) => [...cur, ...rows.filter((r) => !cur.some((c) => c.id === r.id))]);
        setMore(hasMoreNotifications(rows.length));
      })
      .catch(() => setStatus('error'))
      .finally(() => setLoadingMore(false));
  }, [account, items, loadingMore]);

  // Schließen: zurück, wo man herkam – ohne Verlauf (z. B. direkt geöffnet) zum Feed
  const [leaving, setLeaving] = useState(false);
  const close = useCallback(() => {
    const go = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/feed', { replace: true }));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) go();
    else {
      setLeaving(true);
      window.setTimeout(go, 200);
    }
  }, [navigate]);

  // Wischen von links nach rechts (Touch/Stift): das Fenster folgt dem Finger, genug Weg oder Schwung schließt
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; axis?: 'x' | 'y' | undefined; id: number } | null>(
    null,
  );
  const [dx, setDx] = useState(0);
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    d.axis ??= swipeAxis(mx, my);
    if (d.axis === 'x') setDx(Math.max(0, mx));
    else if (d.axis === 'y') drag.current = null;
  };
  const onUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.axis !== 'x') return setDx(0);
    const width = ref.current?.offsetWidth ?? 0;
    const moved = e.clientX - d.x;
    setDx(0);
    if (shouldDismissRight(moved, e.timeStamp - d.t, width)) close();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Eine Mitteilung löschen: sofort aus der Liste, bei Fehler neu laden
  const remove = useCallback(
    (id: string) => {
      setItems((cur) => withoutNotification(cur, id));
      account.deleteNotification(id).catch(() => setTick((n) => n + 1));
    },
    [account],
  );

  // Alle löschen – offene Einladungen bleiben (der Server entscheidet), danach neu laden
  const clearAll = () => {
    setClearing(true);
    account
      .clearNotifications()
      .catch(() => undefined)
      .finally(() => {
        setClearing(false);
        setConfirmClear(false);
        setTick((n) => n + 1);
      });
  };
  const canClear = items.some((n) => !isOpenInvite(n) && n.kind !== 'friend_request');

  // Einladung beantworten: Termin → in den eigenen Kalender, Session → hier dabei sein (wie „Dabei sein“ im Fenster)
  const answer = async (n: AppNotification, accept: boolean) => {
    if (!n.ref) return;
    setBusyId(n.id);
    setErrors((cur) => Object.fromEntries(Object.entries(cur).filter(([id]) => id !== n.id)));
    try {
      if (n.kind === 'trip_invite') {
        if (accept && n.trip)
          await importInvite({
            tripId: n.ref,
            hostId: n.actorId,
            hostUsername: n.username,
            hostDisplayName: n.displayName,
            title: n.trip.title,
            waterName: n.trip.waterName,
            date: n.trip.date,
            from: n.trip.from,
            to: n.trip.to,
            tz: n.trip.tz,
            status: 'accepted',
          });
        await account.respondTripInvite(n.ref, accept);
      } else if (accept) {
        const local = await joinGroupLocally({
          id: n.ref,
          title: n.sessionTitle ?? n.excerpt ?? undefined,
        }).catch((e: unknown) => {
          throw e instanceof GroupSessionBusyError ? new Error(t.busy) : e;
        });
        await account.respondGroupInvite(n.ref, true);
        navigate(`/fangbuch/sessions/${local.id}`);
        return;
      } else {
        await account.respondGroupInvite(n.ref, false);
      }
      setItems((cur) =>
        cur.map((x) => (x.id === n.id ? { ...x, inviteStatus: accept ? 'accepted' : 'declined' } : x)),
      );
    } catch (e) {
      const text =
        e instanceof Error && e.message === t.busy
          ? t.busy
          : n.kind === 'trip_invite'
            ? t.answerError
            : groupErrorText(e);
      setErrors((cur) => ({ ...cur, [n.id]: text }));
    } finally {
      setBusyId(undefined);
    }
  };

  const renderItem = (n: AppNotification) => {
    const to = notificationPath(n);
    return (
      <li key={n.id} className={styles.item}>
        <SwipeRow label={t.deleteLabel(n.username)} onDelete={() => remove(n.id)} card={isInvite(n) && !!to}>
          {isInvite(n) && to ? (
            <InviteCard
              n={n}
              to={to}
              avatarUrl={avatars.get(n.actorId)}
              unlocked={unlockedBy.get(n.actorId)}
              now={now}
              busy={busyId === n.id}
              error={errors[n.id]}
              onAnswer={(accept) => void answer(n, accept)}
            />
          ) : (
            <Row n={n} avatarUrl={avatars.get(n.actorId)} now={now} />
          )}
        </SwipeRow>
      </li>
    );
  };

  const { fresh, earlier } = splitNew(items);
  const style = dx > 0 ? { transform: `translateX(${dx}px)`, transition: 'none' } : undefined;

  return (
    <div
      ref={ref}
      className={`${styles.screen} ${leaving ? styles.leaving : ''}`}
      style={style}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        drag.current = null;
        setDx(0);
      }}
      data-testid="notifications"
    >
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={close} aria-label={t.close}>
          <ChevronLeftIcon />
        </button>
        <h1>{t.title}</h1>
        {canClear && (
          <button type="button" className={styles.clearAll} onClick={() => setConfirmClear(true)}>
            <TrashIcon size={16} />
            {t.clearAll}
          </button>
        )}
      </header>
      <div className={styles.body}>
        {!signedIn ? (
          <Notice>{t.signedOut}</Notice>
        ) : status === 'loading' ? (
          <p className={styles.muted} role="status">
            {t.loading}
          </p>
        ) : status === 'error' && items.length === 0 ? (
          <Notice tone="error">
            {t.loadError}{' '}
            <Button
              variant="secondary"
              onClick={() => {
                setStatus('loading');
                setTick((n) => n + 1);
              }}
            >
              {t.retry}
            </Button>
          </Notice>
        ) : items.length === 0 ? (
          <EmptyState icon={<FishOutlineIcon size={32} />} title={t.emptyTitle}>
            {t.emptyText}
          </EmptyState>
        ) : (
          <>
            {fresh.length > 0 && (
              <section aria-labelledby="notif-new">
                <h2 id="notif-new" className={styles.sectionTitle}>
                  {t.fresh}
                </h2>
                <ul className={styles.list}>{fresh.map(renderItem)}</ul>
              </section>
            )}
            {earlier.length > 0 && (
              <section aria-labelledby="notif-old">
                <h2 id="notif-old" className={styles.sectionTitle}>
                  {t.earlier}
                </h2>
                <ul className={styles.list}>{earlier.map(renderItem)}</ul>
              </section>
            )}
            {more && (
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? t.loading : t.loadMore}
              </Button>
            )}
          </>
        )}
      </div>
      <Sheet open={confirmClear} title={t.clearTitle} onClose={() => setConfirmClear(false)}>
        <div className={styles.confirmBox}>
          <p>{t.clearText}</p>
          <div className={styles.confirmActions}>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              {t.cancel}
            </Button>
            <Button variant="danger" disabled={clearing} onClick={clearAll}>
              {t.clearAll}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

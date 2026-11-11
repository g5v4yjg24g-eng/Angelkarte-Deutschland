// „Dein Angeltrip im Rückblick“ (Wunsch Nutzer 2026-10-23): Vollbild über der App (natives dialog: Fokusfalle,
// Escape, über der unteren Leiste). Öffnet sich nach dem Beenden einer Session und jederzeit aus der Session.
// Liest nur gespeicherte Daten: Session, ihre Einträge, Route, Fotos.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../../i18n/de';
import { Notice } from '../../../design/components/Notice';
import { SunsetScene } from '../../../design/components/SunsetScene';
import { CalendarIcon, ClockIcon, CloseIcon } from '../../../design/icons';
import { getDb } from '../../../data/db';
import { getTrack } from '../../../data/trackService';
import type { Photo } from '../../../domain/schemas';
import { buildReview, reviewEvents, sessionWaterName } from '../../../domain/sessionReview';
import { displaySegments, trackRange } from '../../../domain/track';
import { useNow } from '../../../lib/useNow';
import { statsFromReview } from '../../../domain/groupStats';
import { ReviewHighlights } from './ReviewHighlights';
import { ReviewTogether } from './ReviewTogether';
import { useGroupStats } from './useGroupStats';
import { ReviewTimeline } from './ReviewTimeline';
import styles from './Review.module.css';

import type { ReviewMapApi } from './ReviewMap';

const ReviewMap = lazy(() => import('./ReviewMap'));
const t = de.review;

/** „A“, „A und B“, „A, B und C“ */
const joinNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} und ${names.at(-1)}`;

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });

export function SessionReviewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const dialog = useRef<HTMLDialogElement>(null);
  // Woher die Auswahl kommt: nur ein Tipp auf der Karte scrollt die Chronik zum Eintrag
  const [selection, setSelection] = useState<{ id: string; from: 'map' | 'list' }>();
  const selectedId = selection?.id;
  const mapApi = useRef<ReviewMapApi | null>(null);

  const data = useLiveQuery(async () => {
    const db = getDb();
    const session = await db.sessions.get(id);
    if (!session || session.deletedAt) return { session: null } as const;
    const [catches, track] = await Promise.all([db.catches.toArray(), getTrack(id)]);
    const own = catches.filter((c) => c.sessionId === id && !c.deletedAt);
    const photoIds = own.flatMap((c) => c.photoIds ?? []);
    const photos = photoIds.length ? await db.photos.bulkGet(photoIds) : [];
    return { session, catches, track, photos: photos.filter((p): p is Photo => !!p) };
  }, [id]);

  const close = () => navigate(`/fangbuch/sessions/${id}`, { replace: true });

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const view = useMemo(() => {
    if (!data?.session) return undefined;
    const s = data.session;
    const events = reviewEvents(s, data.catches);
    const segments = data.track ? displaySegments(data.track.segments) : [];
    const range = data.track ? trackRange(data.track) : undefined;
    const times = [
      Date.parse(s.startAt),
      ...(s.endAt ? [Date.parse(s.endAt)] : []),
      ...(range ? [range.from, range.to] : []),
      ...events.map((e) => e.at),
    ];
    return {
      session: s,
      events,
      segments,
      from: Math.min(...times),
      to: Math.max(...times),
      water: sessionWaterName(s, events),
      photos: new Map(data.photos.map((p) => [p.id, p])),
      hasRoute: segments.some((seg) => seg.length > 0),
      withPosition: events.some((e) => e.position),
    };
  }, [data]);
  const review = useMemo(
    () => view && data?.session && buildReview(view.session, view.events, data.track, data.catches, now),
    [view, data, now],
  );

  const mine = useMemo(() => (review ? statsFromReview(review) : undefined), [review]);
  const together = useGroupStats(view?.session.groupId, !!view?.session.endAt, mine);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="rv-title"
      onClose={close}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className={styles.scroller}>
        <header className={styles.header}>
          <SunsetScene variant="full" />
          <div className={styles.headText}>
            {view && (view.water ?? view.session.title) && (
              <p className={styles.kicker}>{view.water ?? view.session.title}</p>
            )}
            <h1 id="rv-title" className={styles.title}>
              {t.title}
            </h1>
          </div>
          <button type="button" className={styles.close} aria-label={t.close} onClick={close}>
            <CloseIcon />
          </button>
        </header>
        {view && (
          <dl className={styles.when}>
            <div>
              <dt>
                <CalendarIcon size={20} />
                <span className="visually-hidden">{t.whenDate}</span>
              </dt>
              <dd>{dateOf(view.session.startAt)}</dd>
            </div>
            <div>
              <dt>
                <ClockIcon size={20} />
                <span className="visually-hidden">{t.whenTime}</span>
              </dt>
              <dd className="tabular">
                {t.times(view.session.startAt.slice(11, 16), view.session.endAt?.slice(11, 16) ?? t.running)}
              </dd>
            </div>
          </dl>
        )}

        {!data ? (
          <Notice>{t.loading}</Notice>
        ) : !view || !review ? (
          <Notice>{t.notFound}</Notice>
        ) : (
          <>
            {view.hasRoute || view.withPosition ? (
              <>
                {!view.hasRoute && <Notice>{t.noRouteEvents}</Notice>}
                {review.segments > 1 && (
                  <p className={`muted ${styles.gapNote}`}>{t.gaps(review.segments - 1)}</p>
                )}
                <Suspense fallback={<div className={styles.mapPlaceholder} aria-hidden="true" />}>
                  <ReviewMap
                    segments={view.segments}
                    events={view.events}
                    from={view.from}
                    to={view.to}
                    selectedId={selectedId}
                    controller={mapApi}
                    onSelect={(id) => setSelection({ id, from: 'map' })}
                  />
                </Suspense>
              </>
            ) : (
              <Notice>{data.track ? t.noMap : `${t.noRoute} ${t.noMap}`}</Notice>
            )}
            <ReviewHighlights review={review} />
            {together && <ReviewTogether state={together} durationMs={review.durationMs} />}
            <ReviewTimeline
              events={view.events}
              photos={view.photos}
              startNote={
                together && together.members.length > 1
                  ? de.review.together.started(joinNames(together.members.map((m) => m.displayName)))
                  : undefined
              }
              selectedId={selectedId}
              scrollToSelected={selection?.from === 'map'}
              onShow={(eid) => {
                setSelection({ id: eid, from: 'list' });
                mapApi.current?.focus(eid);
                dialog.current?.querySelector(`.${styles.mapBlock}`)?.scrollIntoView({ block: 'start' });
              }}
            />
          </>
        )}
      </div>
    </dialog>
  );
}

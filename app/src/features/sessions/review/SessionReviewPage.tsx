// „Dein Angeltrip im Rückblick“ (Wunsch Nutzer 2026-10-23): Vollbild über der App (natives dialog: Fokusfalle,
// Escape, über der unteren Leiste). Öffnet sich nach dem Beenden einer Session und jederzeit aus der Session.
// Liest nur gespeicherte Daten: Session, ihre Einträge, Route, Fotos.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../../i18n/de';
import { Notice } from '../../../design/components/Notice';
import { CloseIcon } from '../../../design/icons';
import { getDb } from '../../../data/db';
import { getTrack } from '../../../data/trackService';
import type { Photo } from '../../../domain/schemas';
import { buildReview, reviewEvents, sessionWaterName } from '../../../domain/sessionReview';
import { displaySegments, trackRange } from '../../../domain/track';
import { useNow } from '../../../lib/useNow';
import { ReviewHighlights } from './ReviewHighlights';
import { ReviewTimeline } from './ReviewTimeline';
import styles from './Review.module.css';

import type { ReviewMapApi } from './ReviewMap';

const ReviewMap = lazy(() => import('./ReviewMap'));
const t = de.review;

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
  const [selectedId, setSelectedId] = useState<string>();
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

  const heading = view?.water ?? view?.session.title ?? t.title;

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
          <div className={styles.headText}>
            {heading !== t.title && <p className={styles.kicker}>{t.title}</p>}
            <h1 id="rv-title" className={styles.title}>
              {heading}
            </h1>
            {view && (
              <p className={styles.meta}>
                <span>{dateOf(view.session.startAt)}</span>
                <span className="tabular">
                  {t.times(
                    view.session.startAt.slice(11, 16),
                    view.session.endAt?.slice(11, 16) ?? t.running,
                  )}
                </span>
              </p>
            )}
          </div>
          <button type="button" className={styles.close} aria-label={t.close} onClick={close}>
            <CloseIcon />
          </button>
        </header>

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
                    onSelect={setSelectedId}
                  />
                </Suspense>
              </>
            ) : (
              <Notice>{data.track ? t.noMap : `${t.noRoute} ${t.noMap}`}</Notice>
            )}
            <ReviewHighlights review={review} />
            <ReviewTimeline
              events={view.events}
              photos={view.photos}
              selectedId={selectedId}
              onShow={(eid) => {
                setSelectedId(eid);
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

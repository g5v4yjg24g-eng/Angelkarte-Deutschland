// Chronik des Rückblicks: alle Einträge der Session in zeitlicher Reihenfolge, dieselben wie auf der Karte.
// Antippen springt auf der Karte zum Ort; ein Tipp auf einen Marker hebt den Eintrag hier hervor.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { de } from '../../../i18n/de';
import type { Photo } from '../../../domain/schemas';
import type { ReviewEvent } from '../../../domain/sessionReview';
import { useObjectUrl } from '../../../lib/useObjectUrl';
import { markerDataUrl } from '../../map/markerIcons';
import { catchTitle } from '../../catches/catchText';
import styles from './Review.module.css';

const t = de.review;
const clock = (iso: string) => iso.slice(11, 16);

function Thumb({ photo, title }: { photo: Photo; title: string }) {
  const url = useObjectUrl(photo.thumb ?? photo.blob);
  return url ? <img className={styles.thumb} src={url} alt={t.photoAlt(title)} /> : null;
}

export function ReviewTimeline({
  events,
  photos,
  selectedId,
  onShow,
}: {
  events: ReviewEvent[];
  photos: Map<string, Photo>;
  selectedId?: string | undefined;
  onShow: (id: string) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  // Marker angetippt → Eintrag sichtbar machen
  useEffect(() => {
    if (!selectedId) return;
    list.current
      ?.querySelector(`[data-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  return (
    <section className={styles.section} aria-labelledby="rv-timeline">
      <h2 id="rv-timeline" className={styles.sectionTitle}>
        {t.timelineTitle}
      </h2>
      {events.length === 0 ? (
        <p className="muted">{t.timelineEmpty}</p>
      ) : (
        <ol ref={list} className={styles.timeline}>
          {events.map((e) => {
            const c = e.item;
            const title = catchTitle(c);
            const photo = c.photoIds?.map((id) => photos.get(id)).find(Boolean);
            const facts = [
              c.lengthCm !== undefined && t.lengthValue(c.lengthCm),
              c.weightG !== undefined && t.weightValue(c.weightG),
            ].filter(Boolean);
            return (
              <li
                key={e.id}
                data-id={e.id}
                aria-current={selectedId === e.id ? 'true' : undefined}
                className={[styles.entry, selectedId === e.id ? styles.entrySelected : ''].join(' ')}
              >
                <img src={markerDataUrl(`catch-${e.outcome}`)} alt="" width={32} height={32} />
                <div className={styles.entryBody}>
                  <div className={styles.entryHead}>
                    <span className="tabular">{clock(c.at)}</span>
                    <strong>{title}</strong>
                  </div>
                  {facts.length > 0 && <span className="tabular">{facts.join(' · ')}</span>}
                  {c.notes && <p className={styles.entryNotes}>{c.notes}</p>}
                  <div className={styles.entryActions}>
                    {e.position ? (
                      <button type="button" className={styles.linkButton} onClick={() => onShow(e.id)}>
                        {t.onMap}
                      </button>
                    ) : (
                      <span className="muted">{t.noPosition}</span>
                    )}
                    <Link to={`/fangbuch/${c.id}`} className={styles.linkButton}>
                      {t.openEntry}
                    </Link>
                  </div>
                </div>
                {photo && <Thumb photo={photo} title={title} />}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

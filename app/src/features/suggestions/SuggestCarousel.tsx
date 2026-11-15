// Horizontales Karussell der Profilvorschläge: Wischen (Touch) über useSwipeCarousel – senkrecht scrollt weiter die Seite –,
// Maus: Pfeil-Knöpfe und Trackpad/Rad, Tastatur: Pfeiltasten bei Fokus auf der Liste. Rastet pro Karte ein, bewegt sich
// nie von selbst; die nächste Karte schaut am rechten Rand hervor.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { de } from '../../i18n/de';
import { ChevronRightIcon } from '../../design/icons';
import type { FollowState, Suggestion } from '../../domain/suggestions';
import { useSwipeCarousel } from '../../lib/useSwipeCarousel';
import { useAvatarUrls } from '../profile/avatarUrls';
import { SuggestCard } from './SuggestCard';
import styles from './Suggest.module.css';

const t = de.suggest;

/** Breite einer Karte samt Abstand */
const stepOf = (el: HTMLElement) => {
  const first = el.firstElementChild as HTMLElement | null;
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
  return (first?.getBoundingClientRect().width ?? el.clientWidth) + gap;
};

export function SuggestCarousel({
  id,
  list,
  followState,
  onFollow,
  onDismiss,
}: {
  id: string;
  list: readonly Suggestion[];
  followState: (userId: string) => FollowState;
  onFollow: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const avatars = useAvatarUrls(list.map((s) => s.userId));
  const swipe = useSwipeCarousel(trackRef, list.length, stepOf);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
  }, [measure, list.length]);

  const move = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * stepOf(el) });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(-1);
    }
  };

  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.head}>
        <div className={styles.heading}>
          <h2 id={id}>{t.title}</h2>
          <p className="muted">{t.subtitle}</p>
        </div>
        <div className={styles.arrows}>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowPrev}`}
            aria-label={t.prev}
            disabled={edge.start}
            onClick={() => move(-1)}
          >
            <ChevronRightIcon size={18} />
          </button>
          <button
            type="button"
            className={styles.arrow}
            aria-label={t.next}
            disabled={edge.end}
            onClick={() => move(1)}
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>
      </div>
      <ul
        ref={trackRef}
        className={styles.track}
        aria-label={t.carouselLabel}
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={onKey}
        onScroll={measure}
        {...swipe}
      >
        {list.map((s, i) => (
          <li
            key={s.userId}
            className={styles.slide}
            aria-roledescription="slide"
            aria-label={t.slide(i + 1, list.length)}
          >
            <SuggestCard
              s={s}
              avatarUrl={avatars.get(s.userId)}
              state={followState(s.userId)}
              onFollow={() => onFollow(s)}
              onDismiss={() => onDismiss(s)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

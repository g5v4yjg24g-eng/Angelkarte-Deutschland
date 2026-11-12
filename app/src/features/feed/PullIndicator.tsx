// Kleine Ladeanimation oben im Feed, solange gezogen oder aktualisiert wird. Schiebt die Liste mit dem Finger nach
// unten (Höhe = Zugweite). Bei reduzierter Bewegung dreht sich nichts, das Symbol erscheint nur.
import { de } from '../../i18n/de';
import { RefreshIcon } from '../../design/icons';
import { PULL_THRESHOLD } from '../../domain/pullRefresh';
import type { PullState } from '../../lib/usePullToRefresh';
import styles from './Feed.module.css';

export function PullIndicator({ offset, state }: { offset: number; state: PullState }) {
  const progress = Math.min(1, offset / PULL_THRESHOLD);
  return (
    <div
      className={styles.pull}
      style={{ height: offset, transition: state === 'pulling' || state === 'ready' ? 'none' : undefined }}
      role="status"
      aria-live="polite"
    >
      {state !== 'idle' && (
        <span
          className={`${styles.pullIcon} ${state === 'refreshing' ? styles.pullSpin : ''}`}
          style={state === 'refreshing' ? undefined : { transform: `rotate(${progress * 270}deg)`, opacity: progress }}
        >
          <RefreshIcon size={22} />
          <span className="visually-hidden">{state === 'refreshing' ? de.feed.refreshing : ''}</span>
        </span>
      )}
    </div>
  );
}

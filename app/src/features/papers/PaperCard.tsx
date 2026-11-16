// Ein Papier als Karte im Wallet: Art, Bezeichnung, Gültigkeit und Stand; Antippen öffnet die Ansicht.
import { de } from '../../i18n/de';
import { IdCardIcon } from '../../design/icons';
import { paperState } from '../../domain/papers';
import type { Paper } from '../../domain/schemas';
import { formatDay, stateText, stateTone } from './paperText';
import styles from './Papers.module.css';

const t = de.papers;
const TONE = { ok: styles.toneOk, soon: styles.toneSoon, expired: styles.toneExpired, neutral: '' } as const;

export function PaperCard({ paper, today, onOpen }: { paper: Paper; today: string; onOpen: () => void }) {
  const state = paperState(paper, today);
  const tone = stateTone(state);
  return (
    <button type="button" className={[styles.card, TONE[tone]].join(' ')} onClick={onOpen}>
      <span className={styles.kindIcon}>
        <IdCardIcon />
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{paper.title}</span>
        <span className={styles.sub}>
          {[
            t.kinds[paper.kind],
            paper.validUntil ? t.validUntil(formatDay(paper.validUntil)) : t.unlimited,
          ].join(' · ')}
        </span>
        {state.kind !== 'unlimited' && (
          <span className={[styles.status, tone === 'expired' ? styles.statusExpired : ''].join(' ')}>
            {stateText(state)}
          </span>
        )}
      </span>
    </button>
  );
}

// Karte mit der Zahl der Stufen und je Familie der höchsten erreichten Stufe (Erreichte zuerst) – für das eigene
// Profil und das Profil anderer (Paket B). Reine Anzeige: der Stand kommt von außen.
import type { ReactNode } from 'react';
import { de } from '../../i18n/de';
import {
  bestTier,
  FAMILIES,
  FIRST_KEY,
  TIERS,
  TOTAL_STEPS,
  unlockedCount,
  type Unlocked,
} from '../../domain/achievements';
import { AchievementBadge } from './AchievementBadge';
import styles from './Achievements.module.css';

const t = de.achievements;

export function AchievementCard({
  id,
  unlocked: u,
  action,
  children,
}: {
  id: string;
  unlocked: Unlocked;
  /** rechts neben der Überschrift, z. B. „Alle ansehen“ */
  action?: ReactNode;
  /** unter der Überschrift, z. B. die „Neu“-Zeile */
  children?: ReactNode;
}) {
  const fams = FAMILIES.map((f) => ({ f, tier: bestTier(u, f.id) })).sort(
    (a, b) => (b.tier ? TIERS.indexOf(b.tier) + 1 : 0) - (a.tier ? TIERS.indexOf(a.tier) + 1 : 0),
  );
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.cardHead}>
        <h2 id={id}>
          {t.title} <span className="muted">· {t.count(unlockedCount(u), TOTAL_STEPS)}</span>
        </h2>
        {action}
      </div>
      {children}
      <ul className={styles.strip}>
        <li>
          <AchievementBadge
            kind="first"
            tier={u[FIRST_KEY] ? 'start' : null}
            size={56}
            label={u[FIRST_KEY] ? t.first.name : `${t.first.name} (${t.open})`}
          />
        </li>
        {fams.map(({ f, tier }) => (
          <li key={f.id}>
            <AchievementBadge
              kind={f.id}
              tier={tier ?? null}
              plate={tier ? String(f.steps[TIERS.indexOf(tier)]) : undefined}
              size={56}
              label={
                tier ? `${t.families[f.id].name}: ${t.tiers[tier]}` : `${t.families[f.id].name} (${t.open})`
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

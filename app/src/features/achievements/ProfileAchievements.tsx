// Erfolge im Profil: Zahl der Stufen und je Familie die höchste erreichte Stufe (Erreichte zuerst).
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import {
  bestTier,
  FAMILIES,
  FIRST_KEY,
  headline,
  TIERS,
  TOTAL_STEPS,
  unlockedCount,
} from '../../domain/achievements';
import { AchievementBadge } from './AchievementBadge';
import { useAchievements } from './useAchievements';
import styles from './Achievements.module.css';

const t = de.achievements;

export function ProfileAchievements() {
  const state = useAchievements();
  if (!state) return null;
  const u = state.unlocked ?? {};
  const h = headline(state.fresh);
  const fresh = h
    ? (h.family === 'first'
        ? t.first.name
        : t.newTierShort(t.families[h.family].name, t.tiers[h.tier ?? 'bronze'])) +
      (state.fresh.length > 1 ? t.andMore(state.fresh.length - 1) : '')
    : undefined;
  const fams = FAMILIES.map((f) => ({ f, tier: bestTier(u, f.id) })).sort(
    (a, b) => (b.tier ? TIERS.indexOf(b.tier) + 1 : 0) - (a.tier ? TIERS.indexOf(a.tier) + 1 : 0),
  );
  return (
    <section className={styles.card} aria-labelledby="profile-achievements">
      <div className={styles.cardHead}>
        <h2 id="profile-achievements">
          {t.title} <span className="muted">· {t.count(unlockedCount(u), TOTAL_STEPS)}</span>
        </h2>
        <Link to="/profil/erfolge" className={styles.more}>
          {t.showAll}
        </Link>
      </div>
      {fresh && (
        <Link to="/profil/erfolge" className={styles.freshLine}>
          <span className={styles.newTag}>{t.newTag}</span>
          {fresh}
        </Link>
      )}
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

// Erfolge im eigenen Profil: Karte mit „Alle ansehen“ und der „Neu“-Zeile.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { headline } from '../../domain/achievements';
import { AchievementCard } from './AchievementCard';
import { useAchievements } from './useAchievements';
import styles from './Achievements.module.css';

const t = de.achievements;

export function ProfileAchievements() {
  const state = useAchievements();
  if (!state) return null;
  const h = headline(state.fresh);
  const fresh = h
    ? (h.family === 'first'
        ? t.first.name
        : t.newTierShort(t.families[h.family].name, t.tiers[h.tier ?? 'bronze'])) +
      (state.fresh.length > 1 ? t.andMore(state.fresh.length - 1) : '')
    : undefined;
  return (
    <AchievementCard
      id="profile-achievements"
      unlocked={state.unlocked ?? {}}
      action={
        <Link to="/profil/erfolge" className={styles.more}>
          {t.showAll}
        </Link>
      }
    >
      {fresh && (
        <Link to="/profil/erfolge" className={styles.freshLine}>
          <span className={styles.newTag}>{t.newTag}</span>
          {fresh}
        </Link>
      )}
    </AchievementCard>
  );
}

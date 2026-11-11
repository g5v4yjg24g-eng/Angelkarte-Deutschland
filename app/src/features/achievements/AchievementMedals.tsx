// Erlangte Erfolge ganz klein als Reihe von Abzeichen (Visitenkarte in „Gemeinsam angeln“): „Erster Fang“ und je Familie
// die höchste erreichte Stufe, die wertvollsten zuerst. Nichts erreicht oder nicht freigegeben → gar nichts (null).
import { de } from '../../i18n/de';
import { bestTier, FAMILIES, FIRST_KEY, TIERS, type Unlocked } from '../../domain/achievements';
import { AchievementBadge } from './AchievementBadge';
import styles from './Achievements.module.css';

const t = de.achievements;

export function AchievementMedals({ unlocked, size = 22 }: { unlocked: Unlocked; size?: number }) {
  const best = FAMILIES.flatMap((f) => {
    const tier = bestTier(unlocked, f.id);
    return tier ? [{ family: f.id, tier }] : [];
  }).sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier));
  const first = !!unlocked[FIRST_KEY];
  if (!first && best.length === 0) return null;
  return (
    <span className={styles.medals} role="group" aria-label={t.title}>
      {first && <AchievementBadge kind="first" tier="start" size={size} label={t.first.name} />}
      {best.map(({ family, tier }) => (
        <AchievementBadge
          key={family}
          kind={family}
          tier={tier}
          size={size}
          label={`${t.families[family].name}: ${t.tiers[tier]}`}
        />
      ))}
    </span>
  );
}

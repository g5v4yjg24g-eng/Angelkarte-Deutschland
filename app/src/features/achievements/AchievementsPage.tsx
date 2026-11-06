// Erfolge-Übersicht (/profil/erfolge): je Familie die erreichte Stufe, die drei Stufen mit Schwellen und der
// Weg zur nächsten. Angezeigt wird der gespeicherte Stand (Variante A), der Fortschritt kommt aus dem Fangbuch.
import { useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { setSetting } from '../../data/settings';
import { Page } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import {
  bestTier,
  FAMILIES,
  FIRST_KEY,
  TIERS,
  tierKey,
  TOTAL_STEPS,
  unlockedCount,
  type FamilyId,
} from '../../domain/achievements';
import { AchievementBadge } from './AchievementBadge';
import { useAchievements } from './useAchievements';
import styles from './Achievements.module.css';

const t = de.achievements;
const date = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
const fmt = (f: FamilyId, n: number) => (f === 'big' ? `${n} cm` : n.toLocaleString('de-DE'));

export function AchievementsPage() {
  const state = useAchievements();
  // Beim Öffnen: „neu“-Markierung für diese Ansicht merken und gespeichert zurücksetzen
  const [seen, setSeen] = useState<string[]>();
  useEffect(() => {
    if (!state || seen) return;
    const keys = state.fresh;
    window.setTimeout(() => setSeen(keys), 0);
    if (keys.length) void setSetting('achievementsNew', []);
  }, [state, seen]);
  const isNew = (k: string) => !!seen?.includes(k);
  if (!state)
    return (
      <Page title={t.title} back="/profil">
        <Notice>{t.loading}</Notice>
      </Page>
    );
  const u = state.unlocked ?? {};
  const first = u[FIRST_KEY];
  return (
    <Page title={t.title} back="/profil">
      <p className="muted">{t.summary(unlockedCount(u), TOTAL_STEPS)}</p>
      <ul className={styles.grid} aria-label={t.title}>
        <li className={styles.tile}>
          <AchievementBadge kind="first" tier={first ? 'start' : null} size={72} />
          <span className={styles.tierName}>
            {first ? t.tiers.start : t.open}
            {isNew(FIRST_KEY) && <span className={styles.newTag}>{t.newTag}</span>}
          </span>
          <strong>{t.first.name}</strong>
          <span className={styles.how}>{t.first.how}</span>
          <span className={first ? styles.done : 'muted'}>{first ? t.since(date(first)) : t.notYet}</span>
        </li>
        {FAMILIES.map((f) => {
          const tier = bestTier(u, f.id);
          const i = tier ? TIERS.indexOf(tier) : -1;
          const next = f.steps[i + 1];
          const have = state.progress.values[f.id];
          const reachedAt = tier ? u[tierKey(f.id, tier)] : undefined;
          return (
            <li key={f.id} className={styles.tile}>
              <AchievementBadge
                kind={f.id}
                tier={tier ?? null}
                plate={tier ? String(f.steps[i]) : undefined}
                size={72}
              />
              <span className={styles.tierName}>
                {tier ? t.tiers[tier] : t.open}
                {tier && isNew(tierKey(f.id, tier)) && <span className={styles.newTag}>{t.newTag}</span>}
              </span>
              <strong>{t.families[f.id].name}</strong>
              <span className={styles.how}>
                {t.families[f.id].how(fmt(f.id, f.steps[Math.max(0, i)] ?? 0))}
              </span>
              <span className={styles.pips} aria-label={t.stepsLabel}>
                {TIERS.map((k, j) => (
                  <span key={k} className={styles.pip}>
                    <AchievementBadge
                      kind={f.id}
                      tier={u[tierKey(f.id, k)] ? k : null}
                      size={26}
                      label={`${t.tiers[k]}: ${t.families[f.id].how(fmt(f.id, f.steps[j] ?? 0))}${u[tierKey(f.id, k)] ? '' : ` (${t.open})`}`}
                    />
                    {fmt(f.id, f.steps[j] ?? 0)}
                  </span>
                ))}
              </span>
              {next === undefined ? (
                <span className={styles.done}>{t.maxed}</span>
              ) : (
                <>
                  <span className={styles.progress} aria-hidden="true">
                    <span style={{ width: `${Math.min(100, Math.round((have / next) * 100))}%` }} />
                  </span>
                  <span className="muted">
                    {f.id === 'big' ? t.biggest(fmt(f.id, have)) : t.ofNext(fmt(f.id, have), fmt(f.id, next))}
                    {' · '}
                    {t.next(t.tiers[TIERS[i + 1] ?? 'bronze'])}
                  </span>
                </>
              )}
              {reachedAt && <span className={styles.small}>{t.since(date(reachedAt))}</span>}
            </li>
          );
        })}
      </ul>
      <p className="muted">{t.rules}</p>
    </Page>
  );
}

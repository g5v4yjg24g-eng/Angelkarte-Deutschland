// Profilkarte für „Angler entdecken“ – wiederverwendbar (Feed, später ggf. Suche). Zeigt nur, was der Server freigibt:
// Name, Abzeichen, Empfehlungsgrund (nie Entfernung/Ort), bis zu drei freigegebene Erfolge und „Folgen“.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { CloseIcon } from '../../design/icons';
import { initialOf } from '../../domain/feed';
import { reasonsOf, topAchievements, type FollowState, type Suggestion } from '../../domain/suggestions';
import { AchievementBadge } from '../achievements/AchievementBadge';
import { FounderBadge } from '../badges/FounderBadge';
import styles from './Suggest.module.css';

const t = de.suggest;
const a = de.achievements;

export function SuggestCard({
  s,
  avatarUrl,
  state,
  onFollow,
  onDismiss,
}: {
  s: Suggestion;
  avatarUrl?: string | undefined;
  state: FollowState;
  onFollow: () => void;
  onDismiss: () => void;
}) {
  const reasons = reasonsOf(s);
  const wins = topAchievements(s.achievementKeys);
  const done = state === 'requested' || state === 'following';
  const label =
    state === 'busy'
      ? t.busy
      : state === 'requested'
        ? t.requested
        : state === 'following'
          ? t.following
          : t.follow;
  return (
    <article className={styles.card} aria-label={s.displayName}>
      <button
        type="button"
        className={styles.close}
        aria-label={t.dismiss(s.displayName)}
        onClick={onDismiss}
      >
        <CloseIcon size={16} />
      </button>
      <Link
        to={`/profil/nutzer/${s.username}`}
        className={styles.avatarLink}
        tabIndex={-1}
        aria-hidden="true"
      >
        <span className={styles.avatar}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : initialOf(s.displayName)}
        </span>
      </Link>
      <span className={styles.names}>
        <Link
          to={`/profil/nutzer/${s.username}`}
          className={styles.name}
          aria-label={t.openProfile(s.displayName)}
        >
          <span className={styles.nameText}>{s.displayName}</span>
          {s.badges.includes('founder') && <FounderBadge />}
        </Link>
        <span className={`${styles.handle} muted`}>{t.handle(s.username)}</span>
      </span>
      <ul className={reasons.length ? styles.reasons : styles.reasonsNone} aria-label={t.title}>
        {reasons.map((r) => (
          <li key={r.kind} className={styles.reason}>
            {t.reasonFriends(r.count)}
          </li>
        ))}
      </ul>
      {wins.length > 0 ? (
        <ul
          className={styles.wins}
          aria-label={t.achievements}
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {wins.map((w) => {
            const name = w.kind === 'first' ? a.first.name : a.families[w.kind].name;
            const tier = a.tiers[w.tier];
            return (
              <li key={w.kind} className={styles.win}>
                <AchievementBadge kind={w.kind} tier={w.tier} size={34} label={`${name}: ${tier}`} />
                <span aria-hidden="true">{name}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={`${styles.neutral} muted`}>{t.noAchievements}</p>
      )}
      <button
        type="button"
        className={styles.followBtn}
        data-state={state}
        aria-label={done ? undefined : t.followLabel(s.displayName)}
        aria-disabled={done || state === 'busy' ? true : undefined}
        onClick={onFollow}
      >
        {label}
      </button>
    </article>
  );
}

// Einladung (Termin, Session, Session-Start) als Visitenkarte der einladenden Person: Profilbild, Name, @Name, ihre
// Erfolge ganz klein, was eingeladen wurde – bei Terminen mit Titel, Tag, Zeit und Gewässer – und grün „Annehmen“,
// rot „Ablehnen“. Antippen einer freien Stelle öffnet den Angelkalender bzw. die Sessions.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { VisitCard, type VisitTone } from '../../design/components/VisitCard';
import type { Unlocked } from '../../domain/achievements';
import { timeAgo, type AppNotification } from '../../domain/notifications';
import { AchievementMedals } from '../achievements/AchievementMedals';
import { Avatar } from '../profile/Avatar';
import styles from './Notifications.module.css';

const t = de.notifications;

export function InviteCard({
  n,
  to,
  avatarUrl,
  unlocked,
  now,
  busy,
  error,
  onAnswer,
}: {
  n: AppNotification;
  /** Ziel beim Antippen */
  to: string;
  avatarUrl?: string | undefined;
  unlocked?: Unlocked | undefined;
  now: number;
  busy: boolean;
  error?: string | undefined;
  onAnswer: (accept: boolean) => void;
}) {
  const status = n.inviteStatus ?? 'invited';
  const isTrip = n.kind === 'trip_invite';
  const tone: VisitTone = status === 'accepted' ? 'success' : status === 'declined' ? 'danger' : 'waiting';
  const isSpots = n.kind === 'spot_link';
  const label =
    status === 'accepted'
      ? isSpots
        ? t.spotsAccepted
        : t.accepted
      : status === 'declined'
        ? t.declined
        : isSpots
          ? t.invitedSpots
          : isTrip
            ? t.invitedTrip
            : t.invitedSession;
  const sessionTitle = n.sessionTitle ?? n.excerpt;
  const tripTitle = n.trip?.title ?? n.excerpt;
  return (
    <VisitCard
      label={t.inviteFrom(n.displayName)}
      avatar={<Avatar url={avatarUrl} size={56} />}
      name={n.displayName}
      handle={`@${n.username}`}
      detail={unlocked ? <AchievementMedals unlocked={unlocked} /> : undefined}
      status={{ label, tone }}
      footer={
        <>
          <Link to={to} className={styles.cardLink} aria-label={t.openInvite(n.displayName)} />
          {isTrip && n.trip ? (
            <dl className={styles.facts}>
              {tripTitle && (
                <>
                  <dt>{t.tripName}</dt>
                  <dd>
                    <strong>{tripTitle}</strong>
                  </dd>
                </>
              )}
              <dt>{t.tripWhen}</dt>
              <dd>
                {[de.calendar.dayTitle(n.trip.date), de.calendar.time(n.trip.from, n.trip.to)]
                  .filter(Boolean)
                  .join(' · ')}
              </dd>
              {n.trip.waterName && (
                <>
                  <dt>{t.tripWhere}</dt>
                  <dd>{n.trip.waterName}</dd>
                </>
              )}
            </dl>
          ) : (
            !isSpots && sessionTitle && <p className={styles.sessionTitle}>„{sessionTitle}“</p>
          )}
          {status === 'invited' && (
            <div className={styles.answers}>
              <button type="button" className={styles.accept} disabled={busy} onClick={() => onAnswer(true)}>
                {t.accept}
              </button>
              <button
                type="button"
                className={styles.declineBtn}
                disabled={busy}
                onClick={() => onAnswer(false)}
              >
                {t.decline}
              </button>
            </div>
          )}
          {error && (
            <p className={styles.answerError} role="alert">
              {error}
            </p>
          )}
          <span className={styles.cardTime}>{timeAgo(n.createdAt, now)}</span>
        </>
      }
    />
  );
}

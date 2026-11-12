// Eine Spot-Verbindung als Visitenkarte (Wunsch Nutzer 2026-11-12): Profilbild, Name, Zahl der geteilten Spots.
// Offenes Angebot an mich: grün „Annehmen“, rot „Ablehnen“. Angenommen: X am rechten Rand beendet das Teilen
// (nach Rückfrage); dasselbe per Wisch von rechts nach links.
import type { ReactNode } from 'react';
import { de } from '../../i18n/de';
import { VisitCard, type VisitTone } from '../../design/components/VisitCard';
import { Button } from '../../design/components/Button';
import { CloseIcon } from '../../design/icons';
import type { Unlocked } from '../../domain/achievements';
import type { SpotLink } from '../../domain/spotLinks';
import { AchievementMedals } from '../achievements/AchievementMedals';
import { SwipeRow } from '../notifications/SwipeRow';
import { Avatar } from '../profile/Avatar';
import notify from '../notifications/Notifications.module.css';
import styles from './Spots.module.css';

const t = de.spots;

export function SpotLinkCard({
  link,
  tab,
  avatarUrl,
  unlocked,
  busy,
  onAnswer,
  onEnd,
  onJoin,
  children,
}: {
  link: SpotLink;
  tab: 'incoming' | 'outgoing';
  avatarUrl?: string | undefined;
  unlocked?: Unlocked | undefined;
  busy: boolean;
  onAnswer: (accept: boolean) => void;
  /** öffnet die Rückfrage */
  onEnd: () => void;
  onJoin: () => void;
  /** Inhalt unter der Karte (die Spots der Person) */
  children?: ReactNode;
}) {
  const accepted = link.status === 'accepted';
  const needsJoin = accepted && !link.iShare;
  const open = !accepted && link.direction === 'incoming';
  const count = tab === 'incoming' ? link.spotsFromPartner : link.spotsToPartner;
  const tone: VisitTone = needsJoin || !accepted ? 'waiting' : 'success';
  const status = needsJoin
    ? t.statusLegacy
    : open
      ? t.statusIncoming
      : accepted
        ? tab === 'incoming'
          ? t.sharedWithYouCount(count)
          : t.sharedByYouCount(count)
        : t.statusOutgoing;
  const card = (
    <VisitCard
      label={link.displayName}
      avatar={<Avatar url={avatarUrl} size={56} />}
      name={link.displayName}
      handle={`@${link.username}`}
      detail={unlocked ? <AchievementMedals unlocked={unlocked} /> : undefined}
      status={{ label: status, tone }}
      trailing={
        accepted ? (
          <button
            type="button"
            className={styles.endButton}
            aria-label={t.endLabel(link.displayName)}
            disabled={busy}
            onClick={onEnd}
          >
            <CloseIcon size={18} aria-hidden="true" />
          </button>
        ) : undefined
      }
      footer={
        open || needsJoin || children ? (
          <>
            {open && (
              <div className={notify.answers}>
                <button
                  type="button"
                  className={notify.accept}
                  disabled={busy}
                  onClick={() => onAnswer(true)}
                >
                  {t.accept}
                </button>
                <button
                  type="button"
                  className={notify.declineBtn}
                  disabled={busy}
                  onClick={() => onAnswer(false)}
                >
                  {t.decline}
                </button>
              </div>
            )}
            {needsJoin && (
              <Button disabled={busy} onClick={onJoin}>
                {t.joinShare}
              </Button>
            )}
            {children}
          </>
        ) : undefined
      }
    />
  );
  return accepted ? (
    <SwipeRow
      card
      confirm
      label={t.endLabel(link.displayName)}
      actionLabel={t.endAction}
      onDelete={onEnd}
    >
      {card}
    </SwipeRow>
  ) : (
    card
  );
}

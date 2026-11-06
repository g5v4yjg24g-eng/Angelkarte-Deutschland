// Zahlen und Knopfzeile „Gefällt mir | Kommentieren“ (Daumen hoch wie früher bei Facebook, Wunsch Nutzer
// 2026-10-27) – gemeinsam für Beitragsseite (Gerät oder Server) und Feed.
import { useState, type Ref } from 'react';
import { de } from '../../i18n/de';
import { BookmarkIcon, CommentIcon, ThumbsUpIcon } from '../../design/icons';
import { useHaptics } from '../haptics/useHaptics';
import styles from '../profile/Profile.module.css';

const t = de.profile;

export function ReactionBar({
  likeCount,
  commentCount,
  liked,
  onLike,
  onComments,
  likeIconRef,
  pulse = 0,
  saved,
  onSave,
}: {
  likeCount: number;
  commentCount: number;
  liked: boolean;
  onLike: () => void;
  onComments: () => void;
  /** Ziel für den Hecht beim Doppeltipp */
  likeIconRef?: Ref<HTMLSpanElement>;
  /** Zähler: jede Erhöhung lässt den Daumen hüpfen (Hecht angekommen) */
  pulse?: number;
  /** Lesezeichen (Paket 7b; nur bei Beiträgen vom Server) */
  saved?: boolean;
  onSave?: () => void;
}) {
  const haptics = useHaptics();
  const [taps, setTaps] = useState(0);
  const pops = pulse + taps;
  return (
    <>
      {(likeCount > 0 || commentCount > 0) && (
        <div className={styles.counts2}>
          <span>
            {likeCount > 0 && (
              <>
                <span className={styles.likeBadge} aria-hidden="true">
                  <ThumbsUpIcon filled size={12} />
                </span>{' '}
                {t.likeCount(likeCount)}
              </>
            )}
          </span>
          {commentCount > 0 && (
            <button type="button" className={styles.linkish} onClick={onComments}>
              {t.commentCount(commentCount)}
            </button>
          )}
        </div>
      )}
      <div className={[styles.actionRow, onSave ? styles.actionRow3 : ''].join(' ')}>
        <button
          type="button"
          className={[styles.action, liked ? styles.liked : ''].join(' ')}
          aria-pressed={liked}
          onClick={() => {
            if (!liked) {
              haptics.light();
              setTaps((n) => n + 1);
            }
            onLike();
          }}
        >
          <span
            key={pops}
            ref={likeIconRef}
            className={[styles.likeIcon, pops > 0 ? styles.likePop : ''].join(' ')}
            aria-hidden="true"
          >
            <ThumbsUpIcon filled={liked} size={22} />
          </span>
          <span>{t.like}</span>
        </button>
        <button type="button" className={styles.action} onClick={onComments}>
          <CommentIcon size={22} />
          <span>{t.commentAction}</span>
        </button>
        {onSave && (
          <button
            type="button"
            className={[styles.action, styles.saveAction, saved ? styles.liked : ''].join(' ')}
            aria-pressed={!!saved}
            onClick={onSave}
          >
            <BookmarkIcon filled={!!saved} size={22} />
            <span className="visually-hidden">{saved ? de.feed.saved : de.feed.save}</span>
          </button>
        )}
      </div>
    </>
  );
}

// Zahlen und Knopfzeile „Gefällt mir | Kommentieren“ (Daumen hoch wie früher bei Facebook, Wunsch Nutzer
// 2026-10-27) – gemeinsam für Beitragsseite (Gerät oder Server) und Feed.
import { de } from '../../i18n/de';
import { CommentIcon, ThumbsUpIcon } from '../../design/icons';
import { useHaptics } from '../haptics/useHaptics';
import styles from '../profile/Profile.module.css';

const t = de.profile;

export function ReactionBar({
  likeCount,
  commentCount,
  liked,
  onLike,
  onComments,
}: {
  likeCount: number;
  commentCount: number;
  liked: boolean;
  onLike: () => void;
  onComments: () => void;
}) {
  const haptics = useHaptics();
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
      <div className={styles.actionRow}>
        <button
          type="button"
          className={[styles.action, liked ? styles.liked : ''].join(' ')}
          aria-pressed={liked}
          onClick={() => {
            if (!liked) haptics.light();
            onLike();
          }}
        >
          <ThumbsUpIcon filled={liked} size={22} />
          <span>{t.like}</span>
        </button>
        <button type="button" className={styles.action} onClick={onComments}>
          <CommentIcon size={22} />
          <span>{t.commentAction}</span>
        </button>
      </div>
    </>
  );
}

// Kommentare eines geteilten Beitrags vom Server (Wunsch Nutzer 2026-11-04): mit Namen und Abzeichen; fremde
// Kommentare lassen sich melden, Verfasser blockieren. Löschen: eigene und alle unter dem eigenen Beitrag.
import { useAvatarUrls } from '../profile/avatarUrls';
import { useCallback, useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { Toast } from '../../design/components/Toast';
import { isHidden } from '../../domain/moderation';
import type { ServerComment } from '../../domain/reactions';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { useHidden } from '../moderation/hiddenStore';
import { SafetyMenu } from '../moderation/SafetyMenu';
import { CommentsSheetView, type ViewComment } from '../profile/CommentsSheet';
import { reactionErrorText } from './reactionErrors';

export function ServerCommentsSheet({
  open,
  postId,
  myAvatarPhotoId,
  onClose,
  onCountChange,
}: {
  open: boolean;
  postId: string;
  /** eigenes Profilbild (nur auf dem Gerät) – für eigene Kommentare */
  myAvatarPhotoId?: string | undefined;
  onClose: () => void;
  /** Kommentarzahl hat sich geändert (+1 / −1) */
  onCountChange?: (delta: number) => void;
}) {
  const { account } = useProviders();
  const me = storedUserId();
  const hidden = useHidden();
  const [list, setList] = useState<ServerComment[]>();
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<string>();

  const load = useCallback(() => {
    account
      .postComments(postId)
      .then((l) => {
        setList(l);
        setError(undefined);
      })
      .catch(() => setError(de.reactions.loadError));
  }, [account, postId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const avatars = useAvatarUrls((list ?? []).map((c) => c.authorId));
  const comments: ViewComment[] = (list ?? [])
    .filter((c) => !isHidden(hidden, 'comment', c.id, c.authorId))
    .map((c) => ({
      id: c.id,
      name: c.displayName,
      founder: c.badges.includes('founder'),
      avatarPhotoId: c.authorId === me ? myAvatarPhotoId : undefined,
      avatarUrl: avatars.get(c.authorId),
      createdAt: c.createdAt,
      text: c.text,
      canDelete: c.canDelete,
      extra:
        c.authorId !== me ? (
          <SafetyMenu
            kind="comment"
            targetId={c.id}
            owner={{ id: c.authorId, name: c.displayName }}
            onDone={(message, action) =>
              setToast(action === 'reported' ? de.reactions.reportedComment : message)
            }
          />
        ) : undefined,
    }));

  return (
    <CommentsSheetView
      open={open}
      comments={comments}
      myAvatarPhotoId={myAvatarPhotoId}
      loading={list === undefined && !error}
      error={error}
      onClose={onClose}
      onSend={async (text) => {
        try {
          await account.addComment(postId, text);
        } catch (e) {
          throw new Error(reactionErrorText(e), { cause: e });
        }
        onCountChange?.(1);
        load();
      }}
      onDelete={async (id) => {
        try {
          await account.deleteComment(id);
        } catch (e) {
          throw new Error(reactionErrorText(e), { cause: e });
        }
        setList((l) => l?.filter((c) => c.id !== id));
        onCountChange?.(-1);
      }}
      notice={toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
    />
  );
}

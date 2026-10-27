// Kommentare als Fenster von unten (Wunsch Nutzer 2026-10-27, Vorbild Instagram): Liste, Emoji-Leiste, Eingabe unten.
// Schließen: herunterziehen (am Griff/Titel, oder in der Liste, wenn sie oben steht), Hintergrund antippen, Escape.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { IconButton } from '../../design/components/Button';
import { Toast } from '../../design/components/Toast';
import { CloseIcon, SendIcon } from '../../design/icons';
import { addComment, postReactions, removeComment, restoreComment } from '../../data/profileService';
import { COMMENT_MAX, commentValid } from '../../domain/profile';
import { LOCAL_AUTHOR } from '../../domain/schemas';
import { Avatar } from './Avatar';
import { dragOffset, shouldClose } from './sheetDrag';
import styles from './Comments.module.css';

const t = de.profile;
const EMOJIS = ['👍', '🎣', '🔥', '👏', '🙌', '😍', '😮', '😂'];

const ago = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' });

export function CommentsSheet({
  open,
  postId,
  name,
  avatarPhotoId,
  onClose,
}: {
  open: boolean;
  postId: string;
  name: string;
  avatarPhotoId?: string | undefined;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const reactions = useLiveQuery(() => postReactions(postId), [postId]);
  const comments = reactions?.comments ?? [];
  const [text, setText] = useState('');
  const [undo, setUndo] = useState<{ id: string; restored: boolean }>();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Herunterziehen: Finger verfolgen; in der Liste nur, wenn sie ganz oben steht
  useEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    let start: { y: number; t: number } | undefined;
    let dy = 0;
    const set = (px: number, animate: boolean) => {
      el.style.transition = animate ? 'transform 200ms ease-out' : 'none';
      el.style.transform = px ? `translateY(${px}px)` : '';
    };
    const down = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('form, button, input')) return;
      if (list.current?.contains(target) && list.current.scrollTop > 0) return;
      start = { y: e.touches[0]?.clientY ?? 0, t: performance.now() };
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (!start) return;
      dy = (e.touches[0]?.clientY ?? 0) - start.y;
      if (dy > 0) {
        e.preventDefault(); // Liste nicht scrollen, Fenster folgt dem Finger
        set(dragOffset(dy), false);
      } else if (list.current?.contains(e.target as Node)) start = undefined; // nach oben: normal scrollen
    };
    const up = () => {
      if (!start) return;
      const speed = dy / Math.max(1, performance.now() - start.t);
      start = undefined;
      if (shouldClose(dy, speed, el.offsetHeight)) {
        set(el.offsetHeight, true);
        window.setTimeout(() => {
          set(0, false);
          close.current();
        }, 200);
      } else set(0, true);
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }, [open]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!commentValid(text)) return;
    void addComment(postId, text).then(() => {
      setText('');
      requestAnimationFrame(() => list.current?.scrollTo({ top: list.current.scrollHeight }));
    });
  };

  return (
    <dialog
      ref={dialog}
      className={styles.sheet}
      aria-labelledby="comments-title"
      onClose={() => close.current()}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      {open && (
        <div ref={panel} className={styles.panel}>
          <header className={styles.header}>
            <span className={styles.handle} aria-hidden="true" />
            <h2 id="comments-title">{t.commentsTitle}</h2>
            <IconButton
              label={de.common.close}
              icon={<CloseIcon size={20} />}
              className={styles.close}
              onClick={onClose}
            />
          </header>
          {comments.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t.noComments}</p>
              <p className="muted">{t.firstComment}</p>
            </div>
          ) : (
            <ul ref={list} className={styles.list}>
              {comments.map((c) => (
                <li key={c.id} className={styles.comment}>
                  <Avatar photoId={c.authorId === LOCAL_AUTHOR ? avatarPhotoId : undefined} size={36} />
                  <div className={styles.body}>
                    <p className={styles.meta}>
                      <strong>{name}</strong> <span className="muted">{ago(c.createdAt)}</span>
                    </p>
                    <p className={styles.text}>{c.text}</p>
                  </div>
                  {c.authorId === LOCAL_AUTHOR && (
                    <IconButton
                      label={t.deleteComment}
                      icon={<CloseIcon size={16} />}
                      className={styles.delete}
                      onClick={() =>
                        void removeComment(c.id).then(() => setUndo({ id: c.id, restored: false }))
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.composer}>
            <div className={styles.emojis} role="group" aria-label={t.emojiLabel}>
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className={styles.emoji}
                  aria-label={t.addEmoji(em)}
                  onClick={() => {
                    setText((v) => (v + em).slice(0, COMMENT_MAX));
                    input.current?.focus();
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
            <form className={styles.form} onSubmit={send}>
              <Avatar photoId={avatarPhotoId} size={36} />
              <input
                ref={input}
                className={styles.input}
                aria-label={t.commentLabel}
                placeholder={t.commentPlaceholder}
                value={text}
                maxLength={COMMENT_MAX}
                enterKeyHint="send"
                onChange={(e) => setText(e.target.value)}
              />
              <IconButton
                type="submit"
                label={t.commentSend}
                icon={<SendIcon size={22} />}
                className={styles.send}
                disabled={!commentValid(text)}
              />
            </form>
          </div>
          {undo && (
            <Toast
              onDismiss={() => setUndo(undefined)}
              actions={
                !undo.restored && (
                  <button
                    type="button"
                    className={styles.undo}
                    onClick={() =>
                      void restoreComment(undo.id).then(() => setUndo({ ...undo, restored: true }))
                    }
                  >
                    {t.undo}
                  </button>
                )
              }
            >
              {undo.restored ? t.commentRestored : t.commentDeleted}
            </Toast>
          )}
        </div>
      )}
    </dialog>
  );
}

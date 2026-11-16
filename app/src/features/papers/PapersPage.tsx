// Angelpapiere (Wallet, Wunsch Nutzer 2026-11-16): Fischereischein, Erlaubnisscheine, Ausweise mit Foto, Ablaufdatum und
// Erinnerung. Bleibt auf dem Gerät, ist Teil der Sicherung. Erinnerungen als Mitteilung nur in der iPhone-App.
import { useEffect, useMemo, useState } from 'react';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { Toast } from '../../design/components/Toast';
import { IdCardIcon, PlusIcon } from '../../design/icons';
import { removePaper, restorePaper } from '../../data/paperService';
import { localToday, needAttention, remindEnabled, sortPapers } from '../../domain/papers';
import { useProviders } from '../../ports/providersContext';
import type { ReminderPermission } from '../../ports/reminders';
import { PaperCard } from './PaperCard';
import { PaperDetail } from './PaperDetail';
import { PaperForm } from './PaperForm';
import { usePapers } from './usePapers';
import styles from './Papers.module.css';

const t = de.papers;

export function PapersPage() {
  const all = usePapers();
  const { reminders } = useProviders();
  const [permission, setPermission] = useState<ReminderPermission>();
  const [today] = useState(() => localToday(new Date()));
  // 'new' = neues Papier, sonst die ID des angezeigten
  const [open, setOpen] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [toast, setToast] = useState<{ text: string; undoId?: string }>();

  useEffect(() => {
    let alive = true;
    void reminders?.permission().then((p) => alive && setPermission(p));
    return () => {
      alive = false;
    };
  }, [reminders, all?.length]);

  const papers = useMemo(() => sortPapers(all ?? [], today), [all, today]);
  if (!all)
    return (
      <Page title={t.title} back="/mehr">
        <Notice>{t.loading}</Notice>
      </Page>
    );

  const attention = needAttention(papers, today).length;
  const reminding = papers.some((p) => p.validUntil && remindEnabled(p));
  const current = papers.find((p) => p.id === open);
  const editingPaper = papers.find((p) => p.id === editing);

  return (
    <Page title={t.title} back="/mehr">
      <Button icon={<PlusIcon size={20} />} onClick={() => setOpen('new')}>
        {t.add}
      </Button>
      {attention > 0 && <Notice tone="warning">{t.attention(attention)}</Notice>}
      {reminding && reminders && permission === 'denied' && <Notice>{t.remindDenied}</Notice>}
      {reminding && !reminders && <Notice>{t.remindWeb}</Notice>}
      {papers.length === 0 ? (
        <EmptyState icon={<IdCardIcon size={32} />} title={t.emptyTitle}>
          {t.empty}
        </EmptyState>
      ) : (
        <ul className={styles.list} aria-label={t.list}>
          {papers.map((p) => (
            <li key={p.id}>
              <PaperCard paper={p} today={today} onOpen={() => setOpen(p.id)} />
            </li>
          ))}
        </ul>
      )}
      {open === 'new' && (
        <PaperForm
          onClose={() => setOpen(undefined)}
          onSaved={(p) => {
            setOpen(p.id);
          }}
        />
      )}
      {current && !editingPaper && (
        <PaperDetail
          paper={current}
          today={today}
          onClose={() => setOpen(undefined)}
          onEdit={() => setEditing(current.id)}
          onRenewed={() => setToast({ text: t.detail.renewed })}
          onRemove={() => {
            const { id, title } = current;
            setOpen(undefined);
            void removePaper(id).then(() => setToast({ text: `${t.detail.removed}: ${title}`, undoId: id }));
          }}
        />
      )}
      {editingPaper && (
        <PaperForm
          initial={editingPaper}
          onClose={() => setEditing(undefined)}
          onSaved={() => setEditing(undefined)}
        />
      )}
      {toast && (
        <Toast
          onDismiss={() => setToast(undefined)}
          actions={
            toast.undoId && (
              <Button
                variant="ghost"
                onClick={() => {
                  const id = toast.undoId ?? '';
                  void restorePaper(id).then(() => setToast({ text: t.detail.undo }));
                }}
              >
                {t.detail.undo}
              </Button>
            )
          }
        >
          {toast.text}
        </Toast>
      )}
    </Page>
  );
}

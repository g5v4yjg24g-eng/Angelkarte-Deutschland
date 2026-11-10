// Admin → Verwaltung → Community-Regeln (Wunsch Nutzer 2026-11-10): aktuelle Fassung mit Zahl der Zustimmungen,
// Editor für eine neue Fassung (nur Founder; der Server prüft das selbst) und der vollständige Verlauf.
import { useCallback, useEffect, useState } from 'react';
import { de } from '../../../i18n/de';
import { Page, Section } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { TextArea, TextField } from '../../../design/components/Field';
import { Notice } from '../../../design/components/Notice';
import { Sheet } from '../../../design/components/Sheet';
import { Toast } from '../../../design/components/Toast';
import {
  RULES_MAX_ITEM,
  RULES_MAX_ITEMS,
  RULES_MAX_INTRO,
  RULES_MAX_SUMMARY,
  cleanDraft,
  draftIssue,
  moveItem,
  type RulesDraft,
  type RulesVersion,
} from '../../../domain/communityRules';
import type { ModRole } from '../../../domain/modTools';
import { useProviders } from '../../../ports/providersContext';
import { rememberRules } from '../rulesConsent';
import { ADMIN_BASE } from './adminPaths';
import { modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin.rulesAdmin;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' });
const draftOf = (r: RulesVersion | undefined): RulesDraft => ({
  intro: r?.intro ?? '',
  items: r ? [...r.items] : [''],
  summary: '',
});

export function RulesAdminPage() {
  const { account } = useProviders();
  const [history, setHistory] = useState<RulesVersion[]>();
  const [role, setRole] = useState<ModRole>();
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<RulesDraft>();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishError, setPublishError] = useState<string>();
  const [toast, setToast] = useState<string>();
  const current = history?.[0];

  const load = useCallback(async () => {
    try {
      const h = await account.modRulesHistory();
      setHistory(h);
      setDraft(draftOf(h[0]));
      setError(undefined);
    } catch (e) {
      setError(modErrorText(e));
    }
  }, [account]);

  useEffect(() => {
    // erst nach dem Zeichnen laden (Zustand wird nur asynchron gesetzt)
    const timer = setTimeout(() => void load(), 0);
    void account.modMyRole().then(setRole);
    return () => clearTimeout(timer);
  }, [account, load]);

  const issue = draft ? draftIssue(draft, current) : 'empty';
  const founder = role === 'founder';
  const setItem = (i: number, v: string) =>
    setDraft((d) => d && { ...d, items: d.items.map((x, n) => (n === i ? v : x)) });

  const publish = async () => {
    if (!draft || issue) return;
    setBusy(true);
    setPublishError(undefined);
    try {
      const c = cleanDraft(draft);
      const v = await account.modPublishRules(c.intro, c.items, c.summary);
      rememberRules({
        version: v,
        intro: c.intro,
        items: c.items,
        summary: c.summary,
        publishedAt: new Date().toISOString(),
      });
      setConfirm(false);
      setToast(t.published(v));
      await load();
    } catch (e) {
      setPublishError(modErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t.title} back={`${ADMIN_BASE}/verwaltung`}>
      {error && <Notice tone="error">{error}</Notice>}
      {!history && !error && <p className="muted">{de.modAdmin.loading}</p>}
      {current && (
        <div className={styles.item}>
          <strong>{t.current(current.version, day(current.publishedAt))}</strong>
          <span className="muted">{t.consents(current.consents, current.accounts)}</span>
        </div>
      )}

      {draft && founder && (
        <Section title={t.editTitle}>
          <p className={`muted ${styles.small}`}>{t.editHint}</p>
          <div className={styles.form}>
            <TextArea
              label={t.intro}
              value={draft.intro}
              rows={3}
              maxLength={RULES_MAX_INTRO}
              onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
            />
            <ol className={styles.ruleEditor}>
              {draft.items.map((item, i) => (
                <li key={i}>
                  <TextArea
                    label={t.item(i + 1)}
                    value={item}
                    rows={2}
                    maxLength={RULES_MAX_ITEM}
                    onChange={(e) => setItem(i, e.target.value)}
                  />
                  <div className={styles.buttons}>
                    <Button
                      variant="ghost"
                      aria-label={t.up(i + 1)}
                      disabled={i === 0}
                      onClick={() => setDraft({ ...draft, items: moveItem(draft.items, i, i - 1) })}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={t.down(i + 1)}
                      disabled={i === draft.items.length - 1}
                      onClick={() => setDraft({ ...draft, items: moveItem(draft.items, i, i + 1) })}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={t.remove(i + 1)}
                      disabled={draft.items.length === 1}
                      onClick={() => setDraft({ ...draft, items: draft.items.filter((_, n) => n !== i) })}
                    >
                      ✕
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
            <div className={styles.buttons}>
              <Button
                variant="secondary"
                disabled={draft.items.length >= RULES_MAX_ITEMS}
                onClick={() => setDraft({ ...draft, items: [...draft.items, ''] })}
              >
                {t.add}
              </Button>
            </div>
            <TextField
              label={t.summary}
              value={draft.summary}
              maxLength={RULES_MAX_SUMMARY}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
            {issue && <p className={`muted ${styles.small}`}>{t.issues[issue]}</p>}
            <div className={styles.buttons}>
              <Button disabled={!!issue} onClick={() => setConfirm(true)}>
                {t.publish}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(draftOf(current))}>
                {t.reset}
              </Button>
            </div>
          </div>
        </Section>
      )}
      {history && role && !founder && <Notice>{t.readOnly}</Notice>}

      {history && history.length > 0 && (
        <Section title={t.history}>
          <ul className={styles.list}>
            {history.map((v) => (
              <li key={v.version} className={styles.item}>
                <strong>{t.historyItem(v.version, day(v.publishedAt))}</strong>
                <span>{v.summary ?? t.first}</span>
                <span className="muted">
                  {v.publisherName && `${t.by(v.publisherName)} · `}
                  {t.consents(v.consents, v.accounts)}
                </span>
                <details>
                  <summary>{t.show}</summary>
                  <p>{v.intro}</p>
                  <ol>
                    {v.items.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ol>
                </details>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Sheet open={confirm} title={t.confirmTitle} onClose={() => setConfirm(false)}>
        <div className={styles.form}>
          <p>{t.confirmText((current?.version ?? 0) + 1)}</p>
          {publishError && <Notice tone="error">{publishError}</Notice>}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {de.modAdmin.cancel}
            </Button>
            <Button disabled={busy} onClick={() => void publish()}>
              {t.publish}
            </Button>
          </div>
        </div>
      </Sheet>
      {toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
    </Page>
  );
}

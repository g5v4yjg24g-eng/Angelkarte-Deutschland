// Regeln der Community: als Liste (Seite /mehr/regeln), als Fenster vor dem Registrieren und als Hinweis auf eine
// neue Fassung (Versionen seit 2026-11-10; Text kommt vom Server, eingebaute Fassung als Rückfall).
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Page } from '../../design/components/Page';
import { Sheet } from '../../design/components/Sheet';
import type { CommunityRules } from '../../domain/communityRules';
import { useProviders } from '../../ports/providersContext';
import { knownRules, useCommunityRules } from './rulesConsent';
import styles from './Moderation.module.css';

const t = de.moderation;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'long', timeZone: 'Europe/Berlin' });

export function RulesList({ rules }: { rules: CommunityRules }) {
  return (
    <>
      <p>{rules.intro}</p>
      <ul className={styles.rules}>
        {rules.items.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      <p className="muted">{t.rulesContact}</p>
      <p className={`muted ${styles.small}`}>{t.rulesVersion(rules.version, day(rules.publishedAt))}</p>
    </>
  );
}

/**
 * Zustimmung: vor dem Registrieren (`update` aus) oder bei einer neuen Fassung (`update` an: Änderung oben,
 * „Später“ statt „Ablehnen“).
 */
export function RulesConsent({
  open,
  rules,
  update = false,
  busy = false,
  onAccept,
  onDecline,
}: {
  open: boolean;
  rules?: CommunityRules | undefined;
  update?: boolean;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const r = rules ?? knownRules();
  return (
    <Sheet
      open={open}
      title={update ? t.rulesUpdatedTitle : t.rulesTitle}
      onClose={onDecline}
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onDecline}>
            {update ? t.later : t.decline}
          </Button>
          <Button onClick={onAccept} disabled={busy}>
            {t.accept}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        {update && (
          <div className={styles.changed}>
            <strong>{t.rulesChanged}</strong>
            {r.summary && <p>{r.summary}</p>}
          </div>
        )}
        <RulesList rules={r} />
      </div>
    </Sheet>
  );
}

export function RulesPage() {
  const { account } = useProviders();
  const rules = useCommunityRules(account);
  return (
    <Page title={t.rulesTitle} back="/mehr">
      <div className={styles.form}>
        <RulesList rules={rules} />
      </div>
    </Page>
  );
}

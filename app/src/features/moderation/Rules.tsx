// Regeln der Community: als Liste (Seite /mehr/regeln) und als Fenster vor dem Versand des Anmeldecodes.
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Page } from '../../design/components/Page';
import { Sheet } from '../../design/components/Sheet';
import styles from './Moderation.module.css';

const t = de.moderation;

export function RulesList() {
  return (
    <>
      <p>{t.rulesIntro}</p>
      <ul className={styles.rules}>
        {t.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="muted">{t.rulesContact}</p>
    </>
  );
}

export function RulesConsent({
  open,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Sheet
      open={open}
      title={t.rulesTitle}
      onClose={onDecline}
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onDecline}>
            {t.decline}
          </Button>
          <Button onClick={onAccept}>{t.accept}</Button>
        </div>
      }
    >
      <div className={styles.form}>
        <RulesList />
      </div>
    </Sheet>
  );
}

export function RulesPage() {
  return (
    <Page title={t.rulesTitle} back="/mehr">
      <div className={styles.form}>
        <RulesList />
      </div>
    </Page>
  );
}

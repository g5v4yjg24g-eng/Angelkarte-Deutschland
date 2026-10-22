// Datenschutz (M11): beschreibt nur, was die App tatsächlich tut. Die Server-Liste ist per E2E belegt
// (privacy.spec.ts: keine anderen Hosts).
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import styles from './AboutPage.module.css';

const t = de.privacy;

export function PrivacyPage() {
  return (
    <Page title={t.title} back="/mehr">
      <p>{t.intro}</p>
      <Section title={t.localTitle}>
        <ul className={styles.list}>
          {t.local.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Section>
      <Section title={t.locationTitle}>
        <p>{t.location}</p>
      </Section>
      <Section title={t.serversTitle}>
        <p className="muted">{t.serversIntro}</p>
        <ul className={styles.list}>
          {t.servers.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong> {s.what}
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t.linksTitle}>
        <p>{t.links}</p>
      </Section>
    </Page>
  );
}

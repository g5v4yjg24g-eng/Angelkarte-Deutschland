import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { FishMark } from '../../design/icons';
import { CHANGELOG } from '../../i18n/changelog';
import { NewsItem } from '../whatsNew/WhatsNew';
import styles from './AboutPage.module.css';

export function AboutPage() {
  return (
    <Page title={de.about.title} back="/mehr">
      <div className={styles.hero}>
        <FishMark size={56} title={de.app.name} />
        <div>
          <p className={styles.name}>{de.app.name}</p>
          <p className="muted tabular">{de.about.version(__APP_VERSION__)}</p>
        </div>
      </div>
      <p>{de.app.tagline}</p>
      <Section title={de.whatsNew.aboutTitle}>
        {CHANGELOG.map((e) => (
          <div key={e.id}>
            <h3 className={styles.newsTitle}>{e.title}</h3>
            <ul className={styles.news}>
              {e.items.map((it) => (
                <li key={it}>
                  <NewsItem text={it} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>
      <Section title={de.about.privacyTitle}>
        <p>{de.about.privacyText}</p>
        <p>
          <Link to="/mehr/datenschutz">{de.about.privacyLink}</Link>
        </p>
      </Section>
      <Section title={de.about.sourcesTitle}>
        <ul className={styles.sources}>
          {de.about.sources.map((s) => (
            <li key={s.name}>
              <span>{s.name}</span>
              <span className="muted">{s.license}</span>
            </li>
          ))}
        </ul>
      </Section>
      <p className="muted">{de.about.legalNote}</p>
    </Page>
  );
}

// Anleitung nachlesen: Mehr → Anleitung und Einstellungen → „Anleitung & Tour“ (dieselbe Seite). Themen nach Gruppen,
// jedes aufklappbar mit Schritten, Hinweis und „Probier’s aus“; oben „Tour starten“ für die Kurztour.
import { useState } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { ChevronRightIcon } from '../../design/icons';
import { GROUPS, type GuideId } from '../../domain/guide';
import { GUIDE_ROUTE, guideIcon } from './catalog';
import { GuideTour } from './GuideTour';
import styles from './Guide.module.css';

const t = de.guide;

function Topic({ id, open, onToggle }: { id: GuideId; open: boolean; onToggle: () => void }) {
  const topic = t.topics[id];
  const panel = `guide-${id}`;
  return (
    <>
      <button
        type="button"
        className={styles.topic}
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
      >
        <span className={styles.mini}>{guideIcon(id, 22)}</span>
        <span className={styles.topicText}>
          <strong>{topic.title}</strong>
          <small>{topic.sub}</small>
        </span>
        <ChevronRightIcon className={styles.chev} size={18} />
      </button>
      {open && (
        <div className={styles.detail} id={panel}>
          <ol>
            {topic.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {'note' in topic && topic.note && <p className={styles.note}>{topic.note}</p>}
          <Link to={GUIDE_ROUTE[id]} className={styles.tryIt}>
            {t.tryIt}
          </Link>
        </div>
      )}
    </>
  );
}

export function GuidePage() {
  const [tour, setTour] = useState(false);
  const [openId, setOpenId] = useState<GuideId>();
  return (
    <Page title={t.title} back="/mehr">
      <div className={styles.again}>
        <strong>{t.tourCard}</strong>
        <Button onClick={() => setTour(true)}>{t.tourStart}</Button>
      </div>
      {GROUPS.map((g) => (
        <Section key={g.id} title={t.groups[g.id]}>
          <div className={styles.topics}>
            {g.topics.map((id) => (
              <Topic
                key={id}
                id={id}
                open={openId === id}
                onToggle={() => setOpenId(openId === id ? undefined : id)}
              />
            ))}
          </div>
        </Section>
      ))}
      <GuideTour open={tour} onClose={() => setTour(false)} />
    </Page>
  );
}

// Gewässerprofil (PLAN M4): nur belegte Angaben; alles andere ausdrücklich als unbekannt/nicht verfügbar.
// Aufbau (Wunsch Nutzer 2026-11-05: „unfassbar unübersichtlich“): Art und Lage unter dem Namen, Kurzüberblick in
// Kacheln, Hauptaktion oben, „Angeln hier“ (Recht + Angelkarte) als Karte, „Weitere Angaben“ zum Aufklappen,
// Quelle klein am Ende. Keine Angabe ist weggefallen.
import { useState } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { ChevronRightIcon } from '../../design/icons';
import { osmUrl, type WaterInfo, type WaterManifest } from '../../domain/water';
import { attribution, thumbUrl, type WaterPhoto } from '../../domain/waterPhotos';
import { WaterPermitSection } from '../permits/WaterPermitSection';
import { WaterRulesSection } from '../permits/WaterRulesSection';
import styles from './WaterProfile.module.css';

const fmtDate = (iso: string) =>
  iso && !Number.isNaN(Date.parse(iso))
    ? new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' })
    : de.water.dateUnknown;

export function WaterProfile({
  info,
  manifest,
  counts,
  photo,
  onMarkHere,
}: {
  info: WaterInfo;
  manifest: WaterManifest | null;
  counts: { places: number; catches: number };
  /** Foto aus Wikimedia Commons, falls es zu diesem Gewässer eines gibt */
  photo?: WaterPhoto | undefined;
  onMarkHere: () => void;
}) {
  const t = de.water;
  const state = info.state ? t.states[info.state] : undefined;
  const where = [info.municipality, info.district !== info.municipality ? info.district : undefined, state]
    .filter(Boolean)
    .join(' · ');
  const link = osmUrl(info.wid);
  return (
    <div className={styles.profile}>
      <p className={styles.subtitle}>
        <strong>{t.types[info.type]}</strong>
        {where && <span className="muted"> · {where}</span>}
      </p>

      {photo && <PhotoFigure photo={photo} />}

      {info.isLine && <p className={`muted ${styles.small}`}>{t.lineHint}</p>}

      <dl className={styles.stats} aria-label={t.statsLabel}>
        {info.areaHa !== undefined && (
          <div className={styles.stat}>
            <dt>{t.statArea}</dt>
            <dd className="tabular">{t.areaValue(info.areaHa)}</dd>
          </div>
        )}
        <div className={styles.stat}>
          <dt>{t.statPlaces}</dt>
          <dd className="tabular">{counts.places}</dd>
        </div>
        <div className={styles.stat}>
          <dt>{t.statCatches}</dt>
          <dd className="tabular">{counts.catches}</dd>
        </div>
      </dl>

      <Button onClick={onMarkHere} className={styles.mainAction}>
        {t.markHere}
      </Button>

      <section className={styles.card} aria-labelledby="water-fishing">
        <h3 id="water-fishing" className={styles.cardTitle}>
          {t.fishingTitle}
        </h3>
        {info.state && state ? (
          <Link to={`/mehr/recht/${info.state}`} className={styles.rowLink}>
            <span>{t.rulesState(state)}</span>
            <ChevronRightIcon size={18} aria-hidden="true" />
          </Link>
        ) : (
          <p className={styles.plain}>{t.rulesNoState}</p>
        )}
        <p className={`muted ${styles.small}`}>{t.rulesWater}</p>
        <WaterRulesSection waterId={info.wid} />
        <WaterPermitSection waterId={info.wid} state={info.state} />
      </section>

      <details className={styles.more}>
        <summary>{t.moreTitle}</summary>
        <dl className={styles.facts}>
          <dt>{t.depthTitle}</dt>
          <dd>{t.depthNone}</dd>
          <dt>{t.speciesTitle}</dt>
          <dd>{t.speciesNone}</dd>
          {info.areaHa !== undefined && (
            <>
              <dt>{t.area}</dt>
              <dd>
                <span className="tabular">{t.areaValue(info.areaHa)}</span>{' '}
                <span className="muted">({t.areaSource})</span>
              </dd>
            </>
          )}
          <dt>{t.location}</dt>
          <dd>{where || '–'}</dd>
          <dt>{t.level1}</dt>
          <dd className="muted">{t.level1Hint}</dd>
        </dl>
      </details>

      <p className={`muted ${styles.source}`}>
        {t.sourceTitle}: {t.source(fmtDate(manifest?.dataDate ?? ''))}
        {link && (
          <>
            {' · '}
            <a href={link} target="_blank" rel="noreferrer">
              {t.osmLink}
            </a>
          </>
        )}
      </p>
    </div>
  );
}

/** Foto mit Namensnennung (Urheber, Lizenz, Link zur Commons-Seite); lädt es nicht, entfällt der Block */
function PhotoFigure({ photo }: { photo: WaterPhoto }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className={styles.photo}>
      <img
        src={thumbUrl(photo, 500)}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      <figcaption>
        <a href={photo.p} target="_blank" rel="noreferrer">
          {attribution(photo)}
        </a>
      </figcaption>
    </figure>
  );
}

// Gewässerprofil (PLAN M4): nur belegte Angaben; alles andere ausdrücklich als unbekannt/nicht verfügbar.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Badge } from '../../design/components/Badge';
import { Button } from '../../design/components/Button';
import { osmUrl, type WaterInfo, type WaterManifest } from '../../domain/water';
import styles from './MapView.module.css';

const fmtDate = (iso: string) =>
  iso && !Number.isNaN(Date.parse(iso))
    ? new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' })
    : de.water.dateUnknown;

export function WaterProfile({
  info,
  manifest,
  counts,
  onMarkHere,
}: {
  info: WaterInfo;
  manifest: WaterManifest | null;
  counts: { places: number; catches: number };
  onMarkHere: () => void;
}) {
  const state = info.state ? de.water.states[info.state] : undefined;
  const where = [info.municipality, info.district !== info.municipality ? info.district : undefined, state]
    .filter(Boolean)
    .join(' · ');
  const link = osmUrl(info.wid);
  return (
    <>
      <div className={styles.badges}>
        <Badge tone="info">{de.water.types[info.type]}</Badge>
        <Badge>{de.water.level1}</Badge>
      </div>
      <p className="muted">{de.water.level1Hint}</p>
      <dl className={styles.profileFacts}>
        {info.areaHa !== undefined && (
          <>
            <dt>{de.water.area}</dt>
            <dd>
              <span className="tabular">{de.water.areaValue(info.areaHa)}</span>{' '}
              <span className="muted">({de.water.areaSource})</span>
            </dd>
          </>
        )}
        <dt>{de.water.location}</dt>
        <dd>{where || '–'}</dd>
        <dt>{de.water.depthTitle}</dt>
        <dd>{de.water.depthNone}</dd>
        <dt>{de.water.speciesTitle}</dt>
        <dd>{de.water.speciesNone}</dd>
        <dt>{de.water.rulesTitle}</dt>
        <dd>
          {info.state && state ? (
            <Link to={`/mehr/recht/${info.state}`}>{de.water.rulesState(state)}</Link>
          ) : (
            de.water.rulesNoState
          )}
          <br />
          <span className="muted">{de.water.rulesWater}</span>
        </dd>
        <dt>{de.water.yourData}</dt>
        <dd className="tabular">{de.water.yourDataValue(counts.places, counts.catches)}</dd>
      </dl>
      {info.isLine && <p className="muted">{de.water.lineHint}</p>}
      <p className="muted">
        {de.water.sourceTitle}: {de.water.source(fmtDate(manifest?.dataDate ?? ''))}
        {link && (
          <>
            {' · '}
            <a href={link} target="_blank" rel="noreferrer">
              {de.water.osmLink}
            </a>
          </>
        )}
      </p>
      <div className={styles.formActions}>
        <Button onClick={onMarkHere}>{de.water.markHere}</Button>
      </div>
    </>
  );
}

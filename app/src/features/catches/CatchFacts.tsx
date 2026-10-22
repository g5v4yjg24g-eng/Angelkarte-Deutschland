// Angaben eines Fangbuch-Eintrags (Karte und Fangbuch). Zeigt nur, was erfasst wurde.
import { de } from '../../i18n/de';
import type { Catch } from '../../domain/schemas';
import { formatDateTime } from '../../lib/storage';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../../data/db';
import { markerDataUrl } from '../map/markerIcons';
import { catchTitle } from './catchText';
import { CatchPhotos } from './CatchPhotos';
import { CatchWeather } from '../weather/CatchWeather';
import styles from './CatchFacts.module.css';

const t = de.catchForm;

export function CatchHead({ item }: { item: Catch }) {
  return (
    <div className={styles.head}>
      <img src={markerDataUrl(`catch-${item.outcome}`)} width={28} height={28} alt="" aria-hidden="true" />
      <div>
        <p className={styles.title}>{catchTitle(item)}</p>
        <p className="muted">{de.map.catchAt(formatDateTime(item.at))}</p>
      </div>
    </div>
  );
}

export function CatchFacts({ item }: { item: Catch }) {
  const session = useLiveQuery(
    async () => (item.sessionId ? await getDb().sessions.get(item.sessionId) : undefined),
    [item.sessionId],
  );
  const sessionLabel =
    session && !session.deletedAt ? de.sessions.inSession(formatDateTime(session.startAt)) : undefined;
  const c = item.conditions;
  const bait = [item.bait?.name, item.bait?.type && t.baitTypes[item.bait.type], item.bait?.color]
    .filter(Boolean)
    .join(' · ');
  const conditions = [
    c?.sky && t.skies[c.sky],
    c?.airTempC !== undefined && `${t.airShort} ${t.tempValue(c.airTempC)}`,
    c?.waterTempC !== undefined && `${t.waterShort} ${t.tempValue(c.waterTempC)}`,
    c?.windBft !== undefined && `${t.windShort} ${t.windValue(c.windBft)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const rows: [string, string | undefined][] = [
    [
      de.map.length,
      item.lengthCm === undefined
        ? undefined
        : de.map.lengthValue(item.lengthCm, item.lengthMethod === 'measured'),
    ],
    [
      t.fields.weight,
      item.weightG === undefined
        ? undefined
        : t.weightValue(item.weightG / 1000, item.weightMethod !== 'weighed'),
    ],
    [t.fields.released, item.released && t.releasedOptions[item.released]],
    [t.fields.contactDetail, item.contactDetail && t.contactDetails[item.contactDetail]],
    [t.fields.method, item.method && t.methods[item.method]],
    [t.fields.bait, bait || undefined],
    [t.fields.conditions, conditions || undefined],
    [t.fields.water, item.waterSnapshot?.name],
    [t.fields.session, sessionLabel],
    [
      t.fields.position,
      item.position
        ? `${t.positionSource[item.position.source]} · ${de.map.coords(item.position.lat, item.position.lng)}`
        : undefined,
    ],
  ];
  const shown = rows.filter((r): r is [string, string] => !!r[1]);
  return (
    <>
      <CatchPhotos ids={item.photoIds} />
      {shown.length > 0 && (
        <dl className={styles.facts}>
          {shown.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.notes && <p className={styles.notes}>{item.notes}</p>}
      <CatchWeather item={item} />
    </>
  );
}

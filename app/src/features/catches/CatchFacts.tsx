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
import { CatchGauge } from '../weather/CatchGauge';
import { LawCheckCard } from '../law/LawCheckCard';
import { SunsetScene } from '../../design/components/SunsetScene';
import { ChevronRightIcon, PinIcon, WavesIcon } from '../../design/icons';
import type { WaterPhoto } from '../../domain/waterPhotos';
import { useLawCheck, useStateResolution } from '../law/useLawCheck';
import { repo } from '../../data/repository';
import styles from './CatchFacts.module.css';

const t = de.catchForm;
const v = de.catchView;

/** Kopf eines Eintrags: Fangsymbol im Kreis, Titel, Zeitpunkt – im Blatt in der Kopfkarte, auf der Seite darunter */
export function CatchHead({ item }: { item: Catch }) {
  return (
    <div className={styles.head}>
      <span className={styles.badge}>
        <img src={markerDataUrl(`catch-${item.outcome}`)} width={30} height={30} alt="" aria-hidden="true" />
      </span>
      <div className={styles.headText}>
        <p className={styles.title}>{catchTitle(item)}</p>
        <p className="muted">{de.map.catchAt(formatDateTime(item.at))}</p>
      </div>
    </div>
  );
}

/** Kopfkarte mit Abendstimmung für die Seite (im Blatt übernimmt das `Sheet` mit `banner`) */
export function CatchBannerCard({ item }: { item: Catch }) {
  return (
    <div className={styles.bannerCard}>
      <SunsetScene />
      <CatchHead item={item} />
    </div>
  );
}

export function CatchFacts({
  item,
  crests,
  onShowOnMap,
  onAssignWater,
}: {
  item: Catch;
  /** Landeswappen je Bundesland, falls geladen (sonst Schild) */
  crests?: Readonly<Record<string, WaterPhoto>> | undefined;
  /** Antippen der Positions-Kachel */
  onShowOnMap?: (() => void) | undefined;
  /** Antippen der Gewässer-Kachel */
  onAssignWater?: (() => void) | undefined;
}) {
  const session = useLiveQuery(
    async () => (item.sessionId ? await getDb().sessions.get(item.sessionId) : undefined),
    [item.sessionId],
  );
  const sessionLabel =
    session && !session.deletedAt ? de.sessions.inSession(formatDateTime(session.startAt)) : undefined;
  const lawCheck = useLawCheck(item, useStateResolution(item.position, item.stateCode));
  const c = item.conditions;
  const bait = [
    item.bait?.name,
    item.bait?.type && t.baitTypes[item.bait.type],
    item.bait?.color,
    item.bait && t.baitDetails(item.bait),
  ]
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
  const waterName =
    item.waterSnapshot?.name ??
    (item.waterSnapshot?.customName && de.catches.customNameValue(item.waterSnapshot.customName));
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
    [t.fields.session, sessionLabel],
    [v.positionSource, item.position && t.positionSource[item.position.source]],
  ];
  const shown = rows.filter((r): r is [string, string] => !!r[1]);
  const waterTile = (
    <>
      <WavesIcon size={26} aria-hidden="true" />
      <span className={styles.tileText}>
        <span className={styles.tileLabel}>{v.water}</span>
        <strong>{waterName || v.waterNone}</strong>
      </span>
    </>
  );
  const posTile = item.position && (
    <>
      <PinIcon size={26} aria-hidden="true" />
      <span className={styles.tileText}>
        <span className={styles.tileLabel}>{v.position}</span>
        <strong className={`tabular ${styles.coords}`}>
          {de.map.coords(item.position.lat, item.position.lng)}
        </strong>
      </span>
      {onShowOnMap && <ChevronRightIcon size={20} aria-hidden="true" />}
    </>
  );
  return (
    <>
      <div className={styles.tiles}>
        {onAssignWater && item.position ? (
          <button type="button" className={styles.tile} onClick={onAssignWater}>
            {waterTile}
          </button>
        ) : (
          <div className={styles.tile}>{waterTile}</div>
        )}
        {posTile &&
          (onShowOnMap ? (
            <button type="button" className={styles.tile} onClick={onShowOnMap} aria-label={v.positionOnMap}>
              {posTile}
            </button>
          ) : (
            <div className={styles.tile}>{posTile}</div>
          ))}
      </div>
      <CatchPhotos ids={item.photoIds} />
      {shown.length > 0 && (
        <section className={styles.details} aria-label={v.details}>
          <dl className={styles.facts}>
            {shown.map(([k, val]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{val}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {item.notes && <p className={styles.notes}>{item.notes}</p>}
      <LawCheckCard
        check={lawCheck}
        hasPosition={!!item.position}
        waterId={item.waterId}
        crests={crests}
        onChooseState={(code) => void repo('catches').update(item.id, { stateCode: code })}
      />
      <CatchWeather item={item} />
      <CatchGauge item={item} />
    </>
  );
}

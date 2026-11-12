// Gewässerprofil (PLAN M4): nur belegte Angaben; alles andere ausdrücklich als unbekannt/nicht verfügbar.
// Aufbau (Wunsch Nutzer 2026-11-05: „unfassbar unübersichtlich“): Art und Lage unter dem Namen, Kurzüberblick in
// Kacheln, Hauptaktion oben, „Angeln hier“ (Recht + Angelkarte) als Karte, „Weitere Angaben“ zum Aufklappen,
// Quelle klein am Ende. Keine Angabe ist weggefallen.
import { useId, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { ChevronRightIcon } from '../../design/icons';
import { osmUrl, type WaterInfo, type WaterManifest } from '../../domain/water';
import { attribution, crestUrl, thumbUrl, type WaterPhoto } from '../../domain/waterPhotos';
import { WaterPermitSection } from '../permits/WaterPermitSection';
import { WaterRulesSection } from '../permits/WaterRulesSection';
import { WaterMiniMap } from './WaterMiniMap';
import { WaterThumb } from './WaterThumb';
import styles from './WaterProfile.module.css';

const fmtDate = (iso: string) =>
  iso && !Number.isNaN(Date.parse(iso))
    ? new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' })
    : de.water.dateUnknown;

type Tab = 'overview' | 'map' | 'rules' | 'assoc';
const TABS: Tab[] = ['overview', 'map', 'rules', 'assoc'];
type Box = [[number, number], [number, number]];

const whereOf = (info: WaterInfo) => {
  const state = info.state ? de.water.states[info.state] : undefined;
  return [info.municipality, info.district !== info.municipality ? info.district : undefined, state]
    .filter(Boolean)
    .join(' · ');
};

/** Kopfbild: Foto aus Wikimedia Commons, sonst Platzhalter-Zeichnung; darüber Name und Lage */
export function WaterHero({ info, photo }: { info: WaterInfo; photo?: WaterPhoto | undefined }) {
  const t = de.water;
  const [failed, setFailed] = useState(false);
  const where = whereOf(info);
  return (
    <div className={styles.hero}>
      <div className={styles.heroImage}>
        {photo && !failed ? (
          <img
            src={thumbUrl(photo, 960)}
            alt=""
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <WaterThumb kind={info.type} fill />
        )}
      </div>
      {photo && !failed && (
        <a
          className={styles.credit}
          href={photo.p}
          target="_blank"
          rel="noreferrer"
          title={attribution(photo)}
        >
          {photo.a ? `${photo.a} · ` : ''}
          {photo.l}
        </a>
      )}
      <div className={styles.heroText}>
        <p className={styles.heroTitle} aria-hidden="true">
          {info.name ?? t.unnamed}
        </p>
        <p className={styles.heroSub}>
          <strong>{t.types[info.type]}</strong>
          {where && <span> · {where}</span>}
        </p>
      </div>
    </div>
  );
}

/** Landeswappen; ohne Datei oder bei Ladefehler ein neutrales Schild */
function StateCrest({ crest }: { crest?: WaterPhoto | undefined }) {
  const [failed, setFailed] = useState(false);
  if (crest && !failed)
    return (
      <img
        className={styles.crest}
        src={crestUrl(crest, 120)}
        srcSet={`${crestUrl(crest, 120)} 1x, ${crestUrl(crest, 250)} 2x`}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  return (
    <svg className={styles.crest} viewBox="0 0 34 40" aria-hidden="true" focusable="false">
      <path
        d="M3 3h28v17c0 9-7 15-14 17C10 35 3 29 3 20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity=".55"
      />
    </svg>
  );
}

export function WaterProfile({
  info,
  manifest,
  counts,
  crest,
  center,
  tiles,
  onOpenMap,
  onMarkHere,
}: {
  info: WaterInfo;
  manifest: WaterManifest | null;
  counts: { places: number; catches: number };
  /** Wappen des Bundeslands (Wikimedia Commons), falls vorhanden */
  crest?: WaterPhoto | undefined;
  /** Mitte des Gewässers (Antippstelle) und Kartendaten für den Kartenauszug; ohne Daten entfällt der Auszug */
  center: { lat: number; lng: number };
  tiles: { url: string; attribution: string } | null;
  onOpenMap: (bounds: Box) => void;
  onMarkHere: () => void;
}) {
  const t = de.water;
  const tabsId = useId();
  const [tab, setTab] = useState<Tab>('overview');
  const state = info.state ? t.states[info.state] : undefined;
  const where = whereOf(info);
  const link = osmUrl(info.wid);

  const onKeys = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const next =
      e.key === 'ArrowRight'
        ? TABS[(i + 1) % TABS.length]
        : e.key === 'ArrowLeft'
          ? TABS[(i + TABS.length - 1) % TABS.length]
          : undefined;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    document.getElementById(`${tabsId}-${next}`)?.focus();
  };

  const rules = (
    <section className={styles.card} aria-labelledby="water-fishing">
      <h3 id="water-fishing" className={styles.cardTitle}>
        {t.fishingTitle}
      </h3>
      {info.state && state ? (
        <Link to={`/mehr/recht/${info.state}`} className={styles.rowLink}>
          <StateCrest crest={crest} />
          <span className={styles.rowText}>
            <strong>{t.rulesStateTitle(state)}</strong>
            <span className="muted">{t.rulesStateSub}</span>
          </span>
          <ChevronRightIcon size={18} aria-hidden="true" />
        </Link>
      ) : (
        <p className={styles.plain}>{t.rulesNoState}</p>
      )}
      <p className={`muted ${styles.small}`}>{t.rulesWater}</p>
      <WaterRulesSection waterId={info.wid} />
    </section>
  );

  const mapCard = (height: number) => (
    <section className={styles.card} aria-labelledby="water-map">
      <h3 id="water-map" className={styles.cardTitle}>
        {t.mapTitle}
      </h3>
      {tiles ? (
        <WaterMiniMap
          wid={info.wid}
          name={info.name}
          district={info.district}
          isLine={info.isLine}
          center={center}
          tilesUrl={tiles.url}
          attribution={tiles.attribution}
          height={height}
          onOpen={onOpenMap}
        />
      ) : (
        <p className={styles.plain}>{t.mapNone}</p>
      )}
      {info.isLine && <p className={`muted ${styles.small}`}>{t.lineHint}</p>}
    </section>
  );

  const source = (
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
  );

  return (
    <div className={styles.profile}>
      <dl className={styles.stats} aria-label={t.statsLabel}>
        {info.areaHa !== undefined && (
          <div className={styles.stat}>
            <dt>{t.statArea}</dt>
            <dd className="tabular">{t.areaValue(info.areaHa)}</dd>
          </div>
        )}
        <div className={styles.stat}>
          <dt>{t.statCatches}</dt>
          <dd className="tabular">{counts.catches}</dd>
        </div>
        <div className={styles.stat}>
          <dt>{t.statPlaces}</dt>
          <dd className="tabular">{counts.places}</dd>
        </div>
      </dl>

      <Button onClick={onMarkHere} className={styles.mainAction}>
        {t.markHere}
      </Button>

      <div role="tablist" aria-label={t.tabsLabel} className={styles.tabs} onKeyDown={onKeys}>
        {TABS.map((k) => (
          <button
            key={k}
            id={`${tabsId}-${k}`}
            type="button"
            role="tab"
            aria-selected={tab === k}
            aria-controls={`${tabsId}-panel`}
            tabIndex={tab === k ? 0 : -1}
            className={styles.tab}
            onClick={() => setTab(k)}
          >
            {t.tabs[k]}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-${tab}`}
        className={styles.panel}
      >
        {tab === 'overview' && (
          <>
            {rules}
            {mapCard(150)}
            <WaterPermitSection waterId={info.wid} state={info.state} />
            {source}
          </>
        )}
        {tab === 'map' && (
          <>
            {mapCard(260)}
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>{t.moreTitle}</h3>
              <dl className={styles.facts}>
                <dt>{t.depthTitle}</dt>
                <dd>{t.depthNone}</dd>
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
            </section>
            {source}
          </>
        )}
        {tab === 'rules' && (
          <>
            {rules}
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>{t.speciesTitle}</h3>
              <p className={styles.plain}>{t.speciesNone}</p>
            </section>
          </>
        )}
        {tab === 'assoc' && <WaterPermitSection waterId={info.wid} state={info.state} />}
      </div>
    </div>
  );
}

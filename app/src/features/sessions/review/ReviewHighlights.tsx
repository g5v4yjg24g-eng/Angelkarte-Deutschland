// „Deine Highlights“: Kennzahlen, Fang-Highlights und besondere Momente – nur aus gespeicherten Werten.
import { de } from '../../../i18n/de';
import type { Catch, CatchOutcome } from '../../../domain/schemas';
import { formatDuration } from '../../../domain/session';
import type { Moment, Review } from '../../../domain/sessionReview';
import { speciesById } from '../../../domain/species';
import { markerDataUrl } from '../../map/markerIcons';
import styles from './Review.module.css';

const t = de.review;
const clock = (iso: string) => iso.slice(11, 16);
const species = (c: Catch) => speciesById(c.speciesId)?.de ?? t.unknownSpecies;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  );
}

function momentText(m: Moment): string {
  switch (m.kind) {
    case 'burst':
      return t.moments.burst(m.count, m.minutes);
    case 'long':
      return t.moments.long(formatDuration(m.ms));
    case 'manyBites':
      return t.moments.manyBites(m.count);
    case 'recordLength':
      return t.moments.recordLength(
        species(m.item),
        t.lengthValue(m.item.lengthCm ?? 0),
        t.lengthValue(m.previousBestCm),
      );
    case 'recordWeight':
      return t.moments.recordWeight(
        species(m.item),
        t.weightValue(m.item.weightG ?? 0),
        t.weightValue(m.previousBestG),
      );
  }
}

const OUTCOMES: CatchOutcome[] = ['caught', 'contact', 'missed_bite', 'observation'];

export function ReviewHighlights({ review }: { review: Review }) {
  const r = review;
  const caught = r.counts.caught > 0;
  return (
    <section className={styles.section} aria-labelledby="rv-highlights">
      <h2 id="rv-highlights" className={styles.sectionTitle}>
        {t.highlights}
      </h2>
      <div className={styles.stats}>
        <Stat
          label={t.duration}
          value={formatDuration(r.durationMs)}
          hint={r.activeMs < r.durationMs ? t.activeTime(formatDuration(r.activeMs)) : undefined}
        />
        <Stat label={t.distance} value={r.distanceM === undefined ? t.distanceNone : t.km(r.distanceM)} />
        <Stat label={t.events} value={String(r.events)} />
        <Stat label={t.bites} value={String(r.bites)} hint={t.bitesHint} />
      </div>
      <ul className={styles.counts} aria-label={t.events}>
        {OUTCOMES.map((o) => (
          <li key={o} className={styles.count}>
            <img src={markerDataUrl(`catch-${o}`)} alt="" width={24} height={24} />
            <span className="tabular">{r.counts[o]}</span> {t.counts[o]}
          </li>
        ))}
      </ul>

      <h3 className={styles.subTitle}>{t.catchTitle}</h3>
      {!caught ? (
        <div className={styles.calm}>
          <p className={styles.calmTitle}>{t.noCatch}</p>
          <p className="muted">{t.noCatchHint}</p>
        </div>
      ) : (
        <div className={styles.catchGrid}>
          {r.longest && (
            <Stat
              label={t.longest}
              value={t.lengthValue(r.longest.item.lengthCm ?? 0)}
              hint={`${species(r.longest.item)}${r.longest.estimated ? ` · ${t.estimated}` : ''}`}
            />
          )}
          {r.heaviest && (
            <Stat
              label={t.heaviest}
              value={t.weightValue(r.heaviest.item.weightG ?? 0)}
              hint={`${species(r.heaviest.item)}${r.heaviest.estimated ? ` · ${t.estimated}` : ''}`}
            />
          )}
          {r.speciesCount > 0 && <Stat label={t.species} value={String(r.speciesCount)} />}
          {r.topSpecies && (
            <Stat
              label={t.topSpecies}
              value={speciesById(r.topSpecies.speciesId)?.de ?? t.unknownSpecies}
              hint={t.timesCount(r.topSpecies.count)}
            />
          )}
          {r.firstCatch && (
            <Stat label={t.first} value={clock(r.firstCatch.at)} hint={species(r.firstCatch)} />
          )}
          {r.lastCatch && <Stat label={t.last} value={clock(r.lastCatch.at)} hint={species(r.lastCatch)} />}
        </div>
      )}

      {r.moments.length > 0 && (
        <>
          <h3 className={styles.subTitle}>{t.momentsTitle}</h3>
          <ul className={styles.moments}>
            {r.moments.map((m, i) => (
              <li key={i} className={styles.moment}>
                {momentText(m)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

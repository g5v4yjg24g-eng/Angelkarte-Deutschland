// Beißfenster (Wunsch Nutzer 2026-10-22): eigene Auswertung aus dem Fangbuch. Keine Wertung „gut/schlecht" – nur
// Zahlen mit Grundlage. Die Solunar-Zeiten stehen seit 2026-10-30 nur noch im Tagesdetail (Wunsch Nutzer).
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Section } from '../../design/components/Page';
import { getDb } from '../../data/db';
import { analyzeBites, matchNow, pressureBucket, SLOT_HOURS } from '../../domain/biteAnalysis';
import type { ForecastHour } from '../../domain/forecast';
import { BarTable } from '../stats/Charts';
import styles from './Weather.module.css';

const t = de.bite;
const berlinHour = (ms: number) =>
  Number(
    new Date(ms).toLocaleString('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Berlin' }),
  );
const round1 = (x: number) => Math.round(x * 10) / 10;

function OwnBites({
  nowMs,
  now,
  change,
}: {
  nowMs: number;
  now?: ForecastHour | undefined;
  change?: number | undefined;
}) {
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [catches, sessions] = await Promise.all([db.catches.toArray(), db.sessions.toArray()]);
    return analyzeBites(catches, sessions);
  }, []);
  if (!data) return <p className="muted">{t.ownLoading}</p>;
  // Unter der Mindestmenge ein Hinweis statt dreimal „zu wenige Daten" (Luftdruck/Tendenz sind Teilmengen)
  if (!data.slots.ok)
    return (
      <>
        <p className="muted">{t.ownIntro(data.bites)}</p>
        <p>{t.tooFew(data.slots.n, data.slots.need)}</p>
      </>
    );
  const m = matchNow(data, { hour: berlinHour(nowMs), pressureHpa: now?.pressureHpa, trend3h: change });
  const rangeOf = (b: number) => t.pressureRanges[b] ?? '';
  return (
    <>
      <p className="muted">{t.ownIntro(data.bites)}</p>
      <div className={styles.biteNow}>
        {m.slot && (
          <p>
            <strong>{t.nowSlot(m.slot.from, m.slot.from + SLOT_HOURS)}:</strong>{' '}
            {m.slot.perHour === undefined
              ? t.slotNoRate(m.slot.bites)
              : t.slotRate(m.slot.perHour, m.slot.hours)}
          </p>
        )}
        {m.pressure && now?.pressureHpa !== undefined && (
          <p>
            <strong>{t.nowPressure(now.pressureHpa, rangeOf(pressureBucket(now.pressureHpa)))}:</strong>{' '}
            {t.share(m.pressure.count, m.pressure.of)}
          </p>
        )}
        {m.trend && (
          <p>
            <strong>{t.nowTrend(t.trends[m.trend.bucket])}:</strong> {t.share(m.trend.count, m.trend.of)}
          </p>
        )}
      </div>
      <h4 className={styles.subhead}>{t.slotsTitle}</h4>
      <p className="muted">{t.slotsHint}</p>
      <BarTable
        caption={t.slotsTitle}
        rows={data.slots.value.map((s) => ({
          label: t.slotLabel(s.from, s.from + SLOT_HOURS),
          value: s.perHour === undefined ? 0 : round1(s.perHour),
          extra: t.slotExtra(s.bites, s.hours),
        }))}
      />
      <h4 className={styles.subhead}>{t.pressureTitle}</h4>
      {data.pressure.ok ? (
        <>
          <p className="muted">{t.weatherHint}</p>
          <BarTable
            caption={t.pressureTitle}
            rows={[0, 1, 2, 3].map((b) => ({
              label: rangeOf(b),
              value: (data.pressure.ok && data.pressure.value[b as 0 | 1 | 2 | 3]) || 0,
            }))}
          />
        </>
      ) : (
        <p>{t.tooFew(data.pressure.n, data.pressure.need)}</p>
      )}
      <h4 className={styles.subhead}>{t.trendTitle}</h4>
      {data.trend.ok ? (
        <BarTable
          caption={t.trendTitle}
          rows={(['falling', 'steady', 'rising'] as const).map((k) => ({
            label: t.trends[k],
            value: (data.trend.ok && data.trend.value[k]) || 0,
          }))}
        />
      ) : (
        <p>{t.tooFew(data.trend.n, data.trend.need)}</p>
      )}
      <h4 className={styles.subhead}>{t.gaugeTitle}</h4>
      <p className="muted">{t.gaugeHint}</p>
      {data.gaugeState.ok ? (
        <BarTable
          caption={t.gaugeTitle}
          rows={(['low', 'normal', 'high'] as const).map((k) => ({
            label: t.gaugeLevels[k],
            value: (data.gaugeState.ok && data.gaugeState.value[k]) || 0,
          }))}
        />
      ) : (
        <p>{t.tooFew(data.gaugeState.n, data.gaugeState.need)}</p>
      )}
      <h4 className={styles.subhead}>{t.gaugeTrendTitle}</h4>
      {data.gaugeTrend.ok ? (
        <BarTable
          caption={t.gaugeTrendTitle}
          rows={(['falling', 'steady', 'rising'] as const).map((k) => ({
            label: t.gaugeTrends[k],
            value: (data.gaugeTrend.ok && data.gaugeTrend.value[k]) || 0,
          }))}
        />
      ) : (
        <p>{t.tooFew(data.gaugeTrend.n, data.gaugeTrend.need)}</p>
      )}
    </>
  );
}

export function BiteWindows(props: {
  nowMs: number;
  now?: ForecastHour | undefined;
  change?: number | undefined;
}) {
  return (
    <Section title={t.title}>
      <p className="muted">{t.intro}</p>
      <section className={styles.biteBlock} aria-labelledby="bite-own">
        <h3 id="bite-own" className={styles.blockTitle}>
          {t.ownTitle}
        </h3>
        <OwnBites nowMs={props.nowMs} now={props.now} change={props.change} />
      </section>
    </Section>
  );
}

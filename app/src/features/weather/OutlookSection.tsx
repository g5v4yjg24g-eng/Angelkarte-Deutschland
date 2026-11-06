// Beißprognose im Tagesdetail (Paket 5, Regeln vom Nutzer freigegeben 2026-11-06): Einordnung, Gründe aus den
// Wetterdaten, Dämmerung, Sicherheitshinweis, fester Hinweis „Faustregeln – keine Fanggarantie“.
import { de } from '../../i18n/de';
import { Notice } from '../../design/components/Notice';
import type { DaySummary } from '../../domain/forecast';
import { dayOutlook, type Effect, type Reason } from '../../domain/fishingOutlook';
import { OutlookChip } from './OutlookChip';
import styles from './WeatherView.module.css';

const t = de.outlook;
const num = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 1 });
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${num(Math.abs(v))}`;
const time = (ms: number) =>
  new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

function reasonText(r: Reason): string {
  switch (r.factor) {
    case 'pressure':
      return t.pressure[r.kind](signed(r.delta));
    case 'wind':
      return t.wind[r.kind](num(r.windMs), r.gustMs !== undefined ? num(r.gustMs) : undefined);
    case 'cloud':
      return t.cloud[r.kind](num(r.cloudPct));
    case 'rain':
      return t.rain[r.kind](num(r.maxMm));
    case 'temp':
      return t.temp[r.kind](
        r.tMin !== undefined ? num(r.tMin) : '–',
        r.tMax !== undefined ? num(r.tMax) : '–',
      );
  }
}

const MARK: Record<Effect, { sign: string; cls: string | undefined; text: string }> = {
  1: { sign: '+', cls: styles.effectPlus, text: t.effect.plus },
  0: { sign: '○', cls: styles.effectZero, text: t.effect.zero },
  [-1]: { sign: '−', cls: styles.effectMinus, text: t.effect.minus },
};

export function OutlookSection({ day }: { day: DaySummary }) {
  const o = dayOutlook(day);
  return (
    <section className={styles.detailSection} aria-labelledby="dd-outlook">
      <h3 id="dd-outlook">{t.title}</h3>
      {o.level === 'unknown' ? (
        <p className="muted">{t.unknown}</p>
      ) : (
        <>
          <p className={styles.outlookHead}>
            <OutlookChip level={o.level} />
            <span className="muted">{t.score(o.score)}</span>
          </p>
          <ul className={styles.reasons}>
            {o.reasons.map((r) => {
              const m = MARK[r.effect];
              return (
                <li key={r.factor}>
                  <span className={[styles.effect, m.cls].join(' ')} aria-hidden="true">
                    {m.sign}
                  </span>
                  <span>
                    {reasonText(r)}
                    <span className="visually-hidden"> ({m.text})</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {o.twilight.length > 0 && (
        <p className="muted">
          {t.twilight(o.twilight.map((w) => `${time(w.from)}–${time(w.to)}`).join(' · '))}
        </p>
      )}
      {(o.safety.thunder || o.safety.storm) && (
        <Notice tone="warning">{o.safety.thunder ? t.safetyThunder : t.safetyStorm}</Notice>
      )}
      <p className="muted">{t.disclaimer}</p>
    </section>
  );
}

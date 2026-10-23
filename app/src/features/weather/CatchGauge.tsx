// Pegel am Fang: gespeicherter Wasserstand am nächsten Pegel zum Fangzeitpunkt oder der Grund, warum keiner da ist.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import type { Catch } from '../../domain/schemas';
import { formatDateTime } from '../../lib/storage';
import { useWeatherEnabled } from './useWeatherEnabled';
import facts from '../catches/CatchFacts.module.css';
import styles from './CatchWeather.module.css';

const t = de.catchGauge;
const g = de.gauge;

export function CatchGauge({ item }: { item: Catch }) {
  const enabled = useWeatherEnabled();
  const s = item.gauge;
  if (!item.position || (!s && enabled === undefined)) return null;
  return (
    <section className={styles.box} aria-label={t.title}>
      <h3 className={styles.title}>{t.title}</h3>
      {!s ? (
        <p className="muted">{enabled ? t.pending : <Link to="/mehr/einstellungen">{t.off}</Link>}</p>
      ) : s.status === 'none' ? (
        <p className="muted">{t.none[s.reason]}</p>
      ) : (
        <>
          <p className="muted">{t.station(s.name, s.water || s.area, s.km)}</p>
          <dl className={facts.facts}>
            <div>
              <dt>{g.level}</dt>
              <dd>
                {g.levelValue(s.levelCm, 'cm')}
                {s.change24h !== undefined && ` · ${g.change(s.change24h, 'cm')}`}
                {s.state && g.states[s.state] && <span className="muted"> · {g.states[s.state]}</span>}
              </dd>
            </div>
          </dl>
          <p className={`muted ${styles.note}`}>
            {t.measuredAt(formatDateTime(s.at))} · {g.levelNote} {t.source(s.attribution)}
          </p>
        </>
      )}
    </section>
  );
}

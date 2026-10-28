// Farbige Wettersymbole (eigene Zeichnungen, 24er Raster): Sonne gelb, Wolken hell, Regen blau. Dekorativ – die
// Beschreibung steht daneben oder im aria-label des umgebenden Elements.
import type { WeatherIconKey } from '../../domain/forecastView';
import styles from './WeatherView.module.css';

const CLOUD = 'M6.5 19h11a3.6 3.6 0 0 0 .5-7.2 5.2 5.2 0 0 0-10-1.4A4.3 4.3 0 0 0 6.5 19Z';
const CLOUD_HIGH = 'M6.5 15.5h11a3.6 3.6 0 0 0 .5-7.2 5.2 5.2 0 0 0-10-1.4 4.3 4.3 0 0 0-1.5 8.6Z';
const MOON = 'M15.5 3.5a7.5 7.5 0 1 0 5 13 6.2 6.2 0 0 1-5-13Z';

function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 1.6);
    const y1 = cy + Math.sin(a) * (r + 1.6);
    const x2 = cx + Math.cos(a) * (r + 3.4);
    const y2 = cy + Math.sin(a) * (r + 3.4);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }).join('');
  return (
    <>
      <circle cx={cx} cy={cy} r={r} className={styles.sun} />
      <path d={rays} className={styles.ray} />
    </>
  );
}

function Drops({ snow = false, slant = true, n = 3 }: { snow?: boolean; slant?: boolean; n?: number }) {
  const xs = n === 3 ? [8, 12, 16] : [9.5, 14.5];
  return (
    <>
      {xs.map((x) =>
        snow ? (
          <path
            key={x}
            d={`M${x} 18.5v4M${x - 1.7} 19.5l3.4 2M${x + 1.7} 19.5l-3.4 2`}
            className={styles.snow}
          />
        ) : (
          <path
            key={x}
            d={slant ? `M${x} 18l-1.2 3.6` : `M${x} 18.5v.1M${x} 21.5v.1`}
            className={styles.drop}
          />
        ),
      )}
    </>
  );
}

export function WeatherIcon({
  icon,
  size = 28,
}: {
  icon: WeatherIconKey | 'sunrise' | 'sunset';
  size?: number;
}) {
  let body: React.ReactNode;
  switch (icon) {
    case 'clear':
      body = <Sun cx={12} cy={12} r={4.6} />;
      break;
    case 'clearNight':
      body = <path d={MOON} className={styles.moon} />;
      break;
    case 'partly':
      body = (
        <>
          <Sun cx={15} cy={8.5} r={3.4} />
          <path d={CLOUD} className={styles.cloud} />
        </>
      );
      break;
    case 'partlyNight':
      body = (
        <>
          <path d="M16.5 2.5a5 5 0 1 0 4.5 7.8 4.2 4.2 0 0 1-4.5-7.8Z" className={styles.moon} />
          <path d={CLOUD} className={styles.cloud} />
        </>
      );
      break;
    case 'cloudy':
      body = <path d={CLOUD} className={styles.cloud} />;
      break;
    case 'fog':
      body = (
        <>
          <path d={CLOUD_HIGH} className={styles.cloud} />
          <path d="M4 18.5h16M6 21.5h12" className={styles.fog} />
        </>
      );
      break;
    case 'drizzle':
      body = (
        <>
          <path d={CLOUD_HIGH} className={styles.cloud} />
          <Drops slant={false} />
        </>
      );
      break;
    case 'rain':
      body = (
        <>
          <path d={CLOUD_HIGH} className={styles.cloud} />
          <Drops />
        </>
      );
      break;
    case 'showers':
      body = (
        <>
          <Sun cx={16} cy={6.5} r={3} />
          <path d={CLOUD_HIGH} className={styles.cloud} />
          <Drops n={2} />
        </>
      );
      break;
    case 'sleet':
      body = (
        <>
          <path d={CLOUD_HIGH} className={styles.cloud} />
          <path d="M9 18l-1.2 3.6" className={styles.drop} />
          <path d="M15 18.5v4M13.3 19.5l3.4 2M16.7 19.5l-3.4 2" className={styles.snow} />
        </>
      );
      break;
    case 'snow':
      body = (
        <>
          <path d={CLOUD_HIGH} className={styles.cloud} />
          <Drops snow n={2} />
        </>
      );
      break;
    case 'thunder':
      body = (
        <>
          <path d={CLOUD_HIGH} className={styles.cloud} />
          <path d="M12.5 15.5 10 19.5h3l-1.5 4 4-5.5h-3l1.5-2.5Z" className={styles.bolt} />
        </>
      );
      break;
    case 'sunrise':
    case 'sunset':
      body = (
        <>
          <path d="M6.5 17a5.5 5.5 0 0 1 11 0Z" className={styles.sun} />
          <path d="M2.5 17h19M5 20.5h14" className={styles.horizon} />
          <path
            d={icon === 'sunrise' ? 'M12 9V3.5M9.5 6 12 3.5 14.5 6' : 'M12 3.5V9M9.5 6.5 12 9l2.5-2.5'}
            className={styles.arrow}
          />
        </>
      );
      break;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={styles.icon}
    >
      {body}
    </svg>
  );
}

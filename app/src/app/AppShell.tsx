import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { de } from '../i18n/de';
import { BookIcon, ChartIcon, FishMark, MapIcon, MoreIcon, OfflineIcon, WeatherIcon } from '../design/icons';
import { Badge } from '../design/components/Badge';
import { useOnline } from '../lib/useOnline';
import { UpdatePrompt } from './UpdatePrompt';
import { BackupReminder } from '../features/backup/BackupReminder';
import { SessionChip } from '../features/sessions/SessionChip';
import { WeatherSync } from '../features/weather/WeatherSync';
import { SessionTracker } from '../features/sessions/tracking/SessionTracker';
import { GaugeSync } from '../features/weather/GaugeSync';
import { DRAG_START_PX, itemAt, lensCenter, type Span } from './navLens';
import styles from './AppShell.module.css';

const NAV = [
  { to: '/', label: de.nav.map, icon: MapIcon, end: true },
  { to: '/fangbuch', label: de.nav.catches, icon: BookIcon, end: false },
  { to: '/wetter', label: de.nav.weather, icon: WeatherIcon, end: false },
  { to: '/statistik', label: de.nav.stats, icon: ChartIcon, end: false },
  { to: '/mehr', label: de.nav.more, icon: MoreIcon, end: false },
] as const;
const NAV_PATHS = NAV.map((n) => n.to);

/** Linse etwas breiter als ein Punkt, damit sie ihn umschließt */
const LENS_SCALE = 1.25;
const SNAP_MS = 220;

interface Lens {
  center: number;
  width: number;
  index: number;
  snapping: boolean;
}

/** Drücken und Wischen auf der Leiste (nur Touch/Stift, nur mobile Leiste): Linse folgt dem Finger, Loslassen wählt. */
/** `paths`: Router-Pfade der Punkte (ohne Basis-Pfad der Veröffentlichung) */
function useNavLens(paths: readonly string[]) {
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const drag = useRef<{ id: number; startX: number; moved: boolean; spans: Span[] } | null>(null);
  const suppressClick = useRef(false);
  const [lens, setLens] = useState<Lens | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const spans = (): Span[] => {
    const nav = navRef.current?.getBoundingClientRect();
    return itemRefs.current.slice(0, paths.length).map((el) => {
      const r = el?.getBoundingClientRect();
      return { left: (r?.left ?? 0) - (nav?.left ?? 0), width: r?.width ?? 0 };
    });
  };
  const localX = (e: PointerEvent) => e.clientX - (navRef.current?.getBoundingClientRect().left ?? 0);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    // Nicht jeder Browser schickt nach dem Wischen einen Klick: Sperre gilt nur bis zur nächsten Berührung
    suppressClick.current = false;
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    if (window.matchMedia('(min-width: 900px)').matches) return;
    window.clearTimeout(timer.current);
    const sp = spans();
    const x = localX(e);
    const index = itemAt(x, sp);
    const item = sp[index];
    if (!item) return;
    drag.current = { id: e.pointerId, startX: e.clientX, moved: false, spans: sp };
    setLens({ center: item.left + item.width / 2, width: item.width * LENS_SCALE, index, snapping: false });
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < DRAG_START_PX) return;
      d.moved = true;
      // Erst beim Wischen festhalten: Ein einfacher Tipp bleibt ein normaler Link-Klick
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Zeiger schon beendet – dann ohne Festhalten weiter
      }
    }
    const x = localX(e);
    const index = itemAt(x, d.spans);
    setLens((l) => l && { ...l, center: lensCenter(x, d.spans), index });
  };
  const finish = (e: PointerEvent<HTMLElement>, select: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return setLens(null);
    suppressClick.current = true;
    const index = itemAt(localX(e), d.spans);
    const item = d.spans[index];
    if (select && item) {
      // Einrasten auf dem gewählten Punkt, dann ausblenden
      setLens((l) => l && { ...l, center: item.left + item.width / 2, index, snapping: true });
      // Router-Pfad, nicht das href: Das enthält auf GitHub Pages schon den Basis-Pfad, der Router setzt ihn sonst doppelt
      const to = paths[index];
      if (to) void navigate(to);
      timer.current = window.setTimeout(() => setLens(null), SNAP_MS);
    } else setLens(null);
  };

  return {
    lens,
    navRef,
    itemRef: (i: number) => (el: HTMLAnchorElement | null) => {
      itemRefs.current[i] = el;
    },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: PointerEvent<HTMLElement>) => finish(e, true),
      onPointerCancel: (e: PointerEvent<HTMLElement>) => finish(e, false),
      onClickCapture: (e: React.MouseEvent) => {
        // Nach dem Wischen hat die Linse schon gewählt
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
    },
  };
}

declare global {
  interface Window {
    __fangpunktAppReady?: () => void;
  }
}

export function AppShell() {
  const online = useOnline();
  const { lens, navRef, itemRef, handlers } = useNavLens(NAV_PATHS);
  useEffect(() => {
    // Intro ausblenden, sobald die Oberfläche steht (index.html).
    window.__fangpunktAppReady?.();
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <FishMark size={30} />
          <span className={styles.wordmark}>{de.app.name}</span>
        </span>
        <span className={styles.headerEnd}>
          <SessionChip />
          {!online && (
            <span title={de.status.offlineHint}>
              <Badge tone="warning">
                <OfflineIcon size={14} />
                <span className={styles.offlineText}>{de.status.offline}</span>
              </Badge>
            </span>
          )}
        </span>
      </header>
      <nav ref={navRef} className={styles.nav} aria-label={de.nav.label} {...handlers}>
        {lens && (
          <span
            className={[styles.lens, lens.snapping ? styles.lensSnap : ''].join(' ')}
            style={{ '--lens-x': `${lens.center}px`, '--lens-w': `${lens.width}px` } as CSSProperties}
            aria-hidden="true"
          />
        )}
        {NAV.map(({ to, label, icon: Icon, end }, i) => (
          <NavLink
            key={to}
            ref={itemRef(i)}
            to={to}
            end={end}
            draggable={false}
            className={({ isActive }) =>
              [styles.navItem, isActive ? styles.active : '', lens?.index === i ? styles.lensed : ''].join(
                ' ',
              )
            }
          >
            <span className={styles.navIcon}>
              <Icon />
            </span>
            <span className={styles.navLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className={styles.main} id="main">
        <BackupReminder />
        <Outlet />
      </main>
      <UpdatePrompt />
      <WeatherSync />
      <SessionTracker />
      <GaugeSync />
    </div>
  );
}

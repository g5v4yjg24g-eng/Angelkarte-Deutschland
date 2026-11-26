// Untere Leiste (mobil schwebende Glas-Kapsel, ab 900 px Schiene links) – ein Baustein für die normale App und den
// Admin-Bereich (Wunsch Nutzer 2026-11-10): gleiche Form, Glas, Linse beim Wischen, aktive Kapsel; nur die Punkte
// unterscheiden sich. Designänderungen hier gelten für beide.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { DRAG_START_PX, itemAt, lensCenter, type Span } from './navLens';
import { NavWave } from './NavWave';
import { useHaptics } from '../features/haptics/useHaptics';
import styles from './AppShell.module.css';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType;
  /** nur bei genau diesem Pfad aktiv (Startseite) */
  end: boolean;
  /** zusätzlich aktiv unter diesem Pfad (z. B. Statistik im Fangbuch) */
  also?: string;
  /** kleine Zahl am Symbol (z. B. offene Meldungen) */
  badge?: ReactNode;
  /** kleiner roter Punkt oben rechts am Symbol (etwas Neues, ohne Zahl); Text für Screenreader */
  dot?: string;
}

/** Linse etwas breiter als ein Punkt, damit sie ihn umschließt */
const LENS_SCALE = 1.25;
const SNAP_MS = 220;

interface Lens {
  center: number;
  width: number;
  index: number;
  snapping: boolean;
  /** erst ab echtem Wischen: Der Hügel folgt dem Finger; beim bloßen Drücken gleitet er zum gedrückten Punkt */
  dragging: boolean;
}

/** Drücken und Wischen auf der Leiste (nur Touch/Stift, nur mobile Leiste): Linse folgt dem Finger, Loslassen wählt. */
/** `paths`: Router-Pfade der Punkte (ohne Basis-Pfad der Veröffentlichung) */
function useNavLens(paths: readonly string[], onTap: (index: number) => void) {
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const drag = useRef<{ id: number; startX: number; moved: boolean; spans: Span[]; index: number } | null>(
    null,
  );
  const haptics = useHaptics();
  const itemEls = useCallback(() => itemRefs.current, []);
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
    drag.current = { id: e.pointerId, startX: e.clientX, moved: false, spans: sp, index };
    setLens({
      center: item.left + item.width / 2,
      width: item.width * LENS_SCALE,
      index,
      snapping: false,
      dragging: false,
    });
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < DRAG_START_PX) return;
      d.moved = true;
      haptics.selectionStart();
      // Erst beim Wischen festhalten: Ein einfacher Tipp bleibt ein normaler Link-Klick
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Zeiger schon beendet – dann ohne Festhalten weiter
      }
    }
    const x = localX(e);
    const index = itemAt(x, d.spans);
    // Spürbarer Klick, sobald die Linse auf einen anderen Punkt wechselt (nur iPhone-App)
    if (index !== d.index) {
      d.index = index;
      haptics.selectionChanged();
    }
    setLens((l) => l && { ...l, center: lensCenter(x, d.spans), index, dragging: true });
  };
  const finish = (e: PointerEvent<HTMLElement>, select: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) {
      // Tipp: Der Klick folgt gleich; den gedrückten Punkt schon jetzt merken, damit der Hügel nicht kurz zurückspringt
      if (select) onTap(d.index);
      return setLens(null);
    }
    haptics.selectionEnd();
    suppressClick.current = true;
    const index = itemAt(localX(e), d.spans);
    const item = d.spans[index];
    if (select && item) {
      // Einrasten auf dem gewählten Punkt, dann ausblenden
      setLens((l) => l && { ...l, center: item.left + item.width / 2, index, snapping: true });
      // Router-Pfad, nicht das href: Das enthält auf GitHub Pages schon den Basis-Pfad, der Router setzt ihn sonst doppelt
      const to = paths[index];
      onTap(index);
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
    itemEls,
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

/** Aktiv wie bei NavLink bzw. über `also` */
const isActivePath = (n: NavItem, pathname: string) =>
  (n.end ? pathname === n.to : pathname === n.to || pathname.startsWith(`${n.to}/`)) ||
  (!!n.also && pathname.startsWith(n.also));

interface Geo {
  width: number;
  height: number;
  /** Mitte jedes Punkts, von der linken Außenkante der Leiste */
  centers: number[];
  tabWidth: number;
}

/** Maße der Leiste und der Punkte für die Umrandung; misst neu, wenn sich die Größe ändert. */
function useNavGeo(
  navRef: React.RefObject<HTMLElement | null>,
  itemRefs: () => (HTMLAnchorElement | null)[],
  count: number,
) {
  const [geo, setGeo] = useState<Geo | null>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const box = nav.getBoundingClientRect();
      const spans = itemRefs()
        .slice(0, count)
        .map((el) => el?.getBoundingClientRect());
      if (!box.width || spans.some((r) => !r)) return;
      const next: Geo = {
        width: box.width,
        height: box.height,
        centers: spans.map((r) => (r?.left ?? 0) - box.left + (r?.width ?? 0) / 2),
        tabWidth: spans[0]?.width ?? 0,
      };
      // Nur bei echter Änderung neu zeichnen (sonst Schleife über die Größenbeobachtung)
      setGeo((old) =>
        old &&
        old.width === next.width &&
        old.height === next.height &&
        old.tabWidth === next.tabWidth &&
        old.centers.length === next.centers.length &&
        old.centers.every((c, i) => c === next.centers[i])
          ? old
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [navRef, itemRefs, count]);
  return geo;
}

export function BottomNav({ items, label }: { items: readonly NavItem[]; label: string }) {
  const paths = items.map((n) => n.to);
  const { pathname } = useLocation();
  // Sofort beim Antippen losgleiten, nicht erst wenn die neue Ansicht fertig aufgebaut ist (Wunsch Nutzer 2026-11-26);
  // gilt nur, solange der Pfad noch der alte ist, danach übernimmt der echte aktive Punkt
  const [tap, setTap] = useState<{ index: number; from: string } | null>(null);
  const { lens, navRef, itemRef, itemEls, handlers } = useNavLens(paths, (index) =>
    setTap({ index, from: pathname }),
  );
  const geo = useNavGeo(navRef, itemEls, items.length);
  const activeIndex = items.findIndex((n) => isActivePath(n, pathname));
  useEffect(() => {
    if (!tap) return;
    const t = window.setTimeout(() => setTap(null), 1500);
    return () => window.clearTimeout(t);
  }, [tap]);
  const pending = tap && tap.from === pathname ? tap.index : null;
  const shownIndex = pending ?? activeIndex;
  // Beim Wischen folgt der Hügel dem Finger; beim bloßen Drücken gleitet er zum gedrückten Punkt, sonst zum angetippten
  // bzw. aktiven. Nie erst zur Linse und beim Loslassen kurz zurück (das war das Hin und Her).
  const pressedIndex = lens ? lens.index : shownIndex;
  const target =
    lens && (lens.dragging || lens.snapping)
      ? lens.center
      : pressedIndex >= 0
        ? (geo?.centers[pressedIndex] ?? null)
        : null;
  return (
    <nav
      ref={navRef}
      className={styles.nav}
      aria-label={label}
      style={{ '--nav-count': items.length } as CSSProperties}
      {...handlers}
    >
      {geo && (
        <NavWave
          width={geo.width}
          height={geo.height}
          tabWidth={geo.tabWidth}
          target={target}
          follow={!!lens && lens.dragging && !lens.snapping}
        />
      )}
      {lens && (
        <span
          className={[styles.lens, lens.snapping ? styles.lensSnap : ''].join(' ')}
          style={{ '--lens-x': `${lens.center}px`, '--lens-w': `${lens.width}px` } as CSSProperties}
          aria-hidden="true"
        />
      )}
      {items.map(({ to, label: text, icon: Icon, end, also, badge, dot }, i) => (
        <NavLink
          key={to}
          ref={itemRef(i)}
          to={to}
          end={end}
          draggable={false}
          onClick={() => setTap({ index: i, from: pathname })}
          className={({ isActive }) =>
            [
              styles.navItem,
              isActive || (also && pathname.startsWith(also)) ? styles.active : '',
              lens?.index === i ? styles.lensed : '',
            ].join(' ')
          }
        >
          <span className={styles.navIcon}>
            <Icon />
          </span>
          <span className={styles.navLabel}>{text}</span>
          {badge !== undefined && <span className={styles.navBadge}>{badge}</span>}
          {dot && <span className={styles.navDot} role="img" aria-label={dot} />}
        </NavLink>
      ))}
    </nav>
  );
}

// Eigene Linien-Icons (24er Raster, 1.8 px Strich). Dekorativ: aria-hidden; Beschriftung macht die Komponente.
import type { ReactNode, SVGProps } from 'react';
import fish from './brand/fish.json';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const MapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
    <path d="M9 4v14M15 6v14" />
  </Icon>
);
export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z" />
    <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7.5h6" />
  </Icon>
);
export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h16" />
    <rect x="5.5" y="11" width="3" height="6" rx="0.8" />
    <rect x="10.5" y="6" width="3" height="11" rx="0.8" />
    <rect x="15.5" y="9" width="3" height="8" rx="0.8" />
  </Icon>
);
export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
);
export const OfflineIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14 10.3A10 10 0 0 1 19 13M2 9.5a14 14 0 0 1 4-2.6M12 6a14 14 0 0 1 10 3.5" />
    <circle cx="12" cy="20" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 5-7 7 7 7" />
  </Icon>
);
export const ParagraphIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15.5 5.5c-.8-1.3-2-2-3.6-2-2 0-3.4 1.1-3.4 2.7 0 3.6 7.5 2.6 7.5 6.6 0 1.4-1 2.5-2.4 2.9M8.5 18.5c.8 1.3 2 2 3.6 2 2 0 3.4-1.1 3.4-2.7 0-3.6-7.5-2.6-7.5-6.6 0-1.4 1-2.5 2.4-2.9" />
  </Icon>
);
export const DatabaseIcon = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
    <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
  </Icon>
);
export const SlidersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icon>
);
export const HookIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="14" cy="4.5" r="1.8" />
    <path d="M14 6.3V15a4.5 4.5 0 0 1-9 0v-2.5l2.6 2.2" />
  </Icon>
);
export const HeatIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" strokeOpacity="0.45" />
    <circle cx="12" cy="12" r="5" strokeOpacity="0.75" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
  </Icon>
);
export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icon>
);
/** Schild (Moderation) */
export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5.5c0 4.3 3 7.9 7 9.5 4-1.6 7-5.2 7-9.5V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
export const WeatherIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8.5" cy="8.5" r="3" />
    <path d="M8.5 2.5v1.2M2.5 8.5h1.2M4.3 4.3l.9.9M12.7 4.3l-.9.9" />
    <path d="M9.5 19.5h8a3.5 3.5 0 0 0 .3-7 4.8 4.8 0 0 0-9-1.2 4 4 0 0 0 .7 8.2Z" />
  </Icon>
);
export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);
export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

/** Admin-Übersicht: vier Kacheln */
export const DashboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
    <rect x="3.5" y="15.5" width="7" height="5" rx="1.5" />
  </Icon>
);
/** Meldungen */
export const FlagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2 4 2 4H5" />
  </Icon>
);
/** Verwaltung/Einstellungen */
export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </Icon>
);
/** Admin-Bereich verlassen */
export const ExitIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />
  </Icon>
);
/** Mail */
export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
);

/** Markenzeichen (Fisch). Mit title wird es für Screenreader benannt, sonst dekorativ. */
export function FishMark({
  size = 32,
  title,
  onDark = false,
}: {
  size?: number;
  title?: string;
  onDark?: boolean;
}) {
  const c = fish.colors;
  const body = onDark ? c.fish : 'var(--color-primary)';
  const gill = onDark ? c.deep : 'var(--color-surface)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="12 18 78 62"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={fish.tail} fill={body} />
      {fish.fins.map((d) => (
        <path key={d} d={d} fill={body} />
      ))}
      <path d={fish.body} fill={body} />
      <path d={fish.gill} fill="none" stroke={gill} strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={fish.eye.cx} cy={fish.eye.cy} r={fish.eye.r} fill={c.eye} />
    </svg>
  );
}
export const KnotIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 18c3 0 5-2 6.5-5S13 6 15.5 6 19 8 17.5 10.5 11 12 9.5 10 11 5 13 5" />
    <path d="M12.5 13.5C14 16 16.5 18 21 18" />
  </Icon>
);
export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 5v14l11-7z" />
  </Icon>
);
export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5v14M16 5v14" />
  </Icon>
);
export const StepBackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 5v14M18 5 9 12l9 7z" />
  </Icon>
);
export const StepForwardIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 5v14M6 5l9 7-9 7z" />
  </Icon>
);
export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </Icon>
);
/** Feed: Beiträge von Freunden (zwei Personen) */
export const FeedIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
    <path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M17.5 14.8c2.1.7 3.5 2.4 4 5.2" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const UserPlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M19 8v6M16 11h6" />
  </Icon>
);
/** mehrere Fotos (Karussell) */
export const ImagesIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="3" width="14" height="14" rx="2.5" />
    <path d="M17 21H5.5A2.5 2.5 0 0 1 3 18.5V7" />
  </Icon>
);
/** „Gefällt mir“ als Daumen hoch (wie früher bei Facebook) */
export const ThumbsUpIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}>
    <path
      d="M7 10.5v9.5H4.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1H7Zm0 0 3.6-6.6a1.6 1.6 0 0 1 3 .9l-.6 4.2h5.2a2 2 0 0 1 2 2.4l-1.3 6.8a2.2 2.2 0 0 1-2.2 1.8H7"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
);
export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z" />
  </Icon>
);
export const CommentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4A8 8 0 1 1 20 11.5Z" />
  </Icon>
);
export const BookmarkIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}>
    <path
      d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1Z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
);
/** Teilen wie im iPhone-Teilen-Menü: Kasten mit Pfeil nach oben */
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5v11" />
    <path d="m8 7.5 4-4 4 4" />
    <path d="M8.5 10.5H7a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5" />
  </Icon>
);
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Icon>
);

/** Stift (bearbeiten) */
export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20Z" />
    <path d="m14.5 6 3.5 3.5" />
  </Icon>
);
/** Papierkorb */
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1Z" />
    <path d="M6 7l1 12a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 19l1-12M10 11v5.5M14 11v5.5" />
  </Icon>
);
/** Geräte (Bildschirm und Handy) */
export const DevicesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 17H4.5A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5h12A1.5 1.5 0 0 1 18 6.5V8M7 20h3" />
    <rect x="14" y="10.5" width="7" height="10" rx="1.5" />
  </Icon>
);

/** Lupe (Suche) */
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </Icon>
);

/** Haken */
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

/** Stopp (Quadrat) */
export const StopIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
  </Icon>
);
/** Standortnadel */
export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icon>
);
/** Strecke mit zwei Punkten (Routenpunkte) */
export const PathIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5.5" cy="6.5" r="2" />
    <circle cx="18.5" cy="17.5" r="2" />
    <path d="M7.5 6.5h5.5a3 3 0 0 1 0 6h-2a3 3 0 0 0 0 6h5.5" />
  </Icon>
);
/** Strecke zwischen zwei Nadeln (Kilometer) */
export const DistanceIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="6" r="2.2" />
    <circle cx="18" cy="18" r="2.2" />
    <path d="M8 7.5c4 .5 1.5 4.5 4 6.5s4 1.2 4 2" strokeDasharray="2 2.5" />
  </Icon>
);
/** Tasse (Pausen) */
export const CupIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9Z" />
    <path d="M16.5 10.500h1.5a2.5 2.5 0 0 1 0 5h-1.5M8 3.5c0 1.5 1.5 1.5 1.5 3M12 3.5c0 1.5 1.5 1.5 1.5 3" />
  </Icon>
);
/** Fisch (Umriss) */
export const FishIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12c3-5 8-6.5 12-4.5l3.5-2.5v14L15 16.5C11 18.5 6 17 3 12Z" />
    <circle cx="8.5" cy="11" r="0.9" fill="currentColor" />
  </Icon>
);
/** Biss: Wellen mit Pfeil nach unten */
export const BiteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v8m0 0-3-3m3 3 3-3" />
    <path d="M4 15c2.5 2.5 5.5 2.5 8 0s5.5-2.5 8 0M6.5 19c1.700 1.300 3.5 1.300 5.5 0s3.800-1.300 5.5 0" />
  </Icon>
);

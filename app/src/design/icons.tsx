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

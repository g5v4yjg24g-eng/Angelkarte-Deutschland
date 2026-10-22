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

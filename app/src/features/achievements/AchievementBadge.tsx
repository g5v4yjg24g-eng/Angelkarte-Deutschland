// Abzeichen als Sechseck („Schuppe“) in Bronze, Silber, Gold oder Fangpunkt-Petrol (Start); offen = grau,
// gestrichelt. Eigene Zeichnung (Vorschau freigegeben 2026-11-06). Medaillenfarben sind fest (wie ein Bild).
import { useId } from 'react';
import type { FamilyId, Tier } from '../../domain/achievements';

type Kind = FamilyId | 'first';

const HEX =
  'M48 6c2.4 0 4.8.6 7 1.9l25.6 14.8c4.3 2.5 7 7.1 7 12.1v29.6c0 5-2.7 9.6-7 12.1L55 91.3c-4.3 2.5-9.7 2.5-14 0L15.4 76.5c-4.3-2.5-7-7.1-7-12.1V34.8c0-5 2.7-9.6 7-12.1L41 7.9C43.2 6.6 45.6 6 48 6Z';

const LOOK = {
  bronze: {
    top: '#c98a52',
    bottom: '#7d4a22',
    ring: 'rgba(255,255,255,.4)',
    icon: '#fff7ee',
    plate: '#5a3315',
    plateText: '#ffe9d2',
  },
  silver: {
    top: '#e6edf0',
    bottom: '#93a4ab',
    ring: 'rgba(255,255,255,.7)',
    icon: '#22343a',
    plate: '#3b4d54',
    plateText: '#f2f6f7',
  },
  gold: {
    top: '#f3d675',
    bottom: '#b8842a',
    ring: 'rgba(255,255,255,.65)',
    icon: '#3d2a06',
    plate: '#6b4a0e',
    plateText: '#fff3cf',
  },
  start: {
    top: '#1b7d92',
    bottom: '#0b3d4a',
    ring: 'rgba(255,255,255,.35)',
    icon: '#ffffff',
    plate: '#f2994a',
    plateText: '#2b1600',
  },
} as const;

function Icon({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'first':
    case 'catches':
      return (
        <>
          <path d="M2.5 12c3-4.2 7.4-5.4 11.5-4.3 2.4.6 4.2 2.2 5.2 4.3-1 2.1-2.8 3.7-5.2 4.3C9.9 17.4 5.5 16.2 2.5 12Z" />
          <path d="M19.2 12 22 9.5v5L19.2 12Z" />
          <circle cx="15.6" cy="11" r=".9" fill="currentColor" stroke="none" />
        </>
      );
    case 'pike':
      return (
        <>
          <path d="M1.8 12.4c2.6-2.6 6.4-3.6 10.6-3.6 3.2 0 6.3.9 9.8 2.4l-3.3 1 3.3 1c-3.5 1.4-6.6 2.1-9.8 2.1-4.2 0-8-1-10.6-2.9Z" />
          <path d="M7 9.4 5.6 7.4M7.2 15.2l-1.4 1.8" />
          <circle cx="15.4" cy="11.3" r=".9" fill="currentColor" stroke="none" />
        </>
      );
    case 'zander':
      return (
        <>
          <path d="M2.5 13c3-3.8 7.4-5 11.5-4 2.4.6 4.2 2 5.2 4-1 2-2.8 3.4-5.2 4-4.1 1-8.5 0-11.5-4Z" />
          <path d="M19.2 13 22 10.6v4.8L19.2 13Z" />
          <path d="M7.5 9.6 8.4 6.8l1.2 2.4 1.1-2.6 1.1 2.4 1-2.2.9 2.2" />
          <circle cx="15.6" cy="12" r=".9" fill="currentColor" stroke="none" />
        </>
      );
    case 'species':
      return (
        <>
          <path d="M3 7.5c1.6-2 3.9-2.6 6.1-2.1 1.3.3 2.2 1.1 2.8 2.1-.6 1-1.5 1.8-2.8 2.1C6.9 10.1 4.6 9.5 3 7.5Z" />
          <path d="M11.5 12.5c1.6-2 3.9-2.6 6.1-2.1 1.3.3 2.2 1.1 2.8 2.1-.6 1-1.5 1.8-2.8 2.1-2.2.5-4.5-.1-6.1-2.1Z" />
          <path d="M4 17.5c1.6-2 3.9-2.6 6.1-2.1 1.3.3 2.2 1.1 2.8 2.1-.6 1-1.5 1.8-2.8 2.1-2.2.5-4.5-.1-6.1-2.1Z" />
        </>
      );
    case 'waters':
      return (
        <>
          <path d="M2 8.5c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0" />
          <path d="M2 13.5c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0" />
          <path d="M2 18.5c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 6.6 0" />
        </>
      );
    case 'sessions':
      return (
        <>
          <circle cx="12" cy="13.5" r="7" />
          <path d="M12 9.5v4l2.8 1.8M10 3h4M12 3v3.5M18.2 6.6l1.4-1.4" />
        </>
      );
    case 'big':
      return (
        <>
          <rect x="2.5" y="8" width="19" height="8" rx="1.6" />
          <path d="M6 8v3M9.5 8v2M13 8v3M16.5 8v2M20 8v3" />
        </>
      );
  }
}

export function AchievementBadge({
  kind,
  tier,
  plate,
  label,
  size = 64,
}: {
  kind: Kind;
  /** null = noch offen */
  tier: Tier | 'start' | null;
  /** kleines Schild unten (z. B. Schwelle „50“) */
  plate?: string | undefined;
  /** Name für Screenreader; leer = nur Zierde */
  label?: string;
  size?: number;
}) {
  const id = useId();
  const look = tier ? LOOK[tier] : null;
  const ic = look ? look.icon : 'var(--color-text-muted)';
  const w = plate ? plate.length * 6 + 12 : 0;
  return (
    <svg
      viewBox="0 0 96 98"
      width={size}
      height={(size * 98) / 96}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      style={{ display: 'block', flex: 'none' }}
    >
      {look && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2=".3" y2="1">
            <stop offset="0" stopColor={look.top} />
            <stop offset="1" stopColor={look.bottom} />
          </linearGradient>
        </defs>
      )}
      <path
        d={HEX}
        fill={look ? `url(#${id})` : 'var(--color-surface-2)'}
        stroke={look ? 'none' : 'var(--color-text-muted)'}
        strokeOpacity={0.45}
        strokeWidth={2}
      />
      <path
        d={HEX}
        fill="none"
        stroke={look ? look.ring : 'var(--color-text-muted)'}
        strokeWidth={2}
        strokeDasharray={look ? undefined : '5 4'}
        transform="translate(48 49) scale(.86) translate(-48 -49)"
      />
      <g
        transform={`translate(26 ${plate ? 22 : 27}) scale(1.83)`}
        fill="none"
        stroke={ic}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: ic }}
      >
        <Icon kind={kind} />
      </g>
      {plate && (
        <g>
          <rect
            x={48 - w / 2}
            y={68}
            width={w}
            height={16}
            rx={8}
            fill={look ? look.plate : 'var(--color-surface)'}
            stroke={look ? 'none' : 'var(--color-border)'}
          />
          <text
            x={48}
            y={79.5}
            textAnchor="middle"
            fontFamily="Inter Variable, system-ui, sans-serif"
            fontSize={11}
            fontWeight={700}
            fill={look ? look.plateText : 'var(--color-text-muted)'}
          >
            {plate}
          </text>
        </g>
      )}
    </svg>
  );
}

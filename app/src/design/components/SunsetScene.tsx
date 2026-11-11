// Sonnenuntergang am See (Wunsch Nutzer 2026-11-11, angelehnt an die Vorlagen). Eigene Zeichnung, rein dekorativ.
// `corner`: Visitenkarte (Kontodetails, Gemeinsam angeln) – sitzt rechts und läuft nach links aus (Maske im CSS).
// `full`: Kopfbild der Session – deckt die ganze Karte, Himmel und Wasser sind undurchsichtig.
import { useId } from 'react';
import styles from './SunsetScene.module.css';

export function SunsetScene({ variant = 'corner' }: { variant?: 'corner' | 'full' }) {
  const id = useId();
  const sky = `${id}-sky`;
  const glow = `${id}-glow`;
  const water = `${id}-water`;
  const streak = `${id}-streak`;
  const full = variant === 'full';
  return (
    <svg
      className={full ? `${styles.sunset} ${styles.full}` : styles.sunset}
      viewBox="0 0 240 120"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          {/* oben durchsichtig: die Kartenfläche bleibt der Abendhimmel (hell wie dunkel) */}
          <stop offset="0" stopColor="#b9703a" stopOpacity="0" />
          <stop offset="0.5" stopColor="#b9703a" stopOpacity="0.25" />
          <stop offset="0.82" stopColor="#d98444" stopOpacity="0.8" />
          <stop offset="1" stopColor="#f2a24a" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff1c2" />
          <stop offset="0.18" stopColor="#ffd27a" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#f59a3c" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f59a3c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={water} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9783a" />
          <stop offset="0.4" stopColor="#8a5a36" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8a5a36" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={streak} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe2a0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb45a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Himmel mit Sonne */}
      {full && <rect width="240" height="120" fill="#10272f" />}
      {full && <rect width="240" height="72" fill="#1d4650" />}
      <rect width="240" height="72" fill={`url(#${sky})`} />
      <circle cx="176" cy="62" r="46" fill={`url(#${glow})`} />
      <circle cx="176" cy="62" r="7.5" fill="#fff3cf" />
      {/* Wolkenstreifen */}
      <path d="M96 30c14-4 30-4 46 0-16 2-32 2-46 0Z" fill="#e59a58" opacity="0.35" />
      <path d="M150 22c18-5 44-5 70 1-26 3-50 3-70-1Z" fill="#f0a868" opacity="0.3" />
      <path d="M40 44c16-3 34-3 52 0-18 2-36 2-52 0Z" fill="#c98250" opacity="0.25" />
      {/* Wasser mit Spiegelung */}
      {full && <rect y="72" width="240" height="48" fill="#0d252d" />}
      <rect y="72" width="240" height="48" fill={`url(#${water})`} />
      <path d="M170 72h12l5 40h-22Z" fill={`url(#${streak})`} />
      <path d="M150 84h46M158 92h34M163 101h24" stroke="#ffd58c" strokeWidth="1" opacity="0.45" />
      {/* fernes Ufer: Baumreihe als Silhouette */}
      <path
        d="M0 73V63c5-1 7-5 12-5 4 0 5 3 9 3 3-4 6-8 11-8 5 0 6 5 10 6 4-2 7-3 11-2 4-5 8-9 13-8 5 1 5 6 9 8 5-1 8-3 12-1 4-3 7-6 12-5 4 1 5 4 8 6 5-1 9-2 13 0 3-2 6-4 10-3 4 1 5 4 9 5 5-2 9-2 13 0 4-3 8-5 12-4 4 1 5 4 9 5 5-1 9-1 12 1 4-2 8-3 12-2 3 1 5 3 8 4 5-1 8 0 11 1 4-2 8-3 12-2 3 1 5 2 9 2 4 0 7-1 12-1v8Z"
        fill="currentColor"
      />
      {/* Schilf im Vordergrund rechts */}
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M214 120c0-16 2-28 6-38M221 120c0-13 1-24 4-33M228 120c0-18-1-30-4-41M234 120c0-12 1-22 3-30M207 120c1-10 3-18 7-25" />
      </g>
      <g fill="currentColor">
        <ellipse cx="220" cy="80" rx="1.8" ry="5" transform="rotate(14 220 80)" />
        <ellipse cx="224" cy="77" rx="1.8" ry="5" transform="rotate(-10 224 77)" />
        <ellipse cx="237" cy="88" rx="1.6" ry="4.5" transform="rotate(10 237 88)" />
      </g>
    </svg>
  );
}

// Vorschaubild eines Gewässers in der Detailsuche. Ohne Foto eine eigene Platzhalter-Zeichnung je Gewässerart –
// bewusst keine Foto-Anmutung, damit niemand sie für ein Bild dieses Gewässers hält.
import { useId, useState } from 'react';

type Look = { sky: string; water: string; sun: boolean; shape: 'lake' | 'river' | 'canal' | 'dam' | 'pond' };

const OTHER: Look = { sky: '#cfd8dc', water: '#4a7585', sun: false, shape: 'lake' };
const LOOK: Record<string, Look> = {
  lake: { sky: '#f6b26b', water: '#2c6f84', sun: true, shape: 'lake' },
  pond: { sky: '#f3d58a', water: '#3d7f6a', sun: false, shape: 'pond' },
  reservoir: { sky: '#e8a77c', water: '#2b6a7e', sun: true, shape: 'dam' },
  river: { sky: '#9ecbd8', water: '#2f7d8a', sun: false, shape: 'river' },
  stream: { sky: '#a9d3b8', water: '#3a7f86', sun: false, shape: 'river' },
  canal: { sky: '#b5c9d6', water: '#3a6f86', sun: false, shape: 'canal' },
  oxbow: { sky: '#d6c58f', water: '#35756f', sun: false, shape: 'river' },
  harbour: { sky: '#c9b8d6', water: '#33657f', sun: false, shape: 'canal' },
};

export function WaterThumb({ kind, photo }: { kind: string; photo?: string | undefined }) {
  const id = useId();
  const [failed, setFailed] = useState<string>();
  // Bild nicht ladbar (offline, Datei entfernt): Platzhalter
  if (photo && failed !== photo)
    return (
      <img
        className="waterThumbImg"
        src={photo}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(photo)}
      />
    );
  const l = LOOK[kind] ?? OTHER;
  return (
    <svg viewBox="0 0 72 56" width="72" height="56" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={l.sky} />
          <stop offset=".62" stopColor="#e9d5b4" />
          <stop offset=".62" stopColor={l.water} />
          <stop offset="1" stopColor="#143a45" />
        </linearGradient>
      </defs>
      <rect width="72" height="56" fill={`url(#${id})`} />
      {l.sun && <circle cx="46" cy="30" r="7" fill="#fff6d8" opacity=".9" />}
      <path
        d="M0 34 L8 22 L14 32 L22 18 L30 33 L40 24 L48 34 L72 34 L72 38 L0 38Z"
        fill="#12373f"
        opacity=".85"
      />
      {l.shape === 'river' && (
        <path d="M-4 56 C18 40 30 52 48 42 S66 40 78 34 L78 60 L-4 60Z" fill="#cfe9ef" opacity=".25" />
      )}
      {l.shape === 'canal' && (
        <>
          <path d="M0 36 H72" stroke="#12373f" strokeWidth="2" />
          <path d="M0 46 H72M0 52 H72" stroke="#fff" strokeOpacity=".15" />
        </>
      )}
      {l.shape === 'dam' && <path d="M0 30 L72 30 L72 36 L0 36Z" fill="#12373f" opacity=".7" />}
      <path d="M8 44h20M34 48h26" stroke="#fff" strokeOpacity=".25" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Landeswappen; ohne Datei oder bei Ladefehler ein neutrales Schild. Gemeinsam für Gewässerprofil und Fang.
import { useState } from 'react';
import { crestUrl, type WaterPhoto } from '../../domain/waterPhotos';

export function StateCrest({
  crest,
  className,
}: {
  crest?: WaterPhoto | undefined;
  className?: string | undefined;
}) {
  const [failed, setFailed] = useState(false);
  if (crest && !failed)
    return (
      <img
        className={className}
        src={crestUrl(crest, 120)}
        srcSet={`${crestUrl(crest, 120)} 1x, ${crestUrl(crest, 250)} 2x`}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  return (
    <svg className={className} viewBox="0 0 34 40" aria-hidden="true" focusable="false">
      <path
        d="M3 3h28v17c0 9-7 15-14 17C10 35 3 29 3 20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity=".55"
      />
    </svg>
  );
}

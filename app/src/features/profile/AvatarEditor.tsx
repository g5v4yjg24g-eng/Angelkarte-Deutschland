// Profilbild zuschneiden (Wunsch Nutzer 2026-11-06, „wie bei Instagram“): Bild im festen Kreis verschieben
// (Finger/Maus/Pfeiltasten), mit zwei Fingern, Mausrad oder Regler zoomen, zurücksetzen, übernehmen. Gespeichert
// wird das Quadrat; rund ist es nur in der Anzeige. Rechnung rein in domain/avatarCrop.ts.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import {
  clampCrop,
  imageBox,
  INITIAL_CROP,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  zoomAt,
  type CropState,
  type ImageSize,
} from '../../domain/avatarCrop';
import { processPhoto, type ProcessedPhoto } from '../../lib/processPhoto';
import { cropPhoto } from '../../lib/cropPhoto';
import { useObjectUrl } from '../../lib/useObjectUrl';
import styles from './AvatarEditor.module.css';

const t = de.profile.avatarEditor;
const KEY_STEP = 0.02;

interface Working {
  blob: Blob;
  size: ImageSize;
}

type Load = { status: 'loading' } | { status: 'ready'; working: Working } | { status: 'error' };

function CropView({
  img,
  url,
  crop,
  className,
}: {
  img: ImageSize;
  url: string;
  crop: CropState;
  className: string | undefined;
}) {
  const b = imageBox(img, crop);
  return (
    <span className={className} aria-hidden="true">
      <img
        src={url}
        alt=""
        draggable={false}
        style={{ left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` }}
      />
    </span>
  );
}

export function AvatarEditor({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (photo: ProcessedPhoto) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const working = load.status === 'ready' ? load.working : undefined;
  const url = useObjectUrl(working?.blob);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Einmal aufbereiten (richtig ausgerichtet, verkleinert, ohne EXIF) – Anzeige und Zuschnitt nutzen dasselbe Bild
  useEffect(() => {
    let live = true;
    processPhoto(file)
      .then(
        (p) =>
          live &&
          setLoad({ status: 'ready', working: { blob: p.blob, size: { width: p.width, height: p.height } } }),
      )
      .catch(() => live && setLoad({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [file]);

  const rect = () => frame.current?.getBoundingClientRect();
  /** Punkt relativ zur Rahmenmitte in Rahmen-Einheiten */
  const rel = (x: number, y: number) => {
    const r = rect();
    if (!r || !r.width) return { px: 0, py: 0 };
    return { px: (x - r.left) / r.width - 0.5, py: (y - r.top) / r.height - 0.5 };
  };

  const update = (fn: (img: ImageSize, s: CropState) => CropState) => {
    if (!working) return;
    setCrop((s) => fn(working.size, s));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!working) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    const r = rect();
    if (!prev || !r?.width) return;
    const others = [...map.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
    const next = { x: e.clientX, y: e.clientY };
    map.set(e.pointerId, next);
    const other = others[0];
    if (!other) {
      update((img, s) => panBy(img, s, (next.x - prev.x) / r.width, (next.y - prev.y) / r.width));
      return;
    }
    // Zwei Finger: Abstand → Zoom um die Mitte zwischen den Fingern, Bewegung der Mitte → Verschieben
    const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
    const d1 = Math.hypot(next.x - other.x, next.y - other.y);
    if (d0 < 1) return;
    const m0 = rel((prev.x + other.x) / 2, (prev.y + other.y) / 2);
    const m1 = rel((next.x + other.x) / 2, (next.y + other.y) / 2);
    update((img, s) =>
      panBy(img, zoomAt(img, s, s.zoom * (d1 / d0), m0.px, m0.py), m1.px - m0.px, m1.py - m0.py),
    );
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const p = rel(e.clientX, e.clientY);
    update((img, s) => zoomAt(img, s, s.zoom * Math.exp(-e.deltaY * 0.0015), p.px, p.py));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP, 0],
      ArrowRight: [-KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    const m = moves[e.key];
    if (m) update((img, s) => panBy(img, s, m[0], m[1]));
    else if (e.key === '+' || e.key === '=') update((img, s) => zoomAt(img, s, s.zoom * 1.1));
    else if (e.key === '-') update((img, s) => zoomAt(img, s, s.zoom / 1.1));
    else return;
    e.preventDefault();
  };

  const apply = async () => {
    if (!working) return;
    setBusy(true);
    setSaveError(false);
    try {
      onDone(await cropPhoto(working.blob, working.size, clampCrop(working.size, crop)));
    } catch {
      setSaveError(true);
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="avatar-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="avatar-editor-title" className={styles.title}>
        {t.title}
      </h2>
      {load.status === 'error' ? (
        <Notice tone="error">{t.readError}</Notice>
      ) : (
        <>
          <p className={styles.hint}>{t.hint}</p>
          <div
            ref={frame}
            className={styles.frame}
            role="group"
            tabIndex={0}
            aria-label={t.frameLabel}
            aria-busy={load.status === 'loading' || undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
          >
            {working && url ? (
              <CropView img={working.size} url={url} crop={crop} className={styles.image} />
            ) : (
              <span className={styles.loading}>{t.loading}</span>
            )}
          </div>
          <div className={styles.controls}>
            {working && url && (
              <CropView img={working.size} url={url} crop={crop} className={styles.preview} />
            )}
            <label className={styles.zoom}>
              <span>{t.zoom}</span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={crop.zoom}
                disabled={!working}
                onChange={(e) => update((img, s) => zoomAt(img, s, Number(e.target.value)))}
              />
            </label>
            <Button variant="ghost" onClick={() => setCrop(INITIAL_CROP)} disabled={!working || busy}>
              {t.reset}
            </Button>
          </div>
        </>
      )}
      {saveError && <Notice tone="error">{t.saveError}</Notice>}
      <div className={styles.actions}>
        <Button onClick={() => void apply()} disabled={!working || busy}>
          {busy ? t.applying : t.apply}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t.cancel}
        </Button>
      </div>
    </dialog>
  );
}

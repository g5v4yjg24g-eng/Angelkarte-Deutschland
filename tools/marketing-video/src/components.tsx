// Bausteine: Handy-Rahmen, Fisch-Logo, Texteinblendung, Angelszene, QR-Code.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, Easing } from 'remotion';
import { C, FONT_DISPLAY, FONT_UI, cfg, fish, qr, sec, type Clip } from './config';

const SCREEN_W = 393; // CSS-px der Aufnahmen
const SCREEN_H = 852; // inkl. Statusleiste (54 px) – iPhone-Größe

/** Modernes Smartphone (ohne Markenbezug) mit Statusleiste; children füllen den App-Bereich unter der Statusleiste. */
export function Phone({ width, children, style }: { width: number; children: ReactNode; style?: CSSProperties }) {
  const bezel = width * 0.035;
  const screenW = width - 2 * bezel;
  const k = screenW / SCREEN_W;
  const height = SCREEN_H * k + 2 * bezel;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.155,
        background: 'linear-gradient(145deg, #3a4246, #15191b 45%, #2b3236)',
        padding: bezel,
        boxShadow: '0 40px 90px rgba(0,0,0,0.45), 0 10px 30px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(255,255,255,0.08)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: screenW,
          height: SCREEN_H * k,
          borderRadius: width * 0.125,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <StatusBar k={k} />
        <div style={{ position: 'absolute', top: 54 * k, left: 0, width: screenW, height: (SCREEN_H - 54) * k, overflow: 'hidden' }}>
          {children}
        </div>
        {/* Kamera-Insel */}
        <div
          style={{
            position: 'absolute',
            top: 11 * k,
            left: '50%',
            width: 124 * k,
            height: 36 * k,
            marginLeft: -62 * k,
            borderRadius: 18 * k,
            background: '#000',
          }}
        />
      </div>
    </div>
  );
}

function StatusBar({ k }: { k: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        height: 54 * k,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${6 * k}px ${34 * k}px 0`,
        font: `600 ${17 * k}px ${FONT_UI}`,
        color: '#000',
      }}
    >
      <span>9:41</span>
      <svg width={70 * k} height={14 * k} viewBox="0 0 70 14">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 5} y={10 - i * 3} width={3.4} height={4 + i * 3} rx={0.8} fill="#000" />
        ))}
        <path d="M28 5.2a10 10 0 0 1 14 0l-1.6 1.6a7.6 7.6 0 0 0-10.8 0zM31.4 8.6a5.2 5.2 0 0 1 7.2 0L35 12.2z" fill="#000" />
        <rect x={46} y={1.5} width={21} height={11} rx={3} fill="none" stroke="#000" strokeOpacity={0.4} />
        <rect x={48} y={3.5} width={15} height={7} rx={1.6} fill="#000" />
        <rect x={68} y={5} width={1.6} height={4} rx={0.6} fill="#000" fillOpacity={0.4} />
      </svg>
    </div>
  );
}

/** Echte App-Aufnahme (PNG oder MP4) füllt den App-Bereich. */
export function Screen({ src, startFrom = 0 }: { src: string; startFrom?: number }) {
  const style: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' };
  return src.endsWith('.mp4') ? (
    <OffthreadVideo src={staticFile(src)} startFrom={startFrom} muted style={style} />
  ) : (
    <Img src={staticFile(src)} style={style} />
  );
}

/** Fisch-Logo aus dem Marken-Master; progress 0…1 spielt das Intro der App nach (Einschwimmen, Flossenschlag, Auge). */
export function FishLogo({ size, progress = 1 }: { size: number; progress?: number }) {
  const c = fish.colors;
  const p = (a: number, b: number) => interpolate(progress, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
  const body = p(0, 0.55);
  const tail = Math.sin(p(0.4, 0.8) * Math.PI * 2) * 12 * (1 - p(0.4, 0.8));
  const eye = p(0.5, 0.75);
  const ripple = p(0.15, 0.65);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
      <path d={fish.ripple} fill="none" stroke={c.ripple} strokeWidth={3.2} strokeLinecap="round" strokeDasharray={80} strokeDashoffset={80 * (1 - ripple)} />
      <g style={{ opacity: body, transform: `translateX(${-38 * (1 - body)}px)` }}>
        <path d={fish.tail} fill={c.fish} style={{ transformOrigin: `${fish.tailPivot[0]}px ${fish.tailPivot[1]}px`, transform: `rotate(${tail}deg)` }} />
        {fish.fins.map((d) => (
          <path key={d} d={d} fill={c.fish} />
        ))}
        <path d={fish.body} fill={c.fish} />
        <path d={fish.gill} fill="none" stroke={c.deep} strokeWidth={2.6} strokeLinecap="round" />
        <circle cx={fish.eye.cx} cy={fish.eye.cy} r={fish.eye.r * eye} fill={c.eye} />
      </g>
    </svg>
  );
}

/** Texteinblendung: weiches Einblenden und leichtes Anheben, danach Ausblenden. Zeiten in Frames relativ zur Sequenz. */
export function Caption({ text, from, to, size, style }: { text: string; from: number; to: number; size: number; style?: CSSProperties }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [from, from + 12, to - 10, to], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(f, [from, from + 18], [18, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <div
      style={{
        font: `620 ${size}px/1.15 ${FONT_DISPLAY}`,
        color: '#fff',
        textAlign: 'center',
        textWrap: 'balance',
        textShadow: '0 2px 18px rgba(0,0,0,0.45)',
        opacity: o,
        transform: `translateY(${y}px)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/** Angelszene: Clip aus assets/fishing-scenes/ mit langsamer Kamerafahrt; ohne Clip ein klar gekennzeichneter Platzhalter. */
export function Footage({ clip, label, push = [1, 1.08], duration, scrim = 'top' }: { clip: Clip | null; label: string; push?: [number, number]; duration: number; scrim?: 'top' | 'left' }) {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, duration], push);
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: C.deep }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        {clip ? (
          <OffthreadVideo
            src={staticFile(`fishing-scenes/${clip.file}`)}
            startFrom={sec(clip.startFrom ?? 0)}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${(clip.focusX ?? 0.5) * 100}% ${(clip.focusY ?? 0.5) * 100}%` }}
          />
        ) : (
          <Placeholder label={label} />
        )}
      </AbsoluteFill>
      {/* Abdunklung dort, wo der Text steht (oben im Hochformat, links im Querformat) – auch über hellem Nebel lesbar */}
      <AbsoluteFill
        style={{
          background:
            scrim === 'top'
              ? 'linear-gradient(180deg, rgba(6,20,25,0.78) 0%, rgba(6,20,25,0.45) 22%, rgba(6,20,25,0) 42%, rgba(6,20,25,0) 70%, rgba(6,20,25,0.45) 100%)'
              : 'linear-gradient(90deg, rgba(6,20,25,0.78) 0%, rgba(6,20,25,0.5) 30%, rgba(6,20,25,0) 58%), linear-gradient(180deg, rgba(6,20,25,0) 70%, rgba(6,20,25,0.4) 100%)',
        }}
      />
    </AbsoluteFill>
  );
}

function Placeholder({ label }: { label: string }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 50% ${60 + Math.sin(f / 40) * 4}%, #5d7f86 0%, #2a4a52 45%, ${C.deep} 100%)`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ font: `600 30px ${FONT_UI}`, color: 'rgba(255,255,255,0.75)', border: '2px dashed rgba(255,255,255,0.5)', borderRadius: 16, padding: '18px 28px', textAlign: 'center', maxWidth: '70%' }}>
        Platzhalter Angelszene
        <br />
        <span style={{ fontWeight: 400, fontSize: 26 }}>{label}</span>
      </div>
    </AbsoluteFill>
  );
}

/** QR-Code als Module mit ganzzahliger Pixelgröße, reines Schwarz auf Weiß, Ruhezone 4 Module. Wird nie bewegt oder skaliert. */
export function QrCode({ module }: { module: number }) {
  const n = qr.rows.length;
  const q = qr.quietZone;
  const size = (n + 2 * q) * module;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n + 2 * q} ${n + 2 * q}`} shapeRendering="crispEdges" style={{ display: 'block' }}>
      <rect width={n + 2 * q} height={n + 2 * q} fill="#fff" />
      {qr.rows.flatMap((row, y) =>
        [...row].map((v, x) => (v === '1' ? <rect key={`${x}-${y}`} x={x + q} y={y + q} width={1} height={1} fill="#000" /> : null)),
      )}
    </svg>
  );
}

export const demoNoteStyle: CSSProperties = {
  font: `500 20px ${FONT_UI}`,
  color: 'rgba(255,255,255,0.85)',
  textAlign: 'center',
  background: 'rgba(11,42,51,0.55)',
  borderRadius: 999,
  padding: '6px 16px',
};
export const demoNote = cfg.texts.demoNote;

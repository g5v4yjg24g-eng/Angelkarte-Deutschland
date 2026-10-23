// Ablauf des Werbevideos. Dieselben Szenen für beide Formate; Positionen kommen aus dem Layout (vertikal/horizontal).
import type { CSSProperties } from 'react';
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT_DISPLAY, FONT_UI, T, cfg, clips, sec, voiceover } from './config';
import { Caption, FishLogo, Footage, Phone, QrCode, Screen, demoNote, demoNoteStyle } from './components';

export type Format = 'vertical' | 'horizontal';

interface Layout {
  caption: CSSProperties;
  captionSize: number;
  phoneWidth: number;
  phone: CSSProperties; // Position des Handys
  enter: 'bottom' | 'right';
  chip: CSSProperties;
  qrModule: number;
}

const LAYOUTS: Record<Format, Layout> = {
  // 1080 × 1920: Text oben (unterhalb der Plattform-Kopfzeile), Handy mittig, unten Platz für Plattform-Bedienelemente
  vertical: {
    caption: { position: 'absolute', top: 210, left: 80, right: 80 },
    captionSize: 64,
    phoneWidth: 560,
    phone: { position: 'absolute', top: 520, left: 260 },
    enter: 'bottom',
    chip: { position: 'absolute', top: 440, left: 0, right: 0, display: 'flex', justifyContent: 'center' },
    qrModule: 12,
  },
  // 1920 × 1080: Text links, Handy rechts
  horizontal: {
    caption: { position: 'absolute', top: 330, left: 150, width: 860, textAlign: 'left' },
    captionSize: 72,
    phoneWidth: 420,
    phone: { position: 'absolute', top: 102, left: 1250 },
    enter: 'right',
    chip: { position: 'absolute', top: 640, left: 150, display: 'flex' },
    qrModule: 13,
  },
};

const S = (a: number) => sec(a);
const dur = (r: readonly [number, number]) => sec(r[1] - r[0]);

export function FangpunktVideo({ format }: { format: Format }) {
  const L = LAYOUTS[format];
  const tx = cfg.texts;
  return (
    <AbsoluteFill style={{ background: C.deep }}>
      {/* Szene 1 – Leidenschaft */}
      <Sequence durationInFrames={dur(T.hook) + 15}>
        <Footage clip={clips.lake} label="Morgennebel am See, Angler am Ufer" duration={dur(T.hook) + 15} />
        <Caption text={tx.hook} from={12} to={dur(T.hook) + 4} size={L.captionSize} style={L.caption} />
      </Sequence>

      {/* Szene 2 – App entdecken: echte Suche und Kartenflug */}
      <Sequence from={S(T.discover[0])} durationInFrames={dur(T.discover)}>
        <BrandBackground fadeIn />
        <PhoneStage L={L} enterAt={0}>
          <Screen src={cfg.screens.flight} startFrom={sec(0.8)} />
        </PhoneStage>
        <DemoNote L={L} />
        <Caption text={tx.discover} from={10} to={dur(T.discover)} size={L.captionSize} style={L.caption} />
      </Sequence>

      {/* Szene 3 – Funktionen */}
      <Sequence from={S(T.features[0])} durationInFrames={dur(T.features)}>
        <BrandBackground />
        <Features L={L} />
        <Caption text={tx.featuresClaim} from={0} to={dur(T.features)} size={L.captionSize * 0.82} style={L.caption} />
      </Sequence>

      {/* Szene 4 – Fangmoment, dann der echte Fangbuch-Eintrag */}
      <Sequence from={S(T.story[0])} durationInFrames={dur(T.story)}>
        <Sequence durationInFrames={sec(3.3)}>
          <Footage clip={clips.fight} label="Angler im Drill, Rute gebogen" push={[1.04, 1.12]} duration={sec(3.3)} />
        </Sequence>
        <Sequence from={sec(3.2)} durationInFrames={sec(1.6)}>
          <CrossFade>
            <Footage clip={clips.fish} label="Fisch mit nassen Händen über dem Wasser" push={[1.06, 1.0]} duration={sec(1.6)} />
          </CrossFade>
        </Sequence>
        <Sequence from={sec(4.7)}>
          <BrandBackground fadeIn />
          <PhoneStage L={L} enterAt={0}>
            <Screen src={cfg.screens.catchDetail} />
          </PhoneStage>
          <DemoNote L={L} />
        </Sequence>
        <Caption text={tx.story} from={sec(0.8)} to={dur(T.story)} size={L.captionSize} style={L.caption} />
      </Sequence>

      {/* Szene 5 – Marke und QR-Code */}
      <Sequence from={S(T.outro[0])}>
        <Outro format={format} L={L} />
      </Sequence>

      <Sound />
    </AbsoluteFill>
  );
}

function BrandBackground({ fadeIn = false }: { fadeIn?: boolean }) {
  const f = useCurrentFrame();
  const o = fadeIn ? interpolate(f, [0, 12], [0, 1], { extrapolateRight: 'clamp' }) : 1;
  return (
    <AbsoluteFill
      style={{
        opacity: o,
        background: `radial-gradient(90% 60% at 50% 55%, ${C.primary} 0%, ${C.deep} 70%)`,
      }}
    />
  );
}

function CrossFade({ children, frames = 8 }: { children: React.ReactNode; frames?: number }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, frames], [0, 1], { extrapolateRight: 'clamp' }) }}>{children}</AbsoluteFill>;
}

/** Handy fährt weich herein und schwebt danach ganz leicht. */
function PhoneStage({ L, enterAt, children, tilt = 0 }: { L: Layout; enterAt: number; children: React.ReactNode; tilt?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - enterAt, fps, config: { damping: 18, stiffness: 90, mass: 0.9 } });
  const off = (1 - s) * (L.enter === 'bottom' ? 900 : 800);
  const float = Math.sin(f / 45) * 6;
  const transform = L.enter === 'bottom' ? `translateY(${off + float}px)` : `translate(${off}px, ${float}px)`;
  return (
    <div style={{ ...L.phone, transform: `${transform} rotate(${tilt}deg)` }}>
      <Phone width={L.phoneWidth}>{children}</Phone>
    </div>
  );
}

/** Vier echte Funktionen nacheinander; die Bildschirme wechseln wie in der App seitlich. */
function Features({ L }: { L: Layout }) {
  const f = useCurrentFrame();
  const tx = cfg.texts;
  const beats = [
    { src: cfg.screens.spots, label: tx.featureSpots },
    { src: cfg.screens.catchForm, label: tx.featureCatch },
    { src: cfg.screens.weather, label: tx.featureWeather },
    { src: cfg.screens.stats, label: tx.featureStats },
  ];
  const len = dur(T.features) / beats.length;
  const i = Math.min(beats.length - 1, Math.floor(f / len));
  const local = f - i * len;
  const slide = (k: number) => {
    const p = interpolate(f - k * len, [0, 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    return k === 0 ? 0 : p * 100;
  };
  const tilt = interpolate(f, [0, dur(T.features)], [-1.5, 1.5]);
  return (
    <>
      <div style={{ ...L.phone, transform: `translateY(${Math.sin(f / 45) * 6}px) rotate(${tilt}deg)` }}>
        <Phone width={L.phoneWidth}>
          {beats.map((b, k) =>
            k <= i && k >= i - 1 ? (
              <div key={b.src} style={{ position: 'absolute', inset: 0, transform: `translateX(${k === i ? slide(k) : slide(i) - 100}%)` }}>
                <Screen src={b.src} />
              </div>
            ) : null,
          )}
        </Phone>
      </div>
      <div style={L.chip}>
        <FeatureChip key={i} text={beats[i]!.label} index={i} local={local} />
      </div>
      <DemoNote L={L} />
    </>
  );
}

function FeatureChip({ text, index, local }: { text: string; index: number; local: number }) {
  const o = interpolate(local, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(local, [0, 10], [10, 0], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        opacity: o,
        transform: `translateY(${y}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        font: `600 34px ${FONT_UI}`,
        color: C.deep,
        background: C.accent,
        borderRadius: 999,
        padding: '12px 28px 12px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      }}
    >
      <span style={{ width: 40, height: 40, borderRadius: 999, background: C.deep, color: C.accent, display: 'grid', placeItems: 'center', fontSize: 22 }}>{index + 1}</span>
      {text}
    </div>
  );
}

function DemoNote({ L }: { L: Layout }) {
  const pos: CSSProperties = L.enter === 'bottom' ? { position: 'absolute', top: 1830, left: 0, right: 0, display: 'flex', justifyContent: 'center' } : { position: 'absolute', top: 1022, left: 0, right: 0, display: 'flex', justifyContent: 'center' };
  return (
    <div style={pos}>
      <span style={demoNoteStyle}>{demoNote}</span>
    </div>
  );
}

function Outro({ format, L }: { format: Format; L: Layout }) {
  const f = useCurrentFrame();
  const tx = cfg.texts;
  const qrAt = sec(T.qrStill - T.outro[0]); // ab hier steht alles still
  const fade = (a: number, b: number) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logo = interpolate(f, [0, sec(1.4)], [0, 1], { extrapolateRight: 'clamp' });
  const vertical = format === 'vertical';
  const brand = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: vertical ? 'center' : 'flex-start', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <FishLogo size={vertical ? 150 : 170} progress={logo} />
        <div style={{ font: `650 ${vertical ? 104 : 120}px/1 ${FONT_DISPLAY}`, color: C.fish, opacity: fade(sec(0.5), sec(1)) }}>{cfg.appName}</div>
      </div>
      <div style={{ font: `500 ${vertical ? 40 : 44}px/1.3 ${FONT_UI}`, color: C.ripple, opacity: fade(sec(1), sec(1.6)), textAlign: vertical ? 'center' : 'left', maxWidth: vertical ? 900 : 760, textWrap: 'balance' }}>
        {tx.slogan}
      </div>
    </div>
  );
  const qrBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: fade(qrAt - sec(1), qrAt) }}>
      <div style={{ padding: 0, borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <QrCode module={L.qrModule} />
      </div>
      <div style={{ font: `650 ${vertical ? 46 : 44}px ${FONT_UI}`, color: '#fff' }}>{tx.cta}</div>
      <div style={{ font: `500 ${vertical ? 28 : 26}px ${FONT_UI}`, color: 'rgba(232,244,245,0.75)' }}>{cfg.targetUrl.replace(/^https:\/\//, '').replace(/\/$/, '')}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: `radial-gradient(80% 55% at 50% 50%, #12404b 0%, ${C.deep} 75%)` }}>
      {vertical ? (
        <AbsoluteFill style={{ alignItems: 'center', paddingTop: 230, gap: 80 }}>
          {brand}
          {qrBlock}
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 170px' }}>
          {brand}
          {qrBlock}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

/** Ton: eigene Musik (leise, unter dem Sprecher abgesenkt), Naturgeräusche, Sprecher, wenige Effekte. */
function Sound() {
  const vo = voiceover.map((v) => [sec(v.at), sec(v.at + v.durationS)] as const);
  const speaking = (f: number) => vo.some(([a, b]) => f >= a - 6 && f <= b + 6);
  const music = (f: number) => (speaking(f) ? 0.09 : 0.16) * interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const amb = (f: number) =>
    interpolate(f, [0, sec(4.5), sec(5.5), sec(23.5), sec(24), sec(30), sec(33)], [0.45, 0.45, 0.12, 0.12, 0.4, 0.3, 0.05], { extrapolateRight: 'clamp' });
  const fx = (file: string, at: number, volume = 0.5) => (
    <Sequence key={`${file}${at}`} from={sec(at)}>
      <Audio src={staticFile(`graphics/${file}`)} volume={volume} />
    </Sequence>
  );
  const beat = (T.features[1] - T.features[0]) / 4;
  return (
    <>
      <Audio src={staticFile('music/music.wav')} volume={music} />
      <Audio src={staticFile('music/ambience.wav')} volume={amb} />
      {voiceover.map((v) => (
        <Sequence key={v.id} from={sec(v.at)}>
          <Audio src={staticFile(`voiceover/${v.id}.wav`)} volume={1} />
        </Sequence>
      ))}
      {fx('sfx-whoosh.wav', T.discover[0] - 0.3, 0.35)}
      {fx('sfx-tap.wav', T.discover[0] + 3.1, 0.45)}
      {[0, 1, 2, 3].map((k) => fx('sfx-tap.wav', T.features[0] + k * beat, 0.4))}
      {fx('sfx-splash.wav', T.story[0] + 0.4, 0.45)}
      {fx('sfx-whoosh.wav', T.outro[0] - 0.3, 0.35)}
    </>
  );
}

// Zeichnet den Hecht (Vorschau freigegeben 2026-11-06) im Illustrationsstil auf ein Canvas: kräftige dunkle
// Kontur, olivgrüner Körper, heller Bauch, helle Flecken, Flossen olivbraun (bewusst nicht golden).
// Koordinaten: Seitenansicht, Kopf nach +x, Länge 100. Form/Welle rein in domain/pikeSwim.ts.
import { bodyWave, PIKE_BOTTOM, PIKE_SPOTS, PIKE_TOP, profileAt } from '../../domain/pikeSwim';

// Feste Illustrationsfarben (wie ein Bild, in hell und dunkel gleich)
const C = {
  outline: '#16220f',
  back: '#2a4020',
  flank: '#5b7a2c',
  low: '#a3ad5c',
  belly: '#efe8c6',
  spot: '#f0df8c',
  fin: '#5f6a2a',
  finLight: '#87894a',
  finRay: 'rgba(30,35,12,0.55)',
  eye: '#d2a63c',
  mouth: '#1a1408',
};
const LW = 1.25;

type P = readonly [number, number];

function smoothPath(ctx: CanvasRenderingContext2D, pts: readonly P[]) {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return;
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a && b) ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  ctx.lineTo(last[0], last[1]);
  ctx.closePath();
}

function fin(ctx: CanvasRenderingContext2D, pts: readonly P[], rays: readonly (readonly [P, P])[] = []) {
  const a = pts[0];
  const m = pts[Math.floor(pts.length / 2)];
  if (!a || !m) return;
  ctx.beginPath();
  smoothPath(ctx, pts);
  const g = ctx.createLinearGradient(a[0], a[1], m[0], m[1]);
  g.addColorStop(0, C.fin);
  g.addColorStop(1, C.finLight);
  ctx.fillStyle = g;
  ctx.fill();
  if (rays.length) {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = C.finRay;
    ctx.lineWidth = 0.45;
    for (const [p, q] of rays) {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = LW;
  ctx.beginPath();
  smoothPath(ctx, pts);
  ctx.stroke();
}

/** `phase`: Fortschritt der Körperwelle (Bogenmaß), `amp`: Stärke, `beat`: Takt von Schwanz und Brustflosse */
export function drawPike(ctx: CanvasRenderingContext2D, phase: number, amp: number, beat: number) {
  const c = (x: number) => bodyWave(x, phase, amp);
  const yt = (x: number) => c(x) - profileAt(PIKE_TOP, x);
  const yb = (x: number) => c(x) + profileAt(PIKE_BOTTOM, x);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Schwanzflosse (gegabelt), schlägt im Takt
  const tc = c(10);
  const f = Math.sin(beat) * 2.8;
  fin(
    ctx,
    [
      [12, tc - 2.6],
      [5, tc - 7.5 + f * 0.6],
      [-1, tc - 12 + f],
      [2.5, tc - 5 + f * 0.6],
      [4.5, tc + f * 0.3],
      [2.5, tc + 5 + f * 0.6],
      [-1, tc + 12 + f],
      [5, tc + 7.5 + f * 0.6],
      [12, tc + 2.6],
    ],
    [
      [
        [11, tc],
        [0, tc - 10 + f],
      ],
      [
        [11, tc],
        [1, tc - 5 + f * 0.6],
      ],
      [
        [11, tc],
        [1, tc + 5 + f * 0.6],
      ],
      [
        [11, tc],
        [0, tc + 10 + f],
      ],
    ],
  );
  // Rücken- und Afterflosse weit hinten (typisch Hecht), Bauchflosse
  fin(
    ctx,
    [
      [18, yt(18) + 0.8],
      [19.5, yt(20) - 5.8],
      [23, yt(23) - 7.4],
      [28, yt(28) - 5.2],
      [31, yt(31) + 0.8],
    ],
    [
      [
        [21, yt(21)],
        [20, yt(20) - 5],
      ],
      [
        [24, yt(24)],
        [23.5, yt(24) - 6.5],
      ],
      [
        [27, yt(27)],
        [27.5, yt(27) - 4.6],
      ],
    ],
  );
  fin(
    ctx,
    [
      [18.5, yb(18.5) - 0.8],
      [20, yb(20) + 5.2],
      [23, yb(23) + 6.4],
      [27.5, yb(27.5) + 4.2],
      [30, yb(30) - 0.8],
    ],
    [
      [
        [21, yb(21)],
        [20.5, yb(21) + 4.6],
      ],
      [
        [24, yb(24)],
        [24, yb(24) + 5.6],
      ],
      [
        [27, yb(27)],
        [27.2, yb(27) + 3.8],
      ],
    ],
  );
  fin(ctx, [
    [45, yb(45) - 0.8],
    [42.5, yb(44) + 5.2],
    [47, yb(47) + 4.6],
    [50, yb(50) - 0.8],
  ]);

  // Körper
  const N = 48;
  const top: P[] = [];
  const bot: P[] = [];
  for (let i = 0; i <= N; i++) {
    const x = 10 + (90 * i) / N;
    top.push([x, yt(x)]);
    bot.push([x, yb(x)]);
  }
  const nose = (yt(100) + yb(100)) / 2;
  const body = () => {
    ctx.beginPath();
    for (const [i, p] of top.entries()) {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.quadraticCurveTo(101.2, nose, 100, yb(100));
    for (let i = N; i >= 0; i--) {
      const p = bot[i];
      if (p) ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
  };
  body();
  const g = ctx.createLinearGradient(0, -10, 0, 10);
  g.addColorStop(0, C.back);
  g.addColorStop(0.38, C.flank);
  g.addColorStop(0.68, C.low);
  g.addColorStop(0.86, C.belly);
  g.addColorStop(1, C.belly);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = C.spot;
  for (const [x, rel, s, rot] of PIKE_SPOTS) {
    const h = rel < 0 ? profileAt(PIKE_TOP, x) : profileAt(PIKE_BOTTOM, x);
    ctx.beginPath();
    ctx.ellipse(x, c(x) + rel * h, 1.35 * s, 0.7 * s, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  // Kopf etwas dunkler, Glanz auf dem Rücken, Kiemendeckel
  ctx.fillStyle = 'rgba(20,30,12,0.18)';
  ctx.beginPath();
  ctx.ellipse(91, c(91) - 1.2, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,230,0.28)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let x = 30; x <= 80; x += 2) {
    if (x === 30) ctx.moveTo(x, yt(x) + 1.6);
    else ctx.lineTo(x, yt(x) + 1.6);
  }
  ctx.stroke();
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = LW * 0.8;
  ctx.beginPath();
  ctx.moveTo(81, yt(81) + 1.5);
  ctx.quadraticCurveTo(77, c(79) + 1, 80.5, yb(80.5) - 0.6);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = LW;
  body();
  ctx.stroke();

  // Brustflosse paddelt
  const pc = c(75);
  const pd = Math.sin(beat * 1.3) * 1.3;
  fin(ctx, [
    [77, pc + 2.4],
    [72, pc + 5.6 + pd],
    [67.5, pc + 7 + pd],
    [70.5, pc + 4],
    [75.5, pc + 1.2],
  ]);

  // Maul (Entenschnabel), Nasenloch, Auge mit Glanzpunkt
  const mc = c(95);
  ctx.strokeStyle = C.mouth;
  ctx.lineWidth = LW * 0.85;
  ctx.beginPath();
  ctx.moveTo(100.6, mc + 0.2);
  ctx.quadraticCurveTo(94, mc + 0.9, 87, mc + 0.6);
  ctx.stroke();
  ctx.fillStyle = C.mouth;
  ctx.beginPath();
  ctx.arc(95.5, yt(95.5) + 1.1, 0.35, 0, Math.PI * 2);
  ctx.fill();
  const ex = 87.3;
  const ey = c(87) - 2.2;
  ctx.fillStyle = C.eye;
  ctx.beginPath();
  ctx.arc(ex, ey, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = LW * 0.7;
  ctx.stroke();
  ctx.fillStyle = '#0d0d0b';
  ctx.beginPath();
  ctx.arc(ex + 0.4, ey + 0.1, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(ex + 0.85, ey - 0.45, 0.42, 0, Math.PI * 2);
  ctx.fill();
}

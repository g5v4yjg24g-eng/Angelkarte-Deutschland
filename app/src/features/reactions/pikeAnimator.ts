// Zeichenschleife für den Hecht (requestAnimationFrame) – außerhalb von React, damit Abbrechen und Aufräumen
// einfach bleiben. Höchstens drei Hechte gleichzeitig; danach steht nichts mehr auf der Zeichenfläche.
import { ARRIVE_MS, RING_MS, swimPose, type SwimPath } from '../../domain/pikeSwim';
import { drawPike } from './drawPike';

interface Swimmer {
  path: SwimPath;
  t0: number;
  rings: { x: number; y: number; t0: number }[];
  arrived: boolean;
}

export class PikeAnimator {
  private swimmers: Swimmer[] = [];
  private raf = 0;
  private canvas: HTMLCanvasElement | undefined;

  constructor(private readonly onArrive: () => void) {}

  /** Zeichenfläche an die Rahmengröße anpassen und einen Hecht starten */
  play(canvas: HTMLCanvasElement, width: number, height: number, path: SwimPath) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    this.canvas = canvas;
    const now = performance.now();
    this.swimmers = [
      ...this.swimmers.slice(-2),
      { path, t0: now, rings: [{ ...path.start, t0: now }], arrived: false },
    ];
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.swimmers = [];
    const cv = this.canvas;
    cv?.getContext('2d')?.clearRect(0, 0, cv.width, cv.height);
  }

  private frame = (now: number) => {
    const cv = this.canvas;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || !cv.isConnected) {
      this.raf = 0;
      this.swimmers = [];
      return;
    }
    const dpr = cv.width / Math.max(1, cv.clientWidth);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
    this.swimmers = this.swimmers.filter((s) => {
      const ms = now - s.t0;
      for (const r of s.rings) {
        const k = (now - r.t0) / RING_MS;
        if (k < 0 || k > 1) continue;
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k)})`;
        ctx.lineWidth = 2 * (1 - k) + 0.5;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, 6 + k * 26, (6 + k * 26) * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!s.arrived && ms >= ARRIVE_MS) {
        s.arrived = true;
        s.rings.push({ x: s.path.end.x, y: s.path.end.y, t0: now });
        this.onArrive();
      }
      const pose = swimPose(s.path, ms);
      if (!pose.done) {
        const beat = (ms / 1000) * Math.PI * 2 * 3.2 * pose.beat;
        ctx.save();
        ctx.globalAlpha = pose.alpha;
        ctx.translate(pose.x, pose.y);
        ctx.rotate(pose.heading);
        if (Math.cos(pose.heading) < 0) ctx.scale(1, -1); // Rücken bleibt oben
        const k = (s.path.size / 100) * pose.scale;
        ctx.scale(k, k);
        ctx.translate(-50, 0);
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        drawPike(ctx, beat, 1.6 * pose.beat, beat);
        ctx.restore();
      }
      return !pose.done || s.rings.some((r) => now - r.t0 < RING_MS);
    });
    this.raf = this.swimmers.length ? requestAnimationFrame(this.frame) : 0;
    if (!this.raf) ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
  };
}

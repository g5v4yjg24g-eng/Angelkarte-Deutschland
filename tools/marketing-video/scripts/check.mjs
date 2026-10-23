// Technische Prüfung eines gerenderten Videos: Abmessungen, Dauer, Tonspur, Lautheit, QR-Code in mehreren
// Einzelbildern (dekodieren + mit der Ziel-URL vergleichen) und Stillstand des QR-Bereichs.
// Aufruf: pnpm check output/<datei>.mp4 [Breite Höhe] [--qr-from=<s>] [--min=<s>] [--max=<s>]
// Erklärvideo: --qr-from aus hyperframes-tutorial/timing.txt („QR unbewegt ab“), --min=55 --max=80
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodePng } from './decode.mjs';

const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [file, w = '1080', h = '1920'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!file) throw new Error('Aufruf: pnpm check <video.mp4> [Breite Höhe]');
const root = new URL('..', import.meta.url);
const { targetUrl } = JSON.parse(readFileSync(new URL('video.config.json', root), 'utf8'));
const QR_FROM = Number(opt['qr-from'] ?? 33); // Standard muss zu T.qrStill in src/config.ts passen
const [MIN, MAX] = [Number(opt.min ?? 35), Number(opt.max ?? 45)];
let ok = true;
const report = (pass, msg) => {
  console.log(`${pass ? '✓' : '✗'} ${msg}`);
  if (!pass) ok = false;
};

const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
const duration = Number(v?.duration ?? probe.format.duration);
report(v && String(v.width) === w && String(v.height) === h, `Abmessungen ${v?.width} × ${v?.height} (erwartet ${w} × ${h})`);
report(duration >= MIN && duration <= MAX, `Dauer ${duration.toFixed(2)} s (erlaubt ${MIN}–${MAX} s)`);
report(v?.codec_name === 'h264' && v?.pix_fmt === 'yuv420p', `Video ${v?.codec_name} ${v?.pix_fmt}, ${v?.r_frame_rate} fps`);
report(!!a, `Tonspur ${a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels} Kanäle` : 'fehlt'}`);

// Vollständig dekodierbar (Fehler beim Lesen bis zum Ende)?
const errs = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
report(errs.trim() === '', 'Datei bis zum Ende ohne Dekodierfehler lesbar');

const loud = execFileSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
void loud;
const summary = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af ebur128=peak=true -f null - 2>&1 | tail -12`], { encoding: 'utf8' });
const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]);
const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1]);
report(lufs >= -18 && lufs <= -11, `Lautheit ${lufs} LUFS integriert (Ziel ≈ −14 für soziale Netzwerke)`);
report(peak <= -1, `Spitzenpegel ${peak} dBFS (≤ −1)`);

const dir = mkdtempSync(join(tmpdir(), 'fangpunkt-check-'));
const times = [QR_FROM + 0.05, (QR_FROM + duration) / 2, duration - 0.1];
const frames = times.map((t, i) => {
  const out = join(dir, `qr-${i}.png`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', out]);
  const text = decodePng(out);
  report(text === targetUrl, `QR bei ${t.toFixed(2)} s dekodiert: ${text ?? 'nicht lesbar'}`);
  return out;
});
// Stillstand: erstes und letztes QR-Bild dürfen sich nur durch Kompressionsrauschen unterscheiden
const diff = execFileSync('sh', ['-c', `ffmpeg -v info -i "${frames[0]}" -i "${frames[2]}" -lavfi psnr -f null - 2>&1 | grep -o 'average:[^ ]*'`], { encoding: 'utf8' }).trim();
const psnr = diff.includes('inf') ? Infinity : Number(diff.split(':')[1]);
report(psnr > 40, `QR-Abschluss unbewegt von ${QR_FROM} s bis zum Ende (PSNR ${diff})`);
console.log(ok ? '\nAlle Prüfungen bestanden.' : '\nMindestens eine Prüfung ist fehlgeschlagen.');
process.exitCode = ok ? 0 : 1;

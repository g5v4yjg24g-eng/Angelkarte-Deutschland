// Endfassung aus dem Remotion-Render: Lautheit auf −14 LUFS (Spitze −1,5 dBTP, zwei Durchgänge),
// Video in Standard-Farbumfang (yuv420p, BT.709), schneller Start im Web (faststart).
// Aufruf: node scripts/finalize.mjs <roh.mp4> <final.mp4>
import { execFileSync } from 'node:child_process';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Aufruf: node scripts/finalize.mjs <roh.mp4> <final.mp4>');
const target = 'I=-14:TP=-1.5:LRA=11';
const first = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${input}" -af loudnorm=${target}:print_format=json -f null - 2>&1`], { encoding: 'utf8' });
const m = JSON.parse(first.slice(first.lastIndexOf('{'), first.lastIndexOf('}') + 1));
const af = `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,alimiter=limit=0.82:level=false:attack=2:release=60`;
execFileSync('ffmpeg', [
  '-v', 'error', '-y', '-i', input,
  '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p',
  '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high',
  '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart', output,
]);
console.log(`✓ ${output} (Lautheit vorher ${m.input_i} LUFS)`);

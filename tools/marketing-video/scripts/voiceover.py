"""Sprechertext aus video.config.json mit Piper (lokal) erzeugen. `say` (optional) ist eine reine
Ausspracheschreibung für die Stimme (z. B. „Spotts"); eingeblendet wird nie `say`, sondern `text`.
Aufruf: python3 scripts/voiceover.py [--speaker N] [--samples]
Stimmen liegen in ~/.piper (siehe README). Ergebnis: assets/voiceover/<id>.wav + voiceover.json (Dauer je Satz)."""
import json, subprocess, sys, wave
from pathlib import Path

root = Path(__file__).resolve().parent.parent
cfg = json.loads((root / 'video.config.json').read_text())
if cfg['voice'].get('engine') == 'elevenlabs':
    sys.exit('Sprecher kommt von ElevenLabs (video.config.json → voice.engine). Neu schneiden mit:\n'
             f"  python3 scripts/split-voiceover.py {cfg['voice']['source']}\n"
             'Für die lokale Piper-Stimme voice.engine auf "piper" setzen.')
voice = cfg['voice']['piper']
model = Path.home() / '.piper' / f"{voice['model']}.onnx"
out = root / 'assets' / 'voiceover'
out.mkdir(parents=True, exist_ok=True)
args = sys.argv[1:]
speaker = int(args[args.index('--speaker') + 1]) if '--speaker' in args else voice.get('speaker')

def synth(text, path, spk):
    cmd = [sys.executable, '-m', 'piper', '-m', str(model), '-f', str(path), '--length-scale', str(voice['lengthScale']),
           '--noise-scale', str(voice.get('noiseScale', 0.667)), '--noise-w-scale', str(voice.get('noiseWScale', 0.8))]
    if spk is not None: cmd += ['--speaker', str(spk)]
    subprocess.run(cmd, input=text.encode(), check=True, capture_output=True)
    with wave.open(str(path)) as w: return w.getnframes() / w.getframerate()

if '--samples' in args:
    # Hörproben verschiedener Sprecher zum Auswählen
    (out / 'samples').mkdir(exist_ok=True)
    for spk in [int(s) for s in args[args.index('--samples') + 1].split(',')]:
        synth(cfg['voiceover'][2]['text'], out / 'samples' / f'speaker-{spk}.wav', spk)
        print('Probe', spk)
    sys.exit()

# Piper klingt bei jedem Durchlauf etwas anders: mehrere Aufnahmen je Satz, die verständlichste bleibt
# (Bewertung per lokaler Spracherkennung, falls faster-whisper installiert ist; sonst die erste).
takes = int(args[args.index('--takes') + 1]) if '--takes' in args else 5
try:
    import re, difflib, numpy as np
    from faster_whisper import WhisperModel
    asr = WhisperModel('small', device='cpu', compute_type='int8')
except ImportError:
    asr, takes = None, 1

def understood(path, text):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    hyp = ''.join(s.text for s in asr.transcribe(audio, language='de', beam_size=5)[0])
    norm = lambda s: re.sub(r'[^a-zäöüß ]', '', s.lower()).split()
    ref = norm(text)
    return sum(b.size for b in difflib.SequenceMatcher(None, ref, norm(hyp)).get_matching_blocks()) / len(ref), hyp.strip()

manifest = {}
for line in cfg['voiceover']:
    target = out / f"{line['id']}.wav"
    best = None
    for k in range(takes):
        tmp = out / f".{line['id']}-take{k}.wav"
        d = synth(line.get('say', line['text']), tmp, speaker)
        score, hyp = understood(tmp, line['text']) if asr else (1.0, '')
        if best is None or score > best[0]:
            if best: best[2].unlink()
            best = (score, d, tmp, hyp)
        else:
            tmp.unlink()
        if score == 1.0:
            break
    best[2].rename(target)
    manifest[line['id']] = round(best[1], 3)
    print(f"{line['id']}: {best[1]:.2f} s" + (f" · {best[0]:.0%} erkannt („{best[3]}“)" if asr else ''))
(out / 'voiceover.json').write_text(json.dumps(manifest, indent=2) + '\n')

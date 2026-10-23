"""Eine durchgehende Sprecheraufnahme (z. B. von ElevenLabs) in die Sätze aus video.config.json teilen.
Aufruf: python3 scripts/split-voiceover.py assets/voiceover/elevenlabs/<datei>.mp3
Die Satzgrenzen kommen aus der Spracherkennung (faster-whisper, Wort-Zeitstempel); geschnitten wird an der
leisesten Stelle zwischen dem letzten Wort eines Satzes und dem ersten des nächsten, mit kurzen Blenden.
Ergebnis: assets/voiceover/<id>.wav und voiceover.json (Dauer je Satz) – wie bei scripts/voiceover.py."""
import json, re, subprocess, sys, wave
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

root = Path(__file__).resolve().parent.parent
cfg = json.loads((root / 'video.config.json').read_text())
src = Path(sys.argv[1])
SR = 48000
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(src), '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768

asr16 = audio[:: SR // 16000]
words = [w for s in WhisperModel('small', device='cpu', compute_type='int8').transcribe(asr16, language='de', beam_size=5, word_timestamps=True)[0] for w in s.words]
count = lambda t: len(re.sub(r'[^\wäöüß ]', ' ', t).split())
lines = cfg['voiceover']
need = sum(count(l['text']) for l in lines)
if len(words) != need:
    sys.exit(f'Erkannt wurden {len(words)} Wörter, der Text hat {need}. Bitte Aufnahme und video.config.json vergleichen.')

def quietest(a, b):
    """Zeitpunkt (s) mit der geringsten Lautstärke (10-ms-Fenster) zwischen a und b."""
    i, j = int(a * SR), max(int(b * SR), int(a * SR) + 480)
    win = 480
    rms = [np.sqrt(np.mean(audio[k : k + win] ** 2)) for k in range(i, j - win + 1, win // 2)]
    return (i + int(np.argmin(rms)) * win // 2 + win // 2) / SR

bounds, k = [], 0
for l in lines:
    n = count(l['text'])
    bounds.append((words[k].start, words[k + n - 1].end))
    k += n
cuts = [0.0] + [quietest(bounds[i][1] - 0.05, bounds[i + 1][0] + 0.05) for i in range(len(bounds) - 1)] + [len(audio) / SR]

out = root / 'assets' / 'voiceover'
manifest = {}
for i, l in enumerate(lines):
    a, b = cuts[i], cuts[i + 1]
    # Stille am Anfang/Ende knapp halten: 80 ms vor dem ersten Wort, 250 ms nach dem letzten
    a = max(a, bounds[i][0] - 0.08)
    b = min(b, bounds[i][1] + 0.25)
    seg = audio[int(a * SR) : int(b * SR)].copy()
    fade = int(0.012 * SR)
    seg[:fade] *= np.linspace(0, 1, fade)
    seg[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(str(out / f"{l['id']}.wav"), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(seg, -1, 1) * 32767).astype(np.int16).tobytes())
    manifest[l['id']] = round(len(seg) / SR, 3)
    print(f"{l['id']}: {a:6.2f}–{b:6.2f} s ({manifest[l['id']]:.2f} s) {l['text']}")
(out / 'voiceover.json').write_text(json.dumps(manifest, indent=2) + '\n')

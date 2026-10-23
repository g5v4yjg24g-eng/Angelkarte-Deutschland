"""Verständlichkeit des Sprechers prüfen: Spracherkennung (faster-whisper, lokal) gegen den Sollsatz.
Aufruf: python3 scripts/asr-check.py   (einmalig: pip install faster-whisper)"""
import json, re, subprocess, difflib
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

root = Path(__file__).resolve().parent.parent
cfg = json.loads((root / 'video.config.json').read_text())
model = WhisperModel('small', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^a-zäöüß ]', '', s.lower()).split()
for v in cfg['voiceover']:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(root / 'assets/voiceover' / f"{v['id']}.wav"), '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    hyp = ''.join(s.text for s in model.transcribe(audio, language='de', beam_size=5)[0]).strip()
    ref = norm(v['text']); sm = difflib.SequenceMatcher(None, ref, norm(hyp))
    hit = sum(b.size for b in sm.get_matching_blocks()) / len(ref)
    print(f"{v['id']}: {hit:.0%} erkannt | „{hyp}“")

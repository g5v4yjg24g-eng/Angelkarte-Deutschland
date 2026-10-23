"""Eigene Musik und Geräusche per Code erzeugen (keine fremden Rechte).
Aufruf: python3 scripts/music.py   → assets/music/music.wav, assets/music/ambience.wav, assets/graphics/sfx-*.wav
Musik: ruhiges Ambient in a-Moll (Am7 – Fmaj7 – C – G), 80 BPM, 42 s, Pad + gezupfte Arpeggios."""
import wave
from pathlib import Path
import numpy as np

SR = 44100
DUR = 42.0
root = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)

def write(path, x):
    path.parent.mkdir(parents=True, exist_ok=True)
    x = np.clip(x, -1, 1)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

def lowpass(x, cutoff):
    # einfacher Einpol-Tiefpass
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc; y[i] = acc
    return y

def hz(note):  # MIDI → Hz
    return 440 * 2 ** ((note - 69) / 12)

n = int(SR * DUR)
t = np.arange(n) / SR
BAR = 3.0  # 4/4 bei 80 BPM
CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]]  # Am7 Fmaj7 C G

# --- Pad: weiche Sinus-Schichten mit leichter Verstimmung, langsamer Einsatz pro Akkord
pad = np.zeros((n, 2))
for b in range(int(DUR / BAR) + 1):
    chord = CHORDS[b % 4] if b < 12 else [48, 55, 60, 64]  # Schluss auf C
    s, e = b * BAR, b * BAR + BAR + 1.5
    m = (t >= s) & (t < e)
    tt = t[m] - s
    env = np.minimum(tt / 1.2, 1) * np.clip((e - t[m]) / 1.5, 0, 1)
    for k, note in enumerate(chord):
        for det, side in ((-0.12, 0), (0.12, 1)):
            f = hz(note) * 2 ** (det / 12)
            pad[m, side] += env * (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)) * 0.05
pad[:, 0] = lowpass(pad[:, 0], 1800); pad[:, 1] = lowpass(pad[:, 1], 1800)

# --- Gezupfte Arpeggios (Karplus-Strong), ab 4,5 s, in Achteln
def pluck(f, length=1.6, bright=0.5):
    N = int(SR / f); buf = rng.uniform(-1, 1, N) * bright
    out = np.empty(int(SR * length))
    for i in range(len(out)):
        out[i] = buf[i % N]
        buf[i % N] = 0.996 * 0.5 * (buf[i % N] + buf[(i + 1) % N])
    return out

arp = np.zeros((n, 2))
step = BAR / 8
pattern = [0, 2, 1, 3, 2, 1, 3, 2]
for b in range(int(DUR / BAR)):
    chord = CHORDS[b % 4] if b < 12 else [48, 55, 60, 64]
    for i, p in enumerate(pattern):
        at = b * BAR + i * step
        if at < 4.5 or at > 36.5:
            continue
        note = chord[p] + 12
        if 24 <= at < 30 and i % 2 == 0:
            note += 12  # Höhepunkt (Fangmoment): eine Oktave höher
        x = pluck(hz(note)) * (0.16 if i % 4 == 0 else 0.11)
        s = int(at * SR); x = x[: n - s]
        pan = 0.5 + 0.3 * np.sin(i)
        arp[s : s + len(x), 0] += x * (1 - pan); arp[s : s + len(x), 1] += x * pan

# --- Tiefer Grundton für Wärme
bass = np.zeros(n)
for b in range(int(DUR / BAR) + 1):
    note = (CHORDS[b % 4][0] if b < 12 else 48) - 12
    m = (t >= b * BAR) & (t < b * BAR + BAR)
    tt = t[m] - b * BAR
    bass[m] += np.sin(2 * np.pi * hz(note) * tt) * np.exp(-tt * 0.6) * 0.09 * np.minimum(tt / 0.05, 1)

music = pad + arp + bass[:, None]
master = np.minimum(t / 1.0, 1) * np.clip((DUR - t) / 4.0, 0, 1)  # Ein- und Ausblenden
music *= master[:, None]
music /= np.abs(music).max() / 0.7
write(root / 'assets/music/music.wav', music)

# --- Natur: Wasserplätschern (gefiltertes Rauschen mit langsamer Welle) + vereinzelte Vogelrufe
noise = rng.normal(0, 1, n)
water = lowpass(noise, 600) - lowpass(noise, 120)
water *= 0.5 + 0.5 * np.sin(2 * np.pi * 0.35 * t + np.sin(2 * np.pi * 0.11 * t) * 2) ** 2
amb = np.stack([water, np.roll(water, 900)], 1) * 0.9
def bird(at, f0=3800, pan=0.3):
    L = 0.12; tt = np.arange(int(L * SR)) / SR
    f = f0 + 1400 * np.sin(np.pi * tt / L)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / L) ** 2 * 0.12
    s = int(at * SR); amb[s : s + len(x), 0] += x * (1 - pan); amb[s : s + len(x), 1] += x * pan
for at, f0, pan in [(0.9, 3600, 0.2), (1.05, 3900, 0.2), (2.6, 4200, 0.8), (2.75, 4000, 0.8), (3.9, 3500, 0.4), (25.2, 4100, 0.7), (25.35, 3800, 0.7), (27.9, 3600, 0.3)]:
    bird(at, f0, pan)
amb *= (np.minimum(t / 0.3, 1) * np.clip((DUR - t) / 3, 0, 1))[:, None]
amb /= np.abs(amb).max() / 0.5
write(root / 'assets/music/ambience.wav', amb)

# --- Kurze Geräusche
def env_noise(L, cutoff, decay):
    tt = np.arange(int(L * SR)) / SR
    return lowpass(rng.normal(0, 1, len(tt)), cutoff) * np.exp(-tt * decay)
tap = env_noise(0.06, 4000, 90) * 0.6
write(root / 'assets/graphics/sfx-tap.wav', tap / np.abs(tap).max() * 0.5)
L = 0.7; tt = np.arange(int(L * SR)) / SR
sweep = lowpass(rng.normal(0, 1, len(tt)), 1500) * np.sin(np.pi * tt / L) ** 2
write(root / 'assets/graphics/sfx-whoosh.wav', sweep / np.abs(sweep).max() * 0.35)
splash = env_noise(0.9, 2500, 5) + 0.5 * env_noise(0.9, 800, 3)
write(root / 'assets/graphics/sfx-splash.wav', splash / np.abs(splash).max() * 0.5)
print('✓ Musik, Natur und Geräusche erzeugt')

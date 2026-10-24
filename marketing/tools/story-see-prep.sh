#!/usr/bin/env bash
# Bereitet die See-Aufnahme des Nutzers (iPhone, HDR/HLG, HEVC, Querformat) für die Story vor:
# HDR → SDR (Tonemapping), Kompressionsblöcke glätten, 9:16 aus der Mitte, 30 fps, vorwärts + rückwärts (20 s, nahtlos).
# Aufruf (Repo-Root): bash marketing/tools/story-see-prep.sh <Originaldatei.mov>
# Ergebnis: marketing/videos/story-see/assets/see.mp4 (nicht im Repository)
set -euo pipefail
src="$1"
out="$(dirname "$0")/../videos/story-see/assets/see.mp4"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

tonemap="zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
# Die Quelle ist stark komprimiert (ca. 4,6 Mbit/s): Blöcke im Himmel entblocken, Bänder glätten, leichtes Korn gegen neue Bänder
cleanup="deblock=filter=strong:block=16:alpha=0.12:beta=0.07:gamma=0.06:delta=0.05,hqdn3d=3:2:0:0,gradfun=6:24,eq=contrast=1.04:saturation=1.15,noise=alls=2:allf=t"
crop="fps=30,crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920:flags=lanczos"

# Ton ist Apple-Raumklang (apac) und wird von ffmpeg nicht gelesen → ohne Ton (Musik in Instagram dazulegen)
ffmpeg -loglevel error -y -i "$src" -an -vf "$tonemap,$cleanup,$crop" -c:v libx264 -preset slow -crf 16 "$tmp/fwd.mp4"
ffmpeg -loglevel error -y -i "$tmp/fwd.mp4" -filter_complex "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0" \
  -c:v libx264 -preset slow -crf 16 -movflags +faststart "$out"
echo "$out"

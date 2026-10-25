#!/usr/bin/env bash
# Schneidet aus den beiden Steg-Aufnahmen des Nutzers (iPhone, 4K HDR/HLG, 60 fps, Hochformat; Dropbox
# /Mobilgeräte-Uploads/Fangpunkt/Rohdatei) die Stellen für die Clips heraus und wandelt sie in 1080 × 1920 SDR, 30 fps.
# Aufruf (Repo-Root): bash marketing/tools/clips-steg-prep.sh <Ordner mit video-1153.mov und video-1159.mov>
# Ergebnis: marketing/videos/clips-steg/assets/*.mp4 (nicht im Repository)
set -euo pipefail
src="$1"
out="$(cd "$(dirname "$0")/.." && pwd)/videos/clips-steg/assets"
mkdir -p "$out"

tonemap="zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,eq=contrast=1.05:saturation=1.12"

# Index der AAC-Tonspur (die zweite Spur ist Apple-Raumklang, den ffmpeg nicht lesen kann)
aac() { ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$1" | grep -n aac | head -1 | cut -d: -f1 | awk '{print $1-1}'; }

# name quelle start dauer filter-vor-tonemap filter-nach-tonemap ton(ja/nein)
cut_clip() {
  local name=$1 file="$src/video-$2.mov" ss=$3 t=$4 pre=$5 post=$6 sound=$7
  local vf="${pre:+$pre,}$tonemap,$post"
  if [ "$sound" = ja ]; then
    ffmpeg -loglevel error -y -ss "$ss" -t "$t" -i "$file" -map 0:v:0 -map "0:a:$(aac "$file")" -vf "$vf" \
      -c:v libx264 -preset slow -crf 16 -c:a aac -b:a 160k -movflags +faststart "$out/$name.mp4"
  else
    ffmpeg -loglevel error -y -ss "$ss" -t "$t" -i "$file" -an -vf "$vf" \
      -c:v libx264 -preset slow -crf 16 -movflags +faststart "$out/$name.mp4"
  fi
  echo "$out/$name.mp4"
}

full="scale=1080:1920:flags=lanczos,fps=30"
# Zoom 1,6× auf den Angler (Mitte etwa x 57 %, y 37 % des 4K-Bildes)
zoom="crop=1350:2400:556:220,scale=1080:1920:flags=lanczos"

# 1 Ankommen: läuft von der Kamera auf den Steg hinaus
cut_clip ankommen 1153 24.5 7 "" "$full" ja
# 2 Der Wurf: Überkopfwurf, Zeitlupe 0,5× (60 fps → 30 fps, jedes Bild bleibt erhalten)
cut_clip wurf 1159 426.8 5.6 "setpts=2*PTS" "$zoom,fps=30" nein
# 3 Pause: hinsetzen
cut_clip pause 1159 440.5 11 "" "$full" ja
# 4 Schneidertag: 7 Minuten Werfen und Einkurbeln als Zeitraffer (60×)
cut_clip zeitraffer 1159 0 420 "select='not(mod(n\,60))',setpts=N/30/TB" "$full" nein
# 5 Feierabend: kommt nach dem letzten Wurf zur Kamera zurück
cut_clip feierabend 1153 252.5 7 "" "$full" ja
# 6 Hintergrund für das Sonntags-Intro: sitzt am Steg, viel Himmel
cut_clip sonntag 1159 488 8 "" "$full" nein

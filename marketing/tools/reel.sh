#!/usr/bin/env bash
# Baut das Slideshow-Reel „Fangpunkt in fünf Bildern“ (1080×1920, 30 fps, H.264, ohne Ton)
# aus den 9:16-Karussellbildern (render.mjs) und der Schluss-Karte. Musik in der Plattform-App dazulegen.
# Aufruf (Repo-Root): bash marketing/tools/reel.sh
set -euo pipefail
cd "$(dirname "$0")/.."

frames=(videos/_frames/02-app-uebersicht-k{1..6}.png brand/schlusskarte-1080x1920.png)
hold=(3.2 2.8 2.8 2.8 2.8 2.8 2.4) # Sekunden je Bild (inkl. Überblendung)
fade=0.4
out=videos/reel-fuenf-bilder-1080x1920.mp4

inputs=()
for i in "${!frames[@]}"; do inputs+=(-loop 1 -t "${hold[$i]}" -i "${frames[$i]}"); done

# Überblendungen verketten; Versatz = Summe der bisherigen Dauern minus Überblendungen
filter="[0:v]format=yuv420p,setsar=1[v0];"
offset=0
for ((i = 1; i < ${#frames[@]}; i++)); do
  offset=$(echo "$offset + ${hold[$((i - 1))]} - $fade" | bc)
  filter+="[$i:v]format=yuv420p,setsar=1[s$i];[v$((i - 1))][s$i]xfade=transition=fade:duration=$fade:offset=$offset[v$i];"
done
last=$((${#frames[@]} - 1))

ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "${filter%;}" -map "[v$last]" \
  -r 30 -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart "$out"
echo "$out"

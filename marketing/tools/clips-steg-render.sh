#!/usr/bin/env bash
# Rendert alle Steg-Clips mit HyperFrames (per npx, Telemetrie vorher ausschalten: npx hyperframes telemetry disable).
# Voraussetzung: tools/clips-steg-prep.sh und tools/clips-steg-build.mjs gelaufen.
# Aufruf (Repo-Root): bash marketing/tools/clips-steg-render.sh [Szene …]   → marketing/videos/clips-steg-<szene>-1080x1920.mp4
set -euo pipefail
cd "$(dirname "$0")/../videos/clips-steg"
hf="${HYPERFRAMES:-npx --yes hyperframes@0.8.189}"
# In der Cloud-Umgebung den vorinstallierten Headless-Chromium verwenden
[ -x /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell ] &&
  export PRODUCER_HEADLESS_SHELL_PATH=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
scenes=("$@")
[ ${#scenes[@]} -eq 0 ] && scenes=($(ls szenen | sed 's/\.html$//'))
trap 'rm -f index.html' EXIT
for s in "${scenes[@]}"; do
  cp "szenen/$s.html" index.html
  $hf render -q high -f 30 --video-frame-format png -o "../clips-steg-$s-1080x1920.mp4" 2>&1 | grep -E "MB|rror" || true
done

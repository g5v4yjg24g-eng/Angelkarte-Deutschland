#!/usr/bin/env bash
# Rendert alle „Clip trifft App“-Clips mit HyperFrames (per npx, Telemetrie vorher ausschalten: npx hyperframes telemetry disable).
# Voraussetzung: App-Aufnahme (z. B. tools/record-pause.mjs) und Ausschnitt assets/steg-pause.mp4 (aus tools/clips-steg-prep.sh) vorhanden.
# Aufruf (Repo-Root): bash marketing/tools/clips-app-render.sh [Szene …]   → marketing/videos/clips-app-<szene>-1080x1920.mp4
set -euo pipefail
cd "$(dirname "$0")/../videos/clips-app"
hf="${HYPERFRAMES:-npx --yes hyperframes@0.8.189}"
# In der Cloud-Umgebung den vorinstallierten Headless-Chromium verwenden
[ -x /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell ] &&
  export PRODUCER_HEADLESS_SHELL_PATH=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
scenes=("$@")
[ ${#scenes[@]} -eq 0 ] && scenes=($(ls szenen | sed 's/\.html$//'))
trap 'rm -f index.html' EXIT
for s in "${scenes[@]}"; do
  cp "szenen/$s.html" index.html
  $hf render -q high -f 30 --video-frame-format png -o "../clips-app-$s-1080x1920.mp4" 2>&1 | grep -E "MB|rror" || true
done

#!/usr/bin/env bash
# Renders slide frames (Swift) + assembles 3-minute MP4 with FFmpeg.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEMO="$ROOT/demo"
FRAMES="$DEMO/frames"
OUTPUT="$DEMO/cup-pulse-demo.mp4"

mkdir -p "$FRAMES"

swift "$ROOT/scripts/render-demo-frames.swift" "$ROOT"

TIMES=(16 34 29 24 29 24 24)
TOTAL=0
for t in "${TIMES[@]}"; do TOTAL=$((TOTAL + t)); done
echo "Total scene time: ${TOTAL}s"

ffmpeg -y \
  -loop 1 -t "${TIMES[0]}" -i "$FRAMES/splash.png" \
  -loop 1 -t "${TIMES[1]}" -i "$FRAMES/overview.png" \
  -loop 1 -t "${TIMES[2]}" -i "$FRAMES/maya.png" \
  -loop 1 -t "${TIMES[3]}" -i "$FRAMES/peers.png" \
  -loop 1 -t "${TIMES[4]}" -i "$FRAMES/prediction.png" \
  -loop 1 -t "${TIMES[5]}" -i "$FRAMES/jordan.png" \
  -loop 1 -t "${TIMES[6]}" -i "$FRAMES/outro.png" \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v][5:v][6:v]concat=n=7:v=1:a=0,format=yuv420p" \
  -c:v libx264 -preset medium -crf 23 -movflags +faststart \
  "$OUTPUT" -loglevel warning

echo ""
echo "Demo video saved: $OUTPUT"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT" | awk '{printf "Duration: %.0fs\n", $1}'
du -h "$OUTPUT" | awk '{print "Size: " $1}'

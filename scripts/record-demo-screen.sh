#!/usr/bin/env bash
# Records your real screen for 3 minutes (requires Screen Recording permission for Terminal).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="$ROOT/demo/cup-pulse-demo-live.mp4"
DURATION=180

mkdir -p "$ROOT/demo"

echo "Recording screen for ${DURATION}s..."
echo "Switch to your Cup Pulse windows now."
sleep 3

# macOS: capture main display (index 1). Adjust if needed after: ffmpeg -f avfoundation -list_devices true -i ""
ffmpeg -y \
  -f avfoundation \
  -capture_cursor 1 \
  -framerate 30 \
  -i "1:none" \
  -t "$DURATION" \
  -c:v libx264 \
  -preset fast \
  -crf 23 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  "$OUTPUT"

echo "Saved: $OUTPUT"

#!/usr/bin/env bash
# UI screenshots via Chrome + FFmpeg concat (run in Terminal.app on your Mac).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/record-demo-ffmpeg.sh.bak-ui" 2>/dev/null || {
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  DEMO="$ROOT/demo"
  FRAMES="$DEMO/frames"
  OUTPUT="$DEMO/cup-pulse-demo-ui.mp4"
  PORT=8765
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

  mkdir -p "$FRAMES"
  cd "$ROOT"
  python3 -m http.server "$PORT" >/tmp/cup-pulse-http.log 2>&1 &
  HTTP_PID=$!
  trap 'kill $HTTP_PID 2>/dev/null || true' EXIT
  sleep 1

  for scene in splash overview maya peers prediction jordan outro; do
    "$CHROME" --headless=new --disable-gpu --window-size=1280,900 \
      --screenshot="$FRAMES/${scene}.png" \
      "http://127.0.0.1:${PORT}/demo/recording.html#${scene}"
    echo "Captured $scene"
  done

  TIMES=(15 35 30 25 30 25 20)
  SCENES=(splash overview maya peers prediction jordan outro)
  : >"$DEMO/concat.txt"
  for i in "${!SCENES[@]}"; do
    echo "file '$FRAMES/${SCENES[$i]}.png'" >>"$DEMO/concat.txt"
    echo "duration ${TIMES[$i]}" >>"$DEMO/concat.txt"
  done
  echo "file '$FRAMES/outro.png'" >>"$DEMO/concat.txt"

  ffmpeg -y -f concat -safe 0 -i "$DEMO/concat.txt" \
    -vf "scale=1280:900,format=yuv420p" -c:v libx264 -crf 23 -movflags +faststart \
    -t 180 "$OUTPUT"
  echo "Saved: $OUTPUT"
}

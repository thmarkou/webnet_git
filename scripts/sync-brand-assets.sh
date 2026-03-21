#!/usr/bin/env bash
# Αναδημιουργεί icon, splash, favicon και Android foreground από assets/webnet.jpeg (macOS: sips).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/assets"
JPEG="$ASSETS/webnet.jpeg"
if [[ ! -f "$JPEG" ]]; then
  echo "Λείπει το $JPEG — βάλε εκεί το logo (τετράγωνο, ιδανικά 1024×1024)."
  exit 1
fi
cd "$ASSETS"
sips -s format png webnet.jpeg --out icon.png
cp icon.png splash-icon.png
cp icon.png android-icon-foreground.png
sips -Z 48 icon.png --out favicon.png
echo "OK: icon.png, splash-icon.png, favicon.png, android-icon-foreground.png"

#!/usr/bin/env bash
# Browser checks for Personal IO. Needs Python Playwright with Chromium.
# Usage (from the repo root): bash tests/e2e/run_all.sh
cd "$(dirname "$0")/../.." || exit 1
python3 -c "from PIL import Image; Image.new('RGB',(900,1200),(230,140,60)).save('tests/e2e/out/pic.jpg')" 2>/dev/null \
  || { mkdir -p tests/e2e/out && python3 -c "from PIL import Image; Image.new('RGB',(900,1200),(230,140,60)).save('tests/e2e/out/pic.jpg')"; }
python3 -m http.server 8765 >/dev/null 2>&1 &
SERVER=$!
sleep 1
FAIL=0
for t in tests/e2e/*.py; do
  OUTPUT=$(python3 "$t" 2>&1)
  if echo "$OUTPUT" | grep -qE "Traceback|Error:|PAGE ERRORS \[.+\]|errors \[.+\]"; then
    echo "FAIL $t"; echo "$OUTPUT" | tail -15; FAIL=1
  else
    echo "ok   $t"
  fi
done
kill $SERVER 2>/dev/null
exit $FAIL

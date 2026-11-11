#!/usr/bin/env bash
# docs/04 §4.2: the unit and integration suites must pass identically in every server zone.
set -euo pipefail
for zone in UTC Africa/Kampala America/Los_Angeles Pacific/Kiritimati; do
  echo "── TZ=${zone}"
  TZ="${zone}" npx vitest run --project unit --project integration --reporter=dot
done

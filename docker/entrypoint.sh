#!/bin/sh
# Boot: apply pending migrations (retrying while Postgres comes up), seed the
# demo data when asked, then serve.
set -e

echo "[ulat] applying database migrations…"
tries=0
until node prisma-cli/node_modules/prisma/build/index.js migrate deploy; do
  tries=$((tries + 1))
  if [ "$tries" -ge 15 ]; then
    echo "[ulat] database still unreachable after $tries attempts — giving up." >&2
    exit 1
  fi
  echo "[ulat] database not ready (attempt $tries) — retrying in 2s…"
  sleep 2
done

# SEED_DEMO=1 inserts the demo instructor/student/guardian accounts once
# (the seed skips anything that already exists).
if [ "$SEED_DEMO" = "1" ]; then
  echo "[ulat] seeding demo data…"
  node prisma/seed.cjs || echo "[ulat] seed failed (non-fatal)" >&2
fi

echo "[ulat] starting server on :$PORT"
exec node server.js

#!/bin/bash
set -e

# Build main + preload
npx tsc -p tsconfig.main.json
npx tsc -p tsconfig.preload.json
cp src/main/entry.cjs dist/main/entry.cjs

echo "Build OK. Launching Electron..."
NODE_ENV=development exec /home/traucus/desarrollos_softam/iptv/node_modules/electron/dist/electron \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  dist/main/entry.cjs

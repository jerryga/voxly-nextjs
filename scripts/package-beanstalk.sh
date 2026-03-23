#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/.dist/beanstalk"
ZIP_PATH="$ROOT_DIR/.dist/voxly-beanstalk.zip"

cd "$ROOT_DIR"

npm run build

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/.next"

cp -R .next/standalone/. "$DIST_DIR/"
cp -R .next/static "$DIST_DIR/.next/static"

rm -f "$DIST_DIR/.env" "$DIST_DIR/.env.local" "$DIST_DIR/.env.production"

if [ -d public ]; then
  cp -R public "$DIST_DIR/public"
fi

if [ -d prisma ]; then
  cp -R prisma "$DIST_DIR/prisma"
fi

if [ -d .platform ]; then
  cp -R .platform "$DIST_DIR/.platform"
fi

if [ -d .ebextensions ]; then
  cp -R .ebextensions "$DIST_DIR/.ebextensions"
fi

cat > "$DIST_DIR/Procfile" <<'EOF'
web: HOSTNAME=0.0.0.0 PORT=${PORT:-8080} node server.js
EOF

rm -f "$ZIP_PATH"
(
  cd "$DIST_DIR"
  zip -rq "$ZIP_PATH" .
)

echo "Created Beanstalk bundle at $ZIP_PATH"

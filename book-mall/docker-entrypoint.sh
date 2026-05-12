#!/bin/sh
set -e
if [ -z "$DATABASE_URL" ]; then
  echo "[book-mall] ERROR: DATABASE_URL 未设置，无法执行 prisma migrate deploy"
  exit 1
fi
echo "[book-mall] Running prisma migrate deploy..."
prisma migrate deploy
exec node server.js

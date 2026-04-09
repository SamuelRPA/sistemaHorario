#!/bin/sh
set -e
echo "[docker] Sincronizando esquema Prisma con la base de datos..."
prisma db push --skip-generate --schema=./prisma/schema.prisma
echo "[docker] Arrancando aplicación..."
exec node src/index.js

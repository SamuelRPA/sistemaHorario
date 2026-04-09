#!/usr/bin/env bash
# Crea ramas locales cuyo contenido en la raíz es solo frontend/ o solo backend/
# (historia filtrada con git subtree split). Útil en Render: Root Directory = vacío,
# cada servicio apunta a su rama.
#
# 1) Sube el monorepo completo en main (o tu rama principal).
# 2) Ejecuta desde la raíz del repo:
#      chmod +x scripts/render-branches.sh
#      ./scripts/render-branches.sh
# 3) Sube las ramas:
#      git push origin render-frontend render-backend --force-with-lease
#
# Opcional: segundo argumento = commit o rama de referencia (por defecto HEAD).

set -euo pipefail
REMOTE="${1:-origin}"
REF="${2:-HEAD}"

git fetch "$REMOTE" 2>/dev/null || true

echo "==> Rama render-frontend (contenido de ./frontend en la raíz)"
git subtree split --prefix=frontend -b render-frontend "$REF"

echo "==> Rama render-backend (contenido de ./backend en la raíz)"
git subtree split --prefix=backend -b render-backend "$REF"

echo ""
echo "Listo. En Render:"
echo "  - Static/Web nginx: Branch render-frontend, Root Directory vacío, Dockerfile en frontend/"
echo "  - API Node:        Branch render-backend, Root Directory vacío, Dockerfile en backend/"
echo ""
echo "Subir ramas:"
echo "  git push $REMOTE render-frontend render-backend --force-with-lease"

# Equivalente a scripts/render-branches.sh (Git Bash o PowerShell con git en PATH).
# Uso: .\scripts\render-branches.ps1
# Luego: git push origin render-frontend render-backend --force-with-lease

$ErrorActionPreference = "Stop"
$ref = if ($args[0]) { $args[0] } else { "HEAD" }

git fetch origin 2>$null

Write-Host "==> Rama render-frontend (contenido de ./frontend en la raíz)"
git subtree split --prefix=frontend -b render-frontend $ref

Write-Host "==> Rama render-backend (contenido de ./backend en la raíz)"
git subtree split --prefix=backend -b render-backend $ref

Write-Host ""
Write-Host "Listo. Subir: git push origin render-frontend render-backend --force-with-lease"

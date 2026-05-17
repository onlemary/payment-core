#!/bin/bash
# ===========================================
# dev-publish.sh
# Bump versión + test + publish + instalar en consumidores.
# Delega a publish.sh (fuente de verdad para publish)
# y scripts/install-consumers.sh (fuente de verdad para install).
#
# ⚠️  PRINCIPIO ARQUITECTÓNICO — NO MODIFICAR SIN AUTORIZACIÓN ⚠️
#
# payment-core se publica online en GitHub Packages.
# gym y tango SIEMPRE consumen @latest del registry online.
# NUNCA usar links locales (pnpm link, file:...) ni versiones fijas.
# Dependencia en package.json SIEMPRE con rango (^x.y.z) o @latest, nunca versión exacta.
#
# Razón: gym y tango están (o estarán) en servers separados.
# Solo lo publicado en el registry está disponible para ellos.
#
# Flujo completo: dev-publish.sh → publish.sh → GitHub Packages
#                                              → install-consumers.sh → pnpm add @latest
#
# Uso: bash dev-publish.sh [patch|minor|major]
# Ejemplo: bash dev-publish.sh patch  (0.1.0 → 0.1.1)
# ===========================================
set -e

BUMP_TYPE=${1:-patch}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📦 Publicando nueva versión de @onlemary/payment-core..."

# 1. Obtener versión actual
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📌 Versión actual: $CURRENT_VERSION"

# 2. Incrementar versión
npm version "$BUMP_TYPE" --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "📌 Nueva versión: $NEW_VERSION"

# 3. Ejecutar tests (fail-fast: si fallan, no commitear el bump)
# NOTA: npm publish vuelve a correr tests via prepublishOnly — es intencional
# como safety net. El test explícito aquí evita commitear un bump roto.
echo "🧪 Ejecutando tests..."
npm test

# 4. Commit del bump
git add -A
git commit -m "chore: bump version to $NEW_VERSION" || true

# 5. Publicar (delega a publish.sh — fuente de verdad)
echo "📤 Publicando..."
bash publish.sh

# 6. Instalar en consumidores (delega a install-consumers.sh — fuente de verdad)
echo ""
bash scripts/install-consumers.sh

echo ""
echo "✅ Publicación completa! Versión: $NEW_VERSION"

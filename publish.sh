#!/bin/bash
# ===========================================
# publish.sh
# Fuente única de verdad para publicar @onlemary/payment-core
# en GitHub Packages (npm.pkg.github.com).
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
# Uso: bash publish.sh
#
# Prerequisitos:
#   - GITHUB_TOKEN configurado (en .env o variable de entorno)
#   - Build ya ejecutado (npm run build) — no hace build aquí
#     para evitar duplicación con prepublishOnly y dev-publish.sh
#
# NOTA: npm publish ejecuta prepublishOnly (build + test) automáticamente.
#       No hacemos build explícito aquí para no duplicar.
# ===========================================
set -e

# Cargar variables de entorno desde monorepo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYMENT_DIR="$SCRIPT_DIR"
PACKAGES_DIR="$(dirname "$PAYMENT_DIR")"
PROJECT_ROOT="$(dirname "$PACKAGES_DIR")"

# Cargar .env del proyecto raíz
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

# Cargar .env local si existe
if [ -f "$PAYMENT_DIR/.env" ]; then
    source "$PAYMENT_DIR/.env"
fi

# Cargar .env.payment (configuración específica de payment-core)
if [ -f "$PAYMENT_DIR/.env.payment" ]; then
    set -a
    source <(grep -v '^#' "$PAYMENT_DIR/.env.payment" | grep -v '^$' | sed 's/\r$//')
    set +a
fi

# Cargar .env.secrets (tokens, API keys — último para mayor prioridad)
if [ -f "$PAYMENT_DIR/.env.secrets" ]; then
    set -a
    source <(grep -v '^#' "$PAYMENT_DIR/.env.secrets" | grep -v '^$' | sed 's/\r$//')
    set +a
fi

cd "$PAYMENT_DIR"

# Verificar si tenemos GITHUB_TOKEN
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GITHUB_TOKEN no encontrado. Solo ejecutando build local."
    npm run build
    echo "✅ Build completado. Para publicar, configura GITHUB_TOKEN."
    exit 0
fi

# Auto-incrementar versión patch (0.1.9 → 0.1.10)
echo "📦 Incrementando versión..."
npm version patch --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ Nueva versión: $NEW_VERSION"

# Publicar (prepublishOnly ejecuta build + test automáticamente)
npm publish --//npm.pkg.github.com/:_authToken="${GITHUB_TOKEN}"

echo "✅ Publicado exitosamente"

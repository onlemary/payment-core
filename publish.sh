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
#   - package.json con la versión YA bumpeada por dev-publish.sh
#     (publish.sh NO bumpea — eso es responsabilidad de dev-publish.sh
#     para evitar doble bump).
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

# Cargar gym/.env.secrets (GITHUB_TOKEN centralizado)
if [ -f "$PROJECT_ROOT/gym/.env.secrets" ]; then
    set -a
    source <(grep -v '^#' "$PROJECT_ROOT/gym/.env.secrets" | grep -v '^$' | sed 's/\r$//')
    set +a
fi

# Cargar PAYMENT_CORE_DB_URL desde gym/.env.payment (Postgres de Lago, base payment_core).
# `npm publish` dispara prepublishOnly → build + test, y esos tests usan Prisma
# contra esa DB. Sin la variable fallan con "Prisma requires PAYMENT_CORE_DB_URL".
# Solo como fallback: si ya viene exportada (ej. desde dev-publish.sh) no la pisamos.
if [ -z "${PAYMENT_CORE_DB_URL:-}" ]; then
    ENV_PAYMENT="$PROJECT_ROOT/gym/.env.payment"
    if [ -f "$ENV_PAYMENT" ]; then
        set -a
        source <(grep '^PAYMENT_CORE_DB_URL' "$ENV_PAYMENT" | sed 's/\r$//')
        set +a
    else
        echo "⚠️  gym/.env.payment no encontrado — los tests (prepublishOnly) pueden fallar si PAYMENT_CORE_DB_URL no está seteada"
    fi
fi
# vitest.config.ts hace fallback entre PAYMENT_CORE_DB_URL y DATABASE_URL — reflejamos si falta.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${PAYMENT_CORE_DB_URL:-}" ]; then
    export DATABASE_URL="$PAYMENT_CORE_DB_URL"
fi

cd "$PAYMENT_DIR"

# Verificar si tenemos GITHUB_TOKEN
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GITHUB_TOKEN no encontrado. Solo ejecutando build local."
    npm run build
    echo "✅ Build completado. Para publicar, configura GITHUB_TOKEN."
    exit 0
fi

# Verificar que el árbol git está limpio (al menos package.json).
# Si el dev-publish.sh no fue usado, hay cambios sin commitear — fallamos
# para evitar publicar una versión que el caller no bumpeó explícitamente.
if ! git diff --quiet package.json 2>/dev/null; then
    if [ -z "${ALLOW_DIRTY_PUBLISH:-}" ]; then
        echo "❌ package.json tiene cambios sin commitear."
        echo "   publish.sh NO bumpea versión — eso es responsabilidad de dev-publish.sh."
        echo "   Si querés publicar la versión actual de package.json, export ALLOW_DIRTY_PUBLISH=1"
        echo "   (NO recomendado — el bump es lo que distingue releases)."
        exit 1
    fi
fi

# Leer versión actual (ya bumpeada por dev-publish.sh)
NEW_VERSION=$(node -p "require('./package.json').version")
echo "📦 Publicando versión: $NEW_VERSION"

# Publicar (prepublishOnly ejecuta build + test automáticamente)
npm publish --//npm.pkg.github.com/:_authToken="${GITHUB_TOKEN}"

echo "✅ Publicado exitosamente ($NEW_VERSION)"

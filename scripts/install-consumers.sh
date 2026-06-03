#!/bin/bash
# ===========================================
# install-consumers.sh
# Instala @onlemary/payment-core@latest en workspaces de gym
#
# ⚠️  PRINCIPIO ARQUITECTÓNICO ⚠️
# payment-core se publica en GitHub Packages.
# gym SIEMPRE consume @latest del registry online.
# NUNCA usar links locales (pnpm link, file:...).
#
# Flujo: publish.sh → GitHub Packages → install-consumers.sh → pnpm add @latest
#
# Uso: bash install-consumers.sh [--add]
#   --add  Usa pnpm add @latest en vez de pnpm update
#         (default es update porque es más confiable cuando el registry
#          acaba de ser actualizado y pnpm puede tener metadata cacheada).
#
# Verifica al final que la versión instalada coincide con la publicada.
# ===========================================
set -e

# Detectar PROJECT_ROOT (3 niveles arriba de este script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYMENT_DIR="$(dirname "$SCRIPT_DIR")"          # packages/payment-core
PACKAGES_DIR="$(dirname "$PAYMENT_DIR")"        # packages
PROJECT_ROOT="$(dirname "$PACKAGES_DIR")"       # monorepo root

# Verificar estructura
if [ ! -d "$PROJECT_ROOT/gym" ]; then
    echo "❌ No se detectó gym en: $PROJECT_ROOT"
    exit 1
fi

MODE="update"
for arg in "$@"; do
    case "$arg" in
        --add) MODE="add" ;;
    esac
done

# Versión publicada (la que queremos que esté instalada).
EXPECTED_VERSION=$(node -p "require('$PAYMENT_DIR/package.json').version")
echo "📦 Instalando @onlemary/payment-core@$EXPECTED_VERSION en gym workspaces (modo: $MODE)..."

cd "$PROJECT_ROOT/gym"

# Actualizar SOLO workspaces (no root)
echo "  📦 Actualizando workspaces..."
if [ "$MODE" = "add" ]; then
    pnpm add -r @onlemary/payment-core@latest || { echo "❌ Error instalando workspaces"; exit 1; }
else
    pnpm update -r @onlemary/payment-core || { echo "❌ Error actualizando workspaces"; exit 1; }
fi

# Verificar que la versión instalada coincide con la publicada.
# pnpm a veces tiene metadata cacheada y `add @latest` no se actualiza
# si acabamos de publicar — update es más confiable, pero aún así
# validamos para detectar drift.
echo ""
echo "  🔍 Verificando versión instalada..."
INSTALLED_VERSION=$(node -p "require('./node_modules/@onlemary/payment-core/package.json').version")
if [ "$INSTALLED_VERSION" != "$EXPECTED_VERSION" ]; then
    echo "❌ DRIFT: Versión publicada=$EXPECTED_VERSION, instalada=$INSTALLED_VERSION"
    echo "   Esto puede pasar por metadata cacheada de pnpm."
    echo "   Forzá con: rm -rf node_modules/.pnpm-store && pnpm install --force"
    exit 1
fi

echo ""
echo "✅ @onlemary/payment-core@$INSTALLED_VERSION instalado en gym workspaces"

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
# Uso: bash install-consumers.sh [--update]
#   --update  Usa pnpm update en vez de pnpm add
#
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

MODE="add"
for arg in "$@"; do
    case "$arg" in
        --update) MODE="update" ;;
    esac
done

echo "📦 Instalando @onlemary/payment-core@latest en gym workspaces (modo: $MODE)..."

cd "$PROJECT_ROOT/gym"

# Actualizar SOLO workspaces (no root)
echo "  📦 Actualizando workspaces..."
if [ "$MODE" = "update" ]; then
    pnpm update -r @onlemary/payment-core || { echo "⚠️  Error actualizando workspaces"; exit 1; }
else
    pnpm add -r @onlemary/payment-core@latest || { echo "⚠️  Error instalando workspaces"; exit 1; }
fi

echo ""
echo "✅ @onlemary/payment-core instalado en gym workspaces"

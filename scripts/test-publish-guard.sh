#!/bin/bash
# ===========================================
# test-publish-guard.sh
# Regression test para el guard anti-self-ref en publish.sh.
#
# El chequeo vive en scripts/guard.cjs (single source of truth — el mismo
# que ejecuta publish.sh antes del `npm publish`). Acá probamos:
#
#   [1] LIVE: corremos guard.cjs contra el ./package.json real.
#       Como payment-core NO se self-referencea, tiene que exit 0.
#       Esto valida que el guard no bloquea releases reales.
#
#   [2..5] INJECTED: tomamos una copia de ./package.json y le inyectamos
#       un self-reference en cada uno de los 4 banks (uno por test).
#       Cada caso tiene que exit 1 con mensaje claro.
#
# Uso:
#   bash scripts/test-publish-guard.sh
#
# Exit codes:
#   0 = todos los casos pasaron
#   1 = al menos un caso falló (el script imprime cuál)
# ===========================================
set -e

TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
GUARD_CJS="$SCRIPT_DIR/guard.cjs"

echo "== test-publish-guard =="
echo "PKG_DIR: $PKG_DIR"
echo "GUARD_CJS: $GUARD_CJS"
echo

# [1] LIVE: contra el package.json real (esperado: exit 0)
echo "[1] LIVE — guard sobre ./package.json real (esperado exit 0)"
set +e
node "$GUARD_CJS"
LIVE_EXIT=$?
set -e
echo "  → exit=$LIVE_EXIT"
if [ "$LIVE_EXIT" -ne 0 ]; then
    echo "❌ FAIL: el guard bloqueó el package.json real. ¿Hay cambios no-committeados?"
    exit 1
fi
echo "  ✅ OK"
echo

# [2..5] INJECTED: copia del real con self-ref inyectado en cada bank
fail_count=0
total=0
for BANK in dependencies devDependencies peerDependencies optionalDependencies; do
    total=$((total + 1))
    INJECTED="$TEST_DIR/injected-$BANK.json"
    # Copia el package.json real y agrega self-ref en $BANK usando node
    # (preserva el resto del archivo byte-perfect).
    node -e "
      const fs = require('fs');
      const p = JSON.parse(fs.readFileSync('$PKG_DIR/package.json', 'utf8'));
      if (!p['$BANK']) p['$BANK'] = {};
      p['$BANK'][p.name] = '999.0.0';
      fs.writeFileSync('$INJECTED', JSON.stringify(p, null, 2));
    "
    echo "[$((total+1))] INJECTED — self-ref en $BANK (esperado exit 1)"
    set +e
    node "$GUARD_CJS" "$INJECTED"
    actual=$?
    set -e
    echo "  → exit=$actual"
    if [ "$actual" -ne 1 ]; then
        echo "  ❌ FAIL: guard NO detectó self-reference en $BANK"
        fail_count=$((fail_count + 1))
    else
        echo "  ✅ OK"
    fi
    echo
done

echo "== resumen =="
echo "  casos inyectados: $((total - fail_count))/$total pasaron"
if [ "$fail_count" -gt 0 ]; then
    echo "❌ FAIL: $fail_count caso(s) fallaron"
    exit 1
fi
echo "✅ PASS — guard verificado contra 1 caso real + 4 fixtures inyectadas."

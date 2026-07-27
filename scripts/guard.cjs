// =============================================================================
// scripts/guard.cjs — Anti-self-ref check para publish.sh
//
// Bug observado: payment-core 0.6.27 publicó un tarball con
// "@onlemary/payment-core": "^0.6.28" dentro de su propio bloque
// `dependencies`. Razón: el comando `npm version patch` automatizó la
// escritura y agregó la clave. Consecuencia: cualquier
// `pnpm add @onlemary/payment-core@latest` en un consumidor resolvía la
// referencia circular e instalaba el paquete vacío. Solo se destrabó en
// 0.6.29 con cleanup manual.
//
// Este guard previene la regresión: lee ./package.json, verifica que
// .name NO aparezca como key en dependencies / devDependencies /
// peerDependencies / optionalDependencies. Si aparece, sale con exit 1
// + mensaje claro.
//
// Archivo .cjs (no .js) porque payment-core tiene "type": "module" en
// package.json, y archivos sin extensión explícita se interpretan como
// ESM. Las extensiones .cjs fuerzan CommonJS — más simple para un script
// CLI con require() síncrono.
//
// Uso desde publish.sh:
//   if ! node scripts/guard.cjs; then exit 1; fi
//
// Uso desde test-publish-guard.sh:
//   node scripts/guard.cjs /path/to/test-fixture.json
// =============================================================================

const fs = require('fs')
const path = require('path')

const pkgPath = process.argv[2] || path.join(__dirname, '..', 'package.json')
let pkg
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
} catch (err) {
  console.error(`❌ No pude leer/parsear ${pkgPath}: ${err.message}`)
  process.exit(1)
}

const self = pkg.name
if (!self) {
  console.error('❌ package.json no tiene campo "name"')
  process.exit(1)
}

const banks = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
const hits = []
for (const b of banks) {
  if (pkg[b] && Object.prototype.hasOwnProperty.call(pkg[b], self)) {
    hits.push(b)
  }
}

if (hits.length === 0) {
  console.log(`✅ ${self}: no hay self-reference en ningún bank.`)
  process.exit(0)
}

for (const b of hits) {
  console.error(`❌ Self-reference en package.json: '${self}' se lista a sí mismo en ${b}`)
}
console.error(`   Limpiá esa entrada y reintentá. (Bug observado: payment-core 0.6.27)`)
console.error(`   Para inspeccionar: grep "${self}" package.json`)
process.exit(1)

/**
 * postinstall — corre automáticamente después de npm install.
 * Si PAYMENT_CORE_DB_URL está definida → ejecuta prisma db push (crea tablas).
 * Si NO está definida → muestra aviso, no bloquea la instalación.
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const url = process.env.PAYMENT_CORE_DB_URL

if (!url) {
  console.warn(`
╔══════════════════════════════════════════════════════════════╗
║  @onlemary/payment-core — AVISO                              ║
╠══════════════════════════════════════════════════════════════╣
║  PAYMENT_CORE_DB_URL no está definida.                       ║
║                                                              ║
║  La DB no se configuró automáticamente.                     ║
║  Configurá la variable y reinstalá, o ejecutá manualmente:  ║
║    npx prisma db push                                        ║
║                                                              ║
║  La app va a fallar al arrancar si falta esta variable.      ║
╚══════════════════════════════════════════════════════════════╝
`)
  process.exit(0)
}

function maskUrl(u: string) {
  return u.replace(/:\/\/.*@/, '://<credentials>@')
}

console.log(`[@onlemary/payment-core] Sincronizando DB: ${maskUrl(url)}`)

try {
  // Prisma db push sincroniza el schema con la DB (crea tablas si no existen)
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  })
  console.log(`[@onlemary/payment-core] Tablas sincronizadas.`)
} catch (err) {
  console.error('[@onlemary/payment-core] Error al sincronizar DB:', err)
  console.error('Verificá que PAYMENT_CORE_DB_URL sea correcta y la DB exista.')
  process.exit(1)
}

/**
 * postinstall — corre automáticamente después de npm install.
 * Crea la database si no existe y sincroniza el schema.
 * Idempotente: la segunda vez no hace nada.
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { PrismaClient } from '../dist/.prisma/client/index.js'

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

const dbName = url.split('/').pop()?.split('?')[0] || 'payment_core'
const maintenanceUrl = url.replace(/\/[^/?]+(?=\?|$)/, '/postgres')

console.log(`[@onlemary/payment-core] Verificando DB: ${maskUrl(url)}`)

// 1. Crear database si no existe
const maintenanceClient = new PrismaClient({
  datasources: { db: { url: maintenanceUrl } },
})

try {
  await maintenanceClient.$connect()
  await maintenanceClient.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`)
  console.log(`[@onlemary/payment-core] Database ${dbName} creada`)
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('already exists')) {
    console.log(`[@onlemary/payment-core] Database ${dbName} ya existe`)
  } else {
    console.error(`[@onlemary/payment-core] Error al crear database:`, message)
    await maintenanceClient.$disconnect()
    process.exit(1)
  }
} finally {
  await maintenanceClient.$disconnect()
}

// 2. Sincronizar schema (crea tablas si no existen)
try {
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

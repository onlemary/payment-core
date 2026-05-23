/**
 * postinstall — corre automáticamente después de npm install.
 * Busca .env.payment walkeando hacia arriba desde su propio directorio,
 * lo carga, crea la database si no existe y sincroniza el schema.
 * Idempotente: la segunda vez no hace nada.
 *
 * Prisma v7+ no soporta datasources en el constructor de PrismaClient,
 * por eso usamos pg.Pool directamente para crear la DB.
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── Helper: write to stderr so pnpm never silences output ────────

function log(msg: string) {
  process.stderr.write(`[@onlemary/payment-core] ${msg}\n`)
}

function logBlock(msg: string) {
  process.stderr.write(msg)
}

// ── Auto-descubrimiento de .env.payment ──────────────────────────

const POSSIBLE_ENV_FILES = ['.env.payment']

function findEnvFile(): string | null {
  let dir = __dirname
  for (let i = 0; i < 10; i++) {
    for (const name of POSSIBLE_ENV_FILES) {
      const candidate = join(dir, name)
      if (existsSync(candidate)) return candidate
    }
    const parent = dirname(dir)
    if (parent === dir) break // reached root
    dir = parent
  }
  return null
}

/**
 * Parsea un archivo .env línea por línea, sin depender de dotenv.
 * Soporta: KEY=VAL, export KEY=VAL, comillas dobles/simples, # comentarios.
 */
function loadEnvFile(filepath: string): Record<string, string> {
  const vars: Record<string, string> = {}
  const text = readFileSync(filepath, 'utf-8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const withoutExport = trimmed.replace(/^export\s+/i, '')
    const eqIdx = withoutExport.indexOf('=')
    if (eqIdx === -1) continue
    const key = withoutExport.slice(0, eqIdx).trim()
    let value = withoutExport.slice(eqIdx + 1).trim()
    if (!key) continue

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

const envFile = findEnvFile()

if (envFile) {
  const vars = loadEnvFile(envFile)
  for (const [key, value] of Object.entries(vars)) {
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
  log(`Cargado: ${envFile}`)
}

// ── Lógica de creación de DB ─────────────────────────────────────

const url = process.env.PAYMENT_CORE_DB_URL

if (!url) {
  logBlock(`
╔══════════════════════════════════════════════════════════════╗
║  @onlemary/payment-core — AVISO                              ║
╠══════════════════════════════════════════════════════════════╣
║  No se encontró PAYMENT_CORE_DB_URL (ni .env.payment).      ║
║                                                              ║
║  ▶ Solución rápida:                                          ║
║    1. Copiá .env.payment.example → .env.payment             ║
║    2. Completá tus valores                                   ║
║    3. Reinstalá el paquete                                    ║
║                                                              ║
║  ▶ También podés ejecutar manualmente:                       ║
║    npx prisma db push --schema=node_modules/@onlemary/       ║
║    payment-core/prisma/schema.prisma                         ║
║                                                              ║
║  ⚠️ PAYMENT_CORE_DB_URL es obligatoria. Sin ella, el        ║
║    validador @onlemary/payment-core va a THROW al           ║
║    instanciar un PaymentClient (fail-fast en constructor).  ║
╚══════════════════════════════════════════════════════════════╝
`)
  process.exit(0)
}

function maskUrl(u: string) {
  return u.replace(/:\/\/.*@/, '://<credentials>@')
}

const dbName = url.split('/').pop()?.split('?')[0] || 'payment_core'
const maintenanceUrl = url.replace(/\/[^/?]+(?=\?|$)/, '/postgres')

log(`Verificando DB: ${maskUrl(url)}`)

// 1. Crear database si no existe (usa pg.Pool, no PrismaClient — Prisma v7+ ya no soporta datasources en constructor)
const pool = new Pool({ connectionString: maintenanceUrl })

try {
  const client = await pool.connect()
  try {
    await client.query(`CREATE DATABASE "${dbName}"`)
    log(`Database ${dbName} creada`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('already exists')) {
      log(`Database ${dbName} ya existe`)
    } else {
      log(`Error al crear database: ${message}`)
      process.exit(1)
    }
  } finally {
    client.release()
  }
} finally {
  await pool.end()
}

// 2. Sincronizar schema (crea tablas si no existen)
try {
  // Prisma v7+ no genera automáticamente, ni acepta --skip-generate (fue removido)
  execSync('prisma db push --accept-data-loss', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  })
  log('Tablas sincronizadas.')
} catch (err) {
  log(`Error al sincronizar DB: ${err instanceof Error ? err.message : String(err)}`)
  log('Verificá que PAYMENT_CORE_DB_URL sea correcta y la DB exista.')
  process.exit(1)
}

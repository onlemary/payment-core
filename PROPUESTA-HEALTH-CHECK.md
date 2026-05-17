# Propuesta: Health Check y Validación de Configuración en Payment-Core

**Fecha**: 2026-05-03  
**Objetivo**: Sistema automático de validación de configuración y conectividad

---

## 🎯 Problema

Cuando se integra payment-core en una nueva app, es fácil olvidar configuraciones críticas:
- Variables de entorno faltantes
- Callback URLs incorrectos
- Storage no inicializado
- Credenciales inválidas
- Conectividad con MercadoPago

**Resultado**: Errores en runtime que son difíciles de debuggear.

---

## 🏗️ Arquitectura Propuesta

### Opción A: Todo en Payment-Core (Monolítico)
```
@onlemary/payment-core
├── /health          # Health checks
├── /validation      # Startup validation
└── /client          # Existing code
```

**Pros:**
- ✅ Todo en un paquete
- ✅ Fácil de instalar
- ✅ Versionado unificado

**Contras:**
- ❌ Aumenta tamaño del paquete
- ❌ Mezcla concerns (core + tooling)
- ❌ Dependencias extra (si health check necesita libs específicas)

### Opción B: Paquete Separado (Modular) - RECOMENDADO
```
@onlemary/payment-core          # Core functionality
@onlemary/payment-core-devtools # Health checks, validation, debugging
```

**Pros:**
- ✅ Separación clara de concerns
- ✅ Core más liviano
- ✅ Devtools solo en desarrollo
- ✅ Puede tener dependencias propias sin afectar core
- ✅ Más fácil de mantener

**Contras:**
- ❌ Dos paquetes para instalar (pero solo devtools en dev)

### Opción C: Híbrido (Recomendación Final)
```
@onlemary/payment-core
├── /health          # Health checks básicos (parte del core)
│   └── runHealthCheck()  # Checks esenciales
│
└── /validation      # NO incluido - usar devtools

@onlemary/payment-core-devtools (opcional, solo dev)
├── /validation      # Startup validation
├── /cli             # CLI tools
├── /dashboard       # Health dashboard (futuro)
└── /testing         # Test helpers
```

**Razón:**
- Health checks son útiles en producción (monitoreo)
- Startup validation es solo para desarrollo
- CLI tools son solo para desarrollo
- Separación clara pero pragmática

---

## 💡 Solución Propuesta (Opción C)

### 1. Health Check API (en payment-core)

```typescript
// payment-core/src/health/index.ts

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    [key: string]: {
      status: 'pass' | 'warn' | 'fail'
      message: string
      details?: any
    }
  }
  timestamp: Date
}

export interface HealthCheckOptions {
  // Qué checks ejecutar
  checkStorage?: boolean
  checkCredentials?: boolean
  checkConnectivity?: boolean
  checkCallbackUrl?: boolean
  
  // Configuración
  expectedCallbackUrls?: string[]
  testTenantId?: string
}

export async function runHealthCheck(
  client: PaymentClient | PaymentClientOAuth,
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult>
```

### 2. Checks Implementados

#### A. Storage Check
```typescript
async function checkStorage(storage: TokenStorage): Promise<CheckResult> {
  try {
    // Test write
    await storage.save('_health', '_test', { test: true, timestamp: Date.now() })
    
    // Test read
    const data = await storage.get('_health', '_test')
    if (!data) {
      return { status: 'fail', message: 'Storage read failed' }
    }
    
    // Test delete
    await storage.delete('_health', '_test')
    
    return { status: 'pass', message: 'Storage is working' }
  } catch (error) {
    return {
      status: 'fail',
      message: 'Storage check failed',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}
```

#### B. Credentials Check
```typescript
async function checkCredentials(client: PaymentClientOAuth): Promise<CheckResult> {
  const config = client.getConfig()
  const checks = []
  
  // Check clientId
  if (!config.providers.mercadopago?.credentials?.clientId) {
    checks.push('Missing clientId')
  }
  
  // Check clientSecret
  if (!config.providers.mercadopago?.credentials?.clientSecret) {
    checks.push('Missing clientSecret')
  }
  
  // Check format (basic validation)
  const clientId = config.providers.mercadopago?.credentials?.clientId
  if (clientId && !/^\d+$/.test(clientId)) {
    checks.push('Invalid clientId format (should be numeric)')
  }
  
  if (checks.length > 0) {
    return {
      status: 'fail',
      message: 'Credentials validation failed',
      details: checks
    }
  }
  
  return { status: 'pass', message: 'Credentials are valid' }
}
```

#### C. Connectivity Check
```typescript
async function checkConnectivity(client: PaymentClientOAuth): Promise<CheckResult> {
  try {
    // Try to get OAuth status (doesn't require accessToken)
    const status = await client.getOAuthStatus('_health_check')
    
    return {
      status: 'pass',
      message: 'MercadoPago API is reachable',
      details: { connected: status.connected }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    
    // Network errors
    if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
      return {
        status: 'fail',
        message: 'Cannot reach MercadoPago API',
        details: { error: message }
      }
    }
    
    // Auth errors (expected if no tokens)
    if (message.includes('401') || message.includes('403')) {
      return {
        status: 'pass',
        message: 'MercadoPago API is reachable (auth required)',
        details: { note: 'API is up, but no valid tokens' }
      }
    }
    
    return {
      status: 'warn',
      message: 'Connectivity check inconclusive',
      details: { error: message }
    }
  }
}
```

#### D. Callback URL Check
```typescript
async function checkCallbackUrl(
  expectedUrls: string[],
  currentUrl: string
): Promise<CheckResult> {
  // Check if current URL is in expected list
  if (!expectedUrls.includes(currentUrl)) {
    return {
      status: 'warn',
      message: 'Callback URL not in expected list',
      details: {
        current: currentUrl,
        expected: expectedUrls,
        note: 'Make sure this URL is registered in MercadoPago dashboard'
      }
    }
  }
  
  // Check URL format
  try {
    const url = new URL(currentUrl)
    
    // Must be HTTPS in production
    if (url.protocol !== 'https:' && !url.hostname.includes('localhost')) {
      return {
        status: 'warn',
        message: 'Callback URL should use HTTPS',
        details: { url: currentUrl }
      }
    }
    
    return {
      status: 'pass',
      message: 'Callback URL is valid',
      details: { url: currentUrl }
    }
  } catch (error) {
    return {
      status: 'fail',
      message: 'Invalid callback URL format',
      details: { url: currentUrl, error: String(error) }
    }
  }
}
```

### 3. Startup Validation (en payment-core-devtools)

```typescript
// @onlemary/payment-core-devtools/src/validation/startup.ts

export interface StartupValidationOptions {
  // Modo estricto: falla si hay errores
  strict?: boolean
  
  // Qué validar
  validateEnv?: boolean
  validateStorage?: boolean
  validateCredentials?: boolean
  
  // Configuración esperada
  requiredEnvVars?: string[]
  expectedCallbackUrls?: string[]
}

export async function validateStartup(
  client: PaymentClient | PaymentClientOAuth,
  options: StartupValidationOptions = {}
): Promise<void> {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate environment variables
  if (options.validateEnv && options.requiredEnvVars) {
    for (const envVar of options.requiredEnvVars) {
      if (!process.env[envVar]) {
        errors.push(`Missing required environment variable: ${envVar}`)
      }
    }
  }
  
  // Validate storage
  if (options.validateStorage) {
    try {
      const storage = client.getStorage()
      await storage.initialize()
    } catch (error) {
      errors.push(`Storage initialization failed: ${error}`)
    }
  }
  
  // Validate credentials
  if (options.validateCredentials) {
    const config = client.getConfig()
    if (!config.providers.mercadopago?.credentials?.clientId) {
      errors.push('Missing MercadoPago clientId')
    }
    if (!config.providers.mercadopago?.credentials?.clientSecret) {
      errors.push('Missing MercadoPago clientSecret')
    }
  }
  
  // Report results
  if (errors.length > 0) {
    const message = `Startup validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
    
    if (options.strict) {
      throw new Error(message)
    } else {
      console.error(message)
    }
  }
  
  if (warnings.length > 0) {
    console.warn(`Startup warnings:\n${warnings.map(w => `  - ${w}`).join('\n')}`)
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Payment-core startup validation passed')
  }
}
```

---

## 🚀 Uso en Gym Platform

### 1. Health Check Endpoint

```typescript
// gym/apps/admin/app/api/health/payment/route.ts

import { NextResponse } from 'next/server'
import { runHealthCheck } from '@onlemary/payment-core/health'
import { getPaymentOAuthClientForOrg } from '@/lib/payment/payment-oauth-client'

export async function GET() {
  try {
    const client = await getPaymentOAuthClientForOrg('_health')
    
    const result = await runHealthCheck(client, {
      checkStorage: true,
      checkCredentials: true,
      checkConnectivity: true,
      checkCallbackUrl: true,
      expectedCallbackUrls: [
        'https://admin.fila.ar/api/[orgSlug]/payments/mercadopago/oauth/callback',
      ],
    })
    
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
```

### 2. Startup Validation (Solo en Desarrollo)

```typescript
// gym/apps/admin/lib/payment/payment-oauth-client.ts

// Solo importar en desarrollo
const isDev = process.env.NODE_ENV === 'development'
const validateStartup = isDev 
  ? require('@onlemary/payment-core-devtools/validation').validateStartup
  : null

export async function getPaymentOAuthClientForOrg(orgSlug: string) {
  // ... existing code ...
  
  const client = new PaymentClientOAuth({ /* ... */ })
  
  // Validate on first initialization (solo en dev)
  if (isDev && validateStartup && !cache.has(orgSlug)) {
    await validateStartup(client, {
      strict: false,
      validateEnv: true,
      validateStorage: true,
      validateCredentials: true,
      requiredEnvVars: [
        'MERCADOPAGO_CLIENT_ID',
        'MERCADOPAGO_CLIENT_SECRET',
        'CLIENTS_DATA_PATH',
        'NEXT_PUBLIC_BASE_URL',
      ],
    })
  }
  
  await client.initialize()
  cache.set(orgSlug, client)
  
  return client
}
```

**Alternativa: Variable de Entorno**
```typescript
// Solo validar si está habilitado explícitamente
const shouldValidate = process.env.PAYMENT_CORE_VALIDATE_STARTUP === 'true'

if (shouldValidate && !cache.has(orgSlug)) {
  const { validateStartup } = await import('@onlemary/payment-core-devtools/validation')
  await validateStartup(client, { /* ... */ })
}
```

### 3. CLI Tool para Validación (payment-core-devtools)

```typescript
// gym/scripts/validate-payment-config.ts

import { runHealthCheck } from '@onlemary/payment-core/health'
import { validateStartup } from '@onlemary/payment-core-devtools/validation'
import { getPaymentOAuthClientForOrg } from '../apps/admin/lib/payment/payment-oauth-client'

async function main() {
  console.log('🔍 Validating payment configuration...\n')
  
  const client = await getPaymentOAuthClientForOrg('gym_iron')
  
  const result = await runHealthCheck(client, {
    checkStorage: true,
    checkCredentials: true,
    checkConnectivity: true,
    checkCallbackUrl: true,
    expectedCallbackUrls: [
      'https://admin.fila.ar/api/gym_iron/payments/mercadopago/oauth/callback',
    ],
  })
  
  // Print results
  console.log(`Status: ${result.status}\n`)
  
  for (const [name, check] of Object.entries(result.checks)) {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'
    console.log(`${icon} ${name}: ${check.message}`)
    if (check.details) {
      console.log(`   Details:`, check.details)
    }
  }
  
  process.exit(result.status === 'unhealthy' ? 1 : 0)
}

main()
```

---

## 📊 Ejemplo de Output

### Health Check Exitoso
```json
{
  "status": "healthy",
  "checks": {
    "storage": {
      "status": "pass",
      "message": "Storage is working"
    },
    "credentials": {
      "status": "pass",
      "message": "Credentials are valid"
    },
    "connectivity": {
      "status": "pass",
      "message": "MercadoPago API is reachable",
      "details": { "connected": false }
    },
    "callbackUrl": {
      "status": "pass",
      "message": "Callback URL is valid",
      "details": {
        "url": "https://admin.fila.ar/api/gym_iron/payments/mercadopago/oauth/callback"
      }
    }
  },
  "timestamp": "2026-05-03T14:30:00.000Z"
}
```

### Health Check con Warnings
```json
{
  "status": "degraded",
  "checks": {
    "storage": {
      "status": "pass",
      "message": "Storage is working"
    },
    "credentials": {
      "status": "pass",
      "message": "Credentials are valid"
    },
    "connectivity": {
      "status": "warn",
      "message": "Connectivity check inconclusive",
      "details": {
        "error": "Request timeout"
      }
    },
    "callbackUrl": {
      "status": "warn",
      "message": "Callback URL not in expected list",
      "details": {
        "current": "http://localhost:4000/api/gym_iron/payments/mercadopago/oauth/callback",
        "expected": ["https://admin.fila.ar/api/gym_iron/payments/mercadopago/oauth/callback"],
        "note": "Make sure this URL is registered in MercadoPago dashboard"
      }
    }
  },
  "timestamp": "2026-05-03T14:30:00.000Z"
}
```

---

## 🎯 Beneficios

### Para Desarrolladores
- ✅ Detecta problemas de configuración al inicio
- ✅ Mensajes de error claros y accionables
- ✅ Reduce tiempo de debugging
- ✅ Documentación implícita (los checks muestran qué se necesita)

### Para Operaciones
- ✅ Health check endpoint para monitoreo
- ✅ Validación automática en CI/CD
- ✅ Alertas tempranas de problemas
- ✅ Facilita troubleshooting

### Para Nuevas Integraciones
- ✅ Checklist automático de configuración
- ✅ Guía paso a paso (basada en checks fallidos)
- ✅ Menos errores en producción
- ✅ Onboarding más rápido

---

## 📦 Estructura de Paquetes

### @onlemary/payment-core (Producción)
```
payment-core/
├── src/
│   ├── client/           # PaymentClient, PaymentClientOAuth
│   ├── providers/        # MercadoPago, Stripe, etc.
│   ├── storage/          # FileStorage, PostgreSQL, etc.
│   ├── oauth/            # OAuth handlers
│   ├── routes/           # Route handlers
│   └── health/           # ✨ Health checks (NUEVO)
│       ├── index.ts      # runHealthCheck()
│       ├── checks/       # Individual checks
│       │   ├── storage.ts
│       │   ├── credentials.ts
│       │   ├── connectivity.ts
│       │   └── callback-url.ts
│       └── types.ts
└── package.json
```

**Instalación:**
```bash
npm install @onlemary/payment-core
```

**Uso:**
```typescript
import { runHealthCheck } from '@onlemary/payment-core/health'

// Health check endpoint (producción)
app.get('/health/payment', async (req, res) => {
  const result = await runHealthCheck(client)
  res.json(result)
})
```

---

### @onlemary/payment-core-devtools (Desarrollo)
```
payment-core-devtools/
├── src/
│   ├── validation/       # Startup validation
│   │   ├── startup.ts    # validateStartup()
│   │   ├── env.ts        # Environment validation
│   │   └── config.ts     # Config validation
│   ├── cli/              # CLI tools
│   │   ├── validate.ts   # Validation command
│   │   ├── test.ts       # Test command
│   │   └── doctor.ts     # Doctor command (diagnose issues)
│   ├── testing/          # Test helpers
│   │   ├── mocks.ts      # Mock clients
│   │   └── fixtures.ts   # Test fixtures
│   └── dashboard/        # Health dashboard (futuro)
│       └── server.ts     # Dashboard server
└── package.json
```

**Instalación:**
```bash
npm install --save-dev @onlemary/payment-core-devtools
```

**Uso:**
```typescript
// Solo en desarrollo
if (process.env.NODE_ENV === 'development') {
  const { validateStartup } = await import('@onlemary/payment-core-devtools/validation')
  await validateStartup(client, { /* ... */ })
}
```

**CLI:**
```bash
# Validar configuración
npx payment-core-devtools validate

# Diagnosticar problemas
npx payment-core-devtools doctor

# Ejecutar tests
npx payment-core-devtools test
```

---

## 🎯 Decisiones de Diseño

### ¿Por qué Health Checks en Core?

**Razón**: Los health checks son útiles en **producción** para monitoreo.

**Casos de uso:**
- Endpoint `/health/payment` para Kubernetes/Docker
- Alertas de Datadog/New Relic
- Status page público
- Debugging en producción

**Ejemplo:**
```typescript
// Producción: Health check endpoint
app.get('/health/payment', async (req, res) => {
  const result = await runHealthCheck(client, {
    checkStorage: true,
    checkConnectivity: true,
  })
  
  const statusCode = result.status === 'healthy' ? 200 : 503
  res.status(statusCode).json(result)
})
```

### ¿Por qué Startup Validation en Devtools?

**Razón**: La validación de startup es solo útil en **desarrollo**.

**Casos de uso:**
- Detectar configuración faltante al desarrollar
- Validar antes de hacer commit (pre-commit hook)
- CI/CD checks
- Onboarding de nuevos devs

**NO necesario en producción porque:**
- Ya validaste en desarrollo
- Agrega overhead al startup
- Las variables de entorno ya están validadas por infra

**Ejemplo:**
```typescript
// Desarrollo: Validación automática
if (process.env.NODE_ENV === 'development') {
  await validateStartup(client, {
    strict: true, // Crash si hay errores
    requiredEnvVars: ['MERCADOPAGO_CLIENT_ID', 'MERCADOPAGO_CLIENT_SECRET'],
  })
}
```

### ¿Por qué CLI en Devtools?

**Razón**: Los CLI tools son para **desarrollo y debugging**.

**Casos de uso:**
- Validar configuración antes de deployar
- Diagnosticar problemas localmente
- Ejecutar tests de integración
- Generar reportes de configuración

**Ejemplo:**
```bash
# Pre-deploy validation
npm run validate:payment

# Diagnose issues
npm run payment:doctor

# Output:
🔍 Diagnosing payment configuration...

✅ Storage: Working
✅ Credentials: Valid
❌ Connectivity: Cannot reach MercadoPago API
   → Check your internet connection
   → Verify firewall settings
⚠️  Callback URL: Using localhost
   → This won't work in production
   → Update NEXT_PUBLIC_BASE_URL
```

---

## 📝 Implementación Propuesta

### Fase 1: Health Checks en Core (1-2 días)
**Paquete**: `@onlemary/payment-core`

- [ ] Crear `/src/health/` directory
- [ ] Implementar `runHealthCheck()` function
- [ ] Implementar checks individuales:
  - [ ] Storage check
  - [ ] Credentials check
  - [ ] Connectivity check
  - [ ] Callback URL check
- [ ] Tests unitarios para cada check
- [ ] Documentación de API
- [ ] Publicar nueva versión minor (0.1.21)

### Fase 2: Devtools Package (2-3 días)
**Paquete**: `@onlemary/payment-core-devtools` (NUEVO)

- [ ] Crear nuevo paquete
- [ ] Implementar `validateStartup()` function
- [ ] Implementar CLI commands:
  - [ ] `validate` - Validar configuración
  - [ ] `doctor` - Diagnosticar problemas
  - [ ] `test` - Ejecutar tests
- [ ] Tests de integración
- [ ] Documentación de uso
- [ ] Publicar versión 0.1.0

### Fase 3: Integración en Gym (1 día)
**Apps**: `gym/apps/admin` y `gym/apps/pago`

- [ ] Agregar health check endpoint en admin
- [ ] Agregar startup validation en desarrollo
- [ ] Crear script de validación
- [ ] Agregar pre-commit hook (opcional)
- [ ] Documentar en README

### Fase 4: Mejoras Avanzadas (opcional, futuro)
- [ ] Dashboard de health checks
- [ ] Métricas y alertas
- [ ] Auto-remediation
- [ ] Integración con monitoring tools

---

## 📦 Instalación y Uso

### En Producción
```bash
# Solo payment-core
npm install @onlemary/payment-core
```

```typescript
// Health check endpoint
import { runHealthCheck } from '@onlemary/payment-core/health'

app.get('/health/payment', async (req, res) => {
  const result = await runHealthCheck(client)
  res.json(result)
})
```

### En Desarrollo
```bash
# Core + devtools
npm install @onlemary/payment-core
npm install --save-dev @onlemary/payment-core-devtools
```

```typescript
// Startup validation (solo en dev)
if (process.env.NODE_ENV === 'development') {
  const { validateStartup } = await import('@onlemary/payment-core-devtools/validation')
  await validateStartup(client, {
    requiredEnvVars: ['MERCADOPAGO_CLIENT_ID', 'MERCADOPAGO_CLIENT_SECRET'],
  })
}
```

```bash
# CLI validation
npx payment-core-devtools validate
npx payment-core-devtools doctor
```

---

## 🎯 Beneficios de la Separación

### Para Payment-Core
- ✅ Core más liviano (solo health checks esenciales)
- ✅ Sin dependencias de desarrollo en producción
- ✅ Versionado independiente
- ✅ Más fácil de mantener

### Para Devtools
- ✅ Puede tener dependencias pesadas (CLI frameworks, etc.)
- ✅ Puede evolucionar independientemente
- ✅ No afecta el tamaño del core
- ✅ Fácil de extender con nuevas herramientas

### Para Usuarios
- ✅ Instalan solo lo que necesitan
- ✅ Producción más liviana
- ✅ Desarrollo más productivo
- ✅ Onboarding más fácil

---

## 🔄 Alternativas Consideradas

### 1. Solo Documentación
**Pros**: Simple, no requiere código  
**Contras**: Fácil de olvidar, no detecta problemas automáticamente

### 2. Validación en Initialize
**Pros**: Automático, no requiere llamada explícita  
**Contras**: Puede hacer startup más lento, menos flexible

### 3. Health Check Separado (Propuesta Actual)
**Pros**: Flexible, no afecta startup, útil para monitoreo  
**Contras**: Requiere llamada explícita

---

## 💡 Conclusión

Un sistema de health check y validación en payment-core:
- ✅ Mejora la experiencia de integración
- ✅ Reduce errores en producción
- ✅ Facilita debugging y troubleshooting
- ✅ Hace el core más "developer-friendly"
- ✅ No rompe compatibilidad (es opt-in)

**Recomendación**: Implementar en fases, empezando con checks básicos y expandiendo según necesidad.

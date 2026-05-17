# Health Check and Validation System

**Version**: 0.1.21  
**Status**: Implemented  
**Last Updated**: 2026-05-03

---

## 📋 Overview

Payment-core includes two complementary systems for configuration validation and monitoring:

1. **Health Checks** (`/health`) - Runtime monitoring for production and development
2. **Startup Validation** (`/validation`) - Configuration validation for development only

Both systems use **tree-shaking** to ensure only imported code is included in your bundle.

---

## 🏥 Health Checks

### Purpose

Health checks provide runtime monitoring of payment-core components. Useful for:
- Production health endpoints (Kubernetes, Docker, monitoring tools)
- Development debugging
- CI/CD validation
- Status dashboards

### Installation

```bash
npm install @onlemary/payment-core
```

### Usage

```typescript
import { runHealthCheck } from '@onlemary/payment-core/health'
import type { HealthCheckResult } from '@onlemary/payment-core/health'

// Run health check
const result: HealthCheckResult = await runHealthCheck(client, {
  checkStorage: true,
  checkCredentials: true,
  checkConnectivity: true,
  checkCallbackUrl: true,
  expectedCallbackUrls: [
    'https://admin.example.com/api/payments/callback',
  ],
  connectivityTimeout: 5000,
})

// Check result
if (result.status === 'healthy') {
  console.log('✅ All checks passed')
} else if (result.status === 'degraded') {
  console.log('⚠️  Some warnings detected')
} else {
  console.log('❌ Health check failed')
}

// Inspect individual checks
for (const [name, check] of Object.entries(result.checks)) {
  console.log(`${name}: ${check.status} - ${check.message}`)
}
```

### Health Check Options

```typescript
interface HealthCheckOptions {
  // Which checks to run
  checkStorage?: boolean              // Default: true
  checkCredentials?: boolean          // Default: true
  checkConnectivity?: boolean         // Default: true
  checkCallbackUrl?: boolean          // Default: false
  
  // Configuration
  expectedCallbackUrls?: string[]     // For callback URL validation
  connectivityTimeout?: number        // Timeout in ms (default: 5000)
}
```

### Health Check Result

```typescript
interface HealthCheckResult {
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
```

### Example: Health Endpoint (Next.js)

```typescript
// app/api/health/payment/route.ts
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
    })
    
    const statusCode = result.status === 'healthy' ? 200 : 503
    return NextResponse.json(result, { status: statusCode })
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

### Individual Checks

#### Storage Check
Validates storage is working by testing read/write/delete operations.

```typescript
{
  status: 'pass',
  message: 'Storage is working'
}
```

#### Credentials Check
Validates MercadoPago credentials are configured correctly.

```typescript
{
  status: 'pass',
  message: 'Credentials are valid'
}
```

#### Connectivity Check
Tests connectivity to MercadoPago API.

```typescript
{
  status: 'pass',
  message: 'MercadoPago API is reachable',
  details: { connected: false }
}
```

#### Callback URL Check
Validates OAuth callback URL format and HTTPS usage.

```typescript
{
  status: 'pass',
  message: 'Callback URL is valid',
  details: { url: 'https://...' }
}
```

---

## ✅ Startup Validation

### Purpose

Startup validation checks configuration at application startup. Useful for:
- Development environment setup
- Catching configuration errors early
- Onboarding new developers
- Pre-deployment validation

**⚠️ WARNING**: Only use in development. Not recommended for production.

### Installation

```bash
npm install @onlemary/payment-core
```

### Usage

```typescript
import { validateStartup } from '@onlemary/payment-core/validation'
import type { ValidationResult } from '@onlemary/payment-core/validation'

// Only in development
if (process.env.NODE_ENV === 'development') {
  const result: ValidationResult = await validateStartup(client, {
    strict: true,  // Throw error if validation fails
    validateEnv: true,
    validateStorage: true,
    validateCredentials: true,
    validateCallbackUrl: true,
    requiredEnvVars: [
      'MERCADOPAGO_CLIENT_ID',
      'MERCADOPAGO_CLIENT_SECRET',
      'CLIENTS_DATA_PATH',
      'NEXT_PUBLIC_BASE_URL',
    ],
    expectedCallbackUrls: [
      'https://admin.example.com/api/payments/callback',
    ],
  })
  
  if (!result.success) {
    console.error('Validation failed:', result.errors)
  }
}
```

### Validation Options

```typescript
interface StartupValidationOptions {
  // Behavior
  strict?: boolean                    // Throw error if validation fails (default: false)
  silent?: boolean                    // Don't log to console (default: false)
  
  // What to validate
  validateEnv?: boolean               // Validate environment variables (default: true)
  validateStorage?: boolean           // Validate storage (default: true)
  validateCredentials?: boolean       // Validate credentials (default: true)
  validateCallbackUrl?: boolean       // Validate callback URL (default: false)
  
  // Configuration
  requiredEnvVars?: string[]          // Required environment variables
  expectedCallbackUrls?: string[]     // Expected callback URLs
}
```

### Validation Result

```typescript
interface ValidationResult {
  success: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  timestamp: Date
}

interface ValidationError {
  code: string
  message: string
  details?: Record<string, any>
}

interface ValidationWarning {
  code: string
  message: string
  details?: Record<string, any>
}
```

### Example: Startup Validation in Factory

```typescript
// lib/payment/payment-oauth-client.ts
import { PaymentClientOAuth } from '@onlemary/payment-core'
import { validateStartup } from '@onlemary/payment-core/validation'

const cache = new Map<string, PaymentClientOAuth>()

export async function getPaymentOAuthClientForOrg(orgSlug: string) {
  if (cache.has(orgSlug)) {
    return cache.get(orgSlug)!
  }
  
  // ... create client ...
  
  // Validate on first initialization (dev only)
  if (process.env.NODE_ENV === 'development' && !cache.has(orgSlug)) {
    await validateStartup(client, {
      strict: false,
      requiredEnvVars: [
        'MERCADOPAGO_CLIENT_ID',
        'MERCADOPAGO_CLIENT_SECRET',
        'CLIENTS_DATA_PATH',
      ],
    })
  }
  
  await client.initialize()
  cache.set(orgSlug, client)
  
  return client
}
```

### Error Codes

| Code | Description | Severity |
|------|-------------|----------|
| `MISSING_ENV_VAR` | Required environment variable is missing | Error |
| `STORAGE_NOT_CONFIGURED` | Storage is not configured | Error |
| `STORAGE_OPERATION_FAILED` | Storage operation failed | Error |
| `CREDENTIALS_NOT_CONFIGURED` | Credentials not configured | Error |
| `MISSING_CLIENT_ID` | MercadoPago clientId is missing | Error |
| `MISSING_CLIENT_SECRET` | MercadoPago clientSecret is missing | Error |
| `INVALID_CALLBACK_URL` | Invalid callback URL format | Error |
| `PRODUCTION_VALIDATION` | Validation used in production | Warning |
| `INVALID_CLIENT_ID_FORMAT` | ClientId should be numeric | Warning |
| `MISSING_ACCESS_TOKEN` | AccessToken is missing (expected for OAuth) | Warning |
| `CALLBACK_URL_NOT_HTTPS` | Callback URL should use HTTPS | Warning |

---

## 🔒 Security

### Log Sanitization

All sensitive values are automatically sanitized in logs:

```typescript
import { sanitizeForLog } from '@onlemary/payment-core/validation'

const config = {
  clientId: '1234567890',
  clientSecret: 'super-secret-value',
  accessToken: 'access-token-value',
}

console.log(sanitizeForLog(config))
// Output: { clientId: '1234567890', clientSecret: '***', accessToken: '***' }
```

### Sensitive Keys

The following keys are automatically masked:
- `clientSecret`
- `accessToken`
- `refreshToken`
- `password`
- `apiKey`
- `secret`
- `privateKey`
- `token`

### Production Warning

Startup validation automatically warns if used in production:

```
⚠️  Payment-core startup warnings:
  - [PRODUCTION_VALIDATION] validateStartup() should not be used in production
   Details: {
     "recommendation": "Use health checks instead for production monitoring"
   }
```

---

## 📦 Tree-Shaking

Payment-core is configured for optimal tree-shaking:

```json
// package.json
{
  "type": "module",
  "sideEffects": false,
  "exports": {
    "./health": "./dist/health/index.js",
    "./validation": "./dist/validation/index.js"
  }
}
```

### Bundle Size Impact

| Import | Included in Bundle |
|--------|-------------------|
| `import { PaymentClient } from '@onlemary/payment-core'` | Core only (~50KB) |
| `import { runHealthCheck } from '@onlemary/payment-core/health'` | Core + Health (~55KB) |
| `import { validateStartup } from '@onlemary/payment-core/validation'` | Core + Validation (~60KB) |

**Production Recommendation**: Only import health checks, not validation.

---

## 🎯 Best Practices

### Development

```typescript
// ✅ Good: Validate on startup in development
if (process.env.NODE_ENV === 'development') {
  await validateStartup(client, {
    strict: true,
    requiredEnvVars: ['MERCADOPAGO_CLIENT_ID', 'MERCADOPAGO_CLIENT_SECRET'],
  })
}

// ✅ Good: Use health checks for debugging
const health = await runHealthCheck(client)
console.log('Health:', health.status)
```

### Production

```typescript
// ✅ Good: Health endpoint for monitoring
app.get('/health/payment', async (req, res) => {
  const result = await runHealthCheck(client, {
    checkStorage: true,
    checkConnectivity: true,
  })
  res.status(result.status === 'healthy' ? 200 : 503).json(result)
})

// ❌ Bad: Don't use validation in production
if (process.env.NODE_ENV === 'production') {
  await validateStartup(client)  // ❌ Adds unnecessary overhead
}
```

### CI/CD

```typescript
// ✅ Good: Validate before deployment
import { validateStartup } from '@onlemary/payment-core/validation'

const result = await validateStartup(client, {
  strict: true,
  silent: false,
})

if (!result.success) {
  process.exit(1)
}
```

---

## 🧪 Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest'
import { runHealthCheck } from '@onlemary/payment-core/health'
import { validateStartup } from '@onlemary/payment-core/validation'

describe('Health Checks', () => {
  it('should pass with valid configuration', async () => {
    const result = await runHealthCheck(client)
    expect(result.status).toBe('healthy')
  })
  
  it('should fail with invalid storage', async () => {
    const result = await runHealthCheck(clientWithBadStorage)
    expect(result.status).toBe('unhealthy')
    expect(result.checks.storage.status).toBe('fail')
  })
})

describe('Startup Validation', () => {
  it('should pass with all required env vars', async () => {
    const result = await validateStartup(client, {
      requiredEnvVars: ['MERCADOPAGO_CLIENT_ID'],
      silent: true,
    })
    expect(result.success).toBe(true)
  })
  
  it('should fail with missing env vars', async () => {
    delete process.env.MERCADOPAGO_CLIENT_ID
    
    const result = await validateStartup(client, {
      requiredEnvVars: ['MERCADOPAGO_CLIENT_ID'],
      silent: true,
    })
    
    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('MISSING_ENV_VAR')
  })
})
```

---

## 📚 Examples

### Example 1: Health Endpoint with Caching

```typescript
// app/api/health/payment/route.ts
import { NextResponse } from 'next/server'
import { runHealthCheck } from '@onlemary/payment-core/health'

let cachedResult: any = null
let cacheTime = 0
const CACHE_TTL = 60000 // 1 minute

export async function GET() {
  const now = Date.now()
  
  // Return cached result if fresh
  if (cachedResult && (now - cacheTime) < CACHE_TTL) {
    return NextResponse.json(cachedResult)
  }
  
  // Run health check
  const client = await getPaymentOAuthClientForOrg('_health')
  const result = await runHealthCheck(client)
  
  // Cache result
  cachedResult = result
  cacheTime = now
  
  const statusCode = result.status === 'healthy' ? 200 : 503
  return NextResponse.json(result, { status: statusCode })
}
```

### Example 2: CLI Validation Script

```typescript
// scripts/validate-payment-config.ts
import { validateStartup } from '@onlemary/payment-core/validation'
import { getPaymentOAuthClientForOrg } from '../lib/payment/payment-oauth-client'

async function main() {
  console.log('🔍 Validating payment configuration...\n')
  
  const client = await getPaymentOAuthClientForOrg('gym_iron')
  
  const result = await validateStartup(client, {
    strict: false,
    requiredEnvVars: [
      'MERCADOPAGO_CLIENT_ID',
      'MERCADOPAGO_CLIENT_SECRET',
      'CLIENTS_DATA_PATH',
      'NEXT_PUBLIC_BASE_URL',
    ],
    expectedCallbackUrls: [
      'https://admin.fila.ar/api/gym_iron/payments/mercadopago/oauth/callback',
    ],
  })
  
  if (result.success) {
    console.log('\n✅ Validation passed')
    process.exit(0)
  } else {
    console.log('\n❌ Validation failed')
    process.exit(1)
  }
}

main()
```

### Example 3: Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running payment configuration validation..."
npm run validate:payment

if [ $? -ne 0 ]; then
  echo "❌ Payment validation failed. Fix errors before committing."
  exit 1
fi

echo "✅ Payment validation passed"
```

---

## 🔄 Migration Guide

### From Custom Validation

**Before:**
```typescript
// Custom validation
if (!process.env.MERCADOPAGO_CLIENT_ID) {
  throw new Error('Missing MERCADOPAGO_CLIENT_ID')
}
if (!process.env.MERCADOPAGO_CLIENT_SECRET) {
  throw new Error('Missing MERCADOPAGO_CLIENT_SECRET')
}
```

**After:**
```typescript
// Use payment-core validation
import { validateStartup } from '@onlemary/payment-core/validation'

await validateStartup(client, {
  strict: true,
  requiredEnvVars: ['MERCADOPAGO_CLIENT_ID', 'MERCADOPAGO_CLIENT_SECRET'],
})
```

### From Manual Health Checks

**Before:**
```typescript
// Manual health check
try {
  await storage.get('test', 'test')
  console.log('Storage OK')
} catch (error) {
  console.error('Storage failed:', error)
}
```

**After:**
```typescript
// Use payment-core health check
import { runHealthCheck } from '@onlemary/payment-core/health'

const result = await runHealthCheck(client, { checkStorage: true })
console.log('Storage:', result.checks.storage.message)
```

---

## 📖 API Reference

### Health Check API

```typescript
// Run health check
function runHealthCheck(
  client: PaymentClient | PaymentClientOAuth,
  options?: HealthCheckOptions
): Promise<HealthCheckResult>

// Types
interface HealthCheckOptions {
  checkStorage?: boolean
  checkCredentials?: boolean
  checkConnectivity?: boolean
  checkCallbackUrl?: boolean
  expectedCallbackUrls?: string[]
  connectivityTimeout?: number
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, CheckResult>
  timestamp: Date
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail'
  message: string
  details?: any
}
```

### Validation API

```typescript
// Run startup validation
function validateStartup(
  client: PaymentClient | PaymentClientOAuth,
  options?: StartupValidationOptions
): Promise<ValidationResult>

// Sanitize logs
function sanitizeForLog(obj: any): any

// Types
interface StartupValidationOptions {
  strict?: boolean
  silent?: boolean
  validateEnv?: boolean
  validateStorage?: boolean
  validateCredentials?: boolean
  validateCallbackUrl?: boolean
  requiredEnvVars?: string[]
  expectedCallbackUrls?: string[]
}

interface ValidationResult {
  success: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  timestamp: Date
}

interface ValidationError {
  code: string
  message: string
  details?: Record<string, any>
}

interface ValidationWarning {
  code: string
  message: string
  details?: Record<string, any>
}
```

---

## 🐛 Troubleshooting

### Health Check Always Fails

**Problem**: Health check returns `unhealthy` even though everything works.

**Solution**: Check individual checks to see which one is failing:

```typescript
const result = await runHealthCheck(client)
console.log('Failed checks:', 
  Object.entries(result.checks)
    .filter(([_, check]) => check.status === 'fail')
    .map(([name, check]) => ({ name, message: check.message }))
)
```

### Validation Throws in Production

**Problem**: Validation throws error in production.

**Solution**: Only use validation in development:

```typescript
if (process.env.NODE_ENV === 'development') {
  await validateStartup(client, { strict: true })
}
```

### Tree-Shaking Not Working

**Problem**: Validation code is included in production bundle.

**Solution**: Check your imports:

```typescript
// ❌ Bad: Imports everything
import * as PaymentCore from '@onlemary/payment-core'

// ✅ Good: Imports only what you need
import { PaymentClient } from '@onlemary/payment-core'
import { runHealthCheck } from '@onlemary/payment-core/health'
```

---

## 📝 Changelog

### v0.1.21 (2026-05-03)

- ✨ Added health check system (`/health`)
- ✨ Added startup validation system (`/validation`)
- ✨ Added log sanitization for security
- ✨ Configured tree-shaking support
- 📚 Added comprehensive documentation

---

## 🤝 Contributing

When adding new checks or validation:

1. **Security First**: Never log sensitive values
2. **Use Sanitization**: Always use `sanitizeForLog()` for logs
3. **Clear Messages**: Provide actionable error messages
4. **Test Coverage**: Add tests for new checks
5. **Documentation**: Update this document

---

## 📄 License

MIT License - See LICENSE file for details

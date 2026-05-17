# OAuth Callback Handler - Integration Guide

## Overview

The OAuth Callback Handler provides a generic, framework-agnostic solution for handling OAuth callbacks from payment providers like MercadoPago. It follows a **NO fallbacks/defaults** philosophy, requiring all callbacks to be explicitly provided.

## Key Features

- **Generic & Reusable**: Works with any OAuth provider
- **Multi-Tenant Support**: TypeScript generics for flexible identifier types
- **Framework Agnostic**: Works with Next.js, Express, Fastify, etc.
- **Routing Flexibility**: Supports path-based, subdomain, query params, custom domain
- **Type Safe**: Full TypeScript support with strict typing
- **NO Fallbacks**: All callbacks are REQUIRED for explicit error handling

## Installation

```bash
npm install @onlemary/payment-core@latest
```

## Quick Start

### Next.js Example (Path-Based Routing)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createMercadoPagoOAuthCallbackHandlerV2 } from '@onlemary/payment-core'
import { getOAuthClient, clearCache } from './your-client-factory'

export async function GET(request: NextRequest, { params }: { params: { orgSlug: string } }) {
  const { orgSlug } = params

  // Create handler with ALL required callbacks
  const handler = createMercadoPagoOAuthCallbackHandlerV2(
    getOAuthClient,
    {
      // REQUIRED: Validate state parameter (security check)
      validateState: (state, identifier) => state === identifier,

      // REQUIRED: Get redirect URI for OAuth flow
      getRedirectUri: (identifier) => {
        return `${process.env.BASE_URL}/api/${identifier}/oauth/callback`
      },

      // REQUIRED: Handle successful OAuth
      onSuccess: (identifier, tokens) => {
        clearCache(identifier)
        return `/${identifier}/dashboard?oauth=success`
      },

      // REQUIRED: Handle OAuth errors
      onError: (identifier, error, errorDescription) => {
        const params = new URLSearchParams({ error, error_description: errorDescription || '' })
        return `/${identifier}/dashboard?${params.toString()}`
      },
    }
  )

  // Convert Next.js request to RouteInput
  const { searchParams } = new URL(request.url)
  const input = {
    headers: Object.fromEntries(request.headers.entries()),
    body: {},
    query: Object.fromEntries(searchParams.entries()),
  }

  // Execute handler
  const output = await handler(input)
  
  if (output.redirect) {
    return NextResponse.redirect(new URL(output.redirect, request.url))
  }

  return NextResponse.json(output.body, { status: output.status })
}
```

### Express Example

```typescript
import express from 'express'
import { createMercadoPagoOAuthCallbackHandlerV2 } from '@onlemary/payment-core'

const app = express()

app.get('/api/:orgSlug/oauth/callback', async (req, res) => {
  const { orgSlug } = req.params

  const handler = createMercadoPagoOAuthCallbackHandlerV2(
    getOAuthClient,
    {
      validateState: (state, identifier) => state === identifier,
      getRedirectUri: (identifier) => `${process.env.BASE_URL}/api/${identifier}/oauth/callback`,
      onSuccess: (identifier, tokens) => {
        clearCache(identifier)
        return `/${identifier}/dashboard?oauth=success`
      },
      onError: (identifier, error, errorDescription) => {
        return `/${identifier}/dashboard?error=${error}`
      },
    }
  )

  const input = {
    headers: req.headers,
    body: req.body,
    query: req.query,
  }

  const output = await handler(input)

  if (output.redirect) {
    return res.redirect(output.redirect)
  }

  return res.status(output.status).json(output.body)
})
```

## Multi-Tenant Routing Strategies

### 1. Path-Based Routing (Recommended)

**Pattern**: `/api/{identifier}/oauth/callback`

**Example**: `/api/gym_iron/oauth/callback`

```typescript
getRedirectUri: (identifier) => {
  return `${process.env.BASE_URL}/api/${identifier}/oauth/callback`
}
```

**Pros**:
- Simple to implement
- Works with any domain
- Easy to debug

**Cons**:
- Longer URLs
- Identifier visible in URL

### 2. Subdomain-Based Routing

**Pattern**: `https://{identifier}.yourdomain.com/oauth/callback`

**Example**: `https://gym-iron.yourdomain.com/oauth/callback`

```typescript
getRedirectUri: (identifier) => {
  return `https://${identifier}.yourdomain.com/oauth/callback`
}
```

**Pros**:
- Clean URLs
- Professional appearance
- Tenant isolation

**Cons**:
- Requires wildcard DNS
- SSL certificate management
- More complex setup

### 3. Query Parameter-Based Routing

**Pattern**: `/oauth/callback?tenant={identifier}`

**Example**: `/oauth/callback?tenant=gym_iron`

```typescript
getRedirectUri: (identifier) => {
  return `${process.env.BASE_URL}/oauth/callback?tenant=${identifier}`
}
```

**Pros**:
- Single endpoint
- Simple routing

**Cons**:
- Less secure (identifier in query string)
- Not recommended for production

### 4. Custom Domain Per Tenant

**Pattern**: `https://{custom-domain}/oauth/callback`

**Example**: `https://gym-iron.com/oauth/callback`

```typescript
getRedirectUri: (identifier) => {
  const domain = await getDomainForTenant(identifier)
  return `https://${domain}/oauth/callback`
}
```

**Pros**:
- Professional branding
- Complete tenant isolation

**Cons**:
- Complex DNS management
- SSL certificate per domain
- Higher cost

## TypeScript Generics

The handler supports different identifier types through TypeScript generics:

### String Identifier (Most Common)

```typescript
const handler = createMercadoPagoOAuthCallbackHandlerV2<string>(
  getOAuthClient,
  {
    validateState: (state: string, identifier: string) => state === identifier,
    // ...
  }
)
```

### Number Identifier

```typescript
const handler = createMercadoPagoOAuthCallbackHandlerV2<number>(
  getOAuthClient,
  {
    validateState: (state: string, identifier: number) => state === identifier.toString(),
    // ...
  }
)
```

### Custom Object Identifier

```typescript
interface TenantId {
  orgId: number
  region: string
}

const handler = createMercadoPagoOAuthCallbackHandlerV2<TenantId>(
  getOAuthClient,
  {
    validateState: (state: string, identifier: TenantId) => {
      return state === `${identifier.orgId}-${identifier.region}`
    },
    // ...
  }
)
```

## Security Best Practices

### 1. State Validation

Always validate the state parameter to prevent CSRF attacks:

```typescript
validateState: (state, identifier) => {
  // Simple validation
  return state === identifier

  // Or more complex validation
  const expectedState = generateStateToken(identifier)
  return state === expectedState
}
```

### 2. HTTPS Requirement

MercadoPago requires HTTPS for OAuth callbacks:

```typescript
getRedirectUri: (identifier) => {
  const baseUrl = process.env.BASE_URL
  if (!baseUrl.startsWith('https://')) {
    throw new Error('BASE_URL must use HTTPS for OAuth callbacks')
  }
  return `${baseUrl}/api/${identifier}/oauth/callback`
}
```

### 3. Environment Variables

Never hardcode sensitive values:

```typescript
// ❌ BAD
getRedirectUri: (identifier) => {
  return `http://localhost:3000/api/${identifier}/oauth/callback`
}

// ✅ GOOD
getRedirectUri: (identifier) => {
  const baseUrl = process.env.BASE_URL
  if (!baseUrl) {
    throw new Error('BASE_URL environment variable is required')
  }
  return `${baseUrl}/api/${identifier}/oauth/callback`
}
```

## Error Handling

The handler provides comprehensive error handling:

### Provider Errors

Errors from the OAuth provider (e.g., user cancelled):

```typescript
onError: (identifier, error, errorDescription) => {
  console.error(`OAuth error for ${identifier}:`, error, errorDescription)
  
  // Redirect with error information
  const params = new URLSearchParams({
    error: error || 'unknown_error',
    error_description: errorDescription || 'An unknown error occurred'
  })
  return `/${identifier}/dashboard?${params.toString()}`
}
```

### Validation Errors

Missing or invalid parameters:

```typescript
// Handled automatically by the handler
// Returns 400 status with descriptive error message
```

### Exception Handling

Unexpected errors during token exchange:

```typescript
onError: (identifier, error, errorDescription) => {
  // Log for debugging
  console.error(`Fatal error for ${identifier}:`, error, errorDescription)
  
  // Notify monitoring service
  notifyError({ identifier, error, errorDescription })
  
  // Redirect to error page
  return `/${identifier}/error?type=oauth_failed`
}
```

## Troubleshooting

### Common Issues

#### 1. "Missing OAuth callback parameters"

**Cause**: Neither `query` nor `body.url` contains OAuth parameters

**Solution**: Ensure your route passes query parameters correctly:

```typescript
const input = {
  headers: req.headers,
  body: req.body,
  query: req.query, // ← Make sure this is populated
}
```

#### 2. "Invalid state parameter"

**Cause**: State validation failed

**Solution**: Ensure state matches identifier:

```typescript
validateState: (state, identifier) => {
  console.log('Validating:', { state, identifier })
  return state === identifier
}
```

#### 3. "Failed to parse OAuth callback URL"

**Cause**: Malformed URL in `body.url`

**Solution**: Ensure URL is properly formatted:

```typescript
// URL must start with http://, https://, or /
const validUrls = [
  'https://example.com/callback?code=ABC',
  '/callback?code=ABC'
]
```

#### 4. "NEXT_PUBLIC_BASE_URL environment variable is required"

**Cause**: Missing environment variable

**Solution**: Add to your `.env` file:

```bash
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### Debugging Tips

#### Enable Verbose Logging

```typescript
onSuccess: (identifier, tokens) => {
  console.log('[OAuth Success]', {
    identifier,
    userId: tokens.userId,
    expiresAt: tokens.expiresAt,
  })
  return `/${identifier}/dashboard?oauth=success`
},

onError: (identifier, error, errorDescription) => {
  console.error('[OAuth Error]', {
    identifier,
    error,
    errorDescription,
  })
  return `/${identifier}/dashboard?error=${error}`
}
```

#### Test with MercadoPago Sandbox

Use test credentials and test users:

```typescript
const oauthClient = createMercadoPagoClient({
  clientId: process.env.MP_TEST_CLIENT_ID,
  clientSecret: process.env.MP_TEST_CLIENT_SECRET,
  // Use test users for testing
})
```

## Advanced Patterns

### Custom Logger Integration

```typescript
import { Logger } from './your-logger'

const logger = new Logger('oauth-callback')

const handler = createMercadoPagoOAuthCallbackHandlerV2(
  getOAuthClient,
  {
    validateState: (state, identifier) => {
      logger.debug('Validating state', { state, identifier })
      return state === identifier
    },
    onSuccess: (identifier, tokens) => {
      logger.info('OAuth success', { identifier, userId: tokens.userId })
      return `/${identifier}/dashboard?oauth=success`
    },
    onError: (identifier, error, errorDescription) => {
      logger.error('OAuth error', { identifier, error, errorDescription })
      return `/${identifier}/dashboard?error=${error}`
    },
  }
)
```

### Cache Invalidation

```typescript
onSuccess: (identifier, tokens) => {
  // Clear all caches related to this tenant
  clearOAuthCache(identifier)
  clearPaymentCache(identifier)
  clearUserCache(identifier)
  
  return `/${identifier}/dashboard?oauth=success`
}
```

### Webhook Notification

```typescript
onSuccess: async (identifier, tokens) => {
  // Notify webhook subscribers
  await notifyWebhook({
    event: 'oauth.connected',
    identifier,
    userId: tokens.userId,
  })
  
  return `/${identifier}/dashboard?oauth=success`
}
```

## NO Fallbacks/Defaults Philosophy

This handler follows a strict **NO fallbacks/defaults** philosophy:

### ❌ Anti-Patterns (What NOT to do)

```typescript
// ❌ Optional callbacks with defaults
validateState: (state, identifier) => true, // Always returns true!

// ❌ Fallback values
getRedirectUri: (identifier) => {
  return process.env.BASE_URL || 'http://localhost:3000' // Dangerous!
}

// ❌ Silent error handling
onError: (identifier, error, errorDescription) => {
  return '/' // Where does this go? Unknown!
}
```

### ✅ Correct Patterns (What TO do)

```typescript
// ✅ Explicit validation
validateState: (state, identifier) => {
  if (!state || !identifier) {
    throw new Error('State and identifier are required')
  }
  return state === identifier
}

// ✅ Required environment variables
getRedirectUri: (identifier) => {
  const baseUrl = process.env.BASE_URL
  if (!baseUrl) {
    throw new Error('BASE_URL environment variable is required')
  }
  return `${baseUrl}/api/${identifier}/oauth/callback`
}

// ✅ Explicit error handling
onError: (identifier, error, errorDescription) => {
  console.error(`OAuth failed for ${identifier}:`, error, errorDescription)
  return `/${identifier}/dashboard?error=${error}&description=${encodeURIComponent(errorDescription || '')}`
}
```

## Next Steps

- Read the [Migration Guide](./oauth-callback-migration.md) if upgrading from old implementation
- Check the [API Reference](../README.md#oauth-callback-handler) for detailed API documentation
- See [Examples](../examples/) for more integration patterns

## Support

For issues or questions:
- GitHub Issues: https://github.com/onlemary/payment-core/issues
- Documentation: https://github.com/onlemary/payment-core/docs

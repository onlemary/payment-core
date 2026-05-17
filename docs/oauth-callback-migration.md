# OAuth Callback Handler - Migration Guide

## Overview

This guide helps you migrate from the old OAuth callback implementation to the new generic handler in `@onlemary/payment-core@0.1.19+`.

## Benefits of Migration

- **44% Less Code**: Reduce callback routes from ~170 lines to ~95 lines
- **Reusability**: OAuth logic is now in payment-core (shared across apps)
- **Type Safety**: Full TypeScript generics for multi-tenant identifiers
- **NO Fallbacks**: Explicit error handling, no silent failures
- **Flexibility**: Support for multiple routing strategies

## Migration Checklist

- [ ] Update `@onlemary/payment-core` to version 0.1.19 or later
- [ ] Backup existing callback route
- [ ] Implement new handler with ALL required callbacks
- [ ] Test OAuth flow end-to-end
- [ ] Remove old code and unused imports
- [ ] Update documentation

## Step-by-Step Migration

### Step 1: Update Package

```bash
npm install @onlemary/payment-core@latest
```

Or for pnpm workspaces:

```bash
# Update package.json
"@onlemary/payment-core": "0.1.19"

# Install
pnpm install
```

### Step 2: Backup Old Implementation

Before making changes, backup your existing callback route:

```bash
cp app/api/[orgSlug]/oauth/callback/route.ts app/api/[orgSlug]/oauth/callback/route.ts.backup
```

### Step 3: Replace Implementation

#### Before (Old Implementation - ~170 lines)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getOAuthClient, clearCache } from './your-client'

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgSlug } = await params

  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Check for errors from provider
    if (error) {
      return NextResponse.redirect(
        new URL(`/${orgSlug}/dashboard?error=${error}`, request.url)
      )
    }

    // Validate required parameters
    if (!code) {
      return NextResponse.json(
        { error: 'Missing required parameter: code' },
        { status: 400 }
      )
    }

    // Validate state
    if (state !== orgSlug) {
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      )
    }

    // Get OAuth client
    const oauthClient = await getOAuthClient(orgSlug)

    // Construct redirect URI
    const redirectUri = `${process.env.BASE_URL}/api/${orgSlug}/oauth/callback`

    // Handle callback
    const tokens = await oauthClient.mercadopago.oauth.handleCallback(
      code,
      orgSlug,
      redirectUri
    )

    // Clear caches
    clearCache(orgSlug)

    // Redirect to success
    return NextResponse.redirect(
      new URL(`/${orgSlug}/dashboard?oauth=success`, request.url)
    )
  } catch (error) {
    console.error('OAuth error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.redirect(
      new URL(`/${orgSlug}/dashboard?error=callback_failed&error_description=${encodeURIComponent(errorMessage)}`, request.url)
    )
  }
}
```

#### After (New Implementation - ~95 lines)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createMercadoPagoOAuthCallbackHandlerV2 } from '@onlemary/payment-core'
import { getOAuthClient, clearCache } from './your-client'

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgSlug } = await params

  // Create handler with ALL required callbacks
  const handler = createMercadoPagoOAuthCallbackHandlerV2(
    getOAuthClient,
    {
      // REQUIRED: Validate state matches orgSlug (security check)
      validateState: (state, identifier) => state === identifier,

      // REQUIRED: Get redirect URI for this org (path-based routing)
      getRedirectUri: (identifier) => {
        const baseUrl = process.env.BASE_URL
        if (!baseUrl) {
          throw new Error('BASE_URL environment variable is required')
        }
        return `${baseUrl}/api/${identifier}/oauth/callback`
      },

      // REQUIRED: Handle successful OAuth (clear caches and redirect)
      onSuccess: (identifier, tokens) => {
        clearCache(identifier)
        return `/${identifier}/dashboard?oauth=success`
      },

      // REQUIRED: Handle OAuth errors (redirect with error params)
      onError: (identifier, error, errorDescription) => {
        const params = new URLSearchParams({
          error: error || 'callback_failed',
          error_description: errorDescription || 'Unknown error'
        })
        return `/${identifier}/dashboard?${params.toString()}`
      },
    }
  )

  // Convert Next.js request to RouteInput format
  const { searchParams } = new URL(request.url)
  const input = {
    headers: Object.fromEntries(request.headers.entries()),
    body: {},
    query: Object.fromEntries(searchParams.entries()),
  }

  // Execute handler and convert RouteOutput to Next.js response
  const output = await handler(input)
  
  if (output.redirect) {
    return NextResponse.redirect(new URL(output.redirect, request.url))
  }

  return NextResponse.json(output.body, { status: output.status })
}
```

### Step 4: Remove POST Route (If Present)

The new handler automatically handles both GET and POST requests through `RouteInput.query` and `RouteInput.body.url`. You can safely remove the POST route:

```typescript
// ❌ Remove this
export async function POST(request: NextRequest, { params }: RouteParams) {
  // ... old POST implementation
}
```

### Step 5: Update Imports

Remove unused imports from the old implementation:

```typescript
// ❌ Remove if no longer used
import { someOldHelper } from './old-helpers'
```

## Breaking Changes

### 1. Handler Function Signature

**Old**:
```typescript
// Direct implementation in route handler
export async function GET(request: NextRequest, { params }: RouteParams) {
  // ... 150+ lines of logic
}
```

**New**:
```typescript
// Handler factory pattern
const handler = createMercadoPagoOAuthCallbackHandlerV2(getClient, options)
const output = await handler(input)
```

### 2. Required Callbacks

**Old**: Logic was embedded in the route handler

**New**: ALL callbacks are REQUIRED:
- `validateState`
- `getRedirectUri`
- `onSuccess`
- `onError`

### 3. Request/Response Format

**Old**: Direct Next.js Request/Response

**New**: Generic `RouteInput` → `RouteOutput` format

```typescript
// Convert Next.js request to RouteInput
const input = {
  headers: Object.fromEntries(request.headers.entries()),
  body: {},
  query: Object.fromEntries(searchParams.entries()),
}

// Convert RouteOutput to Next.js response
if (output.redirect) {
  return NextResponse.redirect(new URL(output.redirect, request.url))
}
return NextResponse.json(output.body, { status: output.status })
```

## Backward Compatibility

The new implementation maintains 100% backward compatibility with existing OAuth flows:

✅ **Compatible**:
- Same URL structure (`/api/[orgSlug]/oauth/callback`)
- Same query parameters (`code`, `state`, `error`, `error_description`)
- Same redirect behavior (success/error pages)
- Same cache clearing behavior
- Same security validations (state check)

❌ **Not Compatible**:
- POST route with custom body format (if you had one)
- Custom error handling logic (must use `onError` callback)
- Hardcoded redirect URLs (must use callbacks)

## Testing After Migration

### 1. Test Authorization URL Generation

```typescript
// Navigate to your OAuth connect page
// Click "Connect MercadoPago"
// Verify redirect to MercadoPago with correct parameters
```

### 2. Test Successful Callback

```typescript
// Complete OAuth flow in MercadoPago
// Verify redirect back to your app
// Verify tokens are saved
// Verify success message is shown
// Verify cache is cleared
```

### 3. Test Error Handling

```typescript
// Test with MercadoPago error
// Manually craft callback URL with error parameter
// Verify error redirect
// Verify error message is shown
```

### 4. Test State Validation

```typescript
// Manually craft callback URL with wrong state
// Verify 400 error is returned
// Verify error message mentions invalid state
```

### 5. Test Missing Parameters

```typescript
// Manually craft callback URL without code
// Verify 400 error is returned
// Verify error message mentions missing parameter
```

## Common Migration Issues

### Issue 1: "Cannot find module '@onlemary/payment-core'"

**Cause**: Package not installed or wrong version

**Solution**:
```bash
npm install @onlemary/payment-core@latest
# or
pnpm install
```

### Issue 2: "Property 'createMercadoPagoOAuthCallbackHandlerV2' does not exist"

**Cause**: Using old version of payment-core

**Solution**: Ensure version is 0.1.19 or later:
```json
{
  "dependencies": {
    "@onlemary/payment-core": "0.1.19"
  }
}
```

### Issue 3: TypeScript errors about missing callbacks

**Cause**: Not all required callbacks are provided

**Solution**: Provide ALL four required callbacks:
```typescript
{
  validateState: (state, identifier) => state === identifier,
  getRedirectUri: (identifier) => `${baseUrl}/api/${identifier}/oauth/callback`,
  onSuccess: (identifier, tokens) => `/${identifier}/dashboard?oauth=success`,
  onError: (identifier, error, errorDescription) => `/${identifier}/dashboard?error=${error}`,
}
```

### Issue 4: "BASE_URL environment variable is required"

**Cause**: Missing environment variable

**Solution**: Add to `.env`:
```bash
BASE_URL=https://yourdomain.com
# or for Next.js
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### Issue 5: OAuth flow works but cache not cleared

**Cause**: Cache clearing logic not in `onSuccess` callback

**Solution**: Add cache clearing to `onSuccess`:
```typescript
onSuccess: (identifier, tokens) => {
  clearOAuthCache(identifier)
  clearPaymentCache(identifier)
  return `/${identifier}/dashboard?oauth=success`
}
```

## Rollback Plan

If you encounter issues, you can quickly rollback:

### 1. Restore Backup

```bash
cp app/api/[orgSlug]/oauth/callback/route.ts.backup app/api/[orgSlug]/oauth/callback/route.ts
```

### 2. Downgrade Package (if needed)

```bash
npm install @onlemary/payment-core@0.1.18
```

### 3. Restart Application

```bash
npm run dev
```

## Migration Examples

### Example 1: Simple Path-Based Routing

**Before**:
```typescript
const redirectUri = `${process.env.BASE_URL}/api/${orgSlug}/oauth/callback`
```

**After**:
```typescript
getRedirectUri: (identifier) => {
  return `${process.env.BASE_URL}/api/${identifier}/oauth/callback`
}
```

### Example 2: Custom Cache Clearing

**Before**:
```typescript
clearOAuthCache(orgSlug)
clearPaymentCache(orgSlug)
clearUserCache(orgSlug)
```

**After**:
```typescript
onSuccess: (identifier, tokens) => {
  clearOAuthCache(identifier)
  clearPaymentCache(identifier)
  clearUserCache(identifier)
  return `/${identifier}/dashboard?oauth=success`
}
```

### Example 3: Custom Error Logging

**Before**:
```typescript
catch (error) {
  console.error('OAuth error:', error)
  logger.error('OAuth failed', { orgSlug, error })
  // ...
}
```

**After**:
```typescript
onError: (identifier, error, errorDescription) => {
  console.error('OAuth error:', error, errorDescription)
  logger.error('OAuth failed', { identifier, error, errorDescription })
  return `/${identifier}/dashboard?error=${error}`
}
```

## Performance Considerations

The new implementation has similar performance characteristics to the old one:

- **Latency**: ~same (handler adds minimal overhead)
- **Memory**: Slightly better (no duplicate logic)
- **Bundle Size**: Smaller (shared code in payment-core)

## Next Steps

After successful migration:

1. ✅ Remove backup file
2. ✅ Update documentation
3. ✅ Deploy to staging
4. ✅ Test end-to-end
5. ✅ Deploy to production
6. ✅ Monitor for errors

## Support

For migration issues:
- GitHub Issues: https://github.com/onlemary/payment-core/issues
- Integration Guide: [oauth-callback-integration.md](./oauth-callback-integration.md)
- API Reference: [README.md](../README.md)

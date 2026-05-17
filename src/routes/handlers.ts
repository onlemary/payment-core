// src/routes/handlers.ts
// Framework-agnostic route handlers

import type {
  RouteInput,
  RouteOutput,
  GetClientFunction,
  WebhookCallbacks,
  Logger,
} from '../types.js'
import type { ProviderLoader } from '../providers/loader.js'
import { createWebhookHandler } from '../webhooks/handler.js'

/**
 * Creates a webhook route handler bound to a ProviderLoader.
 * The returned function accepts { headers, body } and returns { status, body, headers? }.
 * Framework-agnostic — works with Express, Next.js, Hono, etc.
 */
export function createWebhookRouteHandler(
  getClient: GetClientFunction,
  callbacks: WebhookCallbacks,
  logger?: Logger | null
): (input: RouteInput) => Promise<RouteOutput> {
  return async (input: RouteInput): Promise<RouteOutput> => {
    try {
      const client = await getClient()
      // Access the internal loader from the client
      const loader = (client as unknown as { _loader: ProviderLoader })._loader

      if (!loader) {
        logger?.error('Webhook handler: client has no provider loader')
        return {
          status: 500,
          body: { error: 'Internal configuration error' },
        }
      }

      const handler = createWebhookHandler(loader, callbacks, logger)
      const result = await handler(input.headers, input.body)

      return {
        status: result.status,
        body: result.body,
      }
    } catch (error) {
      logger?.error('Webhook route handler error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        status: 500,
        body: { error: 'Internal server error' },
      }
    }
  }
}

/**
 * Creates a MercadoPago OAuth connect route handler.
 * Generates the authorization URL for seller to connect their MercadoPago account.
 * 
 * @example
 * ```typescript
 * // Next.js App Router
 * export const POST = async (request: NextRequest) => {
 *   const handler = createMercadoPagoOAuthConnectHandler(
 *     getClient,
 *     (sellerId) => `${process.env.BASE_URL}/api/${sellerId}/payments/mercadopago/oauth/callback`
 *   )
 *   
 *   const body = await request.json()
 *   const result = await handler({
 *     headers: Object.fromEntries(request.headers),
 *     body,
 *   })
 *   
 *   return NextResponse.json(result.body, { status: result.status })
 * }
 * ```
 */
export function createMercadoPagoOAuthConnectHandler(
  getClient: GetClientFunction,
  getRedirectUri: (sellerId: string) => string,
  logger?: Logger | null
): (input: RouteInput) => Promise<RouteOutput> {
  return async (input: RouteInput): Promise<RouteOutput> => {
    try {
      const client = await getClient()
      const body = input.body as Record<string, unknown> | null

      if (!body || typeof body !== 'object') {
        return { status: 400, body: { error: 'Body is required' } }
      }

      const sellerId = body.sellerId as string | undefined

      if (!sellerId || typeof sellerId !== 'string') {
        return {
          status: 400,
          body: { error: 'sellerId is required' },
        }
      }

      const redirectUri = getRedirectUri(sellerId)
      const connectUrl = client.mercadopago.oauth.getConnectUrl(sellerId, redirectUri)

      logger?.info('MercadoPago OAuth connect URL generated', { sellerId })

      return {
        status: 200,
        body: {
          success: true,
          connectUrl,
          sellerId,
        },
      }
    } catch (error) {
      logger?.error('MercadoPago OAuth connect error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        status: 500,
        body: { error: 'Failed to generate MercadoPago OAuth connect URL' },
      }
    }
  }
}

/**
 * Creates a MercadoPago OAuth callback route handler.
 * Exchanges the authorization code for access tokens.
 * 
 * @example
 * ```typescript
 * // Next.js App Router
 * export const POST = async (request: NextRequest) => {
 *   const handler = createMercadoPagoOAuthCallbackHandler(getClient)
 *   
 *   const body = await request.json()
 *   const result = await handler({
 *     headers: Object.fromEntries(request.headers),
 *     body,
 *   })
 *   
 *   return NextResponse.json(result.body, { status: result.status })
 * }
 * ```
 */
export function createMercadoPagoOAuthCallbackHandler(
  getClient: GetClientFunction,
  logger?: Logger | null
): (input: RouteInput) => Promise<RouteOutput> {
  return async (input: RouteInput): Promise<RouteOutput> => {
    try {
      const client = await getClient()
      const body = input.body as Record<string, unknown> | null

      if (!body || typeof body !== 'object') {
        return { status: 400, body: { error: 'Body is required' } }
      }

      const code = body.code as string | undefined
      const sellerId = body.sellerId as string | undefined
      const redirectUri = body.redirectUri as string | undefined

      if (!code || !sellerId || !redirectUri) {
        return {
          status: 400,
          body: { error: 'Missing required fields: code, sellerId, redirectUri' },
        }
      }

      const tokens = await client.mercadopago.oauth.handleCallback(code, sellerId, redirectUri)

      logger?.info('MercadoPago OAuth callback successful', { sellerId, userId: tokens.userId })

      return {
        status: 200,
        body: {
          success: true,
          userId: tokens.userId,
          expiresAt: tokens.expiresAt.toISOString(),
        },
      }
    } catch (error) {
      logger?.error('MercadoPago OAuth callback error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        status: 500,
        body: { error: 'MercadoPago OAuth callback failed' },
      }
    }
  }
}

/**
 * Creates a MercadoPago OAuth status route handler.
 * Returns the OAuth connection status for a seller.
 * 
 * @example
 * ```typescript
 * // Next.js App Router
 * export const POST = async (request: NextRequest) => {
 *   const handler = createMercadoPagoOAuthStatusHandler(getClient)
 *   
 *   const body = await request.json()
 *   const result = await handler({
 *     headers: Object.fromEntries(request.headers),
 *     body,
 *   })
 *   
 *   return NextResponse.json(result.body, { status: result.status })
 * }
 * ```
 */
export function createMercadoPagoOAuthStatusHandler(
  getClient: GetClientFunction,
  logger?: Logger | null
): (input: RouteInput) => Promise<RouteOutput> {
  return async (input: RouteInput): Promise<RouteOutput> => {
    try {
      const client = await getClient()
      const body = input.body as Record<string, unknown> | null

      if (!body || typeof body !== 'object') {
        return { status: 400, body: { error: 'Body is required' } }
      }

      const sellerId = body.sellerId as string | undefined

      if (!sellerId || typeof sellerId !== 'string') {
        return {
          status: 400,
          body: { error: 'sellerId is required' },
        }
      }

      const status = await client.mercadopago.oauth.getStatus(sellerId)

      logger?.info('MercadoPago OAuth status checked', { sellerId, connected: status.connected })

      return {
        status: 200,
        body: {
          success: true,
          ...status,
          connectedAt: status.connectedAt?.toISOString() || null,
          expiresAt: status.expiresAt?.toISOString() || null,
        },
      }
    } catch (error) {      
      logger?.error('MercadoPago OAuth status check error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return {
        status: 500,
        body: { error: 'Failed to check MercadoPago OAuth status' },
      }
    }
  }
}

/**
 * Creates a MercadoPago OAuth disconnect route handler.
 * Disconnects a seller's MercadoPago OAuth connection (removes tokens).
 * 
 * @example
 * ```typescript
 * // Next.js App Router
 * export const POST = async (request: NextRequest) => {
 *   const handler = createMercadoPagoOAuthDisconnectHandler(getClient)
 *   
 *   const body = await request.json()
 *   const result = await handler({
 *     headers: Object.fromEntries(request.headers),
 *     body,
 *   })
 *   
 *   return NextResponse.json(result.body, { status: result.status })
 * }
 * ```
 */
export function createMercadoPagoOAuthDisconnectHandler(
  getClient: GetClientFunction,
  logger?: Logger | null
): (input: RouteInput) => Promise<RouteOutput> {
  return async (input: RouteInput): Promise<RouteOutput> => {
    try {
      const client = await getClient()
      const body = input.body as Record<string, unknown> | null

      if (!body || typeof body !== 'object') {
        return { status: 400, body: { error: 'Body is required' } }
      }

      const sellerId = body.sellerId as string | undefined

      if (!sellerId || typeof sellerId !== 'string') {
        return {
          status: 400,
          body: { error: 'sellerId is required' },
        }
      }

      const success = await client.mercadopago.oauth.disconnect(sellerId)

      logger?.info('MercadoPago OAuth disconnect', { sellerId, success })

      return {
        status: 200,
        body: {
          success,
          message: success ? 'OAuth connection disconnected' : 'No connection found',
        },
      }
    } catch (error) {
      logger?.error('MercadoPago OAuth disconnect error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        status: 500,
        body: { error: 'Failed to disconnect MercadoPago OAuth connection' },
      }
    }
  }
}

/**
 * Creates a health check route handler.
 * Returns provider health status.
 */
export function createHealthCheckHandler(
  getClient: GetClientFunction,
  logger?: Logger | null
): (input: RouteInput) => Promise<RouteOutput> {
  return async (_input: RouteInput): Promise<RouteOutput> => {
    try {
      const client = await getClient()
      const health = client.getProviderHealth()

      return {
        status: 200,
        body: { health },
      }
    } catch (error) {
      logger?.error('Health check error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        status: 500,
        body: { error: 'Health check failed' },
      }
    }
  }
}


// ============================================
// CHECKOUT ROUTE HANDLERS
// ============================================

import type { 
  PaymentClientConfig, 
  MPPaymentMethodData, 
  StripePaymentMethodData, 
  PayPalPaymentMethodData, 
  CustomerData 
} from '../types.js'
import { createPaymentClient } from '../client.js'

/**
 * Configuration for payment route handler
 */
export interface PaymentRouteHandlerConfig {
  /** Function to get provider config for an organization */
  getConfig: (orgSlug: string) => Promise<{
    provider: 'mercadopago' | 'stripe' | 'paypal'
    credentials: Record<string, string>
  }>

  /** Called before creating payment (validation, logging, etc.) */
  beforeCreate?: (params: {
    orgSlug: string
    amount: number
    paymentMethod: string
    invoiceIds?: string[]
    customer?: { email?: string; name?: string }
  }) => Promise<void | Error>

  /** Called after payment is created successfully */
  afterCreate?: (payment: {
    paymentId: string
    provider: string
    status: string
    amount: number
  }) => Promise<void>

  /** Called on error */
  onError?: (error: Error, params: Record<string, unknown>) => Promise<void>

  /** Logger instance */
  logger?: Logger
}

// ─── Payment Method Builders ──────────────────────────────────────

function getNestedString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const val = (value as Record<string, unknown>)[key]
  return typeof val === 'string' ? val : undefined
}

function buildCustomerData(raw: unknown): CustomerData | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>
  if (typeof obj.email !== 'string' || !obj.email) return undefined
  return {
    email: obj.email,
    name: typeof obj.name === 'string' ? obj.name : undefined,
  }
}

function buildPaymentMethodData(
  provider: 'mercadopago' | 'stripe' | 'paypal',
  input: {
    cardToken: string | undefined
    paymentMethod: string
    customerEmail: string | undefined
    returnUrl: string | undefined
    cancelUrl: string | undefined
  },
): MPPaymentMethodData | StripePaymentMethodData | PayPalPaymentMethodData {
  switch (provider) {
    case 'mercadopago':
      return {
        type: 'mercadopago',
        token: input.cardToken ?? '',
        paymentMethodId: input.paymentMethod,
        payerEmail: input.customerEmail ?? '',
      }
    case 'stripe':
      return {
        type: 'stripe',
        paymentMethodId: input.cardToken ?? '',
      }
    case 'paypal':
      return {
        type: 'paypal',
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
      }
  }
}

/**
 * Creates a payment creation route handler.
 * 
 * @example
 * ```typescript
 * // Next.js App Router
 * export const POST = async (request: NextRequest) => {
 *   const handler = createPaymentRouteHandler({
 *     getConfig: async (orgSlug) => {
 *       const config = await getOrgConfig(orgSlug)
 *       return {
 *         provider: 'mercadopago',
 *         credentials: {
 *           accessToken: config.mercadopago.accessToken,
 *         },
 *       }
 *     },
 *   })
 *   
 *   const body = await request.json()
 *   const result = await handler({
 *     headers: Object.fromEntries(request.headers),
 *     body,
 *   })
 *   
 *   return NextResponse.json(result.body, { status: result.status })
 * }
 * ```
 */
export function createPaymentRouteHandler(
  config: PaymentRouteHandlerConfig
): (input: RouteInput) => Promise<RouteOutput> {
  return async (input: RouteInput): Promise<RouteOutput> => {
    const body = input.body as Record<string, unknown> | null

    try {
      // 1. Validate body
      if (!body || typeof body !== 'object') {
        return { status: 400, body: { error: 'Request body is required' } }
      }

      const { orgSlug, amount, paymentMethod, invoiceIds, customer, cardToken, idempotencyKey } = body

      // 2. Validate required fields
      if (!orgSlug || typeof orgSlug !== 'string') {
        return { status: 400, body: { error: 'orgSlug is required' } }
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return { status: 400, body: { error: 'amount must be a positive number' } }
      }

      if (!paymentMethod || typeof paymentMethod !== 'string') {
        return { status: 400, body: { error: 'paymentMethod is required' } }
      }

      // 3. Get provider config
      const providerConfig = await config.getConfig(orgSlug)

      // 4. Build payment params
      const params = {
        orgSlug,
        amount,
        paymentMethod,
        invoiceIds: invoiceIds as string[] | undefined,
        customer: customer as { email?: string; name?: string } | undefined,
        cardToken: cardToken as string | undefined,
        idempotencyKey: idempotencyKey as string | undefined,
      }

      // 5. Call beforeCreate hook
      if (config.beforeCreate) {
        const hookError = await config.beforeCreate(params)
        if (hookError instanceof Error) {
          config.logger?.info('beforeCreate hook rejected payment', {
            orgSlug,
            error: hookError.message,
          })
          return { status: 400, body: { error: hookError.message } }
        }
      }

      // 6. Create payment client config
      const clientConfig: PaymentClientConfig = {
        providers: {
          [providerConfig.provider]: {
            credentials: providerConfig.credentials,
          },
        },
      }

      // 7. Create payment client
      const paymentClient = await createPaymentClient(clientConfig)

      // 8. Build payment method data per provider
      const paymentMethodData = buildPaymentMethodData(
        providerConfig.provider,
        {
          cardToken: cardToken as string | undefined,
          paymentMethod: paymentMethod as string,
          customerEmail: getNestedString(customer, 'email'),
          returnUrl: body.returnUrl as string | undefined,
          cancelUrl: body.cancelUrl as string | undefined,
        },
      )

      // 9. Build customer data
      const customerData = buildCustomerData(customer)

      // 10. Create payment
      const payment = await paymentClient.payments.create({
        amount,
        currency: 'ARS', // Default, could be from body
        paymentMethod: paymentMethodData,
        customer: customerData,
        idempotencyKey: idempotencyKey as string | undefined,
        metadata: {
          orgSlug: orgSlug as string,
          invoiceIds: Array.isArray(invoiceIds) ? invoiceIds.join(',') : '',
        },
      })

      // 10. Call afterCreate hook
      if (config.afterCreate) {
        await config.afterCreate({
          paymentId: payment.paymentId!,
          provider: providerConfig.provider,
          status: payment.status!,
          amount,
        })
      }

      config.logger?.info('Payment created', {
        orgSlug,
        paymentId: payment.paymentId,
        provider: providerConfig.provider,
      })

      // 11. Return response
      return {
        status: 200,
        body: {
          success: payment.success,
          paymentId: payment.paymentId,
          provider: payment.provider,
          status: payment.status,
          statusDetail: payment.statusDetail,
          error: payment.error,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Call onError hook
      if (config.onError) {
        await config.onError(error as Error, body || {})
      }

      config.logger?.error('Payment creation error', {
        error: errorMessage,
        orgSlug: body?.orgSlug,
      })

      return {
        status: 500,
        body: { error: errorMessage },
      }
    }
  }
}

/**
 * Configuration for status route handler
 */
export interface StatusRouteHandlerConfig {
  /** Function to get provider config for an organization */
  getConfig: (orgSlug: string) => Promise<{
    provider: 'mercadopago' | 'stripe' | 'paypal'
    credentials: Record<string, string>
  }>

  /** Called when status changes */
  onStatusChange?: (paymentId: string, status: string) => Promise<void>

  /** Logger instance */
  logger?: Logger
}

/**
 * Creates a payment status route handler.
 * 
 * @example
 * ```typescript
 * // Next.js App Router
 * export const GET = async (
 *   request: NextRequest,
 *   { params }: { params: { paymentId: string } }
 * ) => {
 *   const handler = createStatusRouteHandler({
 *     getConfig: async (orgSlug) => { ... },
 *   })
 *   
 *   const result = await handler({
 *     headers: Object.fromEntries(request.headers),
 *     body: { paymentId: params.paymentId, orgSlug: 'gym_iron' },
 *   })
 *   
 *   return NextResponse.json(result.body, { status: result.status })
 * }
 * ```
 */
export function createStatusRouteHandler(
  config: StatusRouteHandlerConfig
): (input: RouteInput) => Promise<RouteOutput> {
  return async (input: RouteInput): Promise<RouteOutput> => {
    const body = input.body as Record<string, unknown> | null

    try {
      if (!body || typeof body !== 'object') {
        return { status: 400, body: { error: 'Request body is required' } }
      }

      const { paymentId, orgSlug } = body

      if (!paymentId || typeof paymentId !== 'string') {
        return { status: 400, body: { error: 'paymentId is required' } }
      }

      if (!orgSlug || typeof orgSlug !== 'string') {
        return { status: 400, body: { error: 'orgSlug is required' } }
      }

      // Get provider config
      const providerConfig = await config.getConfig(orgSlug)

      // Create payment client config
      const clientConfig: PaymentClientConfig = {
        providers: {
          [providerConfig.provider]: {
            credentials: providerConfig.credentials,
          },
        },
      }

      // Create payment client
      const paymentClient = await createPaymentClient(clientConfig)

      // Get payment status
      const payment = await paymentClient.payments.get(paymentId)

      // Call onStatusChange hook
      if (config.onStatusChange) {
        await config.onStatusChange(paymentId, payment.status)
      }

      return {
        status: 200,
        body: {
          id: payment.id,
          status: payment.status,
          providerStatus: payment.providerStatus,
          statusDetail: payment.statusDetail,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
          provider: payment.provider,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      config.logger?.error('Status check error', {
        error: errorMessage,
        paymentId: body?.paymentId,
      })

      return {
        status: 500,
        body: { error: errorMessage },
      }
    }
  }
}

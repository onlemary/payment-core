/**
 * OAuth Types
 * 
 * Common types for OAuth flows across all providers.
 */

export type OAuthProvider = 'mercadopago' | 'stripe' | 'paypal'

export type OAuthConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface OAuthState {
  /** Current connection state */
  state: OAuthConnectionState
  /** Whether the account is connected */
  connected: boolean
  /** User/Account ID from the provider */
  userId?: string
  /** When the connection was established */
  connectedAt?: Date
  /** When the token expires */
  expiresAt?: Date
  /** Error message if state is 'error' */
  error?: string
  /** Whether an operation is in progress */
  loading: boolean
}

export interface OAuthConfig {
  /** Organization slug */
  orgSlug: string
  /** Base URL for API calls */
  baseUrl?: string
  /** Called when connection succeeds */
  onSuccess?: (userId: string) => void
  /** Called when connection fails */
  onError?: (error: Error) => void
  /** Called when disconnection succeeds */
  onDisconnect?: () => void
}

export interface OAuthActions {
  /** Initiate OAuth connection flow */
  connect: () => Promise<void>
  /** Disconnect OAuth connection */
  disconnect: () => Promise<void>
  /** Refresh connection status */
  refresh: () => Promise<void>
}

export interface UseOAuthReturn extends OAuthActions {
  /** Current OAuth state */
  state: OAuthState
}

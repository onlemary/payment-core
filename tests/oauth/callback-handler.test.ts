/**
 * Tests for Generic OAuth Callback Handler
 */

import { describe, it, expect, vi } from 'vitest'
import { createGenericOAuthCallbackHandler } from '../../src/oauth/callback-handler.js'
import type { OAuthCallbackHandlerOptions } from '../../src/oauth/types.js'

describe('createGenericOAuthCallbackHandler', () => {
  describe('validation', () => {
    it('should throw when validateState callback is missing', () => {
      const options = {
        // validateState: missing
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success',
        onError: () => '/error'
      } as unknown as OAuthCallbackHandlerOptions

      expect(() => createGenericOAuthCallbackHandler(options)).toThrow('Missing required OAuth callback: validateState')
    })

    it('should throw when getRedirectUri callback is missing', () => {
      const options = {
        validateState: () => true,
        // getRedirectUri: missing
        onSuccess: () => '/success',
        onError: () => '/error'
      } as unknown as OAuthCallbackHandlerOptions

      expect(() => createGenericOAuthCallbackHandler(options)).toThrow('Missing required OAuth callback: getRedirectUri')
    })

    it('should throw when onSuccess callback is missing', () => {
      const options = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        // onSuccess: missing
        onError: () => '/error'
      } as unknown as OAuthCallbackHandlerOptions

      expect(() => createGenericOAuthCallbackHandler(options)).toThrow('Missing required OAuth callback: onSuccess')
    })

    it('should throw when onError callback is missing', () => {
      const options = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success'
        // onError: missing
      } as unknown as OAuthCallbackHandlerOptions

      expect(() => createGenericOAuthCallbackHandler(options)).toThrow('Missing required OAuth callback: onError')
    })

    it('should throw when multiple callbacks are missing', () => {
      const options = {
        validateState: () => true
        // getRedirectUri, onSuccess, onError: missing
      } as unknown as OAuthCallbackHandlerOptions

      expect(() => createGenericOAuthCallbackHandler(options)).toThrow('Missing required OAuth callbacks: getRedirectUri, onSuccess, onError')
    })

    it('should not throw when all callbacks are provided', () => {
      const options: OAuthCallbackHandlerOptions = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success',
        onError: () => '/error'
      }

      expect(() => createGenericOAuthCallbackHandler(options)).not.toThrow()
    })
  })

  describe('extractParams', () => {
    it('should extract parameters from query', () => {
      const options: OAuthCallbackHandlerOptions = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success',
        onError: () => '/error'
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const params = handler.extractParams({
        headers: {},
        body: {},
        query: { code: 'ABC123', state: 'gym_iron' }
      })

      expect(params.code).toBe('ABC123')
      expect(params.state).toBe('gym_iron')
    })

    it('should extract parameters from body.url', () => {
      const options: OAuthCallbackHandlerOptions = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success',
        onError: () => '/error'
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const params = handler.extractParams({
        headers: {},
        body: { url: 'https://example.com/callback?code=ABC123&state=gym_iron' },
        query: undefined
      })

      expect(params.code).toBe('ABC123')
      expect(params.state).toBe('gym_iron')
    })
  })

  describe('validateState', () => {
    it('should call validateState callback with correct parameters', async () => {
      const validateState = vi.fn().mockReturnValue(true)
      const options: OAuthCallbackHandlerOptions<string> = {
        validateState,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success',
        onError: () => '/error'
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const result = await handler.validateState('gym_iron', 'gym_iron')

      expect(validateState).toHaveBeenCalledWith('gym_iron', 'gym_iron')
      expect(result).toBe(true)
    })

    it('should return false when validation fails', async () => {
      const validateState = vi.fn().mockReturnValue(false)
      const options: OAuthCallbackHandlerOptions<string> = {
        validateState,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success',
        onError: () => '/error'
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const result = await handler.validateState('malicious', 'gym_iron')

      expect(result).toBe(false)
    })

    it('should support async validation', async () => {
      const validateState = vi.fn().mockResolvedValue(true)
      const options: OAuthCallbackHandlerOptions<string> = {
        validateState,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success',
        onError: () => '/error'
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const result = await handler.validateState('gym_iron', 'gym_iron')

      expect(result).toBe(true)
    })
  })

  describe('handleSuccess', () => {
    it('should call onSuccess callback with correct parameters', async () => {
      const onSuccess = vi.fn().mockReturnValue('/success')
      const options: OAuthCallbackHandlerOptions<string> = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess,
        onError: () => '/error'
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const tokens = { accessToken: 'token123', userId: 456 }
      const redirectUrl = await handler.handleSuccess('gym_iron', tokens)

      expect(onSuccess).toHaveBeenCalledWith('gym_iron', tokens)
      expect(redirectUrl).toBe('/success')
    })

    it('should convert URL object to string', async () => {
      const onSuccess = vi.fn().mockReturnValue(new URL('https://example.com/success'))
      const options: OAuthCallbackHandlerOptions<string> = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess,
        onError: () => '/error'
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const redirectUrl = await handler.handleSuccess('gym_iron', {})

      expect(redirectUrl).toBe('https://example.com/success')
    })

    it('should support async onSuccess', async () => {
      const onSuccess = vi.fn().mockResolvedValue('/success')
      const options: OAuthCallbackHandlerOptions<string> = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess,
        onError: () => '/error'
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const redirectUrl = await handler.handleSuccess('gym_iron', {})

      expect(redirectUrl).toBe('/success')
    })
  })

  describe('handleError', () => {
    it('should call onError callback with correct parameters', async () => {
      const onError = vi.fn().mockReturnValue('/error')
      const options: OAuthCallbackHandlerOptions<string> = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success',
        onError
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const redirectUrl = await handler.handleError('gym_iron', 'access_denied', 'User cancelled')

      expect(onError).toHaveBeenCalledWith('gym_iron', 'access_denied', 'User cancelled')
      expect(redirectUrl).toBe('/error')
    })

    it('should handle error without description', async () => {
      const onError = vi.fn().mockReturnValue('/error')
      const options: OAuthCallbackHandlerOptions<string> = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success',
        onError
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const redirectUrl = await handler.handleError('gym_iron', 'access_denied')

      expect(onError).toHaveBeenCalledWith('gym_iron', 'access_denied', undefined)
      expect(redirectUrl).toBe('/error')
    })

    it('should convert URL object to string', async () => {
      const onError = vi.fn().mockReturnValue(new URL('https://example.com/error'))
      const options: OAuthCallbackHandlerOptions<string> = {
        validateState: () => true,
        getRedirectUri: () => 'https://example.com/callback',
        onSuccess: () => '/success',
        onError
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const redirectUrl = await handler.handleError('gym_iron', 'access_denied')

      expect(redirectUrl).toBe('https://example.com/error')
    })
  })

  describe('generic type support', () => {
    it('should work with string identifier', async () => {
      const options: OAuthCallbackHandlerOptions<string> = {
        validateState: (state, identifier) => state === identifier,
        getRedirectUri: (identifier) => `https://example.com/${identifier}/callback`,
        onSuccess: (identifier) => `/${identifier}/success`,
        onError: (identifier) => `/${identifier}/error`
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const result = await handler.validateState('gym_iron', 'gym_iron')
      expect(result).toBe(true)
    })

    it('should work with number identifier', async () => {
      const options: OAuthCallbackHandlerOptions<number> = {
        validateState: (state, identifier) => state === identifier.toString(),
        getRedirectUri: (identifier) => `https://example.com/user/${identifier}/callback`,
        onSuccess: (identifier) => `/user/${identifier}/success`,
        onError: (identifier) => `/user/${identifier}/error`
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const result = await handler.validateState('123', 123)
      expect(result).toBe(true)
    })

    it('should work with custom object identifier', async () => {
      interface CustomIdentifier {
        orgId: string
        userId: number
      }

      const options: OAuthCallbackHandlerOptions<CustomIdentifier> = {
        validateState: (state, identifier) => state === `${identifier.orgId}-${identifier.userId}`,
        getRedirectUri: (identifier) => `https://example.com/${identifier.orgId}/callback`,
        onSuccess: (identifier) => `/${identifier.orgId}/success`,
        onError: (identifier) => `/${identifier.orgId}/error`
      }

      const handler = createGenericOAuthCallbackHandler(options)

      const identifier = { orgId: 'gym_iron', userId: 123 }
      const result = await handler.validateState('gym_iron-123', identifier)
      expect(result).toBe(true)
    })
  })
})

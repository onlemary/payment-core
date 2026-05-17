/**
 * Tests for Generic OAuth Utilities
 */

import { describe, it, expect } from 'vitest'
import {
  extractParams,
  extractParamsFromUrl,
  validateRequiredParams,
  hasProviderError,
  formatOAuthError
} from '../../src/oauth/utils.js'

describe('extractParams', () => {
  it('should extract parameters from RouteInput.query', () => {
    const input = {
      headers: {},
      body: {},
      query: {
        code: 'ABC123',
        state: 'gym_iron',
        error: undefined,
        error_description: undefined
      }
    }

    const params = extractParams(input)

    expect(params).toEqual({
      code: 'ABC123',
      state: 'gym_iron',
      error: undefined,
      error_description: undefined
    })
  })

  it('should extract parameters from RouteInput.body.url', () => {
    const input = {
      headers: {},
      body: {
        url: 'https://example.com/callback?code=ABC123&state=gym_iron'
      },
      query: undefined
    }

    const params = extractParams(input)

    expect(params.code).toBe('ABC123')
    expect(params.state).toBe('gym_iron')
  })

  it('should throw error when neither query nor body.url is present', () => {
    const input = {
      headers: {},
      body: {},
      query: undefined
    }

    expect(() => extractParams(input)).toThrow('Missing OAuth callback parameters')
  })

  it('should throw error when body is null', () => {
    const input = {
      headers: {},
      body: null,
      query: undefined
    }

    expect(() => extractParams(input)).toThrow('Missing OAuth callback parameters')
  })

  it('should throw error when body.url is not a string', () => {
    const input = {
      headers: {},
      body: { url: 123 },
      query: undefined
    }

    expect(() => extractParams(input)).toThrow('Missing OAuth callback parameters')
  })
})

describe('extractParamsFromUrl', () => {
  it('should extract parameters from absolute URL', () => {
    const url = 'https://example.com/callback?code=ABC123&state=gym_iron'
    const params = extractParamsFromUrl(url)

    expect(params.code).toBe('ABC123')
    expect(params.state).toBe('gym_iron')
  })

  it('should extract parameters from relative URL', () => {
    const url = '/callback?code=ABC123&state=gym_iron'
    const params = extractParamsFromUrl(url)

    expect(params.code).toBe('ABC123')
    expect(params.state).toBe('gym_iron')
  })

  it('should handle URL with error parameters', () => {
    const url = 'https://example.com/callback?error=access_denied&error_description=User%20cancelled'
    const params = extractParamsFromUrl(url)

    expect(params.error).toBe('access_denied')
    expect(params.error_description).toBe('User cancelled')
  })

  it('should handle URL without query string', () => {
    const url = 'https://example.com/callback'
    const params = extractParamsFromUrl(url)

    expect(params.code).toBeUndefined()
    expect(params.state).toBeUndefined()
    expect(params.error).toBeUndefined()
    expect(params.error_description).toBeUndefined()
  })

  it('should handle URL with hash fragments', () => {
    const url = 'https://example.com/callback?code=ABC123&state=gym_iron#section'
    const params = extractParamsFromUrl(url)

    expect(params.code).toBe('ABC123')
    expect(params.state).toBe('gym_iron')
  })

  it('should throw error for malformed URL', () => {
    const url = 'not a valid url'
    expect(() => extractParamsFromUrl(url)).toThrow('Failed to parse OAuth callback URL')
  })

  it('should return undefined for missing parameters', () => {
    const url = 'https://example.com/callback?code=ABC123'
    const params = extractParamsFromUrl(url)

    expect(params.code).toBe('ABC123')
    expect(params.state).toBeUndefined()
  })
})

describe('validateRequiredParams', () => {
  it('should not throw when all required parameters are present', () => {
    const params = {
      code: 'ABC123',
      state: 'gym_iron',
      error: undefined,
      error_description: undefined
    }

    expect(() => validateRequiredParams(params, ['code', 'state'])).not.toThrow()
  })

  it('should throw when code is missing', () => {
    const params = {
      code: undefined,
      state: 'gym_iron',
      error: undefined,
      error_description: undefined
    }

    expect(() => validateRequiredParams(params, ['code', 'state'])).toThrow('Missing required OAuth parameter: code')
  })

  it('should throw when state is missing', () => {
    const params = {
      code: 'ABC123',
      state: undefined,
      error: undefined,
      error_description: undefined
    }

    expect(() => validateRequiredParams(params, ['code', 'state'])).toThrow('Missing required OAuth parameter: state')
  })

  it('should throw when multiple parameters are missing', () => {
    const params = {
      code: undefined,
      state: undefined,
      error: undefined,
      error_description: undefined
    }

    expect(() => validateRequiredParams(params, ['code', 'state'])).toThrow('Missing required OAuth parameters: code, state')
  })

  it('should not throw when no parameters are required', () => {
    const params = {
      code: undefined,
      state: undefined,
      error: undefined,
      error_description: undefined
    }

    expect(() => validateRequiredParams(params, [])).not.toThrow()
  })
})

describe('hasProviderError', () => {
  it('should return true when error parameter is present', () => {
    const params = {
      code: undefined,
      state: undefined,
      error: 'access_denied',
      error_description: 'User cancelled'
    }

    expect(hasProviderError(params)).toBe(true)
  })

  it('should return false when error parameter is not present', () => {
    const params = {
      code: 'ABC123',
      state: 'gym_iron',
      error: undefined,
      error_description: undefined
    }

    expect(hasProviderError(params)).toBe(false)
  })

  it('should return false when error is empty string', () => {
    const params = {
      code: undefined,
      state: undefined,
      error: '',
      error_description: undefined
    }

    expect(hasProviderError(params)).toBe(false)
  })
})

describe('formatOAuthError', () => {
  it('should format error with description', () => {
    const message = formatOAuthError('access_denied', 'User cancelled authorization')
    expect(message).toBe('OAuth error: access_denied - User cancelled authorization')
  })

  it('should format error without description', () => {
    const message = formatOAuthError('access_denied')
    expect(message).toBe('OAuth error: access_denied')
  })

  it('should format error with empty description', () => {
    const message = formatOAuthError('access_denied', '')
    expect(message).toBe('OAuth error: access_denied')
  })
})

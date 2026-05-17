// health/utils.ts
// Shared utilities for health checks

const SENSITIVE_KEYS = [
  'clientSecret',
  'accessToken',
  'refreshToken',
  'password',
  'apiKey',
  'secret',
  'privateKey',
  'token',
]

export function sanitizeForLog(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item))
  }

  const sanitized: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = SENSITIVE_KEYS.some(sensitiveKey =>
      lowerKey.includes(sensitiveKey.toLowerCase())
    )

    if (isSensitive) {
      sanitized[key] = '***'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

export function formatErrors(errors: Array<{ code: string; message: string; details?: any }>): string {
  return errors.map(e => {
    const details = e.details ? `\n   Details: ${JSON.stringify(sanitizeForLog(e.details), null, 2)}` : ''
    return `  - [${e.code}] ${e.message}${details}`
  }).join('\n')
}

export function formatWarnings(warnings: Array<{ code: string; message: string; details?: any }>): string {
  return warnings.map(w => {
    const details = w.details ? `\n   Details: ${JSON.stringify(sanitizeForLog(w.details), null, 2)}` : ''
    return `  - [${w.code}] ${w.message}${details}`
  }).join('\n')
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkEnvVars } from '../../src/health/checks/env-vars.js'

describe('checkEnvVars', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns pass when infra vars are present', async () => {
    const originalEnv = { ...process.env }
    process.env = {
      ...originalEnv,
      CLIENTS_DATA_PATH: '/data',
      PAYMENT_IDEMPOTENCY_RETENTION_MS: '3600000',
      PAYMENT_IDEMPOTENCY_AUTO_GENERATE: 'true',
      PAYMENT_RATE_LIMIT_MAX_REQUESTS: '100',
      PAYMENT_RATE_LIMIT_WINDOW_MS: '60000',
      PAYMENT_CB_FAILURE_THRESHOLD: '5',
      PAYMENT_CB_RESET_TIMEOUT: '30000',
      PAYMENT_CB_HALF_OPEN_REQUESTS: '3',
      PAYMENT_RETRY_MAX_ATTEMPTS: '3',
      PAYMENT_RETRY_BASE_DELAY_MS: '1000',
      PAYMENT_RETRY_MAX_DELAY_MS: '30000',
    }

    const result = await checkEnvVars({ checkInfra: true })
    expect(result.status).toBe('pass')

    process.env = originalEnv
  })

  it('returns fail when infra vars are missing', async () => {
    const originalEnv = { ...process.env }
    delete process.env.CLIENTS_DATA_PATH
    delete process.env.PAYMENT_IDEMPOTENCY_RETENTION_MS

    const result = await checkEnvVars({ checkInfra: true })
    expect(result.status).toBe('fail')
    expect(result.details?.missing).toBeDefined()
    expect((result.details?.missing as string[]).length).toBeGreaterThan(0)

    process.env = originalEnv
  })
})

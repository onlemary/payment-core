// health/checks/storage-write.ts
// Validates storage by writing, reading, and deleting test data.

import type { CheckResult } from '../types.js'
import type { TokenStorage } from '../../storage/types.js'

export async function checkStorageWrite(storage: TokenStorage): Promise<CheckResult> {
  const testProvider = '_health_test'
  const testKey = '_write_check'

  try {
    await storage.save(testProvider, testKey, { test: true, timestamp: Date.now() })

    const retrieved = await storage.get(testProvider, testKey)
    if (!retrieved) {
      return {
        status: 'fail',
        message: 'Storage write test failed: data not found after save',
      }
    }

    await storage.delete(testProvider, testKey)

    return {
      status: 'pass',
      message: 'Storage write/read/delete test passed',
    }
  } catch (error) {
    return {
      status: 'fail',
      message: 'Storage write test failed',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

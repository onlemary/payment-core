/**
 * Storage Health Check
 * 
 * Verifies that storage can read, write, and delete data.
 */

import type { TokenStorage } from '../../storage/types.js'
import type { CheckResult } from '../types.js'

export async function checkStorage(storage: TokenStorage): Promise<CheckResult> {
  try {
    const testKey = '_health_check'
    const testProvider = '_health'
    const testData = { test: true, timestamp: Date.now() }
    
    // Test write
    await storage.save(testProvider, testKey, testData)
    
    // Test read
    const data = await storage.get(testProvider, testKey)
    if (!data) {
      return {
        status: 'fail',
        message: 'Storage read failed',
        details: { error: 'Data not found after write' }
      }
    }
    
    // Verify data integrity
    if (typeof data !== 'object' || !('test' in data)) {
      return {
        status: 'fail',
        message: 'Storage data integrity check failed',
        details: { error: 'Data structure mismatch' }
      }
    }
    
    // Test delete
    const deleted = await storage.delete(testProvider, testKey)
    if (!deleted) {
      return {
        status: 'warn',
        message: 'Storage delete may have failed',
        details: { note: 'Write and read work, but delete returned false' }
      }
    }
    
    return {
      status: 'pass',
      message: 'Storage is working correctly'
    }
  } catch (error) {
    return {
      status: 'fail',
      message: 'Storage check failed',
      details: {
        error: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      }
    }
  }
}

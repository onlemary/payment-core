/**
 * Vitest Test Setup
 * 
 * Global test configuration and mocks
 */

import { vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Increase test timeout for async operations
vi.configDefaults?.({ testTimeout: 10000 })

// Cleanup after each test to prevent DOM pollution
afterEach(() => {
  cleanup()
})
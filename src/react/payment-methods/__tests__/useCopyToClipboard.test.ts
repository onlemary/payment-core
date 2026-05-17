/**
 * Tests for useCopyToClipboard hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCopyToClipboard } from '../useCopyToClipboard'

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('copies text to clipboard', async () => {
    const { result } = renderHook(() => useCopyToClipboard())
    
    act(() => {
      result.current.copy('test text', 'test-field')
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text')
  })

  it('tracks copied state for specific field', () => {
    const { result } = renderHook(() => useCopyToClipboard())
    
    act(() => {
      result.current.copy('test text', 'test-field')
    })

    expect(result.current.isCopied('test-field')).toBe(true)
    expect(result.current.isCopied('other-field')).toBe(false)
  })

  it('resets copied state after 2 seconds', () => {
    const { result } = renderHook(() => useCopyToClipboard())
    
    act(() => {
      result.current.copy('test text', 'test-field')
    })

    expect(result.current.isCopied('test-field')).toBe(true)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.isCopied('test-field')).toBe(false)
  })

  it('handles multiple fields independently', () => {
    const { result } = renderHook(() => useCopyToClipboard())
    
    act(() => {
      result.current.copy('cbu text', 'cbu')
    })

    expect(result.current.isCopied('cbu')).toBe(true)
    expect(result.current.isCopied('alias')).toBe(false)

    act(() => {
      result.current.copy('alias text', 'alias')
    })

    expect(result.current.isCopied('cbu')).toBe(false)
    expect(result.current.isCopied('alias')).toBe(true)
  })

  it('exposes copiedField state', () => {
    const { result } = renderHook(() => useCopyToClipboard())
    
    expect(result.current.copiedField).toBe(null)

    act(() => {
      result.current.copy('test text', 'test-field')
    })

    expect(result.current.copiedField).toBe('test-field')
  })

  it('copy function is stable across renders', () => {
    const { result, rerender } = renderHook(() => useCopyToClipboard())
    
    const firstCopy = result.current.copy
    
    rerender()
    
    expect(result.current.copy).toBe(firstCopy)
  })
})

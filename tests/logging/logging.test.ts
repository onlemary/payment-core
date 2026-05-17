// tests/logging/logging.test.ts

import { describe, it, expect, vi } from 'vitest'
import { ConsoleLogger, NullLogger, createLogger } from '../../src/logging/index.js'

describe('NullLogger', () => {
  it('should have all log methods that do nothing', () => {
    const logger = new NullLogger()
    // These should not throw
    expect(() => {
      logger.debug('test')
      logger.info('test')
      logger.warn('test')
      logger.error('test')
    }).not.toThrow()
  })
})

describe('ConsoleLogger', () => {
  it('should prefix messages with [payment-core]', () => {
    const logger = new ConsoleLogger()
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    logger.debug('test message')
    expect(debugSpy).toHaveBeenCalledWith('[payment-core] test message')
    debugSpy.mockRestore()
  })

  it('should use custom prefix', () => {
    const logger = new ConsoleLogger('custom')
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logger.info('hello')
    expect(infoSpy).toHaveBeenCalledWith('[custom] hello')
    infoSpy.mockRestore()
  })

  it('should include data object when provided', () => {
    const logger = new ConsoleLogger()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data = { key: 'value' }
    logger.warn('warning', data)
    expect(warnSpy).toHaveBeenCalledWith('[payment-core] warning', data)
    warnSpy.mockRestore()
  })

  it('should not include undefined data when not provided', () => {
    const logger = new ConsoleLogger()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('error msg')
    expect(errorSpy).toHaveBeenCalledWith('[payment-core] error msg')
    errorSpy.mockRestore()
  })

  it('should log debug without data', () => {
    const logger = new ConsoleLogger()
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    logger.debug('debug msg')
    expect(debugSpy).toHaveBeenCalledWith('[payment-core] debug msg')
    debugSpy.mockRestore()
  })

  it('should log debug with data', () => {
    const logger = new ConsoleLogger()
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const data = { key: 'value' }
    logger.debug('debug msg', data)
    expect(debugSpy).toHaveBeenCalledWith('[payment-core] debug msg', data)
    debugSpy.mockRestore()
  })

  it('should log info without data', () => {
    const logger = new ConsoleLogger()
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logger.info('info msg')
    expect(infoSpy).toHaveBeenCalledWith('[payment-core] info msg')
    infoSpy.mockRestore()
  })

  it('should log warn without data', () => {
    const logger = new ConsoleLogger()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('warn msg')
    expect(warnSpy).toHaveBeenCalledWith('[payment-core] warn msg')
    warnSpy.mockRestore()
  })

  it('should log error with data', () => {
    const logger = new ConsoleLogger()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const data = { code: 'ERR' }
    logger.error('error msg', data)
    expect(errorSpy).toHaveBeenCalledWith('[payment-core] error msg', data)
    errorSpy.mockRestore()
  })

  it('should log info with data', () => {
    const logger = new ConsoleLogger()
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const data = { action: 'login' }
    logger.info('info msg', data)
    expect(infoSpy).toHaveBeenCalledWith('[payment-core] info msg', data)
    infoSpy.mockRestore()
  })

  it('should log warn with data using custom prefix', () => {
    const logger = new ConsoleLogger('my-app')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data = { code: 'WARN_1' }
    logger.warn('warning', data)
    expect(warnSpy).toHaveBeenCalledWith('[my-app] warning', data)
    warnSpy.mockRestore()
  })
})

describe('createLogger', () => {
  it('should return the provided logger', () => {
    const customLogger = new NullLogger()
    const result = createLogger(customLogger)
    expect(result).toBe(customLogger)
  })

  it('should return NullLogger when null is provided', () => {
    const result = createLogger(null)
    expect(result).toBeInstanceOf(NullLogger)
  })

  it('should return NullLogger when undefined is provided', () => {
    const result = createLogger(undefined)
    expect(result).toBeInstanceOf(NullLogger)
  })

  it('should return NullLogger when no argument is provided', () => {
    const result = createLogger()
    expect(result).toBeInstanceOf(NullLogger)
  })
})

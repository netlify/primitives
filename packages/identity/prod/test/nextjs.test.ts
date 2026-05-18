import { describe, it, expect, vi, afterEach } from 'vitest'
import { triggerNextjsDynamic, resetNextjsState } from '../src/nextjs.js'

describe('triggerNextjsDynamic', () => {
  afterEach(() => {
    resetNextjsState()
  })

  it('is a no-op when next/headers is not available', () => {
    // next/headers is not installed, so require() will fail and cache null
    expect(() => {
      triggerNextjsDynamic()
    }).not.toThrow()
  })

  it('caches the "not available" result and skips on subsequent calls', () => {
    triggerNextjsDynamic()
    // Second call should return immediately
    expect(() => {
      triggerNextjsDynamic()
    }).not.toThrow()
  })

  it('calls the headers function when available', () => {
    const mockHeaders = vi.fn()
    resetNextjsState(mockHeaders)

    triggerNextjsDynamic()

    expect(mockHeaders).toHaveBeenCalledOnce()
  })

  it('calls headers on every invocation (not just the first)', () => {
    const mockHeaders = vi.fn()
    resetNextjsState(mockHeaders)

    triggerNextjsDynamic()
    triggerNextjsDynamic()
    triggerNextjsDynamic()

    expect(mockHeaders).toHaveBeenCalledTimes(3)
  })

  it('re-throws DynamicServerError (error with digest property)', () => {
    const dynamicError = new Error('DYNAMIC_SERVER_USAGE')
    ;(dynamicError as unknown as Record<string, string>).digest = 'DYNAMIC_SERVER_USAGE'
    resetNextjsState(() => {
      throw dynamicError
    })

    expect(() => {
      triggerNextjsDynamic()
    }).toThrow(dynamicError)
  })

  it('re-throws prerendering bailout errors', () => {
    const bailoutError = new Error('Bail out of prerendering')
    resetNextjsState(() => {
      throw bailoutError
    })

    expect(() => {
      triggerNextjsDynamic()
    }).toThrow(bailoutError)
  })

  it('swallows non-Dynamic errors from headers()', () => {
    resetNextjsState(() => {
      throw new Error('some other error')
    })

    expect(() => {
      triggerNextjsDynamic()
    }).not.toThrow()
  })

  it('swallows non-Error throws from headers()', () => {
    resetNextjsState(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally throwing a non-Error to test the handler
      throw 'string error'
    })

    expect(() => {
      triggerNextjsDynamic()
    }).not.toThrow()
  })

  it('skips entirely when state is set to null (not Next.js)', () => {
    const mockHeaders = vi.fn()
    resetNextjsState(null)

    triggerNextjsDynamic()

    expect(mockHeaders).not.toHaveBeenCalled()
  })
})

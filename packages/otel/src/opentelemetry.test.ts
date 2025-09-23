import { describe, test, expect } from 'vitest'
import { SimpleSpanProcessor, BatchSpanProcessor } from './opentelemetry.js'

describe('OpenTelemetry exports', () => {
  test('exports SimpleSpanProcessor', () => {
    expect(SimpleSpanProcessor).toBeDefined()
    expect(typeof SimpleSpanProcessor).toBe('function')
  })

  test('exports BatchSpanProcessor', () => {
    expect(BatchSpanProcessor).toBeDefined()
    expect(typeof BatchSpanProcessor).toBe('function')
  })
})

import { describe, test, expect } from 'vitest'
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ExportResultCode,
  trace,
  context,
} from './opentelemetry.js'

describe('OpenTelemetry exports', () => {
  test('exports SimpleSpanProcessor', () => {
    expect(SimpleSpanProcessor).toBeDefined()
    expect(typeof SimpleSpanProcessor).toBe('function')
  })

  test('exports BatchSpanProcessor', () => {
    expect(BatchSpanProcessor).toBeDefined()
    expect(typeof BatchSpanProcessor).toBe('function')
  })

  test('exports ExportResultCode', () => {
    expect(ExportResultCode).toBeDefined()
    expect(ExportResultCode.SUCCESS).toBeDefined()
    expect(ExportResultCode.FAILED).toBeDefined()
  })

  test('exports trace API', () => {
    expect(trace).toBeDefined()
    expect(typeof trace.getTracer).toBe('function')
  })

  test('exports context API', () => {
    expect(context).toBeDefined()
    expect(typeof context.active).toBe('function')
  })
})
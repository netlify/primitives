import { describe, test, expect } from 'vitest'
import { getTracer, shutdownTracers } from './main.ts'
import { SugaredTracer } from '@opentelemetry/api/experimental'
import { createTracerProvider } from './bootstrap/main.ts'

describe('`getTracer` export', () => {
  test('Returns undefined if tracing has not been previously activated', () => {
    expect(getTracer()).toBeUndefined()
  })
  test('Returns tracer if tracing has been previously activated', () => {
    createTracerProvider({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      deploymentEnvironment: 'test',
      siteUrl: 'https://example.com',
      siteId: '12345',
      siteName: 'example',
    })
    expect(getTracer()).toBeInstanceOf(SugaredTracer)
  })
})

describe('`shutdownTracers` export', () => {
  test('Returns undefined', async () => {
    await expect(shutdownTracers()).resolves.toBeUndefined()
  })
  test('Returns undefined if tracing has been previously activated', async () => {
    createTracerProvider({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      deploymentEnvironment: 'test',
      siteUrl: 'https://example.com',
      siteId: '12345',
      siteName: 'example',
    })
    await expect(shutdownTracers()).resolves.toBeUndefined()
    await expect(shutdownTracers()).resolves.toBeUndefined()
  })
})

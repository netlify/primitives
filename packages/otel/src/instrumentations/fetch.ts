import * as api from '@opentelemetry/api'
import { SugaredTracer } from '@opentelemetry/api/experimental'
import { _globalThis, W3CTraceContextPropagator } from '@opentelemetry/core'
import { InstrumentationConfig, type Instrumentation } from '@opentelemetry/instrumentation'
import { getTraceContextForwarder } from '../main.ts'

export interface FetchInstrumentationConfig extends InstrumentationConfig {
  getRequestAttributes?(headers: Request): api.Attributes
  getResponseAttributes?(response: Response): api.Attributes
  skipURLs?: (string | RegExp)[]
  skipHeaders?: (string | RegExp)[] | true
  redactHeaders?: (string | RegExp)[] | true
}

export class FetchInstrumentation implements Instrumentation {
  instrumentationName = '@netlify/otel/instrumentation-fetch'
  instrumentationVersion = '1.0.0'
  private originalFetch: typeof fetch | null = null
  private config: FetchInstrumentationConfig
  private provider?: api.TracerProvider

  constructor(config: FetchInstrumentationConfig = {}) {
    this.config = config
  }

  getConfig(): FetchInstrumentationConfig {
    return this.config
  }

  setConfig(): void { }

  setMeterProvider(): void { }
  setTracerProvider(provider: api.TracerProvider): void {
    this.provider = provider
  }
  getTracerProvider(): api.TracerProvider | undefined {
    return this.provider
  }

  private annotateFromRequest(span: api.Span, request: Request): void {
    const extras = this.config.getRequestAttributes?.(request) ?? {}
    const url = new URL(request.url)
    // these are based on @opentelemetry/semantic-convention 1.36
    span.setAttributes({
      ...extras,
      'http.request.method': request.method,
      'url.full': url.href,
      'url.host': url.host,
      'url.scheme': url.protocol.slice(0, -1),
      'server.address': url.hostname,
      'server.port': url.port,
      ...this.prepareHeaders('request', request.headers),
    })
  }

  private annotateFromResponse(span: api.Span, response: Response): void {
    const extras = this.config.getResponseAttributes?.(response) ?? {}

    // these are based on @opentelemetry/semantic-convention 1.36
    span.setAttributes({
      ...extras,
      'http.response.status_code': response.status,
      ...this.prepareHeaders('response', response.headers),
    })
  }

  private prepareHeaders(type: 'request' | 'response', headers: Headers): api.Attributes {
    if (this.config.skipHeaders === true) {
      return {}
    }
    const everything = ['*', '/.*/']
    const skips = this.config.skipHeaders ?? []
    const redacts = this.config.redactHeaders ?? []
    const everythingSkipped = skips.some((skip) => everything.includes(skip.toString()))
    const attributes: api.Attributes = {}
    if (everythingSkipped) return attributes
    const entries = headers.entries()
    for (const [key, value] of entries) {
      if (skips.some((skip) => (typeof skip == 'string' ? skip == key : skip.test(key)))) {
        continue
      }
      const attributeKey = `http.${type}.header.${key}`
      if (
        redacts === true ||
        redacts.some((redact) => (typeof redact == 'string' ? redact == key : redact.test(key)))
      ) {
        attributes[attributeKey] = 'REDACTED'
      } else {
        attributes[attributeKey] = value
      }
    }
    return attributes
  }

  private getTracer(): SugaredTracer | undefined {
    if (!this.provider) {
      return undefined
    }

    const tracer = this.provider.getTracer(this.instrumentationName, this.instrumentationVersion)
    if (tracer instanceof SugaredTracer) {
      return tracer
    }

    return new SugaredTracer(tracer)
  }

  /**
   * patch global fetch
   */
  enable(): void {
    const originalFetch = _globalThis.fetch
    this.originalFetch = originalFetch
    _globalThis.fetch = async (resource: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
      const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url
      const tracer = this.getTracer()
      if (
        !tracer ||
        this.config.skipURLs?.some((skip) => (typeof skip == 'string' ? url.startsWith(skip) : skip.test(url)))
      ) {
        return await originalFetch(resource, options)
      }

      const traceContextForwarder = getTraceContextForwarder()
      if (options?.headers && traceContextForwarder) {
        const headers = new Headers(options.headers)
        const extractedContext = traceContextForwarder(new W3CTraceContextPropagator(), headers)

        // Replace headers in options with the mutated version
        const nextOptions: RequestInit = { ...options, headers }

        return tracer.startActiveSpan('fetch', {}, extractedContext, async (span) => {
          const request = new Request(resource, nextOptions)
          this.annotateFromRequest(span, request)
          const response = await originalFetch(request, nextOptions)
          this.annotateFromResponse(span, response)
          return response
        })
      }

      return tracer.withActiveSpan('fetch', async (span) => {
        const request = new Request(resource, options)
        this.annotateFromRequest(span, request)
        const response = await originalFetch(request, options)
        this.annotateFromResponse(span, response)
        return response
      })
    }
  }

  /**
   * unpatch global fetch
   */
  disable(): void {
    if (this.originalFetch) {
      _globalThis.fetch = this.originalFetch
      this.originalFetch = null
    }
  }
}

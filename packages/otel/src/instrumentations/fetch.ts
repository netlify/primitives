import * as api from '@opentelemetry/api'
import { InstrumentationConfig, type Instrumentation } from '@opentelemetry/instrumentation'
import { _globalThis } from '@opentelemetry/core'
import { SugaredTracer } from '@opentelemetry/api/experimental'

export interface FetchInstrumentationConfig extends InstrumentationConfig {
  getRequestAttributes?(request: Request | RequestInit): api.Attributes
  getResponseAttributes?(response: Response): api.Attributes
  skipURLs?: string[]
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

  setConfig(): void {}

  setMeterProvider(): void {}
  setTracerProvider(provider: api.TracerProvider): void {
    this.provider = provider
  }
  getTracerProvider(): api.TracerProvider | undefined {
    return this.provider
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

  private annotateFromRequest(span: api.Span, request: Request): void {
    const extras = this.config.getRequestAttributes?.(request) ?? {}
    const url = new URL(request.url)
    // these are based on @opentelemetry/semantic-convention 1.36
    span.setAttributes({
      ...extras,
      'http.request.method': request.method,
      'url.full': url.href,
      'url.host': url.host,
      'url.scheme': url.protocol.replace(':', ''),
      'server.address': url.hostname,
      'server.port': url.port,
      ...this.prepareHeaders('request', request.headers),
    })
  }

  private prepareHeaders(type: 'request' | 'response', headers: Headers): api.Attributes {
    return Object.fromEntries(Array.from(headers.entries()).map(([key, value]) => [`${type}.header.${key}`, value]))
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
   * patch global fetch, http and https
   */
  enable(): void {
    const originalFetch = _globalThis.fetch
    this.originalFetch = originalFetch
    _globalThis.fetch = async (resource: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
      const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url
      const tracer = this.getTracer()
      if (!tracer || this.config.skipURLs?.some((skip) => url.startsWith(skip))) {
        return await originalFetch(resource, options)
      }

      return tracer.withActiveSpan('fetch', async (span) => {
        const request = new Request(resource, options)
        this.annotateFromRequest(span, request)
        const response = await originalFetch(resource, options)
        this.annotateFromResponse(span, response)
        return response
      })
    }
  }

  /**
   * unpatch global fetch, http and https
   */
  disable(): void {
    if (this.originalFetch) {
      _globalThis.fetch = this.originalFetch
      this.originalFetch = null
    }
  }
}

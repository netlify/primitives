import * as diagnosticsChannel from 'diagnostics_channel'

import * as api from '@opentelemetry/api'
import { SugaredTracer } from '@opentelemetry/api/experimental'
import { _globalThis } from '@opentelemetry/core'
import { InstrumentationConfig, type Instrumentation } from '@opentelemetry/instrumentation'

export interface FetchInstrumentationConfig extends InstrumentationConfig {
  getRequestAttributes?(request: FetchRequest): api.Attributes
  getResponseAttributes?(response: FetchResponse): api.Attributes
  skipURLs?: (string | RegExp)[]
  skipHeaders?: (string | RegExp)[] | true
  redactHeaders?: (string | RegExp)[] | true
}

export class FetchInstrumentation implements Instrumentation {
  instrumentationName = '@netlify/otel/instrumentation-fetch'
  instrumentationVersion = '1.0.0'
  private config: FetchInstrumentationConfig
  private provider?: api.TracerProvider

  declare private _channelSubs: ListenerRecord[]
  private _recordFromReq = new WeakMap<FetchRequest, api.Span>()

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

  private annotateFromRequest(span: api.Span, request: FetchRequest): void {
    const extras = this.config.getRequestAttributes?.(request) ?? {}
    const url = new URL(request.path, request.origin)

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

  private annotateFromResponse(span: api.Span, response: FetchResponse): void {
    const extras = this.config.getResponseAttributes?.(response) ?? {}

    // these are based on @opentelemetry/semantic-convention 1.36
    span.setAttributes({
      ...extras,
      'http.response.status_code': response.statusCode,
      ...this.prepareHeaders('response', response.headers),
    })

    span.setStatus({
      code: response.statusCode >= 400 ? api.SpanStatusCode.ERROR : api.SpanStatusCode.UNSET,
    })
  }

  private prepareHeaders(
    type: 'request' | 'response',
    headers: FetchRequest['headers'] | FetchResponse['headers'],
  ): api.Attributes {
    if (this.config.skipHeaders === true) {
      return {}
    }
    const everything = ['*', '/.*/']
    const skips = this.config.skipHeaders ?? []
    const redacts = this.config.redactHeaders ?? []
    const everythingSkipped = skips.some((skip) => everything.includes(skip.toString()))
    const attributes: api.Attributes = {}
    if (everythingSkipped) return attributes
    for (let idx = 0; idx < headers.length; idx = idx + 2) {
      const key = headers[idx].toString().toLowerCase()
      const value = headers[idx + 1].toString()
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

  private getRequestMethod(original: string): string {
    const acceptedMethods = ['HEAD', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE']

    if (acceptedMethods.includes(original.toUpperCase())) {
      return original.toUpperCase()
    }

    return '_OTHER'
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

  enable(): void {
    // https://undici.nodejs.org/#/docs/api/DiagnosticsChannel?id=diagnostics-channel-support
    this.subscribe('undici:request:create', this.onRequestCreate.bind(this))
    this.subscribe('undici:request:headers', this.onRequestHeaders.bind(this))
    this.subscribe('undici:request:trailers', this.onRequestEnd.bind(this))
    this.subscribe('undici:request:error', this.onRequestError.bind(this))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private subscribe(channelName: string, onMessage: (message: any, name: string | symbol) => void) {
    diagnosticsChannel.subscribe(channelName, onMessage)

    const unsubscribe = () => diagnosticsChannel.unsubscribe(channelName, onMessage)
    this._channelSubs.push({ name: channelName, unsubscribe })
  }

  disable() {
    this._channelSubs.forEach((sub) => {
      sub.unsubscribe()
    })
    this._channelSubs.length = 0
  }

  private onRequestCreate({ request }: { request: FetchRequest }): void {
    const tracer = this.getTracer()
    const url = new URL(request.path, request.origin)

    if (
      !tracer ||
      request.method === 'CONNECT' ||
      this.config.skipURLs?.some((skip) => (typeof skip == 'string' ? url.href.startsWith(skip) : skip.test(url.href)))
    ) {
      return
    }

    const activeCtx = api.context.active()

    const span = tracer.startSpan(
      this.getRequestMethod(request.method),
      {
        kind: api.SpanKind.CLIENT,
      },
      activeCtx,
    )

    this.annotateFromRequest(span, request)

    this._recordFromReq.set(request, span)
  }

  private onRequestHeaders({ request, response }: { request: FetchRequest; response: FetchResponse }): void {
    const span = this._recordFromReq.get(request)
    if (!span) return

    this.annotateFromResponse(span, response)
  }

  private onRequestError({ request, error }: { request: FetchRequest; error: Error }): void {
    const span = this._recordFromReq.get(request)
    if (!span) return

    span.recordException(error)
    span.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: error.message,
    })

    span.end()
    this._recordFromReq.delete(request)
  }

  private onRequestEnd({ request }: { request: FetchRequest; response: FetchResponse }): void {
    const span = this._recordFromReq.get(request)
    if (!span) return

    span.end()
    this._recordFromReq.delete(request)
  }
}

interface ListenerRecord {
  name: string
  unsubscribe: () => void
}

// https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/packages/instrumentation-undici/src/types.ts
interface FetchRequest {
  origin: string
  method: string
  path: string
  headers: string | (string | string[])[]
  addHeader: (name: string, value: string) => void
  throwOnError: boolean
  completed: boolean
  aborted: boolean
  idempotent: boolean
  contentLength: number | null
  contentType: string | null
  body: unknown
}

interface FetchResponse {
  headers: Buffer[]
  statusCode: number
  statusText: string
}

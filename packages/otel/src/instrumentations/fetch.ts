import * as diagnosticsChannel from 'diagnostics_channel'

import * as api from '@opentelemetry/api'
import { SugaredTracer } from '@opentelemetry/api/experimental'
import { _globalThis } from '@opentelemetry/core'
import { InstrumentationConfig, type Instrumentation } from '@opentelemetry/instrumentation'

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
  private config: FetchInstrumentationConfig
  private provider?: api.TracerProvider

  declare private _channelSubs: ListenerRecord[]
  private _recordFromReq = new WeakMap<UndiciRequest, api.Span>()

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

  private annotateFromRequest(span: api.Span, request: UndiciRequest): void {
    // const extras = this.config.getRequestAttributes?.(request) ?? {}
    const url = new URL(request.path, request.origin)

    // these are based on @opentelemetry/semantic-convention 1.36
    span.setAttributes({
      // ...extras,
      'http.request.method': request.method,
      'url.full': url.href,
      'url.host': url.host,
      'url.scheme': url.protocol.slice(0, -1),
      'server.address': url.hostname,
      'server.port': url.port,
    })
  }

  private annotateFromResponse(span: api.Span, response: UndiciResponse): void {
    // const extras = this.config.getResponseAttributes?.(response) ?? {}

    // these are based on @opentelemetry/semantic-convention 1.36
    span.setAttributes({
      // ...extras,
      'http.response.status_code': response.statusCode,
      'http.response.header.content-length': this.getContentLength(response),
    })

    span.setStatus({
      code: response.statusCode >= 400 ? api.SpanStatusCode.ERROR : api.SpanStatusCode.UNSET,
    })
  }

  private getContentLength(response: UndiciResponse) {
    for (let idx = 0; idx < response.headers.length; idx = idx + 2) {
      const name = response.headers[idx].toString().toLowerCase()

      if (name !== 'content-length') continue

      const value = response.headers[idx + 1]
      const contentLength = Number(value.toString())

      if (!isNaN(contentLength)) return contentLength
    }

    return undefined
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
    this.subscribe('undici:request:create', this.onRequestCreated.bind(this))
    this.subscribe('undici:request:headers', this.onResponseHeaders.bind(this))
    this.subscribe('undici:request:trailers', this.onDone.bind(this))
    this.subscribe('undici:request:error', this.onError.bind(this))
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

  private onRequestCreated({ request }: RequestMessage): void {
    const tracer = this.getTracer()
    if (!tracer) return

    const activeCtx = api.context.active()

    if (request.method === 'CONNECT') return

    const span = tracer.startSpan(
      // TODO - filter down request methods
      request.method,
      {
        kind: api.SpanKind.CLIENT,
      },
      activeCtx,
    )

    this.annotateFromRequest(span, request)

    this._recordFromReq.set(request, span)
  }

  private onResponseHeaders({ request, response }: ResponseHeadersMessage): void {
    const span = this._recordFromReq.get(request)

    if (!span) return

    this.annotateFromResponse(span, response)
  }

  private onError({ request, error }: RequestErrorMessage): void {
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

  private onDone({ request }: RequestTrailersMessage): void {
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

interface RequestMessage {
  request: UndiciRequest
}

interface ResponseHeadersMessage {
  request: UndiciRequest
  response: UndiciResponse
}

interface RequestErrorMessage {
  request: UndiciRequest
  error: Error
}

interface RequestTrailersMessage {
  request: UndiciRequest
  response: UndiciResponse
}

interface UndiciRequest {
  origin: string
  method: string
  path: string
  /**
   * Serialized string of headers in the form `name: value\r\n` for v5
   * Array of strings `[key1, value1, key2, value2]`, where values are
   * `string | string[]` for v6
   */
  headers: string | (string | string[])[]
  /**
   * Helper method to add headers (from v6)
   */
  addHeader: (name: string, value: string) => void
  throwOnError: boolean
  completed: boolean
  aborted: boolean
  idempotent: boolean
  contentLength: number | null
  contentType: string | null
  body: unknown
}

interface UndiciResponse {
  headers: Buffer[]
  statusCode: number
  statusText: string
}

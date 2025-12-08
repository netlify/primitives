import * as diagnosticsChannel from 'diagnostics_channel'
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders } from 'http'

import * as api from '@opentelemetry/api'
import { SugaredTracer } from '@opentelemetry/api/experimental'
import { _globalThis } from '@opentelemetry/core'
import { Instrumentation, InstrumentationConfig } from '@opentelemetry/instrumentation'

export interface HttpInstrumentationConfig extends InstrumentationConfig {
  getRequestAttributes?(request: ClientRequest): api.Attributes
  getResponseAttributes?(response: IncomingMessage): api.Attributes
  skipURLs?: (string | RegExp)[]
  skipHeaders?: (string | RegExp)[] | true
  redactHeaders?: (string | RegExp)[] | true
}

export class HttpInstrumentation implements Instrumentation {
  instrumentationName = '@netlify/otel/instrumentation-http'
  instrumentationVersion = '1.0.0'
  private config: HttpInstrumentationConfig
  private provider?: api.TracerProvider

  declare private _channelSubs: ListenerRecord[]
  private _recordFromReq = new WeakMap<ClientRequest, api.Span>()

  constructor(config = {}) {
    this.config = config
    this._channelSubs = []
  }

  getConfig() {
    return this.config
  }

  setConfig() {}

  setMeterProvider() {}
  setTracerProvider(provider: api.TracerProvider): void {
    this.provider = provider
  }
  getTracerProvider(): api.TracerProvider | undefined {
    return this.provider
  }

  private annotateFromRequest(span: api.Span, request: ClientRequest): void {
    const extras = this.config.getRequestAttributes?.(request) ?? {}
    const url = new URL(request.path, `${request.protocol}//${request.host}`)

    // these are based on @opentelemetry/semantic-convention 1.36
    span.setAttributes({
      ...extras,
      'http.request.method': request.method,
      'url.full': url.href,
      'url.host': url.host,
      'url.scheme': url.protocol.slice(0, -1),
      'server.address': url.hostname,
      ...this.prepareHeaders('request', request.getHeaders()),
    })
  }

  private annotateFromResponse(span: api.Span, response: IncomingMessage): void {
    const extras = this.config.getResponseAttributes?.(response) ?? {}

    // these are based on @opentelemetry/semantic-convention 1.36
    span.setAttributes({
      ...extras,
      'http.response.status_code': response.statusCode,
      ...this.prepareHeaders('response', response.headers),
    })

    span.setStatus({
      code: response.statusCode && response.statusCode >= 400 ? api.SpanStatusCode.ERROR : api.SpanStatusCode.UNSET,
    })
  }

  private prepareHeaders(
    type: 'request' | 'response',
    headers: IncomingHttpHeaders | OutgoingHttpHeaders,
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
    const entries = Object.entries(headers)
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

  private getRequestMethod(original: string): string {
    const acceptedMethods = ['HEAD', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE']

    if (acceptedMethods.includes(original.toUpperCase())) {
      return original.toUpperCase()
    }

    return '_OTHER'
  }

  getTracer() {
    if (!this.provider) {
      return undefined
    }

    const tracer = this.provider.getTracer(this.instrumentationName, this.instrumentationVersion)

    if (tracer instanceof SugaredTracer) {
      return tracer
    }

    return new SugaredTracer(tracer)
  }

  enable() {
    // Avoid to duplicate subscriptions
    if (this._channelSubs.length > 0) return

    // https://nodejs.org/docs/latest-v20.x/api/diagnostics_channel.html#http
    this.subscribe('http.client.request.start', this.onRequest.bind(this))
    this.subscribe('http.client.response.finish', this.onResponse.bind(this))
    this.subscribe('http.client.request.error', this.onError.bind(this))
  }

  disable() {
    this._channelSubs.forEach((sub) => {
      sub.unsubscribe()
    })
    this._channelSubs.length = 0
  }

  private onRequest({ request }: { request: ClientRequest }): void {
    const tracer = this.getTracer()
    const url = new URL(request.path, `${request.protocol}//${request.host}`)

    if (
      !tracer ||
      this.config.skipURLs?.some((skip) => (typeof skip == 'string' ? url.href.startsWith(skip) : skip.test(url.href)))
    ) {
      return
    }

    const span = tracer.startSpan(
      this.getRequestMethod(request.method),
      {
        kind: api.SpanKind.CLIENT,
      },
      api.context.active(),
    )

    this.annotateFromRequest(span, request)

    this._recordFromReq.set(request, span)
  }

  private onResponse({ request, response }: { request: ClientRequest; response: IncomingMessage }): void {
    const span = this._recordFromReq.get(request)

    if (!span) return

    this.annotateFromResponse(span, response)

    span.end()

    this._recordFromReq.delete(request)
  }

  private onError({ request, error }: { request: ClientRequest; error: Error }): void {
    const span = this._recordFromReq.get(request)

    if (!span) return

    span.recordException(error)
    span.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: error.name,
    })

    span.end()

    this._recordFromReq.delete(request)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private subscribe(channelName: string, onMessage: (message: any, name: string | symbol) => void) {
    diagnosticsChannel.subscribe(channelName, onMessage)
    const unsubscribe = () => diagnosticsChannel.unsubscribe(channelName, onMessage)
    this._channelSubs.push({ name: channelName, unsubscribe })
  }
}

interface ListenerRecord {
  name: string
  unsubscribe: () => void
}

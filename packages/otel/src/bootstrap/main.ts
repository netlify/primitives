import { BatchSpanProcessor, ConsoleSpanExporter, type SpanProcessor } from '@opentelemetry/sdk-trace-node'
import type { Instrumentation } from '@opentelemetry/instrumentation'
import { GET_TRACE_CONTEXT_FORWARDER, GET_TRACER, SHUTDOWN_TRACERS } from '../constants.js'
import { Context, context, W3CTraceContextPropagator } from '../opentelemetry.ts'

export interface TracerProviderOptions {
  serviceName: string
  serviceVersion: string
  deploymentEnvironment: string
  siteUrl: string
  siteId: string
  siteName: string
  instrumentations?: (Instrumentation | Promise<Instrumentation>)[]
  spanProcessors?: (SpanProcessor | Promise<SpanProcessor>)[]
  propagationHeaders?: Headers
}

export const createTracerProvider = async (options: TracerProviderOptions) => {
  const { version: nodeVersion } = await import('node:process')

  // remove the v prefix from the version to match the spec
  const runtimeVersion = nodeVersion.slice(1)

  const { W3CTraceContextPropagator } = await import('@opentelemetry/core')
  const { Resource } = await import('@opentelemetry/resources')
  const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node')
  const { registerInstrumentations } = await import('@opentelemetry/instrumentation')

  const resource = new Resource({
    'service.name': options.serviceName,
    'service.version': options.serviceVersion,
    'process.runtime.name': 'nodejs',
    'process.runtime.version': runtimeVersion,
    'deployment.environment': options.deploymentEnvironment,
    'http.url': options.siteUrl,
    'netlify.site.id': options.siteId,
    'netlify.site.name': options.siteName,
  })

  const spanProcessors = await Promise.all(options.spanProcessors ?? [await getBaseSpanProcessor()])

  const nodeTracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors,
  })

  nodeTracerProvider.register({
    propagator: new W3CTraceContextPropagator()

  })

  let traceContextForwarder: (propagator: W3CTraceContextPropagator, requestHeaders: Headers) => void

  if (options.propagationHeaders) {
    traceContextForwarder = (propagator: W3CTraceContextPropagator, requestHeaders: Headers): Context => {
      const getter = {
        keys: (carrier: Headers) => [...carrier.keys()],
        get: (carrier: Headers, key: string) => carrier.get(key) || undefined,
      }
      const extractedContext = propagator.extract(context.active(), options.propagationHeaders, getter)

      propagator?.inject(context.active(), requestHeaders, {
        set: (carrier, key, value) => {
          carrier.set(key, value)
        },
      })

      return extractedContext
    }
  }

  const instrumentations = await Promise.all(options.instrumentations ?? [])

  registerInstrumentations({
    instrumentations,
    tracerProvider: nodeTracerProvider,
  })


  const { trace } = await import('@opentelemetry/api')
  const { SugaredTracer } = await import('@opentelemetry/api/experimental')
  const { default: pkg } = await import('../../package.json', { with: { type: 'json' } })

  Object.defineProperty(globalThis, GET_TRACER, {
    enumerable: false,
    configurable: true,
    writable: false,
    value: function getTracer(name?: string, version?: string) {
      if (name) {
        return new SugaredTracer(trace.getTracer(name, version))
      }

      return new SugaredTracer(trace.getTracer(pkg.name, pkg.version))
    },
  })

  Object.defineProperty(globalThis, GET_TRACE_CONTEXT_FORWARDER, {
    enumerable: false,
    configurable: true,
    writable: false,
    value: function() {
      return traceContextForwarder
    },
  })

  Object.defineProperty(globalThis, SHUTDOWN_TRACERS, {
    enumerable: false,
    configurable: true,
    writable: false,
    value: async () => {
      return await nodeTracerProvider.shutdown()
    },
  })
}

export const getBaseSpanProcessor = async (): Promise<SpanProcessor> => {
  const { SimpleSpanProcessor } = await import('@opentelemetry/sdk-trace-node')
  const { NetlifySpanExporter } = await import('../exporters/netlify.js')

  return new SimpleSpanProcessor(new NetlifySpanExporter())
}

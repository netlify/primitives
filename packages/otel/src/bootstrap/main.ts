import { type SpanProcessor } from '@opentelemetry/sdk-trace-node'
import type { Instrumentation } from '@opentelemetry/instrumentation'
import { GET_TRACER, SHUTDOWN_TRACERS } from '../constants.js'

export interface TracerProviderOptions {
  serviceName: string
  serviceVersion: string
  deploymentEnvironment: string
  siteUrl: string
  siteId: string
  siteName: string
  instrumentations?: (Instrumentation | Promise<Instrumentation>)[]

  // List of additional span processors to be used in addition to the base one.
  extraSpanProcessors?: (SpanProcessor | Promise<SpanProcessor>)[]

  // Full list of span processors to be used. Unlike `extraSpanProcessors`, it
  // does not include the base processor. When both are used, this one takes
  // precedence.
  spanProcessors?: (SpanProcessor | Promise<SpanProcessor>)[]
}

export const createTracerProvider = async (options: TracerProviderOptions) => {
  const { version: nodeVersion } = await import('node:process')

  // remove the v prefix from the version to match the spec
  const runtimeVersion = nodeVersion.slice(1)

  const { Resource } = await import('@opentelemetry/resources')
  const { NodeTracerProvider, SimpleSpanProcessor } = await import('@opentelemetry/sdk-trace-node')

  const { registerInstrumentations } = await import('@opentelemetry/instrumentation')

  const { NetlifySpanExporter } = await import('../exporters/netlify.js')

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

  const spanProcessors = options.spanProcessors
    ? await Promise.all(options.spanProcessors ?? [])
    : [new SimpleSpanProcessor(new NetlifySpanExporter()), ...(await Promise.all(options.extraSpanProcessors ?? []))]

  const nodeTracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors,
  })

  nodeTracerProvider.register()

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

  Object.defineProperty(globalThis, SHUTDOWN_TRACERS, {
    enumerable: false,
    configurable: true,
    writable: false,
    value: async () => {
      return await nodeTracerProvider.shutdown()
    },
  })
}

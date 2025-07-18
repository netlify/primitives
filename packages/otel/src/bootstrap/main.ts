import type { SpanProcessor } from '@opentelemetry/sdk-trace-node'
import type { Instrumentation } from '@opentelemetry/instrumentation'
import { GET_TRACER, SHUTDOWN_TRACERS } from '../constants.js'

const wellKnownInstrumentations = ['http', 'undici'] as const
export interface TracerProviderOptions {
  /**
   * The request headers (checked for presence of the `x-nf-enable-tracing` header)
   */
  headers: Headers
  serviceName: string
  serviceVersion: string
  deploymentEnvironment: string
  siteUrl: string
  siteId: string
  siteName: string
  /**
   * Instrumentations to register. Defaults to ["http", "fetch", "undici"]
   */
  instrumentations?: ((typeof wellKnownInstrumentations)[number] | Instrumentation | Promise<Instrumentation>)[]
  extraSpanProcessors?: (SpanProcessor | Promise<SpanProcessor>)[]
}

export const createTracerProvider = async (options: TracerProviderOptions) => {
  if (!options.headers.has('x-nf-enable-tracing')) {
    return
  }
  const { version: nodeVersion } = await import('node:process')
  // remove the v prefix from the version to match the spec
  const runtimeVersion = nodeVersion.slice(1)

  const { Resource } = await import('@opentelemetry/resources')
  const { NodeTracerProvider, SimpleSpanProcessor } = await import('@opentelemetry/sdk-trace-node')
  const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http')
  const { UndiciInstrumentation } = await import('@opentelemetry/instrumentation-undici')
  const { registerInstrumentations } = await import('@opentelemetry/instrumentation')

  const { NetlifySpanExporter } = await import('./netlify_span_exporter.js')

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

  const nodeTracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [
      new SimpleSpanProcessor(new NetlifySpanExporter()),
      ...(await Promise.all(options.extraSpanProcessors ?? [])),
    ],
  })

  nodeTracerProvider.register()
  const instrumentations = await Promise.all(
    (options.instrumentations ?? wellKnownInstrumentations).map(async (instrumentation) => {
      if (typeof instrumentation === 'string') {
        switch (instrumentation) {
          case 'http':
            return new HttpInstrumentation()
          case 'undici':
            return new UndiciInstrumentation()
          default:
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Unknown instrumentation: ${instrumentation}`)
        }
      }
      return await instrumentation
    }),
  )

  registerInstrumentations({ instrumentations })

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

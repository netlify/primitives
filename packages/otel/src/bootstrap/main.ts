import { GET_TRACER, SHUTDOWN_TRACERS } from '../constants.js'

export const createTracerProvider = async (options: {
  headers: Headers,
  serviceName: string,
  serviceVersion: string,
  deploymentEnvironment: string,
  siteUrl: string,
  siteId: string,
  siteName: string,
}) => {
  if (!options.headers.has('x-nf-enable-tracing')) {
    return
  }
  const { version: nodeVersion } = await import('node:process')
  // remove the v prefix from the version to match the spec
  const runtimeVersion = nodeVersion.slice(1)

  const { resourceFromAttributes } = await import('@opentelemetry/resources')
  const { NodeTracerProvider, BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-node')

  const { NetlifySpanExporter } = await import('./netlify_span_exporter.js')

  const resource = resourceFromAttributes({
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
    spanProcessors: [new BatchSpanProcessor(new NetlifySpanExporter())],
  })

  nodeTracerProvider.register()

  Object.defineProperty(globalThis, GET_TRACER, {
    enumerable: false,
    configurable: true,
    writable: false,
    value: async function getTracer(name?: string, version?: string) {
      const { trace } = await import('@opentelemetry/api')
      const { SugaredTracer } = await import('@opentelemetry/api/experimental')
      if (name) {
        return new SugaredTracer(trace.getTracer(name, version))
      }

      const { default: pkg } = await import('../../package.json', { with: { type: 'json' } })
      return new SugaredTracer(trace.getTracer(pkg.name, pkg.version))
    }
  })

  Object.defineProperty(globalThis, SHUTDOWN_TRACERS, {
    enumerable: false,
    configurable: true,
    writable: false,
    value: async () => {
      return await nodeTracerProvider.shutdown()
    }
  })
}


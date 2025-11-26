import process from 'node:process'

import { trace } from '@opentelemetry/api/trace-api'
import { SugaredTracer } from '@opentelemetry/api/experimental'
import { Resource } from '@opentelemetry/resources'
import { type Instrumentation, registerInstrumentations } from '@opentelemetry/instrumentation'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { NodeTracerProvider, SimpleSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace-node'

import { GET_TRACER, SHUTDOWN_TRACERS } from '../constants.js'
import { NetlifySpanExporter } from '../exporters/netlify.js'
import packageJson from '../../package.json' with { type: 'json' }

export interface TracerProviderOptions {
  serviceName: string
  serviceVersion: string
  deploymentEnvironment: string
  siteUrl: string
  siteId: string
  siteName: string
  instrumentations?: Instrumentation[]
  spanProcessors?: SpanProcessor[]
}

export const createTracerProvider = (options: TracerProviderOptions) => {
  // Prevent multiple tracers from being created
  if (Object.getOwnPropertyNames(globalThis).includes(GET_TRACER)) return

  // remove the v prefix from the version to match the spec
  const runtimeVersion = process.version.slice(1)

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

  const spanProcessors = options.spanProcessors ?? [getBaseSpanProcessor()]

  const nodeTracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors,
  })

  nodeTracerProvider.register({
    propagator: new W3CTraceContextPropagator(),
  })

  const instrumentations = options.instrumentations ?? []

  registerInstrumentations({
    instrumentations,
    tracerProvider: nodeTracerProvider,
  })

  Object.defineProperty(globalThis, GET_TRACER, {
    enumerable: false,
    configurable: true,
    writable: false,
    value: function getTracer(name?: string, version?: string) {
      if (name) {
        return new SugaredTracer(trace.getTracer(name, version))
      }

      return new SugaredTracer(trace.getTracer(packageJson.name, packageJson.version))
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

export const getBaseSpanProcessor = (): SpanProcessor => {
  return new SimpleSpanProcessor(new NetlifySpanExporter())
}

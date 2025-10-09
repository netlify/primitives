/**
 * Re-exports of commonly used OpenTelemetry primitives
 * This ensures version compatibility when building custom exporters and processors
 */
export { context, propagation } from '@opentelemetry/api'
export { W3CTraceContextPropagator } from '@opentelemetry/core'
export { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node'

export type {
  Attributes,
  Context,
  Span,
  SpanContext,
  SpanKind,
  SpanStatus,
  SpanStatusCode,
  TimeInput,
} from '@opentelemetry/api'
export type { ExportResult, ExportResultCode } from '@opentelemetry/core'
export type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-node'

/**
 * Re-exports of commonly used OpenTelemetry primitives
 * This ensures version compatibility when building custom exporters and processors
 */
export type {
  Span,
  Context,
  Attributes,
  SpanContext,
  SpanKind,
  SpanStatus,
  SpanStatusCode,
  TimeInput,
} from '@opentelemetry/api'
export type { ExportResult, ExportResultCode } from '@opentelemetry/core'
export { SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
export type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-node'

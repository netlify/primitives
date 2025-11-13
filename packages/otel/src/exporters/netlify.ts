import { diag, SpanKind, type DiagLogger } from '@opentelemetry/api'
import { BindOnceFuture, ExportResult, ExportResultCode } from '@opentelemetry/core'
import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-node'
import { TRACE_PREFIX } from '../constants.ts'

export class NetlifySpanExporter implements SpanExporter {
  #shutdownOnce: BindOnceFuture<void>
  #logger: DiagLogger

  constructor() {
    this.#shutdownOnce = new BindOnceFuture(this.#shutdown, this)
    this.#logger = diag.createComponentLogger({
      namespace: 'netlify-span-exporter',
    })
  }

  /** Export spans. */
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.#logger.debug(`export ${spans.length.toString()} spans`)
    if (this.#shutdownOnce.isCalled) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error('Exporter has been shutdown'),
      })
      return
    }

    console.log(TRACE_PREFIX, JSON.stringify(serializeSpans(spans)))
    resultCallback({ code: ExportResultCode.SUCCESS })
  }

  /**
   * Shutdown the exporter.
   */
  shutdown(): Promise<void> {
    return this.#shutdownOnce.call()
  }

  /**
   * Called by #shutdownOnce with BindOnceFuture
   */
  #shutdown(): Promise<void> {
    this.#logger.debug('Shutting down')
    return Promise.resolve()
  }
}

// Replaces JsonTraceSerializer.serializeRequest(spans)
export function serializeSpans(spans: ReadableSpan[]): Record<string, unknown> {
  return {
    resourceSpans: spans.map((span) => {
      const spanContext = span.spanContext()
      return {
        resource: {
          attributes: toAttributes(span.resource.attributes),
          droppedAttributesCount: span.droppedAttributesCount,
        },
        scopeSpans: [
          {
            scope: {
              name: span.instrumentationLibrary.name,
              version: span.instrumentationLibrary.version,
            },
            spans: [
              {
                traceId: spanContext.traceId,
                spanId: spanContext.spanId,
                parentSpanId: span.parentSpanId,

                name: span.name,
                kind: span.kind || SpanKind.SERVER,

                startTimeUnixNano: hrTimeToNanos(span.startTime),
                endTimeUnixNano: hrTimeToNanos(span.endTime),

                attributes: toAttributes(span.attributes),
                droppedAttributesCount: span.droppedAttributesCount,

                events: span.events.map((event) => ({
                  name: event.name,
                  timeUnixNano: hrTimeToNanos(event.time),
                  attributes: toAttributes(event.attributes ?? {}),
                  droppedAttributesCount: event.droppedAttributesCount ?? 0,
                })),
                droppedEventsCount: span.droppedEventsCount,

                status: {
                  code: span.status.code,
                  message: span.status.message,
                },

                links: span.links.map((link) => ({
                  spanId: link.context.spanId,
                  traceId: link.context.traceId,
                  attributes: toAttributes(link.attributes ?? {}),
                  droppedAttributesCount: link.droppedAttributesCount ?? 0,
                })),
                droppedLinksCount: span.droppedLinksCount,
              },
            ],
          },
        ],
      }
    }),
  }
}

// Reference: opentelemetry-js/experimental/packages/otlp-transformer/src/common/internal.ts

type IAnyValue = Record<string, number | boolean | string | object>

export function toAttributes(attributes: Record<string, unknown>): IAnyValue[] {
  return Object.keys(attributes).map((key) => toKeyValue(key, attributes[key]))
}

function toKeyValue(key: string, value: unknown): IAnyValue {
  return {
    key: key,
    value: toAnyValue(value),
  }
}

function toAnyValue(value: unknown): IAnyValue {
  const t = typeof value
  if (t === 'string') return { stringValue: value as string }
  if (t === 'number') {
    if (!Number.isInteger(value)) return { doubleValue: value as number }
    return { intValue: value as number }
  }
  if (t === 'boolean') return { boolValue: value as boolean }
  if (value instanceof Uint8Array) return { bytesValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toAnyValue) } }
  if (t === 'object' && value != null)
    return {
      kvlistValue: {
        values: Object.entries(value as object).map(([k, v]) => toKeyValue(k, v)),
      },
    }

  return {}
}

function hrTimeToNanos(hrTime: [number, number]) {
  const NANOSECONDS = BigInt(1_000_000_000)
  const nanos = BigInt(Math.trunc(hrTime[0])) * NANOSECONDS + BigInt(Math.trunc(hrTime[1]))
  return nanos.toString()
}

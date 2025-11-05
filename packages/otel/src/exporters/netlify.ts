import { diag, type DiagLogger } from '@opentelemetry/api'
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

    console.log(TRACE_PREFIX, spanToJSONString(spans))
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
const spanToJSONString = (spans: ReadableSpan[]): string => {
  const serializedSpan = {
    resourceSpans: spans.map((span) => {
      const spanContext = span.spanContext()

      return {
        resource: {
          attributes: Object.entries(span.resource.attributes).map(([key, value]) => {
            return {
              key: key,
              value: {
                stringValue: value?.toString() ?? '',
              },
            }
          }),
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
                name: span.name,
                kind: span.kind,
                startTimeUnixNano: span.startTime.join(''),
                endTimeUnixNano: span.endTime.join(''),
                droppedAttributesCount: span.droppedAttributesCount,
                droppedEventsCount: span.droppedEventsCount,
                droppedLinksCount: span.droppedLinksCount,
                status: {
                  code: span.status.code,
                  message: span.status.message,
                },
                // TODO
                // "attributes": span.attributes,
                // "events": span.events,
                // "links": span.links,
              },
            ],
          },
        ],
      }
    }),
  }

  return JSON.stringify(serializedSpan)
}

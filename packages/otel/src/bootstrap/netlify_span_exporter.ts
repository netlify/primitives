import { diag, type DiagLogger } from '@opentelemetry/api'
import { BindOnceFuture, ExportResult, ExportResultCode } from '@opentelemetry/core'
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer'
import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-node'

export class NetlifySpanExporter implements SpanExporter {
  #shutdownOnce: BindOnceFuture<void>
  #logger: DiagLogger
  static #decoder = new TextDecoder()

  constructor() {
    this.#shutdownOnce = new BindOnceFuture(this.#shutdown, this)
    this.#logger = diag.createComponentLogger({
      namespace: 'netlify-span-exporter',
    })
  }

  /** Export spans. */
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.#logger.debug(`export ${spans.length} spans`)
    if (this.#shutdownOnce.isCalled) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error('Exporter has been shutdown'),
      })
      return
    }

    console.log('__nfOTLPTrace', NetlifySpanExporter.#decoder.decode(JsonTraceSerializer.serializeRequest(spans)))
    return resultCallback({ code: ExportResultCode.SUCCESS })
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

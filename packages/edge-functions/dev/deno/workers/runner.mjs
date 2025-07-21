// @ts-check
/// <reference lib="deno.worker" />
import { handleRequest } from '../bootstrap.mjs'

/**
 * @typedef {import('./types.ts').Message} Message
 * @typedef {import('./types.ts').RunResponseStartMessage} RunResponseStartMessage
 * @typedef {import('./types.ts').RunResponseChunkMessage} RunResponseChunkMessage
 * @typedef {import('./types.ts').RunResponseEndMessage} RunResponseEndMessage
 */

const consoleLog = globalThis.console.log
/** @type {Map<string, string>} */
const fetchRewrites = new Map()

/** @type {DedicatedWorkerGlobalScope} */
// @ts-ignore We are inside a worker, so the global scope is `DedicatedWorkerGlobalScope`.
const worker = globalThis

worker.addEventListener('message', async (e) => {
  const message = /** @type {Message} */ (e.data)

  if (message.type === 'request') {
    const body = message.data.method === 'GET' || message.data.method === 'HEAD' ? undefined : message.data.body
    const req = new Request(message.data.url, {
      body,
      headers: message.data.headers,
      method: message.data.method,
    })

    /** @type {Record<string, string>} */
    const functions = {}

    const imports = Object.entries(message.data.functions).map(async ([name, path]) => {
      const func = await import(path)

      functions[name] = func.default
    })

    await Promise.allSettled(imports)

    const res = await handleRequest(req, functions, {
      // @ts-ignore TODO: Figure out why `fetchRewrites` is not being picked up
      // as part of the type.
      fetchRewrites,
      rawLogger: consoleLog,
      requestTimeout: message.data.timeout,
    })

    worker.postMessage(
      /** @type {RunResponseStartMessage} */ ({
        type: 'responseStart',
        data: {
          headers: Object.fromEntries(res.headers.entries()),
          status: res.status,
          hasBody: Boolean(res.body),
        },
      }),
    )

    const reader = res.body?.getReader()
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        // @ts-expect-error TODO: Figure out type mismatch.
        worker.postMessage(
          /** @type {RunResponseChunkMessage} */ ({
            type: 'responseChunk',
            data: { chunk: value },
          }),
          [value.buffer],
        )
      }
    }

    worker.postMessage(/** @type {RunResponseEndMessage} */ ({ type: 'responseEnd' }))

    return
  }

  throw new Error('Unsupported message')
})

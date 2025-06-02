// @ts-check

/**
 * @typedef {import('./types.js').Message} Message
 * @typedef {import('./types.js').RunResponseStartMessage} RunResponseStartMessage
 * @typedef {import('./types.js').RunResponseChunkMessage} RunResponseChunkMessage
 * @typedef {import('./types.js').RunResponseEndMessage} RunResponseEndMessage
 */

const consoleLog = globalThis.console.log
/** @type {Map<string, string>} */
const fetchRewrites = new Map()

self.onmessage = async (e) => {
  const message = /** @type {Message} */ (e.data)

  if (message.type === 'request') {
    const { handleRequest } = await import(message.data.bootstrapURL)
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
      fetchRewrites,
      rawLogger: consoleLog,
      requestTimeout: message.data.timeout,
    })

    self.postMessage(
      /** @type {RunResponseStartMessage} */ ({
        type: 'responseStart',
        data: {
          headers: Object.fromEntries(res.headers.entries()),
          status: res.status,
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

        self.postMessage(
          /** @type {RunResponseChunkMessage} */ ({
            type: 'responseChunk',
            data: { chunk: value },
          }),
          [value.buffer],
        )
      }
    }

    self.postMessage(/** @type {RunResponseEndMessage} */ ({ type: 'responseEnd' }))

    return
  }

  throw new Error('Unsupported message')
}

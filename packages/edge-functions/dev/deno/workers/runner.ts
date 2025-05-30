import type { Message, RunResponseStartMessage, RunResponseChunkMessage, RunResponseEndMessage } from './types.ts'

// The timeout imposed by the edge nodes. It's important to keep this in place
// as a fallback in case we're unable to patch `fetch` to add our own here.
// https://github.com/netlify/stargate/blob/b5bc0eeb79bbbad3a8a6f41c7c73f1bcbcb8a9c8/proxy/deno/edge.go#L77
const UPSTREAM_REQUEST_TIMEOUT = 37_000

// The overall timeout should be at most the limit imposed by the edge nodes
// minus a buffer that gives us enough time to send back a response.
const REQUEST_TIMEOUT = UPSTREAM_REQUEST_TIMEOUT - 1_000

const consoleLog = globalThis.console.log
const fetchRewrites = new Map<string, string>()

self.onmessage = async (e) => {
  const message = e.data as Message

  if (message.type === 'request') {
    const { handleRequest } = await import(message.data.bootstrapURL)
    const body = message.data.method === 'GET' || message.data.method === 'HEAD' ? undefined : message.data.body
    const req = new Request(message.data.url, {
      body,
      headers: message.data.headers,
      method: message.data.method,
    })
    const functions: Record<string, string> = {}

    const imports = Object.entries(message.data.functions).map(async ([name, path]) => {
      const func = await import(path)

      functions[name] = func.default
    })

    await Promise.allSettled(imports)

    const res = await handleRequest(req, functions, {
      fetchRewrites,
      rawLogger: consoleLog,
      requestTimeout: REQUEST_TIMEOUT,
    })

    self.postMessage({
      type: 'responseStart',
      data: {
        headers: Object.fromEntries(res.headers.entries()),
        status: res.status,
      },
    } as RunResponseStartMessage)

    const reader = res.body?.getReader()
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        self.postMessage(
          {
            type: 'responseChunk',
            data: { chunk: value },
          } as RunResponseChunkMessage,
          [value.buffer],
        )
      }
    }

    self.postMessage({ type: 'responseEnd' } as RunResponseEndMessage)

    return
  }

  throw new Error('Unsupported message')
}

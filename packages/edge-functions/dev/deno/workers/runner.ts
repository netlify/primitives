import type { Message, RunResponseStartMessage, RunResponseChunkMessage, RunResponseEndMessage } from './types.ts'

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
      requestTimeout: message.data.timeout,
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

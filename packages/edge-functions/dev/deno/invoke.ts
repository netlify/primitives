import type { Message, RunRequestMessage } from './workers/types.ts'

// The timeout imposed by the edge nodes. It's important to keep this in place
// as a fallback in case we're unable to patch `fetch` to add our own here.
// https://github.com/netlify/stargate/blob/b5bc0eeb79bbbad3a8a6f41c7c73f1bcbcb8a9c8/proxy/deno/edge.go#L77
const UPSTREAM_REQUEST_TIMEOUT = 37_000

// The overall timeout should be at most the limit imposed by the edge nodes
// minus a buffer that gives us enough time to send back a response.
const REQUEST_TIMEOUT = UPSTREAM_REQUEST_TIMEOUT - 1_000

/**
 * Spawns a `Worker` to invoke a chain of edge functions. It serializes the
 * `Request` into a worker message and uses the messages it receives back to
 * construct a `Response`.
 */
export function invoke(req: Request, bootstrapURL: string, functions: Record<string, string>) {
  return new Promise<Response>((resolve, reject) => {
    const worker = new Worker(new URL('./workers/runner.ts', import.meta.url).href, {
      type: 'module',
    })

    let response: Response | null = null
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null

    const timeoutCheck = setTimeout(() => {
      if (!response) {
        reject(new Error('The edge function has timed out'))
      }
    }, REQUEST_TIMEOUT)

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        streamController = controller

        worker.postMessage({
          type: 'request',
          data: {
            body: await req.arrayBuffer(),
            bootstrapURL,
            functions,
            headers: Object.fromEntries(req.headers.entries()),
            method: req.method,
            timeout: REQUEST_TIMEOUT,
            url: req.url,
          },
        } as RunRequestMessage)
      },
    })

    worker.onmessage = (e) => {
      const message = e.data as Message

      switch (message.type) {
        case 'responseChunk': {
          streamController!.enqueue(message.data.chunk)

          break
        }

        case 'responseStart': {
          response = new Response(stream, {
            headers: message.data.headers,
            status: message.data.status,
          })

          clearTimeout(timeoutCheck)

          resolve(response)

          break
        }

        case 'responseEnd': {
          streamController?.close()
          worker.terminate()

          clearTimeout(timeoutCheck)

          if (!response) {
            reject(new Error('There was an error in producing the edge function response'))

            return
          }

          resolve(response)
        }
      }
    }

    worker.onerror = (e) => {
      clearTimeout(timeoutCheck)

      reject(e)
    }
  })
}

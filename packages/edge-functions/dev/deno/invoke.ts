import type { Message, RunRequestMessage } from './workers/types.ts'

/**
 * Spawns a `Worker` to invoke a chain of edge functions. It serializes the
 * `Request` into a worker message and uses the messages it receives back to
 * construct a `Response`.
 */
export function invoke(req: Request, bootstrapURL: string, functions: Record<string, string>, requestTimeout: number) {
  return new Promise<Response>((resolve, reject) => {
    const worker = new Worker(new URL('./workers/runner.ts', import.meta.url).href, {
      type: 'module',
    })

    let response: Response | null = null
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null

    const timeoutCheck = setTimeout(() => {
      if (!response) {
        reject(
          new Error(
            'An edge function took too long to produce a response. Refer to https://ntl.fyi/ef-limits for information about limits.',
          ),
        )
      }
    }, requestTimeout)

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
            timeout: requestTimeout,
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

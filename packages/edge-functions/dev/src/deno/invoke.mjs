// @ts-check

/**
 * @typedef {import('./workers/types.ts').Message} Message
 */

/**
 * Spawns a `Worker` to invoke a chain of edge functions. It serializes the
 * `Request` into a worker message and uses the messages it receives back to
 * construct a `Response`.
 *
 * @param {Request} req
 * @param {Record<string, string>} functions
 * @param {number} requestTimeout
 */
export function invoke(req, functions, requestTimeout) {
  return new Promise(async (resolve, reject) => {
    const worker = new Worker(new URL('./workers/runner.mjs', import.meta.url).href, {
      type: 'module',
    })

    /** @type {Response | null} */
    let response = null
    /** @type {ReadableStreamDefaultController<Uint8Array> | null} */
    let streamController = null
    /** @type {ReadableStream | null} */
    let stream = null

    const timeoutCheck = setTimeout(() => {
      if (!response) {
        reject(
          new Error(
            'An edge function took too long to produce a response. Refer to https://ntl.fyi/ef-limits for information about limits.',
          ),
        )
      }
    }, requestTimeout)

    worker.onmessage = (e) => {
      const message = /** @type {Message} */ (e.data)

      switch (message.type) {
        case 'responseChunk': {
          streamController && streamController.enqueue(message.data.chunk)

          break
        }

        case 'responseStart': {
          if (message.data.hasBody) {
            stream = new ReadableStream({
              start(controller) {
                streamController = controller
              },
              cancel() {
                streamController = null
                worker.terminate()
              },
            })
          }

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

    worker.postMessage({
      type: 'request',
      data: {
        body: await req.arrayBuffer(),
        functions,
        headers: Object.fromEntries(req.headers.entries()),
        method: req.method,
        timeout: requestTimeout,
        url: req.url,
      },
    })
  })
}

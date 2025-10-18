// @ts-check
/// <reference lib="deno.worker" />

/**
 * @typedef {import('../../shared/types.ts').SerializedError} SerializedError
 * @typedef {import('./types.ts').ConfigResponseMessage} ConfigResponseMessage
 * @typedef {import('./types.ts').Message} Message
 */

/** @type {DedicatedWorkerGlobalScope} */
// @ts-ignore We are inside a worker, so the global scope is `DedicatedWorkerGlobalScope`.
const worker = globalThis

worker.addEventListener('message', async (e) => {
  const message = /** @type {Message} */ (e.data)

  if (message.type === 'configRequest') {
    /** @type {Record<string, object>} */
    const configs = {}

    /** @type {Record<string, SerializedError>} */
    const errors = {}

    const imports = Object.entries(message.data.functions).map(async ([name, path]) => {
      try {
        const func = await import(path)

        configs[name] = func.config ?? {}
      } catch (error) {
        if (error instanceof Error) {
          errors[name] = {
            message: error.message,
            name: error.name,
            stack: error.stack,
          }
        } else {
          errors[name] = {
            message: String(error),
          }
        }
      }
    })

    await Promise.allSettled(imports)

    worker.postMessage(/** @type {ConfigResponseMessage} */ ({ type: 'configResponse', data: { configs, errors } }))

    return
  }

  throw new Error('Unsupported message')
})

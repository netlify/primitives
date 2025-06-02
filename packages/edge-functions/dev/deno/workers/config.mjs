// @ts-check

/**
 * @typedef {Object} SerializedError
 * @property {string} message
 * @property {string} [name]
 * @property {string} [stack]
 */

self.onmessage = async (e) => {
  const message = e.data

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

    self.postMessage({ type: 'configResponse', data: { configs, errors } })

    return
  }

  throw new Error('Unsupported message')
}

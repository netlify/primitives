// @ts-check

/**
 * @typedef {import('./workers/types.ts').ConfigRequestMessage} ConfigRequestMessage
 * @typedef {import('./workers/types.ts').Message} Message
 */

/**
 * @param {Record<string, string>} functions
 */
export function getConfigs(functions) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./workers/config.mjs', import.meta.url).href, {
      type: 'module',
    })

    worker.postMessage(
      /** @type {ConfigRequestMessage} */ ({
        type: 'configRequest',
        data: { functions },
      }),
    )

    worker.onmessage = (e) => {
      const message = /** @type {Message} */ (e.data)

      if (message.type === 'configResponse') {
        const { configs, errors } = message.data

        for (const functionName in errors) {
          const prefix = `Failed to parse edge function \`${functionName}\`:`
          const error = new Error(`${prefix} ${errors[functionName].message}`)

          if (errors[functionName].name) {
            error.name = errors[functionName].name
          }

          error.stack = `${prefix} ${error.stack}`

          reject(error)

          return
        }

        resolve(configs)

        return
      }
    }

    worker.onerror = (e) => {
      reject(e)
    }
  })
}

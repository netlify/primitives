// @ts-check

/**
 * @typedef {import('../shared/types.ts').SerializedError} SerializedError
 * @typedef {import('./workers/types.ts').ConfigRequestMessage} ConfigRequestMessage
 * @typedef {import('./workers/types.ts').Message} Message
 */

/**
 * Returns the configs of the functions that loaded, and an error for each
 * function that did not load.
 *
 * @param {Record<string, string>} functions
 * @returns {Promise<{ configs: Record<string, object>, errors: Record<string, SerializedError> }>}
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

        /** @type {Record<string, SerializedError>} */
        const functionErrors = {}

        for (const functionName in errors) {
          functionErrors[functionName] = {
            ...errors[functionName],
            message: `Failed to parse edge function \`${functionName}\`: ${errors[functionName].message}`,
          }
        }

        resolve({ configs, errors: functionErrors })

        return
      }
    }

    worker.onerror = (e) => {
      reject(e)
    }
  })
}

/**
 * Returns the URLs of the local files that a set of functions import, the
 * functions included. If Deno cannot read the module graph of a function, the
 * name of that function is in `unwatchedFunctions`.
 *
 * @param {Record<string, string>} functions
 * @returns {Promise<{ dependencies: string[], unwatchedFunctions: string[] }>}
 */
export async function getDependencies(functions) {
  /** @type {Set<string>} */
  const dependencies = new Set()

  /** @type {string[]} */
  const unwatchedFunctions = []

  await Promise.all(
    Object.entries(functions).map(async ([name, url]) => {
      try {
        const command = new Deno.Command(Deno.execPath(), {
          args: ['info', '--json', '--no-lock', url],
          stderr: 'null',
          stdout: 'piped',
        })
        const { stdout, success } = await command.output()

        if (!success) {
          unwatchedFunctions.push(name)

          return
        }

        /** @type {{ modules: { specifier: string }[] }} */
        const graph = JSON.parse(new TextDecoder().decode(stdout))

        for (const { specifier } of graph.modules) {
          if (specifier.startsWith('file:')) {
            dependencies.add(specifier)
          }
        }
      } catch {
        unwatchedFunctions.push(name)
      }
    }),
  )

  return { dependencies: [...dependencies], unwatchedFunctions }
}

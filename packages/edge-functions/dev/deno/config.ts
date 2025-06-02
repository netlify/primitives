import type { ConfigRequestMessage, Message } from './workers/types.ts'

export function getConfigs(functions: Record<string, string>) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./workers/config.ts', import.meta.url).href, {
      type: 'module',
    })

    worker.postMessage({
      type: 'configRequest',
      data: { functions },
    } as ConfigRequestMessage)

    worker.onmessage = (e) => {
      const message = e.data as Message

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

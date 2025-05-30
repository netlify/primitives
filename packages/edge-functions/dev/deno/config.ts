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
        resolve(message.data.configs)

        return
      }
    }

    worker.onerror = (e) => {
      reject(e)
    }
  })
}

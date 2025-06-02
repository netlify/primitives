import type { SerializedError } from '../../shared/types.ts'
import type { ConfigResponseMessage, Message } from './types.ts'

self.onmessage = async (e) => {
  const message = e.data as Message

  if (message.type === 'configRequest') {
    const configs: Record<string, object> = {}
    const errors: Record<string, SerializedError> = {}
    const imports = Object.entries(message.data.functions).map(async ([name, path]) => {
      try {
        const func = await import(path)

        configs[name] = func.config ?? {}
      } catch (error: unknown) {
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

    self.postMessage({ type: 'configResponse', data: { configs, errors } } as ConfigResponseMessage)

    return
  }

  throw new Error('Unsupported message')
}

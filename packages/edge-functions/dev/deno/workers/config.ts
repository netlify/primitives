import type { ConfigResponseMessage, Message } from './types.ts'

self.onmessage = async (e) => {
  const message = e.data as Message

  if (message.type === 'configRequest') {
    const configs: Record<string, object> = {}
    const imports = Object.entries(message.data.functions).map(async ([name, path]) => {
      const func = await import(path)

      configs[name] = func.config ?? {}
    })

    await Promise.allSettled(imports)

    self.postMessage({ type: 'configResponse', data: { configs } } as ConfigResponseMessage)

    return
  }

  throw new Error('Unsupported message')
}

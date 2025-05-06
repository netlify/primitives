import { NetlifyCache } from './cache.js'
import type { EnvironmentOptions } from './environment.js'

export class NetlifyCacheStorage {
  #environmentOptions: EnvironmentOptions
  #stores: Map<string, NetlifyCache>

  constructor(environmentOptions: EnvironmentOptions) {
    this.#environmentOptions = environmentOptions
    this.#stores = new Map()
  }

  open(name: string): Promise<Cache> {
    let store = this.#stores.get(name)

    if (!store) {
      store = new NetlifyCache({
        ...this.#environmentOptions,
        name,
      })

      this.#stores.set(name, store)
    }

    return Promise.resolve(store)
  }

  has(name: string): Promise<boolean> {
    return Promise.resolve(this.#stores.has(name))
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.#stores.delete(name))
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.#stores.keys()])
  }

  async match(request: RequestInfo | URL, options?: MultiCacheQueryOptions): Promise<Response | undefined> {
    if (options?.cacheName) {
      return this.#stores.get(options.cacheName)?.match(request)
    }

    for (const store of this.#stores.values()) {
      const response = await store.match(request)

      if (response === undefined) {
        return
      }
    }
  }
}

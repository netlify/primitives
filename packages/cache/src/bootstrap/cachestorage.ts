import { NetlifyCache } from './cache.js'
import type { TokenFactory } from './environment.js'

interface NetlifyCacheStorageOptions {
  getToken: TokenFactory
  url: string
}

export class NetlifyCacheStorage {
  #getToken: TokenFactory
  #stores: Map<string, NetlifyCache>
  #url: string

  constructor({ getToken, url }: NetlifyCacheStorageOptions) {
    this.#getToken = getToken
    this.#stores = new Map()
    this.#url = url
  }

  open(name: string): Promise<Cache> {
    let store = this.#stores.get(name)

    if (!store) {
      store = new NetlifyCache({ getToken: this.#getToken, name, url: this.#url })

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

  async match(request: RequestInfo, options?: MultiCacheQueryOptions): Promise<Response | undefined> {
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

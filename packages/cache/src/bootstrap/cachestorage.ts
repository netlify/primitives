import { NetlifyCache } from './cache.js'
import type { Factory } from './util.js'

interface NetlifyCacheStorageOptions {
  getHost: Factory<string>
  getToken: Factory<string>
  getURL: Factory<string>
  userAgent?: string
}

export class NetlifyCacheStorage {
  #getHost: Factory<string>
  #getToken: Factory<string>
  #getURL: Factory<string>
  #stores: Map<string, NetlifyCache>
  #userAgent?: string

  constructor({ getHost, getToken, getURL, userAgent }: NetlifyCacheStorageOptions) {
    this.#getHost = getHost
    this.#getToken = getToken
    this.#getURL = getURL
    this.#stores = new Map()
    this.#userAgent = userAgent
  }

  open(name: string): Promise<Cache> {
    let store = this.#stores.get(name)

    if (!store) {
      store = new NetlifyCache({
        getHost: this.#getHost,
        getToken: this.#getToken,
        getURL: this.#getURL,
        name,
        userAgent: this.#userAgent,
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

/**
 * Polyfill for local development environments where `globalThis.caches` is not
 * available. It's a no-op cache. In production it will use the real one that
 * has been set up in the environment by the bootstrap layer.
 */
class NetlifyCacheStorageProxy implements CacheStorage {
  async delete(name: string): Promise<boolean> {
    if (globalThis.caches) {
      return globalThis.caches.delete(name)
    }

    return false
  }

  async has(name: string): Promise<boolean> {
    if (globalThis.caches) {
      return globalThis.caches.has(name)
    }

    return false
  }

  async keys(): Promise<string[]> {
    if (globalThis.caches) {
      return globalThis.caches.keys()
    }

    return []
  }

  async match(request: RequestInfo, options?: MultiCacheQueryOptions): Promise<Response | undefined> {
    if (globalThis.caches) {
      return globalThis.caches.match(request, options)
    }
  }

  async open(cacheName: string) {
    if (globalThis.caches) {
      return globalThis.caches.open(cacheName)
    }

    return new NetlifyNoopCache()
  }
}

class NetlifyNoopCache implements Cache {
  async add(_: RequestInfo): Promise<void> {}

  async addAll(_: RequestInfo[]): Promise<void> {}

  async delete(_: RequestInfo): Promise<boolean> {
    return true
  }

  async keys(_?: Request): Promise<Array<Request>> {
    return []
  }

  async match(_: RequestInfo): Promise<undefined> {}

  async matchAll(_?: RequestInfo): Promise<readonly Response[]> {
    return []
  }

  async put(_: RequestInfo | URL | string, __: Response) {}
}

export const caches = new NetlifyCacheStorageProxy()

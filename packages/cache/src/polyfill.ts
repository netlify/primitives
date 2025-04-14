import { NetlifyCacheStorage } from './bootstrap/cachestorage.js'

/**
 * Polyfill for local development environments where `globalThis.caches` is not
 * available. This is a no-op cache, which will automatically work with the
 * real one in production.
 */
export const caches =
  globalThis.caches ??
  new NetlifyCacheStorage({
    base64Encode: () => '',
    getContext: () => null,
  })

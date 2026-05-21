import { AsyncLocalStorage } from 'node:async_hooks'

import type { Context } from '@netlify/types'

export interface ContextStoreContent {
  context: Context
}

// Registered via the global symbol registry so that other packages running in
// the same process (notably `@netlify/serverless-functions-api`) can resolve
// the exact same `AsyncLocalStorage` instance, regardless of how the modules
// were bundled or installed.
const STORE_KEY = Symbol.for('@netlify/functions/request-context-store')

const getOrCreateStore = (): AsyncLocalStorage<ContextStoreContent> => {
  const globalRef = globalThis as Record<symbol, unknown>
  const existing = globalRef[STORE_KEY]

  if (existing instanceof AsyncLocalStorage) {
    return existing as AsyncLocalStorage<ContextStoreContent>
  }

  const store = new AsyncLocalStorage<ContextStoreContent>()
  globalRef[STORE_KEY] = store

  return store
}

export const contextStore = getOrCreateStore()

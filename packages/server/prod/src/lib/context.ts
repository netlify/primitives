import { AsyncLocalStorage } from 'node:async_hooks'

import type { Context } from '@netlify/types'

// The platform runs every request inside this store. The key is shared with
// `@netlify/functions`, so both packages read the same context.
const STORE_KEY = Symbol.for('@netlify/functions/request-context-store')

/**
 * Returns the context of the request being handled. It works anywhere in the
 * code that runs for a request, including framework routes and middleware, but
 * not at module scope or in lifecycle hooks.
 */
export const getContext = (): Context => {
  const store = (globalThis as Record<symbol, unknown>)[STORE_KEY]
  const context =
    store instanceof AsyncLocalStorage ? (store.getStore() as { context?: Context } | undefined)?.context : undefined

  if (!context) {
    throw new Error('getContext() can only be called while a Netlify Server is handling a request.')
  }

  return context
}

import type { Context } from '@netlify/types'

import { contextStore } from './context_store.js'

export const getContext = (): Context => {
  const context = contextStore.getStore()?.context

  if (!context) {
    throw new Error(
      "getContext() can only be called within a Netlify serverless function's request handler or one of its async children.",
    )
  }

  return context
}

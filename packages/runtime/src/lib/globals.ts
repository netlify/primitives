import { type RequestContextFactory, NetlifyCacheStorage } from '@netlify/cache/bootstrap'
import type { Context, NetlifyGlobal } from '@netlify/types'

import { GlobalScope } from './util.js'

declare global {
  // Using `var` so that the declaration is hoisted in such a way that we can
  // reference it before it's initialized.

  // eslint-disable-next-line no-var
  var Netlify: NetlifyGlobal
}

const setCachesGlobal = (globalScope: GlobalScope, getContext: RequestContextFactory, userAgent?: string) => {
  globalScope.caches = new NetlifyCacheStorage({
    getContext,
    userAgent,
  })
}

const setNetlifyGlobal = (globalScope: GlobalScope, env: NetlifyGlobal['env'], getContext: () => Context | null) => {
  globalScope.Netlify = {
    get context() {
      return getContext()
    },
    env,
  }
}

export interface SetGlobalsOptions {
  env: NetlifyGlobal['env']
  getCacheContext: RequestContextFactory
  getRequestContext: () => Context | null
  globalScope: GlobalScope
  userAgent?: string
}

export const setGlobals = ({ env, getCacheContext, getRequestContext, globalScope, userAgent }: SetGlobalsOptions) => {
  setCachesGlobal(globalScope, getCacheContext, userAgent)
  setNetlifyGlobal(globalScope, env, getRequestContext)
}

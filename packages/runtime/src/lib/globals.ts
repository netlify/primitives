import { type RequestContextFactory, NetlifyCacheStorage } from '@netlify/cache/bootstrap'
import type { Context, NetlifyGlobal } from '@netlify/types'

import { GlobalScope } from './util.js'

declare global {
  // Using `var` instead of `const` to allow TypeScript declaration merging.
  // Multiple packages can declare the same global with `var`, but `const` cannot be redeclared.
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

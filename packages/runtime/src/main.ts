import type { RequestContextFactory } from '@netlify/cache/bootstrap'

import type { Context } from './lib/context/context.js'
import { type BlobsOptions, setupBlobsEnvironment } from './lib/environment/blobs.js'
import { EnvironmentVariables } from './lib/environment-variables.js'
import { setupBranchEnvironment } from './lib/environment/branch.js'
import { setupCachePurgeEnvironment } from './lib/environment/purge.js'
import { setGlobals } from './lib/globals.js'
import { GlobalScope, isNonEmptyString } from './lib/util.js'

interface StartRuntimeOptions {
  blobs?: BlobsOptions
  branch?: string
  cache: {
    getCacheAPIContext: RequestContextFactory
    purgeToken?: string
  }
  deployID: string
  env: EnvironmentVariables
  getRequestContext: () => Context | null
  globalScope?: GlobalScope
  preferGlobal?: boolean
  siteID: string
  userAgent?: string
}

export const startRuntime = ({
  blobs,
  branch,
  cache,
  deployID,
  env,
  getRequestContext,
  globalScope = globalThis,
  preferGlobal,
  siteID,
  userAgent,
}: StartRuntimeOptions) => {
  if (blobs) {
    setupBlobsEnvironment({
      ...blobs,
      deployID,
      env,
      globalScope,
      preferGlobal,
      siteID,
    })
  }

  setGlobals({
    env,
    getCacheContext: cache.getCacheAPIContext,
    getRequestContext,
    globalScope,
    userAgent,
  })

  if (isNonEmptyString(cache.purgeToken)) {
    setupCachePurgeEnvironment({
      env,
      token: cache.purgeToken,
    })
  }

  if (isNonEmptyString(branch)) {
    setupBranchEnvironment({ branch, env })
  }
}

export type { EnvironmentVariables }

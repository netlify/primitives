import type { EnvironmentContext } from '@netlify/blobs'
import { base64Encode } from '@netlify/runtime-utils'
import type { NetlifyGlobal } from '@netlify/types'

export interface BlobsOptions {
  edgeURL: string
  primaryRegion: string
  uncachedEdgeURL: string
  token: string
}

export interface SetupBlobsEnvironmentOptions extends BlobsOptions {
  deployID: string
  env: NetlifyGlobal['env']
  globalScope: Record<string, any>
  preferGlobal?: boolean
  siteID: string
}

export const setupBlobsEnvironment = ({
  deployID,
  edgeURL,
  env,
  globalScope,
  primaryRegion,
  preferGlobal,
  siteID,
  token,
  uncachedEdgeURL,
}: SetupBlobsEnvironmentOptions) => {
  const context: EnvironmentContext = {
    deployID,
    edgeURL,
    primaryRegion,
    siteID,
    token,
    uncachedEdgeURL,
  }
  const serializedContext = base64Encode(JSON.stringify(context))

  if (preferGlobal) {
    globalScope.netlifyBlobsContext = serializedContext
  } else {
    env.set('NETLIFY_BLOBS_CONTEXT', serializedContext)
  }
}

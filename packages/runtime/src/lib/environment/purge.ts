import type { NetlifyGlobal } from '@netlify/types'

export interface SetupCachePurgeEnvironmentOptions {
  env: NetlifyGlobal['env']
  token: string
}

export const setupCachePurgeEnvironment = ({ env, token }: SetupCachePurgeEnvironmentOptions) => {
  env.set('NETLIFY_PURGE_API_TOKEN', token)
}

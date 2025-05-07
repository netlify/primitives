import type { NetlifyGlobal } from '@netlify/types'

export interface SetupCachePurgeEnvironmentOptions {
  branch: string
  env: NetlifyGlobal['env']
}

export const setupBranchEnvironment = ({ branch, env }: SetupCachePurgeEnvironmentOptions) => {
  env.set('NETLIFY_BRANCH', branch)
}

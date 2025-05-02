import type { EnvironmentVariables } from '@netlify/runtime-utils'

export interface SetupCachePurgeEnvironmentOptions {
  branch: string
  env: EnvironmentVariables
}

export const setupBranchEnvironment = ({ branch, env }: SetupCachePurgeEnvironmentOptions) => {
  env.set('NETLIFY_BRANCH', branch)
}

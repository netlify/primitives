import { EnvironmentVariables } from '../environment-variables.js'

export interface SetupCachePurgeEnvironmentOptions {
  branch: string
  env: EnvironmentVariables
}

export const setupBranchEnvironment = ({ branch, env }: SetupCachePurgeEnvironmentOptions) => {
  env.set('NETLIFY_BRANCH', branch)
}

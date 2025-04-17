import { EnvironmentVariables } from '../environment-variables.js'

export interface SetupCachePurgeEnvironmentOptions {
  env: EnvironmentVariables
  token: string
}

export const setupCachePurgeEnvironment = ({ env, token }: SetupCachePurgeEnvironmentOptions) => {
  env.set('NETLIFY_PURGE_API_TOKEN', token)
}

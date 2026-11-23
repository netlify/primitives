import path from 'node:path'

import envPaths from 'env-paths'

import { getGlobalConfigStore } from './global-config.js'
import { readTokenFromKeychain } from './keychain.js'

export const LEGACY_STORAGE_ENV_VAR = 'NETLIFY_USE_LEGACY_AUTH_STORAGE' as const

export const isLegacyAuthStorageForced = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const value = env[LEGACY_STORAGE_ENV_VAR]
  return value != null && value !== ''
}

export const getLegacyConfigFilePath = (): string => {
  const paths = envPaths('netlify', { suffix: '' })
  return path.join(paths.config, 'config.json')
}

export const getLegacyAPIToken = async (): Promise<string | undefined> => {
  const globalConfig = await getGlobalConfigStore()
  const userId = globalConfig.get('userId') as string | undefined
  if (userId == null) return undefined
  const token = globalConfig.get(`users.${userId}.auth.token`)
  return typeof token === 'string' && token !== '' ? token : undefined
}

export type StoredAPIToken =
  | { source: 'config' | 'keychain'; token: string }
  | { source: 'none'; keychainError?: Error }

/**
 * A plaintext token wins over the keychain: the CLI clears it on every keychain write, so when both
 * exist the plaintext one is newer.
 */
export const readStoredAPIToken = async (env: NodeJS.ProcessEnv = process.env): Promise<StoredAPIToken> => {
  const legacyToken = await getLegacyAPIToken()
  if (legacyToken != null) return { source: 'config', token: legacyToken }
  if (isLegacyAuthStorageForced(env)) return { source: 'none' }

  const userId = (await getGlobalConfigStore()).get('userId') as string | undefined
  if (userId == null) return { source: 'none' }

  const result = await readTokenFromKeychain(userId)
  if (result.status === 'found') return { source: 'keychain', token: result.token }
  return result.status === 'error' ? { source: 'none', keychainError: result.error } : { source: 'none' }
}

export const AUTH_TOKEN_ENV_VAR = 'NETLIFY_AUTH_TOKEN' as const

/**
 * Matches the token order of the CLI: `NETLIFY_AUTH_TOKEN` wins over a stored token, so that CI can
 * authenticate without `netlify login`. The CLI ignores the literal string `'null'`, and so do we.
 */
export const getAPIToken = async (env: NodeJS.ProcessEnv = process.env): Promise<string | undefined> => {
  const envToken = env[AUTH_TOKEN_ENV_VAR]
  if (envToken != null && envToken !== '' && envToken !== 'null') return envToken

  const stored = await readStoredAPIToken(env)
  return stored.source === 'none' ? undefined : stored.token
}

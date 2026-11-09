const SERVICE_NAME = 'netlify-cli'
const TIMEOUT_MS = 30_000

type Entry = InstanceType<(typeof import('@napi-rs/keyring'))['AsyncEntry']>

// napi-rs aborts via napi_cancel_async_work, which can't stop work already running (e.g. blocked on
// an OS access dialog), so race a timer to unblock the caller; the native call keeps running.
const withEntry = async <T>(
  account: string,
  operation: (entry: Entry, signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController()
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(
        new Error(
          `Timed out after ${String(TIMEOUT_MS / 1000)}s waiting for the OS keychain. It may be waiting for you to respond to a system dialog.`,
        ),
      )
    }, TIMEOUT_MS)
    timer.unref()
  })
  // Lazy so a missing or broken native binary can't break importing dev-utils
  const run = async () => {
    const { AsyncEntry } = await import('@napi-rs/keyring')
    return operation(new AsyncEntry(SERVICE_NAME, account), controller.signal)
  }
  try {
    return await Promise.race([run(), timeout])
  } finally {
    clearTimeout(timer)
  }
}

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)))

export type KeychainReadResult =
  | { status: 'found'; token: string }
  | { status: 'missing' }
  | { status: 'error'; error: Error }

/**
 * `error` covers a store that couldn't be read: locked, access denied, timed out, no credential
 * store, or native module unavailable.
 */
export const readTokenFromKeychain = async (account: string): Promise<KeychainReadResult> => {
  try {
    const token = await withEntry(account, (entry, signal) => entry.getPassword(signal))
    return token ? { status: 'found', token } : { status: 'missing' }
  } catch (error) {
    return { status: 'error', error: toError(error) }
  }
}

/** Returns the stored secret, or `null` if it's missing or couldn't be read. */
export const getTokenFromKeychain = async (account: string): Promise<string | null> => {
  const result = await readTokenFromKeychain(account)
  return result.status === 'found' ? result.token : null
}

export type KeychainWriteResult = { status: 'stored' } | { status: 'error'; error: Error }

export const storeTokenInKeychain = async (account: string, token: string): Promise<KeychainWriteResult> => {
  try {
    await withEntry(account, (entry, signal) => entry.setPassword(token, signal))
    return { status: 'stored' }
  } catch (error) {
    return { status: 'error', error: toError(error) }
  }
}

export type KeychainDeleteResult = { status: 'deleted' } | { status: 'missing' } | { status: 'error'; error: Error }

export const deleteTokenFromKeychain = async (account: string): Promise<KeychainDeleteResult> => {
  try {
    const deleted = await withEntry(account, (entry, signal) => entry.deletePassword(signal))
    return deleted ? { status: 'deleted' } : { status: 'missing' }
  } catch (error) {
    return { status: 'error', error: toError(error) }
  }
}

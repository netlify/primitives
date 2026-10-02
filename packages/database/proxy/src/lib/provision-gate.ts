import type { ProvisionCallback } from '../main.js'

export interface ProvisionRetryOptions {
  /** Wait after the first failure, doubling with each one. Defaults to 1s. */
  baseMs?: number
  /** Defaults to 60s. */
  maxMs?: number
  /** Return true for a failure that retrying cannot fix, such as a 403. Provisioning then stops for good. */
  isPermanent?: (error: unknown) => boolean
}

const DEFAULT_BASE_MS = 1_000
const DEFAULT_MAX_MS = 60_000

/** Thrown for a connection refused from the gate's own state, without calling the provision callback. */
export class ProvisionHeldError extends Error {
  readonly willRetry: boolean

  constructor(message: string, willRetry: boolean) {
    super(message)
    this.name = 'ProvisionHeldError'
    this.willRetry = willRetry
  }
}

export const isProvisionHeldError = (value: unknown): value is ProvisionHeldError => value instanceof ProvisionHeldError

/**
 * Wrap a provision callback so a failure is not re-attempted on every connection.
 *
 * The proxy provisions once per client connection, and Postgres clients reconnect
 * immediately when one is refused, so an unwrapped callback is called as fast as the
 * application issues queries. This holds connections off after a failure instead, and
 * collapses simultaneous connections into a single attempt.
 */
export function gateProvisioning(provision: ProvisionCallback, options: ProvisionRetryOptions = {}): ProvisionCallback {
  const baseMs = options.baseMs ?? DEFAULT_BASE_MS
  const maxMs = options.maxMs ?? DEFAULT_MAX_MS
  const isPermanent = options.isPermanent ?? (() => false)

  let inFlight: Promise<string> | undefined
  let heldError: ProvisionHeldError | undefined
  let retryAt = 0
  let permanent = false
  let failures = 0

  const onFailure = (error: unknown): never => {
    const reason = error instanceof Error ? error.message : String(error)
    failures += 1
    permanent = isPermanent(error)

    if (permanent) {
      heldError = new ProvisionHeldError(`Database provisioning failed and will not be retried: ${reason}`, false)
    } else {
      const delayMs = Math.min(baseMs * 2 ** (failures - 1), maxMs)
      retryAt = Date.now() + delayMs
      const seconds = String(delayMs / 1000)
      heldError = new ProvisionHeldError(`Database provisioning failed, retrying in ${seconds}s: ${reason}`, true)
    }

    throw error
  }

  return async (): Promise<string> => {
    if (heldError && (permanent || Date.now() < retryAt)) {
      throw heldError
    }

    inFlight ??= provision()
      .then((connectionString) => {
        failures = 0
        heldError = undefined

        return connectionString
      }, onFailure)
      .finally(() => {
        inFlight = undefined
      })

    return await inFlight
  }
}

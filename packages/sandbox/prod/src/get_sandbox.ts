import { type ClientOptions, type CreateSandboxOptions, Client } from './client.js'
import { SandboxError } from './error.js'
import type { Sandbox } from './sandbox.js'

export interface SandboxOptions extends ClientOptions, CreateSandboxOptions {}

const split = ({ apiURL, fetch, siteID, token, ...create }: SandboxOptions) => ({
  client: new Client({ apiURL, fetch, siteID, token }),
  create,
})

/** Creates a sandbox with a generated ID. */
export const createSandbox = (options: SandboxOptions = {}): Promise<Sandbox> => {
  const { client, create } = split(options)

  return client.create(create)
}

/**
 * Resolves the sandbox with this name, creating it if it doesn't already
 * exist. The options only apply when it is created.
 */
export const getSandbox = async (name: string, options: SandboxOptions = {}): Promise<Sandbox> => {
  if (typeof name !== 'string' || !name) {
    throw new SandboxError(
      'invalid_request',
      'getSandbox needs the name of the sandbox. To create a sandbox with a generated ID, use createSandbox.',
    )
  }

  const { client, create } = split(options)

  return await client.resolve(name, create)
}

/** Deletes a sandbox by its name or ID, without fetching it first. */
export const deleteSandbox = (id: string, { signal, ...options }: ClientOptions & { signal?: AbortSignal } = {}) =>
  new Client(options).delete(id, { signal })

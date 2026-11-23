import { getEnvironmentContext, type ResolveContext } from './environment.js'
import { MissingSandboxEnvironmentError, SandboxConfigMismatchError } from './error.js'
import { type RequestOptions, sendJSON } from './request.js'
import { Sandbox } from './sandbox.js'
import { sizeInMB, type Size } from './size.js'
import { Snapshot } from './snapshot.js'
import type { NetworkPolicy, SandboxPayload, SnapshotPayload } from './types.js'

const DEFAULT_API_URL = 'https://api.netlify.com'

export interface ClientOptions {
  /** Overrides the Netlify API URL. */
  apiURL?: string

  /**
   * Optional implementation that overrides the global `fetch`.
   */
  fetch?: typeof globalThis.fetch

  /**
   * The ID of the site the sandboxes belong to. Comes from the environment
   * when running on Netlify.
   */
  siteID?: string

  /**
   * A Netlify API token. Comes from the environment when running on Netlify.
   */
  token?: string
}

export interface CreateSandboxOptions {
  /**
   * The sandbox's memory, as a number of megabytes or a string with a unit,
   * such as `"4gb"`.
   */
  memory?: Size

  /** The number of vCPUs the sandbox gets. */
  vcpus?: number

  /**
   * The size of the sandbox's disk, as a number of megabytes or a string with
   * a unit, such as `"8gb"`.
   */
  diskSize?: Size

  /** What the sandbox can reach on the network, and the secrets it can use there. */
  network?: NetworkPolicy

  /**
   * A snapshot, or the ID of one, to start the sandbox from. The sandbox gets
   * the snapshot's disk size, so this can't be combined with `diskSize`.
   */
  from?: Snapshot | string

  /** Cancels the request. */
  signal?: AbortSignal
}

export interface SnapshotOptions {
  /**
   * How long after its last use the snapshot expires, in seconds. Creating a
   * sandbox from a snapshot counts as a use. Defaults to 30 days.
   */
  expiresAfterSeconds?: number

  /** Cancels the request. */
  signal?: AbortSignal
}

export class Client {
  readonly #fetch: typeof globalThis.fetch
  readonly #options: ClientOptions

  constructor(options: ClientOptions = {}) {
    this.#fetch = options.fetch ?? globalThis.fetch
    this.#options = options
  }

  readonly #context: ResolveContext = () => {
    const edge = getEnvironmentContext()
    const apiURL = this.#options.apiURL ?? edge.apiURL ?? DEFAULT_API_URL
    const siteID = this.#options.siteID ?? edge.siteID
    const token = this.#options.token ?? edge.token

    if (!siteID || !token) {
      const missing: string[] = []

      if (!siteID) {
        missing.push('siteID')
      }

      if (!token) {
        missing.push('token')
      }

      throw new MissingSandboxEnvironmentError(missing)
    }

    return { apiURL: apiURL.replace(/\/$/, ''), siteID, token }
  }

  /** Creates a sandbox with a generated ID. */
  async create(options: CreateSandboxOptions = {}): Promise<Sandbox> {
    const payload = await this.#request<SandboxPayload>('/sandboxes', {
      body: createBody(options),
      signal: options.signal,
    })

    return new Sandbox(payload, this.#fetch, this.#context, this)
  }

  /**
   * Resolves the sandbox with this name, creating one if it doesn't already
   * exist.
   */
  async resolve(name: string, options: CreateSandboxOptions = {}): Promise<Sandbox> {
    const payload = await this.#request<SandboxPayload>('/sandboxes', {
      body: { name, ...createBody(options) },
      signal: options.signal,
    })

    assertResourcesMatch(name, options, payload)

    return new Sandbox(payload, this.#fetch, this.#context, this)
  }

  async delete(id: string, options: { signal?: AbortSignal } = {}): Promise<void> {
    await this.#request(`/sandboxes/${id}`, { method: 'DELETE', signal: options.signal })
  }

  async snapshot(id: string, options: SnapshotOptions = {}): Promise<Snapshot> {
    const payload = await this.#request<SnapshotPayload>(`/sandboxes/${id}/snapshots`, {
      body: { expires_after_seconds: options.expiresAfterSeconds },
      signal: options.signal,
    })

    return new Snapshot(payload, this)
  }

  async listSnapshots(options: { signal?: AbortSignal } = {}): Promise<Snapshot[]> {
    const payloads = await this.#request<SnapshotPayload[]>('/sandbox_snapshots', {
      method: 'GET',
      signal: options.signal,
    })

    return payloads.map((payload) => new Snapshot(payload, this))
  }

  async deleteSnapshot(id: string, options: { signal?: AbortSignal } = {}): Promise<void> {
    await this.#request(`/sandbox_snapshots/${id}`, { method: 'DELETE', signal: options.signal })
  }

  #request<T>(path: string, options: RequestOptions): Promise<T> {
    const { apiURL, siteID, token } = this.#context()

    return sendJSON<T>(this.#fetch, `${apiURL}/api/v1/sites/${siteID}${path}`, token, options)
  }
}

function createBody(options: CreateSandboxOptions): Record<string, unknown> {
  return {
    memory_mb: sizeInMB('memory', options.memory),
    vcpus: options.vcpus,
    disk_size_mb: sizeInMB('diskSize', options.diskSize),
    network: options.network,
    from_snapshot: typeof options.from === 'string' ? options.from : options.from?.id,
  }
}

function assertResourcesMatch(name: string, options: CreateSandboxOptions, payload: SandboxPayload) {
  const differences = (
    [
      ['memory', sizeInMB('memory', options.memory), payload.memory_mb],
      ['vcpus', options.vcpus, payload.vcpus],
      ['diskSize', sizeInMB('diskSize', options.diskSize), payload.disk_size_mb],
    ] as const
  )
    .filter(([, asked, actual]) => asked !== undefined && asked !== actual)
    .map(([option, asked, actual]) => `${option} is ${String(actual)}, not the ${String(asked)} asked for`)

  if (differences.length !== 0) {
    throw new SandboxConfigMismatchError(name, differences)
  }
}

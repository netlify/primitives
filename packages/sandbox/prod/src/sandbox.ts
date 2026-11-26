import type { Client, SnapshotOptions } from './client.js'
import { type Commands, type Shell, createCommands, createShell } from './commands.js'
import type { ResolveContext } from './environment.js'
import { createFiles, type Files } from './files.js'
import { type RequestOptions, send, sendJSON } from './request.js'
import type { Snapshot } from './snapshot.js'
import type { SandboxPayload } from './types.js'

// The namespace for the Sandbox control plane.
const SANDBOX_API = '/.netlify/sandbox'

export class Sandbox {
  /**
   * The sandbox's ID. A sandbox created with a name uses that name as its ID,
   * and any other sandbox gets a generated one.
   */
  readonly id: string

  /** The ID of the site the sandbox belongs to. */
  readonly siteID: string

  /** The sandbox's own hostname. */
  readonly hostname: string

  /** The sandbox's memory, in megabytes. */
  readonly memory: number

  /** The number of vCPUs the sandbox has. */
  readonly vcpus: number

  /** The size of the sandbox's disk, in megabytes. */
  readonly diskSize: number

  /** When the sandbox was created. */
  readonly createdAt: Date

  /**
   * Whether the call that returned this sandbox created it. It is `false` for
   * a sandbox that `getSandbox` found by its name.
   */
  readonly created: boolean

  /** Runs commands and processes in the sandbox. */
  readonly commands: Commands

  /** Reads, writes, lists and removes files in the sandbox. */
  readonly files: Files

  /**
   * Runs a shell command written as a template and resolves with its output.
   * Interpolated values are quoted, so they reach the command as they are. A
   * non-zero exit rejects with a `CommandError`. It takes no options, so use
   * `commands.run` to set a directory or environment variables.
   *
   *     const { $ } = sandbox
   *     await $`git clone ${url} ${dir}`
   */
  readonly $: Shell

  readonly #client: Client

  constructor(
    payload: SandboxPayload,
    created: boolean,
    fetch: typeof globalThis.fetch,
    context: ResolveContext,
    client: Client,
  ) {
    this.id = payload.id
    this.siteID = payload.site_id
    this.hostname = payload.hostname
    this.memory = payload.memory_mb
    this.vcpus = payload.vcpus
    this.diskSize = payload.disk_size_mb
    this.createdAt = new Date(payload.created_at)
    this.created = created

    this.#client = client

    const url = (path: string) => `https://${this.hostname}${SANDBOX_API}${path}`

    // The token is read on every request, because the platform replaces it
    // between invocations.
    this.commands = createCommands(async <T>(path: string, options?: RequestOptions) => {
      const { body } = await sendJSON<T>(fetch, url(path), context().token, options)

      return body
    })
    this.files = createFiles((path, options) => send(fetch, url(path), context().token, options))
    this.$ = createShell(this.commands)
  }

  async delete(options: { signal?: AbortSignal } = {}): Promise<void> {
    await this.#client.delete(this.id, options)
  }

  /**
   * Takes a snapshot of the sandbox's disk. A running sandbox is stopped
   * first, and it starts again on its next request.
   */
  async snapshot(options: SnapshotOptions = {}): Promise<Snapshot> {
    return await this.#client.snapshot(this.id, options)
  }

  /** Deletes the sandbox at the end of an `await using` scope. */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.delete()
  }
}

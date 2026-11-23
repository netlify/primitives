import type { CommandResult } from './commands.js'
import type { SandboxRequest } from './request.js'

export interface OutputChunk {
  /** What the process wrote to standard output since the last read. */
  stdout: string

  /** What the process wrote to standard error since the last read. */
  stderr: string

  /** Output was dropped because the process produced more than the sandbox keeps. */
  truncated: boolean
}

interface ProcessOptions {
  /** Cancels the request. */
  signal?: AbortSignal
}

export interface PollOptions extends ProcessOptions {
  /** How long to wait between polls. Defaults to a second. */
  intervalMs?: number
}

export interface ProcessPayload {
  id: string
  argv?: string[]
  started_at?: string
  exited?: boolean
  exit_code?: number
  ended_at?: string
  error?: string
}

interface OutputPayload {
  stdout: string
  stderr: string
  stdout_offset: number
  stderr_offset: number
  truncated?: boolean
  process: ProcessPayload
}

/**
 * A command started in the sandbox. Output is read from a cursor rather than
 * over a held connection, so a caller that keeps the ID and the cursor can pick
 * up where it left off in a later request.
 */
export class Process {
  /** The ID of the process, to pass to `commands.get`. */
  readonly id: string

  /** Unknown until the first call on a handle built by `commands.get`. */
  argv: string[] | undefined

  /** Unknown until the first call on a handle built by `commands.get`. */
  startedAt: Date | undefined

  /** Whether the process had exited when the sandbox was last asked. */
  exited: boolean

  /** The code the process exited with, once it has exited. */
  exitCode: number | undefined

  /** The error the sandbox reported for the process, if any. */
  error: string | undefined

  readonly #request: SandboxRequest
  #stdoutOffset = 0
  #stderrOffset = 0

  constructor(request: SandboxRequest, payload: ProcessPayload, cursor?: string) {
    this.#request = request

    this.id = payload.id
    this.exited = false
    this.#apply(payload)

    if (cursor !== undefined) {
      const [stdoutOffset, stderrOffset] = cursor.split(':').map(Number)

      this.#stdoutOffset = stdoutOffset || 0
      this.#stderrOffset = stderrOffset || 0
    }
  }

  /**
   * Where the next read starts. Pass it to `commands.get` to carry on reading
   * from another request. Treat it as opaque.
   */
  get cursor(): string {
    return `${String(this.#stdoutOffset)}:${String(this.#stderrOffset)}`
  }

  /** Refreshes `exited` and `exitCode` from the sandbox. */
  async status(options: ProcessOptions = {}): Promise<this> {
    const payload = await this.#request<ProcessPayload>(`/processes/${this.id}`, {
      method: 'GET',
      signal: options.signal,
    })

    return this.#apply(payload)
  }

  /** Reads whatever has been written since the cursor, and advances it. */
  async read(options: ProcessOptions = {}): Promise<OutputChunk> {
    const query = `stdout_since=${String(this.#stdoutOffset)}&stderr_since=${String(this.#stderrOffset)}`
    const payload = await this.#request<OutputPayload>(`/processes/${this.id}/output?${query}`, {
      method: 'GET',
      signal: options.signal,
    })

    this.#stdoutOffset = payload.stdout_offset
    this.#stderrOffset = payload.stderr_offset
    this.#apply(payload.process)

    return { stdout: payload.stdout, stderr: payload.stderr, truncated: Boolean(payload.truncated) }
  }

  /**
   * Yields output as the process writes it, from the cursor until the process
   * exits.
   *
   *     for await (const chunk of process.output()) console.log(chunk.stdout)
   */
  async *output(options: PollOptions = {}): AsyncGenerator<OutputChunk, void, undefined> {
    const { intervalMs = 1000, signal } = options

    // A read that starts after the process has exited has everything, so it is
    // the last one.
    let isLastRead = false

    while (!isLastRead) {
      isLastRead = this.exited

      const chunk = await this.read({ signal })

      if (chunk.stdout || chunk.stderr) {
        yield chunk
      }

      if (!this.exited) {
        await sleep(intervalMs, signal)
      }
    }
  }

  /**
   * Resolves once the process has exited, with its exit code and the output it
   * wrote from the cursor on. A non-zero exit is returned, not thrown.
   */
  async wait(options: PollOptions = {}): Promise<CommandResult> {
    const result = { exitCode: 0, stdout: '', stderr: '', truncated: false }

    for await (const chunk of this.output(options)) {
      result.stdout += chunk.stdout
      result.stderr += chunk.stderr
      result.truncated ||= chunk.truncated
    }

    result.exitCode = this.exitCode ?? 0

    return result
  }

  /** Stops the process and resolves once it is gone, not once asked. */
  async kill(options: ProcessOptions = {}): Promise<this> {
    const payload = await this.#request<ProcessPayload>(`/processes/${this.id}`, {
      method: 'DELETE',
      signal: options.signal,
    })

    return this.#apply(payload)
  }

  #apply(payload: ProcessPayload): this {
    this.argv = payload.argv ?? this.argv
    this.startedAt = payload.started_at === undefined ? this.startedAt : new Date(payload.started_at)
    this.exited = payload.exited ?? this.exited
    this.exitCode = payload.exit_code
    this.error = payload.error

    return this
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error)

      return
    }

    const timer = setTimeout(resolve, ms)

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason as Error)
      },
      { once: true },
    )
  })
}

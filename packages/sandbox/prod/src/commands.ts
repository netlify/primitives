import { CommandError, SandboxError } from './error.js'
import { Process, type ProcessPayload } from './process.js'
import type { SandboxRequest } from './request.js'

export interface RunOptions {
  /** Environment variables to add for this command. */
  env?: Record<string, string>

  /** The directory to run the command in. */
  cwd?: string

  /** Cancels the request. */
  signal?: AbortSignal
}

export interface CommandResult {
  /** The code the command exited with. */
  exitCode: number

  /** What the command wrote to standard output. */
  stdout: string

  /** What the command wrote to standard error. */
  stderr: string

  /** Output was dropped because the command produced more than the sandbox keeps. */
  truncated: boolean
}

interface CommandPayload {
  exit_code: number
  stdout?: string
  stderr?: string
  truncated?: boolean
}

export interface Commands {
  /**
   * Runs one command and resolves once it has exited. A non-zero exit is returned, not thrown.
   */
  run(argv: string[] | string, options?: RunOptions): Promise<CommandResult>

  /** Starts a command and resolves as soon as it is running. */
  start(argv: string[] | string, options?: RunOptions): Promise<Process>

  /** Every process the sandbox is still tracking. */
  list(options?: { signal?: AbortSignal }): Promise<Process[]>

  /**
   * A handle on a process that is already running. Nothing is fetched until you
   * call it, so a caller holding an ID and the cursor it last saw can carry on
   * reading in a later request.
   */
  get(id: string, options?: { cursor?: string }): Process
}

export const createCommands = (request: SandboxRequest): Commands => ({
  async run(argv, options = {}) {
    const payload = await request<CommandPayload>('/commands', {
      body: { argv: toArgv(argv), env: options.env, dir: options.cwd },
      signal: options.signal,
    })

    return {
      exitCode: payload.exit_code,
      stdout: payload.stdout ?? '',
      stderr: payload.stderr ?? '',
      truncated: Boolean(payload.truncated),
    }
  },

  async start(argv, options = {}) {
    const payload = await request<ProcessPayload>('/processes', {
      body: { argv: toArgv(argv), env: options.env, dir: options.cwd },
      signal: options.signal,
    })

    return new Process(request, payload)
  },

  async list(options = {}) {
    const payload = await request<{ processes: ProcessPayload[] }>('/processes', {
      method: 'GET',
      signal: options.signal,
    })

    return payload.processes.map((entry) => new Process(request, entry))
  },

  get(id, options = {}) {
    return new Process(request, { id }, options.cursor)
  },
})

function toArgv(argv: string[] | string): string[] {
  return Array.isArray(argv) ? argv : ['sh', '-c', argv]
}

type ShellScalar = string | number | boolean

/** A value interpolated into a `$` template. An array becomes one argument per item. */
export type ShellValue = ShellScalar | readonly ShellScalar[]

export type Shell = (strings: TemplateStringsArray, ...values: ShellValue[]) => Promise<CommandResult>

const quote = (value: ShellScalar) => `'${String(value).replaceAll("'", "'\\''")}'`

const quoteValue = (value: ShellValue) =>
  Array.isArray(value) ? value.map(quote).join(' ') : quote(value as ShellScalar)

// assertUnquoted throws when a value would be interpolated inside quotes. We
// wrap every value in single quotes, which only keeps it from being parsed
// when the template hasn't already opened a quote around it.
const assertUnquoted = (strings: TemplateStringsArray) => {
  let quote: string | undefined

  for (const part of strings.slice(0, -1)) {
    for (let index = 0; index < part.length; index++) {
      const char = part[index]

      if (char === '\\' && quote !== "'") {
        index++
      } else if (quote === undefined && (char === "'" || char === '"')) {
        quote = char
      } else if (char === quote) {
        quote = undefined
      }
    }

    if (quote !== undefined) {
      throw new SandboxError(
        'invalid_request',
        `a value can't be interpolated inside quotes, because it is quoted for you: remove the ${quote} around it`,
      )
    }
  }
}

export const createShell =
  (commands: Commands): Shell =>
  async (strings, ...values) => {
    assertUnquoted(strings)

    const command = strings.reduce((script, part, index) => script + quoteValue(values[index - 1]) + part)
    const result = await commands.run(command)

    if (result.exitCode !== 0) {
      throw new CommandError(command, result)
    }

    return result
  }

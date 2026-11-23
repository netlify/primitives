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

// assertInterpolable throws when the template has a value somewhere it can't
// be passed as an argument of its own: inside quotes, right after a backslash,
// or in a command that has a here-document.
const assertInterpolable = (strings: TemplateStringsArray) => {
  let quote: string | undefined
  let hasHereDocument = false

  for (const part of strings.slice(0, -1)) {
    let isEscaped = false

    for (let index = 0; index < part.length; index++) {
      const char = part[index]

      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\' && quote !== "'") {
        isEscaped = true
      } else if (quote === undefined && (char === "'" || char === '"')) {
        quote = char
      } else if (char === quote) {
        quote = undefined
      } else if (
        quote === undefined &&
        part.startsWith('<<', index) &&
        part[index + 2] !== '<' &&
        part[index - 1] !== '<'
      ) {
        hasHereDocument = true
      }
    }

    if (quote !== undefined) {
      throw new SandboxError(
        'invalid_request',
        `a value can't be interpolated inside quotes. Each value is passed as one argument, so remove the ${quote} around it`,
      )
    }

    if (isEscaped) {
      throw new SandboxError('invalid_request', "a value can't be interpolated right after a backslash")
    }

    if (hasHereDocument) {
      throw new SandboxError('invalid_request', "a value can't be interpolated in a command that has a here-document")
    }
  }
}

// buildScript turns a template into a script and the arguments to run it with.
// Each value is a positional parameter, so the shell reads it as data and
// never parses it.
const buildScript = (strings: TemplateStringsArray, values: ShellValue[]) => {
  const args: string[] = []

  const script = strings.reduce((script, part, index) => {
    const value = values[index - 1]
    const items = Array.isArray(value) ? (value as readonly ShellScalar[]) : [value as ShellScalar]
    const parameters = items.map((item) => `"\${${String(args.push(String(item)))}}"`)

    return script + parameters.join(' ') + part
  })

  return { script, args }
}

export const createShell =
  (commands: Commands): Shell =>
  async (strings, ...values) => {
    assertInterpolable(strings)

    const { script, args } = buildScript(strings, values)
    const result = await commands.run(args.length === 0 ? script : ['sh', '-c', script, 'sh', ...args])

    if (result.exitCode !== 0) {
      // The error shows the command with its values in place, which is easier
      // to read than the script with its parameters.
      throw new CommandError(
        strings.reduce((command, part, index) => command + quoteValue(values[index - 1]) + part),
        result,
      )
    }

    return result
  }

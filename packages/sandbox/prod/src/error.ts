export type SandboxErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'gone'
  | 'rate_limited'
  | 'unavailable'
  | 'command_failed'
  | 'output_truncated'
  | 'file_error'
  | 'config_mismatch'
  | 'missing_environment'
  | 'unknown'

interface SandboxErrorDetails {
  status?: number
  requestID?: string
}

export class SandboxError extends Error {
  /** What went wrong, for code that needs to tell failures apart. */
  readonly code: SandboxErrorCode

  /** The HTTP status, when the failure was a response. */
  readonly status: number | undefined

  /** The ID of the failed request, to quote when asking for help. */
  readonly requestID: string | undefined

  constructor(code: SandboxErrorCode, message: string, { status, requestID }: SandboxErrorDetails = {}) {
    super(message)

    this.name = 'SandboxError'
    this.code = code
    this.status = status
    this.requestID = requestID
  }
}

/** A command run with `sandbox.$` that exited with a non-zero code. */
export class CommandError extends SandboxError {
  readonly command: string
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string

  constructor(command: string, result: { exitCode: number; stdout: string; stderr: string }) {
    const detail = result.stderr.trim() || result.stdout.trim()

    super('command_failed', `\`${command}\` exited with code ${String(result.exitCode)}${detail ? `: ${detail}` : ''}`)

    this.name = 'CommandError'
    this.command = command
    this.exitCode = result.exitCode
    this.stdout = result.stdout
    this.stderr = result.stderr
  }
}

export class SandboxConfigMismatchError extends SandboxError {
  constructor(name: string, differences: string[]) {
    super(
      'config_mismatch',
      `The sandbox "${name}" already exists with different settings: ${differences.join(
        ', ',
      )}. Settings apply only when a sandbox is created, so delete this one to create it again with them.`,
    )

    this.name = 'SandboxConfigMismatchError'
  }
}

export class MissingSandboxEnvironmentError extends SandboxError {
  constructor(requiredProperties: string[]) {
    super(
      'missing_environment',
      `The environment has not been configured to use Netlify Sandbox. To use it manually, supply the following properties: ${requiredProperties.join(
        ', ',
      )}`,
    )

    this.name = 'MissingSandboxEnvironmentError'
  }
}

const codeForStatus = (status: number): SandboxErrorCode => {
  if (status === 400 || status === 422) return 'invalid_request'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 410) return 'gone'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'unavailable'

  return 'unknown'
}

// The longest reason we copy out of a response that isn't JSON.
const MAX_REASON_LENGTH = 300

const reasonFrom = (body: string): string | undefined => {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown }
    const reason = parsed.message ?? parsed.error

    if (typeof reason === 'string' && reason) {
      return reason
    }
  } catch {
    // Not JSON, so the body itself may be the reason.
  }

  const text = body.trim()

  return text && text.length <= MAX_REASON_LENGTH && !text.startsWith('<') ? text : undefined
}

/** Builds the error for a response that wasn't a success, keeping the reason the server gave. */
export const errorFromResponse = async (method: string, url: string, response: Response): Promise<SandboxError> => {
  const reason = reasonFrom(await response.text().catch(() => ''))
  const summary = `${method} ${url} responded with ${String(response.status)}`

  return new SandboxError(codeForStatus(response.status), reason ? `${reason} (${summary})` : summary, {
    status: response.status,
    requestID: response.headers.get('x-nf-request-id') ?? undefined,
  })
}

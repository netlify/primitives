import type { CommandResult, Commands } from './commands.js'
import { SandboxError } from './error.js'

interface FileOptions {
  signal?: AbortSignal
}

export interface Files {
  read(path: string, options?: FileOptions): Promise<string>
  write(path: string, contents: string, options?: FileOptions): Promise<void>
  list(path?: string, options?: FileOptions): Promise<string[]>
}

// check turns the result of the command behind a file call into an error when
// the command failed, or when the sandbox dropped part of its output.
const check = (action: string, path: string, result: CommandResult) => {
  if (result.exitCode !== 0) {
    throw new SandboxError('file_error', `could not ${action} ${path}: ${result.stderr.trim()}`)
  }

  if (result.truncated) {
    throw new SandboxError('output_truncated', `could not ${action} ${path}: it is larger than the sandbox returns`)
  }
}

export const createFiles = (commands: Commands): Files => ({
  async read(path, options = {}) {
    const result = await commands.run(['cat', path], options)

    check('read', path, result)

    return result.stdout
  },

  async write(path, contents, options = {}) {
    const result = await commands.run(
      ['sh', '-c', 'mkdir -p "$(dirname "$2")" && printf %s "$1" | base64 -d > "$2"', 'sh', base64(contents), path],
      options,
    )

    check('write', path, result)
  },

  async list(path = '/', options = {}) {
    const result = await commands.run(['ls', '-1A', path], options)

    check('list', path, result)

    return result.stdout.split('\n').filter(Boolean)
  },
})

function base64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

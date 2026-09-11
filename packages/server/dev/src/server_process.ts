import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import process from 'node:process'

import type { Logger } from '@netlify/dev-utils'
import getAvailablePort from 'get-port'

const READINESS_TIMEOUT_MS = 30_000
const SHUTDOWN_TIMEOUT_MS = 5_000

/**
 * Owns the process that runs the user's server: the published platform
 * bootstrap (`@netlify/serverless-functions-api/server`), pointed at the local
 * entrypoint. This is the same code path that serves the entry in production.
 */
export class ServerProcess {
  #child?: ChildProcess
  #entryPath: string
  #logger: Logger
  #port?: number
  #startPromise?: Promise<number>

  constructor({ entryPath, logger }: { entryPath: string; logger: Logger }) {
    this.#entryPath = entryPath
    this.#logger = logger
  }

  private pipeLogs(child: ChildProcess) {
    for (const stream of [child.stdout, child.stderr]) {
      let buffer = ''

      stream?.setEncoding('utf8')
      stream?.on('data', (chunk: string) => {
        buffer += chunk

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.trim() !== '') {
            this.#logger.log(line)
          }
        }
      })
    }
  }

  private async start(): Promise<number> {
    const require = createRequire(import.meta.url)
    const bootstrapPath = require.resolve('@netlify/serverless-functions-api/server')
    const port = await getAvailablePort()

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NETLIFY_PLAY_ENTRY_KIND: 'server',
      NETLIFY_PLAY_ENTRY_PATH: this.#entryPath,
      NETLIFY_PLAY_PORT: String(port),
      NETLIFY_PLAY_SERVER_READY_FD: '3',
    }

    // The bootstrap owns the port the user server listens on, and it honors a
    // pre-existing PORT, so the host's own value must not leak into the child.
    delete env.PORT
    delete env.NETLIFY_PORT

    const child = spawn(process.execPath, [bootstrapPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
    })

    this.#child = child

    this.pipeLogs(child)

    child.on('exit', (code) => {
      if (this.#child === child) {
        this.#child = undefined
        this.#port = undefined
        this.#startPromise = undefined
      }

      if (code !== 0 && code !== null) {
        this.#logger.error(`Server process exited with code ${String(code)}. It will restart on the next request.`)
      }
    })

    const readyStream = child.stdio[3]

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timed out waiting for the server to start listening on port ${String(port)}`))
        }, READINESS_TIMEOUT_MS)

        readyStream?.once('data', () => {
          clearTimeout(timeout)
          resolve()
        })

        child.once('exit', (code) => {
          clearTimeout(timeout)
          reject(new Error(`Server process exited with code ${String(code)} before it was ready`))
        })

        child.once('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    } catch (error) {
      child.kill('SIGKILL')

      if (this.#child === child) {
        this.#child = undefined
      }

      throw error
    }

    this.#port = port

    return port
  }

  async ensureStarted(): Promise<number> {
    if (this.#startPromise === undefined) {
      this.#startPromise = this.start().catch((error: unknown) => {
        this.#startPromise = undefined

        throw error
      })
    }

    return this.#startPromise
  }

  get port(): number | undefined {
    return this.#port
  }

  async stop(): Promise<void> {
    const child = this.#child

    this.#child = undefined
    this.#port = undefined
    this.#startPromise = undefined

    if (child?.exitCode !== null) {
      return
    }

    const exited = once(child, 'exit')

    // SIGTERM first, so the entry's `shutdown` export runs like in production.
    child.kill('SIGTERM')

    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
    }, SHUTDOWN_TIMEOUT_MS)

    await exited

    clearTimeout(timeout)
  }
}

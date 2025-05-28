import type { Config } from '../../src/lib/config.ts'
import type { EdgeFunction, RunOptions } from '../shared/types.ts'

// The timeout imposed by the edge nodes. It's important to keep this in place
// as a fallback in case we're unable to patch `fetch` to add our own here.
// https://github.com/netlify/stargate/blob/b5bc0eeb79bbbad3a8a6f41c7c73f1bcbcb8a9c8/proxy/deno/edge.go#L77
const UPSTREAM_REQUEST_TIMEOUT = 37_000

// The overall timeout should be at most the limit imposed by the edge nodes
// minus a buffer that gives us enough time to send back a response.
const REQUEST_TIMEOUT = UPSTREAM_REQUEST_TIMEOUT - 1_000

const consoleLog = globalThis.console.log
const fetchRewrites = new Map<string, string>()

type AvailableFunctions = Record<string, string>

export const serveLocal = async ({ bootstrapURL, denoPort: port }: RunOptions) => {
  // Importing the bootstrap layer.
  const { handleRequest } = await import(bootstrapURL)

  const serveOptions: Deno.ServeTcpOptions = {
    // Adding a no-op listener to avoid the default one, which prints a message
    // we don't want.
    onListen() {},
    port,
  }

  const configs: Record<string, Config> = {}
  const functions: Record<string, EdgeFunction> = {}

  const server = Deno.serve(serveOptions, async (req: Request) => {
    const ts = Date.now()
    const url = new URL(req.url)
    const method = req.method.toUpperCase()

    if (method === 'NETLIFYCONFIG') {
      const errors: Error[] = []
      const availableFunctions: AvailableFunctions = url.searchParams.has('functions')
        ? JSON.parse(decodeURIComponent(url.searchParams.get('functions')!))
        : {}
      const queue = Object.keys(availableFunctions).map(async (name) => {
        try {
          // Adding a `v` query parameter to bust the module cache.
          const func = await import(`${availableFunctions[name]}?v=${ts}`)

          if (func.config && typeof func.config === 'object') {
            const config = func.config as Config

            configs[name] = config
          }

          if (typeof func.default === 'function') {
            functions[name] = func.default
          } else {
            console.log(
              `\u001b[91m⬥\u001b[39m \u001b[31mFailed\u001b[39m to load Edge Function \u001b[33m${name}\u001b[39m. The file does not seem to have a function as the default export.`,
            )
          }
        } catch (error) {
          console.log(
            `\u001b[91m⬥\u001b[39m \u001b[31mFailed\u001b[39m to run Edge Function \u001b[33m${name}\u001b[39m:`,
          )

          console.error(error)

          errors.push(error as Error)
        }
      })

      await Promise.allSettled(queue)

      if (errors.length !== 0) {
        return new Response(null, { status: 500 })
      }

      return Response.json(configs)
    }

    if (Object.keys(functions).length === 0) {
      return new Response(null, { status: 404 })
    }

    return handleRequest(req, functions, {
      fetchRewrites,
      rawLogger: consoleLog,
      requestTimeout: REQUEST_TIMEOUT,
    })
  })

  return server.finished
}

const options = JSON.parse(Deno.args[0]) as RunOptions

await serveLocal(options)

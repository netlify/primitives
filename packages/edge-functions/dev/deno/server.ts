import { getErrorResponse } from './errors.ts'
import type { RunOptions } from '../shared/types.ts'

import { getConfigs } from './config.ts'
import { invoke } from './invoke.ts'

type AvailableFunctions = Record<string, string>

/**
 * Starts an HTTP server on the provided port. The server acts as a proxy that
 * handles edge function invocations.
 */
export const serveLocal = ({ bootstrapURL, denoPort: port, requestTimeout }: RunOptions) => {
  const serveOptions: Deno.ServeTcpOptions = {
    // Adding a no-op listener to avoid the default one, which prints a message
    // we don't want.
    onListen() {},
    port,
  }

  let functions: Record<string, string> = {}

  const server = Deno.serve(serveOptions, async (req: Request) => {
    const url = new URL(req.url)
    const method = req.method.toUpperCase()

    // This custom method represents an introspection request that will make
    // the Deno server take a list of functions, import them, and return their
    // configs.
    if (method === 'NETLIFYCONFIG') {
      // This is the list of all the functions found in the project.
      const availableFunctions: AvailableFunctions = url.searchParams.has('functions')
        ? JSON.parse(decodeURIComponent(url.searchParams.get('functions')!))
        : {}

      functions = availableFunctions

      try {
        const configs = await getConfigs(availableFunctions)

        return Response.json(configs)
      } catch (error) {
        return getErrorResponse(error)
      }
    }

    if (Object.keys(functions).length === 0) {
      return new Response(null, { status: 404 })
    }

    try {
      return await invoke(req, bootstrapURL, functions, requestTimeout)
    } catch (error) {
      return getErrorResponse(error)
    }
  })

  return server.finished
}

const url = new URL(import.meta.url)
const rawOptions = url.searchParams.get('options')!
const options = JSON.parse(decodeURIComponent(rawOptions)) as RunOptions

await serveLocal(options)

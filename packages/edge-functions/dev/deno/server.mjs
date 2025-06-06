// @ts-check

/**
 * @typedef {import('../shared/types.ts').RunOptions} RunOptions
 */

import { getErrorResponse } from './errors.mjs'

import { getConfigs } from './config.mjs'
import { invoke } from './invoke.mjs'

/**
 * Starts an HTTP server on the provided port. The server acts as a proxy that
 * handles edge function invocations.
 *
 * @param {RunOptions} options
 */
export const serveLocal = ({ denoPort: port, requestTimeout }) => {
  const serveOptions = {
    // Adding a no-op listener to avoid the default one, which prints a message
    // we don't want.
    onListen() {},
    port,
  }

  /** @type {Record<string, string>} */
  let functions = {}

  /**
   * @param {Request} request
   */
  const server = Deno.serve(serveOptions, async (/** @type {Request} */ request) => {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()

    // This custom method represents an introspection request that will make
    // the Deno server take a list of functions, import them, and return their
    // configs.
    if (method === 'NETLIFYCONFIG') {
      const functionsParam = url.searchParams.get('functions')

      // This is the list of all the functions found in the project.
      /** @type {Record<string, string>} */
      const availableFunctions = functionsParam ? JSON.parse(decodeURIComponent(functionsParam)) : {}

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
      return await invoke(request, functions, requestTimeout)
    } catch (error) {
      return getErrorResponse(error)
    }
  })

  return server.finished
}

const runOptions = JSON.parse(Deno.args[0])

await serveLocal(runOptions)

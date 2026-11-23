// @ts-check

/**
 * @typedef {import('../shared/types.ts').RunOptions} RunOptions
 */

import { getErrorResponse } from './errors.mjs'

import { getConfigs, getDependencies } from './config.mjs'
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
        const [{ configs, errors }, { dependencies, unwatchedFunctions }] = await Promise.all([
          getConfigs(availableFunctions),
          getDependencies(availableFunctions),
        ])

        return Response.json({ configs, dependencies, errors, unwatchedFunctions })
      } catch (error) {
        return getErrorResponse(error)
      }
    }

    // Node sends the functions of the configs that it used to match the
    // request. Use them, because a config request can change `functions` while
    // Node still uses configs from an earlier request.
    const functionsHeader = request.headers.get('x-nf-available-edge-functions')

    /** @type {Record<string, string>} */
    const requestFunctions = functionsHeader ? JSON.parse(functionsHeader) : functions

    if (Object.keys(requestFunctions).length === 0) {
      return new Response(null, { status: 404 })
    }

    try {
      return await invoke(request, requestFunctions, requestTimeout)
    } catch (error) {
      return getErrorResponse(error)
    }
  })

  return server.finished
}

const runOptions = JSON.parse(Deno.args[0])

await serveLocal(runOptions)

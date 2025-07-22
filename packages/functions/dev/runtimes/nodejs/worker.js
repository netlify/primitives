// @ts-check
// This is a JavaScript file because we need to locate it at runtime using the
// `Worker` API and using a `.ts` complicates things. To make it type-safe,
// we use JSDoc annotations.
import { createServer } from 'node:net'
import process from 'node:process'
import { isMainThread, workerData, parentPort } from 'node:worker_threads'

import { isStream } from 'is-stream'
import lambdaLocal from 'lambda-local'
import sourceMapSupport from 'source-map-support'

// https://github.com/nodejs/undici/blob/a36e299d544863c5ade17d4090181be894366024/lib/web/fetch/constants.js#L6
const nullBodyStatus = new Set([101, 204, 205, 304])

/**
 * @typedef HandlerResponse
 * @type {import('../../../src/function/handler_response.js').HandlerResponse}
 */

/**
 * @typedef WorkerResult
 * @type {HandlerResponse & { streamPort?: number }}
 */

if (isMainThread) {
  throw new Error(`Do not import "${import.meta.url}" in the main thread.`)
}

sourceMapSupport.install()

lambdaLocal.getLogger().level = 'alert'

const { clientContext, entryFilePath, environment = {}, event, timeoutMs } = workerData

// Injecting into the environment any properties passed in by the parent.
for (const key in environment) {
  process.env[key] = environment[key]
}
const lambdaFunc = await import(entryFilePath)
const invocationResult = /** @type {HandlerResponse} */ (
  await lambdaLocal.execute({
    clientContext,
    event,
    lambdaFunc,
    region: 'dev',
    timeoutMs,
    verboseLevel: 3,
  })
)

/**
 * When the result body is a stream and result status code allow to have a body,
 * open up a http server that proxies back to the main thread and resolve with server port.
 * Otherwise, resolve with undefined.
 *
 * @param {HandlerResponse} invocationResult
 * @returns {Promise<number | undefined>}
 */
async function getStreamPortForStreamingResponse(invocationResult) {
  // if we don't have result or result's body is not a stream, we do not need a stream port
  if (!invocationResult || !isStream(invocationResult.body)) {
    return undefined
  }

  const { body } = invocationResult

  delete invocationResult.body

  // For streaming responses, lambda-local always returns a result with body stream.
  // We need to discard it if result's status code does not allow response to have a body.
  const shouldNotHaveABody = nullBodyStatus.has(invocationResult.statusCode)
  if (shouldNotHaveABody) {
    return undefined
  }

  // create a server that will proxy the body stream back to the main thread
  return await new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      body.pipe(socket).on('end', () => server.close())
    })
    server.on('error', (error) => {
      reject(error)
    })
    server.listen({ port: 0, host: 'localhost' }, () => {
      const address = server.address()

      /** @type {number | undefined} */
      let streamPort
      if (address && typeof address !== 'string') {
        streamPort = address.port
      }

      resolve(streamPort)
    })
  })
}

const streamPort = await getStreamPortForStreamingResponse(invocationResult)

if (parentPort) {
  /** @type {WorkerResult} */
  const message = { ...invocationResult, streamPort }

  parentPort.postMessage(message)
}

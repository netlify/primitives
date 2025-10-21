import { createConnection } from 'node:net'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'

import lambdaLocal from 'lambda-local'

import type { NetlifyFunction } from '../../function.js'
import type { Runtime } from '../index.js'

import { getNoopBuilder, getZISIBuilder, parseFunctionForMetadata } from './builder.js'

// TODO: Find better place for this.
const BLOBS_CONTEXT_VARIABLE = 'NETLIFY_BLOBS_CONTEXT'

lambdaLocal.getLogger().level = 'alert'

import { HandlerEvent, HandlerResponse } from '@netlify/functions'
import { lambdaEventFromWebRequest, webResponseFromLambdaResponse } from './lambda.js'

export const nodeJSRuntime: Runtime = {
  getBuildFunction: async ({ config, directory, func, projectRoot, targetDirectory }) => {
    const metadata = await parseFunctionForMetadata({ mainFile: func.mainFile, config, projectRoot })
    const zisiBuilder = await getZISIBuilder({ config, directory, func, metadata, projectRoot, targetDirectory })

    if (zisiBuilder) {
      return zisiBuilder.build
    }

    const noopBuilder = await getNoopBuilder({ config, directory, func, metadata, projectRoot, targetDirectory })

    return noopBuilder.build
  },

  invokeFunction: async ({ context, environment, func, request, route, timeout }) => {
    const event = await lambdaEventFromWebRequest(request, route)
    const buildData = await func.getBuildData()

    if (buildData?.runtimeAPIVersion !== 2) {
      const lambdaResponse = await invokeFunctionDirectly({ context, event, func, timeout })

      return webResponseFromLambdaResponse(lambdaResponse)
    }

    const workerData = {
      clientContext: JSON.stringify(context),
      environment,
      event,
      // If a function builder has defined a `buildPath` property, we use it.
      // Otherwise, we'll invoke the function's main file.
      // Because we use import() we have to use file:// URLs for Windows.
      entryFilePath: pathToFileURL(buildData?.buildPath ?? func.mainFile).href,
      timeoutMs: timeout * 1_000,
    }

    const worker = new Worker(workerURL, { workerData })
    const lambdaResponse = await new Promise<HandlerResponse>((resolve, reject) => {
      worker.on('message', (result) => {
        if (result?.streamPort) {
          const client = createConnection(
            {
              port: result.streamPort,
              host: 'localhost',
            },
            () => {
              result.body = client
              resolve(result)
            },
          )
          client.on('error', reject)
        } else {
          resolve(result)
        }
      })

      worker.on('error', reject)
    })

    return webResponseFromLambdaResponse(lambdaResponse)
  },
}

const workerURL = new URL('worker.js', import.meta.url)

export const invokeFunctionDirectly = async ({
  context,
  event,
  func,
  timeout,
}: {
  context: any
  event: HandlerEvent
  func: NetlifyFunction
  timeout: number
}) => {
  // If a function builder has defined a `buildPath` property, we use it.
  // Otherwise, we'll invoke the function's main file.
  const buildData = await func.getBuildData()
  const lambdaPath = buildData?.buildPath ?? func.mainFile
  const result = (await lambdaLocal.execute({
    clientContext: JSON.stringify(context),
    environment: {
      // We've set the Blobs context on the parent process, which means it will
      // be available to the Lambda. This would be inconsistent with production
      // where only V2 functions get the context injected. To fix it, unset the
      // context variable before invoking the function.
      // This has the side-effect of also removing the variable from `process.env`.
      [BLOBS_CONTEXT_VARIABLE]: undefined,
    },
    event,
    lambdaPath,
    timeoutMs: timeout * 1_000,
    verboseLevel: 3,
    esm: lambdaPath.endsWith('.mjs'),
  })) as HandlerResponse

  return result
}

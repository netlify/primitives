import { Buffer } from 'node:buffer'

import type { EnvironmentContext as BlobsContext } from '@netlify/blobs'
import { Manifest } from '@netlify/zip-it-and-ship-it'
import { DevEventHandler, Middleware } from '@netlify/dev'

import { FunctionsRegistry } from './registry.js'
import { headersObjectFromWebHeaders } from './runtimes/nodejs/lambda.js'
import { buildClientContext } from './server/client-context.js'

const CLOCKWORK_USERAGENT = 'Netlify Clockwork'
const UNLINKED_SITE_MOCK_ID = 'unlinked'

// TODO: Integrate CLI mock geo location logic.
const mockLocation = {
  city: 'San Francisco',
  country: { code: 'US', name: 'United States' },
  subdivision: { code: 'CA', name: 'California' },
  longitude: 0,
  latitude: 0,
  timezone: 'UTC',
}

export const withFunctions = (options: WithFunctionsOptions): Middleware => {
  const functionsRegistry = new FunctionsRegistry(options)

  let scan = functionsRegistry.scan([options.userFunctionsPath])

  return {
    handle: async (request, context, next) => {
      await scan

      const url = new URL(request.url)
      const match = await functionsRegistry.getFunctionForURLPath(
        url.pathname,
        request.method,
        // we're pretending there's no static file at the same URL.
        // This is wrong, but in local dev we already did the matching
        // in a downstream server where we had access to the file system, so this never hits.
        () => Promise.resolve(false),
      )
      if (!match) {
        return next(request, context)
      }

      const functionName = match?.func?.name
      if (!functionName) {
        return next(request, context)
      }

      const func = functionsRegistry.get(functionName)
      if (func === undefined) {
        return new Response('Function not found...', {
          status: 404,
        })
      }

      if (!func.hasValidName()) {
        return new Response('Function name should consist only of alphanumeric characters, hyphen & underscores.', {
          status: 400,
        })
      }

      // TODO: Wtf?
      let remoteAddress = request.headers.get('x-forwarded-for') || ''
      remoteAddress =
        remoteAddress
          .split(remoteAddress.includes('.') ? ':' : ',')
          .pop()
          ?.trim() ?? ''

      request.headers.set('x-nf-client-connection-ip', remoteAddress)
      request.headers.set('x-nf-account-id', options.accountId)
      request.headers.set('x-nf-site-id', options?.siteInfo?.id ?? UNLINKED_SITE_MOCK_ID)
      request.headers.set('x-nf-geo', Buffer.from(JSON.stringify(mockLocation)).toString('base64'))

      const { headers: headersObject } = headersObjectFromWebHeaders(request.headers)
      const clientContext = buildClientContext(headersObject) || {}

      if (func.isBackground) {
        // Background functions do not receive a clientContext
        await func.invoke(request, {})

        return new Response(null, { status: 202 })
      }

      if (await func.isScheduled()) {
        // In production, scheduled functions always receive POST requests, so we
        // have to emulate that here, even if a user has triggered a GET request
        // as part of their tests. If we don't do this, we'll hit problems when
        // we send the invocation body in a request that can't have a body.
        const newRequest = new Request(request, {
          ...request,
          method: 'POST',
        })

        newRequest.headers.set('user-agent', CLOCKWORK_USERAGENT)
        newRequest.headers.set('x-nf-event', 'schedule')

        return await func.invoke(newRequest, clientContext)
      }

      return await func.invoke(request, clientContext)
    },
    init: ({ broadcast }) => {
      functionsRegistry.eventHandler = broadcast
    },
  }
}

interface WithFunctionsOptions {
  accountId: string
  blobsContext?: BlobsContext
  destPath: string
  config: any
  debug?: boolean
  eventHandler?: DevEventHandler
  frameworksAPIFunctionsPath?: string
  internalFunctionsPath?: string
  manifest?: Manifest
  projectRoot: string
  siteInfo?: any
  settings: any
  timeouts: any
  userFunctionsPath?: string
}

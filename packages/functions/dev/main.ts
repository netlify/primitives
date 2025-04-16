import { Buffer } from 'node:buffer'

import type { EnvironmentContext as BlobsContext } from '@netlify/blobs'
import { Manifest } from '@netlify/zip-it-and-ship-it'
import { DevEventHandler } from '@netlify/dev-utils'

import type { NetlifyFunction } from './function.js'
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

export interface FunctionMatch {
  handle: (req: Request) => Promise<Response>
  preferStatic: boolean
}

interface FunctionsHandlerOptions {
  accountId?: string
  blobsContext?: BlobsContext
  destPath: string
  config: any
  debug?: boolean
  eventHandler?: DevEventHandler
  frameworksAPIFunctionsPath?: string
  internalFunctionsPath?: string
  manifest?: Manifest
  projectRoot: string
  siteId?: string
  settings: any
  timeouts: any
  userFunctionsPath?: string
}

export class FunctionsHandler {
  private accountID?: string
  private registry: FunctionsRegistry
  private scan: Promise<void>
  private siteID?: string

  constructor(options: FunctionsHandlerOptions) {
    const registry = new FunctionsRegistry(options)

    this.accountID = options.accountId
    this.registry = registry
    this.scan = registry.scan([options.userFunctionsPath])
    this.siteID = options.siteId
  }

  private async invoke(request: Request, func: NetlifyFunction) {
    // TODO: Wtf?
    let remoteAddress = request.headers.get('x-forwarded-for') || ''
    remoteAddress =
      remoteAddress
        .split(remoteAddress.includes('.') ? ':' : ',')
        .pop()
        ?.trim() ?? ''

    request.headers.set('x-nf-client-connection-ip', remoteAddress)

    if (this.accountID) {
      request.headers.set('x-nf-account-id', this.accountID)
    }

    request.headers.set('x-nf-site-id', this.siteID ?? UNLINKED_SITE_MOCK_ID)
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
  }

  async match(request: Request): Promise<FunctionMatch | undefined> {
    await this.scan

    const url = new URL(request.url)
    const match = await this.registry.getFunctionForURLPath(url.pathname, request.method)
    if (!match) {
      return
    }

    const functionName = match?.func?.name
    if (!functionName) {
      return
    }

    const func = this.registry.get(functionName)
    if (func === undefined) {
      return {
        handle: async () =>
          new Response('Function not found...', {
            status: 404,
          }),
        preferStatic: false,
      }
    }

    if (!func.hasValidName()) {
      return {
        handle: async () =>
          new Response('Function name should consist only of alphanumeric characters, hyphen & underscores.', {
            status: 400,
          }),
        preferStatic: false,
      }
    }

    return {
      handle: (request: Request) => this.invoke(request, func),
      preferStatic: match.route?.prefer_static ?? false,
    }
  }
}

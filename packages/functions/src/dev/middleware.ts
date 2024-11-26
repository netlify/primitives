import { Buffer } from 'node:buffer'

import { Middleware } from '@netlify/dev'

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
  const { functionsRegistry } = options

  return async (request, context, next) => {
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
  }
}

interface WithFunctionsOptions {
  accountId: string
  config: any
  // geoCountry: string
  // geolocationMode: 'cache' | 'update' | 'mock'
  functionsRegistry: FunctionsRegistry
  offline?: boolean
  siteInfo?: any
  siteUrl: string
  state: any
}

// export const startFunctionsServer = async (
//   options: {
//     blobsContext: BlobsContext
//     command: BaseCommand
//     config: $TSFixMe
//     capabilities: $TSFixMe
//     debug: boolean
//     loadDistFunctions?: boolean
//     settings: $TSFixMe
//     site: $TSFixMe
//     siteInfo: $TSFixMe
//     timeouts: $TSFixMe
//   } & Omit<GetFunctionsServerOptions, 'functionsRegistry'>,
// ): Promise<FunctionsRegistry | undefined> => {
//   const {
//     blobsContext,
//     capabilities,
//     command,
//     config,
//     debug,
//     loadDistFunctions,
//     settings,
//     site,
//     siteInfo,
//     siteUrl,
//     timeouts,
//   } = options
//   const internalFunctionsDir = await getInternalFunctionsDir({ base: site.root, packagePath: command.workspacePackage })
//   const functionsDirectories: string[] = []
//   let manifest

//   // If the `loadDistFunctions` parameter is sent, the functions server will
//   // use the built functions created by zip-it-and-ship-it rather than building
//   // them from source.
//   if (loadDistFunctions) {
//     const distPath = await getFunctionsDistPath({ base: site.root, packagePath: command.workspacePackage })

//     if (distPath) {
//       functionsDirectories.push(distPath)

//       // When using built functions, read the manifest file so that we can
//       // extract metadata such as routes and API version.
//       try {
//         const manifestPath = path.join(distPath, 'manifest.json')
//         // eslint-disable-next-line unicorn/prefer-json-parse-buffer
//         const data = await fs.readFile(manifestPath, 'utf8')

//         manifest = JSON.parse(data)
//       } catch {
//         // no-op
//       }
//     }
//   } else {
//     // The order of the function directories matters. Rightmost directories take
//     // precedence.
//     const sourceDirectories: string[] = [
//       internalFunctionsDir,
//       command.netlify.frameworksAPIPaths.functions.path,
//       settings.functions,
//     ].filter(Boolean)

//     functionsDirectories.push(...sourceDirectories)
//   }

//   try {
//     const functionsServePath = getFunctionsServePath({ base: site.root, packagePath: command.workspacePackage })

//     await fs.rm(functionsServePath, { force: true, recursive: true })
//   } catch {
//     // no-op
//   }

//   if (functionsDirectories.length === 0) {
//     return
//   }

//   const functionsRegistry = new FunctionsRegistry({
//     blobsContext,
//     // @ts-expect-error TS(7031) FIXME
//     capabilities,
//     config,
//     debug,
//     frameworksAPIPaths: command.netlify.frameworksAPIPaths,
//     isConnected: Boolean(siteUrl),
//     logLambdaCompat: isFeatureFlagEnabled('cli_log_lambda_compat', siteInfo),
//     manifest,
//     // functions always need to be inside the packagePath if set inside a monorepo
//     projectRoot: command.workingDir,
//     settings,
//     timeouts,
//   })

//   await functionsRegistry.scan(functionsDirectories)

//   const server = getFunctionsServer({ ...options, functionsRegistry })

//   await startWebServer({ server, settings, debug })

//   return functionsRegistry
// }

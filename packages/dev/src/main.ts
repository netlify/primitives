import path from 'node:path'
import process from 'node:process'

import { FunctionsHandler } from '@netlify/functions/dev'
import { RedirectsHandler } from '@netlify/redirects'
import { StaticHandler } from '@netlify/static'

import { getConfig } from './lib/config.js'
import { isDirectory } from './lib/fs.js'
import { getRuntime } from './lib/runtime.js'

interface Features {
  blobs?: boolean
  functions?: boolean
  redirects?: boolean
  static?: boolean
}

interface HandleOptions {
  features?: Features
  projectRoot?: string
}

const defaultFeatures: Features = {
  blobs: true,
  functions: true,
  redirects: true,
  static: true,
}

const notFoundHandler = async () => new Response('Not found', { status: 404 })

export const handle = async (request: Request, options?: HandleOptions) => {
  const { features = defaultFeatures, projectRoot = process.cwd() } = options ?? {}
  const { config, siteID } = (await getConfig({ projectRoot })) ?? {}

  // Functions
  const userFunctionsPath = config?.config.functionsDirectory ?? path.join(projectRoot, 'netlify/functions')
  const userFunctionsPathExists = await isDirectory(userFunctionsPath)
  const functions = features.functions
    ? new FunctionsHandler({
        config,
        destPath: path.join(projectRoot, '.netlify', 'functions-serve'),
        projectRoot,
        settings: {},
        siteId: siteID,
        timeouts: {},
        userFunctionsPath: userFunctionsPathExists ? userFunctionsPath : undefined,
      })
    : null

  // Redirects
  const redirects = features.redirects
    ? new RedirectsHandler({
        configPath: config?.configPath,
        configRedirects: config?.config.redirects,
        jwtRoleClaim: '',
        jwtSecret: '',
        notFoundHandler,
        projectDir: projectRoot,
      })
    : null

  // Static files
  const staticFiles = features.static
    ? new StaticHandler({
        directory: config?.config.build.publish ?? projectRoot,
      })
    : null

  // Runtime
  const runtime = await getRuntime({
    blobs: Boolean(features.blobs),
    deployID: '0',
    projectRoot,
    siteID: siteID ?? '0',
  })

  // Try to match the request against the different steps in our request chain.
  //
  // https://docs.netlify.com/platform/request-chain/

  // 1. Check if the request matches a function.
  const functionMatch = await functions?.match(request)
  if (functionMatch) {
    // If the function prefers static files, check if there is a static match
    // and, if so, return that
    if (functionMatch.preferStatic) {
      const staticMatch = await staticFiles?.match(request)

      if (staticMatch) {
        return staticMatch.handle()
      }
    }

    // Let the function handle the request.
    return functionMatch.handle(request)
  }

  // 2. Check if the request matches a redirect rule.
  const redirectMatch = await redirects?.match(request)
  if (redirectMatch) {
    // If the redirect rule matches a function, we'll serve it. The exception
    // is if the function prefers static files, which in this case means that
    // we'll follow the redirect rule.
    const functionMatch = await functions?.match(new Request(redirectMatch.target))
    if (functionMatch && !functionMatch.preferStatic) {
      return functionMatch.handle(request)
    }

    const response = await redirects?.handle(request, redirectMatch, async (maybeStaticFile: Request) => {
      const staticMatch = await staticFiles?.match(maybeStaticFile)

      return staticMatch?.handle
    })
    if (response) {
      return response
    }
  }

  // 3. Check if the request matches a static file.
  const staticMatch = await staticFiles?.match(request)
  if (staticMatch) {
    return staticMatch.handle()
  }

  await runtime.stop()
}

interface StartOptions {
  projectRoot?: string
}

export const start = async (options?: StartOptions) => {
  const { projectRoot = process.cwd() } = options ?? {}
  const { siteID } = (await getConfig({ projectRoot })) ?? {}
  const runtime = await getRuntime({
    blobs: true,
    deployID: '0',
    projectRoot,
    siteID: siteID ?? '0',
  })

  return {
    stop: async () => {
      await runtime.stop()
    },
  }
}

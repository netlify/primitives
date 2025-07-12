import process from 'node:process'

import { defineNuxtModule } from '@nuxt/kit'
import { NetlifyDev } from '@netlify/dev'
import type { Features } from '@netlify/dev'
import { fromWebResponse, netlifyBanner, netlifyCommand } from '@netlify/dev-utils'
import type { Logger } from '@netlify/dev-utils'
import { defineLazyEventHandler, fromNodeMiddleware } from 'h3'

export type NetlifyModuleOptions = Features

const createPrefixedLogger = (prefix: string, logger: Logger) => ({
  log: (msg?: string) => {
    logger.log(`${prefix} ${msg ?? ''}`)
  },
  warn: (msg?: string) => {
    logger.warn(`${prefix} ${msg ?? ''}`)
  },
  error: (msg?: string) => {
    logger.error(`${prefix} ${msg ?? ''}`)
  },
})

export default defineNuxtModule<NetlifyModuleOptions>({
  meta: {
    name: '@netlify/nuxt',
    configKey: 'netlify',
  },
  defaults: {},
  async setup(options, nuxt) {
    // If we're already running inside the Netlify CLI, there is no need to run
    // the plugin, as the environment will already be configured.
    if (process.env.NETLIFY_DEV) {
      return
    }

    // For now, we only have dev mode functionality so bail early if we're not in dev mode.
    if (!(nuxt.options.dev || nuxt.options.test)) {
      return
    }

    const logger = createPrefixedLogger(netlifyBanner, console)
    const { blobs, edgeFunctions, functions, redirects } = options

    let netlifyDev!: NetlifyDev

    nuxt.hook('nitro:init', async (nitro) => {
      netlifyDev = new NetlifyDev({
        blobs,
        edgeFunctions,
        functions,
        logger,
        redirects,
        projectRoot: nuxt.options.rootDir,
        staticFiles: {
          ...options.staticFiles,
          directories: nitro.options.publicAssets.map((d) => d.dir),
        },
      })

      await netlifyDev.start()

      nuxt.hook('close', () => {
        netlifyDev.stop()
      })

      if (!netlifyDev.siteIsLinked) {
        logger.log(
          `💭 Linking this project to a Netlify site lets you deploy your site, use any environment variables defined on your team and site and much more. Run ${netlifyCommand('npx netlify init')} to get started.`,
        )
      }

      logger.log('Environment loaded')
    })

    nuxt.options.nitro.devHandlers ??= []
    nuxt.options.nitro.devHandlers.push({
      handler: defineLazyEventHandler(() => {
        logger.log(`Middleware loaded. Emulating features: ${netlifyDev.getEnabledFeatures().join(', ')}.`)
        return fromNodeMiddleware(async function netlifyPreMiddleware(nodeReq, nodeRes, next) {
          if (!netlifyDev) {
            return
          }
          const headers: Record<string, string> = {}
          const result = await netlifyDev.handleAndIntrospectNodeRequest(nodeReq, {
            headersCollector: (key, value) => {
              headers[key] = value
            },
            serverAddress: `http://localhost:${nodeReq.socket.localPort}`,
          })

          const isStaticFile = result?.type === 'static'

          // Don't serve static matches. Let the Nitro server handle them.
          if (result && !isStaticFile) {
            fromWebResponse(result.response, nodeRes)

            return
          }

          for (const key in headers) {
            nodeRes.setHeader(key, headers[key] ?? '')
          }

          next()
        })
      }),
    })
  },
})

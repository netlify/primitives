import process from 'node:process'

import { NetlifyDev, type Features } from '@netlify/dev'
import { fromWebResponse, netlifyCommand } from '@netlify/dev-utils'
import * as vite from 'vite'

import { createLoggerFromViteLogger } from './lib/logger.js'

export interface NetlifyPluginOptions extends Features {
  /**
   * Attach a Vite middleware that intercepts requests and handles them in the
   * same way as the Netlify production environment (default: true).
   */
  middleware?: boolean
}

export default function netlify(options: NetlifyPluginOptions = {}): any {
  // If we're already running inside the Netlify CLI, there is no need to run
  // the plugin, as the environment will already be configured.
  if (process.env.NETLIFY_DEV) {
    return []
  }

  const plugin: vite.Plugin = {
    name: 'vite-plugin-netlify',
    async configureServer(viteDevServer) {
      // if the vite dev server's http server isn't ready (or we're in
      // middleware mode) let's not get involved
      if (!viteDevServer.httpServer) {
        return
      }
      const logger = createLoggerFromViteLogger(viteDevServer.config.logger)
      const { blobs, edgeFunctions, functions, images, middleware = true, redirects, staticFiles } = options

      const netlifyDev = new NetlifyDev({
        blobs,
        edgeFunctions,
        functions,
        images,
        logger,
        redirects,
        serverAddress: null,
        staticFiles: {
          ...staticFiles,
          directories: [viteDevServer.config.root, viteDevServer.config.publicDir],
        },
        projectRoot: viteDevServer.config.root,
      })

      await netlifyDev.start()

      viteDevServer.httpServer.once('close', () => {
        netlifyDev.stop()
      })

      logger.log('Environment loaded')

      if (middleware) {
        viteDevServer.middlewares.use(async function netlifyPreMiddleware(nodeReq, nodeRes, next) {
          const headers: Record<string, string> = {}
          const result = await netlifyDev.handleAndIntrospectNodeRequest(nodeReq, {
            headersCollector: (key, value) => {
              headers[key] = value
            },
            serverAddress: `http://localhost:${nodeReq.socket.localPort}`,
          })

          const isStaticFile = result?.type === 'static'

          // Don't serve static matches. Let the Vite server handle them.
          if (result && !isStaticFile) {
            fromWebResponse(result.response, nodeRes)

            return
          }

          for (const key in headers) {
            nodeRes.setHeader(key, headers[key])
          }

          next()
        })

        logger.log(`Middleware loaded. Emulating features: ${netlifyDev.getEnabledFeatures().join(', ')}.`)
      }

      if (!netlifyDev.siteIsLinked) {
        logger.log(
          `💭 Linking this project to a Netlify site lets you deploy your site, use any environment variables defined on your team and site and much more. Run ${netlifyCommand('npx netlify init')} to get started.`,
        )
      }
    },
  }

  return [plugin]
}

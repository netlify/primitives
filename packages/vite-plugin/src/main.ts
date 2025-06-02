import process from 'node:process'

import { NetlifyDev, type Features } from '@netlify/dev'
import * as vite from 'vite'

import { logger } from './lib/logger.js'
import { fromWebResponse, toWebRequest } from './lib/reqres.js'

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
      const { port } = viteDevServer.config.server
      const { blobs, edgeFunctions, functions, middleware = true, redirects, staticFiles } = options
      const netlifyDev = new NetlifyDev({
        blobs,
        edgeFunctions,
        functions,
        logger,
        redirects,
        serverAddress: `http://localhost:${port}`,
        staticFiles,
        projectRoot: viteDevServer.config.root,
      })

      await netlifyDev.start()

      if (!netlifyDev.siteIsLinked) {
        logger.log('Your project is not linked to a Netlify site. Run `npx netlify link` to get started.')
      }

      if (middleware) {
        viteDevServer.middlewares.use(async function netlifyPreMiddleware(nodeReq, nodeRes, next) {
          const req = toWebRequest(nodeReq, nodeReq.originalUrl)
          const headers: Record<string, string> = {}
          const result = await netlifyDev.handleAndIntrospect(req, {
            headersCollector: (key, value) => {
              headers[key] = value
            },
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
      }
    },
  }

  return [plugin]
}

import { NetlifyDev, type Features } from '@netlify/dev'
import * as vite from 'vite'

import { logger } from './lib/logger.js'
import { fromWebResponse, toWebRequest } from './lib/reqres.js'

export interface NetlifyPluginOptions extends Features {
  /**
   * Attach a Vite middleware that intercepts requests and handles them in the
   * same way as the Netlify production environment.
   */
  middleware?: boolean
}

export default function netlify(options: NetlifyPluginOptions = {}): any {
  const plugin: vite.Plugin = {
    name: 'vite-plugin-netlify',
    async configureServer(viteDevServer) {
      const { blobs, functions, middleware = true, redirects, staticFiles } = options
      const netlifyDev = new NetlifyDev({
        blobs,
        functions,
        logger,
        redirects,
        staticFiles,
        projectRoot: viteDevServer.config.root,
      })

      await netlifyDev.start()

      if (!netlifyDev.siteIsLinked) {
        logger.log(
          'Your project is not linked to a Netlify site. Refer to https://ntl.fyi/vite-link for more information.',
        )
      }

      if (middleware) {
        return () => {
          viteDevServer.middlewares.use(async (nodeReq, nodeRes, next) => {
            const req = toWebRequest(nodeReq, nodeReq.originalUrl)
            const res = await netlifyDev.handle(req)

            if (res) {
              fromWebResponse(res, nodeRes)
            } else {
              next()
            }
          })
        }
      }
    },
  }

  return [plugin]
}

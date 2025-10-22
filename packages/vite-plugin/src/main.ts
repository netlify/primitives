import process from 'node:process'

import { NetlifyDev, type Features } from '@netlify/dev'
import { fromWebResponse, netlifyCommand, warning } from '@netlify/dev-utils'
import dedent from 'dedent'
import type { Plugin } from 'vite'

import { createLoggerFromViteLogger, type Logger } from './lib/logger.js'
import { createBuildPlugin } from './lib/build.js'

export interface NetlifyPluginOptions extends Features {
  /**
   * Attach a Vite middleware that intercepts requests and handles them in the
   * same way as the Netlify production environment (default: true).
   */
  middleware?: boolean

  /**
   * DO NOT USE - build options, not meant for public use at this time.
   * @private
   */
  build?: {
    /**
     * Prepare the server build for deployment to Netlify - no additional configuration,
     * plugins, or adapters necessary (default: false).
     *
     * This is currently only supported for TanStack Start projects.
     */
    enabled?: boolean
    /**
     * Deploy SSR handler to Netlify Edge Functions instead of Netlify Functions (default: false).
     */
    edgeSSR?: boolean
    /**
     * A display name for the serverless function or edge function deployed to Netlify
     * (default: `@netlify/vite-plugin server handler`).
     */
    displayName?: string
  }
}

// FIXME(serhalp): This should return `Plugin[]`.
export default function netlify(options: NetlifyPluginOptions = {}): any {
  // If we're already running inside the Netlify CLI, there is no need to run
  // the plugin, as the environment will already be configured.
  if (process.env.NETLIFY_DEV) {
    return []
  }

  const devPlugin: Plugin = {
    name: 'vite-plugin-netlify',

    async configureServer(viteDevServer) {
      // if the vite dev server's http server isn't ready (or we're in
      // middleware mode) let's not get involved
      if (!viteDevServer.httpServer) {
        return
      }

      const logger = createLoggerFromViteLogger(viteDevServer.config.logger)

      warnOnDuplicatePlugin(logger)

      const {
        blobs,
        edgeFunctions,
        environmentVariables,
        functions,
        images,
        middleware = true,
        redirects,
        staticFiles,
      } = options

      const netlifyDev = new NetlifyDev({
        blobs,
        edgeFunctions,
        environmentVariables,
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
        // The whole vite dev instance has stopped, so reset the duplicate plugin tracker.
        // For example, this happens when a user makes a change to `vite.config.ts` and a new server starts.
        // We shouldn't print a false positive warning in these cases.
        delete process.env.__VITE_PLUGIN_NETLIFY_LOADED__

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

  const { enabled, ...buildOptions } = options.build ?? {}
  return [devPlugin, ...(enabled === true ? [createBuildPlugin(buildOptions)] : [])]
}

const warnOnDuplicatePlugin = (logger: Logger) => {
  if (process.env.__VITE_PLUGIN_NETLIFY_LOADED__) {
    logger.warn(
      warning(dedent`
        Multiple instances of @netlify/vite-plugin have been loaded. This may cause unexpected \
        behavior if the plugin is configured differently in each instance. If you have one \
        instance of this plugin in your Vite config, you may safely remove it.
      `),
    )
    return
  }
  process.env.__VITE_PLUGIN_NETLIFY_LOADED__ = 'true'
}

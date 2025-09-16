import { type Features } from '@netlify/dev'
import createNetlifyPlugin from '@netlify/vite-plugin'

export interface PluginOptions {
  /**
   * Deploy SSR handler to Netlify Edge Functions instead of Netlify Functions (default: false).
   */
  edgeSSR?: boolean
  /**
   * Optional configuration of Netlify dev features
   * @see {link https://www.npmjs.com/package/@netlify/vite-plugin}
   */
  dev?: Features
}

export default function createNetlifyTanstackStartPlugin(options: PluginOptions = {}) {
  const netlifyPlugin = createNetlifyPlugin({
    build: {
      enabled: true,
      edgeSSR: options.edgeSSR ?? false,
    },
    ...options.dev,
  })
  return netlifyPlugin
}

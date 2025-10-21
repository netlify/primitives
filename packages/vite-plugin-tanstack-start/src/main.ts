import type { Plugin } from 'vite'
import createNetlifyPlugin, { type NetlifyPluginOptions } from '@netlify/vite-plugin'

type DevOptions = Omit<NetlifyPluginOptions, 'build' | 'middleware'>

export interface PluginOptions {
  /**
   * Deploy SSR handler to Netlify Edge Functions instead of Netlify Functions (default: false).
   */
  edgeSSR?: boolean
  /**
   * Optional configuration of Netlify dev features
   * @see {link https://www.npmjs.com/package/@netlify/vite-plugin}
   */
  dev?: DevOptions
}

export default function createNetlifyTanstackStartPlugin(options: PluginOptions = {}): Plugin[] {
  const netlifyPlugin = createNetlifyPlugin({
    build: {
      enabled: true,
      edgeSSR: options.edgeSSR ?? false,
    },
    ...options.dev,
  }) as Plugin[]
  return netlifyPlugin
}

import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { sep as posixSep } from 'node:path/posix'

import js from 'dedent'
import type { Plugin, ResolvedConfig, Rollup } from 'vite'

import { createLoggerFromViteLogger } from './logger.js'
import { version, name } from '../../package.json'

// https://docs.netlify.com/frameworks-api/#netlify-v1-functions
const NETLIFY_FUNCTIONS_DIR = '.netlify/v1/functions'

const NETLIFY_FUNCTION_FILENAME = 'server.mjs'
const NETLIFY_FUNCTION_DEFAULT_NAME = '@netlify/vite-plugin server handler'

const toPosixPath = (path: string) => path.split(sep).join(posixSep)

// Generate the Netlify function that imports the built server entry point
const createNetlifyFunctionHandler = (
  /**
   * The path to the server entry point, relative to the Netlify functions directory.
   * This must be a resolvable node module path on all platforms.
   */
  serverEntrypointPath: string,
  displayName: string,
) => js`
import serverEntrypoint from "${serverEntrypointPath}";

if (typeof serverEntrypoint?.fetch !== "function") {
  console.error("The server entry point must have a default export with a property \`fetch: (req: Request) => Promise<Response>\`");
}

export default serverEntrypoint.fetch;

export const config = {
  name: "${displayName}",
  generator: "${name}@${version}",
  path: "/*",
  preferStatic: true,
};
`
// TODO(serhalp): In the future, support Remix/RR7 by allowing a custom `getServerEntrypoint`
// passed as a plugin opt.
const getServerEntrypoint = (bundle: Rollup.OutputBundle, outDir: string): string => {
  // Find the built server entry point file in the bundle.
  // NOTE: This assumes there is only one BUNDLE entry and that this is the SERVER request entry point. This is an
  // assumption that everyone in the Vite ecosystem seems to make and it holds for our supported frameworks.
  const entryChunks = Object.values(bundle).filter(
    (chunk): chunk is Rollup.OutputChunk => chunk.type === 'chunk' && chunk.isEntry,
  )
  if (entryChunks.length === 0) {
    throw new Error('Could not find entry chunk in bundle - aborting!')
  }
  if (entryChunks.length > 1) {
    throw new Error('Found multiple entry chunks, unable to resolve server entry point - aborting!')
  }
  return join(outDir, entryChunks[0].fileName)
}

export function createBuildPlugin(options?: { displayName?: string; edgeSSR?: boolean }): Plugin {
  let resolvedConfig: ResolvedConfig

  return {
    name: 'vite-plugin-netlify:build',
    apply: 'build',
    /** @see {@link https://vite.dev/guide/api-environment-plugins.html#per-environment-plugins} */
    applyToEnvironment({ name }) {
      // There is a backwards-compatible environment with the name `ssr`:
      // https://vite.dev/guide/api-environment-runtimes.html#creating-a-new-environment-factory.
      // Eventually, to support more advanced configurations, we'll change this condition
      // to `consumer === 'server'` and pass down request routing metadata.
      return name === 'ssr'
    },
    /** @see {@link https://vite.dev/guide/api-plugin.html#configresolved} */
    configResolved(config) {
      resolvedConfig = config
    },

    /** @see {@link https://rollupjs.org/plugin-development/#writebundle} */
    async writeBundle(_, bundle) {
      // Get the built server entry point and write a Netlify function with a handler that calls it
      const functionsDirectory = join(resolvedConfig.root, NETLIFY_FUNCTIONS_DIR)
      await mkdir(functionsDirectory, { recursive: true })
      const serverEntrypoint = getServerEntrypoint(bundle, resolvedConfig.build.outDir)
      const serverEntrypointRelativePath = toPosixPath(relative(functionsDirectory, serverEntrypoint))
      await writeFile(
        join(functionsDirectory, NETLIFY_FUNCTION_FILENAME),
        createNetlifyFunctionHandler(
          serverEntrypointRelativePath,
          options?.displayName ?? NETLIFY_FUNCTION_DEFAULT_NAME,
        ),
      )
      createLoggerFromViteLogger(resolvedConfig.logger).log(
        `✓ Wrote SSR entry point to ${join(NETLIFY_FUNCTIONS_DIR, NETLIFY_FUNCTION_FILENAME)}\n`,
      )
    },
  }
}

import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { sep as posixSep } from 'node:path/posix'

import js from 'dedent'
import type { Plugin, ResolvedConfig, Rollup } from 'vite'

import { version, name } from '../package.json'

// https://docs.netlify.com/frameworks-api/#netlify-v1-functions
const NETLIFY_FUNCTIONS_DIR = '.netlify/v1/functions'

const FUNCTION_FILENAME = 'server.mjs'

const toPosixPath = (path: string) => path.split(sep).join(posixSep)

// Generate the Netlify function that imports the built server entry point
const createNetlifyFunctionHandler = (
  /**
   * The path to the server entry point, relative to the Netlify functions directory.
   * This must be a resolvable node module path on all platforms.
   */
  serverEntrypointPath: string,
) => js`
import serverEntrypoint from "${serverEntrypointPath}";

if (typeof serverEntrypoint?.fetch !== "function") {
  console.error("The server entry point must follow the semi-standard export { fetch: (req: Request) => Promise<Response> } format");
}

export default serverEntrypoint.fetch;

export const config = {
  name: "@netlify/vite-plugin server handler",
  generator: "${name}@${version}",
  path: "/*",
  preferStatic: true,
};
`

export interface Options {
  /**
   * An optional function that receives the server bundle and output directory, and returns
   * the path to the server entry point file. If the returned path is relative, it must start
   * with the provided `outDir`.
   *
   * This generally should not be provided, as the default implementation works for most
   * cases. It is provided for advanced use cases, such as composing this plugin to handle
   * a metaframework that does not produce a server entry point at all (hello, Remix and
   * React Router 7).
   */
  getServerEntrypoint?: (bundle: Rollup.OutputBundle, outDir: string) => string
}

export function createBuildPlugin(options?: Options): Plugin {
  const getServerEntrypoint =
    options?.getServerEntrypoint ??
    ((bundle, outDir): string => {
      // Find the built server entry point file in the bundle.
      // WARN: This assumes there is only one BUNDLE entry and that this is the SERVER request entry point.
      const entryChunk = Object.values(bundle).find(
        (chunk): chunk is Rollup.OutputChunk => chunk.type === 'chunk' && chunk.isEntry,
      )
      if (!entryChunk) {
        throw new Error('Could not find entry chunk in bundle - aborting!')
      }
      return join(outDir, entryChunk.fileName)
    })

  let resolvedConfig: ResolvedConfig

  return {
    name: 'vite-plugin-netlify:build',
    apply: 'build',

    applyToEnvironment(environment) {
      // Apply this to any and all environments that build for the server. Generally this is just 'ssr', but
      // users, metaframeworks, and other plugins may have others, such as `rsc`.
      // TODO(serhalp): This isn't actually fully implemented. We'd need to hold on to all the `originalEntrypoint`s,
      // repeat the `writeBundle` step for each one, and thread routing information through to the function config.
      return environment.config.consumer === 'server'
    },

    configResolved(config) {
      resolvedConfig = config
    },

    // See https://rollupjs.org/plugin-development/#writebundle.
    async writeBundle(_, bundle) {
      // Get the built server entry point and write a Netlify function with a handler that calls it
      const serverEntrypoint = getServerEntrypoint(bundle, resolvedConfig.build.outDir)
      const functionsDirectory = join(resolvedConfig.root, NETLIFY_FUNCTIONS_DIR)
      await mkdir(functionsDirectory, { recursive: true })
      const serverEntrypointRelativePath = serverEntrypoint.startsWith('virtual:')
        ? serverEntrypoint // Use virtual module ID directly
        : toPosixPath(relative(functionsDirectory, serverEntrypoint))
      await writeFile(
        join(functionsDirectory, FUNCTION_FILENAME),
        createNetlifyFunctionHandler(serverEntrypointRelativePath),
      )
    },
  }
}
